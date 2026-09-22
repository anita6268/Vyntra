import { motion, AnimatePresence } from "framer-motion";
import { SparklesIcon, BotIcon, Loader2Icon, RefreshCwIcon, LockIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { axiosInstance } from "../../lib/axios";
import { canUsePremiumFeature, PREMIUM_FEATURES } from "../../lib/premiumFeatures";
import { promptUpgrade } from "../../lib/premiumGating";

function AISummaryPanel({ messages, isLoading, error, onRetry }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [internalError, setInternalError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const runningRef = useRef(false);
  const isAllowed = canUsePremiumFeature(PREMIUM_FEATURES.ADVANCED_AI);

  useEffect(() => {
    if (!isAllowed) return;
    if (isLoading) return;
    let cancelled = false;
    const run = async () => {
      if (runningRef.current) return;
      if (!messages || messages.length === 0) {
        setSummary("No messages to summarize yet.");
        setInternalError(false);
        return;
      }
      setLoading(true);
      runningRef.current = true;
      setInternalError(false);
      try {
        const res = await axiosInstance.post("/ai/summarize", { messages });
        if (!cancelled) {
          setSummary(res.data?.summary || "Summary unavailable.");
          setInternalError(false);
        }
      } catch (err) {
        const msg = err?.response?.data?.message || err?.message || "AI request failed. Please try again.";
        if (!cancelled) {
          toast.error(msg);
          setSummary("⚠️ " + msg);
          setInternalError(true);
        }
      } finally {
        runningRef.current = false;
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [messages, attempt, isAllowed, isLoading]);

  const wordCount = (messages || []).reduce((acc, m) => acc + (m.text ? m.text.split(/\s+/).length : 0), 0);

  if (!isAllowed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <LockIcon className="size-7 text-[color:var(--text-muted)]" />
        </div>
        <p className="text-sm font-medium text-[color:var(--text-primary)]">AI Summary</p>
        <p className="max-w-xs text-xs text-[color:var(--text-muted)]">
          Unlock AI-powered conversation summaries with Vyntra Pro.
        </p>
        <button
          type="button"
          onClick={() => promptUpgrade("AI Summary is available with Vyntra Pro.", PREMIUM_FEATURES.ADVANCED_AI)}
          className="mt-2 inline-flex items-center gap-2 rounded-xl border border-[color:var(--accent-3)]/30 bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-[color:var(--glow)]"
        >
          Upgrade to Pro
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <BotIcon className="size-5 animate-pulse text-[color:var(--accent-3)]" />
        </div>
        <p className="text-xs text-[color:var(--text-muted)]">Loading conversation…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <BotIcon className="size-5 text-rose-400" />
        </div>
        <p className="text-xs text-[color:var(--text-primary)]">Failed to load conversation</p>
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

  if (!messages || messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <SparklesIcon className="size-7 text-[color:var(--text-muted)]" />
        </div>
        <p className="text-sm font-medium text-[color:var(--text-primary)]">No summary yet</p>
        <p className="max-w-xs text-xs text-[color:var(--text-muted)]">
          Send some messages and AI will generate a smart summary for this conversation.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-[color:var(--accent)]/10 to-[color:var(--accent-3)]/10 p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] text-white">
            <BotIcon className="size-4" />
          </div>
          <p className="text-sm font-semibold text-[color:var(--text-primary)]">AI Summary</p>
        </div>
        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
            <p className="text-lg font-bold text-[color:var(--accent-3)]">{messages.length}</p>
            <p className="text-[10px] text-[color:var(--text-muted)]">Messages</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
            <p className="text-lg font-bold text-[color:var(--accent-3)]">{wordCount}</p>
            <p className="text-[10px] text-[color:var(--text-muted)]">Words</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-center">
            <p className="text-lg font-bold text-[color:var(--accent-3)]">{messages.filter((m) => m.image).length}</p>
            <p className="text-[10px] text-[color:var(--text-muted)]">Photos</p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-[color:var(--text-primary)]">
            <SparklesIcon className="size-3.5 text-[color:var(--accent-3)]" />
            Smart summary
          </p>
          {loading ? (
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-[color:var(--text-muted)]">
              <Loader2Icon className="size-4 animate-spin text-[color:var(--accent-3)]" />
              Generating summary…
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {summary && (
                <motion.p
                  key={summary}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="whitespace-pre-wrap text-xs leading-5 text-[color:var(--text-muted)]"
                >
                  {summary}
                </motion.p>
              )}
            </AnimatePresence>
          )}
          {internalError && !loading && (
            <button
              type="button"
              onClick={() => setAttempt((a) => a + 1)}
              disabled={loading}
              className="mt-3 flex items-center gap-1.5 rounded-full border border-[color:var(--accent-3)]/40 bg-[color:var(--accent-3)]/15 px-3 py-1.5 text-xs font-medium text-[color:var(--accent-3)] transition hover:bg-[color:var(--accent-3)]/25 disabled:opacity-50"
            >
              <RefreshCwIcon className="size-3.5" />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default AISummaryPanel;
