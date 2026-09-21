// Groq is the primary AI provider with automatic Gemini fallback (lib/ai.js).
import { generate, formatMessages, friendlyError, errorToHttpStatus, errorToCode } from "../lib/ai.js";
import { parseAiJsonObject, sanitizeAiText } from "../lib/aiOutput.js";
import { AIProviderError, AI_CATEGORIES } from "../lib/aiErrors.js";
import AIHistory from "../models/AIHistory.js";

const saveAIHistory = async (userId, feature, input, result) => {
  try {
    if (!userId || !feature || !input || !result) return;
    const trimmedInput = String(input).trim().slice(0, 5000);
    const trimmedResult = String(result).trim().slice(0, 5000);
    if (!trimmedInput || !trimmedResult) return;

    const recent = new Date(Date.now() - 3000);
    const duplicate = await AIHistory.findOne({
      userId,
      feature,
      input: trimmedInput,
      result: trimmedResult,
      createdAt: { $gte: recent },
    });
    if (duplicate) return;

    await AIHistory.create({ userId, feature, input: trimmedInput, result: trimmedResult });
  } catch (err) {
    console.error("Failed to save AI history:", err.message);
  }
};

// POST /api/ai/translate
// Input: { text, targetLanguage }
// Output: { translatedText }
export const translateAI = async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;
    if (!text || !targetLanguage) {
      return res.status(400).json({ message: "text and targetLanguage are required." });
    }
    const providerOutput = await generate(
      "You are a professional translator. Translate the user's text into the requested target language. Return ONLY the translated text with no explanations, quotes, or extra commentary.",
      `Translate the following text into ${targetLanguage}:\n\n${text}`,
      { temperature: 0.3 }
    );
    const translatedText = sanitizeAiText(providerOutput);
    if (!translatedText) {
      return res.status(502).json({ message: "Translation provider returned empty output." });
    }
    await saveAIHistory(req.user._id, "translate", text, translatedText);
    res.status(200).json({ translatedText });
  } catch (error) {
    console.error("Error in translateAI:", error?.message || "Unknown error");
    const status = errorToHttpStatus(error);
    res.status(status).json({ code: errorToCode(error), message: friendlyError(error) });
  }
};

// POST /api/ai/summarize
// Input: { messages: [] }
// Output: { summary }
export const summarizeAI = async (req, res) => {
  try {
    const { messages } = req.body;
    const transcript = formatMessages(messages);
    if (!transcript) {
      return res.status(200).json({ summary: "No messages to summarize yet." });
    }
    const summary = sanitizeAiText(await generate(
      "You are a concise conversation summarizer inside a messaging app. Summarize the key points, topics, action items, and tone of the conversation in a clear, bullet-friendly paragraph. Do not include filler.",
      `Summarize this conversation:\n\n${transcript}`,
      { temperature: 0.4 }
    ));
    await saveAIHistory(req.user._id, "summarize", transcript, summary);
    res.status(200).json({ summary });
  } catch (error) {
    console.error("Error in summarizeAI:", error?.message || "Unknown error");
    const status = errorToHttpStatus(error);
    res.status(status).json({ code: errorToCode(error), message: friendlyError(error) });
  }
};

// POST /api/ai/grammar
// Input: { text }
// Output: { success, result } on success or { success, code, message } on failure
export const grammarAI = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, code: "INVALID_INPUT", message: "text is required." });
    }
    const correctedText = sanitizeAiText(await generate(
      "You are a grammar and spelling correction assistant. Correct the given text for grammar, spelling, punctuation, and capitalization. Return ONLY the corrected text with no explanations.",
      `Correct the grammar and spelling of this text:\n\n${text}`,
      { temperature: 0.2 }
    ));
    await saveAIHistory(req.user._id, "grammar", text, correctedText);
    res.status(200).json({ success: true, result: correctedText });
  } catch (error) {
    console.error("Error in grammarAI:", error?.message || "Unknown error");
    const status = errorToHttpStatus(error);
    const code = errorToCode(error);
    res.status(status).json({ success: false, code, message: friendlyError(error) });
  }
};

