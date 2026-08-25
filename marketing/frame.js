// Shows exactly one .frame, chosen by the URL hash (#1, #2, …).
// render.py drives this — one Chrome screenshot per frame.
(function () {
  function show() {
    var i = parseInt((location.hash || "#1").slice(1), 10) || 1;
    var frames = document.querySelectorAll(".frame");
    frames.forEach(function (f, n) { f.style.display = n + 1 === i ? "block" : "none"; });
    document.title = "frame " + i + " of " + frames.length;
  }
  window.addEventListener("hashchange", show);
  show();
})();
