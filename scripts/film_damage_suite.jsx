/**
 * @name        Film Damage Suite
 * @category    scripts
 * @type        script
 * @description ScriptUI-panel för att skapa filmskadesimulering i After Effects.
 *              Skapar individuella adjustment- och solid-lager med effekter och expressions.
 * @usage       Kopiera till Scripts/ScriptUI Panels/ och öppna via Window-menyn i AE.
 * @ae-version  2026
 *
 * VERIFIERINGSLISTA – kontrollera dessa i After Effects efter installation:
 *
 *  DROPDOWN-INDEX (kan ej lösas med match names, är versionsberoende):
 *  - Fractal Type "Dynamic"   → sp(fn, "Fractal Type", 5)  – justera vid behov
 *  - Fractal Type "Smeary"    → sp(fn, "Fractal Type", 9)  – justera vid behov
 *  - FN Blending Mode "Hard Light" → sp(fn2, "Blending Mode", 10) – justera vid behov
 *  - CC Toner Tones "Pentatone"   → sp(cc, "Tones", 3)    – justera vid behov
 *  - Set Channels Luminance       → sp(sc, "Set Alpha…", 5) – justera vid behov
 *  - Glow Operation "Screen"      → sp(gfx, "Glow Operation", 3) – justera vid behov
 *
 *  ÖVRIGT:
 *  - Effektparameter-namn (t.ex. "Contrast", "Blurriness") är display names –
 *    fungerar på engelska AE; kan misslyckas på andra AE-språkinställningar.
 *  - Lumetri Color Look-preset (t.ex. Cinespace 2383) och Highlight Tint sätts
 *    manuellt i Effect Controls efter att lagret skapats.
 *  - CC Toner Midtones-expression wiggle(5,1) på LIGHT LEAKS wigglar alla RGB-kanaler
 *    oberoende (ej enkel brightness-wiggle) → kan ge färgflimmer. Justera vid behov.
 *  - Channel Mixer "Blue-Green"/"Blue-Blue" är display names – verifiera i EC.
 *  - Levels Output Black 2500 / Output White 30 000 är angivna för 16-bitsprojekt.
 *    Panelen sätter projektet till 16 bpc vid "Lägg till alla". Vid enskild knapp
 *    sätts 16 bpc per funktion för att säkerställa korrekta värden.
 */
