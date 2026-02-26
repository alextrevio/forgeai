"use client";

import { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import { cn, generateId } from "@/lib/utils";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
  exiting?: boolean;
}

interface ToastContextType {
  addToast: (type: ToastType, message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, type, message, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    // Mark as exiting first for exit animation
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 250);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const typeConfig = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
    border: "border-[#22c55e]/30",
    iconColor: "text-[#22c55e]",
    progressColor: "bg-[#22c55e]",
  },
  error: {
    icon: <XCircle className="h-4 w-4 shrink-0" />,
    border: "border-[#ef4444]/30",
    iconColor: "text-[#ef4444]",
    progressColor: "bg-[#ef4444]",
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
    border: "border-[#f59e0b]/30",
    iconColor: "text-[#f59e0b]",
    progressColor: "bg-[#f59e0b]",
  },
  info: {
    icon: <Info className="h-4 w-4 shrink-0" />,
    border: "border-[#3b82f6]/30",
    iconColor: "text-[#3b82f6]",
    progressColor: "bg-[#3b82f6]",
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    if (toast.duration > 0) {
      const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast, onDismiss]);

  const config = typeConfig[toast.type];

  return (
    <div className={cn(
      "relative flex items-start gap-3 rounded-lg border bg-[#111111] p-3 shadow-xl overflow-hidden",
      config.border,
      toast.exiting ? "animate-slide-out-down" : "animate-slide-in-up"
    )}>
      <span className={config.iconColor}>{config.icon}</span>
      <p className="text-sm text-[#EDEDED] flex-1">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-[#8888a0] hover:text-[#EDEDED] shrink-0 transition-colors duration-150"
      >
        <X className="h-3 w-3" />
      </button>
      {/* Auto-dismiss progress bar */}
      {toast.duration > 0 && !toast.exiting && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px]">
          <div
            className={cn("h-full toast-progress", config.progressColor)}
            style={{ animation: `toastProgress ${toast.duration}ms linear forwards` }}
          />
        </div>
      )}
    </div>
  );
}
