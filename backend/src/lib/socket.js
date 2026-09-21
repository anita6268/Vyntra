import { Server } from "socket.io";
import http from "http";
import express from "express";
import { corsOptions } from "./cors.js";
import { socketAuthMiddleware } from "../middleware/socket.auth.middleware.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Group from "../models/Group.js";
import CallHistory from "../models/CallHistory.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: corsOptions.origin,
    credentials: corsOptions.credentials,
    methods: corsOptions.methods,
    allowedHeaders: corsOptions.allowedHeaders,
  },
  // Allow both polling and websocket transports
  transports: ["polling", "websocket"],
  // Prevent silent failures during handshake
  allowEIO3: true,
});

// apply authentication middleware to all socket connections
io.use(socketAuthMiddleware);

// we will use this function to check if the user is online or not
export function getReceiverSocketId(userId) {
  const sockets = userSocketMap.get(userId);
  return sockets ? sockets.values().next().value : undefined;
}

const userSocketMap = new Map();

const GROUP_ROOM = (id) => `group:${id}`;

// ── Real-time 1-to-1 voice/video calls (WebRTC signaling relay) ─────────────
// Tracks users currently engaged in a call (ringing or connected) so the server
// can honestly report "busy" for an already-in-call user. Keyed by userId and
// mapping each participant to their peer's call info for cleanup on disconnect.
const activeCalls = new Map(); // userId -> { callId, peerId }

// Tracks call lifecycle state for server-side CallHistory persistence.
// callId -> { callerId, receiverId, callType, accepted: boolean }
const callRegistry = new Map();

// ── Server-side call-history persistence (source of truth) ────────────────────
// Create-or-find a single CallHistory record per callId. Both the server
// (this handler) and the frontend REST API may attempt to create the record;
// findOneAndUpdate + upsert guarantees exactly one document per call.
async function persistCallStart(callId, callerId, receiverId, callType) {
  try {
    const record = await CallHistory.findOneAndUpdate(
      { callId },
      {
        $setOnInsert: {
          callId,
          callerId,
          receiverId,
          callType: callType === "video" ? "video" : "voice",
          status: "cancelled",
          startedAt: new Date(),
        },
      },
      { upsert: true, new: true, lean: true }
    );
    return record?._id || null;
  } catch (err) {
    console.error("persistCallStart error:", err?.message);
    return null;
  }
}

// Finalize a call record: completed | missed | rejected | cancelled.
async function persistCallEnd(callId, status, duration) {
  try {
    const record = await CallHistory.findOne({ callId });
    if (!record) return;
    record.status = status;
    record.endedAt = new Date();
    record.duration = Math.max(0, Math.round(duration || 0));
    // If completed and no explicit duration, compute from startedAt/endedAt.
    if (record.status === "completed" && record.duration === 0) {
      const diff = record.endedAt.getTime() - record.startedAt.getTime();
      record.duration = Math.max(0, Math.round(diff / 1000));
    }
    await record.save();
  } catch (err) {
    console.error("persistCallEnd error:", err?.message);
  }
}

// Emit an event only to a specific online user's socket(s). Returns whether the
// user was reachable so callers can differentiate offline from busy/declined.
function emitToUser(targetId, event, payload) {
  const targetSocketId = getReceiverSocketId(String(targetId));
  if (targetSocketId) {
    io.to(targetSocketId).emit(event, payload);
    return true;
  }
  return false;
}

// Remove a user and their peer from the active-call map (idempotent).
function clearCallFor(userId) {
  const entry = activeCalls.get(userId);
  if (entry) activeCalls.delete(entry.peerId);
  activeCalls.delete(userId);
}

// Join a freshly-connected user to every group room they belong to, so they
// receive group messages in realtime without any extra client work.
async function joinUserToGroupRooms(socket, userId) {
  try {
    const groups = await Group.find({ members: userId }).select("_id");
    groups.forEach((g) => socket.join(GROUP_ROOM(String(g._id))));
  } catch (err) {
    console.error("Error joining group rooms:", err?.message);
  }
}

