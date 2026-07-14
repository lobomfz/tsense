import type { FilterDescriptor } from "./index.js";
export declare function serializeFilter(filter: Record<string, unknown>, descriptor: FilterDescriptor): URLSearchParams;
export declare function deserializeFilter(params: URLSearchParams, descriptor: FilterDescriptor): Record<string, unknown>;
