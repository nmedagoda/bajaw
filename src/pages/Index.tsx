import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, Mic, Users, Gavel, Sparkles, Trophy, Globe, Play } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const Index = () => {
  const { user, profile, activeRole } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [demoOpen, setDemoOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (user && (activeRole || profile)) {
      const role = (activeRole || profile?.role) as string;
      switch (role) {
        case 'singer': navigate('/singer/dashboard'); break;
        case 'judge': navigate('/judge/dashboard'); break;
        case 'audience': navigate('/audience/dashboard'); break;
      }
    }
  }, [user, profile, activeRole, navigate]);

  if (user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-primary/10">
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <LanguageSwitcher />
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
              {t('hero.welcome')} <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{t('hero.brand')}</span>
            </h1>

            <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              {t('hero.subtitle')}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Button size="lg" onClick={() => navigate('/auth')} className="px-8 py-3">
                <Sparkles className="w-5 h-5 mr-2" />
                {t('hero.getStarted')}
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate('/performances')} className="px-8 py-3">
                <Trophy className="w-5 h-5 mr-2" />
                {t('hero.watchPerformances')}
              </Button>
            </div>

            <div className="mb-12">
              <Button variant="outline" size="lg" onClick={() => setDemoOpen(true)} className="px-8 py-3 border-primary/50 hover:bg-primary/10">
                <Play className="w-5 h-5 mr-2" />
                {t('hero.watchDemo')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Video Dialog */}
      <Dialog open={demoOpen} onOpenChange={(open) => {
        setDemoOpen(open);
        if (!open && videoRef.current) videoRef.current.pause();
      }}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogTitle className="sr-only">Bajawu Demo Video</DialogTitle>
          <video ref={videoRef} src="/videos/bajawu-demo.mp4" controls autoPlay className="w-full h-auto" />
        </DialogContent>
      </Dialog>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{t('features.title')}</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t('features.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {(['singer', 'judge', 'audience'] as const).map((role) => {
            const icons = { singer: Mic, judge: Gavel, audience: Users };
            const gradients = {
              singer: 'from-accent to-accent/80',
              judge: 'from-primary to-primary/80',
              audience: 'from-secondary-foreground to-muted-foreground',
            };
            const textColors = { singer: 'text-accent-foreground', judge: 'text-primary-foreground', audience: 'text-secondary' };
            const Icon = icons[role];
            return (
              <Card key={role} className="text-center group hover:shadow-xl transition-all duration-300 border-border/50">
                <CardHeader>
                  <div className={`w-16 h-16 bg-gradient-to-br ${gradients[role]} rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-8 h-8 ${textColors[role]}`} />
                  </div>
                  <CardTitle className="text-2xl">{t(`features.${role}.title`)}</CardTitle>
                  <CardDescription className="text-base">{t(`features.${role}.description`)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="text-sm text-muted-foreground space-y-2">
                    {(t(`features.${role}.items`, { returnObjects: true }) as string[]).map((item, i) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Global Community Section */}
      <div className="bg-card/50 border-y border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <Globe className="w-16 h-16 text-primary mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{t('global.title')}</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto mb-8">{t('global.subtitle')}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
              {[
                { emoji: '🎵', key: 'allGenres' },
                { emoji: '🌍', key: 'globalCommunity' },
                { emoji: '👵👴', key: 'allAges' },
                { emoji: '🤝', key: 'socialConnection' },
              ].map((item) => (
                <div key={item.key} className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">{item.emoji}</div>
                  <p className="text-sm text-muted-foreground">{t(`global.${item.key}`)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{t('cta.title')}</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">{t('cta.subtitle')}</p>
          <Button size="lg" onClick={() => navigate('/auth')} className="px-8 py-3">
            <Music className="w-5 h-5 mr-2" />
            {t('cta.button')}
          </Button>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">{t('footer.copyright')}</p>
            <p>
              {t('footer.credit')}{' '}
              <a href="https://www.deepai.co.nz" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-colors underline">
                www.deepai.co.nz
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
