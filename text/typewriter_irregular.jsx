/**
 * @name        Typewriter Irregular
 * @category    text
 * @type        expression
 * @description Skriver fram en textsträng med oregelbunden hastighet, som en person som skriver på riktigt.
 * @usage       Applicera på Source Text-egenskapen på ett textlager.
 * @ae-version  2026
 */

// ── Konfiguration ─────────────────────────────────────────────
var fullText     = "Hej! Det här är ett exempel på oregelbunden skrivmaskintext.";
var baseDelay    = 0.08;  // Grundtid i sekunder per tecken
var variation    = 0.06;  // Max slumpmässig variation i sekunder per tecken

// Extratid som läggs till efter dessa tecken (i sekunder)
var pauseSpace   = 0.12;  // Paus efter mellanslag
var pausePunct   = 0.30;  // Paus efter punkt, komma, utropstecken, frågetecken
// ──────────────────────────────────────────────────────────────

// Bygg en array med kumulativa tidsstämplar för varje tecken.
// seedRandom(i * 137, true) ger reproducerbar slump per tecken –
// samma resultat varje gång expressionevärderas, oavsett RAM-förhandsvisning.
var timestamps = [];
var t = 0;
for (var i = 0; i < fullText.length; i++) {
    timestamps[i] = t;

    // Slumpa fördröjning för nästa tecken
    seedRandom(i * 137, true);
    var delay = baseDelay + random(0, variation);

    // Naturliga pauser baserat på tecknet som precis skrevs
    var ch = fullText.charAt(i);
    if (ch === " ") {
        delay += pauseSpace;
    } else if (ch === "." || ch === "," || ch === "!" || ch === "?") {
        delay += pausePunct;
    }

    t += delay;
}

// Beräkna hur lång tid som förflutit sedan lagrets inPoint
var elapsed = time - inPoint;

// Räkna hur många tecken som ska visas vid aktuell tid
var visibleChars = 0;
for (var j = 0; j < timestamps.length; j++) {
    if (timestamps[j] <= elapsed) {
        visibleChars = j + 1;
    }
}

// Returnera synlig delsträng (eller tom sträng innan animationen börjar)
fullText.substring(0, visibleChars);
