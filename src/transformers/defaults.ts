import { DateTransformer } from "./date.js";
import type { FieldTransformer } from "./types.js";

export const defaultTransformers = [DateTransformer] as FieldTransformer[];
