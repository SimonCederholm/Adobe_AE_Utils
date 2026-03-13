/**
 * @name        Contrast Color Check (Effect Source)
 * @category    color
 * @type        expression
 * @description Returnerar vit eller svart färg baserat på luminansen hos en färg
 *              hämtad från effekten "Background color splash" på lagret
 *              "Color controller splash". Beräknar relativ luminans enligt
 *              ITU-R BT.709 och returnerar svart vid hög luminans, vit vid låg –
 *              för maximal läsbarhet.
 * @usage       Applicera på en Fill-effekts Color-egenskap, eller på ett textlagers
 *              färgegenskap. Byt ut lager- och effektnamnen vid behov.
 * @ae-version  2026
 */

// Returfärger (RGBA, normaliserat 0–1)
var light = [1, 1, 1, 1]; // vit – används mot mörk bakgrund
var dark  = [0, 0, 0, 1]; // svart – används mot ljus bakgrund

// Hämta färg direkt från effektparametern – inget lagersampel behövs
var s = thisComp.layer("Color controller splash").effect("Background color splash")("Color");

// Beräkna relativ luminans enligt ITU-R BT.709
var L = 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];

// Returnera svart om bakgrunden är ljus (L > 0.6), annars vit
L > 0.6 ? dark : light;
