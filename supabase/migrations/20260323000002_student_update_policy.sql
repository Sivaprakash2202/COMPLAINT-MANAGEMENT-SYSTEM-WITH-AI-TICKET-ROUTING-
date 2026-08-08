-- Add UPDATE policy for students on their own pending complaints
CREATE POLICY "Users can update their own pending complaints"
ON public.complaints FOR UPDATE
TO authenticated
USING (
  auth.uid() = submitted_by 
  AND status = 'pending'
);
