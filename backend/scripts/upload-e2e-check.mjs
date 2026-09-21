/**
 * Vyntra — REAL end-to-end attachment check (no mocks).
 *
 * What it does:
 *   1) Connects to the same MongoDB the backend uses and picks two real,
 *      non-test accounts (sender / receiver).
 *   2) Mints real JWTs with the backend's own JWT_SECRET (no password needed)
 *      and calls the RUNNING backend over HTTP exactly like the browser does:
 *         POST /api/messages/send/:receiverId
 *   3) Prints the real status code + response `code`/`message` for every case.
 *   4) Verifies the production "storage unavailable" branch in a child process.
 *   5) Deletes every message it created (clean-up) before exiting.
 *
 * Usage (from the backend/ folder, with the backend running):
 *   node scripts/upload-e2e-check.mjs
 *   node scripts/upload-e2e-check.mjs --base http://localhost:5000
 */

import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

import { ENV } from "../src/lib/env.js";
import User from "../src/models/User.js";
import Message from "../src/models/Message.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argBase = process.argv.indexOf("--base");
const BASE = argBase > -1 ? process.argv[argBase + 1] : `http://localhost:${ENV.PORT || 5000}`;

const MB = 1024 * 1024;
const b64 = (buf) => Buffer.from(buf).toString("base64");
const dataUrl = (mime, buf) => `data:${mime};base64,${b64(buf)}`;

const pdfBytes = Buffer.concat([
  Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n"),
  Buffer.alloc(256, 0x20),
  Buffer.from("%%EOF\n"),
]);
const docxBytes = Buffer.from("PK\u0003\u0004mock-docx-payload-for-validation-only");
const zipBytes = Buffer.from("PK\u0003\u0004mock-zip-payload");
const txtBytes = Buffer.from("hello vyntra attachment test\n");
const csvBytes = Buffer.from("a,b\n1,2\n");

const createdIds = [];
let pass = 0;
let fail = 0;

const row = (name, expected, got, ok, extra = "") => {
  if (ok) pass++;
  else fail++;
  console.log(
    `${ok ? "PASS" : "FAIL"} | ${name.padEnd(46)} | expected ${String(expected).padEnd(30)} | got ${got}${extra ? " | " + extra : ""}`
  );
};

