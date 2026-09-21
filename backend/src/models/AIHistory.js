import mongoose from "mongoose";

const aiHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    feature: {
      type: String,
      required: true,
      enum: [
        "translate",
        "grammar",
        "reply-suggestion",
        "smart-reply",
        "meeting-notes",
        "chat",
        "summarize",
      ],
      index: true,
    },
    input: {
      type: String,
      required: true,
    },
    result: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

aiHistorySchema.index({ userId: 1, createdAt: -1 });

const AIHistory = mongoose.model("AIHistory", aiHistorySchema);

export default AIHistory;
