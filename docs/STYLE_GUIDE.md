# Style Guide

This document defines the visual design system for Atelier, including color palette, typography, spacing, components, and design principles.

## Design Philosophy

### The Aesthetic: "The Director's Desk"

Atelier's visual identity evokes a thoughtful filmmaker's workspace — the kind of place where creativity meets craft. It draws inspiration from:

- **Old bookstores** — warm, intelligent, full of possibility
- **Wes Anderson production design** — meticulous, colorful but controlled, intentionally composed
- **A24 packaging** — elevated, tactile, respects the audience
- **Field Notes / Moleskine** — functional beauty, tools for creative professionals
- **Editorial design** — typography-forward, generous whitespace, confident simplicity

### Core Principles

**1. Typography Does the Heavy Lifting**
Let words and letterforms create visual interest. The typewriter headers, the readable serif body, the occasional handwritten annotation — these establish personality without decoration.

**2. Warm Foundation, Purposeful Color**
The cream parchment background creates warmth. Colors are used intentionally: warm tones for creative/generative features, cool tones for organizational/structural elements.

**3. Generous Space to Breathe**
Especially on landing pages and dashboards, content should feel curated, not crammed. Functional views can be denser, but never cluttered.

**4. Subtle Texture, Not Distraction**
Paper-like surfaces on cards, soft shadows suggesting layered pages — texture should feel tactile without calling attention to itself. No complex background textures.

**5. Function Over Flourish**
Every design choice should enhance usability. The aesthetic supports the work; it never competes with it.

### Personality Keywords

- Intelligent
- Warm
- Confident
- Classic
- Analog-inspired
- Creatively empowering

---

## Color System

### Foundation Palette

The foundation colors create the canvas on which everything else lives.

| Token | Name | Hex | RGB | Usage |
|-------|------|-----|-----|-------|
| `--color-bg-primary` | Parchment | `#F5F1E8` | `245, 241, 232` | Primary background |
| `--color-bg-secondary` | Warm White | `#FAF8F4` | `250, 248, 244` | Cards, elevated surfaces |
| `--color-bg-tertiary` | Cream | `#EDE8DC` | `237, 232, 220` | Subtle differentiation, hover states |
| `--color-text-primary` | Ink | `#1A1A1A` | `26, 26, 26` | Body text, primary content |
| `--color-text-secondary` | Graphite | `#4A4A4A` | `74, 74, 74` | Secondary text, descriptions |
| `--color-text-tertiary` | Pencil | `#7A7A7A` | `122, 122, 122` | Captions, placeholders, metadata |
| `--color-border-default` | Stone | `#D4CFC4` | `212, 207, 196` | Default borders |
| `--color-border-subtle` | Mist | `#E5E1D8` | `229, 225, 216` | Subtle dividers |

### Warm Creative Palette

Used for generative and creative features: image generation, concept art, component library, AI interactions.

| Token | Name | Hex | RGB | Usage |
|-------|------|-----|-----|-------|
| `--color-warm-primary` | Persimmon | `#C85A38` | `200, 90, 56` | Primary actions, generate buttons, creative highlights |
| `--color-warm-secondary` | Dusty Rose | `#C4918A` | `196, 145, 138` | Secondary warm accent, hover states, tags |
| `--color-warm-primary-hover` | Persimmon Dark | `#A84828` | `168, 72, 40` | Hover state for primary |
| `--color-warm-primary-light` | Persimmon Light | `#F5E0D8` | `245, 224, 216` | Backgrounds, subtle highlights |

### Cool Organizational Palette

Used for structural and navigational features: storyboard hierarchy, acts, scenes, shots.

| Token | Name | Hex | RGB | Usage |
|-------|------|-----|-----|-------|
| `--color-cool-act` | Sea Green | `#5B8F8C` | `91, 143, 140` | Acts, top-level navigation |
| `--color-cool-scene` | Steel Blue | `#5A7A99` | `90, 122, 153` | Scenes, mid-level navigation |
| `--color-cool-shot` | Forest | `#4A6D5C` | `74, 109, 92` | Shots, item-level elements |
| `--color-cool-act-light` | Sea Green Light | `#D8E8E7` | `216, 232, 231` | Act backgrounds |
| `--color-cool-scene-light` | Steel Blue Light | `#DCE4EC` | `220, 228, 236` | Scene backgrounds |
| `--color-cool-shot-light` | Forest Light | `#D8E4DC` | `216, 228, 220` | Shot backgrounds |

### System Palette

Used for feedback, states, and system messages.

