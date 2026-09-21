import mongoose from "mongoose";
import CallHistory from "../models/CallHistory.js";
import User from "../models/User.js";
import { ENV } from "../lib/env.js";
import { validateId } from "../lib/utils.js";

const VALID_STATUSES = ["completed", "missed", "rejected", "cancelled"];
const VALID_TYPES = ["voice", "video"];

// The STUN servers are public and never secret — safe to always include.
const PUBLIC_STUN = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const toId = (v) => {
  if (mongoose.isValidObjectId(v)) return new mongoose.Types.ObjectId(String(v));
  return null;
};

// Build the enriched shape for a single created/updated call (with direction
// computed against the acting viewer `me`).
async function enrichWithViewer(doc, me) {
  const base = doc;
  const callerId = String(base.callerId?._id || base.callerId);
  const receiverId = String(base.receiverId?._id || base.receiverId);
  const outgoing = callerId === me;
  const other = outgoing ? base.receiverId : base.callerId;
  const otherId = String(other?._id || other);
  return {
    _id: base._id,
    callType: base.callType,
    status: base.status,
    startedAt: base.startedAt,
    endedAt: base.endedAt,
    duration: base.duration || 0,
    createdAt: base.createdAt,
    direction: outgoing ? "outgoing" : "incoming",
    callerId,
    receiverId,
    peerId: otherId,
    peer: {
      _id: otherId,
      fullName: other?.fullName || "Unknown",
      profilePic: other?.profilePic || "",
    },
  };
}

