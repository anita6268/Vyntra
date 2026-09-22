import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { XIcon, RotateCcwIcon, Trash2Icon, PlayIcon } from "lucide-react";
import { useState, useEffect } from "react";
import CustomSelect from "./CustomSelect";

const GLOBAL_SETTINGS_KEY = "vyntra-wallpaper-settings";

const DEFAULTS = {
  opacity: 0.7,
  blur: 0,
  overlay: 0.55,
  position: "center",
  size: "cover",
};

const POSITION_OPTIONS = [
  { value: "center", label: "Center" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

const SIZE_OPTIONS = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
  { value: "auto", label: "Auto" },
];

function wallpaperThumbnail(choice) {
  if (!choice) return null;
  if (choice.type === "image" || choice.type === "animated-image") {
    return <img src={choice.value} alt="" className="h-10 w-10 rounded-lg object-cover" />;
  }
  if (choice.type === "video") {
    return (
      <div className="relative flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[color:var(--panel-strong)]">
        <PlayIcon className="size-5 text-[color:var(--accent-3)]" />
      </div>
    );
  }
  if (choice.type === "animated-gradient") {
    return <div className={`size-10 rounded-lg ${choice.value ? `wallpaper-${choice.value}` : "wallpaper-aurora"}`} />;
  }
  return <div className="size-10 rounded-lg" style={{ background: choice.value }} />;
}

// Settings are stored PER CHAT (one look per conversation). When a chat has no
// saved settings we fall back to the globally saved settings so the user's
// preferred defaults carry over to a freshly opened conversation.
function loadSettings(chatKey) {
  if (chatKey) {
    try {
      const raw = localStorage.getItem(chatKey);
      if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch { /* ignore parse errors */ }
  }
  try {
    const raw = localStorage.getItem(GLOBAL_SETTINGS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore parse errors */ }
  return { ...DEFAULTS };
}

function WallpaperSettings({ isOpen, onClose, current, chatKey, onApplySettings, onRemove }) {
  const [settings, setSettings] = useState(() => loadSettings(chatKey));

  useEffect(() => {
    if (isOpen) setSettings(loadSettings(chatKey));
  }, [isOpen, chatKey]);

  const update = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    if (chatKey) {
      try { localStorage.setItem(chatKey, JSON.stringify(next)); } catch { /* quota */ }
    }
    onApplySettings?.(next);
  };

  const reset = () => {
    const next = { ...DEFAULTS };
    setSettings(next);
    if (chatKey) {
      try { localStorage.setItem(chatKey, JSON.stringify(next)); } catch { /* quota */ }
    }
    onApplySettings?.(next);
  };

  const handleRemove = () => {
    onRemove?.();
    onClose();
  };

  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[var(--z-modal,1600)] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[color:var(--panel-strong)]/95 shadow-2xl backdrop-blur-2xl"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/25 to-[color:var(--accent-3)]/25 text-[color:var(--accent-3)]">
              <span className="text-sm">🎨</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Chat Wallpaper</h3>
              <p className="text-xs text-[color:var(--text-muted)]">Adjust appearance</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {current && (
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                onClick={handleRemove}
                className="flex size-8 items-center justify-center rounded-full text-rose-400/80 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                title="Remove wallpaper"
              >
                <Trash2Icon className="size-4" />
              </motion.button>
            )}
            <button
              onClick={reset}
              className="flex size-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
              title="Reset to defaults"
            >
              <RotateCcwIcon className="size-4" />
            </button>
            <button
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        </div>

        <div className="scrollbar-thin max-h-[60vh] overflow-y-auto p-4">
          {current && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5">
              {wallpaperThumbnail(current)}
              <div className="min-w-0 text-xs text-[color:var(--text-muted)]">
                <div className="font-medium text-[color:var(--text-primary)]">
                  {current.fileName || current.label || "Custom wallpaper"}
                </div>
                {isAnimatedMedia(current) && (
                  <span className="inline-block rounded-md bg-black/40 px-1.5 py-0.5 text-[10px] font-medium uppercase text-[color:var(--accent-3)]">
                    Animated
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-[color:var(--text-muted)]">Opacity</label>
                <span className="text-[10px] text-[color:var(--text-muted)]">{Math.round(settings.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.opacity}
                onChange={(e) => update("opacity", parseFloat(e.target.value))}
                className="w-full accent-[color:var(--accent-3)]"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-[color:var(--text-muted)]">Blur</label>
                <span className="text-[10px] text-[color:var(--text-muted)]">{settings.blur}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="1"
                value={settings.blur}
                onChange={(e) => update("blur", parseInt(e.target.value, 10))}
                className="w-full accent-[color:var(--accent-3)]"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-[color:var(--text-muted)]">Overlay</label>
                <span className="text-[10px] text-[color:var(--text-muted)]">{Math.round(settings.overlay * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={settings.overlay}
                onChange={(e) => update("overlay", parseFloat(e.target.value))}
                className="w-full accent-[color:var(--accent-3)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[color:var(--text-muted)]">Position</label>
                <CustomSelect
                  value={settings.position}
                  options={POSITION_OPTIONS}
                  onChange={(v) => update("position", v)}
                  label="Position"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[color:var(--text-muted)]">Size</label>
                <CustomSelect
                  value={settings.size}
                  options={SIZE_OPTIONS}
                  onChange={(v) => update("size", v)}
                  label="Size"
                />
              </div>
            </div>

            {typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches && (
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-2.5 text-[10px] text-amber-300">
                Reduced motion is enabled: animated wallpapers will stay still.
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {content}
    </AnimatePresence>,
    document.body
  );
}

function isAnimatedMedia(choice) {
  return (
    choice?.type === "animated-image" ||
    choice?.type === "video" ||
    choice?.type === "animated-gradient"
  );
}

export default WallpaperSettings;
