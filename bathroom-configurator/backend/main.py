"""
FastAPI server for bathroom configurator lead generator.
Provides endpoints for image analysis and style rendering.
"""

import os
import uuid
import httpx
from datetime import datetime
from typing import Optional, Dict, Any
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

from gemini_client import GeminiClient
from prompts import get_error_message, STYLES

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="Bathroom Configurator API",
    description="AI-powered bathroom analysis and rendering for lead generation",
    version="1.0.0"
)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for storing generated renders
STATIC_DIR = Path(__file__).parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Initialize Gemini client
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set")

gemini_client = GeminiClient(GEMINI_API_KEY)

# Configuration
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
WEBHOOK_URL = os.getenv("LEAD_WEBHOOK_URL")  # Optional CRM webhook


# Pydantic models
class BathroomSpec(BaseModel):
    """Bathroom specification model."""
    room: Dict[str, Any]
    fixtures: list[Dict[str, Any]]
    constraints: list[Dict[str, Any]]
    current_style: Optional[str] = None
    condition: Optional[str] = None
    confidence: float
    reasoning: Optional[str] = None


class RenderRequest(BaseModel):
    """Request model for rendering endpoint."""
    spec: Dict[str, Any]
    style: str

    @field_validator('style')
    @classmethod
    def validate_style(cls, v):
        if v not in STYLES:
            raise ValueError(f"Style must be one of: {', '.join(STYLES.keys())}")
        return v


class LeadSubmission(BaseModel):
    """Lead capture form model."""
    name: str
    email: EmailStr
    phone: str
    project_timeline: str
    spec_json: Dict[str, Any]
    render_url: str

    @field_validator('project_timeline')
    @classmethod
    def validate_timeline(cls, v):
        valid = ["1-3 months", "3-6 months", "6-12 months", "12+ months"]
        if v not in valid:
            raise ValueError(f"Timeline must be one of: {', '.join(valid)}")
        return v


# Helper functions
def validate_image_file(file: UploadFile) -> None:
    """Validate uploaded image file."""
    # Check file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=get_error_message("invalid_format")
        )


async def send_lead_to_webhook(lead_data: Dict[str, Any]) -> None:
    """Send lead data to CRM webhook."""
    if not WEBHOOK_URL:
        return

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                WEBHOOK_URL,
                json=lead_data,
                timeout=10.0
            )
            response.raise_for_status()
    except Exception as e:
        # Log error but don't fail the request
        print(f"Webhook error: {str(e)}")


# API Endpoints
@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Bathroom Configurator API",
        "version": "1.0.0"
    }


@app.get("/api/styles")
async def get_styles():
    """Get available rendering styles."""
    return {
        "styles": [
            {
                "id": key,
                "name": style["name"],
                "description": style["description"]
            }
            for key, style in STYLES.items()
        ]
    }


@app.post("/api/analyze")
@limiter.limit("5/hour")
async def analyze_bathroom(
    request: Request,
    file: UploadFile = File(...)
):
    """
    Analyze uploaded bathroom image to extract dimensions, fixtures, and constraints.

    Uses Gemini thinking mode for deep analysis.

    Returns JSON specification with confidence score.
    """
    try:
        # Validate file
        validate_image_file(file)

        # Read file bytes
        image_bytes = await file.read()

        # Check file size
        if len(image_bytes) > MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=get_error_message("image_too_large")
            )

        # Analyze with Gemini
        try:
            spec = gemini_client.analyze_bathroom_layout(image_bytes)
        except ValueError as e:
            # Validation error
            raise HTTPException(
                status_code=400,
                detail=get_error_message("invalid_dimensions")
            )
        except Exception as e:
            # API error
            print(f"Gemini API error: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=get_error_message("api_error")
            )

        # Check confidence threshold
        if spec["confidence"] < 0.5:
            raise HTTPException(
                status_code=400,
                detail=get_error_message("low_confidence")
            )

        return {
            "success": True,
            "spec": spec,
            "message": "Analysis complete"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in analyze: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=get_error_message("api_error")
        )


@app.post("/api/render")
@limiter.limit("3/hour")
async def render_bathroom(
    request: Request,
    render_request: RenderRequest
):
    """
    Generate photorealistic bathroom render from specification and style.

    Uses Gemini Flash with Imagen for high-quality rendering.

    Returns URL to generated image.
    """
    try:
        spec = render_request.spec
        style = render_request.style

        # Generate unique filename
        render_id = str(uuid.uuid4())
        filename = f"render_{render_id}.png"
        filepath = STATIC_DIR / filename

        # Generate render with Gemini
        try:
            image_bytes = gemini_client.generate_bathroom_render(
                spec=spec,
                style=style,
                save_path=str(filepath)
            )

            # Save image
            with open(filepath, "wb") as f:
                f.write(image_bytes)

        except Exception as e:
            print(f"Rendering error: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=get_error_message("api_error")
            )

        # Generate public URL
        base_url = os.getenv("BASE_URL", "http://localhost:8000")
        render_url = f"{base_url}/static/{filename}"

        return {
            "success": True,
            "render_url": render_url,
            "style": style,
            "message": "Render generated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in render: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=get_error_message("api_error")
        )


@app.post("/api/submit-lead")
async def submit_lead(lead: LeadSubmission):
    """
    Submit lead information after viewing render.

    Calculates lead score and sends to CRM webhook if configured.
    """
    try:
        # Calculate lead score
        lead_score = gemini_client.calculate_lead_score(
            spec=lead.spec_json,
            timeline=lead.project_timeline
        )

        # Prepare lead data
        lead_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "name": lead.name,
            "email": lead.email,
            "phone": lead.phone,
            "project_timeline": lead.project_timeline,
            "spec_json": lead.spec_json,
            "render_url": lead.render_url,
            "lead_score": lead_score,
            "source": "bathroom_configurator"
        }

        # Send to webhook (async, don't wait)
        await send_lead_to_webhook(lead_data)

        return {
            "success": True,
            "lead_score": lead_score,
            "message": "Thank you! We'll contact you soon to discuss your project."
        }

    except Exception as e:
        print(f"Lead submission error: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error submitting lead - please try again"
        )


# Error handlers
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Custom rate limit error handler."""
    return JSONResponse(
        status_code=429,
        content={
            "success": False,
            "detail": get_error_message("rate_limit")
        }
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
