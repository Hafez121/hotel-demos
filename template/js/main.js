(function () {
  "use strict";

  /* ---------- Demo banner ---------- */
  var banner = document.getElementById("demo-banner");
  var closeBtn = document.getElementById("demo-banner-close");
  var BANNER_KEY = "lbb-demo-banner-dismissed";
  if (banner && closeBtn) {
    try {
      if (localStorage.getItem(BANNER_KEY) === "1") banner.hidden = true;
    } catch (e) {}
    closeBtn.addEventListener("click", function () {
      banner.hidden = true;
      try { localStorage.setItem(BANNER_KEY, "1"); } catch (e) {}
    });
  }

  /* ---------- Motion / data-saver gating ---------- */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  var video = document.getElementById("hero-video");
  var poster = document.querySelector(".hero__poster");

  function useStaticPoster() {
    if (video) {
      video.pause();
      video.removeAttribute("autoplay");
      video.hidden = true;
    }
    if (poster) poster.hidden = false;
  }

  if (reduceMotion || saveData) {
    useStaticPoster();
  } else if (video) {
    video.play().catch(function () {
      /* autoplay blocked; poster remains visible via video's poster attribute */
    });
  }

  /* ---------- Parallax (transform-only, single rAF loop) ---------- */
  if (!reduceMotion) {
    var layers = Array.prototype.slice.call(document.querySelectorAll("[data-parallax-layer]"));
    var speeds = { slow: 0.15, medium: 0.32, fast: 0.55 };
    var isNarrow = window.matchMedia("(max-width: 700px)").matches;
    var intensity = isNarrow ? 0.5 : 1;

    var active = new Set();
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) active.add(entry.target);
            else active.delete(entry.target);
          });
        },
        { rootMargin: "20% 0px 20% 0px" }
      );
      layers.forEach(function (el) {
        io.observe(el.closest("section") || el);
      });
      // Observe using the layer's own container; fall back to always-active if not found.
      layers.forEach(function (el) { active.add(el); });
    } else {
      layers.forEach(function (el) { active.add(el); });
    }

    var ticking = false;
    function updateParallax() {
      var y = window.scrollY || window.pageYOffset;
      layers.forEach(function (el) {
        var speed = speeds[el.getAttribute("data-parallax-layer")] || 0.2;
        var offset = Math.round(y * speed * intensity);
        el.style.transform = "translate3d(0, " + offset + "px, 0)";
      });
      ticking = false;
    }
    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    updateParallax();
  }
})();
