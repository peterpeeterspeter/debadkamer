import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace('/bathroom-admin', '');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // GET /leads - Get all leads
    if (req.method === 'GET' && path === '/leads') {
      const status = url.searchParams.get('status');
      const limit = parseInt(url.searchParams.get('limit') || '100');
      const offset = parseInt(url.searchParams.get('offset') || '0');

      let query = supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)
        .offset(offset);

      if (status) {
        query = query.eq('status', status);
      }

      const { data: leads, error } = await query;

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({
          success: true,
          leads: leads || [],
          count: leads?.length || 0,
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // PUT /leads/:id/status - Update lead status
    if (req.method === 'PUT' && path.match(/^\/leads\/[^/]+\/status$/)) {
      const leadId = path.split('/')[2];
      const { status } = await req.json();

      const validStatuses = ['new', 'contacted', 'qualified', 'closed'];
      if (!validStatuses.includes(status)) {
        return new Response(
          JSON.stringify({ error: `Status must be one of: ${validStatuses.join(', ')}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error } = await supabase
        .from('leads')
        .update({ status })
        .eq('id', leadId);

      if (error) {
        throw error;
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Lead status updated',
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // GET /analytics - Get analytics summary
    if (req.method === 'GET' && path === '/analytics') {
      // Get total leads
      const { count: totalLeads } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true });

      // Get total specs
      const { count: totalSpecs } = await supabase
        .from('bathroom_specs')
        .select('*', { count: 'exact', head: true });

      // Get total renders
      const { count: totalRenders } = await supabase
        .from('renders')
        .select('*', { count: 'exact', head: true });

      // Calculate conversion rate
      const conversionRate = totalSpecs > 0 ? ((totalLeads || 0) / totalSpecs) * 100 : 0;

      // Get popular styles
      const { data: renders } = await supabase
        .from('renders')
        .select('selected_style');

      const styleCounts: Record<string, number> = {};
      (renders || []).forEach((render: any) => {
        const style = render.selected_style || 'Unknown';
        styleCounts[style] = (styleCounts[style] || 0) + 1;
      });

      const popularStyles = Object.entries(styleCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([style, count]) => ({ style, count }));

      return new Response(
        JSON.stringify({
          success: true,
          analytics: {
            total_leads: totalLeads || 0,
            total_specs: totalSpecs || 0,
            total_renders: totalRenders || 0,
            conversion_rate: Math.round(conversionRate * 100) / 100,
            popular_styles: popularStyles,
          },
        }),
        {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // 404 - Not found
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Request failed' }),
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