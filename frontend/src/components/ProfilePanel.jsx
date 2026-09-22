import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
  XIcon, ImageIcon, FileIcon, MicIcon, PinIcon, Link2Icon, UsersIcon,
  BellOffIcon, BellRingIcon, ShieldOffIcon, ShieldCheckIcon, Trash2Icon,
  PhoneIcon, VideoIcon, MessageCircleIcon, StarIcon, Loader2Icon,
  Share2Icon, FlagIcon, ArrowLeftIcon,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { formatLastSeen } from "../lib/formatLastSeen";
import SharedPhotosPanel from "./panels/SharedPhotosPanel";
import FilesPanel from "./panels/FilesPanel";
import VoiceNotesPanel from "./panels/VoiceNotesPanel";
import PinnedMessagesPanel from "./panels/PinnedMessagesPanel";
import StarredMessagesPanel from "./panels/StarredMessagesPanel";
import ImageViewer from "./ImageViewer";
import ShareModal from "./ShareModal";
import ConfirmModal from "./ConfirmModal";
import toast from "react-hot-toast";

const TABS = [
  { key: "media", label: "Media", icon: ImageIcon },
  { key: "files", label: "Files", icon: FileIcon },
  { key: "voice", label: "Voice", icon: MicIcon },
  { key: "pinned", label: "Pinned", icon: PinIcon },
  { key: "starred", label: "Starred", icon: StarIcon },
];

