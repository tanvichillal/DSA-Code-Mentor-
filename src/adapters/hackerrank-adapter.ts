import { ExtractedProblemContext, PlatformAdapter, ProblemExample } from "./types";
import {
  cleanText,
  extractConstraintsFromText,
  extractExamplesFromText,
  firstMatchingElement,
  normalizeLanguage,
  titleFromSlug,
} from "./extraction-helpers";

const TITLE_SELECTORS = [
  "h1.ui-icon-label",
  ".challenge-view h1",
  "h1",
];

const DESCRIPTION_SELECTORS = [
  ".challenge-body-html",
  ".challenge_problem_statement",
  ".problem-statement",
];

const LANGUAGE_SELECTORS = [
  ".select-language .css-1uccc91-singleValue",
  ".select-language [class*='singleValue']",
  'select[data-analytics="LanguageSelect"]',
  ".hr-monaco-editor-wrapper select",
];

export const hackerrankAdapter: PlatformAdapter = {
  platform: "hackerrank",

  detectLanguage(doc: Document): string {
    for (const sel of LANGUAGE_SELECTORS) {
      const el = doc.querySelector(sel);
      if (!el) continue;
      if (el instanceof HTMLSelectElement) {
        const selected = el.options[el.selectedIndex]?.text ?? el.value;
        const norm = normalizeLanguage(selected);
        if (norm !== "unknown") return norm;
      } else {
        const norm = normalizeLanguage(cleanText(el.textContent));
        if (norm !== "unknown") return norm;
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
    const rawTitle = cleanText(titleEl?.textContent) || cleanText(doc.title.replace(/\s*\|\s*HackerRank.*$/i, ""));
    const problemTitle = rawTitle || titleFromSlug(url, "HackerRank Challenge");

    const constraints = extractConstraintsFromText(statement);
    let examples: ProblemExample[] = extractExamplesFromText(statement);
    if (examples.length === 0) {
      const sampleMatch = statement.match(
        /Sample Input(?:\s*\d*)?\s*\n\s*([\s\S]*?)\n\s*Sample Output(?:\s*\d*)?\s*\n\s*([\s\S]*?)(?:\n\s*Explanation\s*\n\s*([\s\S]*?))?(?=\n\s*Sample|$)/i
      );
      if (sampleMatch) {
        examples = [
          {
            input: cleanText(sampleMatch[1]),
            output: cleanText(sampleMatch[2]),
            explanation: cleanText(sampleMatch[3] ?? ""),
          },
        ];
      }
    }

    return {
      platform: "hackerrank",
      problemTitle,
      problemUrl: url,
      problemStatement: statement,
      constraints,
      examples,
      programmingLanguage: this.detectLanguage(doc),
    };
  },
};
