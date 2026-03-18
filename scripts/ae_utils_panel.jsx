/**
 * @name        AE Utils Panel
 * @category    scripts
 * @type        script
 * @description Samlad panel för vanliga AE-operationer: ankarpunkt, textbox och delay.
 *              - Anchor Point: sätter expression på ankarpunkten (5 positioner) + kompenserar
 *                              positionen så lagret inte hoppar visuellt.
 *              - Self-Adjusting Textbox: skapar ett shape-lager under ett textlager som
 *                              automatiskt anpassar sig efter textens storlek via
 *                              sourceRectAtTime. Separat padding för H/V.
 *              - Delay: sätter en delay-expression på markerade egenskaper mot lagret ovanför.
 * @usage       Installera under Scripts/ScriptUI Panels/ i After Effects.
 * @ae-version  2026
 */
(function aeUtilsPanel(thisObj) {

    // ── Hjälpfunktioner ───────────────────────────────────────────────────────

    function getComp() {
        var item = app.project.activeItem;
        if (!item || !(item instanceof CompItem)) {
            alert("Ingen aktiv komposition.\nÖppna en komp och försök igen.");
            return null;
        }
        return item;
    }

    // ── ANCHOR POINT ──────────────────────────────────────────────────────────

    // Expression-strängar för varje hörn/mitt (klistras in i AE:s expression engine)
    var ANCHOR_EXPRS = {
        tl: "r = sourceRectAtTime();\n[r.left, r.top]",
        tr: "r = sourceRectAtTime();\n[r.left + r.width, r.top]",
        bl: "r = sourceRectAtTime();\n[r.left, r.top + r.height]",
        br: "r = sourceRectAtTime();\n[r.left + r.width, r.top + r.height]",
        c:  "r = sourceRectAtTime();\n[r.left + r.width / 2, r.top + r.height / 2]"
    };

    // Beräknar ny ankarpunkt (i lager-space) utifrån sourceRect och valt hörn
    function calcAnchor(rect, corner) {
        var l = rect.left, t = rect.top, w = rect.width, h = rect.height;
        if (corner === "tl") return [l, t];
        if (corner === "tr") return [l + w, t];
        if (corner === "bl") return [l, t + h];
        if (corner === "br") return [l + w, t + h];
        return [l + w / 2, t + h / 2]; // "c" = center
    }

    function applyAnchor(corner) {
        var comp = getComp();
        if (!comp) return;
        var layers = comp.selectedLayers;
        if (!layers.length) { alert("Markera minst ett lager."); return; }

        app.beginUndoGroup("Set Anchor Point");
        try {
            for (var i = 0; i < layers.length; i++) {
                var layer   = layers[i];
                var tfm     = layer.property("ADBE Transform Group");
                var apProp  = tfm.property("ADBE Anchor Point");
                var posProp = tfm.property("ADBE Position");

                var currentAP  = apProp.value;
                var currentPos = posProp.value;
                var rect  = layer.sourceRectAtTime(comp.time, false);
                var newAP = calcAnchor(rect, corner);

                // Kompensera position så lagret inte hoppar visuellt
                var dx = newAP[0] - currentAP[0];
                var dy = newAP[1] - currentAP[1];
                if (layer.threeDLayer) {
                    posProp.setValue([currentPos[0] + dx, currentPos[1] + dy, currentPos[2]]);
                } else {
                    posProp.setValue([currentPos[0] + dx, currentPos[1] + dy]);
                }

                apProp.expression = ANCHOR_EXPRS[corner];
            }
        } catch (e) {
            app.endUndoGroup();
            alert("Anchor Point fel: " + e.toString());
            return;
        }
        app.endUndoGroup();
    }

    // ── SELF-ADJUSTING TEXTBOX ────────────────────────────────────────────────

    function createTextbox(padH, padV) {
        var comp = getComp();
        if (!comp) return;
        var layers = comp.selectedLayers;

        // Hitta det första markerade textlagret
        var txtLayer = null;
        for (var i = 0; i < layers.length; i++) {
            if (layers[i] instanceof TextLayer) {
                txtLayer = layers[i];
                break;
            }
        }
        if (!txtLayer) { alert("Markera ett textlager."); return; }

        app.beginUndoGroup("Create Textbox");
        try {

        // 1. Centrera textlagrets ankarpunkt + kompensera position
        var tfm     = txtLayer.property("ADBE Transform Group");
        var apProp  = tfm.property("ADBE Anchor Point");
        var posProp = tfm.property("ADBE Position");
        var currentAP  = apProp.value;
        var currentPos = posProp.value;
        var rect  = txtLayer.sourceRectAtTime(comp.time, false);
        var newAP = [rect.left + rect.width / 2, rect.top + rect.height / 2];
        var dx = newAP[0] - currentAP[0];
        var dy = newAP[1] - currentAP[1];
        if (txtLayer.threeDLayer) {
            posProp.setValue([currentPos[0] + dx, currentPos[1] + dy, currentPos[2]]);
        } else {
            posProp.setValue([currentPos[0] + dx, currentPos[1] + dy]);
        }
        apProp.expression = ANCHOR_EXPRS["c"];

        // 2. Centrera textjustering
        try {
            var textDocProp = txtLayer.property("ADBE Text Properties")
                                      .property("ADBE Text Document");
            var doc = textDocProp.value;
            doc.justification = ParagraphJustification.CENTER_JUSTIFY;
            textDocProp.setValue(doc);
        } catch (e) {}

        // 3. Skapa shape-lager och placera det direkt under textlagret
        var txtName    = txtLayer.name;
        var shapeLayer = comp.layers.addShape();
        shapeLayer.name      = txtName + " BG";
        shapeLayer.startTime = txtLayer.startTime;
        shapeLayer.outPoint  = txtLayer.outPoint;
        shapeLayer.moveAfter(txtLayer);

        // 4. Shape-lagrets position följer textens mittpunkt i komp-rymd (via toComp)
        //    toComp() hanterar korrekt även textlager med position/rotation/skalning.
        var posExpr =
            'var txt = thisComp.layer("' + txtName + '");\n' +
            'var r = txt.sourceRectAtTime(time, false);\n' +
            'txt.toComp([r.left + r.width / 2, r.top + r.height / 2])';
        shapeLayer.property("ADBE Transform Group")
                  .property("ADBE Position")
                  .expression = posExpr;

        // 5. Bygg rektangelform i shape-lagret med match names
        var contents = shapeLayer.property("ADBE Root Vectors Group");
        var grp      = contents.addProperty("ADBE Vector Group");
        var inner    = grp.property("ADBE Vectors Group");

        // Rektangelform läggs till först (hamnar längst ner i renderordningen)
        var rectPath = inner.addProperty("ADBE Vector Shape - Rect");

        // Storlek: textens bredd/höjd + padding (padH/padV är ensidig → dubblas för total)
        var sizeExpr =
            'var padH = ' + (padH * 2) + ';\n' +
            'var padV = ' + (padV * 2) + ';\n' +
            'var txt = thisComp.layer("' + txtName + '");\n' +
            'var r = txt.sourceRectAtTime(time, false);\n' +
            '[r.width + padH, r.height + padV]';
        rectPath.property("ADBE Vector Rect Size").expression = sizeExpr;
        // Rektangelns position lämnas på [0, 0] – shape-lagrets position sätts till
        // textens mitt via posExpr ovan, så [0,0] i shape-rymd = textens mitt i komp.

        // Fill läggs till sist (hamnar ovanpå i renderordningen → målar rektangeln)
        var fill = inner.addProperty("ADBE Vector Graphic - Fill");
        fill.property("ADBE Vector Fill Color").setValue([1, 1, 1, 1]); // vit – ändra vid behov

        } catch (e) {
            app.endUndoGroup();
            alert("Textbox fel: " + e.toString());
            return;
        }
        app.endUndoGroup();
    }

    // ── DELAY ─────────────────────────────────────────────────────────────────

    // Söker rekursivt igenom property-trädet och sätter delay-expression
    // på alla markerade egenskaper som stödjer expressions.
    function applyDelayToProps(propGroup, expr) {
        for (var i = 1; i <= propGroup.numProperties; i++) {
            var prop;
            try { prop = propGroup.property(i); } catch (e) { continue; }
            try {
                if (prop.selected && prop.canSetExpression) {
                    prop.expression = expr;
                }
            } catch (e) {}
            try {
                if (prop.propertyType === PropertyType.INDEXED_GROUP ||
                    prop.propertyType === PropertyType.NAMED_GROUP) {
                    applyDelayToProps(prop, expr);
                }
            } catch (e) {}
        }
    }

    function applyDelay(frames) {
        var comp = getComp();
        if (!comp) return;
        var layers = comp.selectedLayers;
        if (!layers.length) { alert("Markera minst ett lager."); return; }

        // Expression-mall från användaren – appliceras på markerade properties.
        // Förutsätter att lagret ovanför (index - 1) har en matchande transform-property.
        var expr =
            'var delay = framesToTime(' + frames + ');\n' +
            'var above = thisComp.layer(index - 1).transform(thisProperty.name);\n' +
            'above.valueAtTime(time - delay)';

        app.beginUndoGroup("Apply Delay Expression");
        for (var i = 0; i < layers.length; i++) {
            applyDelayToProps(layers[i], expr);
        }
        app.endUndoGroup();
    }

    // ── BYGG UI ───────────────────────────────────────────────────────────────

    function buildUI(w) {
        w.orientation   = "column";
        w.alignChildren = ["fill", "top"];
        w.spacing       = 6;
        w.margins       = 10;

        // Titel
        var ttl = w.add("statictext", undefined, "AE Utils");
        ttl.alignment = ["center", "top"];
        ttl.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);

        // ── ANCHOR POINT ──────────────────────────────────────────────────────
        var apPanel = w.add("panel", undefined, "Anchor Point");
        apPanel.orientation   = "column";
        apPanel.alignChildren = ["fill", "top"];
        apPanel.spacing       = 4;
        apPanel.margins       = 8;

        var apRow = apPanel.add("group");
        apRow.orientation   = "row";
        apRow.alignChildren = ["fill", "center"];
        apRow.spacing       = 3;

        var AP_BTNS = [
            { label: "↖ TL", corner: "tl" },
            { label: "↗ TR", corner: "tr" },
            { label: "✛ C",  corner: "c"  },
            { label: "↙ BL", corner: "bl" },
            { label: "↘ BR", corner: "br" }
        ];
        for (var i = 0; i < AP_BTNS.length; i++) {
            (function (d) {
                var btn = apRow.add("button", undefined, d.label);
                btn.alignment = ["fill", "center"];
                btn.onClick = function () { applyAnchor(d.corner); };
            }(AP_BTNS[i]));
        }

        // ── SELF-ADJUSTING TEXTBOX ────────────────────────────────────────────
        var tbPanel = w.add("panel", undefined, "Self-Adjusting Textbox");
        tbPanel.orientation   = "column";
        tbPanel.alignChildren = ["fill", "top"];
        tbPanel.spacing       = 4;
        tbPanel.margins       = 8;

        var padRow = tbPanel.add("group");
        padRow.orientation   = "row";
        padRow.alignChildren = ["center", "center"];
        padRow.spacing       = 5;

        padRow.add("statictext", undefined, "Padding  H:");
        var padHInput = padRow.add("edittext", undefined, "20");
        padHInput.characters = 4;
        padRow.add("statictext", undefined, "V:");
        var padVInput = padRow.add("edittext", undefined, "10");
        padVInput.characters = 4;
        padRow.add("statictext", undefined, "px");

        var tbBtn = tbPanel.add("button", undefined, "Skapa textbox");
        tbBtn.alignment = ["fill", "top"];
        tbBtn.onClick = function () {
            var pH = parseInt(padHInput.text, 10);
            var pV = parseInt(padVInput.text, 10);
            if (isNaN(pH) || pH < 0) { alert("Ogiltigt H-padding-värde."); return; }
            if (isNaN(pV) || pV < 0) { alert("Ogiltigt V-padding-värde."); return; }
            createTextbox(pH, pV);
        };

        // ── DELAY ─────────────────────────────────────────────────────────────
        var dlPanel = w.add("panel", undefined, "Delay");
        dlPanel.orientation   = "column";
        dlPanel.alignChildren = ["fill", "top"];
        dlPanel.spacing       = 4;
        dlPanel.margins       = 8;

        var dlRow = dlPanel.add("group");
        dlRow.orientation   = "row";
        dlRow.alignChildren = ["center", "center"];
        dlRow.spacing       = 5;

        dlRow.add("statictext", undefined, "Frames:");
        var frameInput = dlRow.add("edittext", undefined, "5");
        frameInput.characters = 4;

        var dlBtn = dlPanel.add("button", undefined, "Applicera delay");
        dlBtn.alignment = ["fill", "top"];
        dlBtn.onClick = function () {
            var f = parseInt(frameInput.text, 10);
            if (isNaN(f) || f < 0) { alert("Ogiltigt antal frames."); return; }
            applyDelay(f);
        };
    }

    // ── Starta som ScriptUI-panel eller fristående dialog ─────────────────────
    var palette;
    if (thisObj instanceof Panel) {
        palette = thisObj;
        buildUI(palette);
        palette.layout.layout(true);
    } else {
        palette = new Window("palette", "AE Utils", undefined, { resizeable: true });
        buildUI(palette);
        palette.layout.layout(true);
        palette.layout.resize();
        palette.onResizing = palette.onResize = function () { palette.layout.resize(); };
        palette.show();
    }

}(this));
