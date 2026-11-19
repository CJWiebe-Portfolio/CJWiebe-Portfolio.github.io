/*
=========================================================
FILE: end.js
PROJECT: Another Tally - A zombie survival game
AUTHOR: Cygnus J. Wiebe
DATE: December 14th, 2026
COURSE: INFS 634 - McGill University
=========================================================
DESCRIPTION:
This is the end screen JavaScript file for Another Tally, a zombie survival game. 
It contains the logic for displaying the game results and run summary.
=========================================================
TABLE OF CONTENTS
Ctrl+F a tag such as "[S3]" to jump to that section.
Ctrl+K Ctrl+8 folds every region; Ctrl+K Ctrl+9 unfolds them.
=========================================================
[S1] Load Result, Art & Sound
[S2] Title & Subtitle
[S3] Stat Cards
[S4] Group List
=========================================================
*/

/* 
=============================================================== 
---------- End Screen ----------
=============================================================== 
*/

// End screen: shows the run summary that game.html handed over.
(function () {
  "use strict";

  // #region [S1] Load Result, Art & Sound
  var r = AT.handoff.peekResult();
  if (!r) return;

  var esc = AT.escapeHtml;

  document.getElementById("end-art").src =
    "assets/images/png/" + (r.won ? "end_win" : "end_lose") + ".png";

  // A rooster for making it to the last dawn; the horde if the shelter fell.
  if (r.won) AT.playSound("rooster");
  else AT.playSounds(["hordeClose", ["zombieScream", 600]]);
  var pad = function (n) {
    return String(n).padStart(2, "0");
  };
  // #endregion [S1] Load Result, Art & Sound

  // #region [S2] Title & Subtitle
  // Display the run summary on the end screen depending on whether the player won or lost.
  document.getElementById("end-title").textContent = r.won
    ? "You made it"
    : "Game over";
  document.getElementById("end-sub").textContent = r.won
    ? r.shelter + " reached the final day."
    : r.shelter +
      " fell after " +
      r.daysSurvived +
      " of " +
      r.length +
      " days.";
  // #endregion [S2] Title & Subtitle

  // #region [S3] Stat Cards
  // Provide a summary of the player's performance in the game,
  // including days survived, survivors alive, survivors lost,
  // supplies gathered, locations explored, events faced and survivors found.
  var stats = [
    ["Days survived", pad(r.daysSurvived)],
    ["Survivors alive", r.alive],
    ["Survivors lost", r.lost],
    ["Supplies gathered", pad(r.supplies)],
    ["Locations explored", r.explored + " of " + r.locations],
    ["Events faced", pad(r.events)],
    ["Survivors found", pad(r.found || 0)],
  ];

  // Display the run summary statistics and the list of survivors
  // with their fates on the end screen.
  document.getElementById("stats").innerHTML = stats
    .map(function (s) {
      return (
        '<div class="card"><p class="eyebrow">' +
        s[0] +
        '</p><p class="value">' +
        s[1] +
        "</p></div>"
      );
    })
    .join("");
  // #endregion [S3] Stat Cards

  // #region [S4] Group List
  // Display the list of survivors with their avatars and fates on the end screen.
  document.getElementById("group-list").innerHTML = r.group
    .map(function (s) {
      return (
        '<li><img class="avatar portrait" src="assets/images/png/survivor-' +
        (s.avatar || 1) +
        '.png" alt=""><strong>' +
        esc(s.name) +
        "</strong>" +
        '<span class="fate">' +
        esc(s.fate) +
        "</span></li>"
      );
    })
    .join("");
  document.getElementById("group").hidden = false;
  // #endregion [S4] Group List
})();
