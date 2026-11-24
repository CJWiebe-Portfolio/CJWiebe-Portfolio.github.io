/*
=========================================================
FILE: common.js
PROJECT: Another Tally - A zombie survival game
AUTHOR: Cygnus J. Wiebe
DATE: December 14th, 2026
COURSE: INFS 634 - McGill University
=========================================================
DESCRIPTION:
This is the common JavaScript file for Another Tally, a zombie survival game. 
It contains shared code that is loaded in the <head> of every page. 
The settings (options page) are stored in localStorage, 
while the run is handed between pages through sessionStorage. 
The code includes functions for loading, saving, and resetting settings, 
as well as applying display settings to the HTML document. 
It also includes a seeded random number generator and utility functions 
for escaping HTML and managing survivor skills and traits.

What's in here, in order:
  Game settings ........ load, save and reset the Options (localStorage)
  Display settings ..... text size, contrast and motion as data-attributes on <html>
  Page hand-off ........ the run setup and result passed between pages (sessionStorage)
  Seed generator ....... repeatable random numbers when a seed is set
  Game attributes ...... skills, traits, survivor names and portraits
  Background music ..... one looping track that carries on from page to page
  Ambience ............. the looping sound for each phase, with occasional extras
  Text speed ........... types story text out one letter at a time
  Game logistics ....... the AT object every other script uses
  Sound effects ........ every sound by name, stacking, channels and button sounds
=========================================================
TABLE OF CONTENTS
Ctrl+F a tag such as "[S3]" to jump to that section.
Ctrl+K Ctrl+8 folds every region; Ctrl+K Ctrl+9 unfolds them.
=========================================================
[S1] Game Settings
[S2] Display Settings
[S3] Game Seed Generator
[S4] Game Attributes
[S4b] Volume Groups
[S5] Background Music
[S6] Ambience
[S7] Text Speed
[S8] Game Logistics
[S9] Sound Effects
  [S10] Sound List
    [S11] Menus and buttons
    [S12] Weapons
    [S13] Zombies
    [S14] Doors
    [S15] Searching
    [S16] Building and materials
    [S17] Around the shelter
    [S18] Footsteps
    [S19] Traders
    [S20] Ambience sounds
    [S20a] Sounds still to add
  [S21] Volume Mix & Loading
  [S22] Channels
  [S23] Play & Stop Sounds
  [S24] Preload & Button Sounds
[S25] Tally Marks
=========================================================
*/

// #region [S1] Game Settings
/* 
=============================================================== 
---------- Game Settings ----------
=============================================================== 
*/

