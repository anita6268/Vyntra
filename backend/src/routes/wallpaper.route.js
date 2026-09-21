import express from "express";
import { uploadWallpaper } from "../controllers/wallpaper.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

// Order matters: rate-limit first, then authenticate — mirrors the message routes.
router.use(arcjetProtection, protectRoute);

// POST /api/wallpapers/upload — upload a video wallpaper to Cloudinary and
// receive a secure URL. Images (JPG/PNG/GIF/WebP) are handled client-side as
// base64 data URLs in localStorage, so this endpoint is video-only.
router.post("/upload", uploadWallpaper);

export default router;
