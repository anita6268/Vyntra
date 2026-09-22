import { Info, SearchIcon, PhoneIcon, VideoIcon, MoreVerticalIcon, XIcon, SparklesIcon, ArrowLeft, UserIcon, Trash2Icon, DownloadIcon, BellOffIcon, BellRingIcon, ShieldOffIcon, MessageSquareOffIcon, CheckIcon, PanelRightIcon, ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useChatStore } from "../store/useChatStore";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { startCall } from "../lib/callSocket";
import CallBadge from "./CallBadge";

function ChatHeader({
  isAIOpen,
  onToggleAI,
  isSearchOpen,
  onToggleSearch,
  onViewProfile,
  onViewGroupInfo,
  onClearChat,
  onExportChat,
  onDeleteChat,
  isDetailsOpen,
  onToggleDetails,
  onToggleWallpaper,
  onToggleWallpaperSettings,
}) {
  const { selectedUser, setSelectedUser, selectedGroup, setSelectedGroup, isMuted, isBlocked, muteUser, unmuteUser, blockUser, unblockUser } = useChatStore();
  const { typingUsers } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();
    const isGroup = !!selectedGroup;
  const target = isGroup ? selectedGroup : selectedUser;
  const chatName = isGroup ? target?.name : target?.fullName;
    const isOnline = !isGroup && onlineUsers.includes(String(target?._id)) && target?.showOnline !== false;
  const memberCount = isGroup ? (target?.members?.length ?? 0) : 0;

  // Real-time typing indicator (direct + group). Only surfaces when someone
  // OTHER than me is actually typing in the open conversation.
  let typingLabel = "";
  if (isGroup) {
    const typerId = Object.keys(typingUsers || {}).find(
      (id) =>
        id !== String(authUser?._id) &&
        target?.members?.some((m) => String(m._id) === id)
    );
    if (typerId) {
      const typer = target?.members?.find((m) => String(m._id) === typerId);
      typingLabel = `${typer?.fullName || "Someone"} is typing…`;
    }
  } else if (selectedUser?._id && typingUsers?.[String(selectedUser._id)]) {
    typingLabel = "typing…";
  }
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, placement: "below" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Position the portal dropdown directly under (or above) the 3-dot button.
  // Auto-flips above when there is insufficient space below, and clamps inside
  // the viewport so the menu is never clipped or causes horizontal overflow.
  const repositionMenu = () => {
    const btn = menuButtonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const MENU_WIDTH = 240;
    const GAP = 6;
    const margin = 8;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Horizontal: right-align to button, then clamp inside viewport.
    let left = rect.right - MENU_WIDTH;
    if (left < margin) left = margin;
    if (left + MENU_WIDTH > vw - margin) left = vw - margin - MENU_WIDTH;

    // Vertical: prefer below; flip above if not enough room.
    const spaceBelow = vh - rect.bottom - GAP;
    const estimatedHeight = 220; // generous estimate; menu is compact
    let placement = "below";
    let top = rect.bottom + GAP;
    if (spaceBelow < estimatedHeight && rect.top - GAP > spaceBelow) {
      placement = "above";
      top = rect.top - GAP;
    }
    setMenuPos({ top, left, placement });
  };

  useLayoutEffect(() => {
    if (!menuOpen) return;
    repositionMenu();
    const onResize = () => repositionMenu();
    const onScroll = () => repositionMenu();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      window.addEventListener("keydown", handleEscKey);
    }
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [menuOpen]);

  // Close menu on outside click (ignore clicks inside the portal menu and on the trigger)
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      const inMenu = menuRef.current && menuRef.current.contains(e.target);
      const inBtn = menuButtonRef.current && menuButtonRef.current.contains(e.target);
      if (!inMenu && !inBtn) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [menuOpen]);

