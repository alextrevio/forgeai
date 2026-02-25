import { Router, Response } from "express";
import type { Router as RouterType } from "express";
import { z } from "zod";
import { prisma } from "@forgeai/db";
import { AuthRequest } from "../middleware/auth";
import { sandboxManager } from "../sandbox/manager";

export const githubRouter: RouterType = Router();

const GITHUB_API = "https://api.github.com";

async function githubFetch(token: string, path: string, options: RequestInit = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      ...(options.headers ? (options.headers as Record<string, string>) : {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `GitHub API error: ${res.status}`);
  return data;
}

const connectSchema = z.object({
  token: z.string().min(1),
});

// Connect GitHub account (save PAT)
githubRouter.post("/connect", async (req: AuthRequest, res: Response) => {
  try {
    const body = connectSchema.parse(req.body);

    // Verify token by fetching user info
    const ghUser = await githubFetch(body.token, "/user");

    await prisma.user.update({
      where: { id: req.userId },
      data: {
        githubToken: body.token,
        githubUsername: ghUser.login,
      },
    });

    return res.json({
      connected: true,
      username: ghUser.login,
      avatarUrl: ghUser.avatar_url,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GitHub connect error:", msg);
    return res.status(400).json({ error: msg });
  }
});

// Disconnect GitHub
githubRouter.post("/disconnect", async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { githubToken: null, githubUsername: null },
    });
    return res.json({ connected: false });
  } catch (err) {
    console.error("GitHub disconnect error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get GitHub status
githubRouter.get("/status", async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { githubToken: true, githubUsername: true },
    });
    return res.json({
      connected: !!user?.githubToken,
      username: user?.githubUsername || null,
    });
  } catch (err) {
    console.error("GitHub status error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Export project to new GitHub repo
githubRouter.post("/:id/export", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project || !project.sandboxId) {
      return res.status(404).json({ error: "Project or sandbox not found" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { githubToken: true, githubUsername: true },
    });
    if (!user?.githubToken) {
      return res.status(400).json({ error: "GitHub not connected" });
    }

    const repoName = project.name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50);

    // Create repo
    const repo = await githubFetch(user.githubToken, "/user/repos", {
      method: "POST",
      body: JSON.stringify({
        name: repoName,
        description: project.description || `Created with ForgeAI`,
        private: false,
        auto_init: false,
      }),
    });

    // Collect all project files
    const fileTree = await sandboxManager.getFileTree(project.sandboxId);
    const files: Record<string, string> = {};

    const walkTree = async (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === "file" && !node.path.includes("node_modules")) {
          try {
            files[node.path] = await sandboxManager.readFile(project.sandboxId!, node.path);
          } catch { /* skip binary */ }
        }
        if (node.children) await walkTree(node.children);
      }
    };
    await walkTree(fileTree);

    // Add README
    files["README.md"] = `# ${project.name}\n\nBuilt with [ForgeAI](https://forgeai.app)\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n`;

    // Add .gitignore
    files[".gitignore"] = `node_modules/\ndist/\n.env\n.vite/\n*.local\n`;

    // Push files using GitHub Trees API
    // Step 1: Create blobs for each file
    const blobs: Array<{ path: string; sha: string }> = [];
    for (const [filePath, content] of Object.entries(files)) {
      const blob = await githubFetch(user.githubToken, `/repos/${repo.full_name}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({
          content: Buffer.from(content).toString("base64"),
          encoding: "base64",
        }),
      });
      blobs.push({ path: filePath, sha: blob.sha });
    }

    // Step 2: Create tree
    const tree = await githubFetch(user.githubToken, `/repos/${repo.full_name}/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        tree: blobs.map((b) => ({
          path: b.path,
          mode: "100644",
          type: "blob",
          sha: b.sha,
        })),
      }),
    });

    // Step 3: Create commit
    const commit = await githubFetch(user.githubToken, `/repos/${repo.full_name}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message: "Initial commit from ForgeAI",
        tree: tree.sha,
      }),
    });

    // Step 4: Update main ref
    await githubFetch(user.githubToken, `/repos/${repo.full_name}/git/refs`, {
      method: "POST",
      body: JSON.stringify({
        ref: "refs/heads/main",
        sha: commit.sha,
      }),
    });

    // Update project with GitHub repo info
    await prisma.project.update({
      where: { id: projectId },
      data: { githubRepo: repo.full_name },
    });

    return res.json({
      success: true,
      repoUrl: repo.html_url,
      repoFullName: repo.full_name,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GitHub export error:", msg);
    return res.status(500).json({ error: msg });
  }
});

// Push changes to existing GitHub repo
githubRouter.post("/:id/push", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project || !project.sandboxId || !project.githubRepo) {
      return res.status(404).json({ error: "Project, sandbox, or GitHub repo not found" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { githubToken: true },
    });
    if (!user?.githubToken) {
      return res.status(400).json({ error: "GitHub not connected" });
    }

    // Get latest commit SHA
    const ref = await githubFetch(user.githubToken, `/repos/${project.githubRepo}/git/ref/heads/main`);
    const parentSha = ref.object.sha;

    // Collect files
    const fileTree = await sandboxManager.getFileTree(project.sandboxId);
    const files: Record<string, string> = {};
    const walkTree = async (nodes: any[]) => {
      for (const node of nodes) {
        if (node.type === "file" && !node.path.includes("node_modules")) {
          try {
            files[node.path] = await sandboxManager.readFile(project.sandboxId!, node.path);
          } catch { /* skip */ }
        }
        if (node.children) await walkTree(node.children);
      }
    };
    await walkTree(fileTree);

    // Create blobs
    const blobs: Array<{ path: string; sha: string }> = [];
    for (const [filePath, content] of Object.entries(files)) {
      const blob = await githubFetch(user.githubToken, `/repos/${project.githubRepo}/git/blobs`, {
        method: "POST",
        body: JSON.stringify({
          content: Buffer.from(content).toString("base64"),
          encoding: "base64",
        }),
      });
      blobs.push({ path: filePath, sha: blob.sha });
    }

    // Create tree
    const tree = await githubFetch(user.githubToken, `/repos/${project.githubRepo}/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        tree: blobs.map((b) => ({
          path: b.path,
          mode: "100644",
          type: "blob",
          sha: b.sha,
        })),
      }),
    });

    // Create commit with parent
    const commit = await githubFetch(user.githubToken, `/repos/${project.githubRepo}/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message: req.body.message || "Update from ForgeAI",
        tree: tree.sha,
        parents: [parentSha],
      }),
    });

    // Update ref
    await githubFetch(user.githubToken, `/repos/${project.githubRepo}/git/refs/heads/main`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha }),
    });

    return res.json({ success: true, commitSha: commit.sha });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GitHub push error:", msg);
    return res.status(500).json({ error: msg });
  }
});

// Pull from GitHub repo into sandbox
githubRouter.post("/:id/pull", async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id as string;
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId: req.userId },
    });
    if (!project || !project.sandboxId || !project.githubRepo) {
      return res.status(404).json({ error: "Project, sandbox, or GitHub repo not found" });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { githubToken: true },
    });
    if (!user?.githubToken) {
      return res.status(400).json({ error: "GitHub not connected" });
    }

    // Get the tree recursively
    const ref = await githubFetch(user.githubToken, `/repos/${project.githubRepo}/git/ref/heads/main`);
    const commitData = await githubFetch(user.githubToken, `/repos/${project.githubRepo}/git/commits/${ref.object.sha}`);
    const treeData = await githubFetch(user.githubToken, `/repos/${project.githubRepo}/git/trees/${commitData.tree.sha}?recursive=1`);

    let filesUpdated = 0;
    for (const item of treeData.tree) {
      if (item.type !== "blob") continue;
      if (item.path.includes("node_modules/") || item.path === ".git") continue;

      const blob = await githubFetch(user.githubToken, `/repos/${project.githubRepo}/git/blobs/${item.sha}`);
      const content = Buffer.from(blob.content, "base64").toString("utf-8");
      await sandboxManager.writeFile(project.sandboxId, item.path, content);
      filesUpdated++;
    }

    return res.json({ success: true, filesUpdated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GitHub pull error:", msg);
    return res.status(500).json({ error: msg });
  }
});
