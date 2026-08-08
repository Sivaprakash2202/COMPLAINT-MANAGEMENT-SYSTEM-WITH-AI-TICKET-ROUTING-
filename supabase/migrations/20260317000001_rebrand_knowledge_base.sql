-- 0. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Create Knowledge Base Table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    question text NOT NULL,
    answer text NOT NULL,
    category text,
    embedding vector(768),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Ensure RLS is enabled and public read access is allowed
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read access to knowledge base') THEN
        CREATE POLICY "Allow public read access to knowledge base" ON public.knowledge_base FOR SELECT TO public USING (true);
    END IF;
END $$;

-- 3. Create or replace the match function
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

-- 4. Rebrand existing entries and seed initial data if table was empty
UPDATE public.knowledge_base
SET 
  question = REPLACE(REPLACE(REPLACE(REPLACE(question, 'CampusResolve', 'ACE Compliant Management'), 'Campus Resolve', 'ACE Compliant Management'), 'Compus', 'ACE'), 'Campus', 'ACE'),
  answer = REPLACE(REPLACE(REPLACE(REPLACE(answer, 'CampusResolve', 'ACE Compliant Management'), 'Campus Resolve', 'ACE Compliant Management'), 'Compus', 'ACE'), 'Campus', 'ACE');

-- Seed branded data if table is empty (avoiding legacy names from the start)
INSERT INTO public.knowledge_base (question, answer, category)
SELECT 'How do I connect to the ACE secure Wi-Fi?', 'To connect: 1. Select the "eduroam" SSID. 2. For identity, use your ACE institutional email (e.g., student@ace.edu). 3. For password, use your portal password.', 'infrastructure'
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_base WHERE question LIKE '%Wi-Fi%');

-- Cleanup remaining legacy patterns
UPDATE public.knowledge_base
SET answer = REPLACE(answer, 'college email (e.g., student@ace.edu)', 'ACE institutional email (e.g., student@ace.edu)')
WHERE answer LIKE '%college email%';
