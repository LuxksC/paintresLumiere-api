import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { GetPopularProductsController } from '../controllers/GetPopularProductsController';
import { parseEvent } from '../utils/parseEvent';
import { parseResponse } from '../utils/parseResponse';

export async function handler(event: APIGatewayProxyEventV2) {
  const request = parseEvent(event);
  const response = await GetPopularProductsController.handle(request);
  return parseResponse(response);
}
