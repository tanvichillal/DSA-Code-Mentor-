import React from "react";
import { Clock, CheckCircle2, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { TimerViewState } from "../hooks/useTimer";

interface TimerProps {
  timer: TimerViewState;
  currentHintLevel: number;
  loading?: boolean;
  onRetryCapture?: () => void;
}

function formatMMSS(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export const Timer: React.FC<TimerProps> = ({
  timer,
  currentHintLevel,
  loading = false,
  onRetryCapture,
}) => {
  if (currentHintLevel === 0 && !timer.isCoolingDown) {
    return null;
  }

  return (
    <section className={`card timer-card ${timer.isCoolingDown ? "timer-active" : "timer-ready"}`}>
      <div className="row-between">
        <div className="row-center">
          <Clock size={16} className={timer.isCoolingDown ? "indigo-icon" : "emerald-icon"} />
          <h3>
            {timer.isCoolingDown
              ? "2-Minute Thinking Period"
              : "Thinking Period Complete"}
          </h3>
        </div>
        <span className="timer-clock">{formatMMSS(timer.remainingSeconds)}</span>
      </div>

      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${timer.progressPercent}%` }}
        />
      </div>

      <div className="timer-status-row stack-sm">
        {timer.autoCaptureStatus === "capturing" && (
          <span className="capture-status capturing">
            <Loader2 size={13} className="spin" /> Reading editor & analyzing your changes...
          </span>
        )}
        {timer.autoCaptureStatus === "analyzed" && (
          <span className="capture-status analyzed">
            <CheckCircle2 size={13} /> {timer.autoCaptureMessage || "Code captured and analyzed."}
          </span>
        )}
        {timer.autoCaptureStatus === "failed" && (
          <>
            <span className="capture-status failed">
              <AlertTriangle size={13} /> {timer.autoCaptureMessage || "Automatic capture failed."}
            </span>
            {onRetryCapture && (
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={onRetryCapture}
                disabled={loading}
              >
                <RefreshCw size={12} /> Retry Capture &amp; Analysis
              </button>
            )}
          </>
        )}
        {timer.autoCaptureStatus === "pending" && timer.isCoolingDown && (
          <span className="muted-xs">
            Work on your code in the editor. We will capture & analyze automatically when the timer reaches 00:00.
          </span>
        )}
        {timer.autoCaptureStatus === "idle" && !timer.isCoolingDown && (
          <span className="muted-xs">Cooldown satisfied. Ready for your next hint.</span>
        )}
      </div>
    </section>
  );
};
