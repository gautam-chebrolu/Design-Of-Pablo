const dotenv = require('dotenv');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Multer config for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and HEIC images are allowed'));
    }
  }
});

// ═══════════════════════════════════════════════
// Gemini API (direct REST, no SDK needed)
// ═══════════════════════════════════════════════

function callGeminiAPI(apiKey, base64Image, mimeType) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      contents: [{
        parts: [
          {
            text: `You are an expert UI/UX designer and color theorist. Analyze this image and extract a comprehensive design system inspired by its visual elements.

Return a valid JSON object (no markdown formatting, no code fences) with this exact structure:

{
  "colors": {
    "primary": "<hex color - the most dominant/impactful color>",
    "secondary": "<hex color - the second most prominent color>",
    "accent": "<hex color - a vibrant highlight or feature color>",
    "background": "<hex color - suitable for a page/card background inspired by the image>",
    "surface": "<hex color - a slightly contrasting surface color>",
    "text": "<hex color - appropriate text color for readability on the background>",
    "textSecondary": "<hex color - lighter text for captions/subtitles>"
  },
  "colorNames": {
    "primary": "<evocative name, e.g. 'Forest Emerald'>",
    "secondary": "<evocative name>",
    "accent": "<evocative name>",
    "background": "<evocative name>",
    "surface": "<evocative name>"
  },
  "mood": "<3-5 descriptive words, comma separated, e.g. 'warm, organic, serene, grounded'>",
  "style": "<2-3 word style descriptor, e.g. 'rustic elegance', 'modern minimal', 'bohemian warmth'>",
  "atmosphere": "<one sentence describing the emotional feel>",
  "typography": {
    "headingStyle": "<description of ideal heading typography, e.g. 'bold serif with classic proportions'>",
    "bodyStyle": "<description of ideal body text, e.g. 'clean sans-serif with generous spacing'>",
    "suggestedFonts": {
      "heading": "<Google Font name, e.g. 'Playfair Display'>",
      "body": "<Google Font name, e.g. 'Source Sans 3'>"
    }
  },
  "designNotes": "<2-3 sentences about what makes this image's aesthetic distinctive and how it translates to graphic design>",
  "sourceDescription": "<brief description of what the image appears to show>"
}

Important rules:
- All hex colors must be valid 6-digit hex codes starting with #
- Choose colors that work well together as a cohesive palette, not just sampled directly
- The background should be soft/muted enough to serve as a page background
- Text colors must be readable against the background
- Font suggestions must be real Google Fonts
- Return ONLY the JSON object, no other text`
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          }
        ]
      }]
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    const parsedUrl = new URL(url);

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200) {
            reject(new Error(parsed.error?.message || `Gemini API error: ${res.statusCode}`));
            return;
          }
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            reject(new Error('No response text from Gemini'));
            return;
          }
          resolve(text);
        } catch (e) {
          reject(new Error('Failed to parse Gemini response: ' + e.message));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error('Gemini API request failed: ' + e.message));
    });

    req.write(requestBody);
    req.end();
  });
}

// ═══════════════════════════════════════════════
// Routes
// ═══════════════════════════════════════════════

/**
 * POST /api/analyze
 * Accepts an image upload and returns an extracted design system via Gemini Vision
 */
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured. Add it to your .env file.' });
    }

    const base64Image = req.file.buffer.toString('base64');
    const responseText = await callGeminiAPI(
      process.env.GEMINI_API_KEY,
      base64Image,
      req.file.mimetype
    );

    // Parse the JSON from the response (handle potential markdown wrapping)
    let designSystem;
    try {
      designSystem = JSON.parse(responseText);
    } catch (e) {
      // Try to extract JSON from markdown code fences
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        designSystem = JSON.parse(jsonMatch[1].trim());
      } else {
        // Try to find JSON object in the text
        const objectMatch = responseText.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          designSystem = JSON.parse(objectMatch[0]);
        } else {
          throw new Error('Could not parse design system from AI response');
        }
      }
    }

    res.json({
      success: true,
      designSystem,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({
      error: 'Failed to analyze image',
      details: error.message
    });
  }
});

/**
 * POST /api/generate-prompt
 * Takes a design system and Figma file URL, generates the MCP prompt
 */
app.post('/api/generate-prompt', (req, res) => {
  try {
    const { designSystem, figmaFileUrl } = req.body;

    if (!designSystem) {
      return res.status(400).json({ error: 'designSystem is required' });
    }

    const fileUrl = figmaFileUrl || process.env.FIGMA_FILE_URL || '<YOUR_FIGMA_FILE_URL>';
    const prompt = generateFigmaPrompt(designSystem, fileUrl);

    res.json({
      success: true,
      prompt,
      promptLength: prompt.length
    });

  } catch (error) {
    console.error('Prompt generation error:', error);
    res.status(500).json({
      error: 'Failed to generate prompt',
      details: error.message
    });
  }
});

/**
 * Generates a comprehensive Figma MCP prompt from a design system
 */
function generateFigmaPrompt(ds, fileUrl) {
  return `Using this Figma file: ${fileUrl}

I want you to update the design to match a new design system inspired by the real world. Here is the design system extracted from a photo:

**Style:** ${ds.style}
**Mood:** ${ds.mood}
**Atmosphere:** ${ds.atmosphere}

**Color Palette:**
- Primary: ${ds.colors.primary} (${ds.colorNames && ds.colorNames.primary || 'Primary'})
- Secondary: ${ds.colors.secondary} (${ds.colorNames && ds.colorNames.secondary || 'Secondary'})
- Accent: ${ds.colors.accent} (${ds.colorNames && ds.colorNames.accent || 'Accent'})
- Background: ${ds.colors.background} (${ds.colorNames && ds.colorNames.background || 'Background'})
- Surface: ${ds.colors.surface} (${ds.colorNames && ds.colorNames.surface || 'Surface'})
- Text: ${ds.colors.text}
- Text Secondary: ${ds.colors.textSecondary}

**Typography:**
- Headings: ${ds.typography.headingStyle} → Use "${ds.typography.suggestedFonts.heading}"
- Body: ${ds.typography.bodyStyle} → Use "${ds.typography.suggestedFonts.body}"

**Design Notes:** ${ds.designNotes}

Please:
1. First, inspect the existing file structure to understand the current design.
2. Create or update color variables to match the palette above.
3. Update background fills, text colors, accent elements, and any decorative elements to use the new color variables.
4. If there are text elements, update the font families to match the typography suggestions.
5. Ensure all changes maintain visual harmony and readability.
6. Work incrementally — update colors first, then typography, then review the overall composition.`;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    figmaUrlConfigured: !!process.env.FIGMA_FILE_URL
  });
});

// WebSocket Handling
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  socket.on('push_design_system', (data) => {
    console.log('📦 Broadcasting design system to Figma Plugins...');
    // Broadcast to all connected clients (specifically the Figma Plugin)
    io.emit('apply_design_system', data);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log('\n  \u{1F3A8} The Design of Pablo is running with WebSockets! 🔌');
  console.log('  ────────────────────────');
  console.log('  Local:   http://localhost:' + PORT);
  console.log('  Network: http://0.0.0.0:' + PORT);
  console.log('\n  Open this URL on your phone (same WiFi) to capture photos.\n');

  if (!process.env.GEMINI_API_KEY) {
    console.warn('  ⚠️  GEMINI_API_KEY is not set. Copy .env.example to .env and add your key.\n');
  }
});
