"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles, X, Send, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Msg { role: "user" | "assistant"; content: string; }

export function AiChatDrawer() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    const nextMsgs: Msg[] = [...msgs, { role: "user", content: message }];
    setMsgs(nextMsgs);
    setBusy(true);
    try {
      const res = await fetch(`/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("erp.token")}`,
        },
        body: JSON.stringify({ message, history: msgs }),
      });
      const data = await res.json();
      setMsgs([...nextMsgs, { role: "assistant", content: data.reply ?? data.message ?? "—" }]);
    } catch (err) {
      setMsgs([...nextMsgs, { role: "assistant", content: "Error: " + (err as Error).message }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed bottom-6 z-40 shadow-lg rounded-full h-12 w-12 p-0",
          locale === "ar" ? "left-6" : "right-6",
        )}
        aria-label="Open AI"
      >
        <Sparkles className="h-5 w-5" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="w-full max-w-md bg-card border-l flex flex-col h-full">
            <header className="px-5 py-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">{t("aiAssistant")}</h2>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {msgs.length === 0 && (
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>{t("askAnything")}</p>
                  <ul className="space-y-1 mt-3">
                    <li className="text-xs">• What is my total revenue?</li>
                    <li className="text-xs">• Show me unpaid invoices</li>
                    <li className="text-xs">• كم عميلًا لديّ؟</li>
                  </ul>
                </div>
              )}
              {msgs.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg p-3 text-sm whitespace-pre-wrap leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground ml-8"
                      : "bg-secondary text-secondary-foreground mr-8",
                  )}
                >
                  {m.content}
                </div>
              ))}
              {busy && (
                <div className="bg-secondary rounded-lg p-3 mr-8 inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                </div>
              )}
              <div ref={endRef} />
            </div>

            <form onSubmit={send} className="border-t p-3 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t("askAnything")}
                className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button type="submit" disabled={busy || !input.trim()} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
