import React, { useState } from "react";
import { BrainCircuit, Lock, Mail, User, AlertTriangle, Loader2 } from "lucide-react";
import {
  AuthUserSession,
  getExtensionRedirectUrl,
  isFirebaseConfigured,
  isGoogleSignInConfigured,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from "../services/firebase";
import { api } from "../services/api";

interface LoginProps {
  onAuthenticated: (session: AuthUserSession) => void;
}

export const Login: React.FC<LoginProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firebaseReady = isFirebaseConfigured();
  const googleReady = isGoogleSignInConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const userSession =
        mode === "register"
          ? await signUpWithEmail(name, email.trim(), password)
          : await signInWithEmail(email.trim(), password);

      // Verify token with FastAPI backend & create/update Firestore user document
      await api.verifyAuth(mode === "register" ? name.trim() : undefined);
      onAuthenticated(userSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const userSession = await signInWithGoogle();
      await api.verifyAuth(userSession.displayName);
      onAuthenticated(userSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="panel-shell auth-shell">
      <div className="brand-header">
        <div className="brand-logo">
          <BrainCircuit size={22} />
        </div>
        <div>
          <h1 className="brand-title">AI DSA Mentor</h1>
          <p className="brand-subtitle">Progressive hints · Auto code analysis</p>
        </div>
      </div>

      {!firebaseReady && (
        <div className="alert alert-warning">
          <AlertTriangle size={16} />
          <div>
            <strong>Firebase Web API Key missing.</strong>
            <p className="muted-xs">
              Add <code>VITE_FIREBASE_API_KEY</code> in <code>chrome-extension/.env</code> and rebuild before signing in.
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="segmented-tabs">
          <button
            type="button"
            className={`seg-btn ${mode === "login" ? "active" : ""}`}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`seg-btn ${mode === "register" ? "active" : ""}`}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            Create Account
          </button>
        </div>

        <button
          type="button"
          className="btn btn-google full-width"
          onClick={handleGoogleSignIn}
          disabled={loading || googleLoading}
        >
          {googleLoading ? (
            <>
              <Loader2 size={16} className="spin" /> Connecting to Google...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.8 9.1-9.2 0-.6-.1-1.1-.2-1.6H12z"
                />
                <path
                  fill="#34A853"
                  d="M3.6 7.4l3.2 2.3C7.7 7.6 9.7 6 12 6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 8.3 2.5 5.1 4.6 3.6 7.4z"
                />
                <path
                  fill="#FBBC05"
                  d="M12 21.5c2.5 0 4.6-.8 6.2-2.3l-2.9-2.4c-.8.5-1.8.9-3.3.9-3.8 0-5.1-2.5-5.4-3.8l-3.2 2.5c1.5 2.9 4.7 5.1 8.6 5.1z"
                />
                <path
                  fill="#4285F4"
                  d="M21.1 12.3c0-.6-.1-1.1-.2-1.6H12v3.9h5.4c-.3 1.2-1 2.2-2.1 2.9l2.9 2.4c1.8-1.6 2.9-4.1 2.9-7.6z"
                />
              </svg>
              {mode === "register" ? "Sign up with Google" : "Continue with Google"}
            </>
          )}
        </button>

        {!googleReady && (
          <p className="muted-xs">
            To enable Google Sign-In, set <code>VITE_GOOGLE_CLIENT_ID</code> in{" "}
            <code>chrome-extension/.env</code> with redirect URI{" "}
            <code>{getExtensionRedirectUrl()}</code>.
          </p>
        )}

        <div className="divider-row">
          <span>or continue with email</span>
        </div>

        <form onSubmit={handleSubmit} className="form-stack">
          {mode === "register" && (
            <label className="field">
              <span>Full Name</span>
              <div className="input-wrap">
                <User size={15} />
                <input
                  type="text"
                  placeholder="Ada Lovelace"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </label>
          )}

          <label className="field">
            <span>Email Address</span>
            <div className="input-wrap">
              <Mail size={15} />
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </label>

          <label className="field">
            <span>Password</span>
            <div className="input-wrap">
              <Lock size={15} />
              <input
                type="password"
                placeholder="••••••••"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </label>

          {error && <div className="alert alert-error">{error}</div>}

          <button
            type="submit"
            className="btn btn-primary full-width"
            disabled={loading || googleLoading}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="spin" /> Authenticating...
              </>
            ) : mode === "login" ? (
              "Sign In to Mentor"
            ) : (
              "Register & Start Practicing"
            )}
          </button>
        </form>
      </div>

      <p className="footer-note">
        Supports LeetCode, CodeChef, and HackerRank. Your code is read only with consent.
      </p>
    </div>
  );
};
