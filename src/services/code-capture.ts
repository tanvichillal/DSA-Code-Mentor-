import { mainWorldCaptureEditorCode } from "../adapters/main-world-capture";
import { detectPlatformFromUrl } from "../adapters/platform-detector";
import { CodeCaptureResult, SupportedPlatform } from "../adapters/types";

/**
 * Captures editor code from the given tab using Chrome MV3 scripting in the MAIN world.
 * Only executes when user consent has been explicitly granted.
 */
export async function captureEditorCodeFromTab(
  tabId: number,
  tabUrl: string,
  hasUserConsent: boolean
): Promise<CodeCaptureResult> {
  if (!hasUserConsent) {
    return {
      success: false,
      code: "",
      programmingLanguage: "unknown",
      adapterUsed: "none",
      message: "Code capture requires your consent before reading the editor.",
    };
  }

  const detection = detectPlatformFromUrl(tabUrl);
  const platformHint: SupportedPlatform | null = detection.platform;

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: mainWorldCaptureEditorCode,
      args: [platformHint],
    });

    const capture = results?.[0]?.result as CodeCaptureResult | undefined;
    if (!capture) {
      return {
        success: false,
        code: "",
        programmingLanguage: "unknown",
        adapterUsed: "none",
        message: "No response received from the page editor.",
      };
    }

    // If MAIN world couldn't identify language (e.g. CodeMirror 6), ask content script DOM detector
    if (capture.success && capture.programmingLanguage === "unknown") {
      try {
        const langResp = (await chrome.tabs.sendMessage(tabId, {
          type: "DETECT_LANGUAGE",
        })) as { language?: string } | undefined;
        if (langResp?.language && langResp.language !== "unknown") {
          capture.programmingLanguage = langResp.language;
        }
      } catch {
        // Content script may not be active if tab just navigated
      }
    }

    return capture;
  } catch (err) {
    return {
      success: false,
      code: "",
      programmingLanguage: "unknown",
      adapterUsed: "none",
      message: `Unable to access editor on this tab: ${err instanceof Error ? err.message : String(err)}. You can paste your code manually below.`,
    };
  }
}
