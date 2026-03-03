import { StatusController } from '../controllers/StatusController';
import { parseResponse } from '../utils/parseResponse';

export async function handler() {
  const response = await StatusController.handle();
  return parseResponse(response);
}