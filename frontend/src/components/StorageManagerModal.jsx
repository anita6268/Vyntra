import { AnimatePresence, motion } from "framer-motion";
import {
  XIcon,
  HardDriveIcon,
  ImageIcon,
  FilmIcon,
  FileTextIcon,
  MicIcon,
  FolderOpenIcon,
  LockIcon,
} from "lucide-react";
import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { canUsePremiumFeature, PREMIUM_FEATURES } from "../lib/premiumFeatures";
import { promptUpgrade } from "../lib/premiumGating";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

const TOTAL_GB = 100;
const TOTAL_BYTES = TOTAL_GB * 1024 * 1024 * 1024;

function StorageManagerModal({ isOpen, onClose, onManageFiles }) {
  const messages = useChatStore((s) => s.messages);
  const isLocked = !canUsePremiumFeature(PREMIUM_FEATURES.STORAGE);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const list = Array.isArray(messages) ? messages : [];
  const photos = list.filter((m) => m.image);
  const files = list.filter((m) => m.fileUrl && !m.image);
  const videos = list.filter((m) => (m.fileType || "").startsWith("video"));
  const voice = list.filter((m) => m.audio);

  const usedBytes = list.reduce((acc, m) => acc + (Number(m.fileSize) || 0), 0);
  const usedPct = Math.min(100, (usedBytes / TOTAL_BYTES) * 100);
  const usedLabel = usedBytes > 0 ? formatBytes(usedBytes) : "0 MB";
  const availableLabel = formatBytes(Math.max(0, TOTAL_BYTES - usedBytes));

  const categories = [
    { icon: ImageIcon, label: "Photos", count: photos.length, size: photos.length > 0 ? `${photos.length} shared` : "None yet" },
    { icon: FilmIcon, label: "Videos", count: videos.length, size: videos.length > 0 ? `${videos.length} shared` : "None yet" },
    { icon: FileTextIcon, label: "Files", count: files.length, size: usedBytes > 0 ? usedLabel : (files.length > 0 ? `${files.length} shared` : "None yet") },
    { icon: MicIcon, label: "Voice", count: voice.length, size: voice.length > 0 ? `${voice.length} shared` : "None yet" },
  ];

  const storageLabel = isLocked
    ? "100 GB demo quota"
    : "100 GB demo quota (local)";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm" />
           <motion.div
             initial={{ opacity: 0, scale: 0.94, y: 16 }}
             animate={{ opacity: 1, scale: 1, y: 0 }}
             exit={{ opacity: 0, scale: 0.96, y: 16 }}
             transition={{ type: "spring", stiffness: 340, damping: 28 }}
             onClick={(e) => e.stopPropagation()}
             role="dialog" aria-modal="true" aria-label="Storage Manager"
             className="fixed inset-0 z-[105] flex items-center justify-center p-4 sm:p-6"
           >
            <div className="flex w-full max-w-[520px] max-h-[85vh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--panel-strong)]/95 shadow-2xl backdrop-blur-2xl">
              <div className="relative shrink-0 overflow-hidden rounded-t-3xl border-b border-white/10 bg-[linear-gradient(135deg,var(--accent),var(--accent-2),var(--accent-3))] px-6 py-6 text-center">
                <div className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-white/20 blur-2xl" />
              <div className="flex items-center justify-center gap-3">
                   <div className="flex size-12 items-center justify-center rounded-full border-2 border-white/20 bg-white/15">
                     {isLocked ? <LockIcon className="size-6 text-white" /> : <HardDriveIcon className="size-6 text-white" />}
                   </div>
                   <div className="text-left">
                      <h2 className="text-lg font-bold text-white">Storage Manager</h2>
                      <p className="text-xs text-white/85">{isLocked ? "Premium feature" : "Vyntra Pro Storage (" + storageLabel + ")"}</p>
                   </div>
                 </div>
                <button
                  onClick={onClose}
                  aria-label="Close storage manager"
                  className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/80 transition-colors hover:bg-white/20"
                >
                  <XIcon className="size-4" />
                </button>
              </div>

              {isLocked ? (
                  <div className="flex-1 overflow-y-auto p-6 text-center">
                   <p className="text-sm text-[color:var(--text-muted)]">100 GB demo quota and advanced file management are available with Vyntra Pro.</p>
                   <button
                     type="button"
                     onClick={() => promptUpgrade("Storage Manager is available with Vyntra Pro.", PREMIUM_FEATURES.STORAGE)}
                     className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-[color:var(--glow)]"
                   >
                     Upgrade to Pro
                   </button>
                 </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto overflow-x-hidden p-6">
                    <div className="mb-2 flex items-end justify-between">
                      <span className="text-sm font-semibold text-[color:var(--text-primary)]">Total storage</span>
                      <span className="text-xs text-[color:var(--text-muted)]">{storageLabel}</span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full border border-white/10 bg-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(usedPct, 1)}%` }}
                        transition={{ type: "spring", stiffness: 60, damping: 20 }}
                        className="h-full rounded-full bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)]"
                      />
                    </div>
                    <div className="mt-2 flex justify-between text-[11px] text-[color:var(--text-muted)]">
                      <span>Used: {usedLabel}</span>
                      <span>Available: {availableLabel}</span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      {categories.map((c) => (
                        <div key={c.label} className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                          <div className="mb-2 flex size-9 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/20 to-[color:var(--accent-3)]/20 text-[color:var(--accent-3)]">
                            <c.icon className="size-4" />
                          </div>
                          <p className="text-sm font-semibold text-[color:var(--text-primary)]">{c.label}</p>
                          <p className="text-xl font-bold text-[color:var(--accent-3)]">{c.count}</p>
                          <p className="truncate text-[11px] text-[color:var(--text-muted)]">{c.size}</p>
                        </div>
                      ))}
                    </div>

                    <p className="mt-4 text-center text-[10px] text-[color:var(--text-muted)]">
                      Calculated from files shared in the current conversation. {isLocked ? "This is a demo quota — unlock full storage with Vyntra Pro." : "Local demo quota — no real cloud storage is allocated."}
                    </p>
                  </div>

                  <div className="shrink-0 border-t border-white/10 p-4">
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={onManageFiles}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-[color:var(--glow)]"
                    >
                      <FolderOpenIcon className="size-4" /> Manage Files
                    </motion.button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default StorageManagerModal;
