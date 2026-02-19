import "@testing-library/jest-dom/vitest";
import { describe, test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemeCard } from "./meme-card";
import type { Meme } from "@/lib/validations";

afterEach(() => {
  cleanup();
});

function makeMeme(overrides: Partial<Meme> = {}): Meme {
  return {
    id: "1",
    userId: "u1",
    imageUrl: "https://cdn.example.com/meme.png",
    description: "A funny cat meme",
    tags: ["funny", "cats"],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("MemeCard", () => {
  test("renders image with description as alt text", () => {
    render(<MemeCard meme={makeMeme()} />);

    const img = screen.getByAltText("A funny cat meme");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://cdn.example.com/meme.png");
  });

  test("renders description text", () => {
    render(<MemeCard meme={makeMeme({ description: "Test description" })} />);

    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  test("renders all tags as badges", () => {
    render(<MemeCard meme={makeMeme({ tags: ["funny", "cats", "programming"] })} />);

    expect(screen.getByText("funny")).toBeInTheDocument();
    expect(screen.getByText("cats")).toBeInTheDocument();
    expect(screen.getByText("programming")).toBeInTheDocument();
  });

  test("hides footer when no tags", () => {
    render(<MemeCard meme={makeMeme({ tags: [] })} />);

    expect(screen.queryByText("funny")).not.toBeInTheDocument();
    // CardFooter uses data-slot="card-footer"
    expect(document.querySelector('[data-slot="card-footer"]')).not.toBeInTheDocument();
  });
});
