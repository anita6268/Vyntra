import cloudinary from "../lib/cloudinary.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import Group from "../models/Group.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { validateId } from "../lib/utils.js";
import { uploadGroupAvatar } from "../lib/uploadValidation.js";

const MAX_GROUP_MEMBERS = 25; // reasonable cap — prevents unbounded rosters
const GROUP_ROOM = (id) => `group:${id}`;

const TEST_NAME_PATTERN = /^(QA|Test|Demo|Mock|Fixture|System|Bot|Auto)\b/i;
const TIMESTAMP_SUFFIX = /\d{8,14}$/;
const isAccidentalTestUser = (user) => {
  const name = String(user.fullName || "");
  if (!name) return false;
  if (TEST_NAME_PATTERN.test(name)) return true;
  if (TIMESTAMP_SUFFIX.test(name)) return true;
  return false;
};

// ── Socket helpers ────────────────────────────────────────────────────────────
// Join every provided user's socket to the group room (used at create time and
// when members are added while online).
const joinRoomsForSockets = (userIds, groupId) => {
  for (const uid of userIds) {
    const sockId = getReceiverSocketId(String(uid));
    const sock = sockId ? io.sockets.sockets.get(sockId) : null;
    if (sock) sock.join(GROUP_ROOM(groupId));
  }
};

// Enrich a group document with member/user resolution + per-user state. Also
// computes a REAL unread count for the given viewer (their own sends excluded).
const enrichGroup = async (group, viewerId) => {
  const plain = group.toObject ? group.toObject() : group;
  const viewer = String(viewerId);

  const allIds = [
    ...new Set(
      (plain.members || []).map((m) =>
        typeof m === "object" ? String(m._id || m) : String(m)
      )
    ),
  ];
  const members = await User.find({ _id: { $in: allIds }, role: { $nin: ["test", "system"] } }).select("_id fullName profilePic");
  const realMembers = members.filter((m) => !isAccidentalTestUser(m));
  const memberMap = new Map(realMembers.map((u) => [String(u._id), u]));

  const memberList = (plain.members || []).map((m) => {
    const id = typeof m === "object" ? String(m._id || m) : String(m);
    const u = memberMap.get(id) || {};
    return { _id: id, fullName: u.fullName || "Unknown", profilePic: u.profilePic || "" };
  });

  const adminIds = (plain.admins || []).map((a) => String(a._id || a));
  const createdBy = plain.createdBy;
  const createdByUser =
    typeof createdBy === "object"
      ? createdBy
      : await User.findById(createdBy).select("_id fullName profilePic");

  const unreadCount = await Message.countDocuments({
    conversationType: "group",
    groupId: plain._id,
    senderId: { $ne: viewerId },
    deletedFor: { $not: { $elemMatch: { $eq: viewerId } } },
    seenBy: { $not: { $elemMatch: { $eq: viewerId } } },
  });

  return {
    ...plain,
    members: memberList,
    memberCount: memberList.length,
    admins: adminIds,
    createdBy: createdByUser
      ? { _id: String(createdByUser._id), fullName: createdByUser.fullName, profilePic: createdByUser.profilePic || "" }
      : null,
    isAdmin: adminIds.includes(viewer),
    isMember: allIds.includes(viewer),
    unreadCount,
  };
};

