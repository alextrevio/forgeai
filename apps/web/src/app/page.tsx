"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Zap,
  Brain,
  Monitor,
  Rocket,
  Github,
  Database,
  ArrowRight,
  Check,
  Sparkles,
  MessageSquare,
  Code2,
  Play,
  Twitter,
  Menu,
  X,
  Star,
  Globe,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Data ──────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Brain,
    title: "Generación full-stack",
    description:
      "Describe tu idea en español o inglés. Arya genera frontend, backend y base de datos con código limpio y producción-ready.",
  },
  {
    icon: Monitor,
    title: "Preview en tiempo real",
    description:
      "Ve tu app cobrar vida mientras se construye. Cada cambio se refleja al instante en una preview interactiva.",
  },
  {
    icon: Rocket,
    title: "Deploy con un click",
    description:
      "Despliega a producción con un solo click. URL en vivo con SSL automático, CDN global y dominio personalizable.",
  },
  {
    icon: Github,
    title: "Export a GitHub",
    description:
      "Tu código, tu propiedad. Exporta el proyecto completo a GitHub con estructura limpia y mantenible.",
  },
  {
    icon: Database,
    title: "Supabase integrado",
    description:
      "Base de datos, autenticación y storage listos para usar. Sin configuración de backend — simplemente funciona.",
  },
  {
    icon: Shield,
    title: "Código seguro",
    description:
      "Revisión automática de seguridad, mejores prácticas y patrones modernos aplicados en cada línea generada.",
  },
];

const STEPS = [
  {
    icon: MessageSquare,
    num: "01",
    title: "Describe tu idea",
    description:
      "Escribe lo que necesitas en lenguaje natural. Sé tan simple o detallado como quieras.",
  },
  {
    icon: Code2,
    num: "02",
    title: "Arya lo construye",
    description:
      "Observa cómo tu app se genera con código de producción, diseño profesional y arquitectura moderna.",
  },
  {
    icon: Rocket,
    num: "03",
    title: "Despliega y comparte",
    description:
      "Un click para publicar. Comparte tu app con el mundo en segundos con una URL permanente.",
  },
];

const TESTIMONIALS = [
  {
    quote: "Construí mi SaaS en una tarde. Lo que antes tomaba semanas ahora son minutos.",
    author: "María G.",
    role: "Indie Hacker",
    avatar: "MG",
  },
  {
    quote: "La calidad del código generado es impresionante. Listo para producción desde el primer momento.",
    author: "Carlos R.",
    role: "Senior Developer",
    avatar: "CR",
  },
  {
    quote: "Mis clientes no pueden creer la velocidad. Entrego prototipos funcionales en la primera reunión.",
    author: "Ana P.",
    role: "Product Designer",
    avatar: "AP",
  },
];

const DEMO_PROMPTS = [
  "Crea un dashboard de analytics con gráficas interactivas y métricas en tiempo real",
  "Construye un e-commerce con catálogo, carrito y flujo de checkout completo",
  "Diseña una landing page SaaS con pricing, testimonials y signup flow",
];

const DEMO_STEPS = [
  "Planificando tu app...",
  "Generando componentes...",
  "Aplicando diseño...",
  "Ejecutando verificaciones...",
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "",
    description: "Para probar y explorar",
    features: [
      "50 créditos / mes",
      "3 proyectos",
      "Templates básicos",
      "Soporte comunidad",
    ],
    cta: "Empieza gratis",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$25",
    period: "/mes",
    description: "Para builders e indie hackers",
    features: [
      "500 créditos / mes",
      "20 proyectos",
      "GitHub export",
      "Dominios personalizados",
      "Soporte prioritario",
      "Todos los templates",
    ],
    cta: "Iniciar Pro",
    highlighted: true,
  },
  {
    name: "Business",
    price: "$50",
    period: "/mes",
    description: "Para equipos y agencias",
    features: [
      "2,000 créditos / mes",
      "100 proyectos",
      "Colaboración en equipo",
      "API access",
      "Soporte dedicado",
      "White-label",
    ],
    cta: "Contactar ventas",
    highlighted: false,
  },
];

