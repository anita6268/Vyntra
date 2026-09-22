import { motion, AnimatePresence } from "framer-motion";
import {
  BotIcon,
  SparklesIcon,
  LanguagesIcon,
  MessageSquareTextIcon,
  PenToolIcon,
  Wand2Icon,
  CalendarDaysIcon,
  XIcon,
  ChevronDown,
  RefreshCwIcon,
  CornerDownLeftIcon,
  Loader2Icon,
  CopyIcon,
  CheckIcon,
  SendIcon,
  ScanTextIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { axiosInstance } from "../lib/axios";
import { canUsePremiumFeature, PREMIUM_FEATURES } from "../lib/premiumFeatures";
import { promptUpgrade } from "../lib/premiumGating";

const LANGUAGES = [
  "Hindi", "English", "Spanish", "French", "German",
  "Japanese", "Arabic", "Other...",
];

// Deduplicate messages by a stable _id, preserving the LAST occurrence (most recent).
// Kept as a safety net; the preferred path is useChatStore.getMessages().
const _dedupeMessages = (messages = []) => {
  if (!Array.isArray(messages)) return [];
  const seen = new Set();
  return [...messages]
    .reverse()
    .filter((m) => {
      const key = String(m._id || m.id || [m.senderId, m.createdAt, m.text].filter(Boolean).join("|"));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .reverse();
};

// Map an axios error (or raw error) to a user-friendly, actionable message.
// Differentiates network failures, auth, Pro gating, rate limits, and backend errors.
const getErrorMessage = (err) => {
  const status = err?.response?.status;
  const backendMsg = err?.response?.data?.message;
  if (!status && !err?.response) {
    return "Cannot connect to Vyntra server.";
  }
  if (status === 401) {
    return "Please sign in again.";
  }
  if (status === 403) {
    return "This AI feature requires Vyntra Pro.";
  }
  if (status === 404) {
    return "AI endpoint not found. Check backend route configuration.";
  }
  if (status === 429) {
    return "AI service rate limit reached. Try again shortly.";
  }
  if (status === 502 || status === 503) {
    return backendMsg || "AI provider failed. Check backend configuration/logs.";
  }
  if (status === 504) {
    return "AI request timed out. The provider is slow — try again.";
  }
  if (backendMsg) {
    return backendMsg;
  }
  return err?.message || "AI request failed. Please try again.";
};

const buildTranscript = (messages, authUser, contactName, selectedGroup) => {
  if (!Array.isArray(messages) || messages.length === 0) return "";
  const myId = authUser?._id ? String(authUser._id) : null;
  const groupName = selectedGroup?.name || null;
  const lines = [];
  const imageUrls = [];
  for (const m of messages) {
    const senderId = m.senderId ? String(m.senderId) : null;
    const who = senderId && myId && senderId === myId ? "You" : groupName || contactName || "Them";
    const text = (m.text || "").trim();
    const hasImage = !!(m.image && m.image.trim());
    const hasAudio = !!(m.audio && m.audio.trim());
    const hasFile = !!(m.fileUrl && m.fileUrl.trim());
    if (text) {
      lines.push(`${who}: ${text}`);
    } else if (hasImage) {
      lines.push(`${who}: [Shared image]`);
      imageUrls.push(m.image.trim());
    } else if (hasAudio) {
      lines.push(`${who}: [Voice message]`);
    } else if (hasFile) {
      lines.push(`${who}: [Shared file]`);
    }
  }
  return { transcript: lines.join("\n"), imageUrls };
};

const TOOLS = [
  { key: "translate", icon: LanguagesIcon, label: "Translate", desc: "Translate a message" },
  { key: "reply", icon: MessageSquareTextIcon, label: "Reply Suggestion", desc: "One complete reply" },
  { key: "grammar", icon: PenToolIcon, label: "Grammar Fix", desc: "Correct your latest message" },
  { key: "smart", icon: Wand2Icon, label: "Smart Reply", desc: "3 quick replies" },
  { key: "meeting", icon: CalendarDaysIcon, label: "Meeting Notes", desc: "Notes from the chat" },
];

function AIAssistantPanel({ isOpen, onClose, insertTextRef, defaultTool }) {
  const { selectedUser, selectedGroup, getMessages, isMessagesLoading } = useChatStore();
  const messages = useChatStore((state) => state.messages);
  const { authUser } = useAuthStore();
  const [prompt, setPrompt] = useState("");
  const [busyAction, setBusyAction] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [targetLang, setTargetLang] = useState("Spanish");
  const [messageToTranslate, setMessageToTranslate] = useState(null);
  const [customLang, setCustomLang] = useState("");
  const [smartReplies, setSmartReplies] = useState([]);
  const [meetingNotesData, setMeetingNotesData] = useState(null);
  const [meetingNotesCache, setMeetingNotesCache] = useState({});

  const resultRef = useRef(null);
  const lastRequestRef = useRef(null);
  const busyRef = useRef(false);
  const copiedTimerRef = useRef(null);
  const currentToolRef = useRef(null);
  // Monotonic counter so an older request's response can never overwrite a newer
  // result (race condition when switching messages/tools quickly).
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, [result, busyAction, smartReplies, meetingNotesData]);

  const contactName = selectedUser?.fullName || "them";

  const getConversationKey = () => {
    const id = selectedUser?._id || selectedGroup?._id || "unknown";
    return String(id);
  };

  const getMessageCount = () => {
    const deduped = getMessages();
    return deduped.filter((m) => m.text && m.text.trim()).length;
  };

  const activeToolData = TOOLS.find((t) => t.key === activeTool);

  const generateResult = (title, body, error = false) => ({
    id: Date.now(),
    title,
    body,
    error,
    createdAt: new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
  });

  const formatNotesForCopy = (notes) => {
    if (!notes || typeof notes !== "object") return String(notes || "");
    const lines = [];
    if (notes.summary) lines.push(notes.summary);
    if (notes.discussionPoints?.length) lines.push("\nKey Discussion Points\n" + notes.discussionPoints.map((p) => `• ${p}`).join("\n"));
    if (notes.decisions?.length) lines.push("\nDecisions\n" + notes.decisions.map((d) => `• ${d}`).join("\n"));
    if (notes.actionItems?.length) lines.push("\nAction Items\n" + notes.actionItems.map((a) => `• ${a}`).join("\n"));
    if (notes.nextSteps?.length) lines.push("\nNext Steps\n" + notes.nextSteps.map((n) => `• ${n}`).join("\n"));
    return lines.filter(Boolean).join("\n");
  };

  const openTool = (tool) => {
    if (busyRef.current) return;
    if (!canUsePremiumFeature(PREMIUM_FEATURES.ADVANCED_AI)) {
      promptUpgrade("AI features are available with Vyntra Pro.");
      return;
    }
    setCopied(false);
    setSmartReplies([]);
    setResult(null);
    setMeetingNotesData(null);
    currentToolRef.current = tool.key;
    // Reset the per-tool selections so stale state never leaks between tools.
    setMessageToTranslate(null);
    setCustomLang("");
    setTargetLang("Spanish");
    if (tool.key === "translate") {
      setActiveTool("translate");
      return;
    }
    setActiveTool(tool.key);
    generate(tool.key);
  };

  const openToolRef = useRef(null);
  openToolRef.current = openTool;

  useEffect(() => {
    if (!isOpen || !defaultTool) return;
    const timer = setTimeout(() => {
      const tool = TOOLS.find((t) => t.key === defaultTool);
      if (tool) openToolRef.current(tool);
    }, 120);
    return () => clearTimeout(timer);
  }, [isOpen, defaultTool]);

  const generate = (toolKey, lang) => {
    if (busyRef.current) return;
    const myRequestId = (requestIdRef.current += 1);
    lastRequestRef.current = { type: "tool", toolKey, lang };
    busyRef.current = true;
    setBusyAction(toolKey);
    setResult(null);
    setSmartReplies([]);
     const run = async () => {
      try {
        const deduped = getMessages();
        const textMessages = deduped.filter((m) => m.text && m.text.trim());
        const latest = textMessages[textMessages.length - 1];
        let body = "";
          let title = TOOLS.find((t) => t.key === toolKey)?.label || "AI Output";

        switch (toolKey) {
          case "translate": {
            if (!messageToTranslate?.text) {
              body = "Select a message to translate.";
              break;
            }
            const res = await axiosInstance.post("/ai/translate", {
              text: messageToTranslate.text,
              targetLanguage: lang || targetLang,
            });
            body = res.data?.translatedText || "Translation unavailable.";
            break;
          }
          case "reply": {
            const res = await axiosInstance.post("/ai/reply-suggestion", { messages: deduped });
            body = res.data?.reply || "Reply suggestion unavailable.";
            break;
          }
          case "grammar": {
            if (!latest?.text) {
              body = "No message from you to correct yet. Send a message first.";
              break;
            }
            const res = await axiosInstance.post("/ai/grammar", { text: latest.text });
            if (res.data?.success && res.data?.result) {
              body = res.data.result;
            } else {
              body = res.data?.message || "Correction unavailable.";
            }
            break;
          }
          case "smart": {
            const res = await axiosInstance.post("/ai/smart-reply", { messages: deduped });
            const replies = res.data?.replies || [];
            setSmartReplies(replies.slice(0, 3));
            body = "";
            break;
          }
          case "meeting": {
            if (isMessagesLoading) {
              body = "Loading messages… please wait a moment.";
              break;
            }
            const conversationKey = getConversationKey();
            const messageCount = getMessageCount();
            const cached = meetingNotesCache[conversationKey];
            if (cached && cached.messageCount === messageCount && cached.notes) {
              const parsed = cached.notes;
              setMeetingNotesData(parsed);
              body = formatNotesForCopy(parsed);
              break;
            }
            const usableMessages = (messages || []).filter((m) => {
              if (!m || typeof m !== "object") return false;
              const text = (m.text || "").trim();
              const hasMedia = !!(m.image || m.audio || m.fileUrl);
              return text.length > 0 || hasMedia;
            });
            const { transcript, imageUrls } = buildTranscript(usableMessages.length > 0 ? usableMessages : deduped, authUser, contactName, selectedGroup);
            const transcriptMessageCount = transcript.split("\n").filter((l) => l.trim()).length;
            if (!transcript || transcriptMessageCount < 1) {
              const emptyNotes = {
                summary: "No conversation content available for Meeting Notes.",
                discussionPoints: [],
                decisions: [],
                actionItems: [],
                nextSteps: [],
              };
              setMeetingNotesData(emptyNotes);
              body = emptyNotes.summary;
              break;
            }
            const res = await axiosInstance.post("/ai/meeting-notes", { transcript, imageUrls });
            const parsed = res.data?.notes || {
              summary: "Not enough meaningful conversation to generate detailed notes.",
              discussionPoints: [],
              decisions: [],
              actionItems: [],
              nextSteps: [],
            };
            setMeetingNotesData(parsed);
            setMeetingNotesCache((prev) => ({
              ...prev,
              [conversationKey]: { notes: parsed, messageCount },
            }));
            body = formatNotesForCopy(parsed);
            break;
          }
          default:
            body = "";
        }

        // Guard against race: only commit this response if it's still the latest
        // AND the user hasn't switched to a different tool since sending it.
        if (myRequestId === requestIdRef.current && currentToolRef.current === toolKey) {
          setResult(generateResult(title, body));
        }
      } catch (err) {
        if (myRequestId === requestIdRef.current && currentToolRef.current === toolKey) {
          const msg = getErrorMessage(err);
          toast.error(msg);
            setResult(generateResult(TOOLS.find((t) => t.key === toolKey)?.label || "AI Output", msg, true));
        }
      } finally {
        if (myRequestId === requestIdRef.current) {
          busyRef.current = false;
          setBusyAction(null);
        }
      }
    };
    run();
  };

  const chooseLanguage = (lang) => {
    setTargetLang(lang);
    if (lang === "Other...") return;
    generate("translate", lang);
  };

  const translateLanguage = () => {
    const lang = targetLang === "Other..." ? (customLang.trim() || targetLang) : targetLang;
    if (!lang) {
      toast.error("Enter a target language.");
      return;
    }
    generate("translate", lang);
  };

  const insertSmartReply = (text) => {
    if (insertTextRef?.current) {
      insertTextRef.current(text);
      toast.success("Inserted into message");
    } else {
      toast.error("Message input is not available");
    }
  };

  const insertReplySuggestion = () => {
    if (!result?.body) return;
    if (insertTextRef?.current) {
      insertTextRef.current(result.body);
      toast.success("Inserted into message");
    } else {
      toast.error("Message input is not available");
    }
  };

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard?.writeText(result.body).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard");
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
    });
  };

  const askAI = async (quote) => {
    const question = typeof quote === "string" ? quote.trim() : prompt.trim();
    if (!question || busyRef.current) return;
    if (!canUsePremiumFeature(PREMIUM_FEATURES.ADVANCED_AI)) {
      promptUpgrade("Custom AI prompts are available with Vyntra Pro.");
      return;
    }
    const myRequestId = (requestIdRef.current += 1);
    lastRequestRef.current = { type: "ask", prompt: question };
    currentToolRef.current = "ask";
    setCopied(false);
    setActiveTool("ask");
    setResult(null);
    setSmartReplies([]);
    setBusyAction("ask");
    if (typeof quote !== "string") setPrompt("");
    busyRef.current = true;
    try {
      const deduped = getMessages();
      const { transcript } = buildTranscript(deduped, authUser, contactName, selectedGroup);
      const res = await axiosInstance.post("/ai/chat", {
        prompt: question,
        context: transcript,
      });
      if (myRequestId === requestIdRef.current && currentToolRef.current === "ask") {
        setResult(generateResult("AI Response", res.data?.response || "No response from AI."));
      }
    } catch (err) {
      if (myRequestId === requestIdRef.current && currentToolRef.current === "ask") {
        const msg = getErrorMessage(err);
        toast.error(msg);
        setResult(generateResult("AI Response", msg, true));
      }
    } finally {
      if (myRequestId === requestIdRef.current) {
        busyRef.current = false;
        setBusyAction(null);
      }
    }
  };

  const retryLast = () => {
    const req = lastRequestRef.current;
    if (!req || busyRef.current) return;
    // Bump the request ID so any in-flight response from the failed attempt is discarded.
    requestIdRef.current += 1;
    if (req.type === "ask") askAI(req.prompt);
    else generate(req.toolKey, req.lang);
  };

  const isPro = authUser?.isPro;

  const body = (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Premium Header */}
      <div className="shrink-0 border-b border-white/10 p-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] shadow-[0_0_22px_var(--glow)]">
              <SparklesIcon className="size-5 text-white" />
              <span className="absolute -right-1 -top-1 flex size-3 items-center justify-center rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]">
                <span className="size-1.5 rounded-full bg-white" />
              </span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-[color:var(--text-primary)]">Vyntra AI</h2>
              <p className="text-[11px] text-[color:var(--text-muted)]">Your intelligent chat assistant</p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-muted)] transition hover:bg-white/10 hover:text-[color:var(--text-primary)]"
            aria-label="Close AI Assistant"
            title="Close"
          >
            <XIcon className="size-4" />
          </motion.button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-3">
        {!isPro && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="shrink-0 rounded-2xl border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/10 via-[color:var(--accent-2)]/10 to-[color:var(--accent-3)]/10 p-3.5 shadow-[0_0_24px_rgba(124,58,237,0.25)]"
          >
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] text-white shadow-[0_0_14px_var(--glow)]">
                <SparklesIcon className="size-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[color:var(--text-primary)]">Vyntra Pro</span>
                  <span className="rounded-full bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow">PRO</span>
                </div>
                <p className="text-[11px] text-[color:var(--text-muted)]">Unlock the full power of Vyntra AI</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => promptUpgrade("AI features are available with Vyntra Pro.")}
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-semibold text-[color:var(--text-primary)] transition hover:bg-white/10"
            >
              Upgrade to Pro
            </button>
          </motion.div>
        )}

        <div className="shrink-0">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">AI Tools</p>
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {TOOLS.map((tool) => {
            const isActive = activeTool === tool.key;
            return (
              <motion.button
                key={tool.key}
                whileHover={{ scale: 1.01, y: -1 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                type="button"
                onClick={() => openTool(tool)}
                disabled={!!busyAction}
                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                  isActive
                    ? "border-[color:var(--accent-3)]/50 bg-[color:var(--accent-3)]/10 shadow-[0_0_16px_var(--glow)]"
                    : "border-white/10 bg-white/5 hover:bg-white/10 hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
                }`}
              >
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl border transition-colors duration-200 ${
                  isActive
                    ? "border-[color:var(--accent-3)]/40 bg-gradient-to-br from-[color:var(--accent)]/30 to-[color:var(--accent-3)]/30 text-[color:var(--accent-3)] shadow-[0_0_12px_var(--glow)]"
                    : "border-white/10 bg-white/5 text-[color:var(--text-muted)]"
                }`}>
                  {busyAction === tool.key ? (
                    <Loader2Icon className="size-4 animate-spin text-[color:var(--accent-3)]" />
                  ) : (
                    <tool.icon className="size-4" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[color:var(--text-primary)]">{tool.label}</span>
                  <span className="block text-[11px] text-[color:var(--text-muted)]">{tool.desc}</span>
                </span>
                <ChevronDown
                  className={`size-4 shrink-0 transition-transform duration-200 ${isActive ? "rotate-180 text-[color:var(--accent-3)]" : "text-[color:var(--text-muted)]"}`}
                />
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {activeTool && activeTool !== "ask" && (
            <motion.div
              key={`tool-${activeTool}-${result?.id || "loading"}`}
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-white/5"
            >
              <button
                type="button"
                onClick={() => { setActiveTool(null); setResult(null); setCopied(false); setSmartReplies([]); }}
                className="flex w-full items-center justify-between px-3 py-2.5 text-left"
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-[color:var(--accent-3)]">
                  <activeToolData.icon className="size-3.5" />
                  {activeToolData.label}
                </span>
                <ChevronDown className="size-4 rotate-180 text-[color:var(--text-muted)]" />
              </button>

              {activeTool === "translate" && (
                <div className="border-t border-white/10 px-3 py-3">
                  <p className="mb-2 text-[11px] text-[color:var(--text-muted)]">Select a message to translate:</p>
                   <div className="scrollbar-thin mb-2 max-h-28 space-y-1 overflow-y-auto">
                      {getMessages().filter((m) => m.text && m.text.trim()).slice(-6).reverse().map((m) => (
                        <button
                          key={m._id}
                          type="button"
                          onClick={() => setMessageToTranslate(m)}
                           className={`block w-full truncate rounded-xl border px-2.5 py-2 text-left text-[11px] transition-colors ${
                             String(messageToTranslate?._id) === String(m._id)
                              ? "border-[color:var(--accent-3)]/50 bg-[color:var(--accent-3)]/15 text-[color:var(--text-primary)]"
                              : "border-white/10 bg-white/5 text-[color:var(--text-muted)] hover:bg-white/10"
                          }`}
                       >
                         {m.senderId === authUser?._id ? "You: " : `${contactName}: `}{m.text}
                       </button>
                     ))}
                     {getMessages().filter((m) => m.text && m.text.trim()).length === 0 && (
                       <p className="text-[11px] text-[color:var(--text-muted)]">No messages to translate.</p>
                     )}
                  </div>

                   <p className="mb-2 text-[11px] text-[color:var(--text-muted)]">Select target language:</p>
                   <div className="grid grid-cols-2 gap-1.5">
                     {LANGUAGES.map((lang) => (
                       <button
                         key={lang}
                         type="button"
                         disabled={!messageToTranslate || busyAction === "translate"}
                         onClick={() => chooseLanguage(lang)}
                         className={`rounded-xl border px-2.5 py-2 text-xs transition-colors ${
                           targetLang === lang && messageToTranslate
                             ? "border-[color:var(--accent-3)]/50 bg-[color:var(--accent-3)]/15 text-[color:var(--text-primary)]"
                             : "border-white/10 bg-white/5 text-[color:var(--text-muted)] hover:bg-white/10 disabled:opacity-40"
                         }`}
                       >
                         {busyAction === "translate" && targetLang === lang ? (
                           <Loader2Icon className="size-3.5 animate-spin text-[color:var(--accent-3)]" />
                         ) : null}
                         {lang}
                       </button>
                     ))}
                   </div>

                   {targetLang === "Other..." && (
                     <div className="mt-2 flex items-center gap-1.5">
                       <input
                         value={customLang}
                         onChange={(e) => setCustomLang(e.target.value)}
                         onKeyDown={(e) => { if (e.key === "Enter") translateLanguage(); }}
                         placeholder="Enter language (e.g., Italian, Korean…)"
                         className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)] focus:border-[color:var(--accent-3)]/50"
                       />
                       <button
                         type="button"
                         disabled={!messageToTranslate || !customLang.trim() || busyAction === "translate"}
                         onClick={translateLanguage}
                         className="shrink-0 rounded-xl border border-[color:var(--accent-3)]/40 bg-[color:var(--accent-3)]/15 px-3 py-2 text-xs font-medium text-[color:var(--accent-3)] transition hover:bg-[color:var(--accent-3)]/25 disabled:opacity-40"
                      >
                        Translate
                      </button>
                    </div>
                  )}

                  {!messageToTranslate && (
                    <p className="mt-2 text-center text-[11px] text-[color:var(--text-muted)]">
                      Select a message to translate.
                    </p>
                  )}
                </div>
              )}

              {busyAction === activeTool && activeTool !== "translate" && (
                 <div className="flex items-center gap-2 border-t border-white/10 px-3 py-3 text-xs text-[color:var(--text-muted)]">
                   <Loader2Icon className="size-4 animate-spin text-[color:var(--accent-3)]" />
                   Vyntra AI is thinking…
                 </div>
               )}

              {activeTool === "smart" && !busyAction && smartReplies.length > 0 && (
                <div className="border-t border-white/10 px-3 py-3">
                  <p className="mb-2 text-[11px] text-[color:var(--text-muted)]">Tap a suggestion to insert it into the message:</p>
                  <div className="flex flex-col gap-2">
                    {smartReplies.map((r, i) => (
                      <motion.button
                         key={`reply-${i}-${r.slice(0, 16)}`}
                         whileHover={{ scale: 1.01 }}
                         whileTap={{ scale: 0.97 }}
                         type="button"
                         onClick={() => insertSmartReply(r)}
                         className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-left text-sm text-[color:var(--text-primary)] transition hover:border-[color:var(--accent-3)]/50 hover:bg-white/10"
                       >
                        <CornerDownLeftIcon className="size-3.5 shrink-0 text-[color:var(--accent-3)]" />
                        {r}
                      </motion.button>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => generate("smart")}
                      className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-[color:var(--text-muted)] transition hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                      title="Regenerate"
                    >
                      <RefreshCwIcon className="size-3.5" />
                      Regenerate
                    </button>
                  </div>
                </div>
              )}

              {activeTool === "reply" && result?.body && !busyAction && (
                <div className="border-t border-white/10 px-3 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[color:var(--text-muted)]">{result.createdAt}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={copyResult}
                        className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-[color:var(--text-muted)] transition hover:bg-white/10"
                        title="Copy"
                      >
                        {copied ? <CheckIcon className="size-3.5 text-emerald-400" /> : <CopyIcon className="size-3.5" />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={() => generate("reply")}
                        className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-[color:var(--text-muted)] transition hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                        title="Regenerate"
                      >
                        <RefreshCwIcon className="size-3.5" />
                        Regenerate
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 rounded-2xl border border-white/10 bg-[color:var(--panel-strong)]/70 p-3">
                    <p className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--text-primary)]">{result.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={insertReplySuggestion}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-[color:var(--accent-3)]/40 bg-[color:var(--accent-3)]/15 px-3 py-2.5 text-xs font-medium text-[color:var(--accent-3)] transition hover:bg-[color:var(--accent-3)]/25"
                  >
                    <CornerDownLeftIcon className="size-3.5" />
                    Insert into message
                  </button>
                </div>
              )}

              {activeTool === "meeting" && meetingNotesData && !busyAction && (
                <div className="border-t border-white/10 px-3 py-3" ref={resultRef}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[color:var(--text-muted)]">{result?.createdAt}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={copyResult}
                        className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-[color:var(--text-muted)] transition hover:bg-white/10"
                        title="Copy"
                      >
                        {copied ? <CheckIcon className="size-3.5 text-emerald-400" /> : <CopyIcon className="size-3.5" />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={() => generate("meeting")}
                        className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-[color:var(--text-muted)] transition hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                        title="Regenerate"
                      >
                        <RefreshCwIcon className="size-3.5" />
                        Regenerate
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 space-y-2.5">
                    <div className="rounded-2xl border border-white/10 bg-[color:var(--panel-strong)]/70 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--accent-3)]">Summary</p>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--text-primary)]">{meetingNotesData.summary}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-[color:var(--panel-strong)]/70 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--accent-3)]">Key Discussion Points</p>
                       {meetingNotesData.discussionPoints?.length > 0 ? (
                         <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-5 text-[color:var(--text-primary)]">
                           {meetingNotesData.discussionPoints.map((item, idx) => (
                             <li key={`dp-${idx}-${item.slice(0, 20)}`}>{item}</li>
                           ))}
                         </ul>
                       ) : (
                         <p className="mt-1 text-xs text-[color:var(--text-muted)]">No meaningful discussion points identified.</p>
                       )}
                     </div>
                     <div className="rounded-2xl border border-white/10 bg-[color:var(--panel-strong)]/70 p-3">
                       <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--accent-3)]">Decisions</p>
                       {meetingNotesData.decisions?.length > 0 ? (
                         <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-5 text-[color:var(--text-primary)]">
                           {meetingNotesData.decisions.map((item, idx) => (
                             <li key={`dec-${idx}-${item.slice(0, 20)}`}>{item}</li>
                           ))}
                         </ul>
                       ) : (
                         <p className="mt-1 text-xs text-[color:var(--text-muted)]">No decisions identified.</p>
                       )}
                     </div>
                     <div className="rounded-2xl border border-white/10 bg-[color:var(--panel-strong)]/70 p-3">
                       <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--accent-3)]">Action Items</p>
                       {meetingNotesData.actionItems?.length > 0 ? (
                         <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-5 text-[color:var(--text-primary)]">
                           {meetingNotesData.actionItems.map((item, idx) => (
                             <li key={`ai-${idx}-${item.slice(0, 20)}`}>{item}</li>
                           ))}
                         </ul>
                       ) : (
                         <p className="mt-1 text-xs text-[color:var(--text-muted)]">No action items identified.</p>
                       )}
                     </div>
                     <div className="rounded-2xl border border-white/10 bg-[color:var(--panel-strong)]/70 p-3">
                       <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--accent-3)]">Next Steps</p>
                       {meetingNotesData.nextSteps?.length > 0 ? (
                         <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs leading-5 text-[color:var(--text-primary)]">
                           {meetingNotesData.nextSteps.map((item, idx) => (
                             <li key={`ns-${idx}-${item.slice(0, 20)}`}>{item}</li>
                           ))}
                         </ul>
                       ) : (
                         <p className="mt-1 text-xs text-[color:var(--text-muted)]">No next steps identified.</p>
                       )}
                    </div>
                  </div>
                </div>
              )}

               {result && activeTool !== "translate" && activeTool !== "smart" && activeTool !== "reply" && activeTool !== "meeting" && (() => {
                 const currentToolLabel = TOOLS.find((t) => t.key === activeTool)?.label || "";
                 return result.title === currentToolLabel;
              })() && (
                 <div className="border-t border-white/10 px-3 py-3" ref={resultRef}>
                   <div className="flex items-center justify-between">
                     <span className="text-[10px] text-[color:var(--text-muted)]">{result.createdAt}</span>
                     <button
                       onClick={copyResult}
                       className="rounded-full p-1 text-[color:var(--text-muted)] transition hover:bg-white/10"
                       title="Copy result"
                     >
                       {copied ? <CheckIcon className="size-3.5 text-emerald-400" /> : <CopyIcon className="size-3.5" />}
                     </button>
                   </div>
                   <pre className="mt-1 whitespace-pre-wrap font-sans text-xs leading-5 text-[color:var(--text-primary)]">{result.body}</pre>
                   {result.error && (
                     <button
                       type="button"
                       onClick={retryLast}
                       disabled={!!busyAction}
                       className="mt-2 flex items-center gap-1.5 rounded-full border border-[color:var(--accent-3)]/40 bg-[color:var(--accent-3)]/15 px-3 py-1.5 text-xs font-medium text-[color:var(--accent-3)] transition hover:bg-[color:var(--accent-3)]/25 disabled:opacity-50"
                     >
                       <RefreshCwIcon className="size-3.5" />
                       Retry
                     </button>
                   )}
                 </div>
               )}

               {busyAction === "translate" && (
                 <div className="border-t border-white/10 px-3 py-3">
                   <div className="flex items-center gap-2 text-xs text-[color:var(--text-muted)]">
                     <Loader2Icon className="size-4 animate-spin text-[color:var(--accent-3)]" />
                     Vyntra AI is thinking…
                   </div>
                 </div>
               )}

               {result && activeTool === "translate" && busyAction !== "translate" && (
                 <div className="border-t border-white/10 px-3 py-3" ref={resultRef}>
                   <div className="flex items-center justify-between">
                     <span className="flex items-center gap-1.5 text-[10px] text-[color:var(--text-muted)]">
                       <SparklesIcon className="size-3 text-[color:var(--accent-3)]" />
                       {result.createdAt}
                     </span>
                     <div className="flex items-center gap-1">
                       <span className="rounded-full border border-white/10 bg-[color:var(--accent-3)]/15 px-1.5 py-0.5 text-[9px] font-medium text-[color:var(--accent-3)]">
                         {targetLang === "Other..." ? (customLang.trim() || targetLang) : targetLang}
                       </span>
                       <button
                         type="button"
                         onClick={() => generate("translate", targetLang === "Other..." ? (customLang.trim() || targetLang) : targetLang)}
                         className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-[color:var(--text-muted)] transition hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                         title="Retry"
                       >
                         <RefreshCwIcon className="size-3.5" />
                         Retry
                       </button>
                       <button
                         onClick={copyResult}
                         className="rounded-full p-1 text-[color:var(--text-muted)] transition hover:bg-white/10"
                         title="Copy result"
                       >
                         {copied ? <CheckIcon className="size-3.5 text-emerald-400" /> : <CopyIcon className="size-3.5" />}
                       </button>
                     </div>
                   </div>
                   <div className={`mt-2 rounded-2xl border p-3 ${result.error ? "border-red-500/30 bg-red-900/10" : "border-white/10 bg-[color:var(--panel-strong)]/70"}`}>
                     <p className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--text-primary)]">{result.body}</p>
                   </div>
                 </div>
               )}

              {busyAction === activeTool && activeTool !== "translate" && (
                <div className="flex items-center gap-2 border-t border-white/10 px-3 py-3 text-xs text-[color:var(--text-muted)]">
                  <Loader2Icon className="size-4 animate-spin text-[color:var(--accent-3)]" />
                  Generating {activeToolData.label.toLowerCase()}…
                </div>
              )}
            </motion.div>
          )}

          {activeTool === "ask" && result && (
            <motion.div
              key="ask-result"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-3"
              ref={resultRef}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-semibold text-[color:var(--accent-3)]">
                  <SparklesIcon className="size-3.5" />
                  AI Response
                </span>
                <span className="text-[10px] text-[color:var(--text-muted)]">{result.createdAt}</span>
              </div>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-5 text-[color:var(--text-primary)]">{result.body}</pre>
              <div className="mt-2 flex justify-end gap-1">
                {result.error && (
                  <button
                    onClick={retryLast}
                    className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-[color:var(--text-muted)] transition hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                    title="Retry"
                  >
                    <RefreshCwIcon className="size-3" />
                    Retry
                  </button>
                )}
                <button
                  onClick={copyResult}
                  className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-[color:var(--text-muted)] transition hover:bg-white/10"
                  title="Copy result"
                >
                  {copied ? <CheckIcon className="size-3 text-emerald-400" /> : <CopyIcon className="size-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </motion.div>
          )}

          {busyAction === "ask" && (
            <motion.div
              key="ask-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-[color:var(--text-muted)]"
            >
               <Loader2Icon className="size-4 animate-spin text-[color:var(--accent-3)]" />
               Vyntra AI is thinking…
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fixed Ask AI Composer */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 transition-all duration-200 focus-within:border-[color:var(--accent-3)]/50 focus-within:bg-white/[0.07] focus-within:shadow-[0_0_18px_var(--glow)]">
          <SparklesIcon className="size-4 shrink-0 text-[color:var(--accent-3)]" />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && askAI()}
            className="w-full bg-transparent text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
            placeholder="Ask Vyntra AI anything..."
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={askAI}
            disabled={!prompt.trim() || !!busyAction}
            className="shrink-0 flex size-8 items-center justify-center rounded-full bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] text-white transition hover:opacity-90 disabled:opacity-50"
            aria-label="Send AI prompt"
          >
            {busyAction === "ask" ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <SendIcon className="size-3.5" />
            )}
          </motion.button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {isOpen && (
        <aside id="ai-assistant-panel" className="hidden h-full w-[340px] shrink-0 flex-col overflow-hidden border-l border-white/10 bg-[color:var(--panel-strong)]/80 backdrop-blur-2xl lg:flex">
          {body}
        </aside>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              id="ai-assistant-panel-mobile"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 500) onClose();
              }}
              className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[color:var(--panel-strong)]/95 shadow-2xl backdrop-blur-2xl"
            >
              <div className="flex shrink-0 items-center justify-center gap-2 px-4 pt-3">
                <div className="h-1.5 w-12 rounded-full bg-white/20" />
              </div>
              <div className="min-h-0 flex-1">{body}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default AIAssistantPanel;
