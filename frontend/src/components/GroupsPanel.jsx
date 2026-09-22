import { motion } from "framer-motion";
import { PlusIcon, UsersIcon, SearchIcon, CheckCheck, MessageCircleMore, MoreVerticalIcon, LogOutIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import SectionActionMenu from "./panels/SectionActionMenu";
import ClearSectionModal from "./panels/ClearSectionModal";

// Real-time group preview from the actual last message — never fabricated.
function previewOf(group, authUser) {
  const last = group.lastMessage;
  if (!last) return "No messages yet";
  const fromMe = authUser && last.senderId && String(last.senderId) === String(authUser._id);
  const sender = group.members?.find((m) => String(m._id) === String(last.senderId))?.fullName;
  const prefix = fromMe ? "You: " : sender ? `${sender}: ` : "";
  if (last.text) return `${prefix}${last.text}`;
  if (last.image) return `${prefix}📷 Photo`;
  if (last.audio) return `${prefix}🎤 Voice message`;
  if (last.fileUrl) return `${prefix}📎 ${last.fileName || "File"}`;
  return `${prefix}Message`;
}

function timeOf(last) {
  if (!last?.createdAt) return "";
  const d = new Date(last.createdAt);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function GroupAvatar({ group, size = "size-11" }) {
  const initial = (group.name || "G").trim().charAt(0).toUpperCase();
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] p-[2px]`}
    >
      {group.avatar ? (
        <img src={group.avatar} alt={group.name} className="size-full rounded-full object-cover" />
      ) : (
        <span className="text-base font-bold text-white">{initial}</span>
      )}
    </div>
  );
}

function GroupsPanel({ filter = "", onCreate }) {
  const { getGroups, groups, isGroupsLoading, setSelectedGroup, selectedGroup, leaveGroup, deleteGroup } = useChatStore();
  const { authUser } = useAuthStore();
  const [search, setSearch] = useState("");
  const [confirmAction, setConfirmAction] = useState(null); // { group, action: "leave" | "delete" }

  useEffect(() => {
    getGroups();
  }, [getGroups]);

  const handleCreate = () => {
    if (typeof onCreate === "function") onCreate();
  };

  const myId = authUser?._id ? String(authUser._id) : "";

  const handleAction = (group, action) => {
    setConfirmAction({ group, action });
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;
    const { group, action } = confirmAction;
    setConfirmAction(null);
    if (action === "leave") {
      await leaveGroup(group._id);
    } else if (action === "delete") {
      await deleteGroup(group._id);
    }
  };

  if (isGroupsLoading) return <UsersLoadingSkeleton />;

  // Combine the external tab filter with the in-panel search box (both match name).
  const queryText = `${filter} ${search}`.trim().toLowerCase();
  const filtered = queryText
    ? groups.filter((g) => g.name?.toLowerCase().includes(queryText))
    : groups;
return (
    <div className="space-y-3">
      {/* Header + create */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <UsersIcon className="size-4 text-[color:var(--accent-3)]" />
          </div>
          <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Groups</h3>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleCreate}
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[color:var(--accent)] via-[color:var(--accent-2)] to-[color:var(--accent-3)] px-3 py-1.5 text-xs font-bold text-white shadow-[0_0_14px_var(--glow)]"
        >
          <PlusIcon className="size-3.5" />
          Create Group
        </motion.button>
      </div>

      {/* In-panel group search */}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[color:var(--text-muted)]/60" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search groups…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)]/60 focus:border-[color:var(--accent-3)]/50"
        />
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/[0.02] py-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <UsersIcon className="size-6 text-[color:var(--text-muted)]" />
          </div>
          <p className="mt-1 text-sm font-medium text-[color:var(--text-primary)]">No groups yet</p>
          <p className="max-w-[220px] text-xs text-[color:var(--text-muted)]">
            Create your first group conversation
          </p>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleCreate}
            className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-[color:var(--accent)] transition-colors hover:bg-white/10"
          >
            <PlusIcon className="size-3.5" />
            Create Group
          </motion.button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <SearchIcon className="mb-2 size-8 text-[color:var(--text-muted)]/50" />
          <p className="text-sm text-[color:var(--text-muted)]">No groups match “{filter}”</p>
        </div>
      ) : (
        filtered.map((group) => {
          const isSelected = selectedGroup?._id === group._id;
          const unread = group.unreadCount || 0;
          const last = group.lastMessage;
          const isMine = last && authUser && last.senderId === authUser._id;
          const isAdmin = (group.admins || []).some((a) => String(a) === String(myId));
          return (
            <motion.div
              key={group._id}
              layout
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              transition={{ type: "spring", stiffness: 380, damping: 28 }}
              className={`cursor-pointer rounded-2xl p-3 backdrop-blur-xl transition-all duration-300 ${
                isSelected
                  ? "selected-contact"
                  : "border border-white/[0.04] bg-white/[0.03] hover:border-white/10 hover:bg-white/5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)]"
              }`}
              onClick={() => setSelectedGroup(group)}
            >
              <div className="flex items-center gap-3">
                <GroupAvatar group={group} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="truncate text-sm font-bold text-[color:var(--text-primary)]">
                      {group.name}
                    </h4>
                    <div className="flex items-center gap-1">
                      {unread > 0 && (
                        <span
                          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] text-[10px] font-bold text-white shadow-[0_0_10px_var(--glow)]"
                          title={`${unread} unread message${unread === 1 ? "" : "s"}`}
                        >
                          {unread}
                        </span>
                      )}
                      <div onClick={(e) => e.stopPropagation()}>
                        <SectionActionMenu
                          ariaLabel={`Group actions for ${group.name}`}
                          actions={[
                            ...(isAdmin
                              ? [
                                  {
                                    key: "delete",
                                    label: "Delete Group",
                                    icon: Trash2Icon,
                                    variant: "danger",
                                    onClick: () => handleAction(group, "delete"),
                                  },
                                ]
                              : []),
                            {
                              key: "leave",
                              label: "Leave Group",
                              icon: LogOutIcon,
                              variant: "danger",
                              onClick: () => handleAction(group, "leave"),
                            },
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
                    <span className="shrink-0 text-[10px] font-medium text-[color:var(--accent-3)]">
                      {group.memberCount || 0} {group.memberCount === 1 ? "member" : "members"}
                    </span>
                    {isAdmin && (
                      <span className="shrink-0 text-[10px] font-semibold text-amber-300">Admin</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
                    {isMine ? (
                      <CheckCheck className="size-3.5 shrink-0 text-[color:var(--accent-3)]" title="Sent" />
                    ) : (
                      <MessageCircleMore className="size-3 shrink-0" title="Message" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{previewOf(group, authUser)}</span>
                    {last && <span className="shrink-0 text-[10px] text-[color:var(--text-muted)]/70">{timeOf(last)}</span>}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })
      )}

      {/* Confirmation modal for leave/delete */}
      <ClearSectionModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={confirmAction?.action === "delete" ? "Delete this group?" : "Leave this group?"}
        description={
          confirmAction?.action === "delete"
            ? `This permanently deletes "${confirmAction?.group?.name}" for everyone. This action cannot be undone.`
            : `You will stop receiving messages from "${confirmAction?.group?.name}" and it will be removed from your Groups.`
        }
        confirmLabel={confirmAction?.action === "delete" ? "Delete" : "Leave"}
      />
    </div>
  );
}

export default GroupsPanel;
export { GroupAvatar };