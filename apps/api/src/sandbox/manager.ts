import { join } from "path";
import { SandboxManager } from "@forgeai/sandbox-manager";

const workspacesDir =
  process.env.SANDBOXES_DIR || join(process.cwd(), ".sandboxes");

export const sandboxManager = new SandboxManager({
  workspacesDir,
  ttlMinutes: parseInt(process.env.SANDBOX_TTL_MINUTES || "30", 10),
});
