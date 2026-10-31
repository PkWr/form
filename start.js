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
    var h1 = box.querySelector("h1"), first = h1 && h1.nextElementSibling;
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
