/**
 * Thrown by apiFetch when the API returns a { redirect } response.
 * Callers that catch errors should check for this and bail out silently.
 */
export class ApiRedirectError extends Error {
  constructor(public readonly destination: string) {
    super("redirect:" + destination);
    this.name = "ApiRedirectError";
  }
}

/**
 * Drop-in replacement for fetch() in client components.
 *
 * If the API returns { redirect: string } the browser navigates to that URL
 * and throws ApiRedirectError so the caller's subsequent logic does not run.
 */
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(url, options);

  // 204 No Content has no body — nothing to inspect.
  if (res.status === 204) return res;

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const cloned = res.clone();
    const data = await cloned.json().catch(() => null);
    if (data && typeof data.redirect === "string") {
      window.location.replace(data.redirect);
      throw new ApiRedirectError(data.redirect);
    }
  }

  return res;
}
