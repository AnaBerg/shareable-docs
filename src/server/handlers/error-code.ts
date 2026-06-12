export async function readErrorCode(response: Response): Promise<string | undefined> {
  try {
    const clone = response.clone();
    const body = (await clone.json()) as { error?: { code?: string } };
    return body.error?.code;
  } catch {
    return undefined;
  }
}
