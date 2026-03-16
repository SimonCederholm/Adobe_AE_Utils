/**
 * @name        Chart Diagram Generator
 * @category    scripts
 * @type        script
 * @description Skapar ett animerat linjediagram i AE från en JSON-datafil.
 *              Genererar shapelayers med trim-path-animation, datapunktslabels
 *              och ett rörligt värdesvisare per serie.
 * @usage       Kör som ScriptUI-panel. Importera en JSON-fil till projektet,
 *              välj den i dropdown och klicka "Skapa diagram".
 * @ae-version  2026
 */

(function chartDiagramPanel(thisObj) {

    // =========================================================================
    // CONSTANTS  –  justera dessa vid behov
    // =========================================================================

    var CHART_LEFT            = 140;    // px, vänster kant av diagramytan
    var CHART_RIGHT           = 1300;   // px, höger kant av diagramytan
    var CHART_TOP             = 200;    // px, övre kant (höga värden)
    var CHART_BOTTOM          = 1200;   // px, nedre kant (låga värden)
    var FRAMES_PER_SEGMENT    = 5;      // frames per segment (datapunkt till datapunkt)
    var ANIM_START_FRAME      = 24;     // frame där trim-path-animeringen börjar
    var ANIM_TAIL_FRAMES      = 48;     // extra frames efter att animationen är klar
    var LABEL_OFFSET_Y        = 50;     // px ovanför datapunkt för dolda datalabels
    var RUNNING_OFFSET_Y      = 60;     // px ovanför tracker-null för running label
    var FONT_NAME             = "Arial-BoldMT";
    var FONT_SIZE_LABEL       = 28;
    var FONT_SIZE_RUNNING     = 36;
    var STROKE_WIDTH          = 4;
    var COMP_WIDTH            = 1440;
    var COMP_HEIGHT           = 1440;
    var COMP_FPS              = 24;
    var CONTROLLER_NAME       = "Color Controller";

    // Färgpalett per serie — index 0 = första serien, etc.
    var COLOR_PALETTE = [
        [1.00, 1.00, 1.00],   // vit
        [0.96, 0.36, 0.36],   // korallröd
        [1.00, 0.87, 0.20],   // gul
        [0.40, 0.80, 1.00],   // ljusblå
        [0.60, 0.90, 0.40],   // grön
        [0.90, 0.50, 1.00],   // lila
        [1.00, 0.65, 0.20],   // orange
        [0.40, 0.90, 0.80]    // turkos
    ];

    // =========================================================================
    // HELPERS
    // =========================================================================

    function sanitizeName(str) {
        return str.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 25);
    }

    // Avrundar rawMax uppåt till ett "snyggt" tal (1, 2, 5, 10 × 10^n)
    // Använder loop istället för Math.log för att undvika floating-point-fel
    // (t.ex. Math.log(1000)/Math.LN10 = 2.9999... → Math.floor ger 2 istället för 3)
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

    // Applicerar ease-ease på ett keyframe (index 1-baserat)
    function setEaseEase(prop, keyIdx) {
        try {
            var e = new KeyframeEase(0, 33.33);
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
            td.font        = FONT_NAME;
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

    // Söker igenom alla FootageItems i projektet och returnerar de som är .json
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

    // Läser och parsar JSON-footage; returnerar ett config-objekt med alla beräknade gränser
    function parseChartData(footageItem) {
        // Hämta filsökväg via fsName och skapa ett nytt File-objekt för att undvika caching
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

        // Strippa UTF-8 BOM (\uFEFF) och omgivande whitespace
        content = content.replace(/^\uFEFF/, "");
        content = content.replace(/^\s+|\s+$/g, "");

        if (content.length === 0) {
            throw new Error("Filen är tom eller kunde inte läsas.");
        }

        // Om filen saknar yttre { } (börjar direkt med "nyckel":) – lägg till dem
        if (content.charAt(0) !== "{" && content.charAt(0) !== "[") {
            content = "{" + content + "}";
        }

        // Ta bort trailing commas (vanligt i handskrivna JSON-filer) – ej giltigt i ES3 eval
        content = content.replace(/,(\s*[}\]])/g, "$1");

        var raw;
        try {
            // ScriptUI-paneler kör i ExtendScript (ES3) – JSON.parse finns inte, använd eval
            raw = eval("(" + content + ")"); // eslint-disable-line no-eval
        } catch (e) {
            var preview = content.substring(0, 120).replace(/[\r\n]/g, " ");
            throw new Error("Ogiltig JSON: " + e.message + "\nStart: " + preview);
        }

        // Hitta alla serie-nycklar på toppnivå
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

        // Sortera unika år
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

    // Skapar null-lager "Color Controller" med en ADBE Color Control per serie
    function createControllerLayer(comp, seriesKeys) {
        var nl = comp.layers.addNull();
        nl.name    = CONTROLLER_NAME;
        nl.enabled = false;

        for (var i = 0; i < seriesKeys.length; i++) {
            var fx = addFX(nl, "ADBE Color Control", "Color Control");
            if (!fx) { continue; }
            fx.name = seriesKeys[i];
            var col = COLOR_PALETTE[i % COLOR_PALETTE.length];
            try {
                fx.property("ADBE Color Control-0001").setValue([col[0], col[1], col[2], 1]);
            } catch (e) {
                try { fx.property(1).setValue([col[0], col[1], col[2], 1]); } catch (e2) {}
            }
        }
        return nl;
    }

    // Skapar ett dolt null-lager per datapunkt — dessa fungerar som hantag för path-expressionen
    function createPointNulls(comp, sName, dataPoints, cfg) {
        for (var i = 0; i < dataPoints.length; i++) {
            var pos = dataToCompPos(dataPoints[i].year, dataPoints[i].value, cfg);
            var nl  = comp.layers.addNull();
            nl.name = sName + "_pt" + i;
            nl.transform.anchorPoint.setValue([0, 0]);
            nl.transform.position.setValue(pos);
            nl.enabled = false;
            nl.moveToEnd(); // Skicka null-lager till botten av lagerstacken
        }
    }

    // Skapar ett shapelayer med path-expression, stroke och animerad trim path
    function createLineShapeLayer(comp, sName, displayName, dataPoints, cfg) {
        var numPts = dataPoints.length;
        var sl = comp.layers.addShape();
        sl.name = "Line_" + sName;
        // position=[0,0] och anchor=[0,0] gör att komp-koordinater = lokala koordinater
        sl.transform.anchorPoint.setValue([0, 0]);
        sl.transform.position.setValue([0, 0]);

        var root   = sl.property("ADBE Root Vectors Group");
        var grp    = root.addProperty("ADBE Vector Group");
        grp.name   = "Path Group";
        var grpVec = grp.property("ADBE Vectors Group");

        // Lägg till path-grupp
        var pathGrp  = grpVec.addProperty("ADBE Vector Shape - Group");
        pathGrp.name = "Path 1";
        var pathProp = pathGrp.property("ADBE Vector Shape");

        // Sätt initial statisk path (ersätts av expression men behövs för att lagret ska vara giltigt)
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

        // Path-expression: läser null-lagrets position för varje datapunkt
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

        // Stroke (ingen fill)
        var stroke = grpVec.addProperty("ADBE Vector Graphic - Stroke");
        try { stroke.property("ADBE Vector Stroke Width").setValue(STROKE_WIDTH); } catch (e) {}
        try { stroke.property("ADBE Vector Stroke Line Cap").setValue(2); } catch (e) {} // Round cap
        try {
            var initCol = COLOR_PALETTE[0];
            stroke.property("ADBE Vector Stroke Color").setValue([initCol[0], initCol[1], initCol[2], 1]);
        } catch (e) {}
        // Länka linjefärgen till Color Controller
        // Escapar citattecken i serienamnet så att expression-strängen alltid är giltig JS
        var safeDisplay = displayName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        var colorExpr = 'thisComp.layer("' + CONTROLLER_NAME + '").effect("' + safeDisplay + '")("Color");';
        try { stroke.property("ADBE Vector Stroke Color").expression = colorExpr; } catch (e) {}

        // Trim Paths med animerad End: 0% → 100% med ease-ease
        var trim = grpVec.addProperty("ADBE Vector Filter - Trim");
        trim.name = "Trim Paths 1";
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

    // Skapar ett dolt null-lager vars position följer slutpunkten för den animerade linjen
    function createTrackerNull(comp, sName) {
        var nl = comp.layers.addNull();
        nl.name    = "Tracker_" + sName;
        nl.enabled = false;
        nl.moveToEnd();

        // Expression: läser trim path End och beräknar positionen längs banan med pointOnPath
        var expr =
            'var sl=thisComp.layer("Line_' + sName + '");\n' +
            'var g=sl.content("Path Group");\n' +
            'var t=g.content("Trim Paths 1").end/100;\n' +
            'sl.toComp(g.content("Path 1").path.pointOnPath(t));';
        try { nl.transform.position.expression = expr; } catch (e) {}

        return nl;
    }

    // Skapar ett textlager som visar aktuellt avrundат värde och följer tracker-nullet
    function createRunningLabel(comp, sName, cfg) {
        var trackerName = "Tracker_" + sName;
        var tl = comp.layers.addText("0");
        tl.name = "Running_" + sName;

        var textProp = tl.property("ADBE Text Properties").property("ADBE Text Document");
        applyTextStyle(textProp, FONT_SIZE_RUNNING, [1, 1, 1], ParagraphJustification.CENTER_JUSTIFY);

        // Source text expression: konverterar tracker-nullets Y-position tillbaka till ett datavärde
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

        // Position expression: följer tracker-nullet, förskjutet uppåt
        var posExpr =
            'var p=thisComp.layer("' + trackerName + '").transform.position;\n' +
            '[p[0],p[1]-' + RUNNING_OFFSET_Y + '];';
        try { tl.transform.position.expression = posExpr; } catch (e) {}

        return tl;
    }

    // Skapar ett dolt textlager per datapunkt — placerat ovanför punkten
    function createDataPointLabels(comp, sName, dataPoints, cfg) {
        for (var i = 0; i < dataPoints.length; i++) {
            var pt     = dataPoints[i];
            var ptName = sName + "_pt" + i;

            var tl = comp.layers.addText(formatValue(pt.value));
            tl.name    = "Label_" + sName + "_" + pt.year;
            tl.enabled = false; // Tänd dessa manuellt vid behov

            var textProp = tl.property("ADBE Text Properties").property("ADBE Text Document");
            applyTextStyle(textProp, FONT_SIZE_LABEL, [1, 1, 1], ParagraphJustification.CENTER_JUSTIFY);

            // Position: följer punkt-nullet uppåt
            var posExpr =
                'var nl=thisComp.layer("' + ptName + '");\n' +
                '[nl.transform.position[0],nl.transform.position[1]-' + LABEL_OFFSET_Y + '];';
            try { tl.transform.position.expression = posExpr; } catch (e) {}
        }
    }

    // Skapar statiska x-axel-labels (år) längs underkanten av diagrammet
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

    // Skapar alla lager för en enda dataserie
    function createSeriesLayers(comp, sIdx, sKey, cfg) {
        var sName = "S" + sIdx + "_" + sanitizeName(sKey);
        var pts   = cfg.seriesMap[sKey];

        createPointNulls(comp, sName, pts, cfg);         // Hantag (dolda nulls)
        createLineShapeLayer(comp, sName, sKey, pts, cfg); // Linje med trim-path
        createTrackerNull(comp, sName);                   // Tracker (dold null)
        createDataPointLabels(comp, sName, pts, cfg);     // Datapunktslabels (dolda)
        createRunningLabel(comp, sName, cfg);             // Running value text
    }

    // Huvudfunktion: läser data och skapar hela kompositionen
    function createChart(footageItem, statusEl) {
        if (!app.project) { throw new Error("Inget projekt öppet."); }

        setStatus("Läser JSON-data…", statusEl);
        var cfg = parseChartData(footageItem);

        // Beräkna komp-duration baserat på det max antal datapunkter som finns
        var maxPts = 0;
        for (var si = 0; si < cfg.seriesKeys.length; si++) {
            var n = cfg.seriesMap[cfg.seriesKeys[si]].length;
            if (n > maxPts) { maxPts = n; }
        }
        var totalFrames  = ANIM_START_FRAME + (maxPts - 1) * FRAMES_PER_SEGMENT + ANIM_TAIL_FRAMES;
        var fname        = footageItem.mainSource.file.name;
        var compName     = fname.replace(/\.json$/i, "");

        setStatus("Skapar komposition…", statusEl);
        app.beginUndoGroup("Skapa diagram: " + compName);

        var comp;
        try {
            comp = app.project.items.addComp(
                compName, COMP_WIDTH, COMP_HEIGHT, 1,
                totalFrames / COMP_FPS, COMP_FPS
            );

            for (var si2 = 0; si2 < cfg.seriesKeys.length; si2++) {
                setStatus(
                    "Skapar serie " + (si2 + 1) + " / " + cfg.seriesKeys.length + "…",
                    statusEl
                );
                createSeriesLayers(comp, si2, cfg.seriesKeys[si2], cfg);
            }

            createXAxisLabels(comp, cfg);
            createControllerLayer(comp, cfg.seriesKeys); // Sist → hamnar överst

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

        // Rubrik
        var hdr = w.add("group");
        hdr.alignment = ["center", "top"];
        var ttl = hdr.add("statictext", undefined, "Chart Diagram Generator");
        ttl.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);

        w.add("panel", undefined, "").alignment = ["fill", "top"];

        // JSON-selector rad
        var row = w.add("group");
        row.orientation   = "row";
        row.alignChildren = ["fill", "center"];

        var lbl = row.add("statictext", undefined, "JSON:");
        lbl.minimumSize = [38, -1];

        var dd = row.add("dropdownlist", undefined, []);
        dd.alignment = ["fill", "center"];

        var refBtn = row.add("button", undefined, "\u21ba"); // ↺
        refBtn.maximumSize = [28, 22];

        // Skapa-knapp
        var createBtn = w.add("button", undefined, "Skapa diagram");
        createBtn.alignment = ["fill", "top"];

        w.add("panel", undefined, "").alignment = ["fill", "top"];

        // Statustext
        var statusEl = w.add("statictext", undefined, "Redo.", { multiline: true });
        statusEl.alignment   = ["fill", "top"];
        statusEl.minimumSize = [200, 60];

        // Fyll dropdown vid start
        refreshDropdown(dd);

        // Knappar
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
                statusEl.text = "Välj en JSON-fil i listan.";
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
        palette = new Window("palette", "Chart Diagram Generator", undefined, { resizeable: true });
        buildUI(palette);
        palette.layout.layout(true);
        palette.layout.resize();
        palette.onResizing = palette.onResize = function () { palette.layout.resize(); };
        palette.show();
    }

}(this));
