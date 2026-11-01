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
// The start mark: eight pieces of the F, scattered at random over its 3 x 5 grid in a random mix of shapes. Rolling over it (or, on a touch screen, a moment after it appears) turns them into the F: every piece slides home, straightens and squares up. Leaving scatters them again.
(function () {
  if (!document.documentElement.classList.contains("show-start")) return;
  var btn = document.getElementById("startOpen"), svg = btn && btn.querySelector("svg");
  if (!svg) return;
  var K = 0.5523, NS = "http://www.w3.org/2000/svg";
  // Each shape is four cubic segments on a 100 box, so any two can be blended point by point.
  function line(a, b) { return [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3, a[0] + 2 * (b[0] - a[0]) / 3, a[1] + 2 * (b[1] - a[1]) / 3, b[0], b[1]]; }
  function build(start, segs) { return [].concat.apply([start[0], start[1]], segs); }
  var SHAPES = {
    square: build([0, 0], [line([0, 0], [100, 0]), line([100, 0], [100, 100]), line([100, 100], [0, 100]), line([0, 100], [0, 0])]),
    circle: build([50, 0], [[50 + 50 * K, 0, 100, 50 - 50 * K, 100, 50], [100, 50 + 50 * K, 50 + 50 * K, 100, 50, 100], [50 - 50 * K, 100, 0, 50 + 50 * K, 0, 50], [0, 50 - 50 * K, 50 - 50 * K, 0, 50, 0]]),
    triangle: build([0, 0], [line([0, 0], [0, 100]), line([0, 100], [100, 100]), line([100, 100], [100, 100]), line([100, 100], [0, 0])]),
    quarter: build([0, 100], [line([0, 100], [0, 0]), [100 * K, 0, 100, 100 - 100 * K, 100, 100], line([100, 100], [0, 100]), line([0, 100], [0, 100])])
  };
  var KINDS = ["square", "circle", "triangle", "quarter"];
  // The F as eight cells of a 3 x 5 grid: [column, row].
  var F = [[0, 0], [1, 0], [2, 0], [0, 1], [0, 2], [1, 2], [0, 3], [0, 4]];
  var cells = []; for (var r = 0; r < 5; r++) for (var c = 0; c < 3; c++) cells.push([c, r]);
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  var pieces = [], nodes = [];
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  F.forEach(function () { var p = document.createElementNS(NS, "path"); svg.appendChild(p); nodes.push(p); });
  function scatter() {
    var spots = shuffle(cells.slice()).slice(0, F.length);
    pieces = F.map(function (home, i) {
      return { to: { x: spots[i][0] * 100, y: spots[i][1] * 100, rot: 90 * Math.floor(Math.random() * 4), kind: KINDS[Math.floor(Math.random() * KINDS.length)] }, home: { x: home[0] * 100, y: home[1] * 100, rot: 0, kind: "square" } };
    });
  }
  function draw(i, a, b, t) {
    var x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t, rot = a.rot + (b.rot - a.rot) * t, p = SHAPES[a.kind], q = SHAPES[b.kind], v = [];
    for (var k = 0; k < p.length; k++) v.push((p[k] + (q[k] - p[k]) * t).toFixed(1));
    var d = "M" + v[0] + " " + v[1];
    for (k = 2; k < v.length; k += 6) d += "C" + v.slice(k, k + 6).join(" ");
    nodes[i].setAttribute("d", d + "Z");
    nodes[i].setAttribute("transform", "translate(" + x.toFixed(1) + " " + y.toFixed(1) + ") rotate(" + rot.toFixed(1) + " 50 50)");
  }
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches, raf = 0, t = 0, goal = 0;
  function ease(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  // t runs from 0 (scattered) to 1 (the F).
  function paintAt(v) { pieces.forEach(function (p, i) { draw(i, p.to, p.home, ease(v)); }); }
  function go(target) {
    goal = target; if (reduce) { t = target; paintAt(t); return; }
    cancelAnimationFrame(raf); var last = performance.now();
    (function step(now) { var dt = (now - last) / 700; last = now; t += (goal > t ? 1 : -1) * dt; if ((goal > t) === (goal > t + dt) && Math.abs(goal - t) < dt) t = goal; t = Math.max(0, Math.min(1, t)); paintAt(t); if (t !== goal) raf = requestAnimationFrame(step); else if (goal === 0) { scatter(); paintAt(0); } })(last);
  }
  scatter(); paintAt(0);
  btn.addEventListener("mouseenter", function () { go(1); });
  btn.addEventListener("focus", function () { go(1); });
  function away() { go(0); }
  btn.addEventListener("mouseleave", away); btn.addEventListener("blur", away);
  if (matchMedia("(pointer: coarse)").matches) setTimeout(function () { go(1); }, 1600);
})();
