import express from "express";
import {
  createCallHistory,
  updateCallHistory,
  getMyCallHistory,
  deleteCallHistory,
  clearCallHistory,
  getIceConfig,
} from "../controllers/call.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

// All call-history routes require an authenticated user (rate-limited first).
router.use(arcjetProtection, protectRoute);

// ICE configuration for the authenticated caller (STUN + optional TURN).
// Exposed only to authenticated users — TURN credentials are never hardcoded.
router.get("/ice-config", getIceConfig);
// Both / and /history return the authenticated user's call history.
router.get("/history", getMyCallHistory);
router.get("/", getMyCallHistory);
router.post("/", createCallHistory);
router.put("/:id", updateCallHistory);
// Delete a single call-history record or clear the entire history.
router.delete("/:id", deleteCallHistory);
router.delete("/", clearCallHistory);

export default router;
