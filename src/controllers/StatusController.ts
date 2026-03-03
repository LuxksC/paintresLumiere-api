import { HttpResponse } from "../types/Http";
import { ok } from '../utils/http';

// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class StatusController {
  static async handle(): Promise<HttpResponse> {
    return ok({ status: 'Server Online!' });
  }
}