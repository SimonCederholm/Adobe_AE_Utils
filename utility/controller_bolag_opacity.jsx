/**
 * @name        Controller – Bolag Opacity
 * @category    utility
 * @type        expression
 * @description Visar det lager vars namn matchar valt alternativ i en Dropdown
 *              Menu Control döpt till "Bolag" på null-lagret "controller"
 *              i Main-compen.
 *              Alla övriga bolagslager döljs.
 * @usage       Applicera på Opacity-egenskapen på SAMTLIGA bolagslager inuti
 *              precompen "Bolag". Exakt
 *              samma uttryck används på alla – vilket lager som visas avgörs av
 *              lagrets eget namn jämfört med listan nedan.
 * @ae-version  2026
 */

// ── Controller · Bolag ───────────────────────────────────────
//
// Krav:
//   - Ett null-lager döpt till "controller" i Main-compen
//   - En Dropdown Menu Control på controllern döpt till "Bolag"
//   - Ett lager per bolag inuti precompen "Bolag", döpt exakt som
//     posterna i bolag-listan
//
// Nästlade compositions:
//   controller-nullen ligger i Main-compen medan lagret som styrs ligger i en
//   precomp. `thisComp` skulle då peka på precompen, inte på Main – därför
//   läses controllern via comp("Main"). Byter du namn på Main-compen måste
//   mainComp nedan uppdateras.
//
// VIKTIGT: Dropdown-menyns alternativ måste ligga i EXAKT samma ordning
// som bolag-listan nedan. AE:s dropdown returnerar bara ett index (1, 2,
// 3 …) – inte alternativets text – så listan är det som översätter index
// till lagernamn. Lägger du till, tar bort eller sorterar om alternativ i
// AE måste listan uppdateras på samma sätt (och tvärtom).
//
// Vill du ha ett "inget bolag"-läge: lägg till "Ingen" som alternativ 1 i
// dropdownen OCH som första post i listan nedan. Inget lager heter så, så
// alla bolagslager döljs.
//
// Lager vars namn inte finns i listan lämnas orörda – uttrycket kan alltså
// inte råka släcka något annat lager i compen.
//
// ─────────────────────────────────────────────────────────────

var mainComp    = "Main";        // Compen där controller-nullen ligger
var ctrlLager   = "controller";  // Null-lagret med dropdown-menyerna
var ddNamn      = "Bolag";       // Effektnamn på Dropdown Menu Control
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

// Läser en dropdown säkert – saknas compen, lagret eller effekten
// används fallback
function ddVarde(compNamn, lagerNamn, effektNamn, fallback) {
    try {
        return comp(compNamn).layer(lagerNamn).effect(effektNamn)("Menu").value;
    } catch (err) {
        return fallback;
    }
}

// Normaliserar ett namn för jämförelse (skiftläge och kantmellanslag)
function normalisera(txt) {
    return txt.replace(/^\s+|\s+$/g, "").toLowerCase();
}

var val      = ddVarde(mainComp, ctrlLager, ddNamn, standardVal);
var valtNamn = (val >= 1 && val <= bolag.length) ? normalisera(bolag[val - 1]) : "";
var mittNamn = normalisera(thisLayer.name);

// Är det här lagret överhuvudtaget ett bolagslager?
var arBolagslager = false;
for (var i = 0; i < bolag.length; i++) {
    if (normalisera(bolag[i]) === mittNamn) {
        arBolagslager = true;
        break;
    }
}

if (!arBolagslager) {
    value; // Okänt lagernamn – lämna opaciteten orörd
} else {
    (mittNamn === valtNamn) ? value : 0;
}
