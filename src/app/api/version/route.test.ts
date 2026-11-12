import { describe, it, expect } from "vitest";
import { GET } from "./route";

describe("Version API Route - GET /api/version", () => {
  it("returns active version, build timestamp, app name, git commit, and release notes", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.version).toBe("1.0.1");
    expect(data.appName).toContain("Homicho Ammunition Engineering Industry");
    expect(data.minAppVersion).toBe("1.0.0");
    expect(data.releaseNotes).toBeDefined();
    expect(data.buildTime).toBeDefined();
    expect(data.gitCommit).toBe("bc4b2e1");
    expect(data.githubRepo).toBe("eyuelkebede20/dpm");
    expect(data.githubUrl).toBe("https://github.com/eyuelkebede20/dpm");
  });
});
