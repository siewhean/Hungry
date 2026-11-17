"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import styles from "../../console/console.module.css";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
}

const PRESET_RESPONSES: Record<string, string> = {
  "Write a dish description for my signature oyster cake":
    "Try this:\n\n\"Crisp Fuzhou oyster cake, fried to order with oysters, minced pork, and fresh vegetables inside. Made daily at Maxwell Food Centre.\"",
  "Suggest promotion ideas for this weekend":
    "A few simple options:\n\n1. Weekend bundle: buy any 2 items and get a barley water.\n\n2. Early queue offer: first 30 customers get 10% off.\n\n3. Add-on special: oyster cake with lor mee for a fixed combo price.",
  "Help me respond to a negative review":
    "Try this:\n\n\"Hi [name], thanks for letting us know. Sorry the meal did not turn out the way it should have. Please message us with your visit details so we can check what happened and make it right.\"",
  "Create my weekly special":
    "Weekly special idea:\n\nMaxwell Monday combo: oyster cake with lor mee for S$6 every Monday. Add it to your Hungry profile on Sunday evening so regulars see it before lunch.",
};

const PRESETS = Object.keys(PRESET_RESPONSES);
let messageIdSequence = 0;

function nextMessageId(prefix: "a" | "u") {
  messageIdSequence += 1;
  return `${prefix}${messageIdSequence}`;
}

function now() {
  return new Date().toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" });
}

export default function MerchantAiAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "init",
      role: "assistant",
      text: "Hi, I can help with dish descriptions, promotions, and review replies. Pick a prompt below or type your own question.",
      time: now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || thinking) return;
    const userMsg: ChatMessage = { id: nextMessageId("u"), role: "user", text, time: now() };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setThinking(true);
    await new Promise((r) => setTimeout(r, 1200));
    const responseText = PRESET_RESPONSES[text] ||
      "I would focus on what makes the stall specific: the dish, how it is made, and what regulars come back for. Tell me the dish or promotion you want to write about.";
    const assistantMsg: ChatMessage = { id: nextMessageId("a"), role: "assistant", text: responseText, time: now() };
    setMessages((p) => [...p, assistantMsg]);
    setThinking(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div>
      <div className={styles.headerTitleArea}>
        <div>
          <h1>AI Assistant</h1>
          <p>Get help writing copy, planning promotions, and responding to customers.</p>
        </div>
      </div>

      <div className={styles.chatShell}>
        {/* Preset prompts */}
        <div className={styles.chatPresets}>
          {PRESETS.map((p) => (
            <button key={p} className={styles.chatPresetBtn} onClick={() => sendMessage(p)} disabled={thinking}>
              {p}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className={styles.chatMessages}>
          {messages.map((m) => (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div className={`${styles.chatBubble} ${m.role === "user" ? styles.chatBubbleUser : styles.chatBubbleAssistant}`}
                style={{ whiteSpace: "pre-line" }}>
                {m.text}
              </div>
              <div className={styles.chatMeta}>{m.role === "assistant" ? "AI Assistant · " : "You · "}{m.time}</div>
            </div>
          ))}
          {thinking && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div className={`${styles.chatBubble} ${styles.chatBubbleAssistant}`}>
                <span style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  {[0, 1, 2].map((i) => (
                    <span key={i} style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--color-text-muted)", display: "inline-block", animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }} />
                  ))}
                </span>
              </div>
              <div className={styles.chatMeta}>AI Assistant is thinking…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className={styles.chatInputBar}>
          <textarea
            className={styles.chatInput}
            rows={1}
            placeholder="Ask me anything about your stall…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={thinking}
          />
          <button className={styles.chatSendBtn} onClick={() => sendMessage(input)} disabled={!input.trim() || thinking} aria-label="Send message">
            <Send size={18} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
