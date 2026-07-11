"use client";

import { FormEvent, useRef, useState } from "react";
import { Mic, Pause, SendHorizontal, Sparkles, X } from "lucide-react";

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
  role: "user" | "system";
  text: string;
  audioUrl?: string;
};

export function ChatWorkspace({ brandName }: { brandName: string }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!input.trim() && !audioUrl) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: input.trim() || "Audio enviado para transcribir.",
      audioUrl: audioUrl || undefined,
    };

    const systemMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "system",
      text: "Mensaje recibido. La respuesta estrategica se activara cuando conectemos el motor de IA y el consumo de creditos.",
    };

    setMessages((current) => [...current, userMessage, systemMessage]);
    setInput("");
    setAudioUrl("");
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
          <button type="button" onClick={() => setAudioUrl("")} aria-label="Quitar audio">
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
        />
        <button
          className={isRecording ? "recording" : ""}
          type="button"
          onClick={toggleRecording}
          aria-label={isRecording ? "Detener audio" : "Grabar audio"}
        >
          {isRecording ? <Pause size={18} /> : <Mic size={18} />}
        </button>
        <button type="submit" aria-label="Enviar mensaje">
          <SendHorizontal size={18} />
        </button>
      </form>
    </>
  );
}
