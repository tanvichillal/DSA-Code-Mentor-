import { useCallback, useEffect, useState } from "react";
import { detectPlatformFromUrl } from "../adapters/platform-detector";
import { ExtractedProblemContext, PlatformDetectionResult } from "../adapters/types";
import {
  api,
  ApiError,
  CodeAnalysisResult,
  HintRecord,
  ProgressRecord,
  SessionRecord,
  SessionStatusResponse,
} from "../services/api";
import { captureEditorCodeFromTab } from "../services/code-capture";
import {
  getActiveSessionId,
  getCodeConsent,
  getLocalTimerState,
  setActiveSessionId,
  setCodeConsent,
  setLocalTimerState,
} from "../services/session";

export interface ActiveTabContext {
  tabId: number | null;
  url: string;
  detection: PlatformDetectionResult;
  problem: ExtractedProblemContext | null;
  extractionError: string | null;
}

export function useSession(isAuthenticated: boolean) {
  const [tabContext, setTabContext] = useState<ActiveTabContext>({
    tabId: null,
    url: "",
    detection: {
      supported: false,
      platform: null,
      isProblemPage: false,
      canonicalUrl: "",
    },
    problem: null,
    extractionError: null,
  });

  const [consentGranted, setConsentGranted] = useState<boolean>(false);
  const [recentSessions, setRecentSessions] = useState<SessionRecord[]>([]);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [hints, setHints] = useState<HintRecord[]>([]);
  const [progress, setProgress] = useState<ProgressRecord | null>(null);
  const [status, setStatus] = useState<SessionStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [hintLoading, setHintLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [manualFallbackOpen, setManualFallbackOpen] = useState<boolean>(false);
  const [captureWarning, setCaptureWarning] = useState<string | null>(null);

  const inspectActiveTab = useCallback(async () => {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const url = activeTab?.url ?? "";
      const tabId = activeTab?.id ?? null;
      const detection = detectPlatformFromUrl(url);

      if (!detection.supported || !detection.isProblemPage || tabId === null) {
        setTabContext({
          tabId,
          url,
          detection,
          problem: null,
          extractionError: detection.reason ?? null,
        });
        return;
      }

      try {
        const resp = (await chrome.tabs.sendMessage(tabId, {
          type: "EXTRACT_PROBLEM",
        })) as {
          ok: boolean;
          problem: ExtractedProblemContext | null;
          error?: string;
        };
        setTabContext({
          tabId,
          url,
          detection,
          problem: resp?.ok ? resp.problem : null,
          extractionError: resp?.ok ? null : resp?.error ?? "Unable to extract problem details.",
        });
      } catch {
        setTabContext({
          tabId,
          url,
          detection,
          problem: null,
          extractionError:
            "Content script is not active yet on this tab. Refresh the problem page and click Refresh Detection.",
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to inspect active Chrome tab.");
    }
  }, []);

  const loadRecentSessions = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const list = await api.listSessions();
      setRecentSessions(list);
    } catch {
      // Non-blocking on dashboard
    }
  }, [isAuthenticated]);

  const loadSessionById = useCallback(async (sessionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const details = await api.getSession(sessionId);
      setSession(details.session);
      setHints(details.hints);
      setProgress(details.progress);
      setStatus(details.status);
      await setActiveSessionId(sessionId);

      // Sync timer state if backend cooldown is still active
      if (details.status.cooldownRemainingSeconds > 0 && details.status.cooldownEndsAt) {
        const existingLocal = await getLocalTimerState();
        if (!existingLocal || existingLocal.sessionId !== sessionId) {
          await chrome.runtime.sendMessage({
            type: "START_COOLDOWN_TIMER",
            payload: {
              sessionId,
              tabId: tabContext.tabId,
              problemUrl: details.session.problemUrl,
              programmingLanguage: details.session.programmingLanguage,
              cooldownEndsAt: Date.parse(details.status.cooldownEndsAt),
              durationSeconds: details.status.cooldownSeconds,
            },
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session.");
      await setActiveSessionId(null);
    } finally {
      setLoading(false);
    }
  }, [tabContext.tabId]);

  useEffect(() => {
    getCodeConsent().then(setConsentGranted);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setSession(null);
      setHints([]);
      setProgress(null);
      setStatus(null);
      setRecentSessions([]);
      return;
    }

    inspectActiveTab();
    loadRecentSessions();
    getActiveSessionId().then((id) => {
      if (id) {
        loadSessionById(id);
      }
    });
  }, [isAuthenticated, inspectActiveTab, loadRecentSessions, loadSessionById]);

  // React to background cooldown completion, tab navigation, or page reload
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleRuntimeMessage = async (msg: { type?: string; url?: string }) => {
      if (msg?.type === "COOLDOWN_COMPLETED" && session?.sessionId) {
        await loadSessionById(session.sessionId);
      } else if (msg?.type === "PAGE_URL_CHANGED") {
        await inspectActiveTab();
      }
    };

    const handleTabUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (changeInfo.url || changeInfo.status === "complete") {
        inspectActiveTab();
      }
    };

    const handleTabActivated = () => {
      inspectActiveTab();
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    chrome.tabs.onUpdated.addListener(handleTabUpdated);
    chrome.tabs.onActivated.addListener(handleTabActivated);
    return () => {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, [isAuthenticated, session?.sessionId, loadSessionById, inspectActiveTab]);

  const updateConsent = async (granted: boolean) => {
    setConsentGranted(granted);
    await setCodeConsent(granted);
    if (granted) {
      setCaptureWarning(null);
      if (session && session.sessionStatus === "active") {
        const timerState = await getLocalTimerState();
        if (timerState?.requiresManualFallback) {
          await retryAutoCaptureWithConsent(true);
        }
      }
    }
  };

  const startOrResumeSession = async (problemOverride?: ExtractedProblemContext) => {
    const problem = problemOverride ?? tabContext.problem;
    if (!problem) {
      setError("No problem context detected. Open a problem page or fill in details manually.");
      return;
    }

    setLoading(true);
    setError(null);
    setCaptureWarning(null);

    try {
      let initialCode: string | undefined;
      let language = problem.programmingLanguage;

      if (consentGranted && tabContext.tabId !== null) {
        const cap = await captureEditorCodeFromTab(tabContext.tabId, tabContext.url, true);
        if (cap.success && cap.code.trim()) {
          initialCode = cap.code;
          if (cap.programmingLanguage !== "unknown") {
            language = cap.programmingLanguage;
          }
          if (cap.message) setCaptureWarning(cap.message);
        } else if (cap.message) {
          setCaptureWarning(cap.message);
        }
      }

      const created = await api.createSession(
        { ...problem, programmingLanguage: language },
        initialCode,
        true
      );

      await loadSessionById(created.session.sessionId);
      await loadRecentSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start mentoring session.");
    } finally {
      setLoading(false);
    }
  };

  const requestNextHint = async () => {
    if (!session) return;
    setHintLoading(true);
    setError(null);
    setCaptureWarning(null);

    try {
      let capturedCode: string | undefined;
      let language = session.programmingLanguage;

      if (consentGranted && tabContext.tabId !== null) {
        const cap = await captureEditorCodeFromTab(tabContext.tabId, tabContext.url, true);
        if (cap.success && cap.code.trim()) {
          capturedCode = cap.code;
          if (cap.programmingLanguage !== "unknown") {
            language = cap.programmingLanguage;
          }
        } else if (session.currentHintLevel >= 1 && cap.message) {
          setCaptureWarning(cap.message);
          setManualFallbackOpen(true);
        }
      }

      const resp = await api.requestHint(session.sessionId, capturedCode, language);
      setHints((prev) => [...prev, resp.hint]);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              currentHintLevel: resp.currentHintLevel,
              programmingLanguage: language,
              lastHintTimestamp: resp.hint.createdAt,
            }
          : prev
      );
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              currentHintLevel: resp.currentHintLevel,
              cooldownSeconds: resp.cooldownSeconds,
              cooldownRemainingSeconds: resp.cooldownRemainingSeconds,
              canRequestHint: false,
              cooldownEndsAt: resp.cooldownEndsAt,
              programmingLanguage: language,
            }
          : prev
      );

      await chrome.runtime.sendMessage({
        type: "START_COOLDOWN_TIMER",
        payload: {
          sessionId: session.sessionId,
          tabId: tabContext.tabId,
          problemUrl: session.problemUrl,
          programmingLanguage: language,
          cooldownEndsAt: Date.parse(resp.cooldownEndsAt),
          durationSeconds: resp.cooldownSeconds,
        },
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429 && err.cooldownRemainingSeconds) {
        setError(err.message);
        await loadSessionById(session.sessionId);
      } else {
        setError(err instanceof Error ? err.message : "Failed to generate hint.");
      }
    } finally {
      setHintLoading(false);
    }
  };

  const submitManualCodeAndAnalyze = async (code: string, language: string) => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      await api.submitCodeSnapshot(session.sessionId, code, language, "manual_fallback");
      const analyzed = await api.analyzeCode(session.sessionId, code, language);
      setManualFallbackOpen(false);
      setCaptureWarning(null);
      setProgress((prev) => ({
        sessionId: session.sessionId,
        previousCode: prev?.latestCode ?? "",
        latestCode: code,
        analysis: analyzed.analysis,
        updatedAt: analyzed.updatedAt,
      }));
      const existingTimer = await getLocalTimerState();
      if (existingTimer && existingTimer.sessionId === session.sessionId) {
        await setLocalTimerState({
          ...existingTimer,
          autoCaptureStatus: "analyzed",
          requiresManualFallback: false,
          autoCaptureMessage: "Manual code submitted and analyzed.",
          latestAnalysis: analyzed.analysis as Partial<CodeAnalysisResult>,
        });
      }
      await loadSessionById(session.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze submitted code.");
    } finally {
      setLoading(false);
    }
  };

  const retryAutoCaptureWithConsent = async (forceConsent = false) => {
    if (!session) return;
    const hasConsent = forceConsent || consentGranted;
    setLoading(true);
    setError(null);
    setCaptureWarning(null);
    try {
      const workerResp = (await chrome.runtime.sendMessage({
        type: "TRIGGER_AUTO_CAPTURE_NOW",
      })) as { ok?: boolean } | undefined;

      // Fallback to direct capture if no active timer state exists in background storage
      if (!workerResp?.ok && tabContext.tabId !== null) {
        const cap = await captureEditorCodeFromTab(
          tabContext.tabId,
          tabContext.url,
          hasConsent
        );
        if (!cap.success || !cap.code.trim()) {
          setCaptureWarning(cap.message || "Could not read editor code automatically.");
          setManualFallbackOpen(true);
          return;
        }
        const lang =
          cap.programmingLanguage !== "unknown"
            ? cap.programmingLanguage
            : session.programmingLanguage;
        await api.submitCodeSnapshot(session.sessionId, cap.code, lang, `manual_retry_${cap.adapterUsed}`);
        await api.analyzeCode(session.sessionId, cap.code, lang);
        setManualFallbackOpen(false);
      }

      await loadSessionById(session.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Retry capture failed.");
    } finally {
      setLoading(false);
    }
  };

  const retryAutoCapture = async () => {
    await retryAutoCaptureWithConsent(false);
  };

  const endCurrentSession = async (reason: "solved" | "ended_by_user") => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const ended = await api.endSession(session.sessionId, reason);
      await chrome.runtime.sendMessage({ type: "CANCEL_COOLDOWN_TIMER" });
      setSession((prev) =>
        prev ? { ...prev, sessionStatus: ended.sessionStatus, updatedAt: ended.updatedAt } : prev
      );
      setStatus((prev) =>
        prev ? { ...prev, sessionStatus: ended.sessionStatus, canRequestHint: false } : prev
      );
      await loadRecentSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to end session.");
    } finally {
      setLoading(false);
    }
  };

  const closeActiveSessionView = async () => {
    setSession(null);
    setHints([]);
    setProgress(null);
    setStatus(null);
    setError(null);
    setCaptureWarning(null);
    await setActiveSessionId(null);
  };

  return {
    tabContext,
    consentGranted,
    updateConsent,
    recentSessions,
    session,
    hints,
    progress,
    status,
    loading,
    hintLoading,
    error,
    setError,
    captureWarning,
    manualFallbackOpen,
    setManualFallbackOpen,
    inspectActiveTab,
    startOrResumeSession,
    loadSessionById,
    requestNextHint,
    submitManualCodeAndAnalyze,
    retryAutoCapture,
    endCurrentSession,
    closeActiveSessionView,
  };
}
