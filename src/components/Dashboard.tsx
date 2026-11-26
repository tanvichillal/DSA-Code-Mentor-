import React, { useState } from "react";
import {
  CheckCircle2,
  Code2,
  Compass,
  History,
  Play,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { ExtractedProblemContext, SupportedPlatform } from "../adapters/types";
import { ActiveTabContext } from "../hooks/useSession";
import { SessionRecord } from "../services/api";

interface DashboardProps {
  tabContext: ActiveTabContext;
  consentGranted: boolean;
  onConsentChange: (granted: boolean) => void;
  recentSessions: SessionRecord[];
  loading: boolean;
  error: string | null;
  onRefreshDetection: () => void;
  onStartSession: (override?: ExtractedProblemContext) => void;
  onOpenSession: (sessionId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  tabContext,
  consentGranted,
  onConsentChange,
  recentSessions,
  loading,
  error,
  onRefreshDetection,
  onStartSession,
  onOpenSession,
}) => {
  const [showManualProblem, setShowManualProblem] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualStatement, setManualStatement] = useState("");
  const [manualLang, setManualLang] = useState("python");

  const { detection, problem, extractionError } = tabContext;

  const handleManualStart = (e: React.FormEvent) => {
    e.preventDefault();
    const platform: SupportedPlatform = detection.platform ?? "leetcode";
    onStartSession({
      platform,
      problemTitle: manualTitle.trim(),
      problemUrl: detection.canonicalUrl || tabContext.url || "https://leetcode.com/problems/manual/",
      problemStatement: manualStatement.trim(),
      constraints: [],
      examples: [],
      programmingLanguage: manualLang,
    });
  };

  return (
    <div className="stack-md">
      <section className="card">
        <div className="card-header-row">
          <div className="row-center">
            <Compass size={16} className="accent-icon" />
            <h2>Active Tab Detection</h2>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={onRefreshDetection}
            title="Re-scan current page"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {!detection.supported || !detection.isProblemPage ? (
          <div className="empty-detect">
            <AlertCircle size={18} className="warn-icon" />
            <div>
              <p className="strong-sm">
                {detection.platform
                  ? `On ${detection.platform.toUpperCase()} (not a problem page)`
                  : "Unsupported Coding Platform"}
              </p>
              <p className="muted-xs">
                {extractionError ||
                  "Open a problem on LeetCode, CodeChef, or HackerRank to start an AI mentoring session."}
              </p>
            </div>
          </div>
        ) : problem ? (
          <div className="detected-box">
            <div className="row-between">
              <span className={`platform-pill platform-${problem.platform}`}>
                {problem.platform.toUpperCase()}
              </span>
              <span className="lang-pill">
                <Code2 size={12} /> {problem.programmingLanguage}
              </span>
            </div>
            <h3 className="problem-title">{problem.problemTitle}</h3>
            <p className="problem-preview">
              {problem.problemStatement.slice(0, 170)}
              {problem.problemStatement.length > 170 ? "..." : ""}
            </p>
            <div className="meta-row">
              <span>{problem.examples.length} examples</span>
              <span>·</span>
              <span>{problem.constraints.length} constraints</span>
            </div>
          </div>
        ) : (
          <div className="stack-sm">
            <div className="alert alert-warning">
              <AlertCircle size={16} />
              <span>
                {extractionError || "Could not parse problem details automatically."}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowManualProblem((v) => !v)}
            >
              {showManualProblem ? "Hide Manual Entry" : "Enter Problem Details Manually"}
            </button>
          </div>
        )}

        {showManualProblem && (
          <form onSubmit={handleManualStart} className="form-stack manual-box">
            <label className="field">
              <span>Problem Title</span>
              <input
                type="text"
                placeholder="e.g., Two Sum"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Language</span>
              <select value={manualLang} onChange={(e) => setManualLang(e.target.value)}>
                <option value="python">Python</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
              </select>
            </label>
            <label className="field">
              <span>Problem Statement</span>
              <textarea
                rows={4}
                placeholder="Paste the problem description..."
                value={manualStatement}
                onChange={(e) => setManualStatement(e.target.value)}
                required
              />
            </label>
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
              Start Session with Manual Problem
            </button>
          </form>
        )}

        <label className="consent-box">
          <input
            type="checkbox"
            checked={consentGranted}
            onChange={(e) => onConsentChange(e.target.checked)}
          />
          <div className="consent-copy">
            <span className="row-center">
              <ShieldCheck size={14} className="emerald-icon" />
              <strong>Automatic Code Capture Consent</strong>
            </span>
            <p className="muted-xs">
              Allow AI DSA Mentor to read your editor code at session start and after each 2-minute countdown to tailor hints.
            </p>
          </div>
        </label>

        {error && <div className="alert alert-error">{error}</div>}

        {problem && (
          <button
            type="button"
            className="btn btn-primary full-width"
            disabled={loading}
            onClick={() => onStartSession()}
          >
            <Play size={15} /> {loading ? "Starting Session..." : "Start / Resume Mentoring Session"}
          </button>
        )}
      </section>

      <section className="card">
        <div className="card-header-row">
          <div className="row-center">
            <History size={16} className="accent-icon" />
            <h2>Recent Sessions</h2>
          </div>
          <span className="muted-xs">{recentSessions.length} saved</span>
        </div>

        {recentSessions.length === 0 ? (
          <p className="muted-xs">No practice sessions yet. Open a problem and start one above.</p>
        ) : (
          <ul className="session-list">
            {recentSessions.slice(0, 6).map((s) => (
              <li key={s.sessionId}>
                <button
                  type="button"
                  className="session-item-btn"
                  onClick={() => onOpenSession(s.sessionId)}
                >
                  <div>
                    <div className="row-center">
                      <span className={`platform-pill platform-${s.platform}`}>
                        {s.platform}
                      </span>
                      <span className="session-item-title">{s.problemTitle}</span>
                    </div>
                    <span className="muted-xs">
                      Hint Level {s.currentHintLevel} · {s.programmingLanguage}
                    </span>
                  </div>
                  <span className={`status-dot status-${s.sessionStatus}`}>
                    {s.sessionStatus === "completed" && <CheckCircle2 size={13} />}
                    {s.sessionStatus}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
