/**
 * Debug: Set Channels property structure
 * Kör via File → Scripts → Run Script File...
 * Välj ett lager med Set Channels-effekt i din komp innan du kör.
 */
(function () {
    var comp = app.project.activeItem;
    if (!comp || !(comp instanceof CompItem)) {
        alert("Öppna en komp och välj ett lager med Set Channels-effekt.");
        return;
    }

    // Hitta DUST-lagret eller det valda lagret
    var layer = null;
    if (comp.selectedLayers.length > 0) {
        layer = comp.selectedLayers[0];
    } else {
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).name === "DUST") { layer = comp.layer(i); break; }
        }
    }
    if (!layer) { alert("Inget lager valt och inget DUST-lager hittades."); return; }

    // Hitta Set Channels-effekten
    var fx = null;
    var eff = layer.property("Effects");
    for (var e = 1; e <= eff.numProperties; e++) {
        if (eff.property(e).matchName === "ADBE Set Channels") {
            fx = eff.property(e);
            break;
        }
    }
    if (!fx) { alert("Ingen Set Channels-effekt hittades på lagret."); return; }

    // Skriv ut alla properties
    var out = "Effect: " + fx.name + " (" + fx.matchName + ")\n";
    out += "numProperties: " + fx.numProperties + "\n\n";
    for (var p = 1; p <= fx.numProperties; p++) {
        var prop = fx.property(p);
        var val = "";
        try { val = prop.value; } catch(e) { val = "[ej läsbar]"; }
        out += "  [" + p + "] matchName=\"" + prop.matchName + "\"";
        out += "\n       displayName=\"" + prop.name + "\"";
        out += "\n       value=" + val + "\n";
    }

    // Testa att sätta "Set Alpha to Source 4's" via numIndex 8
    out += "\n--- Test: sc.property(8) ---\n";
    try {
        var alphaProp = fx.property(8);
        out += "property(8).name = \"" + alphaProp.name + "\"\n";
        out += "property(8).matchName = \"" + alphaProp.matchName + "\"\n";
        out += "property(8).value (before) = " + alphaProp.value + "\n";
    } catch(e) { out += "property(8) fel: " + e + "\n"; }

    alert(out);
}());
