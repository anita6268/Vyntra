import { AnimatePresence, motion } from "framer-motion";
import {
  XIcon,
  RotateCcwIcon,
  FlipHorizontal,
  FlipVertical,
  ZoomInIcon,
  ZoomOutIcon,
  CheckIcon,
  Loader2Icon,
  CropIcon,
  MoveIcon,
  MaximizeIcon,
  Undo2Icon,
  ImageIcon,
  AlertCircleIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;
const OUTPUT_SIZE = 1024;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getNormalizedRotation(rotation) {
  return ((rotation % 360) + 360) % 360;
}

function getFitScale(img, viewportSize, rotation = 0) {
  if (!img?.naturalWidth || !img?.naturalHeight || !viewportSize) return 1;
  const normalizedRotation = getNormalizedRotation(rotation);
  const isRotated = normalizedRotation % 180 === 90;
  const visibleWidth = isRotated ? img.naturalHeight : img.naturalWidth;
  const visibleHeight = isRotated ? img.naturalWidth : img.naturalHeight;
  return Math.max(viewportSize / visibleWidth, viewportSize / visibleHeight);
}

function drawCropGuide(ctx, size, lineWidth = 1, color = "rgba(6, 182, 212, 0.6)") {
  const step = size / 3;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (let i = 1; i < 3; i++) {
    const pos = i * step;
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, size);
    ctx.moveTo(0, pos);
    ctx.lineTo(size, pos);
  }
  ctx.stroke();
}

