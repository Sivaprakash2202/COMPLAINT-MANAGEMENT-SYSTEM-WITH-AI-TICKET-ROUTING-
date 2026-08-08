-- Add resolved_by column to complaints
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id);

-- Create function to notify tutors on new complaint
CREATE OR REPLACE FUNCTION public.notify_on_new_complaint()
RETURNS TRIGGER AS $$
DECLARE
    tutor_id UUID;
BEGIN
    -- This is a simplified logic: notify all tutors or a specific one if assigned.
    -- For now, we'll create a general 'live_chat' type reminder for tutors
    -- Or better, a new type 'new_complaint'
    
    INSERT INTO public.escalation_reminders (complaint_id, reminder_type, message)
    VALUES (NEW.id, 'new_complaint', 'New complaint submitted: ' || NEW.title);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for new complaint
DROP TRIGGER IF EXISTS on_complaint_created ON public.complaints;
CREATE TRIGGER on_complaint_created
AFTER INSERT ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_complaint();

-- Create function to notify student on status/level change
CREATE OR REPLACE FUNCTION public.notify_on_complaint_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.escalation_reminders (complaint_id, reminder_type, sent_to, message)
        VALUES (NEW.id, 'status_change', NEW.submitted_by, 'Your complaint status changed to ' || NEW.status);
    END IF;

    IF (OLD.current_level IS DISTINCT FROM NEW.current_level) THEN
        INSERT INTO public.escalation_reminders (complaint_id, reminder_type, sent_to, message)
        VALUES (NEW.id, 'level_change', NEW.submitted_by, 'Your complaint has been forwarded to ' || NEW.current_level);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for complaint updates
DROP TRIGGER IF EXISTS on_complaint_updated ON public.complaints;
CREATE TRIGGER on_complaint_updated
AFTER UPDATE ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_complaint_update();

-- Create function to notify admin on feedback
CREATE OR REPLACE FUNCTION public.notify_on_feedback()
RETURNS TRIGGER AS $$
DECLARE
    super_admin_id UUID;
BEGIN
    -- Only notify if satisfaction_rating was just set
    IF (OLD.satisfaction_rating IS NULL AND NEW.satisfaction_rating IS NOT NULL) THEN
        -- Notify the resolving admin
        IF NEW.resolved_by IS NOT NULL THEN
            INSERT INTO public.escalation_reminders (complaint_id, reminder_type, sent_to, message)
            VALUES (NEW.id, 'feedback', NEW.resolved_by, 'New feedback received for your resolved complaint: ' || NEW.title);
        END IF;

        -- Notify super admins
        FOR super_admin_id IN (SELECT user_id FROM public.user_roles WHERE role = 'super_admin') LOOP
            INSERT INTO public.escalation_reminders (complaint_id, reminder_type, sent_to, message)
            VALUES (NEW.id, 'feedback', super_admin_id, 'New feedback submitted for complaint: ' || NEW.title);
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for feedback
DROP TRIGGER IF EXISTS on_feedback_submitted ON public.complaints;
CREATE TRIGGER on_feedback_submitted
AFTER UPDATE ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_feedback();
