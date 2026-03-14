const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const statusLine = document.getElementById("statusLine");
const hintLine = document.getElementById("hintLine");

const TILE = 16;
const MAP_W = 40;
const MAP_H = 22;

const COLORS = {
  grass: "#2b7a3f",
  grass2: "#3b8f4d",
  path: "#a98c5d",
  water: "#2f5da8",
  water2: "#3d77cc",
  tree: "#1a4d2e",
  trunk: "#6a3f1f",
  houseWall: "#8f5b3e",
  houseRoof: "#8a2f2f",
  cave: "#1f1f29",
  uiDark: "#101522",
  uiBox: "#25324d",
  text: "#eff6ff",
  shadow: "rgba(0,0,0,0.35)",
};

const keys = new Set();
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  keys.add(k);
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
    e.preventDefault();
  }
  if (state.mode === "dialog" && (k === " " || k === "enter" || k === "e")) {
    advanceDialog();
  }
  if (state.mode === "battle") {
    if (["1", "2", "3"].includes(k)) handleBattleChoice(Number(k));
  }
  if (state.mode === "world" && (k === "e" || k === " ")) {
    interact();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));

const player = {
  x: 6,
  y: 14,
  px: 6 * TILE,
  py: 14 * TILE,
  hp: 22,
  maxHp: 22,
  atk: 5,
  lvl: 1,
  xp: 0,
  potions: 3,
  hasCrystal: false,
};

const quest = {
  stage: "talkElder", // talkElder -> getCrystal -> returnElder -> complete
};

const npcs = [
  {
    id: "elder",
    x: 12,
    y: 11,
    name: "Elder Rowan",
  },
  {
    id: "smith",
    x: 18,
    y: 12,
    name: "Mira the Smith",
  },
];

const enemies = [
  { name: "Moss Slime", hp: 12, maxHp: 12, atk: 3, xp: 7, color: "#6dd66f" },
  { name: "Cave Bat", hp: 9, maxHp: 9, atk: 4, xp: 8, color: "#a78bfa" },
  { name: "Thorn Wolf", hp: 15, maxHp: 15, atk: 5, xp: 12, color: "#f97316" },
];

const state = {
  mode: "world", // world | dialog | battle | ending
  dialogQueue: [],
  battle: null,
  stepCooldown: 0,
  flicker: 0,
};

const map = Array.from({ length: MAP_H }, () => Array(MAP_W).fill("grass"));

function buildMap() {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) {
        map[y][x] = "tree";
      }
    }
  }

  for (let x = 2; x < 26; x++) map[13][x] = "path";
  for (let y = 8; y < 14; y++) map[y][12] = "path";
  for (let x = 22; x < 34; x++) map[13][x] = "path";

  for (let y = 2; y < 7; y++) {
    for (let x = 3; x < 10; x++) map[y][x] = (x + y) % 2 ? "water" : "water2";
  }

  // village homes
  paintRect(14, 8, 5, 4, "houseWall");
  paintRect(13, 7, 7, 1, "houseRoof");
  paintRect(8, 9, 4, 3, "houseWall");
  paintRect(7, 8, 6, 1, "houseRoof");

  // cave area
  paintRect(31, 8, 6, 6, "cave");

  for (let y = 8; y < 20; y++) {
    for (let x = 27; x < 39; x++) {
      if (map[y][x] === "grass" && Math.random() < 0.28) map[y][x] = "grass2";
    }
  }

  // dense forest blocker
  for (let y = 4; y < 11; y++) {
    map[y][24] = "tree";
    if (y !== 9) map[y][25] = "tree";
  }

  // open pass
  map[9][24] = "path";
  map[9][25] = "path";

  // crystal spot deep in cave
  map[10][34] = "crystal";
}

function paintRect(x0, y0, w, h, tile) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (map[y] && map[y][x]) map[y][x] = tile;
    }
  }
}

function solidTile(tile) {
  return ["tree", "houseWall", "houseRoof", "water", "water2"].includes(tile);
}

function tileAt(x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return "tree";
  return map[y][x];
}

