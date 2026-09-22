import { AnimatePresence, motion } from "framer-motion";
import { XIcon, ZoomInIcon, ZoomOutIcon, MaximizeIcon } from "lucide-react";
import { useEffect, useState } from "react";

function ImageViewer({ src, alt, isOpen, onClose }) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose?.();
      if (e.key === "=" || e.key === "+") setZoom((z) => Math.min(z + 0.25, 4));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.5));
      if (e.key === "0") setZoom(1);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) setZoom(1);
  }, [isOpen]);

  if (!src) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-3"
          >
            <img
              src={src}
              alt={alt || "Fullscreen preview"}
              className="max-h-[85vh] max-w-[85vw] rounded-2xl object-contain shadow-2xl"
              style={{ transform: `scale(${zoom})`, transition: "transform 0.2s ease" }}
              draggable={false}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
                className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white backdrop-blur-xl transition hover:bg-white/15"
                title="Zoom out"
              >
                <ZoomOutIcon className="size-4" />
              </button>
              <span className="text-xs font-medium text-white/70">{Math.round(zoom * 100)}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(z + 0.25, 4))}
                className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white backdrop-blur-xl transition hover:bg-white/15"
                title="Zoom in"
              >
                <ZoomInIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white backdrop-blur-xl transition hover:bg-white/15"
                title="Reset zoom"
              >
                <MaximizeIcon className="size-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="absolute -top-3 -right-3 flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white backdrop-blur-xl transition hover:bg-white/15"
              title="Close"
            >
              <XIcon className="size-4" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ImageViewer;
