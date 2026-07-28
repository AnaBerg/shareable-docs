import type { ReactElement } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DocumentsList, type DocumentListEntry } from "./documents-list";

const now = "2026-06-12T00:00:00.000Z";

function entry(overrides: Partial<DocumentListEntry> = {}): DocumentListEntry {
  return {
    id: "01HZXJK8JHX7QY9N7K6X8Y2W0A",
    name: "Quarterly Report",
    description: null,
    latestVersionNumber: 3,
    updatedAt: now,
    ...overrides,
  };
}

function render(documents: DocumentListEntry[]) {
  return renderToStaticMarkup(
    createElement(DocumentsList, { documents }) as ReactElement,
  );
}

describe("DocumentsList", () => {
  it("renders an empty state when the owner has no documents", () => {
    const markup = render([]);

    expect(markup).toContain("No documents yet");
  });

  it("links each document to its viewer page", () => {
    const markup = render([entry()]);

    expect(markup).toContain('href="/d/01HZXJK8JHX7QY9N7K6X8Y2W0A"');
    expect(markup).toContain("Quarterly Report");
  });

  it("shows the latest version for each document", () => {
    const markup = render([entry({ latestVersionNumber: 7 })]);

    expect(markup).toContain("v7");
  });

  it("offers a create-share-link action per document", () => {
    const markup = render([
      entry(),
      entry({ id: "01HZXJK8JHX7QY9N7K6X8Y2W0B", name: "Roadmap" }),
    ]);

    expect(markup.match(/Create share link/g)).toHaveLength(2);
  });

  it("does not reveal any share link URL before one is created", () => {
    const markup = render([entry()]);

    expect(markup).not.toContain("?t=");
  });
});
