"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Sparkles,
  Menu,
  X,
  Bot,
  Zap,
  Eye,
  Globe,
  DollarSign,
  Shield,
  Users,
  Star,
  Play,
  ChevronRight,
  Code2,
  Brain,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Data ────────────────────────────────────────────────────

const DEMO_PROMPTS = [
  "Build a project management dashboard with kanban boards",
  "Create a SaaS landing page with pricing and signup flow",
  "Design an analytics dashboard with charts and real-time data",
];

const AGENT_STEPS = [
  { agent: "Planner", action: "Analyzing requirements...", color: "#7c3aed" },
  { agent: "Coder", action: "Writing components...", color: "#3b82f6" },
  { agent: "Designer", action: "Applying styles...", color: "#8b5cf6" },
  { agent: "QA", action: "Running checks...", color: "#22c55e" },
];

const FEATURES = [
  { emoji: "\uD83E\uDD16", title: "Multi-Agent", description: "Agentes especializados trabajan en paralelo — planner, coder, designer, QA — coordinados por un orquestador inteligente." },
  { emoji: "\u26A1", title: "En minutos", description: "De idea a proyecto funcional en minutos, no semanas. Arya entiende contexto y genera codigo production-ready." },
  { emoji: "\uD83D\uDD0D", title: "Transparente", description: "Ve exactamente que hace cada agente en tiempo real. Activity feed, task progress y logs detallados." },
  { emoji: "\uD83C\uDF10", title: "Todo en browser", description: "Sin instalacion, sin CLI, sin configuracion. Editor, terminal, preview y deploy integrados." },
  { emoji: "\uD83D\uDCB0", title: "Accesible", description: "10x mas barato que la competencia. Tracking de costos en tiempo real y spending caps configurables." },
  { emoji: "\uD83D\uDD12", title: "Enterprise", description: "Teams, API publica, webhooks, audit logs, role-based access control y SSO." },
];

const TESTIMONIALS = [
  { name: "Carlos M.", role: "CTO, Startup LATAM", text: "Arya redujo nuestro tiempo de prototipado de semanas a horas. Los agentes realmente entienden lo que necesitas.", avatar: "C" },
  { name: "Ana L.", role: "Indie Hacker", text: "Lance mi SaaS en un fin de semana. El multi-agent system es increible — es como tener un equipo completo.", avatar: "A" },
  { name: "Diego R.", role: "Tech Lead, Enterprise", text: "La API publica y los audit logs nos dieron la confianza para integrar Arya en nuestro workflow de produccion.", avatar: "D" },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "/mes",
    description: "Para explorar y experimentar",
    budget: "$10 USD/mes budget",
    features: ["1 proyecto", "Todos los agentes", "Community support", "Templates basicos"],
    cta: "Empieza gratis",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/mes",
    description: "Para builders serios e indie hackers",
    budget: "$50 USD/mes budget",
    features: ["Proyectos ilimitados", "Todos los agentes", "Priority support", "GitHub export", "Custom domains", "API access"],
    cta: "Comenzar Pro",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Para equipos y empresas",
    budget: "Budget ilimitado",
    features: ["Todo en Pro", "Team workspaces", "API + Webhooks", "Audit logs", "SSO & RBAC", "Soporte dedicado"],
    cta: "Contactar ventas",
    highlighted: false,
  },
];

// ── Component ───────────────────────────────────────────────

