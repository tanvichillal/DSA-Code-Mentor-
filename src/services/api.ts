import { ExtractedProblemContext, SupportedPlatform } from "../adapters/types";
import { getValidIdToken } from "./firebase";

const DEFAULT_API_BASE = "http://127.0.0.1:8000";

export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
  return (envUrl || DEFAULT_API_BASE).replace(/\/+$/, "");
}

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface SessionRecord {
  sessionId: string;
  userId: string;
  platform: SupportedPlatform;
  problemTitle: string;
  problemUrl: string;
  problemStatement: string;
  constraints: string[];
  examples: Array<{ input: string; output: string; explanation: string }>;
  programmingLanguage: string;
  currentHintLevel: number;
  sessionStatus: "active" | "completed" | "ended";
  lastHintTimestamp: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HintRecord {
  hintId: string;
  sessionId: string;
  hintLevel: number;
  hintText: string;
  createdAt: string;
}

export interface CodeAnalysisResult {
  changesSummary: string;
  understoodPreviousHint: boolean;
  approachAssessment: string;
  logicalErrors: string[];
  movingTowardOptimal: boolean;
  nextHintFocus: string;
  appearsSolved: boolean;
}

export interface ProgressRecord {
  sessionId: string;
  previousCode: string;
  latestCode: string;
  analysis: Partial<CodeAnalysisResult>;
  updatedAt: string;
}

export interface SessionStatusResponse {
  sessionId: string;
  sessionStatus: "active" | "completed" | "ended";
  currentHintLevel: number;
  cooldownSeconds: number;
  cooldownRemainingSeconds: number;
  canRequestHint: boolean;
  lastHintTimestamp: string | null;
  cooldownEndsAt: string | null;
  programmingLanguage: string;
  hasLatestAnalysis: boolean;
  latestAnalysis: Partial<CodeAnalysisResult> | null;
}

export interface HintResponse {
  hint: HintRecord;
  cooldownSeconds: number;
  cooldownRemainingSeconds: number;
  cooldownEndsAt: string;
  currentHintLevel: number;
  analysisSummary: string | null;
}

export interface CodeAnalyzeResponse {
  sessionId: string;
  analysis: CodeAnalysisResult;
  updatedAt: string;
  canRequestNextHint: boolean;
  cooldownRemainingSeconds: number;
}

export class ApiError extends Error {
  status: number;
  cooldownRemainingSeconds?: number;

  constructor(message: string, status: number, cooldownRemainingSeconds?: number) {
    super(message);
    this.status = status;
    this.cooldownRemainingSeconds = cooldownRemainingSeconds;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getValidIdToken();
  const baseUrl = getApiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      `Cannot reach AI DSA Mentor backend at ${baseUrl}. Make sure uvicorn is running on port 8000.`,
      0
    );
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const detail = (data as { detail?: unknown } | null)?.detail;
    if (typeof detail === "string") {
      throw new ApiError(detail, res.status);
    }
    if (detail && typeof detail === "object") {
      const obj = detail as { message?: string; cooldownRemainingSeconds?: number };
      throw new ApiError(
        obj.message || `Request failed (${res.status})`,
        res.status,
        obj.cooldownRemainingSeconds
      );
    }
    throw new ApiError(`Request failed with status ${res.status}`, res.status);
  }

  return data as T;
}

export const api = {
  verifyAuth(name?: string): Promise<UserProfile> {
    return request<UserProfile>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify(name ? { name } : {}),
    });
  },

  createSession(
    problem: ExtractedProblemContext,
    initialCode?: string,
    reuseActive = true
  ): Promise<{ session: SessionRecord; resumed: boolean }> {
    return request("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        ...problem,
        initialCode: initialCode ?? null,
        reuseActive,
      }),
    });
  },

  listSessions(): Promise<SessionRecord[]> {
    return request("/api/sessions", { method: "GET" });
  },

  getSession(sessionId: string): Promise<{
    session: SessionRecord;
    hints: HintRecord[];
    progress: ProgressRecord | null;
    status: SessionStatusResponse;
  }> {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}`, {
      method: "GET",
    });
  },

  getSessionStatus(sessionId: string): Promise<SessionStatusResponse> {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/status`, {
      method: "GET",
    });
  },

  requestHint(
    sessionId: string,
    currentCode?: string,
    programmingLanguage?: string
  ): Promise<HintResponse> {
    return request("/api/hints/request", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        currentCode: currentCode ?? null,
        programmingLanguage: programmingLanguage ?? null,
      }),
    });
  },

  submitCodeSnapshot(
    sessionId: string,
    code: string,
    programmingLanguage: string,
    source = "auto_capture"
  ): Promise<{
    snapshot: { snapshotId: string; capturedAt: string };
    previousCodeAvailable: boolean;
    retainedSnapshotsCount: number;
  }> {
    return request("/api/code/snapshot", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        code,
        programmingLanguage,
        source,
      }),
    });
  },

  analyzeCode(
    sessionId: string,
    latestCode?: string,
    programmingLanguage?: string
  ): Promise<CodeAnalyzeResponse> {
    return request("/api/code/analyze", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        latestCode: latestCode ?? null,
        programmingLanguage: programmingLanguage ?? null,
      }),
    });
  },

  endSession(
    sessionId: string,
    reason: "solved" | "ended_by_user" = "ended_by_user"
  ): Promise<{ sessionId: string; sessionStatus: "completed" | "ended"; updatedAt: string }> {
    return request(`/api/sessions/${encodeURIComponent(sessionId)}/end`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },
};
