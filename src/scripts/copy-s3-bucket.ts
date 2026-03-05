import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectsCommand,
  type ListObjectsV2CommandOutput,
} from "@aws-sdk/client-s3";

// Copies all objects from facebook-memes-collection to memecached-us-west-2,
// nested under a user folder. On any failure, rolls back by deleting all
// objects already copied to the destination.
//
// Usage: npx tsx --env-file=.env src/scripts/copy-s3-bucket.ts
// Requires: s3:ListBucket + s3:GetObject on source, s3:PutObject + s3:DeleteObject on destination.

const SOURCE_BUCKET = "facebook-memes-collection";
const DEST_BUCKET = "memecached-us-west-2";
const DEST_PREFIX = "496478f3-784f-4f14-9e1a-2037228199f1";

const BATCH_SIZE = 500;
const RATE_LIMIT_MS = 200;

const sourceS3 = new S3Client({ region: "us-east-2" });
// requestStreamBufferSize: S3 chunked transfer encoding requires each chunk (except the last)
// to be at least 8192 bytes. Without buffering (default 0), the SDK forwards stream chunks
// as-is, which may be too small. Setting this to 65_536 (64KB) tells the SDK to accumulate
// chunks internally before flushing to S3, ensuring chunk sizes meet the requirement.
const destS3 = new S3Client({ region: "us-west-2", requestStreamBufferSize: 65_536 });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function rollback(copiedKeys: string[]) {
  if (copiedKeys.length === 0) return;
  console.error(`\nRolling back ${copiedKeys.length} copied object(s)...`);

  for (let i = 0; i < copiedKeys.length; i += BATCH_SIZE) {
    const batch = copiedKeys.slice(i, i + BATCH_SIZE);
    await destS3.send(
      new DeleteObjectsCommand({
        Bucket: DEST_BUCKET,
        Delete: { Objects: batch.map((Key) => ({ Key })) },
      }),
    );
    if (i + BATCH_SIZE < copiedKeys.length) await sleep(RATE_LIMIT_MS);
  }

  console.error("Rollback complete.");
}

async function main() {
  let continuationToken: string | undefined;
  let totalCopied = 0;
  const copiedKeys: string[] = [];

  console.log(`Copying s3://${SOURCE_BUCKET} → s3://${DEST_BUCKET}/${DEST_PREFIX}/\n`);

  try {
    do {
      const response: ListObjectsV2CommandOutput = await sourceS3.send(
        new ListObjectsV2Command({
          Bucket: SOURCE_BUCKET,
          ContinuationToken: continuationToken,
        }),
      );

      const objects = response.Contents ?? [];

      for (const obj of objects) {
        const sourceKey = obj.Key!;
        const destKey = `${DEST_PREFIX}/${sourceKey}`;

        const { Body, ContentType, ContentLength } = await sourceS3.send(
          new GetObjectCommand({ Bucket: SOURCE_BUCKET, Key: sourceKey }),
        );

        await destS3.send(
          new PutObjectCommand({
            Bucket: DEST_BUCKET,
            Key: destKey,
            Body: Body,
            ContentType,
            // ContentLength is required when Body is a stream — unlike a Buffer where the SDK
            // can infer the size, a stream has no known length upfront.
            ContentLength,
          }),
        );

        copiedKeys.push(destKey);
        console.log(`  ✓ ${sourceKey} → ${destKey}`);
        totalCopied++;
        await sleep(RATE_LIMIT_MS);
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    console.log(`\nDone. Copied: ${totalCopied}`);
  } catch (err) {
    console.error(`\nFailed: ${(err as Error).message}`);
    await rollback(copiedKeys);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
