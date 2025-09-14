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
    
    // Parse HTML using regex since we don't have a DOM parser in Deno
    const songResults: SongResult[] = []
    
    // Match div.item elements with their content
    const itemRegex = /<div class="item">\s*<a href="([^"]+)">\s*<img[^>]+alt="([^"]+)"[^>]*>\s*<span>([^<]+)<\/span>\s*<\/a>\s*<\/div>/g
    
    let match
    let index = 0
    const queryLower = query.toLowerCase()
    
    while ((match = itemRegex.exec(html)) !== null && songResults.length < 20) {
      const [, url, alt, title] = match
      
      // Filter results based on search query if we're using the fallback URL
      if (searchUrl.includes('?q=') || 
          title.toLowerCase().includes(queryLower) || 
          alt.toLowerCase().includes(queryLower)) {
        
        // Extract artist from title (usually after " - " or " Karaoke")
        let songTitle = title.replace(/\s*karaoke\s*/gi, '').trim()
        let artist = 'Unknown Artist'
        
        // Try to extract artist from title patterns like "Song - Artist" or "Song (Artist)"
        const artistMatch = songTitle.match(/^(.+?)\s*[-()]\s*(.+?)(?:\s*karaoke)?$/i)
        if (artistMatch) {
          songTitle = artistMatch[1].trim()
          artist = artistMatch[2].trim()
        }
        
        songResults.push({
          id: `songhub-${index}`,
          title: songTitle,
          artist: artist,
          url: url,
          imageUrl: match[0].match(/src="([^"]+)"/)?.[1] || undefined
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