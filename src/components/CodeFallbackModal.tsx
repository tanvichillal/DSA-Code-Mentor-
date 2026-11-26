import React, { useState } from "react";
import { AlertTriangle, RefreshCw, Send, ShieldCheck, X } from "lucide-react";

interface CodeFallbackModalProps {
  visible: boolean;
  message?: string | null;
  defaultLanguage: string;
  initialCode?: string;
  consentGranted: boolean;
  loading: boolean;
  onAcceptConsent: () => void;
  onRetryCapture: () => void;
  onSubmitManual: (code: string, language: string) => void;
  onClose?: () => void;
}

export const CodeFallbackModal: React.FC<CodeFallbackModalProps> = ({
  visible,
  message,
  defaultLanguage,
  initialCode = "",
  consentGranted,
  loading,
  onAcceptConsent,
  onRetryCapture,
  onSubmitManual,
  onClose,
}) => {
  const [code, setCode] = useState(initialCode);
  const [language, setLanguage] = useState(
    defaultLanguage && defaultLanguage !== "unknown" ? defaultLanguage : "python"
  );

  if (!visible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    onSubmitManual(code, language);
  };

  return (
    <section className="card fallback-card">
      <div className="card-header-row">
        <div className="row-center">
          <AlertTriangle size={16} className="warn-icon" />
          <h3>Manual Code Fallback</h3>
        </div>
        {onClose && (
          <button type="button" className="btn btn-ghost btn-xs" onClick={onClose} aria-label="Close fallback">
            <X size={14} />
          </button>
        )}
      </div>

      <p className="muted-xs">
        {message ||
          "Automatic editor extraction was unavailable on this page. Retry capture or paste your current solution below so Groq can analyze your progress."}
      </p>

      <div className="row-gap">
        {!consentGranted && (
          <button
            type="button"
            className="btn btn-success btn-xs"
            onClick={onAcceptConsent}
            disabled={loading}
          >
            <ShieldCheck size={12} /> Accept Consent &amp; Capture
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary btn-xs"
          onClick={onRetryCapture}
          disabled={loading}
        >
          <RefreshCw size={12} /> Retry Auto-Capture
        </button>
      </div>

      <form onSubmit={handleSubmit} className="form-stack">
        <label className="field">
          <span>Language</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
            <option value="java">Java</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
          </select>
        </label>

        <label className="field">
          <span>Your Current Code</span>
          <textarea
            className="code-textarea"
            rows={7}
            placeholder="Paste your latest code here..."
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
        </label>

        <button type="submit" className="btn btn-primary btn-sm full-width" disabled={loading || !code.trim()}>
          <Send size={13} /> {loading ? "Analyzing Code..." : "Submit & Analyze Code"}
        </button>
      </form>
    </section>
  );
};
