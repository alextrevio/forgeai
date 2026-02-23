import { Router } from "express";
import { prisma } from "@forgeai/db";
import { createWriteStream, existsSync, mkdirSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const router = Router();

// POST /api/projects/:id/export/zip — Export project as ZIP
router.post("/:id/export/zip", async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as any).userId;

    const project = await prisma.project.findFirst({ where: { id } });
    if (!project) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    }

    // Verify access
    const hasAccess =
      project.userId === userId ||
      (await prisma.projectMember.findFirst({ where: { projectId: id, userId } }));
    if (!hasAccess) {
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "No access" } });
    }

    if (!project.sandboxId) {
      return res.status(400).json({ error: { code: "NO_SANDBOX", message: "No sandbox files to export" } });
    }

    const { sandboxManager } = await import("../sandbox/manager");

    // Get sandbox workspace path
    const workspaceDir = sandboxManager.getWorkspaceDir(project.sandboxId);
    if (!workspaceDir || !existsSync(workspaceDir)) {
      return res.status(400).json({ error: { code: "NO_FILES", message: "Sandbox directory not found" } });
    }

    // Generate README
    const readme = `# ${project.name}

${project.description || "Generated with ForgeAI"}

## Framework
${project.framework}

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Built with ForgeAI
This project was generated using [ForgeAI](https://forgeai.dev), an AI-powered app builder.
`;

    // Write README to workspace temporarily
    const readmePath = join(workspaceDir, "README.md");
    const gitignorePath = join(workspaceDir, ".gitignore");
    const hasReadme = existsSync(readmePath);
    const hasGitignore = existsSync(gitignorePath);

    if (!hasReadme) {
      require("fs").writeFileSync(readmePath, readme);
    }
    if (!hasGitignore) {
      require("fs").writeFileSync(
        gitignorePath,
        "node_modules/\ndist/\n.env\n.env.local\n*.log\n"
      );
    }

    // Create zip file
    const tmpDir = join(process.cwd(), "tmp");
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

    const zipFileName = `${project.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.zip`;
    const zipPath = join(tmpDir, zipFileName);

    // Remove old zip if exists
    if (existsSync(zipPath)) unlinkSync(zipPath);

    // Create zip excluding node_modules
    execSync(
      `cd "${workspaceDir}" && zip -r "${zipPath}" . -x "node_modules/*" "node_modules/**" ".git/*" ".git/**"`,
      { timeout: 30000 }
    );

    // Clean up temp files we created
    if (!hasReadme) unlinkSync(readmePath);
    if (!hasGitignore) unlinkSync(gitignorePath);

    // Send file
    const zipBuffer = readFileSync(zipPath);
    unlinkSync(zipPath);

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${zipFileName}"`);
    res.send(zipBuffer);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/import — Import project from ZIP
router.post("/import", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const { name, zipBase64, framework } = req.body;

    if (!name || !zipBase64) {
      return res.status(400).json({ error: { code: "INVALID_INPUT", message: "name and zipBase64 required" } });
    }

    // Create project
    const project = await prisma.project.create({
      data: {
        name,
        userId,
        framework: framework || "react-vite",
        status: "ACTIVE",
      },
    });

    const { sandboxManager } = await import("../sandbox/manager");

    // Create sandbox
    const sandbox = await sandboxManager.createSandbox(project.id, framework || "react-vite");

    // Write zip to temp file and extract
    const tmpDir = join(process.cwd(), "tmp");
    if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });

    const zipPath = join(tmpDir, `import_${project.id}.zip`);
    const zipBuffer = Buffer.from(zipBase64, "base64");
    require("fs").writeFileSync(zipPath, zipBuffer);

    const workspaceDir = sandboxManager.getWorkspaceDir(sandbox.containerId) || sandbox.workspaceDir;
    if (workspaceDir) {
      execSync(`unzip -o "${zipPath}" -d "${workspaceDir}"`, { timeout: 30000 });
    }
    unlinkSync(zipPath);

    // Auto-detect framework
    const detectedFramework = workspaceDir ? detectFramework(workspaceDir) : null;
    if (detectedFramework && detectedFramework !== framework) {
      await prisma.project.update({
        where: { id: project.id },
        data: { framework: detectedFramework, sandboxId: sandbox.containerId },
      });
    } else {
      await prisma.project.update({
        where: { id: project.id },
        data: { sandboxId: sandbox.containerId },
      });
    }

    // Run npm install in background
    try {
      await sandboxManager.executeCommand(sandbox.containerId, "npm install");
    } catch {
      // Non-fatal
    }

    res.json(project);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/import/github — Import from GitHub URL
