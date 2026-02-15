import {
  S3Client,
  PutObjectCommand,
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

const BUCKET = process.env.S3_BUCKET_NAME!;

export async function getPresignedUploadUrl(
  userId: string,
  extension: string,
): Promise<{ uploadUrl: string; key: string }> {
  const key = buildS3Key(userId, randomUUID(), extension);

  const params: PutObjectCommandInput = {
    Bucket: BUCKET,
    Key: key,
  };

  const command = new PutObjectCommand(params);

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: PRESIGNED_URL_EXPIRY_SECONDS,
  });

  return { uploadUrl, key };
}
