import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SentimentRequest {
  complaint_id: string;
  title: string;
  description: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { complaint_id, title, description }: SentimentRequest = await req.json();
    console.log(`Analyzing sentiment for complaint: ${complaint_id}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a sentiment analysis expert. Analyze the emotional tone of complaint messages.
            
Return a JSON object with:
- sentiment: one of "positive", "neutral", "negative", "frustrated", "angry"
- score: number from -1 (very negative) to 1 (very positive)
- urgency_flag: boolean, true if the message indicates urgent attention needed
- key_emotions: array of detected emotions

Only respond with valid JSON, no markdown or explanation.`,
          },
          {
            role: "user",
            content: `Analyze this complaint:
Title: ${title}
Description: ${description}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "analyze_sentiment",
              description: "Return sentiment analysis results",
              parameters: {
                type: "object",
                properties: {
                  sentiment: {
                    type: "string",
                    enum: ["positive", "neutral", "negative", "frustrated", "angry"],
                  },
                  score: { type: "number", minimum: -1, maximum: 1 },
                  urgency_flag: { type: "boolean" },
                  key_emotions: { type: "array", items: { type: "string" } },
                },
                required: ["sentiment", "score", "urgency_flag", "key_emotions"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "analyze_sentiment" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI Response:", JSON.stringify(data));

    let result;
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback parsing
      const content = data.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { sentiment: "neutral", score: 0, urgency_flag: false, key_emotions: [] };
    }

    // Calculate risk score: (Sentiment -1 to 1) converted to 0 to 1 weight, plus category risk
    // We'll normalize sentiment score (s) from -1...1 to 0...1 (where 1 is worst/angry)
    const sentimentRisk = (1 - result.score) / 2; // -1 -> 1, 0 -> 0.5, 1 -> 0
    let categoryRisk = 0;
    
    // Update complaint with sentiment data and risk score
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: complaintData } = await supabase
      .from("complaints")
      .select("category")
      .eq("id", complaint_id)
      .single();
    
    const categoryWeights: Record<string, number> = {
      'infrastructure': 0.4, // Safety issues usually here
      'academic': 0.2,
      'sports': 0.1,
      'library': 0.1,
      'administration': 0.2
    };

    categoryRisk = categoryWeights[complaintData?.category || 'administration'] || 0.2;
    const totalRisk = Math.min(1.0, sentimentRisk + categoryRisk);

    const { error: updateError } = await supabase
      .from("complaints")
      .update({
        sentiment: result.sentiment,
        sentiment_score: result.score,
        risk_score: totalRisk
      })
      .eq("id", complaint_id);

    if (updateError) {
      console.error("Failed to update complaint sentiment:", updateError);
    }

    // If total risk > 0.8 OR urgent sentiment, escalate immediately
    if (totalRisk > 0.8 || result.urgency_flag || result.sentiment === "angry") {
      const { error: priorityError } = await supabase
        .from("complaints")
        .update({ priority: "urgent" })
        .eq("id", complaint_id)
        .neq("priority", "urgent");

      if (!priorityError) {
        console.log("Complaint escalated to urgent priority due to risk/sentiment");
        // Trigger emergency notification
        await supabase.functions.invoke("advanced-escalation", {
          body: { complaint_id: complaint_id, risk_score: totalRisk }
        });
      }
    }

    console.log(`Sentiment analysis complete: ${result.sentiment} (${result.score})`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-sentiment function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
