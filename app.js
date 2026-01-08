/**
 * Bathroom Configurator Frontend Logic
 * Handles image upload, analysis, style selection, rendering, and lead capture
 */

// API Configuration - Using Supabase Edge Functions
const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || 'https://hlahumsdruxifmscyuql.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsYWh1bXNkcnV4aWZtc2N5dXFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzMTI4NDgsImV4cCI6MjA4MDg4ODg0OH0.kkMRwjhOqsTbBXP0k466SZjJY-nWIY1oOXdAkaIeNmE';
const API_BASE_URL = `${SUPABASE_URL}/functions/v1`;

// Session tracking
let sessionId = null;
let specId = null;

// Global state
let currentSpec = null;
let selectedStyle = null;
let currentRenderUrl = null;
let uploadedFile = null;

/**
 * Generate or retrieve session ID
 */
function getSessionId() {
    if (sessionId) return sessionId;

    sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
}

/**
 * Get common request headers
 */
function getHeaders(additionalHeaders = {}) {
    return {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'X-Session-ID': getSessionId(),
        ...additionalHeaders
    };
}

// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('fileInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const analyzeBtn = document.getElementById('analyzeBtn');
const analyzingLoader = document.getElementById('analyzingLoader');

const specsSection = document.getElementById('specsSection');
const specsContent = document.getElementById('specsContent');
const confidenceScore = document.getElementById('confidenceScore');

const styleSection = document.getElementById('styleSection');
const styleGrid = document.getElementById('styleGrid');
const renderBtn = document.getElementById('renderBtn');
const renderingLoader = document.getElementById('renderingLoader');

const renderSection = document.getElementById('renderSection');
const renderImg = document.getElementById('renderImg');
const showLeadForm = document.getElementById('showLeadForm');

const leadSection = document.getElementById('leadSection');
const leadForm = document.getElementById('leadForm');
const successSection = document.getElementById('successSection');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    getSessionId();
    setupEventListeners();
    loadStyles();
    checkForSketchData();
});

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Drag and drop
    dropzone.addEventListener('dragover', handleDragOver);
    dropzone.addEventListener('dragleave', handleDragLeave);
    dropzone.addEventListener('drop', handleDrop);

    // File input
    fileInput.addEventListener('change', handleFileSelect);

    // Analyze button
    analyzeBtn.addEventListener('click', analyzeBathroom);

    // Render button
    renderBtn.addEventListener('click', generateRender);

    // Show lead form
    showLeadForm.addEventListener('click', () => {
        leadSection.classList.remove('hidden');
        leadSection.scrollIntoView({ behavior: 'smooth' });
    });

    // Lead form submission
    leadForm.addEventListener('submit', handleLeadSubmit);
}

/**
 * Drag and drop handlers
 */
function handleDragOver(e) {
    e.preventDefault();
    dropzone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    dropzone.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

/**
 * Handle file upload
 */
function handleFile(file) {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showError('Invalid file type. Please upload JPG, PNG, or WebP.');
        return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showError('File too large. Maximum size is 10MB.');
        return;
    }

    uploadedFile = file;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        imagePreview.classList.remove('hidden');
        dropzone.classList.add('hidden');
    };
    reader.readAsDataURL(file);
}

/**
 * Analyze bathroom layout
 */
