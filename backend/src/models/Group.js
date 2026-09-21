import mongoose from "mongoose";

// Vyntra Groups — multi-participant conversations backed by MongoDB.
//
// `members` is the full roster; `admins` is the subset allowed to manage the
// group (rename, change avatar, add/remove members, delete). `createdBy` is the
// original creator and is kept as a permanent record even if they later leave.
const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
    },
    avatar: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    members: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    admins: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    // Reference to the most recent Message in the group (for the list preview).
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    lastMessageAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true } // createdAt & updatedAt
);

const Group = mongoose.model("Group", groupSchema);

export default Group;
