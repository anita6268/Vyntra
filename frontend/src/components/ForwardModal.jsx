import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { SearchIcon, XIcon, CheckIcon, ForwardIcon } from "lucide-react";
import toast from "react-hot-toast";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";

/**
 * WhatsApp-style Forward modal.
 * - Shows ALL contacts (including the currently open chat).
 * - Searchable, multi-select with checkmarks, select-all, count.
 * - "Forward (n)" button sends the message to each selected contact separately.
 */
function ForwardModal({ isOpen, onClose, message, excludeUserId }) {
  const { allContacts, getAllContacts, isUsersLoading, forwardMessage } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [isForwarding, setIsForwarding] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIds([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !search.trim()) return;
    const t = setTimeout(() => getAllContacts(search), 250);
    return () => clearTimeout(t);
  }, [isOpen, search, getAllContacts]);

  const filtered = useMemo(() => {
    const list = Array.isArray(allContacts) ? allContacts : [];
    const base = excludeUserId ? list.filter((c) => String(c._id) !== String(excludeUserId)) : list;
    if (!search.trim()) return base;
    const q = search.trim().toLowerCase();
    return base.filter((c) => c.fullName?.toLowerCase().includes(q));
  }, [allContacts, search, excludeUserId]);

  const toggle = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allVisibleSelected = filtered.length > 0 && filtered.every((c) => selectedIds.includes(c._id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !filtered.some((c) => c._id === id)));
    } else {
      setSelectedIds((prev) => {
        const combined = new Set(prev);
        filtered.forEach((c) => combined.add(c._id));
        return [...combined];
      });
    }
  };

  const handleForward = async () => {
    if (!message || selectedIds.length === 0 || isForwarding) return;
    setIsForwarding(true);
    try {
      await forwardMessage({ messageId: message._id, receiverIds: selectedIds });
      toast.success("Message forwarded successfully.");
      onClose();
    } catch {
      // forwardMessage already shows the real backend error via toast.
    } finally {
      setIsForwarding(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="forward-message-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[var(--z-popover,1700)] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
        >
            <motion.div
              initial={{ y: 60, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="flex h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[color:var(--panel-strong)]/95 shadow-2xl backdrop-blur-2xl sm:h-[70vh] sm:rounded-[28px]"
            >
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/25 to-[color:var(--accent-3)]/25 text-[color:var(--accent-3)]">
                    <ForwardIcon className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Forward Message</h3>
                    <p className="text-xs text-[color:var(--text-muted)]">
                      {selectedIds.length > 0 ? `${selectedIds.length} selected` : "Select contacts"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="flex size-8 items-center justify-center rounded-full text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                  title="Close"
                >
                  <XIcon className="size-4" />
                </button>
              </div>

              {/* Preview of the message being forwarded */}
              {message && (
                <div className="shrink-0 border-b border-white/10 px-4 py-3">
                  <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                    {message.image ? (
                      <img src={message.image} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[color:var(--accent-3)]/15 text-[color:var(--accent-3)]">
                        <ForwardIcon className="size-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-[color:var(--accent-3)]">
                        {message.forwarded ? "Forwarded message" : "Message"}
                      </p>
                      <p className="truncate text-sm text-[color:var(--text-primary)]">
                        {message.text || (message.image ? "📷 Photo" : "")}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Search */}
              <div className="shrink-0 px-4 py-3">
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                  <SearchIcon className="size-4 shrink-0 text-[color:var(--text-muted)]" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search contacts…"
                    className="w-full bg-transparent text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <button
                    onClick={toggleSelectAll}
                    className="text-xs font-medium text-[color:var(--accent-3)] transition hover:underline"
                  >
                    {allVisibleSelected ? "Deselect all" : "Select All"}
                  </button>
                  <span className="text-[11px] text-[color:var(--text-muted)]">{filtered.length} contacts</span>
                </div>
              </div>

              {/* Contact list */}
               <div className="scrollbar-thin flex-1 overflow-y-auto px-2 py-1">
                 {isUsersLoading ? (
                   <div className="flex items-center justify-center py-10 text-sm text-[color:var(--text-muted)]">
                     Loading contacts…
                   </div>
                 ) : filtered.length === 0 ? (
                   <div className="flex flex-col items-center justify-center py-10 text-center">
                     <SearchIcon className="mb-2 size-8 text-[color:var(--text-muted)]/50" />
                     <p className="text-sm text-[color:var(--text-muted)]">
                       {search.trim() ? `No contacts match "${search}"` : "Type a name or phone number to search."}
                     </p>
                   </div>
                 ) : (
                  filtered.map((contact) => {
                     const isOnline = onlineUsers.includes(String(contact._id));
                    const isSelected = selectedIds.includes(contact._id);
                    return (
                      <button
                        key={contact._id}
                        type="button"
                        onClick={() => toggle(contact._id)}
                        className={`mb-1 flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                          isSelected
                            ? "border-[color:var(--accent-3)]/50 bg-[color:var(--accent-3)]/10"
                            : "border-transparent hover:bg-white/5"
                        }`}
                      >
                        <div className="relative shrink-0">
                          <div className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] p-[2px]">
                            <img
                              src={contact.profilePic || "/avatar.png"}
                              alt={contact.fullName}
                              className="size-full rounded-full object-cover"
                            />
                          </div>
                          {isOnline && (
                            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[color:var(--panel)] bg-emerald-400" />
                          )}
                        </div>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[color:var(--text-primary)]">
                          {contact.fullName}
                        </span>
                        <span
                          className={`flex size-6 shrink-0 items-center justify-center rounded-full border transition-all ${
                            isSelected
                              ? "border-[color:var(--accent-3)] bg-[color:var(--accent-3)] text-white"
                              : "border-white/20 text-transparent"
                          }`}
                        >
                          <CheckIcon className="size-4" />
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="flex shrink-0 items-center gap-2 border-t border-white/10 px-4 py-4">
                <button
                  onClick={onClose}
                  className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-[color:var(--text-muted)] transition hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleForward}
                  disabled={selectedIds.length === 0 || isForwarding}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--accent)] via-[color:var(--accent-2)] to-[color:var(--accent-3)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_var(--glow)] transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ForwardIcon className="size-4" />
                  {isForwarding ? "Forwarding…" : `Forward (${selectedIds.length})`}
                </button>
              </div>
            </motion.div>
        </motion.div>
        )}
    </AnimatePresence>,
    document.body
  );
}

export default ForwardModal;
