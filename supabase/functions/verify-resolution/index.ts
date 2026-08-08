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
    const { complaint_id } = await req.json();
    console.log(`Verifying resolution for complaint: ${complaint_id}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch complaint data including attachments and resolution image
    const { data: complaint, error: fetchError } = await supabase
      .from("complaints")
      .select("*, complaint_attachments(*)")
      .eq("id", complaint_id)
      .single();

    if (fetchError || !complaint) {
      throw new Error(`Complaint not found: ${fetchError?.message}`);
    }

    const beforeImage = complaint.complaint_attachments?.[0]?.file_path;
    const afterImage = complaint.resolution_image;

    if (!beforeImage || !afterImage) {
      return new Response(JSON.stringify({ 
        error: "Both before and after images are required for verification",
        verified: false 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch images from storage and convert to base64
    const getBase64 = async (path: string) => {
      const { data, error } = await supabase.storage
        .from("complaint-attachments")
        .download(path);
      if (error) throw error;
      const arrayBuffer = await data.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8Array.byteLength; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      return btoa(binary);
    };

    const [beforeBase64, afterBase64] = await Promise.all([
      getBase64(beforeImage),
      getBase64(afterImage)
    ]);

    // 3. Compare images using Gemini Vision
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "Compare these two images. Image 1 is the 'Before' (the problem) and Image 2 is the 'After' (the resolution). Did the issue described in the before image get fixed in the after image? Respond with a JSON object: { 'match_score': 0.0-1.0, 'is_fixed': boolean, 'reason': 'short explanation' }. Focus on evidence of repair, cleaning, or restoration." },
            { inline_data: { mime_type: "image/jpeg", data: beforeBase64 } },
            { inline_data: { mime_type: "image/jpeg", data: afterBase64 } }
          ]
        }]
      })
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${await response.text()}`);
    }

    const geminiData = await response.json();
    const aiResponseText = geminiData.candidates[0].content.parts[0].text;
    const aiResult = JSON.parse(aiResponseText.match(/\{[\s\S]*\}/)[0]);

    // 4. Update complaint status
    const verificationStatus = aiResult.match_score > 0.7 ? "verified" : "rejected";
    
    await supabase
      .from("complaints")
      .update({ verification_status: verificationStatus })
      .eq("id", complaint_id);

    // 5. Notify student if rejected
    if (verificationStatus === "rejected") {
      const { data: submitter } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", complaint.user_id)
        .single();

      if (submitter?.email) {
        await supabase.functions.invoke("send-notification", {
          body: {
            complaint_id: complaint.id,
            notification_type: "status_change",
            recipient_email: submitter.email,
            recipient_name: submitter.full_name,
            subject: `⚠️ Resolution Verification Failed: ${complaint.title}`,
            body: `
              <p>Hi ${submitter.full_name},</p>
              <p>The resolution proof provided for your complaint <strong>"${complaint.title}"</strong> could not be verified by our AI system.</p>
              <p><strong>Reason:</strong> ${aiResult.reason}</p>
              <p>The ticket has been flagged for manual review by the Department Head. You can provide more feedback in the complaint chat.</p>
            `
          }
        });
      }
    }

    return new Response(JSON.stringify({ 
      verified: verificationStatus === "verified",
      ai_result: aiResult
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in verify-resolution:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
