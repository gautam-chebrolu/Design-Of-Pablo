/**
 * The Design of Pablo Bridge - code.js
 * Runs uniquely in the Figma Node Sandbox environment.
 * Responsible for creating/updating variables and styles programmatically.
 */

figma.showUI(__html__, { width: 300, height: 120 });

// Fallback to older Figma behavior if variables are not supported
const canUseVariables = typeof figma.variables !== 'undefined';

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'CLIENT_CONNECTED') {
    figma.notify('📱 The Design of Pablo Connected to Phone Server!', { timeout: 3000 });
  }

  if (msg.type === 'APPLY_SYSTEM') {
    const ds = msg.payload;
    if (!ds) return;

    console.log("Applying Payload: ", ds);

    try {
      await updateOrAddColors(ds.colors, ds.colorNames);
      
      // Create/update Local Color Styles in the library
      var colorStyleMap = await createOrUpdateColorStyles(ds.colors, ds.colorNames);
      
      const suggestedFonts = ds.typography ? ds.typography.suggestedFonts : undefined;
      if (suggestedFonts) {
        await updateTextStyles(suggestedFonts);
      }
      
      await updateSelectedShapes(ds.colors);
      
      // Create a summary slide if we're in Figma Slides
      await createDesignSystemSlide(ds, colorStyleMap);
      
      figma.notify('✨ The Design of Pablo System Applied!');
    } catch (e) {
      console.error(e);
      figma.notify('Error applying system: ' + e.message, { error: true });
    }
  }
};

/**
 * Ensures a Variable Collection exists and updates the values for Primary, Secondary, etc.
 */
async function updateOrAddColors(colors, names = {}) {
  if (!canUseVariables) {
    console.warn("Variables are not supported in this file (or Figma version). Skipping variable creation.");
    return;
  }

  // Find or create 'The Design of Pablo' variable collection
  let collection = null;
  const existingCollections = await figma.variables.getLocalVariableCollectionsAsync();
  collection = existingCollections.find(c => c.name === 'The Design of Pablo Colors');

  if (!collection) {
    collection = figma.variables.createVariableCollection('The Design of Pablo Colors');
  }

  const defaultModeId = collection.modes[0].modeId;

  // Process all keys mapping hex to RGB
  for (const [key, hexValue] of Object.entries(colors)) {
    if (!hexValue) continue;
    
    // e.g. Primary, Secondary
    const niceName = key.charAt(0).toUpperCase() + key.slice(1);
    
    // Find or create exact variable
    let variable = null;
    const existingVars = collection.variableIds.map(id => figma.variables.getVariableById(id));
    variable = existingVars.find(v => v.name === niceName);

    if (!variable) {
      variable = figma.variables.createVariable(niceName, collection.id, 'COLOR');
    }

    // Set variable description to evocative name if it exists
    if (names[key]) {
      variable.description = names[key];
    }

    // Convert hex string to Figma RGB object ({r: 0-1, g: 0-1, b: 0-1})
    const rgb = hexToRgb(hexValue);
    if (rgb) {
      variable.setValueForMode(defaultModeId, rgb);
      console.log(`Updated variable ${niceName} to ${hexValue}`);
    }
  }
}

/**
 * Updates Figma's Local Text Styles based on AI typography suggestions
 */