router.post("/import/github", async (req, res, next) => {
  try {
    const userId = (req as any).userId;
    const { repoUrl, name } = req.body;

    if (!repoUrl) {
      return res.status(400).json({ error: { code: "INVALID_INPUT", message: "repoUrl required" } });
    }

    // Extract repo name from URL
    const repoMatch = repoUrl.match(/github\.com[/:]([^/]+\/[^/.]+)/);
    const repoName = repoMatch ? repoMatch[1] : "imported-project";
    const projectName = name || repoName.split("/").pop() || "Imported Project";

    // Create project
    const project = await prisma.project.create({
      data: {
        name: projectName,
        userId,
        framework: "react-vite",
        githubRepo: repoName,
        status: "ACTIVE",
      },
    });

    const { sandboxManager } = await import("../sandbox/manager");

    const sandbox = await sandboxManager.createSandbox(project.id, "react-vite");
    const workspaceDir = sandboxManager.getWorkspaceDir(sandbox.containerId) || sandbox.workspaceDir;

    // Clone repo
    if (workspaceDir) {
      try {
        execSync(`git clone --depth 1 "${repoUrl}" "${workspaceDir}_tmp" && cp -r "${workspaceDir}_tmp"/. "${workspaceDir}" && rm -rf "${workspaceDir}_tmp"`, {
          timeout: 60000,
        });
      } catch (err) {
        return res.status(400).json({ error: { code: "CLONE_FAILED", message: "Failed to clone repository" } });
      }
    }

    // Auto-detect framework
    const detectedFramework = workspaceDir ? detectFramework(workspaceDir) : null;
    await prisma.project.update({
      where: { id: project.id },
      data: {
        sandboxId: sandbox.containerId,
        framework: detectedFramework || "react-vite",
        githubRepo: repoName,
      },
    });

    // npm install
    try {
      await sandboxManager.executeCommand(sandbox.containerId, "npm install");
    } catch {
      // Non-fatal
    }

    res.json(project);
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:id/screenshot — Capture a placeholder screenshot
router.get("/:id/screenshot", async (req, res, next) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findFirst({ where: { id } });
    if (!project) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Project not found" } });
    }

    // Generate a placeholder SVG thumbnail
    const frameworkLabel = project.framework.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#16213e;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="400" height="300" fill="url(#bg)" rx="12" />
  <text x="200" y="130" fill="#e2e8f0" font-family="system-ui, sans-serif" font-size="18" font-weight="600" text-anchor="middle">${escapeXml(project.name)}</text>
  <rect x="140" y="155" width="120" height="28" rx="14" fill="#6d5cff" opacity="0.2" />
  <text x="200" y="174" fill="#6d5cff" font-family="system-ui, sans-serif" font-size="12" font-weight="500" text-anchor="middle">${frameworkLabel}</text>
  <text x="200" y="220" fill="#64748b" font-family="system-ui, sans-serif" font-size="11" text-anchor="middle">ForgeAI</text>
</svg>`;

    const svgBase64 = Buffer.from(svg).toString("base64");
    const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;

    // Store as thumbnail
    await prisma.project.update({
      where: { id },
      data: { thumbnail: dataUrl },
    });

    res.json({ thumbnail: dataUrl });
  } catch (err) {
    next(err);
  }
});

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .slice(0, 30);
}

function detectFramework(dir: string): string | null {
  try {
    if (existsSync(join(dir, "next.config.js")) || existsSync(join(dir, "next.config.ts")) || existsSync(join(dir, "next.config.mjs"))) {
      return "nextjs";
    }
    if (existsSync(join(dir, "vite.config.ts")) || existsSync(join(dir, "vite.config.js"))) {
      // Check for Vue
      const pkgPath = join(dir, "package.json");
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.dependencies?.vue || pkg.devDependencies?.vue) return "vue";
      }
      return "react-vite";
    }
    return null;
  } catch {
    return null;
  }
}

export { router as exportImportRouter };
