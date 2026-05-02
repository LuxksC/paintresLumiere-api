import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GoogleAuthController } from '../controllers/GoogleAuthController';
import { parseEvent } from '../utils/parseEvent';
import { parseResponse } from '../utils/parseResponse';

export async function handler(event: APIGatewayProxyEventV2) {
  const request = parseEvent(event);
  const response = await GoogleAuthController.handle(request);
  return parseResponse(response);
}
