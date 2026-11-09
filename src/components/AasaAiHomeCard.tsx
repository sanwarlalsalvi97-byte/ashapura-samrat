import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, MessageSquareText } from "lucide-react";

export function AasaAiHomeCard() {
  const navigate = useNavigate();

  return (
    <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-50/80 via-card to-emerald-50/30 dark:from-emerald-950/30 dark:to-card shadow-md hover:shadow-lg transition-all rounded-2xl overflow-hidden mb-4">
      <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shrink-0">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-foreground">आसा AI मुंशी</h2>
              <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                स्मार्ट असिस्टेंट
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              बोलकर या लिखकर मजदूरों की हाजिरी और बकाया तुरंत पूछें।
            </p>
          </div>
        </div>
        <Button
          onClick={() => navigate("/aasa-ai")}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shrink-0 font-bold px-4 gap-1.5 shadow-sm"
        >
          <span>बात करें</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
