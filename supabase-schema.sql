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

-- ─── Row Level Security (RLS) ──────────────────────────────
-- Enable RLS on all tables
ALTER TABLE staff_profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_bank_details    ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_workflow_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs            ENABLE ROW LEVEL SECURITY;

-- POLICY: Authenticated users can read all records
-- (Fine-grained access enforced at application layer via useRoleAccess)
CREATE POLICY "authenticated_read_staff_profiles"
  ON staff_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_write_staff_profiles"
  ON staff_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_bank_details"
  ON staff_bank_details FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_write_bank_details"
  ON staff_bank_details FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_documents"
  ON staff_documents FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_write_documents"
  ON staff_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_workflow"
  ON daily_workflow_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_write_workflow"
  ON daily_workflow_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_audit_logs"
  ON audit_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_write_audit_logs"
  ON audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ─── Storage bucket for staff documents ───────────────────
-- Run this separately in Supabase dashboard > Storage > New bucket
-- Or uncomment if using service role key:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('staff-documents', 'staff-documents', true)
-- ON CONFLICT DO NOTHING;
