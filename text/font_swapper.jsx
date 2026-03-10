/**
 * @name        Font Swapper
 * @category    text
 * @type        script
 * @description Scans the active comp or all comps for used fonts (Font A),
 *              lets you pick a replacement font (Font B) from installed fonts
 *              or type a PostScript name manually, then swaps all occurrences.
 * @usage       Install under Scripts/ScriptUI Panels/ in After Effects.
 *              Select scope, scan for fonts, pick Font A and Font B, click Swap.
 * @ae-version  2026
 */

(function fontSwapper(thisObj) {

    function getAllComps() {
        var comps = [], i, item;
        for (i = 1; i <= app.project.items.length; i++) {
            item = app.project.items[i];
            if (item instanceof CompItem) { comps.push(item); }
        }
        return comps;
    }

    function collectFontsFromComps(comps) {
        var fonts = {};

        function scanLayers(layers) {
            var i, k, layer, td, doc, t;
            for (i = 1; i <= layers.length; i++) {
                layer = layers[i];
                if (layer instanceof TextLayer) {
                    td = layer.property("ADBE Text Document");
                    if (td.numKeys > 0) {
                        for (k = 1; k <= td.numKeys; k++) {
                            t = td.keyTime(k);
                            doc = td.valueAtTime(t, false);
                            if (doc.font && doc.font !== "") { fonts[doc.font] = true; }
                        }
                    } else {
                        doc = td.valueAtTime(0, false);
                        if (doc.font && doc.font !== "") { fonts[doc.font] = true; }
                    }
                }
            }
        }

        var i;
        for (i = 0; i < comps.length; i++) { scanLayers(comps[i].layers); }

        var list = [], f;
        for (f in fonts) { if (fonts.hasOwnProperty(f)) { list.push(f); } }
        list.sort();
        return list;
    }

    function replaceFontsInComps(comps, oldFont, newFont) {
        var total = 0;

        function processLayers(layers) {
            var i, k, layer, td, doc, t;
            for (i = 1; i <= layers.length; i++) {
                layer = layers[i];
                if (layer instanceof TextLayer) {
                    td = layer.property("ADBE Text Document");
                    if (td.numKeys > 0) {
                        for (k = 1; k <= td.numKeys; k++) {
                            t = td.keyTime(k);
                            doc = td.valueAtTime(t, false);
                            if (doc.font === oldFont) {
                                doc.font = newFont;
                                td.setValueAtTime(t, doc);
                                total++;
                            }
                        }
                    } else {
                        doc = td.valueAtTime(0, false);
                        if (doc.font === oldFont) {
                            doc.font = newFont;
                            td.setValue(doc);
                            total++;
                        }
                    }
                }
            }
        }

        var i;
        for (i = 0; i < comps.length; i++) { processLayers(comps[i].layers); }
        return total;
    }

    function loadInstalledFonts() {
        var result = [];
        try {
            var all = app.fonts.allFonts;
            var i, name;
            for (i = 0; i < all.length; i++) {
                name = all[i].postScriptName;
                if (name && name !== "") { result.push(name); }
            }
            result.sort();
        } catch(e) {}
        return result;
    }

    function truncate(str, maxLen) {
        if (str.length <= maxLen) { return str; }
        return str.substring(0, maxLen - 3) + "...";
    }

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", "Font Swapper", undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 10;
        win.margins = 16;

        var titleTxt = win.add("statictext", undefined, "Font Swapper");
        titleTxt.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);

        // Scope
        var scopeGroup = win.add("panel", undefined, "Scope");
        scopeGroup.orientation = "row";
        scopeGroup.alignChildren = ["left", "center"];
        scopeGroup.margins = [10, 14, 10, 10];
        var radioActive = scopeGroup.add("radiobutton", undefined, "Active comp");
        var radioAll    = scopeGroup.add("radiobutton", undefined, "All comps in project");
        radioActive.value = true;

        // Font A
        var fromGroup = win.add("panel", undefined, "Font A  (replace this)");
        fromGroup.orientation = "column";
        fromGroup.alignChildren = ["fill", "top"];
        fromGroup.spacing = 6;
        fromGroup.margins = [10, 14, 10, 10];
        var listBoxA = fromGroup.add("listbox", [0, 0, 260, 110], [], { multiselect: false });
        var refreshBtn = fromGroup.add("button", undefined, "Scan");

        // Font B
        var toGroup = win.add("panel", undefined, "Font B  (replace with)");
        toGroup.orientation = "column";
        toGroup.alignChildren = ["fill", "top"];
        toGroup.spacing = 6;
        toGroup.margins = [10, 14, 10, 10];
        toGroup.add("statictext", undefined, "Filter installed fonts:");
        var searchInput = toGroup.add("edittext", undefined, "");
        var listBoxB = toGroup.add("listbox", [0, 0, 260, 110], [], { multiselect: false });
        toGroup.add("statictext", undefined, "Or type PostScript name manually:");
        var inputB = toGroup.add("edittext", undefined, "");

        // Status + button
        var statusTxt = win.add("statictext", undefined, " ");
        statusTxt.alignment = ["fill", "top"];
        var swapBtn = win.add("button", undefined, "Swap Fonts");
        swapBtn.enabled = false;

        // Load installed fonts once
        var installedFonts = loadInstalledFonts();

        function populateListB(filter) {
            listBoxB.removeAll();
            filter = (filter || "").replace(/^\s+|\s+$/g, "").toLowerCase();
            var i, name;
            for (i = 0; i < installedFonts.length; i++) {
                name = installedFonts[i];
                if (filter === "" || name.toLowerCase().indexOf(filter) !== -1) {
                    listBoxB.add("item", truncate(name, 38));
                    listBoxB.items[listBoxB.items.length - 1].fullName = name;
                }
            }
            if (installedFonts.length === 0) {
                listBoxB.add("item", "(no installed fonts found)");
            }
        }

        function setStatus(msg, isError) {
            statusTxt.text = msg;
            var col = isError ? [0.9, 0.3, 0.3, 1] : [0.3, 0.85, 0.4, 1];
            statusTxt.graphics.foregroundColor =
                statusTxt.graphics.newPen(statusTxt.graphics.PenType.SOLID_COLOR, col, 1);
        }

        function updateBtn() {
            swapBtn.enabled = (
                listBoxA.selection !== null &&
                inputB.text.replace(/\s/g, "") !== ""
            );
        }

        function getTargetComps() {
            if (radioAll.value) { return getAllComps(); }
            var comp = app.project.activeItem;
            return (comp instanceof CompItem) ? [comp] : [];
        }

        refreshBtn.onClick = function () {
            var comps = getTargetComps();
            if (comps.length === 0) { setStatus("No active composition.", true); return; }
            listBoxA.removeAll();
            var fonts = collectFontsFromComps(comps);
            if (fonts.length === 0) { setStatus("No text layers found.", true); return; }
            var i;
            for (i = 0; i < fonts.length; i++) {
                listBoxA.add("item", truncate(fonts[i], 38));
                listBoxA.items[listBoxA.items.length-1].fullName = fonts[i];
            }
            var scope = radioAll.value ? "project (" + comps.length + " comps)" : "\"" + comps[0].name + "\"";
            setStatus("Found " + fonts.length + " font(s) in " + scope + ".");
            updateBtn();
        };

        radioActive.onClick = refreshBtn.onClick;
        radioAll.onClick    = refreshBtn.onClick;
        listBoxA.onChange   = updateBtn;

        searchInput.onChanging = function () {
            populateListB(searchInput.text);
        };

        listBoxB.onChange = function () {
            if (listBoxB.selection) {
                var item = listBoxB.selection;
                var name = item.fullName || item.text;
                if (name.charAt(0) !== "(") {
                    inputB.text = name;
                    updateBtn();
                }
            }
        };

        inputB.onChanging = updateBtn;

        swapBtn.onClick = function () {
            var comps = getTargetComps();
            if (comps.length === 0) { setStatus("No active composition.", true); return; }
            if (!listBoxA.selection) { setStatus("Select a font to replace.", true); return; }
            var fontA = listBoxA.selection.fullName || listBoxA.selection.text;
            var fontB = inputB.text.replace(/^\s+|\s+$/g, "");
            if (fontB === "") { setStatus("Enter a replacement font.", true); return; }
            if (fontA === fontB) { setStatus("Font A and B are the same.", true); return; }

            app.beginUndoGroup("Font Swapper: " + fontA + " > " + fontB);
            try {
                var n = replaceFontsInComps(comps, fontA, fontB);
                if (n === 0) {
                    setStatus("No layers using \"" + fontA + "\" found.", true);
                } else {
                    var scope = radioAll.value ? comps.length + " comp(s)" : "\"" + comps[0].name + "\"";
                    setStatus("Done! Replaced " + n + " layer(s) across " + scope + ".");
                    refreshBtn.onClick();
                }
            } catch (e) {
                setStatus("Error: " + e.message, true);
            }
            app.endUndoGroup();
        };

        populateListB();
        refreshBtn.onClick();

        if (win instanceof Window) {
            win.center();
            win.show();
        } else {
            win.layout.layout(true);
        }

        return win;
    }

    buildUI(thisObj);

}(this));
