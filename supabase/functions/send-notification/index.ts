import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  complaint_id: string;
  notification_type: "status_change" | "resolution" | "escalation";
  recipient_email: string;
  recipient_mobile?: string | null;
  recipient_name?: string;
  subject: string;
  body: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseKey);
    const {
      complaint_id,
      notification_type,
      recipient_email,
      recipient_mobile,
      recipient_name,
      subject,
      body,
    }: NotificationRequest = await req.json();

    console.log(`Processing notification for complaint: ${complaint_id}, type: ${notification_type}`);

    // Store notification in database
    const { data: notification, error: insertError } = await supabase
      .from("notifications")
      .insert({
        complaint_id,
        notification_type,
        recipient_email,
        subject,
        body,
        status: resendApiKey ? "pending" : "email_disabled",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert notification:", insertError);
      throw new Error("Failed to store notification");
    }

    // Send email via Resend if API key is configured
    if (resendApiKey) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "ACE Compliant Management Complaint Management <onboarding@resend.dev>",
            to: [recipient_email],
            subject: subject,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 24px 20px; border-radius: 8px 8px 0 0; }
                  .header h1 { margin: 0 0 4px; font-size: 22px; }
                  .header p { margin: 0; opacity: 0.85; font-size: 13px; }
                  .content { background: #f9fafb; padding: 24px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
                  .content h2 { color: #1f2937; margin-top: 0; }
                  .detail-box { background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin: 16px 0; }
                  .detail-box ul { margin: 0; padding-left: 20px; }
                  .detail-box li { margin-bottom: 6px; }
                  .footer { text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px; }
                  .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; background: #ede9fe; color: #7c3aed; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>🎓 ACE Compliant Management</h1>
                    <p>Complaint Management System</p>
                  </div>
                  <div class="content">
                    ${body}
                    <div class="detail-box">
                      <strong>Complaint ID:</strong> <span class="badge">${complaint_id.split("-")[0].toUpperCase()}</span><br/>
                      <small style="color:#6b7280">Keep this for reference when tracking your complaint.</small>
                    </div>
                    <p style="color:#6b7280;font-size:13px">You can track your complaint status anytime on the ACE Compliant Management portal.</p>
                  </div>
                  <div class="footer">
                    <p>This is an automated message from ACE Compliant Management. Please do not reply to this email.</p>
                  </div>
                </div>
              </body>
              </html>
            `,
          }),
        });

        if (emailResponse.ok) {
          await supabase
            .from("notifications")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", notification.id);
          console.log("Email sent successfully to", recipient_email);
        } else {
          const errorText = await emailResponse.text();
          console.error("Failed to send email:", errorText);
          await supabase
            .from("notifications")
            .update({ status: "failed" })
            .eq("id", notification.id);
        }
      } catch (emailError) {
        console.error("Email sending error:", emailError);
        await supabase
          .from("notifications")
          .update({ status: "failed" })
          .eq("id", notification.id);
      }

      // Send SMS via Twilio
      if (recipient_mobile) {
        const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");
        if (twilioSid && twilioToken && twilioFrom) {
          try {
            const smsResponse = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`,
              {
                method: "POST",
                headers: {
                  Authorization: `Basic ${btoa(`${twilioSid}:${twilioToken}`)}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  To: recipient_mobile,
                  From: twilioFrom,
                  Body: `ACE Compliant Management: ${subject}. Complaint ID: ${complaint_id.split("-")[0].toUpperCase()}. Track your complaint on the portal.`,
                }),
              }
            );
            if (smsResponse.ok) {
              console.log(`SMS sent successfully to ${recipient_mobile}`);
            } else {
              const smsError = await smsResponse.text();
              console.error("Failed to send SMS:", smsError);
            }
          } catch (smsErr) {
            console.error("SMS sending error:", smsErr);
          }
        } else {
          console.log("Twilio credentials not configured, SMS not sent");
        }
      }
    } else {
      console.log("RESEND_API_KEY not configured, email not sent");
    }

    return new Response(JSON.stringify({ success: true, notification_id: notification.id }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: unknown) {
    console.error("Error in send-notification function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
