import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router";
import {
  XIcon,
  ImageIcon,
  PhoneIcon,
  AtSignIcon,
  UserIcon,
  Loader2Icon,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { formatLastSeen } from "../lib/formatLastSeen";
import ImageViewer from "../components/ImageViewer";

function PublicProfilePage() {
  const { username } = useParams();
  const { authUser } = useAuthStore();
  const { onlineUsers } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/users/public/${encodeURIComponent(username)}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error("User not found");
          throw new Error("Failed to load profile");
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load profile");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [username]);

  if (!authUser) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2Icon className="size-8 animate-spin text-[color:var(--accent-3)]" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-rose-400">{error || "User not found"}</p>
        <p className="text-xs text-[color:var(--text-muted)]">
          The profile you are looking for does not exist or is no longer available.
        </p>
      </div>
    );
  }

  const isOnline = onlineUsers.includes(String(profile._id)) && profile.showOnline !== false;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">Profile</h3>
        <Navigate to="/" replace />
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="flex flex-col items-center p-5 text-center">
          <div
            className="mb-3 flex size-24 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-gradient-to-br from-[color:var(--accent)] to-[color:var(--accent-3)] p-[3px] shadow-[0_0_30px_var(--glow)]"
            onClick={() => profile.profilePic && setViewerOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setViewerOpen(true);
            }}
            title="View fullscreen photo"
          >
            <img
              src={profile.profilePic || "/avatar.png"}
              alt={profile.fullName}
              className="size-full rounded-full object-cover"
            />
          </div>
          <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{profile.fullName}</h3>
          {profile.username && (
            <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">@{profile.username}</p>
          )}
          <p className={`mt-1 text-sm ${isOnline ? "text-emerald-400" : "text-[color:var(--text-muted)]"}`}>
            {isOnline ? "● Online now" : profile.lastSeen ? formatLastSeen(profile.lastSeen) : "Offline"}
          </p>
          {profile.about && (
            <p className="mt-1 max-w-[260px] break-words text-sm italic text-[color:var(--text-muted)]">
              {profile.about}
            </p>
          )}
        </div>

        <div className="space-y-2 px-5 pb-6">
          {profile.profilePic && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--accent-3)]">
                  <ImageIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--text-muted)]">Photo</p>
                  <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">Available</p>
                </div>
              </div>
            </div>
          )}
          {profile.phone && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[color:var(--accent-3)]">
                  <PhoneIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[color:var(--text-muted)]">Phone</p>
                  <p className="truncate text-sm font-semibold text-[color:var(--text-primary)]">{profile.phone}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ImageViewer
        src={profile.profilePic}
        alt={profile.fullName}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
}

export default PublicProfilePage;
