import express from "express";
import {
  createCheckout,
  confirmSubscription,
  cancelSubscription,
  getSubscription,
} from "../controllers/subscription.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

// All subscription routes require authentication and rate limiting.
router.use(arcjetProtection, protectRoute);

// Real checkout flow:
router.post("/checkout", createCheckout);   // start a checkout (payment-gateway step)
router.post("/confirm", confirmSubscription); // gateway/webhook resolves payment → activates Pro
router.post("/cancel", cancelSubscription);   // Manage Pro: cancel active subscription
router.get("/me", getSubscription);           // live verification of subscription state

export default router;