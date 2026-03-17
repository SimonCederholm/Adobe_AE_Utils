# Adobe After Effects Utils Library

A collection of After Effects expressions and ScriptUI panels for **Adobe After Effects 2026**.

- **Expressions** are designed to be copied and pasted directly into After Effects.
- **Scripts** are ScriptUI panels installed under `Scripts/ScriptUI Panels/` in AE.

---

## Categories

### Motion (`motion/`)

> Expressions related to movement – bounce, wiggle, swing, etc.

| File | Description |
|------|-------------|
| `spike_ease_2d.jsx` | Sharp tanh-based ease for 2D position. Simulates a quick spike movement with controllable sharpness, start time, duration, and distance. Apply to a layer's Position property. |
| `attractor_repulsor_position.jsx` | Attracts or repels a layer's position toward/away from a null layer within a distance threshold. Polarity is determined by the null layer's name (prefix `Attractor` or `Repeller`). Apply to a layer's Position property. |

---

### Text (`text/`)

> Expressions and scripts for text animation and manipulation.

| File | Description |
|------|-------------|
| `font_swapper.jsx` | ScriptUI panel that scans the active comp or all comps for used fonts, lets you pick a replacement font from installed fonts or type a PostScript name manually, then swaps all occurrences. Install under `Scripts/ScriptUI Panels/`. |

---

### Color (`color/`)

> Expressions for color manipulation and effects.

| File | Description |
|------|-------------|
| `contrast_colorcheck.jsx` | Samples a background layer ("Bakgrund") at the current layer's center, calculates relative luminance (ITU-R BT.709), and returns black or white for maximum readability. Apply to a Fill effect's Color property or a text layer's color. |
| `contrast_colorcheck_fx.jsx` | Variant of contrast_colorcheck that reads color directly from the "Background color splash" effect on a layer named "Color controller splash" instead of sampling a layer. Calculates relative luminance (ITU-R BT.709) and returns black or white for maximum readability. Apply to a Fill effect's Color property or a text layer's color. |

---

### Utility (`utility/`)

> Helper expressions – clamp, delay, freeze, etc.

*No expressions yet.*

---

### Scripts (`scripts/`)

> ScriptUI panels (`.jsx`) installed in After Effects.

| File | Description |
|------|-------------|
| `film_damage_suite.jsx` | ScriptUI panel that creates a full film damage simulation stack in the active composition. Adds nine individually togglable layers: Gate Weave, Grain, Scratches, Blobs, Damage, Dust, Flicker, Color Correction, and Light Leaks – each built from native AE effects and expressions. Install under `Scripts/ScriptUI Panels/` and open via the Window menu. |
| `expression_cleanup.jsx` | Script that cleans up expressions referencing control layers via `thisComp`. Replaces `thisComp` with `comp("BRAND_CTRL")` in any expression that references "Text adjustments", "Color picker Splash", "Animation controller", or "Color picker". Also renames "Text adjustments" → "Text Controller" and "Color picker" → "Color controller" (incl. "Color picker Splash"). Run via File > Scripts > Run Script File in AE. |
| `chart_diagram_generator.jsx` | ScriptUI panel that generates animated line chart compositions from a JSON data file. Automatically detects JSON footage in the project, parses multiple series, and builds a 1440×1440 comp with animated trim-path lines (ease-ease), a "Color Controller" null for per-series color control, a running value label that tracks the animated line end, hidden data-point labels (enable manually), and x-axis year labels. Install under `Scripts/ScriptUI Panels/`. |

---

## Usage

Copy the desired expression file's content and paste it into the expression field of the target property in After Effects. Scripts are installed by placing the `.jsx` file in the `Scripts/ScriptUI Panels/` folder and restarting AE.
