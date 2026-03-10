/**
 * @name        Debug Lumetri Color Structure
 * @category    utility
 * @type        script
 * @description Dumpar hela Lumetri Color-effektens property-träd:
 *              matchName, displayName och nuvarande värde för alla
 *              properties och sub-grupper (3 nivåer djupt).
 * @usage       1. Lägg till Lumetri Color på ett lager.
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

    // Hitta Lumetri Color
    var fx = null;
    var eff = layer.property("Effects");
    for (var e = 1; e <= eff.numProperties; e++) {
        if (eff.property(e).matchName === "ADBE Lumetri") { fx = eff.property(e); break; }
    }
    if (!fx) { alert("Ingen Lumetri Color-effekt hittades på lagret."); return; }

    function readVal(prop) {
        try {
            var v = prop.value;
            if (v && v.length !== undefined && v.length <= 4) return "[" + v + "]";
            return String(v);
        } catch(e) { return "–"; }
    }

    function dumpGroup(prop, indent, maxDepth) {
        var out = "";
        var n = 0;
        try { n = prop.numProperties; } catch(e) { return out; }
        for (var i = 1; i <= n; i++) {
            var p;
            try { p = prop.property(i); } catch(e) { continue; }
            var hasChildren = false;
            try { hasChildren = p.numProperties > 0; } catch(e) {}

            out += indent + "[" + i + "] \"" + p.name + "\"";
            out += "  mn=" + p.matchName;
            if (!hasChildren) out += "  val=" + readVal(p);
            out += "\n";

            if (hasChildren && maxDepth > 0) {
                out += dumpGroup(p, indent + "    ", maxDepth - 1);
            }
        }
        return out;
    }

    // Hitta Creative-subgruppen (ADBE Lumetri-0022) och dumpa den fullt ut
    var creative = null;
    for (var i = 1; i <= fx.numProperties; i++) {
        try {
            if (fx.property(i).matchName === "ADBE Lumetri-0022") {
                creative = fx.property(i); break;
            }
        } catch(e) {}
    }

    var out = "=== LUMETRI COLOR – Creative-sektion (full dump) ===\n\n";
    if (creative) {
        out += "Creative  mn=" + creative.matchName + "\n";
        out += dumpGroup(creative, "  ", 5);
    } else {
        out += "(Creative-gruppen hittades inte)\n";
    }

    // Dela upp i två alerts om texten är lång
    if (out.length > 2000) {
        alert(out.substring(0, 2000) + "\n\n[fortsättning i nästa alert...]");
        alert(out.substring(2000));
    } else {
        alert(out);
    }
}());
