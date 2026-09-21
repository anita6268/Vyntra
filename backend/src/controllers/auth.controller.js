import { sendWelcomeEmail } from "../emails/emailHandlers.js";
import { generateToken } from "../lib/utils.js";
import User from "../models/User.js";
import Group from "../models/Group.js";
import Message from "../models/Message.js";
import bcrypt from "bcryptjs";
import { ENV } from "../lib/env.js";
import cloudinary from "../lib/cloudinary.js";
import { materializeSubscription } from "../controllers/subscription.controller.js";
import { uploadProfilePic } from "../lib/uploadValidation.js";
import { normalizePhone } from "../lib/phone.js";

export const signup = async (req, res) => {
  const { fullName, email, password, phone } = req.body;

  try {
    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    // check if emailis valid: regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "Email already exists" });

    // 123456 => $dnjasdkasj_?dmsakmk
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      password: hashedPassword,
      phone: phone || "",
      phoneNormalized: phone ? normalizePhone(phone) : "",
      phoneVerified: false,
    });

    if (newUser) {
      // before CR:
      // generateToken(newUser._id, res);
      // await newUser.save();

      // after CR:
      // Persist user first, then issue auth cookie
      const savedUser = await newUser.save();
      generateToken(savedUser._id, res);

      res.status(201).json(serializeUser(savedUser));

      try {
        await sendWelcomeEmail(savedUser.email, savedUser.fullName, ENV.CLIENT_URL);
      } catch (error) {
        console.error("Failed to send welcome email:", error?.message || "Unknown error");
      }
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.error("Error in signup controller:", error?.message || "Unknown error");
    res.status(500).json({ message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    // never tell the client which one is incorrect: password or email

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    generateToken(user._id, res);

    res.status(200).json(serializeUser(user));
  } catch (error) {
    console.error("Error in login controller:", error?.message || "Unknown error");
    res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = (_, res) => {
  res.cookie("jwt", "", { maxAge: 0 });
  res.status(200).json({ message: "Logged out successfully" });
};

// Serialize the authenticated user — never leak the password hash to the client.
export const serializeUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone || "",
  phoneVerified: !!user.phoneVerified,
  username: user.username || "",
  profilePic: user.profilePic || "",
  about: user.about || "",
  role: user.role,
  plan: user.plan,
  isPro: user.isPro,
  billingCycle: user.billingCycle,
  subscriptionStatus: user.subscriptionStatus,
  subscriptionProvider: user.subscriptionProvider || "",
  subscriptionId: user.subscriptionId || "",
  currentPeriodEnd: user.currentPeriodEnd || null,
  autoRenew: user.autoRenew ?? false,
  createdAt: user.createdAt,
  privacy: user.privacy || {
    lastSeenVisibility: "everyone",
    onlineVisibility: "everyone",
    profilePicVisibility: "everyone",
    phoneVisibility: "nobody",
  },
  notifications: user.notifications || {
    messageNotifications: true,
    soundNotifications: true,
    desktopNotifications: false,
  },
});

export const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { fullName, about, profilePic, privacy, notifications, username, phone } = req.body || {};
    const update = {};

    // ── Full name ──
    if (fullName !== undefined) {
      const name = String(fullName).trim();
      if (!name) return res.status(400).json({ message: "Full name cannot be empty." });
      if (name.length > 50) return res.status(400).json({ message: "Full name must be 50 characters or fewer." });
      update.fullName = name;
    }

    // ── About / bio ──
    if (about !== undefined) {
      const bio = String(about).trim();
      if (bio.length > 140) return res.status(400).json({ message: "About must be 140 characters or fewer." });
      update.about = bio;
    }

    // ── Username ──
    if (username !== undefined) {
      const trimmed = String(username).trim().toLowerCase();
      if (trimmed && !/^[a-z0-9_]{3,20}$/.test(trimmed)) {
        return res.status(400).json({ message: "Username must be 3-20 characters, letters, numbers and underscores only." });
      }
      if (trimmed) {
        const existing = await User.findOne({ username: trimmed, _id: { $ne: userId } });
        if (existing) return res.status(400).json({ message: "Username is already taken." });
      }
      update.username = trimmed || "";
    }

    // ── Phone ──
    if (phone !== undefined) {
      const trimmed = String(phone).trim();
      update.phone = trimmed;
      update.phoneNormalized = normalizePhone(trimmed);
      update.phoneVerified = false;
    }

    // ── Profile picture (data URL → Cloudinary) ──
    if (profilePic !== undefined) {
      if (profilePic) {
        update.profilePic = await uploadProfilePic(profilePic, "vyntra/profiles");
      } else {
        update.profilePic = "";
      }
    }

    // ── Privacy visibility (dot-notation to preserve other privacy fields) ──
    if (privacy && typeof privacy === "object") {
      const allowed = ["everyone", "contacts", "nobody"];
      if (privacy.lastSeenVisibility !== undefined) {
        const val = String(privacy.lastSeenVisibility);
        if (!allowed.includes(val)) return res.status(400).json({ message: "Invalid lastSeenVisibility value." });
        update["privacy.lastSeenVisibility"] = val;
      }
      if (privacy.onlineVisibility !== undefined) {
        const val = String(privacy.onlineVisibility);
        if (!allowed.includes(val)) return res.status(400).json({ message: "Invalid onlineVisibility value." });
        update["privacy.onlineVisibility"] = val;
      }
      if (privacy.profilePicVisibility !== undefined) {
        const val = String(privacy.profilePicVisibility);
        if (!allowed.includes(val)) return res.status(400).json({ message: "Invalid profilePicVisibility value." });
        update["privacy.profilePicVisibility"] = val;
      }
      if (privacy.phoneVisibility !== undefined) {
        const val = String(privacy.phoneVisibility);
        if (!allowed.includes(val)) return res.status(400).json({ message: "Invalid phoneVisibility value." });
        update["privacy.phoneVisibility"] = val;
      }
    }

    // ── Notifications (dot-notation to preserve other notification fields) ──
    if (notifications && typeof notifications === "object") {
      if (typeof notifications.messageNotifications === "boolean") {
        update["notifications.messageNotifications"] = notifications.messageNotifications;
      }
      if (typeof notifications.soundNotifications === "boolean") {
        update["notifications.soundNotifications"] = notifications.soundNotifications;
      }
      if (typeof notifications.desktopNotifications === "boolean") {
        update["notifications.desktopNotifications"] = notifications.desktopNotifications;
      }
    }

    if (!Object.keys(update).length) {
      return res.status(400).json({ message: "Nothing to update." });
    }

    const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true });
    if (!updatedUser) return res.status(404).json({ message: "User not found." });

    res.status(200).json(serializeUser(updatedUser));
  } catch (error) {
    console.error("Error in update profile:", error?.message || "Unknown error");
    res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/auth/delete-account
// Permanently deletes the AUTHENTICATED user's account: removes their direct
// messages and removes them from every group, then deletes their record and
// clears the auth cookie. Only the logged-in user can delete their own account.
export const checkAuth = async (req, res) => {
  try {
    materializeSubscription(req.user);
    await req.user.save();
    res.status(200).json(serializeUser(req.user));
  } catch (error) {
    console.error("Error in checkAuth controller:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Drop the user from all group rosters (members + admins).
    await Group.updateMany(
      { $or: [{ members: userId }, { admins: userId }] },
      { $pull: { members: userId, admins: userId } }
    );

    // Remove their direct-message threads.
    await Message.deleteMany({
      $or: [{ senderId: userId }, { receiverId: userId }],
    });

    const deletedUser = await User.findByIdAndDelete(userId);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found." });
    }

    res.cookie("jwt", "", { maxAge: 0 });
    res.status(200).json({ message: "Account deleted." });
  } catch (error) {
    console.error("Error in deleteAccount: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
