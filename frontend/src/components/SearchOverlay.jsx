import { useEffect, useRef, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { SearchIcon, XIcon, ClockIcon, ArrowUpIcon, ArrowDownIcon, Loader2Icon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

const RECENT_KEY = "vyntra-recent-searches";
const MAX_RECENT = 8;

function HighlightText({ text, query }) {
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded bg-[color:var(--accent-3)]/30 px-0.5 text-[color:var(--text-primary)]">{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function useRecentSearches() {
  const [recent, setRecent] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
    } catch {
      return [];
    }
  });

  const addRecent = (term) => {
    const cleaned = term.trim();
    if (!cleaned) return;
    setRecent((prev) => {
      const next = [cleaned, ...prev.filter((r) => r !== cleaned)].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const clearRecent = () => {
    setRecent([]);
    localStorage.removeItem(RECENT_KEY);
  };

  return { recent, addRecent, clearRecent };
}

function isPhoneLike(input) {
  if (!input || typeof input !== "string") return false;
  // Email addresses contain @ — guard against treating them as phone numbers.
  if (input.includes("@")) return false;
  const digits = input.replace(/[^\d]/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function SearchOverlay({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const { recent, addRecent, clearRecent } = useRecentSearches();
  const { chats, isUsersLoading, getMyChatPartners, lookupContactByPhone, setSelectedUser, setActiveTab } = useChatStore();

  const q = query.trim();

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(-1);
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    if (q) {
      getMyChatPartners();
    }
  }, [q, isOpen, getMyChatPartners]);

  const [phoneResults, setPhoneResults] = useState([]);

  useEffect(() => {
    if (!q) {
      setPhoneResults([]);
      return;
    }
    if (isPhoneLike(q)) {
      let cancelled = false;
      setPhoneResults([]);
      lookupContactByPhone(q).then((users) => {
        if (!cancelled) {
          setPhoneResults(Array.isArray(users) ? users : users ? [users] : []);
        }
      });
      return () => {
        cancelled = true;
      };
    } else {
      setPhoneResults([]);
    }
  }, [q, lookupContactByPhone]);

  const chatResults = useMemo(() => {
    if (!q) return [];
    return chats
      .filter((c) => c.fullName?.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 8);
  }, [chats, q]);

  const allResults = useMemo(() => {
    const results = [...chatResults];
    phoneResults.forEach((phoneUser) => {
      if (!chatResults.some((c) => String(c._id) === String(phoneUser._id))) {
        results.push(phoneUser);
      }
    });
    return results;
  }, [chatResults, phoneResults]);

  const handleSelect = (user) => {
    addRecent(q);
    setSelectedUser(user);
    setActiveTab("chats");
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < allResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < allResults.length) {
        handleSelect(allResults[selectedIndex]);
      }
    }
  };

  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("[data-search-item]");
      items[selectedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const showLoading = q && isUsersLoading && allResults.length === 0;
  const showEmpty = q && !isUsersLoading && allResults.length === 0;
  const showRecent = !q && recent.length > 0;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[var(--z-modal,1600)] flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[10vh] sm:pt-[15vh]"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--panel-strong)]/95 shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-4">
              <SearchIcon className="size-5 shrink-0 text-[color:var(--text-muted)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search chats, people…"
                className="w-full bg-transparent text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
                autoFocus
              />
              {query && (
                <button
                  onClick={() => { setQuery(""); setSelectedIndex(-1); }}
                  className="flex shrink-0 items-center justify-center rounded-full p-0.5 text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                >
                  <XIcon className="size-4" />
                </button>
              )}
              <kbd className="hidden shrink-0 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--text-muted)] sm:block">
                ESC
              </kbd>
            </div>

            <div ref={listRef} className="scrollbar-thin max-h-[50vh] overflow-y-auto p-2">
              {showLoading && (
                <div className="flex items-center justify-center gap-2 py-10 text-xs text-[color:var(--text-muted)]">
                  <Loader2Icon className="size-4 animate-spin text-[color:var(--accent-3)]" />
                  Searching…
                </div>
              )}

              {showEmpty && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <SearchIcon className="mb-2 size-8 text-[color:var(--text-muted)]/50" />
                  <p className="text-sm text-[color:var(--text-muted)]">No results for "{query}"</p>
                </div>
              )}

              {showRecent && (
                <div className="mb-2">
                  <div className="mb-2 flex items-center justify-between px-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">Recent</span>
                    <button
                      onClick={clearRecent}
                      className="text-[10px] font-medium text-[color:var(--accent-3)] transition hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                   <div className="space-y-0.5">
                      {recent.map((r, i) => (
                        <button
                          key={`recent-${i}-${r.slice(0, 24)}`}
                          data-search-item
                          onClick={() => { setQuery(r); setSelectedIndex(-1); }}
                          className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                            selectedIndex === i ? "bg-white/10 text-[color:var(--text-primary)]" : "text-[color:var(--text-muted)] hover:bg-white/5"
                          }`}
                        >
                         <ClockIcon className="size-3.5 shrink-0" />
                         <span className="truncate">{r}</span>
                       </button>
                      ))}
                    </div>
                </div>
              )}

              {allResults.length > 0 && (
                <div className="space-y-0.5">
                  {chatResults.length > 0 && (
                    <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">Chats</div>
                  )}
                  {chatResults.map((chat, i) => (
                    <button
                      key={`chat-${chat._id}`}
                      data-search-item
                      onClick={() => handleSelect(chat)}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        selectedIndex === i ? "bg-white/10 text-[color:var(--text-primary)]" : "text-[color:var(--text-muted)] hover:bg-white/5"
                      }`}
                    >
                      <img src={chat.profilePic || "/avatar.png"} alt={chat.fullName} className="size-8 rounded-full object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium"><HighlightText text={chat.fullName} query={q} /></p>
                        <p className="truncate text-[11px] opacity-70">
                          {chat.lastMessage ? (chat.lastMessage.text || "Media") : "No messages yet"}
                        </p>
                      </div>
                    </button>
                  ))}

                  {phoneResults.length > 0 && (
                    <div className="mb-1 mt-3 px-2 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">People</div>
                  )}
                  {phoneResults.map((phoneResult, idx) => {
                    const resultIndex = chatResults.length + idx;
                    return (
                      <button
                        key={`contact-${phoneResult._id}`}
                        data-search-item
                        onClick={() => handleSelect(phoneResult)}
                        onMouseEnter={() => setSelectedIndex(resultIndex)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                          selectedIndex === resultIndex ? "bg-white/10 text-[color:var(--text-primary)]" : "text-[color:var(--text-muted)] hover:bg-white/5"
                        }`}
                      >
                        <img src={phoneResult.profilePic || "/avatar.png"} alt={phoneResult.fullName} className="size-8 rounded-full object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium"><HighlightText text={phoneResult.fullName} query={q} /></p>
                          <p className="truncate text-[11px] opacity-70">On Vyntra</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {!showLoading && !showEmpty && !showRecent && allResults.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <SearchIcon className="mb-2 size-8 text-[color:var(--text-muted)]/50" />
                  <p className="text-sm text-[color:var(--text-muted)]">Type to search chats and people</p>
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center justify-between border-t border-white/10 px-4 py-2.5 text-[10px] text-[color:var(--text-muted)]">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><ArrowUpIcon className="size-3" /> <ArrowDownIcon className="size-3" /> to navigate</span>
                <span className="flex items-center gap-1"><span className="rounded border border-white/10 bg-white/5 px-1 py-0.5">Enter</span> to select</span>
              </div>
              <span>{allResults.length} result{allResults.length === 1 ? "" : "s"}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default SearchOverlay;

