import { ExtractedProblemContext, PlatformAdapter } from "./types";
import {
  cleanText,
  extractConstraintsFromText,
  extractExamplesFromText,
  firstMatchingElement,
  normalizeLanguage,
  titleFromSlug,
} from "./extraction-helpers";

const TITLE_SELECTORS = [
  '[data-cy="question-title"]',
  'div.text-title-large a[href*="/problems/"]',
  'a[href*="/problems/"][class*="title"]',
  "h1",
];

const DESCRIPTION_SELECTORS = [
  '[data-track-load="description_content"]',
  'div[class*="elfjS"]',
  'div[data-key="description-content"]',
  "article",
];

const LANGUAGE_SELECTORS = [
  'button[id^="headlessui-listbox-button"] span',
  'button[aria-haspopup="listbox"]',
  '[data-cy="lang-select"]',
  'div[class*="editor"] button',
];

export const leetcodeAdapter: PlatformAdapter = {
  platform: "leetcode",

  detectLanguage(doc: Document): string {
    for (const sel of LANGUAGE_SELECTORS) {
      const candidates = Array.from(doc.querySelectorAll(sel));
      for (const el of candidates) {
        const text = cleanText(el.textContent);
        const normalized = normalizeLanguage(text);
        if (normalized !== "unknown" && text.length < 30) {
          return normalized;
        }
      }
    }
    return "unknown";
  },

  extractProblem(doc: Document, url: string): ExtractedProblemContext | null {
    const descEl = firstMatchingElement(doc, DESCRIPTION_SELECTORS);
    const statement = cleanText(descEl?.textContent);
    if (!statement || statement.length < 20) {
      return null;
    }

    const titleEl = firstMatchingElement(doc, TITLE_SELECTORS);
    const rawTitle = cleanText(titleEl?.textContent) || cleanText(doc.title.replace(/\s*-\s*LeetCode.*$/i, ""));
    const problemTitle = rawTitle || titleFromSlug(url, "LeetCode Problem");

    const constraints = extractConstraintsFromText(statement);
    const examples = extractExamplesFromText(statement);
    const programmingLanguage = this.detectLanguage(doc);

    return {
      platform: "leetcode",
      problemTitle,
      problemUrl: url,
      problemStatement: statement,
      constraints,
      examples,
      programmingLanguage,
    };
  },
};
