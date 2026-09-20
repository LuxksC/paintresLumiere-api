import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { UploadProductImageController } from '../controllers/UploadProductImageController';
import { validateAccessToken } from '../libs/jwt';
import { badRequest, unauthorized } from '../utils/http';
import { parseMultipart } from '../utils/parseMultipart';
import { parseResponse } from '../utils/parseResponse';

export async function handler(event: APIGatewayProxyEventV2) {
  const authorization = event.headers.authorization ?? '';
  const [, token] = authorization.split(' ');
  const userId = validateAccessToken(token ?? '');

  if (!userId) {
    return parseResponse(unauthorized({ error: 'Invalid or missing access token.' }));
  }

  let file: Buffer;
  let contentType: string;

  try {
    const parsed = await parseMultipart(event);
    file = parsed.buffer;
    contentType = parsed.contentType;
  } catch {
    return parseResponse(badRequest({ error: 'Invalid or missing file in request.' }));
  }

  const response = await UploadProductImageController.handle({
    userId,
    params: event.pathParameters ?? {},
    file,
    contentType,
  });

  return parseResponse(response);
}
