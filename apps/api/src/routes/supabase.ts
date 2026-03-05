import { Router, Response } from "express";
import type { Router as RouterType } from "express";
import { z } from "zod";
import { prisma } from "@forgeai/db";
import { AuthRequest } from "../middleware/auth";
import { sandboxManager } from "../sandbox/manager";
import { encrypt, decrypt } from "../lib/encryption";

/** Safely decrypt a stored key (handles both encrypted and legacy plaintext) */
function decryptKey(stored: string): string {
  try {
    return decrypt(stored);
  } catch {
    return stored;
  }
}

export const supabaseRouter: RouterType = Router();

const connectSchema = z.object({
  url: z.string().url(),
  anonKey: z.string().min(1),
});

// Connect Supabase account
supabaseRouter.post("/connect", async (req: AuthRequest, res: Response) => {
  try {
    const body = connectSchema.parse(req.body);

    // Verify connection by checking Supabase health
    const healthRes = await fetch(`${body.url}/rest/v1/`, {
      headers: {
        apikey: body.anonKey,
        Authorization: `Bearer ${body.anonKey}`,
      },
    });

    if (!healthRes.ok) {
      return res.status(400).json({ error: "Could not connect to Supabase. Check your URL and key." });
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: {
        supabaseUrl: body.url,
        supabaseKey: encrypt(body.anonKey),
      },
    });

    return res.json({ connected: true, url: body.url });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid input", details: err.errors });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Supabase connect error:", msg);
    return res.status(400).json({ error: msg });
  }
});

// Disconnect Supabase
supabaseRouter.post("/disconnect", async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: { supabaseUrl: null, supabaseKey: null },
    });
    return res.json({ connected: false });
  } catch (err) {
    console.error("Supabase disconnect error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get Supabase connection status
supabaseRouter.get("/status", async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { supabaseUrl: true, supabaseKey: true },
    });
    return res.json({
      connected: !!user?.supabaseUrl,
      url: user?.supabaseUrl || null,
    });
  } catch (err) {
    console.error("Supabase status error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get tables from Supabase
supabaseRouter.get("/tables", async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { supabaseUrl: true, supabaseKey: true },
    });
    if (!user?.supabaseUrl || !user?.supabaseKey) {
      return res.status(400).json({ error: "Supabase not connected" });
    }

    const anonKey = decryptKey(user.supabaseKey);

    // Query information_schema for tables
    const response = await fetch(
      `${user.supabaseUrl}/rest/v1/rpc/get_tables`,
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );

    // Fallback: try to get table list via pg_tables
    if (!response.ok) {
      // Return empty - the function may not exist
      return res.json({ tables: [], note: "Create an RPC function 'get_tables' in Supabase to list tables" });
    }

    const tables = await response.json();
    return res.json({ tables });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Supabase tables error:", msg);
    return res.status(500).json({ error: msg });
  }
});

// Generate Supabase client code for a project
supabaseRouter.post("/:id/generate-client", async (req: AuthRequest, res: Response) => {
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
      select: { supabaseUrl: true, supabaseKey: true },
    });
    if (!user?.supabaseUrl || !user?.supabaseKey) {
      return res.status(400).json({ error: "Supabase not connected" });
    }

    const anonKey = decryptKey(user.supabaseKey);

    // Generate supabase client file
    const clientCode = `import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "${user.supabaseUrl}";
const supabaseAnonKey = "${anonKey}";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
`;

    // Generate auth helpers
    const authCode = `import { supabase } from "./supabase";

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}
`;

    // Write files to sandbox
    await sandboxManager.writeFile(project.sandboxId, "src/lib/supabase.ts", clientCode);
    await sandboxManager.writeFile(project.sandboxId, "src/lib/auth.ts", authCode);

    // Install supabase client
    await sandboxManager.executeCommand(project.sandboxId, "npm install @supabase/supabase-js");

    // Link project to supabase
    await prisma.project.update({
      where: { id: projectId },
      data: { supabaseProjectId: user.supabaseUrl },
    });

    return res.json({
      success: true,
      filesCreated: ["src/lib/supabase.ts", "src/lib/auth.ts"],
      packageInstalled: "@supabase/supabase-js",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Supabase generate error:", msg);
    return res.status(500).json({ error: msg });
  }
});

// Generate database types from Supabase schema
supabaseRouter.post("/:id/generate-types", async (req: AuthRequest, res: Response) => {
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
      select: { supabaseUrl: true, supabaseKey: true },
    });
    if (!user?.supabaseUrl || !user?.supabaseKey) {
      return res.status(400).json({ error: "Supabase not connected" });
    }

    const anonKey = decryptKey(user.supabaseKey);

    // Fetch OpenAPI schema from Supabase
    const openApiRes = await fetch(`${user.supabaseUrl}/rest/v1/?apikey=${anonKey}`);

    if (!openApiRes.ok) {
      return res.status(400).json({ error: "Could not fetch schema from Supabase" });
    }

    const schema = await openApiRes.json();

    // Generate basic types from the OpenAPI definitions
    let typesContent = "// Auto-generated Supabase database types\n// Generated by ForgeAI\n\n";

    if (schema.definitions) {
      for (const [tableName, def] of Object.entries(schema.definitions)) {
        const definition = def as any;
        if (!definition.properties) continue;

        typesContent += `export interface ${tableName} {\n`;
        for (const [col, colDef] of Object.entries(definition.properties)) {
          const colType = colDef as any;
          let tsType = "unknown";
          if (colType.type === "string") tsType = "string";
          else if (colType.type === "integer" || colType.type === "number") tsType = "number";
          else if (colType.type === "boolean") tsType = "boolean";
          else if (colType.format === "uuid") tsType = "string";
          else if (colType.format === "timestamp with time zone" || colType.format === "date") tsType = "string";

          const optional = definition.required?.includes(col) ? "" : "?";
          typesContent += `  ${col}${optional}: ${tsType};\n`;
        }
        typesContent += "}\n\n";
      }
    } else {
      typesContent += "// No table definitions found. Make sure your Supabase project has tables.\n";
      typesContent += "export type Database = Record<string, never>;\n";
    }

    await sandboxManager.writeFile(project.sandboxId, "src/types/database.ts", typesContent);

    return res.json({
      success: true,
      file: "src/types/database.ts",
      tablesFound: schema.definitions ? Object.keys(schema.definitions).length : 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Supabase generate types error:", msg);
    return res.status(500).json({ error: msg });
  }
});
