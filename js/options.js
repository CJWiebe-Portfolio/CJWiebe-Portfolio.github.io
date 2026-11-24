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
  It fills the form on options.html from the saved settings and saves every
  change straight away through AT.save() in common.js, which also applies the
  display and sound settings to the page. Moving a volume slider or turning
  Sound on plays a sample so the player can hear the new level.
=========================================================
TABLE OF CONTENTS
Ctrl+F a tag such as "[S3]" to jump to that section.
Ctrl+K Ctrl+8 folds every region; Ctrl+K Ctrl+9 unfolds them.
=========================================================
[S1] Setup
[S2] Fill Form From Settings
[S3] Read Form Into Settings
[S4] Save on Change
[S5] Reset & Start-up
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

  // #region [S1] Setup
  var form = document.getElementById("options-form");
  var msg = document.getElementById("saved-msg");
  // The main volume and the sliders for each kind of sound (see SOUND_GROUPS
  // in common.js). Their names match the settings in AT.DEFAULTS.
  var VOLUMES = [
    "volume",
    "musicVolume",
    "ambienceVolume",
    "zombieVolume",
    "effectsVolume",
    "voicesVolume",
    "interfaceVolume",
  ];
  // Shows each slider's level as a percentage next to its label.
  function showLevels() {
    VOLUMES.forEach(function (k) {
      var out = form.querySelector('output[data-for="' + k + '"]');
      if (out) out.textContent = form.elements[k].value + "%";
    });
  }
  // The sliders do nothing while Sound is off.
  function lockVolumes(soundOn) {
    VOLUMES.forEach(function (k) {
      form.elements[k].disabled = !soundOn;
    });
  }
  // #endregion [S1] Setup

  // #region [S2] Fill Form From Settings
  // Puts saved settings into the form controls.
  function fill(s) {
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || !(el.name in s)) return;
      if (el.type === "radio") el.checked = String(s[el.name]) === el.value;
      else if (el.type === "checkbox") el.checked = Boolean(s[el.name]);
      else el.value = s[el.name];
    });
    lockVolumes(s.sound);
    showLevels();
  }
  // #endregion [S2] Fill Form From Settings

  // #region [S3] Read Form Into Settings
  // Reads the form back into a settings object.
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
    VOLUMES.forEach(function (k) {
      s[k] = Number(form.elements[k].value);
    });
    return s;
  }
  // #endregion [S3] Read Form Into Settings

  // #region [S4] Save on Change
  // Saves every change straight away (there is no Save button).
  function onChange(e) {
    var s = read();
    AT.save(s);
    lockVolumes(s.sound);
    msg.textContent = "Saved.";
    // Let the player hear the new level (silent if sound was just turned off).
    // The music slider needs no sample: the music is already playing.
    var name = e && e.target.name;
    if (name === "sound" || name === "volume") AT.playSound("click");
    else if (name && e.target.dataset.sample) AT.playSound(e.target.dataset.sample);
  }

  // Any change in the form saves; Enter in a field must not reload the page.
  form.addEventListener("change", onChange);
  // The percentages follow a slider while it's being dragged.
  form.addEventListener("input", showLevels);
  form.addEventListener("submit", function (e) {
    e.preventDefault();
  });
  // #endregion [S4] Save on Change

  // #region [S5] Reset & Start-up
  document.getElementById("reset").addEventListener("click", function () {
    fill(AT.reset());
    msg.textContent = "Options reset to defaults.";
  });

  fill(AT.load());
  // #endregion [S5] Reset & Start-up
})();
