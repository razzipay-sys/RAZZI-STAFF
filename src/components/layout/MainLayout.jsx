import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { cn } from '@/lib/utils';

const pageTitles = {
  '/': 'Dashboard — RazziStaff',
  '/staff': 'Staff Directory',
  '/staff/new': 'Add New Staff',
  '/documents': 'Document Management',
  '/salary': 'Bank & Salary',
  '/workflow': 'Workflow Reports',
  '/calendar': 'HR Calendar',
  '/analytics': 'Analytics',
  '/audit-logs': 'Audit Logs',
  '/recommendations': 'Platform Recommendations',
  '/settings': 'Settings',
};

export default function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const location = useLocation();
  
  const getTitle = () => {
    if (location.pathname.startsWith('/staff/') && location.pathname !== '/staff/new') {
      return 'Staff Profile';
    }
    return pageTitles[location.pathname] || 'RazziStaff';
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      <Header 
        sidebarCollapsed={sidebarCollapsed} 
        toggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
        title={getTitle()}
      />
      <main className={cn(
        "pt-16 min-h-screen transition-all duration-300",
        sidebarCollapsed ? "pl-16" : "pl-64"
      )}>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}