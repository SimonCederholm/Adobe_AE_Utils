/**
 * @name        Green Screen Keyer
 * @category    scripts
 * @type        script
 * @description ScriptUI-panel för professionellt green screen-keyingflöde.
 *              Applicerar Keylight 1.2 + Key Cleaner + Advanced Spill Suppressor
 *              på markerade lager med ett knapptryck, och exponerar de viktigaste
 *              parametrarna för snabb justering direkt från panelen.
 * @usage       Kopiera till Scripts/ScriptUI Panels/ och öppna via Window-menyn i AE.
 * @ae-version  2026
 *
 * VERIFIERINGSNOTER:
 *
 *  Keylight 1.2 (The Foundry – medföljer AE):
 *    Match name: "Keylight-1.2" (ej verifierat i SDK) – displayName "Keylight 1.2"
 *    används som pålitlig fallback.
 *    Parametrar:
 *      "Screen Gain" och "Screen Balance" → direkt under effekten
 *      "Clip Black" / "Clip White" → i sub-gruppen "Screen Matte"
 *      "View" → direkt under effekten (dropdown)
 *    OBS: Keylight använder brittisk stavning: "Screen Colour" (ej Color).
 *    "Screen Colour" öppnas inte via API-skript – välj med eyedropper i Effect Controls.
 *
 *  View-dropdown-index (slutledda – verifieras i AE vid installation):
 *    0 = Composite Source
 *    1 = Status
 *    5 = Screen Matte
 *
 *  Key Cleaner:
 *    Match name: "ADBE Key Cleaner" (ej verifierat) – "Key Cleaner" som fallback.
 *    Parametrar: "Additional Edge Radius", "Reduce Chatter"
 *
 *  Advanced Spill Suppressor:
 *    Match name: "ADBE Advanced Spill Suppressor" (ej verifierat) – displayName som fallback.
 *    Parametrar: "Suppression"
 */
