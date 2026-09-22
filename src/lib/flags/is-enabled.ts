import { z } from "zod";
import fileFlags from "../../../flags.config";

const flagsSchema = z.record(z.string(), z.boolean());

export function isEnabled(name: string, envJson?: string): boolean {
  const fromFile = fileFlags[name] ?? false;

  if (envJson === undefined || envJson.trim() === "") {
    return fromFile;
  }

  let parsedEnv: Record<string, boolean> | null = null;
  try {
    const json = JSON.parse(envJson) as unknown;
    const result = flagsSchema.safeParse(json);
    if (result.success) {
      parsedEnv = result.data;
    }
  } catch {
    return fromFile;
  }

  if (parsedEnv && name in parsedEnv) {
    return parsedEnv[name];
  }

  return fromFile;
}
