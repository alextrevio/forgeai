import { Router, Response } from "express";
import type { Router as RouterType } from "express";
import { AuthRequest } from "../middleware/auth";

export const templateRouter: RouterType = Router();

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  framework: string;
  initialPrompt: string;
  thumbnail: string;
}

const TEMPLATES: ProjectTemplate[] = [
  {
    id: "blank",
    name: "Blank Project",
    description: "Start from scratch with a clean React + Vite + Tailwind setup",
    framework: "react-vite",
    initialPrompt: "",
    thumbnail: "blank",
  },
  {
    id: "landing",
    name: "Landing Page",
    description: "Modern landing page with hero, features, pricing, and CTA sections",
    framework: "react-vite",
    initialPrompt: "Create a modern, professional landing page with: 1) A hero section with gradient background, headline, subtitle, and CTA button, 2) A features section with 3 feature cards with icons, 3) A pricing section with 3 tiers (Free, Pro, Enterprise), 4) A testimonials section with 3 cards, 5) A footer with links and social icons. Use a modern color scheme with purple/blue gradients. Make it fully responsive.",
    thumbnail: "landing",
  },
  {
    id: "dashboard",
    name: "Admin Dashboard",
    description: "Full admin dashboard with sidebar, charts, tables, and stat cards",
    framework: "react-vite",
    initialPrompt: "Create a full admin dashboard with: 1) A collapsible sidebar with navigation links (Dashboard, Users, Products, Orders, Analytics, Settings), 2) A top header with search, notifications bell, and user avatar, 3) Main content area with: 4 stat cards (Total Users, Revenue, Orders, Growth) with icons, a line chart showing revenue over time, a bar chart showing orders by category, a data table with recent orders (columns: ID, Customer, Product, Amount, Status, Date) with pagination. Use a clean dark sidebar with white content area design. Add react-router-dom for navigation.",
    thumbnail: "dashboard",
  },
  {
    id: "saas",
    name: "SaaS Starter",
    description: "SaaS template with auth pages, dashboard, settings, and billing",
    framework: "react-vite",
    initialPrompt: "Create a SaaS starter app with: 1) Login page with email/password form and social login buttons, 2) Register page with name, email, password fields, 3) Dashboard page with welcome message and quick action cards, 4) Settings page with profile form (name, email, avatar), 5) Billing page with current plan display, plan comparison cards, and usage stats, 6) A top navigation bar with logo, nav links, and user dropdown. Use react-router-dom for routing. Store auth state in a simple context. Use a clean, professional design with indigo as primary color.",
    thumbnail: "saas",
  },
  {
    id: "blog",
    name: "Blog / Portfolio",
    description: "Personal blog with article listing, detail pages, and about section",
    framework: "react-vite",
    initialPrompt: "Create a personal blog/portfolio site with: 1) Home page with hero section showing name, title, and short bio, 2) Blog listing page with article cards (title, excerpt, date, read time, cover image placeholder), 3) Blog detail page with full article content, author info, and share buttons, 4) About page with bio, skills, and timeline, 5) Navigation with smooth transitions. Use react-router-dom. Include at least 3 sample blog posts with realistic content. Use a clean, minimal design with serif fonts for headings.",
    thumbnail: "blog",
  },
  {
    id: "ecommerce",
    name: "E-commerce Store",
    description: "Online store with product grid, cart, and checkout flow",
    framework: "react-vite",
    initialPrompt: "Create an e-commerce store with: 1) Product listing page with grid of product cards (image placeholder, name, price, rating stars, add to cart button), filterable by category, 2) Product detail page with large image, description, size/color selectors, quantity, add to cart, 3) Shopping cart sidebar/page with items list, quantity controls, subtotal, and checkout button, 4) Simple checkout form with shipping info and order summary, 5) Navigation with cart icon showing item count. Use react-router-dom and zustand for cart state. Include at least 8 sample products across 3 categories.",
    thumbnail: "ecommerce",
  },
];

// Get all templates
templateRouter.get("/", async (_req: AuthRequest, res: Response) => {
  return res.json(TEMPLATES);
});

// Get single template
templateRouter.get("/:id", async (req: AuthRequest, res: Response) => {
  const template = TEMPLATES.find((t) => t.id === req.params.id);
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }
  return res.json(template);
});
