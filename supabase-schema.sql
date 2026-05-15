-- ============================================================
-- RazziStaff — Supabase Schema (Upgraded)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── staff_profiles ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_profiles (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                     TEXT, -- References auth.users(id) as text
  full_name                   TEXT NOT NULL,
  email                       TEXT NOT NULL UNIQUE,
  phone                       TEXT,
  department                  TEXT CHECK (department IN ('Engineering','Finance','Operations','HR','IT','Marketing','Sales','Customer Support','Legal','Product','Executive')),
  role                        TEXT NOT NULL,
  employment_type             TEXT CHECK (employment_type IN ('Full-time','Part-time','Contract','Intern','Probation')),
  work_mode                   TEXT CHECK (work_mode IN ('On-site','Remote','Hybrid')),
  address                     TEXT,
  emergency_contact_name      TEXT,
  emergency_contact_phone     TEXT,
  next_of_kin_name            TEXT,
  next_of_kin_phone           TEXT,
  next_of_kin_relationship    TEXT,
  profile_photo_url           TEXT,
  date_of_birth               DATE,
  date_joined                 DATE,
  first_employment_date       DATE,
  confirmation_status         TEXT DEFAULT 'Pending' CHECK (confirmation_status IN ('Pending','Confirmed','Extended','Not Applicable')),
  confirmation_date           DATE,
  probation_start_date        DATE,
  probation_end_date          DATE,
  employment_status           TEXT NOT NULL DEFAULT 'Active' CHECK (employment_status IN ('Active','Suspended','Resigned','Terminated','On Leave')),
  manager_id                  UUID REFERENCES staff_profiles(id), -- references another staff_profiles(id)
  manager_name                TEXT,
  staff_bio                   TEXT,
  skills                      TEXT[],
  responsibilities            TEXT,
  hr_notes                    TEXT,
  profile_completion_percentage NUMERIC DEFAULT 0,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- Link (or create) a staff profile for the authenticated user using their JWT email.
-- This prevents duplicate email inserts and allows first-login profile creation without relaxing RLS.
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
    SELECT *
    INTO profile
    FROM public.staff_profiles
    WHERE lower(email) = normalized_email
    LIMIT 1;
  END IF;

  -- Auto-assign 'user' role on first sign-in without overwriting existing roles
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











DO $$
BEGIN
  IF to_regclass('public.staff_profiles') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'staff_profiles_department_check'
        AND conrelid = 'public.staff_profiles'::regclass
    ) THEN
      ALTER TABLE public.staff_profiles DROP CONSTRAINT staff_profiles_department_check;
    END IF;

    ALTER TABLE public.staff_profiles
    ADD CONSTRAINT staff_profiles_department_check
    CHECK (department IN ('Engineering','Finance','Operations','HR','IT','Marketing','Sales','Customer Support','Legal','Product','Executive'));
  END IF;
END
$$;

-- ─── staff_bank_details ────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_bank_details (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_profile_id     UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  staff_name           TEXT,
  bank_name            TEXT NOT NULL,
  account_number       TEXT NOT NULL,
  account_name         TEXT NOT NULL,
  salary_amount        NUMERIC,
  salary_currency      TEXT DEFAULT 'NGN',
  salary_payment_date  INT,
  payment_frequency    TEXT CHECK (payment_frequency IN ('Monthly','Weekly','Bi-weekly','Contract-based')),
  tax_deduction        NUMERIC DEFAULT 0,
  pension_deduction    NUMERIC DEFAULT 0,
  other_deductions     NUMERIC DEFAULT 0,
  finance_notes        TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF to_regclass('public.staff_bank_details') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'staff_bank_details'
        AND column_name = 'staff_profile_id'
    ) THEN
      ALTER TABLE public.staff_bank_details
      ADD COLUMN staff_profile_id UUID REFERENCES public.staff_profiles(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'staff_bank_details'
        AND column_name = 'staff_id'
    ) AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'staff_profiles'
        AND column_name = 'staff_id'
    ) THEN
      UPDATE public.staff_bank_details bd
      SET staff_profile_id = sp.id
      FROM public.staff_profiles sp
      WHERE bd.staff_profile_id IS NULL
        AND bd.staff_id IS NOT NULL
        AND lower(bd.staff_id) = lower(sp.staff_id);
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.staff_bank_details
      WHERE staff_profile_id IS NULL
    ) THEN
      ALTER TABLE public.staff_bank_details
      ALTER COLUMN staff_profile_id SET NOT NULL;
    END IF;

    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_bank_details_staff_profile_id_unique ON public.staff_bank_details(staff_profile_id)';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.sync_staff_bank_details_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p RECORD;
