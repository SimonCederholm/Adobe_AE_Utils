/**
 * @name        Expression Cleanup – BRAND_CTRL
 * @category    scripts
 * @type        script
 * @description Städar expressions i hela projektet som refererar till kontrollager via thisComp.
 *              Ersätter thisComp med comp("BRAND_CTRL") i expressions som refererar till
 *              "Text adjustments", "Color picker Splash", "Animation controller" eller "Color picker".
 *              Byter också namn: "Text adjustments" → "Text Controller",
 *              "Color picker" → "Color controller" (inkl. "Color picker Splash").
 *              Körs på alla kompositioner i projektet.
 * @usage       Kopiera till Scripts/ och kör via File > Scripts > Run Script File i AE.
 * @ae-version  2026
 */

// Expressions som innehåller thisComp + ett av dessa lagernamn träffas och transformeras
var TARGET_LAYERS = [
    "Text adjustments",
    "Color picker Splash",
    "Animation controller",
    "Color picker"
];

// Textersättningar som görs i alla träffade expressions
var RENAMES = [
    { from: "Text adjustments", to: "Text Controller" },
    { from: "Color picker",     to: "Color controller" }
    // "Color picker Splash" → "Color controller Splash" hanteras automatiskt
    // eftersom "Color picker" är en delsträng av "Color picker Splash"
];

// ── Hjälpfunktioner ───────────────────────────────────────────────────────────

function replaceAll(str, search, replacement) {
    return str.split(search).join(replacement);
}

// Kontrollerar om en expression refererar till thisComp + ett av kontrollager-namnen
function containsTargetRef(expr) {
    if (expr.indexOf("thisComp") === -1) return false;
    for (var i = 0; i < TARGET_LAYERS.length; i++) {
        if (expr.indexOf(TARGET_LAYERS[i]) !== -1) return true;
    }
    return false;
}

// Utför alla ersättningar på en expression-sträng
function transformExpr(expr) {
    var result = replaceAll(expr, "thisComp", 'comp("BRAND_CTRL")');
    for (var i = 0; i < RENAMES.length; i++) {
        result = replaceAll(result, RENAMES[i].from, RENAMES[i].to);
    }
    return result;
}

// Rekursiv genomsökning av alla properties på ett lager
function scanProp(prop, pathParts, changes) {
    try {
        if (prop.propertyType === PropertyType.PROPERTY) {
            if (prop.canSetExpression) {
                var expr = prop.expression;
                if (expr && containsTargetRef(expr)) {
                    var newExpr = transformExpr(expr);
                    if (newExpr !== expr) {
                        prop.expression = newExpr;
                        changes.push(pathParts.concat([prop.name]).join(" \u203a "));
                    }
                }
            }
        } else {
            var count = 0;
            try { count = prop.numProperties; } catch (e) {}
            for (var i = 1; i <= count; i++) {
                try {
                    scanProp(prop.property(i), pathParts.concat([prop.name]), changes);
                } catch (e) {}
            }
        }
    } catch (e) {}
}

// ── Kör städningen på hela projektet ─────────────────────────────────────────

var totalChanges = 0;
var compsHit = 0;
var report = [];

app.beginUndoGroup("Expression Cleanup \u2013 BRAND_CTRL");
try {
    for (var p = 1; p <= app.project.numItems; p++) {
        var item = app.project.item(p);
        if (!(item instanceof CompItem)) continue;

        var changes = [];
        for (var i = 1; i <= item.numLayers; i++) {
            var layer = item.layer(i);
            var count = 0;
            try { count = layer.numProperties; } catch (e) {}
            for (var j = 1; j <= count; j++) {
                try {
                    scanProp(layer.property(j), [layer.name], changes);
                } catch (e) {}
            }
        }

        if (changes.length > 0) {
            totalChanges += changes.length;
            compsHit++;
            report.push("── " + item.name + " ──");
            for (var k = 0; k < changes.length; k++) {
                report.push(changes[k]);
            }
        }
    }
} finally {
    app.endUndoGroup();
}

if (totalChanges === 0) {
    alert("Inga matchande expressions hittades i projektet.");
} else {
    var msg = "Uppdaterade " + totalChanges + " expression" +
              (totalChanges > 1 ? "s" : "") +
              " i " + compsHit + " komposition" +
              (compsHit > 1 ? "er" : "") + ":\n\n" +
              report.join("\n");
    alert(msg);
}