async function analyzeBathroom() {
    if (!uploadedFile) return;

    // Show loader
    analyzeBtn.classList.add('hidden');
    analyzingLoader.classList.remove('hidden');

    try {
        // Create form data
        const formData = new FormData();
        formData.append('file', uploadedFile);

        // Call API
        const response = await fetch(`${API_BASE_URL}/bathroom-analyze`, {
            method: 'POST',
            headers: getHeaders(),
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Analysis failed');
        }

        // Store spec and session data
        currentSpec = data.spec;
        specId = data.spec_id;
        sessionId = data.session_id;

        // Display specs
        displaySpecs(currentSpec);

        // Show next section
        specsSection.classList.remove('hidden');
        styleSection.classList.remove('hidden');

        // Scroll to specs
        specsSection.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        showError(error.message);
        analyzeBtn.classList.remove('hidden');
    } finally {
        analyzingLoader.classList.add('hidden');
    }
}

/**
 * Display extracted specifications
 */
function displaySpecs(spec) {
    const room = spec.room;
    const area = (room.length * room.width).toFixed(1);

    // Build HTML
    let html = `
        <div>
            <h3 class="font-semibold text-lg mb-3 text-gray-800">
                <i class="fas fa-ruler-combined text-blue-500 mr-2"></i>Room Dimensions
            </h3>
            <ul class="space-y-2 text-gray-700">
                <li><span class="font-medium">Length:</span> ${room.length}m</li>
                <li><span class="font-medium">Width:</span> ${room.width}m</li>
                <li><span class="font-medium">Height:</span> ${room.height}m</li>
                <li><span class="font-medium">Floor Area:</span> ${area}m²</li>
            </ul>
            ${room.notes ? `<p class="text-sm text-gray-600 mt-2 italic">${room.notes}</p>` : ''}
        </div>

        <div>
            <h3 class="font-semibold text-lg mb-3 text-gray-800">
                <i class="fas fa-toilet text-blue-500 mr-2"></i>Fixtures Detected
            </h3>
            <ul class="space-y-2 text-gray-700">
                ${spec.fixtures.map(f => `
                    <li>
                        <span class="font-medium capitalize">${f.type}:</span> ${f.position}
                        ${f.notes ? `<br><span class="text-sm text-gray-600">${f.notes}</span>` : ''}
                    </li>
                `).join('')}
            </ul>
        </div>
    `;

    if (spec.constraints && spec.constraints.length > 0) {
        html += `
            <div class="md:col-span-2">
                <h3 class="font-semibold text-lg mb-3 text-gray-800">
                    <i class="fas fa-exclamation-triangle text-yellow-500 mr-2"></i>Constraints
                </h3>
                <ul class="space-y-2 text-gray-700">
                    ${spec.constraints.map(c => `
                        <li>
                            <span class="font-medium capitalize">${c.type}:</span> ${c.location}
                            ${c.impact ? `<br><span class="text-sm text-gray-600">${c.impact}</span>` : ''}
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    specsContent.innerHTML = html;

    // Display confidence
    const confidencePercent = (spec.confidence * 100).toFixed(0);
    const confidenceColor = spec.confidence > 0.8 ? 'text-green-600' : spec.confidence > 0.6 ? 'text-yellow-600' : 'text-orange-600';
    confidenceScore.innerHTML = `<span class="${confidenceColor} font-bold">${confidencePercent}%</span>`;
}

/**
 * Load available styles from API
 */
async function loadStyles() {
    try {
        const response = await fetch(`${API_BASE_URL}/bathroom-styles`, {
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error('API not available');
        }

        const data = await response.json();
        displayStyles(data.styles);
    } catch (error) {
        console.error('Error loading styles:', error);
        displayStyles([
            { id: 'modern', name: 'Modern', description: 'Clean lines, floating vanity, large format tiles' },
            { id: 'classic', name: 'Classic', description: 'Traditional elegance with timeless fixtures' },
            { id: 'minimalist', name: 'Minimalist', description: 'Ultimate simplicity with hidden storage' },
            { id: 'luxury', name: 'Luxury', description: 'High-end finishes with statement pieces' }
        ]);
    }
}

/**
 * Display style selection cards
 */
function displayStyles(styles) {
    const styleIcons = {
        modern: 'fa-lightbulb',
        classic: 'fa-crown',
        minimalist: 'fa-minus',
        luxury: 'fa-gem'
    };

    const html = styles.map(style => `
        <div class="style-card bg-white border-2 border-gray-200 rounded-lg p-6 text-center"
             data-style="${style.id}"
             onclick="selectStyle('${style.id}')">
            <i class="fas ${styleIcons[style.id] || 'fa-palette'} text-4xl text-blue-500 mb-3"></i>
            <h3 class="font-bold text-lg mb-2">${style.name}</h3>
            <p class="text-sm text-gray-600">${style.description}</p>
        </div>
    `).join('');

    styleGrid.innerHTML = html;
}

/**
 * Select a style
 */
function selectStyle(styleId) {
    selectedStyle = styleId;

    // Update UI
    document.querySelectorAll('.style-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`[data-style="${styleId}"]`).classList.add('selected');

    // Enable render button
    renderBtn.disabled = false;
}

/**
 * Generate bathroom render
 */
async function generateRender() {
    if (!currentSpec || !selectedStyle) return;

    // Show loader
    renderBtn.classList.add('hidden');
    renderingLoader.classList.remove('hidden');

    try {
        // Call render API
        const response = await fetch(`${API_BASE_URL}/bathroom-render`, {
            method: 'POST',
            headers: getHeaders({
                'Content-Type': 'application/json',
                'X-Spec-ID': specId
            }),
            body: JSON.stringify({
                spec: currentSpec,
                style: selectedStyle
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Rendering failed');
        }

        // Store render URL and session data
        currentRenderUrl = data.render_url;
        sessionId = data.session_id;

        // Display render
        renderImg.src = currentRenderUrl;
        renderSection.classList.remove('hidden');

        // Scroll to render
        renderSection.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        showError(error.message);
        renderBtn.classList.remove('hidden');
    } finally {
        renderingLoader.classList.add('hidden');
    }
}

/**
 * Handle lead form submission
 */
async function handleLeadSubmit(e) {
    e.preventDefault();

    const leadData = {
        name: document.getElementById('leadName').value,
        email: document.getElementById('leadEmail').value,
        phone: document.getElementById('leadPhone').value,
        project_timeline: document.getElementById('leadTimeline').value,
        spec_json: currentSpec,
        render_url: currentRenderUrl
    };

    try {
        const response = await fetch(`${API_BASE_URL}/bathroom-submit-lead`, {
            method: 'POST',
            headers: getHeaders({
                'Content-Type': 'application/json'
            }),
            body: JSON.stringify(leadData)
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || 'Submission failed');
        }

        // Show success
        leadSection.classList.add('hidden');
        successSection.classList.remove('hidden');
        successSection.scrollIntoView({ behavior: 'smooth' });

        // Trigger download
        downloadRender();

    } catch (error) {
        showError(error.message);
    }
}

/**
 * Download render image
 */
function downloadRender() {
    const link = document.createElement('a');
    link.href = currentRenderUrl;
    link.download = `bathroom-render-${selectedStyle}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Show error message
 */
function showError(message) {
    // Create error toast
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-md';
    toast.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-exclamation-circle mr-3 text-xl"></i>
            <div>
                <p class="font-medium">Error</p>
                <p class="text-sm">${message}</p>
            </div>
        </div>
    `;

    document.body.appendChild(toast);

    // Remove after 5 seconds
    setTimeout(() => {
        toast.remove();
    }, 5000);
}

/**
 * Check if coming from sketch tool with pre-populated data
 */
function checkForSketchData() {
    // Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get('source');

    if (source === 'sketch') {
        // Retrieve sketch data from session storage
        const sketchSpecStr = sessionStorage.getItem('sketchSpec');
        const sketchImageStr = sessionStorage.getItem('sketchImage');

        if (sketchSpecStr && sketchImageStr) {
            // Parse spec
            currentSpec = JSON.parse(sketchSpecStr);

            // Display sketch image as preview
            previewImg.src = sketchImageStr;
            imagePreview.classList.remove('hidden');
            dropzone.classList.add('hidden');

            // Hide analyze button (already have spec)
            analyzeBtn.classList.add('hidden');

            // Display specs immediately
            displaySpecs(currentSpec);
            specsSection.classList.remove('hidden');
            styleSection.classList.remove('hidden');

            // Scroll to specs
            specsSection.scrollIntoView({ behavior: 'smooth' });

            // Clear session storage
            sessionStorage.removeItem('sketchSpec');
            sessionStorage.removeItem('sketchImage');

            // Show success message
            const toast = document.createElement('div');
            toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 max-w-md';
            toast.innerHTML = `
                <div class="flex items-center">
                    <i class="fas fa-check-circle mr-3 text-xl"></i>
                    <div>
                        <p class="font-medium">Sketch Imported!</p>
                        <p class="text-sm">Your bathroom layout has been loaded successfully</p>
                    </div>
                </div>
            `;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 5000);
        }
    }
}

// Make functions globally accessible
window.selectStyle = selectStyle;
