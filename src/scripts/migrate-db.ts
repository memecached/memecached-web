import fs from "fs";
import path from "path";
import { imageSize } from "image-size";
import { db } from "@/db";
import { memes, tags, memeTags } from "@/db/schema";
import { inArray } from "drizzle-orm";

// One-off script to migrate memes, tags, and their relations from the old DB CSV exports.
// Run ONCE after the S3 migration (copy-s3-bucket.ts) is complete.
//
// Usage: npx tsx --env-file=.env src/scripts/migrate-db.ts

const USER_ID = "496478f3-784f-4f14-9e1a-2037228199f1";
const CSV_DIR = path.join(process.cwd(), "src/scripts/old-db/facebook-memes-collection");
const RATE_LIMIT_MS = 200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseCSV(filePath: string): Record<string, string>[] {
  const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const parts = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, parts[i]?.trim() ?? ""]));
  });
}

// Image.csv's description field may contain commas, so extract known fields
// from both ends of the split and join everything in between as the description.
function parseImageCSV(filePath: string) {
  const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n");
  return lines.slice(1).map((line) => {
    const parts = line.split(",");
    const id = parts[0];
    const filename = parts[1];
    const url = parts[2];
    const createdAt = parts[parts.length - 2];
    const userId = parts[parts.length - 1];
    const description = parts.slice(3, parts.length - 2).join(",").replace(/^"|"$/g, "");
    return { id, filename, url, description, createdAt, userId };
  });
}

export async function main() {
  const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;
  if (!cloudfrontDomain) throw new Error("CLOUDFRONT_DOMAIN is not set");

  const tagRows = parseCSV(path.join(CSV_DIR, "Tag.csv"));
  const imageRows = parseImageCSV(path.join(CSV_DIR, "Image.csv"));
  const imageToTagRows = parseCSV(path.join(CSV_DIR, "_ImageToTag.csv"));

  // Fetch image dimensions before opening the transaction — HTTP requests
  // should not be made while a DB transaction is held open.
  console.log("Fetching image dimensions...");
  const dimensionMap = new Map<string, { width?: number; height?: number }>();
  for (let i = 0; i < imageRows.length; i++) {
    const r = imageRows[i];
    const imageUrl = `https://${cloudfrontDomain}/${USER_ID}/${r.filename}`;
    try {
      const res = await fetch(imageUrl, { headers: { Range: "bytes=0-4095" } });
      const buffer = Buffer.from(await res.arrayBuffer());
      const { width, height } = imageSize(buffer);
      dimensionMap.set(r.filename, { width, height });
      console.log(`  ✓ ${r.filename} (${width}x${height})`);
    } catch {
      dimensionMap.set(r.filename, {});
      console.log(`  ✗ ${r.filename} (failed)`);
    }
    if (i < imageRows.length - 1) await sleep(RATE_LIMIT_MS);
  }
  console.log(`  ✓ ${dimensionMap.size} images processed`);

  // Wrap all steps in a transaction so any failure rolls back all previous steps
  await db.transaction(async (tx) => {
    // 1. Migrate tags
    console.log("Migrating tags...");
    const tagNames = tagRows.map((r) => r.name.toLowerCase());

    await tx
      .insert(tags)
      .values(tagNames.map((name) => ({ name })))
      .onConflictDoNothing({ target: tags.name });

    const insertedTags = await tx
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(inArray(tags.name, tagNames));

    // Map old tag ID → new tag ID via tag name as the shared key
    const tagNameToNewId = new Map(insertedTags.map((t) => [t.name, t.id]));
    const oldTagIdToNewId = new Map(
      tagRows.map((r) => [r.id, tagNameToNewId.get(r.name.toLowerCase())!]),
    );
    console.log(`  ✓ ${insertedTags.length} tags`);

    // 2. Migrate memes
    console.log("Migrating memes...");
    const memeValues = imageRows.map((r) => ({
      userId: USER_ID,
      // The S3 key was copied as USER_ID/filename during the S3 migration
      imageUrl: `https://${cloudfrontDomain}/${USER_ID}/${r.filename}`,
      imageWidth: dimensionMap.get(r.filename)?.width,
      imageHeight: dimensionMap.get(r.filename)?.height,
      description: r.description,
      createdAt: new Date(r.createdAt),
    }));

    const insertedMemes = await tx.insert(memes).values(memeValues).returning({
      id: memes.id,
      imageUrl: memes.imageUrl,
    });

    // Map old image ID → new meme ID via filename as the shared key
    const filenameToNewMemeId = new Map(
      insertedMemes.map((m) => [m.imageUrl.split("/").pop()!, m.id]),
    );
    const oldImageIdToNewMemeId = new Map(
      imageRows.map((r) => [r.id, filenameToNewMemeId.get(r.filename)!]),
    );
    console.log(`  ✓ ${insertedMemes.length} memes`);

    // 3. Migrate meme-tag relations
    console.log("Migrating meme-tag relations...");
    const memeTagValues = imageToTagRows
      .map((r) => ({
        memeId: oldImageIdToNewMemeId.get(r.A),
        tagId: oldTagIdToNewId.get(r.B),
      }))
      .filter((r): r is { memeId: string; tagId: string } => !!r.memeId && !!r.tagId);

    if (memeTagValues.length > 0) {
      await tx.insert(memeTags).values(memeTagValues).onConflictDoNothing();
    }
    console.log(`  ✓ ${memeTagValues.length} meme-tag relations`);
  });

  console.log("\nMigration complete.");
}

if (process.env.NODE_ENV !== "test") {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
