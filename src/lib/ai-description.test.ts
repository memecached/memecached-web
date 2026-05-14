import { describe, test, expect, vi, beforeEach } from "vitest";

const mockResponsesCreate = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn(() => ({
    responses: {
      create: (...args: unknown[]) => mockResponsesCreate(...args),
    },
  })),
}));

import { suggestMemeDescription } from "./ai-description";

function makeImageFile() {
  return {
    type: "image/png",
    arrayBuffer: async () => new ArrayBuffer(128),
  } as File;
}

describe("suggestMemeDescription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("requests a single sentence description capped at 100 characters", async () => {
    mockResponsesCreate.mockResolvedValue({
      output_text: JSON.stringify({ description: "A cat panics while reading a laptop screen." }),
    });

    const description = await suggestMemeDescription(makeImageFile());

    expect(description).toBe("A cat panics while reading a laptop screen.");
    expect(mockResponsesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        input: [
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({
                type: "input_text",
                text: expect.stringContaining("100 characters or fewer"),
              }),
            ]),
          }),
        ],
        text: {
          format: expect.objectContaining({
            schema: expect.objectContaining({
              properties: {
                description: expect.objectContaining({
                  maxLength: 100,
                }),
              },
            }),
          }),
        },
      }),
    );
  });

  test("rejects descriptions longer than 100 characters", async () => {
    mockResponsesCreate.mockResolvedValue({
      output_text: JSON.stringify({
        description:
          "A very long meme description that rambles past the allowed one hundred character limit for the upload form.",
      }),
    });

    await expect(suggestMemeDescription(makeImageFile())).rejects.toThrow("Invalid AI description response");
  });
});
