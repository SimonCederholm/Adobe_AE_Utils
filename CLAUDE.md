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
- Använd aldrig display names som enda åtkomstmetod – de är språkberoende och misslyckas på icke-engelska AE-installationer.

**Nästlade effektstrukturer – VIKTIGT:**

Vissa AE-effekter har **nästlade property-grupper** där parametrarna inte sitter direkt under effekten utan i sub-grupper. Den generiska `sp()`-funktionen (som söker display names) är **inte tillförlitlig** för sådana effekter och kan sätta fel parameter eller inte sätta något alls.

- **`ADBE Levels2`** (Levels / Individual Controls) – parametrarna sitter i per-kanal sub-grupper (Master, Red, Green, Blue, Alpha). `sp(fx, "Output Black", val)` hittar inte parametern på toppnivån.
- **`ADBE Fractal Noise`** – Transform-parametrar sitter i en `Transform`-sub-grupp, Evolution Options i en separat grupp.

**Regel:** När en effekt har känd komplex struktur, skriv en **dedikerad setter-funktion** (som `setLevels()` och `fnSp()` i film_damage_suite.jsx) som explicit provar:
1. Match names direkt på effekten – **endast om de är verifierade i AE SDK eller testad i AE**. Använd aldrig gissade match names; om de råkar träffa fel property kan värdet bli extremt felaktigt (t.ex. 2500 → 81 920 000 om en intern float-property träffas).
2. Display names direkt på effekten (engelska fallback)
3. Display names i varje sub-grupp (fallback för nästlad struktur)

Använd aldrig den generiska `sp()` för Levels eller andra effekter med känd nästlad struktur.

**Match names för Levels Output-parametrar är ej verifierade** – `setLevels()` i film_damage_suite.jsx använder därför enbart display names och sub-grupp-sökning.

**setValue()-enheter för Levels – VIKTIGT:** AE:s Levels-properties lagrar värden normaliserat (0.0–1.0) internt. UI:t visar värdena skalade till projektets bitdjup (×32 768 för 16 bpc). Att skicka in ett råvärde som 2500 (16-bit-enhet) utan normalisering resulterar i 2500 × 32 768 = 81 920 000 i UI:t. Normalisera alltid: `setValue(value16bit / 32768)`.

---

## Säkerhetsgranskning – VIKTIGT

Granska **all kod** innan commit. Kontrollera följande punkter:

### Expressions (.jsx – klistras in i AE)
- Inga hårdkodade sökvägar eller filsystemsreferenser (`File`, `Folder`, `system`).
- Inga nätverksanrop eller externa beroenden.
- Inga `eval()`-anrop eller dynamisk kodkörning.
- Inga oändliga loopar utan tydligt avslutvillkor.

### ScriptUI-scripts (.jsx – körs i ExtendScript)
- Inga `system.callSystem()`, `app.system` eller shell-anrop.
- Filläsning/skrivning (`File`, `Folder`) är tillåten för scripts men ska vara explicit och avsiktlig – inga sökvägar hårdkodade till systemkataloger som `/etc/`, `C:\Windows\` etc.
- Inga nätverksanrop (`Socket`, XMLHttpRequest eller liknande).
- Inga `eval()`-anrop på extern eller användarinmatad data.
- Indata från UI-fält ska valideras innan användning (t.ex. kontrollera att numeriska fält faktiskt innehåller tal).

### Allmänt
- Inga känsliga uppgifter (lösenord, API-nycklar, tokens) i koden.
- Inga kommenterade-bort kodblock som innehåller säkerhetsproblem.
- Tydliga felhanteringsblock – `try/catch` i ScriptUI-scripts där fel kan uppstå.

**Om ett problem hittas:** åtgärda det innan commit. Skapa aldrig en commit med känd säkerhetsbrist.

---

## README.md

Uppdatera `README.md` varje gång en ny fil läggs till.
README ska innehålla en lista över alla expressions och scripts med korta beskrivningar, grupperade per kategori.
