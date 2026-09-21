import cloudinary from "./cloudinary.js";
import { ENV } from "./env.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_AUDIO_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const PLACEHOLDER_PATTERNS = [
  /your_/i,
  /changeme/i,
  /<.*>/,
  /replace[_-]?me/i,
  /^(dummy|placeholder|example|xxx+)$/i,
];

const isConfigured = (value) => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return Boolean(trimmed) && !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
};

function requireCloudinaryConfig() {
  if (
    !isConfigured(ENV.CLOUDINARY_CLOUD_NAME) ||
    !isConfigured(ENV.CLOUDINARY_API_KEY) ||
    !isConfigured(ENV.CLOUDINARY_API_SECRET)
  ) {
    const error = new Error("Media storage is not configured.");
    error.statusCode = 503;
    error.code = "MEDIA_STORAGE_UNAVAILABLE";
    throw error;
  }
}

// Whether real Cloudinary credentials are present (and not placeholders).
// Mirrors the same placeholder detection used above so a shipped template
// .env (your_cloud_name / your_api_key / your_api_secret) is treated as
// "not configured" rather than silently used.
const cloudinaryConfigured = () =>
  isConfigured(ENV.CLOUDINARY_CLOUD_NAME) &&
  isConfigured(ENV.CLOUDINARY_API_KEY) &&
  isConfigured(ENV.CLOUDINARY_API_SECRET);

let storageFallbackWarned = false;

// Resolve how media is persisted:
//  • Cloudinary configured -> null  (caller proceeds with a real upload)
//  • Not configured + development -> the validated data URL itself (deterministic,
//    genuinely usable by the receiver — never a fake URL).
//  • Not configured + production   -> throw 503 MEDIA_STORAGE_UNAVAILABLE.
function resolveStorageOrFallback(dataUrl) {
  if (cloudinaryConfigured()) return null;
  if (ENV.NODE_ENV !== "production") {
    if (!storageFallbackWarned) {
      storageFallbackWarned = true;
      console.warn(
        "[STORAGE] Cloudinary is not configured. In development the validated local data-URL is persisted directly so attachments still work. Configure Cloudinary (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET) for a permanent CDN in production."
      );
    }
    return dataUrl;
  }
  requireCloudinaryConfig();
}

// Reusable guard used by every upload helper. Keeps the validate -> resolve ->
// upload ordering identical across image / audio / file / avatar flows.
function resolveOrUpload(dataUrl, uploadFn) {
  const fallback = resolveStorageOrFallback(dataUrl);
  if (fallback) return fallback;
  return uploadFn();
}

const ALLOWED_IMAGE_MIME = new Set(["image/jpeg", "image/jpg", "image/pjpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const IMAGE_EXTENSIONS_BY_MIME = {
  "image/jpeg": new Set(["jpg", "jpeg"]),
  "image/jpg": new Set(["jpg", "jpeg"]),
  "image/pjpeg": new Set(["jpg", "jpeg"]),
  "image/png": new Set(["png"]),
  "image/webp": new Set(["webp"]),
  "image/gif": new Set(["gif"]),
};

const ALLOWED_AUDIO_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/oga",
  "audio/webm",
  "audio/m4a",
  "audio/mp4",
  "audio/x-m4a",
]);
const ALLOWED_AUDIO_EXT = new Set(["mp3", "wav", "ogg", "webm", "m4a"]);
const AUDIO_EXT_BY_MIME = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/oga": "ogg",
  "audio/webm": "webm",
  "audio/m4a": "m4a",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
};

