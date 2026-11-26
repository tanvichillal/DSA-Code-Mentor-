import { CodeCaptureResult, SupportedPlatform } from "./types";

/**
 * Self-contained function executed in the tab's MAIN world via chrome.scripting.executeScript
 * ONLY after the user has explicitly granted code-capture consent.
 *
 * Because it is serialized by Chrome's scripting API, it must NOT reference module-scoped
 * variables or imports.
 */
export function mainWorldCaptureEditorCode(platformHint: SupportedPlatform | null): CodeCaptureResult {
  const normalizeLang = (raw: string | undefined | null): string => {
    if (!raw) return "unknown";
    const s = raw.trim().toLowerCase();
    if (s.includes("python")) return "python";
    if (s === "cpp" || s.includes("c++")) return "cpp";
    if (s === "c") return "c";
    if (s.includes("java") && !s.includes("javascript")) return "java";
    if (s.includes("typescript") || s === "ts") return "typescript";
    if (s.includes("javascript") || s === "js") return "javascript";
    if (s.includes("golang") || s === "go") return "go";
    if (s.includes("rust")) return "rust";
    if (s.includes("csharp") || s.includes("c#")) return "csharp";
    return s || "unknown";
  };

  try {
    const win = window as unknown as {
      monaco?: {
        editor?: {
          getModels?: () => Array<{
            getValue?: () => string;
            getLanguageId?: () => string;
            uri?: { toString?: () => string };
          }>;
        };
      };
      ace?: {
        edit?: (el: Element) => {
          getValue?: () => string;
          getSession?: () => { getMode?: () => { $id?: string } };
        };
      };
    };

    // 1. Monaco Editor (LeetCode, HackerRank, modern CodeChef)
    const monacoModels = win.monaco?.editor?.getModels?.();
    if (Array.isArray(monacoModels) && monacoModels.length > 0) {
      // Filter out empty or read-only/diff auxiliary models where possible
      const candidateModels = monacoModels.filter((m) => {
        const uri = m.uri?.toString?.() ?? "";
        return !uri.includes("inmemory://model/diff") && typeof m.getValue === "function";
      });
      const chosen =
        candidateModels.find((m) => (m.getValue?.() ?? "").trim().length > 0) ??
        candidateModels[0];

      if (chosen) {
        const value = chosen.getValue?.() ?? "";
        const lang = normalizeLang(chosen.getLanguageId?.());
        if (value.trim().length > 0) {
          return {
            success: true,
            code: value,
            programmingLanguage: lang,
            adapterUsed: "monaco",
          };
        }
      }
    }

    // 2. CodeMirror 6 (CodeChef modern IDE / some LeetCode modes)
    const cm6Root = document.querySelector(".cm-editor") as
      | (Element & { cmView?: { view?: { state?: { doc?: { toString?: () => string } } } } })
      | null;
    if (cm6Root) {
      const viewDoc = cm6Root.cmView?.view?.state?.doc?.toString?.();
      if (typeof viewDoc === "string" && viewDoc.trim().length > 0) {
        return {
          success: true,
          code: viewDoc,
          programmingLanguage: "unknown",
          adapterUsed: "codemirror6",
        };
      }
    }

    // 3. CodeMirror 5 (Legacy CodeChef / HackerRank)
    const cm5El = document.querySelector(".CodeMirror") as
      | (Element & {
          CodeMirror?: {
            getValue?: () => string;
            getOption?: (key: string) => unknown;
          };
        })
      | null;
    if (cm5El?.CodeMirror?.getValue) {
      const value = cm5El.CodeMirror.getValue();
      const mode = cm5El.CodeMirror.getOption?.("mode");
      const lang = typeof mode === "string" ? normalizeLang(mode) : "unknown";
      if (value.trim().length > 0) {
        return {
          success: true,
          code: value,
          programmingLanguage: lang,
          adapterUsed: "codemirror5",
        };
      }
    }

    // 4. Ace Editor (Legacy HackerRank / CodeChef)
    const aceEl = document.querySelector(".ace_editor");
    if (aceEl && win.ace?.edit) {
      const aceInstance = win.ace.edit(aceEl);
      const value = aceInstance?.getValue?.() ?? "";
      const modeId = aceInstance?.getSession?.()?.getMode?.()?.$id;
      const lang = normalizeLang(modeId?.split("/").pop());
      if (value.trim().length > 0) {
        return {
          success: true,
          code: value,
          programmingLanguage: lang,
          adapterUsed: "ace",
        };
      }
    }

    // 5. Fallback: visible DOM lines (flagged explicitly as partial/DOM fallback)
    const viewLines = document.querySelectorAll(".monaco-editor .view-lines .view-line");
    if (viewLines.length > 0) {
      const assembled = Array.from(viewLines)
        .map((line) => (line.textContent ?? "").replace(/\u00a0/g, " "))
        .join("\n")
        .trim();
      if (assembled.length > 0) {
        return {
          success: true,
          code: assembled,
          programmingLanguage: "unknown",
          adapterUsed: "dom_fallback",
          message:
            "Captured from visible editor DOM lines. If your solution is long and scrolled, verify it in the manual editor box.",
        };
      }
    }

    const cmContent = document.querySelector(".cm-content");
    if (cmContent?.textContent?.trim()) {
      return {
        success: true,
        code: cmContent.textContent.replace(/\u00a0/g, " ").trim(),
        programmingLanguage: "unknown",
        adapterUsed: "dom_fallback",
        message: "Captured from visible CodeMirror DOM content.",
      };
    }

    return {
      success: false,
      code: "",
      programmingLanguage: "unknown",
      adapterUsed: "none",
      message: `Unable to locate an active code editor instance for ${platformHint ?? "this platform"}. Use the manual code input fallback below.`,
    };
  } catch (err) {
    return {
      success: false,
      code: "",
      programmingLanguage: "unknown",
      adapterUsed: "none",
      message: `Editor capture error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
