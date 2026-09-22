import { motion } from "framer-motion";
import { MicIcon, PlayIcon, PauseIcon, RefreshCwIcon } from "lucide-react";
import { useRef, useState } from "react";

function VoiceNotesPanel({ messages, isLoading, error, onRetry }) {
  const [playing, setPlaying] = useState(null);
  const audioRef = useRef(null);

  const notes = (messages || [])
    .filter((m) => m.audio)
    .map((m) => ({
      id: m._id,
      audio: m.audio,
      duration: m.audioDuration || 0,
      date: new Date(m.createdAt).toLocaleDateString(),
    }));

  const togglePlay = (note) => {
    if (playing === note.id) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = note.audio;
    }
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = note.audio;
    audio.play().catch(() => {});
    setPlaying(note.id);
  };

  const onAudioEnded = () => setPlaying(null);

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <MicIcon className="size-5 animate-pulse text-[color:var(--accent-3)]" />
        </div>
        <p className="text-xs text-[color:var(--text-muted)]">Loading voice notes…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <MicIcon className="size-5 text-rose-400" />
        </div>
        <p className="text-xs text-[color:var(--text-primary)]">Failed to load voice notes</p>
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

  if (notes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <MicIcon className="size-7 text-[color:var(--text-muted)]" />
        </div>
        <p className="text-sm font-medium text-[color:var(--text-primary)]">No voice notes</p>
        <p className="max-w-xs text-xs text-[color:var(--text-muted)]">Voice messages in this conversation will appear here.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <audio ref={audioRef} onEnded={onAudioEnded} className="hidden" />
      <div className="space-y-2">
        {notes.map((note, i) => (
          <motion.div
            key={note.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
          >
            <button
              onClick={() => togglePlay(note)}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] text-white shadow-[0_0_15px_var(--glow)]"
            >
              {playing === note.id ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                {[2, 4, 3, 5, 3, 4, 2, 5].map((h, j) => (
                  <span
                    key={j}
                    className="w-1 rounded-full bg-[color:var(--accent-3)]"
                    style={{ height: `${playing === note.id ? h * 3 : h}px` }}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-[color:var(--text-muted)]">
                {note.duration ? `${note.duration}s • ` : ""}{note.date}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default VoiceNotesPanel;
