// ════════════════════════════════════════════════════════════════════════
//  Библиотека Орудий Техники (Warhammer DBC) — компендиум «vehicle-weapons».
//  Профили машинных орудий из DoomBC_Machines.pdf. Предметы type="weapon"
//  с блоком vehicleMount (isMounted:true) — тянутся на лист техники.
//
//  Свойства (props-строка) парсятся в СТРУКТУРНЫЕ system.weaponProps
//  [{key,rating}] по реестру свойств оружия; нечисловые рейтинги (1d5, R)
//  и памятки уходят в system.special. Билдер идемпотентен.
//
//  Наполняется батчами по мере переноса каталога. Батч 1 — общие имперские
//  орудия (папка «Общие»), покрывающие большинство машин.
// ════════════════════════════════════════════════════════════════════════

const IMG = "systems/warhammer-dbc/assets/actor-icons/vehicle.svg";

// Имя свойства (как в справочнике) → ключ реестра weaponProps.
const PKEY = {
  "Reliable": "reliable", "Very Reliable": "veryReliable", "Unreliable": "unreliable",
  "Twin-Linked": "twinLinked", "Twin–Linked": "twinLinked", "Tearing": "tearing",
  "Flame": "flame", "Spray": "spray", "Linger": "linger", "Storm": "storm",
  "Proven": "proven", "Blast": "blast", "Maximal": "maximal", "Overheats": "overheats",
  "Melta": "melta", "Concussive": "concussive", "Ordnance": "ordnance", "Wrecker": "wrecker",
  "Accurate": "accurate", "Imprecise": "imprecise", "Inaccurate": "inaccurate",
  "Devastating": "devastating", "Razor Sharp": "razorSharp", "Hefty": "hefty",
  "Recoil": "recoil", "Snare": "snare", "Piercing": "piercing", "Anti-Air": "antiAir",
  "Anti–Air": "antiAir", "Rad": "rad", "Graviton": "grav", "Grav": "grav", "Haywire": "haywire",
  "Felling": "felling", "Lance": "lance", "Scatter": "scatter", "Crippling": "crippling",
  "Toxic": "toxic", "Corrosive": "corrosive", "Shocking": "shocking", "Sanctified": "sanctified",
  "Warp Weapon": "warpWeapon", "Force": "force", "Deflagrate": "deflagrate",
  "Arcing": "arcing", "Quad": "quad", "Multi-strike": "multiStrike", "Multi-Strike": "multiStrike",
  "Power Field": "powerField", "Flexible": "flexible", "Crunch": "crunch", "Reinforced": "reinforced",
  "Recharge": "recharge", "Extreme": "extreme", "Flush": "flush", "Contained": "contained",
  "Arc": "arc", "Blinding": "blinding", "Smoke": "smoke",
  "Eldar Razor Sharp": "eldarRazorSharp", "Eldar Precise": "eldarPrecise", "Eldar Accurate": "eldarAccurate",
  "Monofilament": "monofilament"
};

const rofParse = (s) => {
  const part = x => { x = (x || "").trim();
    if (x === "S") return 1;
    if (x === "" || x === "–" || x === "-") return 0;
    return parseInt(x) || 0; };
  const [a, b, c] = String(s || "").split("/");
  return { rof_single: part(a), rof_semi: part(b), rof_full: part(c) };
};
const dmgFormula = (d) => {
  if (!d) return "";
  const m = String(d).match(/^\d+d\d+(?:[+\-]\d+)*|^\d+/);
  return m ? m[0] : "";
};
const dtParse = (dmg) => {
  if (/\bR\b/.test(dmg)) return "rending";
  if (/\bC\b/.test(dmg)) return "chemical";
  if (/\bX\b/.test(dmg)) return "blast";
  if (/\bE/.test(dmg))   return "energy";
  if (/\bI/.test(dmg))   return "impact";
  return "impact";
};

// props-строка «Name (N), Name2, Name3 (1d5)» → {weaponProps, notes}
function parseProps(str) {
  const weaponProps = [], notes = [];
  if (!str) return { weaponProps, notes };
  for (let raw of String(str).split(",")) {
    raw = raw.trim(); if (!raw) continue;
    const m = raw.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    const name = (m ? m[1] : raw).trim();
    const rating = m ? m[2].trim() : null;
    const key = PKEY[name];
    if (!key) { notes.push(raw); continue; }               // незнакомое → памятка
    if (rating == null) { weaponProps.push({ key }); continue; }
    const num = /^-?\d+$/.test(rating) ? parseInt(rating) : null;
    if (num != null) weaponProps.push({ key, rating: num });
    else { weaponProps.push({ key }); notes.push(`${name} (${rating})`); }  // dice/букв. рейтинг
  }
  return { weaponProps, notes };
}

// Клип: число | "1/40" (заряжено/запас) | "∞" | "" → {mag, note}
function clipParse(c) {
  const s = String(c ?? "").trim();
  if (s === "" ) return { mag: 0, note: "" };
  if (s === "∞") return { mag: 0, note: "Боезапас: ∞ (энергия/подача)" };
  if (s.includes("/")) {
    const [a, b] = s.split("/").map(x => x.trim());
    return { mag: parseInt(a) || 0, note: b ? `Боезапас в укладке: ${b}` : "" };
  }
  return { mag: parseInt(s) || 0, note: "" };
}

// Билдер орудия техники. o: {r,cls,type,rng,rof,dmg,pen,clip,rld,props,note,wt}
function VW(folder, name, o) {
  const { weaponProps, notes } = parseProps(o.props || "");
  const clip = clipParse(o.clip);
  if (clip.note) notes.push(clip.note);
  if (o.note)    notes.push(o.note);
  return {
    name, type: "weapon", img: IMG, folder,
    system: {
      weaponClass: o.cls || "heavy",
      weaponType:  o.type || "solid",
      range:       o.rng ?? 0,
      ...rofParse(o.rof || ""),
      damage:      dmgFormula(o.dmg || ""),
      damageType:  dtParse(o.dmg || ""),
      penetration: o.pen ?? 0,
      magazineCur: clip.mag, magazineMax: clip.mag,
      reload:      o.rld || "",
      quality:     "common",
      availability: o.r ?? 0,
      weight:      o.wt ?? 0,
      special:     notes.join(". "),
      weaponProps,
      attackBonus: 0, balance: 0,
      vehicleMount: { isMounted: true, mount: o.mount || "turret", reloads: 10 }
    }
  };
}

const COMMON = ["Общие"];
const MECH   = ["Механикус"];
const DRU    = ["Друкхари"];
const LEGION = ["Легионы"];
const DREAD  = ["Дредноуты"];
const CHAOS  = ["Хаос"];
const AIR    = ["Зенитное и авиация"];
const ARTY   = ["Артиллерия"];

