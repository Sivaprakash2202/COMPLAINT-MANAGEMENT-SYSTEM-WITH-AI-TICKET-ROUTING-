import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  try {
    // Create demo student account
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: "demo.student@acecompliantmanagement.dev",
      password: "Demo@1234",
      email_confirm: true,
      user_metadata: { full_name: "Demo Student" },
    });

    if (authError && !authError.message.includes("already been registered")) {
      throw authError;
    }

    const userId = authData?.user?.id;

    if (userId) {
      // Ensure profile exists
      await supabaseAdmin.from("profiles").upsert({
        user_id: userId,
        full_name: "Demo Student",
        email: "demo.student@acecompliantmanagement.dev",
      }, { onConflict: "user_id" });

      // Ensure student role exists
      await supabaseAdmin.from("user_roles").upsert({
        user_id: userId,
        role: "student",
      }, { onConflict: "user_id,role" });

      // Link existing demo complaints to this user
      await supabaseAdmin
        .from("complaints")
        .update({ submitted_by: userId })
        .eq("submitter_email", "demo.student@acecompliantmanagement.dev");
    }

    return new Response(
      JSON.stringify({ success: true, message: "Demo user ready", userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating demo user:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
