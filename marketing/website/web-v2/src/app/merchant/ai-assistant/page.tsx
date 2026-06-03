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
    "Here's a description for your Fuzhou Oyster Cake:\n\n\"Our signature oyster cake is a Fuzhou treasure — a crispy, golden shell filled with plump oysters, minced pork, and fresh vegetables. Hand-made daily using a recipe passed down through generations, each cake is fried to order for that perfect crunch. A Maxwell Food Centre institution since 1982.\"",
  "Suggest promotion ideas for this weekend":
    "Here are 3 promotion ideas for this weekend:\n\n1. **Weekend Bundle** — Buy any 2 items, get a free barley water. Great for families.\n\n2. **Early Bird Special** — First 30 customers each day get 10% off. Creates buzz and drives early queue traffic.\n\n3. **Social Share Reward** — Show us your Instagram story and get an extra oyster cake on us. Boosts your organic reach.",
  "Help me respond to a negative review":
    "Here's a professional response template:\n\n\"Thank you for your honest feedback, [name]. We're truly sorry to hear that your experience didn't meet our standards — that's never what we want. We'd love the opportunity to make it right. Please reach out to us directly and we'll do our best to resolve this. Your satisfaction matters to us greatly.\"",
  "Create my weekly special":
    "Here's a weekly special concept:\n\n**Maxwell Monday Special** — Every Monday only: Oyster Cake + Lor Mee combo at S$6 (usual S$6.50). Perfect for the start-of-week crowd and gives your regulars a reason to visit specifically on Mondays. Announce it on your Hungry profile every Sunday evening.",
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
      text: "Hi! I'm your Hungry AI Assistant. I can help you write dish descriptions, plan promotions, respond to reviews, and more. Try one of the prompts below or type your own question.",
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
      "That's a great question! Based on your stall's profile and recent performance, I'd suggest focusing on what makes Maxwell Fuzhou Oyster Cake unique — your heritage, your handmade process, and the loyal community you've built. Would you like me to help craft specific content around that?";
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
