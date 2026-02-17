import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface TermsAndConditionsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TermsAndConditions: React.FC<TermsAndConditionsProps> = ({ open, onOpenChange }) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{t('terms.title')}</DialogTitle>
          <DialogDescription>{t('terms.subtitle')}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6 text-sm">
            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{t('terms.section1Title')}</h3>
              <p className="text-muted-foreground leading-relaxed mb-3">{t('terms.section1Text')}</p>
              <p className="text-muted-foreground leading-relaxed font-medium">{t('terms.section1Jurisdiction')}</p>
            </section>
            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{t('terms.section2Title')}</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">{t('terms.section2Text')}</p>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                {(t('terms.section2Items', { returnObjects: true }) as string[]).map((item, i) => (<li key={i}>{item}</li>))}
              </ul>
            </section>
            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{t('terms.section3Title')}</h3>
              <p className="text-muted-foreground leading-relaxed">{t('terms.section3Text')}</p>
            </section>
            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{t('terms.section4Title')}</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">{t('terms.section4Text')}</p>
              <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
                {(t('terms.section4Items', { returnObjects: true }) as string[]).map((item, i) => (<li key={i}>{item}</li>))}
              </ul>
            </section>
            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{t('terms.section5Title')}</h3>
              <p className="text-muted-foreground leading-relaxed">{t('terms.section5Text')}</p>
            </section>
            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{t('terms.section6Title')}</h3>
              <p className="text-muted-foreground leading-relaxed">{t('terms.section6Text')}</p>
            </section>
            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{t('terms.section7Title')}</h3>
              <p className="text-muted-foreground leading-relaxed">{t('terms.section7Text')}</p>
            </section>
            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{t('terms.section8Title')}</h3>
              <p className="text-muted-foreground leading-relaxed">{t('terms.section8Text')}</p>
            </section>
            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{t('terms.section9Title')}</h3>
              <p className="text-muted-foreground leading-relaxed font-medium">{t('terms.section9Text')}</p>
            </section>
            <section>
              <h3 className="text-lg font-semibold mb-2 text-foreground">{t('terms.section10Title')}</h3>
              <p className="text-muted-foreground leading-relaxed">{t('terms.section10Text')}</p>
            </section>
            <section className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground italic">
                {t('terms.lastUpdated')} {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default TermsAndConditions;