// ─── Scroll Reveal Hook ────────────────────────────────────────

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}

// ─── Smooth Scroll ─────────────────────────────────────────────

function smoothScrollTo(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Page Component ────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Demo typewriter
  const [typedText, setTypedText] = useState("");
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [activeSteps, setActiveSteps] = useState<number[]>([]);
  const [isTypingDone, setIsTypingDone] = useState(false);
  const typingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Parallax for hero
  const [scrollY, setScrollY] = useState(0);

  // Auth check
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      router.push("/dashboard");
    } else {
      setIsChecking(false);
    }
  }, [router]);

  // Scroll + parallax
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Typewriter
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
              setCurrentPromptIndex((prev) => (prev + 1) % DEMO_PROMPTS.length);
            }, 2500);
          }
        }, 800);
      }
    }, 35);
  }, [currentPromptIndex]);

  useEffect(() => {
    if (isChecking) return;
    startTyping();
    return () => {
      if (typingRef.current) clearInterval(typingRef.current);
      if (stepRef.current) clearInterval(stepRef.current);
    };
  }, [currentPromptIndex, startTyping, isChecking]);

  // Section reveal hooks
  const socialProof = useScrollReveal();
  const featuresSection = useScrollReveal();
  const demoSection = useScrollReveal();
  const stepsSection = useScrollReveal();
  const testimonialsSection = useScrollReveal();
  const pricingSection = useScrollReveal();
  const ctaSection = useScrollReveal();

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0A]">
        <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] flex items-center justify-center animate-pulse">
          <Zap className="h-5 w-5 text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED] overflow-x-hidden">
      {/* ─── Navigation ─── */}
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500",
          scrolled
            ? "bg-[#0A0A0A]/80 backdrop-blur-2xl border-b border-[#2A2A2A]/60"
            : "bg-transparent"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] flex items-center justify-center">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <span className="text-[16px] font-bold tracking-tight">Arya AI</span>
            </div>

            {/* Desktop */}
            <div className="hidden md:flex items-center gap-8">
              {[
                { label: "Features", id: "features" },
                { label: "Demo", id: "demo" },
                { label: "Pricing", id: "pricing" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => smoothScrollTo(item.id)}
                  className="text-[13px] text-[#8888a0] hover:text-[#EDEDED] transition-colors"
                >
                  {item.label}
                </button>
              ))}
              <Link
                href="/login"
                className="text-[13px] text-[#8888a0] hover:text-[#EDEDED] transition-colors"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#7c3aed] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#6d28d9] transition-all duration-200 shadow-lg shadow-[#7c3aed]/20 hover:shadow-[#7c3aed]/30 hover:scale-[1.02] active:scale-[0.98]"
              >
                Empieza gratis
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Mobile */}
            <button
              className="md:hidden text-[#8888a0] hover:text-[#EDEDED]"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0A0A0A]/95 backdrop-blur-2xl border-b border-[#2A2A2A]">
            <div className="px-4 py-4 space-y-3">
              {["features", "demo", "pricing"].map((id) => (
                <button
                  key={id}
                  onClick={() => { smoothScrollTo(id); setMobileMenuOpen(false); }}
                  className="block text-sm text-[#8888a0] hover:text-[#EDEDED] transition-colors capitalize"
                >
                  {id}
                </button>
              ))}
              <Link href="/login" className="block text-sm text-[#8888a0] hover:text-[#EDEDED]">
                Iniciar sesión
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white"
              >
                Empieza gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* ─── Hero Section ─── */}
      <section className="relative pt-32 pb-24 md:pt-48 md:pb-36 overflow-hidden">
        {/* Radial gradient background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(124,58,237,0.12) 0%, transparent 70%)",
            transform: `translateY(${scrollY * 0.15}px)`,
          }}
        />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 bg-grid-pattern opacity-30 pointer-events-none"
          style={{ transform: `translateY(${scrollY * 0.05}px)` }}
        />
        {/* Glow orbs */}
        <div
          className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full opacity-[0.04] pointer-events-none"
          style={{
            background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)",
            transform: `translateY(${scrollY * 0.1}px)`,
          }}
        />
        <div
          className="absolute top-40 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.03] pointer-events-none"
          style={{
            background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)",
            transform: `translateY(${scrollY * 0.08}px)`,
          }}
        />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2A2A2A] bg-[#111111]/60 backdrop-blur-sm px-4 py-1.5 text-[13px] text-[#8888a0] mb-8 animate-fade-in-up">
            <Sparkles className="h-3.5 w-3.5 text-[#7c3aed]" />
            Ahora en beta pública
            <span className="h-1 w-1 rounded-full bg-[#22c55e]" />
          </div>

          {/* Main heading */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-6 animate-fade-in-up animation-delay-200">
            Convierte ideas
            <br />
            <span className="landing-gradient-text">en apps</span>
          </h1>

          {/* Subheading */}
          <p className="text-lg sm:text-xl text-[#8888a0] max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up animation-delay-400">
            Describe lo que necesitas. Arya AI lo construye en minutos.
            <br className="hidden sm:block" />
            Full-stack, con diseño profesional, listo para producción.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up animation-delay-600">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-8 py-3.5 text-[15px] font-semibold text-white transition-all duration-300 shadow-[0_0_30px_rgba(124,58,237,0.3)] hover:shadow-[0_0_50px_rgba(124,58,237,0.45)] hover:bg-[#6d28d9] hover:scale-[1.03] active:scale-[0.98]"
            >
              Empieza gratis
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <button
              onClick={() => smoothScrollTo("demo")}
              className="inline-flex items-center gap-2 rounded-xl border border-[#2A2A2A] bg-transparent px-8 py-3.5 text-[15px] font-medium text-[#EDEDED] hover:bg-[#111111] hover:border-[#3A3A3A] transition-all duration-200"
            >
              <Play className="h-4 w-4 text-[#7c3aed]" />
              Ver demo
            </button>
          </div>
        </div>
      </section>

      {/* ─── Social Proof ─── */}
      <section
        ref={socialProof.ref}
        className={cn(
          "py-12 border-y border-[#2A2A2A]/40 bg-[#0A0A0A]",
          "landing-reveal",
          socialProof.isVisible && "landing-reveal-visible"
        )}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
            {/* Avatar stack */}
            <div className="flex items-center">
              <div className="flex -space-x-2.5">
                {["MG", "CR", "AP", "LS", "DR"].map((initials, i) => (
                  <div
                    key={initials}
                    className="h-9 w-9 rounded-full border-2 border-[#0A0A0A] bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ zIndex: 5 - i }}
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <div className="ml-3.5">
                <div className="flex items-center gap-0.5 mb-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-[#f59e0b] text-[#f59e0b]" />
                  ))}
                </div>
                <p className="text-[12px] text-[#8888a0]">
                  <span className="text-[#EDEDED] font-semibold">2,400+</span> desarrolladores confían en Arya
                </p>
              </div>
            </div>

            {/* Separator */}
            <div className="hidden sm:block h-8 w-px bg-[#2A2A2A]" />

            {/* Stats */}
            <div className="flex items-center gap-8">
              {[
                { value: "10K+", label: "apps creadas" },
                { value: "99.9%", label: "uptime" },
                { value: "<30s", label: "tiempo deploy" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-[18px] font-bold text-[#EDEDED]">{stat.value}</p>
                  <p className="text-[11px] text-[#4a4a5e]">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Demo Section ─── */}
      <section
        id="demo"
        ref={demoSection.ref}
        className={cn(
          "py-24 md:py-32",
          "landing-reveal",
          demoSection.isVisible && "landing-reveal-visible"
        )}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-[13px] font-semibold text-[#7c3aed] uppercase tracking-widest mb-3">Demo en vivo</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Mira cómo funciona
            </h2>
            <p className="text-[#8888a0] text-lg max-w-xl mx-auto">
              Un prompt. Una app completa. En minutos.
            </p>
          </div>

          {/* Mock browser */}
          <div className="rounded-2xl border border-[#2A2A2A] bg-[#111111] overflow-hidden shadow-2xl shadow-[#7c3aed]/5 landing-stagger-1">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2A2A2A] bg-[#0E0E0E]">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]/60" />
                <div className="w-3 h-3 rounded-full bg-[#f59e0b]/60" />
                <div className="w-3 h-3 rounded-full bg-[#22c55e]/60" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="flex items-center gap-2 rounded-lg bg-[#0A0A0A] border border-[#2A2A2A] px-4 py-1.5 text-[12px] text-[#4a4a5e] min-w-[260px]">
                  <Globe className="h-3 w-3" />
                  arya.ai/workspace
                </div>
              </div>
              <div className="w-[52px]" />
            </div>

            {/* Terminal body */}
            <div className="p-6 md:p-8 font-mono text-sm min-h-[280px]">
              {/* Prompt */}
              <div className="flex items-start gap-3 mb-6">
                <span className="text-[#7c3aed] font-bold shrink-0 mt-0.5">&#10095;</span>
                <div className="flex-1">
                  <span className="text-[#EDEDED]">{typedText}</span>
                  <span
                    className={cn(
                      "inline-block w-[2px] h-5 bg-[#7c3aed] ml-0.5 align-middle rounded-full",
                      isTypingDone ? "opacity-0" : "animate-pulse"
                    )}
                  />
                </div>
              </div>

              {/* Steps */}
              {isTypingDone && (
                <div className="space-y-3 pl-5 border-l-2 border-[#2A2A2A] ml-1.5">
                  {DEMO_STEPS.map((step, index) => (
                    <div
                      key={step}
                      className={cn(
                        "flex items-center gap-3 transition-all duration-400",
                        activeSteps.includes(index)
                          ? "opacity-100 translate-x-0"
                          : "opacity-0 -translate-x-3"
                      )}
                    >
                      {activeSteps.includes(index) ? (
                        index < activeSteps.length - 1 || activeSteps.length === DEMO_STEPS.length ? (
                          <Check className="h-4 w-4 text-[#22c55e] shrink-0" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-[#7c3aed] border-t-transparent animate-spin shrink-0" />
                        )
                      ) : (
                        <div className="h-4 w-4" />
                      )}
                      <span className={cn(
                        "text-[13px]",
                        activeSteps.includes(index) && (index < activeSteps.length - 1 || activeSteps.length === DEMO_STEPS.length)
                          ? "text-[#22c55e]"
                          : "text-[#8888a0]"
                      )}>
                        {step}
                      </span>
                    </div>
                  ))}

                  {activeSteps.length === DEMO_STEPS.length && (
                    <div className="pt-3 flex items-center gap-2 animate-fade-in-up">
                      <Sparkles className="h-4 w-4 text-[#7c3aed]" />
                      <span className="text-[#7c3aed] font-semibold text-[13px]">
                        ¡Tu app está lista!
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section
        id="features"
        ref={featuresSection.ref}
        className={cn(
          "py-24 md:py-32",
          "landing-reveal",
          featuresSection.isVisible && "landing-reveal-visible"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[13px] font-semibold text-[#7c3aed] uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Todo lo que necesitas para construir
            </h2>
            <p className="text-[#8888a0] text-lg max-w-2xl mx-auto">
              De la idea a producción en minutos. Arya se encarga de lo pesado
              para que tú te enfoques en lo que importa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.title}
                className={cn(
                  "group rounded-2xl border border-[#2A2A2A]/60 bg-[#111111]/40 p-6 transition-all duration-300",
                  "hover:border-[#7c3aed]/20 hover:bg-[#111111]/80 hover:shadow-lg hover:shadow-[#7c3aed]/5 hover:-translate-y-0.5",
                  `landing-stagger-${(i % 3) + 1}`
                )}
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#7c3aed]/10 text-[#7c3aed] mb-5 group-hover:bg-[#7c3aed]/15 group-hover:scale-110 transition-all duration-300">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="text-[16px] font-semibold mb-2 text-[#EDEDED]">{feature.title}</h3>
                <p className="text-[14px] text-[#8888a0] leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section
        id="how-it-works"
        ref={stepsSection.ref}
        className={cn(
          "py-24 md:py-32 relative",
          "landing-reveal",
          stepsSection.isVisible && "landing-reveal-visible"
        )}
      >
        {/* Subtle bg */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#7c3aed]/[0.02] to-transparent pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[13px] font-semibold text-[#7c3aed] uppercase tracking-widest mb-3">Cómo funciona</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Tres pasos. Cero fricción.
            </h2>
            <p className="text-[#8888a0] text-lg max-w-2xl mx-auto">
              De la idea a una app en producción más rápido de lo que crees
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-[52px] left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-px border-t-2 border-dashed border-[#2A2A2A]" />

            {STEPS.map((step, i) => (
              <div key={step.title} className={cn("text-center relative", `landing-stagger-${i + 1}`)}>
                {/* Number badge */}
                <div className="inline-flex items-center justify-center w-[72px] h-[72px] rounded-2xl bg-[#111111] border border-[#2A2A2A] mb-6 relative z-10">
                  <span className="text-[24px] font-bold landing-gradient-text">{step.num}</span>
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-[14px] text-[#8888a0] max-w-xs mx-auto leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Testimonials ─── */}
      <section
        ref={testimonialsSection.ref}
        className={cn(
          "py-24 md:py-32",
          "landing-reveal",
          testimonialsSection.isVisible && "landing-reveal-visible"
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[13px] font-semibold text-[#7c3aed] uppercase tracking-widest mb-3">Testimonios</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Lo que dicen nuestros usuarios
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.author}
                className={cn(
                  "rounded-2xl border border-[#2A2A2A]/60 bg-[#111111]/40 p-6 transition-all duration-300",
                  "hover:border-[#7c3aed]/20 hover:bg-[#111111]/80",
                  `landing-stagger-${i + 1}`
                )}
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-[#f59e0b] text-[#f59e0b]" />
                  ))}
                </div>
                <p className="text-[14px] text-[#EDEDED] leading-relaxed mb-5 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] flex items-center justify-center text-[12px] font-bold text-white">
                    {t.avatar}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#EDEDED]">{t.author}</p>
                    <p className="text-[12px] text-[#4a4a5e]">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section
        id="pricing"
        ref={pricingSection.ref}
        className={cn(
          "py-24 md:py-32 relative",
          "landing-reveal",
          pricingSection.isVisible && "landing-reveal-visible"
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#7c3aed]/[0.02] to-transparent pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[13px] font-semibold text-[#7c3aed] uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Simple y transparente
            </h2>
            <p className="text-[#8888a0] text-lg max-w-2xl mx-auto">
              Empieza gratis, escala cuando lo necesites. Sin costos ocultos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {PRICING.map((plan, i) => (
              <div
                key={plan.name}
                className={cn(
                  "relative rounded-2xl p-6 transition-all duration-300",
                  `landing-stagger-${i + 1}`,
                  plan.highlighted
                    ? "border-2 border-[#7c3aed]/50 bg-[#111111] shadow-xl shadow-[#7c3aed]/10 scale-[1.02] md:scale-105"
                    : "border border-[#2A2A2A]/60 bg-[#111111]/40 hover:border-[#2A2A2A]"
                )}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#7c3aed] px-3.5 py-1 text-[11px] font-semibold text-white">
                    Más popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-[16px] font-semibold mb-1">{plan.name}</h3>
                  <p className="text-[13px] text-[#8888a0] mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && (
                      <span className="text-[#8888a0] text-[14px]">{plan.period}</span>
                    )}
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-center gap-2.5 text-[13px]">
                      <Check className="h-4 w-4 text-[#22c55e] shrink-0" />
                      <span className="text-[#8888a0]">{feat}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={cn(
                    "block w-full text-center rounded-xl py-2.5 text-[13px] font-semibold transition-all duration-200",
                    plan.highlighted
                      ? "bg-[#7c3aed] text-white hover:bg-[#6d28d9] shadow-lg shadow-[#7c3aed]/20 hover:shadow-[#7c3aed]/30"
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

      {/* ─── Final CTA ─── */}
      <section
        ref={ctaSection.ref}
        className={cn(
          "py-24 md:py-32",
          "landing-reveal",
          ctaSection.isVisible && "landing-reveal-visible"
        )}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="relative rounded-3xl border border-[#2A2A2A]/60 overflow-hidden px-8 py-16 md:px-16 md:py-20 landing-stagger-1">
            {/* CTA background glow */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#7c3aed]/10 via-[#7c3aed]/5 to-transparent pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-[#7c3aed]/5 blur-3xl pointer-events-none" />

            <div className="relative">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-5">
                ¿Listo para construir
                <br />
                <span className="landing-gradient-text">algo increíble?</span>
              </h2>
              <p className="text-[#8888a0] text-lg mb-10 max-w-xl mx-auto">
                Únete a miles de makers que construyen el futuro con IA.
                Gratis, sin tarjeta de crédito.
              </p>
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 rounded-xl bg-[#7c3aed] px-10 py-4 text-[16px] font-semibold text-white transition-all duration-300 shadow-[0_0_40px_rgba(124,58,237,0.3)] hover:shadow-[0_0_60px_rgba(124,58,237,0.5)] hover:bg-[#6d28d9] hover:scale-[1.03] active:scale-[0.98]"
              >
                Empieza gratis
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-[#2A2A2A]/40 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#3b82f6] flex items-center justify-center">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <span className="text-[16px] font-bold">Arya AI</span>
              </div>
              <p className="text-[13px] text-[#8888a0] leading-relaxed max-w-[240px]">
                Convierte tus ideas en apps de producción con el poder de la inteligencia artificial.
              </p>
            </div>

            {/* Producto */}
            <div>
              <h4 className="text-[13px] font-semibold mb-4 text-[#EDEDED]">Producto</h4>
              <ul className="space-y-2.5">
                {["Features", "Pricing", "Templates", "Changelog"].map((item) => (
                  <li key={item}>
                    <button
                      onClick={() => {
                        if (item === "Features") smoothScrollTo("features");
                        else if (item === "Pricing") smoothScrollTo("pricing");
                      }}
                      className="text-[13px] text-[#4a4a5e] hover:text-[#8888a0] transition-colors"
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recursos */}
            <div>
              <h4 className="text-[13px] font-semibold mb-4 text-[#EDEDED]">Recursos</h4>
              <ul className="space-y-2.5">
                {["Docs", "GitHub", "Discord", "Blog"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-[13px] text-[#4a4a5e] hover:text-[#8888a0] transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-[13px] font-semibold mb-4 text-[#EDEDED]">Legal</h4>
              <ul className="space-y-2.5">
                {["Privacidad", "Términos", "Cookies"].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-[13px] text-[#4a4a5e] hover:text-[#8888a0] transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="pt-8 border-t border-[#2A2A2A]/40 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[12px] text-[#4a4a5e]">
              &copy; 2026 Arya AI. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-[#4a4a5e] hover:text-[#8888a0] transition-colors">
                <Twitter className="h-4 w-4" />
              </a>
              <a href="#" className="text-[#4a4a5e] hover:text-[#8888a0] transition-colors">
                <Github className="h-4 w-4" />
              </a>
              <a href="#" className="text-[#4a4a5e] hover:text-[#8888a0] transition-colors">
                <MessageSquare className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