async function updateTextStyles(fonts) {
  if (!fonts || (!fonts.heading && !fonts.body)) return;
  
  const localStyles = figma.getLocalTextStyles();
  if (localStyles.length === 0) {
    console.log("No Local Text Styles found to update.");
    return;
  }
  
  for (const style of localStyles) {
    const name = style.name.toLowerCase();
    
    let familyToLoad = fonts.body;
    let preferredStyles = ['Light', '300', 'Regular', 'Normal', 'Medium'];

    if (name.includes('title')) {
      familyToLoad = fonts.heading;
      preferredStyles = ['Semi Bold', 'SemiBold', '600', 'Bold', '700', 'Medium', 'Regular'];
    } else if (name.includes('header')) {
      familyToLoad = fonts.heading;
      preferredStyles = ['Medium', '500', 'Regular', 'Normal', 'Semi Bold'];
    } else if (name.includes('subheadline 1') || name.includes('subheadline 2') || name.includes('subheadline')) {
      familyToLoad = fonts.heading || fonts.body;
      preferredStyles = ['Regular', 'Normal', '400', 'Medium', 'Light'];
    } else if (name.includes('body 1')) {
      familyToLoad = fonts.body;
      preferredStyles = ['Regular', 'Normal', '400', 'Light', 'Medium'];
    } else if (name.includes('body 2')) {
      familyToLoad = fonts.body;
      preferredStyles = ['Light', '300', 'Regular', 'Normal'];
    } else if (name.includes('body 3')) {
      familyToLoad = fonts.body;
      preferredStyles = ['Light', '300', 'Extra Light', 'ExtraLight', '200', 'Regular'];
    } else if (name.includes('body')) {
      familyToLoad = fonts.body;
      preferredStyles = ['Regular', 'Normal', '400', 'Light'];
    } else if (name.includes('note')) {
      familyToLoad = fonts.body;
      preferredStyles = ['Light', '300', 'Regular', 'Normal', 'Extra Light'];
    } else if (name.includes('caption 1') || name.includes('caption 2') || name.includes('caption')) {
      familyToLoad = fonts.body;
      preferredStyles = ['Light', '300', 'Regular', 'Normal'];
    } else {
      continue; // Skip unrecognized styles
    }

    if (familyToLoad) {
      // Must load existing font before changing the style's fontName
      try {
        await figma.loadFontAsync(style.fontName);
      } catch (e) {
        console.warn(`Could not load existing font for style ${style.name}`);
      }
      
      let loaded = false;
      for (const styleWeight of preferredStyles) {
        try {
          const newFont = { family: familyToLoad, style: styleWeight };
          await figma.loadFontAsync(newFont);
          style.fontName = newFont;
          loaded = true;
          console.log(`Updated Text Style "${style.name}" to ${familyToLoad} ${styleWeight}`);
          break;
        } catch (err) {}
      }
      if (!loaded) console.warn(`Failed to update Text Style "${style.name}"`);
    }
  }
}

/**
 * Magical Feedback: Automatically recolors the user's design based on intelligent rules.
 * This runs to give an instant "wow" factor by coloring nodes that don't have variables bound.
 * Text Font assignment has been removed so we don't destructively override text styles.
 */
async function updateSelectedShapes(colors) {
  // If user selected specific things, modify those. Otherwise modify everything on the page.
  let nodes = figma.currentPage.selection;
  if (nodes.length === 0) {
    nodes = figma.currentPage.children;
  }

  // Define our RGB instances
  const bgRgb = hexToRgb(colors.background);
  const primaryRgb = hexToRgb(colors.primary);
  const accentRgb = hexToRgb(colors.accent);
  const textRgb = hexToRgb(colors.text);
  const textSecRgb = hexToRgb(colors.textSecondary);
  const surfaceRgb = hexToRgb(colors.surface);

  async function traverseAndRecolor(node) {
    const isImage = ('fills' in node) && node.fills !== figma.mixed && Array.isArray(node.fills) && node.fills.some(f => f.type === 'IMAGE' || f.type === 'VIDEO');

    // 1. Backgrounds (Frames/Sections/Slides)
    if (!isImage && (node.type === 'FRAME' || node.type === 'SECTION' || node.type === 'SLIDE')) {
      const isRootElement = node.type === 'SLIDE' || (node.parent && node.parent.type === 'PAGE');
      if (isRootElement && bgRgb) {
        // Main canvas frames/slides get the background color
        if ('fills' in node) node.fills = [{ type: 'SOLID', color: bgRgb }];
      } else if (surfaceRgb) {
        // Nested frames get surface color (like cards)
        if ('fills' in node && node.fills.length > 0) {
           node.fills = [{ type: 'SOLID', color: surfaceRgb }];
        }
      }
    }

    // 2. Text Nodes (Color only)
    if (node.type === 'TEXT') {
      if (node.hasMissingFont) {
        console.warn('Skipping text node due to missing font.', node.name);
        return;
      }
      
      // Load current fonts so we can modify color safely
      await Promise.all(
        node.getRangeAllFontNames(0, node.characters.length).map(figma.loadFontAsync)
      );

      const size = node.fontSize || 16;
      let searchName = node.name.toLowerCase();
      if (node.parent) searchName += ' ' + node.parent.name.toLowerCase();
      if (node.parent && node.parent.parent) searchName += ' ' + node.parent.parent.name.toLowerCase();
      
      const isPrimaryHeading = searchName.includes('primary heading') || searchName.includes('title') || searchName.includes('header') || size >= 32;
      const isSecondaryHeading = searchName.includes('secondary heading') || searchName.includes('subheadline') || (size >= 24 && size < 32);

      // Heuristic: Large text -> Primary or Main Text. Small text -> Secondary Text
      if ('fills' in node) {
        if (isPrimaryHeading && primaryRgb) {
          node.fills = [{ type: 'SOLID', color: primaryRgb }];
        } else if (isSecondaryHeading && textRgb) {
          node.fills = [{ type: 'SOLID', color: textRgb }];
        } else if (textSecRgb) {
          node.fills = [{ type: 'SOLID', color: textSecRgb }];
        }
      }
    }

    // 3. Shapes and Vectors (Buttons, Icons, Graphics)
    if (!isImage && (node.type === 'RECTANGLE' || node.type === 'ELLIPSE' || node.type === 'VECTOR') && 'fills' in node) {
      if (accentRgb) {
        // Set vector shapes to Accent color
        node.fills = [{ type: 'SOLID', color: accentRgb }];
      }
    }

    // Traverse children
    if ('children' in node) {
      for (const child of node.children) {
        await traverseAndRecolor(child);
      }
    }
  }

  for (const rootNode of nodes) {
    await traverseAndRecolor(rootNode);
  }
}