io.on("connection", (socket) => {
  const userId = socket.userId;
  if (!userSocketMap.has(userId)) userSocketMap.set(userId, new Set());
  userSocketMap.get(userId).add(socket.id);

  // A connected client is online: clear their persisted lastSeen.
  User.findByIdAndUpdate(userId, { lastSeen: null }).catch((err) =>
    console.error("Error clearing lastSeen on connect:", err?.message)
  );

  // Join the user to all their group chat rooms for realtime group messages.
  joinUserToGroupRooms(socket, userId);

    // Deliver messages stored while THIS user was offline. Fire-and-forget so the
  // realtime listener registrations below are NOT delayed. They never reached a
  // live socket, so they are delivered now (to the active client) and each
  // original sender is told their message was delivered (sender UI: ✓ → ✓✓).
  (async () => {
    try {
      const pending = await Message.find({
        receiverId: userId,
        delivered: false,
      }).sort({ createdAt: 1 });
      for (const msg of pending) {
        io.to(socket.id).emit("newMessage", msg);
        const senderSocketId = getReceiverSocketId(String(msg.senderId));
        if (senderSocketId) {
          io.to(senderSocketId).emit("messageDelivered", {
            messageId: msg._id,
            delivered: true,
          });
        }
      }
      if (pending.length) {
        await Message.updateMany(
          { receiverId: userId, delivered: false },
          { $set: { delivered: true } }
        );
      }
    } catch (err) {
      console.error("Error delivering pending messages on connect:", err?.message);
    }
  })();

  const isNewUser = userSocketMap.get(userId).size === 1;

  // io.emit() is used to send events to all connected clients
  const onlineUsersList = Array.from(userSocketMap.keys());
  io.emit("getOnlineUsers", onlineUsersList);

  // Real-time typing indicator: relay the event ONLY to the specific recipient.
  socket.on("typing", ({ receiverId }) => {
    if (!receiverId) return;
    const targetSocketId = getReceiverSocketId(receiverId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("typing", { fromUserId: userId });
    }
  });

  socket.on("stopTyping", ({ receiverId }) => {
    if (!receiverId) return;
    const targetSocketId = getReceiverSocketId(receiverId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("stopTyping", { fromUserId: userId });
    }
  });

  // Group typing indicators — relayed to everyone else in the group room.
  socket.on("groupTyping", ({ groupId }) => {
    if (!groupId) return;
    socket.to(GROUP_ROOM(String(groupId))).emit("groupTyping", { fromUserId: userId, groupId });
  });

  socket.on("groupStopTyping", ({ groupId }) => {
    if (!groupId) return;
    socket.to(GROUP_ROOM(String(groupId))).emit("groupStopTyping", { fromUserId: userId, groupId });
  });

  // Real-time read receipt: tell the OTHER participant their messages were just seen.
  socket.on("messageSeen", ({ receiverId }) => {
    if (!receiverId) return;
    const targetSocketId = getReceiverSocketId(receiverId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("messageSeen", { fromUserId: userId });
    }
  });

  // ── WebRTC call signaling (1-to-1 voice/video) ──────────────────────────
  socket.on("call:offer", async ({ callId, targetId, callType, offer }) => {
    if (!callId || !targetId || !offer) return;
    const caller = await User.findById(userId).select("isPro");
    if (!caller?.isPro) {
      io.to(socket.id).emit("call:rejected", { callId, reason: "Pro required" });
      return;
    }
    const target = String(targetId);
    // A caller who is already in a call cannot place a second one.
    if (activeCalls.has(userId)) {
      persistCallEnd(callId, "cancelled", 0);
      io.to(socket.id).emit("call:rejected", { callId, reason: "busy" });
      return;
    }
    // Target already has an active/ringing call -> honest busy.
    if (activeCalls.has(target)) {
      persistCallStart(callId, userId, target, callType);
      persistCallEnd(callId, "cancelled", 0);
      callRegistry.delete(callId);
      io.to(socket.id).emit("call:busy", { callId });
      return;
    }
    // Create the call-history record on the server (source of truth).
    persistCallStart(callId, userId, target, callType);
    const delivered = emitToUser(target, "call:incoming", {
      callId,
      callerId: userId,
      callerName: socket.user.fullName,
      callerAvatar: socket.user.profilePic,
      callType: callType === "video" ? "video" : "voice",
      offer,
    });
    if (!delivered) {
      // Target has no live socket -> tell the caller the user is offline.
      persistCallEnd(callId, "missed", 0);
      callRegistry.delete(callId);
      io.to(socket.id).emit("call:rejected", { callId, reason: "offline" });
      return;
    }
    // Register the call so we can finalize it correctly when it ends.
    callRegistry.set(callId, {
      callerId: userId,
      receiverId: target,
      callType: callType === "video" ? "video" : "voice",
      accepted: false,
    });
    // Reserve both participants so the target is reported as busy until the
    // call ends, is rejected, or the connection drops.
    activeCalls.set(userId, { callId, peerId: target });
    activeCalls.set(target, { callId, peerId: userId });
  });

  socket.on("call:accepted", ({ callId, targetId }) => {
    if (!callId || !targetId) return;
    const reg = callRegistry.get(callId);
    if (reg) reg.accepted = true;
    emitToUser(targetId, "call:accepted", { callId });
  });

  socket.on("call:rejected", ({ callId, targetId, reason }) => {
    if (!callId || !targetId) return;
    const status = reason === "offline" ? "missed" : "rejected";
    persistCallEnd(callId, status, 0);
    callRegistry.delete(callId);
    clearCallFor(userId);
    emitToUser(targetId, "call:rejected", { callId, reason });
  });

  socket.on("call:answer", ({ callId, targetId, answer }) => {
    if (!callId || !targetId || !answer) return;
    emitToUser(targetId, "call:answer", { callId, answer });
  });

  socket.on("call:ice-candidate", ({ callId, targetId, candidate }) => {
    if (!callId || !targetId || !candidate) return;
    emitToUser(targetId, "call:ice-candidate", { callId, candidate });
  });

  socket.on("call:ended", ({ callId, targetId }) => {
    if (!callId || !targetId) return;
    const reg = callRegistry.get(callId);
    const wasConnected = reg?.accepted || false;
    if (reg) {
      persistCallEnd(callId, wasConnected ? "completed" : "missed", 0);
      callRegistry.delete(callId);
    }
    clearCallFor(userId);
    emitToUser(targetId, "call:ended", { callId });
  });

  // with socket.on we listen for events from clients
  socket.on("disconnect", async () => {
    const sockets = userSocketMap.get(userId);
    if (sockets) {
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        userSocketMap.delete(userId);
      }
    }
    io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));

            // If this user was mid-call, clear the call and tell the peer so they don't
    // hang on a dead connection (closing the browser cleans up the call).
    const active = activeCalls.get(userId);
    if (active?.peerId) {
      const reg = callRegistry.get(active.callId);
      const wasConnected = reg?.accepted || false;
      if (reg) {
        persistCallEnd(active.callId, wasConnected ? "completed" : "missed", 0);
        callRegistry.delete(active.callId);
      }
      emitToUser(active.peerId, "call:ended", { callId: active.callId });
    }
    clearCallFor(userId);

    // Persist real last-seen so contacts/chats can show accurate offline status.
    try {
      await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    } catch (err) {
      console.error("Error saving lastSeen on disconnect:", err?.message);
    }
  });
});

export { io, app, server };
