import { motion } from "framer-motion";
import { CameraIcon, UserIcon, MailIcon, PhoneIcon, AtSignIcon } from "lucide-react";

const FIELDS = [
  { key: "profilePic", label: "Profile photo", Icon: CameraIcon },
  { key: "fullName", label: "Full name", Icon: UserIcon },
  { key: "about", label: "About", Icon: MailIcon },
  { key: "phone", label: "Phone", Icon: PhoneIcon },
  { key: "username", label: "Username", Icon: AtSignIcon },
];

function ProfileCompletionCard({ profile, onFieldClick }) {
  const filled = FIELDS.filter((f) => {
    const val = profile?.[f.key];
    return typeof val === "string" && val.trim().length > 0;
  }).length;

  const pct = Math.round((filled / FIELDS.length) * 100);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[color:var(--text-primary)]">Profile completion</p>
        <span className="text-xs font-bold text-[color:var(--accent-3)]">{pct}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-3)]"
        />
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {FIELDS.map(({ key, label, Icon }) => {
          const val = profile?.[key];
          const done = typeof val === "string" && val.trim().length > 0;
          return (
            <button
              key={key}
              type="button"
              title={done ? `${label} set` : `${label} missing`}
              onClick={() => onFieldClick?.(key)}
              className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${
                done
                  ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-400"
                  : "border-white/10 bg-white/5 text-[color:var(--text-muted)]"
              }`}
            >
              <Icon className="size-4" />
              <span className="text-[9px] font-medium leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ProfileCompletionCard;
