import { motion } from "framer-motion";
import { SearchIcon, UsersIcon, RefreshCwIcon, MessageCirclePlusIcon } from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import { formatLastSeen, formatTimeLabel } from "../lib/formatLastSeen";
import UserAvatar from "./UserAvatar";

function lastMessagePreview(lastMessage, authUser) {
  if (!lastMessage) return "";
  const fromMe =
    authUser && String(lastMessage.senderId) === String(authUser._id);
  const prefix = fromMe ? "You: " : "";
  if (lastMessage.text) return prefix + lastMessage.text;
  if (lastMessage.image) return prefix + "Photo";
  if (lastMessage.audio) return prefix + "Voice message";
  if (lastMessage.fileUrl) return prefix + (lastMessage.fileName || "File");
  return prefix + "Message";
}

function isPhoneInput(value) {
  if (!value) return false;
  const digits = value.replace(/[^\d]/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

function isEmailInput(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function ContactList({ filter = "", selectedIndex: externalIndex, onSelect, onKeyDown }) {
  const {
    getMyChatPartners,
    getAllContacts,
    allContacts,
    chats,
    typingUsers,
    setSelectedUser,
    isUsersLoading,
    selectedUser,
    matchContacts,
    lookupContactByPhone,
    lookupContact,
  } = useChatStore();
  const { onlineUsers, authUser } = useAuthStore();

  const [internalIndex, setInternalIndex] = useState(-1);
  const selectedIndex = externalIndex ?? internalIndex;
  const setSelectedIndex = onSelect ? setInternalIndex : () => {};

  const [contactsSynced, setContactsSynced] = useState(false);
  const [contactPickerError, setContactPickerError] = useState("");
  const [identifierSearchResult, setIdentifierSearchResult] = useState([]);
  const [identifierSearching, setIdentifierSearching] = useState(false);
  const [fallbackPhone, setFallbackPhone] = useState("");
  const [fallbackResults, setFallbackResults] = useState([]);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackSearched, setFallbackSearched] = useState(false);
  const isContactPickerSupported = "contacts" in navigator;

  useEffect(() => {
    getMyChatPartners();
    getAllContacts();
  }, [getMyChatPartners, getAllContacts]);

  const enriched = useMemo(() => {
    const chatMap = new Map(chats.map((c) => [String(c._id), c]));
    return allContacts.map((contact) => {
      const chat = chatMap.get(String(contact._id));
      return {
        ...contact,
        isPinned: chat?.isPinned || false,
        unreadCount: chat?.unreadCount || 0,
        lastMessage: chat?.lastMessage || null,
        lastMessageAt: chat?.lastMessageAt || null,
      };
    });
  }, [allContacts, chats]);

  const sorted = useMemo(() => {
    const onlineSet = new Set(onlineUsers.map((id) => String(id)));
    return [...enriched].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const aOnline = onlineSet.has(String(a._id));
      const bOnline = onlineSet.has(String(b._id));
      if (aOnline !== bOnline) return aOnline ? -1 : 1;
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return (a.fullName || "").localeCompare(b.fullName || "");
    });
  }, [enriched, onlineUsers]);

  const nameFiltered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((c) => c.fullName?.toLowerCase().includes(q));
  }, [sorted, filter]);

  const displayList = useMemo(() => {
    if (Array.isArray(identifierSearchResult) && identifierSearchResult.length > 0) return identifierSearchResult;
    return nameFiltered;
  }, [nameFiltered, identifierSearchResult]);

  useEffect(() => {
    if (!filter.trim()) {
      setIdentifierSearchResult([]);
      return;
    }
    const q = filter.trim();
    if (isPhoneInput(q) || isEmailInput(q)) {
      let cancelled = false;
      setIdentifierSearching(true);
      setIdentifierSearchResult([]);
      const lookupRequest = isPhoneInput(q)
        ? lookupContactByPhone(q)
        : lookupContact(q);
      lookupRequest.then((users) => {
        if (!cancelled) {
          setIdentifierSearchResult(users);
          setIdentifierSearching(false);
        }
      });
      return () => {
        cancelled = true;
      };
    } else {
      setIdentifierSearching(false);
      setIdentifierSearchResult([]);
    }
  }, [filter, lookupContactByPhone, lookupContact]);

  const handleFindContacts = useCallback(async () => {
    setContactPickerError("");
    if (!("contacts" in navigator)) {
      setContactPickerError("Contact sync isn't supported in this browser.");
      return;
    }
    try {
      const contacts = await navigator.contacts.select(
        ["name", "tel"],
        { multiple: true }
      );
      const phones = contacts
        .flatMap((c) => Array.isArray(c.tel) ? c.tel : [c.tel || ""])
        .filter((p) => p && p.replace(/[^\d]/g, "").length >= 7);
      if (phones.length === 0) {
        setContactPickerError("No valid phone numbers found in your contacts.");
        return;
      }
      await matchContacts(phones);
      setContactsSynced(true);
    } catch (err) {
      if (err.name !== "AbortError") {
        setContactPickerError("Unable to access contacts. Please try again.");
      }
    }
  }, [matchContacts]);

  const handleFallbackSearch = useCallback(async () => {
    const query = fallbackPhone.trim();
    if (!query) return;
    const emailQuery = isEmailInput(query);
    const phoneQuery = isPhoneInput(query);
    setFallbackLoading(true);
    setFallbackResults([]);
    setFallbackSearched(true);
    try {
      const results = emailQuery
        ? await lookupContact(query)
        : phoneQuery
          ? await lookupContactByPhone(query)
          : [];
      setFallbackResults(results);
    } finally {
      setFallbackLoading(false);
    }
  }, [fallbackPhone, lookupContactByPhone, lookupContact]);

  const handleFallbackKeyDown = useCallback((e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleFallbackSearch();
    }
  }, [handleFallbackSearch]);

  const handleInvite = useCallback(() => {
    const identifier = filter.trim() || fallbackPhone.trim();
    if (!identifier) return;
    const message = "Join me on Vyntra so we can chat.";
    const target = isEmailInput(identifier)
      ? `mailto:${encodeURIComponent(identifier)}?subject=${encodeURIComponent("Join me on Vyntra")}&body=${encodeURIComponent(message)}`
      : `sms:${encodeURIComponent(identifier)}?body=${encodeURIComponent(message)}`;
    window.location.href = target;
  }, [filter, fallbackPhone]);

  if (isUsersLoading && displayList.length === 0) return <UsersLoadingSkeleton />;

  const showEmptyState = !contactsSynced && displayList.length === 0 && identifierSearchResult.length === 0;

  if (showEmptyState) {
    if (isContactPickerSupported) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <UsersIcon className="mb-3 size-10 text-[color:var(--text-muted)]/50" />
          <p className="mb-1 text-sm font-medium text-[color:var(--text-primary)]">None of your contacts are on Vyntra yet.</p>
          <p className="mb-4 text-xs text-[color:var(--text-muted)]">
            Find friends from your phone contacts to start chatting.
          </p>
          {contactPickerError && (
            <p className="mb-3 text-xs text-rose-400">{contactPickerError}</p>
          )}
          <button
            type="button"
            onClick={handleFindContacts}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--accent-3)]/40 bg-[color:var(--accent-3)]/15 px-4 py-2 text-xs font-medium text-[color:var(--accent-3)] transition hover:bg-[color:var(--accent-3)]/25"
          >
            <RefreshCwIcon className="size-3.5" />
            Find friends from contacts
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-10 text-center px-4">
        <UsersIcon className="mb-3 size-10 text-[color:var(--text-muted)]/50" />
        <p className="mb-4 text-sm font-medium text-[color:var(--text-primary)]">Find people you know on Vyntra</p>

        <div className="mb-4 flex w-full max-w-sm items-center gap-2">
          <input
            type="text"
            value={fallbackPhone}
            onChange={(e) => {
              setFallbackPhone(e.target.value);
              if (fallbackSearched) setFallbackSearched(false);
            }}
            onKeyDown={handleFallbackKeyDown}
            placeholder="Enter phone number or email"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent-3)]/50"
          />
          <button
            type="button"
            onClick={handleFallbackSearch}
            disabled={!fallbackPhone.trim() || fallbackLoading}
            className="rounded-full bg-gradient-to-r from-[color:var(--accent)] via-[color:var(--accent-2)] to-[color:var(--accent-3)] px-4 py-2 text-sm font-bold text-white shadow-[0_0_18px_var(--glow)] transition disabled:opacity-60"
          >
            {fallbackLoading ? "Searching…" : "Search"}
          </button>
        </div>

        <p className="mb-1 text-xs text-[color:var(--text-muted)]">Contact sync isn't available in this browser.</p>
        <p className="mb-4 text-xs text-[color:var(--text-muted)]">You can find a Vyntra user using their phone number or email address.</p>

        {fallbackLoading && (
          <div className="flex items-center justify-center gap-2 text-xs text-[color:var(--text-muted)]">
            <RefreshCwIcon className="size-3.5 animate-spin text-[color:var(--accent-3)]" />
            Searching…
          </div>
        )}

        {!fallbackLoading && fallbackSearched && fallbackResults.length > 0 && (
          <>
            <p className="mb-2 text-xs text-[color:var(--text-muted)]">
              {fallbackResults.length} Vyntra account{fallbackResults.length === 1 ? "" : "s"} found
            </p>
            <div className="flex w-full max-w-sm flex-col gap-2">
              {fallbackResults.map((contact) => (
                <button
                  key={contact._id}
                  type="button"
                  onClick={() => {
                    if (onSelect) onSelect(contact);
                    else setSelectedUser(contact);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.04] bg-white/[0.02] p-3 text-left transition hover:border-white/10 hover:bg-white/[0.04]"
                >
                  <UserAvatar
                    src={contact.profilePic}
                    name={contact.fullName}
                    size={44}
                    online={false}
                    className="size-11"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-bold text-[color:var(--text-primary)]">{contact.fullName}</h4>
                    <p className="text-xs text-emerald-400">On Vyntra</p>
                  </div>
                  <span className="rounded-full border border-[color:var(--accent-3)]/40 bg-[color:var(--accent-3)]/15 px-3 py-1.5 text-xs font-medium text-[color:var(--accent-3)]">
                    Message
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {!fallbackLoading && fallbackSearched && fallbackResults.length === 0 && (
          <>
            <p className="text-xs text-rose-400">No Vyntra account found for this phone number or email.</p>
            <button
              type="button"
              onClick={handleInvite}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent-3)]/40 bg-[color:var(--accent-3)]/15 px-4 py-2 text-xs font-medium text-[color:var(--accent-3)] transition hover:bg-[color:var(--accent-3)]/25"
            >
              <MessageCirclePlusIcon className="size-3.5" />
              Invite to Vyntra
            </button>
          </>
        )}
      </div>
    );
  }

  if (displayList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <SearchIcon className="mb-2 size-8 text-[color:var(--text-muted)]/50" />
        <p className="text-sm text-[color:var(--text-muted)]">
          {filter ? `No contacts match "${filter}"` : "None of your contacts are on Vyntra yet."}
        </p>
        {filter && (isPhoneInput(filter) || isEmailInput(filter)) && (
          <button
            type="button"
            onClick={handleInvite}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--accent-3)]/40 bg-[color:var(--accent-3)]/15 px-4 py-2 text-xs font-medium text-[color:var(--accent-3)] transition hover:bg-[color:var(--accent-3)]/25"
          >
            <MessageCirclePlusIcon className="size-3.5" />
            Invite to Vyntra
          </button>
        )}
        {!filter && (
          <button
            type="button"
            onClick={handleFindContacts}
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-[color:var(--text-muted)] transition hover:bg-white/10 hover:text-[color:var(--text-primary)]"
          >
            <RefreshCwIcon className="size-3.5" />
            Find friends from contacts
          </button>
        )}
      </div>
    );
  }

  const handleKey = (e) => {
    if (onKeyDown) onKeyDown(e);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < displayList.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Enter" && selectedIndex >= 0 && selectedIndex < displayList.length) {
      e.preventDefault();
      const contact = displayList[selectedIndex];
      if (onSelect) onSelect(contact);
      else setSelectedUser(contact);
    }
  };

  return (
    <div onKeyDown={handleKey} tabIndex={0} role="listbox" aria-label="Contacts">
      {contactsSynced && (
        <div className="mb-3 px-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
            Vyntra contacts
          </span>
        </div>
      )}
      {identifierSearching && (
        <div className="flex items-center justify-center gap-2 py-4 text-xs text-[color:var(--text-muted)]">
          <RefreshCwIcon className="size-3.5 animate-spin text-[color:var(--accent-3)]" />
          Searching by phone…
        </div>
      )}
      {displayList.map((contact, idx) => {
        const contactId = String(contact._id);
        const isOnline = onlineUsers.includes(String(contact._id)) && contact.showOnline !== false;
        const isSelected = selectedUser?._id === contact._id;
        const isTyping = Boolean(typingUsers?.[contactId]);
        const lastSeenLabel = isOnline ? null : formatLastSeen(contact.lastSeen);
        const timeLabel = contact.lastMessageAt
          ? formatTimeLabel(contact.lastMessageAt)
          : null;
        const isFocused = selectedIndex === idx;

        return (
          <motion.div
            key={contact._id}
            layout
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            transition={{ type: "spring", stiffness: 380, damping: 28 }}
            className={`cursor-pointer rounded-2xl p-3 backdrop-blur-xl transition-all duration-300 ${
              isSelected
                ? "selected-contact"
                : isFocused
                  ? "border border-[color:var(--accent-3)]/30 bg-white/5"
                  : "border border-white/[0.04] bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04] hover:shadow-[0_6px_20px_rgba(0,0,0,0.18)]"
            }`}
            onClick={() => {
              if (onSelect) onSelect(contact);
              else setSelectedUser(contact);
            }}
            role="option"
            aria-selected={isSelected}
          >
            <div className="flex items-center gap-3">
              <UserAvatar
                src={contact.profilePic}
                name={contact.fullName}
                size={44}
                online={isOnline}
                className="size-11"
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="truncate text-sm font-bold text-[color:var(--text-primary)]">
                    {contact.fullName}
                  </h4>
                  {timeLabel && (
                    <span className="shrink-0 text-[10px] text-[color:var(--text-muted)]/70">
                      {timeLabel}
                    </span>
                  )}
                </div>

                <div className="mt-1 flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
                  {isTyping ? (
                    <span className="font-medium text-emerald-400">typing...</span>
                  ) : isOnline ? (
                    <>
                      <span className="inline-flex size-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]" />
                      <span className="text-emerald-400">Online</span>
                    </>
                  ) : lastSeenLabel ? (
                    <span>{lastSeenLabel}</span>
                  ) : (
                    <span className="text-slate-500">Offline</span>
                  )}

                  {contact.lastMessage && !isTyping && (
                    <>
                      <span className="mx-1 h-3 w-px bg-white/10" />
                      <span className="min-w-0 truncate">
                        {lastMessagePreview(contact.lastMessage, authUser)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default ContactList;
