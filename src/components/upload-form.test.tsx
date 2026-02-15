import "@testing-library/jest-dom/vitest";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UploadForm } from "./upload-form";

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

describe("UploadForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  test("renders dropzone in idle state", () => {
    render(<UploadForm />);

    expect(screen.getByText(/drag & drop an image/i)).toBeInTheDocument();
    expect(screen.getByText(/max 2 MB/i)).toBeInTheDocument();
  });

  test("shows preview and upload button after selecting a valid file", async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = createFile("meme.png", 1024, "image/png");

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByAltText("Upload preview")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });
  });

  test("hides dropzone when previewing", async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = createFile("meme.png", 1024, "image/png");

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.queryByText(/drag & drop an image/i)).not.toBeInTheDocument();
    });
  });

  test("resets to idle state when cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = createFile("meme.png", 1024, "image/png");

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.getByText(/drag & drop an image/i)).toBeInTheDocument();
      expect(screen.queryByAltText("Upload preview")).not.toBeInTheDocument();
    });
  });

  test("uploads file to S3 on upload button click", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    fetchSpy
      .mockResolvedValueOnce(
        Response.json({
          uploadUrl: "https://s3.amazonaws.com/signed",
          key: "user/abc.png",
          imageUrl: "https://cdn.example.com/user/abc.png",
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    render(<UploadForm />);

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = createFile("meme.png", 1024, "image/png");

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText(/uploaded successfully/i)).toBeInTheDocument();
      expect(screen.queryByAltText("Upload preview")).not.toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining("/api/upload-url?filename=meme.png"));
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://s3.amazonaws.com/signed",
      expect.objectContaining({ method: "PUT" }),
    );
  });

  test("shows error when API returns failure", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ error: "Unauthorized" }, { status: 401 }));

    render(<UploadForm />);

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = createFile("meme.png", 1024, "image/png");

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText("Unauthorized")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });

  test("shows error when S3 upload fails", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    fetchSpy
      .mockResolvedValueOnce(
        Response.json({
          uploadUrl: "https://s3.amazonaws.com/signed",
          key: "user/abc.png",
          imageUrl: "https://cdn.example.com/user/abc.png",
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 403 }));

    render(<UploadForm />);

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = createFile("meme.png", 1024, "image/png");

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText("Upload to S3 failed")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
  });

  test("retry button resets to dropzone after error", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );

    render(<UploadForm />);

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = createFile("meme.png", 1024, "image/png");

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
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
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

    render(<UploadForm />);

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = createFile("meme.png", 1024, "image/png");

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  test("auto-resets to dropzone after success", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          uploadUrl: "https://s3.amazonaws.com/signed",
          key: "user/abc.png",
          imageUrl: "https://cdn.example.com/user/abc.png",
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    // Mock SUCCESS_DISPLAY_MS to 0 so the timer fires immediately
    const constants = await import("@/lib/constants");
    vi.spyOn(constants, "SUCCESS_DISPLAY_MS", "get").mockReturnValue(0);

    render(<UploadForm />);

    const input = document.querySelector("input[type='file']") as HTMLInputElement;
    const file = createFile("meme.png", 1024, "image/png");

    await user.upload(input, file);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText(/drag & drop an image/i)).toBeInTheDocument();
    });
  });
});
