import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { buildS3Key, PRESIGNED_URL_EXPIRY_SECONDS } from "./constants";

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function getPresignedUploadUrl(
  userId: string,
  extension: string,
): Promise<{ uploadUrl: string; key: string }> {
  const key = buildS3Key(userId, randomUUID(), extension);

  const params: PutObjectCommandInput = {
    Bucket: process.env.S3_BUCKET_NAME!,
    Key: key,
  };

  const command = new PutObjectCommand(params);

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
  });

  return { uploadUrl, key };
}

export async function deleteS3Object(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET_NAME!, Key: key }));
}

export async function deleteS3Objects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: process.env.S3_BUCKET_NAME!,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  );
}