BEGIN
  SELECT id, full_name
  INTO p
  FROM public.staff_profiles
  WHERE id = NEW.staff_profile_id
  LIMIT 1;

  IF p.id IS NOT NULL THEN
    NEW.staff_name := COALESCE(NULLIF(NEW.staff_name, ''), p.full_name);
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.staff_bank_details') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'trg_staff_bank_details_sync_fields'
        AND tgrelid = 'public.staff_bank_details'::regclass
    ) THEN
      CREATE TRIGGER trg_staff_bank_details_sync_fields
      BEFORE INSERT OR UPDATE ON public.staff_bank_details
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_staff_bank_details_fields();
    END IF;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.sync_bank_details_on_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.staff_bank_details
  SET staff_name = COALESCE(staff_name, NEW.full_name),
      updated_at = NOW()
  WHERE staff_profile_id = NEW.id;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('public.staff_profiles') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'trg_staff_profiles_sync_bank_details'
        AND tgrelid = 'public.staff_profiles'::regclass
    ) THEN
      CREATE TRIGGER trg_staff_profiles_sync_bank_details
      AFTER UPDATE OF full_name ON public.staff_profiles
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_bank_details_on_profile_update();
    END IF;
  END IF;
END
$$;

-- ─── staff_documents ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_documents (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_profile_id UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  staff_name     TEXT,
  document_type  TEXT CHECK (document_type IN ('CV','ID Card','Offer Letter','Appointment Letter','Confirmation Letter','NDA','Contract','Certificate','Other')),
  document_name  TEXT,
  document_url   TEXT,
  status         TEXT DEFAULT 'Pending' CHECK (status IN ('Pending','Submitted','Reviewed','Requires Update','Approved','Rejected')),
  reviewed_by    TEXT,
  reviewed_at    TIMESTAMPTZ,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── daily_workflow_reports ────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_workflow_reports (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_profile_id    UUID NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  staff_name          TEXT NOT NULL,
  department          TEXT,
  report_date         DATE NOT NULL,
  assigned_task       TEXT,
  task_description    TEXT,
  priority            TEXT CHECK (priority IN ('Low','Medium','High','Urgent')),
  status              TEXT CHECK (status IN ('Not Started','In Progress','Completed','Pending Review','Blocked','Carried Forward')),
  work_done           TEXT NOT NULL,
  proof_link          TEXT,
  blockers            TEXT,
  start_time          TEXT,
  close_time          TEXT,
  hours_worked        NUMERIC,
  work_mode_for_day   TEXT CHECK (work_mode_for_day IN ('Remote','On-site','Hybrid')),
  clock_in_time       TEXT,
  clock_out_time      TEXT,
  compliance_status   TEXT CHECK (compliance_status IN ('Compliant','Late','Absent','Incomplete Report','Pending Review')),
  supervisor_id       UUID REFERENCES staff_profiles(id),
  supervisor_name     TEXT,
  supervisor_comment  TEXT,
  review_status       TEXT DEFAULT 'Pending Review' CHECK (review_status IN ('Pending Review','Approved','Needs Correction','Rejected')),
  next_action         TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── audit_logs ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_type       TEXT NOT NULL CHECK (action_type IN ('CREATE','UPDATE','DELETE','VIEW','EXPORT','LOGIN','LOGOUT','ROLE_CHANGE','SETTINGS_UPDATE','AVATAR_UPDATE')),
  entity_type       TEXT NOT NULL,
  entity_id         TEXT,
  entity_name       TEXT,
  performed_by      TEXT NOT NULL,
  performed_by_role TEXT,
  changes           TEXT,
  ip_address        TEXT,
  user_agent        TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── user_roles ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID UNIQUE, -- references auth.users(id)
  email             TEXT NOT NULL UNIQUE,
  role              TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('super_admin','admin','hr_admin','finance_admin','manager','user')),
  assigned_by       TEXT,
  assigned_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_email ON user_roles(email);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

ALTER TABLE user_roles
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

UPDATE user_roles
SET created_at = COALESCE(created_at, assigned_at, updated_at, NOW())
WHERE created_at IS NULL;

-- ─── app_settings ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key                TEXT UNIQUE NOT NULL,
  setting_value              JSONB NOT NULL,
  description                TEXT,
  updated_by                 UUID,
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_staff_profiles_email ON staff_profiles(email);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_department ON staff_profiles(department);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_status ON staff_profiles(employment_status);
DO $$
BEGIN
  IF to_regclass('public.daily_workflow_reports') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'daily_workflow_reports'
        AND column_name = 'staff_profile_id'
    ) THEN
      ALTER TABLE public.daily_workflow_reports
      ADD COLUMN staff_profile_id UUID REFERENCES public.staff_profiles(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'daily_workflow_reports'
        AND column_name = 'staff_profile_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_workflow_reports_staff_date ON public.daily_workflow_reports(staff_profile_id, report_date)';
    END IF;
  END IF;

  IF to_regclass('public.staff_documents') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'staff_documents'
        AND column_name = 'staff_profile_id'
    ) THEN
      ALTER TABLE public.staff_documents
      ADD COLUMN staff_profile_id UUID REFERENCES public.staff_profiles(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'staff_documents'
        AND column_name = 'staff_profile_id'
    ) THEN
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_documents_staff_profile_id ON public.staff_documents(staff_profile_id)';
    END IF;
  END IF;
