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
| `cursor_follow_text.jsx` | Follows the right edge of a named text layer in real-time using `sourceRectAtTime()` and `toComp()`. Apply to the Position property of a shape layer (cursor). Includes a separate Opacity expression (as a comment) for blinking at a configurable frequency. |

---

### Text (`text/`)

> Expressions and scripts for text animation and manipulation.

| File | Description |
|------|-------------|
| `font_swapper.jsx` | ScriptUI panel that scans the active comp or all comps for used fonts, lets you pick a replacement font from installed fonts or type a PostScript name manually, then swaps all occurrences. Install under `Scripts/ScriptUI Panels/`. |
| `typewriter_irregular.jsx` | Source Text expression that types out a string with irregular speed, simulating a real person typing. Configurable base delay and variation per character, reproducible randomness via `seedRandom`, and natural pauses after spaces and punctuation. Apply to a text layer's Source Text property. |

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
| `ae_utils_panel.jsx` | ScriptUI panel with three common utilities. **Anchor Point**: pins the anchor of selected layers to any of five positions (TL, TR, Center, BL, BR) via expression, with automatic position compensation so the layer doesn't jump. **Self-Adjusting Textbox**: creates a shape layer below a selected text layer whose rectangle automatically adapts to the text's bounding box via `sourceRectAtTime`. Separate horizontal and vertical padding (default H: 20 px, V: 10 px). Both layers get centered anchor points and the text is center-aligned. **Delay**: applies a delay expression to selected properties, referencing the corresponding transform property on the layer above with a configurable frame offset. Install under `Scripts/ScriptUI Panels/`. |
| `motion_swing_panel.jsx` | ScriptUI panel with six motion expression presets, all applied to the selected property in the timeline. **Swing**: damped pendulum oscillation that eases to a stop, starts at layer inPoint, axis-selectable for 2D/3D. **Sine/Cosine**: continuous oscillation in four modes — Sine 1D, Cosine 1D, Circle 2D (circular orbit), Figure-8 2D (Lissajous). **Inertia Bounce**: elastic overshoot after each keyframe based on incoming velocity; configurable amplitude, frequency, decay and oscillation window. **Bounceback**: full physics gravity simulation after the last keyframe; configurable elasticity, gravity strength and max bounces. **Wobble**: two overlapping sines at an irrational frequency ratio (default: golden ratio) for organic, non-repeating motion. **Pulse**: rhythmic beat expression synced to BPM, with configurable amplitude and sharpness (smooth cosine → sharp spike). All expressions are dimension-aware (1D / 2D / 3D) and additive. Install under `Scripts/ScriptUI Panels/`. |
| `green_screen_keyer.jsx` | ScriptUI panel for professional green screen keying using only built-in AE effects. One button applies the industry-standard **Keylight 1.2 + Key Cleaner + Advanced Spill Suppressor** stack to selected layers (skips effects already present). Exposes the most important parameters directly in the panel: Screen Gain, Screen Balance, Clip Black/White (Screen Matte), a View dropdown for quick matte inspection (Composite Source / Status / Screen Matte), a Toggle Status/Composite button, Key Cleaner Edge Radius and Reduce Chatter, and Advanced Spill Suppressor Suppression. Screen Colour is set via Keylight's own eyedropper in Effect Controls as normal. Install under `Scripts/ScriptUI Panels/`. |
---

## Usage

Copy the desired expression file's content and paste it into the expression field of the target property in After Effects. Scripts are installed by placing the `.jsx` file in the `Scripts/ScriptUI Panels/` folder and restarting AE.
