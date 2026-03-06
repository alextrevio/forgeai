"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowRight, ArrowDown, Check, Sparkles, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Data ──────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: "\uD83E\uDD16",
    title: "Multi-Agent",
    description:
      "Agentes especializados trabajan en paralelo: Coder, Research, Designer, QA y m\u00e1s.",
  },
  {
    icon: "\u26A1",
    title: "Minutos, no semanas",
    description:
      "De idea a producto funcional. Sin esperas, sin freelancers.",
  },
  {
    icon: "\uD83D\uDD0D",
    title: "Transparencia total",
    description:
      "Ve exactamente qu\u00e9 hace cada agente en tiempo real. Sin cajas negras.",
  },
  {
    icon: "\uD83C\uDF10",
    title: "Todo en el browser",
    description:
      "Sin instalaci\u00f3n, sin CLI, sin configuraci\u00f3n. Abre y empieza a crear.",
  },
  {
    icon: "\uD83D\uDCB0",
    title: "10x m\u00e1s accesible",
    description:
      "Desde $0/mes. 10x m\u00e1s barato que la competencia.",
  },
  {
    icon: "\uD83D\uDD12",
    title: "Enterprise-ready",
    description:
      "Teams, API, audit logs, billing, y m\u00e1s. Listo para escalar.",
  },
];

const AGENTS = [
  {
    icon: "\uD83D\uDCBB",
    name: "Coder",
    description: "Full-stack code, APIs, debugging",
    color: "#3b82f6",
  },
  {
    icon: "\uD83D\uDD0D",
    name: "Research",
    description: "Web search, an\u00e1lisis, reportes",
    color: "#f59e0b",
  },
  {
    icon: "\uD83C\uDFA8",
    name: "Designer",
    description: "UI/UX, design systems, CSS, mockups",
    color: "#8b5cf6",
  },
  {
    icon: "\uD83D\uDCCA",
    name: "Analyst",
    description: "Data viz, insights, estad\u00edsticas",
    color: "#06b6d4",
  },
  {
    icon: "\u270D\uFE0F",
    name: "Writer",
    description: "Content pro, blog, email, SEO",
    color: "#ec4899",
  },
  {
    icon: "\uD83D\uDE80",
    name: "Deploy",
    description: "Hosting, CI/CD, SSL, DNS, monitoring",
    color: "#22c55e",
  },
  {
    icon: "\uD83D\uDD12",
    name: "QA",
    description: "Testing, code review, security audit",
    color: "#ef4444",
  },
];

const PRICING = [
  {
    name: "Gratis",
    price: "$0",
    period: "/mes",
    features: [
      "$10 budget AI/mes",
      "3 proyectos",
      "1 agente simult\u00e1neo",
      "Community support",
    ],
    cta: "Empezar",
    ctaLink: "/register",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/mes",
    features: [
      "$50 budget AI/mes",
      "Proyectos ilimitados",
      "Todos los agentes",
      "Priority support",
    ],
    cta: "Upgrade \u2192",
    ctaLink: "/register",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    features: [
      "Budget ilimitado",
      "Teams & workspaces",
      "API & webhooks",
      "SLA & soporte dedicado",
    ],
    cta: "Contactar",
    ctaLink: "/register",
    highlighted: false,
  },
];

