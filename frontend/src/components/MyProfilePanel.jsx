import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  XIcon,
  CameraIcon,
  PaletteIcon,
  MailIcon,
  UserIcon,
  PhoneIcon,
  AtSignIcon,
  CalendarIcon,
  PenLineIcon,
  BadgeCheckIcon,
  EyeIcon,
  BellIcon,
  ShieldIcon,
  LogOutIcon,
  Trash2Icon,
  Loader2Icon,
  CheckIcon,
  Volume2Icon,
  MonitorIcon,
  Share2Icon,
  Link2Icon,
  ZapIcon,
  AlertTriangleIcon,
  RotateCcwIcon,
  ImageOffIcon,
  ImageIcon,
  ShieldCheckIcon,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import { canUsePremiumFeature, PREMIUM_FEATURES } from "../lib/premiumFeatures";
import { promptUpgrade } from "../lib/premiumGating";
import { THEMES } from "../lib/themes";
import { formatLastSeen } from "../lib/formatLastSeen";
import { useProfilePhotoUpload } from "../hooks/useProfilePhotoUpload";
import ImageViewer from "./ImageViewer";
import ProfileCompletionCard from "./ProfileCompletionCard";
import ShareModal from "./ShareModal";
import ConfirmModal from "./ConfirmModal";
import ProfilePhotoEditor from "./ProfilePhotoEditor";
import CameraCaptureModal from "./CameraCaptureModal";

// Lazy-load ThemeMarketplace so it stays code-split from the initial bundle.
const ThemeMarketplace = lazy(() => import("./ThemeMarketplace"));

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

