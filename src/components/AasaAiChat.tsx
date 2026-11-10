import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Sparkles, Mic, Send, Bot, User, Loader2 } from "lucide-react";
import { askAasaAi, createSpeechRecognition, supportSpeechRecognition } from "@/lib/aasa-ai";

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
}

export function AasaAiChat() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "ai",
      text: "नमस्ते! मैं आपका आसा AI मुंशी हूँ। आप मुझसे बोलकर या लिखकर मजदूरों की हाजिरी, बकाया और हिसाब पूछ सकते हैं।",
    },
  ]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg: Message = { id: Date.now().toString(), sender: "user", text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const reply = await askAasaAi(query);
      const aiMsg: Message = { id: (Date.now() + 1).toString(), sender: "ai", text: reply };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "ai",
        text: err?.message || "त्रुटि: उत्तर प्राप्त करने में असमर्थ।",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceInput = () => {
    if (!supportSpeechRecognition()) {
      alert("आपके डिवाइस पर वॉयस इनपुट समर्थित नहीं है।");
      return;
    }
    setListening(true);
    const recognition = createSpeechRecognition(
      (transcript) => {
        setListening(false);
        setInput(transcript);
        handleSend(transcript);
      },
      (err) => {
        setListening(false);
        console.error("Speech Recognition Error:", err);
      }
    );
    if (recognition) {
      recognition.start();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-lg mx-auto">
      {/* Header */}
      <Card className="p-3 bg-emerald-600 text-white rounded-xl flex items-center gap-3 shrink-0 mb-3">
        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white animate-pulse" />
        </div>
        <div>
          <h2 className="font-bold text-sm">आसा AI मुंशी</h2>
          <p className="text-[11px] opacity-90">स्मार्ट वॉइस व चैट असिस्टेंट</p>
        </div>
      </Card>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto space-y-3 px-1 pb-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex items-start gap-2 ${
              m.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            {m.sender === "ai" && (
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div
              className={`max-w-[80%] p-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                m.sender === "user"
                  ? "bg-emerald-600 text-white rounded-br-none"
                  : "bg-muted text-foreground rounded-bl-none shadow-sm"
              }`}
            >
              {m.text}
            </div>
            {m.sender === "user" && (
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span>AI मुंशी सोच रहा है...</span>
          </div>
        )}
      </div>

      {/* Input Box */}
      <div className="flex items-center gap-2 pt-2 border-t border-border shrink-0 bg-background">
        <Button
          type="button"
          onClick={handleVoiceInput}
          variant={listening ? "destructive" : "outline"}
          size="icon"
          className="rounded-xl shrink-0 h-11 w-11"
          title="बोलकर पूछें"
        >
          <Mic className={`w-5 h-5 ${listening ? "animate-bounce" : "text-emerald-600"}`} />
        </Button>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="बोलें या लिखें..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="rounded-xl h-11 text-xs sm:text-sm"
        />
        <Button
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 px-4 shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
