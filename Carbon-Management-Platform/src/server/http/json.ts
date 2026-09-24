import { RequestError } from "./response";

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new RequestError("请求内容不是有效 JSON", 400);
  }
}
