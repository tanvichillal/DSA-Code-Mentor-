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
  '[class*="_problemName_"]',
  '[class*="problem-statement"] h1',
  '[class*="problem-statement"] h2',
  "h1",
];

const DESCRIPTION_SELECTORS = [
  "#problem-statement",
  '[class*="_problemBody_"]',
  '[class*="problem-statement"]',
  "main article",
];

const LANGUAGE_SELECTORS = [
  '[class*="_languageSelect_"]',
  'div[class*="language"] [role="button"]',
  'select[name*="language"]',
  'button[aria-haspopup="listbox"]',
];

export const codechefAdapter: PlatformAdapter = {
  platform: "codechef",

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
    const rawTitle = cleanText(titleEl?.textContent) || cleanText(doc.title.replace(/\s*\|\s*CodeChef.*$/i, ""));
    const problemTitle = rawTitle || titleFromSlug(url, "CodeChef Problem");

    const constraints = extractConstraintsFromText(statement);
    let examples: ProblemExample[] = extractExamplesFromText(statement);

    // CodeChef often uses "Sample Input" / "Sample Output" sections
    if (examples.length === 0) {
      const sampleMatch = statement.match(
        /Sample\s*\d*\s*Input\s*:?\s*\n\s*([\s\S]*?)\n\s*Sample\s*\d*\s*Output\s*:?\s*\n\s*([\s\S]*?)(?:\n\s*Explanation\s*:?\s*([\s\S]*?))?(?=\n\s*Sample|\n\s*Constraints|$)/i
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
      platform: "codechef",
      problemTitle,
      problemUrl: url,
      problemStatement: statement,
      constraints,
      examples,
      programmingLanguage: this.detectLanguage(doc),
    };
  },
};
