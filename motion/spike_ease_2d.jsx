/**
 * @name        Custom 2D Spike Ease
 * @category    motion
 * @type        expression
 * @description En skarp, tanh-baserad ease för 2D position. Simulerar en snabb spik-rörelse med kontrollerbar skärpa, starttid, längd och avstånd.
 * @usage       Applicera på Position-egenskapen av ett lager.
 * @ae-version  2026
 */

// ── Custom Spike Ease · 2D ────────────────────────────────────
var startTime  = 1;
var durationF  = 12;
var distanceX = 100;
var distanceY = 0;
var from       = [value[0], value[1]];
var to         = [value[0]+distanceX, value[1]+distanceY];
var sharpness  = 6;
// ─────────────────────────────────────────────────────────────

var endTime = startTime + durationF * thisComp.frameDuration;
var t = clamp((time - startTime) / (endTime - startTime), 0, 1);
var h = Math.tanh(sharpness * 0.5);
var e = (Math.tanh(sharpness * (t - 0.5)) + h) / (2 * h);

[linear(e, 0, 1, from[0], to[0]),
 linear(e, 0, 1, from[1], to[1])];
