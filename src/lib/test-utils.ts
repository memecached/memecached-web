import { vi } from "vitest";

type MockRoute = Response | Promise<Response> | (() => Response | Promise<Response>);

/**
 * Chainable fetch mock. Call `.on(pattern, response)` to register routes.
 * Pattern is substring-matched against the request URL.
 */
export function mockFetch() {
  const routes = new Map<string, MockRoute>();

  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;
    for (const [pattern, route] of routes) {
      if (url.includes(pattern)) {
        if (typeof route === "function") return Promise.resolve(route());
        if (route instanceof Promise) return route;
        return Promise.resolve(route);
      }
    }
    return Promise.reject(new Error(`Unmocked fetch: ${url}`));
  });

  const builder = {
    on(pattern: string, route: MockRoute) {
      routes.set(pattern, route);
      return builder;
    },
  };
  return builder;
}
