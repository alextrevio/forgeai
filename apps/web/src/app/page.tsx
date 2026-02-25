"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Zap,
  Brain,
  Monitor,
  Paintbrush,
  Rocket,
  Github,
  Database,
  MessageSquare,
  Code2,
  ArrowRight,
  Check,
  Sparkles,
  Layout,
  LayoutDashboard,
  CreditCard,
  BookOpen,
  ShoppingCart,
  FileText,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEMO_PROMPTS = [
  "Build a project management dashboard with kanban boards and team analytics",
  "Create a SaaS landing page with pricing, testimonials, and a signup flow",
  "Design an e-commerce store with product listings, cart, and checkout",
];

const DEMO_STEPS = [
  "Planning your app...",
  "Writing components...",
  "Applying design...",
  "Running checks...",
];

const FEATURES = [
  {
    icon: Brain,
    title: "AI-Powered Development",
    description:
      "Describe what you want in plain English. Our AI understands context, best practices, and modern design patterns.",
  },
  {
    icon: Monitor,
    title: "Live Preview",
    description:
      "See your app come to life in real-time. Every change is instantly reflected in a live preview window.",
  },
  {
    icon: Paintbrush,
    title: "Professional Design",
    description:
      "Every app is built with modern UI components, responsive layouts, and polished animations out of the box.",
  },
  {
    icon: Rocket,
    title: "One-Click Deploy",
    description:
      "Deploy your app to production with a single click. Get a live URL instantly with automatic SSL and CDN.",
  },
  {
    icon: Github,
    title: "GitHub Export",
    description:
      "Export your complete codebase to GitHub. Full ownership of your code with clean, maintainable structure.",
  },
  {
    icon: Database,
    title: "Supabase Built-in",
    description:
      "Database, auth, and storage powered by Supabase. No backend setup required - it just works.",
  },
];

const STEPS = [
  {
    icon: MessageSquare,
    title: "Describe your idea",
    description:
      "Tell the AI what you want to build. Be as simple or detailed as you like.",
  },
  {
    icon: Code2,
    title: "AI builds it",
    description:
      "Watch as your app is generated with production-quality code and design.",
  },
  {
    icon: Rocket,
    title: "Deploy & share",
    description:
      "One click to deploy. Share your app with the world in seconds.",
  },
];

