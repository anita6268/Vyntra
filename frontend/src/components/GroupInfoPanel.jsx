import { AnimatePresence, motion } from "framer-motion";
import {
  XIcon,
  UsersIcon,
  CrownIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  LogOutIcon,
  UserMinusIcon,
  ImageIcon,
  CheckIcon,
  Loader2Icon,
  SearchIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { GroupAvatar } from "./GroupsPanel";
import toast from "react-hot-toast";

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function GroupInfoPanel({ isOpen, onClose }) {
  const {
    selectedGroup: group,
    getGroupById,
    updateGroup,
    addGroupMember,
    removeGroupMember,
    deleteGroup,
    leaveGroup,
    getAllContacts,
    allContacts,
    isUsersLoading,
  } = useChatStore();
  const { authUser } = useAuthStore();

  const [mode, setMode] = useState("view"); // "view" | "edit" | "add"
  const [editName, setEditName] = useState("");
  const [editAvatar, setEditAvatar] = useState(null);
  const [addSearch, setAddSearch] = useState("");
  const [selectedNew, setSelectedNew] = useState(() => new Set());
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRefEdit = useRef(null);

  const handleEditAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file.");
    const dataUrl = await readAsDataURL(file);
    setEditAvatar(dataUrl);
  };

  const isAdmin = (group?.admins || []).some((a) => String(a) === String(myId));
  const myId = authUser?._id ? String(authUser._id) : "";
  const memberName = (memberToRemove && group?.members)
    ? group.members.find((m) => String(m._id) === String(memberToRemove))?.fullName
    : "this member";

  useEffect(() => {
    if (isOpen) {
      setMode("view");
      setConfirmLeave(false);
      setConfirmDelete(false);
      setConfirmRemove(false);
      setMemberToRemove(null);
      setEditName(group?.name || "");
      setEditAvatar(null);
      setSelectedNew(new Set());
      setAddSearch("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, group?._id]);

  // Debounced contact search for the "add members" picker.
  useEffect(() => {
    if (!isOpen || mode !== "add" || !addSearch.trim()) return;
    const t = setTimeout(() => getAllContacts(addSearch), 250);
    return () => clearTimeout(t);
  }, [isOpen, mode, addSearch, getAllContacts]);

  const existingIds = new Set((group?.members || []).map((m) => String(m._id)));
  const addableContacts = allContacts.filter((c) => !existingIds.has(String(c._id)));

  const handleSaveEdit = async () => {
    if (!group) return;
    if (!editName.trim()) return toast.error("Group name is required.");
    if (editName.trim().length > 64) return toast.error("Group name must be 64 characters or fewer.");
    setSaving(true);
    const payload = { name: editName.trim() };
    if (editAvatar) payload.avatar = editAvatar;
    const updated = await updateGroup(group._id, payload);
    setSaving(false);
    if (updated) {
      setMode("view");
      await getGroupById(group._id);
    }
  };

  const toggleNew = (id) => {
    setSelectedNew((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddMembers = async () => {
    if (!group) return;
    if (selectedNew.size === 0) return toast.error("Select at least one member to add.");
    setSaving(true);
    const updated = await addGroupMember(group._id, Array.from(selectedNew));
    setSaving(false);
    if (updated) {
      setMode("view");
      await getGroupById(group._id);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!group) return;
    setMemberToRemove(userId);
    setConfirmRemove(true);
  };

  const handleConfirmRemove = async () => {
    if (!group || !memberToRemove) return;
    setSaving(true);
    await removeGroupMember(group._id, memberToRemove);
    setSaving(false);
    setConfirmRemove(false);
    setMemberToRemove(null);
    await getGroupById(group._id);
  };

  const handleDelete = async () => {
    if (!group) return;
    const ok = await deleteGroup(group._id);
    if (ok) onClose();
  };

  const handleLeave = async () => {
    if (!group) return;
    const res = await leaveGroup(group._id);
    if (res) onClose();
  };
return (
    <AnimatePresence>
      {isOpen && group && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed right-0 top-0 z-[105] flex h-full w-full max-w-sm flex-col border-l border-white/10 bg-[color:var(--panel-strong)]/95 shadow-2xl backdrop-blur-2xl"
          >
            <div className="relative flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3.5">
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[color:var(--accent-3)]/60 to-transparent" />
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5">
                  <UsersIcon className="size-4 text-[color:var(--accent-3)]" />
                </div>
                <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">
                  {mode === "view" ? "Group Info" : mode === "edit" ? "Edit Group" : "Add Members"}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                aria-label="Close"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
              {mode === "view" && (
                <div className="flex flex-col items-center text-center">
                  <GroupAvatar group={group} size="size-20" />
                  <h2 className="mt-3 text-lg font-bold text-[color:var(--text-primary)]">{group.name}</h2>
                  <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">
                    {group.memberCount || 0} {group.memberCount === 1 ? "member" : "members"}
                    {group.createdBy?.fullName ? ` • Created by ${group.createdBy.fullName}` : ""}
                  </p>
                  {isAdmin && (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--accent-3)]">
                      <CrownIcon className="size-3" /> Admin
                    </span>
                  )}
                </div>
              )}

              {/* Members / add-members section */}
              {(mode === "view" || mode === "add") && (
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                      {mode === "view" ? "Members" : "Add Members"}
                    </p>
                    {isAdmin && mode === "view" && (
                      <button
                        onClick={() => {
                          setMode("add");
                          setAddSearch("");
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--accent)] transition-colors hover:bg-white/10"
                      >
                        <PlusIcon className="size-3" /> Add Members
                      </button>
                    )}
                  </div>

                  {mode === "add" && (
                    <div className="mb-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                      <SearchIcon className="size-4 shrink-0 text-[color:var(--text-muted)]" />
                      <input
                        value={addSearch}
                        onChange={(e) => setAddSearch(e.target.value)}
                        placeholder="Search contacts…"
                        className="w-full bg-transparent text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
                      />
                    </div>
                  )}
<div className="space-y-1.5">
                     {mode === "add" && (
                       <>
                         {isUsersLoading ? (
                           <p className="py-6 text-center text-sm text-[color:var(--text-muted)]">Loading contacts…</p>
                         ) : addableContacts.length === 0 ? (
                           <p className="py-6 text-center text-sm text-[color:var(--text-muted)]">
                             {addSearch.trim() ? `No contacts match "${addSearch}"` : "Type a name or phone number to search."}
                           </p>
                         ) : (
                          addableContacts.map((contact) => {
                            const checked = selectedNew.has(String(contact._id));
                            return (
                              <button
                                key={contact._id}
                                type="button"
                                onClick={() => toggleNew(String(contact._id))}
                                className={`flex w-full items-center gap-3 rounded-2xl border p-2 text-left transition-all ${
                                  checked
                                    ? "border-[color:var(--accent-3)]/50 bg-[color:var(--accent-3)]/10"
                                    : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                                }`}
                              >
                                <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] p-[2px]">
                                  <img src={contact.profilePic || "/avatar.png"} alt={contact.fullName} className="size-full rounded-full object-cover" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">{contact.fullName}</p>
                                </div>
                                <div className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-all ${checked ? "border-[color:var(--accent-3)] bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)]" : "border-white/20"}`}>
                                  {checked && <CheckIcon className="size-3.5 text-white" />}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </>
                    )}

                    {mode === "view" &&
                      (group.members || []).map((member) => {
                        const isCreator = group.createdBy && String(member._id) === String(group.createdBy._id);
                        const isMe = String(member._id) === myId;
                        const isRemovable = isAdmin && !isMe && !isCreator;
                        const isMemberAdmin = (group.admins || []).some((a) => String(a) === String(member._id));
                        return (
                          <div key={member._id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-2">
                            <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] p-[2px]">
                              <img src={member.profilePic || "/avatar.png"} alt={member.fullName} className="size-full rounded-full object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">
                                {member.fullName}
                                {isMe && <span className="text-[color:var(--text-muted)]"> (You)</span>}
                              </p>
                              <div className="flex items-center gap-1.5">
                                {isCreator && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-[color:var(--accent-3)]">
                                    <CrownIcon className="size-2.5" /> Creator
                                  </span>
                                )}
                                {isMemberAdmin && (
                                  <span className="text-[10px] font-semibold text-amber-300">Admin</span>
                                )}
                              </div>
                            </div>
                            {isRemovable && (
                              <button
                                onClick={() => handleRemoveMember(member._id)}
                                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-muted)] transition-colors hover:bg-rose-500/15 hover:text-rose-400"
                                title="Remove member"
                              >
                                <UserMinusIcon className="size-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
{mode === "edit" && (
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => fileRefEdit.current?.click()}
                    className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] p-[2px]"
                    title="Change group photo"
                  >
                    {editAvatar ? (
                      <img src={editAvatar} alt="" className="size-full rounded-full object-cover" />
                    ) : group.avatar ? (
                      <img src={group.avatar} alt={group.name} className="size-full rounded-full object-cover" />
                    ) : (
                      <ImageIcon className="size-7 text-white" />
                    )}
                  </button>
                  <input ref={fileRefEdit} type="file" accept="image/*" className="hidden" onChange={handleEditAvatar} />
                  <label className="mt-3 mb-1 block w-full text-left text-[11px] font-medium text-[color:var(--text-muted)]">Group Name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={64}
                    placeholder="Group name"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent-3)]/50"
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            {mode === "view" && (
              <div className="shrink-0 space-y-2 border-t border-white/10 p-4">
                {isAdmin && (
                  <button
                    onClick={() => setMode("edit")}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[color:var(--text-primary)] transition-colors hover:bg-white/10"
                  >
                    <PencilIcon className="size-4 text-[color:var(--accent-3)]" /> Edit Group
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-400 transition-colors hover:bg-rose-500/20"
                  >
                    <Trash2Icon className="size-4" /> Delete Group
                  </button>
                )}
                <button
                  onClick={() => setConfirmLeave(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-rose-400"
                >
                  <LogOutIcon className="size-4" /> Leave Group
                </button>
              </div>
            )}
{mode === "add" && (
              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/10 p-4">
                <button
                  onClick={() => setMode("view")}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMembers}
                  disabled={saving || selectedNew.size === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--accent)] via-[color:var(--accent-2)] to-[color:var(--accent-3)] px-4 py-2 text-sm font-bold text-white shadow-[0_0_16px_var(--glow)] disabled:opacity-60"
                >
                  {saving ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
                  Add Members
                </button>
              </div>
            )}

            {mode === "edit" && (
              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/10 p-4">
                <button
                  onClick={() => setMode("view")}
                  className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[color:var(--accent)] via-[color:var(--accent-2)] to-[color:var(--accent-3)] px-4 py-2 text-sm font-bold text-white shadow-[0_0_16px_var(--glow)] disabled:opacity-60"
                >
                  {saving ? <Loader2Icon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
                  Save
                </button>
              </div>
            )}
          </motion.aside>

          {confirmLeave && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm" onClick={() => setConfirmLeave(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute left-1/2 top-1/2 w-[min(92vw,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-[color:var(--panel-strong)]/95 p-5 shadow-2xl backdrop-blur-2xl"
              >
                <h3 className="text-base font-bold text-[color:var(--text-primary)]">Leave this group?</h3>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  You will stop receiving messages from “{group.name}” and it will be removed from your Groups.
                </p>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button onClick={() => setConfirmLeave(false)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition-colors hover:bg-white/10">
                    Cancel
                  </button>
                  <button onClick={handleLeave} className="rounded-full bg-rose-500 px-4 py-2 text-sm font-bold text-white shadow-[0_0_16px_rgba(244,63,94,0.4)] transition-colors hover:bg-rose-600">
                    Leave
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {confirmDelete && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute left-1/2 top-1/2 w-[min(92vw,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-[color:var(--panel-strong)]/95 p-5 shadow-2xl backdrop-blur-2xl"
              >
                <h3 className="text-base font-bold text-[color:var(--text-primary)]">Delete this group?</h3>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  This permanently deletes “{group.name}” for everyone. This action cannot be undone.
                </p>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button onClick={() => setConfirmDelete(false)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition-colors hover:bg-white/10">
                    Cancel
                  </button>
                  <button onClick={handleDelete} className="rounded-full bg-rose-500 px-4 py-2 text-sm font-bold text-white shadow-[0_0_16px_rgba(244,63,94,0.4)] transition-colors hover:bg-rose-600">
                    Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
          
          {confirmRemove && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm" onClick={() => { setConfirmRemove(false); setMemberToRemove(null); }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94 }}
                onClick={(e) => e.stopPropagation()}
                className="absolute left-1/2 top-1/2 w-[min(92vw,22rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-[color:var(--panel-strong)]/95 p-5 shadow-2xl backdrop-blur-2xl"
              >
                <h3 className="text-base font-bold text-[color:var(--text-primary)]">Remove member?</h3>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  Remove {memberName || "this member"} from "{group?.name}"? They can be added back later.
                </p>
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button onClick={() => { setConfirmRemove(false); setMemberToRemove(null); }} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition-colors hover:bg-white/10">
                    Cancel
                  </button>
                  <button onClick={handleConfirmRemove} disabled={saving} className="rounded-full bg-rose-500 px-4 py-2 text-sm font-bold text-white shadow-[0_0_16px_rgba(244,63,94,0.4)] transition-colors hover:bg-rose-600 disabled:opacity-60">
                    {saving ? "Removing…" : "Remove"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}

export default GroupInfoPanel;
