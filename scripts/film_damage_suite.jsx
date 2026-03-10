/**
 * @name        Film Damage Suite
 * @category    scripts
 * @type        script
 * @description ScriptUI-panel för att skapa filmskadesimulering i After Effects.
 *              Skapar individuella adjustment- och solid-lager med effekter och expressions.
 * @usage       Kopiera till Scripts/ScriptUI Panels/ och öppna via Window-menyn i AE.
 * @ae-version  2026
 *
 * VERIFIERA I AE – dropdown-index (bekräftade via expression i AE):
 *
 *  Fractal Type (bekräftat):
 *    Dynamic=7, Smeary=12
 *
 *  Fractal Noise Blending Mode (bekräftat):
 *    Multiply=5, Hard Light=9
 *
 *  Set Channels "Set Alpha to Source 4's" dropdown (bekräftade värden via debugscript i AE):
 *    Luminance=4, Saturation=8
 *    (Tidigare dokumenterade värden Full On=1..Saturation=11 var OVERIFIERADE och FELAKTIGA.)
 *
 *  Glow Operation (bekräftat):
 *    none=1, normal=2, add=3, multiply=4, dissolve=5, screen=6
 *
 *  CC Toner Tones: Duotone=1, Tritone=2, Pentatone=3
 *
 *  Lumetri Color Look-preset (Cinespace 2383sRGB6bit) och Highlight Tint
 *  (Light Blue/Cyan) sätts manuellt i Effect Controls – kan ej sättas via script.
 *
 *  Effektparameter-namn är engelska display names och kan misslyckas på
 *  icke-engelska AE-installationer.
 *
 *  Levels Output Black 2500 / Output White 30000 är 16-bitsvärden.
 *  Projektet sätts till 16 bpc automatiskt av panelen.
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

    // Generisk setter – söker direkt, ett djup och två djup (för okända effekter)
    function sp(fx, propName, val) {
        if (!fx) return;
        try { fx.property(propName).setValue(val); return; } catch (e) {}
        try {
            for (var i = 1; i <= fx.numProperties; i++) {
                var sub = fx.property(i);
                try { sub.property(propName).setValue(val); return; } catch (e) {}
                try {
                    for (var j = 1; j <= sub.numProperties; j++) {
                        try { sub.property(j).property(propName).setValue(val); return; } catch (e) {}
                    }
                } catch (e2) {}
            }
        } catch (e) {}
    }

    // Generisk expression-setter – söker direkt, ett djup och två djup
    function se(fx, propName, expr) {
        if (!fx) return;
        try { fx.property(propName).expression = expr; return; } catch (e) {}
        try {
            for (var i = 1; i <= fx.numProperties; i++) {
                var sub = fx.property(i);
                try { sub.property(propName).expression = expr; return; } catch (e) {}
                try {
                    for (var j = 1; j <= sub.numProperties; j++) {
                        try { sub.property(j).property(propName).expression = expr; return; } catch (e) {}
                    }
                } catch (e2) {}
            }
        } catch (e) {}
    }

    // Levels-specifik setter – AE:s Levels-properties använder normaliserade
    // 0.0–1.0-värden via setValue(). UI visar värdena skalade till projektets
    // bitdjup: ×32 768 för 16 bpc. Parametrarna tas emot som 16-bit-värden
    // (0–32 768) och normaliseras internt.
    // ADBE Levels har platt struktur, ADBE Levels2 har nästlade kanal-sub-grupper.
    // Match names för Output-parametrarna är ej verifierade och används inte.
    function setLevels(fx, outBlack16, outWhite16) {
        if (!fx) return;
        var black = outBlack16 / 32768;
        var white = outWhite16 / 32768;
        // Display names direkt (fungerar vid engelska AE-installationer)
        try {
            fx.property("Output Black").setValue(black);
            fx.property("Output White").setValue(white);
            return;
        } catch(e) {}
        // Fallback: sök i sub-grupper (ADBE Levels2 nästlar per kanal)
        try {
            for (var i = 1; i <= fx.numProperties; i++) {
                var g = fx.property(i);
                try {
                    g.property("Output Black").setValue(black);
                    g.property("Output White").setValue(white);
                    return;
                } catch(e2) {}
            }
        } catch(e) {}
    }

    // Fractal Noise setter – söker explicit via kända sub-grupper:
    //   direkt → Transform → Transform > Sub Settings → Evolution Options → generisk fallback
    // Provar även alternativa property-namn med suffix "(%)" för procentegenskaper.
    function fnSp(fn, name, val) {
        if (!fn) return;
        var names = [name, name + " (%)"];
        for (var n = 0; n < names.length; n++) {
            var nm = names[n];
            try { fn.property(nm).setValue(val); return; } catch (e) {}
            try { fn.property("Transform").property(nm).setValue(val); return; } catch (e) {}
            try { fn.property("Transform").property("Sub Settings").property(nm).setValue(val); return; } catch (e) {}
            try { fn.property("Evolution Options").property(nm).setValue(val); return; } catch (e) {}
        }
        sp(fn, name, val);
    }

    // Fractal Noise expression-setter – samma söksökvägar som fnSp
    function fnSe(fn, name, expr) {
        if (!fn) return;
        try { fn.property(name).expression = expr; return; } catch (e) {}
        try { fn.property("Transform").property(name).expression = expr; return; } catch (e) {}
        try { fn.property("Transform").property("Sub Settings").property(name).expression = expr; return; } catch (e) {}
        try { fn.property("Evolution Options").property(name).expression = expr; return; } catch (e) {}
        se(fn, name, expr);
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
    // Adjustment Layer
    // TRANSFORM: Position (expression), Scale 101.5%
    function createGateWeave(comp) {
        var l = mkAdj(comp, N.GATE_WEAVE);
        l.moveToBeginning();
        var tfx = addFX(l, "ADBE Transform", "Transform");
        if (tfx) {
            se(tfx, "Position",
                "x = wiggle(12, .5)[0]; y = wiggle(3, .15, 3, 4)[1]; [x, y]");
            // Provar skalär (uniform scale) och array-fallback för Transform-effektens Scale
            try { tfx.property("Scale").setValue(101.5); } catch(e) {
                try { tfx.property("Scale").setValue([101.5, 101.5]); } catch(e2) {
                    sp(tfx, "Scale", 101.5);
                }
            }
        }
    }

    // ── 2. GRAIN ──────────────────────────────────────────────────────────────
    // Adjustment Layer
    // NOISE: Amount 10%
    // GAUSSIAN BLUR: Blurriness 6
    // UNSHARP MASK: Amount 300, Radius 3
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
    // FRACTAL NOISE: Invert, Contrast 200, Brightness 110, Width 25, Height 10000,
    //               Evolution (time*200)
    // TURBULENT DISPLACE: Amount 10+wiggle, Size 50+wiggle, Complexity 3,
    //                     Evolution (time*24)
    function createScratches(comp) {
        var l = mkSolid(comp, N.SCRATCHES);
        l.blendingMode = BlendingMode.MULTIPLY;
        try {
            l.property("Transform").property("Scale").setValue([100, 2000]);
        } catch (e) {}
        l.moveToBeginning();

        var fn = addFX(l, "ADBE Fractal Noise", "Fractal Noise");
        if (fn) {
            fnSp(fn, "Invert", true);
            fnSp(fn, "Contrast", 200);
            fnSp(fn, "Brightness", 110);
            fnSp(fn, "Uniform Scaling", false);
            fnSp(fn, "Scale Width", 25);
            fnSp(fn, "Scale Height", 10000);
            fnSe(fn, "Evolution", "time * 200");
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
    // Solid (Multiply)
    // FRACTAL NOISE: Fractal Type Dynamic (1-indexerat=6), Invert,
    //               Contrast 1875, Brightness 880, Scale 200,
    //               Random Seed (time*100)
    // CC TONER: Midtones #2C5F4A
    function createBlobs(comp) {
        var l = mkSolid(comp, N.BLOBS);
        l.blendingMode = BlendingMode.MULTIPLY;
        l.moveToBeginning();

        var fn = addFX(l, "ADBE Fractal Noise", "Fractal Noise");
        if (fn) {
            fnSp(fn, "Fractal Type", 7); // Dynamic = index 7 (bekräftat via expression i AE)
            fnSp(fn, "Invert", true);
            fnSp(fn, "Contrast", 1875);
            fnSp(fn, "Brightness", 880);
            fnSp(fn, "Scale", 200);
            fnSe(fn, "Random Seed", "time * 100");
        }

        var cc = addFX(l, "CC Toner", "CC Toner");
        sp(cc, "Midtones", hexToRgb("#2C5F4A"));
    }

    // ── 5. DAMAGE ─────────────────────────────────────────────────────────────
    // Solid (Normal)
    // FRACTAL NOISE 1: Contrast 1000, Brightness -460, Uniform Scaling off,
    //                  Scale Width 300, Scale Height 500+wiggle(24,400),
    //                  Random Seed (time*24)
    // EXTRACT: Black Point 20, Black Softness 20
    // FRACTAL NOISE 2: Contrast 313, Brightness 40, Scale 50,
    //                  Blending Mode Hard Light (1-indexerat≈5)
    // CC TONER: Midtones #2FC35E
    //
    // VERIFIERA: Blending Mode Hard Light – index 5 i förenklad FN-lista.
    //            Justera om fel blend mode appliceras.
    function createDamage(comp) {
        var l = mkSolid(comp, N.DAMAGE);
        l.blendingMode = BlendingMode.NORMAL;
        l.moveToBeginning();

        var fn1 = addFX(l, "ADBE Fractal Noise", "Fractal Noise");
        if (fn1) {
            fnSp(fn1, "Contrast", 1000);
            fnSp(fn1, "Brightness", -460);
            fnSp(fn1, "Uniform Scaling", false);
            fnSp(fn1, "Scale Width", 300);
            fnSp(fn1, "Scale Height", 500);
            fnSe(fn1, "Scale Height", "wiggle(24, 400)");
            fnSe(fn1, "Random Seed", "time * 24");
        }

        var ex = addFX(l, "ADBE Extract", "Extract");
        if (ex) {
            sp(ex, "Black Point", 20);
            sp(ex, "Black Softness", 20);
        }

        var fn2 = addFX(l, "ADBE Fractal Noise", "Fractal Noise");
        if (fn2) {
            fnSp(fn2, "Contrast", 313);
            fnSp(fn2, "Brightness", 40);
            fnSp(fn2, "Scale", 50);
            fnSp(fn2, "Blending Mode", 9); // Hard Light = index 9 (bekräftat via expression i AE)
        }

        var cc = addFX(l, "CC Toner", "CC Toner");
        sp(cc, "Midtones", hexToRgb("#2FC35E"));
    }

    // ── 6. DUST ───────────────────────────────────────────────────────────────
    // Solid (Normal)
    // FRACTAL NOISE: Fractal Type Smeary (1-indexerat=10), Invert,
    //               Contrast 3000, Brightness -2925, Scale 200, Complexity 3,
    //               Sub Influence 30%, Sub Scaling 50%, Random Seed (time*24)
    // SET CHANNELS: Set Alpha to Source = Luminance (1-indexerat=9)
    // NOISE: Amount 100%
    // UNSHARP MASK: Amount 200, Radius 2
    // GAUSSIAN BLUR: Blurriness 3
    function createDust(comp) {
        var l = mkSolid(comp, N.DUST);
        l.blendingMode = BlendingMode.NORMAL;
        l.moveToBeginning();

        var fn = addFX(l, "ADBE Fractal Noise", "Fractal Noise");
        if (fn) {
            fnSp(fn, "Fractal Type", 12); // Smeary = index 12 (bekräftat via expression i AE)
            fnSp(fn, "Invert", true);
            fnSp(fn, "Contrast", 3000);
            fnSp(fn, "Brightness", -2925);
            fnSp(fn, "Scale", 200);
            fnSp(fn, "Complexity", 3);
            // Sub Influence/Sub Scaling: sitter i Sub Settings inuti Transform.
            // fnSp söker denna sökväg explicit.
            fnSp(fn, "Sub Influence", 30);
            fnSp(fn, "Sub Scaling", 50);
            fnSe(fn, "Random Seed", "time * 24");
        }

        // Set Channels – property-ordning (numerisk index):
        //   1=Source Layer 1, 2=Set Red 1's, 3=Source Layer 2, 4=Set Green 2's,
        //   5=Source Layer 3, 6=Set Blue 3's, 7=Source Layer 4, 8=Set Alpha 4's, 9=If Layer Sizes Differ
        //
        // "Set Alpha To Source 4's" dropdown-värden (bekräftade via debug i AE):
        //   Luminance=4, Saturation=8
        //   (Kommentaren "Luminance=8" i tidigare versioner var FELAKTIG.)
        var sc = addFX(l, "ADBE Set Channels", "Set Channels");
        if (sc) {
            var LUMINANCE = 4; // bekräftat via debugscript: property(8).value == 4 → UI visar Luminance
            var didSet = false;
            try { sc.property("Set Alpha to Source 4's").setValue(LUMINANCE); didSet = true; } catch(e) {}
            if (!didSet) {
                try { sc.property(8).setValue(LUMINANCE); } catch(e) {}
            }
        }

        var nfx = addFX(l, "ADBE Noise", "Noise");
        sp(nfx, "Amount of Noise", 100);

        var ufx = addFX(l, "ADBE Unsharp Mask", "Unsharp Mask");
        sp(ufx, "Amount", 200);
        sp(ufx, "Radius", 2);

        var bfx = addFX(l, "ADBE Gaussian Blur 2", "Gaussian Blur");
        sp(bfx, "Blurriness", 3);
    }

    // ── 7. FLICKER ────────────────────────────────────────────────────────────
    // Adjustment Layer
    // EXPOSURE: Exposure (wiggle(12, .1))
    function createFlicker(comp) {
        var l = mkAdj(comp, N.FLICKER);
        l.moveToBeginning();
        var efx = addFX(l, "ADBE Exposure2", "Exposure");
        se(efx, "Exposure", "wiggle(12, .1)");
    }

    // ── 8. COLOR CORRECTION ───────────────────────────────────────────────────
    // Adjustment Layer
    // GLOW: Threshold 50%, Radius 500, Intensity 0.2,
    //       Operation Screen (1-indexerat=6: none=1,normal=2,add=3,multiply=4,dissolve=5,screen=6)
    // CHANNEL MIXER: Blue-Green 50, Blue-Blue 50
    // LUMETRI COLOR: Look + Highlight Tint sätts manuellt i Effect Controls
    // CC VIGNETTE: Amount 50
    // LEVELS: Output Black 2500, Output White 30000 (16-bpc-värden)
    function createColorCorrection(comp) {
        try { app.project.bitsPerChannel = 16; } catch (e) {}
        var l = mkAdj(comp, N.COLOR_CORRECTION);
        l.moveToBeginning();

        var gfx = addFX(l, "ADBE Glow", "Glow");
        if (gfx) {
            sp(gfx, "Glow Threshold", 50);
            sp(gfx, "Glow Radius", 500);
            sp(gfx, "Glow Intensity", 0.2);
            sp(gfx, "Glow Operation", 6); // Screen = index 6 (none=1,normal=2,add=3,multiply=4,dissolve=5,screen=6)
        }

        var cm = addFX(l, "ADBE Channel Mixer", "Channel Mixer");
        if (cm) {
            sp(cm, "Blue-Green", 50);
            sp(cm, "Blue-Blue", 50);
        }

        // Look: Cinespace 2383sRGB6bit, Highlight Tint: Light Blue/Cyan
        // Sätts manuellt i Effect Controls – kan ej tillämpas via script.
        addFX(l, "ADBE Lumetri", "Lumetri Color");

        var vfx = addFX(l, "CC Vignette", "CC Vignette");
        sp(vfx, "Amount", 50);

        // ADBE Levels (platt struktur) prövas före ADBE Levels2 (nästlad kanal-struktur)
        var lvl = addFX(l, "ADBE Levels", "Levels");
        if (!lvl) lvl = addFX(l, "ADBE Levels2", "Levels");
        setLevels(lvl, 2500, 30000);
    }

    // ── 9. LIGHT LEAKS ────────────────────────────────────────────────────────
    // Solid (Screen)
    // FRACTAL NOISE 1: Invert, Contrast 60, Brightness -30, Uniform Scaling off,
    //                  Scale Width 4000, Scale Height 8000, Complexity 2,
    //                  Evolution (time*400)
    // CC TONER: Tones Pentatone (1-indexerat=3), Midtones (wiggle(5,1)),
    //           Darktones #313A4B
    // FRACTAL NOISE 2: Brightness -20, Uniform Scaling off,
    //                  Scale Width 3000, Scale Height 6000, Complexity 1,
    //                  Evolution (time*100)
    //
    // OBS: wiggle(5,1) på CC Toner Midtones (color-property) wigglar R/G/B
    //      oberoende → kan ge färgflimmer snarare än brightness-variation.
    //      Ersätt med fast färg + Opacity-expression om enbart ljusvariation önskas.
    function createLightLeaks(comp) {
        var l = mkSolid(comp, N.LIGHT_LEAKS);
        l.blendingMode = BlendingMode.SCREEN;
        l.moveToBeginning();

        var fn1 = addFX(l, "ADBE Fractal Noise", "Fractal Noise");
        if (fn1) {
            fnSp(fn1, "Invert", true);
            fnSp(fn1, "Contrast", 60);
            fnSp(fn1, "Brightness", -30);
            fnSp(fn1, "Uniform Scaling", false);
            fnSp(fn1, "Scale Width", 4000);
            fnSp(fn1, "Scale Height", 8000);
            fnSp(fn1, "Complexity", 2);
            fnSe(fn1, "Evolution", "time * 400");
        }

        var cc = addFX(l, "CC Toner", "CC Toner");
        if (cc) {
            sp(cc, "Tones", 3); // Pentatone = index 3 (Duotone=1, Tritone=2, Pentatone=3)
            se(cc, "Midtones", "wiggle(5, 1)");
            sp(cc, "Darktones", hexToRgb("#313A4B"));
        }

        var fn2 = addFX(l, "ADBE Fractal Noise", "Fractal Noise");
        if (fn2) {
            fnSp(fn2, "Blending Mode", 5); // Multiply = index 5 (bekräftat via expression i AE)
            fnSp(fn2, "Brightness", -20);
            fnSp(fn2, "Uniform Scaling", false);
            fnSp(fn2, "Scale Width", 3000);
            fnSp(fn2, "Scale Height", 6000);
            fnSp(fn2, "Complexity", 1);
            fnSe(fn2, "Evolution", "time * 100");
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
    var CREATE_FNS = {};
    for (var _i = 0; _i < BTN_DATA.length; _i++) {
        CREATE_FNS[BTN_DATA[_i].name] = BTN_DATA[_i].fn;
    }

    function addAllLayers() {
        var comp = getComp();
        if (!comp) return;
        try { app.project.bitsPerChannel = 16; } catch (e) {}
        app.beginUndoGroup("Lägg till alla Film Damage-lager");
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

        var hdrGrp = w.add("group");
        hdrGrp.alignment = ["center", "top"];
        var ttl = hdrGrp.add("statictext", undefined, "Film Damage Suite");
        ttl.graphics.font = ScriptUI.newFont("dialog", "BOLD", 13);

        w.add("panel", undefined, "").alignment = ["fill", "top"];

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
