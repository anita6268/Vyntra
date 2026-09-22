export const THEMES = [
  { key: "dark", label: "Dark", premium: false },
  { key: "midnight", label: "Midnight Neon", premium: false },
  { key: "cyberpurple", label: "Cyber Purple", premium: true },
  { key: "emerald", label: "Emerald Glass", premium: false },
  { key: "ocean", label: "Ocean Blue", premium: false },
  { key: "crimson", label: "Crimson", premium: true },
  { key: "sunset", label: "Sunset Orange", premium: true },
  { key: "matrix", label: "Matrix", premium: false },
  { key: "frost", label: "Frost White", premium: true },
  { key: "amoled", label: "AMOLED Black", premium: true },
  { key: "discord", label: "Discord Dark", premium: true },
  { key: "imessage", label: "iMessage White", premium: true },
];

export const FREE_THEMES = THEMES.filter((t) => !t.premium);
export const PREMIUM_THEMES = THEMES.filter((t) => t.premium);