function interact() {
  for (const npc of npcs) {
    if (Math.abs(npc.x - player.x) + Math.abs(npc.y - player.y) === 1) {
      startNpcDialog(npc.id);
      return;
    }
  }

  if (player.x >= 31 && player.x <= 36 && player.y >= 8 && player.y <= 13 && !player.hasCrystal) {
    status("A chill wind whispers from the cave...");
  }
}

function startNpcDialog(id) {
  const lines = [];
  if (id === "elder") {
    if (quest.stage === "talkElder") {
      lines.push(
        "Elder Rowan: Traveler, a star fell beyond the cave.",
        "Monsters woke up and our fields are cursed.",
        "Bring back the Star Crystal from the cave altar."
      );
      quest.stage = "getCrystal";
      hint("Find the cave to the east. Retrieve the Star Crystal.");
    } else if (quest.stage === "getCrystal") {
      lines.push("Elder Rowan: The crystal's light can calm this land. Please hurry.");
    } else if (quest.stage === "returnElder") {
      lines.push(
        "Elder Rowan: You returned! The Star Crystal still shines...",
        "The village is saved. You are now our Starlight Warden."
      );
      quest.stage = "complete";
      state.mode = "ending";
      hint("Quest complete. You can still roam and battle.");
    } else {
      lines.push("Elder Rowan: Peace has returned. Thank you, Warden.");
    }
  }

  if (id === "smith") {
    if (player.potions < 5) {
      player.potions += 1;
      lines.push("Mira: You look beat up. Take a potion on the house.");
      status("Received 1 potion.");
    } else {
      lines.push("Mira: Keep your blade sharp and your hope sharper.");
    }
  }

  openDialog(lines);
}

function openDialog(lines) {
  state.mode = "dialog";
  state.dialogQueue = [...lines];
  status(state.dialogQueue[0] || "...");
}

function advanceDialog() {
  state.dialogQueue.shift();
  if (state.dialogQueue.length === 0) {
    state.mode = quest.stage === "complete" ? "ending" : "world";
    status("Back to adventure.");
    return;
  }
  status(state.dialogQueue[0]);
}

function status(text) {
  statusLine.textContent = text;
}

function hint(text) {
  hintLine.textContent = text;
}

function maybeEncounter() {
  const t = tileAt(player.x, player.y);
  if (!["grass2", "cave"].includes(t)) return;
  const chance = t === "cave" ? 0.04 : 0.018;
  if (Math.random() < chance) startBattle();
}

function startBattle() {
  const base = enemies[(Math.random() * enemies.length) | 0];
  state.mode = "battle";
  state.battle = {
    enemy: { ...base },
    msg: `A wild ${base.name} appears!`,
    awaitingInput: true,
  };
  status(state.battle.msg);
  hint("Battle: [1] Attack  [2] Star Skill  [3] Potion");
}

function handleBattleChoice(choice) {
  const b = state.battle;
  if (!b || !b.awaitingInput) return;

  if (choice === 1) {
    const dmg = rand(player.atk - 1, player.atk + 2);
    b.enemy.hp -= dmg;
    b.msg = `You slash ${b.enemy.name} for ${dmg} damage!`;
  } else if (choice === 2) {
    const dmg = rand(player.atk + 1, player.atk + 5);
    b.enemy.hp -= dmg;
    b.msg = `Star Burst hits ${b.enemy.name} for ${dmg}!`;
  } else if (choice === 3) {
    if (player.potions > 0) {
      player.potions -= 1;
      const heal = rand(7, 12);
      player.hp = Math.min(player.maxHp, player.hp + heal);
      b.msg = `You drink a potion and recover ${heal} HP.`;
    } else {
      b.msg = "No potions left!";
    }
  }

  if (b.enemy.hp <= 0) {
    const gain = b.enemy.xp;
    player.xp += gain;
    b.msg += ` ${b.enemy.name} is defeated! +${gain} XP.`;
    status(b.msg);
    levelCheck();
    setTimeout(endBattle, 550);
    return;
  }

  const retaliation = Math.max(1, rand(b.enemy.atk - 1, b.enemy.atk + 1));
  player.hp -= retaliation;
  b.msg += ` ${b.enemy.name} strikes back for ${retaliation}!`;
  status(b.msg);

  if (player.hp <= 0) {
    player.hp = player.maxHp;
    player.x = 6;
    player.y = 14;
    player.px = player.x * TILE;
    player.py = player.y * TILE;
    player.potions = Math.max(player.potions, 1);
    b.msg = "You collapse... and awaken in the village shrine.";
    status(b.msg);
    setTimeout(endBattle, 700);
    return;
  }

  b.awaitingInput = true;
}

