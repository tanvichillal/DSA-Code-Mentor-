import React from "react";
import {
  CheckCircle2,
  Code,
  Flag,
  Loader2,
  Sparkles,
  Trophy,
} from "lucide-react";
import { TimerViewState } from "../hooks/useTimer";
import { SessionRecord } from "../services/api";

interface SessionControlsProps {
  session: SessionRecord;
  timer: TimerViewState;
  hintLoading: boolean;
  actionLoading: boolean;
  onRequestHint: () => void;
  onOpenManualFallback: () => void;
  onEndSession: (reason: "solved" | "ended_by_user") => void;
  onBackToDashboard: () => void;
}

export const SessionControls: React.FC<SessionControlsProps> = ({
  session,
  timer,
  hintLoading,
  actionLoading,
  onRequestHint,
  onOpenManualFallback,
  onEndSession,
  onBackToDashboard,
}) => {
  if (session.sessionStatus !== "active") {
    return (
      <section className="card completed-card">
        <div className="row-center">
          <Trophy size={20} className="emerald-icon" />
          <div>
            <h3>
              {session.sessionStatus === "completed"
                ? "Problem Solved — Session Completed!"
                : "Session Ended"}
            </h3>
            <p className="muted-xs">
              Reached Hint Level {session.currentHintLevel} on {session.problemTitle}.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary full-width"
          onClick={onBackToDashboard}
        >
          Back to Dashboard
        </button>
      </section>
    );
  }

  const hintDisabled =
    hintLoading ||
    actionLoading ||
    timer.isCoolingDown ||
    timer.autoCaptureStatus === "capturing";

  return (
    <section className="card controls-card">
      <button
        type="button"
        className="btn btn-primary full-width"
        disabled={hintDisabled}
        onClick={onRequestHint}
      >
        {hintLoading ? (
          <>
            <Loader2 size={16} className="spin" /> Generating Mentor Hint...
          </>
        ) : timer.isCoolingDown ? (
          `Request Hint locked (${timer.remainingSeconds}s left)`
        ) : (
          <>
            <Sparkles size={16} />{" "}
            {session.currentHintLevel === 0
              ? "Request Hint (Level 1)"
              : `Request Next Hint (Level ${session.currentHintLevel + 1})`}
          </>
        )}
      </button>

      <div className="controls-secondary-row">
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={onOpenManualFallback}
          disabled={actionLoading}
        >
          <Code size={13} /> Paste Code Manually
        </button>

        <div className="row-gap">
          <button
            type="button"
            className="btn btn-success btn-xs"
            onClick={() => onEndSession("solved")}
            disabled={actionLoading}
          >
            <CheckCircle2 size={13} /> Solved
          </button>
          <button
            type="button"
            className="btn btn-danger-outline btn-xs"
            onClick={() => onEndSession("ended_by_user")}
            disabled={actionLoading}
          >
            <Flag size={13} /> End Session
          </button>
        </div>
      </div>
    </section>
  );
};
