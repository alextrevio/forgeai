"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Book,
  Key,
  FolderOpen,
  Cpu,
  Sparkles,
  BarChart3,
  Globe,
  ChevronRight,
  Copy,
  Check,
  ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DocSection = "overview" | "auth" | "projects" | "engine" | "skills" | "usage" | "webhooks";

const SECTIONS: Array<{ id: DocSection; label: string; icon: React.ReactNode }> = [
  { id: "overview", label: "Overview", icon: <Book className="h-4 w-4" /> },
  { id: "auth", label: "Authentication", icon: <Key className="h-4 w-4" /> },
  { id: "projects", label: "Projects", icon: <FolderOpen className="h-4 w-4" /> },
  { id: "engine", label: "Engine", icon: <Cpu className="h-4 w-4" /> },
  { id: "skills", label: "Skills", icon: <Sparkles className="h-4 w-4" /> },
  { id: "usage", label: "Usage", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "webhooks", label: "Webhooks", icon: <Globe className="h-4 w-4" /> },
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://api.forgeai.dev";

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2A2A2A]">
        <span className="text-[10px] font-medium text-[#8888a0] uppercase">{language}</span>
        <button onClick={handleCopy} className="text-[#8888a0] hover:text-[#EDEDED] transition-colors">
          {copied ? <Check className="h-3.5 w-3.5 text-[#22c55e]" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="p-4 text-xs text-[#EDEDED] overflow-x-auto font-mono leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

function Endpoint({ method, path, description }: { method: string; path: string; description: string }) {
  const methodColors: Record<string, string> = {
    GET: "bg-[#22c55e]/10 text-[#22c55e]",
    POST: "bg-[#7c3aed]/10 text-[#7c3aed]",
    DELETE: "bg-[#ef4444]/10 text-[#ef4444]",
    PATCH: "bg-[#f59e0b]/10 text-[#f59e0b]",
    PUT: "bg-[#3b82f6]/10 text-[#3b82f6]",
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#2A2A2A] bg-[#111111] px-4 py-3">
      <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold uppercase", methodColors[method] || "bg-[#2A2A2A] text-[#8888a0]")}>
        {method}
      </span>
      <code className="text-sm text-[#EDEDED] font-mono">{path}</code>
      <span className="text-xs text-[#8888a0] ml-auto">{description}</span>
    </div>
  );
}

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState<DocSection>("overview");

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED]">
      {/* Top nav */}
      <nav className="sticky top-0 z-50 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-[#2A2A2A]">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[#7c3aed]" />
            <span className="text-lg font-bold">Arya AI</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">Login</Link>
            <Link href="/register" className="rounded-lg bg-[#7c3aed] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors">
              Registrarse
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-[#8888a0] hover:text-[#EDEDED] mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Volver al inicio
          </Link>
          <h1 className="text-2xl font-bold text-[#EDEDED]">API Documentation</h1>
          <p className="text-sm text-[#8888a0] mt-1">Integrate Arya into your workflow with the public API</p>
        </div>

        <div className="flex gap-8">
          {/* Sidebar nav */}
          <nav className="w-48 shrink-0 space-y-1 sticky top-8 self-start">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  activeSection === section.id
                    ? "bg-[#7c3aed]/10 text-[#EDEDED]"
                    : "text-[#8888a0] hover:bg-[#1A1A1A] hover:text-[#EDEDED]"
                )}
              >
                {activeSection === section.id && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-[#7c3aed]" />
                )}
                {section.icon}
                {section.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-8">
            {/* ─── Overview ─────────────────────── */}
            {activeSection === "overview" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-xl font-bold text-[#EDEDED] mb-2">Arya Public API</h2>
                  <p className="text-sm text-[#8888a0] leading-relaxed">
                    The Arya API lets you programmatically create projects, start the AI engine, manage skills,
                    and track usage. All endpoints are under <code className="text-[#7c3aed]">/api/v1/</code> and
                    require an API key for authentication.
                  </p>
                </div>

                <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-6">
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">Base URL</h3>
                  <code className="text-sm text-[#7c3aed] font-mono">{API_BASE}/api/v1</code>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">Quick Start</h3>
                  <CodeBlock language="bash" code={`# List your projects
curl -H "Authorization: Bearer arya_key_YOUR_KEY" \\
  ${API_BASE}/api/v1/projects`} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">Response Format</h3>
                  <p className="text-xs text-[#8888a0] mb-3">All successful responses wrap the result in a <code className="text-[#7c3aed]">data</code> field. Errors use the <code className="text-[#7c3aed]">error</code> field.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <CodeBlock language="json" code={`// Success
{
  "data": { ... }
}

// Error
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Project not found"
  }
}`} />
                    <div className="rounded-xl border border-[#2A2A2A] bg-[#111111] p-4 space-y-3">
                      <h4 className="text-xs font-semibold text-[#EDEDED]">HTTP Status Codes</h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between"><span className="text-[#22c55e]">200</span><span className="text-[#8888a0]">Success</span></div>
                        <div className="flex justify-between"><span className="text-[#22c55e]">201</span><span className="text-[#8888a0]">Created</span></div>
                        <div className="flex justify-between"><span className="text-[#f59e0b]">400</span><span className="text-[#8888a0]">Bad Request</span></div>
                        <div className="flex justify-between"><span className="text-[#ef4444]">401</span><span className="text-[#8888a0]">Unauthorized</span></div>
                        <div className="flex justify-between"><span className="text-[#ef4444]">403</span><span className="text-[#8888a0]">Insufficient Scope</span></div>
                        <div className="flex justify-between"><span className="text-[#ef4444]">404</span><span className="text-[#8888a0]">Not Found</span></div>
                        <div className="flex justify-between"><span className="text-[#f59e0b]">409</span><span className="text-[#8888a0]">Conflict</span></div>
                        <div className="flex justify-between"><span className="text-[#ef4444]">429</span><span className="text-[#8888a0]">Rate Limited</span></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">Rate Limits</h3>
                  <p className="text-xs text-[#8888a0]">The API is rate-limited to <strong className="text-[#EDEDED]">60 requests per minute</strong> per API key.</p>
                </div>
              </div>
            )}

            {/* ─── Authentication ─────────────────────── */}
            {activeSection === "auth" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-xl font-bold text-[#EDEDED] mb-2">Authentication</h2>
                  <p className="text-sm text-[#8888a0] leading-relaxed">
                    API requests are authenticated using Bearer tokens. Create an API key in
                    <Link href="/settings" className="text-[#7c3aed] hover:underline ml-1">Settings &gt; API Keys</Link>.
                  </p>
                </div>

                <CodeBlock language="bash" code={`curl -H "Authorization: Bearer arya_key_YOUR_KEY" \\
  ${API_BASE}/api/v1/projects`} />

                <CodeBlock language="javascript" code={`const response = await fetch('${API_BASE}/api/v1/projects', {
  headers: {
    'Authorization': 'Bearer arya_key_YOUR_KEY',
    'Content-Type': 'application/json',
  },
});
const { data } = await response.json();
console.log(data);`} />

                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">Scopes</h3>
                  <p className="text-xs text-[#8888a0] mb-3">Each API key has scopes that control which endpoints it can access.</p>
                  <div className="space-y-2">
                    {[
                      { scope: "projects.read", desc: "List and read projects" },
                      { scope: "projects.write", desc: "Create and delete projects" },
                      { scope: "engine.start", desc: "Start engine, control execution, use skills" },
                      { scope: "engine.read", desc: "Read engine status and tasks" },
                      { scope: "skills.read", desc: "List available skills" },
                      { scope: "usage.read", desc: "View usage and spending data" },
                    ].map((s) => (
                      <div key={s.scope} className="flex items-center gap-3 rounded-lg border border-[#2A2A2A] bg-[#111111] px-4 py-2.5">
                        <code className="text-xs text-[#7c3aed] font-mono">{s.scope}</code>
                        <span className="text-xs text-[#8888a0]">{s.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── Projects ─────────────────────── */}
            {activeSection === "projects" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-xl font-bold text-[#EDEDED] mb-2">Projects</h2>
                  <p className="text-sm text-[#8888a0]">Create, list, and manage your projects.</p>
                </div>

                <div className="space-y-3">
                  <Endpoint method="GET" path="/api/v1/projects" description="List all projects" />
                  <Endpoint method="POST" path="/api/v1/projects" description="Create a project" />
                  <Endpoint method="GET" path="/api/v1/projects/:id" description="Get project details" />
                  <Endpoint method="DELETE" path="/api/v1/projects/:id" description="Delete a project" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">List Projects</h3>
                  <CodeBlock language="bash" code={`curl -H "Authorization: Bearer arya_key_YOUR_KEY" \\
  ${API_BASE}/api/v1/projects`} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">Create Project</h3>
                  <CodeBlock language="bash" code={`curl -X POST ${API_BASE}/api/v1/projects \\
  -H "Authorization: Bearer arya_key_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My App", "framework": "react-vite"}'`} />
                  <CodeBlock language="javascript" code={`const response = await fetch('${API_BASE}/api/v1/projects', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer arya_key_YOUR_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'My App',
    framework: 'react-vite', // react-vite | nextjs | vue | landing | dashboard | saas | api-only
    description: 'A cool project',
  }),
});
const { data } = await response.json();
console.log('Created project:', data.id);`} />
                </div>
              </div>
            )}

            {/* ─── Engine ─────────────────────── */}
            {activeSection === "engine" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-xl font-bold text-[#EDEDED] mb-2">Engine</h2>
                  <p className="text-sm text-[#8888a0]">Start the Arya AI engine on a project, monitor progress, and control execution.</p>
                </div>

                <div className="space-y-3">
                  <Endpoint method="POST" path="/api/v1/engine/start" description="Start engine" />
                  <Endpoint method="GET" path="/api/v1/engine/status/:projectId" description="Get engine status" />
                  <Endpoint method="POST" path="/api/v1/engine/control" description="Pause/resume/cancel" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">Start Engine</h3>
                  <CodeBlock language="bash" code={`curl -X POST ${API_BASE}/api/v1/engine/start \\
  -H "Authorization: Bearer arya_key_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"projectId": "PROJECT_ID", "prompt": "Build a landing page with hero, features, and pricing sections"}'`} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">Check Status</h3>
                  <CodeBlock language="javascript" code={`// Poll for engine completion
async function waitForEngine(projectId) {
  while (true) {
    const res = await fetch(
      \`${API_BASE}/api/v1/engine/status/\${projectId}\`,
      { headers: { 'Authorization': 'Bearer arya_key_YOUR_KEY' } }
    );
    const { data } = await res.json();

    console.log(\`Progress: \${data.progress.percentage}%\`);

    if (data.engineStatus === 'completed' || data.engineStatus === 'failed') {
      return data;
    }

    await new Promise(r => setTimeout(r, 3000)); // wait 3s
  }
}`} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">Control Engine</h3>
                  <CodeBlock language="bash" code={`# Pause
curl -X POST ${API_BASE}/api/v1/engine/control \\
  -H "Authorization: Bearer arya_key_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"projectId": "PROJECT_ID", "action": "pause"}'

# Resume
curl -X POST ${API_BASE}/api/v1/engine/control \\
  -H "Authorization: Bearer arya_key_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"projectId": "PROJECT_ID", "action": "resume"}'

# Cancel
curl -X POST ${API_BASE}/api/v1/engine/control \\
  -H "Authorization: Bearer arya_key_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"projectId": "PROJECT_ID", "action": "cancel"}'`} />
                </div>
              </div>
            )}

            {/* ─── Skills ─────────────────────── */}
            {activeSection === "skills" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-xl font-bold text-[#EDEDED] mb-2">Skills</h2>
                  <p className="text-sm text-[#8888a0]">List and use predefined skills to supercharge your projects.</p>
                </div>

                <div className="space-y-3">
                  <Endpoint method="GET" path="/api/v1/skills" description="List available skills" />
                  <Endpoint method="POST" path="/api/v1/skills/:slug/use" description="Use a skill in a project" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">List Skills</h3>
                  <CodeBlock language="bash" code={`# List all skills
curl -H "Authorization: Bearer arya_key_YOUR_KEY" \\
  ${API_BASE}/api/v1/skills

# Filter by category
curl -H "Authorization: Bearer arya_key_YOUR_KEY" \\
  "${API_BASE}/api/v1/skills?category=web&agentType=coder"`} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">Use a Skill</h3>
                  <CodeBlock language="javascript" code={`const response = await fetch('${API_BASE}/api/v1/skills/landing-page/use', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer arya_key_YOUR_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    projectId: 'PROJECT_ID',
    prompt: 'Create a SaaS landing page for my AI tool',
  }),
});
const { data } = await response.json();
console.log('Engine started with skill:', data.skillUsed.name);`} />
                </div>
              </div>
            )}

            {/* ─── Usage ─────────────────────── */}
            {activeSection === "usage" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-xl font-bold text-[#EDEDED] mb-2">Usage</h2>
                  <p className="text-sm text-[#8888a0]">Track your token usage, spending, and breakdown by model and agent.</p>
                </div>

                <div className="space-y-3">
                  <Endpoint method="GET" path="/api/v1/usage" description="Get usage summary" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">Get Usage Summary</h3>
                  <CodeBlock language="bash" code={`curl -H "Authorization: Bearer arya_key_YOUR_KEY" \\
  ${API_BASE}/api/v1/usage`} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">Response Example</h3>
                  <CodeBlock language="json" code={`{
  "data": {
    "plan": "PRO",
    "monthlyBudget": 50.00,
    "totalSpent": 12.34,
    "creditsUsed": 45,
    "creditsLimit": 500,
    "dailyCost": {
      "2025-05-01": { "cost": 1.23, "tokens": 45000 },
      "2025-05-02": { "cost": 2.45, "tokens": 89000 }
    },
    "byModel": {
      "claude-sonnet-4-5-20250929": { "cost": 8.50, "tokens": 200000, "count": 15 }
    },
    "byAgent": {
      "coder": { "cost": 6.00, "tokens": 150000, "count": 10 },
      "research": { "cost": 3.00, "tokens": 50000, "count": 5 }
    },
    "topProjects": [
      { "id": "proj_123", "name": "My App", "cost": 5.00, "tokens": 120000 }
    ]
  }
}`} />
                </div>
              </div>
            )}

            {/* ─── Webhooks ─────────────────────── */}
            {activeSection === "webhooks" && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-xl font-bold text-[#EDEDED] mb-2">Webhooks</h2>
                  <p className="text-sm text-[#8888a0]">
                    Receive real-time HTTP notifications when events occur. Configure webhooks in
                    <Link href="/settings" className="text-[#7c3aed] hover:underline ml-1">Settings &gt; Webhooks</Link>.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">Available Events</h3>
                  <div className="space-y-2">
                    {[
                      { event: "engine.started", desc: "Engine started processing a project" },
                      { event: "engine.completed", desc: "Engine finished all tasks successfully" },
                      { event: "engine.failed", desc: "Engine encountered a fatal error" },
                      { event: "project.created", desc: "A new project was created" },
                      { event: "project.deleted", desc: "A project was deleted" },
                    ].map((e) => (
                      <div key={e.event} className="flex items-center gap-3 rounded-lg border border-[#2A2A2A] bg-[#111111] px-4 py-2.5">
                        <code className="text-xs text-[#7c3aed] font-mono">{e.event}</code>
                        <span className="text-xs text-[#8888a0]">{e.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">Payload Format</h3>
                  <CodeBlock language="json" code={`{
  "event": "engine.completed",
  "timestamp": "2025-05-15T10:30:00.000Z",
  "data": {
    "projectId": "proj_123",
    "projectName": "My App",
    "tasksCompleted": 5,
    "totalTokensUsed": 45000,
    "estimatedCost": 1.23
  }
}`} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">Headers</h3>
                  <div className="space-y-2">
                    {[
                      { header: "X-Arya-Event", desc: "Event type (e.g. engine.completed)" },
                      { header: "X-Arya-Signature", desc: "HMAC-SHA256 signature of the payload" },
                      { header: "X-Arya-Timestamp", desc: "ISO timestamp of when the event was sent" },
                      { header: "Content-Type", desc: "application/json" },
                    ].map((h) => (
                      <div key={h.header} className="flex items-center gap-3 rounded-lg border border-[#2A2A2A] bg-[#111111] px-4 py-2.5">
                        <code className="text-xs text-[#7c3aed] font-mono">{h.header}</code>
                        <span className="text-xs text-[#8888a0]">{h.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-[#EDEDED] mb-3">Verify Signature (Node.js)</h3>
                  <CodeBlock language="javascript" code={`const crypto = require('crypto');

app.post('/webhook', (req, res) => {
  const signature = req.headers['x-arya-signature'];
  const payload = JSON.stringify(req.body);

  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).send('Invalid signature');
  }

  // Process the event
  const { event, data } = req.body;
  console.log('Received event:', event, data);

  res.status(200).send('OK');
});`} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
