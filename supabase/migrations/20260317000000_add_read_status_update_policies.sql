-- Enable updating the is_read status for complaint messages
DROP POLICY IF EXISTS "Admins can mark messages as read" ON public.complaint_messages;
CREATE POLICY "Users can mark messages as read" ON public.complaint_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('tutor', 'hod', 'principal', 'super_admin', 'department_admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.complaints
      WHERE complaints.id = complaint_messages.complaint_id
      AND (complaints.submitted_by = auth.uid() OR complaints.submitter_email = auth.jwt() ->> 'email')
    )
  )
  WITH CHECK (is_read = true);

-- Enable updating the is_read status for escalation reminders
DROP POLICY IF EXISTS "Users can mark reminders as read" ON public.escalation_reminders;
CREATE POLICY "Users can mark reminders as read" ON public.escalation_reminders
  FOR UPDATE
  USING (
    sent_to = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  )
  WITH CHECK (is_read = true);
