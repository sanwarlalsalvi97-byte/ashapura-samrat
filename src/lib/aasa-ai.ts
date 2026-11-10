import { supabase } from "@/integrations/supabase/client";

export interface AasaAiResponse {
  reply?: string;
  error?: string;
}

/**
 * आसा AI एज फंक्शन को सुरक्षित रूप से कॉल करने का क्लाइंट फंक्शन
 */
export async function askAasaAi(prompt: string): Promise<string> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error("कृपया पहले लॉगिन करें। सत्र समाप्त हो गया है।");
    }

    const token = session.access_token;

    const { data, error } = await supabase.functions.invoke("aasa-ai", {
      body: { prompt },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (error) {
      throw new Error(error.message || "आसा AI से संपर्क करने में विफल।");
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data?.reply || "क्षमा करें, आसा AI से कोई उत्तर प्राप्त नहीं हुआ।";
  } catch (err: any) {
    console.error("Aasa AI Client Error:", err);
    throw err;
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
