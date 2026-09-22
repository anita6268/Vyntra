import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useKeyboardSound from "../hooks/useKeyboardSound";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";
import { SendIcon, XIcon, SmileIcon, PaperclipIcon, SparklesIcon, MicIcon, PlusIcon, ReplyIcon, Trash2Icon, CheckIcon, SearchIcon } from "lucide-react";

// ── Premium emoji picker data (categories + search + recents) ──
const EMOJI_CATEGORIES = {
  Smileys: ["😀", "😁", "😂", "🤣", "😊", "😇", "🙂", "😉", "😍", "🥰", "😘", "😜", "🤪", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "😢", "😭", "😤", "😠", "🤯", "😳", "🥺", "😱", "😨", "😰", "😅", "🤗", "🤔", "🫡", "🤫", "🤭", "🫢", "😶", "😴", "🤤", "😪", "😷", "🤒", "🤕", "🤑", "🤠", "😈"],
  Gestures: ["👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "👏", "🙌", "🙏", "🤝", "💪", "👊", "✊", "🤛", "🤜", "👋", "🤚", "🖐️", "✋", "🫶", "🫵", "👆", "👇", "👈", "👉", "🤙", "👐", "💅", "🫰"],
  Hearts: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❤️‍🔥", "💖", "💗", "💓", "💞", "💕", "💘", "💝", "💟", "♥️", "💯"],
  Animals: ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🐦", "🦆", "🦅", "🦉", "🦇", "🐺", "🐝", "🦋", "🐌", "🐞", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑", "🦐", "🦞", "🦀", "🐬", "🐳", "🐋", "🦈", "🐊"],
  Food: ["🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🥑", "🥦", "🥬", "🥒", "🌽", "🥕", "🧄", "🧅", "🥔", "🍠", "🥐", "🍞", "🥖", "🥨", "🧀", "🥚", "🍳", "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🌭", "🍔", "🍟", "🍕", "🥪", "🌮", "🌯", "🍜", "🍣", "🍦", "🍩", "🍪", "🎂", "🍰", "🧁", "🥧", "🍫", "🍬", "🍭"],
  Activities: ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🏋️", "🤸", "🤺", "🤾", "🏌️", "🏇", "🧘", "🏄", "🏊", "🤽", "🚣", "🧗", "🚵", "🚴", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️"],
  Travel: ["🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🛵", "🏍️", "🛺", "🚲", "🛴", "🚨", "🚔", "🚍", "🚘", "🚖", "🚡", "🚠", "🚟", "🚃", "🚋", "🚞", "🚝", "🚄", "🚅", "🚈", "🚂", "✈️", "🛫", "🛬", "🛩️", "💺", "🚀", "🛸", "🚁", "🛶", "⛵", "🚤", "🛥️", "🛳️", "⛴️", "🚢", "🗺️", "🗿"],
  Symbols: ["✅", "❌", "❓", "❗", "‼️", "⁉️", "💯", "💢", "💬", "💭", "🗯️", "🔇", "🔈", "🔉", "🔊", "🔔", "🔕", "📢", "📣", "💤", "⭐", "🌟", "✨", "⚡", "🔥", "💥", "💫", "🌈", "☀️", "🌤️", "⛅", "🌧️", "⛈️", "🌩️", "🌨️", "❄️", "☃️", "🌊", "🌪️", "🌫️", "🍀", "🎉", "🎊", "🎁", "🎈", "🎂", "🎀", "💎", "🔮", "🎯"],
  Objects: ["📱", "💻", "⌚", "⌨️", "🖥️", "🖨️", "🖱️", "💾", "💿", "📀", "📷", "📸", "🎥", "📹", "🎬", "📺", "📻", "🎙️", "🎧", "🎤", "🎹", "🎸", "🎺", "🎻", "🪕", "🥁", "📚", "📖", "📕", "📗", "📘", "📙", "📔", "📓", "✏️", "✒️", "🖊️", "🖋️", "📝", "📌", "📍", "📎", "🖇️", "📏", "📐", "✂️", "🔑", "🔒", "🔓", "💡", "🔦"],
};

