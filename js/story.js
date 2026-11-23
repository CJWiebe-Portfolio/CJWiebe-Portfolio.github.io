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
and the events can be rewritten without touching the game code.
  - game.js shows the OPENING pop-up when a run starts, picks a NIGHT EVENT
    every night and sometimes a MORNING EVENT, and plays each CHECKPOINT as
    the morning event on its day.
  - end.js picks the ENDING that fits how the run went.

All the text below is a first draft. Rewrite it freely.

Placeholders you can use in any text, choice label or outcome
(filled in by fill() at the bottom):
  {shelter}   the shelter's name
  {length}    the run length in days (15, 30 or 45)
  {day}       the current day
  {daysLeft}  days left in the run (0 on the last day)
  {alive}     survivors still alive
  {lost}      survivors lost

Pictures and sounds that aren't in the game yet:
Every event and ending picture is now in assets/images/png/. Fallbacks are
kept in case one goes missing:
  - `art` can be a list of picture names. The first one that exists in
    assets/images/png/ is shown, so ["event_dog", "suburb"] would show
    suburb.png if event_dog.png were ever removed.
  - A sound name that isn't in SOUNDS (common.js) is skipped. The ones these
    events are waiting for are listed, commented out, at the end of the
    sound list in common.js: add the file, remove the // and they play.
=========================================================
TABLE OF CONTENTS
Ctrl+F a tag such as "[S3]" to jump to that section.
Ctrl+K Ctrl+8 folds every region; Ctrl+K Ctrl+9 unfolds them.
=========================================================
[S1] Opening
[S2] Events: how to write one
  [S3] Night events
  [S4] Morning events
