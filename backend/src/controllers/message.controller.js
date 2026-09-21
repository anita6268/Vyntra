import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import Group from "../models/Group.js";
import { sanitizeUserFor } from "../lib/profilePrivacy.js";
import { validateId } from "../lib/utils.js";
import { uploadImage, uploadAudio, uploadFile } from "../lib/uploadValidation.js";
import { normalizePhone, isPhoneLike } from "../lib/phone.js";

const GROUP_ROOM = (id) => `group:${id}`;
const isHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const TEST_NAME_PATTERN = /^(QA|Test|Demo|Mock|Fixture|System|Bot|Auto)\b/i;
const TIMESTAMP_SUFFIX = /\d{8,14}$/;
const isAccidentalTestUser = (user) => {
  const name = String(user.fullName || "");
  if (!name) return false;
  if (TEST_NAME_PATTERN.test(name)) return true;
  if (TIMESTAMP_SUFFIX.test(name)) return true;
  return false;
};

// Helper: broadcast an event to a conversation's participants. For direct
// messages both sender + receiver are notified; for group messages the whole
// group room receives it so every online member stays in sync in realtime.
const broadcastToParticipants = (message, event, payload) => {
  if (message && message.groupId) {
    io.to(GROUP_ROOM(String(message.groupId))).emit(event, payload);
    return;
  }
  const sockets = new Set([message.senderId.toString(), message.receiverId.toString()]);
  for (const uid of sockets) {
    const sockId = getReceiverSocketId(uid);
    if (sockId) io.to(sockId).emit(event, payload);
  }
};

// Helper: determine whether a user participates in a message's conversation.
// Group messages have receiverId = null, so direct string comparisons would
// crash. For group messages membership is checked against the Group document.
const isMessageParticipant = async (message, userId) => {
  const my = String(userId);
  if (String(message.senderId) === my) return true;
  if (!message.groupId) {
    return !!(message.receiverId && String(message.receiverId) === my);
  }
  const g = await Group.findOne({ _id: message.groupId, members: userId }).select("_id");
  return !!g;
};

// Helper: check if a user has blocked the other.
const isBlockedBy = async (userId, otherId) => {
  const user = await User.findById(userId).select("blockedUsers");
  if (!user) return false;
  return (user.blockedUsers || []).some((id) => id.toString() === otherId.toString());
};

export const getAllContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { q } = req.query;

    if (!q || !String(q).trim()) {
      return res.status(200).json([]);
    }

    const term = String(q).trim();
    const filter = { _id: { $ne: loggedInUserId }, role: { $nin: ["test", "system"] } };

    if (isPhoneLike(term)) {
      const normalized = normalizePhone(term);
      // Support accounts created before phoneNormalized was introduced.
      const users = await User.find(filter).select("-password").lean();
      const matchedUsers = users.filter((u) =>
        normalizePhone(u.phoneNormalized || u.phone || "") === normalized
      );
      const realUsers = matchedUsers.filter((u) => !isAccidentalTestUser(u));
      return res.status(200).json(realUsers.map((u) => sanitizeUserFor(u, loggedInUserId)));
    }

    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const isEmailQuery = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(term);

    if (isEmailQuery) {
      const users = await User.find({
        email: { $regex: `^${escapeRegExp(term)}$`, $options: "i" },
        role: { $nin: ["test", "system"] },
      }).select("-password").sort({ fullName: 1 });
      const realUsers = users.filter((u) => !isAccidentalTestUser(u));
      const safeUsers = realUsers.map((u) => sanitizeUserFor(u, loggedInUserId));
      return res.status(200).json(safeUsers);
    }

    const safeTerm = escapeRegExp(term);
    filter.$or = [
      { fullName: { $regex: safeTerm, $options: "i" } },
      { email: { $regex: safeTerm, $options: "i" } },
    ];

    const filteredUsers = await User.find(filter).select("-password").sort({ fullName: 1 });
    const uniqueUsers = [...new Map(filteredUsers.map((u) => [String(u._id), u])).values()];
    const realUsers = uniqueUsers.filter((u) => !isAccidentalTestUser(u));
    res.status(200).json(realUsers.map((u) => sanitizeUserFor(u, loggedInUserId)));
  } catch (error) {
    console.error("Error in getAllContacts:", error?.message || "Unknown error");
    res.status(500).json({ message: "Server error" });
  }
};

export const matchContacts = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const { phones = [] } = req.body;

    if (!Array.isArray(phones) || phones.length === 0) {
      return res.status(200).json([]);
    }

    const normalized = [...new Set(
      phones
        .map((p) => normalizePhone(p))
        .filter((p) => p.length > 0)
    )];

    if (normalized.length === 0) {
      return res.status(200).json([]);
    }

    const matched = await User.find({
      _id: { $ne: loggedInUserId },
      role: { $nin: ["test", "system"] },
    }).select("-password").lean();

    const matchedUsers = matched.filter((u) =>
      normalized.includes(normalizePhone(u.phoneNormalized || u.phone || ""))
    );
    const realUsers = matchedUsers.filter((u) => !isAccidentalTestUser(u));
    res.status(200).json(realUsers.map((u) => sanitizeUserFor(u, loggedInUserId)));
  } catch (error) {
    console.error("Error in matchContacts:", error?.message || "Unknown error");
    res.status(500).json({ message: "Server error" });
  }
};