// ── POST /api/calls — create a call-history record (initiated by the caller) ──
// Supports optional `callId` for idempotent find-or-create: the server socket
// handler and the frontend may both try to create the same call, so when
// `callId` is present we upsert to guarantee exactly one record per call.
export const createCallHistory = async (req, res) => {
  try {
    const me = String(req.user._id);
    const { receiverId, callType, status, startedAt, endedAt, duration, callId } =
      req.body || {};

    const receiver = toId(receiverId);
    if (!receiver) return res.status(400).json({ message: "receiverId is required" });
    if (String(receiver) === me)
      return res.status(400).json({ message: "You cannot call yourself" });
    if (!VALID_TYPES.includes(callType))
      return res.status(400).json({ message: "callType must be 'voice' or 'video'" });
    if (status && !VALID_STATUSES.includes(status))
      return res.status(400).json({ message: "Invalid call status" });

    const receiverUser = await User.findById(receiver).select("_id");
    if (!receiverUser)
      return res.status(404).json({ message: "Receiver not found" });

    const now = new Date();
    const baseFields = {
      callerId: req.user._id,
      receiverId: receiver,
      callType,
      status: status || "cancelled",
      startedAt: startedAt ? new Date(startedAt) : now,
    };

    let record;
    if (callId) {
      // Idempotent upsert by callId — prevents duplicate records when both
      // the server socket handler and the frontend POST race to create.
      // Fields are only set on insert (first writer), never overwritten.
      const $set = {
        callerId: req.user._id,
        receiverId: receiver,
        callType,
        startedAt: baseFields.startedAt,
      };
      const $setOnInsert = {
        callId,
        status: status || "cancelled",
        endedAt: endedAt ? new Date(endedAt) : null,
        duration: Number.isFinite(duration) && duration >= 0 ? Math.round(duration) : 0,
      };
      record = await CallHistory.findOneAndUpdate(
        { callId },
        { $set, $setOnInsert },
        { upsert: true, new: true, lean: false }
      );
    } else {
      record = await CallHistory.create({
        ...baseFields,
        endedAt: endedAt ? new Date(endedAt) : null,
        duration: Number.isFinite(duration) && duration >= 0 ? Math.round(duration) : 0,
      });
    }

    const populated = await CallHistory.findById(record._id).populate(
      "callerId receiverId",
      "fullName profilePic"
    );
    res.status(201).json(await enrichWithViewer(populated, me));
  } catch (error) {
    console.error("Error in createCallHistory controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── PUT /api/calls/:id — finalize/update an existing call (caller or receiver) ─
export const updateCallHistory = async (req, res) => {
  try {
    const me = String(req.user._id);
    validateId(req.params.id, "call id");
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid call id" });

    const record = await CallHistory.findById(id);
    if (!record) return res.status(404).json({ message: "Call record not found" });

    const isParticipant =
      String(record.callerId) === me || String(record.receiverId) === me;
    if (!isParticipant)
      return res.status(403).json({ message: "You are not part of this call" });

    const { status, endedAt, duration } = req.body || {};
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status))
        return res.status(400).json({ message: "Invalid call status" });
      record.status = status;
    }
    if (endedAt !== undefined) record.endedAt = endedAt ? new Date(endedAt) : null;
    if (duration !== undefined) {
      if (!Number.isFinite(duration) || duration < 0)
        return res.status(400).json({ message: "Invalid duration" });
      record.duration = Math.round(duration);
    }
    if (record.endedAt && record.startedAt && record.duration === 0 && record.status === "completed") {
      record.duration = Math.max(
        0,
        Math.round((record.endedAt.getTime() - record.startedAt.getTime()) / 1000)
      );
    }
    if (status === "completed" && !record.endedAt) record.endedAt = new Date();

    await record.save();
    const populated = await CallHistory.findById(record._id).populate(
      "callerId receiverId",
      "fullName profilePic"
    );
    res.status(200).json(await enrichWithViewer(populated, me));
  } catch (error) {
    console.error("Error in updateCallHistory controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── GET /api/calls — fetch the current user's call history ───────────────────
export const getMyCallHistory = async (req, res) => {
  try {
    const me = String(req.user._id);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);

    const records = await CallHistory.find({
      $or: [{ callerId: req.user._id }, { receiverId: req.user._id }],
    })
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();

    const userIds = [];
    records.forEach((c) => {
      userIds.push(String(c.callerId), String(c.receiverId));
    });
    const users = await User.find({ _id: { $in: userIds }, role: { $nin: ["test", "system"] } }).select("_id fullName profilePic");
    const byId = new Map(users.map((u) => [String(u._id), u]));

    const data = records.map((c) => {
      const callerId = String(c.callerId);
      const receiverId = String(c.receiverId);
      const outgoing = callerId === me;
      const peerId = outgoing ? c.receiverId : c.callerId;
      return {
        _id: c._id,
        callType: c.callType,
        status: c.status,
        startedAt: c.startedAt,
        endedAt: c.endedAt,
        duration: c.duration || 0,
        createdAt: c.createdAt,
        direction: outgoing ? "outgoing" : "incoming",
        peerId: String(peerId),
        peer: {
          _id: String(peerId),
          fullName: byId.get(String(peerId))?.fullName || "Unknown",
          profilePic: byId.get(String(peerId))?.profilePic || "",
        },
      };
        });

    res.status(200).json(data);
  } catch (error) {
    console.error("Error in getMyCallHistory controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── GET /api/calls/ice-config — authenticated ICE config for WebRTC ────────────
// Returns the full iceServers list (STUN + optional TURN) to the authenticated
// caller. TURN credentials are NEVER hardcoded — they come from environment
// variables. When TURN variables are missing we return STUN-only and log a
// development warning (server never crashes).
export const getIceConfig = (req, res) => {
  try {
    const iceServers = [...PUBLIC_STUN];

    const turnUrl = ENV.TURN_URL || "";
    const turnUsername = ENV.TURN_USERNAME || "";
    const turnCredential = ENV.TURN_CREDENTIAL || "";

    if (turnUrl && turnUsername && turnCredential) {
      iceServers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential,
      });
    } else if (ENV.NODE_ENV !== "production") {
      console.warn(
        "[ICE] TURN_URL / TURN_USERNAME / TURN_CREDENTIAL not fully set — " +
          "returning STUN-only iceServers."
      );
    }

    res.status(200).json({ iceServers });
  } catch (error) {
    console.error("Error in getIceConfig controller:", error.message);
    // Never leak internal errors to the frontend — fall back to STUN-only.
    res.status(200).json({ iceServers: [...PUBLIC_STUN] });
  }
};

// ── DELETE /api/calls/:id — delete a single call-history record ────────────────
// Only the caller OR receiver may delete their own history entry. Hard-deletes
// the record — call history is personal metadata, not a shared message.
export const deleteCallHistory = async (req, res) => {
  try {
    const me = String(req.user._id);
    validateId(req.params.id, "call id");
    const id = toId(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid call id" });

    const record = await CallHistory.findById(id);
    if (!record) return res.status(404).json({ message: "Call record not found" });

    const isParticipant =
      String(record.callerId) === me || String(record.receiverId) === me;
    if (!isParticipant) {
      return res.status(403).json({ message: "You are not part of this call" });
    }

    await CallHistory.findByIdAndDelete(id);
    res.status(200).json({ message: "Call history deleted." });
  } catch (error) {
    console.error("Error in deleteCallHistory controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── DELETE /api/calls — clear the ENTIRE call history for the current user ─────
// Hard-deletes every CallHistory record where the user is caller OR receiver.
// Active/ongoing calls are NOT affected — this only removes past history.
export const clearCallHistory = async (req, res) => {
  try {
    const me = req.user._id;
    const result = await CallHistory.deleteMany({
      $or: [{ callerId: me }, { receiverId: me }],
    });
    res.status(200).json({
      message: "Call history cleared.",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error in clearCallHistory controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

