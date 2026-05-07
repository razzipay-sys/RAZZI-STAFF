import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  ClipboardList, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Calendar,
  BarChart3,
  Shield,
  Lightbulb,
  LogOut
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { entities } from '@/lib/supabaseEntities';
import { useAuth } from '@/lib/AuthContext';
import { useQuery } from '@tanstack/react-query';
import useRoleAccess from '@/lib/useRoleAccess';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import logo from '@/assets/logo.jpeg';

const navItems = [
  { 
    title: 'Dashboard', 
    icon: LayoutDashboard, 
    href: '/',
    permission: null 
  },
  { 
    title: 'Staff Directory', 
    icon: Users, 
    href: '/staff',
    permission: 'canViewAllStaff'
  },
  { 
    title: 'Documents', 
    icon: FileText, 
    href: '/documents',
    permission: 'canViewDocuments'
  },
  { 
    title: 'Bank & Salary', 
    icon: DollarSign, 
    href: '/salary',
    permission: 'canViewSalary'
  },
  { 
    title: 'Workflow Reports', 
    icon: ClipboardList, 
    href: '/workflow',
    permission: 'canViewWorkflow'
  },
  { 
    title: 'HR Calendar', 
    icon: Calendar, 
    href: '/calendar',
    permission: 'canViewAllStaff'
  },
  { 
    title: 'Analytics', 
    icon: BarChart3, 
    href: '/analytics',
    permission: 'canViewWorkflow'
  },
  { 
    title: 'Audit Logs', 
    icon: Shield, 
    href: '/audit-logs',
    permission: 'canViewAuditLogs'
  },
  { 
    title: 'Access Control', 
    icon: Shield, 
    href: '/access-control',
    permission: 'canManageRoles'
  },
  { 
    title: 'Recommendations', 
    icon: Lightbulb, 
    href: '/recommendations',
    permission: null
  },
  { 
    title: 'Settings', 
    icon: Settings, 
    href: '/settings',
    permission: null
  },
];

export default function Sidebar({ collapsed, setCollapsed, className }) {
  const location = useLocation();
  const { user } = useAuth();
  const { hasPermission, role, isAdmin } = useRoleAccess();

  // Fetch staff profile for avatar and full name
  const { data: staffProfile } = useQuery({
    queryKey: ['my-profile', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const profiles = await entities.StaffProfile.filter({ email: user.email });
      return profiles[0] || null;
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const getInitials = (name, email) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email.slice(0, 2).toUpperCase();
    return 'U';
  };

  const displayName = staffProfile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const avatarUrl = staffProfile?.profile_photo_url || user?.user_metadata?.avatar_url;

  const filteredNavItems = navItems.filter(item => {
    if (!item.permission) return true;
    if (isAdmin) return true;
    return hasPermission(item.permission);
  });

  const { logout } = useAuth();
  const handleLogout = () => { logout(); };

  return (
    <aside className={cn(
      "fixed left-0 top-0 z-40 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300",
      collapsed ? "w-16" : "w-64",
      className
    )}>
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <img src={logo} alt="RazziStaff" className="w-7 h-7 rounded-lg object-cover" />
              </div>
              <div>
                <span className="font-semibold text-sidebar-foreground leading-tight block">RazziStaff</span>
                <span className="text-[10px] text-sidebar-foreground/50 leading-tight block">RazziPay Internal Ops</span>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-2 py-4">
          <nav className="space-y-1">
            {filteredNavItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className={cn("w-5 h-5 flex-shrink-0", collapsed && "mx-auto")} />
                  {!collapsed && <span className="text-sm font-medium">{item.title}</span>}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User Section */}
        <div className="border-t border-sidebar-border p-4">
          {!collapsed && user && (
            <div className="mb-3 px-2 flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="bg-primary/20 text-primary text-[10px] font-bold">
                  {getInitials(displayName, user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{displayName}</p>
                <p className="text-[10px] text-sidebar-primary capitalize">{role?.replace('_', ' ')}</p>
              </div>
            </div>
          )}
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={cn(
              "w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              collapsed ? "justify-center px-2" : "justify-start"
            )}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span className="ml-2">Sign Out</span>}
          </Button>
        </div>
      </div>
    </aside>
  );
}
