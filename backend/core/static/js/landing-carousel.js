/* The carousel of monthly picks on the landing page (experimental/landing-carousel).
 *
 * Progressive enhancement over templates/landing.html: the markup is a stack of months that
 * reads whole without this file, and landing-carousel.css turns it into a scroll-snap track once
 * `.carousel--ready` is on the root. What this script owns is only what CSS cannot: starting on
 * the current month (the track is laid out oldest-first, so the natural start is the wrong end),
 * the two buttons, the wrap from one end to the other, the arrow keys, and telling a screen
 * reader which month is in view. The browser owns the scrolling, the snapping and the touch.
 *
 * Plain script, no build step: served by Django through {% static %} like the stylesheets and
 * hashed by the manifest storage in production. Never part of the Vite bundle (ADR-18 keeps the
 * landing outside the SPA). No autoplay, anywhere.
 */
(function () {
  "use strict";

  var root = document.querySelector("[data-carousel]");
  if (!root) return;

  var track = root.querySelector("[data-carousel-track]");
  var controls = root.querySelector("[data-carousel-controls]");
  var status = root.querySelector("[data-carousel-status]");
  var prevButton = root.querySelector("[data-carousel-prev]");
  var nextButton = root.querySelector("[data-carousel-next]");
  if (!track || !controls || !status || !prevButton || !nextButton) return;

  // Visual order, not DOM order. The template writes the newest month first (what a crawler and a
  // screen reader should meet first) and the CSS reverses that with `order`, so index 0 here is
  // the oldest month on the left and the last index is the current one on the right.
  var slides = Array.prototype.slice.call(track.querySelectorAll("[data-carousel-slide]")).reverse();

  // One month is a block, not a carousel: leave the stack alone and the controls hidden.
  if (slides.length < 2) return;

  var count = slides.length;
  var index = count - 1;
  var settleTimer = 0;

  // --- ARIA -----------------------------------------------------------------------------------
  // The APG carousel pattern, applied only now that there is a carousel. In the stack the slides
  // are plain blocks with their own headings, which is the truthful description of that layout.
  root.setAttribute("aria-roledescription", "carrossel");
  slides.forEach(function (slide) {
    slide.setAttribute("role", "group");
    slide.setAttribute("aria-roledescription", "slide");
    slide.setAttribute("aria-label", slide.getAttribute("data-carousel-label") || "");
  });
  // Focusable so the arrow keys work everywhere, not only where the browser makes scrollable
  // regions focusable on its own (Chrome and Firefox do, Safari does not). A focusable box
  // needs a role and a name, or a screen reader names it by reading every slide in a row.
  track.setAttribute("tabindex", "0");
  track.setAttribute("role", "group");
  track.setAttribute("aria-label", "Leituras por mês");

  var srLabel = document.createElement("span");
  srLabel.className = "carousel__sr";
  var position = document.createTextNode("");
  status.appendChild(srLabel);
  status.appendChild(position);

  // --- positions ------------------------------------------------------------------------------
  function paddingStart() {
    return parseFloat(getComputedStyle(track).paddingLeft) || 0;
  }

  // Where the track has to scroll for a slide to sit on its snap point. offsetLeft is measured
  // from the track's padding edge (the track is position: relative), and the snap point is
  // scroll-padding in from the scrollport, so the two cancel to a plain subtraction.
  function offsetOf(slide) {
    return slide.offsetLeft - paddingStart();
  }

  function nearestIndex() {
    var left = track.scrollLeft;
    var best = 0;
    var bestDistance = Infinity;
    slides.forEach(function (slide, i) {
      var distance = Math.abs(offsetOf(slide) - left);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    return best;
  }

  function announce() {
    srLabel.textContent = (slides[index].getAttribute("data-carousel-label") || "") + ", ";
    position.textContent = index + 1 + " de " + count;
  }

  // `instant` is for the first positioning and for resizes, where a glide would be motion nobody
  // asked for. Otherwise the call carries no behaviour and the stylesheet decides: smooth, or
  // `auto` under prefers-reduced-motion — one place for that rule, and it is the CSS.
  function go(target, instant) {
    index = ((target % count) + count) % count; // the loop: past either end, the other end
    announce();
    var options = { left: offsetOf(slides[index]), top: 0 };
    if (instant) options.behavior = "instant";
    track.scrollTo(options);
  }

  // --- events ---------------------------------------------------------------------------------
  prevButton.addEventListener("click", function () {
    go(index - 1);
  });

  nextButton.addEventListener("click", function () {
    go(index + 1);
  });

  track.addEventListener("keydown", function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    switch (event.key) {
      case "ArrowLeft":
        go(index - 1);
        break;
      case "ArrowRight":
        go(index + 1);
        break;
      case "Home":
        go(0);
        break;
      case "End":
        go(count - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  });

  // A swipe or a scrollbar drag moves the track without going through go(). Read the position
  // back once the scrolling has settled — not on every event, or a button press would announce
  // every month it glides past on the way to the one it was asked for.
  track.addEventListener(
    "scroll",
    function () {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(function () {
        var settled = nearestIndex();
        if (settled !== index) {
          index = settled;
          announce();
        }
      }, 150);
    },
    { passive: true }
  );

  // Snap points move with the width; keep the same month in view rather than wherever the
  // browser's own re-snap lands.
  var resizeFrame = 0;
  window.addEventListener("resize", function () {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(function () {
      go(index, true);
    });
  });

  // --- start ----------------------------------------------------------------------------------
  // The class first — offsets only exist once the track is horizontal — then straight to the
  // current month, before the first paint of the new layout. Deferred scripts run after the
  // stylesheets, so the offsets read here are the real ones.
  root.classList.add("carousel--ready");
  controls.hidden = false;
  go(index, true);
})();
