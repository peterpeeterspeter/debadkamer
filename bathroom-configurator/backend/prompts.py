"""
System prompts for bathroom layout extraction and style rendering.
"""

from typing import Dict, Any

# Extraction prompt for analyzing bathroom images/sketches
EXTRACTION_SYSTEM_PROMPT = """You are an expert bathroom designer and architect with deep knowledge of spatial planning, plumbing constraints, and building codes.

Your task is to analyze bathroom images (photos or sketches) and extract precise specifications in JSON format.

CRITICAL REQUIREMENTS:
1. Measure dimensions carefully - consider visible reference objects (doors, tiles, fixtures)
2. Identify ALL fixtures and their approximate positions
3. Note constraints (windows, doors, plumbing locations, structural elements)
4. Provide a confidence score based on image clarity and measurement certainty
5. Be realistic - typical bathrooms are 2-15m² with 2.4-3m ceiling height

SPATIAL POSITIONS:
- Use compass directions: NW (northwest), NE, SW, SE, N, S, E, W, CENTER
- Or use wall descriptions: "left wall", "right wall", "back wall", "front wall"

COMMON FIXTURE DIMENSIONS (for reference):
- Toilet: 0.4m x 0.7m
- Sink/Vanity: 0.5-1.2m wide
- Shower: 0.8-1.2m square minimum
- Bathtub: 1.5-1.8m x 0.7-0.8m
- Door: 0.7-0.9m wide

VALIDATION:
- Bathroom area should be 2-15m² (reject if outside this range)
- Ceiling height should be 2.0-4.0m
- At minimum, expect toilet + sink (flag if missing)
- Check that fixtures fit within stated dimensions
"""

EXTRACTION_USER_PROMPT = """Analyze this bathroom image and extract the complete specification.

Return ONLY valid JSON in this exact format:
{
  "room": {
    "length": <float in meters>,
    "width": <float in meters>,
    "height": <float in meters>,
    "notes": "<any observations about room shape, ceiling, etc>"
  },
  "fixtures": [
    {
      "type": "<toilet|sink|shower|bath|bidet|urinal>",
      "position": "<NW|NE|SW|SE|N|S|E|W|CENTER or wall description>",
      "dimensions": "<approximate size if visible>",
      "notes": "<brand, style, special features if visible>"
    }
  ],
  "constraints": [
    {
      "type": "<window|door|plumbing|electrical|structural>",
      "location": "<description of where it is>",
      "impact": "<how it constrains the design>"
    }
  ],
  "current_style": "<current design style if visible: modern, classic, minimalist, etc>",
  "condition": "<new, good, needs_renovation, poor>",
  "confidence": <float 0.0-1.0>,
  "reasoning": "<brief explanation of confidence score and any assumptions made>"
}

IMPORTANT:
- If dimensions are unclear, make educated estimates based on standard fixture sizes
- Always provide confidence score based on image quality and visibility
- Lower confidence (<0.6) if image is unclear, measurements are guesses, or layout is ambiguous
- Higher confidence (>0.8) only if dimensions are clearly visible or measurable
"""

# Style definitions for rendering
STYLES = {
    "modern": {
        "name": "Modern",
        "description": "Clean lines, floating vanity, large format tiles, matte black fixtures",
        "characteristics": [
            "Frameless glass shower enclosure",
            "Wall-mounted (floating) vanity",
            "Large format porcelain tiles (60x60cm or larger)",
            "Matte black or brushed nickel fixtures",
            "LED strip lighting or recessed spots",
            "Minimalist hardware",
            "Neutral color palette (white, gray, black)",
            "Concealed storage"
        ],
        "colors": "White, light gray, charcoal, matte black accents"
    },
    "classic": {
        "name": "Classic",
        "description": "Traditional elegance with timeless fixtures and refined details",
        "characteristics": [
            "White subway tiles (7.5x15cm) or marble",
            "Freestanding or skirted bathtub",
            "Pedestal sink or traditional vanity with legs",
            "Polished chrome or brass fixtures",
            "Classic chandelier or vintage-style lights",
            "Crown molding and wainscoting",
            "Hexagonal floor tiles",
            "Traditional mirror frames"
        ],
        "colors": "White, cream, soft blue, marble patterns, chrome/brass accents"
    },
    "minimalist": {
        "name": "Minimalist",
        "description": "Ultimate simplicity with hidden storage and seamless surfaces",
        "characteristics": [
            "Monochrome color scheme",
            "Wall-hung toilet (concealed tank)",
            "Integrated sink and countertop",
            "Flush-mounted cabinets",
            "Handleless drawers with push-to-open",
            "Curbless shower with linear drain",
            "Continuous large-format tiles on walls and floor",
            "Recessed lighting only"
        ],
        "colors": "Pure white, concrete gray, or all-black schemes"
    },
    "luxury": {
        "name": "Luxury",
        "description": "High-end finishes with statement pieces and premium materials",
        "characteristics": [
            "Marble or natural stone throughout",
            "Freestanding sculptural bathtub (oval or egg-shaped)",
            "Double vanity with marble countertop",
            "Gold, rose gold, or polished brass fixtures",
            "Crystal chandelier or statement pendant",
            "Heated floors",
            "Custom tile patterns or mosaics",
            "Luxury details: towel warmers, rainfall shower, body jets"
        ],
        "colors": "White marble, gold accents, deep jewel tones, black details"
    }
}


