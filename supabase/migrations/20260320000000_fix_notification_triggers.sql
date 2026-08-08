-- ============================================================
-- Fix and enhance notification triggers
-- ============================================================

-- Add resolved_by column to complaints (safe if already exists)
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id);

-- ============================================================
-- 1. Notify TUTORS when a new complaint is submitted
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_new_complaint()
RETURNS TRIGGER AS $$
DECLARE
    tutor_user_id UUID;
BEGIN
    -- Notify all tutors so they see the badge
    FOR tutor_user_id IN (
        SELECT user_id FROM public.user_roles WHERE role = 'tutor'
    ) LOOP
        INSERT INTO public.escalation_reminders 
            (complaint_id, reminder_type, sent_to, message, is_read)
        VALUES 
            (NEW.id, 'new_complaint', tutor_user_id, 
             'New complaint submitted: ' || NEW.title, false);
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_complaint_created ON public.complaints;
CREATE TRIGGER on_complaint_created
AFTER INSERT ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_complaint();

-- ============================================================
-- 2. Notify STUDENT when complaint status or level changes (from admin actions)
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_complaint_update()
RETURNS TRIGGER AS $$
DECLARE
    notif_msg TEXT;
BEGIN
    -- Notify student when overall status changes (e.g. resolved, rejected)
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        notif_msg := CASE NEW.status
            WHEN 'resolved'    THEN 'Your complaint "' || NEW.title || '" has been Resolved! 🎉'
            WHEN 'rejected'    THEN 'Your complaint "' || NEW.title || '" has been Rejected.'
            WHEN 'in_progress' THEN 'Your complaint "' || NEW.title || '" is now In Progress.'
            ELSE 'Your complaint "' || NEW.title || '" status changed to ' || NEW.status
        END;

        INSERT INTO public.escalation_reminders 
            (complaint_id, reminder_type, sent_to, message, is_read)
        VALUES 
            (NEW.id, 'status_change', NEW.submitted_by, notif_msg, false);
    END IF;

    -- Notify student when complaint is forwarded (level changes)
    IF (OLD.current_level IS DISTINCT FROM NEW.current_level AND NEW.current_level IS NOT NULL) THEN
        notif_msg := CASE NEW.current_level
            WHEN 'hod'       THEN 'Your complaint "' || NEW.title || '" has been forwarded to the HOD.'
            WHEN 'principal' THEN 'Your complaint "' || NEW.title || '" has been escalated to the Principal.'
            ELSE 'Your complaint "' || NEW.title || '" was forwarded to ' || NEW.current_level
        END;

        INSERT INTO public.escalation_reminders 
            (complaint_id, reminder_type, sent_to, message, is_read)
        VALUES 
            (NEW.id, 'level_change', NEW.submitted_by, notif_msg, false);
    END IF;

    -- Notify student when tutor_status changes (e.g. seen, in_progress, completed)
    IF (OLD.tutor_status IS DISTINCT FROM NEW.tutor_status AND NEW.tutor_status IS NOT NULL) THEN
        notif_msg := CASE NEW.tutor_status
            WHEN 'in_progress' THEN 'Your tutor is now processing your complaint "' || NEW.title || '".'
            WHEN 'completed'   THEN 'Your tutor has marked your complaint "' || NEW.title || '" as completed.'
            WHEN 'forwarded'   THEN 'Your tutor forwarded your complaint "' || NEW.title || '" to the HOD.'
            ELSE 'Your complaint "' || NEW.title || '" was updated by your tutor.'
        END;

        INSERT INTO public.escalation_reminders 
            (complaint_id, reminder_type, sent_to, message, is_read)
        VALUES 
            (NEW.id, 'status_change', NEW.submitted_by, notif_msg, false);
    END IF;

    -- Notify student when hod_status changes
    IF (OLD.hod_status IS DISTINCT FROM NEW.hod_status AND NEW.hod_status IS NOT NULL) THEN
        notif_msg := CASE NEW.hod_status
            WHEN 'in_progress' THEN 'The HOD is now reviewing your complaint "' || NEW.title || '".'
            WHEN 'completed'   THEN 'The HOD has resolved your complaint "' || NEW.title || '".'
            WHEN 'forwarded'   THEN 'Your complaint "' || NEW.title || '" has been escalated to the Principal.'
            ELSE 'The HOD updated your complaint "' || NEW.title || '".'
        END;

        INSERT INTO public.escalation_reminders 
            (complaint_id, reminder_type, sent_to, message, is_read)
        VALUES 
            (NEW.id, 'status_change', NEW.submitted_by, notif_msg, false);
    END IF;

    -- Notify student when principal_status changes
    IF (OLD.principal_status IS DISTINCT FROM NEW.principal_status AND NEW.principal_status IS NOT NULL) THEN
        notif_msg := CASE NEW.principal_status
            WHEN 'in_progress' THEN 'The Principal is reviewing your complaint "' || NEW.title || '".'
            WHEN 'completed'   THEN 'The Principal has resolved your complaint "' || NEW.title || '" ✅'
            ELSE 'The Principal updated your complaint "' || NEW.title || '".'
        END;

        INSERT INTO public.escalation_reminders 
            (complaint_id, reminder_type, sent_to, message, is_read)
        VALUES 
            (NEW.id, 'status_change', NEW.submitted_by, notif_msg, false);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_complaint_updated ON public.complaints;
CREATE TRIGGER on_complaint_updated
AFTER UPDATE ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_complaint_update();

-- ============================================================
-- 3. Notify ADMIN and SUPER ADMINS on feedback submission
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_on_feedback()
RETURNS TRIGGER AS $$
DECLARE
    super_admin_id UUID;
BEGIN
    -- Only fire when satisfaction_rating is newly set
    IF (OLD.satisfaction_rating IS NULL AND NEW.satisfaction_rating IS NOT NULL) THEN
        -- Notify the resolving admin if tracked
        IF NEW.resolved_by IS NOT NULL THEN
            INSERT INTO public.escalation_reminders 
                (complaint_id, reminder_type, sent_to, message, is_read)
            VALUES 
                (NEW.id, 'feedback', NEW.resolved_by,
                 'New feedback (' || NEW.satisfaction_rating || '★) received for: "' || NEW.title || '"', false);
        END IF;

        -- Notify all super admins
        FOR super_admin_id IN (
            SELECT user_id FROM public.user_roles WHERE role = 'super_admin'
        ) LOOP
            IF super_admin_id IS DISTINCT FROM NEW.resolved_by THEN
                INSERT INTO public.escalation_reminders 
                    (complaint_id, reminder_type, sent_to, message, is_read)
                VALUES 
                    (NEW.id, 'feedback', super_admin_id,
                     'New feedback (' || NEW.satisfaction_rating || '★) submitted for: "' || NEW.title || '"', false);
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_feedback_submitted ON public.complaints;
CREATE TRIGGER on_feedback_submitted
AFTER UPDATE ON public.complaints
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_feedback();

-- ============================================================
-- 4. RLS: Allow users to read their own notifications
-- ============================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'escalation_reminders' 
        AND policyname = 'Users can read their own notifications'
    ) THEN
        CREATE POLICY "Users can read their own notifications"
        ON public.escalation_reminders FOR SELECT
        USING (sent_to = auth.uid() OR sent_to IS NULL);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'escalation_reminders' 
        AND policyname = 'Users can update their own notifications'
    ) THEN
        CREATE POLICY "Users can update their own notifications"
        ON public.escalation_reminders FOR UPDATE
        USING (sent_to = auth.uid());
    END IF;
END $$;
