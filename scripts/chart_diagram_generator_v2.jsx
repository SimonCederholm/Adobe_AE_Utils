/**
 * @name        Chart Diagram Generator v2
 * @category    scripts
 * @type        script
 * @description Variant av Chart Diagram Generator med y-axel-etiketter på varje skallinje.
 *              Skapar ett animerat linjediagram i AE från en JSON-datafil.
 *              Genererar shapelayers med trim-path-animation, datapunktslabels,
 *              ett rörligt värdesvisare per serie, legend och y-axeletiketter.
 * @usage       Kör som ScriptUI-panel. Importera en JSON-fil till projektet,
 *              välj den i dropdown och klicka "Skapa diagram".
 * @ae-version  2026
 */
(function chartDiagramPanelV2(thisObj) {
    // =========================================================================
    // CONSTANTS  –  justera dessa vid behov
    // =========================================================================
    var CHART_LEFT            = 140;    // px, vänster kant av diagramytan
    var CHART_RIGHT           = 1300;   // px, höger kant av diagramytan
    var CHART_TOP             = 200;    // px, övre kant (höga värden)
    var CHART_BOTTOM          = 1200;   // px, nedre kant (låga värden)
    var COMP_DURATION_SEC     = 10;     // kompens totala längd (alltid fast)
    var ANIM_DURATION_SEC     = 4;      // trim-path-animationen tar alltid 4 sekunder
    var ANIM_START_FRAME      = 0;      // frame där trim-path-animeringen börjar
    var LABEL_OFFSET_Y        = 50;     // px ovanför datapunkt för dolda datalabels
    var RUNNING_OFFSET_Y      = 60;     // px ovanför tracker-null för running label
    var FONT_NAME             = "IBMPlexSans-Medium";
    var FONT_SIZE_LABEL       = 55;
    var FONT_SIZE_RUNNING     = 55;
    var STROKE_WIDTH          = 8;
    var COMP_WIDTH            = 1440;
    var COMP_HEIGHT           = 1440;
    var COMP_FPS              = 24;
    var CONTROLLER_NAME       = "Color Controller";
    var GRID_ZERO_WIDTH       = 6;    // px, noll-linjens tjocklek
    var GRID_SCALE_WIDTH      = 2;    // px, tunna skallinjer
    var GRID_DIVISIONS        = 4;    // antal skallinjer ovanför 0
    var GRID_LINE_COLOR       = [0.894, 0.953, 0.980]; // Ljusblå RGB 228/243/250
    // Färgpalett per serie — peach och turkos i första hand, endast brand-färger
    var COLOR_PALETTE = [
        [0.922, 0.361, 0.361],  // Peach      RGB 235/92/92    #eb5c5c
        [0.714, 0.882, 0.969],  // Turkos     RGB 182/225/247  #b6e1f7
        [0.000, 0.353, 0.627],  // LF Blå     RGB 0/90/160     #005aa0
        [1.000, 1.000, 1.000],  // Vit        RGB 255/255/255  #ffffff
        [0.890, 0.024, 0.075],  // LF Röd     RGB 227/6/19     #e30613
        [0.427, 0.663, 0.392],  // Grön       RGB 109/169/100  #6da964
        [0.886, 0.937, 0.875],  // Mint grön  RGB 226/239/223  #e2efdf
        [0.894, 0.953, 0.980]   // Ljusblå    RGB 228/243/250  #e4f3fa
    ];
    var BG_COLOR = [0.063, 0.247, 0.455]; // Navy #103f74  RGB 16/63/116
    // Aktivt teckensnitt — uppdateras av UI-fontväljaren
    var selectedFont = FONT_NAME;
    // =========================================================================
    // HELPERS
    // =========================================================================
    function sanitizeName(str) {
        return str.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 25);
    }
    // Avrundar rawMax uppåt till ett "snyggt" tal (1, 2, 5, 10 × 10^n)
    function niceMax(rawMax) {
        if (rawMax <= 0) { return 1; }
        var mag = 1;
        while (rawMax >= mag * 10) { mag *= 10; }
        var norm = rawMax / mag;
        var nice;
        if (norm <= 1)      { nice = 1; }
        else if (norm <= 2) { nice = 2; }
        else if (norm <= 5) { nice = 5; }
        else                { nice = 10; }
        return nice * mag;
    }
    // Formaterar tal med mellanrum som tusental­separator, t.ex. "1 064 751"
    function formatValue(num) {
        var r = Math.round(num);
        return r.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
    }
    // Konverterar data-koordinat (år, värde) → pixelposition [x, y] i kompen
    function dataToCompPos(year, value, cfg) {
        var xPct = (cfg.xMax === cfg.xMin)
            ? 0.5
            : (year - cfg.xMin) / (cfg.xMax - cfg.xMin);
        var yPct = (cfg.yMax === cfg.yMin)
            ? 0.5
            : (value - cfg.yMin) / (cfg.yMax - cfg.yMin);
        return [
            CHART_LEFT  + xPct * (CHART_RIGHT  - CHART_LEFT),
            CHART_BOTTOM - yPct * (CHART_BOTTOM - CHART_TOP)
        ];
    }
    // Applicerar ease-ease med hög influence på ett keyframe (index 1-baserat)
    function setEaseEase(prop, keyIdx) {
        try {
            var e = new KeyframeEase(0, 80);
            prop.setTemporalEaseAtKey(keyIdx, [e], [e]);
        } catch (err) {}
    }
    // Lägger till ett AE-effect via matchname (language-oberoende) med display-name fallback
    function addFX(layer, matchName, displayName) {
        try { return layer.Effects.addProperty(matchName); } catch (e) {}
        try { return layer.Effects.addProperty(displayName); } catch (e) {}
        return null;
    }
    // Applicerar textstil på ett TextDocument-property
    function applyTextStyle(textProp, fontSize, fillColor, justify) {
        try {
            var td = textProp.value;
            td.font        = selectedFont;
            td.fontSize    = fontSize;
            td.fillColor   = fillColor;
            td.applyFill   = true;
            td.applyStroke = false;
            if (justify !== undefined) { td.justification = justify; }
            textProp.setValue(td);
        } catch (e) {}
    }
    function setStatus(txt, el) {
        if (!el) { return; }
        try { el.text = txt; el.parent.layout.layout(true); } catch (e) {}
    }
    // =========================================================================
    // DATA
    // =========================================================================
    function findJsonFiles() {
        var found = [];
        for (var i = 1; i <= app.project.numItems; i++) {
            try {
                var item = app.project.item(i);
                if (!(item instanceof FootageItem)) { continue; }
                var src = item.mainSource;
                if (!(src instanceof FileSource) || !src.file) { continue; }
                var name = src.file.name.toLowerCase();
                if (name.length >= 5 && name.substring(name.length - 5) === ".json") {
                    found.push(item);
                }
            } catch (e) {}
        }
        return found;
    }
    function parseChartData(footageItem) {
        var fsPath;
        try {
            fsPath = footageItem.mainSource.file.fsName;
        } catch (e) {
            throw new Error("Kan inte komma åt filkällan. Är footage-objektet giltigt?");
        }
        var f = new File(fsPath);
        if (!f.open("r")) {
            throw new Error("Kan inte öppna filen: " + fsPath);
        }
        f.encoding = "UTF-8";
        var content = f.read();
        f.close();
        content = content.replace(/^\uFEFF/, "");
        content = content.replace(/^\s+|\s+$/g, "");
        if (content.length === 0) {
            throw new Error("Filen är tom eller kunde inte läsas.");
        }
        if (content.charAt(0) !== "{" && content.charAt(0) !== "[") {
            content = "{" + content + "}";
        }
        content = content.replace(/,(\s*[}\]])/g, "$1");
        var raw;
        try {
            raw = eval("(" + content + ")"); // eslint-disable-line no-eval
        } catch (e) {
            var preview = content.substring(0, 120).replace(/[\r\n]/g, " ");
            throw new Error("Ogiltig JSON: " + e.message + "\nStart: " + preview);
        }
        var seriesKeys = [];
        for (var k in raw) {
            if (raw.hasOwnProperty(k) && typeof raw[k] === "object") {
                seriesKeys.push(k);
            }
        }
        if (seriesKeys.length === 0) {
            throw new Error("Inga serier hittades i JSON-filen.");
        }
        var seriesMap   = {};
        var allYearsMap = {};
        var yMaxRaw     = 0;
        for (var si = 0; si < seriesKeys.length; si++) {
            var key    = seriesKeys[si];
            var obj    = raw[key];
            var points = [];
            for (var yr in obj) {
                if (!obj.hasOwnProperty(yr)) { continue; }
                var yearNum = parseInt(yr, 10);
                var val     = parseFloat(obj[yr]);
                if (isNaN(yearNum) || isNaN(val)) { continue; }
                points.push({ year: yearNum, value: val });
                allYearsMap[yearNum] = true;
                if (val > yMaxRaw) { yMaxRaw = val; }
            }
            points.sort(function (a, b) { return a.year - b.year; });
            seriesMap[key] = points;
        }
        var uniqueYears = [];
        for (var y in allYearsMap) {
            if (allYearsMap.hasOwnProperty(y)) {
                uniqueYears.push(parseInt(y, 10));
            }
        }
        uniqueYears.sort(function (a, b) { return a - b; });
        if (uniqueYears.length === 0) {
            throw new Error("Inga giltiga datapunkter hittades.");
        }
        return {
            seriesKeys  : seriesKeys,
            seriesMap   : seriesMap,
            uniqueYears : uniqueYears,
            yMin        : 0,
            yMax        : niceMax(yMaxRaw * 1.1),
            xMin        : uniqueYears[0],
            xMax        : uniqueYears[uniqueYears.length - 1]
        };
    }
    // =========================================================================
    // LAYER CREATION
    // =========================================================================

    function createBackground(comp) {
        var solid = comp.layers.addSolid(BG_COLOR, "Bakgrund", COMP_WIDTH, COMP_HEIGHT, 1);
        solid.moveToEnd();
        return solid;
    }

    function addHLineToRoot(root, name, x1, x2, y, strokeWidth, alpha) {
        var grp    = root.addProperty("ADBE Vector Group");
        grp.name   = name;
        var grpVec = grp.property("ADBE Vectors Group");
        var pathGrp  = grpVec.addProperty("ADBE Vector Shape - Group");
        var pathProp = pathGrp.property("ADBE Vector Shape");
        try {
            var sh = new Shape();
            sh.vertices    = [[x1, y], [x2, y]];
            sh.inTangents  = [[0, 0], [0, 0]];
            sh.outTangents = [[0, 0], [0, 0]];
            sh.closed = false;
            pathProp.setValue(sh);
        } catch (e) {}
        var stroke = grpVec.addProperty("ADBE Vector Graphic - Stroke");
        try { stroke.property("ADBE Vector Stroke Width").setValue(strokeWidth); } catch (e) {}
        try { stroke.property("ADBE Vector Stroke Line Cap").setValue(2); } catch (e) {}
        try { stroke.property("ADBE Vector Stroke Color").setValue(
            [GRID_LINE_COLOR[0], GRID_LINE_COLOR[1], GRID_LINE_COLOR[2], alpha]
        ); } catch (e) {}
    }

    function createGridLines(comp, cfg) {
        var sl = comp.layers.addShape();
        sl.name = "Skallinjer";
        sl.transform.anchorPoint.setValue([0, 0]);
        sl.transform.position.setValue([0, 0]);
        var root = sl.property("ADBE Root Vectors Group");

        addHLineToRoot(root, "Noll-linje", CHART_LEFT, CHART_RIGHT, CHART_BOTTOM,
            GRID_ZERO_WIDTH, 0.7);

        for (var i = 1; i <= GRID_DIVISIONS; i++) {
            var val  = cfg.yMax * (i / GRID_DIVISIONS);
            var yPos = dataToCompPos(cfg.xMin, val, cfg)[1];
            addHLineToRoot(root, "Skallinje " + i, CHART_LEFT, CHART_RIGHT, yPos,
                GRID_SCALE_WIDTH, 0.35);
        }
        return sl;
    }

    // Skapar textlager med värdetikett strax ovanför varje skallinje,
    // vänsterjusterat med skalstreckets vänsterkant (CHART_LEFT)
    function createYAxisLabels(comp, cfg) {
        var FONT_SIZE_Y  = 40;
        var ABOVE_LINE   = 12; // px ovanför strecket (baseline-offset)
        var col = [GRID_LINE_COLOR[0], GRID_LINE_COLOR[1], GRID_LINE_COLOR[2]];

        // En etikett per skallinje (ingen etikett för 0-linjen)
        for (var i = 1; i <= GRID_DIVISIONS; i++) {
            var val  = cfg.yMax * (i / GRID_DIVISIONS);
            var yPos = dataToCompPos(cfg.xMin, val, cfg)[1];
            var tl   = comp.layers.addText(formatValue(val));
            tl.name  = "YLabel_" + i;
            var textProp = tl.property("ADBE Text Properties").property("ADBE Text Document");
            applyTextStyle(textProp, FONT_SIZE_Y, col, ParagraphJustification.LEFT_JUSTIFY);
            tl.transform.position.setValue([CHART_LEFT, yPos - ABOVE_LINE]);
        }
    }

    function createSeriesController(comp, sKey, col) {
        var nl = comp.layers.addNull();
        nl.name    = CONTROLLER_NAME;
        nl.enabled = false;
        var fx = addFX(nl, "ADBE Color Control", "Color Control");
        if (fx) {
            fx.name = sKey;
            try {
                fx.property("ADBE Color Control-0001").setValue([col[0], col[1], col[2], 1]);
            } catch (e) {
                try { fx.property(1).setValue([col[0], col[1], col[2], 1]); } catch (e2) {}
            }
        }
        return nl;
    }
    function createPointNulls(comp, sName, dataPoints, cfg) {
        var layers = [];
        for (var i = 0; i < dataPoints.length; i++) {
            var pos = dataToCompPos(dataPoints[i].year, dataPoints[i].value, cfg);
            var nl  = comp.layers.addNull();
            nl.name = sName + "_pt" + i;
            nl.transform.anchorPoint.setValue([0, 0]);
            nl.transform.position.setValue(pos);
            nl.enabled = false;
            nl.shy     = true;
            nl.moveToEnd();
            layers.push(nl);
        }
        return layers;
    }
    function createLineShapeLayer(comp, sName, displayName, dataPoints, cfg) {
        var numPts = dataPoints.length;
        var sl = comp.layers.addShape();
        sl.name = "Line_" + sName;
        sl.transform.anchorPoint.setValue([0, 0]);
        sl.transform.position.setValue([0, 0]);
        var root   = sl.property("ADBE Root Vectors Group");
        var grp    = root.addProperty("ADBE Vector Group");
        grp.name   = "Path Group";
        var grpVec = grp.property("ADBE Vectors Group");
        var pathGrp  = grpVec.addProperty("ADBE Vector Shape - Group");
        pathGrp.name = "Path 1";
        var pathProp = pathGrp.property("ADBE Vector Shape");
        try {
            var dummy = new Shape();
            dummy.vertices    = [];
            dummy.inTangents  = [];
            dummy.outTangents = [];
            for (var pi = 0; pi < numPts; pi++) {
                var initPos = dataToCompPos(dataPoints[pi].year, dataPoints[pi].value, cfg);
                dummy.vertices.push(initPos);
                dummy.inTangents.push([0, 0]);
                dummy.outTangents.push([0, 0]);
            }
            dummy.closed = false;
            pathProp.setValue(dummy);
        } catch (e) {}
        var pathExpr =
            'var pts=[],inT=[],outT=[];\n' +
            'var pre="' + sName + '";\n' +
            'var n=' + numPts + ';\n' +
            'for(var i=0;i<n;i++){\n' +
            '  var nl=thisComp.layer(pre+"_pt"+i);\n' +
            '  pts.push(fromCompToSurface(nl.toComp(nl.anchorPoint)));\n' +
            '  inT.push([0,0]);outT.push([0,0]);\n' +
            '}\n' +
            'createPath(pts,inT,outT,false);';
        try { pathProp.expression = pathExpr; } catch (e) {}
        var stroke = grpVec.addProperty("ADBE Vector Graphic - Stroke");
        try { stroke.property("ADBE Vector Stroke Width").setValue(STROKE_WIDTH); } catch (e) {}
        try { stroke.property("ADBE Vector Stroke Line Cap").setValue(2); } catch (e) {}
        try {
            var initCol = COLOR_PALETTE[0];
            stroke.property("ADBE Vector Stroke Color").setValue([initCol[0], initCol[1], initCol[2], 1]);
        } catch (e) {}
        var safeDisplay = displayName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        var colorExpr = 'thisComp.layer("' + CONTROLLER_NAME + '").effect("' + safeDisplay + '")("Color");';
        try { stroke.property("ADBE Vector Stroke Color").expression = colorExpr; } catch (e) {}
        var trim = grpVec.addProperty("ADBE Vector Filter - Trim");
        trim.name = "Trim Paths 1";
        var startSec    = ANIM_START_FRAME / COMP_FPS;
        var endSec      = (ANIM_START_FRAME + (numPts - 1) * cfg.framesPerSegment) / COMP_FPS;
        var trimEndProp = trim.property("ADBE Vector Trim End");
        try {
            trimEndProp.setValueAtTime(startSec, 0);
            trimEndProp.setValueAtTime(endSec, 100);
            setEaseEase(trimEndProp, 1);
            setEaseEase(trimEndProp, 2);
        } catch (e) {}
        return sl;
    }
    function createTrackerNull(comp, sName) {
        var nl = comp.layers.addNull();
        nl.name    = "Tracker_" + sName;
        nl.enabled = false;
        nl.shy     = true;
        nl.moveToEnd();
        var expr =
            'var sl=thisComp.layer("Line_' + sName + '");\n' +
            'var g=sl.content("Path Group");\n' +
            'var t=g.content("Trim Paths 1").end/100;\n' +
            'sl.toComp(g.content("Path 1").path.pointOnPath(t));';
        try { nl.transform.position.expression = expr; } catch (e) {}
        return nl;
    }
    function createRunningLabel(comp, sName, cfg) {
        var trackerName = "Tracker_" + sName;
        var tl = comp.layers.addText("0");
        tl.name = "Running_" + sName;
        var textProp = tl.property("ADBE Text Properties").property("ADBE Text Document");
        applyTextStyle(textProp, FONT_SIZE_RUNNING, [1, 1, 1], ParagraphJustification.CENTER_JUSTIFY);
        var cBot = CHART_BOTTOM;
        var cTop = CHART_TOP;
        var yMin = cfg.yMin;
        var yMax = cfg.yMax;
        var srcExpr =
            'var y=thisComp.layer("' + trackerName + '").transform.position[1];\n' +
            'var pct=1-(y-' + cTop + ')/(' + cBot + '-' + cTop + ');\n' +
            'pct=Math.max(0,Math.min(1,pct));\n' +
            'var val=pct*(' + yMax + '-' + yMin + ')+' + yMin + ';\n' +
            'Math.round(val).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g," ");';
        try { textProp.expression = srcExpr; } catch (e) {}
        var posExpr =
            'var p=thisComp.layer("' + trackerName + '").transform.position;\n' +
            '[p[0],p[1]-' + RUNNING_OFFSET_Y + '];';
        try { tl.transform.position.expression = posExpr; } catch (e) {}
        // Fade in opacity 0→100 från frame 66 (2s+18f) under 6 frames
        try {
            var fadeStartSec = (2 * COMP_FPS + 18) / COMP_FPS;
            var fadeEndSec   = (2 * COMP_FPS + 24) / COMP_FPS;
            tl.transform.opacity.setValueAtTime(fadeStartSec, 0);
            tl.transform.opacity.setValueAtTime(fadeEndSec, 100);
        } catch (e) {}
        return tl;
    }
    function createDataPointLabels(comp, sName, dataPoints, cfg) {
        var layers = [];
        for (var i = 0; i < dataPoints.length; i++) {
            var pt     = dataPoints[i];
            var ptName = sName + "_pt" + i;
            var tl = comp.layers.addText(formatValue(pt.value));
            tl.name    = "Label_" + sName + "_" + pt.year;
            tl.enabled = false;
            tl.shy     = true;
            var textProp = tl.property("ADBE Text Properties").property("ADBE Text Document");
            applyTextStyle(textProp, FONT_SIZE_LABEL, [1, 1, 1], ParagraphJustification.CENTER_JUSTIFY);
            var posExpr =
                'var nl=thisComp.layer("' + ptName + '");\n' +
                '[nl.transform.position[0],nl.transform.position[1]-' + LABEL_OFFSET_Y + '];';
            try { tl.transform.position.expression = posExpr; } catch (e) {}
            layers.push(tl);
        }
        return layers;
    }
    function createLegend(comp, cfg) {
        var LEGEND_Y      = CHART_BOTTOM + 145;
        var SWATCH_W      = 70;
        var SWATCH_STROKE = 8;
        var TEXT_GAP      = 22;
        var ITEM_GAP      = 90;
        var FONT_SIZE_LEG = 50;
        var CHAR_W_EST    = FONT_SIZE_LEG * 0.52;

        var itemW = [];
        for (var i = 0; i < cfg.seriesKeys.length; i++) {
            itemW.push(SWATCH_W + TEXT_GAP + cfg.seriesKeys[i].length * CHAR_W_EST);
        }
        var totalW = 0;
        for (var j = 0; j < itemW.length; j++) {
            totalW += itemW[j];
            if (j < itemW.length - 1) { totalW += ITEM_GAP; }
        }

        var startX = (COMP_WIDTH - totalW) / 2;

        var sl = comp.layers.addShape();
        sl.name = "Legend_Swatches";
        sl.transform.anchorPoint.setValue([0, 0]);
        sl.transform.position.setValue([0, 0]);
        var root = sl.property("ADBE Root Vectors Group");
        var curX = startX;
        for (var si = 0; si < cfg.seriesKeys.length; si++) {
            var col  = COLOR_PALETTE[si % COLOR_PALETTE.length];
            var x1   = curX;
            var x2   = curX + SWATCH_W;
            var grp    = root.addProperty("ADBE Vector Group");
            grp.name   = "Swatch_" + si;
            var grpVec = grp.property("ADBE Vectors Group");
            var pathGrp  = grpVec.addProperty("ADBE Vector Shape - Group");
            var pathProp = pathGrp.property("ADBE Vector Shape");
            try {
                var sh = new Shape();
                sh.vertices    = [[x1, LEGEND_Y], [x2, LEGEND_Y]];
                sh.inTangents  = [[0, 0], [0, 0]];
                sh.outTangents = [[0, 0], [0, 0]];
                sh.closed = false;
                pathProp.setValue(sh);
            } catch (e) {}
            var stroke = grpVec.addProperty("ADBE Vector Graphic - Stroke");
            try { stroke.property("ADBE Vector Stroke Width").setValue(SWATCH_STROKE); } catch (e) {}
            try { stroke.property("ADBE Vector Stroke Line Cap").setValue(2); } catch (e) {}
            try { stroke.property("ADBE Vector Stroke Color").setValue([col[0], col[1], col[2], 1]); } catch (e) {}
            curX += itemW[si] + ITEM_GAP;
        }

        curX = startX;
        for (var ti = 0; ti < cfg.seriesKeys.length; ti++) {
            var lbl   = cfg.seriesKeys[ti];
            var textX = curX + SWATCH_W + TEXT_GAP;
            var tl    = comp.layers.addText(lbl);
            tl.name   = "Legend_" + sanitizeName(lbl);
            var textProp = tl.property("ADBE Text Properties").property("ADBE Text Document");
            applyTextStyle(textProp, FONT_SIZE_LEG, [1, 1, 1], ParagraphJustification.LEFT_JUSTIFY);
            tl.transform.position.setValue([textX, LEGEND_Y + FONT_SIZE_LEG * 0.33]);
            curX += itemW[ti] + ITEM_GAP;
        }
    }

    function createXAxisLabels(comp, cfg) {
        var years = cfg.uniqueYears;
        if (years.length === 0) { return; }
        var toShow = (years.length === 1)
            ? [years[0]]
            : [years[0], years[years.length - 1]];
        for (var i = 0; i < toShow.length; i++) {
            var yr  = toShow[i];
            var xPx = dataToCompPos(yr, cfg.yMin, cfg)[0];
            var tl  = comp.layers.addText(yr.toString());
            tl.name = "XLabel_" + yr;
            var textProp = tl.property("ADBE Text Properties").property("ADBE Text Document");
            applyTextStyle(textProp, FONT_SIZE_LABEL, [1, 1, 1], ParagraphJustification.CENTER_JUSTIFY);
            tl.transform.position.setValue([xPx, CHART_BOTTOM + FONT_SIZE_LABEL + 20]);
        }
    }
    function createSeriesLayers(comp, sIdx, sKey, cfg) {
        var sName = "S" + sIdx + "_" + sanitizeName(sKey);
        var pts   = cfg.seriesMap[sKey];
        var col   = COLOR_PALETTE[sIdx % COLOR_PALETTE.length];

        var allLayers = [];
        allLayers.push(createSeriesController(comp, sKey, col));

        var ptNulls = createPointNulls(comp, sName, pts, cfg);
        for (var a = 0; a < ptNulls.length; a++) { allLayers.push(ptNulls[a]); }

        allLayers.push(createLineShapeLayer(comp, sName, sKey, pts, cfg));
        allLayers.push(createTrackerNull(comp, sName));

        var lbls = createDataPointLabels(comp, sName, pts, cfg);
        for (var b = 0; b < lbls.length; b++) { allLayers.push(lbls[b]); }

        allLayers.push(createRunningLabel(comp, sName, cfg));

        var indices = [];
        for (var k = 0; k < allLayers.length; k++) {
            if (allLayers[k]) { indices.push(allLayers[k].index); }
        }
        indices.sort(function (a, b) { return a - b; });
        var precompLayer = null;
        try {
            precompLayer = comp.layers.precompose(indices, "Serie_" + sName, true);
            if (precompLayer && precompLayer.source) {
                try { precompLayer.source.hideShyLayers = true; } catch (e2) {}
            }
        } catch (e) {}
        return precompLayer;
    }
    // Huvudfunktion: läser data och skapar hela kompositionen
    function createChart(footageItem, statusEl) {
        if (!app.project) { throw new Error("Inget projekt öppet."); }
        setStatus("Läser JSON-data\u2026", statusEl);
        var cfg = parseChartData(footageItem);
        var maxPts = 0;
        for (var si = 0; si < cfg.seriesKeys.length; si++) {
            var n = cfg.seriesMap[cfg.seriesKeys[si]].length;
            if (n > maxPts) { maxPts = n; }
        }
        var animFrames = ANIM_DURATION_SEC * COMP_FPS;
        cfg.framesPerSegment = (maxPts > 1)
            ? Math.max(1, Math.floor(animFrames / (maxPts - 1)))
            : animFrames;
        var totalFrames = COMP_DURATION_SEC * COMP_FPS;
        var fname        = footageItem.mainSource.file.name;
        var compName     = fname.replace(/\.json$/i, "") + "_v2";
        setStatus("Skapar komposition\u2026", statusEl);
        app.beginUndoGroup("Skapa diagram v2: " + compName);
        var comp;
        try {
            comp = app.project.items.addComp(
                compName, COMP_WIDTH, COMP_HEIGHT, 1,
                totalFrames / COMP_FPS, COMP_FPS
            );
            createBackground(comp);
            createGridLines(comp, cfg);
            createYAxisLabels(comp, cfg);
            createXAxisLabels(comp, cfg);
            var precompLayers = [];
            for (var si2 = 0; si2 < cfg.seriesKeys.length; si2++) {
                setStatus(
                    "Skapar serie " + (si2 + 1) + " / " + cfg.seriesKeys.length + "\u2026",
                    statusEl
                );
                var pcLayer = createSeriesLayers(comp, si2, cfg.seriesKeys[si2], cfg);
                if (pcLayer) { precompLayers.push(pcLayer); }
            }
            createLegend(comp, cfg);
            if (precompLayers.length > 0) {
                try {
                    var folder = app.project.items.addFolder("Serie Pre-comps – " + compName);
                    for (var pci = 0; pci < precompLayers.length; pci++) {
                        try { precompLayers[pci].source.parentFolder = folder; } catch (e2) {}
                    }
                } catch (e3) {}
            }
        } catch (e) {
            app.endUndoGroup();
            throw e;
        }
        app.endUndoGroup();
        try { comp.openInViewer(); } catch (e) {}
        var infoLines = [
            "Klart! " + cfg.seriesKeys.length + " serie(r) skapade.",
            "yMax (auto): " + formatValue(cfg.yMax),
            "Komp: " + compName
        ];
        setStatus(infoLines.join("\n"), statusEl);
    }
    // =========================================================================
    // UI
    // =========================================================================

    function loadInstalledFonts() {
        var result = [];
        try {
            var all = app.fonts.allFonts;
            for (var i = 0; i < all.length; i++) {
                var parts = all[i].toString().split(",");
                for (var j = 0; j < parts.length; j++) {
                    var name = parts[j].replace(/^\s+|\s+$/g, "");
                    if (name !== "") { result.push(name); }
                }
            }
            result.sort();
        } catch (e) {}
        return result;
    }

    var jsonItems = [];
    function refreshDropdown(dd) {
        dd.removeAll();
        jsonItems = findJsonFiles();
        if (jsonItems.length === 0) {
            dd.add("item", "(inga JSON-filer i projektet)");
        } else {
            for (var i = 0; i < jsonItems.length; i++) {
                dd.add("item", jsonItems[i].name);
            }
        }
        if (dd.items.length > 0) { dd.selection = 0; }
    }
    function buildUI(w) {
        w.orientation   = "column";
        w.alignChildren = ["fill", "top"];
        w.spacing       = 6;
        w.margins       = 10;
        var hdr = w.add("group");
        hdr.alignment = ["center", "top"];
        var ttl = hdr.add("statictext", undefined, "Chart Diagram Generator v2");
        ttl.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);
        w.add("panel", undefined, "").alignment = ["fill", "top"];
        var row = w.add("group");
        row.orientation   = "row";
        row.alignChildren = ["fill", "center"];
        var lbl = row.add("statictext", undefined, "JSON:");
        lbl.minimumSize = [38, -1];
        var dd = row.add("dropdownlist", undefined, []);
        dd.alignment = ["fill", "center"];
        var refBtn = row.add("button", undefined, "\u21ba");
        refBtn.maximumSize = [28, 22];

        var fontRow = w.add("group");
        fontRow.orientation   = "row";
        fontRow.alignChildren = ["fill", "center"];
        var fontLbl = fontRow.add("statictext", undefined, "Font:");
        fontLbl.minimumSize = [38, -1];
        var fontFilter = fontRow.add("edittext", undefined, "");
        fontFilter.alignment = ["fill", "center"];
        fontFilter.helpTip   = "Filtrera teckensnitt";

        var fontList = w.add("listbox", [0, 0, 0, 90], [], { multiselect: false });
        fontList.alignment = ["fill", "top"];

        var installedFonts = loadInstalledFonts();

        function populateFontList(filter) {
            fontList.removeAll();
            filter = (filter || "").replace(/^\s+|\s+$/g, "").toLowerCase();
            for (var i = 0; i < installedFonts.length; i++) {
                var name = installedFonts[i];
                if (filter === "" || name.toLowerCase().indexOf(filter) !== -1) {
                    var item = fontList.add("item", name.length > 36 ? name.substring(0, 33) + "..." : name);
                    item.fullName = name;
                    if (name === selectedFont) { fontList.selection = fontList.items.length - 1; }
                }
            }
            if (installedFonts.length === 0) {
                fontList.add("item", "(inga teckensnitt hittades)");
            }
        }

        fontFilter.onChanging = function () { populateFontList(fontFilter.text); };

        fontList.onChange = function () {
            if (fontList.selection) {
                var picked = fontList.selection.fullName || fontList.selection.text;
                if (picked.charAt(0) !== "(") { selectedFont = picked; }
            }
        };

        populateFontList();

        var createBtn = w.add("button", undefined, "Skapa diagram");
        createBtn.alignment = ["fill", "top"];
        w.add("panel", undefined, "").alignment = ["fill", "top"];
        var statusEl = w.add("statictext", undefined, "Redo.", { multiline: true });
        statusEl.alignment   = ["fill", "top"];
        statusEl.minimumSize = [200, 60];
        refreshDropdown(dd);
        refBtn.onClick = function () { refreshDropdown(dd); };
        createBtn.onClick = function () {
            if (!app.project) {
                statusEl.text = "Inget projekt öppet.";
                return;
            }
            if (jsonItems.length === 0) {
                statusEl.text = "Inga JSON-filer hittades.\nImportera en JSON-fil och klicka \u21ba.";
                return;
            }
            var idx  = dd.selection ? dd.selection.index : 0;
            var item = jsonItems[idx];
            if (!item) {
                statusEl.text = "V\u00e4lj en JSON-fil i listan.";
                return;
            }
            try {
                createChart(item, statusEl);
            } catch (e) {
                statusEl.text = "Fel: " + e.message;
            }
        };
    }
    // =========================================================================
    // INIT
    // =========================================================================
    var palette;
    if (thisObj instanceof Panel) {
        palette = thisObj;
        buildUI(palette);
        palette.layout.layout(true);
    } else {
        palette = new Window("palette", "Chart Diagram Generator v2", undefined, { resizeable: true });
        buildUI(palette);
        palette.layout.layout(true);
        palette.layout.resize();
        palette.onResizing = palette.onResize = function () { palette.layout.resize(); };
        palette.show();
    }
}(this));
