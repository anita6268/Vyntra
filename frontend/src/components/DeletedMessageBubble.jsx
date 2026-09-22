import { MessageCircleOffIcon, CheckIcon } from "lucide-react";

function DeletedMessageBubble({ message, isSelf }) {
  const time = message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div
      className={`message-bubble relative max-w-full overflow-visible px-4 py-3 pb-2.5 ${
        isSelf ? "message-bubble-self" : "message-bubble-other"
      }`}
    >
      <div className="flex items-center gap-2 text-[color:var(--text-muted)]">
        <MessageCircleOffIcon className="size-3.5 shrink-0 opacity-60" />
        <p className="text-xs italic opacity-70">Message removed</p>
      </div>
      <div
        className={`msg-meta relative z-[10] mt-2 ${
          isSelf ? "text-white/85" : "text-[color:var(--text-muted)]"
        }`}
      >
        <span className="msg-time">{time}</span>
        {isSelf && (
          <span className="flex items-center gap-1">
            <CheckIcon className="size-3" style={{ animation: "tick-pop 0.3s ease-out" }} title="Sent" />
          </span>
        )}
      </div>
    </div>
  );
}

export default DeletedMessageBubble;
