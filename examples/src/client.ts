import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { API } from "./api/router";

const link = new RPCLink({ url: `${window.location.origin}/rpc` });
const client = createORPCClient<RouterClient<API>>(link);

export const orpc = createTanstackQueryUtils(client);
