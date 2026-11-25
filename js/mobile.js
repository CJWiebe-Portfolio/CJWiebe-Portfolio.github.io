/*
=========================================================
FILE: mobile.js  (DRAFT)
PROJECT: Another Tally - A zombie survival game
AUTHOR: Cygnus J. Wiebe
DATE: December 2026
COURSE: INFS 634 - McGill University
=========================================================
DESCRIPTION:
Small helpers for phones and touch screens, used with css/mobile.css.
Load it in the <head>, right after common.js, with no defer:
  <script src="js/mobile.js"></script>
It puts its classes on <html> straight away (so nothing jumps when the
page first draws) and does the rest once the page and game.js are ready.

Nothing here changes the desktop game. The classes it adds only do
something inside css/mobile.css's media queries, and everything else it
does first checks the same media queries.

DRAFTS (just below) turns each draft on or off:
  bottomTabs   the five tabs move to a bar along the bottom of the screen
  todaySheet   a Today button beside End day shows tonight's odds and
               opens the Today panel as a pull-up sheet
  mapPan       a bigger map you swipe sideways, centred on the shelter
  touchWords   on touch screens "Click" reads "Tap", and keyboard-only
               hints are left out
=========================================================
TABLE OF CONTENTS
Ctrl+F a tag such as "[S3]" to jump to that section.
=========================================================
[S1] Drafts and media queries
[S2] Touch words
[S3] Today sheet
[S4] Map panning
[S5] New tab starts at the top
[S6] Start-up
=========================================================
*/

