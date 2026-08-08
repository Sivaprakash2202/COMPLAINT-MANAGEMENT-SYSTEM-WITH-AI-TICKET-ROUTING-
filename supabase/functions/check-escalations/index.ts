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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get complaints approaching SLA deadline (within 4 hours)
    const fourHoursFromNow = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    const { data: approachingDeadline, error: fetchError } = await supabase
      .from('complaints')
      .select('id, title, sla_deadline, current_level, status')
      .eq('status', 'pending')
      .or('status.eq.pending,status.eq.in_progress')
      .gt('sla_deadline', now)
      .lt('sla_deadline', fourHoursFromNow);

    if (fetchError) {
      console.error("Error fetching complaints:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${approachingDeadline?.length || 0} complaints approaching SLA deadline`);

    const reminders: { complaint_id: string; sent_to: string; message: string; reminder_type: string }[] = [];

    for (const complaint of approachingDeadline || []) {
      // Get admins at the current level
      const roleToNotify = complaint.current_level || 'tutor';
      
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', roleToNotify);

      for (const admin of admins || []) {
        // Check if reminder already sent for this complaint to this admin
        const { data: existingReminder } = await supabase
          .from('escalation_reminders')
          .select('id')
          .eq('complaint_id', complaint.id)
          .eq('sent_to', admin.user_id)
          .eq('reminder_type', 'sla_warning')
          .single();

        if (!existingReminder) {
          const hoursRemaining = Math.round((new Date(complaint.sla_deadline).getTime() - Date.now()) / (1000 * 60 * 60));
          
          reminders.push({
            complaint_id: complaint.id,
            sent_to: admin.user_id,
            message: `⚠️ SLA Warning: "${complaint.title}" has only ${hoursRemaining} hours remaining before deadline breach.`,
            reminder_type: 'sla_warning',
          });
        }
      }
    }

    // Get complaints that have breached SLA
    const { data: breachedComplaints } = await supabase
      .from('complaints')
      .select('id, title, sla_deadline, current_level, status')
      .or('status.eq.pending,status.eq.in_progress')
      .lt('sla_deadline', now);

    for (const complaint of breachedComplaints || []) {
      let nextLevel = complaint.current_level || 'tutor';
      let updateData: Record<string, string> = {};
      
      // Determine escalation level
      if (complaint.current_level === 'tutor') {
        nextLevel = 'hod';
        updateData = { current_level: 'hod', tutor_status: 'forwarded' };
      } else if (complaint.current_level === 'hod') {
        nextLevel = 'principal';
        updateData = { current_level: 'principal', hod_status: 'forwarded' };
      }

      // Perform the DB update if escalating
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('complaints')
          .update(updateData)
          .eq('id', complaint.id);
          
        if (updateError) {
          console.error(`Failed to escalate complaint ${complaint.id}:`, updateError);
          continue; // Skip reminder if update failed
        }
        console.log(`Escalated complaint ${complaint.id} to ${nextLevel}`);
      }

      const roleToNotify = nextLevel;
      
      const { data: admins } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', roleToNotify);

      for (const admin of admins || []) {
        const { data: existingReminder } = await supabase
          .from('escalation_reminders')
          .select('id')
          .eq('complaint_id', complaint.id)
          .eq('sent_to', admin.user_id)
          .eq('reminder_type', 'sla_breach')
          .single();

        if (!existingReminder) {
          reminders.push({
            complaint_id: complaint.id,
            sent_to: admin.user_id,
            message: `🚨 SLA Breached & Escalated: "${complaint.title}" has been escalated to ${nextLevel.toUpperCase()}. Immediate action required!`,
            reminder_type: 'sla_breach',
          });
        }
      }
    }

    // Insert all reminders
    if (reminders.length > 0) {
      const { error: insertError } = await supabase
        .from('escalation_reminders')
        .insert(reminders);

      if (insertError) {
        console.error("Error inserting reminders:", insertError);
        throw insertError;
      }

      console.log(`Created ${reminders.length} escalation reminders`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        remindersCreated: reminders.length,
        approachingDeadline: approachingDeadline?.length || 0,
        breachedComplaints: breachedComplaints?.length || 0
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Escalation check error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
