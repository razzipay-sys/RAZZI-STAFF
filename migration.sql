-- ============================================================
-- RazziStaff Migration: Remove staff_id, add UUID FKs, auto-role
-- Run this once in the Supabase SQL Editor.
-- Safe to re-run (all operations are idempotent).
-- ============================================================

-- STEP 0: Drop policies that may depend on legacy staff_id columns (must happen before DROP COLUMN)
DROP POLICY IF EXISTS "docs_select" ON public.staff_documents;
DROP POLICY IF EXISTS "docs_modify" ON public.staff_documents;
DROP POLICY IF EXISTS "workflow_select" ON public.daily_workflow_reports;
DROP POLICY IF EXISTS "workflow_modify" ON public.daily_workflow_reports;

-- STEP 1: Add staff_profile_id UUID FK to staff_documents
ALTER TABLE public.staff_documents
  ADD COLUMN IF NOT EXISTS staff_profile_id UUID REFERENCES public.staff_profiles(id) ON DELETE CASCADE;

-- STEP 2: Backfill staff_profile_id from staff_id in staff_documents
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff_documents' AND column_name = 'staff_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'staff_id'
  ) THEN
    UPDATE public.staff_documents sd
    SET staff_profile_id = sp.id
    FROM public.staff_profiles sp
    WHERE sd.staff_profile_id IS NULL
      AND sd.staff_id IS NOT NULL
      AND lower(sd.staff_id) = lower(sp.staff_id);
  END IF;
END
$$;

-- STEP 3: Add staff_profile_id UUID FK to daily_workflow_reports
ALTER TABLE public.daily_workflow_reports
  ADD COLUMN IF NOT EXISTS staff_profile_id UUID REFERENCES public.staff_profiles(id) ON DELETE CASCADE;

-- STEP 4: Backfill staff_profile_id from staff_id in daily_workflow_reports
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'daily_workflow_reports' AND column_name = 'staff_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'staff_id'
  ) THEN
    UPDATE public.daily_workflow_reports dr
    SET staff_profile_id = sp.id
    FROM public.staff_profiles sp
    WHERE dr.staff_profile_id IS NULL
      AND dr.staff_id IS NOT NULL
      AND lower(dr.staff_id) = lower(sp.staff_id);
  END IF;
END
$$;

-- STEP 5: Add indexes on new UUID FK columns
CREATE INDEX IF NOT EXISTS idx_staff_documents_staff_profile_id ON public.staff_documents(staff_profile_id);
CREATE INDEX IF NOT EXISTS idx_workflow_reports_staff_profile_id ON public.daily_workflow_reports(staff_profile_id, report_date);

-- STEP 6: Drop old text staff_id FK constraints and columns from staff_documents
ALTER TABLE public.staff_documents DROP CONSTRAINT IF EXISTS staff_documents_staff_id_fkey;
ALTER TABLE public.staff_documents DROP COLUMN IF EXISTS staff_id;
DROP INDEX IF EXISTS idx_documents_staff_id;

-- STEP 7: Drop old text staff_id FK constraints and columns from daily_workflow_reports
ALTER TABLE public.daily_workflow_reports DROP CONSTRAINT IF EXISTS daily_workflow_reports_staff_id_fkey;
ALTER TABLE public.daily_workflow_reports DROP COLUMN IF EXISTS staff_id;
DROP INDEX IF EXISTS idx_workflow_reports_staff_date;

-- STEP 8: Ensure staff_bank_details has staff_profile_id and backfill before dropping legacy staff_id
ALTER TABLE public.staff_bank_details
  ADD COLUMN IF NOT EXISTS staff_profile_id UUID REFERENCES public.staff_profiles(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff_bank_details' AND column_name = 'staff_id'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'staff_profiles' AND column_name = 'staff_id'
  ) THEN
    UPDATE public.staff_bank_details bd
    SET staff_profile_id = sp.id
    FROM public.staff_profiles sp
    WHERE bd.staff_profile_id IS NULL
      AND bd.staff_id IS NOT NULL
      AND lower(bd.staff_id) = lower(sp.staff_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.staff_bank_details
    WHERE staff_profile_id IS NULL
  ) THEN
    ALTER TABLE public.staff_bank_details
    ALTER COLUMN staff_profile_id SET NOT NULL;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_bank_details_staff_profile_id_unique
ON public.staff_bank_details(staff_profile_id);

ALTER TABLE public.staff_bank_details DROP COLUMN IF EXISTS staff_id;

-- STEP 9: Drop staff_id generation triggers, functions, and column from staff_profiles
DROP TRIGGER IF EXISTS trg_staff_profiles_assign_staff_id ON public.staff_profiles;
DROP TRIGGER IF EXISTS trg_staff_profiles_sync_bank_details ON public.staff_profiles;
DROP FUNCTION IF EXISTS public.assign_staff_id();
DROP FUNCTION IF EXISTS public.next_staff_id();
DROP FUNCTION IF EXISTS public.set_staff_id_for_profile(UUID, TEXT);
DROP FUNCTION IF EXISTS public.backfill_missing_staff_ids();
DROP FUNCTION IF EXISTS public.assign_staff_id_to_profile(UUID);
DROP SEQUENCE IF EXISTS public.staff_id_seq;
ALTER TABLE public.staff_profiles DROP COLUMN IF EXISTS staff_id;
DROP INDEX IF EXISTS idx_staff_profiles_staff_id;

