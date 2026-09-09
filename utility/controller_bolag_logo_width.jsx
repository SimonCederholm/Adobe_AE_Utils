/**
 * @name        Controller – Bolag Logo Width
 * @category    utility
 * @type        expression
 * @description Mäter bredden på det logolager som motsvarar valt alternativ i
 *              Dropdown Menu Control "Bolag" på null-lagret "controller", och
 *              räknar om bredden till det egna lagrets skala.
 * @usage       Applicera på en 1D-egenskap (t.ex. en Slider Control) på det
 *              lager vars skala bredden ska räknas om till – typiskt nullen som
 *              logotypen är parentad till.
 * @ae-version  2026
 */

// ── Controller · Bolag → Logobredd ───────────────────────────
//
// Krav:
//   - Ett null-lager döpt till "controller"
//   - En Dropdown Menu Control på controllern döpt till "Bolag"
//   - Ett logolager per bolag, döpt exakt som posterna i listan nedan
//
// AE:s dropdown returnerar bara ett index (1, 2, 3 …), aldrig alternativets
// text. Listan nedan översätter index till lagernamn och måste därför ligga
// i EXAKT samma ordning som dropdown-menyns alternativ – samma lista som i
// controller_bolag_opacity.jsx.
//
// Returnerar logotypens källbredd gånger logolagrets egen skala gånger det
// här lagrets skala – dvs. bredden så som den faktiskt ser ut i compen.
//
// ─────────────────────────────────────────────────────────────

var bolag = [
    "Bergslagen",             //  1
    "Blekinge",               //  2
    "Darlarnas",              //  3  – stavat som i mappstrukturen
    "Gotland",                //  4
    "Gävleborg",              //  5
    "Göinge-Kristianstad",    //  6
    "Göteborg och Bohuslän",  //  7
    "Halland",                //  8
    "Jämtland",               //  9
    "Jönköping",              // 10
    "Kalmar",                 // 11
    "Kronoberg",              // 12
    "LF",                     // 13
    "Norrbotten",             // 14
    "Skaraborg",              // 15
    "Skåne",                  // 16
    "Stockholm",              // 17
    "Sörmland",               // 18
    "Uppsala",                // 19
    "Värmland",               // 20
    "Västerbotten",           // 21
    "Västernorrland",         // 22
    "Älvsborg",               // 23
    "Östgöta"                 // 24
];

// ─────────────────────────────────────────────────────────────

var val       = thisComp.layer("controller").effect("Bolag")("Menu");
var logoLager = thisComp.layer(bolag[val - 1]);

var logoWidth = logoLager.sourceRectAtTime().width;
var nullScale = transform.scale[0] / 100;
var logoScale = (logoLager.transform.scale[0] * nullScale) / 100;

logoWidth * logoScale;
