import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting map (in-memory, simple protection)
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. JWT Authentication Verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: No token provided' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    // 2. Rate Limiting: Max 10 requests per user per minute
    const now = Date.now();
    const userLimit = rateLimitMap.get(userId);
    if (userLimit) {
      if (now - userLimit.timestamp < 60000) {
        if (userLimit.count >= 10) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a minute.' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        userLimit.count++;
      } else {
        rateLimitMap.set(userId, { count: 1, timestamp: now });
      }
    } else {
      rateLimitMap.set(userId, { count: 1, timestamp: now });
    }

    // 3. Parse Request Body
    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== 'string' || prompt.length > 300) {
      return new Response(JSON.stringify({ error: 'Invalid prompt or exceeds 300 characters.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Fetch User's Data Safely using RLS
    const { data: workers } = await supabase.from('workers').select('id, name, daily_rate, site_name');
    const { data: attendance } = await supabase.from('attendance').select('worker_id, status, advance, date, site_name');

    // Prepare structural facts for AI (Anti-Hallucination Pipeline)
    const financialFacts = {
      total_workers: workers?.length || 0,
      workers_list: workers || [],
      recent_attendance_count: attendance?.length || 0,
      note: "Do not invent financial figures. Use only these facts."
    };

    // 5. Call Lovable AI Gateway (Gemini)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured in environment variables.');
    }

    const aiResponse = await fetch('https://api.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `आप "आशापुरा सम्राट" ऐप के एआई मुंशी हैं। ठेकेदार के सवालों के जवाब शुद्ध, सम्मानजनक और सरल हिंदी में दें। 
            नीचे दिए गए 'FACTS' के अलावा कोई भी आंकड़ा या राशि अपने मन से न गढ़ें। यदि जानकारी उपलब्ध न हो, तो साफ कहें कि रिकॉर्ड में यह जानकारी नहीं है।
            FACTS: ${JSON.stringify(financialFacts)}`
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    const aiData = await aiResponse.json();
    const reply = aiData.choices?.[0]?.message?.content || 'क्षमा करें, आसा AI अभी उत्तर देने में असमर्थ है।';

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