function levelCheck() {
  const needed = player.lvl * 20;
  if (player.xp >= needed) {
    player.xp -= needed;
    player.lvl += 1;
    player.maxHp += 4;
    player.hp = player.maxHp;
    player.atk += 1;
    status(`Level up! You are now level ${player.lvl}.`);
  }
}

function endBattle() {
  state.mode = quest.stage === "complete" ? "ending" : "world";
  state.battle = null;
  hint(quest.stage === "getCrystal" ? "Find the cave and claim the Star Crystal." : "Talk to villagers and explore.");
}

function pickCrystalIfPresent() {
  if (tileAt(player.x, player.y) === "crystal" && !player.hasCrystal) {
    player.hasCrystal = true;
    map[player.y][player.x] = "cave";
    quest.stage = "returnElder";
    openDialog([
      "You found the Star Crystal!",
      "Its warmth pushes the darkness away.",
      "Return to Elder Rowan in the village."
    ]);
    hint("Bring the Star Crystal back to Elder Rowan.");
  }
}

function rand(a, b) {
  return ((Math.random() * (b - a + 1)) | 0) + a;
}

function update() {
  state.flicker += 0.08;
  if (state.mode === "world" || state.mode === "ending") {
    let dx = 0;
    let dy = 0;
    if (keys.has("w") || keys.has("arrowup")) dy = -1;
    if (keys.has("s") || keys.has("arrowdown")) dy = 1;
    if (keys.has("a") || keys.has("arrowleft")) dx = -1;
    if (keys.has("d") || keys.has("arrowright")) dx = 1;

    if (state.stepCooldown > 0) {
      state.stepCooldown--;
    } else if (dx !== 0 || dy !== 0) {
      const nx = player.x + dx;
      const ny = player.y + dy;
      if (!solidTile(tileAt(nx, ny))) {
        player.x = nx;
        player.y = ny;
        player.px = player.x * TILE;
        player.py = player.y * TILE;
        maybeEncounter();
        pickCrystalIfPresent();
      }
      state.stepCooldown = 5;
    }
  }
}

function drawTile(x, y, t) {
  const px = x * TILE;
  const py = y * TILE;

  if (t === "grass" || t === "grass2") {
    ctx.fillStyle = t === "grass" ? COLORS.grass : COLORS.grass2;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = "#1f6a35";
    ctx.fillRect(px + 3, py + 4, 2, 2);
    ctx.fillRect(px + 9, py + 10, 2, 2);
  } else if (t === "path") {
    ctx.fillStyle = COLORS.path;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = "#9b7c4f";
    ctx.fillRect(px + 4, py + 5, 2, 2);
    ctx.fillRect(px + 10, py + 9, 2, 2);
  } else if (t === "water" || t === "water2") {
    ctx.fillStyle = t === "water" ? COLORS.water : COLORS.water2;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(px + ((Date.now() / 120 + y + x) % 8), py + 4, 4, 2);
  } else if (t === "tree") {
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = COLORS.tree;
    ctx.fillRect(px + 1, py + 1, 14, 10);
    ctx.fillStyle = COLORS.trunk;
    ctx.fillRect(px + 6, py + 10, 4, 6);
  } else if (t === "houseWall") {
    ctx.fillStyle = COLORS.houseWall;
    ctx.fillRect(px, py, TILE, TILE);
  } else if (t === "houseRoof") {
    ctx.fillStyle = COLORS.houseRoof;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = "#6f1f1f";
    ctx.fillRect(px, py + 8, TILE, 2);
  } else if (t === "cave") {
    ctx.fillStyle = COLORS.cave;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = "#333348";
    ctx.fillRect(px + 2, py + 2, 3, 3);
  } else if (t === "crystal") {
    ctx.fillStyle = COLORS.cave;
    ctx.fillRect(px, py, TILE, TILE);
    const glow = 90 + Math.sin(state.flicker) * 40;
    ctx.fillStyle = `rgb(${glow}, ${glow + 60}, 255)`;
    ctx.fillRect(px + 6, py + 3, 4, 10);
    ctx.fillRect(px + 4, py + 6, 8, 4);
  }
}

