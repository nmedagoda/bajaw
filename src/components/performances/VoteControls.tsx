import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VoteControlsProps {
  performanceId: string;
  onVoted?: () => void;
}

type VoteRow = {
  id: string;
  voice_score: number | null;
  overall_score: number | null;
  score: number | null;
};

const VoteControls: React.FC<VoteControlsProps> = ({ performanceId, onVoted }) => {
  const { t } = useTranslation();
  const { user, profile, roles, activeRole } = useAuth();
  const canVote = useMemo(() => {
    if (activeRole) return activeRole === 'judge' || activeRole === 'audience';
    return roles?.includes('judge') || roles?.includes('audience') || profile?.role === 'judge' || profile?.role === 'audience';
  }, [activeRole, roles, profile?.role]);

  const [voice, setVoice] = useState<number>(5);
  const [overall, setOverall] = useState<number>(5);
  const [existingVoteId, setExistingVoteId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadExisting = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.from('votes').select('id, voice_score, overall_score, score').eq('performance_id', performanceId).eq('voter_id', user.id).maybeSingle();
        if (error && error.code !== 'PGRST116') throw error;
        const v = data as VoteRow | null;
        if (v) {
          setExistingVoteId(v.id);
          const base = v.score ?? 5;
          setVoice(v.voice_score ?? base);
          setOverall(v.overall_score ?? base);
        }
      } catch (e) {
        console.error('Failed to load existing vote', e);
      } finally {
        setLoading(false);
      }
    };
    loadExisting();
  }, [user, performanceId]);

  const handleSubmit = async () => {
    if (!user) { toast.error(t('vote.signInToVote')); return; }
    if (!canVote) { toast.error(t('vote.noPermission')); return; }
    setSubmitting(true);
    try {
      if (existingVoteId) {
        const { error } = await supabase.from('votes').update({ voice_score: voice, overall_score: overall, score: Math.round((voice + overall) / 2) }).eq('id', existingVoteId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('votes').insert({ voter_id: user.id, performance_id: performanceId, voice_score: voice, overall_score: overall, score: Math.round((voice + overall) / 2) });
        if (error) throw error;
      }
      toast.success(t('vote.thanks'));
      onVoted?.();
    } catch (e: any) {
      console.error('Vote failed', e);
      toast.error(e?.message ?? 'Failed to submit vote');
    } finally {
      setSubmitting(false);
    }
  };

  if (!canVote) return null;

  return (
    <div className="space-y-4 rounded-lg border border-border/50 p-3">
      <div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t('vote.voiceQuality')}</span>
          <span className="font-medium text-foreground">{voice}/10</span>
        </div>
        <Slider min={1} max={10} step={1} value={[voice]} onValueChange={(v) => setVoice(v[0])} className="mt-2" disabled={loading || submitting} />
      </div>
      <div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t('vote.overallSongQuality')}</span>
          <span className="font-medium text-foreground">{overall}/10</span>
        </div>
        <Slider min={1} max={10} step={1} value={[overall]} onValueChange={(v) => setOverall(v[0])} className="mt-2" disabled={loading || submitting} />
      </div>
      <p className="text-xs text-muted-foreground">{t('vote.scaleHint')}</p>
      <Button onClick={handleSubmit} className="w-full" disabled={submitting || loading}>
        {existingVoteId ? t('vote.updateVote') : t('vote.submitVote')}
      </Button>
    </div>
  );
};

export default VoteControls;