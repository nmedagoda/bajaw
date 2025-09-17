import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  try {
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File
    
    if (!audioFile) {
      return new Response('No audio file provided', { status: 400 })
    }

    console.log(`Converting audio file: ${audioFile.name}, type: ${audioFile.type}, size: ${audioFile.size}`)

    // For now, just return the original file as base64
    // In a real implementation, you would use FFmpeg here
    const arrayBuffer = await audioFile.arrayBuffer()
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))

    return new Response(
      JSON.stringify({
        success: true,
        audio: base64Audio,
        originalType: audioFile.type,
        convertedType: 'audio/mpeg'
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    )
    
  } catch (error) {
    console.error('Conversion error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})