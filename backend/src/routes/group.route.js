import express from "express";
import {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  addGroupMember,
  removeGroupMember,
  markGroupRead,
} from "../controllers/group.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

// All group routes require auth (rate-limited then authenticated, same as
// message routes).
router.use(arcjetProtection, protectRoute);

router.post("/", createGroup);
router.get("/", getGroups);
router.put("/:id/read", markGroupRead);
router.get("/:id", getGroupById);
router.patch("/:id", updateGroup);
router.delete("/:id", deleteGroup);
router.post("/:id/members", addGroupMember);
router.delete("/:id/members/:userId", removeGroupMember);

export default router;
