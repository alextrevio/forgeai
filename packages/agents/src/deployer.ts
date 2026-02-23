import type { SandboxInterface } from "./orchestrator";

export interface DeployResult {
  success: boolean;
  url: string | null;
  logs: string[];
  buildTime: number;
}

export class DeployerAgent {
  async deploy(
    sandbox: SandboxInterface,
    projectId: string,
    onLog: (log: string) => void,
    signal?: AbortSignal
  ): Promise<DeployResult> {
    const logs: string[] = [];
    const start = Date.now();

    const log = (msg: string) => {
      logs.push(msg);
      onLog(msg);
    };

    try {
      // Step 1: Run production build
      log("Running production build (vite build)...");
      const buildResult = await sandbox.executeCommand("npx vite build");

      if (buildResult.stdout) log(buildResult.stdout);
      if (buildResult.stderr) log(buildResult.stderr);

      if (buildResult.exitCode !== 0) {
        log(`Build failed with exit code ${buildResult.exitCode}`);
        return {
          success: false,
          url: null,
          logs,
          buildTime: Date.now() - start,
        };
      }

      log("Build completed successfully");

      // Step 2: Verify dist directory exists
      const checkDist = await sandbox.executeCommand("ls -la dist/");
      if (checkDist.exitCode !== 0) {
        log("Error: dist/ directory not found after build");
        return {
          success: false,
          url: null,
          logs,
          buildTime: Date.now() - start,
        };
      }
      log(`Build output:\n${checkDist.stdout}`);

      // Step 3: Build succeeded, dist/ verified — URL will be assigned by the API orchestrator
      log("Build artifacts ready for deployment");

      return {
        success: true,
        url: null,
        logs,
        buildTime: Date.now() - start,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`Deploy error: ${msg}`);
      return {
        success: false,
        url: null,
        logs,
        buildTime: Date.now() - start,
      };
    }
  }
}
