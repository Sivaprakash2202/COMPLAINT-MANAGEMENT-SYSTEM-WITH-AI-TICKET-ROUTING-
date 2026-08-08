import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const DEPARTMENTS = ['academic', 'infrastructure', 'administration', 'library', 'sports'] as const;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('classify-complaint: Payload received', { 
      keys: Object.keys(payload),
      hasImage: !!payload.imageBase64,
      imageLength: payload.imageBase64?.length,
      hasMime: !!payload.mimeType,
      mimeType: payload.mimeType
    });
    const { title, description, imageBase64, mimeType } = payload;
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      throw new Error('AI service not configured');
    }

    let messages = [];
    
    if (imageBase64) {
      // Smart Lens Mode
      const finalMime = mimeType || 'image/jpeg';
      console.log('Smart Lens analysis requested', { finalMime });
      messages = [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: "You are a helpful assistant analyzing user-uploaded images for a campus complaint management system. Briefly describe the issue shown in the image, suggest a short, clear complaint 'title', a detailed 'description', and the most relevant 'category'. The available departments are: academic, infrastructure, administration, library, sports. Also determine the priority: low, medium, high, or urgent. Return ONLY a JSON object with strictly lowercase keys: 'title', 'description', 'department', 'priority', and 'confidence' (0.0-1.0). Ensure the department is exactly one of the allowed strings."
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${finalMime};base64,${imageBase64}`
              }
            }
          ]
        }
      ];
    } else {
      // Standard Text Classification Mode
      console.log('Text classification requested');
      if (!title || !description) {
        return new Response(
          JSON.stringify({ error: 'Title and description are required for text classification' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      messages = [
        {
          role: 'system',
          content: `You are a complaint classification AI for a college campus. 
          Available departments: academic, infrastructure, administration, library, sports.
          Priority levels: low, medium, high, urgent.
          Respond ONLY with valid JSON: {"department": "one_of_the_departments", "priority": "low|medium|high|urgent", "confidence": 0.0-1.0}`
        },
        {
          role: 'user',
          content: `Classify this complaint:\n\nTitle: ${title}\n\nDescription: ${description}`
        }
      ];
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash',
        messages,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `AI Analysis failed: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log('AI response received');

    // Parse the AI response
    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError, content);
      throw new Error('Invalid response format from AI');
    }

    // Standardize keys for the return
    const finalResult = {
      department: result.department || result.category || 'administration',
      priority: result.priority || 'medium',
      confidence: result.confidence || 0.8,
      title: result.title,
      description: result.description
    };

    // Validate department
    if (!DEPARTMENTS.includes(finalResult.department as any)) {
      finalResult.department = 'administration';
    }

    return new Response(
      JSON.stringify(finalResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in unified AI function:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'AI process failed',
        department: 'administration',
        priority: 'medium',
        confidence: 0
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
