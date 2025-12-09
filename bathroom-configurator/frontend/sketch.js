/**
 * Bathroom Sketch Tool using Fabric.js
 * Allows users to draw bathroom layouts with fixtures and measurements
 */

// API Configuration
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : window.location.origin;

// Canvas setup
let canvas;
let currentTool = 'select';
let isDrawing = false;
let drawingObject = null;

// Fixture definitions (scaled for canvas - 1m = 50px)
const SCALE = 50; // pixels per meter
const FIXTURES = {
    toilet: { width: 0.4, height: 0.7, color: '#e5e7eb', label: 'T' },
    sink: { width: 0.6, height: 0.5, color: '#bfdbfe', label: 'S' },
    shower: { width: 1.0, height: 1.0, color: '#dbeafe', label: 'SH' },
    bath: { width: 1.7, height: 0.75, color: '#bfdbfe', label: 'B' },
    door: { width: 0.9, height: 0.1, color: '#fef3c7', label: 'D' },
    window: { width: 1.0, height: 0.1, color: '#e0e7ff', label: 'W' }
};

// Initialize canvas
function initCanvas() {
    canvas = new fabric.Canvas('sketchCanvas', {
        width: 800,
        height: 600,
        backgroundColor: '#ffffff',
        selection: true
    });

    // Add grid
    addGrid();

    // Set up event listeners
    setupCanvasEvents();
}

// Add grid to canvas
function addGrid() {
    const gridSize = 50; // 1 meter
    const width = canvas.width;
    const height = canvas.height;

    for (let i = 0; i < width / gridSize; i++) {
        canvas.add(new fabric.Line([i * gridSize, 0, i * gridSize, height], {
            stroke: '#e5e7eb',
            strokeWidth: 1,
            selectable: false,
            evented: false
        }));
    }

    for (let i = 0; i < height / gridSize; i++) {
        canvas.add(new fabric.Line([0, i * gridSize, width, i * gridSize], {
            stroke: '#e5e7eb',
            strokeWidth: 1,
            selectable: false,
            evented: false
        }));
    }
}

// Setup canvas events
function setupCanvasEvents() {
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);
}

// Handle mouse down
function handleMouseDown(options) {
    if (currentTool === 'select') return;

    isDrawing = true;
    const pointer = canvas.getPointer(options.e);

    if (currentTool === 'rectangle') {
        drawingObject = new fabric.Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: 'transparent',
            stroke: '#3b82f6',
            strokeWidth: 3
        });
        canvas.add(drawingObject);
    } else if (currentTool === 'line') {
        drawingObject = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
            stroke: '#1f2937',
            strokeWidth: 3
        });
        canvas.add(drawingObject);
    } else if (currentTool === 'text') {
        const text = prompt('Enter measurement (e.g., "3.2m"):');
        if (text) {
            const textObj = new fabric.Text(text, {
                left: pointer.x,
                top: pointer.y,
                fontSize: 16,
                fill: '#1f2937',
                fontWeight: 'bold'
            });
            canvas.add(textObj);
        }
        isDrawing = false;
    }
}

// Handle mouse move
function handleMouseMove(options) {
    if (!isDrawing || !drawingObject) return;

    const pointer = canvas.getPointer(options.e);

    if (currentTool === 'rectangle') {
        const width = pointer.x - drawingObject.left;
        const height = pointer.y - drawingObject.top;
        drawingObject.set({ width, height });
    } else if (currentTool === 'line') {
        drawingObject.set({ x2: pointer.x, y2: pointer.y });
    }

    canvas.renderAll();
}

// Handle mouse up
function handleMouseUp() {
    isDrawing = false;
    drawingObject = null;
}

// Add fixture to canvas
function addFixture(type) {
    const fixture = FIXTURES[type];
    const width = fixture.width * SCALE;
    const height = fixture.height * SCALE;

    // Create fixture group
    const rect = new fabric.Rect({
        width: width,
        height: height,
        fill: fixture.color,
        stroke: '#1f2937',
        strokeWidth: 2
    });

    const text = new fabric.Text(fixture.label, {
        fontSize: 14,
        fill: '#1f2937',
        fontWeight: 'bold',
        originX: 'center',
        originY: 'center',
        left: width / 2,
        top: height / 2
    });

    const group = new fabric.Group([rect, text], {
        left: canvas.width / 2 - width / 2,
        top: canvas.height / 2 - height / 2
    });

    group.set('fixtureType', type);
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();
}

// Tool selection
function selectTool(tool) {
    currentTool = tool;
    canvas.isDrawingMode = false;

    // Update UI
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(tool + 'Tool').classList.add('active');

    // Set canvas selection
    canvas.selection = (tool === 'select');
}