async function post(pathname, body, token) {
  const res = await fetch(`${BASE}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `jwt=${token}` },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 80) };
  }
  return { status: res.status, json };
}

const describeUrl = (value) => {
  if (typeof value !== "string" || !value) return String(value);
  if (value.startsWith("data:")) return `data-url(${value.slice(0, 24)}… ${Math.round(value.length / 1024)}KB)`;
  return value.slice(0, 48);
};

async function main() {
  if (!ENV.MONGO_URI || !ENV.JWT_SECRET) {
    console.error("MONGO_URI / JWT_SECRET missing — cannot run. Aborting.");
    process.exit(2);
  }

  await mongoose.connect(ENV.MONGO_URI);

  const candidates = await User.find({ role: { $nin: ["test", "system"] } })
    .select("_id fullName role")
    .sort({ lastSeen: -1, createdAt: -1 })
    .limit(20)
    .lean();

  const real = candidates.filter(
    (u) => !/^(QA|Test|Demo|Mock|Fixture|System|Bot|Auto)\b/i.test(u.fullName || "")
  );
  if (real.length < 2) {
    console.error(`Need 2 real accounts to test with, found ${real.length}. Aborting.`);
    await mongoose.disconnect();
    process.exit(2);
  }

  const [receiver, sender] = real;
  const token = jwt.sign({ userId: String(sender._id) }, ENV.JWT_SECRET, { expiresIn: "1h" });
  const url = `/api/messages/send/${receiver._id}`;

  console.log(`\nBase URL        : ${BASE}`);
  console.log(`NODE_ENV        : ${ENV.NODE_ENV}`);
  const PLACEHOLDER = /your_|changeme|replace[_-]?me|^<.*>$|^(dummy|placeholder|example|xxx+)$/i;
  const looksReal = (v) => Boolean(String(v || "").trim()) && !PLACEHOLDER.test(String(v).trim());
  console.log(
    `Cloudinary      : cloudNameSet=${Boolean(ENV.CLOUDINARY_CLOUD_NAME)} apiKeySet=${Boolean(ENV.CLOUDINARY_API_KEY)} apiSecretSet=${Boolean(ENV.CLOUDINARY_API_SECRET)}` +
      ` configured(no-placeholders)=${looksReal(ENV.CLOUDINARY_CLOUD_NAME) && looksReal(ENV.CLOUDINARY_API_KEY) && looksReal(ENV.CLOUDINARY_API_SECRET)}`
  );
  console.log(`sender->receiver: ${sender._id} -> ${receiver._id}\n`);
  console.log("── A. HTTP attachment tests (real POSTs against the running backend) ──");

  // A1 — text only (no storage needed)
  {
    const r = await post(url, { text: "e2e text-only" }, token);
    if (r.json?._id) createdIds.push(r.json._id);
    row("A1 text-only message", "201", r.status, r.status === 201 && !r.json.fileUrl);
  }

  // A2 — small PDF (the reported failing case)
  {
    const r = await post(
      url,
      {
        fileUrl: dataUrl("application/pdf", pdfBytes),
        fileName: "e2e-check.pdf",
        fileType: "application/pdf",
        fileSize: pdfBytes.length,
      },
      token
    );
    if (r.json?._id) createdIds.push(r.json._id);
    const ok = r.status === 201 && typeof r.json.fileUrl === "string" && r.json.fileUrl.length > 0;
    row(
      "A2 PDF attachment (declared application/pdf)",
      "201",
      `${r.status} ${r.json.code || ""}`.trim(),
      ok,
      describeUrl(r.json.fileUrl)
    );
  }

  // A3 — DOCX
  {
    const r = await post(
      url,
      {
        fileUrl: dataUrl(
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          docxBytes
        ),
        fileName: "e2e-check.docx",
        fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileSize: docxBytes.length,
      },
      token
    );
    if (r.json?._id) createdIds.push(r.json._id);
    row("A3 DOCX attachment", "201", `${r.status} ${r.json.code || ""}`.trim(), r.status === 201);
  }


  // A4 — ZIP
  {
    const r = await post(
      url,
      {
        fileUrl: dataUrl("application/zip", zipBytes),
        fileName: "e2e-check.zip",
        fileType: "application/zip",
        fileSize: zipBytes.length,
      },
      token
    );
    if (r.json?._id) createdIds.push(r.json._id);
    row("A4 ZIP attachment", "201", `${r.status} ${r.json.code || ""}`.trim(), r.status === 201);
  }

  // A5 — RAR with an EMPTY browser MIME + generic data URL MIME (worst case)
  {
    const r = await post(
      url,
      {
        fileUrl: dataUrl("application/octet-stream", zipBytes),
        fileName: "e2e-check.rar",
        fileType: "application/octet-stream",
        fileSize: zipBytes.length,
      },
      token
    );
    if (r.json?._id) createdIds.push(r.json._id);
    row("A5 RAR, generic/empty browser MIME", "201", `${r.status} ${r.json.code || ""}`.trim(), r.status === 201);
  }

  // A6 — TXT
  {
    const r = await post(
      url,
      {
        fileUrl: dataUrl("text/plain", txtBytes),
        fileName: "e2e-check.txt",
        fileType: "text/plain",
        fileSize: txtBytes.length,
      },
      token
    );
    if (r.json?._id) createdIds.push(r.json._id);
    row("A6 TXT attachment", "201", `${r.status} ${r.json.code || ""}`.trim(), r.status === 201);
  }

  // A7 — CSV
  {
    const r = await post(
      url,
      {
        fileUrl: dataUrl("text/csv", csvBytes),
        fileName: "e2e-check.csv",
        fileType: "text/csv",
        fileSize: csvBytes.length,
      },
      token
    );
    if (r.json?._id) createdIds.push(r.json._id);
    row("A7 CSV attachment", "201", `${r.status} ${r.json.code || ""}`.trim(), r.status === 201);
  }

  // A8 — PDF with an EMPTY data-URL MIME and no declared MIME (extension-only path)
  {
    const r = await post(url, { fileUrl: dataUrl("", pdfBytes), fileName: "e2e-check-empty.pdf" }, token);
    if (r.json?._id) createdIds.push(r.json._id);
    row("A8 PDF, empty MIME + no fileType", "201", `${r.status} ${r.json.code || ""}`.trim(), r.status === 201);
  }

  // A9 — invalid extension must be rejected
  {
    const r = await post(
      url,
      {
        fileUrl: dataUrl("application/octet-stream", zipBytes),
        fileName: "malware.exe",
        fileType: "application/octet-stream",
        fileSize: zipBytes.length,
      },
      token
    );
    row(
      "A9 .exe rejected",
      "400 MEDIA_VALIDATION_FAILED",
      `${r.status} ${r.json.code || ""}`.trim(),
      r.status === 400 && r.json.code === "MEDIA_VALIDATION_FAILED"
    );
  }

  // A10 — mismatched MIME for a .pdf name must be rejected
  {
    const r = await post(
      url,
      {
        fileUrl: dataUrl("text/html", txtBytes),
        fileName: "e2e-check.pdf",
        fileType: "text/html",
        fileSize: txtBytes.length,
      },
      token
    );
    row(
      "A10 .pdf w/ text/html MIME rejected",
      "400 MEDIA_VALIDATION_FAILED",
      `${r.status} ${r.json.code || ""}`.trim(),
      r.status === 400 && r.json.code === "MEDIA_VALIDATION_FAILED"
    );
  }

  // A11 — over the 5 MB per-file limit (but under the 8 MB JSON body limit)
  {
    const big = Buffer.alloc(5 * MB + 512 * 1024, 0x41);
    const r = await post(
      url,
      {
        fileUrl: dataUrl("application/pdf", big),
        fileName: "e2e-too-big.pdf",
        fileType: "application/pdf",
        fileSize: big.length,
      },
      token
    );
    row(
      "A11 5.5 MB PDF rejected",
      "400 MEDIA_VALIDATION_FAILED",
      `${r.status} ${r.json.code || ""}`.trim(),
      r.status === 400 && r.json.code === "MEDIA_VALIDATION_FAILED"
    );
  }

  // A12 — already-hosted http(s) fileUrl must be stored as-is (no re-upload, no storage needed)
  {
    const hosted = "https://example.com/already-hosted.pdf";
    const r = await post(
      url,
      { fileUrl: hosted, fileName: "hosted.pdf", fileType: "application/pdf", fileSize: 1234 },
      token
    );
    if (r.json?._id) createdIds.push(r.json._id);
    row(
      "A12 pre-hosted https fileUrl passthrough",
      "201 + url unchanged",
      `${r.status} ${r.json.code || ""}`.trim(),
      r.status === 201 && r.json.fileUrl === hosted
    );
  }

  // A13 — body above the 8 MB JSON limit (informational: must NOT be unbounded)
  {
    const huge = JSON.stringify({ text: "x".repeat(9 * MB) });
    const r = await post(url, huge, token);
    row("A13 9 MB body", "413/400 (bounded, never unbounded)", r.status, r.status === 413 || r.status === 400);
  }

  console.log("\n── B. Production storage-missing branch (child process, no server) ──");
  {
    const modulePath = pathToFileURL(path.join(HERE, "../src/lib/uploadValidation.js")).href;
    const code = `
      import { uploadFile } from ${JSON.stringify(modulePath)};
      const url = "data:application/pdf;base64," + Buffer.from("%PDF-1.4\\n%%EOF\\n").toString("base64");
      try {
        await uploadFile(url, "vyntra/files", "prod-check.pdf", "application/pdf");
        console.log(JSON.stringify({ threw: false }));
      } catch (e) {
        console.log(JSON.stringify({ threw: true, statusCode: e.statusCode, code: e.code, message: e.message }));
      }
    `;
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", code], {
      cwd: path.join(HERE, ".."),
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        CLOUDINARY_CLOUD_NAME: "your_cloud_name",
        CLOUDINARY_API_KEY: "your_api_key",
        CLOUDINARY_API_SECRET: "your_api_secret",
      },
    });
    const out = (child.stdout || "").trim().split("\n").filter(Boolean).pop() || "";
    let parsed = null;
    try {
      parsed = JSON.parse(out);
    } catch {
      parsed = null;
    }
    const ok = !!parsed && parsed.threw === true && parsed.statusCode === 503 && parsed.code === "MEDIA_STORAGE_UNAVAILABLE";
    row(
      "B1 prod + unconfigured storage",
      "503 MEDIA_STORAGE_UNAVAILABLE",
      parsed ? `${parsed.statusCode} ${parsed.code}` : `no-json (${out || (child.stderr || "").slice(0, 140)})`,
      ok
    );
  }

  console.log("\n── C. Clean-up ──");
  if (createdIds.length) {
    const del = await Message.deleteMany({ _id: { $in: createdIds } });
    console.log(`Deleted ${del.deletedCount} test message(s) created by this run.`);
  } else {
    console.log("No messages to delete.");
  }

  await mongoose.disconnect();
  console.log(`\nRESULT: ${pass} passed, ${fail} failed.`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("E2E check crashed:", err?.message || err);
  try {
    if (createdIds.length) await Message.deleteMany({ _id: { $in: createdIds } });
    await mongoose.disconnect();
  } catch {
    /* ignore clean-up errors */
  }
  process.exit(3);
});