const ALLOWED_FILE_EXT = new Set(["pdf", "doc", "docx", "txt", "csv", "zip", "rar"]);
const GENERIC_FILE_MIME = new Set([
  "application/octet-stream",
  "binary/octet-stream",
  "application/download",
  "application/x-unknown",
  "application/x-file",
  "application/x-empty",
]);
const MIME_FAMILY_ALIASES = {
  "application/pdf": "pdf",
  "application/x-pdf": "pdf",
  "application/acrobat": "pdf",
  "applications/vnd.pdf": "pdf",
  "text/pdf": "pdf",
  "application/msword": "word",
  "application/x-msword": "word",
  "application/vnd.ms-word": "word",
  "application/msword6": "word",
  "application/mswordx": "word",
  "application/word": "word",
  "application/x-word": "word",
  "application/rtf": "word",
  "application/x-rtf": "word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word",
  "text/csv": "spreadsheet",
  "text/comma-separated-values": "spreadsheet",
  "application/csv": "spreadsheet",
  "application/x-csv": "spreadsheet",
  "application/vnd.ms-excel": "spreadsheet",
  "application/x-excel": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "spreadsheet",
  "application/zip": "archive",
  "application/x-zip": "archive",
  "application/x-zip-compressed": "archive",
  "application/x-compressed": "archive",
  "multipart/x-zip": "archive",
  "application/vnd.rar": "archive",
  "application/x-rar": "archive",
  "application/x-rar-compressed": "archive",
  "application/rar": "archive",
  "application/x-7z-compressed": "archive",
  "application/x-tar": "archive",
  "application/gzip": "archive",
  "application/x-gzip": "archive",
  "application/x-bzip": "archive",
  "application/x-bzip2": "archive",
  "application/x-lzma": "archive",
  "application/x-xz": "archive",
  "application/java-archive": "archive",
  "application/vnd.microsoft.portable-executable": "executable",
  "application/x-msdownload": "executable",
  "application/x-dosexec": "executable",
  "application/exe": "executable",
  "application/x-exe": "executable",
  "application/x-executable": "executable",
  "application/x-sh": "executable",
  "application/x-shellscript": "executable",
  "application/javascript": "code",
  "application/x-javascript": "code",
  "text/javascript": "code",
  "application/x-php": "code",
  "application/x-python": "code",
  "application/x-perl": "code",
  "application/x-ruby": "code",
  "application/x-java": "code",
  "application/x-java-archive": "code",
};
const EXPECTED_MIME_FAMILIES_BY_EXT = {
  pdf: new Set(["pdf"]),
  doc: new Set(["word"]),
  docx: new Set(["word", "archive"]),
  txt: new Set(["text"]),
  csv: new Set(["text", "spreadsheet"]),
  zip: new Set(["archive"]),
  rar: new Set(["archive"]),
};
const MIME_TOKEN_PATTERN = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/;

function normalizeMime(value) {
  return String(value || "").split(";")[0].trim().toLowerCase();
}

function extensionOf(name) {
  const normalized = String(name || "").trim();
  const parts = normalized.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

function dataUrlInfo(dataUrl) {
  const value = String(dataUrl || "").trim();
  const commaIndex = value.indexOf(",");
  if (!value.startsWith("data:") || commaIndex < 0) return null;

  const metadata = value.slice(5, commaIndex);
  const metadataParts = metadata.split(";");
  const mimeType = normalizeMime(metadataParts[0]);
  if (!metadataParts.slice(1).some((part) => part.toLowerCase() === "base64")) return null;

  const encoded = value.slice(commaIndex + 1);
  if (
    !encoded ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) ||
    encoded.length % 4 !== 0
  ) {
    return null;
  }

  let size;
  try {
    size = Buffer.byteLength(encoded, "base64");
  } catch {
    return null;
  }
  return { mimeType, size };
}

