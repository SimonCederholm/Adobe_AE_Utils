/**
 * @name        Attractor Repulsor Position
 * @category    motion
 * @type        expression
 * @description Drar ett lagers position mot (eller skjuter bort från) ett null-lager när avståndet understiger ett tröskelvärde. Polariteten bestäms av null-lagrets namn.
 * @usage       Applicera på Position-egenskapen av det lager du vill påverka.
 * @ae-version  2026
 */

// ── Attractor / Repulsor · Position ──────────────────────────
//
// Syfte:
//   Drar ett lagers position mot (eller skjuter bort från) ett
//   null-lager när avståndet understiger ett tröskelvärde.
//   Polariteten bestäms automatiskt av null-lagrets namn:
//     - Namn som börjar med "Attractor" → attraherar
//     - Namn som börjar med "Repeller"  → repellerar
//
// Krav:
//   - Ett null-lager döpt till "Attractor_Null" eller "Repeller_Null"
//     (valfritt suffix efter Attractor/Repeller, t.ex. "Attractor_1")
//   - Appliceras på Position-egenskapen av det lager du vill påverka
//
// Parametrar:
//   nullName   – Namn på null-lagret
//   threshold  – Avstånd i pixlar inom vilket kraften aktiveras
//   force      – Hur många pixlar lagret förflyttas (max, vid dist=0)
//
// ─────────────────────────────────────────────────────────────

var nullName  = "Attractor_Null";
var threshold = 200;
var force     = 80;

// ─────────────────────────────────────────────────────────────

var nullLayer = null;
for (var i = 1; i <= thisComp.numLayers; i++) {
    if (thisComp.layer(i).name === nullName) {
        nullLayer = thisComp.layer(i);
        break;
    }
}

if (nullLayer === null) {
    value;
} else {
    var myPos   = value;
    var nullPos = nullLayer.toComp([0, 0, 0]);
    var dx   = nullPos[0] - myPos[0];
    var dy   = nullPos[1] - myPos[1];
    var dist = Math.sqrt(dx * dx + dy * dy);

    var polarity = (nullLayer.name.indexOf("Repeller") === 0) ? -1 : 1;

    if (dist < threshold && dist > 0) {
        var nx      = dx / dist;
        var ny      = dy / dist;
        var falloff = 1 - (dist / threshold);
        var offset  = force * falloff * polarity;
        [myPos[0] + nx * offset, myPos[1] + ny * offset];
    } else {
        value;
    }
}
