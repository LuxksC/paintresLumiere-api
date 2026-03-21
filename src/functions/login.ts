import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { LoginController } from '../controllers/LoginController';
import { parseEvent } from '../utils/parseEvent';
import { parseResponse } from '../utils/parseResponse';

export async function handler(event: APIGatewayProxyEventV2) {
  const request = parseEvent(event);
  const response = await LoginController.handle(request);
  return parseResponse(response);
}
