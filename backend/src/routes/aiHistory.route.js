import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";
import { getMyAIHistory, deleteAIHistory, clearAIHistory } from "../controllers/aiHistory.controller.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.get("/", getMyAIHistory);
router.delete("/", clearAIHistory);
router.delete("/:id", deleteAIHistory);

export default router;
