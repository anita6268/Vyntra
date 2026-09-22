import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import {
  XIcon,
  PaletteIcon,
  PlusIcon,
  UploadIcon,
  PlayIcon,
  CheckIcon,
  Trash2Icon,
} from "lucide-react";
import { useRef, useState, useEffect } from "react";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_VIDEO_BYTES = 3 * 1024 * 1024;

const IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_EXT = ["jpg", "jpeg", "png", "webp"];
const ANIMATED_IMAGE_MIME = ["image/gif", "image/webp"];
const ANIMATED_EXT = ["gif", "webp"];
const VIDEO_MIME = ["video/mp4", "video/webm"];
const VIDEO_EXT = ["mp4", "webm"];

const PRESETS = [
  { key: "default", label: "Default", type: "solid", value: "transparent" },
  { key: "gradient", label: "Gradient", type: "gradient", value: "linear-gradient(135deg, #7c3aed, #06b6d4, #a855f7)" },
  { key: "ocean", label: "Ocean", type: "gradient", value: "linear-gradient(135deg, #0ea5e9, #14b8a6, #22d3ee)" },
  { key: "sunset", label: "Sunset", type: "gradient", value: "linear-gradient(135deg, #f43f5e, #f97316, #fbbf24)" },
  { key: "emerald", label: "Emerald", type: "gradient", value: "linear-gradient(135deg, #10b981, #34d399, #2dd4bf)" },
  { key: "solid-1", label: "Charcoal", type: "solid", value: "#1f2937" },
  { key: "solid-2", label: "Slate", type: "solid", value: "#0f172a" },
  { key: "solid-3", label: "Rose", type: "solid", value: "#3b0d17" },
  { key: "blur", label: "Blur", type: "solid", value: "rgba(10,10,15,0.55)" },
];

const ANIMATED_PRESETS = [
  { key: "aurora", label: "Aurora", value: "aurora", type: "animated-gradient" },
  { key: "neon-flow", label: "Neon Flow", value: "neon-flow", type: "animated-gradient" },
  { key: "purple-waves", label: "Purple Waves", value: "purple-waves", type: "animated-gradient" },
  { key: "cosmic", label: "Cosmic", value: "cosmic", type: "animated-gradient" },
  { key: "ocean-motion", label: "Ocean Motion", value: "ocean-motion", type: "animated-gradient" },
  { key: "crimson-flow", label: "Crimson Flow", value: "crimson-flow", type: "animated-gradient" },
];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Image failed to load."));
    img.src = dataUrl;
  });
}

function isAnimatedMedia(choice) {
  return choice?.type === "animated-image" || choice?.type === "video" || choice?.type === "animated-gradient";
}