export const VEHICLE_WEAPONS = [
  // ─────────────── Стаб / авто ───────────────
  VW(COMMON, "Heavy Stubber / Тяжёлый Стаббер", { r:0, type:"solid", rng:240, rof:"S/–/12", dmg:"1d10+8 I", pen:3, clip:200, rld:"2", props:"" }),
  VW(COMMON, "Twin Heavy Stubber / Спаренный Тяжёлый Стаббер", { r:1, type:"solid", rng:240, rof:"S/–/12", dmg:"1d10+8 I", pen:3, clip:400, rld:"2", props:"Twin-Linked" }),
  VW(COMMON, "Autocannon / Автопушка", { r:2, type:"solid", rng:600, rof:"S/3/–", dmg:"3d10+8 I", pen:6, clip:20, rld:"2", props:"Reliable" }),
  VW(COMMON, "Twin Autocannon / Спаренная Автопушка", { r:1, type:"solid", rng:600, rof:"S/3/–", dmg:"3d10+8 I", pen:6, clip:40, rld:"2", props:"Reliable, Twin-Linked" }),
  VW(COMMON, "Reaper Autocannon / Автопушка Жнец", { r:2, type:"solid", rng:400, rof:"S/4/–", dmg:"3d10+8 I", pen:6, clip:200, rld:"2", props:"Hefty (R), Reliable, Twin-Linked" }),
  VW(COMMON, "Assault Cannon / Штурмовая Пушка", { r:3, type:"solid", rng:240, rof:"–/–/6", dmg:"2d10+6 X", pen:4, clip:400, rld:"1", props:"Razor Sharp, Storm (2), Tearing" }),
  VW(COMMON, "Twin Assault Cannon / Спаренная Штурмовая Пушка", { r:3, type:"solid", rng:240, rof:"–/–/6", dmg:"2d10+6 X", pen:4, clip:400, rld:"1", props:"Razor Sharp, Storm (2), Tearing, Twin-Linked" }),
  VW(COMMON, "Punisher Gatling Cannon / Гатлинг-Пушка Каратель", { r:3, type:"solid", rng:300, rof:"–/–/5", dmg:"2d10+4 I", pen:4, clip:400, rld:"3", props:"Storm (4)", note:"Цели длинной очереди и все в 5 м от них подавляются (см. справочник)." }),

  // ─────────────── Болтерное ───────────────
  VW(COMMON, "Bolter / Болтер", { r:1, type:"bolt", rng:200, rof:"S/3/–", dmg:"1d10+9 X", pen:4, clip:60, rld:"2", props:"Tearing" }),
  VW(COMMON, "Combi-Bolter / Комби-Болтер", { r:1, type:"bolt", rng:200, rof:"S/3/–", dmg:"1d10+9 X", pen:4, clip:60, rld:"2", props:"Tearing, Twin-Linked" }),
  VW(COMMON, "Storm Bolter / Шторм-Болтер", { r:2, type:"bolt", rng:160, rof:"S/3/6", dmg:"1d10+9 X", pen:4, clip:60, rld:"2", props:"Storm (2), Tearing" }),
  VW(COMMON, "Heavy Bolter / Тяжёлый Болтер", { r:2, type:"bolt", rng:300, rof:"S/4/8", dmg:"2d10+8 X", pen:5, clip:160, rld:"1", props:"Tearing" }),
  VW(COMMON, "Twin Heavy Bolter / Спаренный Тяжёлый Болтер", { r:2, type:"bolt", rng:300, rof:"S/4/8", dmg:"2d10+8 X", pen:5, clip:320, rld:"1", props:"Tearing, Twin-Linked" }),
  VW(COMMON, "Vulcan Megabolter / Мегаболтер Вулкан", { r:4, type:"bolt", rng:700, rof:"–/–/10", dmg:"2d10+10 X", pen:7, clip:1200, rld:"4", props:"Devastating (3), Imprecise, Inaccurate, Storm (3), Tearing, Twin-Linked" }),

  // ─────────────── Огнемёты ───────────────
  VW(COMMON, "Heavy Flamer / Тяжёлый Огнемёт", { r:0, type:"flame", rng:60, rof:"S/–/–", dmg:"1d10+12 E(Fl)", pen:6, clip:15, rld:"2", props:"Flame, Spray, Linger (1d5)" }),
  VW(COMMON, "Twin Heavy Flamer / Спаренный Тяжёлый Огнемёт", { r:0, type:"flame", rng:60, rof:"S/–/–", dmg:"1d10+12 E(Fl)", pen:6, clip:15, rld:"2", props:"Flame, Spray, Linger (1d5), Twin-Linked" }),

  // ─────────────── Лазер / мультилазер ───────────────
  VW(COMMON, "Multilaser / Мультилазер", { r:1, type:"laser", rng:300, rof:"–/–/5", dmg:"2d10+10 E(Ls)", pen:2, clip:"∞", rld:"–", props:"Reliable" }),
  VW(COMMON, "Twin Multilaser / Спаренный Мультилазер", { r:2, type:"laser", rng:300, rof:"–/–/5", dmg:"2d10+10 E(Ls)", pen:2, clip:"∞", rld:"–", props:"Reliable, Twin-Linked" }),
  VW(COMMON, "Lascannon / Лазпушка", { r:3, type:"laser", rng:600, rof:"S/–/–", dmg:"5d10+10 E(Ls)", pen:10, clip:5, rld:"2", props:"Proven (3)" }),
  VW(COMMON, "Twin Lascannon / Спаренная Лазпушка", { r:3, type:"laser", rng:600, rof:"S/–/–", dmg:"5d10+10 E(Ls)", pen:10, clip:"∞", rld:"–", props:"Proven (3), Twin-Linked" }),

  // ─────────────── Плазма / мельта ───────────────
  VW(COMMON, "Plasma Cannon / Плазменная Пушка", { r:3, type:"plasma", rng:300, rof:"S/–/–", dmg:"2d10+12 E", pen:10, clip:16, rld:"2", props:"Blast (3), Maximal, Overheats" }),
  VW(COMMON, "Meltagun / Мельтаган", { r:2, type:"melta", rng:30, rof:"S/–/–", dmg:"2d10+13 E", pen:15, clip:36, rld:"2", props:"Melta" }),
  VW(COMMON, "Multimelta / Мультимельта", { r:3, type:"melta", rng:120, rof:"S/–/–", dmg:"2d10+16 E", pen:15, clip:12, rld:"2", props:"Blast (2), Melta" }),
  VW(COMMON, "Twin Multimelta / Спаренная Мультимельта", { r:3, type:"melta", rng:120, rof:"S/–/–", dmg:"2d10+16 E", pen:15, clip:50, rld:"2", props:"Blast (2), Melta, Twin-Linked" }),

  // ─────────────── Танковые пушки ───────────────
  VW(COMMON, "Battle Cannon / Боевая Пушка", { r:2, type:"solid", rng:1200, rof:"S/–/–", dmg:"3d10+10 X", pen:8, clip:"1/40", rld:"3", props:"Concussive (3), Blast (8), Ordnance, Reliable" }),
  VW(COMMON, "Vanquisher Battle Cannon / Боевая Пушка Покоритель", { r:4, type:"solid", rng:2000, rof:"S/–/–", dmg:"3d10+10 X", pen:16, clip:"1/28", rld:"2", props:"Accurate, Concussive (1), Imprecise, Ordnance, Proven (4)", note:"По цели Размера 2+ можно Избирательно (−20): ½ поглощения после Pen и др. бонусы (см. справочник)." }),
  VW(COMMON, "Demolisher Cannon / Пушка Разрушитель", { r:2, type:"solid", rng:100, rof:"S/–/–", dmg:"4d10+20 X", pen:10, clip:"1/25", rld:"3", props:"Concussive (3), Blast (10), Ordnance, Wrecker (3)" }),

  // ─────────────── Ракетное ───────────────
  VW(COMMON, "Missile Launcher / Ракетная Установка", { r:1, type:"launcher", rng:600, rof:"S/–/–", dmg:"", pen:0, clip:7, rld:"1×7", props:"Reliable", note:"Использует ракеты (крак/фраг и т.п.) — профиль по типу ракеты." }),
  VW(COMMON, "Havoc Launcher / Гранатомёт Хавок", { r:1, type:"launcher", rng:200, rof:"S/2/6", dmg:"", pen:0, clip:"∞", rld:"–", props:"Imprecise, Reliable", note:"Использует ракеты — профиль по типу ракеты." }),
  VW(COMMON, "Hunter-Killer Missile / Ракета Охотник-Убийца", { r:2, type:"launcher", rng:0, rof:"S/–/–", dmg:"", pen:0, clip:1, rld:"10", mount:"pintle",
    props:"", note:"Одноразовая самонаводящаяся крак-ракета: свободным действием навести на цель в обзоре, стреляет сама с BS 35, бьёт сверху (крыша). Перезарядка 10 Ходов только снаружи." }),
  VW(COMMON, "Twin Plasma Cannon / Спаренная Плазменная Пушка", { r:3, type:"plasma", rng:300, rof:"S/–/–", dmg:"2d10+12 E", pen:10, clip:60, rld:"2", props:"Blast (3), Maximal, Overheats, Twin-Linked" }),
  VW(COMMON, "Quad Heavy Bolter / Счетверённый Тяжёлый Болтер", { r:2, type:"bolt", rng:300, rof:"S/4/8", dmg:"2d10+8 X", pen:5, clip:600, rld:"4", props:"Quad, Tearing" }),
  VW(COMMON, "Quad Heavy Stubber / Счетверённый Тяжёлый Стаббер", { r:0, type:"solid", rng:240, rof:"S/–/10", dmg:"1d10+8 I", pen:3, clip:800, rld:"4", props:"Quad" }),
  VW(COMMON, "Quad Multilaser / Счетверённый Мультилазер", { r:1, type:"laser", rng:300, rof:"–/–/5", dmg:"2d10+10 E(Ls)", pen:2, clip:400, rld:"4", props:"Quad, Reliable" }),
  VW(COMMON, "Frag Launchers / Фраг-Установки", { r:3, type:"launcher", rng:30, rof:"–/–/6", dmg:"2d10+2 X(Fr)", pen:0, clip:12, rld:"–", props:"Blast (4), Tearing, Twin-Linked", note:"Все в 3 м от шаблонов — тест Подавления −10 даже при успешном Избегании." }),

  // ═══════════════ МЕХАНИКУС (Cognis) ═══════════════
  VW(MECH, "Twin Cognis Autocannon / Спаренная Когнис-Автопушка", { r:2, type:"solid", rng:600, rof:"S/3/–", dmg:"3d10+8 I", pen:6, clip:200, rld:"2", props:"Anti-Air, Reliable, Twin-Linked", note:"Cognis: переброс промаха при неподвижности стрелка." }),
  VW(MECH, "Twin Cognis Lascannon / Спаренная Когнис-Лазпушка", { r:3, type:"laser", rng:600, rof:"S/–/–", dmg:"5d10+10 E(Ls)", pen:10, clip:30, rld:"2", props:"Anti-Air, Proven (3), Twin-Linked", note:"Cognis: переброс промаха при неподвижности стрелка." }),
  VW(MECH, "Mauler Bolt Cannon / Болт-Пушка Дробитель", { r:3, type:"bolt", rng:200, rof:"S/4/8", dmg:"2d10+10 X", pen:7, clip:200, rld:"1", props:"Tearing", note:"Cognis." }),
  VW(MECH, "Graviton Cannon / Гравитонная Пушка", { r:4, type:"exotic", rng:120, rof:"S/–/–", dmg:"2d10+4 I(Cr)", pen:0, clip:12, rld:"4", props:"Concussive (3), Blast (7), Graviton, Linger (7), Haywire (7)" }),
  VW(MECH, "Taser Lance / Тазерная Пика", { r:2, cls:"melee", type:"shock", rng:0, rof:"–/–/–", dmg:"2d10+6 E(El)", pen:0, clip:0, rld:"–", props:"Arc (6), Contained, Shocking", note:"Копьё, досягаемость 5–7. Arc 6/2d10+6 (цепной разряд)." }),
  VW(MECH, "Radium Jezzail / Радиевая Джизель", { r:3, type:"exotic", rng:600, rof:"S/–/–", dmg:"1d10+8 E", pen:4, clip:16, rld:"2", props:"Rad", note:"Радиевое снайперское оружие Скитариев." }),
  VW(MECH, "Eradication Ray / Искореняющий Излучатель", { r:2, type:"exotic", rng:60, rof:"S/–/–", dmg:"1d10+4 E", pen:3, clip:5, rld:"2", props:"Spray", note:"Cognis. На 10–20 м +1d10 Dmg/+3 Pen; до 10 м +2d10 Dmg/+6 Pen." }),
  VW(MECH, "Twin Heavy Phosphor Blaster / Спаренный Тяжёлый Фосфорный Бластер", { r:3, type:"exotic", rng:300, rof:"–/–/6", dmg:"2d10+7 E(Fl)", pen:5, clip:240, rld:"2", props:"Blinding (0), Devastating (2), Imprecise, Twin-Linked", note:"Cognis, Flame (2d10). По подожжённым фосфором целям — ×2 бонус попадания от Коротких Команд." }),
  VW(MECH, "Twin Mauler Bolt Cannon / Спаренная Болт-Пушка Дробитель", { r:3, type:"bolt", rng:200, rof:"S/4/8", dmg:"2d10+10 X", pen:7, clip:400, rld:"1", props:"Tearing, Twin-Linked", note:"Cognis." }),
  VW(MECH, "Disruptor Missile Launcher / Ракетная Установка Подрыватель", { r:2, type:"launcher", rng:600, rof:"S/–/–", dmg:"3d10+6 X", pen:4, clip:6, rld:"–", props:"Blast (6)" }),
  VW(MECH, "Ferrumite Cannon / Феррумитовая Пушка", { r:2, type:"solid", rng:600, rof:"S/3/–", dmg:"2d10+14 I", pen:8, clip:30, rld:"2", props:"Reliable, Imprecise", note:"Cognis." }),
  VW(MECH, "Beleros Energy Cannon / Энергетическая Пушка Белерос", { r:3, type:"exotic", rng:400, rof:"S/–/–", dmg:"2d10+4 E", pen:2, clip:6, rld:"2", props:"Arcing, Blast (12)", note:"Cognis." }),
  VW(MECH, "Karachnos Missile Battery / Ракетная Батарея Карахнос", { r:3, type:"launcher", rng:1000, rof:"S/3/–", dmg:"2d10+3 X(Fr)", pen:2, clip:30, rld:"1", props:"Arcing, Blast (5), Flush, Tearing, Toxic (4)", note:"Cognis, Rad (1d10). Расход БК ×5. Шаблоны держатся 1d5+1 раундов (Rad-зона)." }),
  VW(MECH, "Lightning Blaster / Молниевый Бластер", { r:3, type:"shock", rng:150, rof:"S/3/6", dmg:"3d10+6 E(El)", pen:8, clip:"∞", rld:"–", props:"Arc (7), Shocking", note:"Cognis. Arc 7/2d10." }),
  VW(MECH, "Lightning Cannon / Молниевая Пушка", { r:3, type:"shock", rng:600, rof:"S/–/–", dmg:"3d10+6 E(El)", pen:8, clip:"∞", rld:"–", props:"Blast (10), Shocking", note:"Cognis." }),
  VW(MECH, "Pulsar Fusil / Пульсарная Фузея", { r:4, type:"exotic", rng:400, rof:"–/–/4", dmg:"5d10+10 E", pen:10, clip:"∞", rld:"–", props:"Proven (4)", note:"Cognis." }),
  VW(MECH, "Twin Rad Cleanser / Спаренный Рад-Очиститель", { r:2, type:"exotic", rng:60, rof:"S/–/–", dmg:"2d10+2 E", pen:10, clip:"∞", rld:"–", props:"Felling (2), Spray, Twin-Linked", note:"Cognis, Rad (1d10). Выстрел Незримый, если цель не засекает радиацию." }),

  // ═══════════════ ЛЕГИОНЫ (Волькит/Лучевики) ═══════════════
  VW(LEGION, "Predator Autocannon / Автопушка Хищник", { r:2, type:"solid", rng:600, rof:"S/2/5", dmg:"4d10+5 X", pen:6, clip:40, rld:"2", props:"Reliable" }),
  VW(LEGION, "Volkite Charger / Волькитовый Разрядник", { r:3, type:"exotic", rng:150, rof:"S/3/–", dmg:"2d10+6 E(Ls)", pen:4, clip:"∞", rld:"–", props:"Deflagrate (4)", note:"Cognis." }),
  VW(LEGION, "Volkite Culverin / Волькитовая Кулеврина", { r:4, type:"exotic", rng:300, rof:"–/–/10", dmg:"3d10+3 E(Ls)", pen:4, clip:600, rld:"2", props:"Deflagrate (5)" }),
  VW(LEGION, "Twin Volkite Culverin / Спаренная Волькитовая Кулеврина", { r:4, type:"exotic", rng:150, rof:"–/–/10", dmg:"3d10+3 E(Ls)", pen:4, clip:"∞", rld:"–", props:"Deflagrate (5), Twin-Linked" }),
  VW(LEGION, "Twin Volkite Caliver / Спаренный Волькитовый Каливер", { r:4, type:"exotic", rng:100, rof:"–/–/5", dmg:"3d10+3 E(Ls)", pen:4, clip:"∞", rld:"–", props:"Deflagrate (5), Twin-Linked" }),
  VW(LEGION, "Rapier Laser Array / Лазерный Комплекс Рапира", { r:3, type:"laser", rng:400, rof:"S/–/–", dmg:"6d10+10 E(Ls)", pen:12, clip:20, rld:"4", props:"Ordnance, Proven (3), Twin-Linked" }),
  VW(LEGION, "Quad Lascannon / Счетверённая Лазпушка", { r:3, type:"laser", rng:600, rof:"S/–/–", dmg:"5d10+10 E(Ls)", pen:10, clip:"∞", rld:"–", props:"Quad, Proven (3)" }),
  VW(LEGION, "Neutron Laser / Нейтронный Лазер", { r:5, type:"laser", rng:1000, rof:"S/–/–", dmg:"6d10+20 E(Ls)", pen:14, clip:"∞", rld:"–", props:"Concussive (4), Imprecise, Ordnance, Proven (3)", note:"Получивший непоглощённый урон получает −30 на все атаки на 1 Раунд." }),
  VW(LEGION, "Heavy Conversion Beamer / Тяжёлый Конверсионный Лучевик", { r:5, type:"exotic", rng:1200, rof:"S/–/–", dmg:"2d10+10 E", pen:2, clip:5, rld:"3", props:"Blast (5)", note:"Урон/Проб. растут с дистанцией до цели (конверсионный луч — см. справочник)." }),

  // ═══════════════ ДРЕДНОУТЫ (ближний бой / спец.) ═══════════════
  VW(DREAD, "Power Scourge / Силовая Плеть", { r:2, cls:"melee", type:"power", rng:0, rof:"–/–/–", dmg:"2d10+14 E", pen:4, clip:0, rld:"–", props:"Devastating (2), Flexible, Multi-strike (3), Power Field", note:"Досягаемость 1–9 (кнут)." }),
  VW(DREAD, "Seismic Hammer / Сейсмический Молот", { r:3, cls:"melee", type:"power", rng:0, rof:"–/–/–", dmg:"2d10+25 I(Cr)", pen:5, clip:0, rld:"–", props:"Concussive (6), Imprecise, Reinforced", note:"Досягаемость 0–3. Оглушение даёт −30 на Iron Jaw; непоглощ. урон по не-сверхтяжёлой машине — доп. эффект (см. справочник)." }),
  VW(DREAD, "Nemesis Doomfist / Роковой Кулак Немезис", { r:5, cls:"melee", type:"power", rng:0, rof:"–/–/–", dmg:"2d10+24 E", pen:6, clip:0, rld:"–", props:"Crunch, Force, Imprecise, Power Field", note:"Досягаемость 0–3 (кулак)." }),
  VW(DREAD, "Melta Drill / Мельта-Дрель", { r:2, type:"melta", rng:20, rof:"S/–/–", dmg:"2d10+16 E", pen:15, clip:"∞", rld:"–", props:"Imprecise, Inaccurate, Melta, Recharge" }),
  VW(DREAD, "Magna-Grapple / Магна-Гарпун", { r:4, type:"exotic", rng:30, rof:"S/–/–", dmg:"2d10+13 R", pen:4, clip:1, rld:"–", props:"Imprecise, Piercing", note:"Притягивает цель/дредноут к цели (см. справочник)." }),
  VW(DREAD, "Graviton Gun / Гравитонное Ружьё", { r:4, type:"exotic", rng:30, rof:"S/–/–", dmg:"2d10+4 I(Cr)", pen:0, clip:15, rld:"4", props:"Concussive (3), Blast (5), Graviton, Linger (5), Haywire (5)" }),
  VW(DREAD, "Dreadnought Fist / Кулак Дредноута", { r:2, cls:"melee", type:"power", rng:0, rof:"–/–/–", dmg:"2d10+24 E", pen:6, clip:0, rld:"–", props:"Crunch, Imprecise, Power Field", note:"Кулак, досягаемость 0–3. Обычно со встроенным орудием (Шторм-Болтер/Огнемёт)." }),
  VW(DREAD, "Dreadnought Claw / Клешня Дредноута", { r:2, cls:"melee", type:"power", rng:0, rof:"–/–/–", dmg:"2d10+20 E", pen:5, clip:0, rld:"–", props:"Power Field", note:"Когти, досягаемость 0–6." }),
  VW(DREAD, "Dreadnought Chainfist / Пилокулак Дредноута", { r:2, cls:"melee", type:"power", rng:0, rof:"–/–/–", dmg:"2d10+20 E", pen:12, clip:0, rld:"–", props:"Imprecise, Tearing, Power Field", note:"Досягаемость 1–3. За полудействие прорезает дверь в стене/переборке." }),
  VW(DREAD, "Dreadnought Talons / Когти Дредноута", { r:3, cls:"melee", type:"power", rng:0, rof:"–/–/–", dmg:"2d10+16 E", pen:5, clip:0, rld:"–", props:"Power Field", note:"Когти, досягаемость 0–3 (парные)." }),
  VW(DREAD, "Kick / Пинок Дредноута", { r:0, cls:"melee", type:"primitive", rng:0, rof:"–/–/–", dmg:"1d10+12 I(Cr)", pen:0, clip:0, rld:"–", props:"Reinforced", note:"Ноги, досягаемость 0–2. Только когда не используется др. рукопашное оружие." }),
  VW(DREAD, "Frag Cannon / Фраг-Пушка", { r:1, type:"solid", rng:30, rof:"S/2/4", dmg:"2d10+6 X(Fr)", pen:4, clip:80, rld:"2", props:"Flush, Reliable, Scatter, Tearing", note:"+1d10 Dmg от Scatter на короткой дальности (как в упор)." }),

  // ═══════════════ ХАОС ═══════════════
  VW(CHAOS, "Ectoplasma Cannon / Эктоплазменная Пушка", { r:2, type:"plasma", rng:120, rof:"S/–/–", dmg:"3d10+6 E", pen:8, clip:"∞", rld:"–", props:"Blast (2), Maximal, Overheats" }),
  VW(CHAOS, "Plaguespitter / Чумоплюй", { r:1, type:"flame", rng:100, rof:"S/–/–", dmg:"2d10+7 C", pen:4, clip:"∞", rld:"–", props:"Spray, Toxic (2)" }),
  VW(CHAOS, "Soulburner Petard / Петарда Душесжигатель", { r:4, type:"exotic", rng:200, rof:"S/–/–", dmg:"1d10+3 E", pen:0, clip:"∞", rld:"–", props:"Blast (3), Recharge, Warp Weapon" }),
  VW(CHAOS, "Hades Autocannon / Автопушка Аид", { r:2, type:"solid", rng:500, rof:"S/3/6", dmg:"3d10+8 I", pen:6, clip:"∞", rld:"–", props:"Devastating (4), Storm (2)" }),
  VW(CHAOS, "Twin Hellstorm Autocannon / Спаренная Автопушка Адский Шторм", { r:2, type:"solid", rng:600, rof:"S/3/–", dmg:"3d10+8 I", pen:5, clip:"∞", rld:"–", props:"Razor Sharp, Reliable, Storm (2)" }),

  // ═══════════════ ЗЕНИТНОЕ И АВИАЦИЯ ═══════════════
  VW(AIR, "Hydra Flak Autocannon / Зенитная Автопушка Гидра", { r:2, type:"solid", rng:3000, rof:"S/–/6", dmg:"3d10+9 I", pen:6, clip:72, rld:"4", props:"Anti-Air, Quad, Tearing, Reliable", note:"При промахе по цели на Низкой/Высокой высоте получает доп. свойство (см. справочник)." }),
  VW(AIR, "Icarus Stormcannon / Штормпушка Икар", { r:3, type:"solid", rng:600, rof:"S/2/5", dmg:"4d10+5 X", pen:4, clip:200, rld:"4", props:"Anti-Air, Storm (2), Tearing" }),
  VW(AIR, "Quad-Gun / Квад-Пушка", { r:2, type:"solid", rng:300, rof:"S/2/–", dmg:"2d10+2 X(Fr)", pen:0, clip:"4/16", rld:"1", props:"Arcing, Blast (5), Devastating (2), Storm (2), Tearing", note:"Все в 5 м от шаблонов — тест Подавления −20 даже при успешном Избегании." }),
  VW(AIR, "Skyhammer Launcher / Ракетная Установка Небесный Молот", { r:2, type:"launcher", rng:1000, rof:"S/3/6", dmg:"3d10+8 X", pen:6, clip:24, rld:"2", props:"Reliable" }),
  VW(AIR, "Stormstrike Missiles / Ракеты Штормовой Удар", { r:2, type:"launcher", rng:1200, rof:"S/2/–", dmg:"3d10+8 X", pen:8, clip:2, rld:"–", props:"" }),
  VW(AIR, "Typhoon Launcher / Ракетная Установка Тайфун", { r:3, type:"launcher", rng:600, rof:"S/2/–", dmg:"", pen:0, clip:12, rld:"4", props:"Imprecise, Twin-Linked", note:"Использует ракеты — профиль по типу ракеты." }),

  // ═══════════════ АРТИЛЛЕРИЯ ═══════════════
  VW(ARTY, "Medusa Siege Cannon / Осадная Пушка Медуза", { r:3, type:"solid", rng:3000, rof:"S/–/–", dmg:"5d10+12 X", pen:14, clip:"1/18", rld:"2", props:"Arcing, Blast (10), Concussive (3), Ordnance, Proven (3)" }),
  VW(ARTY, "Earthshaker Cannon / Пушка Сотрясатель", { r:2, type:"solid", rng:7000, rof:"S/–/–", dmg:"4d10+10 X", pen:8, clip:"1/20", rld:"2", props:"Arcing, Blast (20), Concussive (3), Ordnance", note:"Тяжёлая артиллерия (не стреляет в Ход движения кроме Поворота на месте). Долет: снаряды летят Rng м/Ход." }),
  VW(ARTY, "Stormshard Mortar / Мортира Осколочный Шторм", { r:2, type:"solid", rng:3000, rof:"S/2/–", dmg:"2d10+4 X(Fr)", pen:2, clip:40, rld:"4", props:"Arcing, Blast (10), Quad" }),
  VW(ARTY, "Manticore Launcher / Пусковая Установка Мантикора", { r:3, type:"launcher", rng:8000, rof:"S/2/4", dmg:"", pen:0, clip:4, rld:"4×4", props:"", note:"Ракеты Мантикоры (5 т каждая), перезарядка только с машины снабжения. Профиль по типу ракеты." }),

  // ═══════════════ БАТЧ 3: танковые варианты / ракетные / Хаос ═══════════════
  // ── Танковые пушки (варианты Леман Русс и т.п.) ──
  VW(COMMON, "Eradicator Nova Cannon / Нова-Пушка Искоренитель", { r:3, type:"solid", rng:300, rof:"S/–/–", dmg:"2d10+6 X(Fr)", pen:4, clip:"1/32", rld:"2", props:"Blast (8), Flush, Rad (1d10), Tearing" }),
  VW(COMMON, "Plasma Destroyer / Плазменный Разрушитель", { r:4, type:"plasma", rng:360, rof:"S/3/–", dmg:"2d10+15 E", pen:10, clip:6, rld:"3", props:"Overheats, Blast (5), Maximal", note:"Трейт Volatile." }),
  VW(COMMON, "Vengeance Launcher / Ракетная Установка Отмщение", { r:3, type:"launcher", rng:600, rof:"S/2/4", dmg:"2d10+6 X(Fr)", pen:6, clip:20, rld:"–", props:"Blast (10), Tearing, Reliable" }),
  VW(COMMON, "Flamestorm Cannon / Пушка Огненная Буря", { r:3, type:"flame", rng:80, rof:"S/–/–", dmg:"2d10+8 E(Fl)", pen:7, clip:20, rld:"2", props:"Flame, Spray, Linger (1d5)" }),
  VW(COMMON, "Hurricane Bolter / Ураганный Болтер", { r:3, type:"bolt", rng:200, rof:"S/5/9", dmg:"1d10+9 X", pen:4, clip:144, rld:"1", props:"Storm (2), Tearing, Twin-Linked" }),
  VW(COMMON, "Castellan Launcher / Ракетная Установка Кастелян", { r:2, type:"launcher", rng:600, rof:"S/–/–", dmg:"2d10+5 E(Fl)", pen:4, clip:4, rld:"2", props:"Arcing, Blast (10), Flame, Flush" }),
  VW(COMMON, "Missile Launcher Pod / Блок Ракетных Установок", { r:2, type:"launcher", rng:600, rof:"S/2/6", dmg:"", pen:0, clip:24, rld:"1×24", props:"Imprecise", note:"Использует ракеты — профиль по типу ракеты." }),
  VW(COMMON, "Twin Missile Launcher / Спаренная Ракетная Установка", { r:1, type:"launcher", rng:600, rof:"S/–/–", dmg:"", pen:0, clip:14, rld:"1×7", props:"Imprecise, Reliable, Twin-Linked", note:"Использует ракеты — профиль по типу ракеты." }),
  VW(COMMON, "Inferno Cannon / Пушка Инферно", { r:2, type:"flame", rng:100, rof:"S/–/–", dmg:"2d10+10 E(Fl)", pen:6, clip:100, rld:"–", props:"Flame, Spray, Linger (1d5)", note:"Трейт Volatile. Питание от бака (см. Адская Гончая)." }),
  VW(COMMON, "Chem Cannon / Химическая Пушка", { r:3, type:"acid", rng:60, rof:"S/–/–", dmg:"2d10+5 C", pen:9, clip:100, rld:"–", props:"Corrosive (2), Felling (2), Spray, Linger (1d5), Toxic (4)" }),
  VW(COMMON, "Melta Cannon / Мельта-Пушка", { r:3, type:"melta", rng:150, rof:"S/–/–", dmg:"2d10+18 E", pen:15, clip:20, rld:"–", props:"Blast (6), Melta", note:"Трейт Volatile." }),

  // ── Зенитное / авиационные ракеты ──
  VW(AIR, "Skystrike Missile / Ракета Небесный Удар", { r:2, type:"launcher", rng:1200, rof:"S/–/–", dmg:"3d10+5 X", pen:7, clip:1, rld:"5", props:"" }),
  VW(AIR, "Skystrike Missile Rack / Комплекс Ракет Небесный Удар", { r:2, type:"launcher", rng:1200, rof:"S/2/3", dmg:"3d10+5 X", pen:7, clip:3, rld:"15", props:"Imprecise", note:"Перебрасывает промах по летящей цели (см. справочник)." }),
  VW(AIR, "Hellstrike Missile Rack / Комплекс Ракет Адский Удар", { r:1, type:"launcher", rng:600, rof:"S/2/–", dmg:"3d10+7 X", pen:7, clip:2, rld:"10", props:"Blast (3)" }),
  VW(AIR, "Hellstrike Battery / Батарея Ракет Адский Удар", { r:1, type:"launcher", rng:600, rof:"S/–/–", dmg:"3d10+7 X", pen:7, clip:3, rld:"–", props:"" }),
  VW(AIR, "Helios Launcher / Ракетная Установка Гелиос", { r:2, type:"launcher", rng:600, rof:"S/–/–", dmg:"3d10+5 X(Fr)", pen:6, clip:10, rld:"2", props:"Arcing, Blast (10)" }),
  VW(AIR, "Hyperios Launcher / Ракетная Установка Гипериос", { r:3, type:"launcher", rng:1200, rof:"S/–/–", dmg:"3d10+8 X", pen:8, clip:20, rld:"2", props:"Anti-Air, Imprecise, Proven (4)" }),
  VW(AIR, "Skyspear Launcher / Ракетная Установка Небесное Копьё", { r:3, type:"launcher", rng:1000, rof:"S/–/–", dmg:"4d10+8 X", pen:12, clip:"1/6", rld:"4", props:"Anti-Air, Imprecise, Ordnance, Tearing, Proven (3)" }),

  // ── Авиация Легионов (стр. 69–74) ──
  // Клип и дальность даны как на страницах самолётов: у Буревестника (стр. 74)
  // напечатаны вдвое большие дальности, они лежат в самом акторе, а не здесь.
  VW(AIR, "Lastalon / Лазкоготь", { r:3, type:"laser", rng:240, rof:"S/2/–", dmg:"5d10+8 E(Ls)", pen:10, clip:30, rld:"2", props:"Proven (2), Reliable" }),
  VW(AIR, "Xiphon Rotary Launcher / Роторная Ракетная Установка Ксифон", { r:3, type:"launcher", rng:1000, rof:"S/2/3", dmg:"3d10+10 X", pen:10, clip:20, rld:"10", props:"Anti-Air, Concussive (2), Proven (4), Very Reliable",
    note:"Цели Размером 2 и больше на Низкой или Высокой высоте перебрасывают успешные тесты Уклонения или Виража от атак этим орудием. Непоглощённый урон по такой цели добавляет Критический Эффект 1d5+1 в место попадания." }),
  VW(AIR, "Balefire Missiles / Ракеты Гибельный Огонь", { r:3, type:"launcher", rng:1200, rof:"S/2/–", dmg:"2d10+5 E(Fl)", pen:4, clip:2, rld:"–", props:"Blast (10), Corrosive (2), Flame, Flush, Linger (1d5), Toxic (1)" }),
  VW(AIR, "Twin Avenger Bolt Cannon / Спаренная Болт-Пушка Мститель", { r:4, type:"bolt", rng:700, rof:"–/–/10", dmg:"2d10+10 X", pen:7, clip:800, rld:"4", props:"Devastating (2), Imprecise, Inaccurate, Storm (2), Tearing, Twin-Linked",
    note:"Всегда стреляет широкими очередями, накрывая шаблон Blast (7); попадания распределяются между целями области максимально равномерно. Все цели в области проходят тесты Подавления −20." }),
  VW(AIR, "Reaper Battery / Батарея Жнец", { r:2, type:"solid", rng:400, rof:"S/4/–", dmg:"3d10+8 I", pen:6, clip:40, rld:"2", props:"Quad, Reliable" }),
  VW(AIR, "Magna-Melta / Магна-Мельта", { r:3, type:"melta", rng:100, rof:"S/–/–", dmg:"2d10+16 E", pen:15, clip:"∞", rld:"–", props:"Blast (7), Melta", note:"Взрыв от этого оружия не наносит попадание по самому Цесту." }),
  VW(AIR, "Firefury Launcher / Ракетная Установка Огненная Ярость", { r:2, type:"launcher", rng:300, rof:"S/3/7", dmg:"2d10+6 X(Fr)", pen:6, clip:22, rld:"–", props:"Blast (5), Smoke (5), Storm (2)" }),
  VW(AIR, "Cluster Grenade Launcher / Кластерный Гранатомёт", { r:2, type:"launcher", rng:20, rof:"S/2/6", dmg:"", pen:0, clip:6, rld:"–", props:"Imprecise",
    note:"Стреляет L.Выстрелами. Выстрел можно провести во время любого движения, выстрелив из любой точки траектории полёта." }),
  VW(AIR, "Thunderhawk Cannon / Пушка Громовой Ястреб", { r:3, type:"solid", rng:1000, rof:"S/–/–", dmg:"3d10+15 X", pen:10, clip:"1/28", rld:"1", props:"Concussive (3), Blast (12), Ordnance, Reliable" }),
  VW(AIR, "Turbolaser Destructor / Турболазер Деструктор", { r:5, type:"laser", rng:2000, rof:"S/–/–", dmg:"4d10+30 E(Ls)", pen:14, clip:"1/20", rld:"1", props:"Blast (8), Felling (2), Proven (3)" }),
  VW(AIR, "Dreadstrike Missile Battery / Батарея Ракет Ужасный Удар", { r:4, type:"launcher", rng:6000, rof:"S/–/–", dmg:"4d10+20 X", pen:12, clip:3, rld:"–", props:"Blast (5), Ordnance", note:"Из орудия можно сделать до 3 выстрелов в Ход, в т.ч. по разным целям." }),

  // ── Хаос: демон-движки и звуковое ──
  VW(CHAOS, "Butcher Cannon / Пушка Мясник", { r:3, type:"solid", rng:300, rof:"–/–/4", dmg:"4d10+8 X", pen:4, clip:160, rld:"2", props:"Storm (2)" }),
  VW(CHAOS, "Baleflamer / Бедствогнемёт", { r:2, type:"flame", rng:100, rof:"S/–/–", dmg:"2d10+12 E(Fl)", pen:8, clip:"∞", rld:"–", props:"Flame, Spray, Linger (1d5)" }),
  VW(CHAOS, "Hades Gatling Cannon / Гатлинг-Пушка Аид", { r:4, type:"solid", rng:500, rof:"–/–/5", dmg:"2d10+6 I", pen:6, clip:"∞", rld:"–", props:"Storm (3)" }),
  VW(CHAOS, "Gorestorm Cannon / Пушка Буря Крови", { r:4, type:"exotic", rng:100, rof:"S/–/–", dmg:"3d10+8 E", pen:8, clip:"∞", rld:"–", props:"Spray" }),
  VW(CHAOS, "Ichor Cannon / Ихор-Пушка", { r:4, type:"exotic", rng:400, rof:"S/–/–", dmg:"2d10+8 X(Fr)", pen:8, clip:"∞", rld:"–", props:"Blast (8), Ordnance" }),
  VW(CHAOS, "Skullhurler / Черепомёт", { r:4, type:"exotic", rng:900, rof:"S/–/–", dmg:"5d10+8 R", pen:16, clip:"∞", rld:"–", props:"Blast (12), Ordnance, Tearing" }),
  VW(CHAOS, "Doom Siren / Сирена Рока", { r:4, type:"exotic", rng:30, rof:"S/–/–", dmg:"2d10+6 X", pen:9, clip:"∞", rld:"–", props:"Extreme (6), Spray", note:"Звуковое (Слаанеш)." }),
  VW(CHAOS, "Urdesh Cannon / Пушка Урдеш", { r:2, type:"solid", rng:600, rof:"S/–/–", dmg:"2d10+8 X", pen:6, clip:"1/32", rld:"2", props:"Blast (8), Tearing", note:"Главное орудие танка АТ-70 Разоритель (Кровавый Договор)." }),

  // ── Демон-движки: природное оружие ──
  VW(CHAOS, "Pincer Claw / Клешня (Осквернитель)", { r:0, cls:"melee", type:"power", rng:0, rof:"–/–/–", dmg:"3d10+18 I(Cr)", pen:8, clip:0, rld:"–", props:"Crunch, Imprecise, Reinforced", note:"Досягаемость 2–5. Природное оружие." }),
  VW(CHAOS, "Paw / Лапа (Кузнизверг)", { r:0, cls:"melee", type:"primitive", rng:0, rof:"–/–/–", dmg:"1d10+12 I(Cr)", pen:0, clip:0, rld:"–", props:"Imprecise, Reinforced", note:"Кулак, досягаемость 2–3. Природное оружие." }),
  VW(CHAOS, "Daemon Power Fist / Силовой Кулак (Молотизверг)", { r:2, cls:"melee", type:"power", rng:0, rof:"–/–/–", dmg:"2d10+24 E", pen:6, clip:0, rld:"–", props:"Crunch, Imprecise, Power Field", note:"Кулак, досягаемость 0–3." }),
  VW(CHAOS, "Magma Cutters / Магма-Резаки", { r:2, cls:"melee", type:"melta", rng:0, rof:"–/–/–", dmg:"2d10+13 E", pen:30, clip:0, rld:"–", props:"Contained, Imprecise, Multi-strike (2), Power Field", note:"Досягаемость 0–3. Против иммунных к Melta Pen→15. Прорезает дверь в стене/переборке за полудействие." }),
  VW(CHAOS, "Talons / Когти (Адский Змий)", { r:2, cls:"melee", type:"power", rng:0, rof:"–/–/–", dmg:"2d10+20 E", pen:6, clip:0, rld:"–", props:"Power Field", note:"Когти, досягаемость 0–3." }),

  // ═══════════════════════════ ДРУКХАРИ (техника) ═══════════════════════════
  // ── Осколочное (Toxic) ──
  VW(DRU, "Splinter Pod / Ядострел", { r:-2, type:"splinter", rng:200, rof:"S/3/5", dmg:"1d10+4 R", pen:4, clip:240, rld:"1", props:"Twin-Linked, Toxic (4)" }),
  VW(DRU, "Splinter Rifle / Осколочная Винтовка (техн.)", { r:0, type:"splinter", rng:200, rof:"S/3/5", dmg:"1d10+2 R", pen:4, clip:120, rld:"½", props:"Toxic (4)" }),
  VW(DRU, "Twin Splinter Rifle / Сдвоенная Осколочная Винтовка", { r:1, type:"splinter", rng:200, rof:"S/3/5", dmg:"1d10+2 R", pen:4, clip:120, rld:"1", props:"Twin-Linked, Toxic (4)" }),
  VW(DRU, "Splinter Cannon / Осколочная Пушка (техн.)", { r:2, type:"splinter", rng:100, rof:"S/3/5", dmg:"1d10+3 R", pen:4, clip:120, rld:"½", props:"Storm (3), Toxic (4), Very Reliable" }),
  VW(DRU, "Shredder / Шреддер (техн.)", { r:2, type:"monofilament", rng:70, rof:"S/–/–", dmg:"1d10+8 R", pen:4, clip:5, rld:"2", props:"Blast (2), Eldar Razor Sharp, Imprecise, Monofilament (4), Tearing, Spray", note:"Провал Monofilament → +1 к свойству. Смертельный урон → паралич 12−T.b ч." }),
  // ── Тёмносветовое (Lance) ──
  VW(DRU, "Blaster / Бластер (техн.)", { r:2, type:"darklight", rng:40, rof:"S/–/–", dmg:"2d10+12 X", pen:4, clip:32, rld:"2", props:"Extreme (8), Felling (4), Lance, Proven (4)" }),
  VW(DRU, "Dark Lance / Тёмное Копьё (техн.)", { r:4, type:"darklight", rng:120, rof:"S/–/–", dmg:"3d10+16 X", pen:6, clip:32, rld:"4", props:"Extreme (7), Felling (6), Lance, Proven (4)", note:"По Size ≤1: T−30 или ×2 урон (▲). Size 0 — не остаётся следа. В Рейдере/Опустошителе — R1 (интегрировано)." }),
  VW(DRU, "Heat Lance / Тепловое Копьё (техн.)", { r:5, type:"darklight", rng:60, rof:"S/–/–", dmg:"5d10+20 X", pen:15, clip:32, rld:"4", props:"Deflagrate (12), Extreme (6), Felling (6), Melta, Lance, Proven (5)", note:"По Size ≤2: T−50 или ×2 урон. Size ≤1 непогл. → крит E 6." }),
  // ── Дезинтеграторы (плазма Друкхари) ──
  VW(DRU, "Disintegrator Cannon / Дезинтегратор", { r:4, type:"plasma", rng:150, rof:"–/5/8", dmg:"1d10+16 E", pen:11, clip:60, rld:"5", props:"Blast (6), Maximal, Reliable", note:"Погибший испаряется на атомы. В Рейдере/Опустошителе — R1 (интегрировано)." }),
  VW(DRU, "Pulse Disintegrators / Импульсные Дезинтеграторы", { r:4, type:"plasma", rng:300, rof:"–/–/10", dmg:"2d10+12 E", pen:12, clip:"∞", rld:"–", props:"Storm (3)" }),
  // ── Гранатомёты ──
  VW(DRU, "Horrorfex / Хоррорфекс (техн.)", { r:4, type:"launcher", rng:300, rof:"S/–/–", dmg:"", pen:0, clip:1, rld:"1", props:"Imprecise", note:"Ускоренные гранаты: +2d10+14 I(Cr), Pen 0, Primitive к взрыву." }),
  // ── Рукопашное (лезвия/косы) ──
  VW(DRU, "Blades / Лезвия", { r:0, cls:"melee", type:"primitive", rng:0, rof:"–/–/–", dmg:"1d10+7 R", pen:6, clip:0, rld:"–", props:"", note:"Досягаемость 0–2. При Налёте бьёт по цели в радиусе; доп. попадание при Таране. На Рейдере/Опустошителе — 2d10+7." }),
  VW(DRU, "Hellion Wings / Крылья Геллиона", { r:0, cls:"melee", type:"primitive", rng:0, rof:"–/–/–", dmg:"1d10+8 R", pen:4, clip:0, rld:"–", props:"", note:"Досягаемость 0–2. Крылья скайборда." }),
  VW(DRU, "Grav-Talon / Грав-Коготь", { r:2, cls:"melee", type:"primitive", rng:0, rof:"–/–/–", dmg:"1d10+15 R", pen:7, clip:0, rld:"–", props:"Reinforced", note:"Досягаемость 0–6. Притягивает цель ≤450 кг / Size 1 (S+10) и прижимает к лезвию." }),
  VW(DRU, "Scythevane / Огромные Косы", { r:3, cls:"melee", type:"power", rng:0, rof:"–/–/–", dmg:"3d10+10 R", pen:9, clip:0, rld:"–", props:"Power Field, Reinforced", note:"Досягаемость 0–3. За каждые 5 м Налёта +4 Dmg/+3 Pen; после 15 м — Melta против техники." }),
  VW(DRU, "Scythes / Косы", { r:1, cls:"melee", type:"primitive", rng:0, rof:"–/–/–", dmg:"1d10+15 R", pen:0, clip:0, rld:"–", props:"Reinforced", note:"Досягаемость 0–6. При Налёте бьёт по цели в радиусе." })
];

