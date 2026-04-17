# Sample Figma MCP Prompts

These are pre-built prompts you can use with different template types after VibeSync extracts your design system.

---

## 🎉 Invitation Card

```
Using this Figma file: <FIGMA_URL>

I want to restyle this invitation to match a nature-inspired design system.

**Colors:**
- Background → {background}
- Heading text → {text}
- Body text → {textSecondary}
- Accent border/shapes → {accent}
- Surface/card fill → {surface}

**Typography:**
- Heading font → "{headingFont}", bold
- Body font → "{bodyFont}", regular

Please:
1. Inspect the invitation layout
2. Update the background fill to {background}
3. Change all heading text to {text} using "{headingFont}"
4. Change body text to {textSecondary} using "{bodyFont}"
5. Update any decorative elements to use {accent} and {primary}
6. Maintain the overall layout and spacing
```

---

## 📱 Social Media Graphic

```
Using this Figma file: <FIGMA_URL>

Apply this design system to the social media template:

Primary: {primary}
Secondary: {secondary}
Accent: {accent}
Background: {background}
Text: {text}

Please:
1. Set the main frame background to {background}
2. Apply a gradient from {primary} to {secondary} on headline text
3. Set body text fill to {text}
4. Update accent elements (dividers, shapes, icons) to {accent}
5. Set the headline font to "{headingFont}" and body to "{bodyFont}"
```

---

## 💼 Business Card

```
Using this Figma file: <FIGMA_URL>

Restyle this business card with these design tokens:

- Card background: {surface}
- Name text: {text} in "{headingFont}"
- Role/title: {textSecondary} in "{bodyFont}"
- Accent line: {accent}
- Back of card background: {primary}
- Back of card text: {background}

Apply these changes while maintaining the existing layout structure.
```

---

## 🎨 General — Full Design System Application

```
Using this Figma file: <FIGMA_URL>

I've extracted a design system from a real-world photo. Please apply it to this file:

**Style:** {style}
**Mood:** {mood}

**Color Variables to create/update:**
| Variable | Value |
|----------|-------|
| primary | {primary} |
| secondary | {secondary} |
| accent | {accent} |
| background | {background} |
| surface | {surface} |
| text | {text} |
| textSecondary | {textSecondary} |

**Font Pairings:**
- Headings: "{headingFont}" (bold)
- Body: "{bodyFont}" (regular)

Steps:
1. Scan the file for existing variable collections
2. Create a "VibeSync" variable collection if none exists
3. Add/update the color variables listed above
4. Apply variables to all matching elements
5. Update text styles with the suggested fonts
6. Take a screenshot for me to review
```

---

## Tips

- Replace `{primary}`, `{background}`, etc. with the actual hex codes from VibeSync
- Replace `{headingFont}` and `{bodyFont}` with the actual font names
- Replace `<FIGMA_URL>` with your actual Figma file URL
- VibeSync's "Copy Figma Prompt" button does all of this automatically!
