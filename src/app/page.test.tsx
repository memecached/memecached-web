import "@testing-library/jest-dom/vitest";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mockFetch } from "@/lib/test-utils";
import type { Meme } from "@/lib/validations";

const mockReplace = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => currentSearchParams,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/logout-button", () => ({
  LogoutButton: () => <button>Log out</button>,
}));

function makeMeme(overrides: Partial<Meme> & { id: string }): Meme {
  return {
    userId: "u1",
    imageUrl: `https://cdn.example.com/${overrides.id}.png`,
    description: `Meme ${overrides.id}`,
    tags: ["funny"],
    createdAt: new Date().toISOString() as unknown as Date,
    updatedAt: new Date().toISOString() as unknown as Date,
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Gallery />
    </QueryClientProvider>,
  );
}

// Lazy import to allow mocks to register first
let Gallery: typeof import("@/components/gallery").Gallery;

beforeEach(async () => {
  vi.clearAllMocks();
  currentSearchParams = new URLSearchParams();
  const mod = await import("@/components/gallery");
  Gallery = mod.Gallery;
});

afterEach(() => {
  cleanup();
});

describe("Gallery Page", () => {
  test("renders meme cards", async () => {
    mockFetch()
      .on("/api/tags", () => Response.json({ tags: [] }))
      .on("/api/memes", () =>
        Response.json({
          memes: [
            makeMeme({ id: "1", description: "Cat meme" }),
            makeMeme({ id: "2", description: "Dog meme" }),
          ],
          nextCursor: null,
        }),
      );

    renderPage();

    await waitFor(() => {
      expect(screen.getByAltText("Cat meme")).toBeInTheDocument();
      expect(screen.getByAltText("Dog meme")).toBeInTheDocument();
    });
  });

  test("renders tag filter badges", async () => {
    mockFetch()
      .on("/api/tags", () =>
        Response.json({
          tags: [
            { id: "t1", name: "funny" },
            { id: "t2", name: "cats" },
          ],
        }),
      )
      .on("/api/memes", () => Response.json({ memes: [], nextCursor: null }));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("funny")).toBeInTheDocument();
      expect(screen.getByText("cats")).toBeInTheDocument();
    });
  });

  test("shows empty state when no memes", async () => {
    mockFetch()
      .on("/api/tags", () => Response.json({ tags: [] }))
      .on("/api/memes", () => Response.json({ memes: [], nextCursor: null }));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No memes yet. Upload your first meme!")).toBeInTheDocument();
    });
  });

  test("shows filter-specific empty state", async () => {
    currentSearchParams = new URLSearchParams("q=nonexistent");

    mockFetch()
      .on("/api/tags", () => Response.json({ tags: [] }))
      .on("/api/memes", () => Response.json({ memes: [], nextCursor: null }));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No memes match your filters")).toBeInTheDocument();
    });
  });

  test("shows Load more button when nextCursor exists", async () => {
    mockFetch()
      .on("/api/tags", () => Response.json({ tags: [] }))
      .on("/api/memes", () =>
        Response.json({
          memes: [makeMeme({ id: "1" })],
          nextCursor: "2024-01-01T00:00:00.000Z",
        }),
      );

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();
    });
  });

  test("hides Load more button when nextCursor is null", async () => {
    mockFetch()
      .on("/api/tags", () => Response.json({ tags: [] }))
      .on("/api/memes", () =>
        Response.json({
          memes: [makeMeme({ id: "1" })],
          nextCursor: null,
        }),
      );

    renderPage();

    await waitFor(() => {
      expect(screen.getByAltText("Meme 1")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  test("debounced search updates URL", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    mockFetch()
      .on("/api/tags", () => Response.json({ tags: [] }))
      .on("/api/memes", () => Response.json({ memes: [], nextCursor: null }));

    renderPage();

    const input = screen.getByPlaceholderText("Search memes...");
    await user.type(input, "cats");

    // Should not have called replace yet (debounce)
    expect(mockReplace).not.toHaveBeenCalledWith(expect.stringContaining("q=cats"));

    // Advance past debounce
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining("q=cats"));
    });

    vi.useRealTimers();
  });

  test("tag badge click updates URL", async () => {
    mockFetch()
      .on("/api/tags", () =>
        Response.json({ tags: [{ id: "t1", name: "funny" }] }),
      )
      .on("/api/memes", () => Response.json({ memes: [], nextCursor: null }));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("funny")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("funny"));

    expect(mockReplace).toHaveBeenCalledWith(expect.stringContaining("tag=funny"));
  });

  test("search params are passed to API", async () => {
    currentSearchParams = new URLSearchParams("q=hello&tag=funny");

    mockFetch()
      .on("/api/tags", () => Response.json({ tags: [] }))
      .on("/api/memes", () => Response.json({ memes: [], nextCursor: null }));

    renderPage();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/memes"),
      );
    });

    const memesCall = vi.mocked(globalThis.fetch).mock.calls.find(
      (call) => {
        const url = typeof call[0] === "string" ? call[0] : "";
        return url.includes("/api/memes");
      },
    );

    expect(memesCall).toBeDefined();
    const url = memesCall![0] as string;
    expect(url).toContain("q=hello");
    expect(url).toContain("tag=funny");
  });

  test("shows error state", async () => {
    mockFetch()
      .on("/api/tags", () => Response.json({ tags: [] }))
      .on("/api/memes", () => new Response(null, { status: 500 }));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Failed to load memes")).toBeInTheDocument();
    });
  });
});
