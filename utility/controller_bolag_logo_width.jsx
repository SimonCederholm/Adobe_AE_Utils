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
//   - Ett logolager per bolag, döpt exakt som posterna i bolag-listan
//
// Returnerar logotypens källbredd multiplicerad med både logolagrets
// egen skala och det här lagrets skala – dvs. bredden så som den faktiskt
// ser ut i compen när logotypen är parentad till det här lagret.
//
// VIKTIGT: Dropdown-menyns alternativ måste ligga i EXAKT samma ordning
// som bolag-listan nedan – AE:s dropdown returnerar bara ett index, inte
// alternativets text. Listan måste alltså hållas i synk med listan i
// controller_bolag_opacity.jsx.
//
// Saknas det valda lagret används reservLager ("Logo") i stället, så att
// uttrycket inte kastar fel medan lagren byggs upp.
//
// ─────────────────────────────────────────────────────────────

var ctrlLager   = "controller";  // Null-lagret med dropdown-menyerna
var ddNamn      = "Bolag";       // Effektnamn på Dropdown Menu Control
var reservLager = "Logo";        // Används om valt lager inte finns
var standardVal = 1;             // Fallback om controller/dropdown saknas

// Alternativ 1, 2, 3 … i samma ordning som i dropdown-menyn
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

// Läser en dropdown säkert – saknas lagret eller effekten används fallback
function ddVarde(lagerNamn, effektNamn, fallback) {
    try {
        return thisComp.layer(lagerNamn).effect(effektNamn)("Menu").value;
    } catch (err) {
        return fallback;
    }
}

// Hämtar ett lager säkert – returnerar null om det inte finns
function hittaLager(lagerNamn) {
    try {
        return thisComp.layer(lagerNamn);
    } catch (err) {
        return null;
    }
}

var val       = ddVarde(ctrlLager, ddNamn, standardVal);
var valtNamn  = (val >= 1 && val <= bolag.length) ? bolag[val - 1] : reservLager;
var logoLager = hittaLager(valtNamn);

if (logoLager === null) {
    logoLager = hittaLager(reservLager);
}

if (logoLager === null) {
    value; // Varken valt lager eller reservlager finns
} else {
    var logoWidth = logoLager.sourceRectAtTime().width;
    var nullScale = transform.scale[0] / 100;
    var logoScale = (logoLager.transform.scale[0] * nullScale) / 100;

    logoWidth * logoScale;
}
