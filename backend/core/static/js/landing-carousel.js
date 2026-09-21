/* The carousel of monthly picks on the landing page (experimental/landing-carousel).
 *
 * Progressive enhancement over templates/landing.html: the markup is a stack of months that
 * reads whole without this file, and landing-carousel.css turns it into a scroll-snap track once
 * `.carousel--ready` is on the root. What this script owns is only what CSS cannot: starting on
 * the current month (the track is laid out oldest-first, so the natural start is the wrong end),
 * the two arrows, the dots it builds from the slides, the wrap from one end to the other, the
 * arrow keys, dragging the track with a mouse, and telling a screen reader which month is in
 * view. The browser owns the scrolling, the snapping and the touch swipe.
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
  var status = root.querySelector("[data-carousel-status]");
  var prevButton = root.querySelector("[data-carousel-prev]");
  var nextButton = root.querySelector("[data-carousel-next]");
  var dotsBox = root.querySelector("[data-carousel-dots]");
  if (!track || !status || !prevButton || !nextButton || !dotsBox) return;

  // Visual order, not DOM order. The template writes the newest month first (what a crawler and a
  // screen reader should meet first) and the CSS reverses that with `order`, so index 0 here is
  // the oldest month on the left and the last index is the current one on the right.
  var slides = Array.prototype.slice.call(track.querySelectorAll("[data-carousel-slide]")).reverse();

  // One month is a block, not a carousel: leave the stack alone and the controls hidden.
  if (slides.length < 2) return;

  var count = slides.length;
  var index = count - 1;
  var settleTimer = 0;
  var dots = [];

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

  // --- dots -----------------------------------------------------------------------------------
  // Built here rather than in the template: they are controls that only work with this file, so
  // without it there is nothing to render. Labelled by the month, and the one in view carries
  // aria-current, which is also what the stylesheet lights up.
  slides.forEach(function (slide, i) {
    var dot = document.createElement("button");
    dot.type = "button";
    dot.className = "carousel__dot";
    dot.setAttribute("aria-label", "Ver " + (slide.getAttribute("data-carousel-label") || ""));
    dot.addEventListener("click", function () {
      go(i);
    });
    dotsBox.appendChild(dot);
    dots.push(dot);
  });

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

  // What changes when the month in view changes: the lit dot, the slide the stylesheet lifts out
  // of the dimmed row, and the sentence a screen reader hears ("agosto de 2026, 6 de 7").
  function announce() {
    dots.forEach(function (dot, i) {
      if (i === index) {
        dot.setAttribute("aria-current", "true");
      } else {
        dot.removeAttribute("aria-current");
      }
    });
    slides.forEach(function (slide, i) {
      if (i === index) {
        slide.setAttribute("data-carousel-active", "");
      } else {
        slide.removeAttribute("data-carousel-active");
      }
    });
    status.textContent =
      (slides[index].getAttribute("data-carousel-label") || "") + ", " + (index + 1) + " de " + count;
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

  var drag = { active: false, pointerId: null, startX: 0, startScroll: 0, moved: false };

  // A swipe or a scrollbar drag moves the track without going through go(). Read the position
  // back once the scrolling has settled — not on every event, or a button press would announce
  // every month it glides past on the way to the one it was asked for. While the mouse holds
  // the track nothing is settled, so nothing is read.
  track.addEventListener(
    "scroll",
    function () {
      clearTimeout(settleTimer);
      settleTimer = setTimeout(function () {
        if (drag.active) return;
        var settled = nearestIndex();
        if (settled !== index) {
          index = settled;
          announce();
        }
      }, 150);
    },
    { passive: true }
  );

  // --- mouse drag -----------------------------------------------------------------------------
  // Touch already scrolls the track natively and snaps on release; this gives the mouse the
  // same gesture. While the pointer is down the stylesheet turns snapping off (or the slides
  // would jump between points under the hand) and the track follows the pointer one to one. On
  // release the month is decided the way a swipe decides it: past a fraction of a slide in one
  // direction moves one month that way, less than that settles back — always through go(), so
  // the wrap and the reduced-motion rule are the same as for the arrows. Mouse only: a touch or
  // a pen goes on using the browser's own scrolling.
  var DRAG_THRESHOLD = 0.15; // of a slide's width
  var CLICK_TOLERANCE = 6; // px of movement below which a press is still a click

  track.addEventListener("pointerdown", function (event) {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    drag.active = true;
    drag.pointerId = event.pointerId;
    drag.startX = event.clientX;
    drag.startScroll = track.scrollLeft;
    drag.moved = false;
    track.classList.add("carousel__track--dragging");
    // Capture keeps the moves coming when the pointer leaves the track mid-drag. It throws for
    // a pointer the browser is not tracking; the drag still works without it.
    try {
      track.setPointerCapture(event.pointerId);
    } catch (error) {
      /* no capture, no harm */
    }
  });

  track.addEventListener("pointermove", function (event) {
    if (!drag.active || event.pointerId !== drag.pointerId) return;
    var delta = event.clientX - drag.startX;
    if (Math.abs(delta) > CLICK_TOLERANCE) drag.moved = true;
    track.scrollLeft = drag.startScroll - delta;
  });

  function endDrag(event) {
    if (!drag.active || event.pointerId !== drag.pointerId) return;
    drag.active = false;
    track.classList.remove("carousel__track--dragging");
    try {
      if (track.hasPointerCapture(event.pointerId)) track.releasePointerCapture(event.pointerId);
    } catch (error) {
      /* already released */
    }
    var delta = event.clientX - drag.startX;
    var width = slides[index].getBoundingClientRect().width || 1;
    var settled = nearestIndex();
    var target = settled;
    if (settled === index) {
      // Still nearest to where it started: a short pull settles back, a longer one moves one.
      if (delta <= -width * DRAG_THRESHOLD) target = index + 1; // dragged left: the next month
      if (delta >= width * DRAG_THRESHOLD) target = index - 1; // dragged right: the previous
    }
    // No wrap on a drag, unlike the arrows: a touch swipe cannot wrap either, and a hand that
    // pulls past the last month expects it to stay, not to jump to the other end.
    go(Math.max(0, Math.min(count - 1, target)));
  }

  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);

  // A drag that ends over something clickable inside the track must not click it, and an image
  // must not start the browser's own drag-and-drop instead of ours.
  track.addEventListener(
    "click",
    function (event) {
      if (drag.moved) {
        drag.moved = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );
  track.addEventListener("dragstart", function (event) {
    event.preventDefault();
  });

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
  prevButton.hidden = false;
  nextButton.hidden = false;
  dotsBox.hidden = false;
  go(index, true);
})();
