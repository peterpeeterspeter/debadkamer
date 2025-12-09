# Bathroom Configurator - AI-Powered Lead Generator

Transform bathroom photos or sketches into stunning photorealistic renders with AI. This lead generation tool uses Google's Gemini AI to analyze bathroom layouts and generate styled renders, capturing valuable customer information in the process.

## Features

🎨 **AI Layout Analysis**: Upload a photo or sketch → AI extracts dimensions, fixtures, and constraints
🖼️ **Style Rendering**: Generate photorealistic renders in 4 styles (Modern, Classic, Minimalist, Luxury)
📊 **Lead Scoring**: Automatic lead qualification based on project scope and timeline
⚡ **Fast Processing**: ~30s analysis + ~60s rendering
🔒 **Rate Limited**: Built-in protection (5 analyses/hour, 3 renders/hour per IP)
🎯 **CRM Integration**: Optional webhook for automatic lead forwarding

## Architecture

```
bathroom-configurator/
├── backend/               # FastAPI server
│   ├── main.py           # API endpoints
│   ├── gemini_client.py  # Gemini AI wrapper
│   ├── prompts.py        # AI prompts & styles
│   └── requirements.txt  # Python dependencies
├── frontend/             # Single-page web app
│   ├── index.html        # UI layout
│   └── app.js            # Client logic
├── docker-compose.yml    # Docker orchestration
└── .env.example          # Environment template
```

## Tech Stack

