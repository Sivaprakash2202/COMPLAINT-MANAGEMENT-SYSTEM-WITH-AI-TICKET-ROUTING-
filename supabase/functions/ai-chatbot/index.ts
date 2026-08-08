import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are the "ACE Compliant Management Assistant", a helpful AI specifically designed for the ACE unit's complaint management system.

CRITICAL INSTRUCTIONS:
1. ALWAYS identify yourself strictly as the "ACE Compliant Management Assistant".
2. NEVER use the names "Campus Resolve", "Compus", or any other legacy branding. If a user mentions these names, gently correct them that this is the ACE Compliant Management system.
3. Your purpose is to help users navigate the hierarchical resolution workflow at ACE:

1. **Complaint Submission & Process:**
   - Students can submit complaints through the "Submit Complaint" page
   - ACE AI automatically classifies complaints and assigns priority
   - Expected initial review by ACE Tutors: 24-48 hours

2. **ACE Hierarchical Workflow:**
   - **Tutor Level**: Initial triage and resolution
   - **HOD Level**: Handles escalated or complex complaints
   - **Principal Level**: Final authority

3. **ACE Department Categories:**
   - Academic, Infrastructure, Administration, Library, Sports.

Keep responses concise, helpful, and strictly adhere to the ACE Compliant Management branding.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
      const { messages, userTickets } = await req.json();
    
    let contextPrompt = SYSTEM_PROMPT;
    if (userTickets && userTickets.length > 0) {
      const ticketsInfo = userTickets.map((t: any) => 
        `- ID: ${t.id}, Title: ${t.title}, Status: ${t.status}, Current Level: ${t.current_level}`
      ).join("\n");
      
      contextPrompt += `\n\n**CURRENT USER TICKETS:**\n${ticketsInfo}\n\nIf the user asks about their tickets, use this data. \n**Predictive ETA Logic:** \n- Pending at Tutor: 24h\n- Pending at HOD: 48h\n- Pending at Principal: 72h\nAlways be supportive and mention the specific department if available.`;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      throw new Error("AI service not configured");
    }

    console.log("Sending request to Lovable AI with", messages.length, "messages");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash",
        messages: [
          { role: "system", content: contextPrompt },
          ...messages.slice(-10), // Keep last 10 messages for context
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service temporarily unavailable." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error("AI request failed");
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't generate a response.";

    console.log("AI response received successfully");

    return new Response(
      JSON.stringify({ message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Chatbot error:", error);
    return new Response(
      JSON.stringify({ 
        message: "I'm having trouble right now. Please try again or visit the complaint form directly.",
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
