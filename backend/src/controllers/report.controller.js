import Report from "../models/Report.js";
import { validateId } from "../lib/utils.js";

export const reportUser = async (req, res) => {
  try {
    const reporterId = req.user._id;
    const { userId } = req.params;
    validateId(userId, "user id");
    const { reason } = req.body || {};

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: "Please provide a reason for reporting." });
    }

    if (String(reporterId) === String(userId)) {
      return res.status(400).json({ message: "You cannot report yourself." });
    }

    try {
      await Report.create({
        reporter: reporterId,
        reportedUser: userId,
        reason: String(reason).trim().slice(0, 200),
      });
    } catch (createErr) {
      if (createErr?.code === 11000) {
        return res.status(400).json({ message: "You have already reported this user." });
      }
      throw createErr;
    }

    res.status(201).json({ message: "User reported successfully." });
  } catch (error) {
    console.error("Error in reportUser:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
