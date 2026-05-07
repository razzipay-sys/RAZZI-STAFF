import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';

// Layout
import MainLayout from './components/layout/MainLayout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import StaffDirectory from './pages/StaffDirectory';
import StaffForm from './pages/StaffForm';
import StaffProfile from './pages/StaffProfile';
import Documents from './pages/Documents';
import SalaryManagement from './pages/SalaryManagement';
import WorkflowReports from './pages/WorkflowReports';
import HRCalendar from './pages/HRCalendar';
import Analytics from './pages/Analytics';
import AuditLogs from './pages/AuditLogs';
import Recommendations from './pages/Recommendations';
import Settings from './pages/Settings';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isAuthenticated } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #0d1b2e 0%, #0f2744 100%)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#20b2aa]/30 border-t-[#20b2aa] rounded-full animate-spin" />
          <p className="text-sm text-white/50">Loading RazziStaff...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <Register />} />
      <Route element={isAuthenticated ? <MainLayout /> : <Navigate to="/login" replace />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/staff" element={<StaffDirectory />} />
        <Route path="/staff/new" element={<StaffForm />} />
        <Route path="/staff/:id" element={<StaffProfile />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/salary" element={<SalaryManagement />} />
        <Route path="/workflow" element={<WorkflowReports />} />
        <Route path="/calendar" element={<HRCalendar />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/audit-logs" element={<AuditLogs />} />
        <Route path="/recommendations" element={<Recommendations />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
