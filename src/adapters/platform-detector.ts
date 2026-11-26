import { PlatformDetectionResult, PlatformAdapter } from "./types";
import { leetcodeAdapter } from "./leetcode-adapter";
import { codechefAdapter } from "./codechef-adapter";
import { hackerrankAdapter } from "./hackerrank-adapter";

/**
 * Normalizes a coding platform URL to a canonical problem URL so query params
 * or submission tabs do not accidentally split one problem into multiple sessions.
 */
export function detectPlatformFromUrl(rawUrl: string): PlatformDetectionResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return {
      supported: false,
      platform: null,
      isProblemPage: false,
      canonicalUrl: rawUrl,
      reason: "Invalid tab URL.",
    };
  }

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;

  if (host === "leetcode.com" || host.endsWith(".leetcode.com")) {
    const match = path.match(/^\/problems\/([^/]+)/i);
    if (!match) {
      return {
        supported: true,
        platform: "leetcode",
        isProblemPage: false,
        canonicalUrl: `${parsed.origin}${path}`,
        reason: "Open a specific LeetCode problem (/problems/<slug>/) to start mentoring.",
      };
    }
    return {
      supported: true,
      platform: "leetcode",
      isProblemPage: true,
      canonicalUrl: `${parsed.origin}/problems/${match[1]}/`,
    };
  }

  if (host === "www.codechef.com" || host === "codechef.com") {
    const match = path.match(/^\/(?:[^/]+\/)?problems\/([^/]+)/i);
    const practiceMatch = path.match(/^\/practice\/course\/[^/]+\/[^/]+\/problems\/([^/]+)/i);
    if (!match && !practiceMatch) {
      return {
        supported: true,
        platform: "codechef",
        isProblemPage: false,
        canonicalUrl: `${parsed.origin}${path}`,
        reason: "Open a CodeChef problem page (/problems/<CODE>) to start mentoring.",
      };
    }
    return {
      supported: true,
      platform: "codechef",
      isProblemPage: true,
      canonicalUrl: `${parsed.origin}${path.replace(/\/+$/, "")}`,
    };
  }

  if (host === "www.hackerrank.com" || host === "hackerrank.com") {
    const match = path.match(/^\/challenges\/([^/]+)/i);
    if (!match) {
      return {
        supported: true,
        platform: "hackerrank",
        isProblemPage: false,
        canonicalUrl: `${parsed.origin}${path}`,
        reason: "Open a HackerRank challenge page (/challenges/<slug>/problem) to start mentoring.",
      };
    }
    return {
      supported: true,
      platform: "hackerrank",
      isProblemPage: true,
      canonicalUrl: `${parsed.origin}/challenges/${match[1]}/problem`,
    };
  }

  return {
    supported: false,
    platform: null,
    isProblemPage: false,
    canonicalUrl: rawUrl,
    reason: "Unsupported page. Navigate to a problem on LeetCode, CodeChef, or HackerRank.",
  };
}

export function getAdapterForPlatform(platform: string | null): PlatformAdapter | null {
  switch (platform) {
    case "leetcode":
      return leetcodeAdapter;
    case "codechef":
      return codechefAdapter;
    case "hackerrank":
      return hackerrankAdapter;
    default:
      return null;
  }
}