const ALL_EMOJIS = Object.values(EMOJI_CATEGORIES).flat();
const RECENT_KEY = "vyntra-recent-emojis";
const getRecentEmojis = () => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    return [];
  }
};
const persistRecentEmojis = (list) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 24)));
  } catch {
    // ignore
  }
};

function MessageInput({ onOpenAI, insertTextRef, replyTo, onClearReply, blocked, editingMsg, editText, onEditTextChange, onSaveEdit, onCancelEdit }) {
  const { sendMessage, isSoundEnabled, selectedUser, selectedGroup, emitTyping, emitStopTyping } = useChatStore();
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [emojiCategory, setEmojiCategory] = useState("Smileys");
  const [recentEmojis, setRecentEmojis] = useState(getRecentEmojis);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSendAnim, setIsSendAnim] = useState(false);
  // Real-time typing indicator: emit "typing" on each keystroke (kept on for up to
  // 1.2s of inactivity) and "stopTyping" after 1.2s OR on send/blur. Uses the
  // existing backend Socket.io handlers — no fake UI.
  const typingStopTimerRef = useRef(null);
  const typingSentRef = useRef(false);
  // The typing "target" is the open conversation: a plain user id for direct
  // chats, or { groupId } for group chats (matches the store emitTyping API).
  const typingTarget = selectedGroup
    ? { groupId: selectedGroup._id }
    : selectedUser?._id || null;

  // Reset the typing state whenever the open conversation changes so we never
  // emit a stale "stop typing" for the previous chat. Track the previous target
  // explicitly so we always stop typing on the old conversation, not the new one.
  const typingTargetRef = useRef(null);
  const prevTypingTargetRef = useRef(null);
  useEffect(() => {
    const prev = prevTypingTargetRef.current;
    if (typingSentRef.current && prev) {
      emitStopTyping(prev);
    }
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingSentRef.current = false;
    prevTypingTargetRef.current = typingTarget;
    typingTargetRef.current = typingTarget;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser?._id, selectedGroup?._id]);

  const emitTypingOnce = () => {
    if (!typingTarget || typingSentRef.current) return;
    typingSentRef.current = true;
    emitTyping(typingTarget);
  };
  const scheduleTypingStop = () => {
    if (!typingTarget) return;
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => {
      typingSentRef.current = false;
      emitStopTyping(typingTarget);
    }, 1200);
  };
  const cancelTyping = () => {
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    if (typingSentRef.current && typingTarget) {
      typingSentRef.current = false;
      emitStopTyping(typingTarget);
    }
  };
