/**
 * Format a backend `lastSeen` timestamp into a human-readable WhatsApp-style label.
 *
 * Returns `null` when there is no value (caller decides whether to show "Online"
 * or "Offline"). Never fabricates a timestamp — if the value is missing or
 * unparseable, the caller falls back to "Offline".
 *
 * Examples:
 *   "last seen just now"   (< 1 minute ago)
 *   "last seen 5m ago"     (< 1 hour ago)
 *   "last seen 3h ago"     (< 24 hours ago)
 *   "last seen yesterday"  (1–2 days ago)
 *   "last seen 4d ago"     (< 1 week ago)
 *   "last seen Jan 12"     (> 1 week ago)
 */
export const formatLastSeen = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const now = Date.now();
  const diffMs = now - d.getTime();

  // If the timestamp is in the future (clock skew), clamp to "just now".
  if (diffMs < 0) return "last seen just now";

  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "last seen just now";
  if (diffMin < 60) return `last seen ${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `last seen ${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "last seen yesterday";
  if (diffDay < 7) return `last seen ${diffDay}d ago`;

  return `last seen ${d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
};

/**
 * Format a timestamp into a short time string for the right gutter.
 * e.g. "10:30 AM" or "Yesterday" or "Jan 12"
 */
export const formatTimeLabel = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const now = Date.now();
  const diffMin = Math.floor((now - d.getTime()) / 60000);
  const diffDay = Math.floor(diffMin / (60 * 24));

  if (diffDay === 0) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