/**
 * Creates or updates Local Paint Styles (Color Styles) so they appear in
 * the Figma style library and can be reused across the file.
 * Returns a map of color key -> style ID.
 */
async function createOrUpdateColorStyles(colors, colorNames) {
  var names = colorNames || {};
  var colorEntries = [
    { key: 'primary', label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'accent', label: 'Accent' },
    { key: 'background', label: 'Background' },
    { key: 'surface', label: 'Surface' },
    { key: 'text', label: 'Text' },
    { key: 'textSecondary', label: 'Text Secondary' }
  ];

  var localPaintStyles = figma.getLocalPaintStyles();
  var styleMap = {};

  for (var i = 0; i < colorEntries.length; i++) {
    var entry = colorEntries[i];
    var hex = colors[entry.key];
    if (!hex) continue;

    var rgb = hexToRgb(hex);
    if (!rgb) continue;

    var styleName = 'Pablo / ' + entry.label;

    // Find existing style or create a new one
    var style = null;
    for (var s = 0; s < localPaintStyles.length; s++) {
      if (localPaintStyles[s].name === styleName) {
        style = localPaintStyles[s];
        break;
      }
    }

    if (!style) {
      style = figma.createPaintStyle();
      style.name = styleName;
    }

    style.paints = [{ type: 'SOLID', color: rgb }];

    if (names[entry.key]) {
      style.description = names[entry.key];
    }

    styleMap[entry.key] = style.id;
    console.log('Updated Color Style "' + styleName + '" to ' + hex);
  }

  return styleMap;
}

/**
 * Creates a Design System summary slide (only in Figma Slides).
 * Layout: Left 1/3 has theme info + typography. Right 2/3 has color swatches.
 */
