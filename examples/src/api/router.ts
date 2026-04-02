import { os, ORPCError } from "@orpc/server";
import { builder, collection } from "./collection";

interface Context {
  user?: { id: string };
}

const base = os.$context<Context>();

const authed = base.use(({ context, next }) => {
  if (!context.user) {
    throw new ORPCError("UNAUTHORIZED");
  }

  return next({ context: { user: context.user } });
});

export const router = base.router({
  search: authed
    .input(builder.schema())
    .handler(({ input, context }) =>
      collection.scoped({ owner_id: context.user.id }).search(input),
    ),
});

export type API = typeof router;
