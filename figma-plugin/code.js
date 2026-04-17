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
      
      const suggestedFonts = ds.typography ? ds.typography.suggestedFonts : undefined;
      if (suggestedFonts) {
        await updateTextStyles(suggestedFonts);
      }
      
      await updateSelectedShapes(ds.colors);
      
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
    } else if (name.includes('subheadline 1') || name.includes('subheadline 2')) {
      familyToLoad = fonts.heading || fonts.body;
      preferredStyles = ['Regular', 'Normal', '400', 'Medium', 'Light'];
    } else if (name.includes('body')) {
      familyToLoad = fonts.body;
      preferredStyles = ['Light', '300', 'Regular', 'Normal'];
    } else if (name.includes('caption 1') || name.includes('caption 2')) {
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

// Utility: convert "#RRGGBB" to figma compatible {r, g, b} normalized object
function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255.0,
    g: parseInt(result[2], 16) / 255.0,
    b: parseInt(result[3], 16) / 255.0
  } : null;
}
