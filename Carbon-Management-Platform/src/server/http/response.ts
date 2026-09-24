import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";
import { AccessError } from "@/server/auth/access";

export class RequestError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 403 | 404 | 409,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown): Response {
  if (error instanceof AccessError || error instanceof RequestError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return Response.json({ error: "输入内容不符合要求" }, { status: 400 });
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return Response.json({ error: "编码、版本或账号已存在" }, { status: 409 });
  }

  console.error("Request failed", error);
  return Response.json({ error: "服务暂时不可用" }, { status: 500 });
}