function ProfilePhotoEditor({
  isOpen,
  onClose,
  imageSrc,
  onSave,
  uploading = false,
}) {
  const [baseFitScale, setBaseFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [flip, setFlip] = useState({ x: 1, y: 1 });
  const [interactionMode, setInteractionMode] = useState("move");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [containerSize, setContainerSize] = useState(420);
  const [dragStart, setDragStart] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const imageRef = useRef(null);
  const loadTokenRef = useRef(0);
  const interactionModeRef = useRef("move");
  const rotationRef = useRef(0);
  const baseFitScaleRef = useRef(1);
  const positionRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const flipRef = useRef({ x: 1, y: 1 });

  interactionModeRef.current = interactionMode;
  rotationRef.current = rotation;
  baseFitScaleRef.current = baseFitScale;
  positionRef.current = position;
  zoomRef.current = zoom;
  flipRef.current = flip;

  const resetTransform = useCallback(() => {
    setZoom(baseFitScale);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
    setFlip({ x: 1, y: 1 });
    setInteractionMode("move");
  }, [baseFitScale]);

  const handleImageLoad = useCallback(() => {
    const img = imageRef.current;
    if (!img || !containerRef.current) return;
    const fitScale = getFitScale(img, containerSize, rotation);
    setBaseFitScale(fitScale);
    setZoom(fitScale);
    setPosition({ x: 0, y: 0 });
    setImageLoaded(true);
    setError(null);
  }, [containerSize, rotation]);

  const handleImageError = useCallback(() => {
    setError("Failed to load image. Please try a different file.");
    setImageLoaded(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadTokenRef.current += 1;
    setImageLoaded(false);
    setError(null);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
    setFlip({ x: 1, y: 1 });
    setInteractionMode("move");
    // Clear the ref so the next image load effect starts fresh.
    imageRef.current = null;
  }, [isOpen, imageSrc]);

  useEffect(() => {
    if (!imageSrc) return;
    const token = ++loadTokenRef.current;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (loadTokenRef.current !== token) return;
      imageRef.current = img;
      handleImageLoad();
    };
    img.onerror = handleImageError;
    img.src = imageSrc;
    return () => {
      loadTokenRef.current = token + 1;
    };
  }, [imageSrc, handleImageLoad, handleImageError]);

  useEffect(() => {
    if (!canvasRef.current || !imageRef.current?.naturalWidth) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = imageRef.current;
    const dpr = window.devicePixelRatio || 1;
    const size = containerSize * dpr;
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = `${containerSize}px`;
    canvas.style.height = `${containerSize}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, containerSize, containerSize);
    ctx.save();
    ctx.translate(containerSize / 2, containerSize / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flip.x, flip.y);
    const scale = zoom * baseFitScale;
    const drawWidth = img.naturalWidth * scale;
    const drawHeight = img.naturalHeight * scale;
    ctx.drawImage(
      img,
      -drawWidth / 2 + position.x,
      -drawHeight / 2 + position.y,
      drawWidth,
      drawHeight
    );
    ctx.restore();
    if (interactionMode === "crop") {
      drawCropGuide(ctx, containerSize);
    }
  }, [containerSize, rotation, flip, zoom, position, interactionMode, baseFitScale]);

  useEffect(() => {
    if (!previewCanvasRef.current || !imageRef.current?.naturalWidth) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = imageRef.current;
    const previewSize = 80;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = previewSize * dpr;
    canvas.height = previewSize * dpr;
    canvas.style.width = `${previewSize}px`;
    canvas.style.height = `${previewSize}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, previewSize, previewSize);
    ctx.save();
    ctx.translate(previewSize / 2, previewSize / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flip.x, flip.y);
    const scale = zoom * baseFitScale;
    const drawWidth = img.naturalWidth * scale;
    const drawHeight = img.naturalHeight * scale;
    const maxDim = Math.max(drawWidth, drawHeight);
    const fitScale = (previewSize * 0.9) / maxDim;
    ctx.drawImage(
      img,
      (-drawWidth / 2 + position.x) * fitScale,
      (-drawHeight / 2 + position.y) * fitScale,
      drawWidth * fitScale,
      drawHeight * fitScale
    );
    ctx.restore();
    ctx.beginPath();
    ctx.arc(previewSize / 2, previewSize / 2, previewSize / 2 - 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(6, 182, 212, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [rotation, flip, zoom, position, baseFitScale]);

  const handleMouseDown = useCallback((e) => {
    if (interactionMode !== "move" && interactionMode !== "crop") return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    e.preventDefault();
  }, [interactionMode, position]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !dragStart) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    const maxOffset = (containerSize / 2) * zoom * baseFitScale;
    setPosition({
      x: clamp(newX, -maxOffset, maxOffset),
      y: clamp(newY, -maxOffset, maxOffset),
    });
  }, [isDragging, dragStart, containerSize, zoom, baseFitScale]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((prev) => clamp(prev + delta, MIN_ZOOM, MAX_ZOOM));
  }, []);

  const handleZoomChange = useCallback((e) => {
    const value = parseFloat(e.target.value);
    setZoom(clamp(value, MIN_ZOOM, MAX_ZOOM));
  }, []);

  const handleRotateLeft = useCallback(() => {
    setRotation((prev) => getNormalizedRotation(prev - 90));
  }, []);

  const handleRotateRight = useCallback(() => {
    setRotation((prev) => getNormalizedRotation(prev + 90));
  }, []);

  const handleFlipHorizontal = useCallback(() => {
    setFlip((prev) => ({ ...prev, x: prev.x * -1 }));
  }, []);

  const handleFlipVertical = useCallback(() => {
    setFlip((prev) => ({ ...prev, y: prev.y * -1 }));
  }, []);

  const handleFit = useCallback(() => {
    setZoom(baseFitScale);
    setPosition({ x: 0, y: 0 });
  }, [baseFitScale]);

  const handleExport = useCallback(async () => {
    if (!imageRef.current?.naturalWidth || !onSave) return;
    setIsExporting(true);
    try {
      const img = imageRef.current;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const scale = zoom * baseFitScale;
      const drawWidth = img.naturalWidth * scale;
      const drawHeight = img.naturalHeight * scale;
      ctx.translate(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flip.x, flip.y);
      ctx.drawImage(
        img,
        -drawWidth / 2 + position.x * (OUTPUT_SIZE / containerSize),
        -drawHeight / 2 + position.y * (OUTPUT_SIZE / containerSize),
        drawWidth * (OUTPUT_SIZE / containerSize),
        drawHeight * (OUTPUT_SIZE / containerSize)
      );
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // Convert the Blob to a base64 data URL before passing to onSave.
            // The backend's uploadProfilePic() expects a data URL string, not a
            // Blob object. If a Blob is sent directly, axios JSON.stringifys it
            // to {} and the backend cannot parse it, causing a 500 timeout.
            const reader = new FileReader();
            reader.onloadend = () => {
              onSave(reader.result);
            };
            reader.onerror = () => {
              console.error("Failed to convert blob to data URL");
              setError("Failed to export image. Please try again.");
              setIsExporting(false);
            };
            reader.readAsDataURL(blob);
          } else {
            setIsExporting(false);
          }
        },
        "image/jpeg",
        0.9
      );
    } catch (err) {
      console.error("Export failed:", err);
      setError("Failed to export image. Please try again.");
      setIsExporting(false);
    }
  }, [zoom, baseFitScale, rotation, flip, position, containerSize, onSave]);

  const handleKeyDown = useCallback((e) => {
    if (!isOpen) return;
    switch (e.key) {
      case "Escape":
        onClose();
        break;
      case "ArrowLeft":
        if (e.ctrlKey || e.metaKey) handleRotateLeft();
        break;
      case "ArrowRight":
        if (e.ctrlKey || e.metaKey) handleRotateRight();
        break;
      case "=":
      case "+":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setZoom((prev) => clamp(prev + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM));
        }
        break;
      case "-":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          setZoom((prev) => clamp(prev - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM));
        }
        break;
      case "0":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleFit();
        }
        break;
      case "r":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          resetTransform();
        }
        break;
      default:
        break;
    }
  }, [isOpen, onClose, handleRotateLeft, handleRotateRight, handleFit, resetTransform]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (containerRef.current) {
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setContainerSize(Math.min(entry.contentRect.width, entry.contentRect.height));
        }
      });
      ro.observe(containerRef.current);
      return () => ro.disconnect();
    }
  }, []);

  // Wheel must use a native listener with passive: false because handleWheel
  // calls e.preventDefault() to suppress page scroll. React's onWheel is
  // passive by default (React 17+) and would throw "Unable to preventDefault
  // inside passive event listener invocation."
  useEffect(() => {
    if (containerRef.current) {
      const el = containerRef.current;
      el.addEventListener("wheel", handleWheel, { passive: false });
      return () => el.removeEventListener("wheel", handleWheel, { passive: false });
    }
  }, [handleWheel]);

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[var(--z-backdrop)] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Profile photo editor"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div className="relative rounded-3xl overflow-hidden glass-panel" style={{ background: "var(--panel-strong)" }}>
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">Edit Profile Photo</h2>
                <div className="flex items-center gap-2">
                  <motion.span
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                      interactionMode === "crop"
                        ? "bg-[color:var(--accent-3)]/20 text-[color:var(--accent-3)] border border-[color:var(--accent-3)]/30"
                        : "bg-white/10 text-[color:var(--text-muted)] border border-white/10"
                    }`}
                  >
                    <span className="uppercase tracking-wide">{interactionMode}</span>
                  </motion.span>
                  <button
                    onClick={onClose}
                    className="icon-btn"
                    aria-label="Close editor"
                    disabled={uploading || isExporting}
                  >
                    <XIcon size={18} />
                  </button>
                </div>
              </div>

              <div className="relative p-4" ref={containerRef}>
                <canvas
                  ref={canvasRef}
                  className="w-full h-full block cursor-grab active:cursor-grabbing"
                  style={{ touchAction: "none" }}
                  aria-hidden="true"
                />
                <div
                  className="absolute inset-0 pointer-events-none"
                  aria-hidden="true"
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="rounded-full border-2 border-[color:var(--accent-3)]/50"
                      style={{
                        width: containerSize,
                        height: containerSize,
                        boxShadow: "0 0 0 9999px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.1), 0 0 30px var(--glow)",
                      }}
                    />
                  </div>
                </div>
                {!imageLoaded && !error && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex items-center justify-center bg-[color:var(--panel-strong)]/90 backdrop-blur-sm"
                  >
                    <Loader2Icon size={32} className="text-[color:var(--accent-3)] animate-spin" />
                  </motion.div>
                )}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute inset-0 flex items-center justify-center bg-[color:var(--panel-strong)]/90 backdrop-blur-sm p-6 text-center"
                  >
                    <div className="max-w-xs">
                      <AlertCircleIcon size={48} className="mx-auto mb-3 text-[color:var(--accent)]" />
                      <p className="text-[color:var(--text-primary)] mb-2">{error}</p>
                      <button
                        onClick={() => imageRef.current && handleImageLoad()}
                        className="px-4 py-2 rounded-xl bg-[color:var(--accent)]/20 text-[color:var(--accent)] font-medium hover:bg-[color:var(--accent)]/30 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="p-4 space-y-4 border-t border-white/10">
                <div className="flex items-center justify-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRotateLeft}
                    className={`icon-btn ${interactionMode === "crop" ? "opacity-50 pointer-events-none" : ""}`}
                    aria-label="Rotate left"
                    disabled={interactionMode === "crop" || uploading || isExporting}
                  >
                    <RotateCcwIcon size={18} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleRotateRight}
                    className={`icon-btn ${interactionMode === "crop" ? "opacity-50 pointer-events-none" : ""}`}
                    aria-label="Rotate right"
                    disabled={interactionMode === "crop" || uploading || isExporting}
                  >
                    <RotateCcwIcon size={18} style={{ transform: "rotate(180deg)" }} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleFlipHorizontal}
                    className={`icon-btn ${interactionMode === "crop" ? "opacity-50 pointer-events-none" : ""}`}
                    aria-label="Flip horizontal"
                    disabled={interactionMode === "crop" || uploading || isExporting}
                  >
                    <FlipHorizontal size={18} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleFlipVertical}
                    className={`icon-btn ${interactionMode === "crop" ? "opacity-50 pointer-events-none" : ""}`}
                    aria-label="Flip vertical"
                    disabled={interactionMode === "crop" || uploading || isExporting}
                  >
                    <FlipVertical size={18} />
                  </motion.button>
                </div>

                <div className="flex items-center gap-3 px-2">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setZoom((prev) => clamp(prev - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
                    className="icon-btn"
                    aria-label="Zoom out"
                    disabled={uploading || isExporting}
                  >
                    <ZoomOutIcon size={18} />
                  </motion.button>
                  <input
                    type="range"
                    min={MIN_ZOOM}
                    max={MAX_ZOOM}
                    step={ZOOM_STEP}
                    value={zoom}
                    onChange={handleZoomChange}
                    className="flex-1 h-2 appearance-none cursor-pointer rounded-full bg-white/10 accent-[color:var(--accent-3)]"
                    aria-label="Zoom level"
                    disabled={uploading || isExporting}
                  />
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setZoom((prev) => clamp(prev + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
                    className="icon-btn"
                    aria-label="Zoom in"
                    disabled={uploading || isExporting}
                  >
                    <ZoomInIcon size={18} />
                  </motion.button>
                </div>

                <div className="flex items-center justify-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setInteractionMode("crop")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      interactionMode === "crop"
                        ? "bg-[color:var(--accent-3)]/20 text-[color:var(--accent-3)] border border-[color:var(--accent-3)]/30"
                        : "bg-white/5 text-[color:var(--text-muted)] border border-white/10 hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                    }`}
                    aria-label="Crop mode"
                    aria-pressed={interactionMode === "crop"}
                    disabled={uploading || isExporting}
                  >
                    <CropIcon size={16} />
                    <span>Crop</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setInteractionMode("move")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      interactionMode === "move"
                        ? "bg-[color:var(--accent)]/20 text-[color:var(--accent)] border border-[color:var(--accent)]/30"
                        : "bg-white/5 text-[color:var(--text-muted)] border border-white/10 hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                    }`}
                    aria-label="Move mode"
                    aria-pressed={interactionMode === "move"}
                    disabled={uploading || isExporting}
                  >
                    <MoveIcon size={16} />
                    <span>Move</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleFit}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-[color:var(--text-muted)] border border-white/10 hover:bg-white/10 hover:text-[color:var(--text-primary)] transition-all"
                    aria-label="Fit to frame"
                    disabled={uploading || isExporting}
                  >
                    <MaximizeIcon size={16} />
                    <span>Fit</span>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={resetTransform}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-[color:var(--text-muted)] border border-white/10 hover:bg-white/10 hover:text-[color:var(--text-primary)] transition-all"
                    aria-label="Reset all changes"
                    disabled={uploading || isExporting}
                  >
                    <Undo2Icon size={16} />
                    <span>Reset</span>
                  </motion.button>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-[color:var(--text-muted)]">Preview</span>
                    <canvas
                      ref={previewCanvasRef}
                      width={80}
                      height={80}
                      className="rounded-full border border-white/10"
                      aria-hidden="true"
                    />
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleExport}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-[color:var(--accent)] via-[color:var(--accent-2)] to-[color:var(--accent-3)] shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Save changes"
                    disabled={uploading || isExporting || !imageLoaded}
                  >
                    {isExporting ? (
                      <>
                        <Loader2Icon size={18} className="animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : uploading ? (
                      <>
                        <Loader2Icon size={18} className="animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <CheckIcon size={18} />
                        <span>Save</span>
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof window === "undefined") return null;

  return createPortal(modalContent, document.body);
}

export default ProfilePhotoEditor;