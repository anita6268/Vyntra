import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    profilePic: {
      type: String,
      default: "",
    },
    // Optional phone number — used for contact search & profile display.
    // Stored exactly as entered; matching is substring/case-insensitive so
    // users can find each other by number just like a real messaging app.
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    phoneNormalized: {
      type: String,
      default: "",
      trim: true,
      index: true,
      sparse: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    // Users this user has blocked. When blocked, the blocked user cannot send
    // messages to this user, and their messages are hidden from this user.
    blockedUsers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    // Users whose notifications are muted for this user.
    mutedUsers: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    // Conversations pinned by this user (chat partner ids). Sorted to the top of the Chats list.
    pinnedChats: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    // Last time this user was seen online (null while they are online).
    lastSeen: {
      type: Date,
      default: null,
    },
    // Short unique handle for sharing and mentions. Must be unique, 3-20 chars,
    // lowercase alphanumeric + underscore. Optional at signup; can be set later.
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 20,
      match: [/^[a-z0-9_]+$/, "Username can only contain letters, numbers and underscores"],
    },
    // Short profile bio/status shown on the user's own + other profiles.
    about: {
      type: String,
      default: "",
      trim: true,
      maxlength: 140,
    },
    // Privacy: who may view each piece of presence/profile data. Each value is one
    // of "everyone" | "contacts" | "nobody" and is applied when OTHER users view
    // this user (a user always sees their own full record).
    privacy: {
      lastSeenVisibility: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      onlineVisibility: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      profilePicVisibility: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      phoneVisibility: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "nobody",
      },
    },
    // Per-user notification preferences (sound also exists as a UI toggle in the
    // chat store; this persists the user's preference on their account).
    notifications: {
      messageNotifications: { type: Boolean, default: true },
      soundNotifications: { type: Boolean, default: true },
      desktopNotifications: { type: Boolean, default: false },
    },
    // Account classification. Only real users ("user"/"admin") are exposed to
    // other clients (Contacts, search, forward picker). "test" and "system"
    // accounts are QA/automation records and are excluded from those queries.
    role: {
      type: String,
      enum: ["user", "admin", "test", "system"],
      default: "user",
    },
    // Subscription plan. "free" by default; "pro" unlocks premium features.
    plan: {
      type: String,
      enum: ["free", "pro"],
      default: "free",
    },
    // Convenience flag for quick Pro feature checks.
    isPro: {
      type: Boolean,
      default: false,
    },
    // ── Real subscription fields (source of truth = this MongoDB document) ──
    // Billing cycle chosen at checkout.
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },
    // Lifecycle of the subscription. "active" = paid & Pro unlocked;
    // "inactive" = free / not subscribed / canceled.
    subscriptionStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "inactive",
    },
    // Payment provider used for this subscription (set when a gateway is wired).
    subscriptionProvider: {
      type: String,
      enum: ["none", "stripe", "razorpay", ""],
      default: "",
    },
    // Provider subscription id (created by the payment gateway after checkout).
    subscriptionId: {
      type: String,
      default: "",
    },
    // When the current paid period ends. Pro access is revoked afterwards.
    currentPeriodEnd: {
      type: Date,
      default: null,
    },
    // Whether the provider will auto-renew at the end of the current period.
    autoRenew: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true } // createdAt & updatedAt
);

const User = mongoose.model("User", userSchema);

export default User;