function WallpaperPicker({ isOpen, onClose, chatKey, current, onApply, onOpenSettings }) {
  const imageInputRef = useRef(null);
  const animatedInputRef = useRef(null);
  const KEY = chatKey;
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("");
  const [activeTab, setActiveTab] = useState("solid");

  const currentChoice = current || (() => {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
  })();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const apply = (choice) => {
    try {
      if (choice == null) {
        localStorage.removeItem(KEY);
      } else {
        localStorage.setItem(KEY, JSON.stringify(choice));
      }
    } catch {
      toast.error("Wallpaper is too large to save locally. Please choose a smaller file.");
      return;
    }
    onApply?.(choice);
  };

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imageInputRef.current) imageInputRef.current.value = "";

    const ext = file.name.split(".").pop().toLowerCase();
    const isImage = IMAGE_MIME.includes(file.type);

    if (!isImage) {
      toast.error("Unsupported file. Use JPG, PNG or WebP.");
      return;
    }
    if (!IMAGE_EXT.includes(ext)) {
      toast.error("File extension does not match its image type.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(`Image too large. Max ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      await loadImage(dataUrl);
      apply({ type: "image", value: dataUrl, key: "image", fileName: file.name });
      toast.success("Wallpaper applied");
    } catch {
      toast.error("Failed to load image. The file may be corrupted.");
    }
  };

  const handleAnimatedFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (animatedInputRef.current) animatedInputRef.current.value = "";

    const ext = file.name.split(".").pop().toLowerCase();
    const isAnimatedImage = ANIMATED_IMAGE_MIME.includes(file.type);
    const isVideo = VIDEO_MIME.includes(file.type);

    if (!isAnimatedImage && !isVideo) {
      toast.error("Unsupported file. Use GIF, WebP, MP4 or WebM.");
      return;
    }
    if (isAnimatedImage && !ANIMATED_EXT.includes(ext)) {
      toast.error("File extension does not match its image type.");
      return;
    }
    if (isVideo && !VIDEO_EXT.includes(ext)) {
      toast.error("File extension does not match its video type.");
      return;
    }

    if (isVideo) {
      if (file.size > MAX_VIDEO_BYTES) {
        toast.error(`Video too large. Max ${MAX_VIDEO_BYTES / 1024 / 1024} MB.`);
        return;
      }
      await uploadVideo(file);
    } else {
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`File too large. Max ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
        return;
      }
      try {
        const dataUrl = await readFileAsDataUrl(file);
        await loadImage(dataUrl);
        apply({ type: "animated-image", value: dataUrl, key: "animated-image", fileName: file.name });
        toast.success("Animated wallpaper applied");
      } catch {
        toast.error("Failed to load image. The file may be corrupted.");
      }
    }
  };

  const uploadVideo = async (file) => {
    setUploading(true);
    setUploadLabel("Uploading video…");
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await axiosInstance.post("/wallpapers/upload", {
        dataUrl,
        mimeType: file.type,
        fileName: file.name,
      });
      if (!res.data?.url) throw new Error("Upload returned no URL.");
      apply({ type: "video", value: res.data.url, key: "video", fileName: file.name });
      toast.success("Animated video wallpaper applied");
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Could not upload video wallpaper. The server may not be configured for video uploads — try a GIF instead.";
      toast.error(msg);
    } finally {
      setUploading(false);
      setUploadLabel("");
    }
  };

  const removeWallpaper = () => {
    apply(null);
    toast.success("Wallpaper removed");
  };

  const thumbnailFor = (p) => {
    if (p.type === "image" || p.type === "animated-image") {
      return <img src={p.value} alt="" className="size-full object-cover" />;
    }
    if (p.type === "video") {
      return (
        <div className="relative size-full rounded-lg border border-white/10 bg-[color:var(--panel-strong)]/80">
          <PlayIcon className="absolute inset-0 my-auto size-5 text-[color:var(--accent-3)]" />
        </div>
      );
    }
    if (p.type === "animated-gradient") {
      return <div className={`size-full ${p.value ? `wallpaper-${p.value}` : "wallpaper-aurora"}`} />;
    }
    return <div className="size-full" style={{ background: p.value }} />;
  };

  const Tab = ({ id, label }) => (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => setActiveTab(id)}
      className={`relative flex-1 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
        activeTab === id
          ? "border-[color:var(--accent-3)]/50 bg-[color:var(--accent-3)]/12 text-[color:var(--text-primary)]"
          : "border-white/10 bg-white/5 text-[color:var(--text-muted)] hover:bg-white/10"
      }`}
    >
      {label}
      {activeTab === id && (
        <span className="absolute bottom-0 left-1 right-1 h-0.5 rounded-t bg-[color:var(--accent-3)]" />
      )}
    </motion.button>
  );

  const PresetCard = ({ preset, isActive, onSelect }) => (
    <motion.div
      layout
      key={preset.key}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.96 }}
      onClick={onSelect}
      className={`relative aspect-video w-full overflow-hidden rounded-xl border transition-all ${
        isActive
          ? "border-[color:var(--accent-3)] ring-2 ring-[color:var(--accent-3)]/40 wallpaper-selected-glow"
          : "border-white/10 hover:border-white/20 hover:shadow-[0_0_12px_rgba(124,58,237,0.15)]"
      }`}
    >
      {thumbnailFor(preset)}
      {isAnimatedMedia(preset) && (
        <span className="absolute left-1 top-1 rounded-md bg-black/50 px-1 py-0.5 text-[6px] font-medium uppercase text-white">
          ANIMATED
        </span>
      )}
      {isActive && (
        <CheckIcon className="absolute right-1 top-1 size-3 text-[color:var(--accent-3)]" />
      )}
      <span className="absolute inset-x-0 bottom-0 bg-black/50 px-1.5 py-0.5 text-center text-[9px] font-medium text-white">
        {preset.label}
      </span>
    </motion.div>
  );

  const UploadButton = ({ onClick, disabled, label, icon: Icon }) => (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 py-3 text-sm text-[color:var(--text-muted)] transition hover:bg-white/10 disabled:opacity-60"
    >
      {disabled ? (
        <UploadIcon className="size-4 animate-bounce" />
      ) : (
        <Icon className="size-4" />
      )}
      {label}
    </motion.button>
  );

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
           className="fixed inset-0 z-[var(--z-modal,1600)] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[color:var(--panel-strong)]/95 shadow-2xl backdrop-blur-2xl sm:rounded-[28px]"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/25 to-[color:var(--accent-3)]/25 text-[color:var(--accent-3)]">
                  <PaletteIcon className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Chat Wallpaper</h3>
                  <p className="text-xs text-[color:var(--text-muted)]">Customize this conversation</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            <div className="scrollbar-thin max-h-[60vh] overflow-y-auto p-4">
              <div className="mb-3 flex items-center gap-2">
                <Tab id="solid" label="Solid" />
                <Tab id="image" label="Images" />
                <Tab id="animated" label="Animated" />
              </div>

              {/* ── Solid / gradient presets ── */}
              {activeTab === "solid" && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {PRESETS.map((p) => {
                    const isActive = currentChoice?.key === p.key && !isAnimatedMedia(currentChoice);
                    return (
                      <PresetCard key={p.key} preset={p} isActive={isActive} onSelect={() => apply(p)} />
                    );
                  })}
                </div>
              )}

              {/* ── Images: upload own static picture ── */}
              {activeTab === "image" && (
                <div className="space-y-3">
                  <UploadButton
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploading}
                    label="+ Add Picture"
                    icon={PlusIcon}
                  />
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageFile}
                    className="hidden"
                  />

                  {currentChoice?.type === "image" && (
                    <div className="flex items-center gap-3 rounded-xl border border-[color:var(--accent-3)]/30 bg-white/5 p-2.5">
                      <img src={currentChoice.value} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      <span className="min-w-0 text-xs text-[color:var(--text-muted)]">Custom wallpaper applied</span>
                      <CheckIcon className="ml-auto size-4 text-[color:var(--accent-3)]" />
                    </div>
                  )}
                </div>
              )}

              {/* ── Animated: built-in gradients + my animated media ── */}
              {activeTab === "animated" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
                    {ANIMATED_PRESETS.map((p) => {
                      const isActive = currentChoice?.key === p.key && currentChoice?.type === "animated-gradient";
                      return (
                        <PresetCard key={p.key} preset={p} isActive={isActive} onSelect={() => apply(p)} />
                      );
                    })}
                  </div>

                  <div className="space-y-2">
                    <UploadButton
                      onClick={() => animatedInputRef.current?.click()}
                      disabled={uploading}
                      label="+ Add Animated Wallpaper"
                      icon={PlusIcon}
                    />
                    <input
                      ref={animatedInputRef}
                      type="file"
                      accept="image/gif,image/webp,video/mp4,video/webm"
                      onChange={handleAnimatedFile}
                      className="hidden"
                    />

                    {uploadLabel && (
                      <div className="flex items-center gap-2 text-[11px] text-[color:var(--text-muted)]">
                        <UploadIcon className="size-3 animate-bounce" />
                        {uploadLabel}
                      </div>
                    )}

                    {currentChoice && isAnimatedMedia(currentChoice) && currentChoice.type !== "animated-gradient" ? (
                      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-[color:var(--accent-3)]/50 ring-1 ring-[color:var(--accent-3)]/40">
                        {thumbnailFor(currentChoice)}
                        <span className="absolute left-1 top-1 rounded-md bg-black/50 px-1 py-0.5 text-[6px] font-medium uppercase text-white">
                          ANIMATED
                        </span>
                        <CheckIcon className="absolute right-1 top-1 size-3 text-[color:var(--accent-3)]" />
                        <span className="absolute inset-x-0 bottom-0 bg-black/50 px-1.5 py-0.5 text-center text-[9px] font-medium text-white">
                          {currentChoice.fileName || "Applied"}
                        </span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-[color:var(--text-muted)]">No animated wallpaper applied yet.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer: remove + settings */}
            <div className="border-t border-white/10 p-3">
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={removeWallpaper}
                  disabled={!currentChoice}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-medium text-[color:var(--text-muted)] transition hover:border-rose-400/30 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50"
                >
                  <Trash2Icon className="size-3.5" />
                  Remove Wallpaper
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    onClose();
                    onOpenSettings?.();
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-medium text-[color:var(--text-muted)] transition hover:bg-white/10"
                >
                  <PaletteIcon className="size-3.5" />
                  Settings
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default WallpaperPicker;
