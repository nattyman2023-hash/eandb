import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, X, Send, ArrowRight, ExternalLink } from "lucide-react";
import { api } from "@/lib/apiClient";
import { BUSINESS } from "@/lib/siteContent";
import chatAvatar from "@/assets/chat-avatar.png";

type Role = "user" | "assistant";
interface Message { role: Role; content: string; }

const WELCOME = "Hi, I'm Selam — your virtual receptionist at Wub Hair. ✂️ Ask me about services, prices, or booking.";

const QUICK_REPLIES = ["Book an appointment", "What do braids cost?", "Opening hours", "Where are you?"];

const LiveChat = () => {
  const [isOpen, setIsOpen] = useState(() => sessionStorage.getItem("chat-open") === "true");
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: WELCOME }]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    sessionStorage.setItem("chat-open", String(next));
  };

  const lastUser = [...messages].reverse().find(m => m.role === "user")?.content ?? "Hi, I'd like to book.";
  const whatsappHref = `${BUSINESS.whatsapp}?text=${encodeURIComponent(lastUser)}`;

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    // Quick path: jump to booking
    if (/^book/i.test(trimmed)) {
      setMessages(m => [...m, { role: "user", content: trimmed }, { role: "assistant", content: "Taking you to the booking page now…" }]);
      setInput("");
      setTimeout(() => { navigate("/book"); setIsOpen(false); }, 800);
      return;
    }

    const next = [...messages, { role: "user" as Role, content: trimmed }];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const { data, error } = await api.functions.invoke("chat-assistant", {
        body: { messages: next.map(m => ({ role: m.role, content: m.content })) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages(m => [...m, { role: "assistant", content: data?.reply ?? "Sorry, I'm not sure." }]);
    } catch (err: any) {
      setMessages(m => [...m, { role: "assistant", content: `I can't reach my brain right now — try WhatsApp and the team will reply quickly.` }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Toggle */}
      {!isOpen && (
        <button
          onClick={toggleOpen}
          className="fixed bottom-24 right-4 z-[50] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-110 transition-transform duration-200 md:bottom-8 md:right-6 overflow-hidden"
          aria-label="Open live chat"
        >
          <img src={chatAvatar} alt="" className="h-full w-full object-cover" />
        </button>
      )}

      {/* Window */}
      {isOpen && (
        <div className="fixed bottom-24 left-3 right-3 z-[50] max-h-[560px] rounded-xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden animate-fade-in md:right-6 md:left-auto md:w-[360px] md:bottom-6">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground">
            <img src={chatAvatar} alt="Selam" className="h-9 w-9 rounded-full bg-white/10 object-cover" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">Selam</p>
              <p className="text-[11px] opacity-90">Wub Hair · usually replies in seconds</p>
            </div>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium bg-white/15 hover:bg-white/25 transition rounded-full px-2.5 py-1 flex items-center gap-1"
              title="Continue on WhatsApp"
            >
              WhatsApp <ExternalLink className="h-3 w-3" />
            </a>
            <button onClick={toggleOpen} className="hover:opacity-80" aria-label="Close chat">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[240px] max-h-[360px] bg-muted/20">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <img src={chatAvatar} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0 self-end" />
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                    m.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border text-foreground rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-2">
                <img src={chatAvatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                <div className="bg-card border border-border rounded-2xl px-3 py-2 text-sm text-muted-foreground">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0.15s" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0.3s" }} />
                  </span>
                </div>
              </div>
            )}

            {/* Quick replies — only when fresh */}
            {messages.length === 1 && !sending && (
              <div className="space-y-1.5 pt-2">
                {QUICK_REPLIES.map(q => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    {q} <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* WhatsApp persistent CTA */}
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-[11px] py-1.5 bg-accent/10 text-foreground border-t border-border hover:bg-accent/20 transition"
          >
            Prefer a real person? <span className="font-semibold underline">Continue on WhatsApp →</span>
          </a>

          {/* Input */}
          <div className="border-t border-border p-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Ask anything…"
              className="text-sm"
              maxLength={500}
              disabled={sending}
            />
            <Button size="icon" onClick={() => send(input)} disabled={sending || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default LiveChat;