[S5] Checkpoints
[S6] Endings
[S7] Helpers
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

  // #region [S2] Events: how to write one
  /*
---------- Events ----------
One event happens every night (picked from the night events), and some
mornings bring one too (MORNING_EVENT_CHANCE in game.js). An event is only
picked when everything in its "When it can happen" fields is true, and the
same event never comes twice in a row. To add an event, copy one below,
give it a new title and change the text.

Each event has:
  title     shown at the top. Keep every title different.
  text      what the player reads
  art       a picture name from assets/images/png/ (without .png), or a list
            of names: the first one that exists is shown. Events without art
            show event_generic.
  sounds    played stacked when the event opens. Names are in SOUNDS in
            common.js; ["name", 900] starts that one 900 ms later.
  from      for events that bring someone in: finishes the log line
            "Maya (Medic, tough) joined the group ..." e.g. "at the gate"
  choices   the options, usually three (see below)

When it can happen (all optional; leave them out and it can happen any time):
  needsScavenging  true: only after someone came home from scavenging tonight
                   (night events only)
  needsFreeBed     true: only while there's a free bed (events that bring someone in)
  needsLocked      a map location id: only while that location is still locked
  needsFlag        a story flag: only after a checkpoint or event choice set it
  needsHurt        true: only while someone at the shelter is injured (under 60 health)
  needsBuilt       a facility id: only once it's built. Ids: beds, kitchen,
                   water, workshop, infirmary, walls
  minDay           only on this day or later
  once             true: happens at most once a run

Each choice has a label, and a kind:
  "skill"     needs a rested survivor with that skill at the shelter.
              Skills: Scavenger, Builder, Medic, Fighter, Cook, Hunter,
              Mechanic, Negotiator, Sharpshooter
  "minigame"  plays a mini-game (game: "Defense", "Lockpick" or "Search")
  "cost"      anyone can pick it, if the group can pay the cost

and any of these (all optional). Resources are food, water, materials,
medicine and ammo.
  cost        resources paid, e.g. { food: 3 }; greyed out if you can't pay
  lose        resources taken, as much as you have (never greyed out)
  gain        resources brought in, e.g. { food: 2 }. A pair of numbers
              rolls between them: { food: [2, 4] } is 2, 3 or 4 food.
  reward      a name from REWARDS in game.js, for supplies worked out there:
              crate, pantry, soldier, rats, rain, raiders, cart, scrap, deer, tracks
  fatigue     added to the survivor with the skill
  injure      health the survivor with the skill loses
  hurtOne     health one random survivor at the shelter loses (Cowards are spared)
  healOne     health the most hurt survivor at the shelter gets back
  fatigueAll  added to everyone at the shelter (negative lets them rest)
  morale      added to everyone (can be negative)
  recruit     true: a newcomer joins if there's a free bed
  unlock      a location id to open on the map, e.g. "military"
  flag        a word remembered for the rest of the run, e.g. "dog".
              Later events, checkpoints and endings can check for it.
  needsFlag   greyed out unless that flag was set earlier
  needsNote   what the grey line says is needed, e.g. "a working radio"
  win         minigame choices only: effects applied if the mini-game is won,
              e.g. { recruit: true } or { gain: { ammo: 2 } }. Any of recruit,
              unlock, reward, gain and flag.
  outcome     the line written to the log
  sounds      played stacked when the choice is picked
*/
  // #endregion [S2] Events: how to write one

  // #region [S3] Night events
  // ---------- Night events ----------
  var nightEvents = [
    {
      title: "Knocking at the gate",
      art: "event_gate",
      text: "Someone is pounding on the gate, begging to be let in. Behind them, shapes shuffle out of the dark.",
      from: "at the gate",
      sounds: ["knockSoft", ["knockHard", 1500], ["zombieGroan", 2600]],
      choices: [
        {
          label: "Talk them through it",
          kind: "skill",
          skill: "Medic",
          cost: { medicine: 1 },
          recruit: true,
          outcome:
            "Your medic checked the stranger for bites and opened the gate.",
          sounds: ["doorOpen", ["pillCap", 600], ["closeJar", 1400]],
        },
        {
          label: "Clear the street first",
          kind: "minigame",
          game: "Defense",
          win: { recruit: true },
        },
        {
          label: "Pay them to move on",
          kind: "cost",
          cost: { food: 3 },
          outcome: "You passed food through the gate. They left.",
          sounds: ["canJiggle", ["footsteps", 600]],
        },
      ],
    },
    {
      title: "A locked supply crate",
      art: "event_crate",
      text: "A survivor found a padlocked crate in the alley behind the shelter.",
      sounds: ["rustyMetal"],
      choices: [
        {
          label: "Pry it open",
          kind: "skill",
          skill: "Builder",
          fatigue: 20,
          reward: "crate",
          outcome: "Your builder forced the lid off the crate.",
          sounds: [
            "woodSplitting",
            ["rustyHinges", 500],
            ["cardboardBox", 1100],
          ],
        },
        { label: "Pick the lock", kind: "minigame", game: "Lockpick" },
        {
          label: "Leave it",
          kind: "cost",
          cost: {},
          morale: -5,
          outcome: "You left the crate where it was.",
          sounds: ["footsteps"],
        },
      ],
    },
    {
      title: "Raid on the walls",
      art: "event_raid",
      text: "A crowd of the dead presses against the north wall. It will not hold for long.",
      sounds: ["hordeClose", ["zombieAttack", 800], ["knockHard", 1200]],
      choices: [
        {
          label: "Hold the line",
          kind: "skill",
          skill: "Fighter",
          fatigue: 30,
          injure: 10,
          outcome: "Your fighter held the wall until dawn.",
          sounds: [
            "swing",
            ["swing", 450],
            ["swing", 900],
            ["zombieDying", 1100],
          ],
        },
        { label: "Defend the wall", kind: "minigame", game: "Defense" },
        {
          label: "Fire into the crowd",
          kind: "cost",
          cost: { ammo: 3 },
          outcome: "The shots scattered the crowd.",
          sounds: [
            "gunshot",
            ["gunshot", 350],
            ["gunshot", 700],
            ["zombieDying", 1100],
          ],
        },
      ],
    },
    {
      title: "A house worth searching",
      art: "event_house",
      text: "On the way back, your scavenger spotted a house with the door hanging open. The dead can't be far.",
      needsScavenging: true,
      sounds: ["rustyDoor", ["glassSteps", 900]],
      choices: [
        { label: "Search it room by room", kind: "minigame", game: "Search" },
        {
          label: "Let the expert pick the spots",
          kind: "skill",
          skill: "Scavenger",
          fatigue: 20,
          reward: "pantry",
          outcome:
            "Your scavenger went straight for the pantry and slipped out quietly.",
          sounds: ["carefulWalking", ["drawer", 700], ["searchDesk", 1400]],
        },
        {
          label: "Head home before dark",
          kind: "cost",
          cost: {},
          outcome: "You left the house alone.",
          sounds: ["footsteps", ["doorClose", 1200]],
        },
      ],
    },
    {
      title: "A voice on the radio",
      art: ["event_radio", "school"],
      text: "The old radio crackles to life. Someone is hiding in the school gym, out of food, asking if anyone can hear them.",
      from: "from the school gym",
      needsFreeBed: true,
      sounds: ["radioStatic", "lightSwitch", ["zombieGroan", 1400]],
      choices: [
        {
          label: "Send your fighter",
          kind: "skill",
          skill: "Fighter",
          fatigue: 30,
          injure: 10,
          recruit: true,
          outcome:
            "Your fighter cut a path to the school and brought them back.",
          sounds: [
            "doorOpen",
            ["swing", 700],
            ["swing", 1100],
            ["doorClose", 2000],
          ],
        },
        {
          label: "Cover them as they run",
          kind: "minigame",
          game: "Defense",
          win: { recruit: true },
        },
        {
          label: "Turn the radio off",
          kind: "cost",
          cost: {},
          morale: -5,
          outcome: "You turned the radio off. Nobody slept well.",
          sounds: ["lightSwitch"],
        },
      ],
    },
    {
      title: "A fallen soldier",
      art: "military_checkpoint",
      text: "Near the checkpoint, your scavenger found a soldier slumped against the fence. A keycard hangs from his belt.",
      needsScavenging: true,
      needsLocked: "military",
      sounds: ["glassSteps", ["rustyMetal", 900]],
      choices: [
        {
          label: "Let the expert check him",
          kind: "skill",
          skill: "Scavenger",
          fatigue: 10,
          reward: "soldier",
          unlock: "military",
          outcome:
            "Your scavenger took the keycard and everything useful on him.",
          sounds: ["carefulWalking", ["pillCap", 700], ["reload", 1200]],
        },
        {
          label: "Grab the keycard and run",
          kind: "cost",
          cost: {},
          hurtOne: 10,
          unlock: "military",
          outcome: "You snatched the keycard as the dead closed in.",
          sounds: ["footsteps", ["zombieShout", 500], ["doorClose", 1400]],
        },
        {
          label: "Leave him be",
          kind: "cost",
          cost: {},
          outcome: "You left the soldier where he fell.",
          sounds: ["footsteps"],
        },
      ],
    },
    {
      title: "Rats in the stores",
      art: "kitchen",
      text: "Something has been chewing through the food sacks. Droppings everywhere.",
      sounds: ["rats", "rubbish", ["cardboardBox", 700]],
      choices: [
        {
          label: "Hunt them down",
          kind: "skill",
          skill: "Hunter",
          fatigue: 10,
          reward: "rats",
          outcome:
            "Your hunter cleared the rats out. Not much meat, but it's food.",
          sounds: ["swing", ["swing", 400], ["stove", 1200]],
        },
        {
          label: "Set traps",
          kind: "cost",
          cost: { materials: 2 },
          outcome: "You built traps from scrap. The food is safe.",
          sounds: ["buildingHammering"],
        },
        {
          label: "Let it be",
          kind: "cost",
          cost: {},
          lose: { food: 3 },
          outcome: "The rats got into the food.",
          sounds: ["rubbish", ["rats", 300]],
        },
      ],
    },
    {
      title: "A storm rolls in",
      art: ["event_storm", "watercollector"],
      text: "Rain hammers the roof and water drips through a dozen cracks. The walls are slick, and the dead are quiet for once.",
      sounds: ["rain", "pourWater", ["rustyMetal", 800]],
      choices: [
        {
          label: "Patch the roof",
          kind: "skill",
          skill: "Builder",
          fatigue: 20,
          cost: { materials: 1 },
          reward: "rain",
          morale: 5,
          outcome:
            "Your builder patched the roof and rigged it to catch the rain.",
          sounds: ["buildingHammering", ["pourWater", 900]],
        },
        {
          label: "Put out every pot and pan",
          kind: "cost",
          cost: {},
          reward: "rain",
          morale: -5,
          outcome: "You caught the rain, but everyone slept cold and wet.",
          sounds: ["pourWater", ["canDrop", 500]],
        },
        {
          label: "Sit it out",
          kind: "cost",
          cost: {},
          outcome: "You waited out the storm.",
          sounds: ["rain"],
        },
      ],
    },
    {
      title: "Fever in the shelter",
      art: ["event_fever", "infirmary"],
      text: "One of the group is burning up with fever and can barely stand.",
      sounds: ["cough", "footsteps", ["openJar", 900]],
      choices: [
        {
          label: "Have the medic treat them",
          kind: "skill",
          skill: "Medic",
          cost: { medicine: 1 },
          outcome: "Your medic brought the fever down by morning.",
          sounds: ["pillCap", ["pourWater", 600]],
        },
        {
          label: "Use the medicine",
          kind: "cost",
          cost: { medicine: 2 },
          outcome: "Two doses of medicine broke the fever.",
          sounds: ["pillCap", ["closeJar", 700]],
        },
        {
          label: "Let them sweat it out",
          kind: "cost",
          cost: {},
          hurtOne: 20,
          outcome: "You kept them warm and hoped for the best.",
          sounds: ["lightSwitch", ["cough", 800]],
        },
      ],
    },
    {
      title: "Raiders at the gate",
      art: "event_gate",
      text: "Three armed strangers stand at the gate. They want food and water, or they'll come in and take it.",
      sounds: ["knockHard", ["cock", 900]],
      choices: [
        {
          label: "Talk them down",
          kind: "skill",
          skill: "Negotiator",
          reward: "raiders",
          outcome:
            "Your negotiator talked them into a truce. They even left some ammo.",
          sounds: ["doorOpen", ["cardboardBox", 900], ["doorClose", 1800]],
        },
        { label: "Drive them off", kind: "minigame", game: "Defense" },
        {
          label: "Hand over supplies",
          kind: "cost",
          cost: { food: 2, water: 2 },
          outcome: "You handed over food and water. They left you alone.",
          sounds: ["cardboardBox", ["doorClose", 900]],
        },
      ],
    },
    {
      title: "An old guitar",
      art: ["event_guitar", "bedroom"],
      text: "Someone found a battered guitar in the rubble. It's out of tune, but it still plays.",
      sounds: ["cardboardBox", ["guitar", 600]],
      choices: [
        {
          label: "Play quietly by the fire",
          kind: "cost",
          cost: {},
          morale: 10,
          outcome: "For one night, it almost felt normal.",
          sounds: ["match", ["guitar", 400]],
        },
        {
          label: "Trade it for parts",
          kind: "cost",
          cost: {},
          reward: "scrap",
          outcome: "You stripped the guitar for wire and wood.",
          sounds: ["woodSplitting"],
        },
      ],
    },

    // ----- New night events (November 2026) -----
    {
      title: "A dog at the fence",
      art: ["event_dog", "suburb"],
      text: "A thin dog is whining at the fence, ribs showing through its matted coat. It flinches every time a groan drifts in from the street, but it won't leave.",
      sounds: ["dogWhine", ["rustyMetal", 600], ["zombieGroan", 1600]],
      choices: [
        {
          label: "Coax it inside",
          kind: "skill",
          skill: "Hunter",
          fatigue: 10,
          cost: { food: 1 },
          morale: 10,
          flag: "dog", // the "Good dog" morning event needs this
          outcome:
            "Your hunter knelt by the fence for an hour with a strip of jerky. The dog slept by the door that night.",
          sounds: ["carefulWalking", ["doorClose", 1200]],
        },
        {
          label: "Toss it some scraps",
          kind: "cost",
          cost: { food: 1 },
          morale: 5,
          outcome:
            "You threw it some scraps. It ate, then slipped back into the dark.",
          sounds: ["canJiggle"],
        },
        {
          label: "Chase it off",
          kind: "cost",
          cost: {},
          morale: -5,
          outcome:
            "You rattled the fence until it ran. Nobody looked at each other afterwards.",
          sounds: ["rustyMetal", ["dogWhine", 500]],
        },
      ],
    },
    {
      title: "A bloated one",
      art: ["event_bloated", "event_raid"],
      text: "Something huge is dragging itself along the wall: one of the dead, swollen to twice the size of a man. Where it brushes the boards, they come away wet and soft.",
      sounds: ["zombieGroan", ["squelch", 700], ["woodSplitting", 1300]],
      choices: [
        {
          label: "One clean shot",
          kind: "skill",
          skill: "Sharpshooter",
          cost: { ammo: 1 },
          outcome:
            "Your sharpshooter put one round through its head from the roof. It went down without bursting.",
          sounds: ["cock", ["gunshot", 600], ["zombieDying", 1000]],
        },
        {
          label: "Burn it where it stands",
          kind: "cost",
          cost: { materials: 2 },
          morale: -5,
          outcome:
            "You soaked a rag, lit it and threw it. The smell hung over the shelter all night.",
          sounds: ["match", ["fireCrackle", 400], ["zombieScream", 900]],
        },
        { label: "Bring it down at the wall", kind: "minigame", game: "Defense" },
      ],
    },
    {
      title: "Bulging cans",
      art: ["event_cans", "kitchen"],
      text: "Half the tins in the stores have puffed up overnight, their lids bulging. Some of them must still be good. Some of them definitely aren't.",
      sounds: ["canJiggle", ["canDrop", 600]],
      choices: [
        {
          label: "Let the cook sort them",
          kind: "skill",
          skill: "Cook",
          fatigue: 10,
          outcome:
            "Your cook went through every tin by candlelight and only threw out the bad ones.",
          sounds: ["canOpen", ["openJar", 700]],
        },
        {
          label: "Throw out every bulging tin",
          kind: "cost",
          cost: {},
          lose: { food: 3 },
          outcome: "You didn't take the chance. The bad tins went over the wall.",
          sounds: ["rubbish", ["canDrop", 500]],
        },
        {
          label: "Eat them anyway",
          kind: "cost",
          cost: {},
          hurtOne: 15,
          outcome: "Most of them were fine. One of them wasn't.",
          sounds: ["canOpen", ["stove", 600]],
        },
      ],
    },
    {
      title: "A generator in the basement",
      art: ["event_generator", "workshop"],
      once: true,
      text: "Under a tarp in the basement, someone finds a petrol generator with half a tank left. Real light. Maybe even heat. Also the loudest thing for blocks.",
      sounds: ["searchToolbox", ["rustyMetal", 800]],
      choices: [
        {
          label: "Get it running quietly",
          kind: "skill",
          skill: "Mechanic",
          fatigue: 20,
          cost: { materials: 1 },
          morale: 10,
          outcome:
            "Your mechanic packed the exhaust with scrap and wool until it purred. For one night, the shelter had light.",
          sounds: ["generator", ["lightSwitch", 1200]],
        },
        {
          label: "Run it as it is",
          kind: "cost",
          cost: {},
          morale: 10,
          hurtOne: 10,
          outcome:
            "The lights came on, and so did the dead. They were at the walls within the hour.",
          sounds: ["generator", ["hordeClose", 1500]],
        },
        {
          label: "Strip it for parts",
          kind: "cost",
          cost: {},
          gain: { materials: [2, 3] },
          outcome: "You took it apart for wire, bolts and a good length of hose.",
          sounds: ["searchToolbox", ["rustyMetal", 600]],
        },
      ],
    },
    {
      title: "A trader after dark",
      art: ["event_trader_night", "trader"],
      text: "A lantern bobs at the gate. A hooded trader, travelling at night while the roads are empty, is offering medicine. The price is ammunition.",
      sounds: ["knockSoft", ["carefulWalking", 700]],
      choices: [
        {
          label: "Haggle",
          kind: "skill",
          skill: "Negotiator",
          cost: { ammo: 1 },
          gain: { medicine: 2 },
          outcome: "Your negotiator talked them down to a single round.",
          sounds: ["cardboardBox", ["pillCap", 700]],
        },
        {
          label: "Pay the asking price",
          kind: "cost",
          cost: { ammo: 3 },
          gain: { medicine: 2 },
          outcome: "You paid what they asked. At least the medicine is real.",
          sounds: ["reload", ["pillCap", 700]],
        },
        {
          label: "Send them on their way",
          kind: "cost",
          cost: {},
          outcome: "The lantern bobbed away down the road.",
          sounds: ["doorClose"],
        },
      ],
    },
    {
      title: "In the yard",
      art: ["event_yard", "event_raid"],
      minDay: 5,
      text: "A crash from the yard. A few of the dead found a gap under the fence, and now they're stumbling between the woodpile and the water barrels.",
      sounds: ["glassBreak", ["zombieGroan", 500], ["zombieShout", 1200]],
      choices: [
        {
          label: "Clear them out",
          kind: "skill",
          skill: "Fighter",
          fatigue: 20,
          injure: 10,
          outcome: "Your fighter went out with a crowbar and came back alone.",
          sounds: [
            "doorOpen",
            ["swing", 500],
            ["swing", 900],
            ["zombieDying", 1300],
          ],
        },
        { label: "Fight them off", kind: "minigame", game: "Defense" },
        {
          label: "Bar the doors and wait",
          kind: "cost",
          cost: {},
          lose: { materials: 2, water: 1 },
          morale: -5,
          outcome:
            "By morning they had wandered off, but they knocked over the woodpile and a water barrel on the way.",
          sounds: ["doorClose", ["woodSplitting", 900]],
        },
      ],
    },
    {
      title: "The wound turns",
      art: ["event_wound", "infirmary"],
      needsHurt: true,
      text: "One of the injured has a wound that has started to smell. The skin around it is red and hot to the touch.",
      sounds: ["cough", ["footsteps", 600]],
      choices: [
        {
          label: "Clean it out properly",
          kind: "skill",
          skill: "Medic",
          cost: { medicine: 1 },
          healOne: 20,
          outcome:
            "Your medic cleaned and re-stitched the wound. The fever broke before dawn.",
          sounds: ["pillCap", ["pourWater", 700]],
        },
        {
          label: "Use the medicine",
          kind: "cost",
          cost: { medicine: 2 },
          healOne: 10,
          outcome: "You used two doses and kept the wound clean. It will take time.",
          sounds: ["pillCap", ["closeJar", 600]],
        },
        {
          label: "Bandage it and hope",
          kind: "cost",
          cost: {},
          hurtOne: 15,
          morale: -5,
          outcome: "You wrapped it tight and waited. By morning, the fever had spread.",
          sounds: ["cough", ["lightSwitch", 900]],
        },
      ],
    },
    {
      title: "The wall is leaning",
      art: ["event_wall", "watchtower"],
      needsBuilt: "walls",
      text: "After the last raid, a whole section of the wall leans inwards. One more push and it'll come down on whoever is standing behind it.",
      sounds: ["woodSplitting", ["rustyMetal", 700]],
      choices: [
        {
          label: "Brace it properly",
          kind: "skill",
          skill: "Builder",
          fatigue: 20,
          cost: { materials: 1 },
          outcome:
            "Your builder set new posts and braced the section before the dead came back.",
          sounds: ["buildingHammering", ["shovel", 800]],
        },
        {
          label: "Patch it with whatever's left",
          kind: "cost",
          cost: { materials: 3 },
          outcome:
            "You nailed every spare board over the weak section. It isn't pretty, but it's standing.",
          sounds: ["buildingHammering", ["woodCutting", 700]],
        },
        {
          label: "It'll hold",
          kind: "cost",
          cost: {},
          hurtOne: 15,
          outcome: "It didn't. The section came down on one of the guards.",
          sounds: ["woodSplitting", ["zombieShout", 600]],
        },
      ],
    },
    {
      title: "Followed home",
      art: ["event_followed", "event_house"],
      needsScavenging: true,
      text: "Your scavenger came home out of breath, sure they were followed. Out past the wall, something is shuffling closer, one step at a time.",
      sounds: ["carefulWalking", ["zombieGroan", 1200]],
      choices: [
        {
          label: "Lead them away",
          kind: "skill",
          skill: "Scavenger",
          fatigue: 20,
          outcome:
            "Your scavenger slipped back out, rattled a can three streets over and came home the long way.",
          sounds: ["doorOpen", ["canJiggle", 900], ["carefulWalking", 1500]],
        },
        { label: "Drive them off", kind: "minigame", game: "Defense" },
        {
          label: "Leave the haul outside as bait",
          kind: "cost",
          cost: {},
          lose: { food: 2 },
          outcome:
            "You set the food out by the road. They took the bait and never found the door.",
          sounds: ["cardboardBox", ["zombieGroan", 900]],
        },
      ],
    },
    {
      title: "Missing rations",
      art: ["event_thief", "kitchen"],
      minDay: 6,
      text: "The stores are lighter than they were yesterday. Nobody saw anything. Nobody is looking anyone in the eye, either.",
      sounds: ["drawer", ["arguing", 600]],
      choices: [
        {
          label: "Get everyone talking",
          kind: "skill",
          skill: "Negotiator",
          morale: 5,
          outcome:
            "Your negotiator sat everyone down until it came out: someone had been feeding a friend outside the wall. It's over now.",
          sounds: ["match"],
        },
        {
          label: "Lock up the stores",
          kind: "cost",
          cost: { materials: 2 },
          outcome: "You built a lockbox for the rations and kept the key on you.",
          sounds: ["buildingHammering", ["closeJar", 900]],
        },
        {
          label: "Let it go",
          kind: "cost",
          cost: {},
          lose: { food: 2 },
          morale: -5,
          outcome:
            "You let it go. The food kept disappearing for a while, and so did the trust.",
          sounds: ["doorClose"],
        },
      ],
    },
    {
      title: "Fog",
      art: ["event_fog", "watchtower"],
      text: "Fog rolls in thick enough to swallow the far wall. You can hear the dead out there, close, but you can't see a single one.",
      sounds: ["wind", ["zombieGroan", 900], ["zombieGroan", 2200]],
      choices: [
        {
          label: "Listen for them",
          kind: "skill",
          skill: "Hunter",
          fatigue: 20,
          outcome:
            "Your hunter stood on the wall with their eyes shut and called out every one that came close.",
          sounds: ["carefulWalking", ["swing", 1100], ["zombieDying", 1500]],
        },
        { label: "Fight blind", kind: "minigame", game: "Defense" },
        {
          label: "Double the watch",
          kind: "cost",
          cost: {},
          fatigueAll: 15,
          outcome:
            "Nobody slept. Everyone took a turn on the wall until the fog lifted.",
          sounds: ["guardReady", ["footsteps", 700]],
        },
      ],
    },
    {
      title: "Kitchen fire",
      art: ["event_fire", "kitchen"],
      needsBuilt: "kitchen",
      text: "A pan of fat catches and the flames jump to the shelf above. Smoke is pouring out the window, and every dead thing for blocks will see it.",
      sounds: ["fireCrackle", ["glassBreak", 700], ["zombieShout", 1600]],
      choices: [
        {
          label: "Smother it",
          kind: "skill",
          skill: "Cook",
          fatigue: 10,
          outcome:
            "Your cook threw a lid on the pan and a wet sack over the shelf. It was out in a minute.",
          sounds: ["canDrop", ["pourWater", 500]],
        },
        {
          label: "Throw the water on it",
          kind: "cost",
          cost: { water: 3 },
          outcome:
            "You emptied the water buckets onto the fire. It went out, and so did tomorrow's water.",
          sounds: ["pourWater", ["pourWater", 400]],
        },
        {
          label: "Get out and let it burn",
          kind: "cost",
          cost: {},
          lose: { food: 2, materials: 2 },
          outcome:
            "It burned itself out. The shelf, the pan and half the pantry went with it.",
          sounds: ["fireCrackle", ["doorClose", 900]],
        },
      ],
    },
    {
      title: "A flare gun",
      art: ["event_flare", "gas_station"],
      needsScavenging: true,
      once: true,
      text: "Your scavenger found an orange flare gun in the glovebox of a wrecked car, with one cartridge still loaded.",
      sounds: ["rustyHinges", ["cock", 800]],
      choices: [
        {
          label: "Save it for the last night",
          kind: "cost",
          cost: {},
          morale: 5,
          flag: "flare", // opens a choice in the "A light on the roof" checkpoint
          outcome:
            "You wrapped the flare gun in a cloth and put it on the shelf. If the convoy is real, they'll see this.",
          sounds: ["cardboardBox"],
        },
        {
          label: "Pry the cartridge open for powder",
          kind: "cost",
          cost: {},
          gain: { ammo: 1 },
          outcome: "You packed the powder into a spare shell. One more round.",
          sounds: ["rustyMetal", ["reload", 600]],
        },
        {
          label: "Leave it in the car",
          kind: "cost",
          cost: {},
          outcome: "You left it in the glovebox for someone else.",
          sounds: ["doorClose"],
        },
      ],
    },
    {
      title: "Another voice on the radio",
      art: ["event_radio", "hospital"],
      needsFlag: "radio", // only after the radio was fixed in "The radio wakes"
      text: "The radio your mechanic fixed picks up a new voice: a group hiding near the hospital. They have a little boy with a fever and nothing left to give him.",
      sounds: ["radioStatic", ["helloWoman", 900]],
      choices: [
        {
          label: "Talk them through it",
          kind: "skill",
          skill: "Medic",
          fatigue: 10,
          morale: 10,
          outcome:
            "Your medic stayed on the radio for an hour: cool cloths, small sips, keep him awake. In the morning, a voice said thank you.",
          sounds: ["radioStatic"],
        },
        {
          label: "Leave medicine where they can find it",
          kind: "cost",
          cost: { medicine: 1 },
          gain: { ammo: [1, 2] },
          morale: 10,
          outcome:
            "You left a dose at the bus stop. In the morning, there were bullets in its place.",
          sounds: ["footsteps", ["doorClose", 1200]],
        },
        {
          label: "Turn it down",
          kind: "cost",
          cost: {},
          morale: -10,
          outcome: "You turned the volume down. You could still hear it anyway.",
          sounds: ["lightSwitch"],
        },
      ],
    },
    {
      title: "Letters from before",
      art: ["event_letters", "bedroom"],
      text: "Under a loose floorboard, someone finds a bundle of letters tied with string, addressed to people who probably aren't alive anymore.",
      sounds: ["searchDesk", ["turnPage", 800]],
      choices: [
        {
          label: "Read them aloud",
          kind: "cost",
          cost: {},
          morale: 10,
          outcome:
            "You read them by candlelight: birthdays, complaints about the weather, a recipe for bread. Everyone listened.",
          sounds: ["turnPage", ["turnPage", 1500]],
        },
        {
          label: "Use them as kindling",
          kind: "cost",
          cost: {},
          fatigueAll: -10,
          outcome:
            "They burned fast and kept the room warm. Everyone slept better than they had in a week.",
          sounds: ["match", ["fireCrackle", 400]],
        },
        {
          label: "Put them back",
          kind: "cost",
          cost: {},
          outcome: "You tied the string again and put them back for whoever comes next.",
          sounds: ["searchDesk"],
        },
      ],
    },
  ];
  // #endregion [S3] Night events

  // #region [S4] Morning events
  // ---------- Morning events ----------
  // Same fields as the night events. needsScavenging doesn't work here.
  var morningEvents = [
    {
      title: "A stranger on the road",
      art: "event_gate",
      text: "At first light, a tired stranger waves from the road, hands raised to show they're unarmed.",
      from: "from the road",
      needsFreeBed: true,
      sounds: ["knockSoft"],
      choices: [
        {
          label: "Let them in",
          kind: "cost",
          cost: { food: 1 },
          recruit: true,
          outcome: "You shared a meal and opened the gate.",
          sounds: ["doorOpen", ["footsteps", 500], ["doorClose", 1500]],
        },
        {
          label: "Send them on their way",
          kind: "cost",
          cost: {},
          outcome: "You pointed them down the road.",
          sounds: ["doorClose"],
        },
      ],
    },
    {
      title: "A broken cart",
      art: "event_crate",
      text: "A cart lies tipped over in the road outside, one wheel snapped. Its owner is nowhere to be seen.",
      sounds: ["rustyMetal", ["rustyHinges", 700]],
      choices: [
        {
          label: "Take it apart properly",
          kind: "skill",
          skill: "Mechanic",
          fatigue: 20,
          reward: "cart",
          outcome: "Your mechanic stripped the cart down to every useful bolt.",
          sounds: ["buildingHammering", ["rustyMetal", 600]],
        },
        {
          label: "Grab what you can",
          kind: "cost",
          cost: {},
          reward: "scrap",
          outcome: "You pulled a few boards and nails off the cart.",
          sounds: ["woodSplitting", ["rubbish", 600]],
        },
        {
          label: "Leave it",
          kind: "cost",
          cost: {},
          outcome: "You left the cart in the road.",
          sounds: ["footsteps"],
        },
      ],
    },
    {
      title: "Fresh tracks",
      art: "farm",
      text: "Muddy tracks lead from the walls toward the treeline. Something circled the shelter last night.",
      sounds: ["footsteps", ["zombieGroan", 1200]],
      choices: [
        {
          label: "Send the hunter after them",
          kind: "skill",
          skill: "Hunter",
          fatigue: 20,
          reward: "deer",
          outcome: "They were a deer's. Your hunter brought it home.",
          sounds: ["carefulWalking", ["gunshot", 1500]],
        },
        {
          label: "Follow them together",
          kind: "cost",
          cost: {},
          hurtOne: 10,
          reward: "tracks",
          outcome:
            "The tracks led to a lurker, and a few berry bushes behind it.",
          sounds: ["carefulWalking", ["zombieAttack", 1200], ["swing", 1500]],
        },
        {
          label: "Shore up the gate",
          kind: "cost",
          cost: { materials: 1 },
          morale: 5,
          outcome: "You braced the gate. Everyone breathed easier.",
          sounds: ["buildingHammering"],
        },
      ],
    },

    // ----- New morning events (November 2026) -----
    {
      title: "Good dog",
      art: ["event_dog", "suburb"],
      needsFlag: "dog", // only after "Coax it inside" in "A dog at the fence"
      once: true,
      text: "The dog you took in has been scratching at the back fence since sunrise, tail going, looking back at you every few seconds.",
      sounds: ["dogBark", ["shovel", 900]],
      choices: [
        {
          label: "Dig where it's digging",
          kind: "cost",
          cost: {},
          gain: { food: [1, 2], medicine: 1 },
          outcome:
            "Under the fence was a buried cooler: tinned meat and a sealed bottle of pills. Good dog.",
          sounds: ["shovel", ["openJar", 1200]],
        },
        {
          label: "Give it a name",
          kind: "cost",
          cost: {},
          morale: 10,
          outcome: "After a long argument, it got a name, and an extra blanket.",
          sounds: ["dogBark"],
        },
      ],
    },
    {
      title: "Frost",
      art: "event_frost",
      text: "Everyone wakes up to frost on the inside of the windows. Breath hangs in the air. Nobody wants to get up.",
      sounds: ["wind", ["footsteps", 900]],
      choices: [
        {
          label: "Make something hot",
          kind: "skill",
          skill: "Cook",
          cost: { food: 1 },
          morale: 10,
          outcome:
            "Your cook made a pot of thin soup. It wasn't much, but everyone held the bowl a long time.",
          sounds: ["stove", ["pourWater", 800]],
        },
        {
          label: "Burn some scrap",
          kind: "cost",
          cost: { materials: 2 },
          morale: 5,
          outcome: "You lit a fire in a barrel and everyone crowded round it.",
          sounds: ["match", ["fireCrackle", 400]],
        },
        {
          label: "Wrap up and get on with it",
          kind: "cost",
          cost: {},
          fatigueAll: 10,
          outcome:
            "You pulled on every layer you had and got to work. The cold stayed in your bones all day.",
          sounds: ["footsteps"],
        },
      ],
    },
    {
      title: "Geese in the lot",
      art: ["event_birds", "farm"],
      text: "A flock of geese has landed in the empty lot across the road, picking through the weeds. The dead haven't noticed them yet.",
      sounds: ["birds", ["carefulWalking", 900]],
      choices: [
        {
          label: "Set snares",
          kind: "skill",
          skill: "Hunter",
          fatigue: 10,
          gain: { food: [2, 3] },
          outcome:
            "Your hunter had snares down before the flock took off. Two of them didn't.",
          sounds: ["carefulWalking", ["birds", 900]],
        },
        {
          label: "Take a shot",
          kind: "skill",
          skill: "Sharpshooter",
          cost: { ammo: 1 },
          gain: { food: [3, 4] },
          outcome: "One shot, one goose. The rest of the flock took off.",
          sounds: ["gunshot", ["birds", 300]],
        },
        {
          label: "Just watch them",
          kind: "cost",
          cost: {},
          morale: 5,
          outcome:
            "You watched them for a while. It was nice to see something alive.",
          sounds: ["birds"],
        },
      ],
    },
    {
      title: "A body in the street",
      art: ["event_body", "suburb"],
      text: "A man is lying face down in the street outside. Not one of the dead: he just never got back up. His backpack is still on his shoulders.",
      sounds: ["carefulWalking", ["zombieGroan", 1500]],
      choices: [
        {
          label: "Let the expert check the pack",
          kind: "skill",
          skill: "Scavenger",
          fatigue: 10,
          gain: { food: [1, 2], ammo: [1, 2] },
          outcome:
            "Your scavenger emptied the pack without a sound: tins and a box of bullets.",
          sounds: ["carefulWalking", ["searchDesk", 700]],
        },
        {
          label: "Bury him",
          kind: "cost",
          cost: {},
          morale: 10,
          outcome:
            "You buried him out back with his pack. Someone said a few words.",
          sounds: ["shovel", ["shovel", 1200]],
        },
        {
          label: "Grab the pack and go",
          kind: "cost",
          cost: {},
          gain: { food: 1 },
          hurtOne: 10,
          outcome:
            "You got the pack, but a lurker came out of the doorway behind it.",
          sounds: ["footsteps", ["zombieAttack", 700]],
        },
      ],
    },
    {
      title: "Something in the water",
      art: ["event_water", "watercollector"],
      needsBuilt: "water",
      text: "A dead crow is floating in the rain catcher, and the whole tank smells wrong.",
      sounds: ["pourWater", ["rustyMetal", 700]],
      choices: [
        {
          label: "Rig a filter",
          kind: "skill",
          skill: "Mechanic",
          fatigue: 10,
          cost: { materials: 1 },
          outcome:
            "Your mechanic built a sand-and-charcoal filter. The water came out clear.",
          sounds: ["rustyMetal", ["pourWater", 800]],
        },
        {
          label: "Boil every drop",
          kind: "cost",
          cost: { materials: 2 },
          outcome:
            "You burned scrap all morning to boil it. Safe, but it tastes of smoke.",
          sounds: ["match", ["stove", 500]],
        },
        {
          label: "Dump it",
          kind: "cost",
          cost: {},
          lose: { water: 3 },
          outcome: "You tipped the tank out and scrubbed it clean.",
          sounds: ["pourWater", ["pourWater", 500]],
        },
      ],
    },
    {
      title: "A shuttered pharmacy",
      art: ["event_pharmacy", "hospital"],
      text: "Two streets over, the morning light catches a pharmacy whose steel shutter is still padlocked. Nobody has been inside.",
      sounds: ["carefulWalking", ["rustyMetal", 900]],
      choices: [
        {
          label: "Lever the shutter up",
          kind: "skill",
          skill: "Builder",
          fatigue: 20,
          gain: { medicine: [2, 3] },
          outcome:
            "Your builder levered the shutter up far enough to crawl under. The back shelves were still full.",
          sounds: ["rustyMetal", ["rustyHinges", 600], ["pillCap", 1400]],
        },
        { label: "Pick the padlock", kind: "minigame", game: "Lockpick" },
        {
          label: "Not worth the risk",
          kind: "cost",
          cost: {},
          outcome: "You marked it on the map and went home.",
          sounds: ["footsteps"],
        },
      ],
    },
    {
      title: "A deserter",
      art: ["event_deserter", "military_checkpoint"],
      needsFreeBed: true,
      minDay: 6,
      once: true,
      from: "after deserting the army",
      text: "A young soldier is sitting on the curb outside, rifle across their knees, helmet in the gutter. They say the convoy is real. They also say they're not going back to it.",
      sounds: ["footsteps", ["cock", 900]],
      choices: [
        {
          label: "Let them in",
          kind: "cost",
          cost: { food: 1 },
          recruit: true,
          morale: 5,
          outcome: "You gave them breakfast and a bed.",
          sounds: ["doorOpen", ["footsteps", 500], ["doorClose", 1400]],
        },
        {
          label: "Ask about the convoy",
          kind: "skill",
          skill: "Negotiator",
          morale: 10,
          gain: { ammo: [2, 3] },
          outcome:
            "Your negotiator got the whole story: the route, the timing and a spare magazine. Then the soldier walked on.",
          sounds: ["reload"],
        },
        {
          label: "Send them on",
          kind: "cost",
          cost: {},
          outcome:
            "They nodded like they expected it and walked off toward the river.",
          sounds: ["footsteps"],
        },
      ],
    },
    {
      title: "A quiet morning",
      art: ["event_quiet", "bedroom"],
      text: "No groans. No gunshots. Just birds and a thin grey sun. For once, nobody is in a hurry to do anything.",
      sounds: ["birds", ["match", 1500]],
      choices: [
        {
          label: "Let everyone sleep in",
          kind: "cost",
          cost: {},
          fatigueAll: -20,
          outcome: "Everyone slept until the sun was high. It felt like a holiday.",
          sounds: ["lightSwitch"],
        },
        {
          label: "Hold a proper meeting",
          kind: "cost",
          cost: {},
          morale: 5,
          outcome:
            "You sat everyone down and talked through the next few days. Having a plan helped.",
          sounds: ["turnPage"],
        },
      ],
    },
    {
      title: "Mushrooms by the drain",
      art: ["event_mushrooms", "farm"],
      text: "A cluster of pale mushrooms has sprung up by the drainpipe after the rain. Some look like the ones from the shops. Some don't.",
      sounds: ["footsteps", ["openJar", 900]],
      choices: [
        {
          label: "Let the cook pick",
          kind: "skill",
          skill: "Cook",
          gain: { food: [2, 3] },
          outcome: "Your cook knew which ones were safe. Mushroom soup for lunch.",
          sounds: ["stove", ["openJar", 700]],
        },
        {
          label: "Pick them all",
          kind: "cost",
          cost: {},
          gain: { food: [2, 3] },
          hurtOne: 15,
          outcome: "Lunch was good. One of the mushrooms was not.",
          sounds: ["stove"],
        },
        {
          label: "Leave them",
          kind: "cost",
          cost: {},
          outcome: "You left them by the drain.",
          sounds: ["footsteps"],
        },
      ],
    },
  ];
  // #endregion [S4] Morning events

  // #region [S5] Checkpoints
  /*
---------- Checkpoints ----------
Story events that always happen on set days, as that day's morning event
(they replace the random morning event). `days` gives the day for each run
length: { 15: day, 30: day, 45: day }. Use "last" for the final day.

Checkpoints use the same fields as the events above ([S2]), including
flag, needsFlag and needsNote on choices.
*/
  var checkpoints = [
    {
      // Act 1: a reason to hold out.
      title: "The radio wakes",
      days: { 15: 3, 30: 5, 45: 7 },
      art: ["event_radio", "event_generic"],
      text: "Static hisses from the old radio on the shelf, then a voice: 'This is Evacuation Command. A convoy will reach your district in {daysLeft} days. Survivors must signal from a rooftop on the final night. Signal, or we will not stop.' The message loops twice, then fades.",
      sounds: ["radioStatic", "lightSwitch", ["helloWoman", 900]],
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
          sounds: ["rustyMetal", ["radioStatic", 900]],
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
      art: ["event_notebook", "event_house"],
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
      art: ["event_roof", "watchtower"],
      text: "The convoy is {daysLeft} days out. To be seen, you'll need a signal on the roof for the final night. But anything bright enough for the convoy will be bright enough for the dead.",
      sounds: ["wind", "footsteps", ["zombieGroan", 1200]],
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
          sounds: ["radioStatic", "lightSwitch", ["helloWoman", 700]],
        },
        {
          label: "Fire the flare on the last night",
          kind: "cost",
          cost: {},
          needsFlag: "flare", // set by "Save it for the last night" in "A flare gun"
          needsNote: "a flare gun",
          flag: "signal",
          outcome:
            "You took the flare gun down from the shelf. On the last night, you'll fire it straight up.",
          sounds: ["cock"],
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
      art: ["event_last_morning", "defense"],
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
  // #endregion [S5] Checkpoints

  // #region [S6] Endings
  /*
---------- Endings ----------
Checked from top to bottom when a run ends; the first one whose `when`
returns true is shown on the end screen. Keep the last one as a catch-all.
`art` works like it does on events; without a picture, end_win or end_lose
is shown.

`when` gets the run result `r`:
  r.won          true if anyone made it to the end
  r.daysSurvived days survived
  r.length       run length
  r.alive        survivors alive at the end
  r.lost         survivors lost
  r.flags        flags set by event and checkpoint choices, e.g. r.flags.signal
*/
  var endings = [
    {
      title: "The tally stops",
      art: ["end_tally_stops", "end_lose"],
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
      art: ["end_so_close", "end_lose"],
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
      art: ["end_last_mark", "end_win"],
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
      art: ["end_convoy", "end_win"],
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
      art: ["end_full_count", "end_win"],
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
      art: ["end_another_tally", "end_win"],
      when: function () {
        return true;
      },
      paragraphs: [
        "The convoy's lights pass in the distance and don't stop.",
        "{alive} of you are left. Under the tally, the wall holds the names of everyone you lost. In the morning, someone takes out the knife and starts counting again.",
      ],
    },
  ];
  // #endregion [S6] Endings

  // #region [S7] Helpers
  /*
---------- Helpers ----------
Used by game.js and end.js. Nothing to edit here for the story itself.
*/
  // Every event in one list for game.js, each marked with when it happens.
  var events = nightEvents
    .map(function (ev) {
      return Object.assign({ time: "night" }, ev);
    })
    .concat(
      morningEvents.map(function (ev) {
        return Object.assign({ time: "morning" }, ev);
      }),
    );

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
    events: events,
    checkpoints: checkpoints,
    endings: endings,
    checkpointDay: checkpointDay,
    checkpointFor: checkpointFor,
    pickEnding: pickEnding,
    fill: fill,
  };
  // #endregion [S7] Helpers
})();