// ── Create group ─────────────────────────────────────────────────────────────
// POST /api/groups  { name, avatar?, memberIds: [] }
export const createGroup = async (req, res) => {
  try {
    const { name, avatar, memberIds } = req.body;
    const creatorId = req.user._id;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Group name is required." });
    }
    if (name.trim().length > 64) {
      return res.status(400).json({ message: "Group name must be 64 characters or fewer." });
    }

    let selected = Array.isArray(memberIds) ? memberIds : [];
    // Deduplicate, drop non-strings, and drop self (the creator is added anyway).
    selected = [...new Set(selected.map((id) => String(id)).filter(Boolean))].filter(
      (id) => id !== String(creatorId)
    );

    // Minimum participants: creator + at least 1 selected member.
    if (selected.length < 1) {
      return res.status(400).json({ message: "Select at least 1 participant to create a group." });
    }
    if (selected.length + 1 > MAX_GROUP_MEMBERS) {
      return res.status(400).json({ message: `A group can have at most ${MAX_GROUP_MEMBERS} members.` });
    }

    // Only real (non-test/system) users may be added as members.
    const realUsers = await User.find({
      _id: { $in: selected },
      role: { $nin: ["test", "system"] },
    }).select("_id");
    if (realUsers.length !== selected.length) {
      return res.status(400).json({ message: "One or more selected participants are not valid users." });
    }

    let avatarUrl = "";
    if (avatar) {
      avatarUrl = await uploadGroupAvatar(avatar, "vyntra/groups");
    }

    const members = [creatorId, ...selected.map((id) => String(id))];
    const group = new Group({
      name: name.trim(),
      avatar: avatarUrl,
      createdBy: creatorId,
      members,
      admins: [creatorId],
    });
    await group.save();

    // Realtime: creator (and any online selected members) join the room so the
    // brand-new group is live immediately.
    joinRoomsForSockets(members, group._id);
    const created = await enrichGroup(group, creatorId);

    res.status(201).json(created);
  } catch (error) {
    console.error("Error in createGroup controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── List my groups ───────────────────────────────────────────────────────────
// GET /api/groups
export const getGroups = async (req, res) => {
  try {
    const myId = req.user._id;
    const groups = await Group.find({ members: myId }).sort({ lastMessageAt: -1, createdAt: -1 });

    const enriched = await Promise.all(groups.map((g) => enrichGroup(g, myId)));

    res.status(200).json(enriched);
  } catch (error) {
    console.error("Error in getGroups controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Get one group ────────────────────────────────────────────────────────────
// GET /api/groups/:id — only accessible to members.
export const getGroupById = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id } = req.params;
    validateId(id, "group id");
    const group = await Group.findOne({ _id: id, members: myId });
    if (!group) return res.status(404).json({ message: "Group not found." });

    const enriched = await enrichGroup(group, myId);
    res.status(200).json(enriched);
  } catch (error) {
    console.error("Error in getGroupById controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Update group (rename / change avatar) ────────────────────────────────────
// PATCH /api/groups/:id  { name?, avatar? } — admin only.
export const updateGroup = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id } = req.params;
    validateId(id, "group id");
    const { name, avatar } = req.body;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found." });

    if (!(group.admins || []).some((a) => String(a) === String(myId))) {
      return res.status(403).json({ message: "Only admins can edit the group." });
    }

    if (name !== undefined) {
      if (!name.trim()) return res.status(400).json({ message: "Group name cannot be empty." });
      if (name.trim().length > 64) return res.status(400).json({ message: "Group name must be 64 characters or fewer." });
      group.name = name.trim();
    }
    if (avatar !== undefined) {
      if (avatar) {
        group.avatar = await uploadGroupAvatar(avatar, "vyntra/groups");
      } else {
        group.avatar = "";
      }
    }
    await group.save();

    // Realtime refresh for all online members.
    io.to(GROUP_ROOM(id)).emit("groupUpdated", { groupId: id });
    const enriched = await enrichGroup(group, myId);
    res.status(200).json(enriched);
  } catch (error) {
    console.error("Error in updateGroup controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Delete group ─────────────────────────────────────────────────────────────
// DELETE /api/groups/:id — admin only.
export const deleteGroup = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id } = req.params;
    validateId(id, "group id");
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found." });

    if (!(group.admins || []).some((a) => String(a) === String(myId))) {
      return res.status(403).json({ message: "Only admins can delete the group." });
    }

    await Group.findByIdAndDelete(id);

    // Tell everyone it's gone.
    io.to(GROUP_ROOM(id)).emit("groupRemoved", { groupId: id });
    res.status(200).json({ message: "Group deleted." });
  } catch (error) {
    console.error("Error in deleteGroup controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Add members ──────────────────────────────────────────────────────────────
// POST /api/groups/:id/members  { memberIds: [] } — admin only.
export const addGroupMember = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id } = req.params;
    validateId(id, "group id");
    const { memberIds } = req.body;

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found." });

    if (!(group.admins || []).some((a) => String(a) === String(myId))) {
      return res.status(403).json({ message: "Only admins can add members." });
    }

    const toAdd = Array.isArray(memberIds)
      ? [...new Set(memberIds.map((m) => String(m)).filter(Boolean))]
      : [];
    if (toAdd.length === 0) {
      return res.status(400).json({ message: "No members selected." });
    }

    // Validate real users.
    const realUsers = await User.find({
      _id: { $in: toAdd },
      role: { $nin: ["test", "system"] },
    }).select("_id");
    if (realUsers.length !== toAdd.length) {
      return res.status(400).json({ message: "One or more selected participants are not valid users." });
    }

    const existing = new Set((group.members || []).map((m) => String(m)));
    const fresh = toAdd.filter((uid) => !existing.has(uid));
    if (fresh.length === 0) {
      return res.status(400).json({ message: "Selected users are already members." });
    }
    if ((group.members?.length || 0) + fresh.length > MAX_GROUP_MEMBERS) {
      return res.status(400).json({ message: `A group can have at most ${MAX_GROUP_MEMBERS} members.` });
    }

    fresh.forEach((uid) => group.members.push(uid));
    await group.save();

    // Join newly-added online members to the room so they go live instantly.
    joinRoomsForSockets(fresh, group._id);

    io.to(GROUP_ROOM(id)).emit("groupUpdated", { groupId: id });
    const enriched = await enrichGroup(group, myId);
    res.status(200).json(enriched);
  } catch (error) {
    console.error("Error in addGroupMember controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
// ── Remove member / leave group ──────────────────────────────────────────────
// DELETE /api/groups/:id/members/:userId
//   • :userId === current user  → leave (any member may).
//   • :userId !== current user  → admin-only removal.
export const removeGroupMember = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id, userId } = req.params;
    validateId(id, "group id");
    validateId(userId, "user id");
    const isSelfLeave = String(userId) === String(myId);

    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: "Group not found." });

    if (!isSelfLeave && !(group.admins || []).some((a) => String(a) === String(myId))) {
      return res.status(403).json({ message: "Only admins can remove members." });
    }

    if (!(group.members || []).some((m) => String(m) === String(userId))) {
      return res.status(400).json({ message: "This user is not a member." });
    }

    group.members = (group.members || []).filter((m) => String(m) !== String(userId));
    group.admins = (group.admins || []).filter((a) => String(a) !== String(userId));

    let deleted = false;
    if (group.members.length === 0) {
      // Nobody left — the group ceases to exist.
      await Group.findByIdAndDelete(id);
      deleted = true;
    } else {
      // Keep the group manageable: if no admins remain, promote the first member.
      if (group.admins.length === 0) group.admins.push(group.members[0]);
      await group.save();
    }

    // The removed/leaving user's socket must leave the room too.
    const removedSockId = getReceiverSocketId(String(userId));
    const removedSock = removedSockId ? io.sockets.sockets.get(removedSockId) : null;
    if (removedSock) removedSock.leave(GROUP_ROOM(id));

    if (deleted) {
      io.to(GROUP_ROOM(id)).emit("groupRemoved", { groupId: id });
      if (removedSock) removedSock.emit("groupRemoved", { groupId: id });
      return res.status(200).json({ message: "Group deleted.", deleted: true });
    }

    // Remaining members refresh their roster.
    io.to(GROUP_ROOM(id)).emit("groupUpdated", { groupId: id });
    // The removed user should also drop it from their list.
    if (removedSock && !isSelfLeave) removedSock.emit("groupMemberRemoved", { groupId: id });

    const enriched = await enrichGroup(group, myId);
    res.status(200).json({ ...enriched, deleted: false });
  } catch (error) {
    console.error("Error in removeGroupMember controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ── Mark group as read ───────────────────────────────────────────────────────
// PUT /api/groups/:id/read — any member marks every group message they haven't
// seen as seen (per-user, so removing a member never affects others).
export const markGroupRead = async (req, res) => {
  try {
    const myId = req.user._id;
    const { id } = req.params;
    validateId(id, "group id");
    const group = await Group.findOne({ _id: id, members: myId });
    if (!group) return res.status(404).json({ message: "Group not found." });

    const result = await Message.updateMany(
      { conversationType: "group", groupId: id, senderId: { $ne: myId }, seenBy: { $not: { $elemMatch: { $eq: myId } } } },
      { $addToSet: { seenBy: myId } }
    );

    res.status(200).json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Error in markGroupRead controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