async function createDesignSystemSlide(ds, colorStyleMap) {
  // Only run if we're in Figma Slides (createSlide API exists)
  if (typeof figma.createSlide !== 'function') {
    console.log("Not in Figma Slides — skipping summary slide.");
    return;
  }

  var colors = ds.colors || {};
  var colorNames = ds.colorNames || {};
  var typography = ds.typography || {};
  var fonts = typography.suggestedFonts || {};

  // --- Load fonts ---
  var safeFont = { family: 'Inter', style: 'Regular' };
  var safeFontBold = { family: 'Inter', style: 'Bold' };
  var safeFontLight = { family: 'Inter', style: 'Light' };
  try { await figma.loadFontAsync(safeFont); } catch (e) { console.warn('Could not load Inter Regular'); }
  try { await figma.loadFontAsync(safeFontBold); } catch (e) { console.warn('Could not load Inter Bold'); }
  try { await figma.loadFontAsync(safeFontLight); } catch (e) { console.warn('Could not load Inter Light'); }

  // Try loading the AI-suggested heading font
  var headingFont = safeFontBold;
  if (fonts.heading) {
    var hWeights = ['Bold', 'Semi Bold', 'SemiBold', '700', '600', 'Medium', 'Regular'];
    for (var wi = 0; wi < hWeights.length; wi++) {
      try {
        var candidate = { family: fonts.heading, style: hWeights[wi] };
        await figma.loadFontAsync(candidate);
        headingFont = candidate;
        break;
      } catch (e) {}
    }
  }

  // Try loading the AI-suggested body font
  var bodyFont = safeFont;
  if (fonts.body) {
    var bWeights = ['Regular', 'Normal', '400', 'Light', 'Medium'];
    for (var wi2 = 0; wi2 < bWeights.length; wi2++) {
      try {
        var candidate2 = { family: fonts.body, style: bWeights[wi2] };
        await figma.loadFontAsync(candidate2);
        bodyFont = candidate2;
        break;
      } catch (e) {}
    }
  }

  // --- Create the slide ---
  var slide = figma.createSlide();
  var bgRgb = hexToRgb(colors.background);
  if (bgRgb) {
    slide.fills = [{ type: 'SOLID', color: bgRgb }];
  }

  var textColor = hexToRgb(colors.text) || { r: 0.17, g: 0.17, b: 0.17 };
  var textSecColor = hexToRgb(colors.textSecondary) || { r: 0.45, g: 0.45, b: 0.45 };
  var primaryColor = hexToRgb(colors.primary) || textColor;

  // ============================================
  // LEFT PANEL — Theme Info (x: 80, width: 500)
  // ============================================
  var LX = 80;
  var LW = 500;
  var yPos = 100;

  // Style name (big heading)
  var styleNode = figma.createText();
  slide.appendChild(styleNode);
  styleNode.fontName = headingFont;
  styleNode.characters = (ds.style || 'Design System').toUpperCase();
  styleNode.fontSize = 44;
  styleNode.fills = [{ type: 'SOLID', color: primaryColor }];
  styleNode.x = LX;
  styleNode.y = yPos;
  styleNode.textAutoResize = 'HEIGHT';
  styleNode.resize(LW, styleNode.height);
  yPos += styleNode.height + 28;

  // Mood
  if (ds.mood) {
    var moodNode = figma.createText();
    slide.appendChild(moodNode);
    moodNode.fontName = bodyFont;
    moodNode.characters = ds.mood;
    moodNode.fontSize = 20;
    moodNode.fills = [{ type: 'SOLID', color: textSecColor }];
    moodNode.x = LX;
    moodNode.y = yPos;
    moodNode.textAutoResize = 'HEIGHT';
    moodNode.resize(LW, moodNode.height);
    yPos += moodNode.height + 16;
  }

  // Atmosphere
  if (ds.atmosphere) {
    var atmoNode = figma.createText();
    slide.appendChild(atmoNode);
    atmoNode.fontName = bodyFont;
    atmoNode.characters = ds.atmosphere;
    atmoNode.fontSize = 16;
    atmoNode.fills = [{ type: 'SOLID', color: textSecColor }];
    atmoNode.x = LX;
    atmoNode.y = yPos;
    atmoNode.textAutoResize = 'HEIGHT';
    atmoNode.resize(LW, atmoNode.height);
    yPos += atmoNode.height + 40;
  }

  // Separator line
  var sepLine = figma.createRectangle();
  slide.appendChild(sepLine);
  sepLine.x = LX;
  sepLine.y = yPos;
  sepLine.resize(LW, 1);
  sepLine.fills = [{ type: 'SOLID', color: textSecColor }];
  sepLine.opacity = 0.25;
  yPos += 40;

  // Typography label
  var typoLabel = figma.createText();
  slide.appendChild(typoLabel);
  typoLabel.fontName = safeFontBold;
  typoLabel.characters = 'TYPOGRAPHY';
  typoLabel.fontSize = 11;
  typoLabel.letterSpacing = { value: 20, unit: 'PERCENT' };
  typoLabel.fills = [{ type: 'SOLID', color: textSecColor }];
  typoLabel.x = LX;
  typoLabel.y = yPos;
  yPos += 32;

  // Heading font sample
  var headingSample = figma.createText();
  slide.appendChild(headingSample);
  headingSample.fontName = headingFont;
  headingSample.characters = fonts.heading || 'Heading Font';
  headingSample.fontSize = 32;
  headingSample.fills = [{ type: 'SOLID', color: textColor }];
  headingSample.x = LX;
  headingSample.y = yPos;
  yPos += 48;

  // Body font sample
  var bodySample = figma.createText();
  slide.appendChild(bodySample);
  bodySample.fontName = bodyFont;
  bodySample.characters = fonts.body || 'Body Font';
  bodySample.fontSize = 22;
  bodySample.fills = [{ type: 'SOLID', color: textSecColor }];
  bodySample.x = LX;
  bodySample.y = yPos;
  yPos += 48;

  // Design notes
  if (ds.designNotes) {
    yPos += 16;
    var notesNode = figma.createText();
    slide.appendChild(notesNode);
    notesNode.fontName = bodyFont;
    notesNode.characters = ds.designNotes;
    notesNode.fontSize = 14;
    notesNode.fills = [{ type: 'SOLID', color: textSecColor }];
    notesNode.x = LX;
    notesNode.y = yPos;
    notesNode.textAutoResize = 'HEIGHT';
    notesNode.resize(LW, notesNode.height);
  }

  // =============================================
  // RIGHT PANEL — Color Swatches (x: 700)
  // =============================================
  var RX = 700;
  var availableWidth = 1920 - RX - 80; // 1140px
  var swatchGap = 20;
  var swatchW = Math.floor((availableWidth - 3 * swatchGap) / 4); // ~270px
  var swatchRectH = 220;
  var swatchTextH = 70;
  var rowGap = 40;

  var colorEntries = [
    { key: 'primary', label: 'Primary' },
    { key: 'secondary', label: 'Secondary' },
    { key: 'accent', label: 'Accent' },
    { key: 'background', label: 'Background' },
    { key: 'surface', label: 'Surface' },
    { key: 'text', label: 'Text' },
    { key: 'textSecondary', label: 'Text Secondary' }
  ];

  var topRowY = 100;
  var bottomRowY = topRowY + swatchRectH + swatchTextH + rowGap;

  for (var i = 0; i < colorEntries.length; i++) {
    var entry = colorEntries[i];
    var hex = colors[entry.key];
    if (!hex) continue;

    var rgb = hexToRgb(hex);
    if (!rgb) continue;

    var col, rowY;
    if (i < 4) {
      col = i;
      rowY = topRowY;
    } else {
      col = i - 4;
      rowY = bottomRowY;
    }

    var sx = RX + col * (swatchW + swatchGap);

    // Color rectangle
    var rect = figma.createRectangle();
    slide.appendChild(rect);
    rect.x = sx;
    rect.y = rowY;
    rect.resize(swatchW, swatchRectH);
    rect.cornerRadius = 8;

    // Bind to the Color Style if available, otherwise use raw fill
    var boundStyleId = colorStyleMap ? colorStyleMap[entry.key] : null;
    if (boundStyleId) {
      rect.fillStyleId = boundStyleId;
    } else {
      rect.fills = [{ type: 'SOLID', color: rgb }];
    }

    // Color label
    var labelNode = figma.createText();
    slide.appendChild(labelNode);
    labelNode.fontName = safeFont;
    labelNode.characters = entry.label;
    labelNode.fontSize = 16;
    labelNode.fills = [{ type: 'SOLID', color: textColor }];
    labelNode.x = sx;
    labelNode.y = rowY + swatchRectH + 12;

    // Hex value
    var hexNode = figma.createText();
    slide.appendChild(hexNode);
    hexNode.fontName = safeFontLight;
    hexNode.characters = hex.toUpperCase();
    hexNode.fontSize = 14;
    hexNode.fills = [{ type: 'SOLID', color: textSecColor }];
    hexNode.x = sx;
    hexNode.y = rowY + swatchRectH + 34;

    // Evocative name
    var evoName = colorNames[entry.key];
    if (evoName) {
      var evoNode = figma.createText();
      slide.appendChild(evoNode);
      evoNode.fontName = safeFontLight;
      evoNode.characters = evoName;
      evoNode.fontSize = 12;
      evoNode.fills = [{ type: 'SOLID', color: textSecColor }];
      evoNode.x = sx;
      evoNode.y = rowY + swatchRectH + 54;
    }
  }

  // Focus on the new slide
  figma.currentPage.selection = [slide];
  figma.viewport.scrollAndZoomIntoView([slide]);
  figma.notify('📊 Design System summary slide created!');
}

// Utility: convert "#RRGGBB" to figma compatible {r, g, b} normalized object
function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255.0,
    g: parseInt(result[2], 16) / 255.0,
    b: parseInt(result[3], 16) / 255.0
  } : null;
}