export const lookupContactByPhone = async (req, res) => {
  try {
    const loggedInUserId = req.user?._id;
    const { number } = req.query;

    if (!number || !String(number).trim() || !isPhoneLike(String(number))) {
      return res.status(200).json(null);
    }

    const normalized = normalizePhone(String(number));

    const matchedUsers = await User.find({
      phoneNormalized: normalized,
      role: { $nin: ["test", "system"] },
    }).select("-password").lean();
    const realUsers = matchedUsers.filter((u) => !isAccidentalTestUser(u));
    const safeUsers = realUsers.map((u) => sanitizeUserFor(u, loggedInUserId));

    if (safeUsers.length === 0) {
      return res.status(200).json(null);
    }

    res.status(200).json(safeUsers);
  } catch (error) {
    console.error("Error in lookupContactByPhone:", error?.message || "Unknown error");
    res.status(500).json({ message: "Server error" });
  }
};

export const getMessagesByUserId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: userToChatId } = req.params;
    validateId(userToChatId, "user id");

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
      // Group messages live in groupid, so they never leak into a direct thread.
      conversationType: { $ne: "group" },
      // Exclude messages this user soft-deleted for themselves or cleared via clear-chat.
      deletedFor: { $not: { $elemMatch: { $eq: myId } } },
      clearedFor: { $not: { $elemMatch: { $eq: myId } } },
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, imageName, replyTo, audio, audioDuration, fileUrl, fileName, fileType, fileSize } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id;

    if (!text && !image && !audio && !fileUrl) {
      return res.status(400).json({ message: "Text, image, audio or file is required.", code: "MESSAGE_EMPTY" });
    }
    validateId(receiverId, "receiver id");
    if (senderId.equals(receiverId)) {
      return res.status(400).json({ message: "Cannot send a message to yourself.", code: "MESSAGE_SELF_SEND" });
    }
    const receiverExists = await User.exists({ _id: receiverId });
    if (!receiverExists) {
      return res.status(404).json({ message: "Receiver not found.", code: "RECEIVER_NOT_FOUND" });
    }

    // Block check (either direction): if the receiver blocked the sender OR the
    // sender blocked the receiver, reject the message.
    const [receiverBlockedMe, iBlockedReceiver] = await Promise.all([
      isBlockedBy(receiverId, senderId),
      isBlockedBy(senderId, receiverId),
    ]);
    if (receiverBlockedMe || iBlockedReceiver) {
      return res.status(403).json({ message: "You cannot send messages to this user.", code: "USER_BLOCKED" });
    }

    let imageUrl;
    if (image) {
      try {
        imageUrl = await uploadImage(image, "vyntra/images");
      } catch (err) {
        console.error("[MESSAGE] Image upload failed:", err?.message || err);
        return res.status(err?.statusCode || 502).json({ message: err?.message || "Image upload failed.", code: err?.code || "MEDIA_UPLOAD_FAILED" });
      }
    }

    let audioUrl;
    if (audio) {
      try {
        audioUrl = await uploadAudio(audio, "vyntra/audio");
      } catch (err) {
        console.error("[MESSAGE] Audio upload failed:", err?.message || err);
        return res.status(err?.statusCode || 502).json({ message: err?.message || "Audio upload failed.", code: err?.code || "MEDIA_UPLOAD_FAILED" });
      }
    }

    let uploadedFileUrl;
    if (fileUrl && !isHttpUrl(fileUrl)) {
      try {
        uploadedFileUrl = await uploadFile(fileUrl, "vyntra/files", fileName, fileType);
      } catch (err) {
        console.error("[MESSAGE] File upload failed:", err?.message || err);
        return res.status(err?.statusCode || 502).json({ message: err?.message || "File upload failed.", code: err?.code || "MEDIA_UPLOAD_FAILED" });
      }
    } else {
      uploadedFileUrl = fileUrl;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
      audio: audioUrl,
      audioDuration: audioDuration || undefined,
      fileUrl: uploadedFileUrl || undefined,
      fileName: fileName || undefined,
      fileType: fileType || undefined,
      fileSize: fileSize || undefined,
      replyTo: replyTo || null,
    });

    await newMessage.save();

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      await Message.findByIdAndUpdate(newMessage._id, { $set: { delivered: true } });
      io.to(receiverSocketId).emit("newMessage", newMessage);

      const senderSocketId = getReceiverSocketId(senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit("messageDelivered", {
          messageId: newMessage._id,
          delivered: true,
        });
      }
    }

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("[MESSAGE] Send failed:", error?.message || error);
    const status = error?.statusCode || 500;
    const code = error?.code || (error?.name === "ValidationError" ? "MESSAGE_DB_VALIDATION" : "MESSAGE_DB_SAVE");
    res.status(status).json({ message: error?.message || "Internal server error", code });
  }
};

