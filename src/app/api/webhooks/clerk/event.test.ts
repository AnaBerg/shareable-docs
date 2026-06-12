import { describe, expect, it } from "vitest";

import { getClerkWebhookEventId, toClerkUserLike } from "./event";

describe("Clerk webhook event helpers", () => {
  it("maps snake_case Clerk user payloads", () => {
    expect(
      toClerkUserLike({
        id: "user_123",
        primary_email_address_id: "email_1",
        email_addresses: [{ id: "email_1", email_address: "ada@example.com" }],
        first_name: "Ada",
        last_name: "Lovelace",
        image_url: "https://example.com/ada.png",
      }),
    ).toEqual({
      id: "user_123",
      primaryEmailAddressId: "email_1",
      emailAddresses: [{ id: "email_1", emailAddress: "ada@example.com" }],
      firstName: "Ada",
      lastName: "Lovelace",
      imageUrl: "https://example.com/ada.png",
    });
  });

  it("leaves missing webhook email addresses absent", () => {
    expect(
      toClerkUserLike({
        id: "user_123",
        primary_email_address_id: "email_1",
        email_addresses: [{ id: "email_1" }],
      }).emailAddresses,
    ).toEqual([{ id: "email_1", emailAddress: undefined }]);
  });

  it("reads string event ids", () => {
    expect(getClerkWebhookEventId({ id: "evt_1" })).toBe("evt_1");
    expect(getClerkWebhookEventId({ id: 123 })).toBeUndefined();
  });
});
