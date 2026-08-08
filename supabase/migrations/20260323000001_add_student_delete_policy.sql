-- Add DELETE policy for students on their own pending complaints
CREATE POLICY "Users can delete their own pending complaints"
ON public.complaints FOR DELETE
TO authenticated
USING (
  auth.uid() = submitted_by 
  AND status = 'pending'
);
