/**
 * @name        Controller – Format Position
 * @category    utility
 * @type        expression
 * @description Sätter lagrets position i höjdled utifrån dropdown-menyerna
 *              "Format" (4x5 / 9x16 / 16x9) och "Devis" på null-lagret
 *              "controller". Sidled lämnas orörd.
 * @usage       Applicera på Position-egenskapen på det lager som ska följa
 *              formatet. Använd controller_format_scale.jsx på samma lagers
 *              Scale-egenskap.
 * @ae-version  2026
 */

// ── Controller · Format → Position ───────────────────────────
//
// Krav:
//   - Ett null-lager döpt till "controller" i Main-compen
//   - Dropdown Menu Control "Format" med alternativen:
//       1 = 4x5
//       2 = 9x16
//       3 = 16x9
//   - Dropdown Menu Control "Devis" med alternativen:
//       1 = Ingen
//       2 = A
//       3 = B
//     Allt utom "Ingen" räknas som "devis valt".
//
// Nästlade compositions:
//   controller-nullen ligger i Main-compen medan lagret som styrs ligger i en
//   precomp. `thisComp` skulle då peka på precompen, inte på Main – därför
//   läses controllern via comp("Main"). Byter du namn på Main-compen måste
//   mainComp nedan uppdateras.
//
// Värdetabell (Y-position / skala i %):
//   4x5                 y 1340   100 %
//   4x5  + devis        y 1240   107 %
//   9x16                default  default   ← lagrets egna värden
//   9x16 + devis        y 1120   107 %
//   16x9                y 1332    84 %
//   16x9 + devis        y 1340    97 %
//
// X-led påverkas inte: som standard behålls lagrets eget X-värde,
// vilket gör att keyframes/animation i sidled fungerar som vanligt.
// Sätt anvandEgenX = false för att låsa X till xFast (1280).
//
// ─────────────────────────────────────────────────────────────

var mainComp    = "Main";        // Compen där controller-nullen ligger
var ctrlLager   = "controller";  // Null-lagret med dropdown-menyerna
var ddFormat    = "Format";      // Effektnamn på format-dropdownen
var ddDevis     = "Devis";       // Effektnamn på devis-dropdownen
var anvandEgenX = true;          // true = behåll lagrets eget X
var xFast       = 1280;          // Används endast om anvandEgenX = false

// Tabell per format: [utan devis, med devis] → [yPosition, skalaProcent]
// null = använd lagrets egna värden (default)
var tabell = [
    null,                             // index 0 – oanvänt
    [[1340, 100], [1240, 107]],       // 1 = 4x5
    [null,        [1120, 107]],       // 2 = 9x16
    [[1332,  84], [1340,  97]]        // 3 = 16x9
];

// ─────────────────────────────────────────────────────────────

// Läser en dropdown säkert – saknas compen, lagret eller effekten
// används fallback
function ddVarde(compNamn, lagerNamn, effektNamn, fallback) {
    try {
        return comp(compNamn).layer(lagerNamn).effect(effektNamn)("Menu").value;
    } catch (err) {
        return fallback;
    }
}

var format = ddVarde(mainComp, ctrlLager, ddFormat, 2); // 2 = 9x16 (default)
var devis  = ddVarde(mainComp, ctrlLager, ddDevis,  1); // 1 = Ingen

var post = null;
if (format >= 1 && format < tabell.length) {
    post = tabell[format][(devis > 1) ? 1 : 0];
}

if (post === null) {
    value; // Default – lagrets egna position
} else {
    var x = anvandEgenX ? value[0] : xFast;
    var y = post[0];
    (value.length > 2) ? [x, y, value[2]] : [x, y];
}