END
$$;
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ─── Updated_at auto-update trigger ───────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['staff_profiles','staff_bank_details','staff_documents','daily_workflow_reports','user_roles','app_settings'] LOOP
    EXECUTE format('
      CREATE OR REPLACE TRIGGER trg_%s_updated_at
      BEFORE UPDATE ON %s
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ', t, t);
  END LOOP;
END;
$$;

-- ─── Row Level Security (RLS) ──────────────────────────────
ALTER TABLE staff_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_bank_details    ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_workflow_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings          ENABLE ROW LEVEL SECURITY;

-- Helper: Get current user role from user_roles table safely
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT role
      FROM public.user_roles
      WHERE user_id = auth.uid()
         OR lower(email) = lower(auth.jwt()->>'email')
      LIMIT 1
    ),
    'user'
  );
$$;

-- staff_profiles policies
DROP POLICY IF EXISTS "profiles_select" ON staff_profiles;
DROP POLICY IF EXISTS "profiles_insert" ON staff_profiles;
DROP POLICY IF EXISTS "profiles_update" ON staff_profiles;

CREATE POLICY "profiles_select" ON staff_profiles FOR SELECT TO authenticated
  USING (true); -- Everyone can see basic profile info

CREATE POLICY "profiles_insert" ON staff_profiles FOR INSERT TO authenticated
  WITH CHECK (get_user_role() IN ('super_admin', 'admin', 'hr_admin'));

CREATE POLICY "profiles_update" ON staff_profiles FOR UPDATE TO authenticated
  USING (get_user_role() IN ('super_admin', 'admin', 'hr_admin') OR auth.uid()::text = user_id)
  WITH CHECK (get_user_role() IN ('super_admin', 'admin', 'hr_admin') OR auth.uid()::text = user_id);

-- staff_bank_details policies
DROP POLICY IF EXISTS "bank_select" ON staff_bank_details;
DROP POLICY IF EXISTS "bank_modify" ON staff_bank_details;

CREATE POLICY "bank_select" ON staff_bank_details FOR SELECT TO authenticated
  USING (
    get_user_role() IN ('super_admin', 'admin', 'hr_admin', 'finance_admin')
    OR staff_profile_id = (SELECT id FROM staff_profiles WHERE user_id = auth.uid()::text LIMIT 1)
  );

CREATE POLICY "bank_modify" ON staff_bank_details FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'admin', 'hr_admin', 'finance_admin'))
  WITH CHECK (get_user_role() IN ('super_admin', 'admin', 'hr_admin', 'finance_admin'));

