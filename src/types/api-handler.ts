import type { ApiContext } from "@/server/foundation/context";

export type ApiHandler<TParams = unknown> = (input: {
  request: Request;
  ctx: ApiContext;
  params: TParams;
}) => Promise<Response>;
