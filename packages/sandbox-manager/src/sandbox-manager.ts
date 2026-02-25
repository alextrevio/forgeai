import { spawn, exec, ChildProcess } from "child_process";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  rmSync,
} from "fs";
import { join, relative, dirname } from "path";
import { SandboxConfig, SandboxInfo, CommandResult, FileNode } from "./types";

// Port pool with recycling
const PORT_MIN = 5200;
const PORT_MAX = 6200;
let nextPort = PORT_MIN;
const freePorts: number[] = [];

export class SandboxManager {
  private config: SandboxConfig;
  private sandboxes: Map<string, SandboxInfo> = new Map();
  private ttlTimers: Map<string, NodeJS.Timeout> = new Map();
  private devProcesses: Map<string, ChildProcess> = new Map();
  private devOutputCallbacks: Map<string, (output: string) => void> = new Map();

  constructor(config: SandboxConfig) {
    this.config = config;
    if (!existsSync(config.workspacesDir)) {
      mkdirSync(config.workspacesDir, { recursive: true });
    }
  }

  async createSandbox(
    projectId: string,
    _framework: string
  ): Promise<SandboxInfo> {
    const workspaceDir = join(this.config.workspacesDir, projectId);
    const previewPort = freePorts.length > 0 ? freePorts.pop()! : nextPort < PORT_MAX ? nextPort++ : (() => { nextPort = PORT_MIN; return nextPort++; })();

    if (!existsSync(workspaceDir)) {
      mkdirSync(workspaceDir, { recursive: true });
    }

    const info: SandboxInfo = {
      containerId: projectId,
      projectId,
      status: "creating",
      previewPort,
      workspaceDir,
      devServerPid: null,
      createdAt: new Date(),
    };
    this.sandboxes.set(projectId, info);

    // Write template files
    this.writeTemplate(workspaceDir);

    // Install dependencies
    console.log(`[sandbox:${projectId}] running npm install...`);
    const installResult = await this.executeCommand(projectId, "npm install");
    if (installResult.exitCode !== 0) {
      console.error(
        `[sandbox:${projectId}] npm install failed: ${installResult.stderr.slice(0, 500)}`
      );
    } else {
      console.log(`[sandbox:${projectId}] npm install done`);
    }

    // Start the Vite dev server
    this.startDevServer(projectId, workspaceDir, previewPort);

    info.status = "running";
    this.sandboxes.set(projectId, info);
    this.resetTTL(projectId);

    return info;
  }

  // ─── Dev server ──────────────────────────────────────────

  private startDevServer(
    projectId: string,
    workspaceDir: string,
    port: number
  ): void {
    const child = spawn(
      "npx",
      ["vite", "--host", "0.0.0.0", "--port", String(port)],
      {
        cwd: workspaceDir,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, BROWSER: "none" },
        shell: true,
      }
    );

    child.stdout?.on("data", (data: Buffer) => {
      const text = data.toString().trim();
      console.log(`[vite:${projectId}] ${text}`);
      const cb = this.devOutputCallbacks.get(projectId);
      if (cb) cb(text);
    });
    child.stderr?.on("data", (data: Buffer) => {
      const text = data.toString().trim();
      console.error(`[vite:${projectId}:err] ${text}`);
      const cb = this.devOutputCallbacks.get(projectId);
      if (cb) cb(text);
    });
    child.on("exit", (code) => {
      console.log(`[vite:${projectId}] process exited with code ${code}`);
      this.devProcesses.delete(projectId);
    });

    this.devProcesses.set(projectId, child);

