import { CodeAnalysisResult } from "./api";

export interface LocalTimerState {
  sessionId: string;
  tabId: number | null;
  problemUrl: string;
  programmingLanguage: string;
  cooldownEndsAt: number; // epoch ms
  durationSeconds: number;
  autoCaptureStatus: "idle" | "pending" | "capturing" | "analyzed" | "failed";
  autoCaptureMessage?: string;
  latestAnalysis?: Partial<CodeAnalysisResult> | null;
  requiresManualFallback?: boolean;
}

const CONSENT_KEY = "dsa_mentor_code_consent";
const ACTIVE_SESSION_KEY = "dsa_mentor_active_session_id";
const TIMER_STATE_KEY = "dsa_mentor_timer_state";

export async function getCodeConsent(): Promise<boolean> {
  const res = await chrome.storage.local.get(CONSENT_KEY);
  return Boolean(res[CONSENT_KEY]);
}

export async function setCodeConsent(granted: boolean): Promise<void> {
  await chrome.storage.local.set({ [CONSENT_KEY]: granted });
}

export async function getActiveSessionId(): Promise<string | null> {
  const res = await chrome.storage.local.get(ACTIVE_SESSION_KEY);
  return (res[ACTIVE_SESSION_KEY] as string | undefined) ?? null;
}

export async function setActiveSessionId(sessionId: string | null): Promise<void> {
  if (!sessionId) {
    await chrome.storage.local.remove(ACTIVE_SESSION_KEY);
    return;
  }
  await chrome.storage.local.set({ [ACTIVE_SESSION_KEY]: sessionId });
}

export async function getLocalTimerState(): Promise<LocalTimerState | null> {
  const res = await chrome.storage.local.get(TIMER_STATE_KEY);
  return (res[TIMER_STATE_KEY] as LocalTimerState | undefined) ?? null;
}

export async function setLocalTimerState(state: LocalTimerState | null): Promise<void> {
  if (!state) {
    await chrome.storage.local.remove(TIMER_STATE_KEY);
    return;
  }
  await chrome.storage.local.set({ [TIMER_STATE_KEY]: state });
}
