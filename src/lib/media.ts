import { supabase } from '@/integrations/supabase/client'

// Resolve a playable URL for Supabase Storage files (handles private buckets via signed URLs)
export const resolvePlayableUrl = async (url: string | null): Promise<string | null> => {
  if (!url) return null;
  try {
    const supabaseBase = 'https://ywosoqjzagmwhkybelqp.supabase.co';
    if (url.startsWith(`${supabaseBase}/storage/v1/object/`)) {
      const u = new URL(url);
      const parts = u.pathname.split('/');
      // parts example: ["", "storage", "v1", "object", "public", "audio-uploads", "path", "to", "file.mp3"]
      const objectIdx = parts.indexOf('object');
      if (objectIdx !== -1) {
        let bucketIdx = objectIdx + 1;
        if (parts[bucketIdx] === 'public' || parts[bucketIdx] === 'sign') {
          bucketIdx++;
        }
        const bucket = parts[bucketIdx];
        const objectPath = parts.slice(bucketIdx + 1).join('/');
        if (bucket && objectPath) {
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(objectPath, 60 * 60); // 1 hour
          if (!error && data?.signedUrl) return data.signedUrl;
        }
      }
    }
    // Non-storage or already accessible URLs
    return url;
  } catch (e) {
    return url;
  }
}
