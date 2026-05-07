# RazziStaff — HR Management Platform

A full-featured HR management system built with React + Vite + Supabase.

---

## Stack

- **Frontend**: React 18, Vite, TailwindCSS, shadcn/ui
- **Backend/DB**: Supabase (PostgreSQL + Auth + Storage)
- **State**: TanStack Query
- **Charts**: Recharts

---

## 1. Supabase Setup

### Create your project
1. Go to [supabase.com](https://supabase.com) → New Project
2. Choose a name, password, region (pick closest to Nigeria e.g. EU West)
3. Wait ~2 min for provisioning

### Run the schema
1. In Supabase dashboard → **SQL Editor** → **New query**
2. Paste the entire contents of `supabase-schema.sql`
3. Click **Run**

### Create Storage bucket
1. Supabase dashboard → **Storage** → **New bucket**
2. Name: `staff-documents`
3. Public: **ON** (so document URLs work without signed tokens)

### Get your credentials
1. Supabase dashboard → **Settings** → **API**
2. Copy **Project URL** and **anon public key**

---

## 2. Local Setup

```bash
# Clone/unzip the project
cd RAZZI-STAFF-SUPABASE

# Install dependencies
npm install

# Create your env file
cp .env.example .env
```

Edit `.env`:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_SUPER_ADMIN_EMAIL=your-admin@email.com
```

```bash
# Start dev server
npm run dev
```

---

## 3. Authentication Setup

### Email/Password (default)
Works out of the box. Users sign up → get email confirmation → sign in.

To disable email confirmation for internal apps:
- Supabase → **Auth** → **Settings** → **Email** → uncheck "Enable email confirmations"

### Google OAuth (optional)
1. [Google Cloud Console](https://console.cloud.google.com) → Create OAuth 2.0 credentials
2. Authorized redirect URI: `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
3. Supabase → **Auth** → **Providers** → **Google** → paste Client ID + Secret

---

## 4. User Roles

Roles are stored in `user_metadata.role` on each Supabase user.

| Role | Access |
|------|--------|
| `super_admin` | Full access (set via `VITE_SUPER_ADMIN_EMAIL`) |
| `admin` | All except salary/finance |
| `hr_admin` | Staff + Documents |
| `finance_admin` | Salary + Bank only |
| `manager` | Workflow reports |
| `user` | Read-only dashboard |

**To assign a role to a user:**
1. Supabase → **Authentication** → find the user
2. Edit → **User Metadata** → add: `{"role": "admin"}`

Or via SQL:
```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "hr_admin"}'::jsonb
WHERE email = 'staff@yourcompany.com';
```

---

## 5. Deploy to Production

### Vercel (recommended)
```bash
npm install -g vercel
vercel
# Add env vars in Vercel dashboard
```

### Netlify
```bash
npm run build
# Upload dist/ folder or connect GitHub repo
# Add env vars in Netlify settings
```

Add this `vercel.json` for SPA routing:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

---

## 6. Supabase Row Level Security

The schema enables RLS with permissive policies for authenticated users.
Fine-grained access is enforced at the **application layer** via `useRoleAccess`.

For stricter DB-level policies (e.g. finance_admin can only read bank_details), add:
```sql
CREATE POLICY "finance_only_bank_details"
  ON staff_bank_details FOR SELECT TO authenticated
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) 
    IN ('super_admin', 'admin', 'finance_admin')
  );
```

---

## 7. File Structure

```
src/
├── assets/
│   └── logo.jpeg
├── components/
│   ├── layout/        Header, Sidebar, MainLayout
│   └── ui/            shadcn components
├── lib/
│   ├── supabase.js          ← Supabase client
│   ├── supabaseEntities.js  ← CRUD helpers (replaces base44)
│   ├── AuthContext.jsx      ← Supabase auth context
│   ├── useRoleAccess.js     ← Role/permission hooks
│   └── useAuditLog.js       ← Audit trail
└── pages/
    ├── Login.jsx
    ├── Dashboard.jsx
    ├── StaffDirectory.jsx
    ├── StaffProfile.jsx
    ├── StaffForm.jsx
    ├── Documents.jsx
    ├── SalaryManagement.jsx
    ├── WorkflowReports.jsx
    ├── HRCalendar.jsx
    ├── Analytics.jsx
    ├── AuditLogs.jsx
    ├── Recommendations.jsx
    └── Settings.jsx
```