function mimeFamily(mime) {
  const normalized = normalizeMime(mime);
  if (!normalized || GENERIC_FILE_MIME.has(normalized)) return null;
  if (MIME_FAMILY_ALIASES[normalized]) return MIME_FAMILY_ALIASES[normalized];
  if (/pdf/i.test(normalized)) return "pdf";
  if (/(^|[/.-])(word|msword)|wordprocessingml\.document/i.test(normalized)) return "word";
  if (/(csv|excel|spreadsheet)/i.test(normalized)) return "spreadsheet";
  if (/(zip|rar|compressed|archive)/i.test(normalized)) return "archive";
  if (/^text\//.test(normalized) || /(plain|txt)/i.test(normalized)) return "text";
  return "unknown";
}

function validateImageUpload(dataUrl, fileName) {
  const info = dataUrlInfo(dataUrl);
  if (!info) {
    const err = new Error("Invalid image data.");
    err.statusCode = 400;
    err.code = "MEDIA_VALIDATION_FAILED";
    throw err;
  }

  const nameExtension = extensionOf(fileName);
  const mimeExtension = IMAGE_EXTENSIONS_BY_MIME[info.mimeType];
  const hasGenericMime = !info.mimeType || GENERIC_FILE_MIME.has(info.mimeType);
  if (nameExtension) {
    if (!ALLOWED_IMAGE_EXT.has(nameExtension)) {
      const err = new Error("Invalid image file extension.");
      err.statusCode = 400;
      err.code = "MEDIA_VALIDATION_FAILED";
      throw err;
    }
    if (!hasGenericMime && (!mimeExtension || !mimeExtension.has(nameExtension))) {
      const err = new Error("Unsupported image type.");
      err.statusCode = 400;
      err.code = "MEDIA_VALIDATION_FAILED";
      throw err;
    }
  } else if (!ALLOWED_IMAGE_MIME.has(info.mimeType)) {
    const err = new Error("Unsupported image type.");
    err.statusCode = 400;
    err.code = "MEDIA_VALIDATION_FAILED";
    throw err;
  }

  if (info.size > MAX_IMAGE_BYTES) {
    const err = new Error("Image is too large. Maximum size is 5 MB.");
    err.statusCode = 400;
    err.code = "MEDIA_VALIDATION_FAILED";
    throw err;
  }
  return null;
}

function validateAudioUpload(dataUrl, fileName) {
  const info = dataUrlInfo(dataUrl);
  if (!info) {
    const err = new Error("Invalid audio data.");
    err.statusCode = 400;
    err.code = "MEDIA_VALIDATION_FAILED";
    throw err;
  }

  const nameExtension = extensionOf(fileName);
  const mimeExtension = AUDIO_EXT_BY_MIME[info.mimeType];
  const hasGenericMime = !info.mimeType || GENERIC_FILE_MIME.has(info.mimeType);
  if (nameExtension) {
    if (!ALLOWED_AUDIO_EXT.has(nameExtension)) {
      const err = new Error("Invalid audio file extension.");
      err.statusCode = 400;
      err.code = "MEDIA_VALIDATION_FAILED";
      throw err;
    }
    if (!hasGenericMime && (!mimeExtension || !AUDIO_EXTENSIONS_BY_MIME[info.mimeType]?.has(nameExtension))) {
      const err = new Error("Unsupported audio type.");
      err.statusCode = 400;
      err.code = "MEDIA_VALIDATION_FAILED";
      throw err;
    }
  } else if (!ALLOWED_AUDIO_MIME.has(info.mimeType)) {
    const err = new Error("Unsupported audio type.");
    err.statusCode = 400;
    err.code = "MEDIA_VALIDATION_FAILED";
    throw err;
  }

  if (info.size > MAX_AUDIO_BYTES) {
    const err = new Error("Audio is too large. Maximum size is 5 MB.");
    err.statusCode = 400;
    err.code = "MEDIA_VALIDATION_FAILED";
    throw err;
  }
  return null;
}

function validateFileUpload(dataUrl, fileName, declaredMime) {
  const info = dataUrlInfo(dataUrl);
  if (!info) {
    const err = new Error("Invalid file data.");
    err.statusCode = 400;
    err.code = "MEDIA_VALIDATION_FAILED";
    throw err;
  }

  const ext = extensionOf(fileName);
  if (!ALLOWED_FILE_EXT.has(ext)) {
    const err = new Error("Invalid file extension.");
    err.statusCode = 400;
    err.code = "MEDIA_VALIDATION_FAILED";
    throw err;
  }

  const mimeValues = [info.mimeType, declaredMime]
    .map(normalizeMime)
    .filter(Boolean);
  for (const mime of mimeValues) {
    if (GENERIC_FILE_MIME.has(mime)) continue;
    if (!MIME_TOKEN_PATTERN.test(mime)) {
      const err = new Error("Unsupported file type.");
      err.statusCode = 400;
      err.code = "MEDIA_VALIDATION_FAILED";
      throw err;
    }
    const family = mimeFamily(mime);
    if (!family || !EXPECTED_MIME_FAMILIES_BY_EXT[ext].has(family)) {
      const err = new Error("Unsupported file type.");
      err.statusCode = 400;
      err.code = "MEDIA_VALIDATION_FAILED";
      throw err;
    }
  }

  if (info.size > MAX_FILE_BYTES) {
    const err = new Error("File is too large. Maximum size is 5 MB.");
    err.statusCode = 400;
    err.code = "MEDIA_VALIDATION_FAILED";
    throw err;
  }
  return null;
}

// ── Startup diagnostic (no secrets, names/status only) ───────────────────────
// Printed once at boot so operators can see IMMEDIATELY how attachments will be
// persisted, instead of discovering it from a failed upload:
//   • storage configured                      -> uploads go to Cloudinary
//   • not configured + development (default)  -> validated local data-URL fallback
//   • not configured + production             -> every upload answers
//                                                503 MEDIA_STORAGE_UNAVAILABLE
export function logStorageMode() {
  const ready = cloudinaryConfigured();
  // Distinguish "absent" from "present but a placeholder" — the placeholder case
  // (your_cloud_name, changeme, …) is the one that silently breaks uploads.
  const status = (value) => {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (!trimmed) return "unset";
    return isConfigured(value) ? "set" : "placeholder";
  };
  const parts = [
    `CLOUDINARY_CLOUD_NAME=${status(ENV.CLOUDINARY_CLOUD_NAME)}`,
    `CLOUDINARY_API_KEY=${status(ENV.CLOUDINARY_API_KEY)}`,
    `CLOUDINARY_API_SECRET=${status(ENV.CLOUDINARY_API_SECRET)}`,
  ].join(" ");
  if (ready) {
    console.info(`[STORAGE] Cloudinary configured (${parts}) — uploads use the CDN.`);
    return "cloudinary";
  }
  if (ENV.NODE_ENV === "production") {
    console.error(
      `[STORAGE] Cloudinary NOT configured (${parts}). Uploads will fail with 503 MEDIA_STORAGE_UNAVAILABLE.`
    );
    return "unavailable";
  }
  console.warn(
    `[STORAGE] Cloudinary NOT configured (${parts}). Development mode: attachments are persisted as the validated local data-URL (usable by the receiver, not a CDN) and every upload still returns 201.`
  );
  return "local-fallback";
}

export async function uploadImage(dataUrl, folder = "vyntra/images", fileName) {
  validateImageUpload(dataUrl, fileName);
  return resolveOrUpload(dataUrl, async () => {
    try {
      const res = await cloudinary.uploader.upload(dataUrl, { folder });
      if (!res?.secure_url) throw new Error("Image upload returned no URL.");
      return res.secure_url;
    } catch (err) {
      const error = new Error(err?.message || "Image upload failed.");
      error.statusCode = 502;
      error.code = "MEDIA_UPLOAD_FAILED";
      throw error;
    }
  });
}

export async function uploadAudio(dataUrl, folder = "vyntra/audio") {
  validateAudioUpload(dataUrl, "");
  return resolveOrUpload(dataUrl, async () => {
    try {
      const res = await cloudinary.uploader.upload(dataUrl, {
        folder,
        resource_type: "video",
        format: "webm",
      });
      if (!res?.secure_url) throw new Error("Audio upload returned no URL.");
      return res.secure_url;
    } catch (err) {
      const error = new Error(err?.message || "Audio upload failed.");
      error.statusCode = 502;
      error.code = "MEDIA_UPLOAD_FAILED";
      throw error;
    }
  });
}

export async function uploadFile(dataUrl, folder = "vyntra/files", fileName, declaredMime) {
  validateFileUpload(dataUrl, fileName, declaredMime);
  return resolveOrUpload(dataUrl, async () => {
    try {
      const res = await cloudinary.uploader.upload(dataUrl, {
        folder,
        resource_type: "raw",
        ...(fileName ? { filename_override: fileName } : {}),
      });
      if (!res?.secure_url) throw new Error("File upload returned no URL.");
      return res.secure_url;
    } catch (err) {
      const error = new Error(err?.message || "File upload failed.");
      error.statusCode = 502;
      error.code = "MEDIA_UPLOAD_FAILED";
      throw error;
    }
  });
}

export async function uploadProfilePic(dataUrl, folder = "vyntra/profiles") {
  validateImageUpload(dataUrl, "");
  return resolveOrUpload(dataUrl, async () => {
    try {
      const res = await cloudinary.uploader.upload(dataUrl, { folder });
      return res.secure_url;
    } catch (err) {
      const error = new Error(err?.message || "Profile picture upload failed.");
      error.statusCode = 502;
      error.code = "MEDIA_UPLOAD_FAILED";
      throw error;
    }
  });
}

export async function uploadGroupAvatar(dataUrl, folder = "vyntra/groups") {
  validateImageUpload(dataUrl, "");
  return resolveOrUpload(dataUrl, async () => {
    try {
      const res = await cloudinary.uploader.upload(dataUrl, { folder });
      return res.secure_url;
    } catch (err) {
      const error = new Error(err?.message || "Group avatar upload failed.");
      error.statusCode = err?.statusCode || 502;
      error.code = err?.code || "MEDIA_UPLOAD_FAILED";
      throw error;
    }
  });
}