-- STEP 10: Simplify bank sync trigger (no more staff_id to sync)
CREATE OR REPLACE FUNCTION public.sync_staff_bank_details_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p RECORD;
BEGIN
  SELECT id, full_name INTO p
  FROM public.staff_profiles
  WHERE id = NEW.staff_profile_id
  LIMIT 1;

  IF p.id IS NOT NULL THEN
    NEW.staff_name := COALESCE(NULLIF(NEW.staff_name, ''), p.full_name);
  END IF;

  RETURN NEW;
END;
$$;

-- STEP 11: Update RLS policies for staff_documents to use UUID
DROP POLICY IF EXISTS "docs_select" ON public.staff_documents;
DROP POLICY IF EXISTS "docs_modify" ON public.staff_documents;

CREATE POLICY "docs_select" ON public.staff_documents FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('super_admin', 'admin', 'hr_admin')
    OR staff_profile_id = (SELECT id FROM public.staff_profiles WHERE user_id = auth.uid()::text LIMIT 1)
  );

CREATE POLICY "docs_modify" ON public.staff_documents FOR ALL TO authenticated
  USING (
    public.get_user_role() IN ('super_admin', 'admin', 'hr_admin')
    OR staff_profile_id = (SELECT id FROM public.staff_profiles WHERE user_id = auth.uid()::text LIMIT 1)
  )
  WITH CHECK (
    public.get_user_role() IN ('super_admin', 'admin', 'hr_admin')
    OR staff_profile_id = (SELECT id FROM public.staff_profiles WHERE user_id = auth.uid()::text LIMIT 1)
  );

-- STEP 12: Update RLS policies for daily_workflow_reports to use UUID
DROP POLICY IF EXISTS "workflow_select" ON public.daily_workflow_reports;
DROP POLICY IF EXISTS "workflow_modify" ON public.daily_workflow_reports;

CREATE POLICY "workflow_select" ON public.daily_workflow_reports FOR SELECT TO authenticated
  USING (
    public.get_user_role() IN ('super_admin', 'admin', 'manager')
    OR staff_profile_id = (SELECT id FROM public.staff_profiles WHERE user_id = auth.uid()::text LIMIT 1)
  );

CREATE POLICY "workflow_modify" ON public.daily_workflow_reports FOR ALL TO authenticated
  USING (
    staff_profile_id = (SELECT id FROM public.staff_profiles WHERE user_id = auth.uid()::text LIMIT 1)
    OR public.get_user_role() IN ('super_admin', 'admin', 'manager')
  )
  WITH CHECK (
    staff_profile_id = (SELECT id FROM public.staff_profiles WHERE user_id = auth.uid()::text LIMIT 1)
    OR public.get_user_role() IN ('super_admin', 'admin', 'manager')
  );

-- STEP 13: Update link_or_create_staff_profile to auto-assign 'user' role on first sign-in
CREATE OR REPLACE FUNCTION public.link_or_create_staff_profile(p_full_name TEXT DEFAULT NULL)
RETURNS public.staff_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_email TEXT;
  normalized_email TEXT;
  profile public.staff_profiles;
BEGIN
  jwt_email := auth.jwt()->>'email';
  normalized_email := lower(trim(jwt_email));

  IF normalized_email IS NULL OR normalized_email = '' THEN
    RAISE EXCEPTION 'Missing authenticated email';
  END IF;

  INSERT INTO public.staff_profiles (user_id, email, full_name, role, employment_status)
  VALUES (
    auth.uid()::text,
    normalized_email,
    COALESCE(NULLIF(trim(p_full_name), ''), split_part(normalized_email, '@', 1)),
    'user',
    'Active'
  )
  ON CONFLICT (email) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        updated_at = NOW()
    WHERE public.staff_profiles.user_id IS NULL
       OR public.staff_profiles.user_id = EXCLUDED.user_id
  RETURNING * INTO profile;

  IF profile.id IS NULL THEN
    SELECT * INTO profile
    FROM public.staff_profiles
    WHERE lower(email) = normalized_email
    LIMIT 1;
  END IF;

  -- Auto-assign 'user' role if not already assigned
  INSERT INTO public.user_roles (user_id, email, role, assigned_by, assigned_at)
  VALUES (auth.uid(), normalized_email, 'user', 'system', NOW())
  ON CONFLICT (email) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        updated_at = NOW()
    WHERE public.user_roles.user_id IS NULL;

  RETURN profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_or_create_staff_profile(TEXT) TO authenticated;