function VisibilityPicker({ label, value, options, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <span className="text-sm font-medium text-[color:var(--text-primary)]">{label}</span>
      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
              value === opt.value
                ? "bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] text-white"
                : "text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
            } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleRow({ label, icon: Icon, value, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--accent-3)]">
          <Icon className="size-4" />
        </div>
        <span className="text-sm font-medium text-[color:var(--text-primary)]">{label}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${value ? "bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)]" : "bg-white/15"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <span
          className={`absolute top-0.5 block size-5 rounded-full bg-white shadow transition-all ${value ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}

const VISIBILITY_OPTIONS = [
  { value: "everyone", label: "Everyone" },
  { value: "contacts", label: "Contacts" },
  { value: "nobody", label: "Nobody" },
];

function MyProfilePanel({ isOpen, onClose, theme, setTheme }) {
  const { authUser, updateProfile, logout, deleteAccount, onlineUsers } = useAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const editSectionRef = useRef(null);
  const nameInputRef = useRef(null);
  const aboutInputRef = useRef(null);
  const phoneInputRef = useRef(null);
  const usernameInputRef = useRef(null);

  const [isMarketplaceOpen, setIsMarketplaceOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const { uploading, previewUrl, editorSrc, editorOpen, openEditor, closeEditor, saveEditorResult, clearPreview } = useProfilePhotoUpload();
  const [editName, setEditName] = useState("");
  const [editAbout, setEditAbout] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingField, setSavingField] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showRemovePhoto, setShowRemovePhoto] = useState(false);
  const [removingPhoto, setRemovingPhoto] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Track original values for unsaved-changes detection.
  const originalRef = useRef({ name: "", about: "", phone: "", username: "" });

  const attemptClose = useCallback(() => {
    if (unsavedChanges && !savingProfile && savingField !== "privacy" && savingField !== "notifications") {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  }, [unsavedChanges, savingProfile, savingField, onClose]);

    useEffect(() => {
      if (isOpen && authUser) {
        const name = authUser.fullName || "";
        const about = authUser.about || "";
        const phone = authUser.phone || "";
        const username = authUser.username || "";
        setEditName(name);
        setEditAbout(about);
        setEditPhone(phone);
        setEditUsername(username);
        originalRef.current = { name, about, phone, username };
        setUnsavedChanges(false);
        setConfirmDelete(false);
        setDeleteConfirmText("");
        setDeleting(false);
        setShowRemovePhoto(false);
        setRemovingPhoto(false);
        clearPreview();
        setShowUnsavedWarning(false);
        setLoggingOut(false);
      }
    }, [isOpen, authUser, clearPreview]);

    useEffect(() => {
      if (!isOpen) return;
      const handleKey = (e) => {
        if (e.key === "Escape") {
          if (viewerOpen) {
            setViewerOpen(false);
          } else if (shareOpen) {
            setShareOpen(false);
          } else if (confirmDelete) {
            setConfirmDelete(false);
            setDeleteConfirmText("");
          } else if (showRemovePhoto) {
            setShowRemovePhoto(false);
          } else if (showUnsavedWarning) {
            setShowUnsavedWarning(false);
          } else {
            attemptClose();
          }
        }
      };
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }, [isOpen, viewerOpen, shareOpen, confirmDelete, showRemovePhoto, showUnsavedWarning, attemptClose]);

  const currentTheme = THEMES.find((t) => t.key === theme);
  const isOnline = !!authUser?._id && onlineUsers.includes(String(authUser._id));

  const privacy = authUser?.privacy || {};
  const notifications = authUser?.notifications || {};

  // Detect unsaved changes.
  useEffect(() => {
    if (!isOpen) return;
    const changed =
      editName.trim() !== (originalRef.current.name || "").trim() ||
      editAbout.trim() !== (originalRef.current.about || "").trim() ||
      editPhone.trim() !== (originalRef.current.phone || "").trim() ||
      editUsername.trim() !== (originalRef.current.username || "").trim();
    setUnsavedChanges(changed);
  }, [editName, editAbout, editPhone, editUsername, isOpen]);

  const handleSaveProfile = async () => {
    const name = editName.trim();
    if (!name) return toast.error("Full name cannot be empty.");
    if (name.length > 50) return toast.error("Full name must be 50 characters or fewer.");
    if (editAbout.length > 140) return toast.error("About must be 140 characters or fewer.");
    if (editUsername && !/^[a-z0-9_]{3,20}$/.test(editUsername.trim().toLowerCase())) {
      return toast.error("Username must be 3-20 characters, letters, numbers and underscores only.");
    }
    setSavingProfile(true);
    const updateData = { fullName: name, about: editAbout.trim() };
    const hadPhone = !!(originalRef.current.phone || "").trim();
    if (!hadPhone && editPhone.trim()) {
      updateData.phone = editPhone.trim();
    }
    if (editUsername !== (originalRef.current.username || "")) {
      updateData.username = editUsername.trim() ? editUsername.trim().toLowerCase() : "";
    }
    const result = await updateProfile(updateData);
    setSavingProfile(false);
    if (result) {
      originalRef.current = {
        name: editName.trim(),
        about: editAbout.trim(),
        phone: editPhone.trim(),
        username: editUsername.trim().toLowerCase(),
      };
      setUnsavedChanges(false);
      toast.success("Profile updated");
    }
  };

  const changePrivacy = async (key, value) => {
    setSavingField("privacy");
    try {
      await updateProfile({ privacy: { [key]: value } });
    } catch {
      toast.error("Failed to update privacy setting");
    } finally {
      setSavingField(null);
    }
  };

  const changeNotification = async (key, value) => {
    setSavingField("notifications");
    try {
      await updateProfile({ notifications: { [key]: value } });
    } catch {
      toast.error("Failed to update notification setting");
    } finally {
      setSavingField(null);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      onClose();
    } finally {
      setLoggingOut(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== "delete") {
      toast.error('Please type "DELETE" to confirm.');
      return;
    }
    setDeleting(true);
    try {
      const ok = await deleteAccount();
      if (ok) {
        try {
          const keys = [
            "chatify-theme",
            "vyntra-notifications-enabled",
            "isSoundEnabled",
            "aiAssistantOpen",
            "vyntra-notif-read",
            "vyntra-recent-emojis",
            "vyntra-recent-searches",
            "vyntra-wallpaper-settings",
          ];
          for (const k of keys) localStorage.removeItem(k);
          Object.keys(localStorage)
            .filter((k) => k.startsWith("vyntra-wallpaper-"))
            .forEach((k) => localStorage.removeItem(k));
        } catch {
          // ignore storage errors
        }
        navigate("/login");
      } else {
        setDeleting(false);
      }
    } catch {
      setDeleting(false);
    }
  };

  const handleAppearanceClick = () => {
    if (!canUsePremiumFeature(PREMIUM_FEATURES.THEMES)) {
      promptUpgrade("Premium themes are available with Vyntra Pro.");
      return;
    }
    setIsMarketplaceOpen(true);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await openEditor(file);
    e.target.value = "";
  };

  const openGallery = useCallback(() => fileInputRef.current?.click(), []);
  const openCamera = useCallback(() => setCameraOpen(true), []);
  const handleCameraFallback = useCallback(() => {
    setCameraOpen(false);
    openGallery();
  }, [openGallery]);
  const handleCameraCapture = useCallback(async (file) => {
    await openEditor(file);
  }, [openEditor]);

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) await openEditor(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const profilePicSrc = previewUrl || authUser?.profilePic || "/avatar.png";

  const scrollToEdit = (field) => {
    const refMap = {
      fullName: nameInputRef,
      about: aboutInputRef,
      phone: phoneInputRef,
      username: usernameInputRef,
    };
    const targetRef = refMap[field];
    if (targetRef?.current) {
      targetRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      targetRef.current.focus();
    } else if (editSectionRef.current) {
      editSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleFieldClick = (key) => {
    if (key === "profilePic") {
                         openCamera();
      return;
    }
    const fieldMap = {
      fullName: "fullName",
      about: "about",
      phone: "phone",
      username: "username",
    };
    const field = fieldMap[key];
    if (field) {
      scrollToEdit(field);
    }
  };

  const handleRemovePhoto = async () => {
    setRemovingPhoto(true);
    try {
      const result = await updateProfile({ profilePic: "" });
      if (result) {
        clearPreview();
        toast.success("Profile photo removed");
      }
    } catch {
      toast.error("Failed to remove profile photo");
    } finally {
      setRemovingPhoto(false);
      setShowRemovePhoto(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={attemptClose}
            className="fixed inset-0 z-[70] bg-black/55"
          />

          {/* Panel */}
           <motion.aside
             initial={{ x: "100%" }}
             animate={{ x: 0 }}
             exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
              className="fixed right-0 top-0 z-[80] flex h-[100dvh] w-full max-w-sm flex-col overflow-x-hidden border-l border-white/10 bg-[color:var(--panel-strong)]/95 shadow-2xl backdrop-blur-2xl"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
           >
            {/* Header */}
            <div className="relative flex items-center justify-between border-b border-white/10 px-4 py-4">
              <button
                 onClick={attemptClose}
                 className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-primary)] transition-colors hover:bg-white/10"
                 aria-label="Back"
                 title="Back"
               >
                 <ArrowLeft className="size-4" />
               </button>
              <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Profile</h3>
               <button
                 onClick={attemptClose}
                 className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                 aria-label="Close profile"
                 title="Close"
               >
                 <XIcon className="size-4" />
               </button>
            </div>

            <div className="scrollbar-thin flex-1 overflow-y-auto">
              {/* Large avatar + online indicator */}
              <div className="flex flex-col items-center px-5 pb-5 pt-6 text-center">
                <div
                  className="relative cursor-pointer"
                  onClick={() => setViewerOpen(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setViewerOpen(true);
                  }}
                  title="View fullscreen photo"
                >
                  <div className="flex size-28 items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-[color:var(--accent)] via-[color:var(--accent-2)] to-[color:var(--accent-3)] p-[3px] shadow-[0_0_35px_var(--glow)]">
                    <img
                      src={profilePicSrc}
                      alt={authUser?.fullName || "My profile"}
                      className="size-full rounded-full object-cover"
                    />
                  </div>
                  {/* Change photo button */}
                   <motion.button
                     whileHover={{ scale: 1.08 }}
                     whileTap={{ scale: 0.94 }}
                     onClick={(e) => {
                       e.stopPropagation();
                       openCamera();
                     }}
                     className="absolute bottom-2 right-1 flex size-9 items-center justify-center rounded-full border border-white/20 bg-[color:var(--panel-strong)]/95 text-[color:var(--accent-3)] shadow-lg backdrop-blur-md transition-colors hover:bg-[color:var(--accent)]/40"
                     aria-label="Change profile photo"
                     title="Change profile photo"
                     disabled={uploading}
                   >
                    {uploading ? (
                      <Loader2Icon className="size-4 animate-spin" />
                    ) : (
                      <CameraIcon className="size-4" />
                    )}
                  </motion.button>
                   {authUser?.profilePic && !uploading && (
                     <motion.button
                       whileHover={{ scale: 1.08 }}
                       whileTap={{ scale: 0.94 }}
                       onClick={(e) => {
                         e.stopPropagation();
                         setShowRemovePhoto(true);
                       }}
                       className="absolute bottom-2 left-1 flex size-9 items-center justify-center rounded-full border border-white/20 bg-[color:var(--panel-strong)]/95 text-rose-400 shadow-lg backdrop-blur-md transition-colors hover:bg-rose-500/20"
                       aria-label="Remove profile photo"
                       title="Remove profile photo"
                     >
                      <ImageOffIcon className="size-4" />
                    </motion.button>
                  )}
                  <input
                    type="file"
                    accept={ALLOWED_IMAGE_TYPES.join(",")}
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openGallery();
                    }}
                    className="absolute bottom-2 right-[-42px] flex size-9 items-center justify-center rounded-full border border-white/20 bg-[color:var(--panel-strong)]/95 text-[color:var(--accent-3)] shadow-lg backdrop-blur-md transition-colors hover:bg-[color:var(--accent)]/40"
                    aria-label="Choose profile photo from gallery"
                    title="Gallery"
                    disabled={uploading}
                  >
                    <ImageIcon className="size-4" />
                  </button>

                  {/* Online indicator */}
                  <span className={`online-pulse absolute right-0.5 top-1 size-3.5 rounded-full border-2 border-[color:var(--panel)] bg-emerald-400 ${isOnline ? "" : "hidden"}`} />
                </div>

                <div className="mt-4 flex items-center gap-1.5">
                  <h2 className="text-lg font-bold text-[color:var(--text-primary)]">
                    {authUser?.fullName || "—"}
                  </h2>
                  {authUser?.isPro && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg">
                      <ZapIcon className="size-3" /> Pro
                    </span>
                  )}
                  {authUser?.phoneVerified && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400" title="Verified account">
                      <ShieldCheckIcon className="size-3" /> Verified
                    </span>
                  )}
                </div>
                <p className={`mt-1 text-sm ${isOnline ? "text-emerald-400" : "text-[color:var(--text-muted)]"}`}>
                  {isOnline ? "● Online" : authUser?.lastSeen ? formatLastSeen(authUser.lastSeen) : "Offline"}
                </p>
                {authUser?.username && (
                  <p className="mt-1 text-xs text-[color:var(--text-muted)]">@{authUser.username}</p>
                )}
                {authUser?.about && (
                  <p className="mt-1 max-w-[280px] break-words text-sm italic text-[color:var(--text-muted)]">
                    {authUser.about}
                  </p>
                )}
              </div>

              {/* Profile completion */}
              <div className="px-5 pb-4">
                <ProfileCompletionCard profile={authUser} onFieldClick={handleFieldClick} />
              </div>

              {/* Read-only identity info */}
              <div className="space-y-2.5 px-5">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--accent-3)]">
                      <UserIcon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--text-muted)]">Name</p>
                      <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                        {authUser?.fullName || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--accent-3)]">
                      <MailIcon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--text-muted)]">Email</p>
                      <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                        {authUser?.email || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {authUser?.phone ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--accent-3)]">
                        <PhoneIcon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--text-muted)]">Phone</p>
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                            {authUser.phone}
                          </p>
                          {authUser.phoneVerified ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                              <ShieldCheckIcon className="size-2.5" /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
                              Phone number added
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => scrollToEdit("phone")}
                    className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/10 bg-white/5 p-3.5 text-left text-sm font-medium text-[color:var(--text-muted)] transition-colors hover:border-[color:var(--accent-3)]/30 hover:text-[color:var(--text-primary)]"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--accent-3)]">
                      <PhoneIcon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--text-muted)]">Phone</p>
                      <p className="text-sm font-semibold text-[color:var(--text-primary)]">Add phone number</p>
                    </div>
                  </button>
                )}

                {authUser?.username && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--accent-3)]">
                        <AtSignIcon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--text-muted)]">Username</p>
                        <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                          @{authUser.username}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {authUser?.createdAt && (
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--accent-3)]">
                        <CalendarIcon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--text-muted)]">Joined</p>
                        <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">
                          {new Date(authUser.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Current theme / appearance */}
                <button
                  onClick={handleAppearanceClick}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-left transition-colors hover:bg-white/10"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--accent-3)]">
                    <PaletteIcon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--text-muted)]">Appearance</p>
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">
                      {currentTheme?.label || "Dark"}
                    </p>
                  </div>
                  <span className="status-chip">{currentTheme?.label || "Dark"}</span>
                </button>
              </div>

              {/* Divider */}
              <div className="my-4 h-px bg-white/10" />

              {/* Edit profile */}
              <div ref={editSectionRef} className="space-y-2 px-5 pb-4">
                <div className="flex items-center justify-between px-1">
                  <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
                    <PenLineIcon className="size-3.5 text-[color:var(--accent-3)]" /> Edit Profile
                  </h4>
                  {unsavedChanges && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditName(originalRef.current.name);
                        setEditAbout(originalRef.current.about);
                        setEditPhone(originalRef.current.phone);
                        setEditUsername(originalRef.current.username);
                        setUnsavedChanges(false);
                        toast.success("Changes discarded");
                      }}
                      className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                    >
                      <RotateCcwIcon className="size-3" /> Reset
                    </button>
                  )}
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
                  <label className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-[color:var(--text-muted)]">
                    <span className="flex items-center gap-1.5"><UserIcon className="size-3 text-[color:var(--accent-3)]" /> Full name</span>
                    <span className={`font-mono ${editName.length > 50 ? "text-rose-400" : "text-[color:var(--text-muted)]/60"}`}>{editName.length}/50</span>
                  </label>
                  <input
                    ref={nameInputRef}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={50}
                    placeholder="Your name"
                    aria-label="Full name"
                    className={`w-full rounded-xl border bg-white/[0.03] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)]/50 focus:border-[color:var(--accent-3)]/50 ${editName.length > 50 ? "border-rose-500/50" : "border-white/10"}`}
                  />

                  <label className="mb-1 mt-3 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-[color:var(--text-muted)]">
                    <span className="flex items-center gap-1.5"><MailIcon className="size-3 text-[color:var(--accent-3)]" /> About / status</span>
                    <span className={`font-mono ${editAbout.length > 140 ? "text-rose-400" : "text-[color:var(--text-muted)]/60"}`}>{editAbout.length}/140</span>
                  </label>
                  <textarea
                    ref={aboutInputRef}
                    value={editAbout}
                    onChange={(e) => setEditAbout(e.target.value)}
                    maxLength={140}
                    rows={3}
                    placeholder="Available"
                    aria-label="About"
                    className={`w-full resize-none rounded-xl border bg-white/[0.03] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)]/50 focus:border-[color:var(--accent-3)]/50 ${editAbout.length > 140 ? "border-rose-500/50" : "border-white/10"}`}
                  />

                  <label className="mb-1 mt-3 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-[color:var(--text-muted)]">
                    <span className="flex items-center gap-1.5"><PhoneIcon className="size-3 text-[color:var(--accent-3)]" /> Phone number</span>
                  </label>
                  {authUser?.phone ? (
                    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{authUser.phone}</p>
                        <p className="mt-0.5 text-[10px] text-[color:var(--text-muted)]/70">Managed through account verification</p>
                      </div>
                      {authUser.phoneVerified ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400">
                          <ShieldCheckIcon className="size-2.5" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-400">
                          Phone number added
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <input
                        ref={phoneInputRef}
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="+1 555 000 0000"
                        maxLength={20}
                        aria-label="Phone number"
                        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)]/50 focus:border-[color:var(--accent-3)]/50"
                      />
                      <p className="mt-1 text-[10px] text-[color:var(--text-muted)]/60">Phone number verification is required.</p>
                    </>
                  )}

                  <label className="mb-1 mt-3 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-[color:var(--text-muted)]">
                    <span className="flex items-center gap-1.5"><AtSignIcon className="size-3 text-[color:var(--accent-3)]" /> Username</span>
                    <span className={`font-mono ${editUsername.length > 20 || (editUsername.length > 0 && editUsername.length < 3) ? "text-rose-400" : "text-[color:var(--text-muted)]/60"}`}>{editUsername.length}/20</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[color:var(--text-muted)]">@</span>
                    <input
                      ref={usernameInputRef}
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      maxLength={20}
                      placeholder="username"
                      aria-label="Username"
                      className={`w-full rounded-xl border bg-white/[0.03] px-3 py-2 pl-7 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)]/50 focus:border-[color:var(--accent-3)]/50 ${editUsername.length > 0 && editUsername.length < 3 ? "border-rose-500/50" : "border-white/10"}`}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-[color:var(--text-muted)]/60">3-20 chars, letters, numbers and underscores</p>

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditName(originalRef.current.name);
                        setEditAbout(originalRef.current.about);
                        setEditPhone(originalRef.current.phone);
                        setEditUsername(originalRef.current.username);
                        setUnsavedChanges(false);
                      }}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveProfile}
                      disabled={savingProfile || !unsavedChanges}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[color:var(--accent)] via-[color:var(--accent-2)] to-[color:var(--accent-3)] px-4 py-2 text-sm font-bold text-white transition-opacity disabled:opacity-60"
                    >
                      {savingProfile ? <Loader2Icon className="size-4 animate-spin" /> : <CheckIcon className="size-4" />}
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>

              {/* Share */}
              <div className="mx-5 mb-2 h-px bg-white/10" />
              <div className="space-y-2 px-5 pb-3">
                 <button
                   onClick={() => setShareOpen(true)}
                   className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-left text-sm font-medium text-[color:var(--text-primary)] transition-colors hover:bg-white/10"
                   aria-label="Share profile"
                 >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--accent-3)]">
                    <Share2Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--text-muted)]">Share</p>
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">Share profile</p>
                  </div>
                  <Link2Icon className="size-4 text-[color:var(--text-muted)]" />
                </button>
              </div>

              {/* Privacy */}
              <div className="mx-5 mb-2 h-px bg-white/10" />
               <div className="space-y-2 px-5 pb-3">
                 <h4 className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
                   <EyeIcon className="size-3.5 text-[color:var(--accent-3)]" /> Privacy
                   <span className="ml-auto" aria-live="polite">
                     {savingField === "privacy" && <Loader2Icon className="size-3 animate-spin text-[color:var(--accent-3)]" />}
                   </span>
                 </h4>
                <VisibilityPicker
                  label="Last seen"
                  value={privacy.lastSeenVisibility || "everyone"}
                  options={VISIBILITY_OPTIONS}
                  onChange={(v) => changePrivacy("lastSeenVisibility", v)}
                  disabled={savingField === "privacy"}
                />
                <VisibilityPicker
                  label="Online status"
                  value={privacy.onlineVisibility || "everyone"}
                  options={VISIBILITY_OPTIONS}
                  onChange={(v) => changePrivacy("onlineVisibility", v)}
                  disabled={savingField === "privacy"}
                />
                <VisibilityPicker
                  label="Profile photo"
                  value={privacy.profilePicVisibility || "everyone"}
                  options={VISIBILITY_OPTIONS}
                  onChange={(v) => changePrivacy("profilePicVisibility", v)}
                  disabled={savingField === "privacy"}
                />
              </div>

              {/* Notifications */}
              <div className="mx-5 mb-2 h-px bg-white/10" />
               <div className="space-y-2 px-5 pb-3">
                 <h4 className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
                   <BellIcon className="size-3.5 text-[color:var(--accent-3)]" /> Notifications
                   <span className="ml-auto" aria-live="polite">
                     {savingField === "notifications" && <Loader2Icon className="size-3 animate-spin text-[color:var(--accent-3)]" />}
                   </span>
                 </h4>
                <ToggleRow
                  label="Message notifications"
                  icon={BellIcon}
                  value={notifications.messageNotifications !== false}
                  onChange={(v) => changeNotification("messageNotifications", v)}
                  disabled={savingField === "notifications"}
                />
                <ToggleRow
                  label="Sound"
                  icon={Volume2Icon}
                  value={notifications.soundNotifications !== false}
                  onChange={(v) => changeNotification("soundNotifications", v)}
                  disabled={savingField === "notifications"}
                />
                <ToggleRow
                  label="Desktop notifications"
                  icon={MonitorIcon}
                  value={notifications.desktopNotifications === true}
                  onChange={(v) => changeNotification("desktopNotifications", v)}
                  disabled={savingField === "notifications"}
                />
              </div>

              {/* Account */}
              <div className="mx-5 mb-2 h-px bg-white/10" />
              <div className="space-y-2 px-5 pb-3">
                <h4 className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
                  <ShieldIcon className="size-3.5 text-[color:var(--accent-3)]" /> Account
                </h4>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left text-sm font-medium text-[color:var(--text-primary)] transition-colors hover:bg-white/10 disabled:opacity-60"
                >
                  {loggingOut ? <Loader2Icon className="size-4 animate-spin" /> : <LogOutIcon className="size-4 text-[color:var(--text-muted)]" />}
                  {loggingOut ? "Logging out..." : "Log out"}
                </button>
              </div>

              {/* Danger Zone */}
              <div className="mx-5 mb-2 h-px bg-rose-500/20" />
              <div className="space-y-2 px-5 pb-6">
                <h4 className="flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-rose-400">
                  <AlertTriangleIcon className="size-3.5" /> Danger Zone
                </h4>
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
                  <p className="text-xs text-rose-300/80">
                    Deleting your account is permanent and cannot be undone. All your messages, group memberships and data will be removed.
                  </p>
                   <button
                     onClick={() => {
                       setDeleteConfirmText("");
                       setConfirmDelete(true);
                     }}
                     className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm font-semibold text-rose-400 transition-colors hover:bg-rose-500/20"
                     aria-label="Delete account"
                   >
                    <Trash2Icon className="size-4" /> Delete account
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>

          {/* Fullscreen image viewer */}
          <ImageViewer
            src={profilePicSrc}
            alt={authUser?.fullName || "My profile"}
            isOpen={viewerOpen}
            onClose={() => setViewerOpen(false)}
          />

          {/* Profile photo editor */}
          <ProfilePhotoEditor
            isOpen={editorOpen}
            onClose={closeEditor}
            imageSrc={editorSrc}
            onSave={saveEditorResult}
            uploading={uploading}
          />
          <CameraCaptureModal
            isOpen={cameraOpen}
            onClose={() => setCameraOpen(false)}
            onFallback={handleCameraFallback}
            onCapture={handleCameraCapture}
          />

          {/* Share modal */}
          <ShareModal
            isOpen={shareOpen}
            onClose={() => setShareOpen(false)}
            profile={authUser}
          />

          {/* Unsaved changes warning */}
          <ConfirmModal
            isOpen={showUnsavedWarning}
            onClose={() => {
              setShowUnsavedWarning(false);
            }}
            onConfirm={() => {
              setShowUnsavedWarning(false);
              onClose();
            }}
            title="Unsaved changes"
            description="You have unsaved profile changes. Are you sure you want to discard them?"
            confirmLabel="Discard"
            confirmVariant="danger"
          />

          {/* Remove photo confirmation */}
          {showRemovePhoto && (
            <ConfirmModal
              isOpen={showRemovePhoto}
              onClose={() => setShowRemovePhoto(false)}
              onConfirm={handleRemovePhoto}
              title="Remove profile photo?"
              description="This will remove your current profile photo and revert to the default avatar."
              confirmLabel={removingPhoto ? "Removing..." : "Remove photo"}
              confirmVariant="danger"
              disabled={removingPhoto}
            />
          )}

          {/* Delete account confirmation */}
          {confirmDelete && (
            <ConfirmModal
              isOpen={confirmDelete}
              onClose={() => {
                setConfirmDelete(false);
                setDeleteConfirmText("");
              }}
              onConfirm={handleDeleteAccount}
              title="Delete account?"
              description={
                <div className="space-y-3">
                  <p>
                    This permanently deletes your account, messages and group memberships.{" "}
                    <span className="font-semibold text-[color:var(--text-primary)]">This cannot be undone.</span>
                  </p>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-rose-300">
                      Type <span className="font-bold">DELETE</span> to confirm
                    </label>
                    <input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                      autoComplete="off"
                      className="w-full rounded-xl border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-[color:var(--text-primary)] outline-none transition-colors placeholder:text-[color:var(--text-muted)]/50 focus:border-rose-400/50"
                    />
                  </div>
                </div>
              }
              confirmLabel={deleting ? "Deleting..." : "Delete account permanently"}
              confirmVariant="danger"
              disabled={deleting || deleteConfirmText.trim().toLowerCase() !== "delete"}
            />
          )}

          <Suspense fallback={null}>
            <ThemeMarketplace
              isOpen={isMarketplaceOpen}
              onClose={() => setIsMarketplaceOpen(false)}
              currentTheme={theme}
              onApply={(key) => setTheme(key)}
            />
          </Suspense>
        </>
      )}
    </AnimatePresence>
  );
}

export default MyProfilePanel;
