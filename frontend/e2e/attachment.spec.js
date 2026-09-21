import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Attachment (file send) browser regression test.
//
// Verifies, against a REAL running app, that:
//   • attaching a file renders exactly one composer preview
//   • ONE click on Send issues exactly ONE POST /api/messages/send/:id
//   • a 201 clears the composer (and the attachment is downloadable byte-for-byte)
//   • a failing upload (503) surfaces the error and KEEPS the attachment
//
// Requirements: backend + frontend dev servers running, and a real session cookie
// supplied via VYNTRA_TEST_JWT (DevTools → Application → Cookies → copy `jwt`).
// Without it the tests skip instead of failing.
//
//   $env:VYNTRA_TEST_JWT="<jwt cookie>"; npx playwright test --config=playwright.config.js
//
// NOTE: test A really sends one attachment and test B one short text to your
// most recent conversation. If you want them gone, remove the generated rows:
//   db.messages.deleteMany({ fileName: /^e2e-/ })   // plus the "e2e browser text check" row

const TOKEN = process.env.VYNTRA_TEST_JWT;
const BASE = process.env.VYNTRA_BASE || "http://localhost:5174";
const TMP = path.join(os.tmpdir(), "vyntra-browser-test");
const PDF = path.join(TMP, "e2e-browser.pdf");
const SEND_RE = /\/api\/messages\/send\//;

test.skip(!TOKEN, "Set VYNTRA_TEST_JWT to a real jwt cookie value to run this suite.");

// The composer's attachment row ("mb-3 … gap-3") holds the file name; message
// bubbles use different classes, so this pinpoints the composer preview rather
// than the sent bubble. `.last()` keeps strict mode happy (the row can also sit
// inside a similarly-named wrapper).
const composerPreview = (page, name) =>
  page
    .locator('div[class*="mb-3"][class*="gap-3"]')
    .filter({ hasText: name })
    .last();

test.beforeAll(() => {
  fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(
    PDF,
    Buffer.concat([
      Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<<>>\n"),
      Buffer.alloc(1024, 0x20),
      Buffer.from("%%EOF\n"),
    ])
  );
});

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    { name: "jwt", value: TOKEN, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
});

async function openConversation(page) {
  await page.goto(BASE);
  const firstChat = page.locator('[role="option"]').first();
  await firstChat.waitFor({ timeout: 40_000 });
  await firstChat.click();
  await expect(page.getByPlaceholder(/Type a message/)).toBeVisible();
}

test("A. attach a PDF and send: exactly ONE POST, 201, preview cleared", async ({ page }) => {
  const posts = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && SEND_RE.test(r.url())) posts.push(r.url());
  });

  await openConversation(page);

  await page.locator('input[type="file"]:not([accept])').setInputFiles(PDF);
  await expect(composerPreview(page, "e2e-browser.pdf")).toBeVisible();

  const respPromise = page.waitForResponse(
    (r) => r.request().method() === "POST" && SEND_RE.test(r.url()),
    { timeout: 40_000 }
  );
  await page.getByTitle("Send").click();
  const resp = await respPromise;
  const body = await resp.json();

  await page.waitForTimeout(2000); // let any (incorrect) duplicate fire

  expect(posts.length, `POST count for ONE user action (urls: ${JSON.stringify(posts)})`).toBe(1);
  expect(resp.status()).toBe(201);
  expect(typeof body.fileUrl).toBe("string");
  expect(body.fileName).toBe("e2e-browser.pdf");
  await expect(composerPreview(page, "e2e-browser.pdf")).toHaveCount(0); // composer cleared

  // The sent bubble must expose the file to the receiver, and the receiver's
  // Download action must actually produce the file.
  await expect(page.locator('[title="Download"]').last()).toBeVisible({ timeout: 10_000 });
  const downloadPromise = page.waitForEvent("download", { timeout: 20_000 });
  await page.locator('[title="Download"]').last().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("e2e-browser.pdf");
  const savedTo = path.join(TMP, "downloaded.pdf");
  await download.saveAs(savedTo);
  const downloadedBytes = fs.readFileSync(savedTo);
  const originalBytes = fs.readFileSync(PDF);
  expect(downloadedBytes.length).toBe(originalBytes.length);
  expect(downloadedBytes.equals(originalBytes)).toBe(true);

  console.log(
    `[A] status=${resp.status()} code=${body.code || "none"} fileUrlKind=${
      body.fileUrl.startsWith("data:") ? "data-url" : "https"
    } downloaded=${downloadedBytes.length}B identical=true`
  );
});

test("B. text-only send: exactly ONE POST, 201", async ({ page }) => {
  const posts = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && SEND_RE.test(r.url())) posts.push(r.url());
  });

  await openConversation(page);
  await page.getByPlaceholder(/Type a message/).fill("e2e browser text check");
  const respPromise = page.waitForResponse(
    (r) => r.request().method() === "POST" && SEND_RE.test(r.url()),
    { timeout: 40_000 }
  );
  await page.getByTitle("Send").click();
  const resp = await respPromise;
  await page.waitForTimeout(1500);

  expect(posts.length, `POST count for ONE user action (urls: ${JSON.stringify(posts)})`).toBe(1);
  expect(resp.status()).toBe(201);
  console.log(`[B] status=${resp.status()}`);
});

test("C. storage 503 (simulated): one POST, error surfaced, attachment NOT cleared", async ({ page }) => {
  const posts = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && SEND_RE.test(r.url())) posts.push(r.url());
  });
  await page.route("**/api/messages/send/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        code: "MEDIA_STORAGE_UNAVAILABLE",
        message: "Media storage is not configured.",
      }),
    })
  );

  await openConversation(page);
  await page.locator('input[type="file"]:not([accept])').setInputFiles(PDF);
  const preview = composerPreview(page, "e2e-browser.pdf");
  await expect(preview).toBeVisible();

  const respPromise = page.waitForResponse(
    (r) => r.request().method() === "POST" && SEND_RE.test(r.url()),
    { timeout: 40_000 }
  );
  await page.getByTitle("Send").click();
  const resp = await respPromise;
  await page.waitForTimeout(2000);

  expect(posts.length, `POST count for ONE user action (urls: ${JSON.stringify(posts)})`).toBe(1);
  expect(resp.status()).toBe(503);
  // Failure must be surfaced and the attachment must still be there for a retry.
  await expect(page.getByText("Media storage is not configured.").first()).toBeVisible();
  await expect(preview).toBeVisible();
  console.log(`[C] status=${resp.status()} attachmentKept=true`);
});
