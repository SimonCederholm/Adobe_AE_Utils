/**
 * @name        Controller – Devis Opacity
 * @category    utility
 * @type        expression
 * @description Togglar synligheten mellan tre lägen via en Dropdown Menu Control
 *              på null-lagret "controller" i Main-compen: Ingen (inget devis
 *              synligt), A (endast "Devis A") eller B (endast "Devis B").
 * @usage       Applicera på Opacity-egenskapen på BÅDA devis-lagren inuti
 *              precompen "Devis". Exakt samma uttryck används på båda – vilket
 *              lager som visas avgörs av lagrets eget namn.
 * @ae-version  2026
 */

// ── Controller · Devis ───────────────────────────────────────
//
// Krav:
//   - Ett null-lager döpt till "controller" i Main-compen
//   - En Dropdown Menu Control på controllern döpt till "Devis"
//     med alternativen i denna ordning:
//       1 = Ingen
//       2 = A
//       3 = B
//   - Lagren "Devis A" och "Devis B" inuti precompen "Devis"
//
// Nästlade compositions:
//   controller-nullen ligger i Main-compen medan det här lagret ligger i
//   precompen "Devis". `thisComp` skulle då peka på "Devis", inte på Main –
//   därför läses controllern via comp("Main"). Byter du namn på Main-compen
//   måste mainComp nedan uppdateras.
//
// Ett valt lager behåller sin egen opacitet (så in-/utfades fungerar
// fortfarande), ett bortvalt lager tvingas till 0.
//
// ─────────────────────────────────────────────────────────────

var mainComp    = "Main";        // Compen där controller-nullen ligger
var ctrlLager   = "controller";  // Null-lagret med dropdown-menyerna
var ddNamn      = "Devis";       // Effektnamn på Dropdown Menu Control
var namnA       = "Devis A";     // Lagernamn för alternativ 2
var namnB       = "Devis B";     // Lagernamn för alternativ 3
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
if (mittNamn === namnA.toLowerCase()) {
    synlig = (val === 2);
} else if (mittNamn === namnB.toLowerCase()) {
    synlig = (val === 3);
} else {
    synlig = true; // Okänt lagernamn – lämna opaciteten orörd
}

synlig ? value : 0;
