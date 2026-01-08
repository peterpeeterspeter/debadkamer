import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const EMPTY_ROOM_PROMPT = `Transform this bathroom image into an empty room shell by removing ALL bathroom fixtures and products while preserving the exact architectural structure.

REMOVE COMPLETELY:
- All fixtures (toilet, sink, vanity, bathtub, shower, bidet, urinal)
- All tiles and wall coverings
- All mirrors and cabinets
- All accessories and decorations
- All lighting fixtures
- All plumbing visible elements

PRESERVE EXACTLY:
- Wall positions and dimensions
- Window locations and sizes
- Door locations and sizes
- Floor area and outline
- Ceiling height and structure
- Architectural features (corners, alcoves, niches)
- Room proportions and shape

The result should be a clean, empty room with plain white walls, basic floor, and all architectural features intact. This will be used as a base for applying new bathroom designs.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { image_base64, mime_type, spec_id } = await req.json();
    
    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: 'No image provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const startTime = Date.now();
    console.log('Starting empty room generation...');

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${geminiApiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: EMPTY_ROOM_PROMPT },
            {
              inline_data: {
                mime_type: mime_type || 'image/jpeg',
                data: image_base64
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          responseModalities: ['image'],
        }
      })
    });
    
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini error:', errorText);
      
      return new Response(
        JSON.stringify({ error: 'Empty room generation failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response received');
    
    const imagePart = geminiData.candidates?.[0]?.content?.parts?.find(
      (part: any) => part.inline_data
    );
    
    if (!imagePart) {
      console.error('No image in Gemini response');
      return new Response(
        JSON.stringify({ error: 'No image generated' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const generatedImageBase64 = imagePart.inline_data.data;
    const generatedMimeType = imagePart.inline_data.mime_type;
    const dataUrl = `data:${generatedMimeType};base64,${generatedImageBase64}`;

    const processingTime = Date.now() - startTime;
    console.log(`Empty room generated in ${processingTime}ms`);

    if (spec_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from('bathroom_specs')
        .update({ empty_room_image_url: dataUrl })
        .eq('id', spec_id);
      
      console.log('Database updated with empty room URL');
    }

    return new Response(
      JSON.stringify({
        success: true,
        empty_room_image_url: dataUrl,
        processing_time_ms: processingTime,
        message: 'Empty room generated successfully',
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Empty room processing failed' }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
