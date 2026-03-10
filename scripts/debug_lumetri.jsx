/**
 * @name        Debug Lumetri Color Structure
 * @category    utility
 * @type        script
 * @description Dumpar hela Lumetri Color-effektens property-lista (flat) till en textfil.
 *              Skriver till Desktop/lumetri_dump.txt för att undvika alert-trunkering.
 * @usage       1. Lägg till Lumetri Color på ett lager (sätt gärna Highlight Tint manuellt).
 *              2. Välj lagret.
 *              3. Kör via File → Scripts → Run Script File...
 * @ae-version  2026
 */
(function () {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        alert("Öppna en komp och välj ett lager med Lumetri Color-effekt.");
        return;
    }

    var layer = comp.selectedLayers.length > 0 ? comp.selectedLayers[0] : null;
    if (!layer) { alert("Välj ett lager med Lumetri Color-effekt."); return; }

    var fx = null;
    var eff = layer.property("Effects");
    for (var e = 1; e <= eff.numProperties; e++) {
        if (eff.property(e).matchName === "ADBE Lumetri") { fx = eff.property(e); break; }
    }
    if (!fx) { alert("Ingen Lumetri Color-effekt hittades på lagret."); return; }

    function readVal(prop) {
        try {
            var v = prop.value;
            if (v === null || v === undefined) return "null";
            if (typeof v === "object" && v.length !== undefined) return "[" + Array.prototype.join.call(v, ", ") + "]";
            return String(v);
        } catch(e) { return "–"; }
    }

    // Lumetri är flat – alla properties sitter direkt under effekten
    var out = "=== LUMETRI COLOR – alla " + fx.numProperties + " properties ===\n\n";
    for (var i = 1; i <= fx.numProperties; i++) {
        var p;
        try { p = fx.property(i); } catch(e) { out += "[" + i + "] FEL\n"; continue; }
        var isGroup = false;
        try { isGroup = p.numProperties > 0; } catch(e) {}
        out += "[" + i + "] \"" + p.name + "\"";
        out += "  mn=" + p.matchName;
        out += "  val=" + (isGroup ? "(grupp, children=" + p.numProperties + ")" : readVal(p));
        out += "\n";
    }

    // Skriv till fil på skrivbordet
    var desktop = Folder.desktop;
    var f = new File(desktop.absoluteURI + "/lumetri_dump.txt");
    f.open("w");
    f.write(out);
    f.close();

    alert("Klar! Öppna:\n" + f.fsName);
}());
