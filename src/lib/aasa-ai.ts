import { supabase } from "@/integrations/supabase/client";

export interface AasaAiResponse {
  reply?: string;
  error?: string;
}

/**
 * आसा AI मुंशी - सीधे Supabase डेटाबेस से मजदूरों और हाजिरी का हिसाब खोज कर जवाब देता है
 */
export async function askAasaAi(prompt: string): Promise<string> {
  try {
    const text = prompt.trim().toLowerCase();

    // 1. सभी मजदूरों की लिस्ट लाएं
    const { data: workers, error: workerErr } = await supabase.from("workers").select("*");
    if (workerErr) throw workerErr;

    // 2. सभी हाजिरी की लिस्ट लाएं
    const { data: attendance, error: attErr } = await supabase.from("attendance").select("*");
    if (attErr) throw attErr;

    // यदि कोई मजदूर का नाम पूछा जा रहा है
    if (text.includes("हाजिरी") || text.includes("कितनी है") || text.includes("हिसाब")) {
      const foundWorker = workers?.find((w) => text.includes(w.name.toLowerCase()));

      if (foundWorker) {
        const workerAtt = attendance?.filter((a) => a.worker_id === foundWorker.id) || [];
        const presentCount = workerAtt.filter((a) => a.status === "present").length;
        const halfCount = workerAtt.filter((a) => a.status === "half").length;
        const totalDays = presentCount + (halfCount * 0.5);
        const totalAdvance = workerAtt.reduce((sum, a) => sum + (Number(a.advance) || 0), 0);

        return `${foundWorker.name} (${foundWorker.site_name || "साइट तय नहीं"}) का कुल हिसाब:\n- कुल हाजिरी: ${totalDays} दिन\n- कुल एडवांस: ₹${totalAdvance}`;
      } else {
        return `कुल ${workers?.length || 0} मजदूर दर्ज हैं। कृपया किसी विशिष्ट मजदूर का नाम लेकर पूछें, जैसे: "सांवर लाल की हाजिरी कितनी है?"`;
      }
    }

    // सामान्य स्वागत या अन्य सवाल
    return `नमस्ते! आपके पास कुल ${workers?.length || 0} मजदूर रजिस्टर्ड हैं। आप किसी भी मजदूर की हाजिरी या एडवांस के बारे में पूछ सकते हैं।`;

  } catch (err: any) {
    console.error("Aasa AI Local Error:", err);
    return "क्षमा करें, डेटा पढ़ने में कुछ त्रुटि, कृपया पुनः प्रयास करें।";
  }
}

/**
 * वेब स्पीच API (हिंदी वॉयस रिकग्निशन) के लिए हेल्पर
 */
export function supportSpeechRecognition(): boolean {
  return typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

export function createSpeechRecognition(onResult: (text: string) => void, onError: (err: any) => void) {
  const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognitionAPI) return null;

  const recognition = new SpeechRecognitionAPI();
  recognition.lang = "hi-IN";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    onResult(transcript);
  };

  recognition.onerror = (event: any) => {
    onError(event.error);
  };

  return recognition;
}
