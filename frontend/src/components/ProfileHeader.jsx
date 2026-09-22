import { useCallback, useState, useRef, lazy, Suspense } from "react";
import { LogOutIcon, VolumeOffIcon, Volume2Icon, PaletteIcon, ZapIcon, CameraIcon, ImageIcon, Loader2Icon } from "lucide-react";
import { motion } from "framer-motion";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import usePremiumStore from "../store/usePremiumStore";
import { THEMES } from "../lib/themes";
import { canUsePremiumFeature, PREMIUM_FEATURES } from "../lib/premiumFeatures";
import { promptUpgrade } from "../lib/premiumGating";
import { useProfilePhotoUpload } from "../hooks/useProfilePhotoUpload";
import ProfilePhotoEditor from "./ProfilePhotoEditor";
import CameraCaptureModal from "./CameraCaptureModal";
import UserAvatar from "./UserAvatar";

// Lazy-load ThemeMarketplace so it is code-split out of the initial bundle
// (it only mounts when the user opens the theme picker).
const ThemeMarketplace = lazy(() => import("./ThemeMarketplace"));

const mouseClickSound = new Audio("/sounds/mouse-click.mp3");
mouseClickSound.load();

// Uniform circular glass action button used in the profile card. Every button
// shares the same size, shape, border and hover glow so the card never looks
// crowded. Icon-only by design — `aria-label` provides the accessible name.
function ActionButton({ icon: Icon, label, onClick, onContextMenu, children, danger = false, disabled = false }) {
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      disabled={disabled}
      aria-label={label}
      className={`relative flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--text-muted)] backdrop-blur-xl transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)] ${
        danger
          ? "hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-300"
          : "hover:border-[color:var(--accent-3)]/40"
      }`}
    >
      {children ?? <Icon className="size-4" />}
    </motion.button>
  );
}

function ProfileHeader({ theme, setTheme, onOpenMyProfile }) {
  const { logout, authUser, onlineUsers } = useAuthStore();
  const { isSoundEnabled, toggleSound, testSound } = useChatStore();
  const { isPro } = usePremiumStore();
  const [isMarketplaceOpen, setIsMarketplaceOpen] = useState(false);

  const fileInputRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const { uploading, previewUrl, editorSrc, editorOpen, openEditor, closeEditor, saveEditorResult } = useProfilePhotoUpload();

  const isOnline = !!authUser?._id && onlineUsers.includes(String(authUser._id));

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
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

  const currentTheme = THEMES.find((t) => t.key === theme);

  const handleThemeClick = () => {
    if (!canUsePremiumFeature(PREMIUM_FEATURES.THEMES)) {
      // Free users see the upgrade prompt + unified Vyntra Pro modal.
      promptUpgrade("Premium themes are available with Vyntra Pro.");
      return;
    }
    setIsMarketplaceOpen(true);
  };

  return (
    <div className="border-b border-white/[0.08] px-4 pb-3 pt-4">
      {/* Animated gradient logo */}
      <div className="mb-3 flex items-center gap-2.5">
        <div className="relative flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-[color:var(--accent)] via-[color:var(--accent-2)] to-[color:var(--accent-3)] shadow-[0_0_10px_var(--glow)]">
          <ZapIcon className="size-4 text-white" />
        </div>
        <div>
          <h2 className="animated-gradient-text text-base font-bold leading-none tracking-tight">Vyntra</h2>
          <p className="text-[9px] font-medium uppercase tracking-widest text-[color:var(--text-muted)]">Messenger</p>
        </div>
      </div>

      {/* Premium profile card — compact glass with a clean visual hierarchy */}
      <div className="glass-card flex items-center gap-3 px-3 py-2">
        {/* Left: avatar + name/PRO + theme badge — opens My Profile */}
        <button
          type="button"
          onClick={() => onOpenMyProfile?.()}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
          aria-label="Open My Profile"
        >
          <UserAvatar
            src={previewUrl || authUser?.profilePic}
            name={authUser?.fullName}
            size={52}
            online={isOnline}
            className="size-12 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[15px] font-bold leading-tight text-[color:var(--text-primary)]">
                {authUser?.fullName}
              </h3>
              {isPro && (
                <span className="shrink-0 rounded-full bg-[color:var(--accent-3)]/12 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[color:var(--accent)]">
                  PRO
                </span>
              )}
            </div>
            <span className="mt-1 inline-flex items-center gap-1.5 text-[10px] text-[color:var(--text-muted)]">
              <span className={`inline-flex size-1.5 shrink-0 rounded-full ${isOnline ? "bg-emerald-400" : "bg-slate-500"}`} />
              {currentTheme?.label || "Dark"}
            </span>
          </div>
        </button>

        {/* Right: compact action buttons (change photo / theme / sound / logout) */}
        <div className="flex shrink-0 items-center gap-1">
          <div className="relative">
            <ActionButton
              icon={CameraIcon}
              label="Change profile photo"
              disabled={uploading}
              onClick={(e) => {
                e.stopPropagation();
                openCamera();
              }}
            >
              {uploading ? <Loader2Icon className="size-3.5 animate-spin" /> : <CameraIcon className="size-3.5" />}
            </ActionButton>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
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
              disabled={uploading}
              aria-label="Choose profile photo from gallery"
              title="Gallery"
              className="absolute -right-9 top-0 flex size-7 items-center justify-center rounded-full border border-white/10 bg-[color:var(--panel-strong)] text-[color:var(--text-muted)] transition-colors hover:bg-white/10 hover:text-[color:var(--text-primary)]"
            >
              <ImageIcon className="size-3.5" />
            </button>
          </div>
          <ActionButton
            icon={PaletteIcon}
            label={isPro ? "Theme palette" : "Theme palette (PRO)"}
            onClick={(e) => {
              e.stopPropagation();
              handleThemeClick();
            }}
          />
          <ActionButton
            icon={isSoundEnabled ? Volume2Icon : VolumeOffIcon}
            label="Toggle sound"
            onClick={() => {
            if (isSoundEnabled) {
                mouseClickSound.currentTime = 0;
                mouseClickSound.play().catch(() => {});
              }
              toggleSound();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              testSound();
            }}
          />
          <ActionButton icon={LogOutIcon} label="Logout" danger onClick={() => logout()} />
          <Suspense fallback={null}>
            <ThemeMarketplace
              isOpen={isMarketplaceOpen}
              onClose={() => setIsMarketplaceOpen(false)}
              currentTheme={theme}
              onApply={(key) => setTheme(key)}
            />
          </Suspense>
        </div>
      </div>

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
    </div>
  );
}
export default ProfileHeader;
