import "@testing-library/jest-dom/vitest";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadForm } from "./upload-form";
import { mockFetch } from "@/lib/test-utils";

// jsdom doesn't implement URL.createObjectURL
if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = vi.fn(() => "blob:http://localhost:3000/fake");
}
if (typeof URL.revokeObjectURL === "undefined") {
  URL.revokeObjectURL = vi.fn();
}

afterEach(() => {
  // Unmounts React trees that were mounted with render.
  cleanup();
});

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

function createFile(name: string, sizeBytes: number, type: string): File {
  const buffer = new ArrayBuffer(sizeBytes);
  return new File([buffer], name, { type });
}

/** Sets up the happy-path routes every test needs */
function mockFetchDefaults() {
  return mockFetch()
    .on("/api/tags", () =>
      Response.json({
        tags: [
          { id: "1", name: "funny" },
          { id: "2", name: "cats" },
          { id: "3", name: "programming" },
        ],
      }),
    )
    .on("/api/upload-url", () =>
      Response.json({
        uploadUrl: "https://s3.amazonaws.com/signed",
        key: "user/abc.png",
        imageUrl: "https://cdn.example.com/user/abc.png",
      }),
    )
    .on("s3.amazonaws.com", () => new Response(null, { status: 200 }))
    .on("/api/memes", () => Response.json({ meme: { id: "1", imageUrl: "https://cdn.example.com/user/abc.png" } }));
}

/** Helper: select a file and wait for the preview form to appear */
async function selectFileAndWaitForForm(user: ReturnType<typeof userEvent.setup>) {
  const input = document.querySelector("input[type='file']") as HTMLInputElement;
  const file = createFile("meme.png", 1024, "image/png");
  await user.upload(input, file);

  await waitFor(() => {
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
  });

  return file;
}

/** Helper: fill in description and tags fields */
async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  description = "A funny meme",
  tags = ["funny", "cats"],
) {
  await user.type(screen.getByLabelText(/description/i), description);
  const tagInput = screen.getByLabelText(/tags/i);
  for (const tag of tags) {
    await user.type(tagInput, tag);
    await user.keyboard("{Enter}");
  }
}