// POST /api/ai/meeting-notes
// Input: { transcript, imageUrls? }
// Output: { success, notes } where notes is structured JSON or a status string
export const meetingNotesAI = async (req, res) => {
  try {
    const { transcript, imageUrls } = req.body;
    if (!transcript || !transcript.trim()) {
      return res.status(200).json({
        success: true,
        notes: {
          summary: "No conversation content available for Meeting Notes.",
          discussionPoints: [],
          decisions: [],
          actionItems: [],
          nextSteps: [],
        },
      });
    }

    const trimmed = transcript.trim();
    const messageLines = trimmed.split("\n").filter((line) => line.trim());
    const safeImageUrls = Array.isArray(imageUrls) ? imageUrls.filter((u) => typeof u === "string" && u.trim()) : [];

    const isMediaPlaceholder = (line) => {
      const trimmedLine = line.trim().toLowerCase();
      return (
        trimmedLine.endsWith(": [shared image]") ||
        trimmedLine.endsWith(": [voice message]") ||
        trimmedLine.endsWith(": [shared file]") ||
        trimmedLine.endsWith(": [media]")
      );
    };

    const substantiveLines = messageLines.filter((line) => !isMediaPlaceholder(line));

    const imageContext = safeImageUrls.length > 0
      ? `\n\nNote: ${safeImageUrls.length} image(s) were shared in this conversation. Only reference them if the AI can actually infer content from context; otherwise ignore them.`
      : "";

    const notes = await generate(
      `You are a conversation notes assistant inside a messaging app. Analyze the supplied conversation transcript and return structured notes as a valid JSON object ONLY — no markdown, no code fences, no extra text.

The conversation can be anything: casual chat, project discussion, planning, study talk, personal conversation, short messages, or long threads. Do NOT require it to look like a formal business meeting.

Rules:
- Do NOT invent decisions, action items, next steps, or topics that are not clearly supported by the transcript.
- For extremely short or meaningless exchanges (e.g., only greetings like "hlo"/"hi"), return:
  { "summary": "Not enough meaningful conversation to generate detailed notes.", "discussionPoints": [], "decisions": [], "actionItems": [], "nextSteps": [] }
- For short but meaningful conversations, provide an honest concise summary and leave empty arrays for sections with no real content.
- For longer meaningful conversations, include actual discussion points, decisions, action items, and next steps extracted from the transcript.
- Use the exact JSON shape below:

{
  "summary": "2-3 sentences summarizing the actual conversation.",
  "discussionPoints": ["actual topic or point from the transcript"],
  "decisions": ["actual decision"] or [],
  "actionItems": ["actual assigned task"] or [],
  "nextSteps": ["actual next step"] or []
}

If a section has no items, return an empty array for that key.${imageContext}`,
      `Conversation transcript:\n\n${trimmed}`,
      { temperature: 0.4 }
    );

    const parsedNotes = parseAiJsonObject(notes) || {
        summary: sanitizeAiText(notes) || "Not enough meaningful conversation to generate detailed notes.",
        discussionPoints: [],
        decisions: [],
        actionItems: [],
        nextSteps: [],
      };

    await saveAIHistory(req.user._id, "meeting-notes", transcript, JSON.stringify(parsedNotes));
    res.status(200).json({ success: true, notes: parsedNotes });
  } catch (error) {
    console.error("Error in meetingNotesAI:", error?.message || "Unknown error");
    const status = errorToHttpStatus(error);
    const code = errorToCode(error);
    res.status(status).json({ success: false, code, message: friendlyError(error) });
  }
};

