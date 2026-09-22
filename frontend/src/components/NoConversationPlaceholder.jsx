import { motion } from "framer-motion";
import { MessageCircleIcon, SparklesIcon } from "lucide-react";

const NoConversationPlaceholder = () => {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex h-full flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] shadow-lg backdrop-blur-xl">
        <MessageCircleIcon className="size-7 text-[color:var(--accent-3)]" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-[color:var(--text-primary)]">Select a conversation</h3>
      <p className="max-w-xs text-sm text-[color:var(--text-muted)]">
        Pick a contact from the sidebar to start chatting or continue an existing thread.
      </p>
      <div className="mt-4 flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-[color:var(--text-muted)] backdrop-blur-xl">
        <SparklesIcon className="size-3.5 text-[color:var(--accent)]" />
        Premium chat experience ready
      </div>
    </motion.div>
  );
};

export default NoConversationPlaceholder;
