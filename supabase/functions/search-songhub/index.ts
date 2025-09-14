import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SongResult {
  id: string;
  title: string;
  artist: string;
  url: string;
  imageUrl?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { query } = await req.json()
    
    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      )
    }

    console.log(`Searching Songhub for: ${query}`)
    
    // Search on songhub.lk - they might have a search endpoint or we'll search through the karaoke page
    const searchUrl = `https://songhub.lk/karoke-song?q=${encodeURIComponent(query)}`
    const fallbackUrl = 'https://songhub.lk/karoke-song'
    
    let response
    try {
      response = await fetch(searchUrl)
      if (!response.ok) {
        // Try fallback URL and filter client-side
        response = await fetch(fallbackUrl)
      }
    } catch (error) {
      console.error('Error fetching from Songhub:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch from Songhub' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    const html = await response.text()
    
    // Parse HTML to extract song information
    const songResults: SongResult[] = []
    const queryLower = query.toLowerCase()
    
    // Match the exact HTML structure from songhub.lk
    const itemRegex = /<div class="item">\s*<a href="([^"]+)">\s*<img[^>]+src="([^"]+)"[^>]+alt="([^"]+)"[^>]*>\s*<span>([^<]+)<\/span>\s*<\/a>\s*<\/div>/gs
    
    let match
    let index = 0
    
    while ((match = itemRegex.exec(html)) !== null && songResults.length < 20) {
      const [, url, imageUrl, alt, spanText] = match
      
      if (!url || !spanText) continue
      
      // Use the span text as the title, clean it up
      let title = spanText.replace(/\s*karaoke\s*/gi, '').trim()
      title = title.replace(/\s*mp3\s*/gi, '').trim()
      
      let artist = 'Unknown Artist'
      
      // Extract artist from title patterns
      const artistPatterns = [
        /^(.+?)\s*[-–]\s*(.+?)$/,  // "Song - Artist"
        /^(.+?)\s*\(\s*(.+?)\s*\)$/, // "Song (Artist)"
        /^(.+?)\s*by\s+(.+?)$/i,     // "Song by Artist"
      ]
      
      for (const artistPattern of artistPatterns) {
        const artistMatch = title.match(artistPattern)
        if (artistMatch) {
          title = artistMatch[1].trim()
          artist = artistMatch[2].trim()
          break
        }
      }
      
      // Filter based on search query
      const titleLower = title.toLowerCase()
      const artistLower = artist.toLowerCase()
      
      if (titleLower.includes(queryLower) || artistLower.includes(queryLower)) {
        songResults.push({
          id: `songhub-${index}`,
          title: title,
          artist: artist,
          url: url,
          imageUrl: imageUrl
        })
        
        index++
      }
    }

    console.log(`Found ${songResults.length} results for "${query}"`)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        results: songResults,
        query: query 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in search-songhub function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})