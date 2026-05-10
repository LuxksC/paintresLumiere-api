import busboy from 'busboy';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

export type ParsedFile = {
  buffer: Buffer;
  contentType: string;
};

export function parseMultipart(event: APIGatewayProxyEventV2): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const contentType = event.headers['content-type'] ?? '';
    const bb = busboy({ headers: { 'content-type': contentType } });

    let resolved = false;

    bb.on('file', (_fieldname, stream, info) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        resolved = true;
        resolve({ buffer: Buffer.concat(chunks), contentType: info.mimeType });
      });
      stream.on('error', reject);
    });

    bb.on('error', reject);
    bb.on('finish', () => {
      if (!resolved) reject(new Error('No file found in request.'));
    });

    const body = event.isBase64Encoded
      ? Buffer.from(event.body ?? '', 'base64')
      : Buffer.from(event.body ?? '');

    bb.end(body);
  });
}