// Clear canvas
function clearCanvas() {
    if (confirm('Clear entire canvas?')) {
        canvas.clear();
        addGrid();
    }
}

// Delete selected object
function deleteSelected() {
    const activeObjects = canvas.getActiveObjects();
    if (activeObjects.length) {
        activeObjects.forEach(obj => canvas.remove(obj));
        canvas.discardActiveObject();
        canvas.renderAll();
    }
}

// Zoom controls
function zoomIn() {
    const zoom = canvas.getZoom();
    canvas.setZoom(zoom * 1.1);
}

function zoomOut() {
    const zoom = canvas.getZoom();
    canvas.setZoom(zoom * 0.9);
}

function resetView() {
    canvas.setZoom(1);
    canvas.viewportTransform = [1, 0, 0, 1, 0, 0];
    canvas.renderAll();
}

// Export sketch and send to AI
async function exportSketch() {
    // Get room dimensions
    const length = parseFloat(document.getElementById('roomLength').value);
    const width = parseFloat(document.getElementById('roomWidth').value);
    const height = parseFloat(document.getElementById('roomHeight').value);

    // Validate dimensions
    if (!length || !width || !height) {
        alert('Please enter room dimensions (length, width, height)');
        return;
    }

    if (length < 1 || length > 10 || width < 1 || width > 10) {
        alert('Room dimensions must be between 1m and 10m');
        return;
    }

    if (height < 2 || height > 4) {
        alert('Room height must be between 2m and 4m');
        return;
    }

    // Extract fixtures from canvas
    const fixtures = [];
    canvas.getObjects().forEach(obj => {
        if (obj.fixtureType) {
            // Calculate position relative to canvas
            const posX = (obj.left / canvas.width) * 100; // percentage
            const posY = (obj.top / canvas.height) * 100;

            let position = 'CENTER';
            if (posX < 33 && posY < 33) position = 'NW';
            else if (posX > 66 && posY < 33) position = 'NE';
            else if (posX < 33 && posY > 66) position = 'SW';
            else if (posX > 66 && posY > 66) position = 'SE';
            else if (posY < 33) position = 'N';
            else if (posY > 66) position = 'S';
            else if (posX < 33) position = 'W';
            else if (posX > 66) position = 'E';

            fixtures.push({
                type: obj.fixtureType,
                position: position,
                dimensions: `${FIXTURES[obj.fixtureType].width}m x ${FIXTURES[obj.fixtureType].height}m`,
                notes: `Placed at canvas position (${Math.round(posX)}%, ${Math.round(posY)}%)`
            });
        }
    });

    // Build structured spec
    const sketchSpec = {
        room: {
            length: length,
            width: width,
            height: height,
            notes: `User-provided dimensions from sketch tool`
        },
        fixtures: fixtures,
        constraints: [],
        current_style: null,
        condition: 'new',
        confidence: 0.95, // High confidence since user provided explicit data
        reasoning: 'Dimensions and fixtures explicitly provided by user via sketch tool'
    };

    // Export canvas as image
    const imageDataURL = canvas.toDataURL({
        format: 'png',
        quality: 1.0
    });

    // Convert data URL to blob
    const response = await fetch(imageDataURL);
    const blob = await response.blob();

    // Store in session storage for next page
    sessionStorage.setItem('sketchSpec', JSON.stringify(sketchSpec));
    sessionStorage.setItem('sketchImage', imageDataURL);

    // Redirect to main app with sketch flag
    window.location.href = `index.html?source=sketch`;
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initCanvas();

    // Tool buttons
    document.getElementById('selectTool').addEventListener('click', () => selectTool('select'));
    document.getElementById('rectangleTool').addEventListener('click', () => selectTool('rectangle'));
    document.getElementById('lineTool').addEventListener('click', () => selectTool('line'));
    document.getElementById('textTool').addEventListener('click', () => selectTool('text'));

    // Fixture buttons
    document.querySelectorAll('.fixture-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const fixtureType = btn.dataset.fixture;
            addFixture(fixtureType);
        });
    });

    // Action buttons
    document.getElementById('clearCanvas').addEventListener('click', clearCanvas);
    document.getElementById('deleteSelected').addEventListener('click', deleteSelected);

    // Zoom controls
    document.getElementById('zoomIn').addEventListener('click', zoomIn);
    document.getElementById('zoomOut').addEventListener('click', zoomOut);
    document.getElementById('resetView').addEventListener('click', resetView);

    // Export button
    document.getElementById('exportSketch').addEventListener('click', exportSketch);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            deleteSelected();
        }
    });
});
