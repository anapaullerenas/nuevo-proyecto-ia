"use client";

import { FormEvent, MouseEvent, useEffect, useRef, useState } from "react";
import {
  Loader2,
  MessageSquareText,
  Mic,
  MoreHorizontal,
  Pause,
  Plus,
  SendHorizontal,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

const suggestions = [
  "¿Qué creativo producirías esta semana para vender más?",
  "Dame 5 hooks para una persona que aún no confía en mi marca.",
  "¿Qué ángulos usarías para un estático de conversión?",
  "Analiza mi oferta y dime qué objeciones debo atacar.",
  "Crea un brief para un anuncio de prueba social.",
  "¿Qué debería testear primero: precio, promesa o formato?",
];

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  audioUrl?: string;
};

export type ChatConversation = {
  id: string;
  title: string;
  updated_at: string;
};

type ChatWorkspaceProps = {
  brandName: string;
  initialConversations: ChatConversation[];
  initialConversationId: string | null;
  initialMessages: ChatMessage[];
};

export function ChatWorkspace({
  brandName,
  initialConversations,
  initialConversationId,
  initialMessages,
}: ChatWorkspaceProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [conversations, setConversations] = useState(initialConversations);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingError, setRecordingError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  function chooseSuggestion(value: string) {
    setInput(value);
  }

  function startNewConversation() {
    if (isSending) return;
    setConversationId(null);
    setMessages([]);
    setInput("");
    setRecordingError("");
  }

  async function openConversation(id: string) {
    if (id === conversationId || isSending || isLoadingConversation) return;
    setIsLoadingConversation(true);
    setRecordingError("");

    try {
      const response = await fetch(`/api/chat/conversations?id=${encodeURIComponent(id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo abrir la conversación.");
      setConversationId(id);
      setMessages(data.messages || []);
    } catch (error) {
      setRecordingError(error instanceof Error ? error.message : "No se pudo abrir la conversación.");
    } finally {
      setIsLoadingConversation(false);
    }
  }

  async function deleteConversation(event: MouseEvent<HTMLButtonElement>, id: string) {
    event.stopPropagation();
    if (deletingId || isSending) return;
    setDeletingId(id);
    setRecordingError("");

    try {
      const response = await fetch(`/api/chat/conversations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar la conversación.");

      const remaining = conversations.filter((conversation) => conversation.id !== id);
      setConversations(remaining);

      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
      }
    } catch (error) {
      setRecordingError(error instanceof Error ? error.message : "No se pudo eliminar la conversación.");
    } finally {
      setDeletingId("");
    }
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
      setRecordingError("No se pudo activar el micrófono. Revisa los permisos del navegador.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!input.trim() && !audioBlob) || isSending) return;

    setIsSending(true);
    setRecordingError("");
    let userMessageId = "";

    try {
      let finalText = input.trim();

      if (audioBlob) {
        const formData = new FormData();
        formData.append("audio", audioBlob, "nota.webm");
        const transcription = await fetch("/api/transcribe", { method: "POST", body: formData });
        const transcriptionData = await transcription.json();

        if (!transcription.ok) {
          throw new Error(transcriptionData.error || "No se pudo transcribir el audio.");
        }

        finalText = [finalText, transcriptionData.text].filter(Boolean).join("\n\nAudio transcrito: ");
      }

      userMessageId = crypto.randomUUID();
      const userMessage: ChatMessage = {
        id: userMessageId,
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
        body: JSON.stringify({ message: finalText, conversationId }),
      });
      const chatData = await chatResponse.json();
      if (!chatResponse.ok) throw new Error(chatData.error || "No se pudo generar respuesta.");

      setMessages((current) => [
        ...current,
        { id: chatData.messageId || crypto.randomUUID(), role: "assistant", text: chatData.answer },
      ]);
      setConversationId(chatData.conversation.id);
      setConversations((current) => [
        chatData.conversation,
        ...current.filter((conversation) => conversation.id !== chatData.conversation.id),
      ]);
    } catch (error) {
      if (userMessageId) {
        setMessages((current) => current.filter((message) => message.id !== userMessageId));
      }
      setRecordingError(error instanceof Error ? error.message : "No se pudo conectar con el asistente. Intenta de nuevo.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="work-page chat-layout">
      <aside className="conversation-rail" aria-label="Historial de conversaciones">
        <div className="conversation-rail-head">
          <span className="eyebrow">Tus conversaciones</span>
          <button type="button" className="new-chat-button" onClick={startNewConversation} disabled={isSending}>
            <Plus size={17} />
            Nuevo chat
          </button>
        </div>

        <div className="conversation-list">
          {conversations.length ? (
            conversations.map((conversation, index) => (
              <div key={conversation.id} className="conversation-row-wrap">
                {(index === 0 || historyGroup(conversations[index - 1].updated_at) !== historyGroup(conversation.updated_at)) && (
                  <span className="conversation-date">{historyGroup(conversation.updated_at)}</span>
                )}
                <button
                  type="button"
                  className={`conversation-row ${conversation.id === conversationId ? "is-active" : ""}`}
                  onClick={() => openConversation(conversation.id)}
                  disabled={isLoadingConversation || isSending}
                >
                  <MessageSquareText size={16} />
                  <span>{conversation.title}</span>
                  <span className="conversation-more" aria-hidden="true"><MoreHorizontal size={16} /></span>
                </button>
                <button
                  type="button"
                  className="delete-conversation"
                  onClick={(event) => deleteConversation(event, conversation.id)}
                  aria-label={`Eliminar ${conversation.title}`}
                  disabled={deletingId === conversation.id || isSending}
                >
                  {deletingId === conversation.id ? <Loader2 className="spin" size={14} /> : <Trash2 size={14} />}
                </button>
              </div>
            ))
          ) : (
            <div className="conversation-empty">
              <MessageSquareText size={19} />
              <p>Aquí aparecerán los chats que tengas con tu estratega.</p>
            </div>
          )}
        </div>

        <div className="conversation-brand">
          <span aria-hidden="true">{brandName.slice(0, 1).toUpperCase()}</span>
          <div>
            <b>{brandName}</b>
            <small>Memoria de marca conectada</small>
          </div>
        </div>
      </aside>

      <section className="studio-panel chat-studio">
        <div className="panel-heading chat-heading">
          <span className="eyebrow">Chat IA</span>
          <h1>{conversationId ? conversations.find((item) => item.id === conversationId)?.title || "Tu estratega creativa" : "¿Qué vamos a crear hoy?"}</h1>
          <p>Pregunta qué producir, qué analizar o cómo mejorar un anuncio. La IA ya tiene el contexto de {brandName}.</p>
        </div>

        {!messages.length && (
          <div className="suggestion-panel">
            <span className="eyebrow">Ideas para empezar</span>
            <div>
              {suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => chooseSuggestion(suggestion)}>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={messages.length ? "chat-thread" : "chat-empty"} aria-live="polite">
          {isLoadingConversation ? (
            <div className="chat-loading"><Loader2 className="spin" size={22} /><span>Abriendo conversación…</span></div>
          ) : messages.length ? (
            <>
              {messages.map((message) => (
                <article key={message.id} className={`chat-bubble ${message.role}`}>
                  <b>{message.role === "user" ? brandName : "Ana · Estratega IA"}</b>
                  <p>{message.text}</p>
                  {message.audioUrl && <audio controls src={message.audioUrl} />}
                </article>
              ))}
              {isSending && (
                <article className="chat-bubble assistant chat-thinking">
                  <Loader2 className="spin" size={16} />
                  <span>Analizando con la memoria de tu marca…</span>
                </article>
              )}
              <div ref={threadEndRef} />
            </>
          ) : (
            <>
              <Sparkles size={22} />
              <b>Empieza con una pregunta o dicta tu idea.</b>
              <p>Puedes pedir hooks, ángulos, briefs, ideas de estáticos o diagnósticos para {brandName}.</p>
            </>
          )}
        </div>

        {audioUrl && (
          <div className="audio-chip">
            <audio controls src={audioUrl} />
            <button type="button" onClick={() => { setAudioUrl(""); setAudioBlob(null); }} aria-label="Quitar audio">
              <X size={15} />
            </button>
          </div>
        )}

        {recordingError && <p className="form-message">{recordingError}</p>}

        <form className="composer" onSubmit={handleSubmit}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={`Pregunta algo sobre ${brandName}…`}
            disabled={isSending || isLoadingConversation}
            aria-label="Mensaje para la estratega IA"
          />
          <button className={isRecording ? "recording" : ""} type="button" onClick={toggleRecording} aria-label={isRecording ? "Detener audio" : "Grabar audio"} disabled={isSending}>
            {isRecording ? <Pause size={18} /> : <Mic size={18} />}
          </button>
          <button type="submit" aria-label="Enviar mensaje" disabled={isSending || isLoadingConversation}>
            {isSending ? <Loader2 className="spin" size={18} /> : <SendHorizontal size={18} />}
          </button>
        </form>
      </section>
    </section>
  );
}

function historyGroup(value: string) {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((today - target) / 86_400_000);

  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return "Últimos 7 días";
  if (days < 30) return "Últimos 30 días";
  return "Anteriores";
}