(function () {
  "use strict";

  // #region [S1] Drafts and media queries
  var DRAFTS = {
    bottomTabs: true,
    todaySheet: true,
    mapPan: true,
    touchWords: true,
  };

  // The same queries as css/mobile.css.
  var phone = window.matchMedia("(max-width: 760px)");
  var stacked = window.matchMedia("(max-width: 960px)"); // Today panel under the tabs
  var touch = window.matchMedia("(hover: none) and (pointer: coarse)");

  var root = document.documentElement;
  if (DRAFTS.bottomTabs) root.classList.add("m-bottom-tabs");
  if (DRAFTS.todaySheet) root.classList.add("m-sheet");
  if (DRAFTS.mapPan) root.classList.add("m-map-pan");

  function $(id) {
    return document.getElementById(id);
  }
  // #endregion [S1] Drafts and media queries

  // #region [S2] Touch words
  /*
  ---------- Touch words ----------
  The game's instructions say "Click" and "press 1–4", which don't fit a
  phone. On touch screens, the known phrases are swapped as they appear.
  [old text, new text]
  */
  var WORDS = [
    [
      "Click zombies before they reach the wall.",
      "Tap zombies before they reach the wall.",
    ],
    ["Click to send or call back.", "Tap to send or call back."],
    [" Press Space or Enter, or click.", " Tap anywhere to cut."],
  ];
  // Defense's hint names the number keys, so it's replaced whole.
  var DEFENSE_HINT =
    "Tap a zombie to take it down. Missing jams your gun for a moment.";

  function swapWords(box) {
    if (!touch.matches || !box) return;
    var hint = box.querySelector(".mg-hint");
    if (hint && hint.querySelector("kbd")) hint.textContent = DEFENSE_HINT;
    var walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) {
      for (var i = 0; i < WORDS.length; i++) {
        if (node.nodeValue.indexOf(WORDS[i][0]) !== -1) {
          node.nodeValue = node.nodeValue.replace(WORDS[i][0], WORDS[i][1]);
        }
      }
    }
  }

  function setupTouchWords() {
    ["minigame-dialog", "panel-map"].forEach(function (id) {
      var box = $(id);
      if (!box) return;
      swapWords(box);
      new MutationObserver(function () {
        swapWords(box);
      }).observe(box, { childList: true, subtree: true });
    });
  }
  // #endregion [S2] Touch words

  // #region [S3] Today sheet
  /*
  ---------- Today sheet ----------
  Adds a Today button beside End day. It shows tonight's defense against
  the horde (coloured like the odds in the panel) and a red count of the
  warnings, and opens the Today panel over the game.
  */
  var sheet = null; // { side, btn, open }

  function setupSheet() {
    var side = document.querySelector("#game .side");
    var endDay = $("end-day");
    if (!side || !endDay) return;
    side.id = side.id || "today-panel";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "m-today-btn";
    btn.setAttribute("aria-controls", side.id);
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML =
      '<span class="m-today-top" aria-hidden="true">Today<span class="m-chev">▴</span></span>' +
      '<span class="m-today-sum" aria-hidden="true"></span>' +
      '<span class="m-today-warn" aria-hidden="true" hidden></span>';
    var backdrop = document.createElement("div");
    backdrop.className = "m-sheet-backdrop";
    var game = $("game");
    game.appendChild(backdrop);
    game.appendChild(btn);

    sheet = { side: side, btn: btn, open: false };

    btn.addEventListener("click", function () {
      if (sheet.open) closeSheet(true);
      else openSheet();
    });
    backdrop.addEventListener("click", function () {
      closeSheet(true);
    });
    endDay.addEventListener("click", function () {
      closeSheet(false);
    });
    // Esc closes the sheet first (capture, so it doesn't also open Pause).
    window.addEventListener(
      "keydown",
      function (e) {
        if (e.key !== "Escape" || !sheet.open) return;
        e.preventDefault();
        e.stopPropagation();
        closeSheet(true);
      },
      true,
    );
    // Grown back to a wide window: the panel is a sidebar again.
    stacked.addEventListener("change", function () {
      if (!stacked.matches) closeSheet(false);
    });

    new MutationObserver(updateSummary).observe(side, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    updateSummary();
  }

  function openSheet() {
    if (!sheet || !stacked.matches) return;
    sheet.open = true;
    root.classList.add("m-sheet-open");
    sheet.btn.setAttribute("aria-expanded", "true");
    sheet.side.scrollTop = 0;
    sheet.side.tabIndex = -1; // so it can take focus while it's open
    sheet.side.focus({ preventScroll: true });
  }

  function closeSheet(returnFocus) {
    if (!sheet || !sheet.open) return;
    sheet.open = false;
    root.classList.remove("m-sheet-open");
    sheet.btn.setAttribute("aria-expanded", "false");
    sheet.side.removeAttribute("tabindex");
    if (returnFocus) sheet.btn.focus({ preventScroll: true });
  }

  // Reads tonight's odds and the warnings from the panel game.js drew.
  function updateSummary() {
    if (!sheet) return;
    var side = sheet.side;
    var nums = side.querySelectorAll("#tonight .odds strong");
    var label = side.querySelector("#tonight .odds-label");
    var warns = side.querySelectorAll("#warnings > li").length;
    var def = nums[0] ? nums[0].textContent : "–";
    var horde = nums[1] ? nums[1].textContent : "–";

    var sum = sheet.btn.querySelector(".m-today-sum");
    sum.innerHTML = "";
    var a = document.createElement("strong");
    a.textContent = def;
    var b = document.createElement("strong");
    b.textContent = horde;
    sum.appendChild(a);
    sum.appendChild(document.createTextNode(" vs "));
    sum.appendChild(b);

    var level = "";
    if (label) {
      ["good", "info", "bad"].forEach(function (l) {
        if (label.classList.contains(l)) level = l;
      });
    }
    sheet.btn.dataset.level = level;

    var badge = sheet.btn.querySelector(".m-today-warn");
    badge.hidden = !warns;
    badge.textContent = warns;

    sheet.btn.setAttribute(
      "aria-label",
      "Today's plan. Defense " +
        def +
        " against a horde of " +
        horde.replace("~", "about ") +
        (label ? ", " + label.firstChild.textContent.trim() : "") +
        (warns ? ". " + warns + (warns === 1 ? " thing" : " things") + " to fix" : "") +
        ".",
    );
  }
  // #endregion [S3] Today sheet

  // #region [S4] Map panning
  /*
  ---------- Map panning ----------
  game.js redraws the whole map every time a place or survivor is picked,
  which would throw the map back to its left edge. This remembers how far
  it was swiped and puts it back, and the first time centres it on the
  shelter. After tapping a place, its details scroll into view if they're
  off the bottom of the screen.
  */
  function setupMap() {
    var panel = $("panel-map");
    if (!panel) return;
    var saved = null; // how far the map was swiped, in px

    function scroller() {
      return panel.querySelector(".map-col");
    }

    function restore() {
      var col = scroller();
      if (!col || panel.hidden || !phone.matches) return;
      if (saved === null) {
        var home = col.querySelector(".loc.home");
        if (!home) return;
        var h = home.getBoundingClientRect();
        var c = col.getBoundingClientRect();
        saved = col.scrollLeft + h.left + h.width / 2 - (c.left + col.clientWidth / 2);
      }
      col.scrollLeft = saved;
    }

    new MutationObserver(function () {
      var col = scroller();
      if (col && !col.dataset.mPan) {
        col.dataset.mPan = "1";
        col.addEventListener(
          "scroll",
          function () {
            saved = col.scrollLeft;
          },
          { passive: true },
        );
      }
      restore();
    }).observe(panel, { childList: true });

    // A hidden tab can't be scrolled, so restore when the Map opens.
    var tab = $("tab-map");
    if (tab) {
      tab.addEventListener("click", function () {
        requestAnimationFrame(restore);
      });
    }

    // Tapping a place: game.js redraws the map (so the tapped pin is gone
    // by the time the click finishes), then the details are scrolled to.
    panel.addEventListener(
      "click",
      function (e) {
        if (!phone.matches || !e.target.closest("[data-loc]")) return;
        requestAnimationFrame(function () {
          var detail = panel.querySelector(".loc-detail");
          if (!detail) return;
          if (detail.getBoundingClientRect().top > window.innerHeight * 0.7) {
            detail.scrollIntoView({
              behavior: root.dataset.motion === "reduce" ? "auto" : "smooth",
              block: "start",
            });
          }
        });
      },
      true, // capture: before game.js redraws
    );
  }
  // #endregion [S4] Map panning

  // #region [S5] New tab starts at the top
  /*
  ---------- New tab starts at the top ----------
  On a phone you're usually far down a long tab when you switch, and the
  new one opened at the same spot, half way down. Also closes the Today
  sheet when one of its warnings jumps to another tab.
  */
  function setupTabs() {
    document.addEventListener("click", function (e) {
      var t = e.target.closest('[role="tab"], [data-goto]');
      if (!t) return;
      if (t.closest(".side")) closeSheet(false);
      if (stacked.matches && window.scrollY > 0) window.scrollTo(0, 0);
    });
  }
  // #endregion [S5] New tab starts at the top

  // #region [S6] Start-up
  document.addEventListener("DOMContentLoaded", function () {
    if (!$("game")) return; // only the game page needs the rest
    if (DRAFTS.touchWords) setupTouchWords();
    if (DRAFTS.todaySheet) setupSheet();
    if (DRAFTS.mapPan) setupMap();
    setupTabs();
  });
  // #endregion [S6] Start-up
})();
