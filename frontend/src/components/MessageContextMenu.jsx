import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SmilePlusIcon, ReplyIcon, ForwardIcon, CopyIcon, StarIcon, PinIcon, PencilIcon, Trash2Icon } from "lucide-react";

const DEFAULT_ACTIONS = [
  { icon: SmilePlusIcon, label: "React" },
  { icon: ReplyIcon, label: "Reply" },
  { icon: ForwardIcon, label: "Forward" },
  { icon: CopyIcon, label: "Copy" },
  { icon: StarIcon, label: "Star" },
  { icon: PinIcon, label: "Pin" },
  { icon: PencilIcon, label: "Edit" },
  { icon: Trash2Icon, label: "Delete", danger: true },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

/**
 * Floating right-click / long-press context menu for messages.
 *
 * Rendered in a PORTAL (fixed) so it is never clipped by the scroll container and
 * is clamped to stay inside the viewport. Clicking a row calls onAction(label);
 * onClose() is used to dismiss after selection or from ChatContainer (outside
 * click / Escape / scroll).
 */
function MessageContextMenu({ x, y, actions = DEFAULT_ACTIONS, onAction, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Measure the menu and clamp it inside the viewport once it has rendered.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth || 200;
    const h = el.offsetHeight || 240;
    const pad = 8;
    setPos({
      left: clamp(x, pad, Math.max(pad, window.innerWidth - w - pad)),
      top: clamp(y, pad, Math.max(pad, window.innerHeight - h - pad)),
    });
  }, [x, y]);

  return createPortal(
    <div
      ref={ref}
      data-ctx-menu
      className="message-ctx-menu"
      style={{ left: pos.left, top: pos.top }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map(({ icon: Icon, label, danger }) => (
        <button
          key={label}
          type="button"
          className={`message-ctx-menu-item ${danger ? "mcm-danger" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onAction?.(label);
            onClose?.();
          }}
        >
          <Icon className="mcm-icon size-4" />
          <span>{label}</span>
        </button>
      ))}
    </div>,
    document.body
  );
}

export default MessageContextMenu;
