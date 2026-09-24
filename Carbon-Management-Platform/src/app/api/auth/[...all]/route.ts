import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

const handlers = toNextJsHandler(auth);

function isAdminEndpoint(request: Request) {
  return new URL(request.url).pathname.startsWith("/api/auth/admin/");
}

export function GET(request: Request) {
  if (isAdminEndpoint(request))
    return Response.json({ error: "Not found" }, { status: 404 });
  return handlers.GET(request);
}

export function POST(request: Request) {
  // Administrative mutations are exposed only by this application's guarded APIs.
  if (isAdminEndpoint(request)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return handlers.POST(request);
}
