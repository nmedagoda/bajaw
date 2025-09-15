import React, { useEffect, useState } from 'react';
import { resolvePlayableUrl } from '@/lib/media';
import { Loader2 } from 'lucide-react';

interface OriginalSongPlayerProps {
  originalSongUrl?: string | null;
  karaokeOriginalFile?: File | null;
}

export const OriginalSongPlayer: React.FC<OriginalSongPlayerProps> = ({
  originalSongUrl,
  karaokeOriginalFile
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadUrl = async () => {
      if (originalSongUrl) {
        setIsLoading(true);
        try {
          const resolved = await resolvePlayableUrl(originalSongUrl);
          setResolvedUrl(resolved);
        } catch (error) {
          console.error('Failed to resolve original song URL:', error);
        } finally {
          setIsLoading(false);
        }
      } else if (karaokeOriginalFile) {
        setResolvedUrl(URL.createObjectURL(karaokeOriginalFile));
      }
    };

    loadUrl();
  }, [originalSongUrl, karaokeOriginalFile]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        <span className="text-sm text-muted-foreground">Loading original song...</span>
      </div>
    );
  }

  if (!resolvedUrl) {
    return null;
  }

  return (
    <audio
      controls
      className="w-full"
      src={resolvedUrl}
      preload="metadata"
    />
  );
};