| Token | Name | Hex | RGB | Usage |
|-------|------|-----|-----|-------|
| `--color-success` | Forest | `#4A6D5C` | `74, 109, 92` | Success states, saved, complete |
| `--color-warning` | Goldenrod | `#C9933E` | `201, 147, 62` | Warning states, caution |
| `--color-error` | Brick | `#B54A4A` | `181, 74, 74` | Error states, destructive actions |
| `--color-info` | Steel Blue | `#5A7A99` | `90, 122, 153` | Informational messages |
| `--color-success-light` | Forest Light | `#D8E4DC` | `216, 228, 220` | Success backgrounds |
| `--color-warning-light` | Goldenrod Light | `#F5ECD8` | `245, 236, 216` | Warning backgrounds |
| `--color-error-light` | Brick Light | `#F5DCDC` | `245, 220, 220` | Error backgrounds |
| `--color-info-light` | Steel Blue Light | `#DCE4EC` | `220, 228, 236` | Info backgrounds |

### Color Usage Guidelines

**Do:**
- Use Persimmon for primary creative actions (Generate, Create, Add Component)
- Use the organizational colors consistently for their hierarchy level
- Use black (`--color-text-primary`) for all body text
- Use lighter variants for backgrounds and subtle highlights

**Don't:**
- Use warm colors for navigation or structural elements
- Use cool colors for generation or creative actions
- Use colors at full saturation for large areas
- Mix organizational colors outside their hierarchy meaning

---

## Typography

### Font Families

```css
:root {
  /* Primary serif for body text */
  --font-body: 'Charter', 'Georgia', 'Times New Roman', serif;
  
  /* Typewriter for display and technical elements */
  --font-display: 'Courier Prime', 'Courier New', monospace;
  
  /* Handwritten for annotations only */
  --font-annotation: 'Caveat', cursive;
}
```

**Charter** — The primary typeface. Clean, readable, warm without being soft. Used for all body text, descriptions, and most UI copy. Apple and many systems include Charter natively; it reads beautifully and has that editorial quality without being stuffy.

**Courier Prime** — Designed specifically for screenwriters. More refined than standard Courier, it brings authenticity to the filmmaking context. Used for headers, labels, and technical information. Free from Google Fonts.

**Caveat** — A casual handwritten font used very sparingly, **only for miscellaneous annotations on storyboard frames**. Not used for project titles, notes, empty states, or any other UI element.

For cross-platform consistency, consider using `Libre Baskerville` from Google Fonts as a web-safe alternative if Charter is unavailable.

### Type Scale

| Level | Size | Weight | Font | Line Height | Case |
|-------|------|--------|------|-------------|------|
| **H1** | 32px | 400 | Courier Prime | 1.2 | UPPERCASE |
| **H2** | 24px | 400 | Courier Prime | 1.3 | UPPERCASE |
| **H3** | 18px | 700 | Charter | 1.4 | Normal |
| **H4** | 16px | 700 | Charter | 1.4 | Normal |
| **Body** | 16px | 400 | Charter | 1.6 | Normal |
| **Body Small** | 14px | 400 | Charter | 1.5 | Normal |
| **Caption** | 12px | 400 | Charter | 1.4 | Normal |
| **Label** | 12px | 400 | Courier Prime | 1.2 | UPPERCASE |
| **Annotation** | 16px | 400 | Caveat | 1.3 | Normal |

### Typography Usage

**Headers** use Courier Prime in uppercase — evoking that mechanical typewriter voice:
```
SHOT 14 — MEDIUM CLOSE-UP
```

**Body text** uses Charter in black for maximum readability:
```
Sarah enters the room, hesitant. The folder is visible on the desk.
```

**Technical labels** use Courier Prime in uppercase at small sizes:
```
EYE LEVEL • STATIC • INT. OFFICE
```

**Annotations** (rare) use Caveat for a hand-drawn quality on storyboard frames only.

---

## Spacing

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Tight spacing, inline elements |
| `--space-2` | 8px | Related elements, icon gaps |
| `--space-3` | 12px | Form field padding |
| `--space-4` | 16px | Default padding, card padding |
| `--space-5` | 20px | Section gaps |
| `--space-6` | 24px | Component separation |
| `--space-8` | 32px | Major section breaks |
| `--space-10` | 40px | Large gaps |
| `--space-12` | 48px | Page section separation |
| `--space-16` | 64px | Major page sections |
| `--space-20` | 80px | Landing page sections |

### Spacing Guidelines

**Landing Pages & Dashboards:**
Use generous spacing (`--space-12` through `--space-20`) between sections. Content should feel curated and breathable.

**Functional Views (Storyboard, Shot Editor):**
Tighter spacing is acceptable (`--space-4` through `--space-8`) to maximize usable space. Functionality takes priority, but never feel cramped.

**Cards & Components:**
Consistent internal padding (`--space-4` or `--space-6`) with clear visual boundaries.

---

## Shadows & Elevation

### Shadow Scale

Soft shadows suggest layered paper rather than floating UI elements.