(function filmDamagePanel(thisObj) {

    // ── Lagernamn ─────────────────────────────────────────────────────────────
    var N = {
        GATE_WEAVE:       "GATE WEAVE",
        GRAIN:            "GRAIN",
        SCRATCHES:        "SCRATCHES",
        BLOBS:            "BLOBS",
        DAMAGE:           "DAMAGE",
        DUST:             "DUST",
        FLICKER:          "FLICKER",
        COLOR_CORRECTION: "COLOR CORRECTION",
        LIGHT_LEAKS:      "LIGHT LEAKS"
    };

    // Omvänd ordning → addAllLayers lägger till nedifrån-upp med moveToBeginning.
    // Slutlig ordning uppifrån: GATE WEAVE … LIGHT LEAKS
    var LAYER_ORDER = [
        N.LIGHT_LEAKS,
        N.COLOR_CORRECTION,
        N.FLICKER,
        N.DUST,
        N.DAMAGE,
        N.BLOBS,
        N.SCRATCHES,
        N.GRAIN,
        N.GATE_WEAVE
    ];

    // ── Hjälpfunktioner ───────────────────────────────────────────────────────

    function getComp() {
        var item = app.project.activeItem;
        if (!item || !(item instanceof CompItem)) {
            alert("Ingen aktiv komposition.\nÖppna en komp och försök igen.");
            return null;
        }
        return item;
    }

    function hexToRgb(hex) {
        return [
            parseInt(hex.slice(1, 3), 16) / 255,
            parseInt(hex.slice(3, 5), 16) / 255,
            parseInt(hex.slice(5, 7), 16) / 255
        ];
    }

    function findLayer(comp, name) {
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).name === name) return comp.layer(i);
        }
        return null;
    }

    // Lägg till effekt via matchName med fallback till displayName
    function addFX(layer, matchName, displayName) {
        try { return layer.Effects.addProperty(matchName); } catch (e) {}
        try { return layer.Effects.addProperty(displayName); } catch (e) {}
        return null;
    }

    // Sätt värde – söker direkt i effekten, sedan ett djup och sedan två djup.
    // Krävs för t.ex. Sub Influence/Sub Scaling i Fractal Noise (Sub Settings → Transform).
    function sp(fx, propName, val) {
        if (!fx) return;
        // Direkt
        try { fx.property(propName).setValue(val); return; } catch (e) {}
        // Ett djup (t.ex. Transform-undergruppen i Fractal Noise)
        try {
            for (var i = 1; i <= fx.numProperties; i++) {
                var sub = fx.property(i);
                try { sub.property(propName).setValue(val); return; } catch (e) {}
                // Två djup (t.ex. Sub Settings inuti Transform i Fractal Noise)
                try {
                    for (var j = 1; j <= sub.numProperties; j++) {
                        try { sub.property(j).property(propName).setValue(val); return; } catch (e) {}
                    }
                } catch (e2) {}
            }
        } catch (e) {}
    }

    // Sätt expression – söker direkt, ett djup och två djup (se sp-kommentar).
    function se(fx, propName, expr) {
        if (!fx) return;
        // Direkt
        try { fx.property(propName).expression = expr; return; } catch (e) {}
        // Ett djup
        try {
            for (var i = 1; i <= fx.numProperties; i++) {
                var sub = fx.property(i);
                try { sub.property(propName).expression = expr; return; } catch (e) {}
                // Två djup
                try {
                    for (var j = 1; j <= sub.numProperties; j++) {
                        try { sub.property(j).property(propName).expression = expr; return; } catch (e) {}
                    }
                } catch (e2) {}
            }
        } catch (e) {}
    }

    // Skapa adjustment layer
    function mkAdj(comp, name) {
        var l = comp.layers.addSolid(
            [0.5, 0.5, 0.5], name,
            comp.width, comp.height, comp.pixelAspect, comp.duration
        );
        l.adjustmentLayer = true;
        l.name = name;
        return l;
    }

    // Skapa solid layer (vit)
    function mkSolid(comp, name) {
        var l = comp.layers.addSolid(
            [1, 1, 1], name,
            comp.width, comp.height, comp.pixelAspect, comp.duration
        );
        l.name = name;
        return l;
    }

    // ── Lagerskapande funktioner ───────────────────────────────────────────────

    // ── 1. GATE WEAVE ─────────────────────────────────────────────────────────
    // Adjustment Layer | Transform-effekt med position-expression + scale 101.5%
    function createGateWeave(comp) {
        var l = mkAdj(comp, N.GATE_WEAVE);
        l.moveToBeginning();
        var tfx = addFX(l, "ADBE Transform", "Transform");
        if (tfx) {
            se(tfx, "Position",
                "x = wiggle(12, .5)[0]; y = wiggle(3, .15, 3, 4)[1]; [x, y]");
            // Scale i Transform-effekten är en 1D-procent-property
            sp(tfx, "Scale", 101.5);
        }
    }

    // ── 2. GRAIN ──────────────────────────────────────────────────────────────
    // Adjustment Layer | Noise 10% + Gaussian Blur 6 + Unsharp Mask 300/3
    function createGrain(comp) {
        var l = mkAdj(comp, N.GRAIN);
        l.moveToBeginning();
        var nfx = addFX(l, "ADBE Noise", "Noise");
        sp(nfx, "Amount of Noise", 10);
        var bfx = addFX(l, "ADBE Gaussian Blur 2", "Gaussian Blur");
        sp(bfx, "Blurriness", 6);
        var ufx = addFX(l, "ADBE Unsharp Mask", "Unsharp Mask");
        sp(ufx, "Amount", 300);
        sp(ufx, "Radius", 3);
    }

    // ── 3. SCRATCHES ──────────────────────────────────────────────────────────
    // Solid (Multiply) | Scale 100×2000%
    // Fractal Noise (Invert, Contrast 200, Brightness 110, Width 25, Height 10000)
    // Turbulent Displace (Amount wiggle, Size wiggle, Complexity 3)
    function createScratches(comp) {
        var l = mkSolid(comp, N.SCRATCHES);
        l.blendingMode = BlendingMode.MULTIPLY;
        try {
            l.property("Transform").property("Scale").setValue([100, 2000]);
        } catch (e) {}
        l.moveToBeginning();
        var fn = addFX(l, "ADBE Fractal Noise", "Fractal Noise");
        if (fn) {
            sp(fn, "Invert", true);
            sp(fn, "Contrast", 200);
            sp(fn, "Brightness", 110);
            // Scale Width/Height och Uniform Scaling sitter i Transform-undergruppen
            sp(fn, "Uniform Scaling", false);
            sp(fn, "Scale Width", 25);
            sp(fn, "Scale Height", 10000);
            se(fn, "Evolution", "time * 200");
        }
        var td = addFX(l, "ADBE Turbulent Displace", "Turbulent Displace");
        if (td) {
            sp(td, "Amount", 10);
            se(td, "Amount", "wiggle(10, 5)");
            sp(td, "Size", 50);
            se(td, "Size", "wiggle(10, 10)");
            sp(td, "Complexity", 3);
            se(td, "Evolution", "time * 24");
        }
    }

    // ── 4. BLOBS ──────────────────────────────────────────────────────────────
    // Solid (Multiply) | Fractal Noise (Dynamic≈5, Invert, Contrast 1875, Brightness 880)
    // CC Toner (Midtones #2C5F4A)
    //
    // VERIFIERA: Fractal Type "Dynamic" är angivet som index 5.
    //            Kontrollera i Effect Controls och justera vid behov.
    function createBlobs(comp) {
        var l = mkSolid(comp, N.BLOBS);
        l.blendingMode = BlendingMode.MULTIPLY;
        l.moveToBeginning();
        var fn = addFX(l, "ADBE Fractal Noise", "Fractal Noise");
        if (fn) {
            sp(fn, "Fractal Type", 5); // Dynamic ≈ index 5 – verifiera
            sp(fn, "Invert", true);
            sp(fn, "Contrast", 1875);
            sp(fn, "Brightness", 880);
            sp(fn, "Scale", 200);
            se(fn, "Random Seed", "time * 100");
        }
        var cc = addFX(l, "CC Toner", "CC Toner");
        sp(cc, "Midtones", hexToRgb("#2C5F4A"));
    }

    // ── 5. DAMAGE ─────────────────────────────────────────────────────────────
    // Solid (Normal)
    // Fractal Noise 1: Contrast 1000, Brightness -460, Width 300, Height wiggle
    // Extract: Black Point 20, Black Softness 20
    // Fractal Noise 2: Contrast 313, Brightness 40, Scale 50, Blending Hard Light≈10
    // CC Toner (Midtones #2FC35E)
    //
    // VERIFIERA: Blending Mode "Hard Light" inom Fractal Noise är angivet som index 10.
    //            Kontrollera i Effect Controls och justera vid behov.
    function createDamage(comp) {
        var l = mkSolid(comp, N.DAMAGE);
        l.blendingMode = BlendingMode.NORMAL;
        l.moveToBeginning();
        var fn1 = addFX(l, "ADBE Fractal Noise", "Fractal Noise");
        if (fn1) {
            sp(fn1, "Contrast", 1000);
            sp(fn1, "Brightness", -460);
            sp(fn1, "Uniform Scaling", false);
            sp(fn1, "Scale Width", 300);
            sp(fn1, "Scale Height", 500);
            se(fn1, "Scale Height", "wiggle(24, 400)");
            se(fn1, "Random Seed", "time * 24");
        }
        var ex = addFX(l, "ADBE Extract", "Extract");
        if (ex) {
            sp(ex, "Black Point", 20);
            sp(ex, "Black Softness", 20);
        }
        var fn2 = addFX(l, "ADBE Fractal Noise", "Fractal Noise");
        if (fn2) {
            sp(fn2, "Contrast", 313);
            sp(fn2, "Brightness", 40);
            sp(fn2, "Scale", 50);
            sp(fn2, "Blending Mode", 10); // Hard Light ≈ index 10 – verifiera
        }
        var cc = addFX(l, "CC Toner", "CC Toner");
        sp(cc, "Midtones", hexToRgb("#2FC35E"));
    }

    // ── 6. DUST ───────────────────────────────────────────────────────────────
    // Solid (Normal)
    // Fractal Noise (Smeary≈9, Invert, Contrast 3000, Brightness -2925, Sub Influence 30%)
    // Set Channels (Alpha = Luminance≈5)
    // Noise 100% + Unsharp Mask 200/2 + Gaussian Blur 3
    //
    // VERIFIERA: Fractal Type "Smeary" ≈ index 9.
    //            Set Alpha to Source Luminance ≈ index 5.
    //            Sub Influence och Sub Scaling söks två djup ned (Sub Settings → Transform).
    function createDust(comp) {
        var l = mkSolid(comp, N.DUST);
        l.blendingMode = BlendingMode.NORMAL;
        l.moveToBeginning();
        var fn = addFX(l, "ADBE Fractal Noise", "Fractal Noise");
        if (fn) {
            sp(fn, "Fractal Type", 9); // Smeary ≈ index 9 – verifiera
            sp(fn, "Invert", true);
            sp(fn, "Contrast", 3000);
            sp(fn, "Brightness", -2925);
            sp(fn, "Scale", 200);
            sp(fn, "Complexity", 3);
            // Sub Influence och Sub Scaling sitter i Sub Settings (inne i Transform).
            // sp() söker nu två djup för att nå dessa.
            sp(fn, "Sub Influence", 30);
            sp(fn, "Sub Scaling", 50);
            se(fn, "Random Seed", "time * 24");
        }
        // VERIFIERA: "Set Alpha to Source" Luminance – index 5 kan variera.
        var sc = addFX(l, "ADBE Set Channels", "Set Channels");
        sp(sc, "Set Alpha to Source", 5);
        var nfx = addFX(l, "ADBE Noise", "Noise");
        sp(nfx, "Amount of Noise", 100);
        var ufx = addFX(l, "ADBE Unsharp Mask", "Unsharp Mask");
        sp(ufx, "Amount", 200);
        sp(ufx, "Radius", 2);
        var bfx = addFX(l, "ADBE Gaussian Blur 2", "Gaussian Blur");
        sp(bfx, "Blurriness", 3);
    }

    // ── 7. FLICKER ────────────────────────────────────────────────────────────
    // Adjustment Layer | Exposure wiggle(12, .1)
    function createFlicker(comp) {
        var l = mkAdj(comp, N.FLICKER);
        l.moveToBeginning();
        var efx = addFX(l, "ADBE Exposure2", "Exposure");
        se(efx, "Exposure", "wiggle(12, .1)");
    }

    // ── 8. COLOR CORRECTION ───────────────────────────────────────────────────
    // Adjustment Layer
    // Glow (Threshold 50%, Radius 500, Intensity 0.2, Operation: Screen≈3)
    // Channel Mixer (Blue-Green 50, Blue-Blue 50)
    // Lumetri Color (Look-preset sätts manuellt i Effect Controls)
    // CC Vignette (Amount 50)
    // Levels (Output Black 2500, Output White 30000 – 16-bpc-värden)
    //
    // VERIFIERA: Glow Operation "Screen" ≈ index 3.
    //            Channel Mixer "Blue-Green"/"Blue-Blue" – display names, kan
    //            skilja på icke-engelska AE-installationer.
    //            Lumetri Look-preset och Highlight Tint sätts manuellt i EC.
    function createColorCorrection(comp) {
        // Säkerställ 16 bpc så Levels-värdena tolkas korrekt
        try { app.project.bitsPerChannel = 16; } catch (e) {}
        var l = mkAdj(comp, N.COLOR_CORRECTION);
        l.moveToBeginning();
        var gfx = addFX(l, "ADBE Glow", "Glow");
        if (gfx) {
            sp(gfx, "Glow Threshold", 50);
            sp(gfx, "Glow Radius", 500);
            sp(gfx, "Glow Intensity", 0.2);
            sp(gfx, "Glow Operation", 3); // Screen ≈ index 3 – verifiera
        }
        // VERIFIERA: property-namnen är display names och kan kräva justering
        // på icke-engelska AE-installationer.
        var cm = addFX(l, "ADBE Channel Mixer", "Channel Mixer");
        if (cm) {
            sp(cm, "Blue-Green", 50);
            sp(cm, "Blue-Blue", 50);
        }
        // Look-preset och Highlight Tint sätts manuellt i Effect Controls
        addFX(l, "ADBE Lumetri", "Lumetri Color");
        var vfx = addFX(l, "CC Vignette", "CC Vignette");
        sp(vfx, "Amount", 50);
        // Levels – försöker ADBE Levels2 (post-CS6) med fallback till ADBE Levels
        var lvl = addFX(l, "ADBE Levels2", "Levels");
        if (!lvl) lvl = addFX(l, "ADBE Levels", "Levels");
        if (lvl) {
            sp(lvl, "Output Black", 2500);
            sp(lvl, "Output White", 30000);
        }
    }

    // ── 9. LIGHT LEAKS ────────────────────────────────────────────────────────
    // Solid (Screen)
    // Fractal Noise 1: Invert, Contrast 60, Brightness -30, Width 4000, Height 8000
    // CC Toner: Pentatone≈3, Midtones wiggle(5,1), Darktones #313A4B
    // Fractal Noise 2: Brightness -20, Width 3000, Height 6000, Complexity 1
    //
    // VERIFIERA: CC Toner Tones "Pentatone" ≈ index 3.
    //            Midtones expression wiggle(5,1) wigglar alla RGB-kanaler oberoende
    //            → kan ge färgflimmer snarare än brightness-flimmer. Alternativ:
    //            sätt en fast Midtones-färg och styr ljusleckans styrka via
    //            lagrets Opacity-expression istället.
    function createLightLeaks(comp) {
        var l = mkSolid(comp, N.LIGHT_LEAKS);
        l.blendingMode = BlendingMode.SCREEN;
        l.moveToBeginning();
        var fn1 = addFX(l, "ADBE Fractal Noise", "Fractal Noise");
        if (fn1) {
            sp(fn1, "Invert", true);
            sp(fn1, "Contrast", 60);
            sp(fn1, "Brightness", -30);
            sp(fn1, "Uniform Scaling", false);
            sp(fn1, "Scale Width", 4000);
            sp(fn1, "Scale Height", 8000);
            sp(fn1, "Complexity", 2);
            se(fn1, "Evolution", "time * 400");
        }
        var cc = addFX(l, "CC Toner", "CC Toner");
        if (cc) {
            sp(cc, "Tones", 3); // Pentatone ≈ index 3 – verifiera
            // OBS: wiggle(5,1) på en färg-property wigglar R/G/B oberoende.
            // Resulterar i färgflimmer – justera vid behov (se kommentar ovan).
            se(cc, "Midtones", "wiggle(5, 1)");
            sp(cc, "Darktones", hexToRgb("#313A4B"));
        }
        var fn2 = addFX(l, "ADBE Fractal Noise", "Fractal Noise");
        if (fn2) {
            sp(fn2, "Brightness", -20);
            sp(fn2, "Uniform Scaling", false);
            sp(fn2, "Scale Width", 3000);
            sp(fn2, "Scale Height", 6000);
            sp(fn2, "Complexity", 1);
            se(fn2, "Evolution", "time * 100");
        }
    }

    // ── Knappdefinitioner ─────────────────────────────────────────────────────
    var BTN_DATA = [
        { label: "1  GATE WEAVE",       name: N.GATE_WEAVE,       fn: createGateWeave },
        { label: "2  GRAIN",            name: N.GRAIN,            fn: createGrain },
        { label: "3  SCRATCHES",        name: N.SCRATCHES,        fn: createScratches },
        { label: "4  BLOBS",            name: N.BLOBS,            fn: createBlobs },
        { label: "5  DAMAGE",           name: N.DAMAGE,           fn: createDamage },
        { label: "6  DUST",             name: N.DUST,             fn: createDust },
        { label: "7  FLICKER",          name: N.FLICKER,          fn: createFlicker },
        { label: "8  COLOR CORRECTION", name: N.COLOR_CORRECTION, fn: createColorCorrection },
        { label: "9  LIGHT LEAKS",      name: N.LIGHT_LEAKS,      fn: createLightLeaks }
    ];

    // ── Lägg till alla / Ta bort alla ─────────────────────────────────────────
    // Mappar lagernamn → skapande-funktion för addAllLayers
    var CREATE_FNS = {};
    for (var _i = 0; _i < BTN_DATA.length; _i++) {
        CREATE_FNS[BTN_DATA[_i].name] = BTN_DATA[_i].fn;
    }

    function addAllLayers() {
        var comp = getComp();
        if (!comp) return;
        try { app.project.bitsPerChannel = 16; } catch (e) {}
        app.beginUndoGroup("Lägg till alla Film Damage-lager");
        // LAYER_ORDER är omvänd → med moveToBeginning hamnar lagren i rätt ordning
        for (var i = 0; i < LAYER_ORDER.length; i++) {
            var name = LAYER_ORDER[i];
            if (!findLayer(comp, name)) {
                CREATE_FNS[name](comp);
            }
        }
        app.endUndoGroup();
    }

    function removeAllLayers() {
        var comp = getComp();
        if (!comp) return;
        app.beginUndoGroup("Ta bort alla Film Damage-lager");
        for (var key in N) {
            if (N.hasOwnProperty(key)) {
                var layer = findLayer(comp, N[key]);
                if (layer) layer.remove();
            }
        }
        app.endUndoGroup();
    }

    // ── Bygg UI ───────────────────────────────────────────────────────────────
    function buildUI(w) {
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];
        w.spacing = 4;
        w.margins = 10;

        // Rubrik
        var hdrGrp = w.add("group");
        hdrGrp.alignment = ["center", "top"];
        var ttl = hdrGrp.add("statictext", undefined, "Film Damage Suite");
        ttl.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);

        w.add("panel", undefined, "").alignment = ["fill", "top"];

        // Individuella lagerknappar
        for (var i = 0; i < BTN_DATA.length; i++) {
            (function (d) {
                var btn = w.add("button", undefined, d.label);
                btn.alignment = ["fill", "top"];
                btn.onClick = function () {
                    var comp = getComp();
                    if (!comp) return;
                    if (findLayer(comp, d.name)) {
                        alert("\"" + d.name + "\" finns redan i kompositionen.");
                        return;
                    }
                    app.beginUndoGroup("Add " + d.name);
                    d.fn(comp);
                    app.endUndoGroup();
                };
            }(BTN_DATA[i]));
        }

        w.add("panel", undefined, "").alignment = ["fill", "top"];

        // Globala knappar
        var addAllBtn = w.add("button", undefined, "Lägg till alla lager");
        addAllBtn.alignment = ["fill", "top"];
        addAllBtn.onClick = addAllLayers;

        var remAllBtn = w.add("button", undefined, "Ta bort alla");
        remAllBtn.alignment = ["fill", "top"];
        remAllBtn.onClick = removeAllLayers;
    }

    // ── Starta panel eller fristående dialog ──────────────────────────────────
    var palette;
    if (thisObj instanceof Panel) {
        palette = thisObj;
        buildUI(palette);
        palette.layout.layout(true);
    } else {
        palette = new Window("palette", "Film Damage Suite", undefined, { resizeable: true });
        buildUI(palette);
        palette.layout.layout(true);
        palette.layout.resize();
        palette.onResizing = palette.onResize = function () { palette.layout.resize(); };
        palette.show();
    }

}(this));
