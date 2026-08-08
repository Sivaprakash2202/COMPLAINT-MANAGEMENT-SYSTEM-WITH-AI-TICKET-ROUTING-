-- Create Knowledge Base Table
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    question text NOT NULL,
    answer text NOT NULL,
    category text,
    embedding vector(768),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for vector search
CREATE INDEX IF NOT EXISTS knowledge_base_embedding_idx ON public.knowledge_base USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Enable RLS
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Allow public read access to knowledge base (for AI search)
CREATE POLICY "Allow public read access to knowledge base"
ON public.knowledge_base
FOR SELECT
TO public
USING (true);

-- Function for matching knowledge base items
CREATE OR REPLACE FUNCTION match_knowledge_base (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  question text,
  answer text,
  category text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.question,
    kb.answer,
    kb.category,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM knowledge_base kb
  WHERE 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Seed with initial data
-- Note: Embeddings will need to be generated via an edge function or manual script.
-- For now, we'll insert the text and I'll explain how to populate embeddings.
INSERT INTO public.knowledge_base (question, answer, category) VALUES
('How do I connect to the eduroam secure Wi-Fi?', 'To connect to eduroam: 1. Select the "eduroam" SSID. 2. For identity, use your college email (e.g., student@ace.edu). 3. For password, use your portal password. 4. If on Android, set CA Certificate to "Use system certificates" and Domain to "ace.edu".', 'infrastructure'),
('How can I get my college ID card replaced?', 'Lost ID cards can be replaced at the Administration Block, Room 102. 1. Pay a replacement fee of ₹200 at the accounts desk. 2. Bring the receipt to Room 102. 3. Your new card will be printed instantly.', 'administration'),
('What are the central library timings?', 'The Central Library is open from 8:00 AM to 8:00 PM on weekdays, and 9:00 AM to 4:00 PM on Saturdays. It remains closed on Sundays and public holidays.', 'library'),
('How do I apply for a consolidated marksheet?', 'Applications for consolidated marksheets are processed online via the student portal under the "Examinations" tab. Once applied and fees paid, it takes 7-10 working days to be ready for pickup from the Registrar office.', 'academic');
