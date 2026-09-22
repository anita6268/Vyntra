import { motion } from "framer-motion";
import { ImageIcon, LinkIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";

const FILTERS = [
  { key: "all", label: "All", icon: ImageIcon },
  { key: "photos", label: "Photos", icon: ImageIcon },
  { key: "links", label: "Links", icon: LinkIcon },
];

function SharedPhotosPanel({ messages, isLoading, error, onRetry }) {
  const [filter, setFilter] = useState("all");
  const photos = (messages || []).filter((m) => m.image);
  const links = (messages || []).filter((m) => m.text && /https?:\/\//.test(m.text));

  let items = [];
  if (filter === "photos") items = photos;
  else if (filter === "links") items = links;
  else items = [...photos, ...links];

  const hasMedia = photos.length > 0 || links.length > 0;

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <ImageIcon className="size-5 animate-pulse text-[color:var(--accent-3)]" />
        </div>
        <p className="text-xs text-[color:var(--text-muted)]">Loading media…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <ImageIcon className="size-5 text-rose-400" />
        </div>
        <p className="text-xs text-[color:var(--text-primary)]">Failed to load media</p>
        <p className="max-w-[200px] text-[10px] text-[color:var(--text-muted)]">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          disabled={isLoading}
          className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-[color:var(--accent-3)]/40 bg-[color:var(--accent-3)]/15 px-3 py-1.5 text-[11px] font-medium text-[color:var(--accent-3)] transition hover:bg-[color:var(--accent-3)]/25 disabled:opacity-50"
        >
          <RefreshCwIcon className="size-3.5" />
          Retry
        </button>
      </div>
    );
  }

  if (!hasMedia) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <ImageIcon className="size-7 text-[color:var(--text-muted)]" />
        </div>
        <p className="text-sm font-medium text-[color:var(--text-primary)]">No shared media</p>
        <p className="max-w-xs text-xs text-[color:var(--text-muted)]">
          Photos and links shared in this conversation will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* Filter chips */}
      <div className="mb-3 flex items-center gap-1.5">
        {FILTERS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all ${
              filter === key
                ? "border-[color:var(--accent-3)]/50 bg-[color:var(--accent-3)]/15 text-[color:var(--text-primary)]"
                : "border-white/10 bg-white/5 text-[color:var(--text-muted)] hover:bg-white/10"
            }`}
          >
            <Icon className="size-3" />
            {label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-[color:var(--text-muted)]">{items.length} items</span>
      </div>

      {items.length === 0 ? (
        <p className="py-8 text-center text-xs text-[color:var(--text-muted)]">Nothing here yet.</p>
      ) : (
        <>
            {items.filter((item) => item.image).length > 0 && (
            <div className="columns-2 gap-2 sm:columns-3">
              {items
                .filter((item) => item.image)
                .map((photo, i) => (
                  <motion.div
                    key={photo._id || i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.03 }}
                    whileHover={{ scale: 1.03 }}
                    className="mb-2 break-inside-avoid overflow-hidden rounded-xl border border-white/10 transition-all duration-200 hover:border-white/25 hover:shadow-lg"
                  >
                    <div className="relative aspect-square overflow-hidden bg-white/5">
                      <img src={photo.image} alt="Shared" className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" loading="lazy" />
                    </div>
                  </motion.div>
                ))}
            </div>
          )}
          {items.filter((item) => !item.image).length > 0 && (
            <div className="space-y-2 mt-4">
              {items
                .filter((item) => !item.image)
                .map((m, i) => (
                  <motion.a
                    key={m._id || i}
                     href={/(https?:\/\/[^\s]+)/.test(m.text) ? m.text.match(/(https?:\/\/[^\s]+)/)[0] : "#"}
                     target="_blank"
                     rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[color:var(--accent-3)]/15 text-[color:var(--accent-3)]">
                      <LinkIcon className="size-4" />
                    </div>
                    <span className="truncate text-xs text-[color:var(--text-primary)]">{m.text}</span>
                  </motion.a>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SharedPhotosPanel;