const TEMPLATES = [
  {
    icon: FileText,
    name: "Blank",
    description: "Start from scratch with a clean slate",
  },
  {
    icon: Layout,
    name: "Landing Page",
    description: "Marketing page with hero, features, and CTA",
  },
  {
    icon: LayoutDashboard,
    name: "Dashboard",
    description: "Admin panel with charts, tables, and sidebar",
  },
  {
    icon: CreditCard,
    name: "SaaS",
    description: "Full SaaS app with auth, billing, and settings",
  },
  {
    icon: BookOpen,
    name: "Blog",
    description: "Content-driven site with posts and categories",
  },
  {
    icon: ShoppingCart,
    name: "E-commerce",
    description: "Online store with products, cart, and checkout",
  },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "",
    description: "Perfect for trying things out",
    features: [
      "50 credits / month",
      "3 projects",
      "Community support",
      "Basic templates",
    ],
    cta: "Get Started",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$25",
    period: "/mo",
    description: "For serious builders and indie hackers",
    features: [
      "500 credits / month",
      "20 projects",
      "Priority support",
      "GitHub export",
      "Custom domains",
      "All templates",
    ],
    cta: "Start Pro Trial",
    highlighted: true,
  },
  {
    name: "Business",
    price: "$50",
    period: "/mo",
    description: "For teams and agencies",
    features: [
      "2,000 credits / month",
      "100 projects",
      "Dedicated support",
      "Team collaboration",
      "API access",
      "White-label option",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

export default function Home() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [activeSteps, setActiveSteps] = useState<number[]>([]);
  const [isTypingDone, setIsTypingDone] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if user is logged in
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      router.push("/dashboard");
    } else {
      setIsChecking(false);
    }
  }, [router]);

  // Scroll handler for nav
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Typewriter effect
  const startTyping = useCallback(() => {
    const prompt = DEMO_PROMPTS[currentPromptIndex];
    let charIndex = 0;
    setTypedText("");
    setActiveSteps([]);
    setIsTypingDone(false);

    if (typingRef.current) clearInterval(typingRef.current);
    if (stepRef.current) clearInterval(stepRef.current);

    typingRef.current = setInterval(() => {
      if (charIndex < prompt.length) {
        setTypedText(prompt.slice(0, charIndex + 1));
        charIndex++;
      } else {
        if (typingRef.current) clearInterval(typingRef.current);
        setIsTypingDone(true);

        let stepIndex = 0;
        stepRef.current = setInterval(() => {
          if (stepIndex < DEMO_STEPS.length) {
            setActiveSteps((prev) => [...prev, stepIndex]);
            stepIndex++;
          } else {
            if (stepRef.current) clearInterval(stepRef.current);
            setTimeout(() => {
              setCurrentPromptIndex(
                (prev) => (prev + 1) % DEMO_PROMPTS.length
              );
            }, 2000);
          }
        }, 800);
      }
    }, 40);
  }, [currentPromptIndex]);

  useEffect(() => {
    if (isChecking) return;
    startTyping();
    return () => {
      if (typingRef.current) clearInterval(typingRef.current);
      if (stepRef.current) clearInterval(stepRef.current);
    };
  }, [currentPromptIndex, startTyping, isChecking]);

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Zap className="h-8 w-8 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Navigation */}
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          scrolled
            ? "bg-background/80 backdrop-blur-xl border-b border-border"
            : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">ForgeAI</span>
            </div>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                How it Works
              </a>
              <a
                href="#pricing"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Pricing
              </a>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden text-muted-foreground hover:text-foreground"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border">
            <div className="px-4 py-4 space-y-3">
              <a
                href="#features"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                How it Works
              </a>
              <a
                href="#pricing"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </a>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32">
        {/* Background grid pattern */}
        <div className="absolute inset-0 bg-grid-pattern opacity-50" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-sm text-muted-foreground mb-8 animate-fade-in-up">
            <Sparkles className="h-4 w-4 text-primary" />
            Now in public beta
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-in-up animation-delay-200">
            Build apps with AI.
            <br />
            <span className="text-primary">Just describe what you want.</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-up animation-delay-400">
            ForgeAI turns your ideas into production-ready web apps in minutes,
            not weeks. No coding experience required.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-600">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
            >
              Start Building — Free
              <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="#demo"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-base font-medium text-foreground hover:bg-card transition-colors"
            >
              Watch Demo
            </a>
          </div>
        </div>
      </section>

      {/* Demo Section */}
      <section id="demo" className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              See it in action
            </h2>
            <p className="text-muted-foreground text-lg">
              Watch ForgeAI turn a simple prompt into a full application
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-2xl shadow-primary/5">
            {/* Terminal header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="text-xs text-muted-foreground ml-2">
                ForgeAI Terminal
              </span>
            </div>

            <div className="p-6 font-mono text-sm">
              {/* Prompt area */}
              <div className="flex items-start gap-2 mb-6">
                <span className="text-primary font-bold shrink-0">&gt;</span>
                <div>
                  <span className="text-foreground">{typedText}</span>
                  <span
                    className={cn(
                      "inline-block w-2 h-5 bg-primary ml-0.5 align-middle",
                      isTypingDone ? "opacity-0" : "animate-pulse"
                    )}
                  />
                </div>
              </div>

              {/* Steps */}
              {isTypingDone && (
                <div className="space-y-3 pl-4 border-l-2 border-border ml-1">
                  {DEMO_STEPS.map((step, index) => (
                    <div
                      key={step}
                      className={cn(
                        "flex items-center gap-3 transition-all duration-300",
                        activeSteps.includes(index)
                          ? "opacity-100 translate-x-0"
                          : "opacity-0 -translate-x-2"
                      )}
                    >
                      {activeSteps.includes(index) ? (
                        index < activeSteps.length - 1 ||
                        activeSteps.length === DEMO_STEPS.length ? (
                          <Check className="h-4 w-4 text-success shrink-0" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                        )
                      ) : (
                        <div className="h-4 w-4" />
                      )}
                      <span
                        className={cn(
                          "text-sm",
                          activeSteps.includes(index) &&
                            (index < activeSteps.length - 1 ||
                              activeSteps.length === DEMO_STEPS.length)
                            ? "text-success"
                            : "text-muted-foreground"
                        )}
                      >
                        {step}
                      </span>
                    </div>
                  ))}

                  {activeSteps.length === DEMO_STEPS.length && (
                    <div className="pt-2 text-success font-medium animate-fade-in-up">
                      Your app is ready!
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything you need to build
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From idea to production in minutes. ForgeAI handles the heavy
              lifting so you can focus on what matters.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="glass-card rounded-xl p-6 transition-all duration-300 group"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20 md:py-28 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              How it works
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Three simple steps from idea to live application
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Dashed connecting lines (desktop only) */}
            <div className="hidden md:block absolute top-16 left-1/3 right-1/3 h-px border-t-2 border-dashed border-border" />

            {STEPS.map((step, index) => (
              <div key={step.title} className="text-center relative">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6 relative z-10">
                  <step.icon className="h-7 w-7" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                    {index + 1}
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates Section */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Start from a template
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Jump-start your project with pre-built templates designed for
              common use cases
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {TEMPLATES.map((template) => (
              <Link
                href="/register"
                key={template.name}
                className="glass-card rounded-xl p-5 transition-all duration-300 group cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-secondary text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-colors shrink-0">
                    <template.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 group-hover:text-primary transition-colors">
                      {template.name}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {template.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
            >
              Browse all templates
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 md:py-28 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Start free, scale as you grow. No hidden fees, no surprises.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  "rounded-xl p-6 transition-all duration-300 relative",
                  plan.highlighted
                    ? "border-2 border-primary bg-card shadow-xl shadow-primary/10 scale-105"
                    : "border border-border bg-card/50"
                )}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    {plan.description}
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && (
                      <span className="text-muted-foreground">
                        {plan.period}
                      </span>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Check className="h-4 w-4 text-success shrink-0" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={cn(
                    "block w-full text-center rounded-lg py-2.5 text-sm font-medium transition-colors",
                    plan.highlighted
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-border text-foreground hover:bg-card"
                  )}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="rounded-2xl border border-border bg-gradient-to-b from-primary/10 to-card/50 p-12 md:p-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to build something amazing?
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
              Join thousands of makers who are building the future with AI. Start
              for free, no credit card required.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-base font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
            >
              Start Building — Free
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* Logo & tagline */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-5 w-5 text-primary" />
                <span className="text-lg font-bold">ForgeAI</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Turn your ideas into production-ready web apps with the power of
                AI.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold text-sm mb-4">Product</h4>
              <ul className="space-y-2.5">
                <li>
                  <a
                    href="#features"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#pricing"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Pricing
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Templates
                  </a>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h4 className="font-semibold text-sm mb-4">Resources</h4>
              <ul className="space-y-2.5">
                <li>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Docs
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Discord
                  </a>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="font-semibold text-sm mb-4">Company</h4>
              <ul className="space-y-2.5">
                <li>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Blog
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Careers
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Hecho con &#10084;&#65039; por ForgeAI
            </p>
            <p className="text-sm text-muted-foreground">
              &copy; 2026 ForgeAI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
