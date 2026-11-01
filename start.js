// Start screen, as on Spot: a black screen with a round "open" button; the About drawer slides out from the right strip. Skipped when the address has a query (?...).
(function () {
  var root = document.documentElement;
  if (!root.classList.contains("show-start")) return;
  var drawer = document.getElementById("startDrawer"), strip = document.getElementById("startStrip");
  var link = document.querySelector(".cp-foot .hint a:last-of-type");
  if (link) document.getElementById("startVersion").textContent = link.textContent;
  function open() {
    if (!root.classList.contains("show-start")) return;
    root.classList.add("start-leaving");
    setTimeout(function () { root.classList.remove("show-start", "start-leaving"); }, 500);
  }
  document.getElementById("startOpen").addEventListener("click", open);
  function setAbout(on) { drawer.classList.toggle("is-open", on); strip.setAttribute("aria-expanded", String(on)); }
  // Phones fire a pretend rollover around a tap; ignore those so the tap decides.
  var lastTouch = 0, openedAt = 0;
  window.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") lastTouch = Date.now(); }, true);
  var touchy = function () { return Date.now() - lastTouch < 800; };
  strip.addEventListener("mouseenter", function () { if (!touchy() && !drawer.classList.contains("is-open")) { openedAt = Date.now(); setAbout(true); } });
  drawer.addEventListener("mouseleave", function () { if (!touchy()) setAbout(false); });
  document.getElementById("startOpen").addEventListener("mouseenter", function () { if (!touchy()) setAbout(false); });
  strip.addEventListener("click", function () { if (Date.now() - openedAt < 400) return; setAbout(!drawer.classList.contains("is-open")); });
  window.addEventListener("keydown", function (e) { if (e.key === "Escape") setAbout(false); });
  document.getElementById("startScreen").addEventListener("pointerdown", function (e) { if (!drawer.contains(e.target)) setAbout(false); });
  // Fill the drawer from about.html (the one copy of the About text).
  fetch("about.html").then(function (r) { return r.text(); }).then(function (html) {
    var main = new DOMParser().parseFromString(html, "text/html").querySelector("main");
    if (!main) return;
    main.querySelectorAll(".foot").forEach(function (n) { n.remove(); });
    main.querySelectorAll('a[href="./"]').forEach(function (n) { (n.parentNode.tagName === "P" ? n.parentNode : n).remove(); });
    var box = document.getElementById("startAboutContent");
    box.innerHTML = main.innerHTML;
    var h1 = box.querySelector("h1"), first = box.querySelector("h2 + p") || (h1 && h1.nextElementSibling);
    if (h1) h1.textContent = "Form";
    if (!first) return;
    // Phones: the panel covers the circle, so it carries its own way in: the first paragraph, an open circle and "More about Form", the rest unfolding below.
    box.classList.add("is-short");
    var circle = function () {
      var b = document.createElement("button");
      b.type = "button"; b.className = "sa-open"; b.textContent = "open";
      b.addEventListener("click", function () { setAbout(false); open(); });
      return b;
    };
    var more = document.createElement("button");
    more.type = "button"; more.className = "sa-more"; more.textContent = "More about Form \u2193";
    more.addEventListener("click", function () { box.classList.remove("is-short"); more.remove(); });
    var lead = document.createElement("div");
    lead.className = "sa-lead"; lead.appendChild(circle()); lead.appendChild(more);
    first.after(lead);
    var tail = circle(); tail.classList.add("sa-open-end"); box.appendChild(tail);
  }).catch(function () { /* keeps the plain link to about.html */ });
  // First visit: the About panel slides out by itself, so the project is introduced before the circle.
  setTimeout(function () { if (root.classList.contains("show-start") && !drawer.classList.contains("is-open")) setAbout(true); }, 700);
  window.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && root.classList.contains("show-start") && e.target === document.body) { e.preventDefault(); open(); }
  });
})();
// The start mark: the F in as few blocks as it can be, three, keeping its structure: the stem, the top bar and the arm. They lie scattered at random (turned, never overlapping) until you roll over the mark (or, on a touch screen, a moment after it appears); then each slides home and straightens into the F. Leaving scatters them again. Only these three shapes are used.
(function () {
  if (!document.documentElement.classList.contains("show-start")) return;
  var btn = document.getElementById("startOpen"), svg = btn && btn.querySelector("svg");
  if (!svg) return;
  var NS = "http://www.w3.org/2000/svg";
  // w, h and home position (top left) in the F's 300 x 500 box.
  var F = [{ w: 100, h: 500, x: 0, y: 0 }, { w: 200, h: 100, x: 100, y: 0 }, { w: 100, h: 100, x: 100, y: 200 }];
  var AREA = { x0: -150, x1: 450, y0: 0, y1: 500 }, TURNS = [-180, -90, 0, 90, 180];
  svg.setAttribute("viewBox", "-152 -2 604 504");
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  // The word "open" sits in the top bar and turns with it, so it is read at whatever angle the bar is at.
  var nodes = F.map(function (p, i) {
    var g = document.createElementNS(NS, "g"), n = document.createElementNS(NS, "path");
    n.setAttribute("d", "M0 0H" + p.w + "V" + p.h + "H0Z"); g.appendChild(n);
    if (i === 1) {
      var t = document.createElementNS(NS, "text");
      t.setAttribute("x", p.w / 2); t.setAttribute("y", p.h / 2); t.setAttribute("text-anchor", "middle"); t.setAttribute("dominant-baseline", "central");
      t.setAttribute("class", "mark-word"); t.textContent = "open"; g.appendChild(t);
    }
    svg.appendChild(g); return g;
  });
  // Each piece has a current pose; every move runs from wherever it is now to a target pose, so nothing ever jumps. Leaving picks a fresh scatter as the target.
  var cur = [], HOME = F.map(function (p) { return { x: p.x, y: p.y, rot: 0 }; });
  function scatter() {
    var placed = [], tries = 0;
    return F.map(function (p) {
      for (;;) {
        var rot = TURNS[Math.floor(Math.random() * TURNS.length)], q = Math.abs(rot) === 90, w = q ? p.h : p.w, h = q ? p.w : p.h;
        var cx = AREA.x0 + w / 2 + Math.random() * (AREA.x1 - AREA.x0 - w), cy = AREA.y0 + h / 2 + Math.random() * (AREA.y1 - AREA.y0 - h);
        var box = { l: cx - w / 2 - 24, r: cx + w / 2 + 24, t: cy - h / 2 - 24, b: cy + h / 2 + 24 };
        var clash = placed.some(function (o) { return box.l < o.r && box.r > o.l && box.t < o.b && box.b > o.t; });
        if (!clash || ++tries > 400) { placed.push(box); return { x: cx - p.w / 2, y: cy - p.h / 2, rot: rot }; }
      }
    });
  }
  function draw() {
    F.forEach(function (p, i) { var c = cur[i]; nodes[i].setAttribute("transform", "translate(" + c.x.toFixed(1) + " " + c.y.toFixed(1) + ") rotate(" + c.rot.toFixed(1) + " " + p.w / 2 + " " + p.h / 2 + ")"); });
  }
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, raf = 0;
  function ease(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function go(target) {
    cancelAnimationFrame(raf);
    if (reduce) { cur = target.map(function (t) { return { x: t.x, y: t.y, rot: t.rot }; }); draw(); return; }
    var start = cur.map(function (c) { return { x: c.x, y: c.y, rot: c.rot }; }), t0 = performance.now();
    (function step(now) {
      var u = Math.min(1, (now - t0) / 800), e = ease(u);
      cur = start.map(function (s, i) { var t = target[i]; return { x: s.x + (t.x - s.x) * e, y: s.y + (t.y - s.y) * e, rot: s.rot + (t.rot - s.rot) * e }; });
      draw(); if (u < 1) raf = requestAnimationFrame(step);
    })(t0);
  }
  cur = scatter(); draw();
  btn.addEventListener("mouseenter", function () { go(HOME); });
  btn.addEventListener("focus", function () { go(HOME); });
  function away() { go(scatter()); }
  btn.addEventListener("mouseleave", away); btn.addEventListener("blur", away);
  if (matchMedia("(pointer: coarse)").matches) setTimeout(function () { go(HOME); }, 1600);
})();
