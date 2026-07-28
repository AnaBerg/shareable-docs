"use client";

import { CheckIcon, CopyIcon, Link2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

export type DocumentListEntry = {
  id: string;
  name: string;
  description: string | null;
  latestVersionNumber: number;
  updatedAt: string;
};

type ShareLinkState =
  | { status: "idle" }
  | { status: "creating" }
  | { status: "created"; url: string }
  | { status: "error" };

const updatedAtFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

export function DocumentsList({ documents }: { documents: DocumentListEntry[] }) {
  if (documents.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>No documents yet</EmptyTitle>
          <EmptyDescription>
            Publish a document through the API and it will show up here.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {documents.map((document) => (
        <li key={document.id}>
          <DocumentRow document={document} />
        </li>
      ))}
    </ul>
  );
}

function DocumentRow({ document }: { document: DocumentListEntry }) {
  const [shareLink, setShareLink] = useState<ShareLinkState>({ status: "idle" });

  async function createShareLink() {
    setShareLink({ status: "creating" });

    try {
      const response = await fetch(`/api/docs/${document.id}/link`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Share link creation failed with ${response.status}`);
      }

      const { url } = (await response.json()) as { url: string };
      setShareLink({ status: "created", url });
    } catch {
      setShareLink({ status: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <a
            href={`/d/${document.id}`}
            className="truncate font-medium text-foreground hover:underline"
          >
            {document.name}
          </a>
          <p className="text-xs text-muted-foreground">
            v{document.latestVersionNumber} · Updated{" "}
            {updatedAtFormat.format(new Date(document.updatedAt))}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={createShareLink}
          disabled={shareLink.status === "creating"}
          className="shrink-0"
        >
          <Link2Icon data-icon="inline-start" />
          Create share link
        </Button>
      </div>

      {shareLink.status === "created" && <ShareLinkReveal url={shareLink.url} />}
      {shareLink.status === "error" && (
        <p className="text-sm text-destructive">
          Could not create the share link. Please try again.
        </p>
      )}
    </div>
  );
}

function ShareLinkReveal({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      <InputGroup>
        <InputGroupInput readOnly value={url} aria-label="Share link URL" />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            onClick={copy}
            aria-label={copied ? "Copied" : "Copy share link"}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? "Copied" : "Copy"}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <p className="text-xs text-muted-foreground">
        Copy this link now — it will not be shown again. Creating a new link
        invalidates the previous one.
      </p>
    </div>
  );
}