function drawCharacter(x, y, mainColor, accent = "#fff") {
  ctx.fillStyle = mainColor;
  ctx.fillRect(x + 4, y + 3, 8, 10);
  ctx.fillStyle = accent;
  ctx.fillRect(x + 6, y + 5, 1, 1);
  ctx.fillRect(x + 9, y + 5, 1, 1);
  ctx.fillStyle = "#2c1c16";
  ctx.fillRect(x + 6, y + 10, 1, 3);
  ctx.fillRect(x + 9, y + 10, 1, 3);
}

function drawWorld() {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) drawTile(x, y, map[y][x]);
  }

  // npc draw
  for (const npc of npcs) {
    const c = npc.id === "elder" ? "#d6b37a" : "#c084fc";
    drawCharacter(npc.x * TILE, npc.y * TILE, c, "#111");
  }

  drawCharacter(player.px, player.py, "#5ab1ff", "#111");

  drawUI();

  if (state.mode === "ending") {
    drawBanner("THE STARLIGHT RETURNS", "You saved Oakvale. Keep exploring!");
  }
}

function drawBanner(title, subtitle) {
  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(90, 80, 460, 120);
  ctx.strokeStyle = "#ffd166";
  ctx.lineWidth = 3;
  ctx.strokeRect(90, 80, 460, 120);
  text(title, 120, 122, "#ffd166", 3);
  text(subtitle, 120, 160, "#ffffff", 2);
}

function drawBattle() {
  ctx.fillStyle = "#1d2238";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#2d3556";
  ctx.fillRect(0, 0, canvas.width, 220);

  // floor
  ctx.fillStyle = "#3b4a73";
  ctx.fillRect(0, 220, canvas.width, 140);

  drawCharacter(100, 190, "#5ab1ff", "#111");

  // enemy
  const b = state.battle;
  const ex = 430;
  const ey = 120;
  ctx.fillStyle = b.enemy.color;
  ctx.fillRect(ex, ey, 56, 40);
  ctx.fillStyle = "#111";
  ctx.fillRect(ex + 12, ey + 10, 6, 6);
  ctx.fillRect(ex + 36, ey + 10, 6, 6);

  // hp bars
  bar(40, 26, 220, 16, player.hp / player.maxHp, "#4ade80", "HP");
  bar(378, 26, 220, 16, Math.max(0, b.enemy.hp) / b.enemy.maxHp, "#fb7185", b.enemy.name);

  drawUI();

  text("1.Attack  2.Star Skill  3.Potion", 20, 316, COLORS.text, 2);
  text(b.msg, 20, 338, "#dbeafe", 2);
}

function bar(x, y, w, h, ratio, color, label) {
  ctx.fillStyle = "#111827";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x + 2, y + 2, Math.max(2, (w - 4) * Math.max(0, Math.min(1, ratio))), h - 4);
  text(label, x, y - 6, "#fff", 1);
}

function text(str, x, y, color = COLORS.text, size = 2) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${size * 8}px Courier New`;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function drawUI() {
  ctx.fillStyle = COLORS.uiDark;
  ctx.fillRect(0, 320, canvas.width, 40);
  ctx.fillStyle = COLORS.uiBox;
  ctx.fillRect(4, 324, canvas.width - 8, 32);

  const questText = {
    talkElder: "Quest: Speak with Elder Rowan",
    getCrystal: "Quest: Retrieve the Star Crystal",
    returnElder: "Quest: Return to Elder Rowan",
    complete: "Quest: Hero of Oakvale",
  }[quest.stage];

  text(`HP ${player.hp}/${player.maxHp}  LV ${player.lvl}  XP ${player.xp}  Potions ${player.potions}`, 12, 339);
  text(questText, 12, 352, "#ffd166", 1);
}

function render() {
  if (state.mode === "battle") {
    drawBattle();
  } else {
    drawWorld();
  }
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

buildMap();
status("Welcome to Oakvale. The wind carries stardust tonight.");
hint("Find Elder Rowan in the village center.");
loop();
