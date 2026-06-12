import type { ClerkUserLike } from "@/server/clerk/user-sync";

type ClerkUserPayload = ClerkUserLike & {
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

export function toClerkUserLike(data: ClerkUserPayload): ClerkUserLike {
  return {
    id: data.id,
    primaryEmailAddressId:
      data.primaryEmailAddressId ?? data.primary_email_address_id,
    emailAddresses: data.emailAddresses ?? toEmailAddresses(data),
    firstName: data.firstName ?? data.first_name,
    lastName: data.lastName ?? data.last_name,
    imageUrl: data.imageUrl ?? data.image_url,
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

export function getClerkWebhookEventId(event: unknown): string | undefined {
  const eventWithId = event as { id?: unknown };

  return typeof eventWithId.id === "string" ? eventWithId.id : undefined;
}
