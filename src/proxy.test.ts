import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  protect: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/nextjs/server")>();

  return {
    ...actual,
    clerkMiddleware: (handler: (auth: unknown, req: NextRequest) => unknown) => {
      return (req: NextRequest) => handler({ protect: mocks.protect }, req);
    },
  };
});

const documentId = "01HZXJK8JHX7QY9N7K6X8Y2W0A";
const token = "secret-link-token";

async function runProxy(url: string) {
  const { default: proxy } = await import("./proxy");

  return (await proxy(new NextRequest(url), {} as never)) as Response | undefined;
}

describe("proxy", () => {
  beforeEach(() => {
    mocks.protect.mockClear();
  });

  it("redirects /d/<id>?t=TOKEN to the clean URL and moves the token into a cookie", async () => {
    const response = await runProxy(`https://example.com/d/${documentId}?t=${token}`);

    expect(response).toBeDefined();
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe(`https://example.com/d/${documentId}`);

    const setCookie = response?.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`doc_token_${documentId}=${token}`);
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain(`path=/d/${documentId}`.toLowerCase());
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
  });

  it("does not leave the token anywhere in the Location header", async () => {
    const response = await runProxy(`https://example.com/d/${documentId}?t=${token}`);

    expect(response?.headers.get("location")).not.toContain(token);
  });

  it("preserves other query params like version across the redirect", async () => {
    const response = await runProxy(
      `https://example.com/d/${documentId}?t=${token}&version=3`,
    );

    const location = response?.headers.get("location") ?? "";
    expect(location).toContain("version=3");
    expect(location).not.toContain(token);
  });

  it("leaves /d/<id> requests without a token alone and keeps them public", async () => {
    const response = await runProxy(`https://example.com/d/${documentId}`);

    expect(response).toBeUndefined();
    expect(mocks.protect).not.toHaveBeenCalled();
  });

  it("does not protect tokenized viewer requests either", async () => {
    await runProxy(`https://example.com/d/${documentId}?t=${token}`);

    expect(mocks.protect).not.toHaveBeenCalled();
  });

  it("marks the token cookie secure in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();

    try {
      const response = await runProxy(`https://example.com/d/${documentId}?t=${token}`);

      expect(response?.headers.get("set-cookie")?.toLowerCase()).toContain("secure");
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("ignores a viewer path whose id is not a ULID", async () => {
    // The id is interpolated into the cookie name and path, so anything but a
    // real ULID must not reach Set-Cookie: cookies.set rejects invalid values,
    // which would turn a crafted URL into a 500 before auth runs.
    const response = await runProxy(
      `https://example.com/d/not;a=ulid?t=${token}`,
    );

    expect(response).toBeUndefined();
  });

  it("still protects dashboard routes", async () => {
    await runProxy("https://example.com/dashboard");

    expect(mocks.protect).toHaveBeenCalled();
  });
});
