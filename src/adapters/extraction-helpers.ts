import { ProblemExample } from "./types";

const LANGUAGE_ALIASES: Record<string, string> = {
  c: "c",
  "c++": "cpp",
  cpp: "cpp",
  "c++14": "cpp",
  "c++17": "cpp",
  "c++20": "cpp",
  python: "python",
  python3: "python",
  pypy3: "python",
  java: "java",
  javascript: "javascript",
  js: "javascript",
  typescript: "typescript",
  ts: "typescript",
  go: "go",
  golang: "go",
  rust: "rust",
  kotlin: "kotlin",
  swift: "swift",
  "c#": "csharp",
  csharp: "csharp",
};

export function normalizeLanguage(raw: string | null | undefined): string {
  if (!raw) return "unknown";
  const cleaned = raw.trim().toLowerCase();
  if (LANGUAGE_ALIASES[cleaned]) return LANGUAGE_ALIASES[cleaned];
  for (const [alias, normalized] of Object.entries(LANGUAGE_ALIASES)) {
    if (cleaned.includes(alias)) {
      return normalized;
    }
  }
  return cleaned || "unknown";
}

export function cleanText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractConstraintsFromText(text: string): string[] {
  const match = text.match(/Constraints?:\s*\n([\s\S]*?)(?:\n(?:Follow[- ]?up|Note|Sample|Example|Subtasks)|$)/i);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
    .filter((line) => line.length > 0 && line.length < 300)
    .slice(0, 15);
}

export function extractExamplesFromText(text: string): ProblemExample[] {
  const examples: ProblemExample[] = [];
  const regex =
    /Example\s*\d*\s*:?\s*\n?\s*Input:\s*([\s\S]*?)\n\s*Output:\s*([\s\S]*?)(?:\n\s*Explanation:\s*([\s\S]*?))?(?=\n\s*Example\s*\d|\n\s*Constraints?:|$)/gi;

  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null && examples.length < 5) {
    examples.push({
      input: cleanText(m[1]),
      output: cleanText(m[2]),
      explanation: cleanText(m[3] ?? ""),
    });
  }
  return examples;
}

export function firstMatchingElement(doc: Document, selectors: string[]): Element | null {
  for (const sel of selectors) {
    const el = doc.querySelector(sel);
    if (el) return el;
  }
  return null;
}

export function titleFromSlug(url: string, fallback: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const slug = parts[parts.length - 1] === "problem" ? parts[parts.length - 2] : parts[parts.length - 1];
    if (!slug) return fallback;
    return slug
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  } catch {
    return fallback;
  }
}