export default function Home() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [typedText, setTypedText] = useState("");
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [activeAgents, setActiveAgents] = useState<number[]>([]);
  const [isTypingDone, setIsTypingDone] = useState(false);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scroll handler
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Typewriter + agent steps
  const startTyping = useCallback(() => {
    const prompt = DEMO_PROMPTS[currentPromptIndex];
    let charIndex = 0;
    setTypedText("");
    setActiveAgents([]);
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
          if (stepIndex < AGENT_STEPS.length) {
            setActiveAgents((prev) => [...prev, stepIndex]);
            stepIndex++;
          } else {
            if (stepRef.current) clearInterval(stepRef.current);
            setTimeout(() => setCurrentPromptIndex((prev) => (prev + 1) % DEMO_PROMPTS.length), 2500);
          }
        }, 900);
      }
    }, 35);
  }, [currentPromptIndex]);

  useEffect(() => {
    startTyping();
    return () => {
      if (typingRef.current) clearInterval(typingRef.current);
      if (stepRef.current) clearInterval(stepRef.current);
    };
  }, [currentPromptIndex, startTyping]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED] overflow-x-hidden">
      {/* ─── Navigation ─────────────────────────────────────── */}
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled ? "bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-[#2A2A2A]" : "bg-transparent"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-[#7c3aed]" />
              <span className="text-lg font-bold">Arya AI</span>
            </div>

            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">Features</a>
              <a href="#demo" className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">Demo</a>
              <a href="#pricing" className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">Pricing</a>
              <Link href="/docs" className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">API Docs</Link>
              <Link href="/login" className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">Login</Link>
              <Link href="/register"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors shadow-lg shadow-[#7c3aed]/20">
                Empieza gratis <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <button className="md:hidden text-[#8888a0] hover:text-[#EDEDED]" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-[#2A2A2A]">
            <div className="px-4 py-4 space-y-3">
              <a href="#features" className="block text-sm text-[#8888a0] hover:text-[#EDEDED]" onClick={() => setMobileMenuOpen(false)}>Features</a>
              <a href="#demo" className="block text-sm text-[#8888a0] hover:text-[#EDEDED]" onClick={() => setMobileMenuOpen(false)}>Demo</a>
              <a href="#pricing" className="block text-sm text-[#8888a0] hover:text-[#EDEDED]" onClick={() => setMobileMenuOpen(false)}>Pricing</a>
              <Link href="/docs" className="block text-sm text-[#8888a0] hover:text-[#EDEDED]" onClick={() => setMobileMenuOpen(false)}>API Docs</Link>
              <Link href="/login" className="block text-sm text-[#8888a0] hover:text-[#EDEDED]" onClick={() => setMobileMenuOpen(false)}>Login</Link>
              <Link href="/register" className="inline-flex items-center gap-1.5 rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white" onClick={() => setMobileMenuOpen(false)}>
                Empieza gratis <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ─── Hero Section ────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(124,58,237,0.15)_0%,transparent_70%)]" />
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#7c3aed]/10 rounded-full blur-[128px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#3b82f6]/10 rounded-full blur-[128px] animate-pulse" style={{ animationDelay: "1s" }} />
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-[#7c3aed]/40 rounded-full"
              style={{
                left: `${15 + i * 15}%`,
                top: `${20 + (i % 3) * 25}%`,
                animation: `float ${3 + i * 0.5}s ease-in-out infinite`,
                animationDelay: `${i * 0.4}s`,
              }}
            />
          ))}
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-4 py-1.5 text-sm text-[#a78bfa] mb-8 animate-fade-in-up">
            <Sparkles className="h-4 w-4" />
            Nuevo: API publica + Webhooks + Teams
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            Tu equipo de{" "}
            <span className="bg-gradient-to-r from-[#7c3aed] via-[#8b5cf6] to-[#3b82f6] bg-clip-text text-transparent">
              agentes AI
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-[#8888a0] max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
            Describe lo que necesitas. Arya orquesta agentes especializados para
            entregar tu proyecto completo — de idea a produccion.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
            <Link href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-8 py-3.5 text-base font-semibold text-white hover:bg-[#6d28d9] transition-all shadow-xl shadow-[#7c3aed]/25 hover:shadow-[#7c3aed]/40 hover:scale-[1.02]">
              Empieza gratis <ArrowRight className="h-5 w-5" />
            </Link>
            <a href="#demo"
              className="inline-flex items-center gap-2 rounded-xl border border-[#2A2A2A] px-8 py-3.5 text-base font-medium text-[#EDEDED] hover:bg-[#111111] hover:border-[#7c3aed]/30 transition-all">
              <Play className="h-4 w-4" /> Ver demo
            </a>
          </div>

          {/* Agent badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-12 animate-fade-in-up" style={{ animationDelay: "0.5s" }}>
            {["Planner", "Coder", "Designer", "Researcher", "QA", "Deploy"].map((agent, i) => (
              <span key={agent} className="inline-flex items-center gap-1.5 rounded-full border border-[#2A2A2A] bg-[#111111]/80 px-3 py-1 text-xs text-[#8888a0]"
                style={{ animationDelay: `${0.6 + i * 0.1}s` }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#7c3aed]" style={{ opacity: 0.4 + i * 0.1 }} />
                {agent}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Demo Section ─────────────────────────────────────── */}
      <section id="demo" className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Mira los agentes en accion</h2>
            <p className="text-[#8888a0] text-lg">Arya coordina multiples agentes especializados para construir tu proyecto</p>
          </div>

          {/* Terminal mock */}
          <div className="rounded-2xl border border-[#2A2A2A] bg-[#111111] overflow-hidden shadow-2xl shadow-[#7c3aed]/5">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2A2A2A] bg-[#0A0A0A]">
              <div className="w-3 h-3 rounded-full bg-[#ef4444]/60" />
              <div className="w-3 h-3 rounded-full bg-[#f59e0b]/60" />
              <div className="w-3 h-3 rounded-full bg-[#22c55e]/60" />
              <div className="flex-1 flex justify-center">
                <span className="text-xs text-[#8888a0] bg-[#111111] rounded-md px-3 py-0.5">Arya Engine</span>
              </div>
            </div>

            <div className="p-6 md:p-8 font-mono text-sm min-h-[280px]">
              {/* User prompt */}
              <div className="flex items-start gap-3 mb-6">
                <span className="shrink-0 text-[#7c3aed] font-bold text-xs bg-[#7c3aed]/10 rounded px-1.5 py-0.5">YOU</span>
                <div>
                  <span className="text-[#EDEDED]">{typedText}</span>
                  <span className={cn("inline-block w-2 h-5 bg-[#7c3aed] ml-0.5 align-middle rounded-sm", isTypingDone ? "opacity-0" : "animate-pulse")} />
                </div>
              </div>

              {/* Agent steps */}
              {isTypingDone && (
                <div className="space-y-3 ml-2">
                  {AGENT_STEPS.map((step, index) => (
                    <div
                      key={step.agent}
                      className={cn("flex items-center gap-3 transition-all duration-500", activeAgents.includes(index) ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4")}
                    >
                      {activeAgents.includes(index) ? (
                        index < activeAgents.length - 1 || activeAgents.length === AGENT_STEPS.length ? (
                          <Check className="h-4 w-4 shrink-0" style={{ color: step.color }} />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-t-transparent animate-spin shrink-0" style={{ borderColor: step.color, borderTopColor: "transparent" }} />
                        )
                      ) : <div className="h-4 w-4" />}
                      <span className="text-xs font-bold rounded px-1.5 py-0.5" style={{ color: step.color, backgroundColor: step.color + "15" }}>{step.agent}</span>
                      <span className={cn("text-sm", activeAgents.includes(index) && (index < activeAgents.length - 1 || activeAgents.length === AGENT_STEPS.length) ? "text-[#8888a0]" : "text-[#8888a0]/60")}>
                        {step.action}
                      </span>
                    </div>
                  ))}

                  {activeAgents.length === AGENT_STEPS.length && (
                    <div className="pt-3 flex items-center gap-2 text-[#22c55e] font-medium animate-fade-in-up">
                      <Check className="h-5 w-5" />
                      Proyecto listo — 4 agentes, 12 archivos, 47s
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Grid ────────────────────────────────────── */}
      <section id="features" className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Todo lo que necesitas para construir</h2>
            <p className="text-[#8888a0] text-lg max-w-2xl mx-auto">
              Arya combina multiples agentes AI con herramientas de desarrollo integradas para entregar proyectos completos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature) => (
              <div key={feature.title}
                className="rounded-2xl border border-[#2A2A2A] bg-[#111111] p-6 transition-all duration-300 hover:border-[#7c3aed]/30 hover:bg-[#111111]/80 group">
                <span className="text-3xl mb-4 block">{feature.emoji}</span>
                <h3 className="text-lg font-semibold mb-2 text-[#EDEDED]">{feature.title}</h3>
                <p className="text-sm text-[#8888a0] leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Social Proof ─────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-[#111111]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm text-[#7c3aed] font-medium mb-2">CONFIANZA DE LA COMUNIDAD</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Usado por developers en LATAM y el mundo</h2>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
            {[
              { value: "2,500+", label: "Developers" },
              { value: "15,000+", label: "Proyectos creados" },
              { value: "4.8/5", label: "Satisfaccion" },
              { value: "<60s", label: "Tiempo promedio" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] bg-clip-text text-transparent">{stat.value}</p>
                <p className="text-sm text-[#8888a0] mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Testimonials */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-2xl border border-[#2A2A2A] bg-[#111111] p-6">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-[#f59e0b] text-[#f59e0b]" />
                  ))}
                </div>
                <p className="text-sm text-[#EDEDED] leading-relaxed mb-4">&ldquo;{t.text}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-[#7c3aed]/20 flex items-center justify-center text-sm font-bold text-[#7c3aed]">{t.avatar}</div>
                  <div>
                    <p className="text-sm font-medium text-[#EDEDED]">{t.name}</p>
                    <p className="text-xs text-[#8888a0]">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it Works ─────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Como funciona</h2>
            <p className="text-[#8888a0] text-lg">Tres pasos de idea a proyecto en produccion</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-20 left-[calc(33.33%+1rem)] right-[calc(33.33%+1rem)] h-px border-t-2 border-dashed border-[#2A2A2A]" />
            {[
              { icon: Brain, title: "Describe tu idea", desc: "Escribe en lenguaje natural lo que quieres construir. Arya entiende el contexto." },
              { icon: Cpu, title: "Los agentes trabajan", desc: "Multiples agentes especializados colaboran en paralelo para construir tu proyecto." },
              { icon: Globe, title: "Deploy y comparte", desc: "Un click para deployar. Comparte tu app con el mundo en segundos." },
            ].map((step, index) => (
              <div key={step.title} className="text-center relative">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7c3aed]/20 to-[#3b82f6]/20 mb-6 relative z-10">
                  <step.icon className="h-7 w-7 text-[#7c3aed]" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-[#7c3aed] text-white text-xs font-bold flex items-center justify-center">{index + 1}</div>
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-[#8888a0] text-sm max-w-xs mx-auto">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing Section ──────────────────────────────────── */}
      <section id="pricing" className="py-20 md:py-28 bg-[#111111]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Precios simples y transparentes</h2>
            <p className="text-[#8888a0] text-lg max-w-2xl mx-auto">Empieza gratis, escala cuando lo necesites. Sin costos ocultos.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING.map((plan) => (
              <div key={plan.name} className={cn(
                "rounded-2xl p-6 md:p-8 transition-all duration-300 relative",
                plan.highlighted
                  ? "border-2 border-[#7c3aed] bg-[#111111] shadow-xl shadow-[#7c3aed]/10 md:scale-105"
                  : "border border-[#2A2A2A] bg-[#111111]/50"
              )}>
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#7c3aed] px-4 py-0.5 text-xs font-semibold text-white">POPULAR</div>
                )}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-1">{plan.name}</h3>
                  <p className="text-[#8888a0] text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && <span className="text-[#8888a0]">{plan.period}</span>}
                  </div>
                  <p className="text-xs text-[#7c3aed] mt-2">{plan.budget}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-[#22c55e] shrink-0" />
                      <span className="text-[#8888a0]">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link href="/register" className={cn(
                  "block w-full text-center rounded-xl py-3 text-sm font-semibold transition-all",
                  plan.highlighted
                    ? "bg-[#7c3aed] text-white hover:bg-[#6d28d9] shadow-lg shadow-[#7c3aed]/20"
                    : "border border-[#2A2A2A] text-[#EDEDED] hover:bg-[#1A1A1A] hover:border-[#7c3aed]/30"
                )}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="rounded-3xl border border-[#2A2A2A] bg-gradient-to-b from-[#7c3aed]/10 via-[#111111] to-[#111111] p-12 md:p-16 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(124,58,237,0.15)_0%,transparent_60%)]" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Listo para construir algo increible?</h2>
              <p className="text-[#8888a0] text-lg mb-8 max-w-xl mx-auto">
                Unite a miles de developers que estan construyendo el futuro con AI. Gratis, sin tarjeta de credito.
              </p>
              <Link href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-8 py-3.5 text-base font-semibold text-white hover:bg-[#6d28d9] transition-all shadow-xl shadow-[#7c3aed]/25 hover:shadow-[#7c3aed]/40 hover:scale-[1.02]">
                Empieza gratis <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-[#2A2A2A] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-5 w-5 text-[#7c3aed]" />
                <span className="text-lg font-bold">Arya AI</span>
              </div>
              <p className="text-sm text-[#8888a0] leading-relaxed">
                Tu equipo de agentes AI para construir proyectos completos.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-4">Producto</h4>
              <ul className="space-y-2.5">
                <li><a href="#features" className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">Pricing</a></li>
                <li><Link href="/dashboard" className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">Dashboard</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-4">Developers</h4>
              <ul className="space-y-2.5">
                <li><Link href="/docs" className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">API Docs</Link></li>
                <li><a href="#" className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">GitHub</a></li>
                <li><a href="#" className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">Status</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-4">Empresa</h4>
              <ul className="space-y-2.5">
                <li><a href="#" className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">About</a></li>
                <li><a href="#" className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">Blog</a></li>
                <li><a href="#" className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors">Contacto</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-[#2A2A2A] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-[#8888a0]">&copy; 2026 Arya AI. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-xs text-[#8888a0] hover:text-[#EDEDED] transition-colors">Privacy</a>
              <a href="#" className="text-xs text-[#8888a0] hover:text-[#EDEDED] transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Float animation keyframe */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); opacity: 0.4; }
          50% { transform: translateY(-20px); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