// ── Пак первичен, библиотека — запасной путь ─────────────────────────────
// Компендиум warhammer-dbc.vehicle-weapons — то, что видно ГМу и правится
// руками начиная с любой книги; VEHICLE_WEAPONS может отставать (или,
// как сейчас, местами обгонять — см. doombc-vehicle-weapons) от него.
// Тот же приём, что и Бог Таланта в patronage.mjs: индекс строится ЗАРАНЕЕ
// и кэшируется, потому что свап орудия — обработчик change, а не место,
// откуда естественно ждать pack.getIndex() каждый раз.
const VEHICLE_WEAPONS_PACK_ID = "warhammer-dbc.vehicle-weapons";

let _vehicleWeaponsByName = null; // null = ещё не строился

function fallbackVehicleWeaponIndex() {
  return new Map(VEHICLE_WEAPONS.map(w => [w.name, w]));
}

async function _refreshVehicleWeaponIndex() {
  const pack = (typeof game !== "undefined") ? game.packs?.get?.(VEHICLE_WEAPONS_PACK_ID) : null;
  if (!pack) { _vehicleWeaponsByName = fallbackVehicleWeaponIndex(); return; }
  try {
    const docs = await pack.getDocuments();
    const byName = new Map(docs.map(d => [d.name, { name: d.name, img: d.img, system: d.system }]));
    // Библиотека как подстраховка: профиль, которого в паке ещё нет
    // (не перенесён/новая книга), не должен тихо пропасть со свапа.
    for (const [name, w] of fallbackVehicleWeaponIndex()) if (!byName.has(name)) byName.set(name, w);
    _vehicleWeaponsByName = byName;
  } catch (e) { console.warn("Warhammer DBC | кэш «пак первичен» не построился, работает библиотека", e); _vehicleWeaponsByName = fallbackVehicleWeaponIndex(); }
}

/** Регистрируется в warhammer-dbc.mjs — строит кэш после готовности мира и
 * обновляет его при правках компендиума warhammer-dbc.vehicle-weapons. До
 * первого построения (или в тестах без game.packs) используется библиотека. */
export function initVehicleWeaponIndex() {
  Hooks.once("ready", () => _refreshVehicleWeaponIndex());
  for (const h of ["createItem", "deleteItem", "updateItem"])
    Hooks.on(h, doc => { if (doc?.pack === VEHICLE_WEAPONS_PACK_ID) _refreshVehicleWeaponIndex(); });
}

/** Профиль орудия техники по имени (как оно лежит в компендиуме/библиотеке),
 * или null, если не найден нигде. */
export function vehicleWeaponProfile(name) {
  const index = _vehicleWeaponsByName || fallbackVehicleWeaponIndex();
  return index.get(name) || null;
}
