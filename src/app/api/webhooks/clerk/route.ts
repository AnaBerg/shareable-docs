import { verifyWebhook } from "@clerk/nextjs/webhooks";

import {
  createDrizzleUserSyncRepository,
  syncClerkUserDeleted,
  syncClerkUserUpserted,
} from "@/server/clerk/user-sync";

import { getClerkWebhookEventId, toClerkUserLike } from "./event";

export const runtime = "nodejs";

type ClerkWebhookEvent = Awaited<ReturnType<typeof verifyWebhook>>;

export async function POST(req: Request): Promise<Response> {
  let event: ClerkWebhookEvent;

  try {
    event = await verifyWebhook(req as Parameters<typeof verifyWebhook>[0]);
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const repository = createDrizzleUserSyncRepository();

    await syncClerkUserUpserted(repository, toClerkUserLike(event.data));

    return new Response("OK", { status: 200 });
  }

  if (event.type === "user.deleted") {
    const repository = createDrizzleUserSyncRepository();

    await syncClerkUserDeleted(repository, event.data);

    return new Response("OK", { status: 200 });
  }

  console.info("Unsupported Clerk webhook event", {
    id: getClerkWebhookEventId(event),
    type: event.type,
  });

  return new Response("OK", { status: 200 });
}
