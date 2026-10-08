/** Reject cross-origin browser requests before releasing an authenticated token. */
export function isSameOriginRequest(input: {
  origin: string | null;
  secFetchSite: string | null;
  expectedOrigin: string;
}) {
  if (input.origin && input.origin !== input.expectedOrigin) return false;
  if (input.secFetchSite && input.secFetchSite !== "same-origin") return false;
  return true;
}
