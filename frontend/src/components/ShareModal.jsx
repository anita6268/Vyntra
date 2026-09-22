import { useState } from "react";
import { motion } from "framer-motion";
import {
  XIcon,
  Link2Icon,
  CheckIcon,
  Share2Icon,
  CopyIcon,
  UserIcon,
} from "lucide-react";
import toast from "react-hot-toast";

function ShareModal({ isOpen, onClose, profile }) {
  const [copied, setCopied] = useState(false);

  const profileUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/u/${profile?.username || profile?._id}`
      : "";

  const handleCopy = async () => {
    if (!profileUrl) return;
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      toast.success("Profile link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleNativeShare = async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: `${profile?.fullName || "User"} on Vyntra`,
        text: `Check out ${profile?.fullName || "this user"} on Vyntra`,
        url: profileUrl,
      });
    } catch {
      // user cancelled or share failed silently
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-[min(92vw,22rem)] rounded-3xl border border-white/10 bg-[color:var(--panel-strong)]/95 p-5 shadow-2xl backdrop-blur-2xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[color:var(--text-primary)]">Share profile</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-muted)] transition hover:bg-white/10 hover:text-[color:var(--text-primary)]"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] text-white">
            {profile?.profilePic ? (
              <img src={profile.profilePic} alt="" className="size-full rounded-full object-cover" />
            ) : (
              <UserIcon className="size-5" />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
              {profile?.fullName || "User"}
            </p>
            <p className="truncate text-xs text-[color:var(--text-muted)]">
              @{profile?.username || "username"}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium text-[color:var(--text-primary)] transition hover:bg-white/10"
          >
            {copied ? (
              <CheckIcon className="size-4 text-emerald-400" />
            ) : (
              <CopyIcon className="size-4 text-[color:var(--accent-3)]" />
            )}
            {copied ? "Copied!" : "Copy profile link"}
          </button>
          {typeof navigator !== "undefined" && navigator.share && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-medium text-[color:var(--text-primary)] transition hover:bg-white/10"
            >
              <Share2Icon className="size-4 text-[color:var(--accent-3)]" />
              Share via...
            </button>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--text-muted)]">Profile link</p>
          <p className="mt-1 break-all text-xs text-[color:var(--text-primary)]">{profileUrl}</p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default ShareModal;
