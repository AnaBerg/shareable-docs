import { verifyWebhook } from "@clerk/nextjs/webhooks";

import {
  createDrizzleUserSyncRepository,
  syncClerkUserDeleted,
  syncClerkUserUpserted,
  type ClerkUserLike,
} from "@/server/clerk/user-sync";

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
    id: getEventId(event),
    type: event.type,
  });

  return new Response("OK", { status: 200 });
}

function toClerkUserLike(data: ClerkWebhookEvent["data"]): ClerkUserLike {
  const clerkUser = data as ClerkUserLike & {
    first_name?: string | null;
    image_url?: string | null;
    last_name?: string | null;
    primary_email_address_id?: string | null;
    email_addresses?: Array<{
      id: string;
      email_address?: string;
      emailAddress?: string;
    }>;
  };

  return {
    id: clerkUser.id,
    primaryEmailAddressId:
      clerkUser.primaryEmailAddressId ?? clerkUser.primary_email_address_id,
    emailAddresses: clerkUser.emailAddresses ?? toEmailAddresses(clerkUser),
    firstName: clerkUser.firstName ?? clerkUser.first_name,
    lastName: clerkUser.lastName ?? clerkUser.last_name,
    imageUrl: clerkUser.imageUrl ?? clerkUser.image_url,
  };
}

function toEmailAddresses(user: {
  email_addresses?: Array<{
    id: string;
    email_address?: string;
    emailAddress?: string;
  }>;
}): ClerkUserLike["emailAddresses"] {
  return user.email_addresses?.map((email) => ({
    id: email.id,
    emailAddress: email.emailAddress ?? email.email_address ?? "",
  }));
}

function getEventId(event: ClerkWebhookEvent): string | undefined {
  const eventWithId = event as ClerkWebhookEvent & { id?: unknown };

  return typeof eventWithId.id === "string" ? eventWithId.id : undefined;
}
