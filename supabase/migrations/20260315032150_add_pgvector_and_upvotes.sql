-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Add embedding vector column to complaints (Gemini embeddings are typically 768 dimensions)
alter table public.complaints add column if not exists embedding vector(768);

-- Create a table for users to upvote/associate themselves with a megathread complaint
create table if not exists public.complaint_upvotes (
    id uuid default gen_random_uuid() primary key,
    complaint_id uuid references public.complaints(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(complaint_id, user_id)
);

-- Enable RLS on the new table
alter table public.complaint_upvotes enable row level security;

-- Create policies for complaint_upvotes
create policy "Users can see upvotes for complaints they are interested in" on public.complaint_upvotes
    for select using (auth.role() = 'authenticated');

create policy "Users can upvote a complaint" on public.complaint_upvotes
    for insert with check (auth.uid() = user_id);

create policy "Users can remove their own upvote" on public.complaint_upvotes
    for delete using (auth.uid() = user_id);

create policy "Admins can view all upvotes" on public.complaint_upvotes
    for all using (
        exists (
            select 1 from public.user_roles 
            where user_roles.user_id = auth.uid() 
            and role in ('tutor', 'hod', 'principal')
        )
    );

-- Create a function to search for matching complaints using pgvector's cosine distance operator (<=>)
create or replace function match_complaints (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  department_filter public.department_type default null
)
returns table (
  id uuid,
  title text,
  description text,
  category public.department_type,
  status public.complaint_status,
  similarity float
)
language sql stable
as $$
  select
    complaints.id,
    complaints.title,
    complaints.description,
    complaints.category,
    complaints.status,
    1 - (complaints.embedding <=> query_embedding) as similarity
  from complaints
  where complaints.embedding is not null
    -- Only match open/ongoing complaints, not fully resolved or rejected ones
    and complaints.status in ('pending', 'in_progress')
    -- Apply optional department filter
    and (department_filter is null or complaints.category = department_filter)
    -- Filter by threshold
    and 1 - (complaints.embedding <=> query_embedding) > match_threshold
  order by complaints.embedding <=> query_embedding
  limit match_count;
$$;