describe("UploadForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  test("renders dropzone in idle state", () => {
    mockFetchDefaults();
    render(<UploadForm />);

    expect(screen.getByText(/drag & drop an image/i)).toBeInTheDocument();
    expect(screen.getByText(/max 2 MB/i)).toBeInTheDocument();
  });

  test("shows preview, form fields, and upload button after selecting a valid file", async () => {
    const user = userEvent.setup();
    mockFetchDefaults();
    render(<UploadForm />);

    await selectFileAndWaitForForm(user);

    expect(screen.getByAltText("Upload preview")).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tags/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  test("hides dropzone when previewing", async () => {
    const user = userEvent.setup();
    mockFetchDefaults();
    render(<UploadForm />);

    await selectFileAndWaitForForm(user);

    expect(screen.queryByText(/drag & drop an image/i)).not.toBeInTheDocument();
  });

  test("resets to idle state when cancel is clicked", async () => {
    const user = userEvent.setup();
    mockFetchDefaults();
    render(<UploadForm />);

    await selectFileAndWaitForForm(user);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.getByText(/drag & drop an image/i)).toBeInTheDocument();
      expect(screen.queryByAltText("Upload preview")).not.toBeInTheDocument();
    });
  });

  test("upload button is disabled when form is empty", async () => {
    const user = userEvent.setup();
    mockFetchDefaults();
    render(<UploadForm />);

    await selectFileAndWaitForForm(user);

    expect(screen.getByRole("button", { name: /upload/i })).toBeDisabled();
  });

  test("upload button is disabled when only description is filled", async () => {
    const user = userEvent.setup();
    mockFetchDefaults();
    render(<UploadForm />);

    await selectFileAndWaitForForm(user);
    await user.type(screen.getByLabelText(/description/i), "A funny meme");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload/i })).toBeDisabled();
    });
  });

  test("upload button is disabled when only tags are filled", async () => {
    const user = userEvent.setup();
    mockFetchDefaults();
    render(<UploadForm />);

    await selectFileAndWaitForForm(user);
    const tagInput = screen.getByLabelText(/tags/i);
    await user.type(tagInput, "funny");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload/i })).toBeDisabled();
    });
  });

  test("upload button is enabled when both description and tags are filled", async () => {
    const user = userEvent.setup();
    mockFetchDefaults();
    render(<UploadForm />);

    await selectFileAndWaitForForm(user);
    await fillForm(user);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload/i })).toBeEnabled();
    });
  });

  test("form inputs are visible but disabled while uploading", async () => {
    const user = userEvent.setup();
    let resolveS3: (value: Response) => void;
    const s3Promise = new Promise<Response>((r) => {
      resolveS3 = r;
    });

    mockFetchDefaults().on("s3.amazonaws.com", s3Promise);

    render(<UploadForm />);

    await selectFileAndWaitForForm(user);
    await fillForm(user);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload/i })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: /upload/i }));

    // While uploading, form should be visible but all inputs disabled
    await waitFor(() => {
      expect(screen.getByLabelText(/description/i)).toBeDisabled();
      expect(screen.getByLabelText(/tags/i)).toBeDisabled();
      expect(screen.getByRole("button", { name: /upload/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    });

    // Resolve to let the test complete cleanly
    resolveS3!(new Response(null, { status: 200 }));

    await waitFor(() => {
      expect(screen.getByText(/uploaded successfully/i)).toBeInTheDocument();
    });
  });

  test("uploads file to S3 and creates meme via POST /api/memes", async () => {
    const user = userEvent.setup();

    mockFetchDefaults();

    render(<UploadForm />);

    await selectFileAndWaitForForm(user);
    await fillForm(user, "A funny cat meme", ["funny", "cats"]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload/i })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText(/uploaded successfully/i)).toBeInTheDocument();
      expect(screen.queryByAltText("Upload preview")).not.toBeInTheDocument();
    });

    const fetchSpy = vi.mocked(globalThis.fetch);
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("/api/upload-url?filename=meme.png"));
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://s3.amazonaws.com/signed",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/memes",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: "https://cdn.example.com/user/abc.png",
          description: "A funny cat meme",
          tags: ["funny", "cats"],
        }),
      }),
    );
  });

  test("shows error when API returns failure", async () => {
    const user = userEvent.setup();
    mockFetchDefaults().on("/api/upload-url", Response.json({ error: "Unauthorized" }, { status: 401 }));

    render(<UploadForm />);

    await selectFileAndWaitForForm(user);
    await fillForm(user);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload/i })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText("Unauthorized")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });

  test("shows error when S3 upload fails", async () => {
    const user = userEvent.setup();

    mockFetchDefaults().on("s3.amazonaws.com", new Response(null, { status: 403 }));

    render(<UploadForm />);

    await selectFileAndWaitForForm(user);
    await fillForm(user);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload/i })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText("Upload to S3 failed")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });

  test("shows error when POST /api/memes fails", async () => {
    const user = userEvent.setup();

    mockFetchDefaults().on("/api/memes", Response.json({ error: "Validation failed" }, { status: 422 }));

    render(<UploadForm />);

    await selectFileAndWaitForForm(user);
    await fillForm(user);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload/i })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText("Validation failed")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });

  test("retry button resets to dropzone after error", async () => {
    const user = userEvent.setup();
    mockFetchDefaults().on("/api/upload-url", Response.json({ error: "Unauthorized" }, { status: 401 }));

    render(<UploadForm />);

    await selectFileAndWaitForForm(user);
    await fillForm(user);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload/i })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(screen.getByText(/drag & drop an image/i)).toBeInTheDocument();
      expect(screen.queryByText("Unauthorized")).not.toBeInTheDocument();
    });
  });

  test("shows error when network request fails", async () => {
    const user = userEvent.setup();
    mockFetchDefaults().on("/api/upload-url", () => Promise.reject(new Error("Network error")));

    render(<UploadForm />);

    await selectFileAndWaitForForm(user);
    await fillForm(user);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload/i })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  test("auto-resets to dropzone after success", async () => {
    const user = userEvent.setup();

    mockFetchDefaults();

    // Mock SUCCESS_DISPLAY_MS to 0 so the timer fires immediately
    const constants = await import("@/lib/constants");
    vi.spyOn(constants, "SUCCESS_DISPLAY_MS", "get").mockReturnValue(0);

    render(<UploadForm />);

    await selectFileAndWaitForForm(user);
    await fillForm(user);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload/i })).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText(/drag & drop an image/i)).toBeInTheDocument();
    });
  });

  // --- Tag autocomplete tests ---

  test("shows autocomplete suggestions when typing", async () => {
    const user = userEvent.setup();
    mockFetchDefaults();
    render(<UploadForm />);

    await selectFileAndWaitForForm(user);

    // Wait for tags to be fetched
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/tags");
    });

    const tagInput = screen.getByLabelText(/tags/i);
    await user.type(tagInput, "fun");

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "funny" })).toBeInTheDocument();
    });

    // "cats" and "programming" should not appear
    expect(screen.queryByRole("option", { name: "cats" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "programming" })).not.toBeInTheDocument();
  });

  test("adds tag on Enter, displays as badge, clears input", async () => {
    const user = userEvent.setup();
    mockFetchDefaults();
    render(<UploadForm />);

    await selectFileAndWaitForForm(user);

    const tagInput = screen.getByLabelText(/tags/i);
    await user.type(tagInput, "funny");
    await user.keyboard("{Enter}");

    // Badge should appear with the tag text
    await waitFor(() => {
      expect(screen.getByText("funny")).toBeInTheDocument();
    });

    // Input should be cleared
    expect(tagInput).toHaveValue("");
  });

  test("removes tag when badge X is clicked", async () => {
    const user = userEvent.setup();
    mockFetchDefaults();
    render(<UploadForm />);

    await selectFileAndWaitForForm(user);

    const tagInput = screen.getByLabelText(/tags/i);
    await user.type(tagInput, "funny");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("funny")).toBeInTheDocument();
    });

    // Click the remove button on the badge
    await user.click(screen.getByRole("button", { name: /remove funny/i }));

    await waitFor(() => {
      expect(screen.queryByText("funny")).not.toBeInTheDocument();
    });
  });

  test("excludes already-selected tags from suggestions", async () => {
    const user = userEvent.setup();
    mockFetchDefaults();
    render(<UploadForm />);

    await selectFileAndWaitForForm(user);

    // Wait for tags to be fetched
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/tags");
    });

    const tagInput = screen.getByLabelText(/tags/i);

    // Add "funny"
    await user.type(tagInput, "funny");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("funny")).toBeInTheDocument();
    });

    // Type "fun" again — "funny" should not appear in suggestions
    await user.type(tagInput, "fun");

    await waitFor(() => {
      // The listbox should not appear since "funny" is the only match and it's already selected
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  test("allows creating a new tag not in suggestions", async () => {
    const user = userEvent.setup();
    mockFetchDefaults();
    render(<UploadForm />);

    await selectFileAndWaitForForm(user);

    const tagInput = screen.getByLabelText(/tags/i);
    await user.type(tagInput, "brandnewtag");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("brandnewtag")).toBeInTheDocument();
    });

    expect(tagInput).toHaveValue("");
  });
});
