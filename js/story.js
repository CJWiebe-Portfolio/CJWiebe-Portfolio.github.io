/*
=========================================================
FILE: story.js
PROJECT: Another Tally - A zombie survival game
AUTHOR: Cygnus J. Wiebe
DATE: December 14th, 2026
COURSE: INFS 634 - McGill University
=========================================================
DESCRIPTION:
Every piece of story text in Another Tally lives in this file, so the plot
can be rewritten without touching the game code.
  - game.js shows the OPENING pop-up when a run starts, and plays each
    CHECKPOINT as the morning event on its day.
  - end.js picks the ENDING that fits how the run went.

All the text below is a first draft. Rewrite it freely.

Placeholders you can use in any text (filled in by fill() at the bottom):
  {shelter}   the shelter's name
  {length}    the run length in days (15, 30 or 45)
  {day}       the current day
  {daysLeft}  days left in the run (0 on the last day)
  {alive}     survivors still alive
  {lost}      survivors lost
=========================================================
TABLE OF CONTENTS
Ctrl+F a tag such as "[S3]" to jump to that section.
Ctrl+K Ctrl+8 folds every region; Ctrl+K Ctrl+9 unfolds them.
=========================================================
[S1] Opening
[S2] Checkpoints
[S3] Endings
[S4] Helpers
=========================================================
*/

