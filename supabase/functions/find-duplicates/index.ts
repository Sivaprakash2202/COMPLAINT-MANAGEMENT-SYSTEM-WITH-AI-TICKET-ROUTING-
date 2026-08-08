import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DuplicateRequest {
  title: string;
  description: string;
  category?: string;
  exclude_id?: string;
}

interface SimilarComplaint {
  id: string;
  title: string;
  status: string;
  similarity_score: number;
  created_at: string;
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

    const { title, description, category, exclude_id }: DuplicateRequest = await req.json();
    console.log(`Finding duplicates for: ${title}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch recent complaints to compare against
    let query = supabase
      .from("complaints")
      .select("id, title, description, status, category, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (category) {
      query = query.eq("category", category);
    }

    if (exclude_id) {
      query = query.neq("id", exclude_id);
    }

    const { data: existingComplaints, error: fetchError } = await query;

    if (fetchError) {
      console.error("Failed to fetch complaints:", fetchError);
      throw new Error("Failed to fetch existing complaints");
    }

    if (!existingComplaints || existingComplaints.length === 0) {
      return new Response(JSON.stringify({ similar: [], message: "No existing complaints to compare" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI to find similar complaints
    const complaintsForAI = existingComplaints.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description.substring(0, 200),
      status: c.status,
    }));

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
            content: `You are a duplicate complaint detector. Compare the new complaint with existing ones and identify similar issues.
            
Consider complaints similar if they:
- Report the same underlying problem
- Mention the same location/facility
- Describe similar symptoms or issues
- Could be grouped for batch resolution

Return only IDs of similar complaints with similarity scores (0.0 to 1.0).`,
          },
          {
            role: "user",
            content: `New complaint:
Title: ${title}
Description: ${description}

Existing complaints to compare:
${JSON.stringify(complaintsForAI, null, 2)}

Find complaints with similarity > 0.6`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "report_similar",
              description: "Report similar complaints found",
              parameters: {
                type: "object",
                properties: {
                  similar_complaints: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        similarity_score: { type: "number", minimum: 0, maximum: 1 },
                        reason: { type: "string" },
                      },
                      required: ["id", "similarity_score"],
                    },
                  },
                },
                required: ["similar_complaints"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "report_similar" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    let result: { similar_complaints: Array<{ id: string; similarity_score: number; reason?: string }> };
    
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    } else {
      result = { similar_complaints: [] };
    }

    // Enrich with complaint details
    const similarWithDetails: SimilarComplaint[] = result.similar_complaints
      .filter(s => s.similarity_score >= 0.6)
      .map(s => {
        const complaint = existingComplaints.find(c => c.id === s.id);
        return complaint ? {
          id: s.id,
          title: complaint.title,
          status: complaint.status,
          similarity_score: s.similarity_score,
          created_at: complaint.created_at,
        } : null;
      })
      .filter((s): s is SimilarComplaint => s !== null)
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, 5);

    console.log(`Found ${similarWithDetails.length} similar complaints`);

    return new Response(JSON.stringify({ similar: similarWithDetails }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in find-duplicates function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", similar: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
