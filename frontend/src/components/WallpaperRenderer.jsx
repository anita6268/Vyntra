import { useEffect, useRef, useState } from "react";

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

// Map the settings.size value (cover|contain|auto) onto an object-fit value
// for <img>/<video> media layers.
function fitFor(size) {
  if (size === "contain") return "contain";
  if (size === "auto") return "fill";
  return "cover";
}

// The animated-gradient presets are genuine CSS-animated backgrounds (continuous
// gradient motion), not a static image masquerading as animation.
const ANIMATED_GRADIENTS = {
  aurora: "wallpaper-aurora",
  "neon-flow": "wallpaper-neon-flow",
  "purple-waves": "wallpaper-purple-waves",
  cosmic: "wallpaper-cosmic",
  "ocean-motion": "wallpaper-ocean-motion",
  "crimson-flow": "wallpaper-crimson-flow",
  nebula: "wallpaper-nebula",
};

/**
 * Renders a single wallpaper media layer at z-0.
 *
 * Layering contract (do NOT change z-index):
 *   z-0  WallpaperRenderer (this component)
 *   z-1  color overlay  (rendered by the parent / ChatContainer)
 *   z-2  chat messages
 *   z-3+ ChatHeader / composer / panels
 *
 * Only the wallpaper layer receives opacity + blur filters so message bubbles,
 * the header, composer and panels stay crisp on top of a possibly-blurred
 * wallpaper.
 */
function WallpaperRenderer({ wallpaper, settings }) {
  const videoRef = useRef(null);
  const reduced = useReducedMotion();

  // Clean up the previous media when the wallpaper or conversation changes so
  // we never keep a hidden <video> playing (no memory leaks / ghost playback).
  useEffect(() => {
    return () => {
      if (videoRef.current) {
        try { videoRef.current.pause(); } catch { /* already paused/unmounted */ }
        videoRef.current = null;
      }
    };
  }, [wallpaper]);

  // Respect autoplay-restrictions + reduced motion for video.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    if (reduced) {
      try { v.pause(); } catch { /* already paused/unmounted */ }
    } else {
      v.play().catch(() => undefined);
    }
  }, [wallpaper, reduced, settings]);

  if (!wallpaper) return null;

  const opacity = settings?.opacity ?? 0.7;
  const blur = settings?.blur ? `blur(${settings.blur}px)` : "none";
  const size = settings?.size || "cover";
  const position = settings?.position || "center";

  // Solid / gradient presets (existing behaviour).
  if (wallpaper.type === "gradient" || wallpaper.type === "solid") {
    return (
      <div
        className="absolute inset-0 z-0"
        style={{
          background: wallpaper.value,
          opacity,
          filter: blur,
        }}
      />
    );
  }

  // Static image → existing background-image implementation.
  if (wallpaper.type === "image") {
    return (
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${wallpaper.value})`,
          backgroundSize: size,
          backgroundPosition: position,
          backgroundRepeat: "no-repeat",
          opacity,
          filter: blur,
        }}
      />
    );
  }

  // Animated GIF / animated WebP. Rendered as a real <img> (background-image
  // does NOT run GIF/WebP frame animation), so motion is genuine.
  if (wallpaper.type === "animated-image") {
    if (reduced) {
      // Static fallback: a GIF/WebP as CSS background only paints the first
      // frame and never animates — a honest respect for reduced motion.
      return (
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${wallpaper.value})`,
            backgroundSize: size,
            backgroundPosition: position,
            backgroundRepeat: "no-repeat",
            opacity,
            filter: blur,
          }}
        />
      );
    }
    return (
      <img
        src={wallpaper.value}
        alt=""
        loading="eager"
        className="absolute inset-0 z-0 h-full w-full"
        style={{
          objectFit: fitFor(size),
          objectPosition: position,
          opacity,
          filter: blur,
        }}
      />
    );
  }

  // Video wallpaper (MP4 / WebM) — Cloudinary-hosted URL. Behaves as a
  // background layer: covers the area, muted, looping, playsInline, behind
  // messages and pointer-events-none.
  if (wallpaper.type === "video") {
    if (reduced) {
      // Under reduced motion: show nothing moving, keep the overlay intact.
      return null;
    }
    return (
      <video
        ref={videoRef}
        src={wallpaper.value}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        className="absolute inset-0 z-0 h-full w-full object-cover"
        style={{
          objectFit: fitFor(size),
          objectPosition: position,
          opacity,
          filter: blur,
          pointerEvents: "none",
        }}
      />
    );
  }

  // Built-in animated gradient presets (genuine CSS keyframe animation).
  if (wallpaper.type === "animated-gradient") {
    const cls = ANIMATED_GRADIENTS[wallpaper.value];
    return (
      <div
        className={`absolute inset-0 z-0 ${cls || "wallpaper-aurora"}`}
        style={{
          opacity,
          filter: blur,
        }}
      />
    );
  }

  return null;
}

export default WallpaperRenderer;
