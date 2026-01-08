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
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
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
      console.error('Gemini error:', errorText);
      
      return new Response(
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!responseText) {
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
      return new Response(
        JSON.stringify({ error: 'Invalid AI response format' }),
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

    return new Response(
      JSON.stringify({
        success: true,
        spec,
        spec_id: storedSpec?.id,
        session_id: sessionId,
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
      JSON.stringify({ error: error.message || 'Analysis failed' }),
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
