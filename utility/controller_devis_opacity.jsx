/**
 * @name        Controller – Devis Opacity
 * @category    utility
 * @type        expression
 * @description Togglar synligheten mellan tre lägen via en Dropdown Menu Control
 *              på null-lagret "controller": Ingen (inget devis synligt),
 *              A (endast lager "A") eller B (endast lager "B").
 * @usage       Applicera på Opacity-egenskapen på BÅDA devis-lagren ("A" och "B").
 *              Exakt samma uttryck används på båda – vilket lager som visas
 *              avgörs av lagrets eget namn.
 * @ae-version  2026
 */

// ── Controller · Devis ───────────────────────────────────────
//
// Krav:
//   - Ett null-lager döpt till "controller"
//   - En Dropdown Menu Control på controllern döpt till "Devis"
//     med alternativen i denna ordning:
//       1 = Ingen
//       2 = A
//       3 = B
//   - Två lager döpta till "A" respektive "B"
//
// Ett valt lager behåller sin egen opacitet (så in-/utfades fungerar
// fortfarande), ett bortvalt lager tvingas till 0.
//
// ─────────────────────────────────────────────────────────────

var ctrlLager   = "controller";  // Null-lagret med dropdown-menyerna
var ddNamn      = "Devis";       // Effektnamn på Dropdown Menu Control
var namnA       = "A";           // Lagernamn för alternativ 2
var namnB       = "B";           // Lagernamn för alternativ 3
var standardVal = 1;             // Fallback om controller/dropdown saknas

// ─────────────────────────────────────────────────────────────

// Läser en dropdown säkert – saknas lagret eller effekten används fallback
function ddVarde(lagerNamn, effektNamn, fallback) {
    try {
        return thisComp.layer(lagerNamn).effect(effektNamn)("Menu").value;
    } catch (err) {
        return fallback;
    }
}

var val      = ddVarde(ctrlLager, ddNamn, standardVal);
var mittNamn = thisLayer.name.toLowerCase();

var synlig;
if (mittNamn === namnA.toLowerCase()) {
    synlig = (val === 2);
} else if (mittNamn === namnB.toLowerCase()) {
    synlig = (val === 3);
} else {
    synlig = true; // Okänt lagernamn – lämna opaciteten orörd
}

synlig ? value : 0;