// Voice/video calling — start a real WebRTC call via the shared engine.
  // When the user is OFFLINE the buttons are genuinely disabled (no fake call).
  const callsAvailable = isOnline && !isGroup;
  const handleVoiceCall = () => {
    if (!callsAvailable) return;
    startCall("voice", selectedUser);
  };
  const handleVideoCall = () => {
    if (!callsAvailable) return;
    startCall("video", selectedUser);
  };

    const targetId = isGroup ? selectedGroup._id : selectedUser._id;
  const hasAvatar = isGroup ? target?.avatar : target?.profilePic;
  // Never rely on a static placeholder image: fall back to initials rendered
  // inside the avatar ring when the user/group has no profile picture.
  const chatAvatar = hasAvatar || null;
  const chatInitial = (target?.name || target?.fullName || "G").trim().charAt(0).toUpperCase();
  const menuItems = isGroup
    ? [
        { icon: Info, label: "Group Info", action: onViewGroupInfo },
        { icon: ImageIcon, label: "Chat Wallpaper", action: onToggleWallpaper },
        { icon: ImageIcon, label: "Wallpaper Settings", action: onToggleWallpaperSettings },
      ]
    : [
        { icon: UserIcon, label: "View Profile", action: onViewProfile },
        { icon: ImageIcon, label: "Chat Wallpaper", action: onToggleWallpaper },
        { icon: ImageIcon, label: "Wallpaper Settings", action: onToggleWallpaperSettings },
        { icon: Trash2Icon, label: "Clear Chat", action: onClearChat },
        { icon: DownloadIcon, label: "Export Chat", action: onExportChat },
        {
          icon: isMuted ? BellRingIcon : BellOffIcon,
          label: isMuted ? "Unmute" : "Mute",
          action: () => (isMuted ? unmuteUser(targetId) : muteUser(targetId)),
        },
        {
          icon: isBlocked ? CheckIcon : ShieldOffIcon,
          label: isBlocked ? "Unblock" : "Block",
          action: () => (isBlocked ? unblockUser(targetId) : blockUser(targetId)),
          danger: isBlocked,
        },
        { icon: MessageSquareOffIcon, label: "Delete Conversation", action: onDeleteChat, danger: true, separator: true },
      ];

  return (
    <div className="relative z-[100] flex shrink-0 items-center justify-between gap-3 overflow-visible border-b border-white/[0.08] bg-white/[0.08] px-3 py-3 backdrop-blur-xl sm:px-5">
      {/* Animated border glow */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[color:var(--accent-3)]/40 to-transparent" />

      <div className="flex min-w-0 items-center gap-3">
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => { setSelectedUser(null); setSelectedGroup(null); }}
          aria-label="Back"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[color:var(--text-primary)] backdrop-blur-xl transition-all duration-200 hover:bg-white/10"
        >
          <ArrowLeft className="size-4" />
        </motion.button>

        <motion.div
          whileHover={{ scale: 1.03 }}
          onClick={isGroup ? onViewGroupInfo : onViewProfile}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              isGroup ? onViewGroupInfo?.() : onViewProfile?.();
            }
          }}
          className="relative shrink-0 cursor-pointer"
        >
          <div className="flex size-11 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] p-[2px] shadow-[0_0_14px_var(--glow)] ring-2 ring-[color:var(--accent-3)]/20">
            {chatAvatar ? (
              <img src={chatAvatar} alt={chatName} className="size-full rounded-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-xs font-black text-white">
                {chatInitial}
              </span>
            )}
          </div>
          {!isGroup && (
            isOnline ? (
              <span className="online-pulse absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[color:var(--panel)] bg-emerald-400" />
            ) : (
              <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[color:var(--panel)] bg-slate-500" />
            )
          )}
        </motion.div>

        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-semibold leading-tight text-[color:var(--text-primary)]">{chatName || "Chat"}</h3>
          <p className="flex items-center gap-1.5 pt-0.5 text-xs text-[color:var(--text-muted)]">
            {typingLabel ? (
              <span className="flex items-center gap-1 font-medium text-emerald-300">
                <span className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                {typingLabel}
              </span>
            ) : isGroup ? (
              <>
                <ShieldOffIcon className="size-3" />
                <span>Group • {memberCount} {memberCount === 1 ? "member" : "members"}</span>
              </>
            ) : isBlocked ? (
              <span className="font-medium text-rose-400">Blocked</span>
            ) : isOnline ? (
              <>
                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                <span className="font-medium text-emerald-300">Online</span>
              </>
            ) : (
              <span className="text-[color:var(--text-muted)]/80">Offline</span>
            )}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={onToggleDetails} className={`premium-button ${isDetailsOpen ? "btn-active bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)]" : ""}`} aria-label="Details panel" aria-expanded={isDetailsOpen} aria-controls="chat-details-panel">
          <PanelRightIcon className="size-3.5" />
        </motion.button>
        <CallBadge />
        <motion.button
          whileHover={callsAvailable ? { scale: 1.04 } : undefined}
          whileTap={callsAvailable ? { scale: 0.96 } : undefined}
          onClick={handleVoiceCall}
          disabled={!callsAvailable}
          aria-disabled={!callsAvailable}
          aria-label={callsAvailable ? "Voice call" : `${chatName} is offline`}
          className={`premium-button hidden sm:inline-flex ${callsAvailable ? "" : "disabled:cursor-not-allowed disabled:opacity-30"}`}
        >
          <PhoneIcon className="size-3.5" />
        </motion.button>
        <motion.button
          whileHover={callsAvailable ? { scale: 1.04 } : undefined}
          whileTap={callsAvailable ? { scale: 0.96 } : undefined}
          onClick={handleVideoCall}
          disabled={!callsAvailable}
          aria-disabled={!callsAvailable}
          aria-label={callsAvailable ? "Video call" : `${chatName} is offline`}
          className={`premium-button hidden md:inline-flex ${callsAvailable ? "" : "disabled:cursor-not-allowed disabled:opacity-30"}`}
        >
          <VideoIcon className="size-3.5" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onToggleSearch}
          className={`premium-button hidden md:inline-flex ${isSearchOpen ? "btn-active bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)]" : ""}`}
          aria-label="Search in conversation"
          aria-expanded={isSearchOpen}
          aria-controls="chat-search-panel"
        >
          <SearchIcon className="size-3.5" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onToggleAI}
          className={`premium-button inline-flex ${isAIOpen ? "btn-active bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)]" : ""}`}
          aria-label="AI Assistant"
          aria-expanded={isAIOpen}
          aria-controls="ai-assistant-panel"
        >
          <SparklesIcon className="size-3.5" />
        </motion.button>
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} className="premium-button hidden sm:inline-flex" onClick={() => { setSelectedUser(null); setSelectedGroup(null); }} aria-label="Close chat">
          <XIcon className="size-3.5" />
        </motion.button>

        {/* Three-dot menu */}
        <div className="relative">
          <motion.button
            ref={menuButtonRef}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className={`premium-button inline-flex ${menuOpen ? "btn-active bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)]" : ""}`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="More options"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            aria-controls="chat-header-menu"
          >
            <MoreVerticalIcon className="size-3.5" />
          </motion.button>
        </div>

        {mounted &&
          createPortal(
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  ref={menuRef}
                  role="menu"
                  id="chat-header-menu"
                  aria-label="Chat options"
                  initial={
                    menuPos.placement === "below"
                      ? { opacity: 0, y: -6, scale: 0.96 }
                      : { opacity: 0, y: 6, scale: 0.96 }
                  }
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={
                    menuPos.placement === "below"
                      ? { opacity: 0, y: -6, scale: 0.96 }
                      : { opacity: 0, y: 6, scale: 0.96 }
                  }
                  transition={{ type: "spring", stiffness: 420, damping: 30, mass: 0.6 }}
                  style={{
                    position: "fixed",
                    top: menuPos.top,
                    left: menuPos.left,
                    width: 240,
                    transformOrigin:
                      menuPos.placement === "below" ? "top right" : "bottom right",
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                   className="z-[var(--z-popover,1700)] overflow-hidden rounded-2xl border border-white/[0.10] bg-[color:var(--panel-strong)] shadow-[0_18px_60px_-12px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.04),0_0_28px_-10px_var(--glow)] backdrop-blur-2xl"
                >
                  <div className="p-1.5">
                    {menuItems.map(({ icon: Icon, label, action, danger, separator }) => (
                      <div key={label}>
                        {separator && (
                          <div
                            role="separator"
                            className="my-1 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
                          />
                        )}
                        <motion.button
                          role="menuitem"
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            action?.();
                            setMenuOpen(false);
                            if (label === "Delete Conversation") window?.dispatchEvent(new Event("close-chat"));
                          }}
                          className={`group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors duration-150 ${
                            danger
                              ? "text-rose-400 hover:bg-rose-500/15 hover:text-rose-300"
                              : "text-[color:var(--text-primary)] hover:bg-[color:var(--accent-3)]/12 hover:text-[color:var(--accent-3)]"
                          }`}
                        >
                          <span
                            className={`flex size-4 shrink-0 items-center justify-center transition-colors duration-150 ${
                              danger ? "" : "text-[color:var(--text-muted)] group-hover:text-[color:var(--accent-3)]"
                            }`}
                          >
                            <Icon className="size-4" strokeWidth={2} />
                          </span>
                          <span className="truncate">{label}</span>
                        </motion.button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>,
            document.body
          )}
      </div>
    </div>
  );
}
export default ChatHeader;

