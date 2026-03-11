"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowUp,
  Paperclip,
  Loader2,
  Brain,
  Mic,
  MicOff,
  X,
} from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { useAuthStore } from "@/stores/auth-store";
import { useToast } from "@/components/toast";
import { api } from "@/lib/api";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { cn } from "@/lib/utils";

const ACCEPTED_FILE_TYPES = ".pdf,.csv,.xlsx,.xls,.docx,.doc,.txt,.json,.js,.ts,.tsx,.jsx,.py,.html,.css,.png,.jpg,.jpeg,.gif,.zip,.md,.yaml,.yml,.xml,.sql,.sh";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 10;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileEmoji(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "\uD83D\uDCC4";
  if (["csv", "xlsx", "xls"].includes(ext)) return "\uD83D\uDCCA";
  if (["txt", "doc", "docx", "md"].includes(ext)) return "\uD83D\uDCDD";
  if (["js", "ts", "tsx", "jsx", "py", "html", "css", "sql", "sh", "go", "rs", "java", "c", "cpp"].includes(ext)) return "\uD83D\uDCBB";
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return "\uD83D\uDDBC\uFE0F";
  if (ext === "zip") return "\uD83D\uDCE6";
  return "\uD83D\uDCC1";
}

const QUICK_CHIPS = [
  { emoji: "\uD83D\uDED2", label: "E-commerce", skillSlug: "ecommerce", prompt: "Crear una tienda online con catálogo de productos, carrito de compras y checkout" },
  { emoji: "\uD83D\uDCCA", label: "Dashboard", skillSlug: "dashboard", prompt: "Crear un dashboard de analytics con métricas KPI, gráficos y tablas de datos" },
  { emoji: "\uD83C\uDFA8", label: "Portfolio", skillSlug: "landing-page", prompt: "Crear un portfolio personal profesional con secciones de proyectos, about y contacto" },
  { emoji: "\uD83D\uDCF1", label: "React App", skillSlug: "react-app", prompt: "Crear una aplicación React moderna con routing, componentes reutilizables y dark mode" },
  { emoji: "\uD83D\uDD0D", label: "Blog", skillSlug: "blog", prompt: "Crear un blog con soporte de markdown, categorías, búsqueda y diseño editorial" },
  { emoji: "\u{1F680}", label: "REST API", skillSlug: "express-api", prompt: "Crear una REST API con Express, autenticación JWT, validación y base de datos" },
];

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, isAuthenticated, loadUser } = useAuthStore();
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();
  const [memorySummary, setMemorySummary] = useState<string | null>(null);
  const handleVoiceResultRef = useRef<((text: string) => void) | null>(null);

  const { isListening, transcript, isSupported, toggleListening } = useVoiceInput({
    language: "es-MX",
    onResult: (text) => {
      handleVoiceResultRef.current?.(text);
    },
  });

  useEffect(() => {
    handleVoiceResultRef.current = (text: string) => {
      setPrompt(text);
      setTimeout(() => handleSubmit(), 500);
    };
  });

  useEffect(() => { loadUser(); }, [loadUser]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push("/login"); return; }
  }, [authLoading, isAuthenticated, router]);

  // Fetch memory summary
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        const data = await api.getMemorySummary();
        if (data.summary) setMemorySummary(data.summary);
      } catch { /* ignore */ }
    })();
  }, [isAuthenticated]);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "56px";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  useEffect(() => { adjustHeight(); }, [prompt, adjustHeight]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const totalFiles = attachedFiles.length + selected.length;
    if (totalFiles > MAX_FILES) {
      addToast("warning", `Puedes adjuntar hasta ${MAX_FILES} archivos.`);
      return;
    }
    for (const file of selected) {
      if (file.size > MAX_FILE_SIZE) {
        addToast("warning", `${file.name} es demasiado grande (max 50MB).`);
        return;
      }
    }
    setAttachedFiles((prev) => [...prev, ...selected]);
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const text = prompt.trim();
    if ((!text && attachedFiles.length === 0) || isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Create project with prompt as name (truncated) and description
      const displayText = text || `Analizar ${attachedFiles.length} archivo(s)`;
      const name = displayText.length > 60 ? displayText.slice(0, 57) + "..." : displayText;
      const project = await api.createProject(name, "react-vite", text || undefined);

      // Upload files if any
      if (attachedFiles.length > 0) {
        try {
          await api.uploadFiles(project.id, attachedFiles);
        } catch (uploadErr) {
          console.error("File upload failed:", uploadErr);
          addToast("warning", "Algunos archivos no se pudieron subir.");
        }
      }

      // Build prompt with file context
      let enginePrompt = text;
      if (attachedFiles.length > 0) {
        const fileList = attachedFiles.map((f) => f.name).join(", ");
        if (text) {
          enginePrompt = `${text}\n\n[Archivos adjuntos: ${fileList}]`;
        } else {
          enginePrompt = `Analiza los siguientes archivos adjuntos y genera un reporte con insights: ${fileList}`;
        }
      }

      // Start the engine
      try {
        await api.startEngine(project.id, enginePrompt);
      } catch (engineErr: any) {
        const msg = engineErr?.message || "";
        if (msg.includes("credit balance") || msg.includes("insufficient") || engineErr?.status === 402) {
          addToast("error", "El proveedor de AI no tiene créditos. Verifica tu API key de Anthropic en console.anthropic.com.");
        } else if (msg.includes("API key") || msg.includes("authentication") || msg.includes("invalid_api_key")) {
          addToast("error", "API key inválida. Verifica tu configuración de Anthropic API key.");
        } else if (msg.includes("rate limit") || msg.includes("too many")) {
          addToast("warning", "Limite de solicitudes alcanzado. Espera un momento e intenta de nuevo.");
        } else {
          addToast("warning", "El engine no pudo iniciar -- puedes reintentar desde la pagina del proyecto.");
        }
      }
      router.push(`/project/${project.id}`);
    } catch (err) {
      console.error("Failed to create project:", err);
      addToast("error", "Failed to create project. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleChipClick = (chip: typeof QUICK_CHIPS[number]) => {
    setPrompt(chip.prompt);
    textareaRef.current?.focus();
  };

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buenos días";
    if (hour < 18) return "Buenas tardes";
    return "Buenas noches";
  })();

  const firstName = user?.name?.split(" ")[0] || user?.email?.split("@")[0] || "Usuario";

  // Loading
  if (authLoading) {
    return (
      <AppLayout>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#7c3aed]" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center min-h-screen max-w-2xl w-full mx-auto px-6">
        {/* Greeting */}
        <div className="flex flex-col items-center animate-fade-in-up">
          <Sparkles className="w-10 h-10 text-[#7c3aed] animate-sparkle-pulse" />
          <h1 className="text-3xl font-light text-[#EDEDED] mt-4 text-center">
            {greeting}, {firstName}
          </h1>
          <p className="text-3xl font-light text-[#EDEDED] mt-1 text-center">
            ¿Qué quieres lograr hoy?
          </p>
          {memorySummary && (
            <div className="flex items-center gap-2 mt-3 text-xs text-[#8888a0] animate-fade-in">
              <Brain className="h-3.5 w-3.5 text-[#7c3aed]" />
              <span>Arya recuerda tu stack: {memorySummary}</span>
            </div>
          )}
        </div>

        {/* Input area */}
        <div
          className="relative w-full mt-8 animate-fade-in-up"
          style={{ animationDelay: "0.1s" }}
        >
          {/* Voice listening indicator */}
          {isListening && (
            <div className="absolute -top-12 left-0 right-0 flex items-center justify-center z-10">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/30 animate-fade-in">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm text-red-400">
                  {transcript || "Escuchando..."}
                </span>
              </div>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={isListening && transcript ? transcript : prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe lo que necesitas..."
            disabled={isSubmitting || isListening}
            rows={1}
            className="w-full rounded-2xl border border-[#2A2A2A] bg-[#111111] p-4 pb-12 pr-24 text-[#EDEDED] text-sm placeholder:text-[#555555] resize-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed] focus:outline-none transition-colors disabled:opacity-60"
            style={{ minHeight: "56px", maxHeight: "200px" }}
          />
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            onChange={handleFileSelect}
            className="hidden"
          />
          {/* Attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSubmitting}
            className={cn(
              "absolute left-4 bottom-3 transition-colors",
              attachedFiles.length > 0 ? "text-[#7c3aed]" : "text-[#555555] hover:text-[#999]"
            )}
            title="Adjuntar archivos"
          >
            <Paperclip className="h-4.5 w-4.5" />
          </button>
          {/* Mic button */}
          {isSupported && (
            <button
              onClick={toggleListening}
              disabled={isSubmitting}
              className={cn(
                "absolute right-14 bottom-3 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200",
                isListening
                  ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30"
                  : "text-[#555] hover:text-[#888] hover:bg-[#1A1A1A]"
              )}
              title={isListening ? "Detener" : "Hablar con Arya"}
            >
              {isListening ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          )}
          {/* Send button */}
          {(prompt.trim() || attachedFiles.length > 0) && (
            <button
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              className="absolute right-3 bottom-3 flex items-center justify-center w-9 h-9 rounded-full bg-[#7c3aed] hover:bg-[#6d28d9] text-white transition-colors disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </button>
          )}
        </div>

        {/* Attached file badges */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3 w-full animate-fade-in">
            {attachedFiles.slice(0, 5).map((file, i) => (
              <div
                key={`${file.name}-${i}`}
                className="flex items-center gap-2 rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-1.5 text-xs text-[#EDEDED]"
              >
                <span>{getFileEmoji(file.name)}</span>
                <span className="truncate max-w-[160px]">{file.name}</span>
                <span className="text-[#8888a0]">({formatFileSize(file.size)})</span>
                <button
                  onClick={() => removeFile(i)}
                  className="text-[#555] hover:text-[#ef4444] transition-colors ml-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {attachedFiles.length > 5 && (
              <div className="flex items-center rounded-lg bg-[#1A1A1A] border border-[#2A2A2A] px-3 py-1.5 text-xs text-[#8888a0]">
                +{attachedFiles.length - 5} mas
              </div>
            )}
          </div>
        )}

        {/* Quick action chips */}
        <div
          className="flex flex-wrap gap-2 mt-6 justify-center animate-fade-in-up"
          style={{ animationDelay: "0.2s" }}
        >
          {QUICK_CHIPS.map((chip) => (
            <button
              key={chip.label}
              onClick={() => handleChipClick(chip)}
              className="px-4 py-2 rounded-full border border-[#2A2A2A] bg-transparent hover:bg-[#1A1A1A] hover:border-[#3A3A3A] text-sm text-[#888] transition-all duration-200 cursor-pointer"
            >
              {chip.emoji} {chip.label}
            </button>
          ))}
        </div>

        {/* Subtitle */}
        <p className="text-sm text-[#555555] mt-8 text-center">
          Arya orquesta agentes especializados para entregar tu proyecto completo
        </p>

        {/* Footer */}
        <p className="text-xs text-[#444444] mt-12">
          Arya AI puede cometer errores. Verifica los resultados.
        </p>
      </div>
    </AppLayout>
  );
}
