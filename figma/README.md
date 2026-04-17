# Figma Integration Guide for VibeSync

## Overview

VibeSync generates a complete design system from a real-world photo, then helps you apply it to a Figma file using the **Figma MCP server** — specifically the `use_figma` write-to-canvas tool.

---

## Prerequisites

1. **Figma Account** with a **Full seat** (Dev seats are read-only for canvas writes)
2. **MCP Client** — one of:
   - VS Code (with GitHub Copilot or another MCP-compatible extension)
   - Cursor
   - Claude Code
   - Codex by OpenAI
   - Windsurf
3. **Figma MCP Server** connected to your client (see setup below)

---

## Step 1: Set Up Your Figma Template

Create a simple Figma Design file that will serve as your template. Good starting points:

### Option A: Invitation Card
Create a frame (e.g., 5×7 inches) with:
- A background fill
- Heading text (event title)
- Body text (details, date, location)
- Decorative accent shapes or borders
- An optional image placeholder

### Option B: Social Media Graphic
Create a 1080×1080 frame with:
- Background color
- Bold headline
- Subtitle text
- Accent shapes or dividers

### Option C: Business Card
Create a 3.5×2 inch frame with:
- Background
- Name (heading)
- Title/role (body)
- Contact info
- Accent line or shape

### Best Practices for the Template
- **Use Figma Variables** for colors (Primary, Secondary, Accent, Background, Text) — this makes it easy for the AI agent to update them
- **Name your layers clearly** — "Heading", "Body Text", "Background", "Accent Shape", etc.
- **Use Auto Layout** where possible — the agent understands and can modify auto layout

---

## Step 2: Connect the Figma MCP Server

### Remote Server (Recommended)

Add this to your MCP client's configuration:

**VS Code** (`settings.json`):
```json
{
  "mcp": {
    "servers": {
      "figma": {
        "url": "https://mcp.figma.com/mcp"
      }
    }
  }
}
```

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "figma": {
      "url": "https://mcp.figma.com/mcp"
    }
  }
}
```

**Claude Code**:
```bash
claude mcp add figma --transport sse https://mcp.figma.com/mcp
```

The first time you use it, you'll be prompted to authenticate with your Figma account through OAuth.

---

## Step 3: Use the VibeSync-Generated Prompt

1. Open VibeSync on your phone and capture a photo
2. Wait for the AI analysis to complete
3. Enter your Figma file URL in the input field
4. Click **"Copy Figma Prompt"**
5. Open your MCP client (VS Code, Cursor, etc.)
6. Paste the prompt into the AI chat/agent
7. The agent will:
   - Inspect your Figma file structure
   - Create/update color variables
   - Apply the new palette to frames, shapes, and text
   - Update typography if fonts are available

---

## Step 4: Review & Iterate

After the agent applies the design system:

1. Open your Figma file and review the changes
2. If something doesn't look right, prompt the agent:
   - *"The accent color is too bright — darken it by 20%"*
   - *"Update the heading font size to 48px"*
   - *"Add a gradient using the primary and secondary colors"*
3. Continue iterating until you're happy with the result!

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Agent can't write to file | Ensure you have a **Full seat** (not Dev) |
| Agent returns code instead of modifying Figma | Include `use_figma` in your prompt or load the `figma-use` skill |
| Font not applied | Some fonts may not be available in Figma. The agent will note this. |
| Colors look wrong | Try rephrasing: "Update the fill of the background frame to {hex}" |

---

## Tips for Best Results

- **Start simple**: A template with 5-8 elements works best
- **Name everything**: Clear layer names help the agent find and modify the right elements
- **Use variables**: If your template uses Figma color variables, the agent can update all instances by changing the variable value
- **Work incrementally**: Let the agent update colors first, then typography, then layout tweaks
