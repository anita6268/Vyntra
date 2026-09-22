import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { XIcon, UsersIcon, SearchIcon, ImageIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";

const MAX_SELECTABLE = 25; // matches the backend cap (creator + members ≤ 25)
const MIN_SELECTED = 2; // at least 2 participants selected to form a group

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function CreateGroupModal({ isOpen, onClose, onCreated }) {
  const { createGroup, isCreatingGroup, getAllContacts, allContacts, isUsersLoading } = useChatStore();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(null); // data URL
  const [selected, setSelected] = useState(() => new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setAvatar(null);
      setSelected(new Set());
      setSearchTerm("");
    }
  }, [isOpen]);

  // Debounced contact search — only fetch when user types a query.
  useEffect(() => {
    if (!isOpen) return;
    if (!searchTerm.trim()) {
      return;
    }
    const t = setTimeout(() => getAllContacts(searchTerm), 250);
    return () => clearTimeout(t);
  }, [isOpen, searchTerm, getAllContacts]);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    const dataUrl = await readAsDataURL(file);
    setAvatar(dataUrl);
  };

  const selectedList = useMemo(() => Array.from(selected), [selected]);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Group name is required.");
      return;
    }
    if (name.trim().length > 64) {
      toast.error("Group name must be 64 characters or fewer.");
      return;
    }
    if (selectedList.length < MIN_SELECTED) {
      toast.error(`Select at least ${MIN_SELECTED} participants.`);
      return;
    }
    if (selectedList.length > MAX_SELECTABLE) {
      toast.error(`You can select at most ${MAX_SELECTABLE} participants.`);
      return;
    }

    const group = await createGroup({ name: name.trim(), avatar: avatar || "", memberIds: selectedList });
    if (group) {
      onCreated?.(group);
      onClose();
    }
  };
return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed left-1/2 top-1/2 z-[95] flex max-h-[88vh] w-[min(94vw,26rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[color:var(--panel-strong)]/95 shadow-2xl backdrop-blur-2xl"
          >
            <div className="relative flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[color:var(--accent-3)]/60 to-transparent" />
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <UsersIcon className="size-4 text-[color:var(--accent-3)]" />
                </div>
                <h3 className="text-base font-bold text-[color:var(--text-primary)]">Create New Group</h3>
              </div>
              <button
                onClick={onClose}
                className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                aria-label="Close"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] p-[2px]"
                  title="Upload group photo"
                >
                  {avatar ? (
                    <img src={avatar} alt="Group" className="size-full rounded-full object-cover" />
                  ) : (
                    <ImageIcon className="size-6 text-white" />
                  )}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-[11px] font-medium text-[color:var(--text-muted)]">Group Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={64}
                    placeholder="e.g. Weekend Plans"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent-3)]/50"
                  />
                </div>
              </div>

              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">Select Participants</p>
                <span className="text-[11px] text-[color:var(--text-muted)]">
                  {selectedList.length}/{MAX_SELECTABLE} selected
                </span>
              </div>
              <div className="mb-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                <SearchIcon className="size-4 shrink-0 text-[color:var(--text-muted)]" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search contacts…"
                  className="w-full bg-transparent text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
                />
              </div>
 <div className="space-y-1.5">
                {isUsersLoading ? (
                  <p className="py-6 text-center text-sm text-[color:var(--text-muted)]">Loading contacts…</p>
                ) : allContacts.length === 0 ? (
                  <p className="py-6 text-center text-sm text-[color:var(--text-muted)]">
                    {searchTerm.trim() ? `No contacts match "${searchTerm}"` : "Type a name or phone number to search."}
                  </p>
                ) : (
                  allContacts.map((contact) => {
                    const checked = selected.has(String(contact._id));
                    return (
                      <button
                        type="button"
                        key={contact._id}
                        onClick={() => toggleSelect(String(contact._id))}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-all ${
                          checked
                            ? "border-[color:var(--accent-3)]/50 bg-[color:var(--accent-3)]/10"
                            : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                        }`}
                      >
                        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] p-[2px]">
                          <img src={contact.profilePic || "/avatar.png"} alt={contact.fullName} className="size-full rounded-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">{contact.fullName}</p>
                          <p className="truncate text-[11px] text-[color:var(--text-muted)]">{contact.email || contact.phone || ""}</p>
                        </div>
                        <div
                          className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                            checked
                              ? "border-[color:var(--accent-3)] bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)]"
                              : "border-white/20"
                          }`}
                        >
                          {checked && <CheckIcon className="size-3.5 text-white" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/10 px-5 py-4">
              <button
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-semibold text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreatingGroup}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--accent)] via-[color:var(--accent-2)] to-[color:var(--accent-3)] px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_18px_var(--glow)] transition-opacity disabled:opacity-60"
              >
                {isCreatingGroup ? <Loader2Icon className="size-4 animate-spin" /> : <UsersIcon className="size-4" />}
                Create Group
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default CreateGroupModal;
