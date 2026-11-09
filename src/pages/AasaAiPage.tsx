import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Mic, MicOff, Send, Bot, User, Sparkles, Loader2 } from "lucide-react";
import { askAasaAi, supportSpeechRecognition, createSpeechRecognition } from "@/lib/aasa-ai-client";
import { toast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "आज की कुल हाजिरी बताओ",
  "मजदूरों का कुल बकाया कितना है?",
  "इस महीने की कुल कमाई कितनी है?",
  "किस-किस मजदूर को एडवांस दिया गया है?",
  "रामलाल का हिसाब बताओ",
  "इस महीने का कुल भुगतान (Paid) कितना है?"
];

export default function AasaAiPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "नमस्ते ठेकेदार साहब! मैं **आसा AI** हूँ। आप मुझसे अपने मजदूरों की हाजिरी, बकाया या पेरोल के बारे में कुछ भी पूछ सकते हैं।"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const promptText = textToSend || input;
    if (!promptText.trim() || loading) return;

    if (promptText.length > 300) {
      toast({ title: "संदेश बहुत बड़ा है", description: "कृपया 300 अक्षरों के भीतर सवाल पूछें।", variant: "destructive" });
      return;
    }

    const userMessage: Message = { role: "user", content: promptText };
    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInput("");
    setLoading(true);

    try {
      const reply = await askAasaAi(promptText);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err: any) {
      toast({ title: "त्रुटि", description: err.message || "उत्तर प्राप्त करने में विफल", variant: "destructive" });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "क्षमा करें, आसा AI से संपर्क करने में समस्या आ रही है। कृपया कुछ देर बाद पुनः प्रयास करें।" }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Voice Recognition Handler
  const toggleListening = () => {
    if (!supportSpeechRecognition()) {
      toast({ title: "समर्थित नहीं है", description: "आपका ब्राउज़र वॉइस रिकग्निशन का समर्थन नहीं करता। कृपया टाइप करें।", variant: "destructive" });
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const recognition = createSpeechRecognition(
      (transcript) => {
        setInput(transcript);
        setIsListening(false);
        handleSend(transcript);
      },
      (err) => {
        console.error("Speech error:", err);
        setIsListening(false);
        toast({ title: "माइक त्रुटि", description: "आवाज़ पहचानने में विफल। कृपया टाइप करें।", variant: "destructive" });
      }
    );

    if (recognition) {
      try {
        recognition.start();
        setIsListening(true);
      } catch (e) {
        setIsListening(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-2xl mx-auto p-3 sm:p-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between bg-card border border-border/60 rounded-2xl p-3 shadow-sm mb-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold">आसा AI असिस्टेंट</h1>
              <p className="text-[10px] text-muted-foreground font-semibold">आशापुरा सम्राट स्मार्ट मुंशी</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Prompts Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
        {QUICK_PROMPTS.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSend(prompt)}
            disabled={loading}
            className="shrink-0 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60 rounded-full px-3 py-1.5 font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex items-start gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
          >
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground font-bold text-xs"
                  : "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div
              className={`max-w-[80%] rounded-2xl p-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-none"
                  : "bg-card border border-border/60 shadow-sm rounded-tl-none"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            <span>आसा AI सोच रहा है...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="mt-3 bg-card border border-border/60 rounded-2xl p-2 shadow-sm flex items-center gap-2">
        <Button
          type="button"
          variant={isListening ? "destructive" : "outline"}
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl"
          onClick={toggleListening}
        >
          {isListening ? <MicOff className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5 text-emerald-600" />}
        </Button>
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="यहाँ सवाल टाइप करें या बोलें..."
          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-sm"
          disabled={loading}
        />
        <Button
          type="button"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => handleSend()}
          disabled={loading || !input.trim()}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
