import AIHistory from "../models/AIHistory.js";
import { validateId } from "../lib/utils.js";

// GET /api/ai/history
// Fetch the current user's AI history, newest first.
export const getMyAIHistory = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 200);
    const records = await AIHistory.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.status(200).json(records);
  } catch (error) {
    console.error("Error in getMyAIHistory:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/ai/history/:id — delete a single AI history entry.
// Backend enforces ownership: only the record's owner may delete it.
export const deleteAIHistory = async (req, res) => {
  try {
    const { id } = req.params;
    validateId(id, "ai history id");
    const myId = req.user._id;

    const record = await AIHistory.findOne({ _id: id, userId: myId });
    if (!record) {
      return res.status(404).json({ message: "AI history entry not found." });
    }

    await AIHistory.findByIdAndDelete(id);
    res.status(200).json({ message: "AI history entry deleted." });
  } catch (error) {
    console.error("Error in deleteAIHistory:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

// DELETE /api/ai/history — clear the ENTIRE AI history for the current user.
export const clearAIHistory = async (req, res) => {
  try {
    const result = await AIHistory.deleteMany({ userId: req.user._id });
    res.status(200).json({
      message: "AI history cleared.",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error in clearAIHistory:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
};
