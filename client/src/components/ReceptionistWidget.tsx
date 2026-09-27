import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, CalendarCheck, User } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type FormMode = "none" | "lead" | "booking";
type SuggestedAction = "booking" | "lead" | null;

const QUICK_REPLIES = [
  { label: "Browse courses", message: "What courses do you offer?" },
  { label: "Bundle deal?", message: "Tell me about the bundle deal." },
  { label: "Book a call", action: "booking" as const },
  { label: "Talk to a human", action: "lead" as const },
];

const GREETING =
  "Hi! I'm the Spiral Academy assistant. Ask me about our courses, the bundle deal, or I can book you a call.";

export default function ReceptionistWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [formMode, setFormMode] = useState<FormMode>("none");
  const [suggested, setSuggested] = useState<SuggestedAction>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formDay, setFormDay] = useState("");
  const [formTime, setFormTime] = useState("");
  const [formTopic, setFormTopic] = useState("");
  const [formError, setFormError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const chat = trpc.receptionist.chat.useMutation();
  const captureLead = trpc.receptionist.captureLead.useMutation();
  const requestBooking = trpc.receptionist.requestBooking.useMutation();
  const busy = chat.isPending || captureLead.isPending || requestBooking.isPending;

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", content: GREETING }]);
    }
  }, [open, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, formMode, open]);

  const pushUser = (content: string) => {
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    return next;
  };

  const sendToServer = async (history: ChatMessage[]) => {
    try {
      const res = await chat.mutateAsync({
        messages: history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
      setSuggested(res.suggestedAction ?? null);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I'm having trouble right now. Tap \"Talk to a human\" and we'll reach out by email." },
      ]);
      setSuggested("lead");
    }
  };

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    setSuggested(null);
    void sendToServer(pushUser(trimmed));
  };

  const handleQuickReply = (qr: (typeof QUICK_REPLIES)[number]) => {
    if ("action" in qr && qr.action) {
      setSuggested(null);
      setFormError("");
      setFormMode(qr.action);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: qr.action === "booking" ? "I'd like to book a call." : "I'd like to talk to a human." },
      ]);
    } else if ("message" in qr && qr.message) {
      handleSend(qr.message);
    }
  };

  const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!formName.trim()) return setFormError("Please enter your name.");
    if (!validEmail(formEmail)) return setFormError("Please enter a valid email address.");
    if (formMode === "booking" && !formDay.trim()) return setFormError("Please enter a preferred day.");
    if (formMode === "booking" && !formTime.trim()) return setFormError("Please enter a preferred time.");
    setFormError("");

    try {
      if (formMode === "booking") {
        await requestBooking.mutateAsync({
          name: formName.trim(),
          email: formEmail.trim(),
          preferredDay: formDay.trim(),
          preferredTime: formTime.trim(),
          topic: formTopic.trim() || undefined,
        });
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Thanks ${formName.trim()}! Your call request is in — we'll confirm ${formDay.trim()} at ${formTime.trim()} by email.`,
          },
        ]);
      } else {
        await captureLead.mutateAsync({
          name: formName.trim(),
          email: formEmail.trim(),
          interest: formTopic.trim() || undefined,
          sourcePage: window.location.pathname,
        });
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Thanks ${formName.trim()}! We've got your details — our team will reach out to ${formEmail.trim()} shortly.`,
          },
        ]);
      }
      setFormMode("none");
      setSuggested(null);
      setFormName("");
      setFormEmail("");
      setFormDay("");
      setFormTime("");
      setFormTopic("");
    } catch {
      setFormError("Something went wrong saving your details. Please try again.");
    }
  };

  const showChips = messages.length <= 1 && formMode === "none";

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[min(500px,72vh)] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between bg-violet-700 px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">Spiral Academy Assistant</p>
              <p className="text-xs text-violet-200">Typically replies instantly</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-full p-1.5 hover:bg-violet-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-violet-50/50 px-4 py-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-md bg-violet-600 text-white"
                      : "rounded-bl-md bg-white text-gray-800 shadow-sm ring-1 ring-violet-100"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {chat.isPending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-sm text-gray-500 shadow-sm ring-1 ring-violet-100">
                  <Loader2 className="h-4 w-4 animate-spin" /> Typing…
                </div>
              </div>
            )}
            {suggested && formMode === "none" && (
              <div className="flex justify-start">
                <button
                  onClick={() => {
                    setFormError("");
                    setFormMode(suggested);
                    setSuggested(null);
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-violet-600 px-3.5 py-2 text-xs font-medium text-white shadow hover:bg-violet-700"
                >
                  {suggested === "booking" ? (
                    <>
                      <CalendarCheck className="h-3.5 w-3.5" /> Book a call
                    </>
                  ) : (
                    <>
                      <User className="h-3.5 w-3.5" /> Talk to a human
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Quick replies */}
          {showChips && (
            <div className="flex flex-wrap gap-2 border-t border-violet-100 bg-white px-4 py-2.5">
              {QUICK_REPLIES.map((qr) => (
                <button
                  key={qr.label}
                  onClick={() => handleQuickReply(qr)}
                  className="rounded-full border border-violet-300 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50"
                >
                  {qr.label}
                </button>
              ))}
            </div>
          )}

          {/* Inline form */}
          {formMode !== "none" && (
            <form onSubmit={handleFormSubmit} className="space-y-2.5 border-t border-violet-100 bg-white px-4 py-3">
              <p className="text-sm font-medium text-gray-800">
                {formMode === "booking" ? "Book a call" : "Talk to a human"}
              </p>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
              />
              <input
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="Email address"
                type="email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
              />
              {formMode === "booking" && (
                <>
                  <div className="flex gap-2">
                    <input
                      value={formDay}
                      onChange={(e) => setFormDay(e.target.value)}
                      placeholder="Preferred day (e.g. Tuesday)"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                    />
                    <input
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      placeholder="Time (e.g. 2pm CT)"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                    />
                  </div>
                  <input
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    placeholder="What would you like to discuss? (optional)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                  />
                </>
              )}
              {formMode === "lead" && (
                <input
                  value={formTopic}
                  onChange={(e) => setFormTopic(e.target.value)}
                  placeholder="What can we help with? (optional)"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
              )}
              {formError && <p className="text-xs text-red-600">{formError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {busy ? "Sending…" : formMode === "booking" ? "Request call" : "Send details"}
                </button>
                <button
                  type="button"
                  onClick={() => setFormMode("none")}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Input */}
          {formMode === "none" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
              }}
              className="flex items-center gap-2 border-t border-violet-100 bg-white px-3 py-2.5"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about courses, pricing…"
                className="flex-1 rounded-full border border-gray-300 px-3.5 py-2 text-sm focus:border-violet-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send message"
                className="rounded-full bg-violet-600 p-2.5 text-white hover:bg-violet-700 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-xl hover:bg-violet-700"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
