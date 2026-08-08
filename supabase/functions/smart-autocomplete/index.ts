import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an AI assistant helping students write better complaint submissions for a university complaint management system.

Based on the user's partial input, suggest completions that are:
1. Clear and professional
2. Specific and actionable
3. Appropriate for an academic/institutional context

Categories include: academic, infrastructure, administration, library, sports

Respond with a JSON array of 2-3 suggestion strings only. No explanations.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, field, category } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = field === "title"
      ? `The user is writing a complaint title in the ${category || 'general'} category. Their partial input is: "${text}". Suggest 3 complete, professional complaint titles that start with or relate to what they've typed.`
      : `The user is writing a complaint description in the ${category || 'general'} category. Their partial input is: "${text}". Suggest 2 complete, detailed complaint descriptions that expand on what they've started writing. Each should be 2-3 sentences.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.error("AI API error:", response.status);
      return new Response(
        JSON.stringify({ suggestions: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "[]";
    
    // Parse the JSON array from the response
    let suggestions: string[] = [];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        suggestions = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse suggestions:", parseError);
      // Fallback: split by newlines and clean up
      suggestions = content
        .split('\n')
        .filter((line: string) => line.trim().length > 0)
        .slice(0, 3)
        .map((line: string) => line.replace(/^[\d\-\*\.\)]+\s*/, '').trim());
    }

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Smart autocomplete error:", error);
    return new Response(
      JSON.stringify({ suggestions: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
