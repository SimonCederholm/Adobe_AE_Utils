var rect = thisLayer.sourceRectAtTime(time, false);
var center = thisLayer.toComp([rect.left + rect.width/2, rect.top + rect.height/2]);
var radius = [rect.width, rect.height];

var s = thisComp.layer("Bakgrund").sampleImage(center, radius, true, 0);
var L = 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];

L > 0.5 ? dark : light;
var light = [1, 1, 1, 1];  // vit
var dark  = [0, 0, 0, 1];  // svart

L > 0.6 ? dark : light;
