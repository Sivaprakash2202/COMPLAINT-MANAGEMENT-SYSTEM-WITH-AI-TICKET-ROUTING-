-- Drop the restrictive INSERT policy and recreate as permissive
DROP POLICY IF EXISTS "Anyone can insert complaints" ON public.complaints;
CREATE POLICY "Anyone can insert complaints" ON public.complaints FOR INSERT TO public WITH CHECK (true);

-- Also fix the attachments policy to be permissive
DROP POLICY IF EXISTS "Anyone can insert attachments" ON public.complaint_attachments;
CREATE POLICY "Anyone can insert attachments" ON public.complaint_attachments FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can view attachments" ON public.complaint_attachments;
CREATE POLICY "Anyone can view attachments" ON public.complaint_attachments FOR SELECT TO public USING (true);

-- Fix notifications insert policy
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO public WITH CHECK (true);