import { detectPlatformFromUrl, getAdapterForPlatform } from "../adapters/platform-detector";

let lastObservedUrl = window.location.href;

function extractCurrentProblem() {
  const detection = detectPlatformFromUrl(window.location.href);
  if (!detection.supported || !detection.isProblemPage || !detection.platform) {
    return {
      ok: false,
      detection,
      problem: null,
      error: detection.reason ?? "Not a supported problem page.",
    };
  }

  const adapter = getAdapterForPlatform(detection.platform);
  if (!adapter) {
    return {
      ok: false,
      detection,
      problem: null,
      error: "Platform adapter not available.",
    };
  }

  const problem = adapter.extractProblem(document, detection.canonicalUrl);
  if (!problem) {
    return {
      ok: false,
      detection,
      problem: null,
      error:
        "Problem statement could not be extracted yet. Wait for the page to finish loading or enter details manually.",
    };
  }

  return {
    ok: true,
    detection,
    problem,
  };
}

function detectCurrentLanguage(): string {
  const detection = detectPlatformFromUrl(window.location.href);
  const adapter = getAdapterForPlatform(detection.platform);
  return adapter ? adapter.detectLanguage(document) : "unknown";
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return false;

  if (message.type === "EXTRACT_PROBLEM") {
    sendResponse(extractCurrentProblem());
    return true;
  }

  if (message.type === "DETECT_LANGUAGE") {
    sendResponse({ language: detectCurrentLanguage() });
    return true;
  }

  return false;
});

// Detect SPA navigation (e.g., clicking Next Problem on LeetCode)
const notifyUrlChangeIfNeeded = () => {
  if (window.location.href !== lastObservedUrl) {
    lastObservedUrl = window.location.href;
    chrome.runtime
      .sendMessage({
        type: "PAGE_URL_CHANGED",
        url: lastObservedUrl,
      })
      .catch(() => {
        // Side panel or worker may not be listening at the moment
      });
  }
};

const observer = new MutationObserver(() => notifyUrlChangeIfNeeded());
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("popstate", notifyUrlChangeIfNeeded);
