"use client";

import { FormEvent, useRef, useState } from "react";
import { Loader2, Mic, Pause, SendHorizontal, Sparkles, X } from "lucide-react";

const suggestions = [
  "Que creativo producirias esta semana para vender mas?",
  "Dame 5 hooks para una persona que aun no confia en mi marca.",
  "Que angulos usarias para un estatico de conversion?",
  "Analiza mi oferta y dime que objeciones debo atacar.",
  "Crea un brief para un anuncio de prueba social.",
  "Que deberia testear primero: precio, promesa o formato?",
];

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  audioUrl?: string;
};

export function ChatWorkspace({ brandName }: { brandName: string }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingError, setRecordingError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function chooseSuggestion(value: string) {
    setInput(value);
  }

  async function toggleRecording() {
    setRecordingError("");

    if (isRecording) {
      recorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((track) => track.stop());
      };

      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setRecordingError("No se pudo activar el microfono. Revisa permisos del navegador.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if ((!input.trim() && !audioBlob) || isSending) return;

    setIsSending(true);
    setRecordingError("");

    try {
      let finalText = input.trim();

      if (audioBlob) {
        const formData = new FormData();
        formData.append("audio", audioBlob, "nota.webm");

        const transcription = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
        });

        const transcriptionData = await transcription.json();

        if (!transcription.ok) {
          setRecordingError(transcriptionData.error || "No se pudo transcribir el audio.");
          return;
        }

        finalText = [finalText, transcriptionData.text].filter(Boolean).join("\n\nAudio transcrito: ");
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        text: finalText || "Audio enviado.",
        audioUrl: audioUrl || undefined,
      };

      setMessages((current) => [...current, userMessage]);
      setInput("");
      setAudioUrl("");
      setAudioBlob(null);

      const chatResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: finalText,
          messages: messages.map((message) => ({
            role: message.role,
            text: message.text,
          })),
        }),
      });

      const chatData = await chatResponse.json();

      if (!chatResponse.ok) {
        setRecordingError(chatData.error || "No se pudo generar respuesta.");
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: chatData.answer,
        },
      ]);
    } catch {
      setRecordingError("No se pudo conectar con el asistente. Intenta de nuevo.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <div className="suggestion-panel">
        <span className="eyebrow">Ideas para preguntar</span>
        <div>
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" onClick={() => chooseSuggestion(suggestion)}>
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <div className={messages.length ? "chat-thread" : "chat-empty"}>
        {messages.length ? (
          messages.map((message) => (
            <article key={message.id} className={`chat-bubble ${message.role}`}>
              <b>{message.role === "user" ? brandName : "Asistente IA"}</b>
              <p>{message.text}</p>
              {message.audioUrl && <audio controls src={message.audioUrl} />}
            </article>
          ))
        ) : (
          <>
            <Sparkles size={22} />
            <b>Empieza con una pregunta o dicta tu idea.</b>
            <p>
              Puedes pedir hooks, angles, briefs, ideas de estaticos o diagnosticos
              usando la memoria de esta marca.
            </p>
          </>
        )}
      </div>

      {audioUrl && (
        <div className="audio-chip">
          <audio controls src={audioUrl} />
          <button
            type="button"
            onClick={() => {
              setAudioUrl("");
              setAudioBlob(null);
            }}
            aria-label="Quitar audio"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {recordingError && <p className="form-message">{recordingError}</p>}

      <form className="composer" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ej. Que estatico producirias esta semana para esta marca?"
          disabled={isSending}
        />
        <button
          className={isRecording ? "recording" : ""}
          type="button"
          onClick={toggleRecording}
          aria-label={isRecording ? "Detener audio" : "Grabar audio"}
          disabled={isSending}
        >
          {isRecording ? <Pause size={18} /> : <Mic size={18} />}
        </button>
        <button type="submit" aria-label="Enviar mensaje" disabled={isSending}>
          {isSending ? <Loader2 className="spin" size={18} /> : <SendHorizontal size={18} />}
        </button>
      </form>
    </>
  );
}
