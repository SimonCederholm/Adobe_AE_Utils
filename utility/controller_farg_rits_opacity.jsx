/**
 * @name        Controller – Färg/Rits Opacity
 * @category    utility
 * @type        expression
 * @description Togglar synligheten mellan två lager ("färg" och "rits") via en
 *              Dropdown Menu Control på null-lagret "controller". Väljs det ena
 *              lagret blir det andra osynligt, och vice versa.
 * @usage       Applicera på Opacity-egenskapen på BÅDA lagren. Exakt samma
 *              uttryck används på båda – vilket lager som visas avgörs av
 *              lagrets eget namn.
 * @ae-version  2026
 */

// ── Controller · Färg/Rits ───────────────────────────────────
//
// Krav:
//   - Ett null-lager döpt till "controller"
//   - En Dropdown Menu Control på controllern döpt till "Färg/Rits"
//     med alternativen i denna ordning:
//       1 = Färg
//       2 = Rits
//   - Två lager döpta till "färg" respektive "rits"
//
// Uttrycket multiplicerar inte bort befintlig opacitet – ett valt
// lager behåller sitt eget värde (t.ex. en inanimerad fade), ett
// bortvalt lager tvingas till 0.
//
// ─────────────────────────────────────────────────────────────

var ctrlLager   = "controller";  // Null-lagret med dropdown-menyerna
var ddNamn      = "Färg/Rits";   // Effektnamn på Dropdown Menu Control
var namnFarg    = "färg";        // Lagernamn för alternativ 1
var namnRits    = "rits";        // Lagernamn för alternativ 2
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
if (mittNamn === namnFarg.toLowerCase()) {
    synlig = (val === 1);
} else if (mittNamn === namnRits.toLowerCase()) {
    synlig = (val === 2);
} else {
    synlig = true; // Okänt lagernamn – lämna opaciteten orörd
}

synlig ? value : 0;