// File upload state
  const [filePreview, setFilePreview] = useState(null); // { name, type, size, dataUrl }
  // Voice recording state (real MediaRecorder)
  // States: idle | recording | processing | sent
  const [recordingState, setRecordingState] = useState("idle");
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState(null); // { dataUrl, duration }
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const recordStartRef = useRef(0);
  const recordingCancelledRef = useRef(false);
  const streamRef = useRef(null);
  const voiceSendLockRef = useRef(false);

  const fileInputRef = useRef(null);
  const fileInputRef2 = useRef(null);
  const sendBtnRef = useRef(null);
  const emojiRef = useRef(null);
  const pickerRef = useRef(null);
  const textAreaRef = useRef(null);
  const triggerSendAnimRef = useRef(null);
  const recordedAudioRef = useRef(null); // { dataUrl, duration } — synchronous access to latest recorded audio
  const [pickerStyle, setPickerStyle] = useState(null);

  // Register the text setter so the parent (ChatPage) can inject AI suggestions.
  useEffect(() => {
    if (insertTextRef) {
      insertTextRef.current = (value) => {
        setText((prev) => (prev ? prev + " " + value : value));
      };
    }
    return () => {
      if (insertTextRef) insertTextRef.current = null;
    };
  }, [insertTextRef]);

  // Close emoji picker on outside click/tap.
  useEffect(() => {
    if (!emojiOpen) return;
    const handler = (e) => {
      if (emojiRef.current?.contains(e.target)) return;
      if (pickerRef.current?.contains(e.target)) return;
      setEmojiOpen(false);
      setPickerStyle(null);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [emojiOpen]);

  // Close emoji picker on Escape key.
  useEffect(() => {
    if (!emojiOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        setEmojiOpen(false);
        setPickerStyle(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [emojiOpen]);

  // Compute and maintain picker position above the emoji button.
  useLayoutEffect(() => {
    if (!emojiOpen) return;

    const compute = () => {
      if (!emojiRef.current) return;
      const rect = emojiRef.current.getBoundingClientRect();
      const pickerWidth = 300;
      const pickerHeight = 320;
      const gap = 8;

      let top = rect.top - pickerHeight - gap;
      let left = rect.left;

      if (top < 8) {
        top = rect.bottom + gap;
      }
      if (left + pickerWidth > window.innerWidth - 8) {
        left = window.innerWidth - pickerWidth - 8;
      }
      if (left < 8) {
        left = 8;
      }
      if (top + pickerHeight > window.innerHeight - 8) {
        top = window.innerHeight - pickerHeight - 8;
      }
      if (top < 8) {
        top = 8;
      }

      setPickerStyle({ top, left, position: "fixed" });
    };

    compute();

    const onResize = () => compute();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [emojiOpen]);

  // Close picker on scroll so it never drifts away from the button.
  useEffect(() => {
    if (!emojiOpen) return;
    const onScroll = () => setEmojiOpen(false);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [emojiOpen]);

  // Cleanup on unmount: stop media stream, clear the recording timer so it
  // never fires after unmount, and release any in-progress recording.
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Clean up the typing indicator when the component unmounts so we never leave a
  // stale "typing…" state for the receiver (direct or group).
  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      if (triggerSendAnimRef.current) clearTimeout(triggerSendAnimRef.current);
      const lastTarget = typingTargetRef.current;
      if (typingSentRef.current && lastTarget) {
        emitStopTyping(lastTarget);
      }
    };
  }, [emitStopTyping]);

  // Reset all composer draft state when the open conversation changes so a
  // half-typed message or a queued image/file/audio never leaks into the next
  // chat. Reply + edit are parent-managed (reset elsewhere); everything else
  // lives in this component and must be cleared here.
  useEffect(() => {
    setText("");
    setImagePreview(null);
    setFilePreview(null);
    setRecordedAudio(null);
    setRecordSeconds(0);
    setRecordingState("idle");
    recordingCancelledRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (fileInputRef2.current) fileInputRef2.current.value = "";
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, [selectedUser?._id, selectedGroup?._id]);

  const triggerSendAnim = () => {
    setIsSendAnim(true);
    if (sendBtnRef.current) {
      sendBtnRef.current.classList.remove("send-morph");
      void sendBtnRef.current.offsetWidth;
      sendBtnRef.current.classList.add("send-morph");
    }
    if (triggerSendAnimRef.current) clearTimeout(triggerSendAnimRef.current);
    triggerSendAnimRef.current = setTimeout(() => setIsSendAnim(false), 450);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (blocked) {
      toast.error("You cannot send messages to this user.");
      return;
    }
    const nextText = text.trim();
    if (!nextText && !imagePreview && !filePreview && !recordedAudio && !recordedAudioRef.current) return;
    if (isSoundEnabled) playRandomKeyStrokeSound();
    cancelTyping();

    const isVoice = !!recordedAudioRef.current || !!recordedAudio;
    // Lock the send button so a double-click / rapid Enter cannot send twice.
    if (isVoice && voiceSendLockRef.current) return;
    if (isVoice) voiceSendLockRef.current = true;

    try {
      await sendMessage({
        text: nextText,
        image: imagePreview,
        replyTo: replyTo || null,
        audio: recordedAudioRef.current?.dataUrl || undefined,
        audioDuration: recordedAudioRef.current?.duration || undefined,
        fileUrl: filePreview?.dataUrl || undefined,
        fileName: filePreview?.name || undefined,
        fileType: filePreview?.type || undefined,
        fileSize: filePreview?.size || undefined,
      });
    } catch {
      if (isVoice) {
        console.error("[VOICE SEND ERROR] Voice message failed to send.");
        toast.error("Voice message failed to send.");
      }
    } finally {
      if (isVoice) voiceSendLockRef.current = false;
    }
    setText("");
    setImagePreview(null);
    setFilePreview(null);
    setRecordedAudio(null);
    recordedAudioRef.current = null;
    audioChunksRef.current = [];
    setEmojiOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (fileInputRef2.current) fileInputRef2.current.value = "";
    if (onClearReply) onClearReply();
    triggerSendAnim();
  };

  const handleKeyDown = (e) => {
    // Play typing sound for actual character input only — not for modifiers,
    // navigation keys, Enter, Backspace/Delete, etc.
    const isTypingKey = ![
      "Shift",
      "Control",
      "Alt",
      "Meta",
      "Tab",
      "CapsLock",
      "Escape",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Enter",
      "Backspace",
      "Delete",
    ].includes(e.key);

    if (isTypingKey && isSoundEnabled) {
      playRandomKeyStrokeSound();
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  // Read a file as a data URL.
  const readAsDataURL = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const processFile = async (file) => {
    if (!file) return;
    // Limit to 20 MB for file attachments.
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large. Max 20 MB.");
      return;
    }
    try {
      const dataUrl = await readAsDataURL(file);
      if (file.type.startsWith("image/")) {
        setImagePreview(dataUrl);
      } else {
        setFilePreview({
          name: file.name,
          type: file.type || "file",
          size: file.size,
          dataUrl,
        });
      }
    } catch {
      toast.error("Failed to read file");
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = () => {
    setFilePreview(null);
    if (fileInputRef2.current) fileInputRef2.current.value = "";
  };

  // ── Emoji insertion (with recents + cursor position) ──
  const insertEmoji = (emoji) => {
    const textarea = textAreaRef.current;
    const cursorPos = textarea ? textarea.selectionStart : -1;
    setText((prev) => {
      const pos = cursorPos >= 0 ? Math.min(cursorPos, prev.length) : prev.length;
      return prev.slice(0, pos) + emoji + prev.slice(pos);
    });
    setRecentEmojis((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)];
      persistRecentEmojis(next);
      return next;
    });
    setEmojiOpen(false);
    if (textarea) {
      requestAnimationFrame(() => {
        const ta = textAreaRef.current;
        if (ta) {
          const newPos = Math.min(cursorPos + emoji.length, ta.value.length);
          ta.setSelectionRange(newPos, newPos);
          ta.focus();
        }
      });
    }
  };

  // ── Real MediaRecorder voice messages ──
  const startRecording = async () => {
    if (blocked) {
      toast.error("You cannot send messages to this user.");
      return;
    }
    if (recordingState !== "idle") return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (blob.size === 0) {
          console.error("[Voice] Empty recording — no audio chunks collected");
          toast.error("Recording was empty. Try again.");
          stream.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          setRecordingState("idle");
          return;
        }
        setRecordingState("processing");
        const reader = new FileReader();
        reader.onloadend = () => {
          if (recordingCancelledRef.current) {
            setRecordingState("idle");
            return;
          }
          const audioData = {
            dataUrl: reader.result,
            duration: Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000)),
          };
          recordedAudioRef.current = audioData;
          setRecordedAudio(audioData);
          setRecordingState("idle");
        };
        reader.onerror = () => {
          console.error("[Voice] FileReader error reading recording");
          toast.error("Failed to process recording.");
          setRecordingState("idle");
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      recorder.start();
      setRecordingState("recording");
      setRecordSeconds(0);
      recordStartRef.current = Date.now();
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
      toast("Recording…", { icon: "🎙️" });
    } catch {
      toast.error("Microphone permission denied. Allow mic access to record voice messages.");
      setRecordingState("idle");
    }
  };

  const stopRecording = (send = true) => {
    if (recordingState !== "recording") return;
    const recorder = mediaRecorderRef.current;
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    recordingCancelledRef.current = !send;
    setRecordingState("idle");
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    if (!send) {
      setRecordedAudio(null);
      toast("Recording cancelled", { icon: "🎙️" });
    }
  };

  const formatRecordTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const canSend = !!text.trim() || !!imagePreview || !!filePreview || !!recordedAudio;

  // Filter emojis by search or return the selected category.
  const visibleEmojis = emojiSearch.trim()
    ? ALL_EMOJIS.filter((e) => e.includes(emojiSearch.trim().toLowerCase()))
    : emojiCategory === "Recent"
    ? (recentEmojis.length ? recentEmojis : ["😀", "😂", "❤️", "👍", "🎉"])
    : EMOJI_CATEGORIES[emojiCategory] || [];

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editText.trim()) return;
    await onSaveEdit?.();
  };

  return (
    <div className="px-3 pb-3 pt-1 sm:px-4 sm:pb-4">
      <div className="mx-auto max-w-[1000px] rounded-[22px] border border-white/[0.08] bg-[color:var(--panel-strong)] p-2 shadow-[0_-2px_12px_rgba(0,0,0,0.12)] backdrop-blur-2xl sm:p-2.5">
        {/* Image preview */}
        <AnimatePresence>
          {imagePreview && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
                className="mx-auto mb-3 flex max-w-[1000px] items-center"
             >
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="h-20 w-20 rounded-2xl border border-white/10 object-cover" />
                <button onClick={removeImage} className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--panel-strong)] text-[color:var(--text-primary)]" type="button">
                  <XIcon className="size-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File preview */}
        <AnimatePresence>
          {filePreview && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
               className="mx-auto mb-3 flex max-w-[1000px] items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
              >
               <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[color:var(--accent-3)]/15 text-[color:var(--accent-3)]">
                 <PaperclipIcon className="size-5" />
               </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[color:var(--text-primary)]">{filePreview.name}</p>
                <p className="text-[10px] text-[color:var(--text-muted)]">
                  {filePreview.type || "File"}
                  {filePreview.size ? ` • ${(filePreview.size / 1024).toFixed(0)} KB` : ""}
                </p>
              </div>
              <button onClick={removeFile} className="flex size-7 shrink-0 items-center justify-center rounded-full text-[color:var(--text-muted)] transition hover:bg-white/10 hover:text-[color:var(--text-primary)]" type="button">
                <XIcon className="size-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recorded audio preview */}
        <AnimatePresence>
          {recordedAudio && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
               className="mx-auto mb-3 flex max-w-[1000px] items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
              >
               <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400">
                 <MicIcon className="size-5" />
               </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[color:var(--text-primary)]">Voice message ready</p>
                <p className="text-[10px] text-[color:var(--text-muted)]">{recordedAudio.duration}s • tap send to deliver</p>
              </div>
              <audio src={recordedAudio.dataUrl} controls className="h-9 max-w-[180px]" />
              <button onClick={() => setRecordedAudio(null)} className="flex size-7 shrink-0 items-center justify-center rounded-full text-[color:var(--text-muted)] transition hover:bg-white/10 hover:text-[color:var(--text-primary)]" type="button">
                <XIcon className="size-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* WhatsApp-style reply preview */}
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
               className="mx-auto mb-2 flex max-w-[1000px] items-center overflow-hidden rounded-2xl border border-l-4 border-l-[color:var(--accent-3)] border-white/10 bg-white/5"
              >
              <div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
                {replyTo.image ? (
                  <img src={replyTo.image} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                ) : (
                  <ReplyIcon className="size-4 shrink-0 text-[color:var(--accent-3)]" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold text-[color:var(--accent-3)]">
                    {replyTo.senderName || "You"}
                  </p>
                  <p className="truncate text-xs text-[color:var(--text-muted)]">
                    {replyTo.text ? replyTo.text.slice(0, 70) : replyTo.image ? "📷 Photo" : "Message"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClearReply}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[color:var(--text-muted)] transition hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                title="Cancel reply"
              >
                <XIcon className="size-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {editingMsg ? (
          <form
            onSubmit={handleEditSubmit}
            className="mx-auto flex max-w-[1000px] items-center gap-2"
          >
            <button
              type="button"
              onClick={onCancelEdit}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
              title="Cancel edit"
            >
              <XIcon className="size-4" />
            </button>
            <textarea
              value={editText}
              rows={1}
              onChange={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
                onEditTextChange(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleEditSubmit(e);
                }
                if (e.key === "Escape") onCancelEdit();
              }}
              disabled={blocked}
              className="auto-grow-textarea min-w-0 flex-1 resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
              placeholder="Edit message…"
              autoFocus
            />
            <button
              type="submit"
              disabled={!editText.trim()}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] text-white shadow-[0_0_15px_var(--glow)] disabled:cursor-not-allowed disabled:opacity-40"
              title="Save"
            >
              <CheckIcon className="size-4" />
            </button>
          </form>
        ) : (
          <>
            <form
            onSubmit={handleSendMessage}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className="mx-auto flex max-w-[1000px] items-end gap-1 sm:gap-1.5"
          >
          {/* Plus button — quick attach menu */}
          <div className="relative">
            <motion.button
              whileHover={{ scale: 1.08, rotate: 90 }}
              whileTap={{ scale: 0.92 }}
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="composer-btn composer-btn-lg flex shrink-0 items-center justify-center rounded-full"
              aria-label="Attach image"
            >
              <PlusIcon className="size-5" />
            </motion.button>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageChange} className="hidden" />
          </div>

          <div className={`relative flex flex-1 items-center gap-1 rounded-[28px] border px-2 py-1.5 shadow-inner transition-all ${isDragOver ? "composer-drag-over" : ""} ${canSend ? "border-[color:var(--accent-3)]/50 bg-[color:var(--panel-strong)] shadow-[0_0_0_2px_rgba(6,182,212,0.18)]" : "border-white/10 bg-[color:var(--panel-strong)]"}`}>
            {/* Emoji picker */}
            <div ref={emojiRef} className="relative">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                type="button"
                onClick={(e) => { e.stopPropagation(); setEmojiOpen((o) => !o); }}
                className={`composer-btn relative flex size-9 shrink-0 items-center justify-center rounded-full ${emojiOpen ? "is-open" : ""}`}
                title="Emoji"
              >
                <SmileIcon className="size-4" />
              </motion.button>

              {/* Premium emoji picker panel */}
              {emojiOpen && document.body && createPortal(
                  <AnimatePresence>
                    <motion.div
                      key="emoji-picker"
                      ref={pickerRef}
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 28 }}
                      className="flex h-[320px] w-[300px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[color:var(--panel-strong)]/98 shadow-2xl backdrop-blur-2xl"
                      style={{ top: 0, left: 0, position: "fixed", zIndex: 120, ...pickerStyle }}
                    >
                      {/* Search */}
                      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
                        <SearchIcon className="size-3.5 shrink-0 text-[color:var(--text-muted)]" />
                        <input
                          value={emojiSearch}
                          onChange={(e) => setEmojiSearch(e.target.value)}
                          placeholder="Search emojis…"
                          className="w-full bg-transparent text-xs text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
                        />
                      </div>
                      {/* Categories */}
                      {!emojiSearch.trim() && (
                        <div className="scrollbar-thin flex shrink-0 items-center gap-1 overflow-x-auto border-b border-white/10 px-2 py-1.5">
                          {["Recent", ...Object.keys(EMOJI_CATEGORIES)].map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setEmojiCategory(cat)}
                              className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium transition-colors ${
                                emojiCategory === cat
                                  ? "bg-[color:var(--accent-3)]/20 text-[color:var(--accent-3)]"
                                  : "text-[color:var(--text-muted)] hover:bg-white/10"
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Emoji grid */}
                      <div className="scrollbar-thin grid flex-1 grid-cols-8 content-start gap-0.5 overflow-y-auto p-2">
                        {visibleEmojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            className="flex size-8 items-center justify-center rounded-lg text-lg transition-transform hover:scale-125 hover:bg-white/10"
                          >
                            {emoji}
                          </button>
                        ))}
                        {visibleEmojis.length === 0 && (
                          <p className="col-span-8 py-4 text-center text-xs text-[color:var(--text-muted)]">No emojis found</p>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                  , document.body)}
            </div>

            {/* Attach any file */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              type="button"
              onClick={() => fileInputRef2.current?.click()}
              className={`composer-btn flex size-9 shrink-0 items-center justify-center rounded-full ${imagePreview || filePreview ? "text-[color:var(--accent-3)]" : ""}`}
              title="Attach file"
            >
              <PaperclipIcon className="size-4" />
            </motion.button>
            <input type="file" ref={fileInputRef2} onChange={handleFileChange} className="hidden" />

            {/* AI Assistant */}
            <motion.button
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              type="button"
              onClick={onOpenAI}
              className="composer-btn flex size-9 shrink-0 items-center justify-center rounded-full text-[color:var(--accent-3)]"
              title="AI Assistant"
            >
              <SparklesIcon className="size-4" />
            </motion.button>

            <textarea
              ref={textAreaRef}
              value={text}
              rows={1}
              onChange={(e) => {
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
                setText(e.target.value);
                if (e.target.value.trim() && typingTarget) {
                  emitTypingOnce();
                  scheduleTypingStop();
                }
              }}
              onBlur={cancelTyping}
              onKeyDown={handleKeyDown}
              disabled={blocked}
              className="auto-grow-textarea min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]/60 disabled:opacity-50"
              placeholder={blocked ? "You cannot send messages to this user" : isDragOver ? "Drop file to send…" : "Type a message... or drop a file"}
            />

            {/* Voice message — real MediaRecorder */}
            {recordingState === "recording" ? (
              <>
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.94 }}
                  type="button"
                  disabled={blocked}
                  onClick={(e) => { e.stopPropagation(); stopRecording(true); }}
                  className="composer-btn relative flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-400"
                  title="Stop recording"
                >
                  <XIcon className="size-4" />
                </motion.button>
                {/* Live recording timer + wave animation */}
                <span className="absolute -top-9 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-[color:var(--panel-strong)]/95 px-2.5 py-1 text-[10px] font-medium text-rose-400 shadow-xl backdrop-blur-xl">
                  <span className="flex items-end gap-[2px]">
                    {[3, 7, 5, 9, 4, 8, 3, 6].map((h, i) => (
                      <span
                        key={i}
                        className="w-[2px] rounded-full bg-rose-400"
                        style={{ height: `${h}px`, animation: `typing-bounce 0.9s ease-in-out ${i * 0.08}s infinite` }}
                      />
                    ))}
                  </span>
                  {formatRecordTime(recordSeconds)}
                </span>
              </>
            ) : (
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                type="button"
                disabled={blocked}
                onClick={(e) => { e.stopPropagation(); startRecording(); }}
                className={`composer-btn relative flex size-9 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-40 ${
                  recordingState === "processing" ? "recording-pulse bg-amber-500/20 text-amber-400" : ""
                }`}
                title="Record voice message"
              >
                <MicIcon className="size-4" />
              </motion.button>
            )}
          </div>

          {/* Glowing send button */}
          <motion.button
            ref={sendBtnRef}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            animate={{ scale: isSendAnim ? 0.9 : 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            type="submit"
            disabled={!canSend || blocked}
            className="glow-send flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[color:var(--accent)] via-[color:var(--accent-2)] to-[color:var(--accent-3)] text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
            title="Send"
          >
            <SendIcon className="size-5" />
          </motion.button>
          </form>
          <p className="mx-auto mt-2 max-w-[1000px] text-[11px] text-[color:var(--text-muted)]">
            Press Enter to send • Shift + Enter for a new line • Drag & drop files
          </p>
        </>
      )}
      </div>
    </div>
  );
}
export default MessageInput;

