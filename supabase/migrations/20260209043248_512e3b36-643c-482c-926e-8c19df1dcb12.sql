-- Fix the overly permissive insert policy for escalation reminders
-- Drop the permissive policy
DROP POLICY IF EXISTS "System can create reminders" ON public.escalation_reminders;

-- Create a more restrictive policy that allows service role or authenticated admin users
CREATE POLICY "Admins can create reminders" 
ON public.escalation_reminders 
FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('tutor', 'hod', 'principal', 'super_admin'))
);