export type SupportedPlatform = "leetcode" | "codechef" | "hackerrank";

export interface ProblemExample {
  input: string;
  output: string;
  explanation: string;
}

export interface ExtractedProblemContext {
  platform: SupportedPlatform;
  problemTitle: string;
  problemUrl: string;
  problemStatement: string;
  constraints: string[];
  examples: ProblemExample[];
  programmingLanguage: string;
}

export interface PlatformDetectionResult {
  supported: boolean;
  platform: SupportedPlatform | null;
  isProblemPage: boolean;
  canonicalUrl: string;
  reason?: string;
}

export interface CodeCaptureResult {
  success: boolean;
  code: string;
  programmingLanguage: string;
  adapterUsed: "monaco" | "codemirror5" | "codemirror6" | "ace" | "dom_fallback" | "none";
  message?: string;
}

export interface PlatformAdapter {
  readonly platform: SupportedPlatform;
  extractProblem(doc: Document, url: string): ExtractedProblemContext | null;
  detectLanguage(doc: Document): string;
}