```css
:root {
  /* Subtle lift - cards, buttons */
  --shadow-sm: 0 1px 2px rgba(26, 26, 26, 0.04),
               0 1px 4px rgba(26, 26, 26, 0.06);
  
  /* Default elevation - dropdowns, popovers */
  --shadow-md: 0 2px 4px rgba(26, 26, 26, 0.04),
               0 4px 12px rgba(26, 26, 26, 0.08);
  
  /* High elevation - modals, dialogs */
  --shadow-lg: 0 4px 8px rgba(26, 26, 26, 0.04),
               0 8px 24px rgba(26, 26, 26, 0.10);
  
  /* Focus ring */
  --shadow-focus: 0 0 0 2px var(--color-bg-primary),
                  0 0 0 4px var(--color-warm-primary);
}
```

### Elevation Levels

| Level | Shadow | Usage |
|-------|--------|-------|
| 0 | None | Inline elements, flat surfaces |
| 1 | `--shadow-sm` | Cards, buttons, input fields |
| 2 | `--shadow-md` | Dropdowns, popovers, tooltips |
| 3 | `--shadow-lg` | Modals, dialogs, overlays |

---

## Border Radius

### Radius Scale

Subtle rounding that feels tactile without being bubbly.

```css
:root {
  --radius-sm: 4px;      /* Buttons, inputs, tags */
  --radius-md: 6px;      /* Cards, panels */
  --radius-lg: 8px;      /* Modals, large containers */
  --radius-full: 9999px; /* Pills, avatars */
}
```

---

## Components

### Buttons

**Primary Button (Creative Actions)**

```css
.btn-primary {
  background-color: var(--color-warm-primary);
  color: white;
  font-family: var(--font-display);
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
}

.btn-primary:hover {
  background-color: var(--color-warm-primary-hover);
}
```

**Secondary Button**

```css
.btn-secondary {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border-default);
  font-family: var(--font-display);
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-sm);
}

.btn-secondary:hover {
  background-color: var(--color-bg-tertiary);
}
```

**Ghost Button**

```css
.btn-ghost {
  background-color: transparent;
  color: var(--color-text-secondary);
  font-family: var(--font-display);
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-sm);
}

.btn-ghost:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}
```

### Cards

**Standard Card**

```css
.card {
  background-color: var(--color-bg-secondary);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}
```

**Interactive Card**

```css
.card-interactive {
  /* Inherits from .card */
  cursor: pointer;
  transition: box-shadow 0.15s ease, border-color 0.15s ease;
}

.card-interactive:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--color-border-default);
}
```

---

## Tailwind Configuration

```javascript
// tailwind.config.js

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment: '#F5F1E8',
        'warm-white': '#FAF8F4',
        cream: '#EDE8DC',
        ink: '#1A1A1A',
        graphite: '#4A4A4A',
        pencil: '#7A7A7A',
        stone: '#D4CFC4',
        mist: '#E5E1D8',
        persimmon: {
          DEFAULT: '#C85A38',
          dark: '#A84828',
          light: '#F5E0D8',
        },
        'dusty-rose': '#C4918A',
        'sea-green': {
          DEFAULT: '#5B8F8C',
          light: '#D8E8E7',
        },
        'steel-blue': {
          DEFAULT: '#5A7A99',
          light: '#DCE4EC',
        },
        forest: {
          DEFAULT: '#4A6D5C',
          light: '#D8E4DC',
        },
        goldenrod: {
          DEFAULT: '#C9933E',
          light: '#F5ECD8',
        },
        brick: {
          DEFAULT: '#B54A4A',
          light: '#F5DCDC',
        },
      },
      fontFamily: {
        body: ['Charter', 'Georgia', 'Times New Roman', 'serif'],
        display: ['Courier Prime', 'Courier New', 'monospace'],
        annotation: ['Caveat', 'cursive'],
      },
      boxShadow: {
        sm: '0 1px 2px rgba(26, 26, 26, 0.04), 0 1px 4px rgba(26, 26, 26, 0.06)',
        md: '0 2px 4px rgba(26, 26, 26, 0.04), 0 4px 12px rgba(26, 26, 26, 0.08)',
        lg: '0 4px 8px rgba(26, 26, 26, 0.04), 0 8px 24px rgba(26, 26, 26, 0.10)',
      },
    },
  },
};
```

### Font Loading

Include fonts via Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Caveat&family=Courier+Prime:wght@400;700&display=swap" rel="stylesheet">
```

---

## Dark Mode (Deferred)

Dark mode is planned for future implementation. When implemented, it should:

- Preserve the same "Director's Desk" aesthetic character
- Use dark charcoal backgrounds (not pure black)
- Maintain the warm/cool color distinction
- Keep accent colors recognizable but adjusted for dark backgrounds
- Ensure equivalent contrast ratios
- Handle canvas background for annotation visibility

Placeholder token structure for dark mode:

```css
[data-theme="dark"] {
  --color-bg-primary: #1E1E1C;
  --color-bg-secondary: #2A2A28;
  --color-bg-tertiary: #363632;
  --color-text-primary: #F5F1E8;
  --color-text-secondary: #B8B4AA;
  --color-text-tertiary: #8A8680;
}
```
