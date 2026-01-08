import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Session-ID, X-Spec-ID",
};

const STYLES = {
  modern: {
    name: "Modern",
    description: "Clean lines, floating vanity, large format tiles, matte black fixtures",
    characteristics: [
      "Frameless glass shower",
      "Floating vanity",
      "Large tiles",
      "Matte black fixtures",
    ],
    colors: "White, gray, black",
  },
  classic: {
    name: "Classic",
    description: "Traditional elegance",
    characteristics: [
      "Subway tiles",
      "Chrome fixtures",
      "Traditional vanity",
    ],
    colors: "White, cream, chrome",
  },
  minimalist: {
    name: "Minimalist",
    description: "Ultimate simplicity",
    characteristics: [
      "Monochrome",
      "Hidden storage",
      "Seamless surfaces",
    ],
    colors: "White, concrete gray",
  },
  luxury: {
    name: "Luxury",
    description: "High-end finishes",
    characteristics: [
      "Marble",
      "Gold fixtures",
      "Chandelier",
    ],
    colors: "Marble, gold",
  },
};

function getRenderingPrompt(spec: any, style: string, hasEmptyRoom: boolean): string {
  const styleDef = STYLES[style];
  const room = spec.room;
  const fixtures = spec.fixtures || [];
  const fixtureList = fixtures.map((f: any) => `${f.type} at ${f.position}`).join(', ');
  
  if (hasEmptyRoom) {
    return `Transform this empty bathroom shell into a photorealistic ${styleDef.name} bathroom design.

APPLY TO THIS ROOM:
ROOM DIMENSIONS: ${room.length}m x ${room.width}m x ${room.height}m
FIXTURES TO ADD: ${fixtureList}

STYLE: ${styleDef.name} - ${styleDef.description}
COLORS: ${styleDef.colors}
CHARACTERISTICS: ${styleDef.characteristics.join(', ')}

Preserve the exact room structure, walls, windows, and doors from the base image.
Add all fixtures and style elements specified above.
Create a photorealistic, professionally designed bathroom.
Add small "finetuner.be" watermark in corner.`;
  }
  
  return `Generate a photorealistic bathroom render:

ROOM: ${room.length}m x ${room.width}m x ${room.height}m
FIXTURES: ${fixtureList}
STYLE: ${styleDef.name} - ${styleDef.description}
COLORS: ${styleDef.colors}

Characteristics: ${styleDef.characteristics.join(', ')}
Add small "finetuner.be" watermark.`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { spec, style } = await req.json();
    
    if (!spec || !style) {
      return new Response(
        JSON.stringify({ error: 'Missing spec or style' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!STYLES[style]) {
      return new Response(
        JSON.stringify({ error: 'Invalid style' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionId = req.headers.get('X-Session-ID') || crypto.randomUUID();
    const specId = req.headers.get('X-Spec-ID');
    const startTime = Date.now();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let emptyRoomImageUrl = null;
    if (specId) {
      const { data: specData } = await supabase
        .from('bathroom_specs')
        .select('empty_room_image_url')
        .eq('id', specId)
        .maybeSingle();
      
      emptyRoomImageUrl = specData?.empty_room_image_url;
    }

    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    let renderUrl;
    let prompt;

    console.log('Render conditions - geminiApiKey:', !!geminiApiKey, 'emptyRoomImageUrl:', !!emptyRoomImageUrl);

    if (geminiApiKey && emptyRoomImageUrl) {
      try {
        console.log('Attempting image-to-image render with empty room');
        prompt = getRenderingPrompt(spec, style, true);

        const base64Data = emptyRoomImageUrl.split(',')[1];
        const mimeType = emptyRoomImageUrl.match(/data:(.*?);/)?.[1] || 'image/png';

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${geminiApiKey}`;

        const geminiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 0.7,
              topP: 0.95,
              responseModalities: ['image'],
            }
          })
        });

        console.log('Gemini response status:', geminiResponse.status);

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          const imagePart = geminiData.candidates?.[0]?.content?.parts?.find(
            (part: any) => part.inline_data
          );

          if (imagePart) {
            const generatedImageBase64 = imagePart.inline_data.data;
            const generatedMimeType = imagePart.inline_data.mime_type;
            renderUrl = `data:${generatedMimeType};base64,${generatedImageBase64}`;
            console.log('Image generated successfully, size:', generatedImageBase64.length);
          } else {
            console.error('No image part in response:', JSON.stringify(geminiData).substring(0, 500));
          }
        } else {
          const errorText = await geminiResponse.text();
          console.error('Gemini API error:', errorText.substring(0, 500));
        }
      } catch (error) {
        console.error('Gemini render exception:', error.message);
      }
    } else if (geminiApiKey && !emptyRoomImageUrl) {
      try {
        console.log('Attempting text-to-image render (no empty room)');
        prompt = getRenderingPrompt(spec, style, false);

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${geminiApiKey}`;

        const geminiResponse = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }],
            generationConfig: {
              temperature: 0.7,
              topP: 0.95,
              responseModalities: ['image'],
            }
          })
        });

        console.log('Text-to-image response status:', geminiResponse.status);

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          const imagePart = geminiData.candidates?.[0]?.content?.parts?.find(
            (part: any) => part.inline_data
          );

          if (imagePart) {
            const generatedImageBase64 = imagePart.inline_data.data;
            const generatedMimeType = imagePart.inline_data.mime_type;
            renderUrl = `data:${generatedMimeType};base64,${generatedImageBase64}`;
            console.log('Text-to-image generated successfully');
          } else {
            console.error('No image in text-to-image response:', JSON.stringify(geminiData).substring(0, 500));
          }
        } else {
          const errorText = await geminiResponse.text();
          console.error('Text-to-image API error:', errorText.substring(0, 500));
        }
      } catch (error) {
        console.error('Text-to-image exception:', error.message);
      }
    } else {
      console.log('Skipping Gemini - no API key configured');
    }

    if (!renderUrl) {
      console.log('Using placeholder fallback');
      prompt = getRenderingPrompt(spec, style, false);
      renderUrl = `https://placehold.co/1024x1024/e2e8f0/1e293b?text=${encodeURIComponent(style + ' Bathroom')}`;
    }

    const generationTimeMs = Date.now() - startTime;

    const { data: storedRender, error: dbError } = await supabase
      .from('renders')
      .insert({
        session_id: sessionId,
        spec_id: specId,
        selected_style: style,
        render_url: renderUrl,
        prompt_used: prompt,
        generation_time_ms: generationTimeMs,
      })
      .select()
      .maybeSingle();

    if (dbError) {
      console.error('Database error:', dbError);
    }

    await supabase.from('analytics_events').insert({
      session_id: sessionId,
      event_type: 'render',
      event_data: { style, generation_time_ms: generationTimeMs },
      user_agent: req.headers.get('User-Agent'),
    });

    return new Response(
      JSON.stringify({
        success: true,
        render_url: renderUrl,
        render_id: storedRender?.id,
        style,
        session_id: sessionId,
        message: 'Render generated successfully',
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
      JSON.stringify({ error: error.message || 'Render failed' }),
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