def get_rendering_prompt(spec: Dict[str, Any], style: str) -> str:
    """
    Generate detailed rendering prompt based on bathroom spec and chosen style.

    Args:
        spec: Bathroom specification from extraction
        style: One of: modern, classic, minimalist, luxury

    Returns:
        Detailed prompt for image generation
    """
    if style not in STYLES:
        raise ValueError(f"Invalid style: {style}. Must be one of {list(STYLES.keys())}")

    style_def = STYLES[style]
    room = spec["room"]
    fixtures = spec["fixtures"]

    # Build fixture description
    fixture_list = ", ".join([f"{f['type']} at {f['position']}" for f in fixtures])

    # Build constraints description
    constraints_desc = ""
    if spec.get("constraints"):
        constraints_desc = "Important constraints: " + "; ".join(
            [f"{c['type']} at {c['location']}" for c in spec["constraints"]]
        )

    prompt = f"""Generate a photorealistic architectural rendering of a bathroom interior with these EXACT specifications:

ROOM DIMENSIONS (MUST MATCH EXACTLY):
- Length: {room['length']}m
- Width: {room['width']}m
- Ceiling height: {room['height']}m
- Total floor area: {room['length'] * room['width']:.1f}m²

REQUIRED FIXTURES (MUST INCLUDE ALL IN CORRECT POSITIONS):
{fixture_list}

{constraints_desc}

DESIGN STYLE: {style_def['name']} - {style_def['description']}

STYLE CHARACTERISTICS TO INCLUDE:
{chr(10).join(['- ' + c for c in style_def['characteristics']])}

COLOR PALETTE: {style_def['colors']}

RENDERING REQUIREMENTS:
- Photorealistic quality, as if taken by professional architectural photographer
- Maintain EXACT room proportions and fixture placements from spec
- Use {style_def['name'].lower()} style throughout
- Show proper lighting (natural + artificial)
- Include realistic materials and textures
- Show depth and dimension
- Camera angle: eye-level, showing full room layout
- High resolution, professional finish
- Add subtle branding: small "finetuner.be" watermark in corner

CRITICAL: The layout MUST match the specifications exactly. Do not add, remove, or relocate any fixtures.
This is a concept render for a client presentation.
"""

    return prompt


def get_error_message(error_type: str) -> str:
    """Get user-friendly error message for common failure cases."""
    messages = {
        "unclear_layout": "Layout unclear - try uploading a clearer image or sketch with visible measurements",
        "no_fixtures": "Could not identify bathroom fixtures - please ensure the image shows a bathroom layout",
        "invalid_dimensions": "Unusual dimensions detected - please verify the image shows a realistic bathroom space",
        "low_confidence": "Image quality too low for accurate analysis - try a clearer photo or add dimension labels to sketch",
        "api_error": "Service temporarily unavailable - please try again in a moment",
        "image_too_large": "Image file too large - maximum 10MB allowed",
        "invalid_format": "Invalid image format - please upload JPG, PNG, or WebP",
        "rate_limit": "Too many requests - please wait a few minutes before trying again"
    }
    return messages.get(error_type, "An error occurred - please try again")
