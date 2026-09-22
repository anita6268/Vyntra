import { motion } from "framer-motion";
import { FileIcon, FileTextIcon, DownloadIcon, RefreshCwIcon } from "lucide-react";
import { useChatStore } from "../../store/useChatStore";

function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FilesPanel({ messages, isLoading, error, onRetry }) {
  const downloadMessageFile = useChatStore((state) => state.downloadMessageFile);
  const files = (messages || [])
    .filter((m) => m.fileUrl && !m.image)
    .map((m) => ({
      id: m._id,
      name: m.fileName || "file",
      size: formatFileSize(m.fileSize),
      type: m.fileType || "",
      date: new Date(m.createdAt).toLocaleDateString(),
      url: m.fileUrl,
    }));

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <FileIcon className="size-5 animate-pulse text-[color:var(--accent-3)]" />
        </div>
        <p className="text-xs text-[color:var(--text-muted)]">Loading files…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <FileIcon className="size-5 text-rose-400" />
        </div>
        <p className="text-xs text-[color:var(--text-primary)]">Failed to load files</p>
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

  if (files.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex size-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <FileIcon className="size-7 text-[color:var(--text-muted)]" />
        </div>
        <p className="text-sm font-medium text-[color:var(--text-primary)]">No files shared</p>
        <p className="max-w-xs text-xs text-[color:var(--text-muted)]">Files shared in this conversation will appear here.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="space-y-2">
        {files.map((file, i) => (
          <motion.div
            key={file.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3"
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[color:var(--accent)]/25 to-[color:var(--accent-3)]/25 text-[color:var(--accent-3)]">
              <FileTextIcon className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[color:var(--text-primary)]">{file.name}</p>
              <p className="text-xs text-[color:var(--text-muted)]">{file.size}{file.type ? ` • ${file.type}` : ""} • {file.date}</p>
            </div>
            <button
              onClick={() => downloadMessageFile(file.id, file.name)}
              className="rounded-lg border border-white/10 bg-white/5 p-2 text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--text-primary)]"
              title="Download file"
            >
              <DownloadIcon className="size-4" />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default FilesPanel;
