/**
 * @name        Motion Expressions Panel
 * @category    scripts
 * @type        script
 * @description Panel med motion expressions: swing, sinus/cosinus, inertia bounce,
 *              bounceback, wobble och puls. Applicera på valfri property i tidslinjen.
 * @usage       Välj en property i AE-tidslinjen, konfigurera parametrarna och klicka Apply.
 *              Klicka Apply igen med nya värden för att uppdatera en befintlig expression.
 * @ae-version  2026
 */
(function motionSwingPanel(thisObj) {

  var statusEl;

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /** parseFloat with fallback */
  function pf(field, fallback) {
    var v = parseFloat(field.text);
    return isNaN(v) ? fallback : v;
  }

  function setStatus(msg, isErr) {
    if (!statusEl) return;
    statusEl.text = msg;
    statusEl.graphics.foregroundColor = statusEl.graphics.newPen(
      statusEl.graphics.PenType.SOLID_COLOR,
      isErr ? [0.9, 0.3, 0.3] : [0.3, 0.8, 0.4],
      1
    );
  }

  /**
   * Apply exprStr to every selected property in the active comp.
   * Clicking Apply a second time with new values replaces the old expression.
   */
  function applyToSelected(exprStr, undoLabel) {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
      setStatus("No active composition.", true);
      return;
    }
    var sel = comp.selectedProperties;
    if (!sel || sel.length === 0) {
      setStatus("Select at least one property in the timeline first.", true);
      return;
    }
    app.beginUndoGroup(undoLabel || "Apply Motion Expression");
    var count = 0;
    for (var i = 0; i < sel.length; i++) {
      try {
        sel[i].expression = exprStr;
        count++;
      } catch (err) {
        setStatus("Error on property " + (i + 1) + ": " + err.message, true);
        app.endUndoGroup();
        return;
      }
    }
    app.endUndoGroup();
    setStatus(
      "Applied to " + count + " propert" + (count === 1 ? "y" : "ies") + ".",
      false
    );
  }

  /** Clear the expression from all selected properties. */
  function removeFromSelected() {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) { setStatus("No active composition.", true); return; }
    var sel = comp.selectedProperties;
    if (!sel || sel.length === 0) { setStatus("Select at least one property.", true); return; }
    app.beginUndoGroup("Remove Expression");
    var count = 0;
    for (var i = 0; i < sel.length; i++) {
      try { sel[i].expression = ""; count++; } catch (e) {}
    }
    app.endUndoGroup();
    setStatus(
      "Removed from " + count + " propert" + (count === 1 ? "y" : "ies") + ".",
      false
    );
  }

  // ── UI row builders ───────────────────────────────────────────────────────────

  /** Labeled text input row. Returns the edittext field. */
  function addRow(parent, label, defaultVal, labelWidth) {
    var row = parent.add("group");
    row.orientation = "row";
    row.alignment   = ["fill", "center"];
    row.spacing     = 4;
    var lbl = row.add("statictext", undefined, label);
    lbl.preferredSize.width = labelWidth || 140;
    lbl.alignment = ["left", "center"];
    var field = row.add("edittext", undefined, String(defaultVal));
    field.preferredSize.width = 68;
    field.alignment = ["right", "center"];
    return field;
  }

  /** Labeled dropdown row. Returns the dropdownlist. */
  function addDropdown(parent, label, items, labelWidth) {
    var row = parent.add("group");
    row.orientation = "row";
    row.alignment   = ["fill", "center"];
    row.spacing     = 4;
    var lbl = row.add("statictext", undefined, label);
    lbl.preferredSize.width = labelWidth || 140;
    lbl.alignment = ["left", "center"];
    var dd = row.add("dropdownlist", undefined, items);
    dd.selection = 0;
    dd.preferredSize.width = 90;
    dd.alignment = ["right", "center"];
    return dd;
  }

  /** Dimmed hint text. */
  function addHint(parent, text) {
    var h = parent.add("statictext", undefined, text, { multiline: true });
    h.alignment = ["fill", "top"];
    h.graphics.foregroundColor = h.graphics.newPen(
      h.graphics.PenType.SOLID_COLOR, [0.5, 0.5, 0.5], 1
    );
    return h;
  }

  /** Full-width Apply button. */
  function addApplyBtn(parent, label, onClick) {
    var btn = parent.add("button", undefined, label);
    btn.alignment = ["fill", "top"];
    btn.onClick = onClick;
    return btn;
  }

  /** Thin horizontal separator. */
  function addSeparator(parent) {
    var sep = parent.add("panel", undefined, undefined);
    sep.alignment = ["fill", "top"];
    sep.preferredSize.height = 2;
    return sep;
  }

  // ── Axis helper ───────────────────────────────────────────────────────────────

  /**
   * Returns [ax, ay] from a dropdown selection index.
   * Index 0 = X, 1 = Y, 2 = X + Y
   */
  function axisFactors(idx) {
    if (idx === 1) return [0, 1];
    if (idx === 2) return [1, 1];
    return [1, 0];
  }

  // ── Expression string builders ────────────────────────────────────────────────

  /**
   * SWING — Damped pendulum that eases to a stop.
   *
   * Improvements over the bare formula:
   *  - Additive: adds oscillation on top of the property's own value/keyframes
   *  - Time reference: uses inPoint so the swing starts when the layer enters
   *  - Dimension-aware: handles 1D (Rotation, Opacity), 2D and 3D (Position)
   *  - Axis selection: controls which axis is affected for 2D/3D properties
   */
  function buildSwingExpr(maxDist, speed, duration, ax, ay) {
    return [
      'var maxDist = ' + maxDist + ';',
      'var speed   = ' + speed   + ';',
      'var duration= ' + duration + ';',
      'var ax = ' + ax + ', ay = ' + ay + ';',
      'var t = time - inPoint;',
      'var easeAmt = ease(t, 0, duration, maxDist, 0);',
      'var sw = Math.sin(t * speed) * easeAmt;',
      '(value instanceof Array)',
      '  ? (value.length >= 3',
      '      ? [value[0] + sw*ax, value[1] + sw*ay, value[2]]',
      '      : [value[0] + sw*ax, value[1] + sw*ay])',
      '  : value + sw;'
    ].join('\n');
  }

  /**
   * SINE / COSINE — Continuous oscillation.
   *
   * Modes:
   *  0 – Sine 1D:    single-axis sine wave; works on any property
   *  1 – Cosine 1D:  same, cosine phase; works on any property
   *  2 – Circle 2D:  X = cos, Y = sin → circular orbit; requires 2D property
   *  3 – Figure-8:   Lissajous 2:1 ratio (X = cos, Y = sin×2freq); requires 2D
   */
  function buildSineExpr(amp, freq, phase, mode) {
    var ph = 'var phase = ' + phase + ' * Math.PI / 180;';
    var hd = 'var amp = ' + amp + ', freq = ' + freq + ';';

    if (mode === 0) {
      return [
        hd, ph,
        'var s = Math.sin(time * freq * Math.PI * 2 + phase) * amp;',
        '(value instanceof Array)',
        '  ? (value.length >= 3',
        '      ? [value[0] + s, value[1], value[2]]',
        '      : [value[0] + s, value[1]])',
        '  : value + s;'
      ].join('\n');
    }
    if (mode === 1) {
      return [
        hd, ph,
        'var s = Math.cos(time * freq * Math.PI * 2 + phase) * amp;',
        '(value instanceof Array)',
        '  ? (value.length >= 3',
        '      ? [value[0] + s, value[1], value[2]]',
        '      : [value[0] + s, value[1]])',
        '  : value + s;'
      ].join('\n');
    }
    if (mode === 2) {
      return [
        hd, ph,
        '[value[0] + Math.cos(time * freq * Math.PI * 2 + phase) * amp,',
        ' value[1] + Math.sin(time * freq * Math.PI * 2 + phase) * amp];'
      ].join('\n');
    }
    if (mode === 3) {
      return [
        hd, ph,
        '[value[0] + Math.cos(time * freq * Math.PI * 2 + phase) * amp,',
        ' value[1] + Math.sin(time * freq * Math.PI * 4 + phase) * amp];'
      ].join('\n');
    }
    return 'value;';
  }

  /**
   * INERTIA BOUNCE — Elastic overshoot after each keyframe.
   *
   * Improvements:
   *  - var declarations throughout (no global pollution)
   *  - oscTime replaces the hardcoded t < 1 threshold
   *  - thisComp.frameDuration for reliable frame-rate-independent offset
   *  - Works with any property (1D or 2D/3D)
   */
  function buildInertiaExpr(amp, freq, decay, oscTime) {
    return [
      'var amp     = ' + amp     + ';',
      'var freq    = ' + freq    + ';',
      'var decay   = ' + decay   + ';',
      'var oscTime = ' + oscTime + ';',
      'var n = 0;',
      'if (numKeys > 0) {',
      '  n = nearestKey(time).index;',
      '  if (key(n).time > time) n--;',
      '}',
      'var t = (n > 0) ? time - key(n).time : 0;',
      'if (n > 0 && t < oscTime) {',
      '  var v = velocityAtTime(key(n).time - thisComp.frameDuration / 10);',
      '  value + v * amp * Math.sin(freq * t * 2 * Math.PI) / Math.exp(decay * t);',
      '} else {',
      '  value;',
      '}'
    ].join('\n');
  }

  /**
   * BOUNCEBACK — Realistic gravity bounce after the last keyframe.
   *
   * Improvements:
   *  - thisComp.frameDuration instead of hardcoded .001 (frame-rate-independent)
   *  - var declarations throughout
   *  - Correct 2D/3D zero-vector fallback per dimension
   *  - Ternary final expression (consistent return style)
   */
  function buildBounceExpr(e, g, nMax) {
    return [
      'var e    = ' + e    + ';',
      'var g    = ' + g    + ';',
      'var nMax = ' + nMax + ';',
      'var n = 0;',
      'if (numKeys > 0) {',
      '  n = nearestKey(time).index;',
      '  if (key(n).time > time) n--;',
      '}',
      'if (n > 0) {',
      '  var t  = time - key(n).time;',
      '  var v  = -velocityAtTime(key(n).time - thisComp.frameDuration) * e;',
      '  var vl = length(v);',
      '  var vu;',
      '  if (value instanceof Array) {',
      '    vu = (vl > 0) ? normalize(v) : (value.length >= 3 ? [0,0,0] : [0,0]);',
      '  } else {',
      '    vu = (v < 0) ? -1 : 1;',
      '  }',
      '  var tCur   = 0;',
      '  var segDur = 2 * vl / g;',
      '  var tNext  = segDur;',
      '  var nb     = 1;',
      '  while (tNext < t && nb <= nMax) {',
      '    vl     *= e;',
      '    segDur *= e;',
      '    tCur    = tNext;',
      '    tNext  += segDur;',
      '    nb++;',
      '  }',
      '  var delta = t - tCur;',
      '  (nb <= nMax) ? value + vu * delta * (vl - g * delta / 2) : value;',
      '} else {',
      '  value;',
      '}'
    ].join('\n');
  }

  /**
   * WOBBLE — Organic multi-frequency oscillation.
   *
   * Two sine waves at an irrational frequency ratio (default: golden ratio 1.618)
   * produce a non-repeating, organic feel without the mechanical look of a pure sine.
   * Great for breathing effects, subtle camera shake or character jitter.
   */
  function buildWobbleExpr(amp, freq, ratio, ax, ay) {
    return [
      'var amp   = ' + amp   + ';',
      'var freq  = ' + freq  + ';',
      'var ratio = ' + ratio + ';',
      'var ax = ' + ax + ', ay = ' + ay + ';',
      'var w = (Math.sin(time * freq * Math.PI * 2)         * 0.65 +',
      '         Math.sin(time * freq * ratio * Math.PI * 2) * 0.35) * amp;',
      '(value instanceof Array)',
      '  ? (value.length >= 3',
      '      ? [value[0] + w*ax, value[1] + w*ay, value[2]]',
      '      : [value[0] + w*ax, value[1] + w*ay])',
      '  : value + w;'
    ].join('\n');
  }

  /**
   * PULSE — Rhythmic beat synchronized to a BPM.
   *
   * Uses a raised cosine raised to `sharpness` — 1 = smooth half-wave,
   * higher values = sharp, percussive spike. Apply to Scale or Opacity for
   * music-sync animations, or to Position Y for a bouncing-ball beat effect.
   */
  function buildPulseExpr(bpm, amp, sharpness) {
    return [
      'var bpm       = ' + bpm       + ';',
      'var amp       = ' + amp       + ';',
      'var sharpness = ' + sharpness + ';',
      'var beatDur = 60 / bpm;',
      'var t = (time % beatDur) / beatDur;',
      'var pulse = Math.pow(Math.max(0, Math.cos(t * Math.PI * 2)), sharpness);',
      '(value instanceof Array)',
      '  ? (value.length >= 3',
      '      ? [value[0] + pulse*amp, value[1] + pulse*amp, value[2]]',
      '      : [value[0] + pulse*amp, value[1] + pulse*amp])',
      '  : value + pulse * amp;'
    ].join('\n');
  }

  // ── Tab builders ──────────────────────────────────────────────────────────────

  function buildSwingTab(tab) {
    tab.orientation = "column";
    tab.alignment   = ["fill", "fill"];
    tab.margins     = 10;
    tab.spacing     = 6;

    addHint(tab, "Damped pendulum that eases to a stop. Starts at layer inPoint.\nWorks on Rotation (1D) and Position (2D/3D).");
    addSeparator(tab);

    var maxDistF  = addRow(tab, "Max Distance:", 75);
    var speedF    = addRow(tab, "Speed:", 5);
    var durationF = addRow(tab, "Duration (s):", 6);
    var axDD      = addDropdown(tab, "Axis (2D/3D):", ["X", "Y", "X + Y"]);

    addSeparator(tab);
    addApplyBtn(tab, "Apply Swing", function () {
      var axis = axisFactors(axDD.selection ? axDD.selection.index : 0);
      applyToSelected(
        buildSwingExpr(pf(maxDistF, 75), pf(speedF, 5), pf(durationF, 6), axis[0], axis[1]),
        "Apply Swing Expression"
      );
    });
  }

  function buildSineTab(tab) {
    tab.orientation = "column";
    tab.alignment   = ["fill", "fill"];
    tab.margins     = 10;
    tab.spacing     = 6;

    addHint(tab, "Continuous oscillation. Circle and Figure-8 modes require a 2D property (e.g. Position).");
    addSeparator(tab);

    var ampF   = addRow(tab, "Amplitude:", 100);
    var freqF  = addRow(tab, "Frequency (Hz):", 1);
    var phaseF = addRow(tab, "Phase (degrees):", 0);
    var modeDD = addDropdown(tab, "Mode:", ["Sine 1D", "Cosine 1D", "Circle 2D", "Figure-8 2D"]);

    addSeparator(tab);
    addApplyBtn(tab, "Apply Sine/Cosine", function () {
      applyToSelected(
        buildSineExpr(
          pf(ampF, 100), pf(freqF, 1), pf(phaseF, 0),
          modeDD.selection ? modeDD.selection.index : 0
        ),
        "Apply Sine Expression"
      );
    });
  }

  function buildInertiaTab(tab) {
    tab.orientation = "column";
    tab.alignment   = ["fill", "fill"];
    tab.margins     = 10;
    tab.spacing     = 6;

    addHint(tab, "Elastic overshoot based on incoming velocity at each keyframe.\nWorks on any property. Needs at least one keyframe.");
    addSeparator(tab);

    var ampF     = addRow(tab, "Amplitude:", 0.05);
    var freqF    = addRow(tab, "Frequency:", 4.0);
    var decayF   = addRow(tab, "Decay:", 8.0);
    var oscTimeF = addRow(tab, "Oscillation time (s):", 1.0);

    addSeparator(tab);
    addApplyBtn(tab, "Apply Inertia Bounce", function () {
      applyToSelected(
        buildInertiaExpr(pf(ampF, 0.05), pf(freqF, 4.0), pf(decayF, 8.0), pf(oscTimeF, 1.0)),
        "Apply Inertia Bounce Expression"
      );
    });
  }

  function buildBounceTab(tab) {
    tab.orientation = "column";
    tab.alignment   = ["fill", "fill"];
    tab.margins     = 10;
    tab.spacing     = 6;

    addHint(tab, "Physics gravity bounce after the last keyframe.\nWorks with Position (2D/3D) and 1D properties.");
    addSeparator(tab);

    var elasticF = addRow(tab, "Elasticity (0 – 1):", 0.7);
    var gravF    = addRow(tab, "Gravity:", 5000);
    var nMaxF    = addRow(tab, "Max Bounces:", 9);

    addSeparator(tab);
    addApplyBtn(tab, "Apply Bounceback", function () {
      applyToSelected(
        buildBounceExpr(pf(elasticF, 0.7), pf(gravF, 5000), pf(nMaxF, 9)),
        "Apply Bounceback Expression"
      );
    });
  }

  function buildWobbleTab(tab) {
    tab.orientation = "column";
    tab.alignment   = ["fill", "fill"];
    tab.margins     = 10;
    tab.spacing     = 6;

    addHint(tab, "Two sines at an irrational frequency ratio — organic, non-repeating motion.\nDefault ratio 1.618 (golden ratio) avoids mechanical patterns.");
    addSeparator(tab);

    var ampF   = addRow(tab, "Amplitude:", 30);
    var freqF  = addRow(tab, "Base Frequency (Hz):", 1.5);
    var ratioF = addRow(tab, "Freq Ratio:", 1.618);
    var axDD   = addDropdown(tab, "Axis (2D/3D):", ["X", "Y", "X + Y"]);

    addSeparator(tab);
    addApplyBtn(tab, "Apply Wobble", function () {
      var axis = axisFactors(axDD.selection ? axDD.selection.index : 0);
      applyToSelected(
        buildWobbleExpr(pf(ampF, 30), pf(freqF, 1.5), pf(ratioF, 1.618), axis[0], axis[1]),
        "Apply Wobble Expression"
      );
    });
  }

  function buildPulseTab(tab) {
    tab.orientation = "column";
    tab.alignment   = ["fill", "fill"];
    tab.margins     = 10;
    tab.spacing     = 6;

    addHint(tab, "Rhythmic beat synced to BPM. Sharpness 1 = smooth cosine, 4+ = percussive spike.\nApply to Scale, Opacity, or Position Y for music-sync effects.");
    addSeparator(tab);

    var bpmF       = addRow(tab, "BPM:", 120);
    var ampF       = addRow(tab, "Amplitude:", 20);
    var sharpnessF = addRow(tab, "Sharpness (1 – 6):", 2);

    addSeparator(tab);
    addApplyBtn(tab, "Apply Pulse", function () {
      applyToSelected(
        buildPulseExpr(pf(bpmF, 120), pf(ampF, 20), pf(sharpnessF, 2)),
        "Apply Pulse Expression"
      );
    });
  }

  // ── Main UI ───────────────────────────────────────────────────────────────────

  function buildUI(w) {
    w.orientation = "column";
    w.alignment   = ["fill", "fill"];
    w.spacing     = 6;
    w.margins     = 8;

    // Title
    var titleGrp = w.add("group");
    titleGrp.orientation = "row";
    titleGrp.alignment   = ["fill", "top"];
    var title = titleGrp.add("statictext", undefined, "Motion Expressions");
    title.graphics.font  = ScriptUI.newFont("dialog", "BOLD", 13);

    // Tabbed panel
    var tabs = w.add("tabbedpanel");
    tabs.alignment = ["fill", "fill"];

    buildSwingTab(tabs.add("tab", undefined, "Swing"));
    buildSineTab(tabs.add("tab",  undefined, "Sine/Cos"));
    buildInertiaTab(tabs.add("tab", undefined, "Inertia"));
    buildBounceTab(tabs.add("tab", undefined, "Bounce"));
    buildWobbleTab(tabs.add("tab", undefined, "Wobble"));
    buildPulseTab(tabs.add("tab",  undefined, "Pulse"));

    // Bottom bar: status + remove button
    var bottomGrp = w.add("group");
    bottomGrp.orientation = "row";
    bottomGrp.alignment   = ["fill", "bottom"];

    statusEl = bottomGrp.add("statictext", undefined, "Select a property, then Apply.");
    statusEl.alignment = ["fill", "center"];

    var removeBtn = bottomGrp.add("button", undefined, "Remove");
    removeBtn.preferredSize.width = 72;
    removeBtn.alignment           = ["right", "center"];
    removeBtn.helpTip             = "Clear expression from all selected properties";
    removeBtn.onClick             = removeFromSelected;
  }

  // ── Launch ────────────────────────────────────────────────────────────────────

  var palette;
  if (thisObj instanceof Panel) {
    palette = thisObj;
    buildUI(palette);
    palette.layout.layout(true);
  } else {
    palette = new Window("palette", "Motion Expressions", undefined, { resizeable: true });
    buildUI(palette);
    palette.layout.layout(true);
    palette.center();
    palette.show();
  }

}(this));