    const s = this.sandboxes.get(projectId);
    if (s) {
      s.devServerPid = child.pid ?? null;
    }
  }

  // ─── Execute command ─────────────────────────────────────

  async executeCommand(
    sandboxId: string,
    command: string,
    cwd?: string
  ): Promise<CommandResult> {
    const info = this.sandboxes.get(sandboxId);
    const workDir = cwd || info?.workspaceDir;
    if (!workDir) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Sandbox ${sandboxId} not found`,
      };
    }

    return new Promise<CommandResult>((resolve) => {
      exec(
        command,
        {
          cwd: workDir,
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
          env: { ...process.env, NODE_ENV: "development" },
        },
        (error, stdout, stderr) => {
          resolve({
            exitCode: error ? (error as any).code ?? 1 : 0,
            stdout: typeof stdout === "string" ? stdout.trim() : "",
            stderr: typeof stderr === "string" ? stderr.trim() : "",
          });
        }
      );
    });
  }

  // ─── File operations ─────────────────────────────────────

  async writeFile(
    sandboxId: string,
    filePath: string,
    content: string
  ): Promise<void> {
    const info = this.sandboxes.get(sandboxId);
    if (!info) throw new Error(`Sandbox ${sandboxId} not found`);

    const fullPath = join(info.workspaceDir, filePath);
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(fullPath, content, "utf-8");
  }

  async readFile(sandboxId: string, filePath: string): Promise<string> {
    const info = this.sandboxes.get(sandboxId);
    if (!info) throw new Error(`Sandbox ${sandboxId} not found`);

    const fullPath = join(info.workspaceDir, filePath);
    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    return readFileSync(fullPath, "utf-8");
  }

  async deleteFile(sandboxId: string, filePath: string): Promise<void> {
    const info = this.sandboxes.get(sandboxId);
    if (!info) throw new Error(`Sandbox ${sandboxId} not found`);

    const fullPath = join(info.workspaceDir, filePath);
    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
    }
  }

  async getFileTree(sandboxId: string): Promise<FileNode[]> {
    const info = this.sandboxes.get(sandboxId);
    if (!info) return [];
    return this.buildFileTreeFromFS(info.workspaceDir, info.workspaceDir);
  }

  async getPreviewUrl(sandboxId: string): Promise<string> {
    const info = this.sandboxes.get(sandboxId);
    if (!info) throw new Error("Sandbox not found");
    return `http://localhost:${info.previewPort}`;
  }

  // ─── Health Check & Auto-Restart ────────────────────────

  /**
   * Ensure the sandbox dev server is running. If the process died,
   * restart it automatically. Returns true when the dev server is responsive.
   */
  async ensureSandboxRunning(projectId: string): Promise<boolean> {
    const info = this.sandboxes.get(projectId);
    if (!info) return false;

    const child = this.devProcesses.get(projectId);
    const isAlive = child && !child.killed && child.exitCode === null;

    if (!isAlive) {
      console.log(`[sandbox:${projectId}] Dev server is dead, restarting...`);
      // Clean up old reference
      this.devProcesses.delete(projectId);
      // Restart the dev server
      this.startDevServer(projectId, info.workspaceDir, info.previewPort);
      info.status = "running";
      this.sandboxes.set(projectId, info);

      // Wait briefly for the server to start
      await new Promise<void>((resolve) => setTimeout(resolve, 2000));
    }

    // Ping the dev server to check it's responding
    try {
      const result = await this.executeCommand(
        projectId,
        `timeout 3 curl -s -o /dev/null -w "%{http_code}" http://localhost:${info.previewPort} 2>/dev/null || echo "000"`
      );
      const statusCode = result.stdout.trim();
      if (statusCode !== "000") {
        return true;
      }
    } catch { /* ignore */ }

    // Server not responding yet — wait a bit more and retry once
    await new Promise<void>((resolve) => setTimeout(resolve, 3000));
    try {
      const retry = await this.executeCommand(
        projectId,
        `timeout 3 curl -s -o /dev/null -w "%{http_code}" http://localhost:${info.previewPort} 2>/dev/null || echo "000"`
      );
      return retry.stdout.trim() !== "000";
    } catch {
      return false;
    }
  }

  // ─── Lifecycle ───────────────────────────────────────────

  async destroySandbox(projectId: string): Promise<void> {
    const info = this.sandboxes.get(projectId);

    const child = this.devProcesses.get(projectId);
    if (child && !child.killed) {
      child.kill("SIGTERM");
      this.devProcesses.delete(projectId);
    }

    // Recycle the port
    if (info?.previewPort) {
      freePorts.push(info.previewPort);
    }

    // Clean up workspace directory
    if (info?.workspaceDir && existsSync(info.workspaceDir)) {
      try {
        rmSync(info.workspaceDir, { recursive: true, force: true });
      } catch { /* best-effort cleanup */ }
    }

    // Clean up callback
    this.devOutputCallbacks.delete(projectId);

    this.sandboxes.delete(projectId);
    const timer = this.ttlTimers.get(projectId);
    if (timer) {
      clearTimeout(timer);
      this.ttlTimers.delete(projectId);
    }
  }

  getSandboxInfo(projectId: string): SandboxInfo | undefined {
    return this.sandboxes.get(projectId);
  }

  getWorkspaceDir(sandboxId: string): string | null {
    const info = this.sandboxes.get(sandboxId);
    return info?.workspaceDir ?? null;
  }

  onDevServerOutput(projectId: string, callback: (output: string) => void): void {
    this.devOutputCallbacks.set(projectId, callback);
  }

  async restoreFiles(sandboxId: string, files: Record<string, string>): Promise<void> {
    const info = this.sandboxes.get(sandboxId);
    if (!info) throw new Error(`Sandbox ${sandboxId} not found`);

    // Delete all files in src/ first, then restore from snapshot
    const srcDir = join(info.workspaceDir, "src");
    if (existsSync(srcDir)) {
      const deleteRecursive = (dir: string) => {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            deleteRecursive(fullPath);
            try { rmSync(fullPath, { recursive: true, force: true }); } catch { /* skip */ }
          } else {
            unlinkSync(fullPath);
          }
        }
      };
      deleteRecursive(srcDir);
    }

    // Write all files from snapshot
    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = join(info.workspaceDir, filePath);
      const dir = dirname(fullPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(fullPath, content, "utf-8");
    }
  }

  resetTTL(projectId: string): void {
    const existing = this.ttlTimers.get(projectId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(
      () => this.destroySandbox(projectId),
      this.config.ttlMinutes * 60 * 1000
    );
    this.ttlTimers.set(projectId, timer);
  }

  // ─── Template ────────────────────────────────────────────

  private writeTemplate(dir: string): void {
    const files: Record<string, string> = {
      "package.json": JSON.stringify(
        {
          name: "forgeai-project",
          private: true,
          version: "0.0.1",
          type: "module",
          scripts: {
            dev: "vite",
            build: "tsc && vite build",
            preview: "vite preview",
          },
          dependencies: {
            react: "^18.3.1",
            "react-dom": "^18.3.1",
            "react-router-dom": "^7.1.0",
            "zustand": "^5.0.0",
            "lucide-react": "^0.469.0",
            "clsx": "^2.1.1",
            "tailwind-merge": "^2.6.0",
          },
          devDependencies: {
            "@types/react": "^18.3.12",
            "@types/react-dom": "^18.3.1",
            "@vitejs/plugin-react": "^4.3.4",
            typescript: "^5.6.0",
            vite: "^6.0.0",
            tailwindcss: "^4.0.0",
            "@tailwindcss/vite": "^4.0.0",
          },
        },
        null,
        2
      ),

      "vite.config.ts": [
        'import { defineConfig } from "vite";',
        'import react from "@vitejs/plugin-react";',
        'import tailwindcss from "@tailwindcss/vite";',
        "",
        "export default defineConfig({",
        "  plugins: [react(), tailwindcss()],",
        "  server: {",
        '    host: "0.0.0.0",',
        "    strictPort: false,",
        "  },",
        "});",
        "",
      ].join("\n"),

      "tsconfig.json": JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            useDefineForClassFields: true,
            lib: ["ES2020", "DOM", "DOM.Iterable"],
            module: "ESNext",
            skipLibCheck: true,
            moduleResolution: "bundler",
            allowImportingTsExtensions: true,
            isolatedModules: true,
            moduleDetection: "force",
            noEmit: true,
            jsx: "react-jsx",
            strict: true,
            noUnusedLocals: false,
            noUnusedParameters: false,
            noFallthroughCasesInSwitch: true,
          },
          include: ["src"],
        },
        null,
        2
      ),

      "index.html": [
        "<!DOCTYPE html>",
        '<html lang="en">',
        "  <head>",
        '    <meta charset="UTF-8" />',
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
        "    <title>ForgeAI App</title>",
        "  </head>",
        "  <body>",
        '    <div id="root"></div>',
        '    <script type="module" src="/src/main.tsx"></script>',
        "  </body>",
        "</html>",
        "",
      ].join("\n"),

      "src/main.tsx": [
        'import React from "react";',
        'import ReactDOM from "react-dom/client";',
        'import App from "./App";',
        'import "./index.css";',
        "",
        'ReactDOM.createRoot(document.getElementById("root")!).render(',
        "  <React.StrictMode>",
        "    <App />",
        "  </React.StrictMode>",
        ");",
        "",
      ].join("\n"),

      "src/App.tsx": [
        "export default function App() {",
        "  return (",
        '    <div className="min-h-screen bg-gray-50 flex items-center justify-center">',
        '      <div className="text-center">',
        '        <h1 className="text-4xl font-bold text-gray-900 mb-4">',
        "          Welcome to ForgeAI",
        "        </h1>",
        '        <p className="text-lg text-gray-600">',
        "          Your app is being built by AI. This placeholder will be replaced shortly.",
        "        </p>",
        "      </div>",
        "    </div>",
        "  );",
        "}",
        "",
      ].join("\n"),

      "src/index.css": '@import "tailwindcss";\n',

      "src/vite-env.d.ts": '/// <reference types="vite/client" />\n',
    };

    for (const [filePath, content] of Object.entries(files)) {
      const fullPath = join(dir, filePath);
      const fileDir = dirname(fullPath);
      if (!existsSync(fileDir)) {
        mkdirSync(fileDir, { recursive: true });
      }
      writeFileSync(fullPath, content, "utf-8");
    }
  }

  // ─── File tree ───────────────────────────────────────────

  private buildFileTreeFromFS(dir: string, root: string): FileNode[] {
    const IGNORE = new Set(["node_modules", ".git", "dist", ".vite"]);
    const result: FileNode[] = [];

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return result;
    }

    for (const entry of entries.sort()) {
      if (IGNORE.has(entry)) continue;

      const fullPath = join(dir, entry);
      const relPath = relative(root, fullPath);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        result.push({
          name: entry,
          path: relPath,
          type: "directory",
          children: this.buildFileTreeFromFS(fullPath, root),
        });
      } else {
        result.push({ name: entry, path: relPath, type: "file" });
      }
    }

    return result;
  }
}
