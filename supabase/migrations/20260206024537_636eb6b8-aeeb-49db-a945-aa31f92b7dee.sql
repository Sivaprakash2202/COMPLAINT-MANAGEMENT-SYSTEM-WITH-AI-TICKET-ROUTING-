-- Step 1: Create workflow level enum
CREATE TYPE public.workflow_level AS ENUM ('tutor', 'hod', 'principal');

-- Step 2: Create workflow status enum
CREATE TYPE public.workflow_status AS ENUM ('not_viewed', 'in_progress', 'completed', 'forwarded');

-- Step 3: Add workflow columns to complaints table
ALTER TABLE public.complaints 
ADD COLUMN IF NOT EXISTS current_level workflow_level DEFAULT 'tutor',
ADD COLUMN IF NOT EXISTS tutor_status workflow_status DEFAULT 'not_viewed',
ADD COLUMN IF NOT EXISTS tutor_notes text,
ADD COLUMN IF NOT EXISTS tutor_processed_at timestamptz,
ADD COLUMN IF NOT EXISTS tutor_processed_by uuid,
ADD COLUMN IF NOT EXISTS hod_status workflow_status DEFAULT 'not_viewed',
ADD COLUMN IF NOT EXISTS hod_notes text,
ADD COLUMN IF NOT EXISTS hod_processed_at timestamptz,
ADD COLUMN IF NOT EXISTS hod_processed_by uuid,
ADD COLUMN IF NOT EXISTS principal_status workflow_status DEFAULT 'not_viewed',
ADD COLUMN IF NOT EXISTS principal_notes text,
ADD COLUMN IF NOT EXISTS principal_processed_at timestamptz,
ADD COLUMN IF NOT EXISTS principal_processed_by uuid;

-- Step 4: Create proof attachments table for admin resolutions
CREATE TABLE public.resolution_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  level workflow_level NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL,
  file_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Step 5: Enable RLS on resolution_attachments
ALTER TABLE public.resolution_attachments ENABLE ROW LEVEL SECURITY;

-- Step 6: RLS policies for resolution_attachments
CREATE POLICY "Admins can insert resolution attachments"
ON public.resolution_attachments FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'tutor'::app_role) OR 
  has_role(auth.uid(), 'hod'::app_role) OR 
  has_role(auth.uid(), 'principal'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

CREATE POLICY "Anyone can view resolution attachments"
ON public.resolution_attachments FOR SELECT
USING (true);

-- Step 7: Update complaints RLS to allow tutor, hod, principal access
CREATE POLICY "Tutors can view complaints at tutor level"
ON public.complaints FOR SELECT
USING (has_role(auth.uid(), 'tutor'::app_role) AND current_level = 'tutor');

CREATE POLICY "HODs can view complaints at hod level"
ON public.complaints FOR SELECT
USING (has_role(auth.uid(), 'hod'::app_role) AND current_level = 'hod');

CREATE POLICY "Principals can view complaints at principal level"
ON public.complaints FOR SELECT
USING (has_role(auth.uid(), 'principal'::app_role) AND current_level = 'principal');

CREATE POLICY "Tutors can update complaints at tutor level"
ON public.complaints FOR UPDATE
USING (has_role(auth.uid(), 'tutor'::app_role) AND current_level = 'tutor');

CREATE POLICY "HODs can update complaints at hod level"
ON public.complaints FOR UPDATE
USING (has_role(auth.uid(), 'hod'::app_role) AND current_level = 'hod');

CREATE POLICY "Principals can update complaints at principal level"
ON public.complaints FOR UPDATE
USING (has_role(auth.uid(), 'principal'::app_role) AND current_level = 'principal');

-- Step 8: Create storage bucket for resolution proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('resolution-proofs', 'resolution-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Step 9: Storage policies for resolution proofs
CREATE POLICY "Admins can upload resolution proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'resolution-proofs' AND (
    has_role(auth.uid(), 'tutor'::app_role) OR 
    has_role(auth.uid(), 'hod'::app_role) OR 
    has_role(auth.uid(), 'principal'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role)
  )
);

CREATE POLICY "Anyone can view resolution proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'resolution-proofs');