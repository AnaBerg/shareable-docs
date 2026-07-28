export function searchParamsToObject(
  searchParams: URLSearchParams,
): Record<string, string | string[]> {
  const output: Record<string, string | string[]> = {};

  for (const [key, value] of searchParams.entries()) {
    const existing = output[key];

    if (existing === undefined) {
      output[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      output[key] = [existing, value];
    }
  }

  return output;
}
