-- Step 1: Add new admin roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'tutor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hod';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'principal';