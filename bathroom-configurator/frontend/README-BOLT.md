# Bathroom Configurator Frontend - Bolt.new Setup

This frontend is ready to deploy on **Bolt.new** with zero configuration!

## 🚀 Quick Start with Bolt.new

### Option 1: Upload to Bolt (Recommended)

1. **Go to [bolt.new](https://bolt.new)**

2. **Upload these files**:
   ```
   frontend/
   ├── index.html
   ├── app.js
   ├── sketch.html
   ├── sketch.js
   ├── package.json
   ├── vite.config.js
   └── .env.example
   ```

3. **Create `.env` file in Bolt**:
   ```env
   VITE_API_URL=http://localhost:8000
   ```
   (Or use your deployed backend URL)

4. **Bolt will auto-install and run** - that's it!

### Option 2: GitHub Import

1. Push frontend folder to GitHub
2. Go to bolt.new
3. Click "Import from GitHub"
4. Select your repo/frontend folder
5. Bolt auto-configures everything

---

## 🔧 Configuration

### Backend Connection

**Local Backend** (running on localhost:8000):
```env
VITE_API_URL=http://localhost:8000
```

**Deployed Backend**:
```env
VITE_API_URL=https://your-backend-domain.com
```

**Using Vite Proxy** (for CORS issues):
- No .env needed!
- Vite proxy is pre-configured in `vite.config.js`
- Requests to `/api/*` and `/static/*` auto-forward to backend

---

## 📦 What's Included

### Core Files
- **index.html** - Main app with upload/analysis flow
- **app.js** - Upload, AI analysis, style selection, lead capture
- **sketch.html** - Fabric.js sketch tool interface
- **sketch.js** - Canvas drawing with fixtures + measurements

### Dependencies (via CDN - no npm install needed!)
- ✅ Tailwind CSS (styling)
- ✅ Font Awesome (icons)
- ✅ Fabric.js (canvas drawing)

### Build Tools
- **Vite** - Fast dev server + build tool
- **package.json** - Node.js config
- **vite.config.js** - Proxy + multi-page setup

---

## 🎨 Features

### Main App (index.html)
1. **Upload Flow**: Drag-and-drop or file select
2. **Sketch Tool CTA**: Prominent purple button
3. **AI Analysis**: Displays extracted specs with confidence
4. **Style Selection**: 4 cards (Modern, Classic, Minimalist, Luxury)
5. **Render Display**: Shows generated bathroom render
6. **Lead Form**: Name, email, phone, project timeline

### Sketch Tool (sketch.html)
1. **Drawing Tools**: Select, Rectangle, Line, Text
2. **Fixture Library**: 6 pre-built fixtures (toilet, sink, shower, bath, door, window)
3. **Dimensions Input**: Length, width, height (meters)
4. **Grid Canvas**: 1m = 50px scale
5. **Export**: PNG + structured JSON → auto-imports to main app

---

## 🏗️ Development

### Run Locally
```bash
npm run dev
# Opens http://localhost:3000
```

### Build for Production
```bash
npm run build
# Creates /dist folder
```

### Preview Production Build
```bash
npm run preview
```

---

## 🔌 API Endpoints Used

### GET /api/styles
Returns available rendering styles

### POST /api/analyze
Upload bathroom image → extract specs
**Rate limit**: 5/hour per IP

### POST /api/render
Generate render from spec + style
**Rate limit**: 3/hour per IP

### POST /api/submit-lead
Submit lead after viewing render

---

## 🐛 Troubleshooting

### CORS Errors
**Solution 1**: Use Vite proxy (already configured)
```js
// vite.config.js already has:
proxy: {
  '/api': { target: 'http://localhost:8000' }
}
```

**Solution 2**: Enable CORS on backend
```python
# backend/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Add your Bolt URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Backend Not Responding
1. Check backend is running: `curl http://localhost:8000/`
2. Verify `VITE_API_URL` in `.env`
3. Check browser console for network errors

### Fabric.js Not Loading (Sketch Tool)
- Check internet connection (Fabric.js is from CDN)
- Check browser console for CDN errors
- Fallback: Download Fabric.js and serve locally

---

## 📱 Mobile Support

The UI is fully responsive with Tailwind CSS:
- ✅ Mobile-friendly drag-and-drop
- ✅ Touch-enabled sketch canvas
- ✅ Responsive grid layouts
- ✅ Mobile-optimized buttons

---

## 🚢 Deployment Options

### Bolt.new (Easiest)
- **Pros**: Zero config, instant preview
- **Cons**: Requires Bolt account
- **Best for**: Quick demos, testing

### Vercel
```bash
npm run build
vercel --prod
```

### Netlify
```bash
npm run build
netlify deploy --prod --dir=dist
```

### GitHub Pages
```bash
npm run build
# Upload /dist to gh-pages branch
```

---

## 🎯 Next Steps

1. **Upload to Bolt.new**
2. **Configure .env with backend URL**
3. **Test upload flow**: Upload a bathroom photo
4. **Test sketch tool**: Draw a bathroom layout
5. **Test full flow**: Upload → Analyze → Style → Render → Lead

---

## 💡 Tips

- **Use sketch tool for demos** - Higher confidence (95% vs 70%)
- **Gemini 3 Pro needed** - Backend must use correct model names
- **Rate limits** - 5 analyses + 3 renders per hour per IP
- **Webhook optional** - Lead form works without CRM integration

---

Built with ❤️ using Gemini 3 Pro + Fabric.js + Vite
