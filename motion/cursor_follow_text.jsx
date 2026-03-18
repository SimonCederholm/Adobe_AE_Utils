/**
 * @name        Cursor Follow Text
 * @category    motion
 * @type        expression
 * @description Position-expression för ett shape-lager (fyrkantig cursor) som följer höger kant
 *              av ett textlager i real-time via sourceRectAtTime().
 * @usage       Applicera på Position-egenskapen för ett shape-lager som representerar en cursor.
 *              Byt ut lagernamnsvariabeln nedan mot namnet på ditt textlager.
 * @ae-version  2026
 */

// ── Konfiguration ─────────────────────────────────────────────
var textLayerName = "Text Layer";  // Namnet på textlagret som cursorn ska följa
// ──────────────────────────────────────────────────────────────

// Hämta referens till textlagret
var txtLayer = thisComp.layer(textLayerName);

// Hämta textlagrets bounding box i lagrets lokala koordinatsystem
var rect = txtLayer.sourceRectAtTime(time, false);

// Beräkna höger kant av texten i lagrets lokala koordinatsystem.
// rect.left + rect.width är textens högra kant relativt lagrets anchor point.
var localRight = [rect.left + rect.width, 0];

// Konvertera till comp-space via toComp().
// toComp() tar hänsyn till lagrets position, rotation, skala och anchor point.
var compRight = txtLayer.toComp(localRight);

// Hämta textlagrets Y-position i comp-space (mitten av lagret).
// Vi låser Y-axeln till denna position istället för att låta bounding box-Y
// variera vid teckenvariation, vilket ger ett stabilare cursor-beteende.
var layerCompPos = txtLayer.toComp([0, 0]);

// Returnera position: höger kant X, textlagrets Y i comp-space
[compRight[0], layerCompPos[1]];

// ── Opacity-expression (inkludera separat på cursor-lagrets Opacity) ──────────
//
// Blinkande cursor med konfigurerbar frekvens.
// Applicera nedanstående expression på Opacity-egenskapen för cursor-lagret:
//
//   var freq = 1;  // Blinkar per sekund
//   Math.round((Math.sin(time * Math.PI * freq * 2) + 1) / 2) * 100;
//
// freq = 1  → ett blink per sekund (klassiskt markörblinkande)
// freq = 2  → två blink per sekund (snabbare)
// ─────────────────────────────────────────────────────────────────────────────