const STEPS = [
  {
    num: "1",
    title: "Describe",
    description: "Escribe qu\u00e9 quieres construir en lenguaje natural.",
    visual: (
      <div className="rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] p-4 font-mono text-sm">
        <span className="text-[#555]">$</span>{" "}
        <span className="text-[#EDEDED]">&quot;Hazme un e-commerce con carrito y checkout&quot;</span>
        <span className="inline-block w-1.5 h-4 bg-[#7c3aed] ml-1 align-middle animate-pulse rounded-sm" />
      </div>
    ),
  },
  {
    num: "2",
    title: "Arya planifica",
    description: "El orquestador crea un plan y asigna agentes.",
    visual: (
      <div className="rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] p-4 text-sm space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[#7c3aed]">\u2714</span>
          <span className="text-[#8888a0]">1. Research competencia</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#7c3aed]">\u2714</span>
          <span className="text-[#8888a0]">2. Design system UI</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded-full border-2 border-[#7c3aed] border-t-transparent animate-spin" />
          <span className="text-[#EDEDED]">3. Code components</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#555]">\u25CB</span>
          <span className="text-[#555]">4. QA & deploy</span>
        </div>
      </div>
    ),
  },
  {
    num: "3",
    title: "Agentes trabajan",
    description: "Agentes especializados ejecutan en paralelo.",
    visual: (
      <div className="rounded-xl border border-[#2A2A2A] bg-[#0A0A0A] p-4 text-sm space-y-2">
        {[
          { emoji: "\uD83D\uDCBB", name: "Coder", status: "escribiendo componentes...", c: "#3b82f6" },
          { emoji: "\uD83C\uDFA8", name: "Designer", status: "aplicando estilos...", c: "#8b5cf6" },
          { emoji: "\uD83D\uDD0D", name: "Research", status: "analizando mercado...", c: "#f59e0b" },
        ].map((a) => (
          <div key={a.name} className="flex items-center gap-2">
            <span>{a.emoji}</span>
            <span className="font-medium" style={{ color: a.c }}>{a.name}</span>
            <span className="text-[#8888a0] text-xs">{a.status}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    num: "4",
    title: "Resultado",
    description: "Tu app lista para deploy en minutos.",
    visual: (
      <div className="rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/5 p-4 text-sm">
        <div className="flex items-center gap-2 text-[#22c55e] font-medium">
          <Check className="h-4 w-4" />
          <span>Proyecto completado</span>
        </div>
        <div className="mt-2 text-xs text-[#8888a0] space-y-1">
          <p>4 agentes \u2022 12 archivos \u2022 47s</p>
          <p className="text-[#22c55e]/80">Preview: app-demo.arya.ai</p>
        </div>
      </div>
    ),
  },
];

// ── Intersection Observer hook ────────────────────────────────

function useInView(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.unobserve(el);
        }
      },
      { threshold: 0.15, ...options }
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, inView };
}

// ── Component ──────────────────────────────────────────────────

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const [navSolid, setNavSolid] = useState(false);
  const lastScrollY = useRef(0);

  // Navbar: hide on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setNavSolid(y > 20);
      if (y > lastScrollY.current && y > 80) {
        setNavVisible(false);
        setMobileMenuOpen(false);
      } else {
        setNavVisible(true);
      }
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Smooth scroll for anchor links
  const scrollTo = useCallback((id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Section observers
  const heroObs = useInView();
  const stepsObs = useInView();
  const featObs = useInView();
  const agentsObs = useInView();
  const pricingObs = useInView();
  const ctaObs = useInView();

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED] overflow-x-hidden">
      {/* ─── Sparkle particles (CSS) ──────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden>
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="landing-particle"
            style={{
              left: `${5 + ((i * 17) % 90)}%`,
              top: `${3 + ((i * 23) % 85)}%`,
              animationDelay: `${(i * 0.7) % 5}s`,
              animationDuration: `${4 + (i % 4)}s`,
            }}
          />
        ))}
      </div>

      {/* ─── Navigation ───────────────────────────────────────── */}
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
          navVisible ? "translate-y-0" : "-translate-y-full",
          navSolid
            ? "bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-[#2A2A2A]/60"
            : "bg-transparent"
        )}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <Sparkles className="h-5 w-5 text-[#7c3aed]" />
              <span className="text-base font-semibold tracking-tight">Arya AI</span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              <button onClick={() => scrollTo("how-it-works")} className="px-3 py-1.5 text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors rounded-lg hover:bg-white/[0.03]">
                Producto
              </button>
              <button onClick={() => scrollTo("pricing")} className="px-3 py-1.5 text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors rounded-lg hover:bg-white/[0.03]">
                Pricing
              </button>
              <Link href="/docs" className="px-3 py-1.5 text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors rounded-lg hover:bg-white/[0.03]">
                Docs
              </Link>
              <Link href="/dashboard" className="px-3 py-1.5 text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors rounded-lg hover:bg-white/[0.03]">
                Hub
              </Link>
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-3">
              <Link href="/login" className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors px-3 py-1.5">
                Login
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white hover:bg-[#6d28d9] transition-all shadow-lg shadow-[#7c3aed]/20 hover:shadow-[#7c3aed]/30"
              >
                Empieza gratis <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Mobile toggle */}
            <button
              className="md:hidden text-[#8888a0] hover:text-[#EDEDED] p-1"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0A0A0A]/95 backdrop-blur-xl border-b border-[#2A2A2A] animate-fade-in">
            <div className="px-5 py-4 space-y-1">
              <button onClick={() => scrollTo("how-it-works")} className="block w-full text-left text-sm text-[#8888a0] hover:text-[#EDEDED] py-2.5 transition-colors">Producto</button>
              <button onClick={() => scrollTo("pricing")} className="block w-full text-left text-sm text-[#8888a0] hover:text-[#EDEDED] py-2.5 transition-colors">Pricing</button>
              <Link href="/docs" className="block text-sm text-[#8888a0] hover:text-[#EDEDED] py-2.5 transition-colors" onClick={() => setMobileMenuOpen(false)}>Docs</Link>
              <Link href="/dashboard" className="block text-sm text-[#8888a0] hover:text-[#EDEDED] py-2.5 transition-colors" onClick={() => setMobileMenuOpen(false)}>Hub</Link>
              <div className="pt-3 border-t border-[#2A2A2A] flex items-center gap-3">
                <Link href="/login" className="text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors" onClick={() => setMobileMenuOpen(false)}>Login</Link>
                <Link href="/register" className="inline-flex items-center gap-1.5 rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white" onClick={() => setMobileMenuOpen(false)}>
                  Empieza gratis <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ─── HERO ─────────────────────────────────────────────── */}
      <section ref={heroObs.ref} className="relative pt-32 pb-24 md:pt-44 md:pb-36 overflow-hidden">
        {/* Background: radial gradient */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,rgba(124,58,237,0.12)_0%,transparent_70%)]" />
        </div>

        <div className={cn(
          "relative max-w-3xl mx-auto px-5 sm:px-8 text-center",
          heroObs.inView ? "animate-landing-hero" : "opacity-0"
        )}>
          {/* Sparkle icon */}
          <div className="flex justify-center mb-6">
            <Sparkles className="h-8 w-8 text-[#7c3aed] animate-sparkle-pulse" />
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
            Tu equipo de{" "}
            <span className="bg-gradient-to-r from-white via-purple-200 to-purple-400 bg-clip-text text-transparent">
              agentes AI
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-[#8888a0] leading-relaxed max-w-xl mx-auto mb-4 font-light">
            De idea a producto en minutos, no semanas.
          </p>
          <p className="text-base text-[#666] max-w-lg mx-auto mb-10 font-light leading-relaxed">
            Describe lo que necesitas. Arya orquesta agentes especializados que investigan,
            dise&ntilde;an, programan y despliegan tu proyecto completo.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-7 py-3 text-base font-semibold text-white hover:bg-[#6d28d9] transition-all shadow-xl shadow-[#7c3aed]/25 hover:shadow-[#7c3aed]/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              Empieza gratis <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              onClick={() => scrollTo("how-it-works")}
              className="inline-flex items-center gap-2 rounded-xl border border-[#2A2A2A] px-7 py-3 text-base font-medium text-[#EDEDED] hover:bg-[#111111] hover:border-[#3A3A3A] transition-all"
            >
              Ver c&oacute;mo funciona <ArrowDown className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────────── */}
      <section id="how-it-works" ref={stepsObs.ref} className="py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <div className={cn(
            "text-center mb-16 transition-all duration-700",
            stepsObs.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <p className="text-sm font-medium text-[#7c3aed] tracking-wider uppercase mb-3">C&oacute;mo funciona</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">De idea a producto en 4 pasos</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((step, i) => (
              <div
                key={step.num}
                className={cn(
                  "group rounded-2xl border border-[#1E1E1E] bg-[#0E0E0E] p-5 transition-all duration-500 hover:border-[#2A2A2A] hover:scale-[1.02]",
                  stepsObs.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
                style={{
                  transitionDelay: stepsObs.inView ? `${i * 120}ms` : "0ms",
                }}
              >
                {/* Step number */}
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#7c3aed]/10 text-[#7c3aed] text-xs font-bold">
                    {step.num}
                  </span>
                  <h3 className="text-sm font-semibold text-[#EDEDED]">{step.title}</h3>
                </div>
                {/* Visual */}
                <div className="mb-4">{step.visual}</div>
                {/* Description */}
                <p className="text-xs text-[#8888a0] leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES GRID ────────────────────────────────────── */}
      <section id="features" ref={featObs.ref} className="py-24 md:py-32">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <div className={cn(
            "text-center mb-16 transition-all duration-700",
            featObs.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <p className="text-sm font-medium text-[#7c3aed] tracking-wider uppercase mb-3">Capacidades</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Todo lo que necesitas para construir</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={cn(
                  "group rounded-2xl border border-[#1E1E1E] bg-[#0E0E0E] p-6 transition-all duration-500 hover:border-[#7c3aed]/20 hover:scale-[1.02]",
                  featObs.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
                style={{
                  transitionDelay: featObs.inView ? `${i * 80}ms` : "0ms",
                }}
              >
                <span className="text-2xl block mb-3">{f.icon}</span>
                <h3 className="text-base font-semibold mb-1.5 text-[#EDEDED]">{f.title}</h3>
                <p className="text-sm text-[#8888a0] leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── AGENTS SHOWCASE ──────────────────────────────────── */}
      <section id="agents" ref={agentsObs.ref} className="py-24 md:py-32 overflow-hidden">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <div className={cn(
            "text-center mb-16 transition-all duration-700",
            agentsObs.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <p className="text-sm font-medium text-[#7c3aed] tracking-wider uppercase mb-3">El equipo</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Agentes especializados</h2>
          </div>

          {/* Scrollable on mobile, grid on desktop */}
          <div className="flex gap-3 overflow-x-auto pb-4 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0 snap-x snap-mandatory scrollbar-none">
            {AGENTS.map((a, i) => (
              <div
                key={a.name}
                className={cn(
                  "group shrink-0 w-[200px] lg:w-auto snap-start rounded-2xl border border-[#1E1E1E] bg-[#0E0E0E] p-5 transition-all duration-500 hover:scale-[1.02]",
                  agentsObs.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
                style={{
                  transitionDelay: agentsObs.inView ? `${i * 60}ms` : "0ms",
                  borderColor: undefined,
                }}
              >
                {/* Icon + accent line */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">{a.icon}</span>
                  <span className="text-sm font-semibold" style={{ color: a.color }}>
                    {a.name}
                  </span>
                </div>
                <p className="text-xs text-[#8888a0] leading-relaxed">{a.description}</p>
                {/* Accent bar */}
                <div
                  className="mt-4 h-0.5 w-8 rounded-full opacity-40 group-hover:w-12 group-hover:opacity-80 transition-all duration-300"
                  style={{ backgroundColor: a.color }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ──────────────────────────────────────────── */}
      <section id="pricing" ref={pricingObs.ref} className="py-24 md:py-32">
        <div className="max-w-4xl mx-auto px-5 sm:px-8">
          <div className={cn(
            "text-center mb-16 transition-all duration-700",
            pricingObs.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <p className="text-sm font-medium text-[#7c3aed] tracking-wider uppercase mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Simple, transparente</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PRICING.map((plan, i) => (
              <div
                key={plan.name}
                className={cn(
                  "relative rounded-2xl p-6 transition-all duration-500 hover:scale-[1.02]",
                  plan.highlighted
                    ? "border-2 border-[#7c3aed] bg-[#0E0E0E] shadow-xl shadow-[#7c3aed]/10"
                    : "border border-[#1E1E1E] bg-[#0E0E0E]",
                  pricingObs.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
                style={{
                  transitionDelay: pricingObs.inView ? `${i * 100}ms` : "0ms",
                }}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#7c3aed] px-3 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                    Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">{plan.name}</h3>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                    {plan.period && <span className="text-[#8888a0] text-sm">{plan.period}</span>}
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <Check className="h-3.5 w-3.5 text-[#7c3aed] shrink-0" />
                      <span className="text-[#8888a0]">{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.ctaLink}
                  className={cn(
                    "block w-full text-center rounded-xl py-2.5 text-sm font-semibold transition-all",
                    plan.highlighted
                      ? "bg-[#7c3aed] text-white hover:bg-[#6d28d9] shadow-lg shadow-[#7c3aed]/20"
                      : "border border-[#2A2A2A] text-[#EDEDED] hover:bg-[#1A1A1A] hover:border-[#3A3A3A]"
                  )}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ────────────────────────────────────────── */}
      <section ref={ctaObs.ref} className="py-24 md:py-32">
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <div className={cn(
            "relative rounded-3xl border border-[#1E1E1E] overflow-hidden transition-all duration-700",
            ctaObs.inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            {/* Gradient background */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#7c3aed]/8 via-[#0E0E0E] to-[#0E0E0E]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(124,58,237,0.12)_0%,transparent_70%)]" />

            <div className="relative text-center px-8 py-16 md:py-20">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                &iquest;Listo para construir con AI?
              </h2>
              <p className="text-[#8888a0] text-base mb-8 max-w-md mx-auto">
                Empieza gratis. Sin tarjeta de cr&eacute;dito.
              </p>
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-8 py-3.5 text-base font-semibold text-white hover:bg-[#6d28d9] transition-all shadow-xl shadow-[#7c3aed]/25 hover:shadow-[#7c3aed]/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                Crear cuenta gratis <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ───────────────────────────────────────────── */}
      <footer className="border-t border-[#1E1E1E] py-16">
        <div className="max-w-5xl mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-[#7c3aed]" />
                <span className="text-sm font-semibold">Arya AI</span>
              </div>
              <p className="text-xs text-[#666] leading-relaxed mb-4">
                Agentes AI que construyen por ti.
              </p>
              <p className="text-xs text-[#444]">&copy; 2026 Arya AI</p>
            </div>

            {/* Producto */}
            <div>
              <h4 className="text-xs font-semibold text-[#8888a0] uppercase tracking-wider mb-4">Producto</h4>
              <ul className="space-y-2.5">
                <li><Link href="/dashboard" className="text-sm text-[#666] hover:text-[#EDEDED] transition-colors">Dashboard</Link></li>
                <li><Link href="/dashboard" className="text-sm text-[#666] hover:text-[#EDEDED] transition-colors">Hub</Link></li>
                <li><Link href="/docs" className="text-sm text-[#666] hover:text-[#EDEDED] transition-colors">Docs</Link></li>
                <li><button onClick={() => scrollTo("pricing")} className="text-sm text-[#666] hover:text-[#EDEDED] transition-colors">Pricing</button></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-xs font-semibold text-[#8888a0] uppercase tracking-wider mb-4">Legal</h4>
              <ul className="space-y-2.5">
                <li><a href="#" className="text-sm text-[#666] hover:text-[#EDEDED] transition-colors">T&eacute;rminos</a></li>
                <li><a href="#" className="text-sm text-[#666] hover:text-[#EDEDED] transition-colors">Privacidad</a></li>
              </ul>
            </div>

            {/* Social */}
            <div>
              <h4 className="text-xs font-semibold text-[#8888a0] uppercase tracking-wider mb-4">Social</h4>
              <ul className="space-y-2.5">
                <li><a href="#" className="text-sm text-[#666] hover:text-[#EDEDED] transition-colors">Twitter</a></li>
                <li><a href="#" className="text-sm text-[#666] hover:text-[#EDEDED] transition-colors">GitHub</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── Landing page CSS ─────────────────────────────────── */}
      <style jsx>{`
        /* Sparkle particles */
        .landing-particle {
          position: absolute;
          width: 2px;
          height: 2px;
          border-radius: 50%;
          background: rgba(124, 58, 237, 0.35);
          animation: particleFade ease-in-out infinite;
        }
        @keyframes particleFade {
          0%, 100% { opacity: 0; transform: scale(0); }
          50% { opacity: 1; transform: scale(1); }
        }

        /* Hero entrance */
        .animate-landing-hero {
          animation: heroEntrance 0.8s ease-out forwards;
        }
        @keyframes heroEntrance {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Hide scrollbar for agents carousel */
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
