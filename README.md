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

---

### Text (`text/`)

> Expressions for text animation and manipulation.

*No expressions yet.*

---

### Color (`color/`)

> Expressions for color manipulation and effects.

*No expressions yet.*

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

---

## Usage

Copy the desired expression file's content and paste it into the expression field of the target property in After Effects. Scripts are installed by placing the `.jsx` file in the `Scripts/ScriptUI Panels/` folder and restarting AE.
