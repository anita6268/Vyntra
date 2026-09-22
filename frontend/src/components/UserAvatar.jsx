import { useMemo } from "react";

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0];
  return parts[0][0] + parts[parts.length - 1][0];
}

/**
 * Premium avatar with graceful fallback.
 *
 * Render order (matches the task's expected hierarchy):
 *   1) valid Cloudinary/profilePic URL  → <img>
 *   2) user profile avatar             → <img>
 *   3) Vyntra initials fallback        → gradient circle + initials
 *
 * Never renders a broken image or a localhost placeholder: when `src` is empty
 * the component falls back to initials on a gradient ring. The online indicator
 * is drawn on top of the avatar only when `online` is true.
 */
export default function UserAvatar({
  src,
  name = "",
  size = 44,
  online = false,
  showOnline = true,
  offlineDot = true,
  glow = false,
  className = "",
  imgClassName = "",
  altName,
}) {
  const initials = useMemo(() => getInitials(name), [name]);
  const hasSrc = Boolean(src && String(src).trim() !== "");
  const sz = Number(size) || 44;

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${className}`.trim()}
      style={{ width: sz, height: sz }}
    >
      {hasSrc ? (
        <div className="relative flex size-full items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-[color:var(--accent)] via-[color:var(--accent-2)] to-[color:var(--accent-3)] p-[3px]">
          <img
            src={src}
            alt={altName || name ? `${altName || name}'s avatar` : "avatar"}
            className={`size-full rounded-full object-cover ${imgClassName}`}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      ) : (
        <div
          aria-label={initials || undefined}
          className={`flex size-full items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent)] via-[color:var(--accent-2)] to-[color:var(--accent-3)] font-black text-white`}
          style={{ fontSize: Math.round(sz * 0.42), lineHeight: 1 }}
        >
          {initials}
        </div>
      )}
      {showOnline && (
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[color:var(--panel)] ${
            online
              ? "bg-emerald-400"
              : offlineDot
              ? "bg-slate-500"
              : "bg-transparent"
          }`}
          title={online ? "Online" : "Offline"}
        />
      )}
      {glow && (
        <span className="pointer-events-none absolute -inset-0.5 rounded-full opacity-60 shadow-[0_0_18px_var(--glow)]" />
      )}
    </div>
  );
}
