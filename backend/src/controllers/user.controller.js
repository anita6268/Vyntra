import { getReceiverSocketId, io } from "../lib/socket.js";
import User from "../models/User.js";
import { sanitizeUserFor } from "../lib/profilePrivacy.js";
import { validateId } from "../lib/utils.js";

// Helper: serialize a user's block/mute state relative to another user.
const relationshipState = (me, otherId) => {
  const other = String(otherId);
  return {
    isBlocked: (me.blockedUsers || []).some((id) => id.toString() === other),
    hasBlockedMe: false, // filled below by the caller when the other user is loaded
    isMuted: (me.mutedUsers || []).some((id) => id.toString() === other),
  };
};

// GET /api/users/relationship/:userId
// Returns whether the current user has blocked/muted :userId and vice-versa.
export const getRelationship = async (req, res) => {
  try {
    const myId = req.user._id;
    const { userId } = req.params;
    validateId(userId, "user id");

    const [me, other] = await Promise.all([
      User.findById(myId).select("blockedUsers mutedUsers"),
      User.findById(userId).select("blockedUsers"),
    ]);

    if (!me || !other) {
      return res.status(404).json({ message: "User not found." });
    }

    const state = relationshipState(me, userId);
    state.hasBlockedMe = (other.blockedUsers || []).some((id) => id.toString() === myId.toString());

    res.status(200).json(state);
  } catch (error) {
    console.error("Error in getRelationship controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PUT /api/users/block/:userId
// Blocks :userId. Messaging becomes prevented in both directions.
export const blockUser = async (req, res) => {
  try {
    const myId = req.user._id;
    const { userId } = req.params;
    validateId(userId, "user id");

    if (myId.toString() === userId.toString()) {
      return res.status(400).json({ message: "You cannot block yourself." });
    }

    const other = await User.exists({ _id: userId });
    if (!other) {
      return res.status(404).json({ message: "User not found." });
    }

    const me = await User.findByIdAndUpdate(
      myId,
      { $addToSet: { blockedUsers: userId } },
      { new: true }
    ).select("blockedUsers mutedUsers");

    // Notify both users so the UI can update in realtime.
    const mySock = getReceiverSocketId(myId.toString());
    if (mySock) io.to(mySock).emit("userBlocked", { userId, blocked: true });
    const otherSock = getReceiverSocketId(userId.toString());
    if (otherSock) io.to(otherSock).emit("userBlocked", { userId: myId.toString(), blocked: true });

    res.status(200).json(relationshipState(me, userId));
  } catch (error) {
    console.error("Error in blockUser controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PUT /api/users/unblock/:userId
// Unblocks :userId.
export const unblockUser = async (req, res) => {
  try {
    const myId = req.user._id;
    const { userId } = req.params;
    validateId(userId, "user id");

    const me = await User.findByIdAndUpdate(
      myId,
      { $pull: { blockedUsers: userId } },
      { new: true }
    ).select("blockedUsers mutedUsers");

    if (!me) {
      return res.status(404).json({ message: "User not found." });
    }

    const mySock = getReceiverSocketId(myId.toString());
    if (mySock) io.to(mySock).emit("userBlocked", { userId, blocked: false });
    const otherSock = getReceiverSocketId(userId.toString());
    if (otherSock) io.to(otherSock).emit("userBlocked", { userId: myId.toString(), blocked: false });

    res.status(200).json(relationshipState(me, userId));
  } catch (error) {
    console.error("Error in unblockUser controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PUT /api/users/mute/:userId
// Mutes notifications from :userId. Persists in MongoDB.
export const muteUser = async (req, res) => {
  try {
    const myId = req.user._id;
    const { userId } = req.params;
    validateId(userId, "user id");

    if (myId.toString() === userId.toString()) {
      return res.status(400).json({ message: "You cannot mute yourself." });
    }

    const other = await User.exists({ _id: userId });
    if (!other) {
      return res.status(404).json({ message: "User not found." });
    }

    const me = await User.findByIdAndUpdate(
      myId,
      { $addToSet: { mutedUsers: userId } },
      { new: true }
    ).select("blockedUsers mutedUsers");

    const mySock = getReceiverSocketId(myId.toString());
    if (mySock) io.to(mySock).emit("userMuted", { userId, muted: true });

    res.status(200).json(relationshipState(me, userId));
  } catch (error) {
    console.error("Error in muteUser controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PUT /api/users/unmute/:userId
// Unmutes notifications from :userId.
export const unmuteUser = async (req, res) => {
  try {
    const myId = req.user._id;
    const { userId } = req.params;
    validateId(userId, "user id");

    const me = await User.findByIdAndUpdate(
      myId,
      { $pull: { mutedUsers: userId } },
      { new: true }
    ).select("blockedUsers mutedUsers");

    if (!me) {
      return res.status(404).json({ message: "User not found." });
    }

    const mySock = getReceiverSocketId(myId.toString());
    if (mySock) io.to(mySock).emit("userMuted", { userId, muted: false });

    res.status(200).json(relationshipState(me, userId));
  } catch (error) {
    console.error("Error in unmuteUser controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET /api/users/:id
// Returns a privacy-sanitized public profile of :id for the authenticated viewer.
export const getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;
    validateId(id, "user id");
    const user = await User.findById(id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.status(200).json(sanitizeUserFor(user, req.user._id));
  } catch (error) {
    console.error("Error in getUserProfile controller: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /api/users/public/:username
// Returns a privacy-sanitized public profile for sharing links.
// Requires authentication; privacy rules apply based on the authenticated viewer.
export const getPublicProfileByUsername = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.status(200).json(sanitizeUserFor(user, req.user._id));
  } catch (error) {
    console.error("Error in getPublicProfileByUsername controller: ", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ── Note: the old PATCH /api/users/upgrade demo activation has been removed ──
// Real Pro access is now granted only through the subscription flow in
// src/controllers/subscription.controller.js (backed by /api/subscriptions), so
// a free user can no longer self-activate with no payment.

