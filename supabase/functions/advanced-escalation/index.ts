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
    const { complaint_id, risk_score } = await req.json();
    console.log(`Emergency escalation for complaint: ${complaint_id} (Risk: ${risk_score})`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch complaint and submitter details
    const { data: complaint, error: fetchError } = await supabase
      .from("complaints")
      .select("*, profiles!complaints_user_id_fkey(*)")
      .eq("id", complaint_id)
      .single();

    if (fetchError || !complaint) {
       throw new Error(`Failed to fetch complaint: ${fetchError?.message}`);
    }

    // 2. Determine who to notify (Principal for risk > 0.9, HOD otherwise)
    const targetRole = risk_score > 0.9 ? "principal" : "hod";
    
    // Get admins for this role
    let query = supabase.from("user_roles").select("user_id, profiles(*)").eq("role", targetRole);
    
    // If HOD, filter by department
    if (targetRole === "hod") {
       // Note: This logic assumes HODs are assigned to specific departments in their profiles
       // We'll just get all HODs for now or filter if the schema supports it
    }

    const { data: admins } = await query;

    if (!admins || admins.length === 0) {
       console.log(`No ${targetRole} found to notify`);
       return new Response(JSON.stringify({ success: false, message: "No recipients found" }), {
         headers: { ...corsHeaders, "Content-Type": "application/json" },
       });
    }

    // 3. Send notifications via existing send-notification function
    for (const admin of admins) {
       const adminProfile = admin.profiles;
       if (adminProfile?.email) {
          await supabase.functions.invoke("send-notification", {
            body: {
              complaint_id: complaint.id,
              notification_type: "escalation",
              recipient_email: adminProfile.email,
              recipient_name: adminProfile.full_name,
              subject: `🚨 EMERGENCY ESCALATION: ${complaint.title}`,
              body: `
                <h2>High Risk Complaint Detected</h2>
                <p>A complaint has been automatically escalated due to <strong>Emergency Sentiment/Risk</strong>.</p>
                <div style="background: #fee2e2; border: 1px solid #ef4444; padding: 15px; border-radius: 5px;">
                  <p><strong>Title:</strong> ${complaint.title}</p>
                  <p><strong>Risk Score:</strong> ${(risk_score * 100).toFixed(1)}%</p>
                  <p><strong>Sentiment:</strong> ${complaint.sentiment}</p>
                  <p><strong>Department:</strong> ${complaint.category}</p>
                </div>
                <p>Immediate intervention may be required as this issue has bypassed the standard 24-hour review cycle.</p>
              `
            }
          });
       }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in advanced-escalation:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
