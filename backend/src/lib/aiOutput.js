const removeReasoningBlocks = (value) => String(value || "")
  .replace(/<think\b[^>]*>[\s\S]*?<\/think\s*>/gi, "")
  .replace(/<analysis\b[^>]*>[\s\S]*?<\/analysis\s*>/gi, "")
  .replace(/<think\b[^>]*>[\s\S]*$/gi, "")
  .replace(/<analysis\b[^>]*>[\s\S]*$/gi, "");

export const sanitizeAiText = (value) => {
  let cleaned = removeReasoningBlocks(value);
  const answer = cleaned.match(/<answer\b[^>]*>([\s\S]*?)<\/answer\s*>/i);
  if (answer) cleaned = answer[1];
  return cleaned.replace(/^\s*Final output:\s*/i, "").trim();
};

const findJsonObject = (value) => {
  const start = value.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let quoted = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') quoted = false;
      continue;
    }
    if (character === '"') quoted = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return value.slice(start, index + 1);
  }
  return null;
};

export const parseAiJsonObject = (value) => {
  const cleaned = sanitizeAiText(value).replace(/^```(?:json)?\s*|\s*```$/gi, "").trim();
  const candidate = findJsonObject(cleaned);
  if (!candidate) return null;
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
};