(function () {
  "use strict";

  //Creates the variables for the localStorage and sessionStorage
  var SETTINGS_KEY = "anotherTally.settings";
  var SETUP_KEY = "anotherTally.setup";
  var RESULT_KEY = "anotherTally.result";

  //This is the default (settings) variable of the game, also used for resetting
  var DEFAULTS = {
    difficulty: "normal", // easy | normal | hard
    length: 30, // 15 | 30 | 45 days
    minigames: "play", // play | auto
    seed: "",
    textSize: "medium", // small | medium | large
    textSpeed: 50, // 0–100
    highContrast: false,
    reduceMotion: false,
    sound: true,
    volume: 70, // 0–100, the main volume
    // Each kind of sound has its own level on top of the main volume (0–100).
    // SOUND_GROUPS (in the Volume Mix section) says which sounds are which.
    musicVolume: 100,
    ambienceVolume: 100,
    zombieVolume: 100,
    effectsVolume: 100,
    voicesVolume: 100,
    interfaceVolume: 100,
  };

  // This function loads the game settings from localStorage or returns the default settings
  function load() {
    var saved = {};
    try {
      saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    } catch (e) {
      // storage blocked
    }
    return Object.assign({}, DEFAULTS, saved);
  }

  // This function saves the game settings to localStorage and applies them
  function save(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      // storage blocked
    }
    apply(settings);
  }

  // This function resets the game settings to their defaults
  function reset() {
    try {
      localStorage.removeItem(SETTINGS_KEY);
    } catch (e) {
      // storage blocked
    }
    apply(DEFAULTS);
    return Object.assign({}, DEFAULTS);
  }
  // #endregion [S1] Game Settings

  // #region [S2] Display Settings
  /* 
=============================================================== 
---------- Display Settings for Adaptive Features ----------
=============================================================== 
*/

  // The display settings become data-attributes on when they are on html
  // and then the style.css can react to them.
  function apply(s) {
    var root = document.documentElement;
    root.dataset.textSize = s.textSize;
    root.dataset.contrast = s.highContrast ? "high" : "normal";
    root.dataset.motion = s.reduceMotion ? "reduce" : "full";
    syncMusic(s);
    syncAmbience(s);
    syncLoops(s);
  }

  // These functions manage sessionStorage for handing off the game setup
  // and result between pages.
  function put(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      // storage blocked
    }
  }
  // Reads a value from sessionStorage. With remove = true it is deleted after
  // reading, so the hand-off only works once (a refresh can't reuse it).
  function read(key, remove) {
    try {
      var raw = sessionStorage.getItem(key);
      if (remove) sessionStorage.removeItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  // #endregion [S2] Display Settings

  // #region [S3] Game Seed Generator
  /* 
=============================================================== 
---------- Game Seed Generator ----------
=============================================================== 
*/

  // This implements the seeded random number generator (Options > Seed).
  // When a seed is provided, it generates a reproducible sequence of random numbers.
  // When no seed is provided, it uses the default Math.random function.
  function makeRng(seed) {
    if (!seed) return Math.random;
    var a = 0;
    String(seed)
      .split("")
      .forEach(function (c) {
        a = (Math.imul(a, 31) + c.charCodeAt(0)) | 0;
      });
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // This function escapes HTML special characters to prevent XSS attacks
  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  // Shows a picture from assets/images/png/ in an <img>. `names` is one picture
  // name or a list of them (see `art` in js/story.js): the first one that
  // exists is shown, then `fallback` if none of them do. This lets the story
  // name pictures before they've been drawn.
  function showArt(img, names, fallback) {
    var list = [].concat(names || [], fallback || []);
    if (!img || !list.length) return;
    var i = 0;
    img.onerror = function () {
      i += 1;
      if (i < list.length) img.src = "assets/images/png/" + list[i] + ".png";
      else img.onerror = null;
    };
    img.src = "assets/images/png/" + list[0] + ".png";
  }
  // #endregion [S3] Game Seed Generator

  // #region [S4] Game Attributes
  /* 
=============================================================== 
---------- Game Attributes ----------
=============================================================== 
*/

  // Survivor skills and traits in a dictionary where names are attached to their effects
  // in the game. The new-game.js will randomly pick from these,
  // game.js applies them, and how-to-play.html also lists them.
  var SKILLS = {
    // Special
    // 10 - Positive Skills, these will have a positive effect on gameplay.
    Scavenger:
      "Can find useful supplies in places most people wouldn't dare look. Apparently, one person's garbage is another person's survival.", //Brings back 2 extra supplies when scavenging.
    Builder:
      "Can stretch a handful of materials into a surprisingly sturdy structure. Apparently, watching DIY videos finally paid off.", //Upgrades cost 2 fewer materials while they are on Build.
    Medic:
      "Knows their way around a first-aid kit. Somehow more qualified than Googling your symptoms.", //On Heal, restores 30 health instead of 10.
    Fighter:
      "Has a knack for keeping the undead at bay. Violence really is the answer sometimes.", //Adds 10 night defense on Guard instead of 5.
    Cook: "Can make a little food go a long way. Has mastered the ancient art of convincing people they're full.", //On Cook, the group eats 1 less food at dusk.
    Hunter:
      "Can track and catch food in the wild. Finally, someone who knows animals aren't just things you pet.", //Also brings back 2 food when scavenging.
    Mechanic:
      "Can take apart just about anything and somehow put it back together. Usually with fewer leftover screws.", //On Build, salvages 2 materials each day.
    Negotiator:
      "Has a silver tongue and a talent for getting deals. Even the apocalypse has room for a little haggling.", //The trader accepts offers worth 25% less.
    Sharpshooter:
      "Rarely misses a shot. Has excellent aim and a concerning amount of confidence with firearms.", //On Guard, ammo counts double toward night defense.
    Survivalist:
      "Knows how to make a little water last. Has apparently mastered the art of being slightly less thirsty.", //Only 1 drinks water every other day.
    // 10 - Filler Skills, these will not have an effect on gameplay.
    Entertainer:
      "Can sing, dance, and tell jokes. Unfortunately, none of these things stop zombies.", // Doesn't bring any skills relevant to the zombie apocalypse
    "Professional Wine Taster":
      "Can identify 200 different wine varieties. Unfortunately, all the good vintages are probably infected.", // Doesn't bring any skills relevant to the zombie apocalypse
    "Ice sculptor":
      "Can turn a block of ice into a beautiful swan. Shame it melts faster than your survival chances.", // Doesn't bring any skills relevant to the zombie apocalypse
    "Competitive chess":
      "Can think 15 moves ahead, but somehow didn't think to bring a weapon.", // Doesn't bring any skills relevant to the zombie apocalypse
    "Interior decorating":
      "Can make any abandoned building feel like home. Even if home is currently surrounded by zombies.", // Doesn't bring any skills relevant to the zombie apocalypse
    Tiktoker:
      "Had 2 million followers and knows every viral dance. Unfortunately, the Wi-Fi is down.", // Doesn't bring any skills relevant to the zombie apocalypse
    "Piano tuning":
      "Can tune a grand piano to perfection. Unfortunately, the only thing playing now is the sound of approaching zombies.", // Doesn't bring any skills relevant to the zombie apocalypse
    Calligraphy:
      "Can write beautifully crafted letters by hand. Perfect for leaving an elegant goodbye note.", // Doesn't bring any skills relevant to the zombie apocalypse
    "Video game streaming":
      "Has spent thousands of hours surviving virtual apocalypses. Unfortunately, this one doesn't have a respawn button.", // Doesn't bring any skills relevant to the zombie apocalypse
    "Puzzle solver":
      "Can solve a Rubik's Cube in under 10 seconds. Still can't figure out why everyone keeps eating each other.", // Doesn't bring any skills relevant to the zombie apocalypse
  };
  var TRAITS = {
    // Special; these have abilities within the game.
    // 10 - Positive Traits, these will have a positive effect on gameplay.
    "Night owl":
      "Is surprisingly energetic at night. While everyone else is sleeping, they're busy making sure nothing eats the group.", //Adds 5 extra night defense on Guard.
    Optimist:
      "Always looks on the bright side. Even when surrounded by zombies, they insist things could be worse.", //Recovers 5 health every morning.
    Tough:
      "Has an unusually high pain tolerance. Probably the type to walk off a broken leg and complain about the weather.", //Takes half damage when injured.
    Lucky:
      "Seems to have luck on their side. Somehow manages to find the good stuff while everyone else finds garbage.", //Rolls twice when scavenging and keeps the better haul.
    Loner:
      "Prefers working alone and actively avoids company. At least they're more productive without people around.", //Brings back 1 extra supply when scavenging alone.
    Extrovert:
      "Thrives in the company of others. Apparently, even scavenging is more fun with a friend.", //Brings back 1 extra supply when scavenging with another survivor.
    "Quick healer":
      "Has an impressive ability to bounce back from injuries. Must have really good genetics.", //Recovers 10 health when resting.
    Hoarder:
      "Can't resist collecting useful materials. Their pockets are full, their backpack is overflowing, and they're still not satisfied.", //Also brings back 1 material when scavenging.
    Motivational:
      "Always knows what to say to lift someone's spirits. Basically, the group's unpaid motivational speaker.", //Slightly brings up the moral of the survivors with the current least moral
    Athletic:
      "Is in excellent physical condition. All those years of running finally have a practical application.", //All tasks take slightly less fatigue to preform.
    // 10 - Negative Traits, these will have a negative effect on gameplay.
    Coward:
      "Has perfected the art of being somewhere else when trouble starts. Unfortunately, standing guard isn't their strong suit.", //Never the one injured, but adds no defense on Guard.
    "Big eater":
      "Has an enormous appetite and absolutely no concept of rationing. The group's food supply is getting nervous.", //Eats 2 food at dusk instead of 1.
    Forgetful:
      "Frequently misplaces things. Nobody knows where the supplies went, including them.", //Each day they complete a roll that is 1/6 odds, if successful they will misplace and lose some random 2 supplies.
    Clumsy:
      "Has two left feet and somehow manages to trip over absolutely nothing. Scavenging with them is a liability.", //Brings back 1 less supply when scavenging.
    Smoker:
      "Has a persistent cough that could wake the dead. Unfortunately, that's exactly what you're trying to avoid.", //Their excessive coughing, they have a 1/6 chance to slightly increases the nightly horde strength.
    Alcoholic:
      "Can't resist a drink, even during the apocalypse. Sometimes disappears on a scavenging trip for reasons nobody wants to ask about.", //When scavenging, they have a 1/6 change to (find a bottle) and spend a extra day before returning to camp.
    "Drug addict":
      "Struggles with their personal demons. The apocalypse has certainly not made things easier.", //With them having to forcefully break free of their addition, every night they have a chance to take some damage.
    Argumentative:
      "Has an opinion about absolutely everything and isn't afraid to share it. The zombies aren't the only thing threatening the group's survival.", //Gets in fights with other survivors, lowering the moral of one other survivor by 10
    Lazy: "Has mastered the art of doing absolutely nothing. Somehow manages to get exhausted just thinking about work.", //All tasks take more fatigue to complete
    Splurger:
      "Has absolutely no self-control when it comes to spending. Apparently, the apocalypse is no excuse to stop shopping.", //They will slightly make all trades a worse deal for the all survivors.
    // 10 - Filler Traits, these will not have an effect on gameplay.
    Kind: "Has a heart of gold. Unfortunately, zombies don't accept kindness as payment.", // Doesn't bring any traits relevant to the zombie apocalypse
    Brave:
      "Is always first to volunteer for a task. Usually before finding out what the task is.", // Doesn't bring any traits relevant to the zombie apocalypse
    Fearless:
      "Does not fear death. This is either incredibly admirable or deeply concerning.", // Doesn't bring any traits relevant to the zombie apocalypse
    Peaceful:
      "Avoids arguments at all costs. Would rather negotiate with a zombie than raise their voice.", // Doesn't bring any traits relevant to the zombie apocalypse
    "Open Minded":
      "Is open to new ideas and perspectives. Even the occasional suggestion to befriend the zombies.", // Doesn't bring any traits relevant to the zombie apocalypse
    Religious:
      "Spends time each day in prayer. Has been negotiating with the Almighty for better survival odds.", // Doesn't bring any traits relevant to the zombie apocalypse
    Selfish:
      "Always puts themselves first. At least someone is looking out for them.", // Doesn't bring any traits relevant to the zombie apocalypse
    Resilient:
      "Never gives up, even when everyone else has accepted that things are hopeless.", // Doesn't bring any traits relevant to the zombie apocalypse
    Logical:
      "Always likes to have a plan. Unfortunately, the zombies haven't agreed to follow it.", // Doesn't bring any traits relevant to the zombie apocalypse
    Sympathetic:
      "Feels deeply for those who are suffering. Which is unfortunate, considering the current population.", // Doesn't bring any traits relevant to the zombie apocalypse
  };

  // Names for survivors. new-game.js picks the starting group from this list,
  // and game.js picks from it again for anyone recruited during a run.
  var NAMES = [
    // Male
    // Female
    "Liam",
    "Olivia",
    "Noah",
    "Emma",
    "Oliver",
    "Amelia",
    "Theodore",
    "Charlotte",
    "James",
    "Mia",
    "Henry",
    "Sophia",
    "Mateo",
    "Isabella",
    "Elijah",
    "Evelyn",
    "Lucas",
    "Ava",
    "William",
    "Sofia",
    "Benjamin",
    "Camila",
    "Levi",
    "Harper",
    "Ezra",
    "Luna",
    "Sebastian",
    "Eleanor",
    "Jack",
    "Violet",
    "Daniel",
    "Aurora",
    "Samuel",
    "Elizabeth",
    "Michael",
    "Eliana",
    "Grayson",
    "Hazel",
    "Ethan",
    "Chloe",
    "Asher",
    "Ellie",
    "John",
    "Nora",
    "Hudson",
    "Gianna",
    "Luca",
    "Lily",
    "Leo",
    "Emily",
    "Elias",
    "Aria",
    "Kai",
    "Scarlett",
    "Theo",
    "Willow",
    "Owen",
    "Penelope",
    "Alexander",
    "Zoe",
    "Dylan",
    "Ella",
    "Gabriel",
    "Avery",
    "Santiago",
    "Elena",
    "Mason",
    "Abigail",
    "Julian",
    "Mila",
    "David",
    "Lucy",
    "Joseph",
    "Isla",
    "Carter",
    "Ivy",
    "Matthew",
    "Layla",
    "Luke",
    "Delilah",
    "Aiden",
    "Riley",
    "Jackson",
    "Lainey",
    "Maverick",
    "Nova",
    "Miles",
    "Grace",
    "Wyatt",
    "Goldie",
    "Thomas",
    "Winter",
    "Isaac",
    "Arabella",
    "Josiah",
    "Anastasia",
    "Hugo",
    "Myla",
    "Arthur",
    "Leah",
  ];

  // Portrait numbers: assets/images/png/survivor-1.png to survivor-17.png.
  var AVATARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
  // #endregion [S4] Game Attributes

  // #region [S4b] Volume Groups
  /*
===============================================================
---------- Volume Groups ----------
===============================================================
*/
  // These come before the music and ambience because apply() uses them as
  // soon as the page loads.
  // Which slider on the Options page controls each sound. Anything not listed
  // is a sound effect ("effects"). The music has its own slider too, and the
  // occasional sounds layered over the ambience (a far-off groan) count as
  // ambience whatever they are.
  var SOUND_GROUPS = {
    ambience: [
      "ambMorning",
      "rooster",
      "ambDay",
      "ambDayExtra",
      "ambEvening",
      "ambNight",
      "wind",
      "rain",
      "birds",
    ],
    zombie: [
      "zombie",
      "horde",
      "hordeClose",
      "zombieGroan",
      "zombieShout",
      "zombieScream",
      "zombieAttack",
      "zombieDying",
      "zombieSpotted",
    ],
    voices: [
      "helloWoman",
      "arguing",
      "cough",
      "hurtMale",
      "hurtFemale",
      "dyingMale",
      "dyingFemale",
    ],
    interface: ["click", "menu", "turnPage", "typewriter"],
  };
  // The setting (in DEFAULTS) that holds each group's level.
  var GROUP_SETTING = {
    music: "musicVolume",
    ambience: "ambienceVolume",
    zombie: "zombieVolume",
    effects: "effectsVolume",
    voices: "voicesVolume",
    interface: "interfaceVolume",
  };
  // The group a sound name belongs to.
  function groupOf(name) {
    var found = "effects";
    Object.keys(SOUND_GROUPS).forEach(function (g) {
      if (SOUND_GROUPS[g].indexOf(name) !== -1) found = g;
    });
    return found;
  }
  // A group's level from the settings, 0 to 1 (full if it's never been set).
  function groupLevel(group, s) {
    var v = s[GROUP_SETTING[group]];
    return v == null || v === "" || isNaN(v) ? 1 : clamp(Number(v) / 100);
  }

  // Looping sounds still playing (the typewriter, rain in an event...), so a
  // volume change on the Options page reaches them straight away.
  var loops = [];
  // #endregion [S4b] Volume Groups

  // #region [S5] Background Music
  /*
===============================================================
---------- Background Music ----------
===============================================================
*/

  // One looping track that carries across every page. Each page is a new
  // document, so the current position is saved in sessionStorage when the
  // page is left and picked up again on the next page.
  var MUSIC_SRC = "assets/audio/another_tally_background_music.mp3";
  var MUSIC_TIME_KEY = "anotherTally.musicTime";
  // Pages opened from the pause menu (new tab) stay silent so the music doesn't double up.
  var musicAllowed =
    new URLSearchParams(location.search).get("from") !== "game";
  var music = null;

  if (musicAllowed) {
    music = new Audio(MUSIC_SRC);
    music.loop = true;
    music.preload = "auto";

    // Resume from where the last page left off.
    music.addEventListener(
      "loadedmetadata",
      function () {
        try {
          var t = Number(sessionStorage.getItem(MUSIC_TIME_KEY));
          if (t > 0 && t < music.duration) music.currentTime = t;
        } catch (e) {
          // storage blocked
        }
      },
      { once: true },
    );

    // Save the position when leaving the page.
    window.addEventListener("pagehide", function () {
      try {
        sessionStorage.setItem(MUSIC_TIME_KEY, String(music.currentTime));
      } catch (e) {
        // storage blocked
      }
    });
  }

  // Applies the Sound and Volume settings, and starts the music if it's allowed.
  function syncMusic(s) {
    if (!music) return;
    music.volume = clamp((Number(s.volume) / 100) * groupLevel("music", s));
    if (!s.sound) {
      music.pause();
      return;
    }
    if (music.paused) music.play().catch(waitForInteraction);
  }

  // Browsers block sound until the player clicks or presses a key on the page.
  function waitForInteraction() {
    // Try again on the first click or key press (each listener runs once).
    document.addEventListener("pointerdown", resumeAudio, { once: true });
    document.addEventListener("keydown", resumeAudio, { once: true });
  }
  // Restarts the music and ambience once the browser allows sound.
  function resumeAudio() {
    var s = load();
    syncMusic(s);
    syncAmbience(s);
  }
  // #endregion [S5] Background Music

  // #region [S6] Ambience
  /*
===============================================================
---------- Ambience ----------
===============================================================
*/

  // One looping background track at a time (morning, day, evening, night),
  // layered on top of the music. Changing it fades the old track out quickly and
  // the new one in. game.js picks the track with AT.setAmbience("ambDay").
  // extras (optional) = { sounds: [names], every: [min, max] seconds }: one-off
  // sounds layered over the loop at random moments, like a distant groan.
  var AMBIENCE_FADE_IN_MS = 1000;
  var AMBIENCE_FADE_OUT_MS = 500; // short, so clicking through phases keeps up
  var amb = { name: null, el: null, extrasTimer: null };
  // Each track is loaded once and kept, so coming back to a phase (dusk, night,
  // dawn, day) starts straight away instead of loading the file again.
  var ambTracks = {};

  // Returns the looping Audio element for a file, creating it the first time.
  function ambTrack(src) {
    if (!ambTracks[src]) {
      ambTracks[src] = new Audio(src);
      ambTracks[src].loop = true;
      ambTracks[src].preload = "auto";
      ambTracks[src].volume = 0;
    }
    return ambTracks[src];
  }

  // Starts loading ambience tracks before they are needed (game.js calls this at the start of a run).
  function preloadAmbience(names) {
    names.forEach(function (name) {
      [].concat(SOUNDS[name] || []).forEach(ambTrack);
    });
  }

  // Switches the looping ambience to a sound name from SOUNDS (null for silence).
  // Does nothing if that track is already playing.
  function setAmbience(name, extras) {
    if (amb.name === (name || null)) return;
    // The old phase's extras (a groan, a far-off sound) stop with it.
    clearTimeout(amb.extrasTimer);
    stopChannel("ambienceExtras", AMBIENCE_FADE_OUT_MS);
    var old = amb.el;
    amb.name = name || null;
    amb.el = name ? ambTrack(pickSrc(name)) : null;
    if (old && old !== amb.el) {
      fadeTo(old, 0, AMBIENCE_FADE_OUT_MS, function () {
        old.pause();
      });
    }
    if (!name) return;
    syncAmbience(load());
    if (extras) scheduleExtra(extras);
  }

  // Applies the Sound and Volume settings to the ambience track.
  function syncAmbience(s) {
    if (!amb.el) return;
    if (!s.sound) {
      amb.el.pause();
      return;
    }
    fadeTo(amb.el, volumeFor(amb.name, s), AMBIENCE_FADE_IN_MS);
    if (amb.el.paused) amb.el.play().catch(waitForInteraction);
  }

  // Plays one of the extras after a random wait, then queues the next one.
  function scheduleExtra(extras) {
    var min = extras.every[0],
      max = extras.every[1];
    amb.extrasTimer = setTimeout(
      function () {
        var list = extras.sounds;
        playSound(list[Math.floor(Math.random() * list.length)], {
          channel: "ambienceExtras",
        });
        scheduleExtra(extras);
      },
      (min + Math.random() * (max - min)) * 1000,
    );
  }

  // Slides a sound's volume to target over ms milliseconds, then calls done.
  function fadeTo(a, target, ms, done) {
    clearInterval(a.fadeTimer);
    var start = a.volume,
      t0 = Date.now();
    a.fadeTimer = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / ms);
      a.volume = clamp(start + (target - start) * k);
      if (k === 1) {
        clearInterval(a.fadeTimer);
        if (done) done();
      }
    }, 50);
  }

  // Keeps a volume between 0 and 1.
  function clamp(v) {
    return Math.min(1, Math.max(0, v));
  }
  // #endregion [S6] Ambience

  // #region [S7] Text Speed
  /*
===============================================================
---------- Text Speed ----------
===============================================================
The Text speed option (0 to 100) types story text out one letter at a time.
100 shows it at once, and so does Reduce motion. Screen readers always get the
whole text straight away from a hidden copy, so nobody has to wait for it.
*/

  // Milliseconds between letters: 0 at speed 100, 30 at speed 0 (15 at the default 50).
  function charDelay(s) {
    s = s || load();
    if (s.reduceMotion) return 0;
    return Math.round((100 - Number(s.textSpeed)) * 0.3);
  }

  // Sets an element up to be typed: a hidden full copy for screen readers,
  // then the visible part, split into the letters typed so far and the rest.
  // The rest is invisible but still takes up room (see .untyped in style.css),
  // so the dialog doesn't grow and push the buttons around while text types.
  function prepareTyping(el, text) {
    el.innerHTML =
      '<span class="visually-hidden"></span>' +
      '<span aria-hidden="true"><span></span><span class="untyped"></span></span>';
    el.firstChild.textContent = text;
    var shown = el.lastChild;
    shown.lastChild.textContent = text;
    return shown;
  }

  // Shows the first `count` letters of text in a prepared element.
  function showLetters(shown, text, count) {
    shown.firstChild.textContent = text.slice(0, count);
    shown.lastChild.textContent = text.slice(count);
  }

  // Types text into el, then calls done. Returns a function that skips
  // straight to the end (call it when the player clicks the text).
  function typeText(el, text, done) {
    return typeLines([el], [text], done);
  }

  // Types several elements one after another (e.g. the lines of a report).
  // texts[i] goes into els[i]. Returns a skip function like typeText().
  function typeLines(els, texts, done) {
    var ms = charDelay();
    var finished = false;
    // Shows all the text at once and stops typing (runs only once).
    function finish() {
      if (finished) return;
      finished = true;
      clearInterval(timer);
      stopChannel("typing", 150);
      els.forEach(function (el, i) {
        el.textContent = texts[i];
      });
      if (done) done();
    }
    if (!ms || !els.length) {
      finish();
      return finish;
    }
    var shown = els.map(function (el, i) {
      return prepareTyping(el, texts[i]);
    });
    // The typewriter clacks along until the text is done (or skipped).
    playSound("typewriter", { loop: true, channel: "typing", replace: true });
    var line = 0,
      letter = 0;
    var timer = setInterval(function () {
      letter += 1;
      showLetters(shown[line], texts[line], letter);
      if (letter >= texts[line].length) {
        line += 1;
        letter = 0;
        if (line >= els.length) finish();
      }
    }, ms);
    return finish;
  }
  // #endregion [S7] Text Speed

  // #region [S8] Game Logistics
  /*
===============================================================
---------- Game Logistics ----------
=============================================================== 
*/

  // Expose the public API for the game settings and attributes
  window.AT = {
    DEFAULTS: DEFAULTS,
    SKILLS: SKILLS,
    TRAITS: TRAITS,
    NAMES: NAMES,
    AVATARS: AVATARS,
    typeText: typeText,
    typeLines: typeLines,
    load: load,
    save: save,
    reset: reset,
    apply: apply,
    makeRng: makeRng,
    escapeHtml: escapeHtml,
    showArt: showArt,
    handoff: {
      setSetup: function (v) {
        put(SETUP_KEY, v);
      },
      takeSetup: function () {
        return read(SETUP_KEY, true);
      },
      setResult: function (v) {
        put(RESULT_KEY, v);
      },
      peekResult: function () {
        return read(RESULT_KEY, false);
      },
    },
  };

  apply(load());

  // Options changed in another tab (e.g. opened from the pause menu): apply here too.
  window.addEventListener("storage", function (e) {
    if (e.key === SETTINGS_KEY) apply(load());
  });

  // Pages opened from the pause menu run in a new tab: say so, so the player returns to the run.
  document.addEventListener("DOMContentLoaded", function () {
    if (new URLSearchParams(location.search).get("from") !== "game") return;
    var main = document.querySelector("main");
    if (!main) return;
    var note = document.createElement("p");
    note.className = "notice";
    note.textContent =
      "Opened from your paused game. Your run is still in the other tab; close this tab to return to it.";
    main.prepend(note);
  });

  // The Back and Done buttons will close the tab if it was opened from the game,
  // otherwise go back in history, otherwise follow the link (to the title screen).
  document.addEventListener("click", function (e) {
    var link = e.target.closest("[data-back]");
    if (!link) return;
    if (new URLSearchParams(location.search).get("from") === "game") {
      e.preventDefault();
      window.close();
      return;
    }
    var sameSite =
      document.referrer &&
      new URL(document.referrer).origin === location.origin;
    if (sameSite && history.length > 1) {
      e.preventDefault();
      history.back();
    }
  });
  // #endregion [S8] Game Logistics

  // #region [S9] Sound Effects
  /*
  ===============================================================
  ---------- Sound Effects ----------
  ===============================================================
  Every button plays the click. A button can play a different sound by
  naming it in a data-sound attribute, e.g. <button data-sound="gunshot">,
  and data-sound="none" makes it silent. Code can also play a sound with
  AT.playSound("horde"), or stack several at once with AT.playSounds().

  A name can list more than one file. One is picked at random each time,
  so sounds that repeat (gunshots, groans, footsteps) don't all sound the same.
  */

  var A = "assets/audio/";

  // #region [S10] Sound List
  // Sound name → file, or a list of files to pick from. Add a line here for each new sound.
  var SOUNDS = {
    // #region [S11] Menus and buttons
    // ---- Menus and buttons ----
    click: A + "click.mp3",
    menu: A + "menu_select.mp3",
    turnPage: A + "paper(next-page).mp3",
    // #endregion [S11] Menus and buttons

    // #region [S12] Weapons
    // ---- Weapons ----
    gunshot: A + "pistol_shot.mp3",
    cock: A + "gun_cocking.mp3",
    guardReady: [
      A + "gun_cocking.mp3",
      A + "weapon_cocking.mp3",
      A + "weapon_cocking2.mp3",
      A + "weapon_adjustment.mp3",
    ],
    gunJam: A + "weapon_bolt.mp3",
    reload: A + "weapon_reloading.mp3",
    swing: [
      A + "wooshing_weapon.mp3",
      A + "wooshing_weapon2.mp3",
      A + "wooshing_weapon3.mp3",
    ],
    // #endregion [S12] Weapons

    // #region [S13] Zombies
    // ---- Zombies ----
    zombie: A + "zombie_individual.mp3",
    horde: A + "zombie_horde.mp3",
    hordeClose: A + "zombie_horde(closeup).mp3",
    zombieGroan: [A + "zombie_male(call).mp3", A + "zombie_individual.mp3"],
    zombieShout: [
      A + "zombie_male(shout).mp3",
      A + "zombie_male(call).mp3",
      A + "zombie_male(screams).mp3",
      A + "zombie_female(screams).mp3",
      A + "zombie_individual.mp3",
    ],
    zombieScream: [
      A + "zombie_male(screams).mp3",
      A + "zombie_female(screams).mp3",
      A + "zombie_male_scream_1.mp3",
      A + "zombie_male_scream_2.mp3",
      A + "zombie_male_scream_3.mp3",
      A + "zombie_male_scream_4.mp3",
    ],
    zombieAttack: A + "zombie_individual.mp3",
    zombieDying: A + "zombie_dying.mp3",
    zombieSpotted: A + "zombie_male_spotting_enemy.mp3", // a failed mini-game gets you seen
    // #endregion [S13] Zombies

    // #region [S14] Doors
    // ---- Doors ----
    doorOpen: A + "door_opening.mp3",
    doorClose: A + "door_closing.mp3",
    knock: A + "door_knock.mp3",
    knockSoft: A + "door_knocking(soft).mp3",
    knockHard: A + "door_knocking(intense).mp3",
    rustyDoor: A + "rusty_door.mp3",
    rustyHinges: A + "rusty_hindges.mp3",
    lockClick: A + "lock-click.mp3", // a lock pin setting
    // #endregion [S14] Doors

    // #region [S15] Searching
    // ---- Searching ----
    searchBooks: A + "searching_books.mp3",
    searchDesk: A + "searching_desk.mp3",
    searchToolbox: A + "searching_toolbox.mp3",
    drawer: A + "opening_kitchen_drawer.mp3",
    cabinet: A + "rusty_cabinet.mp3",
    rummage: [
      A + "searching_books.mp3",
      A + "searching_desk.mp3",
      A + "searching_toolbox.mp3",
      A + "opening_kitchen_drawer.mp3",
      A + "rusty_cabinet.mp3",
    ],
    // #endregion [S15] Searching

    // #region [S16] Building and materials
    // ---- Building and materials ----
    buildingHammering: A + "building(hammering).mp3",
    woodCutting: A + "wood_cutting.mp3",
    tally: A + "tally.mp3", // carving a tally mark
    woodSplitting: A + "wood_splitting.mp3",
    rustyMetal: A + "rusty_metal.mp3",
    shovel: A + "shovel_digging.mp3",
    cardboardBox: A + "cardboard_box.mp3",
    rubbish: A + "rubbish_pile.mp3",
    // #endregion [S16] Building and materials

    // #region [S17] Around the shelter
    // ---- Around the shelter ----
    lightSwitch: A + "light_switch.mp3",
    match: A + "lighting_a_match.mp3",
    stove: A + "turning_on_stove.mp3",
    fridge: A + "old_fridge(ambiance).mp3",
    pourWater: A + "water_into_glass.mp3",
    openJar: A + "opening_jar.mp3",
    closeJar: A + "closing_jar.mp3",
    pillCap: A + "plastic_cap_opening.mp3",
    canOpen: A + "soda_can_opening.mp3",
    canJiggle: A + "soda_can_jiggle.mp3",
    canDrop: A + "soda_can_falling.mp3",
    glassBreak: A + "small_glass_shattering.mp3",
    // #endregion [S17] Around the shelter

    // #region [S18] Footsteps
    // ---- Footsteps ----
    footsteps: A + "footprints_across_a_room.mp3",
    carefulWalking: A + "careful_walking.mp3",
    glassSteps: A + "footsteps_on_glass.mp3",
    // #endregion [S18] Footsteps

    // #region [S19] Traders
    // ---- Traders ----
    shopBell: A + "shop_door_bell(trader).mp3",
    helloWoman: A + "hello(women).mp3",
    // #endregion [S19] Traders

    // #region [S20] Ambience sounds
    // ---- Ambience (looped with AT.setAmbience, see the Ambience section) ----
    ambMorning: A + "morning(ambiance).mp3",
    rooster: A + "morning(rooster).mp3",
    ambDay: A + "day(ambiance).mp3",
    ambDayExtra: A + "day(occational-ambiance).mp3",
    ambEvening: [A + "evening(ambiance).mp3", A + "evening(ambiance2).mp3"],
    ambNight: A + "night(ambiance).mp3",
    // #endregion [S20] Ambience sounds

    // #region [S20a] Events, weather and survivors
    // ---- Events and weather (used by events in story.js) ----
    radioStatic: A + "radio_static.mp3", // radio events and checkpoints
    dogWhine: A + "dog_whinning.mp3", // A dog at the fence
    dogBark: A + "dog_barking.mp3", // Good dog
    fireCrackle: A + "fire_cracking.mp3", // fires, kindling, burning the bloated one
    generator: A + "generator(pull-cord).mp3", // A generator in the basement
    generatorOff: A + "generator(shuttingdown).mp3", // not used yet
    wind: A + "windy_ambiance.mp3", // fog, frost, the roof checkpoint
    rain: A + "rain.mp3", // A storm rolls in
    birds: A + "frogs_and_goose(ambiance).mp3", // geese, quiet morning
    arguing: A + "arguing.mp3", // Missing rations
    guitar: A + "guitar.mp3", // An old guitar
    rats: A + "rats.mp3", // Rats in the stores
    freezing: A + "freezing.mp3", // Frost
    snowSteps: A + "walking_on_snow.mp3", // Frost
    // squelch: A + "squelch.mp3", // A bloated one (no squelch file in assets/audio yet)

    // ---- Survivors (game.js picks Male or Female from the survivor's name) ----
    cough: [A + "male(cough).mp3", A + "female(cough).mp3"], // fever and infected wounds
    hurtMale: A + "male-grunt.mp3",
    hurtFemale: A + "female-grunt.mp3",
    dyingMale: A + "male-dying.mp3",
    dyingFemale: A + "female-dying.mp3",
    healing: A + "healing.mp3", // a Heal task treats someone

    // ---- Story text ----
    typewriter: A + "type-writer.mp3", // loops while story text types out
    // #endregion [S20a] Events, weather and survivors
  };
  // #endregion [S10] Sound List

  // #region [S21] Volume Mix & Loading
  // How loud each sound plays compared to its group's level (1 = full volume).
  // Anything not listed plays at 1. Turn these up or down to balance the mix.
  var SOUND_VOLUME = {
    ambMorning: 0.5,
    ambDay: 0.5,
    ambEvening: 0.5,
    ambNight: 0.5,
    ambDayExtra: 0.6,
    rooster: 0.8,
    zombieGroan: 0.6,
    horde: 0.8,
    hordeClose: 0.7,
    typewriter: 0.35,
  };

  // Seconds to skip at the start of a file that opens with silence,
  // so the sound lands the moment it's triggered, e.g. { lockClick: 0.45 }.
  var SOUND_START = {};

  // The ambience tracks are long, so they only load when they are played.
  // So do the two big weather loops.
  var NO_PRELOAD = [
    "ambMorning",
    "ambDay",
    "ambDayExtra",
    "ambEvening",
    "ambNight",
    "wind",
    "rain",
  ];

  // Picks the file for a name (a random one if the name lists several).
  function pickSrc(name) {
    var src = SOUNDS[name];
    if (Array.isArray(src)) src = src[Math.floor(Math.random() * src.length)];
    return src;
  }

  // The main volume, times the sound's group level, times its own level from
  // SOUND_VOLUME. Pass group to override the sound's usual group.
  function volumeFor(name, s, group) {
    var own = name in SOUND_VOLUME ? SOUND_VOLUME[name] : 1;
    return clamp(
      (Number(s.volume) / 100) * groupLevel(group || groupOf(name), s) * own,
    );
  }

  // Each file is loaded once and then copied for every play.
  var loadedSounds = {};
  // Returns the loaded Audio element for a file, creating it the first time.
  function loadFile(src) {
    if (!loadedSounds[src]) {
      loadedSounds[src] = new Audio(src);
      loadedSounds[src].preload = "auto";
    }
    return loadedSounds[src];
  }

  // Loads sounds ahead of time so the first play isn't delayed.
  // With no list, it loads every sound except the long ambience tracks.
  function preloadSounds(names) {
    (
      names ||
      Object.keys(SOUNDS).filter(function (n) {
        return NO_PRELOAD.indexOf(n) === -1;
      })
    ).forEach(function (name) {
      [].concat(SOUNDS[name] || []).forEach(loadFile);
    });
  }
  // #endregion [S21] Volume Mix & Loading

  // #region [S22] Channels
  /*
  ---------- Channels ----------
  A channel is a named group of sounds that can be stopped together, including
  sounds still waiting on a delay. game.js puts everything from a report or
  event on the "scene" channel and stops it when the player clicks Continue,
  so the dusk sounds don't drag on into the night.

  With replace: true, a new sound first stops whatever is still playing (or
  waiting to play) on its channel. Every button press uses the "button"
  channel this way, so clicking quickly from one option to the next swaps the
  sound instead of piling them on top of each other.
  */
  var STOP_FADE_MS = 300;
  var channels = {};
  // Returns a channel's record of playing sounds and waiting timers, creating it if needed.
  function channel(name) {
    if (!channels[name]) channels[name] = { playing: [], timers: [] };
    return channels[name];
  }

  // Fades out everything playing on a channel and cancels anything still waiting.
  function stopChannel(name, ms) {
    var ch = channels[name];
    if (!ch) return;
    ch.timers.forEach(clearTimeout);
    ch.timers = [];
    ch.playing.forEach(function (a) {
      stopSound(a, ms == null ? STOP_FADE_MS : ms);
    });
    ch.playing = [];
  }
  // #endregion [S22] Channels

  // #region [S23] Play & Stop Sounds
  // Plays a sound by name, using the Sound and Volume settings from the Options page.
  // opts (all optional):
  //   delay:   wait this many milliseconds first (to stagger stacked sounds)
  //   volume:  extra level for this one play (1 = normal, 0.5 = half)
  //   loop:    keep repeating until AT.stopSound() is called (not with delay)
  //   gap:     skip it if the same sound started less than this many ms ago,
  //            so fast repeats (like zombies hitting the wall) don't pile up
  //   channel: the channel it belongs to (see Channels above)
  //   replace: stop the rest of the channel first
  //   fade:    how fast (ms) replace fades out the old sounds
  // Returns the playing copy so it can be stopped, or null.
  var lastPlayed = {};
  // Re-applies the volume settings to every loop that's still playing.
  function syncLoops(s) {
    loops = loops.filter(function (l) {
      return !l.a.paused;
    });
    loops.forEach(function (l) {
      if (!s.sound) {
        l.a.pause();
        return;
      }
      clearInterval(l.a.fadeTimer);
      l.a.volume = clamp(volumeFor(l.name, s, l.group) * l.extra);
    });
  }
  // See the opts list above.
  function playSound(name, opts) {
    opts = opts || {};
    if (opts.replace && opts.channel) stopChannel(opts.channel, opts.fade);
    if (opts.delay) {
      var later = { volume: opts.volume, gap: opts.gap, channel: opts.channel };
      var id = setTimeout(function () {
        if (later.channel) {
          var waiting = channel(later.channel).timers;
          if (waiting.indexOf(id) !== -1)
            waiting.splice(waiting.indexOf(id), 1);
        }
        playSound(name, later);
      }, opts.delay);
      if (opts.channel) channel(opts.channel).timers.push(id);
      return null;
    }
    var s = load();
    if (!s.sound || !SOUNDS[name]) return null;
    var now = Date.now();
    if (opts.gap && now - (lastPlayed[name] || 0) < opts.gap) return null;
    lastPlayed[name] = now;
    // A copy lets the same sound overlap itself (e.g. two quick shots).
    var a = loadFile(pickSrc(name)).cloneNode();
    // Sounds layered over the ambience follow the Ambience slider.
    var group = opts.channel === "ambienceExtras" ? "ambience" : groupOf(name);
    var extra = opts.volume == null ? 1 : opts.volume;
    a.volume = clamp(volumeFor(name, s, group) * extra);
    a.loop = Boolean(opts.loop);
    if (a.loop) loops.push({ a: a, name: name, group: group, extra: extra });
    if (SOUND_START[name]) a.currentTime = SOUND_START[name];
    if (opts.channel) {
      var ch = channel(opts.channel);
      ch.playing.push(a);
      // A finished sound no longer needs stopping, so drop it from its channel.
      a.addEventListener("ended", function () {
        var i = ch.playing.indexOf(a);
        if (i !== -1) ch.playing.splice(i, 1);
      });
    }
    a.play().catch(function () {});
    return a;
  }

  // Plays several sounds stacked on top of each other. Each item is a name,
  // or [name, delay in ms] to start that one a little later, e.g.
  // AT.playSounds(["doorOpen", ["carefulWalking", 300]]).
  // opts: channel, replace and fade work as in playSound(). With replace, the
  // whole stack replaces what was on the channel before.
  function playSounds(list, opts) {
    opts = opts || {};
    if (opts.replace && opts.channel) stopChannel(opts.channel, opts.fade);
    (list || []).forEach(function (item) {
      var one = typeof item === "string" ? [item] : item;
      playSound(one[0], {
        delay: one[1],
        volume: one[2],
        channel: opts.channel,
      });
    });
  }

  // Fades out and stops a sound that playSound() returned.
  function stopSound(a, ms) {
    if (!a) return;
    fadeTo(a, 0, ms || 400, function () {
      a.pause();
    });
  }
  // #endregion [S23] Play & Stop Sounds

  // #region [S24] Preload & Button Sounds
  // The menu sounds are used on every page, so load them now.
  preloadSounds(["click", "menu", "turnPage"]);

  // Kept so older code that calls AT.playClick() still works.
  function playClick() {
    playSound("click");
  }

  // Plays each button's sound when it's clicked (see the note at the top of this section).
  document.addEventListener("click", function (e) {
    // Only buttons (and links styled as buttons) make a sound.
    var btn = e.target.closest("button, .btn");
    if (!btn || btn.disabled) return;
    var name = btn.dataset.sound || "click";
    // A new button press cuts off the last one's sound (see Channels).
    if (name !== "none") {
      playSound(name, { channel: "button", replace: true, fade: 120 });
    }

    // Links load a new page, which cuts the sound off, so wait a moment first.
    // Skip this if another handler (like data-back) already took over the click,
    // or if the player is opening the link in a new tab.
    if (
      btn.tagName === "A" &&
      btn.href &&
      !e.defaultPrevented &&
      btn.target !== "_blank" &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.shiftKey
    ) {
      e.preventDefault();
      setTimeout(function () {
        location.href = btn.href;
      }, 150);
    }
  });

  window.AT.playClick = playClick;
  window.AT.playSound = playSound;
  window.AT.playSounds = playSounds;
  window.AT.stopSound = stopSound;
  window.AT.stopChannel = stopChannel;
  window.AT.preloadAmbience = preloadAmbience;
  window.AT.preloadSounds = preloadSounds;
  window.AT.setAmbience = setAmbience;
  window.AT.SOUND_GROUPS = SOUND_GROUPS;
  // #endregion [S24] Preload & Button Sounds
  // #endregion [S9] Sound Effects

  // #region [S25] Tally Marks
  /*
===============================================================
---------- Tally Marks ----------
===============================================================
Draws tally marks as HTML: four upright lines, then the fifth slashes
through them. Used by the top bar (game.js), the Tally mini-game
(minigames.js) and the Final Tally (end.js). The look lives in
css/style.css (9m. Tally marks).

marks is a number, or a list with one entry per mark: true for a clean
mark, false for a crooked one (a lost Tally mini-game).
opts.fresh: the index of a mark to draw with the carving animation.
*/
  function tallyMarks(marks, opts) {
    opts = opts || {};
    if (typeof marks === "number") {
      marks = Array.apply(null, Array(Math.max(0, marks))).map(function () {
        return true;
      });
    }
    var html = "";
    for (var g = 0; g < marks.length; g += 5) {
      html += '<span class="tally-group">';
      for (var i = g; i < Math.min(g + 5, marks.length); i++) {
        var cls = i - g === 4 ? "tally-slash" : "tally-mark";
        if (marks[i] === false) cls += " crooked";
        if (opts.fresh === i) cls += " fresh";
        html += '<i class="' + cls + '"></i>';
      }
      html += "</span>";
    }
    return '<span class="tally" aria-hidden="true">' + html + "</span>";
  }
  window.AT.tallyMarks = tallyMarks;
  // #endregion [S25] Tally Marks
})();
