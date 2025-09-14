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
    
    // Try multiple regex patterns to match different HTML structures
    const patterns = [
      // Pattern 1: Look for song cards with links and titles
      /<a[^>]+href="([^"]*karoke-song[^"]*)"[^>]*>.*?<img[^>]+src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/gs,
      // Pattern 2: Alternative structure
      /<div[^>]*class="[^"]*item[^"]*"[^>]*>.*?<a[^>]+href="([^"]*karoke-song[^"]*)"[^>]*>.*?<img[^>]+src="([^"]*)"[^>]*>.*?<span[^>]*>([^<]+)<\/span>/gs,
      // Pattern 3: Simple link pattern
      /<a[^>]+href="([^"]*karoke-song[^"]*)"[^>]*>([^<]*)<\/a>/gs
    ]
    
    let index = 0
    
    for (const pattern of patterns) {
      let match
      pattern.lastIndex = 0 // Reset regex
      
      while ((match = pattern.exec(html)) !== null && songResults.length < 20) {
        let url, imageUrl, title, artist = 'Unknown Artist'
        
        if (match.length === 5) {
          // Pattern 1: full match with image
          [, url, imageUrl, , title] = match
        } else if (match.length === 4) {
          // Pattern 2: alternative structure
          [, url, imageUrl, title] = match
        } else if (match.length === 3) {
          // Pattern 3: simple link
          [, url, title] = match
          imageUrl = undefined
        } else {
          continue
        }
        
        if (!url || !title) continue
        
        // Clean up the title and extract artist
        title = title.replace(/\s*karaoke\s*/gi, '').trim()
        title = title.replace(/\s*mp3\s*/gi, '').trim()
        
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
          // Ensure full URL
          if (!url.startsWith('http')) {
            url = url.startsWith('/') ? `https://songhub.lk${url}` : `https://songhub.lk/${url}`
          }
          
          // Ensure full image URL
          if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = imageUrl.startsWith('/') ? `https://songhub.lk${imageUrl}` : `https://songhub.lk/${imageUrl}`
          }
          
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
      
      if (songResults.length > 0) break // Stop if we found results with this pattern
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