function ProfilePanel({ isOpen, onClose, onVoiceCall, onVideoCall, onDeleteConversation, messages = [] }) {
  const { onlineUsers, authUser } = useAuthStore();
  const { selectedUser, isMuted, isBlocked, muteUser, unmuteUser, blockUser, unblockUser, getUserProfile, getRelationship, reportUser } = useChatStore();
  const [activeTab, setActiveTab] = useState("media");
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    if (!isOpen || !selectedUser?._id) return;
    let isCancelled = false;
    setIsLoadingProfile(true);
    setProfileError(null);

    const refreshProfile = async () => {
      try {
        const [profile, relationship] = await Promise.all([
          getUserProfile(selectedUser._id),
          getRelationship(selectedUser._id),
        ]);
        if (isCancelled) return;
        if (profile) {
          useChatStore.setState((state) => ({
            selectedUser: { ...state.selectedUser, ...profile },
          }));
        }
        if (relationship) {
          useChatStore.setState({
            isBlocked: relationship.isBlocked,
            hasBlockedMe: relationship.hasBlockedMe,
            isMuted: relationship.isMuted,
          });
        }
      } catch {
        if (!isCancelled) setProfileError("Failed to load profile");
      } finally {
        if (!isCancelled) setIsLoadingProfile(false);
      }
    };

    refreshProfile();
    return () => { isCancelled = true; };
  }, [isOpen, selectedUser?._id, getUserProfile, getRelationship]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") {
        if (viewerOpen) {
          setViewerOpen(false);
        } else if (shareOpen) {
          setShareOpen(false);
        } else if (showReportConfirm) {
          setShowReportConfirm(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, viewerOpen, shareOpen, showReportConfirm, onClose]);

  if (!selectedUser) return null;

  const isOnline = onlineUsers.includes(String(selectedUser._id)) && selectedUser.showOnline !== false;
  const myId = authUser?._id;

  const mediaCount = messages.filter((m) => m.image).length;
  const filesCount = messages.filter((m) => m.fileUrl && !m.image).length;
  const voiceCount = messages.filter((m) => m.audio).length;
  const linksCount = messages.filter((m) => m.text && /https?:\/\//.test(m.text)).length;
  const pinnedCount = messages.filter((m) => Array.isArray(m.pinnedBy) && m.pinnedBy.some((id) => id.toString() === myId)).length;
  const starredCount = messages.filter((m) => Array.isArray(m.starredBy) && m.starredBy.some((id) => id.toString() === myId)).length;

  const handleVoiceCall = () => {
    if (!isOnline) return;
    onVoiceCall?.();
  };
  const handleVideoCall = () => {
    if (!isOnline) return;
    onVideoCall?.();
  };

  const handleReport = async () => {
    setShowReportConfirm(false);
    setReporting(true);
    try {
      await reportUser(selectedUser._id, "Reported from profile");
      toast.success("Report submitted. We will review this user.");
    } catch {
      toast.error("Failed to submit report");
    } finally {
      setReporting(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "media":
        return <SharedPhotosPanel messages={messages} />;
      case "files":
        return <FilesPanel messages={messages} />;
      case "voice":
        return <VoiceNotesPanel messages={messages} />;
      case "pinned":
        return <PinnedMessagesPanel messages={messages} />;
      case "starred":
        return <StarredMessagesPanel messages={messages} />;
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="fixed right-0 top-0 z-[70] flex h-full max-h-[100dvh] w-full max-w-sm flex-col border-l border-white/10 bg-[color:var(--panel-strong)]/90 shadow-2xl backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 p-4">
              <button
                onClick={onClose}
                className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-primary)] transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-3)]/50"
                aria-label="Back"
              >
                <ArrowLeftIcon className="size-4" />
              </button>
              <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Profile</h3>
              <button
                onClick={onClose}
                className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-3)]/50"
                aria-label="Close profile"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            <div className="scrollbar-thin h-full overflow-y-auto">
              {/* User info */}
              <div className="flex flex-col items-center px-5 pt-6 pb-4 text-center">
                {isLoadingProfile ? (
                  <Loader2Icon className="size-8 animate-spin text-[color:var(--accent-3)]" />
                ) : profileError ? (
                  <div className="space-y-2">
                    <p className="text-sm text-rose-400">{profileError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileError(null);
                        setIsLoadingProfile(true);
                        getUserProfile(selectedUser._id).then((profile) => {
                          if (profile) {
                            useChatStore.setState((state) => ({
                              selectedUser: { ...state.selectedUser, ...profile },
                            }));
                          }
                        }).catch(() => setProfileError("Failed to load profile"))
                          .finally(() => setIsLoadingProfile(false));
                      }}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-[color:var(--text-primary)] transition-colors hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-3)]/50"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative mb-4">
                      <div
                        className="flex size-28 cursor-pointer items-center justify-center rounded-full border-2 border-[color:var(--accent)]/40 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] p-[3px] shadow-[0_0_25px_rgba(124,58,237,0.25)] transition-all duration-300 hover:shadow-[0_0_35px_rgba(124,58,237,0.35)]"
                        onClick={() => setViewerOpen(true)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setViewerOpen(true);
                        }}
                        title="View fullscreen photo"
                      >
                        <img src={selectedUser.profilePic || "/avatar.png"} alt={selectedUser.fullName} className="size-full rounded-full object-cover" />
                      </div>
                      <span className={`absolute bottom-1 right-1 size-4 rounded-full border-2 border-[color:var(--panel-strong)] ${isOnline ? "bg-emerald-400" : "bg-zinc-500"}`} />
                    </div>
                    <h3 className="text-xl font-bold text-[color:var(--text-primary)]">{selectedUser.fullName}</h3>
                    {selectedUser.username && (
                      <p className="mt-1 text-xs text-[color:var(--text-muted)]">@{selectedUser.username}</p>
                    )}
                    <p className={`mt-1.5 text-sm font-medium ${isOnline ? "text-emerald-400" : "text-[color:var(--text-muted)]"}`}>
                      {isOnline ? "Online now" : selectedUser.lastSeen ? formatLastSeen(selectedUser.lastSeen) : "Offline"}
                    </p>
                    {selectedUser.about && (
                      <p className="mt-2 max-w-[280px] break-words text-sm text-[color:var(--text-muted)]">
                        {selectedUser.about}
                      </p>
                    )}
                    {selectedUser.phone && (
                      <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-[color:var(--text-muted)]">
                        <PhoneIcon className="size-3.5" /> {selectedUser.phone}
                      </p>
                    )}
                  </>
                )}

                <div className="mt-5 flex w-full gap-2.5">
                  <button
                    onClick={handleVoiceCall}
                    aria-label={isOnline ? `Call ${selectedUser.fullName}` : `${selectedUser.fullName} is offline`}
                    title={isOnline ? `Call ${selectedUser.fullName}` : `${selectedUser.fullName} is offline`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] py-3 text-sm font-semibold text-white shadow-lg shadow-purple-500/20 transition-all duration-200 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-3)]/50"
                  >
                    <PhoneIcon className="size-4" /> Call
                  </button>
                  <button
                    onClick={handleVideoCall}
                    aria-label={isOnline ? `Video call ${selectedUser.fullName}` : `${selectedUser.fullName} is offline`}
                    title={isOnline ? `Video call ${selectedUser.fullName}` : `${selectedUser.fullName} is offline`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] py-3 text-sm font-semibold text-[color:var(--text-primary)] transition-all duration-200 hover:bg-white/10 hover:border-white/25 hover:shadow-lg active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-3)]/50"
                  >
                    <VideoIcon className="size-4" /> Video
                  </button>
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-2.5 px-5">
                {[
                  { label: "Media", value: mediaCount },
                  { label: "Files", value: filesCount },
                  { label: "Voice", value: voiceCount },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.07] p-3 text-center transition-all duration-200 hover:bg-white/[0.12] hover:border-white/20">
                    <p className="text-xl font-bold text-[color:var(--accent-3)]">{s.value}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-[color:var(--text-muted)]">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Section tabs */}
              <div className="mt-5 flex items-center gap-1.5 overflow-x-auto px-5 pb-1 scrollbar-thin">
                {TABS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-3)]/50 ${
                      activeTab === key
                        ? "border-transparent bg-gradient-to-r from-[color:var(--accent)]/25 to-[color:var(--accent-3)]/25 text-[color:var(--text-primary)] shadow-[0_0_18px_rgba(124,58,237,0.25)]"
                        : "border-white/10 bg-white/5 text-[color:var(--text-muted)] hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="mt-3 max-h-[28vh] overflow-y-auto px-5">
                {renderContent()}
              </div>

              {/* Links, shared media counts */}
              <div className="mt-3 space-y-2 px-5 pb-4">
                <div className="flex items-center gap-2.5 text-sm text-[color:var(--text-muted)]">
                  <Link2Icon className="size-4 text-[color:var(--accent-3)]" />
                  <span>Shared links: <span className="font-semibold text-[color:var(--text-primary)]">{linksCount}</span></span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-[color:var(--text-muted)]">
                  <PinIcon className="size-4 text-[color:var(--accent-3)]" />
                  <span>Pinned: <span className="font-semibold text-[color:var(--text-primary)]">{pinnedCount}</span></span>
                </div>
                <div className="flex items-center gap-2.5 text-sm text-[color:var(--text-muted)]">
                  <StarIcon className="size-4 text-[color:var(--accent-3)]" />
                  <span>Starred: <span className="font-semibold text-[color:var(--text-primary)]">{starredCount}</span></span>
                </div>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-2.5 px-5 pb-4">
                <button
                  onClick={() => setShareOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-3 text-sm font-semibold text-[color:var(--text-primary)] transition-all duration-200 hover:bg-white/[0.12] hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-3)]/50"
                  aria-label={`Share ${selectedUser.fullName}'s profile`}
                >
                  <Share2Icon className="size-4 text-[color:var(--accent-3)]" /> Share
                </button>
                <button
                  onClick={() => (isMuted ? unmuteUser(selectedUser._id) : muteUser(selectedUser._id))}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.07] px-3 py-3 text-sm font-semibold text-[color:var(--text-primary)] transition-all duration-200 hover:bg-white/[0.12] hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-3)]/50"
                  aria-label={isMuted ? "Unmute notifications" : "Mute notifications"}
                >
                  {isMuted ? <BellRingIcon className="size-4 text-[color:var(--accent-3)]" /> : <BellOffIcon className="size-4 text-[color:var(--text-muted)]" />}
                  {isMuted ? "Unmute" : "Mute"}
                </button>
              </div>

              {/* Danger actions */}
              <div className="space-y-2.5 border-t border-white/10 p-5 pt-4">
                <button
                  onClick={() => (isBlocked ? unblockUser(selectedUser._id) : blockUser(selectedUser._id))}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-3)]/50 ${
                    isBlocked
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      : "border-white/10 bg-white/[0.07] text-[color:var(--text-primary)] hover:bg-white/[0.12] hover:border-white/20"
                  }`}
                  aria-label={isBlocked ? "Unblock user" : "Block user"}
                >
                  {isBlocked ? <ShieldCheckIcon className="size-4" /> : <ShieldOffIcon className="size-4 text-[color:var(--text-muted)]" />}
                  {isBlocked ? "Unblock user" : "Block user"}
                </button>
                <button
                  onClick={() => setShowReportConfirm(true)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-400 transition-all duration-200 hover:bg-amber-500/20 hover:border-amber-500/30 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  aria-label="Report user"
                >
                  <FlagIcon className="size-4" /> Report user
                </button>
                <button
                  onClick={() => {
                    onDeleteConversation?.();
                    onClose();
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-400 transition-all duration-200 hover:bg-rose-500/20 hover:border-rose-500/30 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                  aria-label="Delete conversation"
                >
                  <Trash2Icon className="size-4" />
                  Delete conversation
                </button>
              </div>
            </div>
          </motion.aside>

          {/* Fullscreen image viewer */}
          <ImageViewer
            src={selectedUser?.profilePic}
            alt={selectedUser?.fullName}
            isOpen={viewerOpen}
            onClose={() => setViewerOpen(false)}
          />

          {/* Share modal */}
          <ShareModal
            isOpen={shareOpen}
            onClose={() => setShareOpen(false)}
            profile={selectedUser}
          />

          {/* Report confirmation */}
          <ConfirmModal
            isOpen={showReportConfirm}
            onClose={() => setShowReportConfirm(false)}
            onConfirm={handleReport}
            title="Report user?"
            description={
              <>
                This will flag <span className="font-semibold text-[color:var(--text-primary)]">{selectedUser?.fullName}</span> for review by our moderation team.
              </>
            }
            confirmLabel={reporting ? "Submitting..." : "Report"}
            confirmVariant="danger"
          />
        </>
      )}
    </AnimatePresence>
  );
}

export default ProfilePanel;
