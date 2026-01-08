import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Session-ID",
};

function calculateLeadScore(spec: any, timeline: string): string {
  let score = 0;

  const timelineScores: Record<string, number> = {
    "1-3 months": 3,
    "3-6 months": 2,
    "6-12 months": 1,
    "12+ months": 0,
  };
  score += timelineScores[timeline] || 0;

  const room = spec.room || {};
  const area = (room.length || 0) * (room.width || 0);
  if (area > 8) {
    score += 2;
  } else if (area > 5) {
    score += 1;
  }

  const fixtureCount = (spec.fixtures || []).length;
  if (fixtureCount >= 4) {
    score += 2;
  } else if (fixtureCount >= 3) {
    score += 1;
  }

  if ((spec.confidence || 0) > 0.8) {
    score += 1;
  }

  if (score >= 6) return "high";
  if (score >= 3) return "medium";
  return "low";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { name, email, phone, project_timeline, spec_json, render_url } = await req.json();

    if (!name || !email || !project_timeline || !spec_json) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionId = req.headers.get('X-Session-ID') || crypto.randomUUID();
    const leadScore = calculateLeadScore(spec_json, project_timeline);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: storedLead, error: dbError } = await supabase
      .from('leads')
      .insert({
        name,
        email,
        phone,
        session_id: sessionId,
        spec_json,
        render_url,
        lead_score: leadScore,
        status: 'new',
        metadata: {
          project_timeline,
          source: 'bathroom_configurator',
        },
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      throw new Error('Failed to store lead');
    }

    await supabase.from('analytics_events').insert({
      session_id: sessionId,
      event_type: 'submit_lead',
      event_data: { lead_score: leadScore, project_timeline },
      user_agent: req.headers.get('User-Agent'),
    });

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: storedLead?.id,
        lead_score: leadScore,
        message: "Thank you! We'll contact you soon to discuss your project.",
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
      JSON.stringify({ error: error.message || 'Failed to submit lead' }),
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