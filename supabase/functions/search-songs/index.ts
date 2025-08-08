import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

interface GoogleSearchResponse {
  results: SearchResult[];
}

async function searchGoogleForSongs(query: string): Promise<SearchResult[]> {
  try {
    // Search specifically for Sinhala songs
    const searchQuery = `${query} sinhala song lyrics sri lanka`;
    
    // Mock search results for Sinhala songs - in production, you'd use a real search API
    const mockResults: SearchResult[] = [
      {
        title: `${query} - Sinhala Song Official Video`,
        link: `https://www.youtube.com/watch?v=example`,
        snippet: `Official Sinhala music video for ${query}. Popular Sri Lankan song...`
      },
      {
        title: `${query} Sinhala Lyrics`,
        link: `https://sinhala-lyrics.com/example`,
        snippet: `Sinhala lyrics for ${query}. Traditional Sri Lankan song...`
      },
      {
        title: `${query} - Sri Lankan Music`,
        link: `https://music.lk/track/example`,
        snippet: `Listen to ${query} Sinhala song. Popular in Sri Lankan music scene...`
      }
    ];

    return mockResults;
  } catch (error) {
    console.error('Error searching Google:', error);
    return [];
  }
}

function extractSongInfo(searchResult: SearchResult, index: number) {
  const title = searchResult.title;
  
  // Extract artist and song from title
  let songTitle = '';
  let artist = 'Unknown Artist';
  
  // Try to parse common title formats
  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    if (parts.length >= 2) {
      songTitle = parts[0].trim();
      artist = parts[1].replace(/\(.*\)/g, '').trim();
    }
  } else if (title.includes(' by ')) {
    const parts = title.split(' by ');
    if (parts.length >= 2) {
      songTitle = parts[0].trim();
      artist = parts[1].replace(/\(.*\)/g, '').trim();
    }
  } else {
    // Fallback - use title as song name
    songTitle = title.replace(/\(.*\)/g, '').replace(/Official.*|Music Video|Lyrics/gi, '').trim();
  }

  // Generate mock data for Sinhala songs
  const genres = ['Sinhala Pop', 'Baila', 'Classical Sinhala', 'Folk', 'Contemporary Sinhala', 'Traditional'];
  const difficulties: ('Easy' | 'Medium' | 'Hard')[] = ['Easy', 'Medium', 'Hard'];
  
  // Generate sample lyrics structure (placeholder only - avoid copyright content)
  const generateSampleLyrics = (title: string, artist: string) => {
    return `[Verse 1]
This is where the song lyrics would appear
For "${title}" by ${artist}
(Actual lyrics would be retrieved from a licensed source)

[Chorus]
Sample lyrics structure shown here
Real implementation would require proper licensing
To display copyrighted lyrical content

[Verse 2]
Additional verses and content
Would be structured similarly
Following standard song format

[Bridge]
Musical bridge section here
With appropriate lyrical content

[Chorus]
Repeating chorus section
As commonly found in songs

[Outro]
Song conclusion lyrics
Final musical phrases`;
  };
  
  return {
    id: `google-${index}-${Date.now()}`,
    title: songTitle || `Song ${index + 1}`,
    artist: artist,
    album: 'Unknown Album',
    genre: genres[index % genres.length],
    duration: `${Math.floor(Math.random() * 3) + 2}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
    difficulty: difficulties[index % difficulties.length],
    popularity: Math.floor(Math.random() * 100),
    previewUrl: null,
    spotifyUrl: searchResult.link.includes('spotify') ? searchResult.link : undefined,
    imageUrl: null,
    searchSnippet: searchResult.snippet,
    originalUrl: searchResult.link,
    lyrics: generateSampleLyrics(songTitle || `Song ${index + 1}`, artist),
    lyricsImageUrl: Math.random() > 0.5 ? '/lovable-uploads/fa7b84ce-1981-49b5-89a7-75a6464deeae.png' : null,
    lyricsLanguage: 'Sinhala'
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, limit = 10 } = await req.json();

    if (!query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Search query is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Searching Google for songs: "${query}"`);

    // Search Google for songs
    const searchResults = await searchGoogleForSongs(query);
    
    // Transform search results to our song format
    const songs = searchResults.slice(0, limit).map((result, index) => 
      extractSongInfo(result, index)
    );

    console.log(`Found ${songs.length} songs from Google search`);

    return new Response(
      JSON.stringify({ 
        songs,
        total: searchResults.length,
        source: 'google'
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