import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    name: string;
    images: Array<{ url: string }>;
  };
  duration_ms: number;
  popularity: number;
  preview_url: string | null;
  external_urls: {
    spotify: string;
  };
}

interface SpotifySearchResponse {
  tracks: {
    items: SpotifyTrack[];
    total: number;
  };
}

async function getSpotifyAccessToken(): Promise<string> {
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET');
  
  if (!clientId || !clientSecret) {
    throw new Error('Spotify credentials not configured');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error('Failed to get Spotify access token');
  }

  const data = await response.json();
  return data.access_token;
}

function formatDuration(durationMs: number): string {
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getDifficultyFromPopularity(popularity: number): 'Easy' | 'Medium' | 'Hard' {
  if (popularity >= 70) return 'Easy';
  if (popularity >= 40) return 'Medium';
  return 'Hard';
}

function getGenreFromArtist(artistName: string): string {
  // Simple genre mapping based on common artists
  const genreMap: { [key: string]: string } = {
    'Taylor Swift': 'Pop',
    'Ed Sheeran': 'Pop',
    'Adele': 'Soul',
    'Queen': 'Rock',
    'The Beatles': 'Rock',
    'Michael Jackson': 'Pop',
    'Billie Eilish': 'Pop',
    'Drake': 'Hip-Hop',
    'Kendrick Lamar': 'Hip-Hop',
    'Coldplay': 'Alternative',
    'Imagine Dragons': 'Alternative',
    'Maroon 5': 'Pop Rock',
    'Bruno Mars': 'Pop',
    'Justin Bieber': 'Pop',
    'Ariana Grande': 'Pop',
  };
  
  return genreMap[artistName] || 'Pop';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, limit = 20 } = await req.json();

    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Search query is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Searching for songs: "${query}"`);

    // Get Spotify access token
    const accessToken = await getSpotifyAccessToken();

    // Search for tracks on Spotify
    const searchUrl = new URL('https://api.spotify.com/v1/search');
    searchUrl.searchParams.append('q', query);
    searchUrl.searchParams.append('type', 'track');
    searchUrl.searchParams.append('limit', limit.toString());
    searchUrl.searchParams.append('market', 'US');

    const searchResponse = await fetch(searchUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!searchResponse.ok) {
      throw new Error(`Spotify API error: ${searchResponse.status}`);
    }

    const searchData: SpotifySearchResponse = await searchResponse.json();

    // Transform Spotify data to our format
    const songs = searchData.tracks.items.map((track) => ({
      id: track.id,
      title: track.name,
      artist: track.artists.map(artist => artist.name).join(', '),
      album: track.album.name,
      genre: getGenreFromArtist(track.artists[0]?.name || ''),
      duration: formatDuration(track.duration_ms),
      difficulty: getDifficultyFromPopularity(track.popularity),
      popularity: track.popularity,
      previewUrl: track.preview_url,
      spotifyUrl: track.external_urls.spotify,
      imageUrl: track.album.images[0]?.url || null,
    }));

    console.log(`Found ${songs.length} songs`);

    return new Response(
      JSON.stringify({ 
        songs,
        total: searchData.tracks.total 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error searching songs:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to search songs' 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});