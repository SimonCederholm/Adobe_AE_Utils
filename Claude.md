# CLAUDE.md – Instruktioner för After Effects Utils Library

Det här dokumentet styr hur Claude Code ska jobba i det här repot.

---

## Projektbeskrivning

Det här är ett bibliotek av After Effects expressions och ScriptUI-paneler.
Målmiljö: **Adobe After Effects 2026**.
Expressions är avsedda att kopieras och klistras in direkt i After Effects.
Scripts är ScriptUI-paneler som installeras under `Scripts/ScriptUI Panels/` i AE.

---

## Git-regler – VIKTIGT

- Jobba **alltid** direkt på `main`-branchen.
- Skapa **aldrig** egna branches, inte ens för enkla uppgifter som att skapa en README eller lägga till en fil.
- Commita direkt till `main` för alla ändringar, stora som små.
- Varje commit ska ha ett beskrivande meddelande på engelska, t.ex:
  - `Add bounce ease expression`
  - `Add flicker ScriptUI panel`
  - `Update README with new expressions`
  - `Fix looping wiggle duration bug`

---

## Mappstruktur

```
Adobe_AE_Utils/
├── CLAUDE.md
├── README.md
├── motion/
├── text/
├── color/
├── utility/
└── scripts/
```

Lägg till nya kategori-mappar vid behov om ingen befintlig passar.

- `motion/` – rörelserelaterade expressions som bounce, wiggle, swing
- `text/` – textrelaterade expressions
- `color/` – färgrelaterade expressions
- `utility/` – hjälpexpressions som clamp, delay, freeze
- `scripts/` – ScriptUI-paneler (.jsx) som installeras i AE

**Exempel:** En bounce-expression hör hemma i `motion/bounce_ease.jsx`, en ScriptUI-panel i `scripts/flicker_gate.jsx`.

---

## Filnamngivning

- Använd **snake_case**: `bounce_ease.jsx`
- Filändelse ska vara `.jsx`
- Inga mellanslag i filnamn
- Namnet ska beskriva vad filen gör

---

## Kodformat

Varje fil ska börja med en header-kommentar:

```javascript
/**
 * @name        Bounce Ease
 * @category    motion
 * @type        expression
 * @description Lägger till en studsande ease på en egenskap.
 * @usage       Applicera på position, skala eller rotation.
 * @ae-version  2026
 */
```

För ScriptUI-paneler, använd `@type script` istället för `expression`.

---

## After Effects-kodregler

**I expressions** (klistras in direkt i AE):
- Referera alltid till effektparametrar med **namn**, inte index: `effect("Fractal Noise")("Contrast")` – aldrig `effect("Fractal Noise")(4)`. Index kan förskjutas om effekter läggs till eller AE uppdateras.
- Använd JavaScript expression engine (standard i AE 2026), inte Legacy ExtendScript engine.

**I ScriptUI-scripts** (ExtendScript .jsx-filer):
- Använd **match names** för att referera till effekter och parametrar, t.ex. `layer.property("ADBE Effect Parade").property("ADBE Gaussian Blur")`. Match names är språkoberoende och fungerar oavsett vilket språk AE är inställt på.
- Använd aldrig numeriska index för att referera till effektparametrar.

---

## README.md

Uppdatera `README.md` varje gång en ny fil läggs till.
README ska innehålla en lista över alla expressions och scripts med korta beskrivningar, grupperade per kategori.
