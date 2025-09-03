import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, Mic, Users, Gavel, Sparkles, Trophy, Globe } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';

const Index = () => {
  const { user, profile, activeRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect authenticated users to their dashboard based on active role selection
    if (user && (activeRole || profile)) {
      const role = (activeRole || profile?.role) as string;
      switch (role) {
        case 'singer':
          navigate('/singer/dashboard');
          break;
        case 'judge':
          navigate('/judge/dashboard');
          break;
        case 'audience':
          navigate('/audience/dashboard');
          break;
        default:
          break;
      }
    }
  }, [user, profile, activeRole, navigate]);

  if (user) {
    return null; // Will redirect above
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/10">
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center shadow-2xl">
                <Music className="w-10 h-10 text-primary-foreground" />
              </div>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              Welcome to <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Bajaw</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              The global vocal performance comparison platform that helps singers improve through AI analysis and community feedback
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Button size="lg" onClick={() => navigate('/auth')} className="px-8 py-3">
                <Sparkles className="w-5 h-5 mr-2" />
                Get Started
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate('/performances')} className="px-8 py-3">
                <Trophy className="w-5 h-5 mr-2" />
                Watch Performances
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Three Ways to Experience Music
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join our global community as a singer, judge, or audience member
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Singer */}
          <Card className="text-center group hover:shadow-xl transition-all duration-300 border-border/50">
            <CardHeader>
              <div className="w-16 h-16 bg-gradient-to-br from-accent to-accent/80 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Mic className="w-8 h-8 text-accent-foreground" />
              </div>
              <CardTitle className="text-2xl">Singer</CardTitle>
              <CardDescription className="text-base">
                Record performances and get AI-powered vocal analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Search and select songs</li>
                <li>• Record with karaoke tracks</li>
                <li>• Get similarity scores vs professionals</li>
                <li>• Receive detailed vocal feedback</li>
                <li>• Upload your own recordings</li>
              </ul>
            </CardContent>
          </Card>

          {/* Judge */}
          <Card className="text-center group hover:shadow-xl transition-all duration-300 border-border/50">
            <CardHeader>
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Gavel className="w-8 h-8 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl">Judge</CardTitle>
              <CardDescription className="text-base">
                Provide expert evaluation and constructive feedback
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Watch singer performances</li>
                <li>• Access AI analysis insights</li>
                <li>• Rate with detailed criteria</li>
                <li>• Leave constructive comments</li>
                <li>• Help singers improve</li>
              </ul>
            </CardContent>
          </Card>

          {/* Audience */}
          <Card className="text-center group hover:shadow-xl transition-all duration-300 border-border/50">
            <CardHeader>
              <div className="w-16 h-16 bg-gradient-to-br from-secondary-foreground to-muted-foreground rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8 text-secondary" />
              </div>
              <CardTitle className="text-2xl">Audience</CardTitle>
              <CardDescription className="text-base">
                Enjoy performances and vote for your favorites
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Browse all performances</li>
                <li>• Vote for favorites</li>
                <li>• See community ratings</li>
                <li>• Discover new talent</li>
                <li>• Enjoy global music diversity</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Global Community Section */}
      <div className="bg-card/50 border-y border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <Globe className="w-16 h-16 text-primary mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              A Global Entertainment Platform
            </h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8">
              Bajaw brings together singers, judges, and music lovers from every culture and age group. 
              Whether you're 8 or 80, there's a place for you in our musical community.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">🎵</div>
                <p className="text-sm text-muted-foreground">All Genres</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">🌍</div>
                <p className="text-sm text-muted-foreground">Global Community</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">👵👴</div>
                <p className="text-sm text-muted-foreground">All Ages Welcome</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-2">🤝</div>
                <p className="text-sm text-muted-foreground">Social Connection</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ready to Share Your Voice?
          </h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of singers, judges, and music lovers from around the world
          </p>
          <Button size="lg" onClick={() => navigate('/auth')} className="px-8 py-3">
            <Music className="w-5 h-5 mr-2" />
            Join Bajaw Today
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
