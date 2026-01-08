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

function getRenderingPrompt(spec: any, style: string): string {
  const styleDef = STYLES[style];
  const room = spec.room;
  const fixtures = spec.fixtures || [];
  const fixtureList = fixtures.map((f: any) => `${f.type} at ${f.position}`).join(', ');
  
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

    // Generate rendering prompt
    const prompt = getRenderingPrompt(spec, style);

    // NOTE: Actual image generation would require:
    // 1. Gemini Imagen API access (not available in basic API)
    // 2. Or integration with DALL-E, Midjourney, Stable Diffusion, etc.
    // For now, we'll create a placeholder URL
    
    const renderId = crypto.randomUUID();
    const renderUrl = `https://placehold.co/1024x1024/e2e8f0/1e293b?text=${encodeURIComponent(style + ' Bathroom')}`;

    const generationTimeMs = Date.now() - startTime;

    // Store in Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
    }

    // Track analytics
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
        note: 'Using placeholder image - connect AI image generator for actual renders',
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