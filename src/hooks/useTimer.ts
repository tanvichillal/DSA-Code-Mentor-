import { useEffect, useState } from "react";
import { getLocalTimerState, LocalTimerState } from "../services/session";

export interface TimerViewState {
  remainingSeconds: number;
  isCoolingDown: boolean;
  durationSeconds: number;
  progressPercent: number;
  autoCaptureStatus: LocalTimerState["autoCaptureStatus"];
  autoCaptureMessage?: string;
  requiresManualFallback: boolean;
}

export function useTimer(sessionId: string | null, backendCooldownEndsAt?: string | null): TimerViewState {
  const [localState, setLocalState] = useState<LocalTimerState | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const refreshFromStorage = async () => {
    const stored = await getLocalTimerState();
    if (stored && (!sessionId || stored.sessionId === sessionId)) {
      setLocalState(stored);
    } else if (!sessionId) {
      setLocalState(null);
    }
  };

  useEffect(() => {
    refreshFromStorage();

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === "local" && changes.dsa_mentor_timer_state) {
        const nextVal = (changes.dsa_mentor_timer_state.newValue as LocalTimerState | undefined) ?? null;
        if (!sessionId || !nextVal || nextVal.sessionId === sessionId) {
          setLocalState(nextVal);
        }
      }
    };

    const handleMessage = (msg: { type?: string }) => {
      if (msg?.type === "COOLDOWN_COMPLETED") {
        refreshFromStorage();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    chrome.runtime.onMessage.addListener(handleMessage);
    const interval = window.setInterval(() => setNowMs(Date.now()), 500);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      chrome.runtime.onMessage.removeListener(handleMessage);
      window.clearInterval(interval);
    };
  }, [sessionId]);

  const backendEndsMs = backendCooldownEndsAt ? Date.parse(backendCooldownEndsAt) : 0;
  const localEndsMs = localState?.cooldownEndsAt ?? 0;
  const effectiveEndsMs = Math.max(backendEndsMs || 0, localEndsMs || 0);
  const durationSeconds = localState?.durationSeconds || 120;

  const remainingMs = effectiveEndsMs > nowMs ? effectiveEndsMs - nowMs : 0;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const isCoolingDown = remainingSeconds > 0;
  const elapsed = Math.max(0, durationSeconds - remainingSeconds);
  const progressPercent = isCoolingDown
    ? Math.min(100, Math.round((elapsed / durationSeconds) * 100))
    : 100;

  return {
    remainingSeconds,
    isCoolingDown,
    durationSeconds,
    progressPercent,
    autoCaptureStatus: localState?.autoCaptureStatus ?? "idle",
    autoCaptureMessage: localState?.autoCaptureMessage,
    requiresManualFallback: Boolean(localState?.requiresManualFallback),
  };
}
