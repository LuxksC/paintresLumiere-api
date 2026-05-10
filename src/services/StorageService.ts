import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { s3Client } from '../clients/s3Client';

export type PresignedUpload = {
  url: string;
  fields: Record<string, string>;
  key: string;
};

export type PresignedUploadOptions = {
  bucket: string;
  key: string;
  contentType: string;
  maxFileSizeBytes: number;
  expiresIn?: number;
};

export class StorageService {
  static async getPresignedUpload(options: PresignedUploadOptions): Promise<PresignedUpload> {
    const { bucket, key, contentType, maxFileSizeBytes, expiresIn = 300 } = options;

    const { url, fields } = await createPresignedPost(s3Client, {
      Bucket: bucket,
      Key: key,
      Conditions: [
        ['content-length-range', 1, maxFileSizeBytes],
        ['eq', '$Content-Type', contentType],
      ],
      Fields: { 'Content-Type': contentType },
      Expires: expiresIn,
    });

    return { url, fields, key };
  }

  static async putObject(bucket: string, key: string, body: Buffer, contentType: string): Promise<void> {
    await s3Client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  }

  static async deleteObject(bucket: string, key: string): Promise<void> {
    await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  static isS3Url(url: string, bucket: string): boolean {
    try {
      const { hostname } = new URL(url);
      return hostname.startsWith(`${bucket}.s3.`);
    } catch {
      return false;
    }
  }

  static extractS3Key(url: string): string {
    const { pathname } = new URL(url);
    return pathname.slice(1);
  }
}
