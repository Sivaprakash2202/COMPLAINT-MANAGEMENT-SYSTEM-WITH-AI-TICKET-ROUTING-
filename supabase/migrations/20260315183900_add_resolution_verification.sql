-- Add columns for resolution verification and risk tracking
ALTER TABLE public.complaints 
ADD COLUMN IF NOT EXISTS resolution_image text,
ADD COLUMN IF NOT EXISTS verification_status text CHECK (verification_status IN ('pending', 'verified', 'rejected')) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS risk_score numeric DEFAULT 0;

-- Ensure RLS allows reading these new columns (usually covered by existing SELECT policies)
