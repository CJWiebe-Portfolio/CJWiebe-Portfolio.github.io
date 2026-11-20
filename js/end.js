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
It contains the logic for displaying the game results: the Final Tally and run summary.
=========================================================
TABLE OF CONTENTS
Ctrl+F a tag such as "[S3]" to jump to that section.
Ctrl+K Ctrl+8 folds every region; Ctrl+K Ctrl+9 unfolds them.
=========================================================
[S1] Load Result, Art & Sound
[S2] Title & Subtitle
[S3] Final Tally
[S3a] Ending
[S4] Stat Cards
[S5] Group List
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

  // The ending that fits this run (see Endings in js/story.js).
  var ending = AT.STORY.pickEnding(r);

  // The ending's own picture (the first one in its `art` list that exists),
  // or the plain win/lose one.
  AT.showArt(
    document.getElementById("end-art"),
    ending && ending.art,
    r.won ? "end_win" : "end_lose",
  );

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

  // #region [S3] Final Tally
  // One mark for each day survived; crooked marks are the Tally mini-games that slipped.
  // Results from before the tally existed only have a count, so fall back to that.
  var marks = r.tallies || r.daysSurvived;
  var count = typeof marks === "number" ? marks : marks.length;
  var crooked =
    typeof marks === "number"
      ? 0
      : marks.filter(function (m) {
          return m === false;
        }).length;
  document.getElementById("final-tally-marks").innerHTML = count
    ? AT.tallyMarks(marks)
    : "";
  document.getElementById("final-tally-count").textContent = count
    ? count +
      (count === 1 ? " mark" : " marks") +
      " on the wall" +
      (crooked ? " (" + crooked + " crooked)" : "") +
      "."
    : "Not a single mark on the wall.";
  document.getElementById("final-tally").hidden = false;
  // #endregion [S3] Final Tally

  // #region [S3a] Ending
  // One <p> per paragraph of the ending, typed out at the Text speed setting
  // (click to show it all). {placeholders} are filled from the run result.
  if (ending) {
    var values = {
      shelter: r.shelter,
      length: r.length,
      day: r.daysSurvived,
      daysLeft: r.length - r.daysSurvived,
      alive: r.alive,
      lost: r.lost,
    };
    var box = document.getElementById("ending-text");
    var paras = ending.paragraphs.map(function () {
      return box.appendChild(document.createElement("p"));
    });
    document.getElementById("ending-title").textContent = AT.STORY.fill(
      ending.title,
      values,
    );
    document.getElementById("ending").hidden = false;
    var skipEnding = AT.typeLines(
      paras,
      ending.paragraphs.map(function (t) {
        return AT.STORY.fill(t, values);
      }),
    );
    box.addEventListener("click", function () {
      skipEnding();
    });
  }
  // #endregion [S3a] Ending

  // #region [S4] Stat Cards
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
  // #endregion [S4] Stat Cards

  // #region [S5] Group List
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
  // #endregion [S5] Group List
})();
