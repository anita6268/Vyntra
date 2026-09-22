import { forwardRef } from "react";
import { SearchIcon, XIcon } from "lucide-react";
import { motion } from "framer-motion";

const IS_MAC =
  typeof navigator !== "undefined" &&
  (/Mac|iP(hone|ad|od)/i.test(navigator.platform || "") ||
    (typeof navigator.userAgent === "string" &&
      /Mac/i.test(navigator.userAgent) &&
      !/Windows/i.test(navigator.userAgent)));

const SearchBar = forwardRef(function SearchBar({ value, onChange, onClear, placeholder = "Search chats, people…" }, ref) {
  return (
    <div className="sidebar-section pt-1">
      <motion.div
        whileFocus={{ scale: 1.01 }}
        onClick={() => ref?.current?.focus()}
        className="group flex cursor-text items-center gap-2 rounded-xl border border-white/[0.08] bg-[color:var(--panel-strong)]/60 px-3 py-1.5 backdrop-blur-xl transition-all duration-300 focus-within:border-[color:var(--accent-3)]/50 focus-within:bg-white/[0.06] focus-within:shadow-[0_0_0_2px_rgba(6,182,212,0.1)]"
      >
        <SearchIcon className="size-4 shrink-0 text-[color:var(--text-muted)] transition-colors group-focus-within:text-[color:var(--accent-3)]" />
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              if (value) onClear();
              ref?.current?.blur();
            }
          }}
          className="w-full bg-transparent text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]/70"
          placeholder={placeholder}
          aria-label="Global search"
        />
        {value ? (
          <button
            type="button"
            onClick={onClear}
            className="flex shrink-0 items-center justify-center rounded-full p-0.5 text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
            aria-label="Clear search"
          >
            <XIcon className="size-3.5" />
          </button>
        ) : (
          <kbd className="shrink-0 rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--text-muted)]/80 lg:block">
            {IS_MAC ? "⌘ K" : "Ctrl K"}
          </kbd>
        )}
      </motion.div>
    </div>
  );
});

export default SearchBar;
