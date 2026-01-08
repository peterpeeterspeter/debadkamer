const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const STYLES = {
  modern: {
    name: "Modern",
    description: "Clean lines, floating vanity, large format tiles, matte black fixtures",
  },
  classic: {
    name: "Classic",
    description: "Traditional elegance with timeless fixtures and refined details",
  },
  minimalist: {
    name: "Minimalist",
    description: "Ultimate simplicity with hidden storage and seamless surfaces",
  },
  luxury: {
    name: "Luxury",
    description: "High-end finishes with statement pieces and premium materials",
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const styles = Object.entries(STYLES).map(([id, style]) => ({
      id,
      name: style.name,
      description: style.description,
    }));

    return new Response(
      JSON.stringify({ styles }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});