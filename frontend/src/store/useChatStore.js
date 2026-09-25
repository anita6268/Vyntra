import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

const notificationSound = new Audio("/sounds/notification.mp3");
notificationSound.load();

function playNotificationSound() {
  try {
    notificationSound.currentTime = 0;
    notificationSound.play().catch(() => {});
  } catch {
    // missing file or autoplay restriction — fail silently
  }
}

const NOTIFICATIONS_KEY = "vyntra-notifications-enabled";

function getNotificationsEnabled() {
  try {
    return localStorage.getItem(NOTIFICATIONS_KEY) === "true";
  } catch {
    return false;
  }
}

function setNotificationsEnabled(value) {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, String(value));
  } catch {
    // ignore
  }
}

function showBrowserNotification(title, options = {}) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      icon: "/avatar.png",
      badge: "/avatar.png",
      ...options,
    });
    n.addEventListener("click", () => {
      if (options.onClick) options.onClick();
      n.close();
    });
    n.addEventListener("error", () => {
      n.close();
    });
  } catch {
    // fail silently
  }
}

const notifiedMessageIds = new Set();
const MAX_NOTIFIED_IDS = 500;
const downloadLocks = new Set();

export const useChatStore = create((set, get) => ({
  allContacts: [],
  chats: [],
  messages: [],
  activeTab: "chats",
  selectedUser: null,
  // ── Groups ──
  groups: [],
  selectedGroup: null,
  isGroupsLoading: false,
  isCreatingGroup: false,
  isUsersLoading: false,
  isMessagesLoading: false,
  messagesError: null,
  // ── Group modal open-state (shared by GroupsPanel / ChatHeader / ChatPage) ──
  isCreateGroupOpen: false,
  isGroupInfoOpen: false,
  isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === true,
  notificationsEnabled: getNotificationsEnabled(),
  // { [userId]: true } — set ONLY when Socket.io reports the user is typing.
  typingUsers: {},
  // Per-conversation state (loaded when selecting a user / from chats list).
  isBlocked: false,
  hasBlockedMe: false,
  isMuted: false,

  // Global message library (Pinned / Starred / Files) across ALL conversations.
  // Each entry is keyed by "pinned" | "starred" | "files" and holds the
  // enriched list returned by GET /api/messages/library, or null until loaded.
  library: { pinned: null, starred: null, files: null },
  isLibraryLoading: false,
  libraryError: null,

  // Persisted voice/video call history (GET /api/calls). Real data only.
  callHistory: [],
  isCallHistoryLoading: false,
  callHistoryError: null,

  // Persisted AI interaction history (GET /api/ai/history). Real data only.
  aiHistory: [],
  isAiHistoryLoading: false,
  aiHistoryError: null,

  toggleSound: () => {
    localStorage.setItem("isSoundEnabled", !get().isSoundEnabled);
    set({ isSoundEnabled: !get().isSoundEnabled });
  },

  testSound: () => {
    playNotificationSound();
  },

  requestNotificationPermission: async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }
    if (Notification.permission === "granted") {
      setNotificationsEnabled(true);
      set({ notificationsEnabled: true });
      return true;
    }
    if (Notification.permission === "denied") {
      setNotificationsEnabled(false);
      set({ notificationsEnabled: false });
      return false;
    }
    const result = await Notification.requestPermission();
    const granted = result === "granted";
    setNotificationsEnabled(granted);
    set({ notificationsEnabled: granted });
    return granted;
  },

  disableNotifications: () => {
    setNotificationsEnabled(false);
    set({ notificationsEnabled: false });
  },

  testNotification: () => {
    if (!get().notificationsEnabled) return;
    showBrowserNotification("Vyntra", {
      body: "Test notification — your notifications are working!",
      requireInteraction: false,
    });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),
    setSelectedUser: (selectedUser) => {
    set({
      selectedUser,
      // Opening a direct chat clears any open group chat & its relationship bits.
      selectedGroup: null,
      isBlocked: selectedUser?.isBlocked === true,
      hasBlockedMe: selectedUser?.hasBlockedMe === true,
      isMuted: selectedUser?.isMuted === true,
      // Clear the previous conversation's messages so stale content from a
      // previously-open chat is not shown while the fresh fetch loads.
      // (getMessagesByUserId now *merges* instead of replaces, so the clearing
      // must happen here — at conversation-switch time — rather than inside the
      // fetch itself.)
      messages: [],
    });
    // Opening a conversation clears its real unread count.
    if (selectedUser?._id) get().markConversationRead(selectedUser._id);
  },

  // ── Group state ─────────────────────────────────────────────────────────────
    setSelectedGroup: (selectedGroup) => {
    set({
      selectedGroup,
      // Opening a group chat clears any open direct chat + block/mute bits.
      selectedUser: null,
      isBlocked: false,
      hasBlockedMe: false,
      isMuted: false,
      // Clear the previous conversation's messages — same rationale as
      // setSelectedUser.
      messages: [],
    });
        if (selectedGroup?._id) get().markGroupRead(selectedGroup._id);
  },

  // ── Group modal open-state helpers (shared across components) ──
  openCreateGroup: () => set({ isCreateGroupOpen: true, isGroupInfoOpen: false }),
  closeCreateGroup: () => set({ isCreateGroupOpen: false }),
  openGroupInfo: () => set({ isGroupInfoOpen: true }),
  closeGroupInfo: () => set({ isGroupInfoOpen: false }),
  toggleGroupInfo: () => set((s) => ({ isGroupInfoOpen: !s.isGroupInfoOpen })),

  // Load every group the current user belongs to (real data, enriched server-side).
  getGroups: async () => {
    set({ isGroupsLoading: true });
    try {
      const res = await axiosInstance.get("/groups");
      const groups = Array.isArray(res.data) ? res.data : [];
      set({ groups });
      // Keep the open group fresh if it's still listed.
      const sel = get().selectedGroup;
      if (sel) {
        const match = groups.find((g) => String(g._id) === String(sel._id));
        if (match) set({ selectedGroup: match });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load groups");
    } finally {
      set({ isGroupsLoading: false });
    }
  },

  // Refresh a single group (after member/name edits) and keep lists in sync.
  getGroupById: async (groupId) => {
    try {
      const res = await axiosInstance.get(`/groups/${groupId}`);
      set((state) => ({
        groups: state.groups.map((g) => (String(g._id) === String(groupId) ? res.data : g)),
        selectedGroup:
          state.selectedGroup && String(state.selectedGroup._id) === String(groupId) ? res.data : state.selectedGroup,
      }));
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load group");
      return null;
    }
  },
  // Create a group and immediately surface it in the list.
  createGroup: async ({ name, avatar = "", memberIds = [] }) => {
    set({ isCreatingGroup: true });
    try {
      const res = await axiosInstance.post("/groups", { name, avatar, memberIds });
      set((state) => ({
        groups: [res.data, ...state.groups.filter((g) => String(g._id) !== String(res.data._id))],
      }));
      toast.success("Group created");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create group");
      return null;
    } finally {
      set({ isCreatingGroup: false });
    }
  },

  // Rename / change avatar (admin only on the backend).
  updateGroup: async (groupId, data) => {
    try {
      const res = await axiosInstance.patch(`/groups/${groupId}`, data);
      const updated = res.data;
      set((state) => ({
        groups: state.groups.map((g) => (String(g._id) === String(groupId) ? updated : g)),
        selectedGroup:
          state.selectedGroup && String(state.selectedGroup._id) === String(groupId) ? updated : state.selectedGroup,
      }));
      toast.success("Group updated");
      return updated;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update group");
      return null;
    }
  },

  // Delete a group (admin only). Removes it everywhere and closes the chat.
  deleteGroup: async (groupId) => {
    try {
      await axiosInstance.delete(`/groups/${groupId}`);
      set((state) => ({
        groups: state.groups.filter((g) => String(g._id) !== String(groupId)),
        selectedGroup:
          state.selectedGroup && String(state.selectedGroup._id) === String(groupId) ? null : state.selectedGroup,
        messages: state.selectedGroup && String(state.selectedGroup._id) === String(groupId) ? [] : state.messages,
        selectedUser:
          state.selectedUser && state.selectedGroup && String(state.selectedGroup._id) === String(groupId) ? null : state.selectedUser,
      }));
      toast.success("Group deleted");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete group");
      return false;
    }
  },
// Add members (admin only on the backend).
  addGroupMember: async (groupId, memberIds) => {
    try {
      const res = await axiosInstance.post(`/groups/${groupId}/members`, { memberIds });
      const updated = res.data;
      set((state) => ({
        groups: state.groups.map((g) => (String(g._id) === String(groupId) ? updated : g)),
        selectedGroup:
          state.selectedGroup && String(state.selectedGroup._id) === String(groupId) ? updated : state.selectedGroup,
      }));
      toast.success("Member added");
      return updated;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add member");
      return null;
    }
  },

  // Remove a member (admin) — refreshes the roster locally too.
  removeGroupMember: async (groupId, userId) => {
    try {
      const res = await axiosInstance.delete(`/groups/${groupId}/members/${userId}`);
      const updated = res.data;
      if (updated?.deleted) {
        set((state) => ({
          groups: state.groups.filter((g) => String(g._id) !== String(groupId)),
          selectedGroup:
            state.selectedGroup && String(state.selectedGroup._id) === String(groupId) ? null : state.selectedGroup,
          messages: state.selectedGroup && String(state.selectedGroup._id) === String(groupId) ? [] : state.messages,
        }));
        toast.success("Group deleted");
      } else if (updated) {
        set((state) => ({
          groups: state.groups.map((g) => (String(g._id) === String(groupId) ? updated : g)),
          selectedGroup:
            state.selectedGroup && String(state.selectedGroup._id) === String(groupId) ? updated : state.selectedGroup,
        }));
      }
      return updated;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove member");
      return null;
    }
  },

  // Leave a group — removes the current user's membership, closes the chat and
  // drops the group from the user's Groups list.
  leaveGroup: async (groupId) => {
    const { authUser } = useAuthStore.getState();
    if (!authUser) return null;
    const res = await get().removeGroupMember(groupId, authUser._id);
    if (res?.deleted) {
      // Backend deleted the group because this user was the last member.
      // removeGroupMember already cleaned up local state and showed the toast.
      return res;
    }
    if (res) {
      toast.success("You left the group");
      set((state) => ({
        selectedGroup: state.selectedGroup && String(state.selectedGroup._id) === String(groupId) ? null : state.selectedGroup,
        messages: state.selectedGroup && String(state.selectedGroup._id) === String(groupId) ? [] : state.messages,
      }));
    }
    return res;
  },

  // Mark every message in a group as read for me.
  markGroupRead: async (groupId) => {
    try {
      await axiosInstance.put(`/groups/${groupId}/read`);
      set((state) => ({
        groups: state.groups.map((g) =>
          String(g._id) === String(groupId) ? { ...g, unreadCount: 0 } : g
        ),
      }));
    } catch {
      /* non-critical */
    }
  },

  // Fetch the messages for the open group.
    getMessagesByGroupId: async (groupId) => {
    // Merge (not replace) so messages sent while the fetch is in-flight are
    // not wiped by a stale [] response — same race-condition fix as
    // getMessagesByUserId.  Clearing of previous-conversation messages is
    // handled by setSelectedGroup instead.
    set({ isMessagesLoading: true, messagesError: null });
    try {
      const res = await axiosInstance.get(`/messages/group/${groupId}`);
      const raw = Array.isArray(res.data) ? res.data : [];
      const fetched = [...new Map(raw.map((m) => [String(m._id), m])).values()];
      set((state) => {
        const merged = new Map(state.messages.map((m) => [String(m._id), m]));
        for (const m of fetched) {
          merged.set(String(m._id), m);
        }
        return { messages: Array.from(merged.values()), messagesError: null };
      });
    } catch (error) {
      const msg = error.response?.data?.message || error.message || "Failed to load messages";
      toast.error(msg);
      set({ messagesError: msg });
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  // Move a group to the top of the list + refresh its preview locally.
  bumpGroupPreview: (message) => {
    if (!message?.groupId) return;
    const gid = String(message.groupId);
    const { authUser } = useAuthStore.getState();
    const fromMe = authUser && String(message.senderId) === String(authUser._id);
    set((state) => ({
      groups: state.groups
        .map((g) => {
          if (String(g._id) !== gid) return g;
          return {
            ...g,
            lastMessage: message,
            lastMessageAt: message.createdAt || new Date().toISOString(),
            unreadCount: fromMe ? 0 : g.unreadCount || 0,
          };
        })
        .sort((a, b) => {
          const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bt - at;
        }),
    }));
  },


  getRelationship: async (userId) => {
    try {
      const res = await axiosInstance.get(`/users/relationship/${userId}`);
      set({
        isBlocked: res.data?.isBlocked === true,
        hasBlockedMe: res.data?.hasBlockedMe === true,
        isMuted: res.data?.isMuted === true,
      });
      return res.data;
    } catch {
      // Relationship is not critical for rendering; keep defaults on failure.
      return null;
    }
  },

  getUserProfile: async (userId) => {
    try {
      const res = await axiosInstance.get(`/users/${userId}`);
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load profile");
      return null;
    }
  },

  getAllContacts: async (search = "") => {
    set({ isUsersLoading: true });
    try {
      const q = search && search.trim() ? `?q=${encodeURIComponent(search.trim())}` : "";
      const res = await axiosInstance.get(`/messages/contacts${q}`);
      const contacts = Array.isArray(res.data) ? res.data : [];
      const deduped = [...new Map(contacts.map((u) => [String(u._id), u])).values()];
      set({ allContacts: deduped });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load contacts");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  matchContacts: async (phones = []) => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.post("/messages/contacts/match", { phones });
      const contacts = Array.isArray(res.data) ? res.data : [];
      const deduped = [...new Map(contacts.map((u) => [String(u._id), u])).values()];
      set({ allContacts: deduped });
      return deduped;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to match contacts");
      return [];
    } finally {
      set({ isUsersLoading: false });
    }
  },

  lookupContactByPhone: async (phone) => {
    try {
      const res = await axiosInstance.get(`/messages/contacts/phone?number=${encodeURIComponent(phone)}`);
      return Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
    } catch {
      return [];
    }
  },

  lookupContact: async (identifier) => {
    try {
      const res = await axiosInstance.get(`/messages/contacts?q=${encodeURIComponent(identifier)}`);
      return Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
    } catch {
      return [];
    }
  },

    getMyChatPartners: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/chats");
      set({ chats: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load chats");
    } finally {
      set({ isUsersLoading: false });
    }
  },

  // Fetch the logged-in user's global library (pinned / starred / files) across
  // every conversation. Real data from the backend — nothing is fabricated.
  // Results are cached per kind so the panel stays snappy on re-open; re-fetch
  // is triggered explicitly via the refresh button in the panel.
  getLibrary: async (kind) => {
    set({ isLibraryLoading: true, libraryError: null });
    try {
      const res = await axiosInstance.get(`/messages/library?kind=${encodeURIComponent(kind)}`);
      const data = Array.isArray(res.data) ? res.data : [];
      set((state) => ({
        library: { ...state.library, [kind]: data },
      }));
      return data;
    } catch (error) {
      const msg = error.response?.data?.message || error.message || "Failed to load library";
      set({ libraryError: msg });
      toast.error(msg);
      return [];
    } finally {
      set({ isLibraryLoading: false });
    }
  },

  // Fetch the logged-in user's persisted call history (GET /api/calls).
  // Failure is surfaced so the Calls panel can show an error + retry state.
  getCallHistory: async () => {
    set({ isCallHistoryLoading: true, callHistoryError: null });
    try {
      const res = await axiosInstance.get("/calls");
      const data = Array.isArray(res.data) ? res.data : [];
      set({ callHistory: data });
      return data;
    } catch (error) {
      const msg = error.response?.data?.message || error.message || "Failed to load call history";
      set({ callHistoryError: msg });
      return [];
    } finally {
      set({ isCallHistoryLoading: false });
    }
  },

  // Fetch the logged-in user's AI interaction history (GET /api/ai/history).
  getAiHistory: async () => {
    set({ isAiHistoryLoading: true, aiHistoryError: null });
    try {
      const res = await axiosInstance.get("/ai/history");
      const data = Array.isArray(res.data) ? res.data : [];
      set({ aiHistory: data });
      return data;
    } catch (error) {
      const msg = error.response?.data?.message || error.message || "Failed to load AI history";
      set({ aiHistoryError: msg });
      return [];
    } finally {
      set({ isAiHistoryLoading: false });
    }
  },

  // ── Library (Pinned / Favorites / Files) delete & clear ──────────────────────
  // DELETE /api/messages/library/:messageId { kind }
  // Removes the current user from the message's pinnedBy / starredBy array, or
  // soft-deletes the file message (deletedFor) when kind === "files".
  deleteLibraryItem: async (messageId, kind = "files") => {
    try {
      const res = await axiosInstance.delete(`/messages/library/${messageId}`, {
        data: { kind },
      });
      // Update the cached library view immediately.
      set((state) => {
        const arr = state.library[kind] || [];
        if (kind === "files") {
          return {
            library: {
              ...state.library,
              [kind]: arr.filter((m) => String(m._id) !== String(messageId)),
            },
          };
        }
        return {
          library: {
            ...state.library,
            [kind]: arr.filter((m) => String(m._id) !== String(messageId)),
          },
        };
      });
      toast.success(res.data?.message || "Item removed");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete item");
      return false;
    }
  },

  // DELETE /api/messages/library/clear { kind }
  // Clears ALL pinned / starred / file messages for the current user.
  clearLibrary: async (kind) => {
    try {
      const res = await axiosInstance.delete("/messages/library/clear", {
        data: { kind },
      });
      set((state) => ({ library: { ...state.library, [kind]: [] } }));
      toast.success(res.data?.message || "Cleared");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to clear");
      return false;
    }
  },

  // ── Call history delete & clear ──────────────────────────────────────────────
  // DELETE /api/calls/:id — hard-delete a single call-history record.
  deleteCallHistory: async (callId) => {
    try {
      await axiosInstance.delete(`/calls/${callId}`);
      set((state) => ({
        callHistory: (state.callHistory || []).filter(
          (c) => String(c._id) !== String(callId)
        ),
      }));
      toast.success("Call history deleted");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete call");
      return false;
    }
  },

  // DELETE /api/calls — hard-delete the ENTIRE call history.
  clearCallHistory: async () => {
    try {
      const res = await axiosInstance.delete("/calls");
      set({ callHistory: [] });
      toast.success(res.data?.message || "Call history cleared");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to clear call history");
      return false;
    }
  },

  // ── AI history delete & clear ────────────────────────────────────────────────
  // DELETE /api/ai/history/:id — delete a single AI history entry.
  deleteAiHistoryItem: async (historyId) => {
    try {
      await axiosInstance.delete(`/ai/history/${historyId}`);
      set((state) => ({
        aiHistory: (state.aiHistory || []).filter(
          (h) => String(h._id) !== String(historyId)
        ),
      }));
      toast.success("AI history entry deleted");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete AI history");
      return false;
    }
  },

  // DELETE /api/ai/history — clear the ENTIRE AI history.
  clearAiHistory: async () => {
    try {
      const res = await axiosInstance.delete("/ai/history");
      set({ aiHistory: [] });
      toast.success(res.data?.message || "AI history cleared");
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to clear AI history");
      return false;
    }
  },

  downloadMessageFile: async (messageId, fileName) => {
    // Prevent duplicate downloads from rapid clicks
    const lockKey = `download-${messageId}`;
    if (downloadLocks.has(lockKey)) {
      toast.error("Download already in progress.");
      return;
    }
    downloadLocks.add(lockKey);
    try {
      const res = await axiosInstance.get(`/messages/files/${messageId}/download`);
      const data = res.data;
      if (!data || !data.success || !data.downloadUrl) {
        toast.error(data?.message || "Download failed.");
        return;
      }
      const { downloadUrl, fileName: remoteFileName, fileType } = data;
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = fileName || remoteFileName || "download";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      // Use setTimeout to allow the browser to start the download before removing
      setTimeout(() => a.remove(), 100);
      toast.success(fileType ? `Downloading ${fileName || remoteFileName || "file"}` : "Download started");
    } catch {
      toast.error("Download failed. Please try again.");
    } finally {
      downloadLocks.delete(lockKey);
    }
  },


  // Marks messages FROM :userId TO me as seen, clears the unread badge, and
  // notifies :userId in realtime (read receipt).
  markConversationRead: async (userId) => {
    if (!userId) return null;
    try {
      await axiosInstance.put(`/messages/chat/${userId}/read`);
      set((state) => ({
        chats: state.chats.map((c) =>
          String(c._id) === String(userId) ? { ...c, unreadCount: 0 } : c
        ),
      }));
      const socket = useAuthStore.getState().socket;
      if (socket?.connected) socket.emit("messageSeen", { receiverId: userId });
    } catch {
      // Non-critical; never block opening the chat because the read receipt failed.
      return null;
    }
  },

  // Pin / unpin a conversation (persisted in MongoDB â†’ pinnedChats).
  togglePinnedChat: async (userId, pinned) => {
    try {
      const res = await axiosInstance.put(`/messages/chat/${userId}/pin`, { pinned });
      set((state) => ({
        chats: [...state.chats]
          .map((c) =>
            String(c._id) === String(userId) ? { ...c, isPinned: res.data.isPinned } : c
          )
          .sort((a, b) => {
            if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
            const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
            const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
            return bTime - aTime;
          }),
      }));
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update pinned chats");
      return null;
    }
  },

  // Typing indicator — only emitted from real keystrokes in the message input.
  // `target` is either a plain user id (direct) or `{ groupId }` (group).
  emitTyping: (target) => {
    const socket = useAuthStore.getState().socket;
    if (!socket?.connected || !target) return;
    if (typeof target === "string") {
      socket.emit("typing", { receiverId: target });
    } else if (target.groupId) {
      socket.emit("groupTyping", { groupId: target.groupId });
    }
  },

  emitStopTyping: (target) => {
    const socket = useAuthStore.getState().socket;
    if (!socket?.connected || !target) return;
    if (typeof target === "string") {
      socket.emit("stopTyping", { receiverId: target });
    } else if (target.groupId) {
      socket.emit("groupStopTyping", { groupId: target.groupId });
    }
  },

  // Move the partner conversation to the top with the newest real preview.
  bumpChatPreview: (message) => {
    if (!message) return;
    const { authUser } = useAuthStore.getState();
    const isMine = authUser && String(message.senderId) === String(authUser._id);
    const partnerId = isMine ? message.receiverId : message.senderId;
    if (!partnerId) return;

    set((state) => ({
      chats: [...state.chats]
        .map((c) =>
          String(c._id) === String(partnerId)
            ? { ...c, lastMessage: message, lastMessageAt: message.createdAt || new Date().toISOString() }
            : c
        )
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bTime - aTime;
        }),
    }));
  },

      getMessagesByUserId: async (userId) => {
    // Do NOT clear `messages` here — clearing creates a race where a message
    // sent during this in-flight fetch is destroyed by the stale [] write
    // when the (pre-save) response arrives.  Clearing of previous-conversation
    // messages is handled by setSelectedUser instead.  We merge the server
    // result with any messages that were optimistically added during the fetch
    // so sent messages survive even if the backend query ran before the save.
    set({ isMessagesLoading: true, messagesError: null });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      const raw = Array.isArray(res.data) ? res.data : [];
      const fetched = [...new Map(raw.map((m) => [String(m._id), m])).values()];
      set((state) => {
        const merged = new Map(state.messages.map((m) => [String(m._id), m]));
        for (const m of fetched) {
          merged.set(String(m._id), m);
        }
        return { messages: Array.from(merged.values()), messagesError: null };
      });
    } catch (error) {
      const msg = error.response?.data?.message || error.message || "Failed to load messages";
      toast.error(msg);
      set({ messagesError: msg });
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  // Stable deduped view of the current messages array. Components should use
  // this instead of reading `messages` directly when they need to render or
  // send the conversation, because the raw store array can temporarily contain
  // duplicates from socket/HTTP races.
  getMessages: () => {
    const { messages } = get();
    return [...new Map(messages.map((m) => [String(m._id || m.id), m])).values()];
  },

  sendMessage: async (messageData) => {
    const { selectedUser, selectedGroup } = get();
    const { authUser } = useAuthStore.getState();

    // ── Group conversation ──
    if (selectedGroup) {
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage = {
        _id: tempId,
        senderId: authUser._id,
        receiverId: null,
        conversationType: "group",
        groupId: selectedGroup._id,
        text: messageData.text || "",
        image: messageData.image || null,
        audio: messageData.audio || null,
        audioDuration: messageData.audioDuration || null,
        fileUrl: messageData.fileUrl || null,
        fileName: messageData.fileName || null,
        fileType: messageData.fileType || null,
        fileSize: messageData.fileSize || null,
        replyTo: messageData.replyTo || null,
        forwarded: false,
        createdAt: new Date().toISOString(),
        isOptimistic: true,
      };

      set((state) => ({ messages: [...state.messages, optimisticMessage] }));

      try {
        const res = await axiosInstance.post(`/messages/group/${selectedGroup._id}/send`, messageData);
        set((state) => ({
          // Drop the optimistic copy AND any real copy the socket echo may have
          // already delivered, then append the canonical server message once.
          // Filtering both ids prevents a duplicate when the socket event races
          // ahead of the HTTP response.
           messages: state.messages
             .filter((message) => String(message._id) !== String(tempId) && String(message._id) !== String(res.data._id))
             .concat(res.data),
        }));
        // Reflect the sent message in the groups list preview immediately.
        get().bumpGroupPreview(res.data);
        return res.data;
      } catch (error) {
        set((state) => ({ messages: state.messages.filter((message) => String(message._id) !== String(tempId)) }));
        const msg = error.response?.data?.message || error.response?.data?.error || "Something went wrong";
        toast.error(msg);
        return null;
      }
    }

    // ── Direct conversation (existing behaviour, unchanged) ──
    if (!selectedUser) return;

    if (get().isBlocked || get().hasBlockedMe) {
      toast.error("You cannot send messages to this user.");
      return null;
    }

    const tempId = `temp-${Date.now()}`;

    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text || "",
      image: messageData.image || null,
      audio: messageData.audio || null,
      audioDuration: messageData.audioDuration || null,
      fileUrl: messageData.fileUrl || null,
      fileName: messageData.fileName || null,
      fileType: messageData.fileType || null,
      fileSize: messageData.fileSize || null,
      replyTo: messageData.replyTo || null,
      forwarded: false,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    set((state) => ({ messages: [...state.messages, optimisticMessage] }));

    try {
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData);
      set((state) => ({
        // Drop the optimistic copy AND any real copy the socket echo may have
        // already delivered, then append the canonical server message once.
        // Filtering both ids prevents a duplicate when the socket event races
        // ahead of the HTTP response.
        messages: state.messages
          .filter((message) => String(message._id) !== String(tempId) && String(message._id) !== String(res.data._id))
          .concat(res.data),
      }));
      // Reflect the sent message in the chat list preview immediately.
      get().bumpChatPreview(res.data);
      return res.data;
    } catch (error) {
      set((state) => ({ messages: state.messages.filter((message) => String(message._id) !== String(tempId)) }));
      const msg = error.response?.data?.message || error.response?.data?.error || "Something went wrong";
      toast.error(msg);
      return null;
    }
  },

  forwardMessage: async ({ messageId, receiverIds }) => {
    try {
      const res = await axiosInstance.post("/messages/forward", { messageId, receiverIds });
      return res.data?.messages || [];
    } catch (error) {
      const msg = error.response?.data?.message || error.response?.data?.error || error.message || "Failed to forward message";
      toast.error(msg);
      throw error;
    }
  },

  deleteMessage: async ({ id, scope = "me" }) => {
    try {
      const res = await axiosInstance.delete(`/messages/${id}`, { data: { scope } });
      if (scope === "me") {
        set((state) => ({
          messages: state.messages.filter((m) => String(m._id) !== String(id)),
        }));
      } else if (scope === "everyone") {
        set((state) => ({
          messages: state.messages.map((m) =>
            String(m._id) === String(id) ? { ...m, deletedForEveryone: true } : m
          ),
        }));
      }
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete message");
      return null;
    }
  },

  editMessage: async ({ id, text }) => {
    try {
      const res = await axiosInstance.put(`/messages/${id}/edit`, { text });
      set((state) => ({
        messages: state.messages.map((m) => (String(m._id) === String(id) ? res.data : m)),
      }));
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to edit message");
      return null;
    }
  },

  // â”€â”€ Reactions â”€â”€
  reactToMessage: async ({ id, emoji }) => {
    try {
      const res = await axiosInstance.post(`/messages/${id}/react`, { emoji });
      set((state) => ({
        messages: state.messages.map((m) => (String(m._id) === String(id) ? res.data : m)),
      }));
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to react to message");
      return null;
    }
  },

  // â”€â”€ Pin / Unpin â”€â”€
  pinMessage: async ({ id, pinned }) => {
    try {
      const res = await axiosInstance.put(`/messages/${id}/pin`, { pinned });
      set((state) => ({
        messages: state.messages.map((m) => (String(m._id) === String(id) ? res.data : m)),
      }));
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to pin message");
      return null;
    }
  },

  // â”€â”€ Star / Unstar â”€â”€
  starMessage: async ({ id, starred }) => {
    try {
      const res = await axiosInstance.put(`/messages/${id}/star`, { starred });
      set((state) => ({
        messages: state.messages.map((m) => (String(m._id) === String(id) ? res.data : m)),
      }));
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to star message");
      return null;
    }
  },

// â”€â”€ Clear chat â”€â”€
  clearChat: async (userId) => {
    const { selectedUser } = get();
    const otherId = userId || selectedUser?._id;
    if (!otherId) return null;
    try {
      const res = await axiosInstance.delete(`/messages/chat/${otherId}/clear`);
      // Clear the open chat pane AND refresh the chats list so the preview
      // updates to the cleared (empty) state without the conversation leaving the list.
      set({ messages: [] });
      get().getMyChatPartners();
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to clear chat");
      return null;
    }
  },

  // â”€â”€ Delete conversation (removes the chat from the chats list) â”€â”€
  deleteConversation: async (userId) => {
    const { selectedUser } = get();
    const otherId = userId || selectedUser?._id;
    if (!otherId) return null;
    try {
      const res = await axiosInstance.delete(`/messages/conversation/${otherId}`);
      set((state) => ({
        messages: [],
        selectedUser:
          state.selectedUser && String(state.selectedUser._id) === String(otherId) ? null : state.selectedUser,
        chats: state.chats.filter((c) => String(c._id) !== String(otherId)),
      }));
      toast.success("Conversation deleted");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete conversation");
      return null;
    }
  },

// â”€â”€ Block / Unblock (canonical /users endpoints, broadcast socket events) â”€â”€
  blockUser: async (userId) => {
    try {
      const res = await axiosInstance.put(`/users/block/${userId}`);
      set({ isBlocked: true });
      toast.success("User blocked");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to block user");
      return null;
    }
  },

  unblockUser: async (userId) => {
    try {
      const res = await axiosInstance.put(`/users/unblock/${userId}`);
      set({ isBlocked: false });
      toast.success("User unblocked");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to unblock user");
      return null;
    }
  },

  // â”€â”€ Mute / Unmute (canonical /users endpoints, broadcast socket events) â”€â”€
  muteUser: async (userId) => {
    try {
      const res = await axiosInstance.put(`/users/mute/${userId}`);
      set({ isMuted: true });
      toast.success("Notifications muted");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to mute user");
      return null;
    }
  },

  unmuteUser: async (userId) => {
    try {
      const res = await axiosInstance.put(`/users/unmute/${userId}`);
      set({ isMuted: false });
      toast.success("Notifications unmuted");
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to unmute user");
      return null;
    }
  },

  reportUser: async (userId, reason = "Reported by user") => {
    try {
      const trimmed = String(reason).trim().slice(0, 200);
      if (!trimmed) {
        return null;
      }
      const res = await axiosInstance.post(`/users/report/${userId}`, { reason: trimmed });
      return res.data;
    } catch {
      return null;
    }
  },

  // GLOBAL realtime subscription (registered once after login). Works for every
  // conversation, even when none is open â€” keeping unread badges, typing
  // indicators, read receipts and the chat list real at all times.
  subscribeToMessages: () => {
    const { isSoundEnabled } = get();
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newMessage");
    socket.off("messageDeleted");
    socket.off("messageEdited");
    socket.off("messageReacted");
    socket.off("messagePinned");
    socket.off("messageStarred");
    socket.off("chatCleared");
    socket.off("userBlocked");
    socket.off("userUnblocked");
    socket.off("userMuted");
    socket.off("typing");
    socket.off("stopTyping");
    socket.off("groupTyping");
    socket.off("groupStopTyping");
    socket.off("groupMessage");
    socket.off("groupUpdated");
    socket.off("groupRemoved");
    socket.off("groupMemberRemoved");
    socket.off("messageSeen");
    socket.off("messageDelivered");

    const isInOpenChat = (msg) => {
      const { selectedUser: sel, selectedGroup: sg } = get();
      const cur = useAuthStore.getState().authUser;
      // Group message matches the currently open group chat.
      if (msg && msg.groupId && sg && String(msg.groupId) === String(sg._id)) return true;
      // Direct message matches the currently open direct chat.
      return (
        msg &&
        sel &&
        ((String(msg.senderId) === String(sel._id) && String(msg.receiverId) === String(cur?._id)) ||
          (String(msg.senderId) === String(cur?._id) && String(msg.receiverId) === String(sel._id)))
      );
    };

    socket.on("newMessage", (newMessage) => {
      if (!newMessage) return;

      // A delivered message always stops the peer's typing indicator.
      set((state) => {
        if (!state.typingUsers[String(newMessage.senderId)]) return state;
        const typingUsers = { ...state.typingUsers };
        delete typingUsers[String(newMessage.senderId)];
        return { typingUsers };
      });

      // Incoming messages increment the real unread count for non-open chats.
      const cur = useAuthStore.getState().authUser;
      const isFromMe = cur && String(newMessage.senderId) === String(cur._id);
      const selected = get().selectedUser;

      if (!isFromMe && (!selected || String(newMessage.senderId) !== String(selected._id))) {
        const partnerId = newMessage.senderId;
        set((state) => ({
          chats: state.chats.map((c) =>
            String(c._id) === String(partnerId)
              ? { ...c, lastMessage: newMessage, lastMessageAt: newMessage.createdAt || new Date().toISOString(), unreadCount: (c.unreadCount || 0) + 1 }
              : c
          ),
        }));
      } else {
        get().bumpChatPreview(newMessage);
      }

      if (isInOpenChat(newMessage)) {
        set((state) => {
          const alreadyExists = state.messages.some((message) => String(message._id) === String(newMessage._id));
          if (alreadyExists) return state;
          return { messages: [...state.messages, newMessage] };
        });
        const openSel = get().selectedUser;
        if (openSel?._id) get().markConversationRead(String(openSel._id));
      }

      if (isSoundEnabled && !isFromMe) {
        const sender = get().chats.find((c) => String(c._id) === String(newMessage.senderId));
        if (!sender?.isMuted) playNotificationSound();
      }

      if (!isFromMe && !isInOpenChat(newMessage)) {
        const sender = get().chats.find((c) => String(c._id) === String(newMessage.senderId));
        if (!sender?.isMuted && get().notificationsEnabled) {
          const mid = String(newMessage._id);
          if (!notifiedMessageIds.has(mid)) {
            notifiedMessageIds.add(mid);
            if (notifiedMessageIds.size > MAX_NOTIFIED_IDS) {
              const arr = Array.from(notifiedMessageIds).slice(-MAX_NOTIFIED_IDS / 2);
              notifiedMessageIds.clear();
              arr.forEach((id) => notifiedMessageIds.add(id));
            }
            const chatSender = get().chats.find((c) => String(c._id) === String(newMessage.senderId));
            showBrowserNotification(chatSender?.fullName || "New message", {
              body: newMessage.text?.slice(0, 120) || (newMessage.image ? "📷 Photo" : "New message"),
              onClick: () => {
                if (chatSender) {
                  get().setSelectedUser(chatSender);
                  get().setActiveTab("chats");
                }
              },
            });
          }
        }
      }
    });

    // Real-time group messages — delivered to every online member via the room.
    socket.on("groupMessage", (newMessage) => {
      if (!newMessage) return;

      // A delivered message stops the group sender's typing indicator.
      set((state) => {
        if (!state.typingUsers[String(newMessage.senderId)]) return state;
        const typingUsers = { ...state.typingUsers };
        delete typingUsers[String(newMessage.senderId)];
        return { typingUsers };
      });

      const cur = useAuthStore.getState().authUser;
      const isFromMe = cur && String(newMessage.senderId) === String(cur._id);
      const gid = String(newMessage.groupId);
      const sg = get().selectedGroup;
      const groupOpen = sg && String(sg._id) === gid;

      if (isInOpenChat(newMessage)) {
        // Append to the open chat, then mark the group read (clears the badge).
        set((state) => {
          const already = state.messages.some((m) => String(m._id) === String(newMessage._id));
          if (already) return state;
          return { messages: [...state.messages, newMessage] };
        });
        if (sg?._id) get().markGroupRead(String(sg._id));
      } else if (!groupOpen) {
        // Not viewing this group → bump it to the top with a real unread count.
        set((state) => ({
          groups: state.groups
            .map((g) => {
              if (String(g._id) !== gid) return g;
              return {
                ...g,
                lastMessage: newMessage,
                lastMessageAt: newMessage.createdAt || new Date().toISOString(),
                unreadCount: isFromMe ? 0 : (g.unreadCount || 0) + 1,
              };
            })
            .sort((a, b) => {
              const at = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
              const bt = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
              return bt - at;
            }),
        }));
      } else {
        get().bumpGroupPreview(newMessage);
      }

      if (isSoundEnabled && !isFromMe && !get().isMuted) {
        playNotificationSound();
      }

      if (!isFromMe && !isInOpenChat(newMessage) && !get().isMuted && get().notificationsEnabled) {
        const mid = String(newMessage._id);
        if (!notifiedMessageIds.has(mid)) {
          notifiedMessageIds.add(mid);
          if (notifiedMessageIds.size > MAX_NOTIFIED_IDS) {
            const arr = Array.from(notifiedMessageIds).slice(-MAX_NOTIFIED_IDS / 2);
            notifiedMessageIds.clear();
            arr.forEach((id) => notifiedMessageIds.add(id));
          }
          const group = get().groups.find((g) => String(g._id) === String(newMessage.groupId));
          showBrowserNotification(group?.name || "New group message", {
            body: newMessage.text?.slice(0, 120) || (newMessage.image ? "📷 Photo" : "New message"),
            onClick: () => {
              if (group) {
                get().setSelectedGroup(group);
                get().setActiveTab("chats");
              }
            },
          });
        }
      }
    });

    // Group membership / metadata changed → refresh that group.
    socket.on("groupUpdated", ({ groupId }) => {
      if (groupId) get().getGroupById(groupId);
      get().getGroups();
    });

    // A group was deleted (or I was removed and it became empty) → drop it.
    socket.on("groupRemoved", ({ groupId }) => {
      set((state) => ({
        groups: state.groups.filter((g) => String(g._id) !== String(groupId)),
        selectedGroup:
          state.selectedGroup && String(state.selectedGroup._id) === String(groupId) ? null : state.selectedGroup,
        messages: state.selectedGroup && String(state.selectedGroup._id) === String(groupId) ? [] : state.messages,
      }));
      get().getGroups();
    });

    // An admin removed me → drop the group from my list + close the chat.
    socket.on("groupMemberRemoved", ({ groupId }) => {
      set((state) => ({
        groups: state.groups.filter((g) => String(g._id) !== String(groupId)),
        selectedGroup:
          state.selectedGroup && String(state.selectedGroup._id) === String(groupId) ? null : state.selectedGroup,
        messages: state.selectedGroup && String(state.selectedGroup._id) === String(groupId) ? [] : state.messages,
      }));
    });

    // Group typing indicators — only for the group being viewed.
    socket.on("groupTyping", ({ fromUserId, groupId }) => {
      const sg = get().selectedGroup;
      if (!fromUserId || !sg || String(groupId) !== String(sg._id)) return;
      set((state) => ({ typingUsers: { ...state.typingUsers, [String(fromUserId)]: true } }));
    });
    socket.on("groupStopTyping", ({ fromUserId, groupId }) => {
      const sg = get().selectedGroup;
      if (!fromUserId || !sg || String(groupId) !== String(sg._id)) return;
      set((state) => {
        const typingUsers = { ...state.typingUsers };
        delete typingUsers[String(fromUserId)];
        return { typingUsers };
      });
    });

    // Real typing indicator â€” relayed ONLY from the peer's actual Socket.io event.
    socket.on("typing", ({ fromUserId }) => {
      if (!fromUserId) return;
      set((state) => ({ typingUsers: { ...state.typingUsers, [String(fromUserId)]: true } }));
    });

    socket.on("stopTyping", ({ fromUserId }) => {
      if (!fromUserId) return;
      set((state) => {
        const typingUsers = { ...state.typingUsers };
        delete typingUsers[String(fromUserId)];
        return { typingUsers };
      });
    });

    // Peer read my messages â†’ mark my outgoing messages as seen in the UI.
    socket.on("messageSeen", ({ fromUserId }) => {
      const { selectedUser: sel } = get();
      const cur = useAuthStore.getState().authUser;
      if (!sel || !cur || String(fromUserId) !== String(sel._id)) return;
      const seenAt = new Date().toISOString();
      set((state) => ({
        messages: state.messages.map((m) => {
          if (String(m.senderId) === String(cur._id) && String(m.receiverId) === String(sel._id)) {
            const seenBy = Array.isArray(m.seenBy) ? m.seenBy.map((id) => String(id)) : [];
            if (!seenBy.includes(String(sel._id))) {
              return { ...m, seenBy: [...(m.seenBy || []), sel._id], seenAt };
            }
          }
          return m;
                }),
      }));
    });

    // Backend emits this only when the recipient's active client actually received
    // one of MY outgoing messages (online delivery). Flip my message from âœ“ (sent)
    // to âœ“âœ“ (delivered) â€” never from HTTP/Mongo-save success alone.
    socket.on("messageDelivered", ({ messageId }) => {
      if (!messageId) return;
      const { authUser } = useAuthStore.getState();
      if (!authUser) return;
      set((state) => ({
        messages: state.messages.map((m) =>
          String(m.senderId) === String(authUser._id) && String(m._id) === String(messageId)
            ? { ...m, delivered: true }
            : m
        ),
      }));
    });

    socket.on("messageDeleted", ({ id, scope, deletedForEveryone }) => {
      if (scope === "everyone" && deletedForEveryone) {
        set((state) => ({
          messages: state.messages.map((m) =>
            String(m._id) === String(id) ? { ...m, deletedForEveryone: true } : m
          ),
        }));
      } else if (scope === "me") {
        set((state) => ({ messages: state.messages.filter((m) => String(m._id) !== String(id)) }));
      }
    });

    socket.on("messageEdited", (editedMessage) => {
      if (isInOpenChat(editedMessage)) {
        set((state) => ({
          messages: state.messages.map((m) => (String(m._id) === String(editedMessage._id) ? editedMessage : m)),
        }));
      }
    });

    socket.on("messageReacted", (updatedMessage) => {
      if (isInOpenChat(updatedMessage)) {
        set((state) => ({
          messages: state.messages.map((m) => (String(m._id) === String(updatedMessage._id) ? updatedMessage : m)),
        }));
      }
    });

    socket.on("messagePinned", (updatedMessage) => {
      if (isInOpenChat(updatedMessage)) {
        set((state) => ({
          messages: state.messages.map((m) => (String(m._id) === String(updatedMessage._id) ? updatedMessage : m)),
        }));
      }
    });

    socket.on("messageStarred", (updatedMessage) => {
      if (isInOpenChat(updatedMessage)) {
        set((state) => ({
          messages: state.messages.map((m) => (String(m._id) === String(updatedMessage._id) ? updatedMessage : m)),
        }));
      }
    });

    // Clear-chat from the peer is per-user: the peer's own view is cleared on
    // their side; on my side nothing is deleted, so we only refresh the chats
    // list so my preview stays accurate (my messages to them are untouched).
    socket.on("chatCleared", () => {
      get().getMyChatPartners();
    });

// Realtime block state sync.
    // Canonical user.controller emits `{ userId, blocked }` where `userId` is the
    // OTHER user id and `blocked` is a boolean ("me" blocked them, or they blocked me).
    socket.on("userBlocked", ({ userId, blocked }) => {
      const { selectedUser: sel } = get();
      // Only apply when this event concerns the currently open conversation.
      if (!sel || String(userId) !== String(sel._id)) return;
      set({ isBlocked: blocked === true });
    });

    socket.on("userUnblocked", ({ userId, blocked }) => {
      const { selectedUser: sel } = get();
      if (!sel || String(userId) !== String(sel._id)) return;
      set({ isBlocked: blocked === false });
    });

    // Realtime mute state sync (user.controller broadcasts `{ userId, muted }`).
    socket.on("userMuted", ({ userId, muted }) => {
      const { selectedUser: sel } = get();
      if (!sel || String(userId) !== String(sel._id)) return;
      set({ isMuted: muted === true });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newMessage");
      socket.off("messageDeleted");
      socket.off("messageEdited");
      socket.off("messageReacted");
      socket.off("messagePinned");
      socket.off("messageStarred");
      socket.off("chatCleared");
      socket.off("userBlocked");
      socket.off("userUnblocked");
      socket.off("userMuted");
      socket.off("typing");
      socket.off("stopTyping");
      socket.off("groupTyping");
      socket.off("groupStopTyping");
      socket.off("groupMessage");
      socket.off("groupUpdated");
      socket.off("groupRemoved");
      socket.off("groupMemberRemoved");
      socket.off("messageSeen");
      socket.off("messageDelivered");
    }
  },
}));

