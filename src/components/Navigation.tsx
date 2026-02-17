import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Music, Mic, Users, Gavel, Search, Trophy, User, LogOut } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const Navigation = () => {
  const { t } = useTranslation();
  const { user, profile, signOut, activeRole, setActiveRole, roles } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const roleConfig = {
    singer: {
      icon: Mic,
      color: 'text-accent',
      routes: [
        { path: '/singer/dashboard', label: t('nav.myPerformances'), icon: Mic },
        { path: '/singer/record', label: t('nav.recordNewSong'), icon: Music },
        { path: '/performances', label: t('nav.browsePerformances'), icon: Search },
        { path: '/profile', label: t('nav.profile'), icon: User },
      ]
    },
    judge: {
      icon: Gavel,
      color: 'text-primary',
      routes: [
        { path: '/judge/dashboard', label: t('nav.judgerDashboard'), icon: Gavel },
        { path: '/performances', label: t('nav.ratePerformances'), icon: Trophy },
        { path: '/profile', label: t('nav.profile'), icon: User },
      ]
    },
    audience: {
      icon: Users,
      color: 'text-secondary-foreground',
      routes: [
        { path: '/audience/dashboard', label: t('nav.audienceDashboard'), icon: Users },
        { path: '/performances', label: t('nav.watchAndVote'), icon: Trophy },
        { path: '/profile', label: t('nav.profile'), icon: User },
      ]
    }
  };

  const currentRole = (activeRole || profile?.role) as keyof typeof roleConfig | undefined;
  const config = currentRole ? roleConfig[currentRole] : undefined;
  if (!config) return null;

  return (
    <nav className="bg-card border-b border-border/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-2 sm:space-x-8">
            <Link to="/" className="flex items-center space-x-2 flex-shrink-0">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <Music className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground hidden sm:block">Bajawu</span>
            </Link>
            
            <div className="hidden lg:flex items-center space-x-6">
              {config.routes.map((route) => {
                const Icon = route.icon;
                const isActive = location.pathname === route.path;
                return (
                  <Link key={route.path} to={route.path} className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`}>
                    <Icon className="w-4 h-4" /><span>{route.label}</span>
                  </Link>
                );
              })}
            </div>

            <div className="flex lg:hidden items-center space-x-1">
              {config.routes.slice(0, 2).map((route) => {
                const Icon = route.icon;
                const isActive = location.pathname === route.path;
                return (
                  <Link key={route.path} to={route.path} className={`flex items-center justify-center p-2 rounded-md transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'}`} title={route.label}>
                    <Icon className="w-4 h-4" />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <LanguageSwitcher />
            <ThemeToggle />
            
            <div className="hidden sm:flex items-center space-x-2">
              <config.icon className={`w-5 h-5 ${config.color}`} />
              <span className="text-sm font-medium capitalize">{currentRole}</span>
            </div>

            {roles && roles.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="hidden sm:flex capitalize">
                    {t('nav.actingAs', { role: currentRole })}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {roles.map((r) => (
                    <DropdownMenuItem key={r} className="capitalize" onClick={() => setActiveRole(r)}>{r}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.profile_photo_url || ''} alt={profile?.full_name || ''} />
                    <AvatarFallback>{profile?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium">{profile?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground sm:hidden capitalize">{t('nav.role', { role: currentRole })}</p>
                </div>
                <DropdownMenuSeparator />
                <div className="lg:hidden">
                  {config.routes.slice(2).map((route) => (
                    <DropdownMenuItem key={route.path} asChild>
                      <Link to={route.path} className="flex items-center"><route.icon className="mr-2 h-4 w-4" />{route.label}</Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </div>
                {roles && roles.length > 1 && (
                  <div className="sm:hidden">
                    <div className="px-2 py-1 text-xs text-muted-foreground">{t('nav.switchRole')}</div>
                    {roles.map((r) => (
                      <DropdownMenuItem key={r} className="capitalize pl-4" onClick={() => setActiveRole(r)}>{r}</DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </div>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center"><User className="mr-2 h-4 w-4" />{t('nav.profileSettings')}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />{t('nav.signOut')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;