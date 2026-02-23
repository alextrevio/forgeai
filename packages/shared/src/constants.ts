export const FRAMEWORKS = {
  "react-vite": {
    label: "React + Vite + Tailwind",
    description: "Modern React app with Vite bundler and Tailwind CSS",
    icon: "react",
  },
  nextjs: {
    label: "Next.js 14",
    description: "Full-stack React framework with API routes",
    icon: "nextjs",
  },
  vue: {
    label: "Vue 3 + Vite",
    description: "Progressive framework with Vite",
    icon: "vue",
  },
  landing: {
    label: "Landing Page",
    description: "Static landing page with Tailwind",
    icon: "globe",
  },
  dashboard: {
    label: "Dashboard",
    description: "Admin dashboard with charts and data tables",
    icon: "layout-dashboard",
  },
  saas: {
    label: "SaaS Starter",
    description: "SaaS template with auth, billing, and dashboard",
    icon: "rocket",
  },
  "api-only": {
    label: "API Only",
    description: "Express + Prisma REST API",
    icon: "server",
  },
} as const;

export const PLAN_LIMITS = {
  FREE: { credits: 50, maxProjects: 3, sandboxTTL: 15 },
  PRO: { credits: 500, maxProjects: 20, sandboxTTL: 60 },
  BUSINESS: { credits: 2000, maxProjects: 100, sandboxTTL: 120 },
  ENTERPRISE: { credits: -1, maxProjects: -1, sandboxTTL: -1 }, // unlimited
} as const;

export const SANDBOX_CONFIG = {
  defaultPort: 5173,
  maxCpu: "1",
  maxRam: "2g",
  maxDisk: "5g",
  ttlMinutes: 30,
  image: "forgeai/sandbox:latest",
} as const;

export const TEMPLATES = {
  blank: {
    name: "Blank Project",
    description: "Start from scratch",
    icon: "file",
  },
  landing: {
    name: "Landing Page",
    description: "Hero, features, pricing, CTA",
    icon: "globe",
  },
  dashboard: {
    name: "Admin Dashboard",
    description: "Sidebar, charts, tables, stats",
    icon: "layout-dashboard",
  },
  saas: {
    name: "SaaS Starter",
    description: "Auth, dashboard, settings, billing",
    icon: "rocket",
  },
  blog: {
    name: "Blog / Portfolio",
    description: "Articles, detail pages, about",
    icon: "book-open",
  },
  ecommerce: {
    name: "E-commerce Store",
    description: "Products, cart, checkout",
    icon: "shopping-cart",
  },
} as const;

export const API_ROUTES = {
  auth: {
    register: "/api/auth/register",
    login: "/api/auth/login",
    refresh: "/api/auth/refresh",
    me: "/api/auth/me",
  },
  projects: {
    list: "/api/projects",
    create: "/api/projects",
    get: (id: string) => `/api/projects/${id}`,
    delete: (id: string) => `/api/projects/${id}`,
    settings: (id: string) => `/api/projects/${id}/settings`,
    deploy: (id: string) => `/api/projects/${id}/deploy`,
    messages: (id: string) => `/api/projects/${id}/messages`,
    stop: (id: string) => `/api/projects/${id}/stop`,
    undo: (id: string) => `/api/projects/${id}/undo`,
    files: (id: string) => `/api/projects/${id}/files`,
    file: (id: string, path: string) => `/api/projects/${id}/files/${path}`,
    preview: (id: string) => `/api/projects/${id}/preview`,
    snapshots: (id: string) => `/api/projects/${id}/snapshots`,
  },
  github: {
    connect: "/api/github/connect",
    disconnect: "/api/github/disconnect",
    status: "/api/github/status",
    export: (id: string) => `/api/github/${id}/export`,
    push: (id: string) => `/api/github/${id}/push`,
    pull: (id: string) => `/api/github/${id}/pull`,
  },
  supabase: {
    connect: "/api/supabase/connect",
    disconnect: "/api/supabase/disconnect",
    status: "/api/supabase/status",
    tables: "/api/supabase/tables",
    generateClient: (id: string) => `/api/supabase/${id}/generate-client`,
    generateTypes: (id: string) => `/api/supabase/${id}/generate-types`,
  },
  billing: {
    usage: "/api/billing/usage",
    upgrade: "/api/billing/upgrade",
    plans: "/api/billing/plans",
  },
  templates: {
    list: "/api/templates",
    get: (id: string) => `/api/templates/${id}`,
  },
} as const;
