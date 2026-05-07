import React from 'react';
import { Bell, Search, Moon, Sun, Menu, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import useRoleAccess from '@/lib/useRoleAccess';
import { useQuery } from '@tanstack/react-query';
import { entities } from '@/lib/supabaseEntities';
import { useNavigate } from 'react-router-dom';

export default function Header({ sidebarCollapsed, toggleSidebar, title }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { role = '', isAdmin } = useRoleAccess();
  
  // Fetch staff profile for avatar and full name
  const { data: staffProfile } = useQuery({
    queryKey: ['my-profile', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const profiles = await entities.StaffProfile.filter({ email: user.email });
      return profiles[0] || null;
    },
    enabled: !!user?.email,
  });

  const [darkMode, setDarkMode] = React.useState(() => {
    if (typeof window !== 'undefined') return document.documentElement.classList.contains('dark');
    return true;
  });

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
    setDarkMode(!darkMode);
  };

  const getInitials = (name, email) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    if (email) return email.slice(0, 2).toUpperCase();
    return 'U';
  };

  const displayName = staffProfile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const avatarUrl = staffProfile?.profile_photo_url || user?.user_metadata?.avatar_url;

  return (
    <header className={cn(
      "fixed top-0 right-0 z-30 h-16 bg-background/80 backdrop-blur-lg border-b border-border transition-all duration-300",
      sidebarCollapsed ? "left-0 md:left-16" : "left-0 md:left-64"
    )}>
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2 md:gap-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleSidebar}>
            <Menu className="w-5 h-5" />
          </Button>
          <h1 className="text-base md:text-lg font-semibold text-foreground truncate max-w-[150px] md:max-w-none">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="w-56 pl-10 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary text-sm"
            />
          </div>

          <Button variant="ghost" size="icon" onClick={toggleDarkMode} className="text-muted-foreground hover:text-foreground">
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <div className="p-4 text-center text-muted-foreground text-sm">No new notifications</div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-9 px-2 rounded-full">
                <Avatar className="w-7 h-7">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="text-xs bg-primary/20 text-primary font-semibold">
                    {getInitials(displayName, user?.email)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden md:block text-sm font-medium max-w-28 truncate">{displayName}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                <span className="inline-block mt-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium capitalize">
                  {role.replace('_', ' ')}
                </span>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="gap-2 text-sm cursor-pointer"
                onClick={() => staffProfile ? navigate(`/staff/${staffProfile.id}`) : navigate('/settings')}
              >
                <User className="w-4 h-4" /> Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="gap-2 text-sm text-destructive cursor-pointer focus:text-destructive">
                <LogOut className="w-4 h-4" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
