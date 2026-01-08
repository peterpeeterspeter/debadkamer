import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Session-ID",
};

const EXTRACTION_PROMPT = `You are an expert bathroom designer and architect. Analyze this bathroom image and extract specifications.

Return ONLY valid JSON in this format:
{
  "room": {
    "length": <float in meters>,
    "width": <float in meters>,
    "height": <float in meters>,
    "notes": "<observations>"
  },
  "fixtures": [
    {
      "type": "<toilet|sink|shower|bath|bidet|urinal>",
      "position": "<NW|NE|SW|SE|N|S|E|W|CENTER>",
      "dimensions": "<size>",
      "notes": "<details>"
    }
  ],
  "constraints": [
    {
      "type": "<window|door|plumbing|electrical|structural>",
      "location": "<description>",
      "impact": "<constraint description>"
    }
  ],
  "current_style": "<style>",
  "condition": "<new|good|needs_renovation|poor>",
  "confidence": <0.0-1.0>,
  "reasoning": "<explanation>"
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          error: 'API key not configured. Please add GEMINI_API_KEY in Supabase dashboard.',
          setup_url: 'https://supabase.com/dashboard/project/_/settings/secrets'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionId = req.headers.get('X-Session-ID') || crypto.randomUUID();

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file uploaded' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    const mimeType = file.type || 'image/jpeg';

    console.log('Calling Gemini API for analysis...');
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${geminiApiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: EXTRACTION_PROMPT },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.4,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      })
    });
    
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      
      return new Response(
        JSON.stringify({ 
          error: 'AI analysis failed. Please check your API key configuration.',
          details: errorText.substring(0, 200)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();
    console.log('Gemini response received');
    
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
      console.error('No text in Gemini response:', JSON.stringify(geminiData).substring(0, 200));
      return new Response(
        JSON.stringify({ error: 'No response from AI' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let spec;
    try {
      let jsonStr = responseText;
      if (responseText.includes('```json')) {
        const start = responseText.indexOf('```json') + 7;
        const end = responseText.indexOf('```', start);
        jsonStr = responseText.substring(start, end).trim();
      } else if (responseText.includes('{')) {
        const start = responseText.indexOf('{');
        const end = responseText.lastIndexOf('}') + 1;
        jsonStr = responseText.substring(start, end);
      }
      spec = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse AI response:', responseText.substring(0, 200));
      return new Response(
        JSON.stringify({ 
          error: 'Invalid AI response format',
          details: responseText.substring(0, 200)
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (spec.confidence < 0.5) {
      return new Response(
        JSON.stringify({ 
          error: 'Image quality too low - try a clearer photo'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: storedSpec } = await supabase
      .from('bathroom_specs')
      .insert({
        session_id: sessionId,
        spec_json: spec,
        confidence_score: spec.confidence,
        dimensions: spec.room || {},
        fixtures: spec.fixtures || [],
        style_preferences: {},
      })
      .select()
      .maybeSingle();

    await supabase.from('analytics_events').insert({
      session_id: sessionId,
      event_type: 'analyze',
      event_data: { confidence: spec.confidence },
      user_agent: req.headers.get('User-Agent'),
    });

    let emptyRoomImageUrl = null;

    if (storedSpec?.id && geminiApiKey) {
      try {
        console.log('Triggering empty room processing...');
        const emptyRoomUrl = `${supabaseUrl}/functions/v1/bathroom-process-empty-room`;
        const emptyRoomResponse = await fetch(emptyRoomUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            image_base64: base64,
            mime_type: mimeType,
            spec_id: storedSpec.id,
          }),
        });

        if (emptyRoomResponse.ok) {
          const emptyRoomData = await emptyRoomResponse.json();
          emptyRoomImageUrl = emptyRoomData.empty_room_image_url;
          console.log('Empty room generated successfully');
        } else {
          const errorText = await emptyRoomResponse.text();
          console.error('Empty room processing failed:', errorText);
        }
      } catch (emptyRoomError) {
        console.error('Empty room processing error:', emptyRoomError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        spec,
        spec_id: storedSpec?.id,
        session_id: sessionId,
        empty_room_image_url: emptyRoomImageUrl,
        message: 'Analysis complete',
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
      JSON.stringify({ 
        error: error.message || 'Analysis failed',
        type: error.name
      }),
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
