import type { SQSEvent } from 'aws-lambda';
import { ProcessProfileImage } from '../queues/ProcessProfileImage';

export async function handler(event: SQSEvent) {
  for (const record of event.Records) {
    let body: any;
    try {
      body = JSON.parse(record.body);
    } catch {
      console.error('Failed to parse SQS message body:', record.body);
      continue;
    }

    // S3 sends a test event when the notification is first configured
    if (body.Event === 's3:TestEvent') continue;

    const s3Records = body.Records ?? [];
    for (const s3Record of s3Records) {
      const key = decodeURIComponent(s3Record.s3.object.key.replace(/\+/g, ' '));
      const bucket = s3Record.s3.bucket.name;
      await ProcessProfileImage.process(bucket, key);
    }
  }
}
