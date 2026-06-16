import { validationError } from "@/server/foundation/errors";

export async function parseJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw validationError("Malformed JSON");
  }
}
