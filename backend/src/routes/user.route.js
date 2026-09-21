import express from "express";
import {
  getRelationship,
  blockUser,
  unblockUser,
  muteUser,
  unmuteUser,
  getUserProfile,
  getPublicProfileByUsername,
} from "../controllers/user.controller.js";
import { reportUser } from "../controllers/report.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

// All user routes require authentication and rate limiting.
router.use(arcjetProtection, protectRoute);

// Public profile route — requires authentication, privacy rules apply based on viewer.
router.get("/public/:username", getPublicProfileByUsername);

// Relationship actions
router.put("/block/:userId", blockUser);
router.put("/unblock/:userId", unblockUser);
router.put("/mute/:userId", muteUser);
router.put("/unmute/:userId", unmuteUser);
router.get("/:id", getUserProfile);
router.post("/report/:userId", reportUser);
router.get("/relationship/:userId", getRelationship);

export default router;