// POST /api/messages/group/:id/send — send a message to a group.
// The requester must be a current member. The saved message uses
// conversationType: "group" + groupId so it never leaks into direct chats.
export const sendMessageGroup = async (req, res) => {
  try {
    const { text, image, imageName, replyTo, audio, audioDuration, fileUrl, fileName, fileType, fileSize } = req.body;
    const { id: groupId } = req.params;
    const senderId = req.user._id;

    if (!text && !image && !audio && !fileUrl) {
      return res.status(400).json({ message: "Text, image, audio or file is required.", code: "MESSAGE_EMPTY" });
    }

    const group = await Group.findOne({ _id: groupId, members: senderId });
    if (!group) {
      return res.status(404).json({ message: "Group not found or you are not a member.", code: "GROUP_NOT_FOUND" });
    }

    let imageUrl;
    if (image) {
      try {
        imageUrl = await uploadImage(image, "vyntra/images");
      } catch (err) {
        console.error("[MESSAGE GROUP] Image upload failed:", err?.message || err);
        return res.status(err?.statusCode || 502).json({ message: err?.message || "Image upload failed.", code: err?.code || "MEDIA_UPLOAD_FAILED" });
      }
    }

    let audioUrl;
    if (audio) {
      try {
        audioUrl = await uploadAudio(audio, "vyntra/audio");
      } catch (err) {
        console.error("[MESSAGE GROUP] Audio upload failed:", err?.message || err);
        return res.status(err?.statusCode || 502).json({ message: err?.message || "Audio upload failed.", code: err?.code || "MEDIA_UPLOAD_FAILED" });
      }
    }

    let uploadedFileUrl;
    if (fileUrl && !isHttpUrl(fileUrl)) {
      try {
        uploadedFileUrl = await uploadFile(fileUrl, "vyntra/files", fileName, fileType);
      } catch (err) {
        console.error("[MESSAGE GROUP] File upload failed:", err?.message || err);
        return res.status(err?.statusCode || 502).json({ message: err?.message || "File upload failed.", code: err?.code || "MEDIA_UPLOAD_FAILED" });
      }
    } else {
      uploadedFileUrl = fileUrl;
    }

    const newMessage = new Message({
      senderId,
      receiverId: null,
      conversationType: "group",
      groupId,
      text,
      image: imageUrl,
      audio: audioUrl,
      audioDuration: audioDuration || undefined,
      fileUrl: uploadedFileUrl || undefined,
      fileName: fileName || undefined,
      fileType: fileType || undefined,
      fileSize: fileSize || undefined,
      replyTo: replyTo || null,
    });

    await newMessage.save();

    // Update the group's list preview (last message + time).
    await Group.findByIdAndUpdate(groupId, {
      lastMessage: newMessage._id,
      lastMessageAt: newMessage.createdAt,
    });

    // Realtime: deliver to every online member via the group room.
    io.to(GROUP_ROOM(String(groupId))).emit("groupMessage", newMessage);

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("[MESSAGE GROUP] Send failed:", error?.message || error);
    const status = error?.statusCode || 500;
    const code = error?.code || (error?.name === "ValidationError" ? "MESSAGE_DB_VALIDATION" : "MESSAGE_DB_SAVE");
    res.status(status).json({ message: error?.message || "Internal server error", code });
  }
};

