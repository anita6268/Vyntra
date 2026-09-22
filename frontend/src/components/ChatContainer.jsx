import { AnimatePresence, motion } from "framer-motion";
import { CheckIcon, SearchIcon, XIcon, PlayIcon, PauseIcon, DownloadIcon, FileIcon, StarIcon, PinIcon, SmilePlusIcon, ReplyIcon, ForwardIcon, CopyIcon, PencilIcon, Trash2Icon, AlertCircleIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";
import ChatHeader from "./ChatHeader";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";
import MessageInput from "./MessageInput";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import AnimatedChatBackground from "./AnimatedChatBackground";
import PremiumWidgets from "./PremiumWidgets";
import { startCall } from "../lib/callSocket";
import ProfilePanel from "./ProfilePanel";
import ForwardModal from "./ForwardModal";
import MessageContextMenu from "./MessageContextMenu";

import DeleteMessageModal from "./DeleteMessageModal";
import ClearChatModal from "./ClearChatModal";
import ConfirmModal from "./ConfirmModal";
import WallpaperPicker from "./WallpaperPicker";
import WallpaperSettings from "./WallpaperSettings";
import WallpaperRenderer from "./WallpaperRenderer";
import DeletedMessageBubble from "./DeletedMessageBubble";

// Premium reaction set — hold to express emotions
const REACTIONS = [
  { icon: "❤️", label: "Love" },
  { icon: "😂", label: "Haha" },
  { icon: "😍", label: "Adore" },
  { icon: "😮", label: "Wow" },
  { icon: "😢", label: "Sad" },
  { icon: "👍", label: "Like" },
  { icon: "👎", label: "Dislike" },
  { icon: "➕", label: "More" },
];

// Message status: "sent" (single tick) → "delivered" (double grey tick) → "seen" (double blue tick).
function statusOf(msg) {
  if (!msg) return "sent";
  if (msg.isOptimistic) return "sent";
  if (msg.seenAt || (Array.isArray(msg.seenBy) && msg.seenBy.length > 0)) return "seen";
  if (msg.delivered === true) return "delivered";
  return "sent";
}

// Highlight search matches in message text.
function HighlightedText({ text, query }) {
  if (!query || !query.trim()) return <p className="whitespace-pre-wrap text-sm leading-6">{text}</p>;
  const q = query.trim();
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <p className="whitespace-pre-wrap text-sm leading-6">{text}</p>;
  return (
    <p className="whitespace-pre-wrap text-sm leading-6">
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-400/40 px-0.5 text-inherit">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </p>
  );
}

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ChatContainer({ isAIOpen, onToggleAI, insertTextRef, detailsTrigger, detailsPanel, onViewGroupInfo }) {
  const {
        selectedUser,
    selectedGroup,
    getMessagesByUserId,
    getMessagesByGroupId,
    messages,
    isMessagesLoading,
    messagesError,
    setSelectedUser,
    setSelectedGroup,
    deleteMessage,
    editMessage,
    reactToMessage,
    pinMessage,
    starMessage,
    clearChat,
    deleteConversation,
    getRelationship,
    isBlocked,
    hasBlockedMe,
    } = useChatStore();
  const { authUser } = useAuthStore();
  const isGroup = !!selectedGroup;

  // Single source of truth for the conversation wallpaper storage key.
  // Direct chats use a user key; groups use a group key. Switching
  // User A -> User B -> Group A -> User A must restore each one's wallpaper.
  const getWallpaperChatKey = useCallback(
    () =>
      selectedGroup
        ? `vyntra-wallpaper-group-${selectedGroup._id}`
        : selectedUser
          ? `vyntra-wallpaper-user-${selectedUser._id}`
          : null,
    [selectedGroup, selectedUser]
  );

  // Resolve a group member's profile from the open group (for sender avatars/names).
  const groupMember = (id) => {
    if (!isGroup || !selectedGroup?.members) return null;
    return selectedGroup.members.find((m) => String(m._id) === String(id));
  };
  const groupMemberName = (id) => groupMember(id)?.fullName || "Unknown member";
  const groupMemberAvatar = (id) => groupMember(id)?.profilePic || "/avatar.png";
  const messageEndRef = useRef(null);
  const scrollRef = useRef(null);
  const bubbleRefs = useRef({});
  const isNearBottomRef = useRef(true);
  const previousMessageCountRef = useRef(0);
  const isInitialChatLoadRef = useRef(true);
  const isScrollingRef = useRef(false);
  const scrollStopTimerRef = useRef(null);
  const [activeReactionMsg, setActiveReactionMsg] = useState(null);
  const [pickerStyle, setPickerStyle] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [activeDetailsPanel, setActiveDetailsPanel] = useState("photos");
  const lastOpenDetailsRef = useRef(null);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [deleteMsg, setDeleteMsg] = useState(null);
  const [clearChatOpen, setClearChatOpen] = useState(false);
  const [highlightId, setHighlightId] = useState(null);
  const [playingAudioId, setPlayingAudioId] = useState(null);
  const audioRef = useRef(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [editText, setEditText] = useState("");
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [wallpaperSettingsOpen, setWallpaperSettingsOpen] = useState(false);
  const [wallpaperSettings, setWallpaperSettings] = useState(() => {
    try {
      const raw = localStorage.getItem("vyntra-wallpaper-settings");
      if (raw) return JSON.parse(raw);
    } catch { /* ignore parse errors */ }
    return {
      opacity: 0.7,
      blur: 0,
      overlay: 0.55,
      position: "center",
      size: "cover",
    };
  });

  // Per-chat identifier used to scope BOTH the wallpaper and its settings so
  // each conversation can look different. Groups use a group-specific prefix.
  const wallpaperChatKey = selectedGroup
    ? `group-${selectedGroup._id}`
    : selectedUser?._id
    ? String(selectedUser._id)
    : null;
  const wallpaperSettingsKey = `vyntra-wallpaper-settings-${wallpaperChatKey}`;

  const loadWallpaperSettings = useCallback((chatKey) => {
    const key = `vyntra-wallpaper-settings-${chatKey}`;
    try {
      const perChat = localStorage.getItem(key);
      if (perChat) {
        setWallpaperSettings(JSON.parse(perChat));
        return;
      }
    } catch { /* ignore */ }
    // Fall back to the global saved settings (shared default look), then
    // to hardcoded defaults — never break a chat that has nothing saved.
    try {
      const global = localStorage.getItem("vyntra-wallpaper-settings");
      if (global) {
        setWallpaperSettings(JSON.parse(global));
        return;
      }
    } catch { /* ignore */ }
    setWallpaperSettings({ opacity: 0.7, blur: 0, overlay: 0.55, position: "center", size: "cover" });
  }, []);

  // Relapse settings whenever the open conversation changes.
  useEffect(() => {
    if (wallpaperChatKey) loadWallpaperSettings(wallpaperChatKey);
  }, [wallpaperChatKey, loadWallpaperSettings]);


  // Message action UX — right-click/long-press context menu only.
  const [ctxMenu, setCtxMenu] = useState(null); // { id, isSelf, x, y }
  const longPressTimerRef = useRef(null);

  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

  const isWithinSixHours = (msg) => {
    if (!msg?.createdAt) return false;
    return Date.now() - new Date(msg.createdAt).getTime() <= SIX_HOURS_MS;
  };

  const canDeleteForEveryone = (msg) => {
    if (!msg) return false;
    const isSelf = String(msg.senderId) === String(authUser._id);
    return isSelf && isWithinSixHours(msg);
  };

  // Dynamic context menu actions: Edit + Delete only for own messages.
  // Delete for everyone is enforced server-side; the modal hides it after 6h.
  const getContextActions = (msg) => {
    if (msg.deletedForEveryone) return [];
    const isSelf = String(msg.senderId) === String(authUser._id);
    const actions = [
      { icon: SmilePlusIcon, label: "React" },
      { icon: ReplyIcon, label: "Reply" },
      { icon: ForwardIcon, label: "Forward" },
      { icon: CopyIcon, label: "Copy" },
      { icon: StarIcon, label: "Star" },
      { icon: PinIcon, label: "Pin" },
    ];
    if (isSelf) {
      actions.push({ icon: PencilIcon, label: "Edit" });
      actions.push({ icon: Trash2Icon, label: "Delete", danger: true });
    }
    return actions;
  };

  const [wallpaper, setWallpaper] = useState(() => {
    const key = selectedGroup
      ? `vyntra-wallpaper-group-${selectedGroup._id}`
      : selectedUser
        ? `vyntra-wallpaper-user-${selectedUser._id}`
        : null;
    if (!key) return null;
    try {
      return JSON.parse(localStorage.getItem(key)) || null;
    } catch {
      return null;
    }
  });

  useLayoutEffect(() => {
    // Wallpaper is stored per conversation: per-user for DMs, per-group for
    // groups. Reload on every target change so switching in either direction
    // never leaves a stale wallpaper from the previous chat.
    const key = getWallpaperChatKey();
    if (!key) {
      setWallpaper(null);
      return;
    }
    try {
      setWallpaper(JSON.parse(localStorage.getItem(key)) || null);
    } catch {
      setWallpaper(null);
    }
  }, [selectedUser, selectedGroup, getWallpaperChatKey]);

    useEffect(() => {
    if (selectedGroup) {
      getMessagesByGroupId(selectedGroup._id);
      return;
    }
    if (!selectedUser) return;
    getMessagesByUserId(selectedUser._id);
    getRelationship(selectedUser._id);
  }, [selectedUser, selectedGroup, getMessagesByUserId, getMessagesByGroupId, getRelationship]);

  const handleMessageScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;

    isNearBottomRef.current = distanceFromBottom <= 80;

    isScrollingRef.current = true;

    if (scrollStopTimerRef.current) {
      clearTimeout(scrollStopTimerRef.current);
    }

    scrollStopTimerRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 120);

    setCtxMenu(null);
    setActiveReactionMsg(null);
    setPickerStyle(null);
  }, []);

  // Track whether we should auto-scroll to bottom on the next message update.
  // We auto-scroll ONLY when:
  //   a) opening/switching to a conversation, OR
  //   b) the user was already near the bottom (<= 80px) when a new message arrived.
  const shouldAutoScrollRef = useRef(true);

  // Opening/switching conversation -> always scroll to bottom.
  useEffect(() => {
    isInitialChatLoadRef.current = true;
    previousMessageCountRef.current = 0;
    isNearBottomRef.current = true;
    shouldAutoScrollRef.current = true;
  }, [selectedUser, selectedGroup]);

  // After messages update, either scroll to bottom (if near bottom) or
  // preserve the current visual scroll position (if reading old messages).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const count = messages.length;
    const previous = previousMessageCountRef.current;

    if (count === 0) {
      previousMessageCountRef.current = 0;
      return;
    }

    // Initial conversation load
    if (isInitialChatLoadRef.current || previous === 0) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
        isNearBottomRef.current = true;
      });

      isInitialChatLoadRef.current = false;
      previousMessageCountRef.current = count;
      return;
    }

    // New message arrived.
    if (count > previous && isNearBottomRef.current) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }

    previousMessageCountRef.current = count;
  }, [messages.length]);

  // Close transient UI when the conversation changes. Also resets any in-progress
  // edit so it never leaks into another chat.
  useEffect(() => {
    setActiveReactionMsg(null);
    setPickerStyle(null);
    setCtxMenu(null);
    setEditingMsg(null);
    setEditText("");
  }, [selectedUser?._id, selectedGroup?._id]);

  // Listen for "open-ai-assistant" custom event from the sidebar AI tab
  useEffect(() => {
    const handler = () => onToggleAI?.(true);
    window.addEventListener("open-ai-assistant", handler);
    return () => window.removeEventListener("open-ai-assistant", handler);
  }, [onToggleAI]);

    // Listen for "close-chat" event from delete conversation menu
  useEffect(() => {
    const handler = () => {
      setSelectedUser(null);
      setSelectedGroup(null);
    };
    window.addEventListener("close-chat", handler);
    return () => window.removeEventListener("close-chat", handler);
  }, [setSelectedUser, setSelectedGroup]);

  // Close picker when clicking outside of it
  useEffect(() => {
    if (!activeReactionMsg) return;
    const handler = (e) => {
      if (e.target.closest && e.target.closest("[data-reaction-picker]")) return;
      setActiveReactionMsg(null);
      setPickerStyle(null);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchend", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchend", handler);
    };
  }, [activeReactionMsg]);

  // (Right-click context menu removed — hover toolbar handles all message actions.)
  
  // Stop audio when conversation changes or unmount.
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [selectedUser, selectedGroup]);

  const [searchFilter, setSearchFilter] = useState("all");

  const isStarredByMe = useCallback((m) => (Array.isArray(m?.starredBy) ? m.starredBy.some((id) => id.toString() === authUser?._id) : false), [authUser?._id]);
  const isPinnedByMe = useCallback((m) => (Array.isArray(m?.pinnedBy) ? m.pinnedBy.some((id) => id.toString() === authUser?._id) : false), [authUser?._id]);

  const dedupedMessages = useMemo(() => [...new Map(messages.map((m) => [String(m._id), m])).values()], [messages]);
  const filteredMessages = useMemo(() => {
    return dedupedMessages.filter((m) => {
      if (searchFilter !== "all") {
        if (searchFilter === "photos" && !m.image) return false;
        if (searchFilter === "links" && !(m.text && /https?:\/\//.test(m.text))) return false;
        if (searchFilter === "starred" && !isStarredByMe(m)) return false;
        if (searchFilter === "pinned" && !isPinnedByMe(m)) return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        return (
          (m.text && m.text.toLowerCase().includes(q)) ||
          (m.fileName && m.fileName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [dedupedMessages, searchFilter, searchTerm, isStarredByMe, isPinnedByMe]);

  const handleClearChat = () => {
    setClearChatOpen(true);
  };

  const handleClearChatConfirmed = async () => {
    if (!selectedUser) return;
    const res = await clearChat(selectedUser._id);
    if (res) {
      toast.success("Chat cleared");
    }
    setClearChatOpen(false);
  };

  const handleExportChat = () => {
    const chatName = isGroup ? selectedGroup.name : selectedUser?.fullName;
    const senderName = (m) =>
      m.senderId === authUser._id ? "You" : isGroup ? groupMemberName(m.senderId) : selectedUser?.fullName;
    const text = messages
      .map((m) => `[${new Date(m.createdAt).toLocaleString()}] ${senderName(m)}: ${m.text || "[Image]"}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-with-${chatName || "someone"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Chat exported");
  };
  const handleDeleteChat = async () => {
    if (!selectedUser?._id) return;
    setShowDeleteConfirm(true);
  };
  const handleConfirmDeleteChat = async () => {
    setShowDeleteConfirm(false);
    await deleteConversation(selectedUser._id);
  };

  const handleToggleDetails = () => setIsDetailsOpen((d) => !d);

  useEffect(() => {
    if (detailsTrigger > 0 && detailsPanel) {
      setIsDetailsOpen(true);
      setActiveDetailsPanel(detailsPanel);
    }
  }, [detailsTrigger, detailsPanel]);

  useEffect(() => {
    if (!isDetailsOpen) {
      lastOpenDetailsRef.current = null;
    }
  }, [isDetailsOpen]);

  const retryMessages = useCallback(async () => {
    if (selectedGroup) {
      await getMessagesByGroupId(selectedGroup._id);
    } else if (selectedUser) {
      await getMessagesByUserId(selectedUser._id);
    }
  }, [selectedGroup, selectedUser, getMessagesByGroupId, getMessagesByUserId]);

  const openReactionPicker = useCallback((msg) => {
    const el = bubbleRefs.current[msg._id];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const PICKER_HEIGHT = 48;
    const GAP = 10;
    let top = rect.top - PICKER_HEIGHT - GAP;
    if (top < 8) top = rect.bottom + GAP;
    let left = rect.left + rect.width / 2;
    const estimatedWidth = REACTIONS.length * 40 + 16;
    if (left - estimatedWidth / 2 < 8) left = estimatedWidth / 2 + 8;
    if (left + estimatedWidth / 2 > window.innerWidth - 8) left = window.innerWidth - estimatedWidth / 2 - 8;
    setPickerStyle({ top, left, transform: "translate(-50%, 0)" });
    setActiveReactionMsg(msg._id);
  }, []);

  // Add reaction via backend (persisted + socket).
  const addReaction = (msgId, emoji) => {
    reactToMessage({ id: msgId, emoji });
    setActiveReactionMsg(null);
    setPickerStyle(null);
  };

  const handleReact = (msg) => {
    openReactionPicker(msg);
  };

    const handleReply = (msg) => {
    const senderName =
      msg.senderId === authUser._id
        ? "You"
        : isGroup
        ? groupMemberName(msg.senderId)
        : selectedUser?.fullName;
    setReplyTo({
      _id: msg._id,
      text: msg.text || "",
      image: msg.image || "",
      senderId: msg.senderId,
      senderName,
    });
    toast.success("Reply selected");
  };

  const handleForward = (msg) => {
    setForwardMsg(msg);
  };

  const handleCopy = (msg) => {
    navigator.clipboard?.writeText(msg.text || msg.image || msg.fileUrl || "").then(() => {
      toast.success("Message copied");
    });
  };

  // Scroll to the original message and highlight it for 2 seconds.
  const focusOriginalMessage = (origId) => {
    const el = bubbleRefs.current[origId];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(origId);
      setTimeout(() => setHighlightId(null), 2000);
    }
  };

 const requestDeleteMessage = (msg) => {
  setDeleteMsg(msg);
};

const handleDeleteConfirmed = async (scope) => {
    if (!deleteMsg) return false;
    // Never send a temporary optimistic id to the backend DELETE endpoint.
    // A temp-* id means the message has not been persisted to MongoDB yet, so
    // there is no server-side id to delete — surface an error instead of
    // silently doing nothing (and never delete a different message).
    const targetId = deleteMsg._id;
    if (typeof targetId === "string" && targetId.startsWith("temp-")) {
      toast.error("This message hasn't been sent yet and can't be deleted.");
      return false;
    }
    const ok = await deleteMessage({ id: targetId, scope });
    return !!ok;
  };

  const onMessageAction = (msg, label) => {
    switch (label) {
      case "React":
        handleReact(msg);
        break;
      case "Reply":
        handleReply(msg);
        break;
      case "Forward":
        handleForward(msg);
        break;
      case "Copy":
        handleCopy(msg);
        break;
      case "Delete":
        requestDeleteMessage(msg);
        break;
      case "Star":
        handleToggleStar(msg._id);
        break;
      case "Pin":
        handleTogglePin(msg._id);
        break;
      case "Edit":
        handleStartEdit(msg);
        break;
      default:
        break;
    }
  };

  // --- Right-click / long-press context menu ---
  const openContextMenu = (msg, isSelf, x, y) => {
    setCtxMenu({ id: msg._id, isSelf, x, y });
  };

  const closeContextMenu = () => setCtxMenu(null);

  const handleBubbleContextMenu = (msg, isSelf) => (e) => {
    e.preventDefault();
    if (!msg.deletedForEveryone) {
      openContextMenu(msg, isSelf, e.clientX, e.clientY);
    }
  };

  const handleBubbleLongPressStart = (msg, isSelf) => (e) => {
    if (e.pointerType !== "touch") return;
    if (msg.deletedForEveryone) return;
    clearTimeout(longPressTimerRef.current);
    const start = { x: e.clientX, y: e.clientY };
    longPressTimerRef.current = setTimeout(() => openContextMenu(msg, isSelf, start.x, start.y), 480);
  };

  const cancelLongPress = () => clearTimeout(longPressTimerRef.current);

  // Cancel pending timers on unmount.
  useEffect(() => () => {
    clearTimeout(longPressTimerRef.current);
    if (scrollStopTimerRef.current) {
      clearTimeout(scrollStopTimerRef.current);
    }
  }, []);

  // Dismiss the context menu on Escape / outside-click / scroll.
  useEffect(() => {
    if (!ctxMenu) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeContextMenu();
    };
    // The [data-ctx-menu] guard keeps clicks inside the menu from closing it.
    const onDoc = (e) => {
      if (e.target && e.target.closest && e.target.closest("[data-ctx-menu]")) return;
      closeContextMenu();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    document.addEventListener("wheel", onDoc, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("wheel", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [ctxMenu]);
  
  // Star / Pin toggles (backend-persisted)
    const handleToggleStar = async (id) => {
    const msg = messages.find((m) => String(m._id) === String(id));
    const currentlyStarred = msg ? isStarredByMe(msg) : false;
    const res = await starMessage({ id, starred: !currentlyStarred });
    if (res) {
      const nowStarred = isStarredByMe(res);
      toast(nowStarred ? "Message starred ⭐" : "Message unstarred", { icon: nowStarred ? "⭐" : "🗑️" });
    }
  };
    const handleTogglePin = async (id) => {
    const msg = messages.find((m) => String(m._id) === String(id));
    const currentlyPinned = msg ? isPinnedByMe(msg) : false;
    const res = await pinMessage({ id, pinned: !currentlyPinned });
    if (res) {
      const nowPinned = isPinnedByMe(res);
      toast(nowPinned ? "Message pinned 📌" : "Message unpinned", { icon: nowPinned ? "📌" : "🗑️" });
    }
  };

  // Edit message
  const handleStartEdit = (msg) => {
    if (!msg.text) {
      toast.error("Only text messages can be edited");
      return;
    }
    setEditingMsg(msg);
    setEditText(msg.text);
  };
  const handleSaveEdit = async () => {
    if (!editingMsg) return;
    const newText = editText.trim();
    if (!newText) {
      toast.error("Message cannot be empty");
      return;
    }
    // Normalize ids with String() — the rest of the app compares ids this way.
    // A raw strict !== breaks Edit for one's own message whenever the senderId
    // and authUser._id representations differ (ObjectId vs string).
    if (String(editingMsg.senderId) !== String(authUser._id)) {
      toast.error("You can only edit your own messages");
      setEditingMsg(null);
      setEditText("");
      return;
    }
    // Unchanged edit: exit edit mode without hitting the API / creating a message.
    if (String(editingMsg.text ?? "") === newText) {
      setEditingMsg(null);
      setEditText("");
      return;
    }
    const updated = await editMessage({ id: editingMsg._id, text: newText });
    if (!updated) {
      // Failure: the store already toasted the error. Keep edit mode open so the
      // user can retry; the original message is never overwritten on failure.
      return;
    }
    toast.success("Message edited");
    setEditingMsg(null);
    setEditText("");
  };

  const toggleAudio = (msg) => {
    if (!msg.audio) return;
    if (playingAudioId === msg._id && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingAudioId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(msg.audio);
    audioRef.current = audio;
    audio.onended = () => setPlayingAudioId(null);
    audio.play().then(() => setPlayingAudioId(msg._id)).catch(() => toast.error("Failed to play voice message"));
  };

  // Normalize old mojibake-coded reactions to proper emoji.
  const normalizeReaction = (reaction) => {
    const value = String(reaction ?? "");
    const map = {
      "💔": "❤️",
      "👎": "👍",
      "😡": "😂",
      "😘": "😍",
      "😲": "😮",
      "😭": "😢",
    };
    return map[value] || value;
  };

  // Get my reaction emoji on a message (reactions are stored as [{userId, emoji}]).
  const myReactionEmoji = (m) => {
    if (!Array.isArray(m?.reactions)) return null;
    const mine = m.reactions.find(
      (r) => r && String(r.userId) === String(authUser?._id) && r.emoji
    );
    return normalizeReaction(mine?.emoji || null);
  };

  // Aggregate all reactions on a message into [{emoji, count}] for badges.
  const reactionSummary = (m) => {
    if (!Array.isArray(m?.reactions)) return [];
    const counts = {};
    m.reactions.forEach((r) => {
      if (r && r.emoji) {
        const emoji = normalizeReaction(r.emoji);
        counts[emoji] = (counts[emoji] || 0) + 1;
      }
    });
    return Object.entries(counts).map(([emoji, count]) => ({ emoji, count }));
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
      <ChatHeader
        isAIOpen={isAIOpen}
        onToggleAI={onToggleAI}
        isSearchOpen={isSearchOpen}
        onToggleSearch={() => {
          setIsSearchOpen((s) => !s);
          setSearchTerm("");
          isInitialChatLoadRef.current = true;
          previousMessageCountRef.current = 0;
          isNearBottomRef.current = true;
          shouldAutoScrollRef.current = true;
          requestAnimationFrame(() => {
            const el = scrollRef.current;
            if (el) el.scrollTop = el.scrollHeight;
          });
        }}
        onViewProfile={() => setShowProfile(true)}
        onViewGroupInfo={onViewGroupInfo}
        onClearChat={handleClearChat}
        onExportChat={handleExportChat}
        onDeleteChat={() => setShowDeleteConfirm(true)}
        isDetailsOpen={isDetailsOpen}
        onToggleDetails={handleToggleDetails}
        onToggleWallpaper={() => setWallpaperOpen((o) => !o)}
        onToggleWallpaperSettings={() => setWallpaperSettingsOpen((o) => !o)}
      />

      <div className="flex min-h-0 flex-1">
        <div className="relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {!wallpaper && <AnimatedChatBackground />}

          <AnimatePresence>
            {isSearchOpen && (
              <motion.div
                id="chat-search-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="relative z-10 shrink-0 overflow-hidden border-b border-white/10 bg-[color:var(--panel-strong)]/80 px-4 backdrop-blur-xl"
              >
                <div className="flex items-center gap-2 py-2.5">
                  <SearchIcon className="size-4 shrink-0 text-[color:var(--accent-3)]" />
                  <input
                    autoFocus
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                     placeholder={`Search messages with ${isGroup ? selectedGroup?.name : selectedUser?.fullName}…`}
                    className="w-full bg-transparent text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
                  />
                  <span className="shrink-0 text-[11px] text-[color:var(--text-muted)]">
                    {searchTerm.trim() ? `${filteredMessages.length} result${filteredMessages.length === 1 ? "" : "s"}` : ""}
                  </span>
                  <button
                    onClick={() => {
                      setIsSearchOpen(false);
                      setSearchTerm("");
                      setSearchFilter("all");
                    }}
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                  >
                    <XIcon className="size-4" />
                  </button>
                </div>
                <div className="scrollbar-thin flex items-center gap-1.5 overflow-x-auto pb-2.5">
                  {[
                    { key: "photos", label: "📷 Photos" },
                    { key: "links", label: "🔗 Links" },
                    { key: "starred", label: "⭐ Starred" },
                    { key: "pinned", label: "📌 Pinned" },
                  ].map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setSearchFilter(f.key)}
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
                        searchFilter === f.key
                          ? "border-[color:var(--accent-3)]/50 bg-[color:var(--accent-3)]/15 text-[color:var(--text-primary)]"
                          : "border-white/10 bg-white/5 text-[color:var(--text-muted)] hover:bg-white/10"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

           <PremiumWidgets messages={messages} isOpen={isDetailsOpen} onClose={() => setIsDetailsOpen(false)} isLoading={isMessagesLoading} error={messagesError} onRetry={retryMessages} defaultPanel={activeDetailsPanel} />

           <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
             <WallpaperRenderer wallpaper={wallpaper} settings={wallpaperSettings} />
             <div className="absolute inset-0 z-[1] pointer-events-none" style={{ background: `rgba(5, 10, 25, ${wallpaperSettings.overlay ?? 0.55})` }} />

             <div
               ref={scrollRef}
               onScroll={handleMessageScroll}
               className="scrollbar-thin relative z-[2] min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 pb-8 pt-6 sm:px-6"
               style={{ scrollbarGutter: "stable" }}
             >
              {filteredMessages.length > 0 && !isMessagesLoading ? (
                <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-5">
                  {filteredMessages.map((msg, idx) => {
                    const isSelf = String(msg.senderId) === String(authUser._id);
                    const myReaction = myReactionEmoji(msg);
                    const reactions = reactionSummary(msg);
                    const isStarred = isStarredByMe(msg);
                    const isPinned = isPinnedByMe(msg);
                    const showSender =
                      isGroup &&
                      !isSelf &&
                      (idx === 0 || String(filteredMessages[idx - 1].senderId) !== String(msg.senderId));
                    return (
                      <div
                        key={msg._id}
                        className={`message-row group relative flex w-full overflow-visible ${
                          isSelf ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className="message-content-wrapper relative inline-flex flex-col min-w-0 max-w-[85%] sm:max-w-[600px]"
                          onContextMenu={handleBubbleContextMenu(msg, isSelf)}
                          onPointerDown={handleBubbleLongPressStart(msg, isSelf)}
                          onPointerUp={cancelLongPress}
                          onPointerLeave={cancelLongPress}
                        >
                      {showSender && (
                        <div className="mb-1 flex items-center gap-1.5 pl-1">
                          <img src={groupMemberAvatar(msg.senderId)} alt="" className="size-5 rounded-full object-cover" />
                          <span className="text-[10px] font-medium text-[color:var(--accent-3)]">
                            {groupMemberName(msg.senderId)}
                          </span>
                        </div>
                      )}
                      <div
                        ref={(el) => { bubbleRefs.current[msg._id] = el; }}
                        className={`message-bubble relative max-w-full overflow-visible px-4 py-3 pb-2.5 transition-colors duration-500 ${reactions.length > 0 ? "pb-9" : "pb-2.5"} ${isSelf ? "message-bubble-self" : "message-bubble-other"} ${highlightId === msg._id ? "message-highlight" : ""}`}
                      >
                        

                        <div className={`absolute top-1.5 flex gap-1 ${isSelf ? "left-2" : "right-2"}`}>
                          {isStarred && (
                            <span className="msg-flag" title="Starred">
                              <StarIcon className="size-2.5" />
                            </span>
                          )}
                          {isPinned && (
                            <span className="msg-flag" title="Pinned">
                              <PinIcon className="size-2.5" />
                            </span>
                          )}
                        </div>
                         {msg.deletedForEveryone ? (
                           <DeletedMessageBubble message={msg} isSelf={isSelf} />
                         ) : (
                          <>
                           {msg.forwarded && (
                             <p className="mb-1 text-[11px] font-semibold italic text-[color:var(--accent-3)]">Forwarded</p>
                           )}
                           {msg.replyTo && (
                             <button
                               type="button"
                               onClick={() => focusOriginalMessage(msg.replyTo._id)}
                               className="mb-1 w-full max-w-[300px] cursor-pointer overflow-hidden rounded-xl border-l-4 border-l-[color:var(--accent-3)] border-white/10 bg-white/10 px-2 py-1.5 text-left"
                               title="View quoted message"
                             >
                               <div className="flex items-center gap-2">
                                 {msg.replyTo.image && (
                                   <img src={msg.replyTo.image} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                                 )}
                                 <div className="min-w-0">
                                   <p className="truncate text-[11px] font-semibold text-[color:var(--accent-3)]">
                                     {msg.replyTo.senderName || (msg.replyTo.senderId === authUser._id ? "You" : "Them")}
                                   </p>
                                    <p className={`truncate text-xs ${isSelf ? "text-gray-900" : "text-[color:var(--text-muted)]"}`}>
                                      {msg.replyTo.text ? msg.replyTo.text.slice(0, 70) : msg.replyTo.image ? "📷 Photo" : "Message"}
                                    </p>
                                 </div>
                               </div>
                             </button>
                           )}
                           {msg.image && (
                             <button
                               type="button"
                               onClick={() => setPreviewImage(msg.image)}
                               className="mb-2 block max-w-[380px] cursor-zoom-in overflow-hidden rounded-2xl"
                               title="Click to view full screen"
                             >
                               <img src={msg.image} alt="Shared" className="max-h-[280px] w-full max-w-[380px] rounded-2xl object-cover transition-transform duration-300 hover:scale-[1.03]" />
                             </button>
                           )}
                           {msg.audio && (
                             <div className="mb-2 flex max-w-[280px] items-center gap-3 rounded-2xl bg-white/10 px-3 py-2.5">
                               <button
                                 type="button"
                                 onClick={() => toggleAudio(msg)}
                                 className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] text-white shadow-[0_0_15px_var(--glow)]"
                                 title={playingAudioId === msg._id ? "Pause" : "Play"}
                               >
                                 {playingAudioId === msg._id ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
                               </button>
                               <div className="min-w-0 flex-1">
                                 <div className="flex items-center gap-[3px]">
                                   {[2, 4, 3, 5, 3, 4, 2, 5, 3].map((h, j) => (
                                     <span
                                       key={j}
                                       className="w-1 rounded-full bg-[color:var(--accent-3)]"
                                       style={{ height: `${playingAudioId === msg._id ? h * 3 : h}px` }}
                                     />
                                   ))}
                                 </div>
                                 <p className="mt-1 text-[11px] text-[color:var(--text-muted)]">
                                   {msg.audioDuration ? `${msg.audioDuration}s` : "Voice message"}
                                 </p>
                               </div>
                             </div>
                           )}
                            {msg.fileUrl && (
                              <div className="mb-2 flex max-w-[300px] items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-3 py-2.5">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[color:var(--accent)]/25 to-[color:var(--accent-3)]/25 text-[color:var(--accent-3)]">
                                  <FileIcon className="size-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-medium text-[color:var(--text-primary)]">{msg.fileName || "File"}</p>
                                  <p className="text-[10px] text-[color:var(--text-muted)]">
                                    {msg.fileType || ""}{msg.fileSize ? ` • ${formatFileSize(msg.fileSize)}` : ""}
                                  </p>
                                </div>
                                 <button
                                   onClick={() => useChatStore.getState().downloadMessageFile(msg._id, msg.fileName)}
                                   className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--text-primary)]"
                                   title="Download"
                                 >
                                   <DownloadIcon className="size-4" />
                                 </button>
                              </div>
                            )}
                           {msg.text && <HighlightedText text={msg.text} query={searchTerm} />}
                           {msg.edited && <span className="msg-edit-tag mt-1 block">edited</span>}
                          </>
                         )}
                        <div className={`msg-meta relative z-[10] mt-2 ${isSelf ? "text-white/85" : "text-[color:var(--text-muted)]"}`}>
                          <span className="msg-time">
                            {new Date(msg.createdAt).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isSelf && (
                            <span className="flex items-center gap-1">
                              {statusOf(msg) === "sent" ? (
                                <CheckIcon className="size-3" style={{ animation: "tick-pop 0.3s ease-out" }} title="Sent" />
                              ) : (
                                <motion.span
                                  initial={{ opacity: 0, scale: 0.5 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 20 }}
                                  className={`flex items-center ${statusOf(msg) === "seen" ? "text-sky-400" : ""}`}
                                  title={statusOf(msg) === "seen" ? "Seen" : "Delivered"}
                                >
                                  <CheckIcon className="size-3" style={{ animation: "tick-pop 0.3s ease-out" }} />
                                  <CheckIcon
                                    className={`size-3 -ml-1 ${statusOf(msg) === "seen" ? "text-sky-400" : "text-white/70"}`}
                                    style={{ animation: `tick-pop 0.3s ease-out 0.15s ${statusOf(msg) === "seen" ? "both" : "forwards"}` }}
                                  />
                                </motion.span>
                              )}
                              {statusOf(msg) === "seen" && (
                                <span className="msg-time">
                                  {new Date(msg.seenAt || msg.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </span>
                          )}
                        </div>

                        {/* Reaction badges — real backend reactions (persisted + realtime) */}
                        {reactions.length > 0 && (
                          <motion.div
                            initial={{ scale: 0.6, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 18 }}
                            className={`absolute bottom-2 flex flex-wrap gap-1 ${isSelf ? "right-3" : "left-3"}`}
                          >
                            {reactions.map(({ emoji, count }) => (
                              <span
                                key={emoji}
                                className={`reaction-badge inline-flex items-center gap-1 ${myReaction === emoji ? "ring-1 ring-[color:var(--accent-3)]" : ""}`}
                                title={`${count} reaction${count > 1 ? "s" : ""}`}
                              >
                                {emoji}
                                {count > 1 && <span className="text-[9px] leading-none">{count}</span>}
                              </span>
                            ))}
                          </motion.div>
                        )}
                         </div>
                       </div>
                     </div>
                   );
                 })}
                 <div ref={messageEndRef} />
               </div>
             ) : isMessagesLoading ? (
               <MessagesLoadingSkeleton />
             ) : messagesError ? (
               <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                 <AlertCircleIcon className="size-10 text-rose-400" />
                 <p className="text-sm font-medium text-[color:var(--text-primary)]">Failed to load messages</p>
                 <p className="max-w-[240px] text-xs text-[color:var(--text-muted)]">{messagesError}</p>
                 <button
                   type="button"
                   onClick={retryMessages}
                   className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--accent-3)]/40 bg-[color:var(--accent-3)]/15 px-3 py-1.5 text-xs font-medium text-[color:var(--accent-3)] transition hover:bg-[color:var(--accent-3)]/25"
                 >
                   <RefreshCwIcon className="size-3.5" />
                   Retry
                 </button>
               </div>
             ) : searchTerm.trim() ? (
               <div className="flex h-full flex-col items-center justify-center text-center">
                 <SearchIcon className="mb-3 size-10 text-[color:var(--text-muted)]/50" />
                 <p className="text-sm text-[color:var(--text-muted)]">No messages match “{searchTerm}”</p>
               </div>
               ) : (
                <NoChatHistoryPlaceholder name={selectedUser?.fullName || selectedGroup?.name || "Chat"} />
              )}
           </div>
           </div>

           <div className="shrink-0">
           <MessageInput
             onOpenAI={onToggleAI}
             insertTextRef={insertTextRef}
             replyTo={replyTo}
             onClearReply={() => setReplyTo(null)}
             blocked={isBlocked || hasBlockedMe}
             editingMsg={editingMsg}
             editText={editText}
             onEditTextChange={setEditText}
             onSaveEdit={handleSaveEdit}
             onCancelEdit={() => { setEditingMsg(null); setEditText(""); }}
           />
          </div>
        </div>
      </div>

      <ProfilePanel
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        messages={messages}
        onVoiceCall={() => { setShowProfile(false); if (selectedUser) startCall("voice", selectedUser); }}
        onVideoCall={() => { setShowProfile(false); if (selectedUser) startCall("video", selectedUser); }}
        onDeleteConversation={handleDeleteChat}
      />

      <ForwardModal
        isOpen={!!forwardMsg}
        onClose={() => setForwardMsg(null)}
        message={forwardMsg}
        excludeUserId={selectedUser?._id}
      />

      <DeleteMessageModal
        isOpen={!!deleteMsg}
        message={deleteMsg}
        onClose={() => setDeleteMsg(null)}
        onDeleteForMe={() => handleDeleteConfirmed("me")}
        onDeleteForEveryone={() => handleDeleteConfirmed("everyone")}
        canDeleteForEveryone={canDeleteForEveryone(deleteMsg)}
      />

      <ClearChatModal
        isOpen={clearChatOpen}
        onClose={() => setClearChatOpen(false)}
        onConfirm={handleClearChatConfirmed}
         contactName={isGroup ? selectedGroup?.name : selectedUser?.fullName}
      />

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDeleteChat}
        title="Delete conversation?"
        description="This will remove the conversation from your list. This action cannot be undone."
        confirmLabel="Delete"
        confirmVariant="danger"
      />

      <WallpaperPicker
        isOpen={wallpaperOpen}
        onClose={() => setWallpaperOpen(false)}
        chatKey={getWallpaperChatKey()}
        current={wallpaper}
        onApply={(choice) => {
          setWallpaper(choice);
          const key = getWallpaperChatKey();
           if (key) {
            try {
              if (choice == null) localStorage.removeItem(key);
              else localStorage.setItem(key, JSON.stringify(choice));
            } catch {
              /* localStorage full/disabled — apply in-memory only */
            }
          }
        }}
        onOpenSettings={() => {
          setWallpaperOpen(false);
          setWallpaperSettingsOpen(true);
        }}
      />

      <WallpaperSettings
        isOpen={wallpaperSettingsOpen}
        onClose={() => setWallpaperSettingsOpen(false)}
        current={wallpaper}
        chatKey={wallpaperSettingsKey}
        onApplySettings={setWallpaperSettings}
        onRemove={() => {
          const key = getWallpaperChatKey();
          if (key) {
            try { localStorage.removeItem(key); } catch { /* ignore */ }
          }
          setWallpaper(null);
        }}
      />




      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 z-[var(--z-modal,1600)] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          >
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition-colors hover:bg-white/20"
              title="Close"
            >
              <XIcon className="size-5" />
            </button>
            <motion.img
              src={previewImage}
              alt="Preview"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reaction emoji picker — rendered in a PORTAL so it is never clipped by the scroll container */}
      {activeReactionMsg &&
        createPortal(
          <motion.div
            data-reaction-picker
            initial={{ opacity: 0, scale: 0.7, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 6 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            style={pickerStyle}
            className="reaction-picker fixed z-[var(--z-popover,1700)]"
          >
            {REACTIONS.map(({ icon, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => addReaction(activeReactionMsg, icon)}
                className="reaction-picker-btn"
                title={label}
              >
                {icon}
              </button>
            ))}
          </motion.div>,
          document.body
        )}

       {/* Context menu — remains portal-based (fixed) as it is invoked from
          right-click/long-press at arbitrary cursor positions. It is dismissed
          on scroll, outside-click, and Escape (see handlers above). */}
       {ctxMenu && (() => {
         const m = messages.find((mm) => String(mm._id) === String(ctxMenu.id));
         if (!m) return null;
         const actions = getContextActions(m);
         return (
          <MessageContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            actions={actions}
            onAction={(label) => {
              onMessageAction(m, label);
              closeContextMenu();
            }}
            onClose={closeContextMenu}
           />
         );
       })()}
      </div>
    )
  }

export default ChatContainer;





