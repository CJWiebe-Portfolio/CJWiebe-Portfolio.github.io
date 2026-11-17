/*
=========================================================
FILE: options.js
PROJECT: Another Tally - A zombie survival game
AUTHOR: Cygnus J. Wiebe
DATE: December 14th, 2026
COURSE: INFS 634 - McGill University
=========================================================
DESCRIPTION:
  This is the options screen JavaScript file for Another Tally.
=========================================================
*/

/* 
=============================================================== 
---------- Options Screen ----------
=============================================================== 
*/

/* Options page: fills the form from saved settings and saves every change straight away. */
(function () {
  "use strict";

  var form = document.getElementById("options-form");
  var msg = document.getElementById("saved-msg");

  function fill(s) {
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || !(el.name in s)) return;
      if (el.type === "radio") el.checked = String(s[el.name]) === el.value;
      else if (el.type === "checkbox") el.checked = Boolean(s[el.name]);
      else el.value = s[el.name];
    });
    form.elements.volume.disabled = !s.sound;
  }

  function read() {
    var s = AT.load();
    var data = new FormData(form);
    s.difficulty = data.get("difficulty");
    s.length = Number(data.get("length"));
    s.minigames = data.get("minigames");
    s.seed = String(data.get("seed") || "").trim();
    s.textSize = data.get("textSize");
    s.textSpeed = Number(form.elements.textSpeed.value);
    s.highContrast = form.elements.highContrast.checked;
    s.reduceMotion = form.elements.reduceMotion.checked;
    s.sound = form.elements.sound.checked;
    s.volume = Number(form.elements.volume.value);
    return s;
  }

  function onChange(e) {
    var s = read();
    AT.save(s);
    form.elements.volume.disabled = !s.sound;
    msg.textContent = "Saved.";
    // Let the player hear the new volume (silent if sound was just turned off).
    if (e && (e.target.name === "volume" || e.target.name === "sound")) {
      AT.playSound("click");
    }
  }

  form.addEventListener("change", onChange);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
  });

  document.getElementById("reset").addEventListener("click", function () {
    fill(AT.reset());
    msg.textContent = "Options reset to defaults.";
  });

  fill(AT.load());
})();
