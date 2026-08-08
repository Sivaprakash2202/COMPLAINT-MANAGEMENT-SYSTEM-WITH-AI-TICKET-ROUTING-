import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { title, description } = await req.json();

    if (!title && !description) {
      return new Response(JSON.stringify({ duplicates: [] }), { headers: corsHeaders });
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    
    if (!GEMINI_API_KEY) {
      console.warn('GEMINI_API_KEY is missing, skipping duplicate check');
      return new Response(JSON.stringify({ duplicates: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const textToEmbed = `Title: ${title || ''}\nDescription: ${description || ''}`;

    // 1. Get embedding from Google Gemini API
    const embeddingResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: {
            parts: [{ text: textToEmbed }]
          }
        }),
      }
    );

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      console.error('Failed to get embeddings:', errorText);
      throw new Error('Embedding API failed');
    }

    const embeddingData = await embeddingResponse.json();
    const embeddingValues = embeddingData.embedding?.values;

    if (!embeddingValues) {
       throw new Error('No embedding array returned from Gemini');
    }

    // 2. Search Supabase for similar complaints using pgvector
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    const { data: duplicates, error: dbError } = await supabaseClient
      .rpc('match_complaints', {
        query_embedding: embeddingValues,
        match_threshold: 0.82, // 82% similarity threshold for catching duplicates
        match_count: 5 
      });

    if (dbError) {
      console.error('Database match_complaints error:', dbError);
      throw dbError;
    }

    return new Response(
      JSON.stringify({ duplicates: duplicates || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking duplicates:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
