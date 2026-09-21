import express from "express";
import {
  getAllContacts,
  getChatPartners,
  matchContacts,
  lookupContactByPhone,
  getMessagesByUserId,
  sendMessage,
  sendMessageGroup,
  getMessagesByGroupId,
  forwardMessage,
  deleteMessage,
  editMessage,
  reactToMessage,
  pinMessage,
  starMessage,
  clearChat,
  deleteConversation,
  getBlockedUsers,
  markConversationRead,
  pinConversation,
  getLibrary,
  downloadMessageFile,
  deleteLibraryItem,
  clearLibrary,
} from "../controllers/message.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.get("/contacts", getAllContacts);
router.post("/contacts/match", matchContacts);
router.get("/contacts/phone", lookupContactByPhone);
router.get("/chats", getChatPartners);
router.get("/blocked", getBlockedUsers);
// Library (pinned / starred / files) must be registered BEFORE /:id so the
  // literal "/library" isn't swallowed by the getMessagesByUserId param route.
  router.get("/library", getLibrary);
  router.delete("/library/clear", clearLibrary);
  router.delete("/library/:messageId", deleteLibraryItem);
  router.get("/files/:messageId/download", downloadMessageFile);

// Group messages (registered before /:id so the literal "/group" segment is
// never mistaken for a user id).
router.get("/group/:id", getMessagesByGroupId);
router.post("/group/:id/send", sendMessageGroup);

// Per-message actions
router.post("/:id/react", reactToMessage);
router.put("/:id/pin", pinMessage);
router.put("/:id/star", starMessage);

// Conversation-level actions
router.delete("/chat/:id/clear", clearChat);
router.delete("/conversation/:id", deleteConversation);
router.put("/chat/:id/read", markConversationRead);
router.put("/chat/:id/pin", pinConversation);

// Message CRUD
router.get("/:id", getMessagesByUserId);
router.post("/send/:id", sendMessage);
router.post("/forward", forwardMessage);
router.put("/:id/edit", editMessage);
router.delete("/:id", deleteMessage);

export default router;

