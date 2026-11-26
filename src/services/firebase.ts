export interface AuthUserSession {
  uid: string;
  email: string;
  displayName: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

const STORAGE_KEY = "dsa_mentor_auth_session";

function getFirebaseApiKey(): string {
  return (import.meta.env.VITE_FIREBASE_API_KEY as string | undefined)?.trim() ?? "";
}

function getGoogleClientId(): string {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? "";
}

export function isFirebaseConfigured(): boolean {
  return getFirebaseApiKey().length > 0;
}

export function isGoogleSignInConfigured(): boolean {
  return getGoogleClientId().length > 0;
}

export function getExtensionRedirectUrl(): string {
  try {
    return chrome.identity.getRedirectURL("oauth2");
  } catch {
    return "https://<extension-id>.chromiumapp.org/oauth2";
  }
}

function mapFirebaseAuthError(code: string): string {
  switch (code) {
    case "EMAIL_EXISTS":
      return "An account with this email already exists.";
    case "EMAIL_NOT_FOUND":
    case "INVALID_PASSWORD":
    case "INVALID_LOGIN_CREDENTIALS":
      return "Invalid email or password.";
    case "WEAK_PASSWORD : Password should be at least 6 characters":
    case "WEAK_PASSWORD":
      return "Password must be at least 6 characters.";
    case "INVALID_EMAIL":
      return "Please enter a valid email address.";
    case "TOO_MANY_ATTEMPTS_TRY_LATER":
      return "Too many login attempts. Please wait a moment and try again.";
    default:
      return code ? `Authentication failed: ${code}` : "Authentication failed.";
  }
}

async function saveSession(session: AuthUserSession | null): Promise<void> {
  if (!session) {
    await chrome.storage.local.remove(STORAGE_KEY);
    return;
  }
  await chrome.storage.local.set({ [STORAGE_KEY]: session });
}

export async function getStoredAuthSession(): Promise<AuthUserSession | null> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as AuthUserSession | undefined) ?? null;
}

export async function signUpWithEmail(
  name: string,
  email: string,
  password: string
): Promise<AuthUserSession> {
  const apiKey = getFirebaseApiKey();
  if (!apiKey) {
    throw new Error(
      "Firebase Web API key is missing. Set VITE_FIREBASE_API_KEY in chrome-extension/.env and rebuild."
    );
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(mapFirebaseAuthError(data?.error?.message ?? ""));
  }

  // Update display name on Firebase profile
  if (name.trim()) {
    await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken: data.idToken,
          displayName: name.trim(),
          returnSecureToken: false,
        }),
      }
    );
  }

  const session: AuthUserSession = {
    uid: data.localId,
    email: data.email ?? email,
    displayName: name.trim() || email.split("@")[0],
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000,
  };
  await saveSession(session);
  return session;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<AuthUserSession> {
  const apiKey = getFirebaseApiKey();
  if (!apiKey) {
    throw new Error(
      "Firebase Web API key is missing. Set VITE_FIREBASE_API_KEY in chrome-extension/.env and rebuild."
    );
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(mapFirebaseAuthError(data?.error?.message ?? ""));
  }

  const session: AuthUserSession = {
    uid: data.localId,
    email: data.email ?? email,
    displayName: data.displayName || email.split("@")[0],
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000,
  };
  await saveSession(session);
  return session;
}

export async function signInWithGoogle(): Promise<AuthUserSession> {
  const apiKey = getFirebaseApiKey();
  if (!apiKey) {
    throw new Error(
      "Firebase Web API key is missing. Set VITE_FIREBASE_API_KEY in chrome-extension/.env and rebuild."
    );
  }

  const googleClientId = getGoogleClientId();
  if (!googleClientId) {
    throw new Error(
      `Google Sign-In needs VITE_GOOGLE_CLIENT_ID in chrome-extension/.env. Add this redirect URI to Google Cloud OAuth: ${getExtensionRedirectUrl()}`
    );
  }

  if (!chrome.identity?.launchWebAuthFlow) {
    throw new Error("Chrome Identity API is unavailable. Reload the extension in chrome://extensions.");
  }

  const redirectUri = getExtensionRedirectUrl();
  const nonce = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: googleClientId,
    response_type: "id_token",
    redirect_uri: redirectUri,
    scope: "openid email profile",
    nonce,
    prompt: "select_account",
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });

  if (!responseUrl) {
    throw new Error("Google sign-in was cancelled.");
  }

  const hashFragment = new URL(responseUrl).hash.replace(/^#/, "");
  const hashParams = new URLSearchParams(hashFragment);
  const googleIdToken = hashParams.get("id_token");
  const oauthError = hashParams.get("error");
  if (oauthError) {
    throw new Error(`Google sign-in failed: ${oauthError}`);
  }
  if (!googleIdToken) {
    throw new Error("Google sign-in did not return an ID token.");
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: `id_token=${encodeURIComponent(googleIdToken)}&providerId=google.com`,
        requestUri: redirectUri,
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(mapFirebaseAuthError(data?.error?.message ?? ""));
  }

  const session: AuthUserSession = {
    uid: data.localId,
    email: data.email ?? "",
    displayName: data.displayName || data.fullName || (data.email ? String(data.email).split("@")[0] : "Learner"),
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn || 3600) * 1000,
  };
  await saveSession(session);
  return session;
}

export async function getValidIdToken(): Promise<string> {
  const session = await getStoredAuthSession();
  if (!session) {
    throw new Error("You are not logged in.");
  }

  // Refresh 2 minutes before expiry
  if (Date.now() < session.expiresAt - 120_000) {
    return session.idToken;
  }

  const apiKey = getFirebaseApiKey();
  if (!apiKey) {
    return session.idToken;
  }

  const res = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: session.refreshToken,
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    await saveSession(null);
    throw new Error("Session expired. Please sign in again.");
  }

  const refreshed: AuthUserSession = {
    ...session,
    idToken: data.id_token,
    refreshToken: data.refresh_token || session.refreshToken,
    expiresAt: Date.now() + Number(data.expires_in || 3600) * 1000,
  };
  await saveSession(refreshed);
  return refreshed.idToken;
}

export async function signOut(): Promise<void> {
  await saveSession(null);
}
