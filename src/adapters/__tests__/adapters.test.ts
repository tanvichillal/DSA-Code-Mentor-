import { describe, it, expect, afterEach } from "vitest";
import { detectPlatformFromUrl } from "../platform-detector";
import { leetcodeAdapter } from "../leetcode-adapter";
import { codechefAdapter } from "../codechef-adapter";
import { hackerrankAdapter } from "../hackerrank-adapter";
import { mainWorldCaptureEditorCode } from "../main-world-capture";

describe("Platform Detection", () => {
  it("detects LeetCode problem pages and normalizes URLs", () => {
    const res = detectPlatformFromUrl("https://leetcode.com/problems/two-sum/description/?envType=daily");
    expect(res.supported).toBe(true);
    expect(res.platform).toBe("leetcode");
    expect(res.isProblemPage).toBe(true);
    expect(res.canonicalUrl).toBe("https://leetcode.com/problems/two-sum/");
  });

  it("detects non-problem LeetCode pages", () => {
    const res = detectPlatformFromUrl("https://leetcode.com/problemset/all/");
    expect(res.supported).toBe(true);
    expect(res.isProblemPage).toBe(false);
  });

  it("detects CodeChef and HackerRank problem pages", () => {
    const cc = detectPlatformFromUrl("https://www.codechef.com/problems/START01");
    expect(cc.platform).toBe("codechef");
    expect(cc.isProblemPage).toBe(true);

    const hr = detectPlatformFromUrl("https://www.hackerrank.com/challenges/solve-me-first/problem");
    expect(hr.platform).toBe("hackerrank");
    expect(hr.isProblemPage).toBe(true);
  });

  it("rejects unsupported websites", () => {
    const res = detectPlatformFromUrl("https://example.com/algorithms");
    expect(res.supported).toBe(false);
    expect(res.platform).toBeNull();
  });
});

describe("Platform Problem Extraction Adapters", () => {
  it("extracts LeetCode title, statement, constraints, examples, and language", () => {
    const doc = new DOMParser().parseFromString(
      `
      <html>
        <head><title>1. Two Sum - LeetCode</title></head>
        <body>
          <div class="text-title-large"><a href="/problems/two-sum/">1. Two Sum</a></div>
          <button id="headlessui-listbox-button-:r1:"><span>Python3</span></button>
          <div data-track-load="description_content">
            Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.
            Example 1:
            Input: nums = [2,7,11,15], target = 9
            Output: [0,1]
            Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
            Constraints:
            2 <= nums.length <= 10^4
            -10^9 <= nums[i] <= 10^9
          </div>
        </body>
      </html>
      `,
      "text/html"
    );

    const extracted = leetcodeAdapter.extractProblem(doc, "https://leetcode.com/problems/two-sum/");
    expect(extracted).not.toBeNull();
    expect(extracted?.problemTitle).toBe("1. Two Sum");
    expect(extracted?.programmingLanguage).toBe("python");
    expect(extracted?.examples.length).toBe(1);
    expect(extracted?.constraints.length).toBe(2);
  });

  it("extracts CodeChef problem details", () => {
    const doc = new DOMParser().parseFromString(
      `
      <html>
        <body>
          <div id="problem-statement">
            <h1>Number Mirror</h1>
            Write a program that takes a number N as input and prints it.
            Sample Input
            123
            Sample Output
            123
            Constraints:
            0 <= N <= 10^5
          </div>
        </body>
      </html>
      `,
      "text/html"
    );
    const extracted = codechefAdapter.extractProblem(doc, "https://www.codechef.com/problems/START01");
    expect(extracted?.platform).toBe("codechef");
    expect(extracted?.problemTitle).toBe("Number Mirror");
    expect(extracted?.examples.length).toBe(1);
  });

  it("extracts HackerRank challenge details", () => {
    const doc = new DOMParser().parseFromString(
      `
      <html>
        <body>
          <h1 class="ui-icon-label">Solve Me First</h1>
          <div class="select-language"><div class="css-1uccc91-singleValue">C++17</div></div>
          <div class="challenge-body-html">
            Complete the function solveMeFirst to compute the sum of two integers.
            Sample Input
            a = 2, b = 3
            Sample Output
            5
          </div>
        </body>
      </html>
      `,
      "text/html"
    );
    const extracted = hackerrankAdapter.extractProblem(
      doc,
      "https://www.hackerrank.com/challenges/solve-me-first/problem"
    );
    expect(extracted?.platform).toBe("hackerrank");
    expect(extracted?.problemTitle).toBe("Solve Me First");
    expect(extracted?.programmingLanguage).toBe("cpp");
  });
});

describe("MAIN World Editor Code Capture", () => {
  afterEach(() => {
    delete (window as unknown as { monaco?: unknown }).monaco;
    document.body.innerHTML = "";
  });

  it("reads full source code and language from Monaco models", () => {
    (window as unknown as { monaco: unknown }).monaco = {
      editor: {
        getModels: () => [
          {
            uri: { toString: () => "inmemory://model/1" },
            getValue: () => "class Solution:\n    def twoSum(self, nums, target):\n        return []",
            getLanguageId: () => "python",
          },
        ],
      },
    };

    const res = mainWorldCaptureEditorCode("leetcode");
    expect(res.success).toBe(true);
    expect(res.adapterUsed).toBe("monaco");
    expect(res.programmingLanguage).toBe("python");
    expect(res.code).toContain("def twoSum");
  });

  it("falls back to visible Monaco view-lines when global monaco is unavailable", () => {
    document.body.innerHTML = `
      <div class="monaco-editor">
        <div class="view-lines">
          <div class="view-line">int\u00a0main()\u00a0{</div>
          <div class="view-line">  return 0;</div>
          <div class="view-line">}</div>
        </div>
      </div>
    `;

    const res = mainWorldCaptureEditorCode("leetcode");
    expect(res.success).toBe(true);
    expect(res.adapterUsed).toBe("dom_fallback");
    expect(res.code).toContain("int main() {");
  });

  it("returns explicit failure state when no editor exists", () => {
    const res = mainWorldCaptureEditorCode("codechef");
    expect(res.success).toBe(false);
    expect(res.adapterUsed).toBe("none");
    expect(res.message).toContain("manual code input fallback");
  });
});
