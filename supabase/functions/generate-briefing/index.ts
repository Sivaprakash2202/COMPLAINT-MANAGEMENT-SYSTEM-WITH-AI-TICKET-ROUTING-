import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json().catch(() => ({}));
    const { role } = body;
    
    if (role !== "principal") {
      throw new Error("Unauthorized");
    }

    // Fetch stats for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dateStr = sevenDaysAgo.toISOString();

    const { data: recentComplaints, error: complaintsError } = await supabaseClient
      .from("complaints")
      .select("status, category, created_at")
      .gte("created_at", dateStr);

    if (complaintsError) throw complaintsError;

    const total = recentComplaints.length;
    const resolved = recentComplaints.filter(c => c.status === "resolved").length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    // Count categories
    const categories: Record<string, number> = {};
    recentComplaints.forEach(c => {
      categories[c.category] = (categories[c.category] || 0) + 1;
    });
    const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || "None";

    const prompt = `You are an AI Executive Assistant for a College Principal. 
    Summarize the following raw data into a 3-sentence "Morning Briefing". 
    Focus on trends, urgency, and one positive note.
    
    Data:
    - Total tickets in last 7 days: ${total}
    - Resolution rate: ${resolutionRate}%
    - Most active category: ${topCategory}
    
    Make it professional and concise.`;

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
        max_tokens: 200,
      }),
    });

    const aiData = await response.json();
    const briefing = aiData.choices?.[0]?.message?.content || "Could not generate briefing.";

    return new Response(JSON.stringify({ briefing }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
