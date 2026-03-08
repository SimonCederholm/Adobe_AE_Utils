# CLAUDE.md – Instruktioner för After Effects Expression Library

Det här dokumentet styr hur Claude Code ska jobba i det här repot.

---

## Projektbeskrivning

Det här är ett bibliotek av After Effects expressions skrivna i JavaScript/ExtendScript.
Målet är att samla återanvändbara expressions organiserade per kategori.
Filerna är avsedda att kopieras och klistras in direkt i After Effects – de körs inte som externa script.

---

## Git-regler – VIKTIGT

- Jobba **alltid** direkt på `main`-branchen.
- Skapa **aldrig** egna branches, inte ens för enkla uppgifter som att skapa en README eller lägga till en fil.
- Commita direkt till `main` för alla ändringar, stora som små.
- Varje commit ska ha ett beskrivande meddelande på engelska, t.ex:
  - `Add bounce ease expression`
  - `Update README with new expressions`
  - `Fix looping wiggle duration bug`

---

## Mappstruktur

Alla expressions ska ligga i rätt kategori-mapp. Skapa mappen om den inte finns.

```
after_effects_expression/
├── CLAUDE.md
├── README.md
├── motion/
├── text/
├── color/
└── utility/
```

Lägg till nya kategori-mappar vid behov om ingen befintlig passar.

**Exempel:** En bounce-expression hör hemma i `motion/bounce_ease.jsx`, inte i roten av repot.

---

## Filnamngivning

- Använd **snake_case**: `bounce_ease.jsx`
- Filändelse ska vara `.jsx`
- Inga mellanslag i filnamn
- Namnet ska beskriva vad expressionen gör

---

## Kodformat

Varje fil ska börja med en header-kommentar:

```javascript
/**
 * @name        Bounce Ease
 * @category    motion
 * @description Lägger till en studsande ease på en egenskap.
 * @usage       Applicera på position, skala eller rotation.
 */
```

After Effects-kodregler

Referera alltid till effektparametrar med namn, inte index: effect("Fractal Noise")("Contrast") – aldrig effect("Fractal Noise")(4). Index kan förskjutas vid AE-uppdateringar eller om effekter läggs till i annan ordning.

---
## README.md

Uppdatera `README.md` varje gång en ny expression läggs till.
README ska innehålla en lista över alla expressions med korta beskrivningar, grupperade per kategori.
