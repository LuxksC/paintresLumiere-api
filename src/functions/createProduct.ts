import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { CreateProductController } from '../controllers/CreateProductController';
import { parseProtectedEvent } from '../utils/parseProtectedEvent';
import { parseResponse } from '../utils/parseResponse';
import { unauthorized } from '../utils/http';

export async function handler(event: APIGatewayProxyEventV2) {
  try {
    const request = parseProtectedEvent(event);
    const response = await CreateProductController.handle(request);
    return parseResponse(response);
  } catch {
    return parseResponse(unauthorized({ error: 'Invalid or missing access token.' }));
  }
}