// GET /api/messages/group/:id — messages in a group (visible to members only).
export const getMessagesByGroupId = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: groupId } = req.params;
    validateId(groupId, "group id");

    const group = await Group.findOne({ _id: groupId, members: myId });
    if (!group) {
      return res.status(404).json({ message: "Group not found or you are not a member." });
    }

    const messages = await Message.find({
      conversationType: "group",
      groupId,
      deletedFor: { $not: { $elemMatch: { $eq: myId } } },
      clearedFor: { $not: { $elemMatch: { $eq: myId } } },
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getMessagesByGroupId controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// POST /api/messages/forward
export const forwardMessage = async (req, res) => {
  try {
    const { receiverIds, messageId } = req.body;
    const senderId = req.user._id;

    if (!messageId) {
      return res.status(400).json({ message: "messageId is required." });
    }
    if (!Array.isArray(receiverIds) || receiverIds.length === 0) {
      return res.status(400).json({ message: "At least one receiver is required." });
    }

    const original = await Message.findById(messageId);
    if (!original) {
      return res.status(404).json({ message: "Message not found." });
    }

    // AUTHORIZATION: the user may only forward messages they actually took part
    // in — i.e. a message they sent OR received. Without this a user could
    // forward any message in the DB to any receiver (IDOR / message leakage).
    const isParticipant =
      String(original.senderId) === String(senderId) ||
      String(original.receiverId) === String(senderId);
    if (!isParticipant) {
      return res.status(403).json({ message: "You can only forward messages you participated in." });
    }

    const uniqueIds = [...new Set(receiverIds)].filter((id) => id.toString() !== senderId.toString());
    if (uniqueIds.length === 0) {
      return res.status(400).json({ message: "Cannot forward to yourself." });
    }

    const receiversExist = await User.find({ _id: { $in: uniqueIds } }).select("_id");
    const validIds = receiversExist.map((u) => u._id.toString());
    if (validIds.length === 0) {
      return res.status(404).json({ message: "No valid receivers found." });
    }

    // Skip receivers who have blocked the sender.
    const sendableIds = [];
    for (const receiverId of validIds) {
      if (!(await isBlockedBy(receiverId, senderId))) sendableIds.push(receiverId);
    }
    if (sendableIds.length === 0) {
      return res.status(403).json({ message: "You cannot send messages to the selected users." });
    }

    const createdMessages = [];
    for (const receiverId of sendableIds) {
      const receiverSocketId = getReceiverSocketId(receiverId);
      const forwarded = new Message({
        senderId,
        receiverId,
        text: original.text,
        image: original.image,
        audio: original.audio,
        audioDuration: original.audioDuration,
        fileUrl: original.fileUrl,
        fileName: original.fileName,
        fileType: original.fileType,
        fileSize: original.fileSize,
        replyTo: original.replyTo || null,
        forwarded: true,
        delivered: !!receiverSocketId,
      });
      await forwarded.save();
      createdMessages.push(forwarded);

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", forwarded);
        const senderSocketId = getReceiverSocketId(senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit("messageDelivered", {
            messageId: forwarded._id,
            delivered: true,
          });
        }
      }
    }

    res.status(201).json({ messages: createdMessages });
  } catch (error) {
    console.error("Error in forwardMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PUT /api/messages/:id/edit
export const editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    validateId(id, "message id");
    const { text } = req.body;
    const myId = req.user._id;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: "text is required." });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    if (message.senderId.toString() !== myId.toString()) {
      return res.status(403).json({ message: "Only the sender can edit this message." });
    }
    if (message.image || message.audio || message.fileUrl) {
      return res.status(400).json({ message: "Media messages cannot be edited." });
    }

    message.text = text.trim();
    message.edited = true;
    await message.save();

    broadcastToParticipants(message, "messageEdited", message);

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in editMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// DELETE /api/messages/:id
// Input: { scope: "me" | "everyone" }
export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    validateId(id, "message id");
    const { scope = "me" } = req.body;
    const myId = req.user._id;

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    const isSender = String(message.senderId) === String(myId);
    if (!(await isMessageParticipant(message, myId))) {
      return res.status(403).json({ message: "Not authorized to delete this message." });
    }

    if (scope === "everyone") {
      if (!isSender) {
        return res.status(403).json({ message: "Only the sender can delete for everyone." });
      }

      const sixHoursMs = 6 * 60 * 60 * 1000;
      const age = Date.now() - new Date(message.createdAt).getTime();
      if (age > sixHoursMs) {
        return res.status(403).json({ message: "Delete for everyone is only available within 6 hours of sending." });
      }

      message.deletedForEveryone = true;
      message.deletedAt = new Date();
      message.deletedBy = myId;
      await message.save();

      broadcastToParticipants(message, "messageDeleted", { id, scope: "everyone", deletedForEveryone: true });
      return res.status(200).json({ message: "Message deleted for everyone." });
    }

    // scope === "me" — soft delete: add current user to deletedFor.
    const deletedFor = message.deletedFor ? [...message.deletedFor] : [];
    if (!deletedFor.some((uid) => uid.toString() === myId.toString())) {
      deletedFor.push(myId);
      message.deletedFor = deletedFor;
      await message.save();
    }

    const sockId = getReceiverSocketId(myId.toString());
    if (sockId) io.to(sockId).emit("messageDeleted", { id, scope: "me" });

    res.status(200).json({ message: "Message deleted for you." });
  } catch (error) {
    console.error("Error in deleteMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Reactions ──
// POST /api/messages/:id/react  { emoji }
// One reaction per user: same emoji removes it, different emoji changes it.
export const reactToMessage = async (req, res) => {
  try {
    const { id } = req.params;
    validateId(id, "message id");
    const { emoji } = req.body;
    const myId = req.user._id;

    if (!emoji || !emoji.trim()) {
      return res.status(400).json({ message: "emoji is required." });
    }

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    const isParticipant = await isMessageParticipant(message, myId);
    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorized to react to this message." });
    }

    const reactions = (message.reactions || []).filter((r) => r.userId.toString() !== myId.toString());
    const existing = (message.reactions || []).find((r) => r.userId.toString() === myId.toString());

    if (existing && existing.emoji === emoji) {
      // Same emoji → remove reaction (toggle off).
      message.reactions = reactions;
    } else {
      // Add or change reaction.
      reactions.push({ userId: myId, emoji });
      message.reactions = reactions;
    }

    await message.save();
    broadcastToParticipants(message, "messageReacted", message);

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in reactToMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Pin / Unpin ──
// PUT /api/messages/:id/pin  { pinned: boolean } — per-user toggle.
export const pinMessage = async (req, res) => {
  try {
    const { id } = req.params;
    validateId(id, "message id");
    const { pinned } = req.body;
    const myId = req.user._id;

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    const isParticipant = await isMessageParticipant(message, myId);
    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorized to pin this message." });
    }

    const pinnedBy = (message.pinnedBy || []).filter((uid) => uid.toString() !== myId.toString());
    const shouldPin = pinned !== false;
    if (shouldPin) pinnedBy.push(myId);
    message.pinnedBy = pinnedBy;
    await message.save();

    broadcastToParticipants(message, "messagePinned", message);

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in pinMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Star / Unstar ──
// PUT /api/messages/:id/star  { starred: boolean } — per-user toggle.
export const starMessage = async (req, res) => {
  try {
    const { id } = req.params;
    validateId(id, "message id");
    const { starred } = req.body;
    const myId = req.user._id;

    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    const isParticipant = await isMessageParticipant(message, myId);
    if (!isParticipant) {
      return res.status(403).json({ message: "Not authorized to star this message." });
    }

    const starredBy = (message.starredBy || []).filter((uid) => uid.toString() !== myId.toString());
    const shouldStar = starred !== false;
    if (shouldStar) starredBy.push(myId);
    message.starredBy = starredBy;
    await message.save();

    broadcastToParticipants(message, "messageStarred", message);

    res.status(200).json(message);
  } catch (error) {
    console.error("Error in starMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Clear Chat ──
// DELETE /api/messages/chat/:id/clear — soft-hides the messages for me but keeps
// the conversation in the chats list. Only the visible messages are hidden; the
// partner and the chat entry remain so the user can still return to the thread.
export const clearChat = async (req, res) => {
  try {
    const { id: otherId } = req.params;
    validateId(otherId, "user id");
    const myId = req.user._id;

    // Mark every message in this conversation as cleared for me (hidden, NOT hard-deleted).
    const result = await Message.updateMany(
      {
        $or: [
          { senderId: myId, receiverId: otherId },
          { senderId: otherId, receiverId: myId },
        ],
      },
      { $addToSet: { clearedFor: myId } }
    );

    // Notify the other user so they can update if this conversation is open.
    const otherSockId = getReceiverSocketId(otherId);
    if (otherSockId) io.to(otherSockId).emit("chatCleared", { byUserId: myId.toString(), otherId: otherId.toString() });

    res.status(200).json({ message: "Chat cleared.", modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Error in clearChat controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Delete Conversation ──
// DELETE /api/messages/conversation/:id — actually removes the conversation.
// Soft-deletes every message in the thread for the current user (deletedFor)
// and unpins the chat, so it disappears from the chats list while any messages
// still exist in MongoDB for the other participant.
export const deleteConversation = async (req, res) => {
  try {
    const { id: otherId } = req.params;
    const myId = req.user._id;

    if (String(myId) === String(otherId)) {
      return res.status(400).json({ message: "Cannot delete conversation with yourself." });
    }

    const other = await User.exists({ _id: otherId });
    if (!other) return res.status(404).json({ message: "User not found." });

    // Soft-delete every message in this thread FOR ME only.
    const result = await Message.updateMany(
      {
        $or: [
          { senderId: myId, receiverId: otherId },
          { senderId: otherId, receiverId: myId },
        ],
      },
      { $addToSet: { deletedFor: myId } }
    );

    // Unpin the chat from my conversation list.
    await User.findByIdAndUpdate(myId, { $pull: { pinnedChats: otherId } });

    res.status(200).json({ message: "Conversation deleted.", modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Error in deleteConversation controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/messages/blocked — list of blocked user ids for current user.
export const getBlockedUsers = async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select("blockedUsers mutedUsers");
    res.status(200).json({ blockedUsers: me.blockedUsers, mutedUsers: me.mutedUsers });
  } catch (error) {
    console.error("Error in getBlockedUsers controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getChatPartners = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

        // find all the messages where the logged-in user is either sender or receiver.
    // Only `deletedFor` removes a conversation from the chats list.
    // `clearedFor` hides the messages (clear chat) but MUST keep the chat + partner
    // alive so the user can still open the (now empty) thread — matches
    // "Clear Chat -> messages clear -> Chat/contact remains".
    const messages = await Message.find({
      $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
      // Group messages never create a "direct chat" entry.
      conversationType: { $ne: "group" },
      deletedFor: { $not: { $elemMatch: { $eq: loggedInUserId } } },
      deletedForEveryone: { $ne: true },
    }).sort({ createdAt: -1 });

    const chatPartnerIds = [
      ...new Set(
        messages.map((msg) =>
          msg.senderId.toString() === loggedInUserId.toString()
            ? msg.receiverId.toString()
            : msg.senderId.toString()
        )
      ),
    ];

    // Contacts/chats are REAL users only. Internal automation / QA accounts
    // (role "test"|"system" or names matching QA/test patterns) — e.g.
    // "QA Four …" test records — are excluded so they never surface in the
    // sidebar Chats list. This filters by role classification AND by obvious
    // test-data name patterns as a defense-in-depth against mis-typed roles.
    const chatPartners = await User.find({
      _id: { $in: chatPartnerIds },
      role: { $nin: ["test", "system"] },
    }).select("-password");

    const realChatPartners = chatPartners.filter((p) => !isAccidentalTestUser(p));

    // Attach the last message + unread count for each partner.
    const me = await User.findById(loggedInUserId).select("blockedUsers mutedUsers pinnedChats");

    const enriched = await Promise.all(
      realChatPartners.map(async (partner) => {
        const partnerId = partner._id;

        // Last message in the conversation (visible to me).
        const lastMessage = await Message.findOne({
          $or: [
            { senderId: loggedInUserId, receiverId: partnerId },
            { senderId: partnerId, receiverId: loggedInUserId },
          ],
          deletedFor: { $not: { $elemMatch: { $eq: loggedInUserId } } },
          clearedFor: { $not: { $elemMatch: { $eq: loggedInUserId } } },
          deletedForEveryone: { $ne: true },
        }).sort({ createdAt: -1 });

        // Unread count: messages from partner that I haven't seen yet.
        const unreadCount = await Message.countDocuments({
          senderId: partnerId,
          receiverId: loggedInUserId,
          deletedFor: { $not: { $elemMatch: { $eq: loggedInUserId } } },
          clearedFor: { $not: { $elemMatch: { $eq: loggedInUserId } } },
          deletedForEveryone: { $ne: true },
          seenBy: { $not: { $elemMatch: { $eq: loggedInUserId } } },
        });

        const plain = sanitizeUserFor(partner, loggedInUserId);
        plain.lastMessage = lastMessage || null;
        plain.lastMessageAt = lastMessage ? lastMessage.createdAt : null;
        plain.unreadCount = unreadCount;
        plain.isBlocked = (me.blockedUsers || []).some((id) => id.toString() === partnerId.toString());
        plain.isMuted = (me.mutedUsers || []).some((id) => id.toString() === partnerId.toString());
        plain.isPinned = (me.pinnedChats || []).some((id) => id.toString() === partnerId.toString());
        return plain;
      })
    );

    // Sort: pinned conversations first, then by the latest message (most recent on top).
    enriched.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });

    res.status(200).json(enriched);
  } catch (error) {
    console.error("Error in getChatPartners: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Mark conversation as read ──
// PUT /api/messages/chat/:id/read
// Marks every unread message FROM :id TO me as seen, and notifies :id in realtime.
export const markConversationRead = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: otherId } = req.params;
    validateId(otherId, "user id");

    const result = await Message.updateMany(
      {
        senderId: otherId,
        receiverId: myId,
        seenBy: { $not: { $elemMatch: { $eq: myId } } },
      },
      { $addToSet: { seenBy: myId } }
    );

    // Realtime read receipt: let the sender know their messages were seen.
    const otherSockId = getReceiverSocketId(otherId);
    if (otherSockId) io.to(otherSockId).emit("messageSeen", { fromUserId: myId.toString() });

    res.status(200).json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Error in markConversationRead controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Pin / Unpin a conversation ──
// PUT /api/messages/chat/:id/pin  { pinned: boolean }
export const pinConversation = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id: otherId } = req.params;
    const { pinned } = req.body;

    const shouldPin = pinned !== false;
    const update = shouldPin
      ? { $addToSet: { pinnedChats: otherId } }
      : { $pull: { pinnedChats: otherId } };

    const me = await User.findByIdAndUpdate(myId, update, { new: true }).select("pinnedChats");
    if (!me) return res.status(404).json({ message: "User not found." });

    res.status(200).json({ isPinned: shouldPin ? me.pinnedChats.some((id) => id.toString() === otherId.toString()) : false });
  } catch (error) {
    console.error("Error in pinConversation controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Library (Pinned / Starred / Files) across ALL conversations ──
// GET /api/messages/library?kind=pinned|starred|files
//
// Returns messages the logged-in user actually pinned / starred / sent-as-files
// across every conversation (not just the currently open chat), each enriched
// with its conversation partner (fullName, profilePic, _id) so the UI can show
// context and open the correct thread. Only messages the user is a participant
// of — and that haven't been deleted-for or cleared-for them — are returned.
// This is real data from the DB; nothing is fabricated.
export const getLibrary = async (req, res) => {
  try {
    const myId = req.user._id;
    const { kind } = req.query;

    if (!["pinned", "starred", "files"].includes(kind)) {
      return res.status(400).json({ message: "kind must be 'pinned', 'starred' or 'files'." });
    }

    const filter = {
      $or: [{ senderId: myId }, { receiverId: myId }],
      // The library (pinned/starred/files) reflects direct conversations only;
      // group messages are resolved per-group in the group UI.
      conversationType: { $ne: "group" },
      // Exclude messages this user soft-deleted for themselves or cleared via "clear chat".
      deletedFor: { $not: { $elemMatch: { $eq: myId } } },
      clearedFor: { $not: { $elemMatch: { $eq: myId } } },
      deletedForEveryone: { $ne: true },
    };

    if (kind === "pinned") {
      filter.pinnedBy = myId;
    } else if (kind === "starred") {
      filter.starredBy = myId;
    } else if (kind === "files") {
      filter.fileUrl = { $exists: true, $ne: null, $ne: "" };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    // Resolve every conversation partner in a single query (avoid N+1 lookups).
    const partnerIds = [
      ...new Set(
        messages.map((m) =>
          String(m.senderId) === String(myId) ? String(m.receiverId) : String(m.senderId)
        )
      ),
    ];

    const partners = await User.find({
      _id: { $in: partnerIds },
      // Never expose internal/test/system accounts as conversation partners.
      role: { $nin: ["test", "system"] },
    }).select("fullName profilePic");

    const realPartners = partners.filter((p) => !isAccidentalTestUser(p));
    const partnerMap = new Map(realPartners.map((u) => [String(u._id), u]));

    const enriched = messages.map((m) => {
      const isMine = String(m.senderId) === String(myId);
      const partnerId = isMine ? m.receiverId : m.senderId;
      const partner = partnerMap.get(String(partnerId));
      return {
        ...m,
        partnerId: String(partnerId),
        partnerName: partner?.fullName || "Unknown",
        partnerProfilePic: partner?.profilePic || "",
      };
    });

    res.status(200).json(enriched);
  } catch (error) {
    console.error("Error in getLibrary controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/messages/files/:messageId/download
// Authorizes the user, then either:
//   • redirects the browser to a signed Cloudinary download URL (production CDN),
//     or
//   • serves the stored file directly for development data-URL attachments.
// In both cases the browser receives a real file download (Content-Disposition:
// attachment) with the original filename — no temp file, no server-side proxy
// stream, no downloading of the full file to backend storage first.
export const downloadMessageFile = async (req, res) => {
  try {
    const myId = req.user._id;
    const { messageId } = req.params;
    validateId(messageId, "message id");

    const message = await Message.findById(messageId).lean();
    if (!message || !message.fileUrl) {
      return res.status(404).json({ message: "File not found." });
    }

    // Authorization: user must be a participant in this conversation.
    const isSender = String(message.senderId) === String(myId);
    const isReceiver = String(message.receiverId) === String(myId);
    let isGroupMember = false;
    if (message.conversationType === "group" && message.groupId) {
      const group = await Group.findById(message.groupId).lean();
      isGroupMember = group && group.members && group.members.some((m) => String(m) === String(myId));
    }

    if (!isSender && !isReceiver && !isGroupMember) {
      return res.status(403).json({ message: "Not authorized to access this file." });
    }

    const fileUrl = message.fileUrl;
    const fileName = message.fileName || "download";
    const storedFileType = message.fileType || "";

    // ── Development fallback: fileUrl is a data URL when Cloudinary is not ──
    // configured (see resolveStorageOrFallback in lib/uploadValidation.js). Return
    // the stored data URL as JSON so the frontend can trigger a same-origin download
    // with the correct filename via a temporary <a download> anchor. No temp file,
    // no proxy, no server-side download of the full file to backend storage.
    if (typeof fileUrl === "string" && fileUrl.trim().toLowerCase().startsWith("data:")) {
      return res.json({
        success: true,
        downloadUrl: fileUrl,
        fileName,
        fileType: storedFileType,
      });
    }

    // ── Production / configured: signed Cloudinary download URL ──────────────
    // URL format:
    //   https://res.cloudinary.com/<cloud_name>/<resource_type>/upload/v<version>/<public_id>.<ext>
    let downloadUrl = fileUrl;

    try {
      const urlObj = new URL(fileUrl);
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      const uploadIndex = pathParts.findIndex((p) => p === "upload");
      if (uploadIndex > 0) {
        const resourceType = pathParts[uploadIndex - 1] || "image";
        let publicIdParts = [];
        for (let i = uploadIndex + 1; i < pathParts.length; i++) {
          if (pathParts[i].startsWith("v") && /^v\d+$/.test(pathParts[i])) {
            continue;
          }
          publicIdParts.push(pathParts[i]);
        }
        if (publicIdParts.length > 0) {
          // IMPORTANT: Cloudinary stores the extension as PART OF the public_id
          // for `raw` resource_type files (e.g. public_id =
          // "vyntra/files/lp3jmr3h3mhpxsqnqgph.pdf"). The `fileUrl` this endpoint
          // serves is always a raw file upload (see uploadFile() in
          // lib/uploadValidation.js), so publicIdParts already contains the real
          // public_id INCLUDING the extension. We must NOT split the extension
          // off into a separate `format` — doing so yields a public_id that
          // Cloudinary cannot find ("Resource not found"). Pass the full
          // public_id verbatim with format = null.
          const publicId = publicIdParts.join("/");

          // Generate a signed Cloudinary download URL using the server-side
          // SDK's private_download_url helper. The `attachment: true` flag makes
          // Cloudinary send Content-Disposition: attachment so the browser
          // downloads the file with the correct original filename instead of
          // displaying it inline. Return this as JSON (same contract as the
          // data-URL fallback) so the frontend can trigger the browser download
          // without a server-side proxy / temp file / full-file download to the
          // backend first.
          downloadUrl = cloudinary.utils.private_download_url(
            publicId,
            null,
            {
              resource_type: resourceType,
              type: "upload",
              attachment: true,
            }
          );
        }
      }
    } catch (urlError) {
      console.error("[DOWNLOAD] Failed to parse Cloudinary URL, using original:", urlError.message);
    }

    // Return a signed download URL as JSON (same contract as the data-URL
    // fallback). The frontend triggers the actual browser download from this
    // URL — for Cloudinary that means the signed URL's Content-Disposition:
    // attachment (set via `attachment: true`) carries the original filename.
    return res.json({
      success: true,
      downloadUrl,
      fileName,
      fileType: storedFileType,
    });
  } catch (error) {
    console.error("[DOWNLOAD] controller error:", error.message);
    const status = error?.statusCode || 500;
    if (!res.headersSent) {
      res.status(status).json({ message: error?.message || "Download failed." });
    }
  }
};

// ── Library: delete a single pinned/starred/file message for the current user ──
// DELETE /api/messages/library/:messageId  { kind: "pinned" | "starred" | "files" }
// Removes the current user from the message's pinnedBy / starredBy array, or soft-
// deletes the message (deletedFor) when kind === "files". Never hard-deletes the
// message — the other participant still sees it. Backend enforces auth.
export const deleteLibraryItem = async (req, res) => {
  try {
    const myId = req.user._id;
    const { messageId } = req.params;
    const { kind = "files" } = req.body || {};
    validateId(messageId, "message id");

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    // Authorization: user must be a participant in this conversation.
    if (!(await isMessageParticipant(message, myId))) {
      return res.status(403).json({ message: "Not authorized to delete this item." });
    }

    if (kind === "pinned") {
      message.pinnedBy = (message.pinnedBy || []).filter(
        (uid) => uid.toString() !== myId.toString()
      );
      await message.save();
      broadcastToParticipants(message, "messagePinned", message);
      return res.status(200).json({ message: "Removed from pinned." });
    }

    if (kind === "starred") {
      message.starredBy = (message.starredBy || []).filter(
        (uid) => uid.toString() !== myId.toString()
      );
      await message.save();
      broadcastToParticipants(message, "messageStarred", message);
      return res.status(200).json({ message: "Removed from favorites." });
    }

    // kind === "files" — soft-delete the file message for me (not the other user).
    const deletedFor = message.deletedFor ? [...message.deletedFor] : [];
    if (!deletedFor.some((uid) => uid.toString() === myId.toString())) {
      deletedFor.push(myId);
      message.deletedFor = deletedFor;
      await message.save();
    }
    const sockId = getReceiverSocketId(myId.toString());
    if (sockId) io.to(sockId).emit("messageDeleted", { id: messageId, scope: "me" });
    return res.status(200).json({ message: "File deleted." });
  } catch (error) {
    console.error("Error in deleteLibraryItem controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Library: clear ALL pinned / starred / file messages for the current user ──
// DELETE /api/messages/library/clear  { kind: "pinned" | "starred" | "files" }
// Pinned/Starred: removes the user from every message's pinnedBy/starredBy array.
// Files: soft-deletes (deletedFor) every file message the user sent or received.
// Never hard-deletes — the other participant's view is untouched.
export const clearLibrary = async (req, res) => {
  try {
    const myId = req.user._id;
    const { kind } = req.body || {};
    if (!["pinned", "starred", "files"].includes(kind)) {
      return res.status(400).json({ message: "kind must be 'pinned', 'starred' or 'files'." });
    }

    const baseFilter = {
      $or: [{ senderId: myId }, { receiverId: myId }],
      conversationType: { $ne: "group" },
    };

    if (kind === "pinned") {
      const messages = await Message.find({
        ...baseFilter,
        pinnedBy: myId,
      });
      for (const m of messages) {
        m.pinnedBy = (m.pinnedBy || []).filter((uid) => uid.toString() !== myId.toString());
        await m.save();
        broadcastToParticipants(m, "messagePinned", m);
      }
      return res.status(200).json({ message: "All pinned items cleared.", count: messages.length });
    }

    if (kind === "starred") {
      const messages = await Message.find({
        ...baseFilter,
        starredBy: myId,
      });
      for (const m of messages) {
        m.starredBy = (m.starredBy || []).filter((uid) => uid.toString() !== myId.toString());
        await m.save();
        broadcastToParticipants(m, "messageStarred", m);
      }
      return res.status(200).json({ message: "All favorites cleared.", count: messages.length });
    }

    // kind === "files" — soft-delete every file message for me.
    const result = await Message.updateMany(
      {
        ...baseFilter,
        fileUrl: { $exists: true, $ne: null, $ne: "" },
      },
      { $addToSet: { deletedFor: myId } }
    );
    const sockId = getReceiverSocketId(myId.toString());
    if (sockId) io.to(sockId).emit("libraryCleared", { kind });
    return res.status(200).json({
      message: "All files cleared.",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error in clearLibrary controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

