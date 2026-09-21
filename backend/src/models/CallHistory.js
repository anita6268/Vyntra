import mongoose from "mongoose";

// CallHistory — persisted record of a single 1-to-1 voice/video call.
//
// Exactly ONE document is created per placed call, always by the CALLER side
// (startCall). The receiver sees it through their own history because reads are
// scoped to "caller OR receiver = me". No audio/video is ever stored here — only
// metadata. `endedAt`/`duration` are (re)set when the call is finalized via the
// update endpoint.
const callHistorySchema = new mongoose.Schema(
  {
    // Client-generated unique call identifier (e.g. "<callerId>-<timestamp>").
    // Lets the server and frontend share a single record per call without
    // duplicates, even if both try to create one.
    callId: {
      type: String,
      index: true,
      sparse: true,
    },
    callerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    callType: {
      type: String,
      enum: ["voice", "video"],
      required: true,
    },
    status: {
      type: String,
      enum: ["completed", "missed", "rejected", "cancelled"],
      default: "cancelled",
    },
    startedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    endedAt: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number, // seconds
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// Common history lookup — a user's history is any call they placed OR received.
callHistorySchema.index({ callerId: 1, startedAt: -1 });
callHistorySchema.index({ receiverId: 1, startedAt: -1 });

const CallHistory = mongoose.model("CallHistory", callHistorySchema);

export default CallHistory;