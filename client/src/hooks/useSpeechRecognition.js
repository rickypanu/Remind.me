import { useCallback, useEffect, useRef, useState } from "react";

const getRecognitionClass = () =>
  typeof window === "undefined" ? undefined : window.SpeechRecognition || window.webkitSpeechRecognition;

/**
 * Browser speech-to-text. `onText(transcript)` receives the full transcript so far; `getBaseText` returns the text
 * already typed, so speech is appended to it. `onUnsupported` / `onError` let the page choose the message.
 */
export default function useSpeechRecognition({ lang, getBaseText, onText, onUnsupported, onError }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const baseRef = useRef("");
  const handlers = useRef({});
  useEffect(() => {
    handlers.current = { getBaseText, onText, onUnsupported, onError };
  });

  useEffect(() => () => recognitionRef.current?.abort?.(), []);

  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  const start = useCallback(() => {
    const Recognition = getRecognitionClass();
    if (!Recognition) {
      handlers.current.onUnsupported?.();
      return;
    }
    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.interimResults = true; // real-time transcription
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setListening(true);
      baseRef.current = (handlers.current.getBaseText?.() || "").trim();
    };
    recognition.onresult = (event) => {
      if (!event.results?.length) return;
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join("");
      handlers.current.onText?.(baseRef.current ? `${baseRef.current} ${transcript}` : transcript);
    };
    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") handlers.current.onError?.(event.error);
    };
    recognition.onend = () => setListening(false);
    recognition.start();
  }, [lang]);

  const toggle = useCallback(() => (listening ? stop() : start()), [listening, start, stop]);

  return { listening, start, stop, toggle, supported: !!getRecognitionClass() };
}