-- staff_documents policies
DROP POLICY IF EXISTS "docs_select" ON staff_documents;
DROP POLICY IF EXISTS "docs_modify" ON staff_documents;

CREATE POLICY "docs_select" ON staff_documents FOR SELECT TO authenticated
  USING (get_user_role() IN ('super_admin', 'admin', 'hr_admin') OR staff_profile_id = (SELECT id FROM staff_profiles WHERE user_id = auth.uid()::text));

CREATE POLICY "docs_modify" ON staff_documents FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'admin', 'hr_admin') OR staff_profile_id = (SELECT id FROM staff_profiles WHERE user_id = auth.uid()::text))
  WITH CHECK (get_user_role() IN ('super_admin', 'admin', 'hr_admin') OR staff_profile_id = (SELECT id FROM staff_profiles WHERE user_id = auth.uid()::text));

-- daily_workflow_reports policies
DROP POLICY IF EXISTS "workflow_select" ON daily_workflow_reports;
DROP POLICY IF EXISTS "workflow_modify" ON daily_workflow_reports;

CREATE POLICY "workflow_select" ON daily_workflow_reports FOR SELECT TO authenticated
  USING (get_user_role() IN ('super_admin', 'admin', 'manager') OR staff_profile_id = (SELECT id FROM staff_profiles WHERE user_id = auth.uid()::text));

CREATE POLICY "workflow_modify" ON daily_workflow_reports FOR ALL TO authenticated
  USING (staff_profile_id = (SELECT id FROM staff_profiles WHERE user_id = auth.uid()::text) OR get_user_role() IN ('super_admin', 'admin', 'manager'))
  WITH CHECK (staff_profile_id = (SELECT id FROM staff_profiles WHERE user_id = auth.uid()::text) OR get_user_role() IN ('super_admin', 'admin', 'manager'));

-- user_roles policies
DROP POLICY IF EXISTS "roles_select" ON user_roles;
DROP POLICY IF EXISTS "roles_insert" ON user_roles;
DROP POLICY IF EXISTS "roles_update" ON user_roles;
DROP POLICY IF EXISTS "roles_delete" ON user_roles;
DROP POLICY IF EXISTS "roles_modify" ON user_roles;

CREATE POLICY "roles_select" ON user_roles FOR SELECT TO authenticated
  USING (lower(email) = lower(auth.jwt()->>'email') OR get_user_role() IN ('super_admin', 'admin'));

CREATE POLICY "roles_insert" ON user_roles FOR INSERT TO authenticated
  WITH CHECK (
    get_user_role() = 'super_admin'
    OR (get_user_role() = 'admin' AND role != 'super_admin')
  );

CREATE POLICY "roles_update" ON user_roles FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR (get_user_role() = 'admin' AND role != 'super_admin')
  )
  WITH CHECK (
    get_user_role() = 'super_admin'
    OR (get_user_role() = 'admin' AND role != 'super_admin')
  );

CREATE POLICY "roles_delete" ON user_roles FOR DELETE TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR (get_user_role() = 'admin' AND role != 'super_admin')
  );

-- Seed first super admin
INSERT INTO user_roles (email, role, assigned_by, created_at, assigned_at, updated_at)
VALUES ('adegbesanadebola1@gmail.com', 'super_admin', 'system', NOW(), NOW(), NOW())
ON CONFLICT (email)
DO UPDATE SET
  role = 'super_admin',
  updated_at = NOW();

-- audit_logs policies
DROP POLICY IF EXISTS "audit_select" ON audit_logs;
DROP POLICY IF EXISTS "audit_insert" ON audit_logs;

CREATE POLICY "audit_select" ON audit_logs FOR SELECT TO authenticated
  USING (get_user_role() IN ('super_admin', 'admin'));

CREATE POLICY "audit_insert" ON audit_logs FOR INSERT TO authenticated
  WITH CHECK (true);

-- app_settings policies
DROP POLICY IF EXISTS "settings_select" ON app_settings;
DROP POLICY IF EXISTS "settings_modify" ON app_settings;

CREATE POLICY "settings_select" ON app_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "settings_modify" ON app_settings FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin', 'admin'))
  WITH CHECK (get_user_role() IN ('super_admin', 'admin'));
