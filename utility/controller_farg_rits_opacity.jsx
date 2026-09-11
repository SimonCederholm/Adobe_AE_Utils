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
//   - Ett null-lager döpt till "controller" i Main-compen
//   - En Dropdown Menu Control på controllern döpt till "Färg/Rits"
//     med alternativen i denna ordning:
//       1 = Färg
//       2 = Rits
//   - Två lager döpta till "färg" respektive "rits"
//
// Nästlade compositions:
//   controller-nullen ligger i Main-compen medan det här lagret ligger i en
//   precomp. `thisComp` skulle då peka på precompen, inte på Main – därför
//   läses controllern via comp("Main"). Byter du namn på Main-compen måste
//   mainComp nedan uppdateras.
//
// Uttrycket multiplicerar inte bort befintlig opacitet – ett valt
// lager behåller sitt eget värde (t.ex. en inanimerad fade), ett
// bortvalt lager tvingas till 0.
//
// ─────────────────────────────────────────────────────────────

var mainComp    = "Main";        // Compen där controller-nullen ligger
var ctrlLager   = "controller";  // Null-lagret med dropdown-menyerna
var ddNamn      = "Färg/Rits";   // Effektnamn på Dropdown Menu Control
var namnFarg    = "färg";        // Lagernamn för alternativ 1
var namnRits    = "rits";        // Lagernamn för alternativ 2
var standardVal = 1;             // Fallback om controller/dropdown saknas

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

var val      = ddVarde(mainComp, ctrlLager, ddNamn, standardVal);
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
