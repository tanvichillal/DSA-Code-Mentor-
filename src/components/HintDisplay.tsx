import React from "react";
import { Lightbulb, Sparkles, Bug, Check, ArrowUpRight } from "lucide-react";
import { CodeAnalysisResult, HintRecord } from "../services/api";

interface HintDisplayProps {
  hints: HintRecord[];
  analysis: Partial<CodeAnalysisResult> | null | undefined;
}

export const HintDisplay: React.FC<HintDisplayProps> = ({ hints, analysis }) => {
  const hasAnalysis = analysis && Object.keys(analysis).length > 0;

  return (
    <div className="stack-md">
      {hasAnalysis && (
        <section className="card analysis-card">
          <div className="card-header-row">
            <div className="row-center">
              <Sparkles size={16} className="emerald-icon" />
              <h3>AI Code Progress Analysis</h3>
            </div>
            {typeof analysis.understoodPreviousHint === "boolean" && (
              <span
                className={`mini-badge ${
                  analysis.understoodPreviousHint ? "badge-ok" : "badge-warn"
                }`}
              >
                {analysis.understoodPreviousHint ? (
                  <>
                    <Check size={11} /> On Track
                  </>
                ) : (
                  "Needs Refocus"
                )}
              </span>
            )}
          </div>

          {analysis.changesSummary && (
            <p className="analysis-line">
              <strong>Changes:</strong> {analysis.changesSummary}
            </p>
          )}
          {analysis.approachAssessment && (
            <p className="analysis-line">
              <strong>Assessment:</strong> {analysis.approachAssessment}
            </p>
          )}
          {Array.isArray(analysis.logicalErrors) && analysis.logicalErrors.length > 0 && (
            <div className="errors-list">
              <span className="row-center error-heading">
                <Bug size={13} /> Issues noticed:
              </span>
              <ul>
                {analysis.logicalErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
          {analysis.nextHintFocus && (
            <p className="analysis-focus">
              <ArrowUpRight size={13} /> <strong>Next focus:</strong> {analysis.nextHintFocus}
            </p>
          )}
        </section>
      )}

      <section className="card">
        <div className="card-header-row">
          <div className="row-center">
            <Lightbulb size={16} className="indigo-icon" />
            <h3>Mentor Hints</h3>
          </div>
          <span className="muted-xs">{hints.length} unlocked</span>
        </div>

        {hints.length === 0 ? (
          <div className="empty-hints">
            <p className="muted-sm">
              Ready when you are. Click <strong>Request Hint</strong> below to get your first conceptual nudge without spoiling the solution.
            </p>
          </div>
        ) : (
          <div className="hints-stack">
            {hints.map((hint) => (
              <article key={hint.hintId} className="hint-item">
                <div className="hint-item-header">
                  <span className="hint-level-tag">Hint Level {hint.hintLevel}</span>
                  <span className="muted-xs">
                    {new Date(hint.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="hint-text">{hint.hintText}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
