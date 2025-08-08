import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import { Music, Mic, Users, Gavel, Search, Trophy, User, LogOut } from 'lucide-react';

const Navigation = () => {
  const { user, profile, signOut } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const roleConfig = {
    singer: {
      icon: Mic,
      color: 'text-accent',
      routes: [
        { path: '/singer/dashboard', label: 'My Performances', icon: Mic },
        { path: '/singer/record', label: 'Record New Song', icon: Music },
        { path: '/performances', label: 'Browse Performances', icon: Search },
      ]
    },
    judge: {
      icon: Gavel,
      color: 'text-primary',
      routes: [
        { path: '/judge/dashboard', label: 'Judge Dashboard', icon: Gavel },
        { path: '/performances', label: 'Rate Performances', icon: Trophy },
      ]
    },
    audience: {
      icon: Users,
      color: 'text-secondary-foreground',
      routes: [
        { path: '/audience/dashboard', label: 'Audience Dashboard', icon: Users },
        { path: '/performances', label: 'Watch & Vote', icon: Trophy },
      ]
    }
  };

  const config = roleConfig[profile?.role as keyof typeof roleConfig];
  if (!config) return null;

  return (
    <nav className="bg-card border-b border-border/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center space-x-8">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <Music className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">Bajaw</span>
            </Link>
            
            <div className="flex items-center space-x-6">
              {config.routes.map((route) => {
                const Icon = route.icon;
                const isActive = location.pathname === route.path;
                return (
                  <Link
                    key={route.path}
                    to={route.path}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{route.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <config.icon className={`w-5 h-5 ${config.color}`} />
              <span className="text-sm font-medium capitalize">{profile?.role}</span>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.profile_photo_url || ''} alt={profile?.full_name || ''} />
                    <AvatarFallback>
                      {profile?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium">{profile?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    Profile Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
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