**Backend**: FastAPI, Google Gemini AI (2.0 Flash + Thinking Mode), Python 3.11+
**Frontend**: Vanilla JavaScript, Tailwind CSS
**Deployment**: Docker, Nginx

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Google Gemini API key ([Get one here](https://ai.google.dev/))

### Installation

1. **Clone and setup**
```bash
cd bathroom-configurator
cp .env.example .env
```

2. **Configure environment**
Edit `.env` and add your Gemini API key:
```env
GEMINI_API_KEY=your_actual_api_key_here
BASE_URL=http://localhost:3000
LEAD_WEBHOOK_URL=https://your-crm.com/api/leads  # Optional
```

3. **Launch with Docker**
```bash
docker-compose up -d
```

4. **Access the app**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Local Development (Without Docker)

**Backend**:
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

**Frontend**:
```bash
cd frontend
# Serve with any static server, e.g.:
python -m http.server 3000
# or
npx serve -p 3000
```

## Usage Flow

### 1. Upload Bathroom Image
- Drag & drop or select a photo/sketch
- Supports JPG, PNG, WebP (max 10MB)
- Best results: Include measurements or reference objects

### 2. AI Analysis
- Gemini thinking mode extracts:
  - Room dimensions (length, width, height)
  - Fixtures (toilet, sink, shower, bath)
  - Constraints (windows, doors, plumbing)
  - Confidence score

### 3. Select Style
Choose from 4 predefined styles:
- **Modern**: Clean lines, floating vanity, large tiles, matte black
- **Classic**: Traditional, subway tiles, chrome fixtures, elegant
- **Minimalist**: Monochrome, hidden storage, seamless surfaces
- **Luxury**: Marble, gold fixtures, chandelier, high-end finishes

### 4. Generate Render
- AI maintains exact layout from analysis
- Applies selected style characteristics
- Adds finetuner.be watermark

### 5. Capture Lead
- User downloads render after providing:
  - Name, email, phone
  - Project timeline (1-3mo, 3-6mo, 6-12mo, 12+mo)
- Lead score calculated automatically (high/medium/low)
- Data sent to CRM webhook if configured

## API Endpoints

### `GET /api/styles`
Returns available rendering styles.

**Response**:
```json
{
  "styles": [
    {
      "id": "modern",
      "name": "Modern",
      "description": "Clean lines, floating vanity, large format tiles"
    }
  ]
}
```

### `POST /api/analyze`
Analyze bathroom image to extract specifications.

**Request**: Multipart form with `file` (image)
**Rate Limit**: 5/hour per IP
**Response**:
```json
{
  "success": true,
  "spec": {
    "room": {
      "length": 3.2,
      "width": 2.8,
      "height": 2.5
    },
    "fixtures": [
      {"type": "toilet", "position": "NW"},
      {"type": "sink", "position": "NE"}
    ],
    "constraints": [],
    "confidence": 0.85
  }
}
```

### `POST /api/render`
Generate photorealistic render from spec and style.

**Request**:
```json
{
  "spec": { /* spec from /analyze */ },
  "style": "modern"
}
```

**Rate Limit**: 3/hour per IP
**Response**:
```json
{
  "success": true,
  "render_url": "http://localhost:8000/static/render_uuid.png",
  "style": "modern"
}
```

### `POST /api/submit-lead`
Submit lead information after viewing render.

**Request**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "project_timeline": "1-3 months",
  "spec_json": { /* original spec */ },
  "render_url": "http://..."
}
```

**Response**:
```json
{
  "success": true,
  "lead_score": "high",
  "message": "Thank you! We'll contact you soon."
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Google Gemini API key (required) | - |
| `BASE_URL` | Public URL for static files | `http://localhost:8000` |
| `LEAD_WEBHOOK_URL` | CRM webhook for lead data | - |
| `ANALYZE_RATE_LIMIT` | Max analyses per IP/hour | 5 |
| `RENDER_RATE_LIMIT` | Max renders per IP/hour | 3 |

### CRM Webhook Payload

If `LEAD_WEBHOOK_URL` is configured, leads are sent as:

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890",
  "project_timeline": "1-3 months",
  "spec_json": { /* bathroom spec */ },
  "render_url": "http://...",
  "lead_score": "high",
  "source": "bathroom_configurator"
}
```

### Lead Scoring Logic

Scores based on:
- **Timeline**: 1-3mo (3pts), 3-6mo (2pts), 6-12mo (1pt)
- **Bathroom size**: >8m² (2pts), >5m² (1pt)
- **Fixtures**: 4+ (2pts), 3 (1pt)
- **Confidence**: >0.8 (1pt)

**Thresholds**: High (6+), Medium (3-5), Low (<3)

## Customization

### Adding New Styles

Edit `backend/prompts.py`:

```python
STYLES = {
    "your_style": {
        "name": "Your Style",
        "description": "Brief description",
        "characteristics": [
            "Characteristic 1",
            "Characteristic 2",
        ],
        "colors": "Color palette"
    }
}
```

Update frontend icon in `frontend/app.js`:
```javascript
const styleIcons = {
    your_style: 'fa-icon-name'
};
```

### Adjusting AI Prompts

**Analysis prompt**: `backend/prompts.py` → `EXTRACTION_SYSTEM_PROMPT`
**Rendering prompt**: `backend/prompts.py` → `get_rendering_prompt()`

### Rate Limiting

Modify in `backend/main.py`:
```python
@limiter.limit("10/hour")  # Change to your needs
async def analyze_bathroom(...):
```

## Production Deployment

### Security Checklist

- [ ] Set strong `GEMINI_API_KEY`
- [ ] Configure `ALLOWED_ORIGINS` in CORS (main.py)
- [ ] Use HTTPS (add SSL certificates to nginx)
- [ ] Set `BASE_URL` to public domain
- [ ] Enable firewall rules
- [ ] Set up monitoring/logging
- [ ] Regular security updates

### Performance Optimization

1. **Caching**: Add Redis for render caching
2. **CDN**: Serve static files via CDN
3. **Load Balancing**: Multiple backend instances
4. **Database**: Store leads in PostgreSQL instead of webhook-only

### Monitoring

**Health checks**:
- Backend: http://localhost:8000/
- Docker: Built-in healthcheck (30s interval)

**Key metrics to track**:
- Analysis success rate (target: >80%)
- Average confidence score
- Render generation time
- Lead conversion rate (render view → form submit)
- API error rates

## Troubleshooting

### "GEMINI_API_KEY environment variable not set"
→ Check `.env` file exists and contains valid API key

### "Layout unclear - try sketch with measurements"
→ AI confidence <0.5, upload clearer image or add dimension labels

### "Rate limit exceeded"
→ Wait or adjust limits in `main.py`

### Images not loading
→ Check `BASE_URL` matches your domain, verify static files mounted

### CRM webhook failing
→ Check `LEAD_WEBHOOK_URL` is accessible, review webhook logs

## License

MIT License - See LICENSE file

## Support

For issues or questions:
- GitHub Issues: [Create an issue](#)
- Email: support@finetuner.be
- Website: https://finetuner.be

## Credits

Built with:
- [Google Gemini AI](https://ai.google.dev/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Tailwind CSS](https://tailwindcss.com/)

---

Made with ❤️ by [finetuner.be](https://finetuner.be)
