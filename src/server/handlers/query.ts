export function searchParamsToObject(searchParams: URLSearchParams) {
  return Object.fromEntries(searchParams.entries());
}
