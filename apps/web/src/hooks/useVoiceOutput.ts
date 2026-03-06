import { useState, useRef, useCallback } from "react";

interface UseVoiceOutputOptions {
  voice?: string;
  rate?: number;
  pitch?: number;
  language?: string;
}

export function useVoiceOutput(options: UseVoiceOutputOptions = {}) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const speak = useCallback(
    (text: string) => {
      if (!isEnabled || typeof window === "undefined" || !window.speechSynthesis)
        return;

      window.speechSynthesis.cancel();

      // Clean text — remove markdown, code blocks, emojis
      const cleanText = text
        .replace(/```[\s\S]*?```/g, "código omitido")
        .replace(/`[^`]+`/g, "")
        .replace(/[#*_~]/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(
          /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
          ""
        )
        .trim();

      if (!cleanText) return;

      // Limit length for TTS
      const truncated =
        cleanText.length > 500
          ? cleanText.slice(0, 500) + "... respuesta truncada."
          : cleanText;

      const utterance = new SpeechSynthesisUtterance(truncated);
      utterance.lang = optionsRef.current.language || "es-MX";
      utterance.rate = optionsRef.current.rate || 1.0;
      utterance.pitch = optionsRef.current.pitch || 1.0;

      // Try to find a good Spanish voice
      const voices = window.speechSynthesis.getVoices();
      const spanishVoice =
        voices.find(
          (v) => v.lang.startsWith("es") && v.name.includes("Google")
        ) || voices.find((v) => v.lang.startsWith("es"));
      if (spanishVoice) utterance.voice = spanishVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isEnabled]
  );

  const stop = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const toggleEnabled = useCallback(() => {
    if (isSpeaking) stop();
    setIsEnabled((prev) => !prev);
  }, [isSpeaking, stop]);

  return {
    isSpeaking,
    isEnabled,
    speak,
    stop,
    toggleEnabled,
    setIsEnabled,
  };
}
