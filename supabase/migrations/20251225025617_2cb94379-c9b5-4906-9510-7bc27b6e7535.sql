-- Create complaint_attachments table
CREATE TABLE public.complaint_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add new columns to complaints table
ALTER TABLE public.complaints 
ADD COLUMN sentiment TEXT,
ADD COLUMN sentiment_score NUMERIC(3,2),
ADD COLUMN sla_deadline TIMESTAMP WITH TIME ZONE,
ADD COLUMN escalated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
ADD COLUMN satisfaction_feedback TEXT,
ADD COLUMN similar_complaint_ids UUID[];

-- Create storage bucket for attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('complaint-attachments', 'complaint-attachments', true);

-- Enable RLS on new tables
ALTER TABLE public.complaint_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies for complaint_attachments
CREATE POLICY "Anyone can view attachments" ON public.complaint_attachments
FOR SELECT USING (true);

CREATE POLICY "Anyone can insert attachments" ON public.complaint_attachments
FOR INSERT WITH CHECK (true);

CREATE POLICY "Super admins can delete attachments" ON public.complaint_attachments
FOR DELETE USING (has_role(auth.uid(), 'super_admin'::app_role));

-- RLS policies for notifications
CREATE POLICY "Super admins can view all notifications" ON public.notifications
FOR SELECT USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "System can insert notifications" ON public.notifications
FOR INSERT WITH CHECK (true);

-- Storage policies for complaint-attachments bucket
CREATE POLICY "Anyone can view complaint attachments" ON storage.objects
FOR SELECT USING (bucket_id = 'complaint-attachments');

CREATE POLICY "Anyone can upload complaint attachments" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'complaint-attachments');

-- Create function to calculate SLA deadline based on priority
CREATE OR REPLACE FUNCTION public.calculate_sla_deadline()
RETURNS TRIGGER AS $$
BEGIN
  -- Set SLA based on priority: high=24h, medium=48h, low=72h
  IF NEW.priority = 'high' THEN
    NEW.sla_deadline = NEW.created_at + INTERVAL '24 hours';
  ELSIF NEW.priority = 'medium' THEN
    NEW.sla_deadline = NEW.created_at + INTERVAL '48 hours';
  ELSE
    NEW.sla_deadline = NEW.created_at + INTERVAL '72 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for SLA calculation
CREATE TRIGGER set_sla_deadline
BEFORE INSERT ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.calculate_sla_deadline();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;