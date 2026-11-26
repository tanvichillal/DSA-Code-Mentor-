import { api } from "../services/api";
import { captureEditorCodeFromTab } from "../services/code-capture";
import {
  getCodeConsent,
  getLocalTimerState,
  LocalTimerState,
  setLocalTimerState,
} from "../services/session";

const COOLDOWN_ALARM_NAME = "dsa_mentor_cooldown";

chrome.runtime.onInstalled.addListener(async () => {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
  // Clear stale failed capture errors from previous extension versions on reload/update
  const state = await getLocalTimerState();
  if (state && state.autoCaptureStatus === "failed") {
    await setLocalTimerState({
      ...state,
      autoCaptureStatus: "idle",
      autoCaptureMessage: undefined,
      requiresManualFallback: false,
    });
  }
});

chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});

async function resolveProblemTab(preferredTabId: number | null, problemUrl: string): Promise<chrome.tabs.Tab | null> {
  if (preferredTabId !== null) {
    try {
      const tab = await chrome.tabs.get(preferredTabId);
      if (tab?.id && tab.url) {
        return tab;
      }
    } catch {
      // Tab may have been closed
    }
  }

  const allTabs = await chrome.tabs.query({});
  const normalizedPrefix = problemUrl.replace(/\/+$/, "");
  const matching = allTabs.find(
    (t) => t.id && t.url && t.url.replace(/\/+$/, "").startsWith(normalizedPrefix)
  );
  return matching ?? null;
}

async function runAutoCaptureAndAnalysis(timerState: LocalTimerState): Promise<void> {
  const consent = await getCodeConsent();
  await setLocalTimerState({
    ...timerState,
    autoCaptureStatus: "capturing",
    autoCaptureMessage: "Capturing your latest code from the editor...",
    requiresManualFallback: false,
  });

  const targetTab = await resolveProblemTab(timerState.tabId, timerState.problemUrl);
  if (!targetTab?.id || !targetTab.url) {
    await setLocalTimerState({
      ...timerState,
      autoCaptureStatus: "failed",
      requiresManualFallback: true,
      autoCaptureMessage:
        "Problem tab was closed or navigated away. Reopen the problem or paste your code manually.",
    });
    notifyPanel();
    return;
  }

  const capture = await captureEditorCodeFromTab(targetTab.id, targetTab.url, consent);
  if (!capture.success || !capture.code.trim()) {
    await setLocalTimerState({
      ...timerState,
      autoCaptureStatus: "failed",
      requiresManualFallback: true,
      autoCaptureMessage:
        capture.message ||
        "Automatic code extraction failed. Paste your code in the manual fallback box.",
    });
    notifyPanel();
    return;
  }

  const language =
    capture.programmingLanguage !== "unknown"
      ? capture.programmingLanguage
      : timerState.programmingLanguage;

  try {
    await api.submitCodeSnapshot(
      timerState.sessionId,
      capture.code,
      language,
      `auto_${capture.adapterUsed}`
    );
    const analysisResp = await api.analyzeCode(timerState.sessionId, capture.code, language);

    await setLocalTimerState({
      ...timerState,
      programmingLanguage: language,
      autoCaptureStatus: "analyzed",
      requiresManualFallback: capture.adapterUsed === "dom_fallback",
      autoCaptureMessage:
        capture.message ||
        `Code captured (${capture.adapterUsed}) and analyzed. Ready for your next hint.`,
      latestAnalysis: analysisResp.analysis,
    });
  } catch (err) {
    await setLocalTimerState({
      ...timerState,
      programmingLanguage: language,
      autoCaptureStatus: "failed",
      requiresManualFallback: true,
      autoCaptureMessage: `Code captured, but backend analysis failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    });
  }

  notifyPanel();
}

function notifyPanel(): void {
  chrome.runtime.sendMessage({ type: "COOLDOWN_COMPLETED" }).catch(() => {
    // Side panel may be closed; state is already persisted in chrome.storage.local
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== COOLDOWN_ALARM_NAME) return;
  const state = await getLocalTimerState();
  if (!state) return;
  await runAutoCaptureAndAnalysis(state);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message.type !== "string") return false;

  if (message.type === "START_COOLDOWN_TIMER") {
    const payload = message.payload as {
      sessionId: string;
      tabId: number | null;
      problemUrl: string;
      programmingLanguage: string;
      cooldownEndsAt: number;
      durationSeconds: number;
    };

    const nextState: LocalTimerState = {
      ...payload,
      autoCaptureStatus: "pending",
      requiresManualFallback: false,
      autoCaptureMessage: undefined,
    };

    (async () => {
      await setLocalTimerState(nextState);
      await chrome.alarms.clear(COOLDOWN_ALARM_NAME);
      await chrome.alarms.create(COOLDOWN_ALARM_NAME, {
        when: Math.max(Date.now() + 500, payload.cooldownEndsAt),
      });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === "CANCEL_COOLDOWN_TIMER") {
    (async () => {
      await chrome.alarms.clear(COOLDOWN_ALARM_NAME);
      await setLocalTimerState(null);
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === "TRIGGER_AUTO_CAPTURE_NOW") {
    (async () => {
      const state = await getLocalTimerState();
      if (!state) {
        sendResponse({ ok: false, error: "No active timer state." });
        return;
      }
      await runAutoCaptureAndAnalysis(state);
      sendResponse({ ok: true });
    })();
    return true;
  }

  return false;
});
