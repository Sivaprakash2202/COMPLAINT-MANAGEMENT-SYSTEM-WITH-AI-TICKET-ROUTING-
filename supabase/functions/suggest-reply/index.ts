import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { complaint, level } = await req.json();

    const prompt = `You are an AI Resolution Assistant for college staff (${level}). 
    Draft a professional, empathetic, and action-oriented reply to the following complaint.
    
    Complaint Title: ${complaint.title}
    Description: ${complaint.description}
    Category: ${complaint.category}
    
    The reply should:
    1. Acknowledge the issue.
    2. State that it is being addressed at the ${level} level.
    3. Keep it under 60 words.
    4. End with "Your ACE Resolution Team."`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 150,
      }),
    });

    const aiData = await response.json();
    const suggestion = aiData.choices?.[0]?.message?.content || "Sample reply draft...";

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