(function () {
  "use strict";

  // #region [S1] Opening
  /*
---------- Opening ----------
Shown once, in a pop-up, before day 1 starts. Each entry in `paragraphs`
is one paragraph. Leave `paragraphs` empty to skip the pop-up.
*/
  var intro = {
    kicker: "Day 01 · Before it begins",
    title: "Another Tally",
    art: "title_screen", // a picture from assets/images/png/
    paragraphs: [
      "You can’t quite recall how many days it has been since it all started. It feels like forever at this point. Days, weeks, months… it doesn’t make any difference now.",
      "As you search your memory, you recall that it started when you first noticed more and more people wearing masks as you passed them on your way to work. Back when you still had work, a job, and worries about whether the next paycheque would cover your rent that month, on top of the food you could no longer afford. News stories covered yet another strange infection that was spreading.",
      "Your family… you lost contact with them in what felt like the flick of a light switch, as suddenly all long-distance communication was gone.",
      "The whole city lost power weeks ago. Then the phones lost their connection, and the sirens stopped racing past your window. When you realized what was happening, you quickly filled everything in your house that could hold water, until it no longer came out of the pipes.",
      "At night, the screams and the sound of gunshots became familiar, until you eventually passed out from exhaustion.",
      "Now, when you look out your window, you see nothing but destruction and death. The dead still stand, shuffling through the streets and attacking anyone and anything that makes a noise.",
      "Eventually, you found some decent folks who share your understanding of what it takes to survive. Your group reached {shelter} just before dark. It will have to do.",
      "As you step inside, it doesn’t take long to realize you have walked into someone else’s camp. Everything is overturned and in a mess, but it doesn’t look like it has been raided, and the few supplies left behind are now essential to your survival.",
      "Someone has scratched tally marks into the wall, one for every day they lasted here. The marks stop at forty-one.",
      "The latest rumour spreading through your group is that the national army is sweeping the city for survivors and will reach this district in about {length} days. Someone takes out a knife and carves a fresh line beside the old ones. Day one. Another tally begins.",
    ],
    button: "Begin day 1",
  };
  // #endregion [S1] Opening

  // #region [S2] Checkpoints
  /*
---------- Checkpoints ----------
Story events that always happen on set days, as that day's morning event
(they replace the random morning event). `days` gives the day for each run
length: { 15: day, 30: day, 45: day }. Use "last" for the final day.

Checkpoints use the same fields as the events in game.js (title, art, text,
sounds, choices; see the list above EVENTS there), plus two choice fields
that only the story uses:
  flag       a word remembered for the rest of the run, e.g. "signal".
             Later checkpoints and the endings can check for it.
  needsFlag  the choice is greyed out unless that flag was set earlier.
  needsNote  what the grey line says is needed, e.g. "a working radio".
*/
  var checkpoints = [
    {
      // Act 1: a reason to hold out.
      title: "The radio wakes",
      days: { 15: 3, 30: 5, 45: 7 },
      art: "event_generic",
      text: "Static hisses from the old radio on the shelf, then a voice: 'This is Evacuation Command. A convoy will reach your district in {daysLeft} days. Survivors must signal from a rooftop on the final night. Signal, or we will not stop.' The message loops twice, then fades.",
      sounds: ["lightSwitch", ["helloWoman", 900]],
      choices: [
        {
          label: "Get the radio working properly",
          kind: "skill",
          skill: "Mechanic",
          fatigue: 15,
          flag: "radio",
          morale: 5,
          outcome:
            "Your mechanic rewired the radio. You'll hear it if the plan changes.",
          sounds: ["rustyMetal"],
        },
        {
          label: "Mark the day on the wall",
          kind: "cost",
          cost: {},
          morale: 10,
          outcome:
            "You carved a circle around the day the convoy comes. For the first time, there is something to count towards.",
          sounds: ["woodCutting"],
        },
        {
          label: "Strip it for parts",
          kind: "cost",
          cost: {},
          reward: "scrap",
          outcome:
            "You pulled the radio apart. Hope doesn't keep the walls up.",
          sounds: ["rustyMetal", ["cardboardBox", 600]],
        },
      ],
    },
    {
      // Act 2: who kept the first tally.
      title: "The last page",
      days: { 15: 7, 30: 14, 45: 20 },
      art: "event_house",
      text: "Behind a loose panel under the old tally marks, you find a rusted tin. Inside is a notebook kept by the group who lived here before you. They heard the same broadcast. The last entry reads: 'Day 41. Going to the checkpoint to meet the convoy. Leaving the keycard for whoever comes next.'",
      sounds: ["rustyHinges", ["searchBooks", 700]],
      choices: [
        {
          label: "Take the keycard",
          kind: "cost",
          cost: {},
          unlock: "military",
          outcome: "You took their keycard. It still has a little blood on it.",
          sounds: ["openJar"],
        },
        {
          label: "Read every page aloud",
          kind: "cost",
          cost: {},
          morale: 10,
          outcome:
            "You read their story together and added their names beside the tally.",
          sounds: ["turnPage"],
        },
      ],
    },
    {
      // Act 3: how will the convoy find you?
      title: "A light on the roof",
      days: { 15: 11, 30: 22, 45: 33 },
      art: "watchtower",
      text: "The convoy is {daysLeft} days out. To be seen, you'll need a signal on the roof for the final night. But anything bright enough for the convoy will be bright enough for the dead.",
      sounds: ["footsteps", ["zombieGroan", 1200]],
      choices: [
        {
          label: "Build a signal fire",
          kind: "cost",
          cost: { materials: 6 },
          flag: "signal",
          outcome:
            "You stacked a pyre on the roof, ready to light on the last night.",
          sounds: ["buildingHammering", ["woodSplitting", 700]],
        },
        {
          label: "Answer on the radio",
          kind: "cost",
          cost: {},
          needsFlag: "radio",
          needsNote: "a working radio",
          flag: "signal",
          outcome:
            "You got a reply through. Evacuation Command has your location.",
          sounds: ["lightSwitch", ["helloWoman", 700]],
        },
        {
          label: "Stay dark",
          kind: "cost",
          cost: {},
          morale: -5,
          outcome:
            "You decided not to risk a light. If the convoy comes, it will pass you by.",
          sounds: ["doorClose"],
        },
      ],
    },
    {
      // Finale: the last morning.
      title: "The last morning",
      days: { 15: "last", 30: "last", 45: "last" },
      art: "defense",
      text: "This morning the last line went on the wall: {length} of them. Tonight the convoy comes, and so does the biggest horde you've seen. Everyone knows it. Nobody says it.",
      sounds: ["zombieGroan", ["hordeClose", 1500]],
      choices: [
        {
          label: "Share a proper meal",
          kind: "cost",
          cost: { food: 2 },
          morale: 15,
          outcome: "You ate together like it was any other night.",
          sounds: ["stove", ["openJar", 800]],
        },
        {
          label: "Carve your names into the wall",
          kind: "cost",
          cost: {},
          morale: 10,
          outcome:
            "Under both tallies, everyone carved their name. Whatever happens tonight, someone will know you were here.",
          sounds: ["woodCutting"],
        },
      ],
    },
  ];
  // #endregion [S2] Checkpoints

  // #region [S3] Endings
  /*
---------- Endings ----------
Checked from top to bottom when a run ends; the first one whose `when`
returns true is shown on the end screen. Keep the last one as a catch-all.

`when` gets the run result `r`:
  r.won          true if anyone made it to the end
  r.daysSurvived days survived
  r.length       run length
  r.alive        survivors alive at the end
  r.lost         survivors lost
  r.flags        flags set by checkpoint choices, e.g. r.flags.signal
*/
  var endings = [
    {
      title: "The tally stops",
      art: "end_lose",
      when: function (r) {
        return !r.won && r.daysSurvived < r.length / 2;
      },
      paragraphs: [
        "The marks on the wall of {shelter} stop at {day}.",
        "One day, another group will find the shelter and count your marks the way you counted the ones before. Maybe they'll last longer.",
      ],
    },
    {
      title: "So close",
      art: "end_lose",
      when: function (r) {
        return !r.won;
      },
      paragraphs: [
        "The convoy was due on day {length}. You made it to day {day}.",
        "When it finally rolls through the district, nobody is on the roof of {shelter}. The tally on the wall stops a few lines short.",
      ],
    },
    {
      title: "The last mark",
      art: "end_win",
      when: function (r) {
        return r.won && r.alive === 1;
      },
      paragraphs: [
        "You carve the last line alone.",
        "Everyone else is a name on the wall now, under the tally. Whatever comes for {shelter} next, someone has to remember them, so you stay a while longer and keep counting.",
      ],
    },
    {
      title: "The last broadcast",
      art: "end_win",
      when: function (r) {
        return r.won && r.flags.signal;
      },
      paragraphs: [
        "On the final night the signal burns on the roof of {shelter}. Just before dawn, headlights cut through the dark, and the convoy stops.",
        "{alive} survivors climb aboard. Behind you, the tally on the wall stays at {length}. Someone else can finish counting.",
      ],
    },
    {
      title: "Full count",
      art: "end_win",
      when: function (r) {
        return r.won && r.lost === 0;
      },
      paragraphs: [
        "The convoy's lights pass in the distance and don't stop. Nobody signalled.",
        "But everyone who walked into {shelter} on day one is still here. In the morning, someone carves a new first line. Another tally begins.",
      ],
    },
    {
      title: "Another tally",
      art: "end_win",
      when: function () {
        return true;
      },
      paragraphs: [
        "The convoy's lights pass in the distance and don't stop.",
        "{alive} of you are left. Under the tally, the wall holds the names of everyone you lost. In the morning, someone takes out the knife and starts counting again.",
      ],
    },
  ];
  // #endregion [S3] Endings

  // #region [S4] Helpers
  /*
---------- Helpers ----------
Used by game.js and end.js. Nothing to edit here for the story itself.
*/
  // The day a checkpoint happens on in a run of this length.
  // "last" is the final day; lengths not in `days` fall back to the same
  // share of the run as the 30-day value.
  function checkpointDay(cp, length) {
    var d = cp.days[length];
    if (d === undefined) d = Math.round((cp.days[30] / 30) * length);
    return d === "last" ? length : d;
  }

  // The checkpoint for this day of the run, or null. Checkpoints are
  // morning events, so game.js treats them the same way.
  function checkpointFor(day, length) {
    for (var i = 0; i < checkpoints.length; i++) {
      if (checkpointDay(checkpoints[i], length) === day) {
        return Object.assign(
          { time: "morning", checkpoint: true },
          checkpoints[i],
        );
      }
    }
    return null;
  }

  // The first ending whose `when` fits the result.
  function pickEnding(r) {
    var run = Object.assign({ flags: {} }, r);
    for (var i = 0; i < endings.length; i++) {
      if (endings[i].when(run)) return endings[i];
    }
    return null;
  }

  // Swaps {placeholders} in text for values, e.g. fill("Day {day}", { day: 3 }).
  // Unknown placeholders are left as they are so typos are easy to spot.
  function fill(text, values) {
    return String(text).replace(/\{(\w+)\}/g, function (match, key) {
      return values && values[key] !== undefined ? values[key] : match;
    });
  }

  window.AT.STORY = {
    intro: intro,
    checkpoints: checkpoints,
    endings: endings,
    checkpointDay: checkpointDay,
    checkpointFor: checkpointFor,
    pickEnding: pickEnding,
    fill: fill,
  };
  // #endregion [S4] Helpers
})();
