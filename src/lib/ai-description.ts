import OpenAI from "openai";
import { z } from "zod";

const DEFAULT_MODEL = "gpt-5-nano";
const MAX_DESCRIPTION_LENGTH = 100;

const suggestionSchema = z.object({
  description: z.string().trim().min(1).max(MAX_DESCRIPTION_LENGTH),
});

let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  openaiClient ??= new OpenAI();
  return openaiClient;
}

export async function suggestMemeDescription(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const imageUrl = `data:${file.type};base64,${base64}`;

  const response = await getOpenAIClient().responses.create({
    model: DEFAULT_MODEL,
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              `Describe this meme image in one concise, searchable sentence of ${MAX_DESCRIPTION_LENGTH} characters or fewer. ` +
              "If image has texts, prioritize concatenating those to the description, " +
              "then if there are still space, describe visible content, and the meme's likely situation or reaction. " +
              "Do not identify private people or guess sensitive traits.",
          },
          {
            type: "input_image",
            image_url: imageUrl,
            detail: "low",
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "meme_description_suggestion",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            description: {
              type: "string",
              minLength: 1,
              maxLength: MAX_DESCRIPTION_LENGTH,
            },
          },
          required: ["description"],
        },
      },
    },
  });

  const parsed = suggestionSchema.safeParse(JSON.parse(response.output_text));
  if (!parsed.success) {
    throw new Error("Invalid AI description response");
  }

  return parsed.data.description;
}
