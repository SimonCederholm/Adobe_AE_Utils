/**
 * @name        Animated Chart JSON
 * @category    scripts
 * @type        script
 * @description Skapar ett animerat linjediagram i AE från en JSON-fil (data.json).
 *              Bygger ett Controller-null med Dropdown Menu Control för serieväxling,
 *              år-namnade nulls med expressions, en shapelinje med Trim Paths-animation,
 *              ett Tracker-null och ett rörligt värdetext-lager.
 * @usage       Importera data.json till projektet, kör panelen och klicka "Skapa diagram".
 * @ae-version  2026
 */

(function animatedChartJson(thisObj) {

    // =========================================================================
    // KONSTANTER  –  justera dessa vid behov
    // =========================================================================

    var CHART_LEFT         = 140;   // px, vänster kant av diagramytan
    var CHART_RIGHT        = 1300;  // px, höger kant av diagramytan
    var CHART_TOP          = 200;   // px, övre kant (höga värden)
    var CHART_BOTTOM       = 1200;  // px, nedre kant (låga värden)
    var FRAMES_PER_SEGMENT = 5;     // frames per segment (år till år)
    var ANIM_START_FRAME   = 24;    // frame där trim-path-animeringen börjar
    var ANIM_TAIL_FRAMES   = 48;    // extra frames efter att animationen är klar
    var STROKE_WIDTH       = 4;     // px, linjebredd
    var COMP_WIDTH         = 1440;  // px
    var COMP_HEIGHT        = 1440;  // px
    var COMP_FPS           = 24;
    var FONT_NAME          = "Arial-BoldMT";
    var FONT_SIZE_RUNNING  = 36;
    var FONT_SIZE_LABEL    = 28;
    var RUNNING_OFFSET_Y   = 60;    // px ovanför tracker-null för running label
    var LABEL_OFFSET_Y     = 50;    // px ovanför datapunkt för dolda datalabels
    var CONTROLLER_NAME    = "Controller";
    var SERIE_EFFECT_NAME  = "Serie";
    var LINE_LAYER_NAME    = "Chart Line";
    var TRACKER_NAME       = "Tracker_chart";
    var RUNNING_NAME       = "Running_chart";

    // =========================================================================
    // HELPERS
    // =========================================================================

    function setStatus(txt, el) {
        if (!el) { return; }
        try { el.text = txt; el.parent.layout.layout(true); } catch (e) {}
    }

    // Avrundar uppåt till ett "snyggt" tal (1, 2, 5 × 10^n)
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

    function formatValue(num) {
        var r = Math.round(num);
        return r.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
    }

    // Konverterar data-koordinater → pixelposition [x, y]
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

    function setEaseEase(prop, keyIdx) {
        try {
            var e = new KeyframeEase(0, 33.33);
            prop.setTemporalEaseAtKey(keyIdx, [e], [e]);
        } catch (err) {}
    }

    function applyTextStyle(textProp, fontSize, fillColor, justify) {
        try {
            var td = textProp.value;
            td.font        = FONT_NAME;
            td.fontSize    = fontSize;
            td.fillColor   = fillColor;
            td.applyFill   = true;
            td.applyStroke = false;
            if (justify !== undefined) { td.justification = justify; }
            textProp.setValue(td);
        } catch (e) {}
    }

    // =========================================================================
    // DATA
    // =========================================================================

    // Söker igenom projektet efter JSON-footage; returnerar array av FootageItems
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

    // Läser och parsar JSON-footage via File-objekt
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
        f.encoding = "UTF-8"; // Måste sättas EFTER open() i ExtendScript
        var content = f.read();
        f.close();

        content = content.replace(/^\uFEFF/, ""); // Strippa UTF-8 BOM
        content = content.replace(/^\s+|\s+$/g, "");

        if (content.length === 0) {
            throw new Error("Filen är tom eller kunde inte läsas.");
        }
        if (content.charAt(0) !== "{" && content.charAt(0) !== "[") {
            content = "{" + content + "}";
        }

        // Ta bort trailing commas (inte giltigt i ES3 eval)
        content = content.replace(/,(\s*[}\]])/g, "$1");

        var raw;
        try {
            raw = eval("(" + content + ")"); // eslint-disable-line no-eval
        } catch (e) {
            throw new Error("Ogiltig JSON: " + e.message);
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
            xMax        : uniqueYears[uniqueYears.length - 1],
            fileName    : footageItem.mainSource.file.name
        };
    }

    // =========================================================================
    // LAYER CREATION
    // =========================================================================

    // Skapar Controller-null med Dropdown Menu Control för serieväxling
    function createControllerLayer(comp, seriesKeys) {
        var nl  = comp.layers.addNull();
        nl.name = CONTROLLER_NAME;
        nl.enabled = false;

        var fx;
        try { fx = nl.Effects.addProperty("ADBE Dropdown Control"); } catch (e) {}
        if (!fx) {
            try { fx = nl.Effects.addProperty("Dropdown Menu Control"); } catch (e2) {}
        }
        if (!fx) { return nl; }
        fx.name = SERIE_EFFECT_NAME;

        // Populera dropdown-items med serienamnen
        try {
            fx.property("ADBE Dropdown Control-0001").setPropertyParameters(seriesKeys);
        } catch (e) {
            // Äldre API: bygg items manuellt om setPropertyParameters inte finns
            try {
                var menuProp = fx.property("Menu");
                for (var i = 0; i < seriesKeys.length; i++) {
                    menuProp.addProperty(seriesKeys[i]);
                }
            } catch (e2) {}
        }

        return nl;
    }

    // Skapar år-namnade null-lager vars Y-position styrs av en expression
    // som läser Controller-dropdown och hämtar data från footage("data.json")
    function createYearNulls(comp, cfg) {
        var years      = cfg.uniqueYears;
        var seriesKeys = cfg.seriesKeys;

        // Bygg en JS-arrayliteral med serienamn för inbäddning i expression
        var keysLiteral = "[";
        for (var ki = 0; ki < seriesKeys.length; ki++) {
            keysLiteral += '"' + seriesKeys[ki].replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
            if (ki < seriesKeys.length - 1) { keysLiteral += ","; }
        }
        keysLiteral += "]";

        for (var i = 0; i < years.length; i++) {
            var year  = years[i];
            var xPos  = dataToCompPos(year, 0, cfg)[0];

            // Beräkna ett initialvärde för Y (första serien) för statisk start
            var firstSeriesPts = cfg.seriesMap[seriesKeys[0]];
            var initVal = 0;
            for (var pi = 0; pi < firstSeriesPts.length; pi++) {
                if (firstSeriesPts[pi].year === year) {
                    initVal = firstSeriesPts[pi].value;
                    break;
                }
            }
            var initPos = dataToCompPos(year, initVal, cfg);

            var nl  = comp.layers.addNull();
            nl.name = year.toString();
            nl.transform.anchorPoint.setValue([0, 0]);
            nl.transform.position.setValue(initPos);
            nl.enabled = false;
            nl.moveToEnd();

            // Position-expression: X statiskt, Y beräknat från dropdown + JSON
            var posExpr =
                'var dd=thisComp.layer("' + CONTROLLER_NAME + '").effect("' + SERIE_EFFECT_NAME + '")("Menu");\n' +
                'var year=thisLayer.name;\n' +
                'eval("var d="+footage("' + cfg.fileName + '").sourceText);\n' +
                'var keys=' + keysLiteral + ';\n' +
                'var sName=keys[dd-1];\n' +
                'var val=(d[sName]&&d[sName][year])?parseFloat(d[sName][year]):0;\n' +
                'var yMin=' + cfg.yMin + ';\n' +
                'var yMax=' + cfg.yMax + ';\n' +
                'var cTop=' + CHART_TOP + ';\n' +
                'var cBot=' + CHART_BOTTOM + ';\n' +
                'var yPct=(yMax===yMin)?0.5:(val-yMin)/(yMax-yMin);\n' +
                'var y=cBot-yPct*(cBot-cTop);\n' +
                '[' + xPos + ',y];';

            try { nl.transform.position.expression = posExpr; } catch (e) {}
        }
    }

    // Skapar shapelayer med path-expression, stroke och animerad Trim Paths
    function createLineShapeLayer(comp, cfg) {
        var years  = cfg.uniqueYears;
        var numPts = years.length;

        var sl = comp.layers.addShape();
        sl.name = LINE_LAYER_NAME;
        sl.transform.anchorPoint.setValue([0, 0]);
        sl.transform.position.setValue([0, 0]);

        var root   = sl.property("ADBE Root Vectors Group");
        var grp    = root.addProperty("ADBE Vector Group");
        grp.name   = "Path Group";
        var grpVec = grp.property("ADBE Vectors Group");

        // Path
        var pathGrp  = grpVec.addProperty("ADBE Vector Shape - Group");
        pathGrp.name = "Path 1";
        var pathProp = pathGrp.property("ADBE Vector Shape");

        // Sätt initial statisk path (behövs för att lagret ska vara giltigt)
        try {
            var dummy = new Shape();
            dummy.vertices    = [];
            dummy.inTangents  = [];
            dummy.outTangents = [];
            for (var pi = 0; pi < numPts; pi++) {
                var initPos = dataToCompPos(years[pi], 0, cfg);
                dummy.vertices.push(initPos);
                dummy.inTangents.push([0, 0]);
                dummy.outTangents.push([0, 0]);
            }
            dummy.closed = false;
            pathProp.setValue(dummy);
        } catch (e) {}

        // Bygg en JS-arrayliteral med årtalen för inbäddning i path-expression
        var yearsLiteral = "[";
        for (var yi = 0; yi < years.length; yi++) {
            yearsLiteral += '"' + years[yi] + '"';
            if (yi < years.length - 1) { yearsLiteral += ","; }
        }
        yearsLiteral += "]";

        // Path-expression: läser varje år-nulls position som path-punkter
        var pathExpr =
            'var pts=[],inT=[],outT=[];\n' +
            'var years=' + yearsLiteral + ';\n' +
            'for(var i=0;i<years.length;i++){\n' +
            '  var nl=thisComp.layer(years[i]);\n' +
            '  pts.push(fromCompToSurface(nl.toComp(nl.anchorPoint)));\n' +
            '  inT.push([0,0]);outT.push([0,0]);\n' +
            '}\n' +
            'createPath(pts,inT,outT,false);';
        try { pathProp.expression = pathExpr; } catch (e) {}

        // Stroke
        var stroke = grpVec.addProperty("ADBE Vector Graphic - Stroke");
        try { stroke.property("ADBE Vector Stroke Width").setValue(STROKE_WIDTH); } catch (e) {}
        try { stroke.property("ADBE Vector Stroke Line Cap").setValue(2); } catch (e) {} // Round
        try {
            stroke.property("ADBE Vector Stroke Color").setValue([1, 1, 1, 1]);
        } catch (e) {}

        // Trim Paths: End animeras 0% → 100%
        var trim        = grpVec.addProperty("ADBE Vector Filter - Trim");
        trim.name       = "Trim Paths 1";
        var startSec    = ANIM_START_FRAME / COMP_FPS;
        var endSec      = (ANIM_START_FRAME + (numPts - 1) * FRAMES_PER_SEGMENT) / COMP_FPS;
        var trimEndProp = trim.property("ADBE Vector Trim End");
        try {
            trimEndProp.setValueAtTime(startSec, 0);
            trimEndProp.setValueAtTime(endSec, 100);
            setEaseEase(trimEndProp, 1);
            setEaseEase(trimEndProp, 2);
        } catch (e) {}

        return sl;
    }

    // Skapar Tracker-null vars position följer trim-path-slutpunkten
    function createTrackerNull(comp) {
        var nl    = comp.layers.addNull();
        nl.name   = TRACKER_NAME;
        nl.enabled = false;
        nl.moveToEnd();

        var expr =
            'var sl=thisComp.layer("' + LINE_LAYER_NAME + '");\n' +
            'var g=sl.content("Path Group");\n' +
            'var t=g.content("Trim Paths 1").end/100;\n' +
            'sl.toComp(g.content("Path 1").path.pointOnPath(t));';
        try { nl.transform.position.expression = expr; } catch (e) {}

        return nl;
    }

    // Skapar rörligt värdestext-lager som följer Tracker-nullet
    function createRunningLabel(comp, cfg) {
        var tl  = comp.layers.addText("0");
        tl.name = RUNNING_NAME;

        var textProp = tl.property("ADBE Text Properties").property("ADBE Text Document");
        applyTextStyle(textProp, FONT_SIZE_RUNNING, [1, 1, 1], ParagraphJustification.CENTER_JUSTIFY);

        // Source text: inverterad Y→värde-formel med tusentalsavgränsare
        var cTop = CHART_TOP;
        var cBot = CHART_BOTTOM;
        var yMin = cfg.yMin;
        var yMax = cfg.yMax;
        var srcExpr =
            'var y=thisComp.layer("' + TRACKER_NAME + '").transform.position[1];\n' +
            'var pct=1-(y-' + cTop + ')/(' + cBot + '-' + cTop + ');\n' +
            'pct=Math.max(0,Math.min(1,pct));\n' +
            'var val=pct*(' + yMax + '-' + yMin + ')+' + yMin + ';\n' +
            'Math.round(val).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g,"\u00a0");';
        try { textProp.expression = srcExpr; } catch (e) {}

        // Position: följer Tracker-nullet, förskjutet uppåt
        var posExpr =
            'var p=thisComp.layer("' + TRACKER_NAME + '").transform.position;\n' +
            '[p[0],p[1]-' + RUNNING_OFFSET_Y + '];';
        try { tl.transform.position.expression = posExpr; } catch (e) {}

        return tl;
    }

    // Skapar dolda x-axel-labels (år) längs underkanten
    function createXAxisLabels(comp, cfg) {
        var years = cfg.uniqueYears;
        for (var i = 0; i < years.length; i++) {
            var xPx = dataToCompPos(years[i], cfg.yMin, cfg)[0];
            var tl  = comp.layers.addText(years[i].toString());
            tl.name = "XLabel_" + years[i];

            var textProp = tl.property("ADBE Text Properties").property("ADBE Text Document");
            applyTextStyle(textProp, FONT_SIZE_LABEL, [1, 1, 1], ParagraphJustification.CENTER_JUSTIFY);
            tl.transform.position.setValue([xPx, CHART_BOTTOM + 40]);
        }
    }

    // =========================================================================
    // HUVUDFUNKTION
    // =========================================================================

    function createChart(footageItem, compName, statusEl) {
        if (!app.project) { throw new Error("Inget projekt öppet."); }

        setStatus("Läser JSON-data\u2026", statusEl);
        var cfg = parseChartData(footageItem);

        var maxPts = cfg.uniqueYears.length;
        var totalFrames = ANIM_START_FRAME + (maxPts - 1) * FRAMES_PER_SEGMENT + ANIM_TAIL_FRAMES;

        setStatus("Skapar komposition\u2026", statusEl);
        app.beginUndoGroup("Skapa animerat diagram: " + compName);

        try {
            var comp = app.project.items.addComp(
                compName, COMP_WIDTH, COMP_HEIGHT, 1,
                totalFrames / COMP_FPS, COMP_FPS
            );

            setStatus("Skapar år-nulls\u2026", statusEl);
            createYearNulls(comp, cfg);

            setStatus("Skapar linje\u2026", statusEl);
            createLineShapeLayer(comp, cfg);

            setStatus("Skapar tracker & värdestext\u2026", statusEl);
            createTrackerNull(comp);
            createRunningLabel(comp, cfg);

            setStatus("Skapar axeletiketter\u2026", statusEl);
            createXAxisLabels(comp, cfg);

            // Controller-null hamnar överst → skapas sist
            setStatus("Skapar Controller\u2026", statusEl);
            createControllerLayer(comp, cfg.seriesKeys);

        } catch (e) {
            app.endUndoGroup();
            throw e;
        }
        app.endUndoGroup();

        try { comp.openInViewer(); } catch (e) {}

        setStatus(
            "Klart! " + cfg.seriesKeys.length + " serie(r) i dropdown.\n" +
            "År: " + cfg.uniqueYears[0] + "\u2013" + cfg.uniqueYears[cfg.uniqueYears.length - 1] + "\n" +
            "yMax (auto): " + formatValue(cfg.yMax),
            statusEl
        );
    }

    // =========================================================================
    // UI
    // =========================================================================

    var jsonItems = [];

    function refreshDropdown(dd, compNameEl) {
        dd.removeAll();
        jsonItems = findJsonFiles();

        if (jsonItems.length === 0) {
            dd.add("item", "(inga JSON-filer i projektet)");
        } else {
            var dataJsonIdx = -1;
            for (var i = 0; i < jsonItems.length; i++) {
                dd.add("item", jsonItems[i].name);
                if (jsonItems[i].mainSource.file.name.toLowerCase() === "data.json") {
                    dataJsonIdx = i;
                }
            }
            // Auto-välj data.json om den finns
            dd.selection = (dataJsonIdx >= 0) ? dataJsonIdx : 0;
        }

        // Uppdatera föreslaget komp-namn utifrån vald fil
        updateCompName(dd, compNameEl);
    }

    function updateCompName(dd, compNameEl) {
        if (!compNameEl || !dd.selection || jsonItems.length === 0) { return; }
        var idx = dd.selection.index;
        if (idx < 0 || idx >= jsonItems.length) { return; }
        try {
            var fname = jsonItems[idx].mainSource.file.name;
            compNameEl.text = fname.replace(/\.json$/i, "");
        } catch (e) {}
    }

    function buildUI(w) {
        w.orientation   = "column";
        w.alignChildren = ["fill", "top"];
        w.spacing       = 6;
        w.margins       = 10;

        // Rubrik
        var hdr = w.add("group");
        hdr.alignment = ["center", "top"];
        var ttl = hdr.add("statictext", undefined, "Animated Chart JSON");
        ttl.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);

        w.add("panel", undefined, "").alignment = ["fill", "top"];

        // JSON-selector rad
        var jsonRow = w.add("group");
        jsonRow.orientation   = "row";
        jsonRow.alignChildren = ["fill", "center"];

        var jsonLbl = jsonRow.add("statictext", undefined, "JSON:");
        jsonLbl.minimumSize = [38, -1];

        var jsonDd = jsonRow.add("dropdownlist", undefined, []);
        jsonDd.alignment = ["fill", "center"];

        var refBtn = jsonRow.add("button", undefined, "\u21ba"); // ↺
        refBtn.maximumSize = [28, 22];

        // Komp-namn rad
        var compRow = w.add("group");
        compRow.orientation   = "row";
        compRow.alignChildren = ["fill", "center"];

        var compLbl = compRow.add("statictext", undefined, "Komp:");
        compLbl.minimumSize = [38, -1];

        var compNameEl = compRow.add("edittext", undefined, "");
        compNameEl.alignment = ["fill", "center"];

        // Skapa-knapp
        var createBtn = w.add("button", undefined, "Skapa diagram");
        createBtn.alignment = ["fill", "top"];

        w.add("panel", undefined, "").alignment = ["fill", "top"];

        // Statustext
        var statusEl = w.add("statictext", undefined, "Redo.", { multiline: true });
        statusEl.alignment   = ["fill", "top"];
        statusEl.minimumSize = [200, 60];

        // Fyll dropdown vid start
        refreshDropdown(jsonDd, compNameEl);

        // Händelsehanterare
        refBtn.onClick = function () {
            refreshDropdown(jsonDd, compNameEl);
        };

        jsonDd.onChange = function () {
            updateCompName(jsonDd, compNameEl);
        };

        createBtn.onClick = function () {
            if (!app.project) {
                statusEl.text = "Inget projekt öppet.";
                return;
            }
            if (jsonItems.length === 0) {
                statusEl.text = "Inga JSON-filer hittades.\nImportera data.json och klicka \u21ba.";
                return;
            }
            var idx  = jsonDd.selection ? jsonDd.selection.index : 0;
            var item = jsonItems[idx];
            if (!item) {
                statusEl.text = "Välj en JSON-fil i listan.";
                return;
            }
            var cName = compNameEl.text.replace(/^\s+|\s+$/g, "");
            if (cName.length === 0) { cName = "Chart"; }
            try {
                createChart(item, cName, statusEl);
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
        palette = new Window("palette", "Animated Chart JSON", undefined, { resizeable: true });
        buildUI(palette);
        palette.layout.layout(true);
        palette.layout.resize();
        palette.onResizing = palette.onResize = function () { palette.layout.resize(); };
        palette.show();
    }

}(this));
