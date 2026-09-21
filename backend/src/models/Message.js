import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // A message lives in EITHER a direct conversation OR a group.
    //   • direct: conversationType === "direct", receiverId = the other user,
    //     groupId = null
    //   • group:  conversationType === "group", groupId = the group, receiverId = null
    conversationType: {
      type: String,
      enum: ["direct", "group"],
      default: "direct",
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    text: {
      type: String,
      trim: true,
      maxlength: 5000,
    },
    image: {
      type: String,
    },
    // Voice message (audio data URL or uploaded URL + metadata).
    audio: {
      type: String,
    },
    audioDuration: {
      type: Number,
    },
    // Arbitrary file attachment (Cloudinary raw upload).
    fileUrl: {
      type: String,
    },
    fileName: {
      type: String,
    },
    fileType: {
      type: String,
    },
    fileSize: {
      type: Number,
    },
    // WhatsApp-style reply: stores the original message's key fields.
    replyTo: {
      type: Object,
      default: null,
    },
    // Marks a message as forwarded.
    forwarded: {
      type: Boolean,
      default: false,
    },
    // Marks a message as edited (shows "edited" label in UI).
    edited: {
      type: Boolean,
      default: false,
    },
    // Reactions: [{ userId, emoji }] — one reaction per user (upsert).
    reactions: {
      type: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          emoji: { type: String, default: "" },
        },
      ],
      default: [],
    },
    // Per-user pinning (a message can be pinned independently for each participant).
    pinnedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    // Per-user starring/favorites.
    starredBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
        // Users who have seen/read this message (read receipts).
    seenBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    // Delivery receipt: set to true ONCE the recipient's active client has actually
    // received this message over Socket.io (i.e. they were online when it was sent,
    // or came online and were handed the message). A successful MongoDB save / HTTP
    // response does NOT mark a message delivered — an offline recipient stays "sent".
    delivered: {
      type: Boolean,
      default: false,
    },
    // Soft-delete: stores user ids who deleted the message for themselves.
    deletedFor: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    // Clear-chat: stores user ids whose "clear chat" hid this message for them.
    clearedFor: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    // Soft-delete for everyone: when true, the message is hidden for all participants.
    deletedForEveryone: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;

