-- Create chat messages table for in-app live chat
CREATE TABLE public.complaint_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'student',
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.complaint_messages ENABLE ROW LEVEL SECURITY;

-- Policies for complaint messages
CREATE POLICY "Users can view messages for their own complaints" 
ON public.complaint_messages 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.complaints 
    WHERE complaints.id = complaint_messages.complaint_id 
    AND (complaints.submitted_by = auth.uid() OR complaints.submitter_email = auth.jwt() ->> 'email')
  )
  OR 
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('tutor', 'hod', 'principal', 'super_admin', 'department_admin'))
);

CREATE POLICY "Users can send messages to their own complaints" 
ON public.complaint_messages 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.complaints 
    WHERE complaints.id = complaint_messages.complaint_id 
    AND (complaints.submitted_by = auth.uid() OR complaints.submitter_email = auth.jwt() ->> 'email')
  )
  OR 
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('tutor', 'hod', 'principal', 'super_admin', 'department_admin'))
);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.complaint_messages;

-- Create escalation reminders table
CREATE TABLE public.escalation_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL DEFAULT 'sla_warning',
  sent_to UUID REFERENCES auth.users(id),
  sent_at TIMESTAMP WITH TIME ZONE,
  is_read BOOLEAN DEFAULT false,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.escalation_reminders ENABLE ROW LEVEL SECURITY;

-- Policies for escalation reminders
CREATE POLICY "Admins can view their own reminders" 
ON public.escalation_reminders 
FOR SELECT 
USING (
  sent_to = auth.uid() OR 
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('super_admin'))
);

CREATE POLICY "System can create reminders" 
ON public.escalation_reminders 
FOR INSERT 
WITH CHECK (true);

-- Enable realtime for escalation reminders
ALTER PUBLICATION supabase_realtime ADD TABLE public.escalation_reminders;