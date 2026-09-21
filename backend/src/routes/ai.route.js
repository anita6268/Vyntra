import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";
import {
  translateAI,
  summarizeAI,
  grammarAI,
  meetingNotesAI,
  replySuggestionAI,
  smartReplyAI,
  chatAI,
} from "../controllers/ai.controller.js";

const router = express.Router();

// All AI routes require authentication, rate limiting, and Pro subscription.
router.use(arcjetProtection, protectRoute);

// AI features are Pro-only on the backend. Free users get a clear upgrade message.
const requirePro = (req, res, next) => {
  if (!req.user?.isPro) {
    return res.status(403).json({
      message: "AI features are exclusive to Vyntra Pro. Upgrade to unlock unlimited AI.",
      upgradeRequired: true,
    });
  }
  next();
};

router.use(requirePro);

router.post("/translate", translateAI);
router.post("/summarize", summarizeAI);
router.post("/grammar", grammarAI);
router.post("/meeting-notes", meetingNotesAI);
router.post("/reply-suggestion", replySuggestionAI);
router.post("/smart-reply", smartReplyAI);
router.post("/chat", chatAI);

export default router;
