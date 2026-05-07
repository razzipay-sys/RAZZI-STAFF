-- ============================================================
-- RazziStaff — Supabase Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension (already on by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── staff_profiles ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_profiles (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                     TEXT,
  staff_id                    TEXT UNIQUE,
  full_name                   TEXT NOT NULL,
  email                       TEXT NOT NULL UNIQUE,
  phone                       TEXT,
  department                  TEXT CHECK (department IN ('Engineering','Finance','Operations','HR','Marketing','Sales','Customer Support','Legal','Product','Executive')),
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
  manager_id                  TEXT,
  manager_name                TEXT,
  staff_bio                   TEXT,
  skills                      TEXT[],
  responsibilities            TEXT,
  hr_notes                    TEXT,
  profile_completion_percentage NUMERIC DEFAULT 0,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── staff_bank_details ────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_bank_details (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id             TEXT NOT NULL REFERENCES staff_profiles(staff_id) ON DELETE CASCADE,
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

-- ─── staff_documents ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_documents (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id       TEXT NOT NULL,
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
  staff_id            TEXT NOT NULL,
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
  supervisor_id       TEXT,
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
  action_type       TEXT NOT NULL CHECK (action_type IN ('CREATE','UPDATE','DELETE','VIEW','EXPORT','LOGIN','LOGOUT')),
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

-- ─── Indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_staff_profiles_email ON staff_profiles(email);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_department ON staff_profiles(department);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_status ON staff_profiles(employment_status);
CREATE INDEX IF NOT EXISTS idx_workflow_reports_staff_date ON daily_workflow_reports(staff_id, report_date);
CREATE INDEX IF NOT EXISTS idx_documents_staff_id ON staff_documents(staff_id);
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
  FOREACH t IN ARRAY ARRAY['staff_profiles','staff_bank_details','staff_documents','daily_workflow_reports'] LOOP
    EXECUTE format('
      CREATE OR REPLACE TRIGGER trg_%s_updated_at
      BEFORE UPDATE ON %s
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ', t, t);
  END LOOP;
END;
$$;

-- ─── user_roles ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email             TEXT NOT NULL UNIQUE,
  role              TEXT NOT NULL DEFAULT 'user',
  assigned_by       UUID REFERENCES auth.users(id),
  assigned_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── app_settings ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  id                         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key                TEXT UNIQUE NOT NULL,
  setting_value              JSONB NOT NULL,
  description                TEXT,
  updated_by                 UUID REFERENCES auth.users(id),
  updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default settings
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
('work_schedule', '{"start_time": "09:00", "end_time": "17:00", "late_threshold_minutes": 15}', 'Standard company work schedule'),
('reminders', '{"salary_reminder_days": 5, "birthday_reminder_days": 30, "confirmation_reminder_days": 60}', 'HR and Finance reminder thresholds')
ON CONFLICT (setting_key) DO NOTHING;
-- ─── Row Level Security (RLS) ──────────────────────────────
-- Enable RLS on all tables
ALTER TABLE staff_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_bank_details    ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_workflow_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings          ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Staff Profiles Policies
CREATE POLICY "Profiles are viewable by everyone authenticated"
  ON staff_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Profiles can be created by admins"
  ON staff_profiles FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "Profiles can be updated by admins or owners"
  ON staff_profiles FOR UPDATE TO authenticated 
  USING (is_admin() OR auth.uid()::text = user_id)
  WITH CHECK (is_admin() OR auth.uid()::text = user_id);

-- user_roles Policies
CREATE POLICY "Roles are viewable by admins"
  ON user_roles FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "Roles can be managed by super_admins"
  ON user_roles FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- ─── Storage bucket for staff documents ───────────────────
-- Run this separately in Supabase dashboard > Storage > New bucket
-- Or uncomment if using service role key:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('staff-documents', 'staff-documents', true)
-- ON CONFLICT DO NOTHING;
