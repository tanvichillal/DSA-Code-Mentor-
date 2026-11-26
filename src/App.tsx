import React, { useEffect, useState } from "react";
import { BrainCircuit, LogOut, ShieldCheck } from "lucide-react";
import { CodeFallbackModal } from "./components/CodeFallbackModal";
import { Dashboard } from "./components/Dashboard";
import { HintDisplay } from "./components/HintDisplay";
import { Login } from "./components/Login";
import { ProblemInfo } from "./components/ProblemInfo";
import { SessionControls } from "./components/SessionControls";
import { Timer } from "./components/Timer";
import { useSession } from "./hooks/useSession";
import { useTimer } from "./hooks/useTimer";
import {
  AuthUserSession,
  getStoredAuthSession,
  signOut,
} from "./services/firebase";

export const App: React.FC = () => {
  const [authUser, setAuthUser] = useState<AuthUserSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    getStoredAuthSession()
      .then((stored) => setAuthUser(stored))
      .finally(() => setAuthChecked(true));
  }, []);

  const sessionMgr = useSession(Boolean(authUser));
  const timer = useTimer(
    sessionMgr.session?.sessionId ?? null,
    sessionMgr.status?.cooldownEndsAt ?? null
  );

  const handleLogout = async () => {
    await signOut();
    await sessionMgr.closeActiveSessionView();
    setAuthUser(null);
  };

  if (!authChecked) {
    return (
      <div className="panel-shell">
        <p className="muted-sm">Loading AI DSA Mentor...</p>
      </div>
    );
  }

  if (!authUser) {
    return <Login onAuthenticated={(u) => setAuthUser(u)} />;
  }

  const showFallback =
    sessionMgr.manualFallbackOpen ||
    (timer.requiresManualFallback && sessionMgr.session?.sessionStatus === "active");

  return (
    <div className="panel-shell">
      <header className="topbar">
        <div className="brand-header">
          <div className="brand-logo">
            <BrainCircuit size={19} />
          </div>
          <div>
            <h1 className="brand-title">AI DSA Mentor</h1>
            <p className="brand-subtitle">{authUser.displayName || authUser.email}</p>
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-xs" onClick={handleLogout} title="Sign out">
          <LogOut size={13} /> Sign Out
        </button>
      </header>

      {!sessionMgr.session ? (
        <Dashboard
          tabContext={sessionMgr.tabContext}
          consentGranted={sessionMgr.consentGranted}
          onConsentChange={sessionMgr.updateConsent}
          recentSessions={sessionMgr.recentSessions}
          loading={sessionMgr.loading}
          error={sessionMgr.error}
          onRefreshDetection={sessionMgr.inspectActiveTab}
          onStartSession={sessionMgr.startOrResumeSession}
          onOpenSession={sessionMgr.loadSessionById}
        />
      ) : (
        <main className="stack-md">
          <ProblemInfo
            session={sessionMgr.session}
            detectedLiveLanguage={sessionMgr.tabContext.problem?.programmingLanguage}
            onBackToDashboard={sessionMgr.closeActiveSessionView}
          />

          {!sessionMgr.consentGranted && sessionMgr.session.sessionStatus === "active" && (
            <section className="card consent-banner">
              <div className="row-center">
                <ShieldCheck size={16} className="emerald-icon" />
                <h3>Automatic Code Capture Consent</h3>
              </div>
              <p className="muted-xs">
                Allow AI DSA Mentor to read your editor code after each 2-minute countdown so hints adapt to your progress.
              </p>
              <button
                type="button"
                className="btn btn-success btn-sm full-width"
                disabled={sessionMgr.loading}
                onClick={() => sessionMgr.updateConsent(true)}
              >
                <ShieldCheck size={14} /> Accept &amp; Enable Auto Code Capture
              </button>
            </section>
          )}

          <Timer
            timer={timer}
            currentHintLevel={sessionMgr.session.currentHintLevel}
            loading={sessionMgr.loading}
            onRetryCapture={sessionMgr.retryAutoCapture}
          />

          {sessionMgr.captureWarning && (
            <div className="alert alert-warning">{sessionMgr.captureWarning}</div>
          )}

          {sessionMgr.error && (
            <div className="alert alert-error">{sessionMgr.error}</div>
          )}

          <CodeFallbackModal
            visible={showFallback}
            message={timer.autoCaptureMessage || sessionMgr.captureWarning}
            defaultLanguage={sessionMgr.session.programmingLanguage}
            initialCode={sessionMgr.progress?.latestCode ?? ""}
            consentGranted={sessionMgr.consentGranted}
            loading={sessionMgr.loading}
            onAcceptConsent={() => sessionMgr.updateConsent(true)}
            onRetryCapture={sessionMgr.retryAutoCapture}
            onSubmitManual={sessionMgr.submitManualCodeAndAnalyze}
            onClose={() => sessionMgr.setManualFallbackOpen(false)}
          />

          <HintDisplay
            hints={sessionMgr.hints}
            analysis={sessionMgr.progress?.analysis || sessionMgr.status?.latestAnalysis}
          />

          <SessionControls
            session={sessionMgr.session}
            timer={timer}
            hintLoading={sessionMgr.hintLoading}
            actionLoading={sessionMgr.loading}
            onRequestHint={sessionMgr.requestNextHint}
            onOpenManualFallback={() => sessionMgr.setManualFallbackOpen(true)}
            onEndSession={sessionMgr.endCurrentSession}
            onBackToDashboard={sessionMgr.closeActiveSessionView}
          />
        </main>
      )}
    </div>
  );
};

export default App;
