import React from "react";
import { ArrowLeft, Code2 } from "lucide-react";
import { SessionRecord } from "../services/api";

interface ProblemInfoProps {
  session: SessionRecord;
  detectedLiveLanguage?: string;
  onBackToDashboard: () => void;
}

export const ProblemInfo: React.FC<ProblemInfoProps> = ({
  session,
  detectedLiveLanguage,
  onBackToDashboard,
}) => {
  const languageChanged =
    detectedLiveLanguage &&
    detectedLiveLanguage !== "unknown" &&
    detectedLiveLanguage !== session.programmingLanguage;

  return (
    <section className="card problem-info-card">
      <div className="row-between">
        <button type="button" className="btn btn-ghost btn-xs" onClick={onBackToDashboard}>
          <ArrowLeft size={13} /> Dashboard
        </button>
        <span className={`status-badge status-${session.sessionStatus}`}>
          {session.sessionStatus.toUpperCase()}
        </span>
      </div>

      <div className="problem-meta-top">
        <span className={`platform-pill platform-${session.platform}`}>
          {session.platform.toUpperCase()}
        </span>
        <span className="lang-pill">
          <Code2 size={12} /> {languageChanged ? detectedLiveLanguage : session.programmingLanguage}
          {languageChanged && <em className="lang-updated"> (updated)</em>}
        </span>
        <span className="level-pill">Hint Level {session.currentHintLevel}</span>
      </div>

      <h2 className="active-problem-title">{session.problemTitle}</h2>
    </section>
  );
};