// POST /api/ai/reply-suggestion
// Input: { messages: [] }
// Output: { reply } — ONE complete conversational reply to the latest message
export const replySuggestionAI = async (req, res) => {
  try {
    const { messages } = req.body;
    const transcript = formatMessages(messages);
    if (!transcript) {
      return res.status(200).json({ reply: "You can reply once there's a message to respond to." });
    }
    const reply = sanitizeAiText(await generate(
      "You are a helpful assistant inside a messaging app. Generate ONE complete conversational response based on the latest incoming message. The reply should feel natural, context-appropriate, and complete — as if the user is typing it themselves. Return ONLY the reply text with no quotes, labels, or explanations.",
      `Conversation so far:\n\n${transcript}\n\nWrite a single reply to the latest incoming message:`,
      { temperature: 0.7 }
    ));
    if (!reply) {
      throw new AIProviderError(
        "reply-suggestion",
        AI_CATEGORIES.INVALID,
        "Reply suggestion provider returned empty output."
      );
    }
    await saveAIHistory(req.user._id, "reply-suggestion", transcript, reply);
    res.status(200).json({ reply });
  } catch (error) {
    console.error("Error in replySuggestionAI:", error?.message || "Unknown error");
    const status = errorToHttpStatus(error);
    res.status(status).json({ code: errorToCode(error), message: friendlyError(error) });
  }
};

// POST /api/ai/smart-reply
// Input: { messages: [] }
// Output: { replies: [...] } — exactly 3 short quick replies (2-5 words each)
export const smartReplyAI = async (req, res) => {
  try {
    const { messages } = req.body;
    const transcript = formatMessages(messages);
    if (!transcript) {
      return res.status(200).json({ replies: ["Say something first to get reply suggestions."] });
    }
    const raw = await generate(
      'You are a smart reply assistant inside a messaging app. Generate exactly three short quick replies (2-5 words each), suitable as one-tap responses in a chat. Return ONLY a JSON array of exactly 3 strings, with no markdown or code fences.',
      `Conversation:\n\n${transcript}\n\nReturn a JSON array of exactly 3 short quick replies.`,
      { temperature: 0.8 }
    );
    let replies = [];
    try {
      // Strip any markdown code fences if present.
      const cleaned = sanitizeAiText(raw).replace(/```json/gi, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      // Accept either a bare array or an object with a "replies" key for robustness.
      replies = (Array.isArray(parsed) ? parsed : Array.isArray(parsed?.replies) ? parsed.replies : []).slice(0, 3);
    } catch {
      replies = sanitizeAiText(raw)
        .split("\n")
        .map((l) => l.replace(/^[-•]\s*/, "").replace(/^\d+[.)]\s*/, "").replace(/^"|"$/g, "").trim())
        .filter(Boolean)
        .slice(0, 3);
    }
    if (replies.length === 0) {
      replies = ["Sounds good", "I'll be there", "Thanks!"];
    }
    await saveAIHistory(req.user._id, "smart-reply", transcript, JSON.stringify(replies));
    res.status(200).json({ replies });
  } catch (error) {
    console.error("Error in smartReplyAI:", error?.message || "Unknown error");
    const status = errorToHttpStatus(error);
    res.status(status).json({ code: errorToCode(error), message: friendlyError(error) });
  }
};

// POST /api/ai/chat
// Input: { prompt }
// Output: { response }
export const chatAI = async (req, res) => {
  try {
    const { prompt, context } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ message: "prompt is required." });
    }
    const contextual = context ? `\n\nRelevant chat transcript for context:\n${context}` : "";
    const response = sanitizeAiText(await generate(
      "You are Vyntra's helpful AI assistant embedded in a messaging app. You answer concisely and helpfully. Use the provided chat transcript as context when relevant.",
      `${prompt}${contextual}`,
      { temperature: 0.7 }
    ));
    await saveAIHistory(req.user._id, "chat", prompt, response);
    res.status(200).json({ response });
  } catch (error) {
    console.error("Error in chatAI:", error?.message || "Unknown error");
    const status = errorToHttpStatus(error);
    res.status(status).json({ code: errorToCode(error), message: friendlyError(error) });
  }
};
