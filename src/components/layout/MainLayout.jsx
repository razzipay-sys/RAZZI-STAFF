import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const isMobile = useIsMobile();
  
  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const getTitle = () => {
    if (location.pathname.startsWith('/staff/') && location.pathname !== '/staff/new') {
      return 'Staff Profile';
    }
    return pageTitles[location.pathname] || 'RazziStaff';
  };

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileMenuOpen(!mobileMenuOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sidebar collapsed={sidebarCollapsed} setCollapsed={setSidebarCollapsed} />
      )}

      {/* Mobile Sidebar (Sheet) */}
      {isMobile && (
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="p-0 w-64 border-none">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <Sidebar 
              collapsed={false} 
              setCollapsed={() => setMobileMenuOpen(false)} 
              className="relative w-full h-full"
            />
          </SheetContent>
        </Sheet>
      )}

      <div className="flex-1 flex flex-col min-h-screen">
        <Header 
          sidebarCollapsed={isMobile ? true : sidebarCollapsed} 
          toggleSidebar={toggleSidebar}
          title={getTitle()}
        />
        
        <main className={cn(
          "flex-1 transition-all duration-300 pt-16",
          !isMobile && (sidebarCollapsed ? "pl-16" : "pl-64")
        )}>
          <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}