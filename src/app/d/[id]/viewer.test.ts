import { readFile } from "node:fs/promises";
import { isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { notFoundError } from "@/server/foundation/errors";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  cookies: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  viewDocument: vi.fn(),
  findActiveUserByClerkId: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/server/services/docs/view-document", () => ({
  viewDocument: mocks.viewDocument,
}));
vi.mock("@/server/repositories/users/find-active-user-by-clerk-id", () => ({
  findActiveUserByClerkId: mocks.findActiveUserByClerkId,
}));

const documentId = "01HZXJK8JHX7QY9N7K6X8Y2W0A";

function viewResult(html: string) {
  const now = new Date("2026-06-12T00:00:00.000Z");
  const document = {
    id: documentId,
    ownerUserId: "owner",
    name: "Quarterly Report",
    description: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const version = {
    id: "01HZXJK8JHX7QY9N7K6X8Y2W0B",
    documentId,
    versionNumber: 2,
    html,
    createdByUserId: "owner",
    createdAt: now,
  };

  return { document, version, latestVersion: version, access: "link" as const };
}

function setLinkTokenCookie(token: string | undefined) {
  mocks.cookies.mockResolvedValue({
    get: (name: string) =>
      token !== undefined && name === `doc_token_${documentId}`
        ? { name, value: token }
        : undefined,
  });
}

async function renderPageElement(searchParams: Record<string, string> = {}) {
  const { default: DocumentViewerPage } = await import("./page");

  return (await DocumentViewerPage({
    params: Promise.resolve({ id: documentId }),
    searchParams: Promise.resolve(searchParams),
  })) as ReactElement;
}

async function renderPage(searchParams: Record<string, string> = {}) {
  return renderToStaticMarkup(await renderPageElement(searchParams));
}

function findIframes(node: unknown, found: ReactElement[] = []): ReactElement[] {
  if (Array.isArray(node)) {
    for (const child of node) findIframes(child, found);
    return found;
  }

  if (!isValidElement(node)) {
    return found;
  }

  if (node.type === "iframe") {
    found.push(node);
  }

  const props = node.props as { children?: unknown };
  findIframes(props.children, found);

  return found;
}

describe("document viewer page", () => {
  beforeEach(() => {
    // Clear every mock, not just viewDocument: a lingering mocks.notFound call
    // from an earlier test would satisfy the not-found assertions below without
    // this test having triggered anything.
    vi.clearAllMocks();
    setLinkTokenCookie(undefined);
  });

  it("renders the stored HTML only inside an iframe sandboxed with exactly allow-scripts", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    mocks.viewDocument.mockResolvedValue(viewResult("<h1>hello</h1><script>evil()</script>"));
    setLinkTokenCookie("token");

    const element = await renderPageElement();

    const iframes = findIframes(element);
    expect(iframes).toHaveLength(1);

    const iframe = iframes[0].props as {
      srcDoc?: string;
      sandbox?: string;
      dangerouslySetInnerHTML?: unknown;
    };

    // Security invariant: allow-scripts WITHOUT allow-same-origin keeps the
    // document in an opaque origin. Adding allow-same-origin would defeat the
    // sandbox entirely — this assertion must never be loosened.
    expect(iframe.sandbox).toBe("allow-scripts");
    expect(iframe.srcDoc).toBe("<h1>hello</h1><script>evil()</script>");
    expect(iframe.dangerouslySetInnerHTML).toBeUndefined();

    const markup = renderToStaticMarkup(element);
    expect(markup).toContain('sandbox="allow-scripts"');
    expect(markup).not.toContain("allow-same-origin");
  });

  it("never injects document HTML via dangerouslySetInnerHTML", async () => {
    const pageSource = await readFile(new URL("./page.tsx", import.meta.url), "utf8");

    expect(pageSource).not.toContain("dangerouslySetInnerHTML");
  });

  it("shows the document name and version indicator", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    mocks.viewDocument.mockResolvedValue(viewResult("<p>doc</p>"));
    setLinkTokenCookie("token");

    const markup = await renderPage();

    expect(markup).toContain("Quarterly Report");
    expect(markup).toContain("v2");
  });

  it("resolves link access from the doc-scoped cookie, without touching the session", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    mocks.viewDocument.mockResolvedValue(viewResult("<p>doc</p>"));
    setLinkTokenCookie("secret-token");

    await renderPage();

    expect(mocks.viewDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        viewer: { kind: "link", token: "secret-token" },
        documentId,
      }),
    );
  });

  it("never reads the link token from the URL search params", async () => {
    // Regression: a `?t=` token in the URL leaks to the sandboxed iframe via
    // document.baseURI. The proxy strips it into a cookie; the page must
    // ignore it entirely even if one slips through.
    mocks.auth.mockResolvedValue({ userId: null });
    mocks.viewDocument.mockRejectedValue(notFoundError("Document not found"));

    await expect(renderPage({ t: "leaked-token" })).rejects.toThrow("NEXT_NOT_FOUND");

    expect(mocks.viewDocument).toHaveBeenCalledWith(
      expect.objectContaining({ viewer: null }),
    );
    expect(mocks.viewDocument).not.toHaveBeenCalledWith(
      expect.objectContaining({
        viewer: expect.objectContaining({ token: "leaked-token" }),
      }),
    );
  });

  it("falls back to the Clerk session when the link cookie is stale", async () => {
    // Regression: a stale or planted doc_token_<id> cookie (e.g. after the
    // owner rotates the link) must not lock a session-authorized viewer out.
    mocks.auth.mockResolvedValue({ userId: "clerk_owner" });
    mocks.findActiveUserByClerkId.mockResolvedValue({
      id: "owner",
      clerkUserId: "clerk_owner",
      primaryEmail: "owner@example.com",
    });
    mocks.viewDocument.mockImplementation(async ({ viewer }) =>
      viewer?.kind === "user"
        ? viewResult("<p>doc</p>")
        : Promise.reject(notFoundError("Document not found")),
    );
    setLinkTokenCookie("stale-token");

    const markup = await renderPage();

    expect(markup).toContain("Quarterly Report");
    expect(mocks.viewDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        viewer: { kind: "user", userId: "owner", email: "owner@example.com" },
      }),
    );
  });

  it("falls back to the Clerk session when there is no token", async () => {
    mocks.auth.mockResolvedValue({ userId: "clerk_owner" });
    mocks.findActiveUserByClerkId.mockResolvedValue({
      id: "owner",
      clerkUserId: "clerk_owner",
      primaryEmail: "Owner@Example.com",
    });
    mocks.viewDocument.mockResolvedValue(viewResult("<p>doc</p>"));

    await renderPage();

    expect(mocks.viewDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        viewer: { kind: "user", userId: "owner", email: "owner@example.com" },
      }),
    );
  });

  it("requests the version from the version search param", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    mocks.viewDocument.mockResolvedValue(viewResult("<p>doc</p>"));
    setLinkTokenCookie("token");

    await renderPage({ version: "3" });

    expect(mocks.viewDocument).toHaveBeenCalledWith(
      expect.objectContaining({ version: 3 }),
    );
  });

  it("renders the not-found page when the service hides the document", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    mocks.viewDocument.mockRejectedValue(notFoundError("Document not found"));
    setLinkTokenCookie("revoked");

    await expect(renderPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.notFound).toHaveBeenCalled();
  });

  it("renders the not-found page for an anonymous visitor without a token", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    mocks.viewDocument.mockRejectedValue(notFoundError("Document not found"));

    await expect(renderPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