(function greenScreenKeyer(thisObj) {

    // ── Hjälpfunktioner ───────────────────────────────────────────────────────

    function getComp() {
        var item = app.project.activeItem;
        if (!item || !(item instanceof CompItem)) {
            alert("Ingen aktiv komposition.\nÖppna en komp och försök igen.");
            return null;
        }
        return item;
    }

    function getSelectedLayers(comp) {
        var layers = comp.selectedLayers;
        if (!layers || !layers.length) {
            alert("Markera minst ett lager och försök igen.");
            return null;
        }
        return layers;
    }

    // Lägger till effekt via matchName med fallback till displayName
    function addFX(layer, matchName, displayName) {
        try { return layer.Effects.addProperty(matchName); } catch (e) {}
        try { return layer.Effects.addProperty(displayName); } catch (e) {}
        return null;
    }

    // Kontrollerar om ett lager redan har en effekt med givet display name
    function hasEffect(layer, displayName) {
        var effects = layer.property("ADBE Effect Parade");
        if (!effects) return false;
        for (var i = 1; i <= effects.numProperties; i++) {
            try {
                if (effects.property(i).name === displayName) return true;
            } catch (e) {}
        }
        return false;
    }

    // Hämtar en effekt från ett lager baserat på display name
    function getEffect(layer, displayName) {
        var effects = layer.property("ADBE Effect Parade");
        if (!effects) return null;
        for (var i = 1; i <= effects.numProperties; i++) {
            try {
                var fx = effects.property(i);
                if (fx.name === displayName) return fx;
            } catch (e) {}
        }
        return null;
    }

    // Hämtar Keylight-effekten (hanterar möjlig namnvariation)
    function getKeylight(layer) {
        var kl = getEffect(layer, "Keylight 1.2");
        if (kl) return kl;
        kl = getEffect(layer, "Keylight");
        return kl;
    }

    // Generisk property-setter: söker direkt, ett djup och två djup
    function sp(fx, propName, val) {
        if (!fx) return;
        try { fx.property(propName).setValue(val); return; } catch (e) {}
        try {
            for (var i = 1; i <= fx.numProperties; i++) {
                var sub = fx.property(i);
                try { sub.property(propName).setValue(val); return; } catch (e2) {}
                try {
                    for (var j = 1; j <= sub.numProperties; j++) {
                        try { sub.property(j).property(propName).setValue(val); return; } catch (e3) {}
                    }
                } catch (e4) {}
            }
        } catch (e) {}
    }

    // Keylight Screen Matte-setter – Clip Black och Clip White sitter i sub-gruppen
    // "Screen Matte". Provar direkt, sedan via "Screen Matte"-sub-gruppen, sedan
    // generisk sökning.
    function setKlMatte(fx, clipBlack, clipWhite) {
        if (!fx) return;
        var setB = false, setW = false;
        try { fx.property("Clip Black").setValue(clipBlack); setB = true; } catch (e) {}
        try { fx.property("Clip White").setValue(clipWhite); setW = true; } catch (e) {}
        if (setB && setW) return;
        try {
            var matte = fx.property("Screen Matte");
            if (matte) {
                if (!setB) { try { matte.property("Clip Black").setValue(clipBlack); setB = true; } catch (e) {} }
                if (!setW) { try { matte.property("Clip White").setValue(clipWhite); setW = true; } catch (e) {} }
            }
        } catch (e) {}
        if (!setB) sp(fx, "Clip Black", clipBlack);
        if (!setW) sp(fx, "Clip White", clipWhite);
    }

    // Validerar numerisk inmatning – returnerar fallback om ogiltigt
    function parseNum(str, fallback) {
        var v = parseFloat(str);
        return isNaN(v) ? fallback : v;
    }

    // ── Kärnfunktioner ────────────────────────────────────────────────────────

    // Applicerar tre-effekt-stacken på ett enskilt lager.
    // Hoppar över effekter som redan finns.
    function applyStackToLayer(layer) {
        if (!hasEffect(layer, "Keylight 1.2")) {
            var kl = addFX(layer, "Keylight-1.2", "Keylight 1.2");
            if (kl) {
                sp(kl, "Screen Gain",    100);
                sp(kl, "Screen Balance", 50);
            }
        }
        if (!hasEffect(layer, "Key Cleaner")) {
            addFX(layer, "ADBE Key Cleaner", "Key Cleaner");
        }
        if (!hasEffect(layer, "Advanced Spill Suppressor")) {
            addFX(layer, "ADBE Advanced Spill Suppressor", "Advanced Spill Suppressor");
        }
    }

    function applyStack() {
        var comp = getComp();
        if (!comp) return;
        var layers = getSelectedLayers(comp);
        if (!layers) return;

        app.beginUndoGroup("Apply Green Screen Stack");
        try {
            for (var i = 0; i < layers.length; i++) {
                applyStackToLayer(layers[i]);
            }
        } catch (e) {
            app.endUndoGroup();
            alert("Fel vid applicering:\n" + e.toString());
            return;
        }
        app.endUndoGroup();
    }

    function setKeylightValues(gain, balance, viewIdx, clipBlack, clipWhite) {
        var comp = getComp();
        if (!comp) return;
        var layers = getSelectedLayers(comp);
        if (!layers) return;

        app.beginUndoGroup("Set Keylight Values");
        try {
            for (var i = 0; i < layers.length; i++) {
                var kl = getKeylight(layers[i]);
                if (!kl) {
                    alert("Keylight 1.2 saknas på lagret \"" + layers[i].name +
                          "\".\nAnvänd Apply Keylight Stack först.");
                    continue;
                }
                sp(kl, "Screen Gain",    gain);
                sp(kl, "Screen Balance", balance);
                try { kl.property("View").setValue(viewIdx); } catch (e) {}
                setKlMatte(kl, clipBlack, clipWhite);
            }
        } catch (e) {
            app.endUndoGroup();
            alert("Fel vid Keylight-inställning:\n" + e.toString());
            return;
        }
        app.endUndoGroup();
    }

    function applyKeylightView(viewIdx) {
        var comp = app.project.activeItem;
        if (!comp || !(comp instanceof CompItem)) return;
        var layers = comp.selectedLayers;
        if (!layers || !layers.length) return;

        app.beginUndoGroup("Keylight View");
        try {
            for (var i = 0; i < layers.length; i++) {
                var kl = getKeylight(layers[i]);
                if (kl) {
                    try { kl.property("View").setValue(viewIdx); } catch (e) {}
                }
            }
        } catch (e) {}
        app.endUndoGroup();
    }

    function setKeyCleanerValues(edgeRadius, chatter) {
        var comp = getComp();
        if (!comp) return;
        var layers = getSelectedLayers(comp);
        if (!layers) return;

        app.beginUndoGroup("Set Key Cleaner Values");
        try {
            for (var i = 0; i < layers.length; i++) {
                var kc = getEffect(layers[i], "Key Cleaner");
                if (!kc) {
                    alert("Key Cleaner saknas på lagret \"" + layers[i].name +
                          "\".\nAnvänd Apply Keylight Stack först.");
                    continue;
                }
                sp(kc, "Additional Edge Radius", edgeRadius);
                sp(kc, "Reduce Chatter",         chatter);
            }
        } catch (e) {
            app.endUndoGroup();
            alert("Fel vid Key Cleaner-inställning:\n" + e.toString());
            return;
        }
        app.endUndoGroup();
    }

    function setSpillValues(suppression) {
        var comp = getComp();
        if (!comp) return;
        var layers = getSelectedLayers(comp);
        if (!layers) return;

        app.beginUndoGroup("Set Spill Suppressor Values");
        try {
            for (var i = 0; i < layers.length; i++) {
                var spFx = getEffect(layers[i], "Advanced Spill Suppressor");
                if (!spFx) {
                    alert("Advanced Spill Suppressor saknas på lagret \"" + layers[i].name +
                          "\".\nAnvänd Apply Keylight Stack först.");
                    continue;
                }
                sp(spFx, "Suppression", suppression);
            }
        } catch (e) {
            app.endUndoGroup();
            alert("Fel vid Spill Suppressor-inställning:\n" + e.toString());
            return;
        }
        app.endUndoGroup();
    }

    // ── UI ────────────────────────────────────────────────────────────────────

    // Skapar en rad med etikett + edittext
    function addRow(parent, label, defaultVal, tipText) {
        var g = parent.add("group");
        g.orientation   = "row";
        g.alignChildren = ["center", "center"];
        g.spacing       = 4;
        var lbl = g.add("statictext", undefined, label);
        lbl.preferredSize.width = 110;
        var fld = g.add("edittext", undefined, String(defaultVal));
        fld.preferredSize.width = 56;
        if (tipText) fld.helpTip = tipText;
        return fld;
    }

    function buildUI(w) {
        w.orientation   = "column";
        w.alignChildren = ["fill", "top"];
        w.spacing       = 6;
        w.margins       = 10;

        // Titel
        var ttl = w.add("statictext", undefined, "Green Screen Keyer");
        ttl.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);
        ttl.alignment     = ["fill", "center"];

        // ── Apply Stack ──────────────────────────────────────────────────────
        var btnApply = w.add("button", undefined, "Apply Keylight Stack");
        btnApply.alignment = ["fill", "top"];
        btnApply.helpTip   =
            "Applicerar Keylight 1.2 + Key Cleaner + Advanced Spill Suppressor\n" +
            "på markerade lager. Hoppar över effekter som redan finns.";
        btnApply.onClick = function () { applyStack(); };

        var hint = w.add("statictext", undefined,
            "Obs: Screen Colour väljs med eyedropper i Effect Controls.");
        hint.graphics.foregroundColor = hint.graphics.newPen(
            hint.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5, 1], 1);
        hint.alignment = ["fill", "top"];

        // ── Keylight 1.2 ─────────────────────────────────────────────────────
        var klPanel = w.add("panel", undefined, "Keylight 1.2");
        klPanel.orientation   = "column";
        klPanel.alignChildren = ["fill", "top"];
        klPanel.spacing       = 4;
        klPanel.margins       = [8, 12, 8, 8];

        var gainFld = addRow(klPanel, "Screen Gain:", "100",
            "Standard 100. Minska om kanten ser för genomskinlig ut (0–200).");
        var balanceFld = addRow(klPanel, "Screen Balance:", "50",
            "Kanalfärgsbalans (0–100). Standard 50. Justeras för ojämn belysning.");

        // View-dropdown ─ byt vy direkt vid val
        // View-index (slutledda): 0=Composite Source, 1=Status, 5=Screen Matte
        var VIEW_IDX    = [0, 1, 5];
        var viewGroup   = klPanel.add("group");
        viewGroup.orientation   = "row";
        viewGroup.alignChildren = ["center", "center"];
        viewGroup.spacing       = 4;
        var viewLbl = viewGroup.add("statictext", undefined, "View:");
        viewLbl.preferredSize.width = 110;
        var viewDd = viewGroup.add("dropdownlist", undefined,
            ["Composite Source", "Status", "Screen Matte"]);
        viewDd.selection        = 0;
        viewDd.preferredSize.width = 130;
        viewDd.helpTip =
            "Byt vy för att granska matten.\n" +
            "Status: vit=opak, grå=semi-transparent, svart=transparent.";
        viewDd.onChange = function () {
            if (!viewDd.selection) return;
            applyKeylightView(VIEW_IDX[viewDd.selection.index]);
        };

        // Screen Matte-parametrar
        var matteSep = klPanel.add("statictext", undefined, "— Screen Matte —");
        matteSep.alignment = ["fill", "center"];
        matteSep.graphics.foregroundColor = matteSep.graphics.newPen(
            matteSep.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5, 1], 1);

        var clipBFld = addRow(klPanel, "Clip Black:", "0",
            "Öka tills bakgrunden är helt transparent (svart i Status-vy).\nVärde 0–100.");
        var clipWFld = addRow(klPanel, "Clip White:", "100",
            "Minska tills motivet är helt opakt (vitt i Status-vy).\nVärde 0–100.");

        // Toggle-knapp: växlar snabbt mellan Composite Source och Status
        var btnToggle = klPanel.add("button", undefined, "Toggle Status / Composite");
        btnToggle.alignment = ["fill", "top"];
        btnToggle.helpTip   = "Växlar snabbt mellan Composite Source och Status-vy.";
        btnToggle.onClick = function () {
            var next = (viewDd.selection && viewDd.selection.index === 0) ? 1 : 0;
            viewDd.selection = next;
            // onChange anropas automatiskt via selection-ändringen ovan
        };

        // Applicera alla Keylight-värden
        var btnKL = klPanel.add("button", undefined, "Set Keylight Values");
        btnKL.alignment = ["fill", "top"];
        btnKL.helpTip   =
            "Skriver Screen Gain, Screen Balance och Clip-värdena till\n" +
            "Keylight 1.2 på markerade lager.";
        btnKL.onClick = function () {
            var gain      = parseNum(gainFld.text,    100);
            var balance   = parseNum(balanceFld.text, 50);
            var viewIdx   = VIEW_IDX[viewDd.selection ? viewDd.selection.index : 0];
            var clipBlack = parseNum(clipBFld.text,   0);
            var clipWhite = parseNum(clipWFld.text,   100);
            setKeylightValues(gain, balance, viewIdx, clipBlack, clipWhite);
        };

        // ── Key Cleaner ───────────────────────────────────────────────────────
        var kcPanel = w.add("panel", undefined, "Key Cleaner");
        kcPanel.orientation   = "column";
        kcPanel.alignChildren = ["fill", "top"];
        kcPanel.spacing       = 4;
        kcPanel.margins       = [8, 12, 8, 8];

        var edgeRadFld = addRow(kcPanel, "Edge Radius:", "0",
            "Utökar mattkantens täckning (0–200).\nÖka för att fylla igen kvarvarande bakgrundsrester.");
        var chatterFld = addRow(kcPanel, "Reduce Chatter:", "0",
            "Minskar flimmer i semi-transparenta kantområden (0–100).");

        var btnKC = kcPanel.add("button", undefined, "Set Key Cleaner Values");
        btnKC.alignment = ["fill", "top"];
        btnKC.helpTip   =
            "Skriver Edge Radius och Reduce Chatter till\n" +
            "Key Cleaner på markerade lager.";
        btnKC.onClick = function () {
            var edgeRadius = parseNum(edgeRadFld.text, 0);
            var chatter    = parseNum(chatterFld.text, 0);
            setKeyCleanerValues(edgeRadius, chatter);
        };

        // ── Advanced Spill Suppressor ──────────────────────────────────────────
        var spPanel = w.add("panel", undefined, "Advanced Spill Suppressor");
        spPanel.orientation   = "column";
        spPanel.alignChildren = ["fill", "top"];
        spPanel.spacing       = 4;
        spPanel.margins       = [8, 12, 8, 8];

        var suppressFld = addRow(spPanel, "Suppression:", "50",
            "Styrka för spillsupprimering (0–100).\n" +
            "Öka om grön/blå färgreflektion syns på motivet efter keying.");

        var btnSP = spPanel.add("button", undefined, "Set Spill Values");
        btnSP.alignment = ["fill", "top"];
        btnSP.helpTip   =
            "Skriver Suppression-värdet till\n" +
            "Advanced Spill Suppressor på markerade lager.";
        btnSP.onClick = function () {
            var suppression = parseNum(suppressFld.text, 50);
            setSpillValues(suppression);
        };
    }

    // ── Panel-launcher ────────────────────────────────────────────────────────
    var palette;
    if (thisObj instanceof Panel) {
        palette = thisObj;
        buildUI(palette);
        palette.layout.layout(true);
    } else {
        palette = new Window("palette", "Green Screen Keyer", undefined, { resizeable: true });
        buildUI(palette);
        palette.layout.layout(true);
        palette.layout.resize();
        palette.onResizing = palette.onResize = function () { palette.layout.resize(); };
        palette.show();
    }

}(this));
