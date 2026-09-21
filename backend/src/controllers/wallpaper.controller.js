import cloudinary from "../lib/cloudinary.js";

// Wallpaper uploads go straight to Cloudinary as base64 data URLs (the same
// transport the rest of the app uses for chat attachments). Because the global
// express.json body limit is 5 MB, the raw file must stay small enough that its
// ~33% base64 expansion fits — 3 MB raw keeps a video well under the limit.
const ALLOWED_VIDEO_MIME = ["video/mp4", "video/webm"];
const ALLOWED_VIDEO_EXT = ["mp4", "webm"];
const MAX_VIDEO_BYTES = 3 * 1024 * 1024; // 3 MB

function extensionOf(name) {
  return String(name || "").split(".").pop().toLowerCase();
}

// Decode the base64 payload size from a data URL without buffering the whole
// string in memory — used only for the length check, which Buffer.byteLength
// can compute from the base64 characters directly.
function dataUrlInfo(dataUrl) {
  const match = String(dataUrl || "").match(/^data:(.+?);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1];
  let size;
  try {
    size = Buffer.byteLength(match[2], "base64");
  } catch {
    return null;
  }
  return { mimeType, size };
}

export const uploadWallpaper = async (req, res) => {
  try {
    const { dataUrl, mimeType, fileName } = req.body || {};

    // Validate on the server too — never trust the client MIME/extension alone.
    if (!dataUrl || !mimeType) {
      return res.status(400).json({ message: "No wallpaper data provided." });
    }

    const info = dataUrlInfo(dataUrl);
    if (!info) {
      return res.status(400).json({ message: "Invalid wallpaper data." });
    }

    if (!ALLOWED_VIDEO_MIME.includes(mimeType) && !ALLOWED_VIDEO_MIME.includes(info.mimeType)) {
      return res.status(400).json({ message: "Unsupported wallpaper type. Only MP4 and WebM video are accepted here." });
    }

    const ext = extensionOf(fileName);
    if (!ALLOWED_VIDEO_EXT.includes(ext)) {
      return res.status(400).json({ message: "Invalid video file extension." });
    }

    if (info.size > MAX_VIDEO_BYTES) {
      return res.status(413).json({ message: "Video wallpaper is too large. Maximum size is 3 MB." });
    }

    // Verify the data URL's embedded MIME matches the declared MIME so a JPEG
    // can't sneak in disguised as a video (extension/MIME spoofing defense).
    const declared = mimeType;
    const embedded = info.mimeType;
    if (declared !== embedded) {
      return res.status(400).json({ message: "File content does not match the declared video type." });
    }

    const uploadResponse = await cloudinary.uploader.upload(dataUrl, {
      folder: "vyntra/wallpapers",
      resource_type: "video",
      use_filename: true,
      unique_filename: true,
      ...(fileName ? { filename_override: fileName } : {}),
    });

    // Only persist if Cloudinary actually returned a usable URL.
    if (!uploadResponse?.secure_url) {
      console.error("Wallpaper upload returned no URL.", uploadResponse);
      return res.status(502).json({ message: "Upload provider returned an invalid response." });
    }

    return res.json({
      url: uploadResponse.secure_url,
      publicId: uploadResponse.public_id,
      resourceType: uploadResponse.resource_type,
    });
  } catch (error) {
    // Never leak Cloudinary/API secrets — just the generic message.
    console.error("Error in uploadWallpaper controller: ", error?.message || "Unknown error");
    return res.status(500).json({ message: "Failed to upload wallpaper. The server may not be configured for video uploads." });
  }
};
