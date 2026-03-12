/**
 * @name        Contrast Color Check
 * @category    color
 * @type        expression
 * @description Returnerar vit eller svart färg baserat på luminansen hos ett bakgrundslager
 *              direkt under det aktuella lagret. Samplar lagret "Bakgrund" vid det aktuella
 *              lagrets center och beräknar relativ luminans enligt ITU-R BT.709.
 *              Returnerar svart vid hög luminans och vit vid låg – för maximal läsbarhet.
 * @usage       Applicera på en Fill-effekts Color-egenskap, eller på ett textlagers
 *              färgegenskap. Byt ut "Bakgrund" mot namnet på det lager du vill sampla.
 * @ae-version  2026
 */

// Returfärger (RGBA, normaliserat 0–1)
var light = [1, 1, 1, 1]; // vit – används mot mörk bakgrund
var dark  = [0, 0, 0, 1]; // svart – används mot ljus bakgrund

// Hämta lagrets bounding box och beräkna center i comp-koordinater
var rect   = thisLayer.sourceRectAtTime(time, false);
var center = thisLayer.toComp([rect.left + rect.width / 2, rect.top + rect.height / 2]);
var radius = [rect.width, rect.height];

// Sampla bakgrundslagrets genomsnittliga färg inom lagrets yta
var s = thisComp.layer("Bakgrund").sampleImage(center, radius, true, 0);

// Beräkna relativ luminans enligt ITU-R BT.709
var L = 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];

// Returnera svart om bakgrunden är ljus (L > 0.6), annars vit
L > 0.6 ? dark : light;
