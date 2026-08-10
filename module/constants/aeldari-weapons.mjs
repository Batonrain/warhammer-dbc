// ════════════════════════════════════════════════════════════════════════
//  Библиотека оружия Азуриан (Аэльдари) для компендиума «Оружие — DBC».
//  Заполняется автоматически в пак warhammer-dbc.weapons с вложенными
//  папками: Азуриане → Стрелковое/Рукопашное → категория.
//
//  Профиль задаётся компактно; свойства — строкой `props` (как в справочнике),
//  которую парсер превращает в СТРУКТУРНЫЕ system.weaponProps [{key,rating,rating2}].
//  То, что после «+» в `props`, и неузнанные токены/нечисловые рейтинги — уходят
//  в system.special как памятка (моды, аспект-группа, dice-рейтинги Linger и т.п.).
//  Билдер идемпотентен и мигрирует старые записи без weaponProps.
// ════════════════════════════════════════════════════════════════════════

// Имя свойства (как в справочнике) → ключ реестра.
const PROP_ALIASES = {
  "Eldar Razor Sharp": "eldarRazorSharp", "Eldar Precise": "eldarPrecise", "Eldar Accurate": "eldarAccurate",
  "Extreme": "extreme", "Reliable": "reliable", "Very Reliable": "veryReliable",
  "Unreliable": "unreliable", "Very Unreliable": "veryUnreliable", "Resonant": "resonant",
  "Twin-Linked": "twinLinked", "Twin–Linked": "twinLinked", "Carbine": "carbine", "Tearing": "tearing",
  "Hefty": "hefty", "Aspect": "aspect", "Blinding": "blinding", "Sanctified": "sanctified",
  "Hallucinogenic": "hallucinogenic", "Force": "force", "Warp Weapon": "warpWeapon", "Warp–Weapon": "warpWeapon",
  "Storm": "storm", "Proven": "proven", "Felling": "felling", "Lance": "lance", "Scatter": "scatter",
  "Impulse": "impulse", "Through Shot": "throughShot", "Combi": "combi", "Independent": "independent",
  "Melta": "melta", "Flame": "flame", "Linger": "linger", "Imprecise": "imprecise", "Inaccurate": "inaccurate",
  "Wrecker": "wrecker", "Primitive": "primitive", "Toxic": "toxic", "Crippling": "crippling",
  "Arcing": "arcing", "Blast": "blast", "Monofilament": "monofilament", "Spray": "spray",
  "Anti-Air": "antiAir", "Anti–Air": "antiAir", "Revolver": "revolver", "Maximal": "maximal",
  "Devastating": "devastating", "Prisma": "prisma", "Concussive": "concussive", "Recoil": "recoil",
  "Surge": "surge", "Haywire": "haywire", "Rad": "rad", "Grav": "grav", "Shocking": "shocking",
  "Power Field": "powerField", "Reinforced": "reinforced", "Mighty": "mighty", "Dueling Weapon": "duelingWeapon",
  "Step By Step": "stepByStep", "Step by Step": "stepByStep", "Corrosive": "corrosive", "Flexible": "flexible",
  "Multi-Strike": "multiStrike", "Multi–Strike": "multiStrike", "Crunch": "crunch", "Witch's Edge": "witchsEdge",
  "Witch’s Edge": "witchsEdge", "Vibro": "vibro", "Distortion": "distortion", "Defensive": "defensive",
  "Cheap Shot": "cheapShot", "Arc": "arc", "Wrist": "wrist",
  "Accurate": "accurate", "Precise": "precise",
  "Legion": "legion", "Piercing": "piercing", "Gyro-Stabilized": "gyroStabilized",
  "Gyro–Stabilized": "gyroStabilized", "Snare": "snare", "Flush": "flush",
  "Ogrynized": "ogryned", "Ogryned": "ogryned", "Razor Sharp": "razorSharp",
  "Overheats": "overheats", "Recharge": "recharge", "Deflagrate": "deflagrate",
  "Ordnance": "ordnance", "Quad": "quad", "Contained": "contained", "Tainted": "tainted",
  "Graviton": "grav", "Cognis": "cognis", "Smoke": "smoke", "Ogrynized ": "ogryned"
};

// "S/3/5" → {rof_single, rof_semi, rof_full}
function rofParse(s) {
  const part = x => {
    x = (x || "").trim();
    if (x === "S") return 1;
    if (x === "" || x === "–" || x === "-") return 0;
    return parseInt(x) || 0;
  };
  const [a, b, c] = String(s).split("/");
  return { rof_single: part(a), rof_semi: part(b), rof_full: part(c) };
}

// Чистая формула броска из строки урона ("1d10+4 R" → "1d10+4";
// "1d10+8+(2×X) E" → "1d10+8"; "†" → ""). Тип урона (буква) отбрасывается —
// он хранится отдельно в damageType, иначе new Roll() падает на букве.
function dmgFormula(d) {
  if (!d) return "";
  // Сохраняем и бонусы характеристик: «1d10-3+S.b R» -> «1d10-3+S.b».
  // Раньше хвост обрезался, и луки (Dmg 1d10-3+S.b) теряли бонус Силы,
  // а профили с уроном по I.b — свой бонус Ловкости.
  const m = String(d).match(
    /^(?:\d+d\d+|\d+)(?:\s*[+\-]\s*(?:\d+|(?:Int|Inf|Cor|Per|Fel|WS|BS|Ag|WP|S|T|A|I|P|W|F)\.b))*/i
  );
  return m ? m[0].replace(/\s+/g, "") : "";
}

// Тип урона из строки урона ("1d10+4 R", "1d10+3 E(Ls)", "1d10 I(Cr)")
function dtParse(dmg) {
  if (/\bR\b/.test(dmg)) return "rending";
  if (/\bC\b/.test(dmg)) return "chemical";
  if (/\bE/.test(dmg))   return "energy";
  if (/\bI/.test(dmg))   return "impact";
  return "impact";
}

// Строка свойств → { weaponProps:[{key,rating,rating2}], notes:[...] }
function parseProps(str) {
  if (!str) return { weaponProps: [], notes: [] };
  // отделяем моды (после «+»)
  const plus = str.indexOf("+");
  let propsPart = plus >= 0 ? str.slice(0, plus) : str;
  const modsPart = plus >= 0 ? str.slice(plus + 1).trim() : "";
  const notes = [];
  if (modsPart) notes.push("Моды: " + modsPart);
  // делим по запятым на верхнем уровне (учёт скобок)
  const tokens = []; let depth = 0, cur = "";
  for (const ch of propsPart) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { tokens.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  if (cur.trim()) tokens.push(cur.trim());

  const weaponProps = [];
  for (const tok of tokens) {
    if (!tok) continue;
    const m = tok.match(/^(.*?)\s*\((.*)\)\s*$/);
    let name = tok, rating = null;
    if (m) { name = m[1].trim(); rating = m[2].trim(); }
    const key = PROP_ALIASES[name];
    if (!key) { notes.push(tok); continue; }   // неузнанное → памятка
    const entry = { key };
    if (rating != null) {
      const slash = rating.split("/");
      const r1 = Number(slash[0]);
      if (slash[0] !== "" && Number.isInteger(r1) && String(r1) === slash[0].trim()) {
        entry.rating = r1;
        if (slash[1] != null) {
          const r2 = Number(slash[1]);
          if (Number.isInteger(r2) && String(r2) === slash[1].trim()) entry.rating2 = r2;
          else notes.push(`${name} (2): ${slash[1]}`);
        }
      } else {
        notes.push(`${name}: ${rating}`);       // нечисловой рейтинг (аспект-группа, dice) → памятка
      }
    }
    weaponProps.push(entry);
  }
  return { weaponProps, notes };
}

// Сборка предмета. o: {c,t,rng,rof,dmg,pen,clip,rld,wt,av,props,note}
function W(folder, name, o) {
  const { weaponProps, notes } = parseProps(o.props || "");
  if (o.note) notes.push(o.note);
  const rof = rofParse(o.rof || "");
  return {
    folder, name, type: "weapon",
    system: {
      weaponClass: o.c || "basic",
      // Друкхарийское снаряжение считается по своей таблице Качества (5 уровней).
      drukhari: folder?.[0] === "Друкхари",
      weaponType:  o.t || "shuriken",
      range:       o.rng ?? 0,
      rof_single:  rof.rof_single, rof_semi: rof.rof_semi, rof_full: rof.rof_full,
      damage:      dmgFormula(o.dmg || ""),
      damageType:  dtParse(o.dmg || ""),
      penetration: o.pen ?? 0,
      magazineCur: o.clip ?? 0, magazineMax: o.clip ?? 0,
      reload:      o.rld || "1",
      quality:     "common",
      availability: o.av ?? 0,
      weight:      o.wt ?? 0,
      special:     notes.join(". "),
      weaponProps,
      // Полосы дальности (стр. 193-197): у некоторых оружий урон/пробитие
      // меняются с дистанцией особым образом. [{label, dice, dmg, pen}]
      rangeBands:  o.bands || []
    }
  };
}

// Рукопашное: "2-4"/"2–4"/"1" → последнее число (для отображения досягаемости).
function reachMax(r) {
  const nums = String(r).match(/\d+/g);
  return nums ? parseInt(nums[nums.length - 1]) : 0;
}

// Доп. боевой профиль рукопашного оружия (стр. 207-221). У древкового и
// составного оружия несколько рабочих частей: топором бьют иначе, чем
// крюком или древком. Профили кладём в system.profiles — их читает окно
// атаки и чипы в HUD, так что переключение работает без ручного ввода.
function PF(label, reach, dmg, pen, props) {
  const { weaponProps } = parseProps(props || "");
  return {
    label, range: String(reach).replace(/[–—]/g, "-"),
    damage: dmgFormula(dmg), damageType: dtParse(dmg),
    penetration: pen ?? 0, weaponProps
  };
}
// Древко почти у всего древкового оружия одинаковое — не дублируем руками.
const PSTAFF   = (props) => PF("Посох", "2-4", "1d10-2 I(Cr)", 0, props || "Imprecise, Primitive");
const PSTAFF5  = (props) => PF("Посох", "2-5", "1d10-2 I(Cr)", 0, props || "Imprecise, Primitive");
const PSTAFF_R = () => PSTAFF("Imprecise, Primitive, Reinforced");

// Рукопашное оружие. o: {t,grip,form,reach,dmg,pen,props,bl,wt,av,note,prof}
function M(folder, name, o) {
  const { weaponProps, notes } = parseProps(o.props || "");
  const head = [];
  if (o.form)  head.push(o.form);
  if (o.grip)  head.push("Хват " + o.grip);
  if (o.reach) head.push("Досягаемость " + o.reach);
  const lead = head.join("; ");
  const all = (lead ? [lead] : []).concat(notes);
  if (o.note) all.push(o.note);
  return {
    folder, name, type: "weapon",
    system: {
      weaponClass: "melee", weaponType: o.t || "chain",
      // Друкхарийское снаряжение считается по своей таблице Качества (5 уровней).
      drukhari: folder?.[0] === "Друкхари",
      range: reachMax(o.reach || 0), balance: o.bl ?? 0,
      rof_single: 0, rof_semi: 0, rof_full: 0,
      damage: dmgFormula(o.dmg || ""), damageType: dtParse(o.dmg || ""), penetration: o.pen ?? 0,
      magazineCur: 0, magazineMax: 0, reload: "–",
      quality: "common", availability: o.av ?? 0, weight: o.wt ?? 0,
      special: all.join(". "), weaponProps,
      // Доп. профили и ярлык основного — переключаются в окне атаки и в HUD.
      // Ключи пишем ТОЛЬКО когда профили есть: пустой список при синхронизации
      // компендиума затёр бы профили, проставленные миграцией weapon-grips.
      ...(o.prof?.length ? { profiles: o.prof, profileLabel: o.form || "" } : {}),
      // Свойства, появляющиеся только в двуручном хвате (стр. 211).
      ...(o.g2h ? { gripProps2h: o.g2h } : {}),
      // Эффекты, открывающиеся по Порче владельца (стр. 220).
      ...(o.cor ? { corEffects: o.cor } : {}),
      // Ручные щиты (стр. 215): AP и прикрываемые зоны — машинные поля, чтобы
      // броня щита реально считалась, а не лежала текстом в примечании.
      // zones: «Т+Р1+Р2+Н1+Н2+(Г)» — в скобках зоны, прикрываемые лишь частично
      // (нужно пригнуться/поднять щит: даёт AP только при явном выборе).
      ...(o.sap != null ? { shieldAP: o.sap, shieldZones: o.zones || "", shieldForm: o.form || "" } : {})
    }
  };
}

const SHU = ["Азуриане", "Стрелковое", "Сюрикен"];
const LAS = ["Азуриане", "Стрелковое", "Лазерное"];
const MON = ["Азуриане", "Стрелковое", "Моносетевое"];
const PLA = ["Азуриане", "Стрелковое", "Плазменное"];
const FUS = ["Азуриане", "Стрелковое", "Фузионное"];
const FLM = ["Азуриане", "Стрелковое", "Огнемёты"];
const NDL = ["Азуриане", "Стрелковое", "Игольное"];
const PRI = ["Азуриане", "Стрелковое", "Призменное"];
const LCH = ["Азуриане", "Стрелковое", "Ракетные установки"];
const RKT = ["Азуриане", "Стрелковое", "Ракеты"];
const GRN = ["Азуриане", "Стрелковое", "Гранаты и бомбы"];
const CHN = ["Азуриане", "Рукопашное", "Цепное"];
const POW = ["Азуриане", "Рукопашное", "Силовое"];
const WRT = ["Азуриане", "Рукопашное", "Психокостяное"];
const DSPL  = ["Друкхари", "Стрелковое", "Осколочное"];
const DDARK = ["Друкхари", "Стрелковое", "Тёмносветовое"];
const DLCH  = ["Друкхари", "Стрелковое", "Гранатомёты"];
const DGRN  = ["Друкхари", "Стрелковое", "Гранаты и бомбы"];
const DEXO  = ["Друкхари", "Стрелковое", "Экзотическое"];
const DPRIM = ["Друкхари", "Рукопашное", "Примитивное"];
const DHAEM = ["Друкхари", "Рукопашное", "Оружие Гемункулов"];
const DPOW  = ["Друкхари", "Рукопашное", "Силовое"];
const DUNIQ = ["Друкхари", "Рукопашное", "Уникальное"];
const DMEDU = ["Друкхари", "Атаки существ", "Медуза"];
const DABYS = ["Друкхари", "Атаки существ", "Житель Бездны"];
// ── Имперское (и не-аэльдарское) оружие ──
const IMP_SP   = ["Имперское", "Стрелковое", "Авто и стаб"];
const IMP_SHOT = ["Имперское", "Стрелковое", "Дробовики"];
const IMP_ACAN = ["Имперское", "Стрелковое", "Автопушки"];
const IMP_LAS  = ["Имперское", "Стрелковое", "Лазерное"];
const IMP_BOLT = ["Имперское", "Стрелковое", "Болтерное"];
const IMP_PLA  = ["Имперское", "Стрелковое", "Плазменное"];
const IMP_LCH  = ["Имперское", "Стрелковое", "Гранатомёты"];
const IMP_GRN  = ["Имперское", "Стрелковое", "Гранаты"];
const IMP_BMB  = ["Имперское", "Стрелковое", "Бомбы"];
const IMP_MECH = ["Имперское", "Стрелковое", "Механикум"];
const IMP_PRIM = ["Имперское", "Стрелковое", "Примитивное"];
const IMP_EXT  = ["Имперское", "Стрелковое", "Экзотическое (тех.)"];
const IMP_EXM  = ["Имперское", "Стрелковое", "Экзотическое (мист.)"];
const IMP_IMPR = ["Имперское", "Стрелковое", "Импровизированное"];
const DIGITAL = "Умещается в перстень. Можно надеть на каждый палец руки, кроме большого, и стрелять одновременно с оружием в этой руке и друг с другом. Перезарядка: тест Tech-Use−10 и ½ смены работы.";
const PULSE = "Трофейное оружие Тау. Перезарядка магазина считается Редкостью 0, добыча нового магазина — Редкостью 2.";
const LCH_NOTE = "Урон, пробитие и дополнительные свойства берутся от заряженной ракеты. Можно Закреплять «с плеча».";
const IMP_GEARW = ["Имперское", "Оружие снаряжения"];
const IMP_RKT  = ["Имперское", "Стрелковое", "Ракетные установки"];
const IMP_RKTA = ["Имперское", "Стрелковое", "Ракеты"];
const IMP_EXX  = ["Имперское", "Стрелковое", "Экзотическое (ксено)"];
const IMP_MEL  = ["Имперское", "Стрелковое", "Мельта"];
const IMP_FLM  = ["Имперское", "Стрелковое", "Огнемёты"];
const IMP_VOL  = ["Имперское", "Стрелковое", "Волькитовое"];
const IMP_GRAV = ["Имперское", "Стрелковое", "Гравитонное"];
// ── Варианты Астартес (то, что в книге в [квадратных скобках] / Legion (P)) ──
const AST_ACAN = ["Астартес", "Стрелковое", "Автопушки"];
const AST_GRAV = ["Астартес", "Стрелковое", "Гравитонное"];
const AST_EXO  = ["Астартес", "Стрелковое", "Экзотическое"];
const AST_LAS  = ["Астартес", "Стрелковое", "Лазерное"];
const AST_BOLT = ["Астартес", "Стрелковое", "Болтерное"];
const AST_PLA  = ["Астартес", "Стрелковое", "Плазменное"];
const AST_MEL  = ["Астартес", "Стрелковое", "Мельта"];
const AST_FLM  = ["Астартес", "Стрелковое", "Огнемёты"];
const AST_VOL  = ["Астартес", "Стрелковое", "Волькитовое"];
const AST_LCH  = ["Астартес", "Стрелковое", "Гранатомёты"];
const AST_RKT  = ["Астартес", "Стрелковое", "Ракетные установки"];
const IMP_MPRIM = ["Имперское", "Рукопашное", "Примитивное"];
const IMP_MCHN  = ["Имперское", "Рукопашное", "Цепное"];
const IMP_MSHK  = ["Имперское", "Рукопашное", "Шоковое"];
const AST_MPRIM = ["Астартес", "Рукопашное", "Примитивное"];
const IMP_MPOW = ["Имперское", "Рукопашное", "Силовое"];
const IMP_MPSY = ["Имперское", "Рукопашное", "Психосиловое"];
const IMP_MEXO = ["Имперское", "Рукопашное", "Экзотическое (тех.)"];
const IMP_MEXM = ["Имперское", "Рукопашное", "Экзотическое (мист.)"];
const IMP_MIMP = ["Имперское", "Рукопашное", "Импровизированное"];
const SHLD     = ["Имперское", "Щиты"];
const AST_SHLD = ["Астартес", "Щиты"];
const HQ_M     = ["Арлекины", "Рукопашное"];
const HQ_R     = ["Арлекины", "Стрелковое"];
// Общее правило легионных вариантов щитов (приписывается к примечанию базовых щитов).
const SHLEG = " Легион-вариант: +1 R, +1 Dmg, +1 Pen, +1 AP и модификация Hardened (или ещё +1 AP, если Hardened уже в профиле).";

// Механика метания/установки (приписывается к примечанию каждой гранаты/бомбы).
const THROW_GRENADE = "Метание: Rng S.b×3 м, RoF S/–/–; вместо перезарядки — экипировка другой гранаты из инвентаря. При S.b 8+: либо считать S.b до 7 в расчёте Rng, либо бросать 1d5 — на «1» граната ломается от чрезмерной силы и не детонирует. Как мина (стр. 188): профиль и Редкость те же, но граната ставится на землю и срабатывает при проходе через клетку 1×1 м. Установка — полудействие (мина заметна); чтобы спрятать, нужно 30 секунд (6 ходов) и комбинированный тест Tech-Use (I)+50 и Stealth (P)+20. Переделка гранаты в мину или обратно — ½ смены работы, тест Tech-Use+30, по 1 за каждый Успех.";
const THROW_BOMB = "Бомба (тяжёлая граната): метание Rng только S.b×1.5 м; чаще ставится для удалённого/задержанного подрыва. Настройка времени и вокс-частоты детонации — тест Tech-Use+20 и 1 минута работы (12 ходов).";

export const AELDARI_WEAPONS = [

  // ─────────────────────────── СЮРИКЕН ───────────────────────────
  W(SHU, "Сюрикен Пистолет (Murehk)", { c:"pistol", t:"shuriken", rng:20, rof:"S/3/5", dmg:"1d10+4 R", pen:4, clip:40, rld:"½", wt:1, av:-1, props:"Eldar Razor Sharp, Extreme (9), Reliable" }),
  W(SHU, "Спаренный Сюрикен Пистолет", { c:"pistol", t:"shuriken", rng:30, rof:"S/3/5", dmg:"1d10+4 R", pen:4, clip:90, rld:"½", wt:1.5, av:0, props:"Eldar Razor Sharp, Extreme (9), Reliable, Twin-Linked" }),
  W(SHU, "Сюрикен Арбалет", { c:"pistol", t:"shuriken", rng:80, rof:"S/3/–", dmg:"1d10+4 R", pen:4, clip:20, rld:"1", wt:1.5, av:0, props:"Eldar Razor Sharp, Extreme (9), Reliable +Ammo Selector" }),
  W(SHU, "Сюрикен Катапульта (Tuelean)", { c:"basic", t:"shuriken", rng:60, rof:"S/4/8", dmg:"1d10+4 R", pen:4, clip:120, rld:"½", wt:2, av:-1, props:"Carbine, Eldar Razor Sharp, Extreme (9), Reliable +Pistol Grip" }),
  W(SHU, "Сюрикен Катапульта Мстителей", { c:"basic", t:"shuriken", rng:100, rof:"S/6/12", dmg:"1d10+5 R", pen:4, clip:180, rld:"½", wt:3, av:2, props:"Aspect (Зловещие Мстители), Carbine, Eldar Razor Sharp, Extreme (9), Reliable, Tearing +Pistol Grip, Targeter", note:"Режимы стрельбы: Одиночный/Полуавто/Авто (см. справочник)." }),
  W(SHU, "Сюрикен Катапульта Хранитель Врат", { c:"basic", t:"shuriken", rng:100, rof:"S/6/12", dmg:"1d10+5 R", pen:4, clip:180, rld:"½", wt:4, av:3, props:"Carbine, Eldar Razor Sharp, Extreme (9), Hefty (I(Cr)), Tearing, Very Reliable +Djinn-Scope, Motion Predictor, Pistol Grip, Targeter", note:"В рукопашной +3 Dmg, +1 Pen, Concussive (0); без штрафов погоды." }),
  W(SHU, "Сюрикен Катапульта Стража", { c:"basic", t:"shuriken", rng:80, rof:"S/4/6", dmg:"1d10+4 R", pen:4, clip:100, rld:"¼", wt:2, av:-1, props:"Carbine, Eldar Razor Sharp, Extreme (9), Reliable +Pistol Grip" }),
  W(SHU, "Сюрикен Винтовка", { c:"basic", t:"shuriken", rng:150, rof:"S/3/5", dmg:"1d10+4 R", pen:4, clip:120, rld:"½", wt:3, av:-1, props:"Eldar Razor Sharp, Extreme (9), Reliable +Ammo Selector, Pistol Grip" }),
  W(SHU, "Стрела Кхейна", { c:"basic", t:"shuriken", rng:80, rof:"S/6/12", dmg:"1d10+6 R", pen:5, clip:240, rld:"½", wt:4.5, av:3, props:"Carbine, Eldar Precise, Eldar Razor Sharp, Extreme (7), Hefty (I(Cr)), Tearing, Very Reliable +Djinn-Scope, Motion Predictor, Pistol Grip, Targeter" }),
  W(SHU, "Гнев Азуриана", { c:"basic", t:"shuriken", rng:80, rof:"S/4/8", dmg:"1d10+5 R", pen:4, clip:120, rld:"½", wt:4.5, av:1, props:"Carbine, Eldar Razor Sharp, Extreme (6), Reliable +Pistol Grip" }),
  W(SHU, "Сюрикен Пушка", { c:"heavy", t:"shuriken", rng:150, rof:"S/–/10", dmg:"2d10+8 R", pen:6, clip:240, rld:"1", wt:9, av:2, props:"Eldar Razor Sharp, Extreme (9), Reliable, Tearing" }),
  W(SHU, "Пылающие Звёзды Ваула", { c:"heavy", t:"shuriken", rng:150, rof:"S/–/10", dmg:"2d10+10 R", pen:6, clip:240, rld:"1", wt:10, av:3, props:"Blinding (2), Eldar Razor Sharp, Extreme (9), Reliable, Tearing" }),
  W(SHU, "Лук Курноуса", { c:"pistol", t:"shuriken", rng:40, rof:"S/4/7", dmg:"1d10+4 R", pen:4, clip:65, rld:"½", wt:1, av:3, props:"Eldar Razor Sharp, Extreme (5), Reliable, Sanctified" }),
  W(SHU, "Пистолет Провидца Рока", { c:"pistol", t:"shuriken", rng:40, rof:"S/3/5", dmg:"1d10+4 R", pen:4, clip:40, rld:"½", wt:1, av:3, props:"Aspect (Видящие), Eldar Razor Sharp, Extreme (9), Reliable" }),
  W(SHU, "Пистолет Небобежца", { c:"pistol", t:"shuriken", rng:40, rof:"S/3/5", dmg:"1d10+4 R", pen:4, clip:40, rld:"½", wt:1, av:3, props:"Aspect (Видящие), Eldar Razor Sharp, Extreme (9), Reliable" }),
  W(SHU, "Пистолет Провидца Войны", { c:"pistol", t:"shuriken", rng:40, rof:"S/3/5", dmg:"1d10+4 R", pen:4, clip:40, rld:"½", wt:1, av:3, props:"Aspect (Видящие), Eldar Razor Sharp, Extreme (9), Reliable" }),
  W(SHU, "Небесный Сюрикен Арбалет", { c:"basic", t:"shuriken", rng:20, rof:"S/3/–", dmg:"1d10+2 R", pen:2, clip:36, rld:"1", wt:1, av:5, props:"Eldar Razor Sharp, Extreme (9), Reliable", note:"С 4 «плечами»: 180м, 1d10+10 R, 9 Pen, Extreme (5), Recoil (+1), Surge (12)." }),
  W(SHU, "Песнь Иннеада", { c:"pistol", t:"shuriken", rng:30, rof:"S/3/5", dmg:"1d10+4 R", pen:4, clip:40, rld:"½", wt:1, av:5, props:"Aspect (Иннари), Eldar Razor Sharp, Extreme (9), Hallucinogenic (2), Reliable" }),
  W(SHU, "Пистолет Рассекатель", { c:"pistol", t:"shuriken", rng:30, rof:"S/3/5", dmg:"1d10 R", pen:0, clip:40, rld:"½", wt:1, av:5, props:"Eldar Razor Sharp, Extreme (9), Force, Reliable, Warp Weapon" }),
  W(SHU, "Шторм Клинков", { c:"pistol", t:"shuriken", rng:40, rof:"S/6/10", dmg:"1d10+8 R", pen:6, clip:0, rld:"†", wt:1, av:0, props:"Eldar Razor Sharp, Extreme (7), Reliable, Storm (5)", note:"Артефакт (см. справочник)." }),

  // ─────────────────────────── ЛАЗЕРНОЕ ───────────────────────────
  W(LAS, "Эльдарский Лазпистолет", { c:"pistol", t:"laser", rng:40, rof:"S/3/–", dmg:"1d10+3 E(Ls)", pen:1, clip:60, rld:"½", wt:1, av:-4, props:"Combi, Very Reliable" }),
  W(LAS, "Эльдарский Лазкарабин", { c:"basic", t:"laser", rng:100, rof:"S/3/5", dmg:"1d10+4 E(Ls)", pen:2, clip:120, rld:"½", wt:1.5, av:-4, props:"Carbine, Very Reliable" }),
  W(LAS, "Эльдарский Лазган", { c:"basic", t:"laser", rng:125, rof:"S/3/–", dmg:"1d10+4 E(Ls)", pen:2, clip:120, rld:"½", wt:2.5, av:-4, props:"Carbine, Eldar Precise, Very Reliable" }),
  W(LAS, "Пистолет Лазбластер", { c:"pistol", t:"laser", rng:60, rof:"S/2/–", dmg:"1d10+4 E(Ls)", pen:4, clip:60, rld:"½", wt:1, av:-1, props:"Proven (2), Very Reliable" }),
  W(LAS, "Лазбластер", { c:"basic", t:"laser", rng:150, rof:"S/4/8", dmg:"1d10+4 E(Ls)", pen:2, clip:120, rld:"½", wt:2, av:-2, props:"Proven (3), Very Reliable" }),
  W(LAS, "Скорострельный Лазбластер", { c:"basic", t:"laser", rng:125, rof:"S/6/12", dmg:"1d10+3 E(Ls)", pen:2, clip:160, rld:"1", wt:2, av:1, props:"Proven (2), Very Reliable" }),
  W(LAS, "Тяжёлый Лазбластер", { c:"heavy", t:"laser", rng:200, rof:"S/2/–", dmg:"3d10+8 E(Ls)", pen:4, clip:200, rld:"2", wt:10, av:3, props:"Felling (6), Proven (5), Very Reliable" }),
  W(LAS, "Винтовка Рейнджера", { c:"basic", t:"laser", rng:200, rof:"S/2/–", dmg:"1d10+6 E(Ls)", pen:4, clip:120, rld:"1", wt:3, av:2, props:"Eldar Accurate, Eldar Precise, Extreme (9), Felling (4), Reliable +Djinn-Scope, Fish-Eye Sight, Infra-Red, Ion Precharger, Oculus Scope" }),
  W(LAS, "Длинная Винтовка Рейнджера", { c:"basic", t:"laser", rng:400, rof:"S/–/–", dmg:"1d10+9 E(Ls)", pen:4, clip:120, rld:"2", wt:4, av:4, props:"Aspect (Рейнджеры), Eldar Accurate, Eldar Precise, Extreme (7), Felling (8), Reliable +Infra-Red, Ion Precharger, Omni-Scope" }),
  W(LAS, "Лазбластер Пикирующих Ястребов", { c:"basic", t:"laser", rng:150, rof:"S/4/8", dmg:"1d10+5 E(Ls)", pen:4, clip:120, rld:"1", wt:2.5, av:2, props:"Aspect (Пикирующие Ястребы), Carbine, Eldar Precise, Proven (3), Very Reliable" }),
  W(LAS, "Сметающий Облака", { c:"basic", t:"laser", rng:100, rof:"–/3/–", dmg:"1d10+5 E(Ls)", pen:3, clip:120, rld:"2", wt:2.5, av:2, props:"Aspect (Пикирующие Ястребы), Carbine, Extreme (9), Proven (3), Very Reliable +Motion Predictor" }),
  W(LAS, "Коготь Ястреба", { c:"basic", t:"laser", rng:200, rof:"S/3/–", dmg:"2d10+6 E(Ls)", pen:4, clip:120, rld:"1", wt:3, av:4, props:"Aspect (Пикирующие Ястребы), Eldar Precise, Extreme (9), Proven (5), Very Reliable +Motion Predictor", note:"В Упор: Lance." }),
  W(LAS, "Лазерное Копьё", { c:"basic", t:"laser", rng:3, rof:"S/–/–", dmg:"2d10+8 E(Ls)", pen:6, clip:30, rld:"4", wt:6, av:3, props:"Aspect (Сияющие Копья), Extreme (9), Lance, Proven (3), Very Reliable", note:"Раскрывается на байке/скакуне с Верховной Атакой." }),
  W(LAS, "Звёздное Копьё", { c:"basic", t:"laser", rng:3, rof:"S/–/–", dmg:"3d10+9 E(Ls)", pen:10, clip:30, rld:"4", wt:6, av:4, props:"Aspect (Сияющие Копья), Extreme (7), Lance, Proven (5), Very Reliable" }),
  W(LAS, "Солнечный Пистолет", { c:"pistol", t:"laser", rng:100, rof:"S/3/–", dmg:"1d10+4 E(Ls)", pen:4, clip:120, rld:"½", wt:1.5, av:4, props:"Aspect (Пикирующие Ястребы), Lance, Very Reliable", note:"Proven = успехам атаки (до 10); за чётный успех +1 Dmg/Pen." }),
  W(LAS, "Солнечная Винтовка", { c:"basic", t:"laser", rng:150, rof:"S/3/–", dmg:"2d10+4 E(Ls)", pen:4, clip:180, rld:"2", wt:2, av:4, props:"Aspect (Пикирующие Ястребы), Extreme (9), Scatter, Very Reliable" }),
  W(LAS, "Рассеивающий Лазер (Sierbahn)", { c:"heavy", t:"laser", rng:150, rof:"S/3/6", dmg:"2d10+8 E(Ls)", pen:4, clip:360, rld:"2", wt:30, av:3, props:"Impulse, Reliable, Storm (2), Twin-Linked", note:"Стволы можно разделять (теряя Twin-Linked); в одну цель — Storm (3), Surge (2)." }),
  W(LAS, "Сияющее Копьё", { c:"heavy", t:"laser", rng:400, rof:"S/–/–", dmg:"5d10+10 E(Ls)", pen:15, clip:10, rld:"2", wt:30, av:3, props:"Eldar Precise, Proven (5), Through Shot", note:"Против укрытий ×2 Pen." }),
  W(LAS, "Импульсный Пистолет", { c:"pistol", t:"laser", rng:30, rof:"S/5/8", dmg:"1d10+4 E(Ls)", pen:2, clip:120, rld:"½", wt:1, av:1, props:"Impulse, Storm (2), Very Reliable" }),
  W(LAS, "Импульсная Винтовка", { c:"basic", t:"laser", rng:70, rof:"S/6/10", dmg:"1d10+4 E(Ls)", pen:2, clip:180, rld:"1", wt:3, av:2, props:"Impulse, Storm (2), Very Reliable" }),
  W(LAS, "Импульсная Пушка", { c:"heavy", t:"laser", rng:100, rof:"–/8/16", dmg:"2d10+4 E(Ls)", pen:3, clip:360, rld:"2", wt:20, av:3, props:"Impulse, Storm (3), Very Reliable" }),
  W(LAS, "Импульсный Лазер", { c:"heavy", t:"laser", rng:300, rof:"S/4/6", dmg:"3d10+8 E(Ls)", pen:8, clip:360, rld:"2", wt:75, av:4, props:"Impulse, Reliable, Storm (2), Twin-Linked" }),
  W(LAS, "Бедосвет", { c:"pistol", t:"laser", rng:30, rof:"–/–/4", dmg:"1d10+5 E(Ls)", pen:4, clip:16, rld:"½", wt:1, av:2, props:"Blinding (1), Storm (4), Very Reliable", note:"Нельзя прицеливание/избирательные атаки." }),
  W(LAS, "Мандибластеры", { c:"pistol", t:"laser", rng:2, rof:"S/2/4", dmg:"1d10+4 E(Ls)", pen:4, clip:10, rld:"2", wt:0.1, av:3, props:"Aspect (Жалящие Скорпионы), Eldar Precise, Independent, Very Reliable", note:"Всегда В Упор; +40 к стрельбе." }),
  W(LAS, "Длинная Винтовка Ульданоретхи", { c:"basic", t:"laser", rng:400, rof:"S/–/–", dmg:"1d10+9 E(Ls)", pen:4, clip:120, rld:"2", wt:4, av:5, props:"Aspect (Рейнджеры), Eldar Accurate, Eldar Precise, Extreme (6), Felling (8), Reliable +Infra-Red, Ion Precharger, Omni-Scope", note:"Автоуспех Survival в дикой природе; +5 I." }),
  W(LAS, "Новокопьё Сайм-Ханна", { c:"basic", t:"laser", rng:3, rof:"S/–/–", dmg:"4d10+15 E(Ls)", pen:20, clip:30, rld:"4", wt:6, av:5, props:"Aspect (Сияющие Копья), Extreme (6), Proven (6), Lance, Very Reliable" }),
  W(LAS, "Дыхание Иннеада", { c:"basic", t:"laser", rng:400, rof:"S/–/–", dmg:"1d10+10 E(Ls)", pen:5, clip:120, rld:"1", wt:4, av:5, props:"Aspect (Рейнджеры), Eldar Accurate, Eldar Precise, Extreme (6), Felling (8), Reliable +Infra-Red, Ion Precharger, Omni-Scope", note:"Бесшумна, невидима в тепле; тест BS+20 vs Awareness(P)−30 → Незримая атака." }),

  // ─────────────────────────── МОНОСЕТЕВОЕ ───────────────────────────
  W(MON, "Моносетевой Пистолет", { c:"pistol", t:"monofilament", rng:20, rof:"S/2/–", dmg:"1d10+1 R", pen:1, clip:5, rld:"½", wt:1, av:1, props:"Imprecise, Monofilament (1), Spray, Very Reliable" }),
  W(MON, "Моносетевая Винтовка", { c:"basic", t:"monofilament", rng:30, rof:"S/2/–", dmg:"1d10+1 R", pen:1, clip:10, rld:"1", wt:3, av:1, props:"Imprecise, Monofilament (2), Spray, Very Reliable" }),
  W(MON, "Тяжёлая Моносетевая Винтовка", { c:"basic", t:"monofilament", rng:40, rof:"S/2/–", dmg:"1d10+2 R", pen:2, clip:15, rld:"2", wt:5, av:2, props:"Imprecise, Monofilament (3), Spray, Very Reliable" }),
  W(MON, "Смертопряд", { c:"basic", t:"monofilament", rng:40, rof:"S/3/–", dmg:"1d10+8 R", pen:5, clip:30, rld:"1", wt:5, av:3, props:"Aspect (Варп-Пауки), Eldar Razor Sharp, Linger (1d3+1/10), Monofilament (3), Spray, Tearing, Reliable" }),
  W(MON, "Смертоткач", { c:"pistol", t:"monofilament", rng:20, rof:"S/3/–", dmg:"1d10+6 R", pen:4, clip:10, rld:"½", wt:2, av:3, props:"Aspect (Варп-Пауки), Eldar Razor Sharp, Linger (2/5), Monofilament (2), Spray, Tearing, Very Reliable, Wrist", note:"При реквизиции выдаётся пара." }),
  W(MON, "Монопряд", { c:"heavy", t:"monofilament", rng:100, rof:"S/3/–", dmg:"1d10+5 R", pen:4, clip:5, rld:"2", wt:5, av:2, props:"Arcing, Blast (5), Imprecise, Monofilament (3), Tearing, Reliable" }),
  W(MON, "Тяжёлый Монопряд", { c:"heavy", t:"monofilament", rng:150, rof:"S/3/–", dmg:"1d10+5 R", pen:4, clip:10, rld:"4", wt:10, av:3, props:"Arcing, Blast (10), Imprecise, Monofilament (4), Tearing, Reliable" }),
  W(MON, "Тенепряд", { c:"heavy", t:"monofilament", rng:250, rof:"S/4/6", dmg:"1d10+10 R", pen:4, clip:50, rld:"4", wt:25, av:3, props:"Arcing, Blast (15), Imprecise, Monofilament (5), Tearing, Very Reliable" }),
  W(MON, "Мононитевый Пистолет", { c:"pistol", t:"monofilament", rng:20, rof:"S/2/–", dmg:"1d10+2 R", pen:4, clip:5, rld:"½", wt:2, av:2, props:"Eldar Razor Sharp, Eldar Precise, Monofilament (0), Reliable", note:"Бонусы по дистанции (см. справочник)." }),
  W(MON, "Мононитевая Винтовка", { c:"basic", t:"monofilament", rng:30, rof:"S/2/–", dmg:"1d10+2 R", pen:4, clip:10, rld:"1", wt:3, av:3, props:"Eldar Razor Sharp, Eldar Precise, Monofilament (1), Reliable" }),
  W(MON, "Прядильщик", { c:"basic", t:"monofilament", rng:60, rof:"S/3/–", dmg:"1d10+8 R", pen:4, clip:10, rld:"2", wt:8, av:4, props:"Aspect (Варп-Пауки), Eldar Precise, Eldar Razor Sharp, Monofilament (2), Tearing" }),
  W(MON, "Душесеть", { c:"basic", t:"monofilament", rng:50, rof:"S/–/–", dmg:"1d10+1 R", pen:8, clip:10, rld:"2", wt:3, av:5, props:"Imprecise, Monofilament (2), Spray, Very Reliable, Warp Weapon" }),

  // ─────────────────────────── ПЛАЗМЕННОЕ ───────────────────────────
  W(PLA, "Звёздный Пистолет", { c:"pistol", t:"plasma", rng:40, rof:"S/3/–", dmg:"2d10+10 E", pen:10, clip:12, rld:"2", wt:2.5, av:2, props:"Blast (2), Reliable", note:"Всегда стреляет в режиме Maximal без Recharge и удвоения расхода." }),
  W(PLA, "Звёздная Винтовка", { c:"basic", t:"plasma", rng:120, rof:"S/4/–", dmg:"2d10+12 E", pen:12, clip:24, rld:"3", wt:5, av:2, props:"Blast (2), Reliable" }),
  W(PLA, "Звёздная Пушка", { c:"heavy", t:"plasma", rng:250, rof:"S/3/–", dmg:"3d10+12 E", pen:14, clip:32, rld:"5", wt:25, av:3, props:"Blast (6), Reliable" }),
  W(PLA, "Новапушка", { c:"heavy", t:"plasma", rng:350, rof:"S/–/–", dmg:"3d10+18 E", pen:15, clip:32, rld:"10", wt:50, av:4, props:"Blast (10), Reliable", note:"После выстрела −1 надёжность; Tech-Use(I)+20 восстанавливает." }),
  W(PLA, "Звёздный Повторитель", { c:"basic", t:"plasma", rng:50, rof:"S/4/6", dmg:"2d10+8 E", pen:10, clip:24, rld:"3", wt:6, av:3, props:"Reliable" }),
  W(PLA, "Жнец", { c:"basic", t:"plasma", rng:180, rof:"S/–/–", dmg:"2d10+14 E", pen:12, clip:32, rld:"5", wt:12, av:4, props:"Blast (8), Spray", note:"Spray на 30м: 1d10+10 E(Fl), 5 Pen, Blinding (0), Flame (2d10)." }),

  // ─────────────────────────── ФУЗИОННОЕ ───────────────────────────
  W(FUS, "Фузионный Пистолет", { c:"pistol", t:"fusion", rng:20, rof:"S/–/–", dmg:"2d10+14 E", pen:15, clip:6, rld:"1", wt:2, av:2, props:"Melta, Reliable" }),
  W(FUS, "Фузионная Винтовка", { c:"basic", t:"fusion", rng:30, rof:"S/–/–", dmg:"2d10+14 E", pen:15, clip:15, rld:"2", wt:4.5, av:2, props:"Imprecise, Melta, Reliable" }),
  W(FUS, "Поцелуй Воздушных Налётчиков", { c:"basic", t:"fusion", rng:40, rof:"S/3/5", dmg:"2d10+14 E", pen:15, clip:20, rld:"2", wt:10, av:3, props:"Melta, Very Reliable" }),
  W(FUS, "Огненная Пика", { c:"basic", t:"fusion", rng:100, rof:"S/–/–", dmg:"5d10+20 E", pen:20, clip:5, rld:"3", wt:10, av:4, props:"Aspect (Огненные Драконы), Eldar Accurate, Melta, Very Reliable, Wrecker (5)", note:"В Упор: Proven (6)." }),
  W(FUS, "Гнев Дракона", { c:"pistol", t:"fusion", rng:5, rof:"S/–/–", dmg:"2d10+25 E", pen:40, clip:1, rld:"10", wt:2.1, av:4, props:"Aspect (Огненные Драконы), Flame (3d10), Independent, Imprecise, Linger (3), Very Reliable", note:"Создаёт стену пламени (Linger), 180° (см. справочник)." }),
  W(FUS, "Око Ак-Аэлрона", { c:"pistol", t:"fusion", rng:20, rof:"S/–/–", dmg:"2d10+14 E", pen:20, clip:6, rld:"1", wt:2.1, av:4, props:"Aspect (Огненные Драконы), Eldar Accurate, Eldar Precise, Melta, Reliable, Wrecker (2)", note:"Всегда с бонусами Полного Прицеливания." }),

  // ─────────────────────────── ОГНЕМЁТЫ ───────────────────────────
  W(FLM, "Пистолет Драконьего Дыхания", { c:"pistol", t:"flame", rng:20, rof:"S/2/–", dmg:"1d10+10 E", pen:4, clip:5, rld:"½", wt:2.5, av:1, props:"Flame, Linger (1d5), Spray" }),
  W(FLM, "Огнемёт Драконьего Дыхания", { c:"basic", t:"flame", rng:30, rof:"S/2/–", dmg:"1d10+12 E", pen:4, clip:15, rld:"1", wt:5, av:0, props:"Flame, Linger (1d10), Spray" }),
  W(FLM, "Тяжёлый Огнемёт Драконьего Дыхания", { c:"basic", t:"flame", rng:40, rof:"S/3/–", dmg:"1d10+13 E", pen:4, clip:20, rld:"2", wt:10, av:2, props:"Flame (2d10), Linger (1d10), Spray", note:"Конус Spray 90°." }),
  W(FLM, "Кузница Ваула", { c:"heavy", t:"flame", rng:50, rof:"S/2/–", dmg:"2d10+12 E", pen:10, clip:15, rld:"4", wt:60, av:4, props:"Aspect (Огненные Драконы), Blinding (3), Flame (3d10), Linger (2d10), Spray, Wrecker (2)", note:"Аура 30м: E(Fl) +1 кубик." }),
  W(FLM, "Гнев Кхейна", { c:"basic", t:"flame", rng:40, rof:"S/2/–", dmg:"1d10+8 E", pen:3, clip:15, rld:"1", wt:12, av:4, props:"Aspect (Огненные Драконы), Flame (2d10), Linger (1d10), Spray", note:"+1 кубик в Ярости; +1 при наличии цели с Hatred. Игнорирует Cooler." }),

  // ─────────────────────────── ИГОЛЬНОЕ ───────────────────────────
  W(NDL, "Игольный Пистолет", { c:"pistol", t:"needler", rng:20, rof:"S/2/3", dmg:"1d10+4 R", pen:0, clip:20, rld:"½", wt:0.5, av:1, props:"Eldar Accurate, Eldar Precise, Primitive, Toxic (1) +Ammo Selector, Scope" }),
  W(NDL, "Игольная Винтовка", { c:"basic", t:"needler", rng:50, rof:"S/2/3", dmg:"1d10+8 R", pen:0, clip:40, rld:"1", wt:1, av:1, props:"Eldar Accurate, Eldar Precise, Primitive, Toxic (1) +Ammo Selector, Scope" }),
  W(NDL, "Снайперская Игольная Винтовка", { c:"basic", t:"needler", rng:150, rof:"S/–/–", dmg:"1d10+10 R", pen:0, clip:50, rld:"2", wt:5, av:3, props:"Crippling (4), Eldar Accurate, Eldar Precise, Primitive, Toxic (2) +Ammo Selector, Scope" }),

  // ─────────────────────────── ПРИЗМЕННОЕ ───────────────────────────
  W(PRI, "Винтовка Теневого Фантома", { c:"basic", t:"prisma", rng:30, rof:"S/2/3", dmg:"1d10+8+(2×X) E", pen:0, clip:60, rld:"2", wt:5, av:4, props:"Aspect (Теневые Фантомы), Maximal, Prisma (3)", note:"Дальность 30×X м; Pen 2×X; Blast (½ X); Devastating (½ X) — масштаб от зарядов X." }),
  W(PRI, "Призменный Бластер", { c:"basic", t:"prisma", rng:50, rof:"S/2/3", dmg:"1d10+10+(3×X) E", pen:0, clip:60, rld:"3", wt:15, av:5, props:"Aspect (Теневые Фантомы), Maximal, Prisma (6)", note:"Дальность 50×X м; Pen 3×X; Blast (X); Devastating (X). Призма заряжается ×2." }),

  // ─────────────────────────── РАКЕТНЫЕ УСТАНОВКИ ───────────────────────────
  W(LCH, "Эльдарская Ракетница", { c:"launcher", t:"launcher", rng:250, rof:"S/2/–", dmg:"", pen:0, clip:10, rld:"2", wt:10, av:-1, props:"Arcing, Imprecise, Reliable +Ammo Selector", note:"Использует ракеты (см. боеприпасы). Тесты Arcing +40." }),
  W(LCH, "Ракетница Жнеца", { c:"launcher", t:"launcher", rng:350, rof:"S/2/3", dmg:"", pen:0, clip:15, rld:"4", wt:15, av:3, props:"Aspect (Тёмные Жнецы), Anti-Air, Arcing, Imprecise, Reliable +Ammo Selector", note:"Использует ракеты. Дальномер Тёмных Жнецов." }),
  W(LCH, "Потоковая Ракетница Жнеца", { c:"launcher", t:"launcher", rng:350, rof:"S/3/6", dmg:"", pen:0, clip:30, rld:"6", wt:40, av:3, props:"Aspect (Тёмные Жнецы), Anti-Air, Arcing, Imprecise, Reliable, Revolver +Ammo Selector", note:"Использует ракеты." }),
  W(LCH, "Ракетница Бури", { c:"launcher", t:"launcher", rng:500, rof:"S/3/6", dmg:"", pen:0, clip:30, rld:"4", wt:20, av:4, props:"Aspect (Тёмные Жнецы), Anti-Air, Arcing, Imprecise, Twin-Linked, Very Reliable +Ammo Selector", note:"Использует ракеты." }),
  W(LCH, "Череп Храма", { c:"launcher", t:"launcher", rng:500, rof:"S/3/8", dmg:"", pen:0, clip:40, rld:"4", wt:20, av:5, props:"Aspect (Тёмные Жнецы), Anti-Air, Arcing, Imprecise, Twin-Linked, Very Reliable, Wrecker (3) +Ammo Selector", note:"Использует ракеты." }),
  W(LCH, "ЭМИ Ракетница", { c:"launcher", t:"launcher", rng:400, rof:"S/–/–", dmg:"", pen:0, clip:5, rld:"10", wt:15, av:5, props:"Aspect (Теневые Фантомы), Anti-Air, Arcing, Haywire (20, 2d10+5), Imprecise, Very Reliable", note:"Уникальные ЭМИ-снаряды (R4)." }),
  W(LCH, "Набор Гранат Пикирующих Ястребов", { c:"launcher", t:"launcher", rng:50, rof:"S/–/–", dmg:"", pen:0, clip:3, rld:"1", wt:5, av:3, props:"Aspect (Пикирующие Ястребы), Independent", note:"Использует гранаты; Compact (в расчёте разгрузок). Переключение между 3 гранатами." }),

  // ─────────────────────────── РАКЕТЫ (боеприпасы) ───────────────────────────
  W(RKT, "Ракета: Солнечная Вспышка", { c:"launcher", t:"rocket", dmg:"2d10+7 E", pen:5, wt:0.1, av:-2, props:"Blast (5), Devastating (2), Storm (2)" }),
  W(RKT, "Ракета: Звёздный Выстрел", { c:"launcher", t:"rocket", dmg:"3d10+12 E", pen:9, wt:0.1, av:-1, props:"Concussive (3), Proven (4)" }),
  W(RKT, "Ракета: Звёздный Рой", { c:"launcher", t:"rocket", dmg:"2d10+4 E", pen:4, wt:0.5, av:1, props:"Blast (3), Devastating (5), Storm (4)" }),
  W(RKT, "Ракета: Моновыстрел", { c:"launcher", t:"rocket", dmg:"1d10+8 R", pen:4, wt:0.1, av:1, props:"Blast (8), Devastating (3), Monofilament (2)" }),
  W(RKT, "Ракета: ЭМИ", { c:"launcher", t:"rocket", dmg:"†", pen:0, wt:0.1, av:2, props:"Haywire (5, 3d5)" }),
  W(RKT, "Ракета: Вибро", { c:"launcher", t:"rocket", dmg:"2d10+9 X", pen:7, wt:0.3, av:3, props:"Blast (3), Concussive (3), Devastating (5), Vibro (2)" }),

  // ─────────────────────────── ГРАНАТЫ И БОМБЫ ───────────────────────────
  W(GRN, "Граната: Плазменная", { c:"thrown", t:"grenade", dmg:"2d10+6 E", pen:6, wt:0.2, av:-1, props:"Blinding (0), Blast (4)" }),
  W(GRN, "Граната: Моносетевая", { c:"thrown", t:"grenade", dmg:"1d10+5 R", pen:3, wt:0.1, av:-1, props:"Blast (4), Monofilament (2)" }),
  W(GRN, "Граната: Проволочная", { c:"thrown", t:"grenade", dmg:"1d10+4 R", pen:3, wt:0.1, av:0, props:"Blast (4), Monofilament (2)", note:"Всегда в ногу; Monofilament авто в сочленение." }),
  W(GRN, "Граната: Психокостяная", { c:"thrown", t:"grenade", dmg:"1d5+6 E", pen:0, wt:0.1, av:0, props:"Blast (2), Shocking, Warp Weapon" }),
  W(GRN, "Граната: Спазменная", { c:"thrown", t:"grenade", dmg:"3d10+5 I", pen:0, wt:0.1, av:0, props:"Blast (6), Shocking", note:"Урон делится между S и T; Shocking T−10." }),
  W(GRN, "Граната: Солнечная", { c:"thrown", t:"grenade", dmg:"†", pen:0, wt:0.5, av:1, props:"Blast (15), Blinding (2)" }),
  W(GRN, "Граната: ЭМИ", { c:"thrown", t:"grenade", dmg:"†", pen:0, wt:0.5, av:3, props:"Haywire (8, 3d5)" }),
  W(GRN, "Граната: Галлюциногенная", { c:"thrown", t:"grenade", dmg:"†", pen:0, wt:0.5, av:3, props:"Blast (8), Hallucinogenic (3)" }),
  W(GRN, "Граната: Фузионный Диск", { c:"thrown", t:"grenade", dmg:"6d10 E", pen:25, wt:5, av:3, props:"Aspect (Огненные Драконы/Пикирующие Ястребы), Blast (4), Melta", note:"Метание −20; прямое попадание (центр) — Lance." }),
  W(GRN, "Граната: Антигравитационная", { c:"thrown", t:"grenade", dmg:"†", pen:0, wt:1, av:3, props:"Aspect (Тёмные Жнецы), Blast (10), Graviton", note:"Трудный Ландшафт−30." }),
  W(GRN, "Граната: Мерцающая Сфера", { c:"thrown", t:"grenade", dmg:"†", pen:0, wt:1, av:3, props:"Aspect (Варп-Пауки), Blast (15)", note:"Поглощает вражеские выстрелы из выбранной арки 180° (см. справочник)." }),

  // ═══════════════════════════ РУКОПАШНОЕ: ЦЕПНОЕ ═══════════════════════════
  M(CHN, "Эльдарский Пилонож", { t:"chain", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"1d5+3 R", pen:3, props:"Eldar Precise, Tearing", bl:1, wt:0.1, av:-1 }),
  M(CHN, "Эльдарский Пилокортик", { t:"chain", grip:"1р [Об]", form:"Меч", reach:"1–3", dmg:"1d10+3 R", pen:3, props:"Eldar Precise, Tearing", bl:2, wt:0.2, av:-1 }),
  M(CHN, "Эльдарский Облегчённый Пилокортик", { t:"chain", grip:"1р [Об]", form:"Меч", reach:"1–3", dmg:"1d10+2 R", pen:2, props:"Cheap Shot, Eldar Precise, Tearing", bl:2, wt:0.1, av:-1 }),
  M(CHN, "Эльдарский Пиломеч", { t:"chain", grip:"1р [2р, Об, Бл, Мх]", form:"Меч", reach:"2–4", dmg:"1d10+3 R", pen:3, props:"Step By Step, Tearing", bl:2, wt:1, av:-1 }),
  M(CHN, "Эльдарский Двуручный Пиломеч", { t:"chain", grip:"2р [Бл, Мх]", form:"Меч", reach:"3–6", dmg:"2d10+3 R", pen:3, props:"Tearing", bl:1, wt:1.5, av:0 }),
  M(CHN, "Эльдарская Пилосабля", { t:"chain", grip:"1р [2р, Об]", form:"Сабля", reach:"2–3", dmg:"1d10+3 R", pen:3, props:"Dueling Weapon, Tearing", bl:2, wt:1, av:0 }),
  M(CHN, "Эльдарский Пилотопор", { t:"chain", grip:"1р [2р, Кл]", form:"Топор", reach:"3", dmg:"1d10+4 R", pen:4, props:"Tearing", bl:0, wt:1, av:1 }),
  M(CHN, "Эльдарский Длинный Пиломеч", { t:"chain", grip:"2р [1р, Бл, Мх]", form:"Меч", reach:"2–5", dmg:"1d10+5 R", pen:3, props:"Tearing", bl:2, wt:1, av:0 }),
  M(CHN, "Эльдарская Пилосекира", { t:"chain", grip:"2р [1р, Бл, 1р+Кл]", form:"Топор", reach:"4", dmg:"2d10+4 R", pen:5, props:"Tearing", bl:0, wt:2.5, av:1, note:"Также головы: Крюк 2d10+3 R, Pen 6, Felling (2); Посох (2–4) 1d10 I(Cr)." }),
  M(CHN, "Эльдарское Пилокопьё", { t:"chain", grip:"2р [1р, Бл, 1р+Об]", form:"Копьё", reach:"4–6", dmg:"1d10+7 R", pen:4, props:"Step By Step, Tearing", bl:1, wt:1, av:0, note:"Посох (2–4): 1d10 I(Cr), Pen 1." }),
  M(CHN, "Эльдарская Пилоглефа", { t:"chain", grip:"2р [Бл]", form:"Глефа", reach:"4–6", dmg:"1d10+7 R", pen:4, props:"Step By Step, Tearing", bl:1, wt:1.5, av:0, note:"Посох (2–4): 1d10 I(Cr), Pen 1." }),
  M(CHN, "Эльдарская Пилокоса", { t:"chain", grip:"2р [Бл]", form:"Крюк", reach:"4", dmg:"2d10+5 R", pen:4, props:"Devastating (2), Extreme (8), Felling (2), Tearing", bl:-1, wt:2, av:1, note:"Посох (2–4): 1d10 I(Cr), Pen 1." }),
  M(CHN, "Хвост Скорпиона", { t:"chain", grip:"1р [Об]", form:"Рапира", reach:"1–4", dmg:"1d10+3 R", pen:3, props:"Aspect (Жалящие Скорпионы), Eldar Precise, Tearing, Toxic (2)", bl:1, wt:0.5, av:2, note:"В сочленение: Toxic +1." }),
  M(CHN, "Пиломеч Скорпиона", { t:"chain", grip:"1р [2р, Об, Бл, Мх]", form:"Меч", reach:"2–4", dmg:"1d10+3 R", pen:3, props:"Aspect (Жалящие Скорпионы), Dueling Weapon, Step By Step, Tearing", bl:2, wt:1, av:2 }),
  M(CHN, "Двуручный Меч Скорпиона", { t:"chain", grip:"2р [Бл, Мх]", form:"Меч", reach:"3–6", dmg:"2d10+3 R", pen:3, props:"Aspect (Жалящие Скорпионы), Reinforced, Step By Step, Tearing", bl:1, wt:1.5, av:3 }),
  M(CHN, "Кусающий Клинок", { t:"chain", grip:"2р [Бл, Мх]", form:"Сабля", reach:"3–6", dmg:"2d10+3 R", pen:10, props:"Aspect (Жалящие Скорпионы), Dueling Weapon, Extreme (7), Power Field, Proven (4), Reinforced, Step By Step, Tearing", bl:1, wt:3, av:4, note:"После боя 1d10 затупленных зубцов = −Pen (уход)." }),
  M(CHN, "Пилосабли", { t:"chain", grip:"П+Л", form:"Когти.П", reach:"1–3", dmg:"1d10+5 R", pen:4, props:"Aspect (Жалящие Скорпионы), Dueling Weapon, Reinforced, Step By Step, Tearing", bl:1, wt:2.5, av:4, note:"Встроены 2 сюрикен-пистолета (Independent); каждая атака удваивается." }),
  M(CHN, "Кулак Тысячи Клинков", { t:"chain", grip:"П", form:"Когти.П / Крюк / Нож", reach:"0–4", dmg:"1d10 R", pen:4, props:"Crunch, Mighty, Reinforced, Tearing", bl:1, wt:2.5, av:3, note:"Exotic. Рука +10 Парир./Финт; +2 Rng оружию в этой руке." }),
  M(CHN, "Зуб Дракона", { t:"chain", grip:"1р [2р, Об, Бл, Мх]", form:"Меч", reach:"2–5", dmg:"1d10+8 R", pen:8, props:"Aspect (Жалящие Скорпионы), Corrosive (1), Dueling Weapon, Power Field, Reinforced, Step By Step, Tearing", bl:2, wt:2, av:5, note:"+Inf.b к урону. Всегда шумит." }),
  M(CHN, "Теневое Жало", { t:"chain", grip:"2р [Бл, Мх]", form:"Меч", reach:"3–6", dmg:"1d10+8 R", pen:12, props:"Aspect (Жалящие Скорпионы), Dueling Weapon, Extreme (9), Mighty, Reinforced, Step By Step, Tearing", bl:1, wt:2, av:0, note:"Экстрем. урон → WS+10: +1 за чётный успех." }),

  // ═══════════════════════════ РУКОПАШНОЕ: СИЛОВОЕ ═══════════════════════════
  M(POW, "Эльдарская Силовая Перчатка", { t:"power", grip:"Л", form:"Кулак.Б", reach:"0", dmg:"1d10+6 E", pen:6, props:"Crunch, Imprecise, Power Field", bl:0, wt:1, av:2 }),
  M(POW, "Эльдарский Силовой Нож", { t:"power", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"1d5+6 E", pen:6, props:"Eldar Precise, Power Field", bl:1, wt:0.1, av:2 }),
  M(POW, "Эльдарский Силовой Меч", { t:"power", grip:"1р [2р, Об]", form:"Меч", reach:"2–4", dmg:"1d10+6 E", pen:6, props:"Dueling Weapon, Power Field, Step By Step", bl:2, wt:0.5, av:2 }),
  M(POW, "Эльдарская Силовая Рапира", { t:"power", grip:"1р [Об]", form:"Рапира", reach:"3–5", dmg:"1d10+6 E", pen:6, props:"Eldar Precise, Power Field, Step By Step", bl:2, wt:0.5, av:2 }),
  M(POW, "Эльдарская Силовая Сабля", { t:"power", grip:"1р [2р, Об]", form:"Сабля", reach:"2–3", dmg:"1d10+6 E", pen:6, props:"Dueling Weapon, Eldar Precise, Power Field", bl:2, wt:0.5, av:2 }),
  M(POW, "Эльдарский Силовой Топор", { t:"power", grip:"1р [2р, Кл]", form:"Топор", reach:"3", dmg:"1d10+7 E", pen:7, props:"Power Field", bl:1, wt:1, av:2 }),
  M(POW, "Эльдарская Силовая Булава", { t:"power", grip:"1р [2р]", form:"Булава", reach:"3", dmg:"1d10+7 E", pen:5, props:"Power Field", bl:1, wt:0.5, av:2, note:"В 2р хвате: Concussive (0)." }),
  M(POW, "Эльдарский Силовой Кистень", { t:"power", grip:"1р [2р]", form:"Кистень", reach:"4", dmg:"1d10+7 E", pen:5, props:"Power Field", bl:0, wt:0.5, av:2, note:"В 2р хвате: Concussive (0)." }),
  M(POW, "Эльдарский Длинный Силовой Меч", { t:"power", grip:"2р [1р]", form:"Меч", reach:"2–5", dmg:"1d10+8 E", pen:6, props:"Power Field", bl:2, wt:1, av:2 }),
  M(POW, "Эльдарский Двуручный Силовой Меч", { t:"power", grip:"2р", form:"Меч", reach:"3–6", dmg:"2d10+7 E", pen:6, props:"Power Field", bl:1, wt:1.5, av:2 }),
  M(POW, "Эльдарская Силовая Секира", { t:"power", grip:"2р [1р, Бл, 1р+Кл]", form:"Топор", reach:"4", dmg:"2d10+7 E", pen:8, props:"Power Field", bl:0, wt:2.5, av:2, note:"Крюк: 2d10+7 E, Pen 6, Concussive (1), Power Field; Посох (2–4): 1d10 I(Cr)." }),
  M(POW, "Эльдарская Силовая Коса", { t:"power", grip:"2р [Бл]", form:"Крюк", reach:"4", dmg:"2d10+8 E", pen:7, props:"Devastating (2), Extreme (8), Felling (4), Power Field", bl:-1, wt:2, av:2, note:"Посох (2–4): 1d10 I(Cr)." }),
  M(POW, "Эльдарское Силовое Копьё", { t:"power", grip:"2р [1р, Бл, 1р+Об]", form:"Копьё", reach:"5–7", dmg:"1d10+6 E", pen:6, props:"Step By Step, Power Field", bl:1, wt:1, av:2, note:"Посох (2–4): 1d10 I(Cr)." }),
  M(POW, "Эльдарская Силовая Глефа", { t:"power", grip:"2р [Бл]", form:"Глефа", reach:"4–6", dmg:"1d10+10 E", pen:7, props:"Step By Step, Power Field", bl:2, wt:1.5, av:2, note:"Посох (2–4): 1d10 I(Cr)." }),
  M(POW, "Эльдарская Силовая Алебарда", { t:"power", grip:"2р [Бл]", form:"Глефа", reach:"4–5", dmg:"2d10+7 E", pen:8, props:"Step By Step, Power Field", bl:2, wt:1.5, av:2, note:"Крюк: 2d10+6 E, Pen 9, Felling (4), Power Field, Step By Step; Копьё (5–6): 1d10+6 E, Pen 6; Посох (2–4): 1d10 I(Cr)." }),
  M(POW, "Эльдарский Силовой Кнут", { t:"power", grip:"1р", form:"Кнут", reach:"5–7", dmg:"1d10+5 E", pen:5, props:"Flexible, Power Field", bl:0, wt:0.2, av:2 }),
  M(POW, "Меч Воющей Баньши", { t:"power", grip:"1р [2р, Об]", form:"Меч", reach:"1–4", dmg:"1d10+10 E", pen:6, props:"Aspect (Воющие Баньши), Felling (4), Power Field", bl:2, wt:1, av:3 }),
  M(POW, "Скорпионья Клешня", { t:"power", grip:"Л", form:"Кулак.Б", reach:"0", dmg:"2d10+1 E", pen:9, props:"Aspect (Жалящие Скорпионы), Crunch, Imprecise, Mighty, Power Field", bl:1, wt:2, av:3, note:"Атаки +2 Размера; +20 S; встроена Сюрикен Катапульта (Independent)." }),
  M(POW, "Скорпионий Хват", { t:"power", grip:"Л+П", form:"Когти.П", reach:"1–2", dmg:"1d10+2 E", pen:6, props:"Aspect (Жалящие Скорпионы), Power Field, Reinforced", bl:1, wt:3, av:3, note:"Атаки +1 Размер; +10 S; встроен Сюрикен Пистолет (Independent)." }),
  M(POW, "Драконий Топор", { t:"power", grip:"1р [2р, Кл]", form:"Топор", reach:"3", dmg:"1d10+8 E", pen:50, props:"Aspect (Огненные Драконы), Flame (2d10), Power Field, Reinforced", bl:1, wt:1, av:4, note:"Иммунные к Melta считают Pen 15." }),
  M(POW, "Зловещий Меч", { t:"power", grip:"1р [2р, Об]", form:"Меч", reach:"2–4", dmg:"2d10+4 E", pen:7, props:"Aspect (Зловещие Мстители), Dueling Weapon, Felling (4), Power Field, Reinforced, Step By Step", bl:1, wt:3, av:4, note:"Цель: W−20 (психосила) или 1 непогл. E за каждый провал." }),
  M(POW, "Палач", { t:"power", grip:"2р", form:"Глефа", reach:"4–6", dmg:"2d10+10 E", pen:10, props:"Aspect (Воющие Баньши), Devastating (3), Felling (6), Power Field, Proven (3), Reinforced, Step By Step", bl:1, wt:3, av:4 }),
  M(POW, "Трискелион", { t:"power", grip:"1р", form:"Нож (рукопашный/метательный)", reach:"0–2", dmg:"1d10+4 E", pen:4, props:"Aspect (Воющие Баньши), Extreme (7), Felling (4), Multi-Strike (3), Power Field, Reinforced", bl:1, wt:2, av:4, note:"Метательный (S.b×4): 1d10+4 E, Pen 4, Devastating (5), Extreme (9), Felling (4), Power Field, Reinforced." }),
  M(POW, "Зеркальный Меч", { t:"power", grip:"1р [Об]", form:"Меч", reach:"1–4", dmg:"1d10+9 E", pen:8, props:"Aspect (Воющие Баньши), Felling (2), Power Field, Reinforced", bl:2, wt:0.5, av:4, note:"Реквизируется парой; синхронные атаки (см. справочник)." }),
  M(POW, "Сабля Парагон", { t:"power", grip:"1р [2р, Об]", form:"Меч", reach:"2–4", dmg:"2d10+8 E", pen:10, props:"Aspect (Сияющие Копья), Dueling Weapon, Extreme (7), Felling (4), Lance, Power Field, Proven (3), Reinforced, Step By Step, Very Reliable", bl:1, wt:1, av:5 }),
  M(POW, "Звёздная Глефа", { t:"power", grip:"2р [Бл]", form:"Глефа", reach:"4–6", dmg:"1d10+11 E", pen:9, props:"Aspect (Аутархи), Extreme (6), Felling (4), Power Field, Reinforced", bl:2, wt:4, av:4, note:"Посох (2–4): 1d10+1 I(Cr), Pen 1. +20 командование/избегание эльдарам; союзникам +10 парир." }),
  M(POW, "Мстящий Меч", { t:"power", grip:"1р [Об]", form:"Exotic", reach:"1–4", dmg:"2d10+4 E", pen:7, props:"Aspect (Зловещие Мстители), Dueling Weapon, Felling (8), Power Field, Reinforced, Step By Step, Warp Weapon", bl:2, wt:3, av:5, note:"Против друкхари: Hatred, Ярость, +5 хар-к, +10 WS." }),
  M(POW, "Паучий Укус", { t:"power", grip:"1р", form:"Меч", reach:"2–4", dmg:"1d10 E", pen:8, props:"Aspect (Варп-Пауки), Power Field, Shocking, Toxic (6)", bl:2, wt:2, av:4, note:"Кристаллизация: игнор Natural Armour/T.b; T−40 (см. справочник)." }),
  M(POW, "Меч Гнева", { t:"power", grip:"1р", form:"Меч", reach:"2–4", dmg:"5d5 E", pen:8, props:"Arc (4/3d10), Power Field, Reinforced", bl:2, wt:2, av:4, note:"Каждый кубик может дать экстрем.; дуга 15м." }),
  M(POW, "Каэла Менша Шхелве", { t:"power", grip:"1р [2р, Об]", form:"Меч (Exotic)", reach:"2–4", dmg:"2d10+8 E", pen:12, props:"Dueling Weapon, Flame (3d10), Mighty, Power Field, Step By Step", bl:2, wt:1.5, av:5, note:"Песнь Кроваворукого: цель не лечит раны; Кровотечение/Обескровливание (см. справочник)." }),

  // ═══════════════════════ РУКОПАШНОЕ: ПСИХОКОСТЯНОЕ ═══════════════════════
  M(WRT, "Психокостяной Посох", { t:"wraithbone", grip:"2р [1р]", form:"Посох", reach:"2–4", dmg:"1d10+1 I(Cr)", pen:1, props:"Force", bl:2, wt:0.5, av:2 }),
  M(WRT, "Эльдарская Кристальная Перчатка", { t:"wraithbone", grip:"Л", form:"Кулак.Б", reach:"0", dmg:"1d10+3 I(Cr)", pen:1, props:"Force", bl:0, wt:0.1, av:3 }),
  M(WRT, "Психокостяной Нож", { t:"wraithbone", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"1d5+3 R", pen:3, props:"Eldar Precise, Force", bl:2, wt:0.1, av:2 }),
  M(WRT, "Психокостяной Меч", { t:"wraithbone", grip:"1р [2р, Об]", form:"Меч", reach:"2–4", dmg:"1d10+3 R", pen:3, props:"Dueling Weapon, Force, Step By Step", bl:2, wt:0.5, av:2 }),
  M(WRT, "Психокостяная Рапира", { t:"wraithbone", grip:"1р [Об]", form:"Рапира", reach:"3–5", dmg:"1d10+3 R", pen:3, props:"Eldar Precise, Force, Step By Step", bl:2, wt:0.5, av:2 }),
  M(WRT, "Психокостяная Сабля", { t:"wraithbone", grip:"1р [2р, Об]", form:"Сабля", reach:"2–3", dmg:"1d10+3 R", pen:3, props:"Dueling Weapon, Eldar Precise, Force", bl:2, wt:0.5, av:2 }),
  M(WRT, "Психокостяной Топор", { t:"wraithbone", grip:"1р [2р, Кл]", form:"Топор", reach:"3", dmg:"1d10+4 R", pen:4, props:"Force", bl:1, wt:1, av:3 }),
  M(WRT, "Психокостяной Молот", { t:"wraithbone", grip:"1р [2р]", form:"Молот", reach:"3", dmg:"1d10+6 I(Cr)", pen:3, props:"Force", bl:1, wt:1, av:3, note:"В 2р: Concussive (1), Shocking. Крюк: 1d10+4 R, Pen 3, Force, Felling (4)." }),
  M(WRT, "Психокостяной Длинный Меч", { t:"wraithbone", grip:"1р [2р]", form:"Меч", reach:"2–5", dmg:"1d10+5 R", pen:3, props:"Force", bl:1, wt:1.5, av:2 }),
  M(WRT, "Психокостяной Двуручный Меч", { t:"wraithbone", grip:"2р [1р]", form:"Меч", reach:"3–6", dmg:"2d10+3 R", pen:3, props:"Force", bl:1, wt:2, av:3 }),
  M(WRT, "Психокостяная Секира", { t:"wraithbone", grip:"2р", form:"Топор", reach:"4", dmg:"2d10+4 R", pen:5, props:"Force", bl:0, wt:1.5, av:3, note:"Молот: 2d10+5 I(Cr), Pen 1, Concussive (2), Force; Посох (2–4): 1d10 I(Cr), Pen 1, Force." }),
  M(WRT, "Психокостяной Двуручный Молот", { t:"wraithbone", grip:"2р [1р, Бл, 1р+Кл]", form:"Молот", reach:"4", dmg:"2d10+6 I(Cr)", pen:2, props:"Concussive (2), Force", bl:-1, wt:1.5, av:3, note:"Крюк: 2d10+4 R, Pen 6, Force, Felling (4); Посох (2–4): 1d10+1 I(Cr), Pen 1, Force." }),
  M(WRT, "Психокостяное Копьё", { t:"wraithbone", grip:"2р [Бл]", form:"Копьё", reach:"5–7", dmg:"1d10+3 R", pen:3, props:"Force, Step By Step", bl:1, wt:1, av:2, note:"Посох (2–4): 1d10+1 I(Cr), Pen 1, Force." }),
  M(WRT, "Психокостяная Глефа", { t:"wraithbone", grip:"2р [1р, Бл, 1р+Об]", form:"Глефа", reach:"4–6", dmg:"1d10+7 R", pen:4, props:"Force, Step By Step", bl:2, wt:1.5, av:3, note:"Посох (2–4): 1d10+1 I(Cr), Pen 1, Force." }),
  M(WRT, "Психокостяная Коса", { t:"wraithbone", grip:"2р [Бл]", form:"Крюк", reach:"4", dmg:"2d10+5 R", pen:4, props:"Devastating (2), Extreme (8), Felling (4), Force", bl:-1, wt:2, av:3, note:"Посох (2–4): 1d10+1 I(Cr), Pen 1, Force." }),
  M(WRT, "Психокостяная Алебарда", { t:"wraithbone", grip:"2р [Бл]", form:"Глефа", reach:"4–5", dmg:"2d10+4 R", pen:5, props:"Force", bl:2, wt:1.5, av:3, note:"Крюк: 2d10+3 R, Pen 6, Force, Felling (4); Копьё (5–6): 1d10+3 R, Pen 3, Force; Посох (2–4): 1d10+1 I(Cr), Pen 1, Force." }),
  M(WRT, "Психокостяной Кнут", { t:"wraithbone", grip:"1р", form:"Кнут", reach:"5–7", dmg:"1d10+4 I", pen:1, props:"Flexible, Force", bl:0, wt:0.1, av:3 }),
  M(WRT, "Поющее Копьё", { prof:[PF("Посох", "2-4", "1d10+1 I(Cr)", 0, "Imprecise, Reinforced")], t:"wraithbone", grip:"2р [1р, Бл, 1р+Об]", form:"Копьё", reach:"5–7", dmg:"1d10+5 R", pen:7, props:"Aspect (Видящие), Dueling Weapon, Extreme (8), Power Field, Step By Step, Witch's Edge", bl:1, wt:0.9, av:3, note:"Посох (2–4): 1d10+4 I(Cr), Pen 2. Можно метать (W вместо BS)." }),
  M(WRT, "Поющий Меч", { t:"wraithbone", grip:"1р [2р, Об]", form:"Меч", reach:"2–4", dmg:"1d10+6 R", pen:7, props:"Aspect (Видящие), Dueling Weapon, Extreme (8), Power Field, Step By Step, Witch's Edge", bl:2, wt:0.6, av:3 }),
  M(WRT, "Поющий Двуручный Меч", { t:"wraithbone", grip:"2р", form:"Меч", reach:"3–6", dmg:"2d10+7 R", pen:8, props:"Aspect (Видящие), Extreme (7), Power Field, Witch's Edge", bl:1, wt:1.4, av:4, note:"Парирует Незримые атаки и психосилы." }),
  M(WRT, "Стеклянный Меч", { t:"wraithbone", grip:"1р [2р]", form:"Меч", reach:"2–4", dmg:"2d10 R", pen:0, props:"Aspect (Видящие), Crippling (бPR), Extreme (4), Force, Power Field", bl:2, wt:0.1, av:4, note:"Хрупкий: +A.b Dmg/Pen (до 10); 12-й удар разрушает (Blast 8). См. справочник." }),
  M(WRT, "Ведьмин Клинок", { t:"wraithbone", grip:"2р [1р, Бл, Мх]", form:"Меч", reach:"2–5", dmg:"1d10+7 R", pen:7, props:"Aspect (Видящие), Dueling Weapon, Extreme (8), Force, Reinforced, Power Field, Step By Step", bl:2, wt:0.8, av:3, note:"После попадания — Выжигание Души бесплатно. Вариации: Истощающий, Беспощадный, Иши, Курноуса, Старухи (+1 R)." }),
  M(WRT, "Ведьмин Посох", { t:"wraithbone", grip:"2р [1р]", form:"Посох", reach:"2–4", dmg:"1d10+5 I(Cr)", pen:7, props:"Aspect (Видящие), Force, Flame (2d10), Linger (3), Reinforced", bl:2, wt:0.5, av:5, note:"Flame только после Выжигания Души (психопламя)." }),
  M(WRT, "Пожиратель Хаоса", { t:"wraithbone", grip:"2р [1р, Бл, Мх]", form:"Меч", reach:"2–5", dmg:"1d10+9 R", pen:7, props:"Aspect (Видящие), Extreme (8), Force, Reinforced, Power Field, Sanctified", bl:2, wt:0.8, av:5, note:"+1 рейтинг Страха против Хаоса/Демонов; усиливает варп-нестабильность." }),
  M(WRT, "Жаждущий Клинок", { t:"wraithbone", grip:"1р [2р]", form:"Меч", reach:"2–4", dmg:"1d10+4 R", pen:4, props:"Aspect (Видящие), Corrosive (4), Force", bl:2, wt:2, av:5, note:"Манифестирует Проклятие Праха (PR 9) при попадании." }),
  M(WRT, "Пламенная Сабля", { t:"wraithbone", grip:"1р [2р]", form:"Меч", reach:"2–4", dmg:"2d10+4 E(Fl)", pen:7, props:"Aspect (Видящие), Flame (3d10), Force, Linger (PR)", bl:2, wt:2, av:5, note:"Мистический Flame: игнор сопротивления огню; −PR×5 на избегание." }),
  M(WRT, "Сияющий Клинок Эллиарны", { t:"wraithbone", grip:"1р [2р]", form:"Меч", reach:"2–4", dmg:"1d10+8 R", pen:6, props:"Aspect (Видящие), Felling (6), Force", bl:2, wt:2, av:4, note:"Против Оркоидов: +кубик урона, Mighty, ×2 Felling." }),
  M(WRT, "Осколок Анариса", { t:"wraithbone", grip:"1р [2р]", form:"Меч", reach:"2–5", dmg:"2d10+10 R", pen:12, props:"Aspect (Видящие), Extreme (4), Felling (12), Force, Power Field", bl:2, wt:2, av:5, note:"Артефакт. Убитые им не воскрешаются." }),
  M(WRT, "Копьё Малан’тай", { t:"wraithbone", grip:"2р [1р, Бл, 1р+Об]", form:"Копьё", reach:"5–7", dmg:"1d10+9 R", pen:6, props:"Aspect (Видящие), Force, Toxic (3)", bl:1, wt:0.9, av:4, note:"Посох (2–4): 1d10+5 I(Cr), Pen 4, Force. Best.Q Психофокус и Пси-Капюшон; Hatred (Тираниды). С 812.М41." }),
  M(WRT, "Раскаивающий Души", { t:"wraithbone", grip:"1р [2р, Об]", form:"Меч", reach:"2–4", dmg:"1d10 R", pen:0, props:"Aspect (Видящие), Force, Power Field, Sanctified, Tainted", bl:1, wt:2.1, av:5, note:"+Dmg/Pen = числу Hatred (2 ур.); риск Ярости после боя (см. справочник)." }),
  M(WRT, "Вестник Рока", { t:"wraithbone", grip:"2р [1р, Бл, 1р+Об]", form:"Копьё", reach:"5–7", dmg:"2d10+7 R", pen:8, props:"Aspect (Видящие), Dueling Weapon, Extreme (8), Force, Power Field, Step By Step", bl:1, wt:1.2, av:4, note:"Посох (2–4): 2d10+4 I(Cr), Pen 2, Concussive (2), Force. Псайкер бьёт на бPR×2 м (через W)." }),
  M(WRT, "Гравитационный Клинок", { t:"power", grip:"1р", form:"Меч", reach:"2–4", dmg:"1d10+8 E", pen:7, props:"Aspect (Видящие), Felling (4), Power Field", bl:1, wt:1, av:4, note:"2 режима. Подавительный: 2d10+12 I(Cr), Pen 0, Blast (3), Devastating (3), Grav, Graviton, Power Field. Телекинетический: бонусы Телекинеза (см. справочник)." }),
  M(WRT, "Клинок Взрыва Души", { t:"wraithbone", grip:"1р [2р, Об]", form:"Меч", reach:"2–4", dmg:"1d10+3 R", pen:3, props:"Aspect (Иннари), Dueling Weapon, Force, Step By Step, Warp Weapon", bl:2, wt:0.5, av:4, note:"Поглощение цели через T.b; урон в S и T." }),
  M(WRT, "Пустотная Сабля", { t:"wraithbone", grip:"1р [2р, Об]", form:"Сабля", reach:"2–3", dmg:"1d10+4 R", pen:4, props:"Aspect (Корсары), Dueling Weapon, Eldar Precise, Toxic (3)", bl:2, wt:0.5, av:4, note:"Кристалл анафемы: игнор органического T.b; психический Toxic." }),

  // ═══════════════════════ ДРУКХАРИ: ОСКОЛОЧНОЕ ═══════════════════════
  W(DSPL, "Осколочный Пистолет", { c:"pistol", t:"splinter", rng:30, rof:"S/2/3", dmg:"1d10+2 R", pen:2, clip:30, rld:"½", wt:1, av:1, props:"Hefty (R), Reliable, Toxic (2) +Mono-Bayonet, Venom Drip" }),
  W(DSPL, "Осколочная Винтовка", { c:"basic", t:"splinter", rng:100, rof:"S/3/5", dmg:"1d10+2 R", pen:2, clip:120, rld:"½", wt:3, av:0, props:"Hefty (R), Reliable, Toxic (2) +Mono-Sword, Pistol Grip, Venom Drip" }),
  W(DSPL, "Осколкарабин", { c:"basic", t:"splinter", rng:60, rof:"S/4/6", dmg:"1d10+2 R", pen:2, clip:150, rld:"½", wt:2.5, av:1, props:"Carbine, Hefty (R), Reliable, Storm (2), Toxic (2) +Mono-Sword, Venom Drip" }),
  W(DSPL, "Осколочная Пушка", { c:"basic", t:"splinter", rng:150, rof:"S/3/6", dmg:"1d10+4 R", pen:2, clip:120, rld:"½", wt:6, av:2, props:"Hefty (R), Storm (3), Reliable, Toxic (2), Very Reliable +Mono-Spear, Venom Drip", note:"Тяжёлое при длинных очередях." }),
  W(DSPL, "Измельчитель Осколков", { c:"basic", t:"splinter", rng:30, rof:"S/2/–", dmg:"1d10+2 R", pen:2, clip:40, rld:"1", wt:2.5, av:2, props:"Carbine, Hefty (R), Reliable, Toxic (2) +Mono-Sword, Pistol Grip, Venom Drip", note:"2-й выстрел — Spray 30 м (не пробивает броню)." }),
  W(DSPL, "Осколочный Инфильтратор", { c:"pistol", t:"splinter", rng:40, rof:"S/–/–", dmg:"1d10+2 R", pen:2, clip:15, rld:"¼", wt:1.3, av:3, props:"Combi, Hefty (R), Reliable, Toxic (2) +Mono-Bayonet, Venom Drip", note:"Удалённый подрыв кристалла (см. справочник); боеприпасы R3." }),
  W(DSPL, "Стая Ос", { c:"pistol", t:"splinter", rng:10, rof:"S/–/–", dmg:"1d10+2 R", pen:2, clip:3, rld:"4", wt:0.6, av:3, props:"Combi, Hefty (R), Reliable, Toxic (2), Scatter", note:"Осколки рикошетят от твёрдых поверхностей." }),
  W(DSPL, "Осколкарабин «Удав»", { c:"basic", t:"splinter", rng:50, rof:"S/4/6", dmg:"1d10+2 R", pen:2, clip:150, rld:"½", wt:2.5, av:3, props:"Carbine, Hefty (R), Reliable, Storm (2), Toxic (2) +Mono-Bayonet, Venom Drip", note:"Одиночные −10, короткая +10, длинная +20." }),
  W(DSPL, "Осколочный Роевой Пистолет", { c:"pistol", t:"splinter", rng:20, rof:"S/–/4", dmg:"1d10+2 R", pen:2, clip:30, rld:"½", wt:1.4, av:3, props:"Hefty (R), Reliable, Storm (3), Toxic (2) +Mono-Bayonet, Venom Drip", note:"Можно дать Compact (магазин на 1 выстрел)." }),
  W(DSPL, "Осколочная Винтовка «Пробиватель»", { c:"basic", t:"splinter", rng:150, rof:"S/–/–", dmg:"1d10+4 R", pen:5, clip:5, rld:"2", wt:5, av:3, props:"Eldar Accurate, Eldar Precise, Hefty (R), Reliable, Toxic (5) +Mono-Spear, Pistol Grip, Venom Drip", note:"В сочленение Toxic +1; в шею — тест против ½ Toxic или паралич." }),
  W(DSPL, "Осколочный Пистолет «Костолом»", { c:"pistol", t:"splinter", rng:40, rof:"S/2/3", dmg:"1d10+5 R", pen:2, clip:30, rld:"½", wt:2.3, av:4, props:"Hefty (R), Reliable, Revolver, Toxic (2) +Mono-Bayonet, Venom Drip", note:"Система «охраны»: при краже Recoil (9), критические эффекты по рукам/торсу." }),

  // ═══════════════════════ ДРУКХАРИ: ТЁМНОСВЕТОВОЕ ═══════════════════════
  W(DDARK, "Бласт Пистолет (Друкхари)", { c:"pistol", t:"darklight", rng:20, rof:"S/–/–", dmg:"2d10+7 X", pen:6, clip:6, rld:"1", wt:2, av:3, props:"Extreme (9), Felling (4), Lance, Proven (3)", note:"Антисвет (X): игнорирует укрепления (не технику); блокируется только эльдар/друкхари/некрон/археотех технологиями. На 99–100 поле отказывает — Blast (5)." }),
  W(DDARK, "Бластер", { c:"basic", t:"darklight", rng:40, rof:"S/–/–", dmg:"2d10+12 X", pen:10, clip:32, rld:"2", wt:4, av:2, props:"Extreme (8), Felling (4), Lance, Proven (4)", note:"Противотанковое. Антисвет (см. Бласт Пистолет)." }),
  W(DDARK, "Тёмное Копьё", { c:"heavy", t:"darklight", rng:120, rof:"S/–/–", dmg:"2d10+16 X", pen:6, clip:32, rld:"2", wt:16, av:3, props:"Extreme (7), Felling (6), Lance, Proven (4)", note:"По цели Size ≤1: T−10 или ×2 урон (▲). Size 0 — не остаётся следа." }),
  W(DDARK, "Тепловое Копьё", { c:"heavy", t:"darklight", rng:60, rof:"S/–/–", dmg:"3d10+20 X", pen:12, clip:32, rld:"4", wt:17, av:5, props:"Deflagrate (12), Extreme (6), Felling (6), Melta, Lance, Proven (5)", note:"По цели Size ≤2: T−30 или ×2 урон (▲). Size ≤1 непогл. урон — крит. E 6." }),

  // ═══════════════════════ ДРУКХАРИ: ГРАНАТОМЁТЫ ═══════════════════════
  W(DLCH, "Гранатомёт Фантазм", { c:"launcher", t:"launcher", rng:50, rof:"S/2/–", dmg:"", pen:0, clip:16, rld:"4", wt:6, av:2, props:"Arcing, Imprecise, Independent, Twin-Linked", note:"Использует гранаты." }),
  W(DLCH, "Террорфекс", { c:"launcher", t:"launcher", rng:30, rof:"S/–/–", dmg:"", pen:0, clip:1, rld:"½", wt:3, av:3, props:"Carbine, Imprecise, Wrist", note:"Использует гранаты; крепится на руку." }),
  W(DLCH, "Хоррорфекс", { c:"launcher", t:"launcher", rng:300, rof:"S/–/–", dmg:"", pen:0, clip:1, rld:"1", wt:25, av:3, props:"Arcing, Imprecise", note:"Использует гранаты. В Упор: попадание 2d10+12 I(Cr), Primitive до взрыва; короткая: 1d10+12 I(Cr)." }),

  // ═══════════════════════ ДРУКХАРИ: ГРАНАТЫ ═══════════════════════
  W(DGRN, "Граната: Ядовитая Осколкбомба", { c:"thrown", t:"grenade", dmg:"4d10+1 R(Fr)", pen:2, wt:0.2, av:2, props:"Blast (6), Toxic (3)" }),

  // ═══════════════════════ ДРУКХАРИ: ЭКЗОТИЧЕСКОЕ ═══════════════════════
  W(DEXO, "Бластер Помех", { c:"basic", t:"exotic", rng:100, rof:"S/–/–", dmg:"", pen:0, clip:15, rld:"4", wt:4, av:3, props:"Haywire (4, 4d5)", note:"При Haywire 9+ техника получает 5d5 непогл. E и цепные эффекты." }),
  W(DEXO, "Сглаз-винтовка", { c:"basic", t:"exotic", rng:60, rof:"S/–/–", dmg:"1d10+3 R", pen:2, clip:1, rld:"2", wt:3, av:4, props:"Eldar Accurate, Eldar Precise, Felling (8)", note:"Непоглощ. урон → заражение Стеклянной Чумой (см. справочник)." }),
  W(DEXO, "Разжижитель", { c:"basic", t:"acid", rng:30, rof:"S/2/4", dmg:"1d10+4 C", pen:4, clip:6, rld:"4", wt:5, av:3, props:"Corrosive (1d5), Toxic (4), Reinforced, Spray", note:"За провал избегания Corrosive +1; при пробитии C урон ×3." }),
  W(DEXO, "Оссефактор", { c:"heavy", t:"exotic", rng:60, rof:"S/3/–", dmg:"1d10+8 R", pen:4, clip:6, rld:"4", wt:12, av:3, props:"Eldar Accurate, Eldar Precise, Felling (8)", note:"Непоглощ. урон → T−20, рост костей (см. справочник); взрыв костей по соседям." }),
  W(DEXO, "Шреддер", { c:"basic", t:"monofilament", rng:70, rof:"S/–/–", dmg:"1d10+8 R", pen:4, clip:5, rld:"2", wt:2.7, av:3, props:"Eldar Razor Sharp, Imprecise, Monofilament (4), Tearing, Spray", note:"Свободным действием Spray → Arcing + Blast (2); смертельный урон → паралич." }),
  W(DEXO, "Струна Души", { c:"basic", t:"needler", rng:30, rof:"S/–/–", dmg:"1d10+5 R", pen:4, clip:12, rld:"1", wt:2.1, av:3, props:"Eldar Accurate, Shocking, Precise, Primitive", note:"Непоглощ. урон по псайкеру → развеивает поддерживаемые психосилы (см. справочник)." }),
  W(DEXO, "Жало", { c:"pistol", t:"needler", rng:30, rof:"S/–/–", dmg:"1d10+3 R", pen:3, clip:18, rld:"2", wt:2, av:4, props:"Eldar Razor Sharp, Felling (4), Toxic (6), Precise, Primitive", note:"Паразиты: T−30 → урон и взрыв 2d10+T.b×2 X, Blast (T.b), Toxic (4) (цепная реакция)." }),
  W(DEXO, "Кровавый Камень", { c:"pistol", t:"exotic", rng:20, rof:"S/–/–", dmg:"1d10+5 E", pen:7, clip:1, rld:"5", wt:0.1, av:4, props:"Shocking, Spray, Warp Weapon", note:"Невидим без Warp Sight/пси-чутья. В радиусе: T−20 или закипание крови — кровотечение + 4 броска Обескровливания. Ставится в оружие/броню (Independent)." }),
  W(DEXO, "Деструктор", { c:"basic", t:"acid", rng:70, rof:"S/–/–", dmg:"2d10+5 R", pen:7, clip:8, rld:"4", wt:7, av:4, props:"Eldar Accurate, Eldar Precise, Felling (8), Toxic (7, 2d10)", note:"При пробитии — 4 теста T−20: кровотечение, ожоги, слепота, паралич (см. справочник)." }),
  W(DEXO, "Дезинтегратор", { c:"heavy", t:"plasma", rng:150, rof:"–/5/8", dmg:"1d10+16 E", pen:11, clip:60, rld:"5", wt:25, av:4, props:"Blast (6), Maximal, Reliable", note:"Плазма Друкхари; погибший от него испаряется на атомы." }),

  // ═══════════════════ ДРУКХАРИ: РУКОПАШНОЕ — ПРИМИТИВНОЕ ═══════════════════
  M(DPRIM, "Блестящий Клинок", { t:"primitive", grip:"1р [2р, Об, Бл, Мх]", form:"Меч", reach:"2–4", dmg:"1d10+3 R", pen:4, props:"Eldar Precise, Extreme (8), Crippling (4), Reinforced, Tearing", bl:1, wt:0.5, av:3, note:"Оружие Мерцающей Стали (для Мандрагор R0); излучает холод." }),
  M(DPRIM, "Гекатрийский Клинок (Друкхари)", { t:"primitive", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"1d5+2 R", pen:3, props:"Eldar Precise, Eldar Razor Sharp, Extreme (4), Reinforced, Tearing", bl:1, wt:0.1, av:-3, note:"Реквизиция 1 = 4 клинка." }),
  M(DPRIM, "Ведьмин Клинок (Друкхари)", { t:"primitive", grip:"1р [2р, Об, Бл, Мх]", form:"Меч", reach:"2–4", dmg:"1d10+2 R", pen:3, props:"Eldar Precise, Eldar Razor Sharp, Extreme (8), Reinforced, Tearing", bl:1, wt:0.5, av:-1, note:"Show-Off: +10 при использовании только ведьминых клинков." }),
  M(DPRIM, "Клинок Суккуба", { t:"exotic", grip:"2р [Об, Бл, Мх]", form:"Меч", reach:"2–4", dmg:"1d10+4 R", pen:4, props:"Dueling Weapon, Eldar Precise, Eldar Razor Sharp, Extreme (8), Reinforced, Tearing, Step By Step", bl:1, wt:0.5, av:2, note:"Show-Off: +20." }),
  M(DPRIM, "Адская Глефа", { t:"primitive", grip:"2р [Бл]", form:"Глефа", reach:"4–6", dmg:"1d10+6 E", pen:3, props:"Eldar Razor Sharp, Reinforced, Step By Step", bl:2, wt:1.5, av:0, note:"Посох (2–4): 1d10+1 I(Cr), Pen 2. На геллионе: +10 Operate, +20 по сочленениям." }),
  M(DPRIM, "Мономолекулярный Клинок", { t:"primitive", grip:"1р [2р, Об, Бл, Мх]", form:"Меч", reach:"2–4", dmg:"1d10+2 R", pen:9, props:"Eldar Razor Sharp", bl:2, wt:1, av:2, note:"Не может получить Reinforced. Против Theldrite Core/Reinforced Transteel при парировании −5 Pen." }),
  M(DPRIM, "Пронзатель", { t:"primitive", grip:"1р [2р]", form:"Копьё", reach:"6–8", dmg:"1d10+3 R", pen:3, props:"", bl:1, wt:2.1, av:0, note:"Проигрыш Power Field — теряет 1 лезвие (бой продолжается). S.b>4 — переброс урона." }),
  M(DPRIM, "Бритвоцеп", { t:"primitive", grip:"1р [2р]", form:"Меч", reach:"3–5", dmg:"1d10+3 R", pen:2, props:"Eldar Razor Sharp, Reinforced", bl:1, wt:0.5, av:1, note:"Свободным действием → Хлыст (4–8, Flexible, теряет Reinforced); можно парировать-в-хлыст реакцией." }),
  M(DPRIM, "Перчатка Гидры", { t:"primitive", grip:"1р", form:"Кулак.Б", reach:"0–1", dmg:"1d10+2 I(Cr)", pen:0, props:"Felling (2), Reinforced", bl:1, wt:0.2, av:3, note:"Психоприказом → Когти.Р, R урон, +4 Dmg, +2 Pen. Реакция — ×2 попадания (−1d5 I/W)." }),
  M(DPRIM, "Тычковый Кинжал Друкхари", { t:"primitive", grip:"1р", form:"Кулак+Нож", reach:"0–1", dmg:"1d5+2 R", pen:2, props:"Eldar Precise, Reinforced", bl:1, wt:0.1, av:-3 }),
  M(DPRIM, "Клинок Шаимеша", { t:"exotic", grip:"1р [2р, Бл, Мх]", form:"Меч", reach:"2–4", dmg:"1d10+3 R", pen:5, props:"Eldar Precise, Felling (6), Reinforced, Toxic (5)", bl:1, wt:0.5, av:4, note:"Яд Шаимеша: при непогл. уроне/провале Toxic — эффект 1d10 по таблице (см. справочник)." }),
  M(DPRIM, "Осколочная Сеть", { t:"primitive", grip:"1р", form:"Сеть", reach:"3", dmg:"1d5+3 R", pen:4, props:"Flexible, Snare (5), Shocking", bl:1, wt:0.1, av:0, note:"Метательная (S.b/A.b). При Snare выпускается из руки; тест Shocking −20 или Провалы×2 E(El)." }),
  M(DPRIM, "Наручное Лезвие", { t:"primitive", grip:"1р", form:"Нож", reach:"0–1", dmg:"1d5+1 R", pen:2, props:"Eldar Precise, Reinforced", bl:1, wt:0.2, av:-3, note:"В конце хода получает Defensive (до начала хода)." }),
  M(DPRIM, "Ядовитый Клинок", { t:"exotic", grip:"1р [2р, Об, Бл, Мх]", form:"Меч", reach:"2–4", dmg:"2d10+3 R", pen:4, props:"Eldar Precise, Extreme (8), Felling (8), Reinforced, Toxic (7)", bl:1, wt:1.2, av:4, note:"+30 командование Друкхари; переброс тестов; +1 к кубам урона (+1 ещё если цель отравлена)." }),
  M(DPRIM, "Клинок Сестринства", { t:"exotic", grip:"1р [2р, Бл, Мх]", form:"Меч", reach:"2–4", dmg:"1d10+3 R", pen:5, props:"Crippling (4), Eldar Precise, Felling (4), Reinforced, Toxic (3)", bl:2, wt:0.5, av:3 }),
  M(DPRIM, "Гекатрийское Копьё", { t:"primitive", grip:"1р [2р]", form:"Копьё", reach:"6–8", dmg:"1d10+3 R", pen:4, props:"Step By Step", bl:1, wt:2.1, av:2, note:"+WS.b к Dmg и Pen." }),
  M(DPRIM, "Бритвенный Кистень", { t:"primitive", grip:"1р", form:"Кнут", reach:"4–8", dmg:"1d5+4 I(Cr)", pen:2, props:"Flexible", bl:1, wt:0.4, av:-1 }),
  M(DPRIM, "Оглушающие Когти", { t:"primitive", grip:"1р", form:"Кнут", reach:"4–10", dmg:"1d5+2 I(Cr)", pen:2, props:"Flexible, Shocking", bl:1, wt:0.5, av:0, note:"Давление +20; цепляется за геллиона/технику." }),

  // ═══════════════════ ДРУКХАРИ: ОРУЖИЕ ГЕМУНКУЛОВ ═══════════════════
  M(DHAEM, "Мыслефазовая Перчатка", { t:"exotic", grip:"П+Л", form:"Когти.П", reach:"0–1", dmg:"1d10+4 I(Cr)", pen:8, props:"Reinforced", bl:1, wt:1.2, av:4, note:"Непогл. урон → W−40; провал — подавление воли/подчинение (см. справочник). Несмертельный режим." }),
  M(DHAEM, "Рука-Ножницы", { t:"exotic", grip:"1р", form:"Когти.П", reach:"0–1", dmg:"1d10 R", pen:2, props:"Eldar Precise, Felling (4), Toxic (4, 3d10)", bl:1, wt:0.1, av:4, note:"Можно зарядить любой яд (Рана/Контакт). При провале W−30 — боль/паралич." }),
  M(DHAEM, "Перчатка Плоти", { t:"exotic", grip:"1р", form:"Кулак.Б", reach:"0–2", dmg:"1d10+3 I(Cr)", pen:2, props:"Reinforced, Felling (4), Toxic (4)", bl:1, wt:3, av:4, note:"Рост плоти: Unnatural T растёт каждый ход до смерти (см. справочник)." }),
  M(DHAEM, "Ампутатор", { t:"exotic", grip:"1р", form:"Когти.Р", reach:"0–1", dmg:"1d10+2 R", pen:5, props:"Eldar Precise, Felling (6), Reinforced", bl:1, wt:2.5, av:4, note:"½ поглощения от T.b; непогл. урон ×3 (▲); по руке/ноге — крит. I/R 7." }),

  // ═══════════════════ ДРУКХАРИ: РУКОПАШНОЕ — СИЛОВОЕ ═══════════════════
  M(DPOW, "Агонайзер", { t:"power", grip:"1р", form:"Кнут", reach:"5–7", dmg:"1d10+8 E", pen:5, props:"Flexible, Power Field, Shocking", bl:-2, wt:0.2, av:2, note:"Экстрем. урон → 1d5 урона в S и P (+2/Размер). Вместо урона — штраф к Shocking. Best.Q: урон в хар-ки перманентный." }),
  M(DPOW, "Электрокоррозивный Хлыст", { t:"power", grip:"1р", form:"Кнут", reach:"5–7", dmg:"1d10+8 E", pen:7, props:"Corrosive (3), Flexible, Power Field, Shocking, Toxic (1)", bl:-2, wt:0.2, av:2, note:"Смертельный урон → паралич 12−T.b ч. Свободным действием → E(Fl)." }),
  M(DPOW, "Клинок Джинна", { t:"power", grip:"1р [2р, Об]", form:"Меч", reach:"2–4", dmg:"1d10+9 E", pen:8, props:"Dueling Weapon, Power Field, Step By Step", bl:2, wt:1.3, av:4, note:"Заключает душу убитого (3 мутации); непогл. урон → урон в S и T; крит./экстрем. → +1d5+WS.b в S и T." }),
  M(DPOW, "Полуклэйв", { t:"power", grip:"1р [2р, Об]", form:"Меч", reach:"2–4", dmg:"1d10+7 E", pen:8, props:"Dueling Weapon, Power Field, Step By Step", bl:2, wt:0.8, av:3, note:"Переброс атак; за полудействие — в Клэйв и обратно. Контратака — двумя." }),
  M(DPOW, "Клэйв", { t:"power", grip:"2р", form:"Меч", reach:"3–6", dmg:"2d10+7 E", pen:11, props:"Dueling Weapon, Power Field", bl:1, wt:1.4, av:3, note:"+20 по сочленениям; 5+ успехов — доп. атака в то же сочленение." }),
  M(DPOW, "Каратель", { t:"power", grip:"2р", form:"Топор", reach:"4", dmg:"1d10+9 E", pen:9, props:"Mighty, Power Field", bl:0, wt:2.5, av:3, note:"Power Field 1–95 (1–50 vs Reinforced); −35 тех. щитам, 9–10 — перегрузка на раунд. Крюк: 1d10+8 E, Pen 6, Concussive (2), Mighty; Посох (2–4): 1d10+1 I(Cr)." }),
  M(DPOW, "Клинок Обдиратель", { t:"power", grip:"1р [2р, Об]", form:"Меч", reach:"2–4", dmg:"1d10+10 E", pen:8, props:"Dueling Weapon, Power Field, Step By Step", bl:2, wt:1.3, av:4, note:"При пробитии — 1d5 урона в S/T/A (1d10 против Size 1+); иссушение в мумию (см. справочник)." }),

  // ═══════════════════════════ ИМПЕРСКОЕ: АВТО И СТАБ ═══════════════════════════
  W(IMP_SP, "Кремневый Пистолет", { c:"pistol", t:"solid", rng:15, rof:"S/–/–", dmg:"1d10+2 I", pen:0, clip:1, rld:"3", wt:1.5, av:-3, props:"Primitive, Inaccurate, Unreliable" }),
  W(IMP_SP, "Кремневый Мушкет", { c:"basic", t:"solid", rng:30, rof:"S/–/–", dmg:"1d10+3 I", pen:0, clip:1, rld:"5", wt:4.5, av:-3, props:"Primitive, Inaccurate, Unreliable" }),
  W(IMP_SP, "Стаб Револьвер", { c:"pistol", t:"solid", rng:30, rof:"S/–/–", dmg:"1d10+3 I", pen:0, clip:6, rld:"2", wt:1.5, av:-3, props:"Combi, Reliable, Revolver" }),
  W(IMP_SP, "Авто-Стаб", { c:"pistol", t:"solid", rng:30, rof:"S/3/–", dmg:"1d10+3 I", pen:0, clip:9, rld:"1", wt:1.5, av:-2, props:"Combi" }),
  W(IMP_SP, "Стаб Карабин", { c:"basic", t:"solid", rng:100, rof:"S/3/–", dmg:"1d10+3 I", pen:0, clip:15, rld:"1", wt:3, av:-2, props:"Carbine +Pistol Grip", note:"Пистолетная рукоятка: обычный штраф за неё действует (у версии Скитарии он снят)." }),
  W(IMP_SP, "Стаб Винтовка [револьвер]", { c:"basic", t:"solid", rng:120, rof:"S/–/–", dmg:"1d10+3 I", pen:1, clip:5, rld:"1", wt:4, av:-2, props:"Accurate", note:"Вариант револьвер: перезарядка 2, Accurate, Reliable, Revolver." }),
  W(IMP_SP, "Снайперская Винтовка", { c:"basic", t:"solid", rng:200, rof:"S/–/–", dmg:"1d10+4 I", pen:3, clip:10, rld:"1", wt:6, av:0, props:"Accurate, Reliable +Scope, Silencer" }),
  W(IMP_SP, "Тяжёлый Стаббер", { c:"heavy", t:"solid", rng:120, rof:"S/–/10", dmg:"1d10+8 I", pen:3, clip:200, rld:"2", wt:35, av:1, props:"" }),
  W(IMP_SP, "Спаренный Тяжёлый Стаббер", { c:"heavy", t:"solid", rng:120, rof:"S/–/10", dmg:"1d10+8 I", pen:3, clip:200, rld:"2", wt:50, av:1, props:"Twin-Linked", note:"Вариант Ogrynized: вес 75 кг." }),
  W(IMP_SP, "Макро Стаббер", { c:"heavy", t:"solid", rng:60, rof:"S/–/10", dmg:"1d10+8 I", pen:3, clip:50, rld:"2", wt:12, av:2, props:"Gyro-Stabilized +Pistol Grip" }),
  W(IMP_SP, "Ручная Пушка [револьвер]", { c:"pistol", t:"solid", rng:35, rof:"S/–/–", dmg:"1d10+5 I", pen:2, clip:5, rld:"2", wt:3, av:0, props:"Recoil (4)", note:"Вариант револьвер: обойма 4, Recoil (4), Reliable, Revolver." }),
  W(IMP_SP, "Стаб Пушка [револьвер]", { c:"pistol", t:"solid", rng:25, rof:"S/–/–", dmg:"1d10+7 I", pen:3, clip:5, rld:"2", wt:4, av:0, props:"Unreliable, Recoil (6)", note:"Вариант револьвер: обойма 4, Recoil (6), Revolver." }),
  W(IMP_SP, "Ручная Пушка Карнодон [револьвер]", { c:"pistol", t:"solid", rng:40, rof:"S/3/–", dmg:"1d10+4 I", pen:2, clip:6, rld:"1", wt:2.5, av:1, props:"Accurate, Recoil (5)", note:"Вариант револьвер: обойма 2, Accurate, Recoil (6), Reliable, Revolver." }),
  W(IMP_SP, "Дуэльный Револьвер Ортхлак [Альт]", { c:"pistol", t:"solid", rng:40, rof:"S/–/–", dmg:"1d10+3 I", pen:2, clip:9, rld:"2", wt:2, av:2, props:"Accurate, Precise, Reliable, Revolver", note:"Альт. режим: 10 м, 1d10+4 I, обойма 1, перезарядка 3, Scatter, Recoil (4), Reliable." }),
  W(IMP_SP, "Автопистолет", { c:"pistol", t:"solid", rng:30, rof:"S/–/6", dmg:"1d10+2 I", pen:0, clip:18, rld:"1", wt:1.5, av:-1, props:"Combi" }),
  W(IMP_SP, "Автоган", { c:"basic", t:"solid", rng:100, rof:"S/3/10", dmg:"1d10+3 I", pen:0, clip:30, rld:"1", wt:3.5, av:-1, props:"" }),
  W(IMP_SP, "Роторная Пушка", { c:"heavy", t:"solid", rng:100, rof:"–/–/12", dmg:"1d10+4 I", pen:0, clip:300, rld:"2", wt:60, av:3, props:"Devastating (1), Hefty (I(Cr)), Legion, Reliable, Storm (2)" }),
  W(IMP_SP, "Пушка Жнец Душ", { c:"heavy", t:"solid", rng:100, rof:"–/–/12", dmg:"1d10+3 I", pen:0, clip:300, rld:"2", wt:66, av:4, props:"Devastating (1), Hefty (R), Legion, Reliable, Storm (2), Warp Weapon" }),
  W(IMP_SP, "Сеткомёт", { c:"basic", t:"solid", rng:30, rof:"S/–/–", dmg:"", pen:0, clip:1, rld:"1", wt:3.5, av:0, props:"Snare (1)" }),
  W(IMP_SP, "Гарпунное Ружьё", { c:"heavy", t:"solid", rng:40, rof:"S/–/–", dmg:"2d10+2 R", pen:0, clip:1, rld:"4", wt:18, av:0, props:"Crippling (5), Piercing, Snare (1), Unreliable" }),

  // ═══════════════════════════ ИМПЕРСКОЕ: ДРОБОВИКИ ═══════════════════════════
  W(IMP_SHOT, "Дробовик Пистолет", { c:"pistol", t:"solid", rng:10, rof:"S/–/–", dmg:"1d10+4 I", pen:0, clip:1, rld:"½", wt:1.5, av:-2, props:"Combi, Recoil (4), Reliable, Scatter" }),
  W(IMP_SHOT, "Двуствольный Дробовик", { c:"basic", t:"solid", rng:30, rof:"S/2/–", dmg:"1d10+4 I", pen:0, clip:2, rld:"1", wt:3.5, av:-3, props:"Maximal, Recoil (4), Scatter, Twin-Linked", note:"Recoil (6) при Maximal или Twin-Linked." }),
  W(IMP_SHOT, "Обрез Двуствольного Дробовика", { c:"pistol", t:"solid", rng:10, rof:"S/2/–", dmg:"1d10+4 I", pen:0, clip:2, rld:"1", wt:3, av:-3, props:"Maximal, Recoil (4), Scatter, Twin-Linked", note:"Recoil (6) при Maximal или Twin-Linked." }),
  W(IMP_SHOT, "Помповый Дробовик", { c:"basic", t:"solid", rng:30, rof:"S/–/–", dmg:"1d10+4 I", pen:0, clip:8, rld:"2", wt:4, av:-2, props:"Recoil (4), Scatter" }),
  W(IMP_SHOT, "Штурмовой Дробовик", { c:"basic", t:"solid", rng:30, rof:"S/3/–", dmg:"1d10+4 I", pen:0, clip:18, rld:"2", wt:5, av:0, props:"Recoil (4), Scatter" }),
  W(IMP_SHOT, "Тяжёлый Дробовик", { c:"basic", t:"solid", rng:30, rof:"S/2/–", dmg:"1d10+6 I", pen:0, clip:10, rld:"2", wt:6, av:1, props:"Maximal, Recoil (4), Scatter, Twin-Linked", note:"Recoil (6) при Maximal или Twin-Linked." }),
  W(IMP_SHOT, "Дробовик Отбивная", { c:"basic", t:"solid", rng:20, rof:"S/2/3", dmg:"1d10+7 I", pen:0, clip:3, rld:"2", wt:6, av:1, props:"Recoil (5), Scatter, Tearing", note:"Трёхствольный. Второй режим — отдельный профиль «Дробовик Отбивная (второй режим)»." }),
  W(IMP_SHOT, "Пушка Потрошитель", { c:"basic", t:"solid", rng:30, rof:"S/2/3", dmg:"1d10+10 I", pen:0, clip:48, rld:"4", wt:35, av:1, props:"Inaccurate, Hefty (I(Cr)), Ogrynized, Scatter +Mono Bayonet" }),
  W(IMP_SHOT, "Флотская Дробепушка", { c:"heavy", t:"solid", rng:40, rof:"S/–/–", dmg:"2d10+4 X", pen:0, clip:24, rld:"2", wt:12, av:1, props:"Scatter, Unreliable" }),
  W(IMP_SHOT, "Дробовик Вокс-Леги", { c:"basic", t:"solid", rng:30, rof:"S/2/–", dmg:"1d10+8 I", pen:0, clip:14, rld:"2", wt:7, av:2, props:"Reinforced, Reliable, Scatter, Hefty (I(Cr)) +Shock Stock", note:"Альт. режим: 20 м, обойма 1, перезарядка ½, Scatter." }),
  W(IMP_SHOT, "Дробовик Легиона", { c:"basic", t:"solid", rng:30, rof:"S/2/–", dmg:"1d10+8 I", pen:0, clip:10, rld:"1", wt:10, av:2, props:"Legion, Reinforced, Recoil (8), Reliable, Scatter" }),

  // ═══════════════════════════ ИМПЕРСКОЕ: АВТОПУШКИ ═══════════════════════════
  W(IMP_ACAN, "Автопушка", { c:"heavy", t:"solid", rng:300, rof:"S/3/–", dmg:"3d10+8 X", pen:6, clip:20, rld:"2", wt:40, av:2, props:"Reliable" }),
  W(IMP_ACAN, "Фраг Пушка", { bands:[{label:"Короткая дистанция (Рассеивание как в упор)",dice:1}], c:"heavy", t:"solid", rng:30, rof:"S/2/4", dmg:"2d10+6 X(Fr)", pen:4, clip:20, rld:"2", wt:45, av:2, props:"Flush, Reliable, Scatter, Tearing" }),
  W(IMP_ACAN, "Автопушка Икар", { c:"heavy", t:"solid", rng:300, rof:"S/3/–", dmg:"3d10+8 X", pen:6, clip:20, rld:"2×2", wt:100, av:3, props:"Anti-Air, Reliable, Twin-Linked, Legion +Tripod", note:"Обойма 20×2." }),
  W(IMP_ACAN, "Ускорительная Автопушка", { c:"heavy", t:"solid", rng:300, rof:"S/2/4", dmg:"4d10+5 X", pen:6, clip:20, rld:"2", wt:50, av:3, props:"Gyro-Stabilized, Reliable, Tearing, Legion (P)" }),
  W(IMP_ACAN, "Противотанковая Винтовка", { c:"heavy", t:"solid", rng:300, rof:"S/–/–", dmg:"3d10+8 X", pen:6, clip:5, rld:"2", wt:40, av:3, props:"Accurate, Reliable, Legion +Scope" }),
  W(IMP_ACAN, "Автопушка Жнец", { c:"heavy", t:"solid", rng:200, rof:"S/4/–", dmg:"3d10+8 X", pen:6, clip:20, rld:"2", wt:60, av:3, props:"Hefty (R), Legion, Reliable, Twin-Linked" }),
  W(IMP_ACAN, "Цепная Пушка Жнец", { c:"heavy", t:"solid", rng:100, rof:"S/2/4", dmg:"2d10+6 X", pen:4, clip:36, rld:"2", wt:60, av:3, props:"Legion, Reliable, Storm (3)" }),
  W(IMP_ACAN, "Штурмовая Пушка", { c:"heavy", t:"solid", rng:120, rof:"–/–/6", dmg:"2d10+6 R", pen:4, clip:192, rld:"2", wt:60, av:4, props:"Legion, Razor Sharp, Storm (2), Tearing, Unreliable" }),

  // ═══════════════════════════ ИМПЕРСКОЕ: ЛАЗЕРНОЕ ═══════════════════════════
  W(IMP_LAS, "Лазпистолет", { c:"pistol", t:"laser", rng:30, rof:"S/2/–", dmg:"1d10+2 E(Ls)", pen:0, clip:30, rld:"½", wt:1, av:-2, props:"Combi, Reliable +Power Setting" }),
  W(IMP_LAS, "Лазкарабин", { c:"basic", t:"laser", rng:75, rof:"S/2/–", dmg:"1d10+3 E(Ls)", pen:0, clip:60, rld:"½", wt:2.5, av:-2, props:"Carbine, Reliable +Power Setting" }),
  W(IMP_LAS, "Лазган", { c:"basic", t:"laser", rng:100, rof:"S/3/–", dmg:"1d10+3 E(Ls)", pen:0, clip:60, rld:"½", wt:3, av:-2, props:"Reliable +Power Setting" }),
  W(IMP_LAS, "Лонглаз", { c:"basic", t:"laser", rng:150, rof:"S/–/–", dmg:"1d10+4 E(Ls)", pen:2, clip:60, rld:"1", wt:4.5, av:-1, props:"Accurate, Felling (4), Reliable, Surge (2) +Scope, Power Setting" }),
  W(IMP_LAS, "Лаз-Лок", { c:"basic", t:"laser", rng:120, rof:"S/–/–", dmg:"1d10+4 E(Ls)", pen:0, clip:60, rld:"1", wt:4, av:0, props:"Very Reliable +Collimators, Blast Module" }),
  W(IMP_LAS, "Митра-Лок", { c:"basic", t:"laser", rng:30, rof:"S/2/–", dmg:"1d10+4 E(Ls)", pen:0, clip:60, rld:"1", wt:4.5, av:0, props:"Reliable, Scatter, Surge (3)" }),
  W(IMP_LAS, "Бласт Пистолет", { c:"pistol", t:"laser", rng:20, rof:"S/2/–", dmg:"2d10+6 E(Ls)", pen:2, clip:30, rld:"1", wt:2, av:1, props:"Overheats, Surge (3), Twin-Linked" }),
  W(IMP_LAS, "Хотшот Пистолет", { c:"pistol", t:"laser", rng:20, rof:"S/2/–", dmg:"1d10+3 E(Ls)", pen:7, clip:30, rld:"½", wt:1.5, av:1, props:"Combi, Surge (3) +Power Setting" }),
  W(IMP_LAS, "Хотшот Лазган", { c:"basic", t:"laser", rng:75, rof:"S/3/–", dmg:"1d10+4 E(Ls)", pen:7, clip:60, rld:"½", wt:3.5, av:1, props:"Surge (3) +Power Setting" }),
  W(IMP_LAS, "Хотшот Залпвинтовка", { c:"basic", t:"laser", rng:75, rof:"S/3/6", dmg:"1d10+7 E(Ls)", pen:7, clip:60, rld:"½", wt:5.5, av:2, props:"Surge (4) +Power Setting" }),
  W(IMP_LAS, "Месианский Разделитель", { c:"basic", t:"laser", rng:100, rof:"S/–/–", dmg:"1d10+5 E(Ls)", pen:0, clip:60, rld:"1", wt:5, av:0, props:"Felling (2), Precise, Reliable, Surge (5)" }),
  W(IMP_LAS, "Месианский Подавитель", { c:"basic", t:"laser", rng:100, rof:"–/–/6", dmg:"1d10+3 E(Ls)", pen:0, clip:60, rld:"½", wt:5, av:0, props:"Devastating (1), Imprecise, Reliable, Surge (2)" }),
  W(IMP_LAS, "Дуэльный Лазер", { c:"pistol", t:"laser", rng:40, rof:"S/–/–", dmg:"1d10+7 E(Ls)", pen:7, clip:30, rld:"1", wt:1, av:2, props:"Accurate, Precise, Surge (4), Very Reliable" }),
  W(IMP_LAS, "Археотеховый Лазер", { c:"pistol", t:"laser", rng:40, rof:"S/2/–", dmg:"1d10+9 E(Ls)", pen:4, clip:0, rld:"–", wt:1, av:4, props:"Accurate, Combi, Extreme (9), Precise, Very Reliable", note:"Обойма ∞ (без перезарядки)." }),
  W(IMP_LAS, "Мультилазер", { c:"heavy", t:"laser", rng:150, rof:"–/–/5", dmg:"2d10+10 E(Ls)", pen:2, clip:100, rld:"2", wt:35, av:2, props:"Reliable" }),
  W(IMP_LAS, "Лазпушка", { c:"heavy", t:"laser", rng:300, rof:"S/–/–", dmg:"5d10+10 E(Ls)", pen:10, clip:5, rld:"2", wt:55, av:3, props:"Proven (3)" }),

  // ═══════════════════════════ ИМПЕРСКОЕ: БОЛТЕРНОЕ (база) ═══════════════════════════
  W(IMP_BOLT, "Болт Пистолет", { c:"pistol", t:"bolt", rng:30, rof:"S/2/–", dmg:"1d10+6 X", pen:4, clip:8, rld:"1", wt:3, av:1, props:"Tearing" }),
  W(IMP_BOLT, "Болт Револьвер", { c:"pistol", t:"bolt", rng:30, rof:"S/–/–", dmg:"1d10+6 X", pen:4, clip:6, rld:"1", wt:3, av:1, props:"Combi, Reliable, Revolver, Tearing" }),
  W(IMP_BOLT, "Болт Карабин", { c:"basic", t:"bolt", rng:60, rof:"S/3/–", dmg:"1d10+6 X", pen:4, clip:24, rld:"1", wt:5, av:1, props:"Carbine, Tearing +Secondary Grip" }),
  W(IMP_BOLT, "Болтер", { c:"basic", t:"bolt", rng:100, rof:"S/3/–", dmg:"1d10+6 X", pen:4, clip:24, rld:"1", wt:7, av:1, props:"Tearing" }),
  W(IMP_BOLT, "Комби-Болтер", { c:"basic", t:"bolt", rng:100, rof:"S/3/–", dmg:"1d10+6 X", pen:4, clip:24, rld:"1", wt:12, av:2, props:"Tearing, Twin-Linked", note:"Обойма 24×2." }),
  W(IMP_BOLT, "Шторм Болтер", { c:"basic", t:"bolt", rng:80, rof:"S/3/6", dmg:"1d10+6 X", pen:4, clip:24, rld:"1", wt:12, av:3, props:"Storm (2), Tearing", note:"Обойма 24×2." }),
  W(IMP_BOLT, "Ураганный Болтер", { c:"heavy", t:"bolt", rng:100, rof:"S/5/9", dmg:"1d10+9 X", pen:4, clip:72, rld:"2", wt:70, av:3, props:"Storm (2), Tearing, Twin-Linked, Legion", note:"Обойма 72×2." }),
  W(IMP_BOLT, "Сталкер Болтер", { c:"basic", t:"bolt", rng:200, rof:"S/–/–", dmg:"1d10+6 X", pen:4, clip:24, rld:"1", wt:8, av:2, props:"Accurate, Tearing +Scope, Silencer" }),
  W(IMP_BOLT, "Болт Винтовка Атрокс", { c:"heavy", t:"bolt", rng:200, rof:"S/–/–", dmg:"1d10+8 X", pen:4, clip:8, rld:"1", wt:20, av:3, props:"Accurate, Precise, Tearing +Scope" }),
  W(IMP_BOLT, "Тяжёлый Болтер", { c:"heavy", t:"bolt", rng:150, rof:"S/4/6", dmg:"2d10+5 X", pen:5, clip:60, rld:"1", wt:40, av:2, props:"Tearing" }),
  W(IMP_BOLT, "Максима Болтер", { c:"basic", t:"bolt", rng:30, rof:"–/–/5", dmg:"1d10+9 X", pen:4, clip:90, rld:"4", wt:20, av:3, props:"Gyro-Stabilized, Storm (3), Tearing" }),
  W(IMP_BOLT, "Болт Пушка Дробитель", { c:"heavy", t:"bolt", rng:100, rof:"S/4/6", dmg:"2d10+10 X", pen:7, clip:100, rld:"1", wt:75, av:4, props:"Tearing" }),

  // ═══════════════════════════ АСТАРТЕС: ЛАЗЕРНОЕ ═══════════════════════════
  W(AST_LAS, "Лаз-Фузея", { c:"heavy", t:"laser", rng:200, rof:"S/–/–", dmg:"3d10+8 E(Ls)", pen:10, clip:10, rld:"2", wt:35, av:3, props:"Accurate, Felling (4), Proven (3), Legion (P) +Scope" }),

  // ═══════════════════════════ АСТАРТЕС: БОЛТЕРНОЕ ═══════════════════════════
  // Варианты Астартес для болт-оружия из [скобок] (+урон, вес, редкость, Legion):
  W(AST_BOLT, "Болт Пистолет (Астартес)", { c:"pistol", t:"bolt", rng:30, rof:"S/2/–", dmg:"1d10+9 X", pen:4, clip:8, rld:"2", wt:6, av:2, props:"Tearing, Legion" }),
  W(AST_BOLT, "Болт Револьвер (Астартес)", { c:"pistol", t:"bolt", rng:30, rof:"S/–/–", dmg:"1d10+9 X", pen:4, clip:6, rld:"2", wt:6, av:2, props:"Combi, Reliable, Revolver, Tearing, Legion" }),
  W(AST_BOLT, "Болт Карабин (Астартес)", { c:"basic", t:"bolt", rng:60, rof:"S/3/–", dmg:"1d10+9 X", pen:4, clip:24, rld:"2", wt:8, av:2, props:"Carbine, Tearing, Legion +Secondary Grip" }),
  W(AST_BOLT, "Болтер (Астартес)", { c:"basic", t:"bolt", rng:100, rof:"S/3/–", dmg:"1d10+9 X", pen:4, clip:24, rld:"2", wt:10, av:2, props:"Tearing, Legion" }),
  W(AST_BOLT, "Комби-Болтер (Астартес)", { c:"basic", t:"bolt", rng:100, rof:"S/3/–", dmg:"1d10+9 X", pen:4, clip:24, rld:"2", wt:17, av:3, props:"Tearing, Twin-Linked, Legion", note:"Обойма 24×2." }),
  W(AST_BOLT, "Шторм Болтер (Астартес)", { c:"basic", t:"bolt", rng:80, rof:"S/3/6", dmg:"1d10+9 X", pen:4, clip:24, rld:"2", wt:17, av:4, props:"Storm (2), Tearing, Legion", note:"Обойма 24×2." }),
  W(AST_BOLT, "Сталкер Болтер (Астартес)", { c:"basic", t:"bolt", rng:200, rof:"S/–/–", dmg:"1d10+9 X", pen:4, clip:24, rld:"2", wt:13, av:3, props:"Accurate, Tearing, Legion +Scope, Silencer" }),
  W(AST_BOLT, "Болт Винтовка Атрокс (Астартес)", { c:"heavy", t:"bolt", rng:200, rof:"S/–/–", dmg:"1d10+11 X", pen:4, clip:8, rld:"2", wt:30, av:4, props:"Accurate, Precise, Tearing, Legion +Scope" }),
  W(AST_BOLT, "Тяжёлый Болтер (Астартес)", { c:"heavy", t:"bolt", rng:150, rof:"S/4/6", dmg:"2d10+8 X", pen:5, clip:60, rld:"1", wt:55, av:3, props:"Tearing, Legion" }),
  // Болт-оружие Астартес (Legion (P), без имперского аналога):
  W(AST_BOLT, "Тяжёлый Болт Пистолет", { c:"pistol", t:"bolt", rng:50, rof:"S/–/–", dmg:"2d10+6 X", pen:6, clip:5, rld:"1", wt:6, av:2, props:"Legion (P), Tearing" }),
  W(AST_BOLT, "Болт Винтовка", { c:"basic", t:"bolt", rng:150, rof:"S/3/–", dmg:"1d10+9 X", pen:6, clip:24, rld:"1", wt:11, av:2, props:"Legion (P), Tearing" }),
  W(AST_BOLT, "Авто Болт Винтовка", { c:"basic", t:"bolt", rng:100, rof:"S/2/3", dmg:"1d10+9 X", pen:4, clip:24, rld:"1", wt:11, av:3, props:"Legion (P), Tearing, Storm (2)" }),
  W(AST_BOLT, "Тяжёлая Болт Винтовка", { c:"basic", t:"bolt", rng:120, rof:"S/–/–", dmg:"2d10+6 X", pen:5, clip:24, rld:"1", wt:20, av:3, props:"Legion (P), Tearing" }),
  W(AST_BOLT, "Болт Винтовка Сорокопут", { c:"basic", t:"bolt", rng:250, rof:"S/–/–", dmg:"2d10+6 X", pen:6, clip:5, rld:"1", wt:17, av:4, props:"Accurate, Legion (P), Precise, Tearing +Scope, Silencer" }),
  W(AST_BOLT, "Болтшторм Перчатка", { c:"pistol", t:"bolt", rng:60, rof:"S/3/6", dmg:"1d10+9 X", pen:4, clip:48, rld:"2", wt:7, av:3, props:"Inaccurate, Legion (P), Tearing, Wrist" }),
  W(AST_BOLT, "Штурмовой Болтер", { c:"heavy", t:"bolt", rng:60, rof:"S/3/6", dmg:"2d10+8 X", pen:5, clip:60, rld:"2", wt:20, av:4, props:"Gyro-Stabilized, Legion (P), Tearing, Storm (2) +Pistol Grip" }),

  // ═══════════════════════════ ИМПЕРСКОЕ: ПЛАЗМЕННОЕ (база) ═══════════════════════════
  W(IMP_PLA, "Плазменный Пистолет", { c:"pistol", t:"plasma", rng:30, rof:"S/2/–", dmg:"1d10+8 E", pen:8, clip:10, rld:"3", wt:3, av:2, props:"Maximal, Overheats" }),
  W(IMP_PLA, "Плазмаган", { c:"basic", t:"plasma", rng:100, rof:"S/2/–", dmg:"1d10+10 E", pen:10, clip:20, rld:"5", wt:7, av:2, props:"Maximal, Overheats" }),
  W(IMP_PLA, "Комби-Плазма", { c:"basic", t:"plasma", rng:80, rof:"S/2/–", dmg:"1d10+10 E", pen:10, clip:2, rld:"10", wt:3, av:2, props:"Combi, Maximal, Overheats" }),
  W(IMP_PLA, "Плазменная Пушка", { c:"heavy", t:"plasma", rng:150, rof:"S/–/–", dmg:"2d10+10 E", pen:10, clip:16, rld:"5", wt:40, av:3, props:"Blast (3), Maximal, Overheats" }),
  W(IMP_PLA, "Плазменный Бластер", { c:"basic", t:"plasma", rng:100, rof:"S/3/–", dmg:"1d10+13 E", pen:10, clip:0, rld:"†", wt:22, av:5, props:"Blast (1), Maximal, Legion, Overheats, Reliable, Twin-Linked", note:"Обойма/перезарядка — особые (†)." }),
  W(IMP_PLA, "Плазменный Каливер", { c:"basic", t:"plasma", rng:80, rof:"S/3/6", dmg:"1d10+8 E", pen:10, clip:20, rld:"5", wt:10, av:3, props:"Maximal, Overheats" }),
  W(IMP_PLA, "Плазменная Кулеврина", { c:"heavy", t:"plasma", rng:150, rof:"–/–/8", dmg:"1d10+14 E", pen:10, clip:48, rld:"5", wt:45, av:4, props:"Maximal, Overheats" }),
  W(IMP_PLA, "Фазированная Плазменная Фузея", { c:"basic", t:"plasma", rng:200, rof:"S/–/–", dmg:"2d10+7 E", pen:10, clip:12, rld:"5", wt:14, av:4, props:"Accurate, Maximal, Overheats, Reliable" }),
  W(IMP_PLA, "Плазменный Повторитель", { c:"basic", t:"plasma", rng:30, rof:"S/2/3", dmg:"1d10+11 E", pen:10, clip:15, rld:"5", wt:10, av:4, props:"Maximal, Overheats, Scatter, Twin-Linked" }),
  W(IMP_PLA, "Плазменный Сжигатель", { c:"basic", t:"plasma", rng:30, rof:"S/–/–", dmg:"1d10+5 E", pen:10, clip:12, rld:"5", wt:10, av:4, props:"Maximal, Overheats, Spray" }),
  W(IMP_PLA, "Плазменный Кастер", { c:"pistol", t:"plasma", rng:20, rof:"S/–/–", dmg:"1d10+5 E", pen:10, clip:6, rld:"5", wt:5, av:5, props:"Maximal, Overheats, Spray" }),

  // ═══════════════════════════ АСТАРТЕС: ПЛАЗМЕННОЕ ═══════════════════════════
  W(AST_PLA, "Плазменный Пистолет (Астартес)", { c:"pistol", t:"plasma", rng:30, rof:"S/2/–", dmg:"1d10+10 E", pen:12, clip:10, rld:"3", wt:6, av:3, props:"Maximal, Overheats, Legion" }),
  W(AST_PLA, "Плазмаган (Астартес)", { c:"basic", t:"plasma", rng:100, rof:"S/2/–", dmg:"1d10+12 E", pen:10, clip:24, rld:"5", wt:12, av:3, props:"Maximal, Overheats, Legion" }),
  W(AST_PLA, "Комби-Плазма (Астартес)", { c:"basic", t:"plasma", rng:80, rof:"S/2/–", dmg:"1d10+12 E", pen:10, clip:2, rld:"10", wt:5, av:3, props:"Combi, Maximal, Overheats, Legion" }),
  W(AST_PLA, "Плазменная Пушка (Астартес)", { c:"heavy", t:"plasma", rng:150, rof:"S/–/–", dmg:"2d10+12 E", pen:10, clip:16, rld:"5", wt:55, av:4, props:"Blast (3), Maximal, Overheats, Legion" }),
  W(AST_PLA, "Плазменный Каливер (Астартес)", { c:"basic", t:"plasma", rng:80, rof:"S/3/6", dmg:"1d10+10 E", pen:10, clip:24, rld:"5", wt:13, av:4, props:"Maximal, Overheats, Legion" }),
  W(AST_PLA, "Плазменный Повторитель (Астартес)", { c:"basic", t:"plasma", rng:30, rof:"S/2/3", dmg:"1d10+13 E", pen:10, clip:18, rld:"5", wt:14, av:4, props:"Maximal, Overheats, Scatter, Twin-Linked, Legion" }),
  W(AST_PLA, "Плазменный Сжигатель (Астартес)", { c:"basic", t:"plasma", rng:30, rof:"S/–/–", dmg:"1d10+7 E", pen:10, clip:16, rld:"5", wt:14, av:4, props:"Maximal, Overheats, Spray, Legion" }),
  W(AST_PLA, "Плазменный Кастер (Астартес)", { c:"pistol", t:"plasma", rng:20, rof:"S/–/–", dmg:"1d10+7 E", pen:10, clip:8, rld:"5", wt:9, av:5, props:"Maximal, Overheats, Spray, Legion" }),
  // Плазма Астартес (Legion (P), без имперского аналога):
  W(AST_PLA, "Плазменный Испепелитель", { c:"basic", t:"plasma", rng:150, rof:"S/2/–", dmg:"1d10+12 E", pen:12, clip:12, rld:"5", wt:13, av:3, props:"Legion (P), Maximal, Overheats", note:"Обойма 12×2." }),
  W(AST_PLA, "Штурмовой Плазменный Испепелитель", { c:"basic", t:"plasma", rng:100, rof:"S/3/6", dmg:"1d10+9 E", pen:12, clip:12, rld:"5", wt:13, av:3, props:"Legion (P), Maximal, Overheats", note:"Обойма 12×2." }),
  W(AST_PLA, "Тяжёлый Плазменный Испепелитель", { c:"basic", t:"plasma", rng:200, rof:"S/–/–", dmg:"2d10+9 E", pen:12, clip:6, rld:"5", wt:15, av:4, props:"Legion (P), Maximal, Overheats" }),
  W(AST_PLA, "Плазменный Экстерминатор", { c:"heavy", t:"plasma", rng:60, rof:"S/–/–", dmg:"2d10+12 E", pen:12, clip:6, rld:"5", wt:20, av:4, props:"Blast (3), Legion (P), Maximal, Overheats" }),

  // ═══════════════════════════ ИМПЕРСКОЕ: МЕЛЬТА (база) ═══════════════════════════
  W(IMP_MEL, "Инферно Пистолет", { c:"pistol", t:"melta", rng:10, rof:"S/–/–", dmg:"2d10+10 E", pen:15, clip:3, rld:"1", wt:3, av:3, props:"Imprecise, Melta" }),
  W(IMP_MEL, "Мельтаган", { c:"basic", t:"melta", rng:20, rof:"S/–/–", dmg:"2d10+10 E", pen:15, clip:5, rld:"2", wt:7, av:2, props:"Imprecise, Melta" }),
  W(IMP_MEL, "Комби-Мельта", { c:"basic", t:"melta", rng:20, rof:"S/–/–", dmg:"2d10+10 E", pen:15, clip:1, rld:"10", wt:3, av:2, props:"Combi, Imprecise, Melta" }),
  W(IMP_MEL, "Мультимельта", { c:"heavy", t:"melta", rng:60, rof:"S/–/–", dmg:"2d10+16 E", pen:15, clip:12, rld:"2", wt:40, av:3, props:"Blast (2), Melta" }),
  W(IMP_MEL, "Мельта Лучевик", { c:"basic", t:"melta", rng:60, rof:"S/–/–", dmg:"2d10+6 E", pen:15, clip:5, rld:"2", wt:10, av:3, props:"Accurate, Melta, Unreliable" }),
  W(IMP_MEL, "Термальное Копьё", { c:"heavy", t:"melta", rng:60, rof:"S/2/–", dmg:"2d10+16 E", pen:15, clip:12, rld:"2", wt:40, av:4, props:"Melta" }),
  W(IMP_MEL, "Солнечный Атомизатор", { c:"basic", t:"melta", rng:40, rof:"S/–/–", dmg:"4d10+16 E", pen:15, clip:12, rld:"4", wt:15, av:4, props:"Blinding (2), Cognis, Imprecise, Melta" }),

  // ═══════════════════════════ АСТАРТЕС: МЕЛЬТА ═══════════════════════════
  W(AST_MEL, "Инферно Пистолет (Астартес)", { c:"pistol", t:"melta", rng:10, rof:"S/–/–", dmg:"2d10+13 E", pen:15, clip:3, rld:"1", wt:5, av:3, props:"Imprecise, Melta, Legion" }),
  W(AST_MEL, "Мельтаган (Астартес)", { c:"basic", t:"melta", rng:20, rof:"S/–/–", dmg:"2d10+13 E", pen:15, clip:6, rld:"2", wt:18, av:3, props:"Imprecise, Melta, Legion" }),
  W(AST_MEL, "Комби-Мельта (Астартес)", { c:"basic", t:"melta", rng:20, rof:"S/–/–", dmg:"2d10+13 E", pen:15, clip:1, rld:"10", wt:5, av:3, props:"Combi, Imprecise, Melta, Legion" }),
  W(AST_MEL, "Мельта Лучевик (Астартес)", { c:"basic", t:"melta", rng:60, rof:"S/–/–", dmg:"2d10+9 E", pen:15, clip:6, rld:"2", wt:20, av:4, props:"Accurate, Melta, Unreliable, Legion" }),
  // Мельта Астартес (Legion (P)):
  W(AST_MEL, "Мельта Винтовка", { c:"basic", t:"melta", rng:60, rof:"S/–/–", dmg:"2d10+9 E", pen:15, clip:12, rld:"4", wt:20, av:3, props:"Imprecise, Legion (P), Melta" }),
  W(AST_MEL, "Тяжёлая Мельта Винтовка", { c:"heavy", t:"melta", rng:100, rof:"S/–/–", dmg:"3d10+9 E", pen:15, clip:6, rld:"6", wt:30, av:4, props:"Extreme (9), Imprecise, Legion (P), Melta" }),

  // ═══════════════════════════ ИМПЕРСКОЕ: ОГНЕМЁТЫ (база) ═══════════════════════════
  W(IMP_FLM, "Ручной Огнемёт", { c:"pistol", t:"flame", rng:10, rof:"S/–/–", dmg:"1d10+6 E(Fl)", pen:2, clip:2, rld:"2", wt:3.5, av:0, props:"Flame, Spray, Linger (1d5)" }),
  W(IMP_FLM, "Огнемёт", { c:"basic", t:"flame", rng:20, rof:"S/–/–", dmg:"1d10+6 E(Fl)", pen:2, clip:6, rld:"2", wt:6, av:-1, props:"Flame, Spray, Linger (1d5)" }),
  W(IMP_FLM, "Комби-Огнемёт", { c:"basic", t:"flame", rng:20, rof:"S/–/–", dmg:"1d10+6 E(Fl)", pen:2, clip:1, rld:"10", wt:3.5, av:-1, props:"Combi, Flame, Spray, Linger (1d5)" }),
  W(IMP_FLM, "Тяжёлый Огнемёт", { c:"heavy", t:"flame", rng:30, rof:"S/–/–", dmg:"1d10+10 E(Fl)", pen:4, clip:10, rld:"2", wt:20, av:0, props:"Flame, Spray, Linger (1d5)" }),
  W(IMP_FLM, "Штурмовой Огнемёт", { c:"basic", t:"flame", rng:20, rof:"S/–/–", dmg:"1d10+7 E(Fl)", pen:2, clip:10, rld:"2", wt:12, av:1, props:"Flame, Spray, Linger (1)" }),
  W(IMP_FLM, "Пиробластер", { c:"basic", t:"flame", rng:40, rof:"S/–/–", dmg:"1d10+9 E(Fl)", pen:4, clip:3, rld:"2", wt:10, av:3, props:"Flame, Spray, Linger (1d5)" }),
  W(IMP_FLM, "Инцендиновый Поджигатель", { c:"heavy", t:"flame", rng:30, rof:"S/–/–", dmg:"1d10+12 E(Fl)", pen:6, clip:10, rld:"2", wt:20, av:3, props:"Flame, Spray, Linger (1d5)" }),
  W(IMP_FLM, "Огневой Прожектор", { c:"basic", t:"flame", rng:20, rof:"S/–/–", dmg:"2d10+6 E(Fl)", pen:4, clip:10, rld:"4", wt:12, av:4, props:"Flame, Spray, Linger (1d5)" }),
  W(IMP_FLM, "Сжигатель", { c:"heavy", t:"flame", rng:30, rof:"S/–/–", dmg:"2d10+9 E(Fl)", pen:6, clip:15, rld:"4", wt:20, av:4, props:"Blinding (0), Extreme (9), Flame, Spray, Linger (1d10), Legion" }),

  // ═══════════════════════════ АСТАРТЕС: ОГНЕМЁТЫ ═══════════════════════════
  W(AST_FLM, "Ручной Огнемёт (Астартес)", { c:"pistol", t:"flame", rng:10, rof:"S/–/–", dmg:"1d10+9 E(Fl)", pen:4, clip:2, rld:"2", wt:5, av:2, props:"Flame, Spray, Linger (1d5), Legion" }),
  W(AST_FLM, "Огнемёт (Астартес)", { c:"basic", t:"flame", rng:20, rof:"S/–/–", dmg:"1d10+9 E(Fl)", pen:4, clip:6, rld:"2", wt:10, av:1, props:"Flame, Spray, Linger (1d5), Legion" }),
  W(AST_FLM, "Комби-Огнемёт (Астартес)", { c:"basic", t:"flame", rng:20, rof:"S/–/–", dmg:"1d10+9 E(Fl)", pen:4, clip:1, rld:"10", wt:5, av:1, props:"Combi, Flame, Spray, Linger (1d5), Legion" }),
  W(AST_FLM, "Тяжёлый Огнемёт (Астартес)", { c:"heavy", t:"flame", rng:30, rof:"S/–/–", dmg:"1d10+12 E(Fl)", pen:6, clip:15, rld:"2", wt:25, av:2, props:"Flame, Spray, Linger (1d5), Legion" }),
  W(AST_FLM, "Штурмовой Огнемёт (Астартес)", { c:"basic", t:"flame", rng:20, rof:"S/–/–", dmg:"1d10+11 E(Fl)", pen:4, clip:10, rld:"2", wt:20, av:2, props:"Flame, Spray, Linger (1), Legion" }),
  // Огнемёты Астартес (Legion (P)):
  W(AST_FLM, "Огнешторм Перчатка", { c:"pistol", t:"flame", rng:20, rof:"S/–/–", dmg:"1d10+9 E(Fl)", pen:4, clip:6, rld:"2", wt:6, av:3, props:"Flame, Spray, Linger (1d5), Legion (P), Wrist" }),

  // ═══════════════════════════ ИМПЕРСКОЕ: ВОЛЬКАНСКОЕ ═══════════════════════════
  W(IMP_VOL, "Волькитовый Бластер", { c:"heavy", t:"laser", rng:100, rof:"S/4/10", dmg:"3d10+3 E(Ls)", pen:4, clip:120, rld:"2", wt:32, av:2, props:"Cognis, Deflagrate (5)" }),
  W(IMP_VOL, "Волькитовая Серпента", { c:"pistol", t:"laser", rng:30, rof:"S/2/–", dmg:"2d10+5 E(Ls)", pen:4, clip:30, rld:"1", wt:6, av:4, props:"Deflagrate (3)" }),
  W(IMP_VOL, "Волькитовый Разрядник", { c:"basic", t:"laser", rng:75, rof:"S/3/–", dmg:"2d10+6 E(Ls)", pen:4, clip:60, rld:"1", wt:12, av:4, props:"Deflagrate (4)" }),
  W(IMP_VOL, "Комби-Волькит", { c:"basic", t:"laser", rng:75, rof:"S/3/–", dmg:"2d10+6 E(Ls)", pen:4, clip:9, rld:"10", wt:6, av:4, props:"Combi, Deflagrate (4)" }),
  W(IMP_VOL, "Волькитовый Каливер", { c:"basic", t:"laser", rng:150, rof:"S/4/6", dmg:"2d10+6 E(Ls)", pen:4, clip:60, rld:"1", wt:16, av:4, props:"Deflagrate (4)" }),
  W(IMP_VOL, "Волькитовая Кулеврина", { c:"heavy", t:"laser", rng:150, rof:"–/–/8", dmg:"3d10+3 E(Ls)", pen:4, clip:200, rld:"4", wt:40, av:4, props:"Deflagrate (5)" }),

  // ═══════════════════════════ АСТАРТЕС: ВОЛЬКАНСКОЕ ═══════════════════════════
  W(AST_VOL, "Нео-Волькитовый Пистолет", { c:"pistol", t:"laser", rng:50, rof:"S/2/–", dmg:"3d10+3 E(Ls)", pen:4, clip:30, rld:"4", wt:10, av:3, props:"Imprecise, Recharge, Surge (3), Deflagrate (3), Legion (P)" }),

  // ═══════════════════════════ ИМПЕРСКОЕ: ГРАВИТОННОЕ ═══════════════════════════
  W(IMP_GRAV, "Гравитонный Пистолет", { c:"pistol", t:"exotic", rng:15, rof:"S/–/–", dmg:"1d10+4 I(Cr)", pen:0, clip:3, rld:"2", wt:4, av:4, props:"Concussive (3), Blast (3), Graviton, Linger (3), Haywire (3)" }),
  W(IMP_GRAV, "Гравитонное Ружьё", { c:"basic", t:"exotic", rng:30, rof:"S/–/–", dmg:"1d10+4 I(Cr)", pen:0, clip:4, rld:"2", wt:8, av:3, props:"Concussive (3), Graviton, Blast (5), Linger (5), Haywire (5)" }),
  W(IMP_GRAV, "Комби-Гравитон", { c:"basic", t:"exotic", rng:30, rof:"S/–/–", dmg:"1d10+4 I(Cr)", pen:0, clip:1, rld:"10", wt:4, av:3, props:"Combi, Concussive (3), Blast (5), Graviton, Linger (5), Haywire (5)" }),
  W(IMP_GRAV, "Грав Пистолет", { c:"pistol", t:"exotic", rng:20, rof:"S/–/–", dmg:"†", pen:15, clip:5, rld:"2", wt:6, av:3, props:"Grav, Imprecise" }),
  W(IMP_GRAV, "Гравган", { c:"basic", t:"exotic", rng:80, rof:"S/2/–", dmg:"†", pen:15, clip:12, rld:"2", wt:12, av:3, props:"Grav, Imprecise" }),
  W(IMP_GRAV, "Комби-Грав", { c:"basic", t:"exotic", rng:80, rof:"S/–/–", dmg:"†", pen:15, clip:1, rld:"10", wt:6, av:3, props:"Combi, Grav, Imprecise" }),
  W(IMP_GRAV, "Грав Пушка", { c:"heavy", t:"exotic", rng:100, rof:"S/3/6", dmg:"†", pen:15, clip:36, rld:"2", wt:55, av:4, props:"Grav, Imprecise" }),
  W(IMP_GRAV, "Грав-Усилитель", { c:"heavy", t:"exotic", rng:100, rof:"S/–/–", dmg:"†", pen:0, clip:12, rld:"1", wt:35, av:4, props:"Spray" }),

  // ═══════════════════════════ ИМПЕРСКОЕ: ГРАНАТОМЁТЫ (база) ═══════════════════════════
  W(IMP_LCH, "Однозарядный Гранатомёт", { c:"basic", t:"launcher", rng:60, rof:"S/–/–", dmg:"", pen:0, clip:1, rld:"½", wt:3, av:-2, props:"Carbine, Combi, Imprecise, Reliable +Pistol Grip", note:"Стреляет гранатами (выстрелами); урон и свойства — от заряженной гранаты." }),
  W(IMP_LCH, "Револьверный Гранатомёт", { c:"basic", t:"launcher", rng:60, rof:"S/–/–", dmg:"", pen:0, clip:8, rld:"2", wt:7, av:-1, props:"Imprecise, Revolver", note:"Стреляет гранатами (выстрелами); урон и свойства — от заряженной гранаты." }),
  W(IMP_LCH, "Вспомогательный Гранатомёт", { c:"basic", t:"launcher", rng:40, rof:"S/–/–", dmg:"", pen:0, clip:4, rld:"2", wt:5, av:-1, props:"Combi, Imprecise, Revolver", note:"Стреляет гранатами (выстрелами); урон и свойства — от заряженной гранаты." }),
  W(IMP_LCH, "Штурмовой Гранатомёт", { c:"basic", t:"launcher", rng:30, rof:"S/2/–", dmg:"", pen:0, clip:8, rld:"4", wt:7, av:1, props:"Carbine, Imprecise, Unreliable", note:"Стреляет гранатами (выстрелами); урон и свойства — от заряженной гранаты." }),
  W(IMP_LCH, "Авто-Гранатомёт", { c:"heavy", t:"launcher", rng:80, rof:"S/2/4", dmg:"", pen:0, clip:20, rld:"4", wt:35, av:1, props:"Imprecise", note:"Стреляет гранатами (выстрелами); урон и свойства — от заряженной гранаты." }),
  W(IMP_LCH, "Полевой Миномёт", { c:"heavy", t:"launcher", rng:200, rof:"S/–/–", dmg:"", pen:0, clip:6, rld:"4", wt:45, av:1, props:"Arcing, Imprecise", note:"Стреляет крупными выстрелами (L.); урон и свойства — от заряженного боеприпаса." }),
  W(IMP_LCH, "Гранатомёт Хавок", { c:"heavy", t:"launcher", rng:100, rof:"S/2/6", dmg:"", pen:0, clip:6, rld:"2", wt:35, av:1, props:"Imprecise, Reliable, Legion", note:"Стреляет гранатами (выстрелами); урон и свойства — от заряженной гранаты." }),
  W(IMP_LCH, "Гренадерская Перчатка", { c:"basic", t:"launcher", rng:30, rof:"S/–/–", dmg:"", pen:0, clip:4, rld:"4", wt:40, av:1, props:"Imprecise, Reliable, Ogrynized", note:"Стреляет гранатами (выстрелами); урон и свойства — от заряженной гранаты." }),
  W(IMP_LCH, "Гранатная Обвязка", { c:"pistol", t:"launcher", rng:40, rof:"S/–/–", dmg:"", pen:0, clip:6, rld:"2", wt:10, av:2, props:"Imprecise, Independent, Legion, Twin-Linked", note:"Стреляет гранатами (выстрелами); урон и свойства — от заряженной гранаты." }),
  W(IMP_LCH, "Подавительный Карабин", { c:"basic", t:"launcher", rng:60, rof:"S/2/–", dmg:"", pen:0, clip:8, rld:"2", wt:5, av:3, props:"Carbine, Imprecise", note:"Стреляет гранатами (выстрелами); урон и свойства — от заряженной гранаты." }),

  // ═══════════════════════════ АСТАРТЕС: ГРАНАТОМЁТЫ ═══════════════════════════
  W(AST_LCH, "Однозарядный Гранатомёт (Астартес)", { c:"basic", t:"launcher", rng:60, rof:"S/–/–", dmg:"", pen:0, clip:1, rld:"½", wt:5, av:0, props:"Carbine, Combi, Imprecise, Reliable, Legion +Pistol Grip", note:"Стреляет гранатами (выстрелами)." }),
  W(AST_LCH, "Револьверный Гранатомёт (Астартес)", { c:"basic", t:"launcher", rng:60, rof:"S/–/–", dmg:"", pen:0, clip:8, rld:"2", wt:15, av:1, props:"Imprecise, Revolver, Legion", note:"Стреляет гранатами (выстрелами)." }),
  W(AST_LCH, "Вспомогательный Гранатомёт (Астартес)", { c:"basic", t:"launcher", rng:40, rof:"S/–/–", dmg:"", pen:0, clip:4, rld:"2", wt:8, av:1, props:"Combi, Imprecise, Revolver, Legion", note:"Стреляет гранатами (выстрелами)." }),
  W(AST_LCH, "Штурмовой Гранатомёт (Астартес)", { c:"basic", t:"launcher", rng:30, rof:"S/2/–", dmg:"", pen:0, clip:8, rld:"4", wt:15, av:2, props:"Carbine, Imprecise, Unreliable, Legion", note:"Стреляет гранатами (выстрелами)." }),
  W(AST_LCH, "Авто-Гранатомёт (Астартес)", { c:"heavy", t:"launcher", rng:80, rof:"S/2/4", dmg:"", pen:0, clip:20, rld:"4", wt:40, av:2, props:"Imprecise, Legion", note:"Стреляет гранатами (выстрелами)." }),

  // ═══════════════════════════ ИМПЕРСКОЕ: ГРАНАТЫ ═══════════════════════════
  W(IMP_GRN, "Огнебомба", { c:"thrown", t:"explosive", dmg:"1d5 E(Fl)", pen:0, clip:1, rld:"–", wt:0.3, av:-4, props:"Blast (2), Flame, Flush, Linger (1)", note:THROW_GRENADE }),
  W(IMP_GRN, "Дряньбомба", { c:"thrown", t:"explosive", dmg:"1d5 C", pen:1, clip:1, rld:"–", wt:0.5, av:-3, props:"Blast (3), Corrosive (1), Flush, Linger (2d10), Toxic (-2)", note:THROW_GRENADE }),
  W(IMP_GRN, "Фраг", { c:"thrown", t:"explosive", dmg:"2d10 X(Fr)", pen:0, clip:1, rld:"–", wt:0.5, av:-2, props:"Blast (3), Tearing", note:"Версия Легиона: 2d10+2 X(Fr), Blast (4), Tearing, Legion (R 0). " + THROW_GRENADE }),
  W(IMP_GRN, "Оглушающая", { c:"thrown", t:"explosive", dmg:"", pen:0, clip:1, rld:"–", wt:0.5, av:-2, props:"Blast (3), Concussive (2)", note:"Версия Легиона: Blast (4), Concussive (2), Legion. " + THROW_GRENADE }),
  W(IMP_GRN, "Дымовая", { c:"thrown", t:"explosive", dmg:"", pen:0, clip:1, rld:"–", wt:0.5, av:-2, props:"Smoke (7)", note:"Версия Легиона: Smoke (10), Legion. " + THROW_GRENADE }),
  W(IMP_GRN, "Крак", { c:"thrown", t:"explosive", dmg:"2d10+4 X", pen:6, clip:1, rld:"–", wt:0.5, av:-1, props:"Concussive (0)", note:"Версия Легиона: 2d10+6 X, Concussive (1), Legion (R 1). " + THROW_GRENADE }),
  W(IMP_GRN, "Зажигательная", { c:"thrown", t:"explosive", dmg:"1d10 E(Fl)", pen:0, clip:1, rld:"–", wt:0.5, av:-1, props:"Blast (2), Flame, Flush, Linger (1d5)", note:"Версия Легиона: 1d10+2 E(Fl), Blast (3), Flame, Legion, Flush, Linger (1d5). " + THROW_GRENADE }),
  W(IMP_GRN, "Моровая", { c:"thrown", t:"explosive", dmg:"2d10 C(Tx)", pen:0, clip:1, rld:"–", wt:1, av:0, props:"Blast (6), Linger (1d10), Toxic (2), Legion", note:THROW_GRENADE }),
  W(IMP_GRN, "Фотонная", { c:"thrown", t:"explosive", dmg:"", pen:0, clip:1, rld:"–", wt:0.5, av:0, props:"Blast (10), Blinding (0)", note:"Версия Легиона: Blast (12), Blinding (0), Legion. " + THROW_GRENADE }),
  W(IMP_GRN, "Плазменная", { c:"thrown", t:"explosive", dmg:"2d10+6 E", pen:4, clip:1, rld:"–", wt:0.2, av:1, props:"Blast (4)", note:THROW_GRENADE }),
  W(IMP_GRN, "Кислотная", { c:"thrown", t:"explosive", dmg:"1d10+2 C", pen:0, clip:1, rld:"–", wt:0.5, av:1, props:"Blast (2), Corrosive (3)", note:"Версия Легиона: 1d10+4 C, Blast (3), Corrosive (3), Legion. " + THROW_GRENADE }),
  W(IMP_GRN, "Галлюциногенная", { c:"thrown", t:"explosive", dmg:"", pen:0, clip:1, rld:"–", wt:0.5, av:1, props:"Blast (6), Hallucinogenic (2)", note:"Версия Легиона: Blast (10), Hallucinogenic (2), Legion. " + THROW_GRENADE }),
  W(IMP_GRN, "ЭМИ Граната", { c:"thrown", t:"explosive", dmg:"", pen:0, clip:1, rld:"–", wt:0.5, av:1, props:"Haywire (3)", note:"Версия Легиона: Haywire (5), Legion. " + THROW_GRENADE }),
  W(IMP_GRN, "Паутинная", { c:"thrown", t:"explosive", dmg:"", pen:0, clip:1, rld:"–", wt:0.5, av:1, props:"Blast (3), Snare (2), Linger (10)", note:"Версия Легиона: Blast (4), Snare (2), Linger (10), Legion. " + THROW_GRENADE }),
  W(IMP_GRN, "Мыслелом", { c:"thrown", t:"explosive", dmg:"2d10 E(El)", pen:2, clip:1, rld:"–", wt:0.5, av:2, props:"Blast (3), Shocking", note:THROW_GRENADE }),
  W(IMP_GRN, "Фосфорная", { c:"thrown", t:"explosive", dmg:"2d10+4 E(Fl)", pen:0, clip:1, rld:"–", wt:0.5, av:2, props:"Blast (2), Blinding (0), Flame (2d10), Linger (1d10)", note:THROW_GRENADE }),
  W(IMP_GRN, "Рад", { c:"thrown", t:"explosive", dmg:"1d5+4 X(Fr)", pen:0, clip:1, rld:"–", wt:0.5, av:2, props:"Blast (3), Rad (2d10)", note:"Версия Легиона: 1d5+6 X(Fr), Blast (4), Rad (2d10+2), Legion (R 3). " + THROW_GRENADE }),
  W(IMP_GRN, "Псайк-Аут", { c:"thrown", t:"explosive", dmg:"3d10 X(Fr)", pen:0, clip:1, rld:"–", wt:0.5, av:4, props:"Blast (3), Sanctified, Tearing", note:"Версия Легиона: 3d10+2 X(Fr), Blast (4), Sanctified, Tearing, Legion. " + THROW_GRENADE }),
  W(IMP_GRN, "Вихревая", { c:"thrown", t:"explosive", dmg:"†", pen:0, clip:1, rld:"–", wt:1, av:5, props:"Blast (6), Linger (?/1d10)", note:THROW_GRENADE }),

  // ═══════════════════════════ ИМПЕРСКОЕ: БОМБЫ ═══════════════════════════
  W(IMP_BMB, "Подрывной Заряд", { c:"thrown", t:"explosive", dmg:"3d10+2×M X", pen:6, clip:1, rld:"–", wt:0, av:0, props:"Blast (3+M), Tearing", note:"Вес M кг (зависит от размера M). " + THROW_BOMB }),
  W(IMP_BMB, "Инферно Бомба", { c:"thrown", t:"explosive", dmg:"2d10+2 E(Fl)", pen:0, clip:1, rld:"–", wt:2, av:1, props:"Blast (6), Flame, Flush, Linger (5)", note:"Версия Легиона: 2d10+4 E(Fl), Blast (8), Flame, Legion, Flush, Linger (5) (4 кг). " + THROW_BOMB }),
  W(IMP_BMB, "Газовая Бомба", { c:"thrown", t:"explosive", dmg:"", pen:0, clip:1, rld:"–", wt:2, av:1, props:"Blast (6), Toxic (1), Linger (1d10)", note:"Автоматически пробивает негерметичную броню. Версия Легиона: Blast (9), Toxic (1), Linger (1d10), Legion (4 кг). " + THROW_BOMB }),
  W(IMP_BMB, "Завесная Бомба", { c:"thrown", t:"explosive", dmg:"", pen:0, clip:1, rld:"–", wt:2, av:1, props:"Smoke (15)", note:"Версия Легиона: Smoke (20), Legion. " + THROW_BOMB }),
  W(IMP_BMB, "Мельта Бомба", { c:"thrown", t:"explosive", dmg:"6d10 E", pen:15, clip:1, rld:"–", wt:3, av:2, props:"Blast (3)", note:"Версия Легиона: Blast (4), Legion (5 кг, R 3). " + THROW_BOMB }),
  W(IMP_BMB, "Замыкающая Бомба", { c:"thrown", t:"explosive", dmg:"", pen:0, clip:1, rld:"–", wt:2, av:3, props:"Haywire (7)", note:"Бросает 3d5 вместо 1d10 на эффект Haywire. Версия Легиона: Haywire (10), Legion (4 кг, R 4). " + THROW_BOMB }),
  W(IMP_BMB, "Фосфексная Бомба", { c:"thrown", t:"explosive", dmg:"4d10 E(Fl)", pen:6, clip:1, rld:"–", wt:3, av:4, props:"Blast (5), Corrosive (4), Flame (2d10), Linger (1d10), Rad (2d10), Toxic (3)", note:THROW_BOMB }),
  W(IMP_BMB, "Стазис Бомба", { c:"thrown", t:"explosive", dmg:"", pen:0, clip:1, rld:"–", wt:2, av:4, props:"Blast (2)", note:"Special (особый эффект стазиса). Версия Легиона: Blast (3), Special, Legion (4 кг). " + THROW_BOMB }),

  // ═══════════════════════════ ИМПЕРСКОЕ: ОРУЖИЕ МЕХАНИКУМ ═══════════════════════════
  W(IMP_MECH, "Гальваническая Винтовка", { c:"basic", t:"exotic", rng:150, rof:"S/3/–", dmg:"1d10+5 E(El)", pen:6, clip:24, rld:"1", wt:5, av:0, props:"Reliable, Tearing" }),
  W(IMP_MECH, "Гальванический Карабин", { c:"basic", t:"exotic", rng:100, rof:"S/2/–", dmg:"1d10+5 E(El)", pen:6, clip:24, rld:"1", wt:4, av:0, props:"Carbine, Reliable, Tearing +Pistol Grip" }),
  W(IMP_MECH, "Гальванический Кастер", { c:"basic", t:"exotic", rng:50, rof:"S/3/–", dmg:"1d10+5 E(El)", pen:6, clip:24, rld:"1", wt:7, av:2, props:"Reliable, Scatter, Tearing +Combi" }),
  W(IMP_MECH, "Радиевый Пистолет", { c:"pistol", t:"exotic", rng:25, rof:"S/2/–", dmg:"1d10+3 E", pen:2, clip:12, rld:"1", wt:2, av:0, props:"Combi, Felling (4), Rad (1d5)" }),
  W(IMP_MECH, "Радиевая Серпента", { c:"pistol", t:"exotic", rng:50, rof:"S/2/–", dmg:"1d10+5 E", pen:2, clip:24, rld:"1", wt:2, av:2, props:"Accurate, Felling (4), Rad (1d5)" }),
  W(IMP_MECH, "Радиевый Карабин", { c:"basic", t:"exotic", rng:80, rof:"S/3/5", dmg:"1d10+4 E", pen:2, clip:36, rld:"1", wt:5, av:0, props:"Carbine, Felling (4), Rad (1d5)" }),
  W(IMP_MECH, "Радиевая Джезайл", { c:"basic", t:"exotic", rng:300, rof:"S/–/–", dmg:"1d10+8 E", pen:4, clip:16, rld:"2", wt:18, av:2, props:"Accurate, Felling (4), Rad (1d10), Reliable" }),
  W(IMP_MECH, "Лучевой Очиститель", { c:"basic", t:"exotic", rng:30, rof:"S/–/–", dmg:"2d10+2 E", pen:10, clip:36, rld:"1", wt:20, av:3, props:"Felling (4), Rad (1d10), Recharge, Spray" }),
  W(IMP_MECH, "Облучающее Орудие", { c:"heavy", t:"exotic", rng:50, rof:"S/–/–", dmg:"1d10+8 E", pen:10, clip:18, rld:"2", wt:42, av:4, props:"Felling (4), Rad (2d10), Spray" }),
  W(IMP_MECH, "Флешетный Бластер", { c:"pistol", t:"exotic", rng:30, rof:"S/5/10", dmg:"1d10+2 R", pen:2, clip:100, rld:"½", wt:2, av:1, props:"Combi, Hefty (I(Cr)), Reliable, Storm (2), Tearing" }),
  W(IMP_MECH, "Флешетный Карабин", { c:"basic", t:"exotic", rng:100, rof:"S/5/10", dmg:"1d10+4 R", pen:3, clip:100, rld:"½", wt:4, av:1, props:"Carbine, Reliable, Storm (2), Tearing +Secondary Grip" }),
  W(IMP_MECH, "Дуговой Пистолет", { c:"pistol", t:"exotic", rng:30, rof:"S/–/–", dmg:"1d10+9 E(El)", pen:4, clip:20, rld:"2", wt:3, av:2, props:"Arc (9/2d10), Haywire (0), Imprecise" }),
  W(IMP_MECH, "Дуговая Винтовка", { c:"basic", t:"exotic", rng:100, rof:"S/3/–", dmg:"1d10+9 E(El)", pen:4, clip:30, rld:"2", wt:6, av:2, props:"Arc (9/2d10), Haywire (0), Imprecise" }),
  W(IMP_MECH, "Комби-Дуговик", { c:"basic", t:"exotic", rng:100, rof:"S/3/–", dmg:"1d10+9 E(El)", pen:4, clip:3, rld:"10", wt:3, av:2, props:"Arc (9/2d10), Combi, Haywire (0), Imprecise" }),
  W(IMP_MECH, "Тяжёлая Дуговая Винтовка", { c:"heavy", t:"exotic", rng:150, rof:"S/3/5", dmg:"2d10+6 E(El)", pen:4, clip:30, rld:"2", wt:35, av:3, props:"Arc (8/2d10), Haywire (0), Imprecise" }),
  W(IMP_MECH, "Дуговая Пика", { c:"basic", t:"exotic", rng:30, rof:"S/2/–", dmg:"2d10+6 E(El)", pen:4, clip:20, rld:"2", wt:7, av:3, props:"Arc (8/2d10), Haywire (0), Imprecise" }),
  W(IMP_MECH, "Молниевое Ружьё", { c:"heavy", t:"exotic", rng:100, rof:"S/–/–", dmg:"3d10+6 E(El)", pen:8, clip:10, rld:"1", wt:15, av:2, props:"Accurate, Arc (7/2d10), Shocking" }),
  W(IMP_MECH, "Фосфорный Пистолет", { c:"pistol", t:"exotic", rng:30, rof:"S/–/–", dmg:"1d10+5 E(Fl)", pen:3, clip:6, rld:"1", wt:1, av:1, props:"Combi, Blinding (-2), Flame (2d10), Imprecise, Reliable" }),
  W(IMP_MECH, "Фосфорный Бласт Пистолет", { c:"pistol", t:"exotic", rng:30, rof:"S/–/–", dmg:"2d10+3 E(Fl)", pen:5, clip:6, rld:"1", wt:3, av:2, props:"Combi, Blinding (0), Flame (2d10), Hefty (I(Cr)), Imprecise, Reliable" }),
  W(IMP_MECH, "Фосфорный Бласт Карабин", { c:"basic", t:"exotic", rng:80, rof:"S/3/–", dmg:"2d10+3 E(Fl)", pen:5, clip:6, rld:"½", wt:7, av:2, props:"Carbine, Blinding (0), Flame (2d10), Imprecise, Reliable" }),
  W(IMP_MECH, "Фосфорная Серпента", { c:"pistol", t:"exotic", rng:60, rof:"S/–/–", dmg:"2d10+4 E(Fl)", pen:5, clip:4, rld:"2", wt:3, av:3, props:"Accurate, Blinding (0), Flame (2d10), Imprecise" }),
  W(IMP_MECH, "Фосфорный Бластер", { c:"basic", t:"exotic", rng:100, rof:"S/3/–", dmg:"2d10+4 E(Fl)", pen:5, clip:12, rld:"2", wt:6, av:2, props:"Blinding (0), Flame (2d10), Imprecise" }),
  W(IMP_MECH, "Фотонная Перчатка", { c:"pistol", t:"exotic", rng:30, rof:"S/2/–", dmg:"2d10+8 E(Ls)", pen:10, clip:8, rld:"4", wt:4, av:4, props:"Cognis, Extreme (9), Lance, Proven (3)" }),
  W(IMP_MECH, "Фотонный Движитель", { c:"basic", t:"exotic", rng:150, rof:"S/–/–", dmg:"2d10+8 E(Ls)", pen:10, clip:12, rld:"4", wt:12, av:4, props:"Extreme (9), Lance, Proven (3)" }),
  W(IMP_MECH, "Тёмнопламенная Пушка", { c:"heavy", t:"exotic", rng:300, rof:"S/–/–", dmg:"3d10+8 E(Ls)", pen:12, clip:12, rld:"4", wt:30, av:4, props:"Extreme (9), Lance, Proven (3)" }),
  W(IMP_MECH, "Трансурановая Аркебуза", { c:"heavy", t:"exotic", rng:200, rof:"S/–/–", dmg:"3d10+4 I", pen:8, clip:4, rld:"2", wt:27, av:3, props:"Accurate, Felling (6), Rad (2d10)" }),
  W(IMP_MECH, "Гамма Пистолет", { c:"pistol", t:"exotic", rng:30, rof:"S/–/–", dmg:"1d10+8 E", pen:14, clip:8, rld:"1", wt:3, av:4, props:"Corrosive (14), Reliable, Rad (1d10+5), Tearing" }),
  W(IMP_MECH, "Нанитный Репликатор", { c:"pistol", t:"exotic", rng:30, rof:"S/–/–", dmg:"1d10+3 R", pen:4, clip:0, rld:"†", wt:3, av:5, props:"Blast (2), Cognis, Combi, Corrosive (2), Linger (?/1d5), Recharge", note:"Обойма ∞ (наниты)." }),
  W(IMP_MECH, "Искореняющий Излучатель", { bands:[{label:"10–20 м",dice:1,pen:3},{label:"до 10 м",dice:2,pen:6}], c:"heavy", t:"exotic", rng:30, rof:"S/–/–", dmg:"1d10+4 E", pen:3, clip:5, rld:"2", wt:32, av:3, props:"Cognis, Spray" }),
  W(IMP_MECH, "Торсионная Пушка", { c:"heavy", t:"exotic", rng:300, rof:"S/–/–", dmg:"3d10+8 I(Cr)", pen:30, clip:10, rld:"4", wt:35, av:3, props:"Extreme (8)" }),
  W(IMP_MECH, "Трансзвуковая Пушка", { c:"heavy", t:"exotic", rng:30, rof:"S/–/–", dmg:"2d10+2 X", pen:4, clip:30, rld:"2", wt:20, av:3, props:"Cognis, Spray, Resonant" }),
  W(IMP_MECH, "Магнарельсовая Пика", { c:"heavy", t:"exotic", rng:200, rof:"S/–/–", dmg:"3d10+4 I", pen:18, clip:30, rld:"2", wt:20, av:3, props:"Accurate, Cognis, Extreme (7), Proven (4)" }),
  W(IMP_MECH, "Конверсионный Излучатель", { bands:[{label:"50–99 м",dice:1,pen:2},{label:"100–149 м",dice:2,pen:4},{label:"150–199 м",dice:3,pen:6},{label:"200–249 м",dice:4,pen:8},{label:"250–299 м",dice:5,pen:10},{label:"300 м и дальше",dice:6,pen:12}], c:"heavy", t:"exotic", rng:300, rof:"S/–/–", dmg:"1d10+10 E", pen:2, clip:5, rld:"5", wt:60, av:4, props:"Blast (1), Cognis" }),

  // ═══════════════════════════ ИМПЕРСКОЕ: ПРИМИТИВНОЕ (луки, арбалеты, метательное) ═══════════════════════════
  W(IMP_PRIM, "Лук", { c:"basic", t:"lowtech", rng:0, rof:"S/–/–", dmg:"1d10-3+S.b R", pen:0, clip:1, rld:"½", wt:2, av:-3, props:"Piercing, Primitive, Reliable", note:"Дальность S.b×10 м. Урон 1d10−3+S.b R (добавь бонус Силы). Draw (2-3)." }),
  W(IMP_PRIM, "Длинный Лук", { c:"basic", t:"lowtech", rng:0, rof:"S/–/–", dmg:"1d10-1+S.b R", pen:1, clip:1, rld:"½", wt:3, av:-2, props:"Piercing, Primitive, Reliable", note:"Дальность S.b×15 м. Урон 1d10−1+S.b R. Draw (4-5)." }),
  W(IMP_PRIM, "Великий Лук", { c:"basic", t:"lowtech", rng:0, rof:"S/–/–", dmg:"1d10+S.b R", pen:3, clip:1, rld:"½", wt:10, av:1, props:"Piercing, Primitive, Reliable", note:"Дальность S.b×20 м. Урон 1d10+S.b R. Draw (6-8)." }),
  W(IMP_PRIM, "Ручной Арбалет", { c:"pistol", t:"lowtech", rng:20, rof:"S/–/–", dmg:"1d10 R", pen:0, clip:1, rld:"2", wt:1, av:-2, props:"Piercing, Primitive, Reliable" }),
  W(IMP_PRIM, "Арбалет", { c:"basic", t:"lowtech", rng:50, rof:"S/–/–", dmg:"1d10+2 R", pen:1, clip:1, rld:"2", wt:3, av:-2, props:"Piercing, Primitive, Reliable" }),
  W(IMP_PRIM, "Арбалет Кондемнор", { c:"basic", t:"lowtech", rng:40, rof:"S/–/–", dmg:"1d10+1 R", pen:1, clip:1, rld:"2", wt:1.5, av:1, props:"Combi, Piercing, Primitive, Reliable" }),
  W(IMP_PRIM, "Арбалеста", { c:"basic", t:"lowtech", rng:100, rof:"S/–/–", dmg:"1d10+4 R", pen:2, clip:1, rld:"4", wt:5, av:-1, props:"Accurate, Piercing, Primitive" }),
  W(IMP_PRIM, "Праща", { c:"basic", t:"lowtech", rng:0, rof:"S/–/–", dmg:"1d5-3+S.b I", pen:0, clip:1, rld:"½", wt:0, av:-4, props:"Primitive", note:"Дальность S.b×7 м. Урон 1d5−3+S.b I." }),
  W(IMP_PRIM, "Дротик", { c:"thrown", t:"lowtech", rng:0, rof:"S/–/–", dmg:"1d10 R", pen:0, clip:1, rld:"–", wt:0.8, av:-3, props:"Piercing, Primitive", note:"Метание: Rng S.b×5 м. Урон 1d10+S.b R." }),
  W(IMP_PRIM, "Атлатль", { c:"thrown", t:"lowtech", rng:0, rof:"S/–/–", dmg:"1d10 R", pen:0, clip:1, rld:"–", wt:1, av:-2, props:"Piercing, Primitive", note:"Метание: Rng S.b×8 м. Урон 1d10+S.b R." }),
  W(IMP_PRIM, "Метательный Нож", { c:"thrown", t:"lowtech", rng:0, rof:"S/–/–", dmg:"1d5 R", pen:0, clip:1, rld:"–", wt:0.2, av:-3, props:"Primitive", note:"Метание: Rng S.b×3 м. Урон 1d5+S.b R." }),
  W(IMP_PRIM, "Метательный Топор", { c:"thrown", t:"lowtech", rng:0, rof:"S/–/–", dmg:"1d10 R", pen:0, clip:1, rld:"–", wt:0.5, av:-3, props:"Imprecise, Inaccurate, Primitive", note:"Метание: Rng S.b×3 м. Урон 1d10+S.b R." }),
  W(IMP_PRIM, "Бола", { c:"thrown", t:"lowtech", rng:0, rof:"S/–/–", dmg:"1d5 I(Cr)", pen:0, clip:1, rld:"–", wt:0.5, av:-2, props:"Imprecise, Primitive, Snare (1)", note:"Метание: Rng S.b×3 м. Урон 1d5+S.b I(Cr)." }),

  // ═══════════════════════════ ИМПЕРСКОЕ: ЭКЗОТИЧЕСКОЕ (ТЕХНОЛОГИЧЕСКОЕ) ═══════════════════════════
  W(IMP_EXT, "Иглопистолет", { c:"pistol", t:"exotic", rng:45, rof:"S/3/5", dmg:"1d10+1 R", pen:2, clip:60, rld:"½", wt:1, av:3, props:"Accurate, Precise, Toxic (1) +Scope" }),
  W(IMP_EXT, "Игловинтовка", { c:"basic", t:"exotic", rng:180, rof:"S/3/5", dmg:"1d10+1 R", pen:2, clip:120, rld:"1", wt:3, av:3, props:"Accurate, Carbine, Precise, Toxic (1) +Scope" }),
  W(IMP_EXT, "Комби-Игловик", { c:"basic", t:"exotic", rng:180, rof:"S/3/5", dmg:"1d10+1 R", pen:2, clip:40, rld:"5", wt:1, av:3, props:"Accurate, Combi, Precise, Toxic (1)" }),
  W(IMP_EXT, "Паутинный Пистолет", { c:"pistol", t:"exotic", rng:30, rof:"S/–/–", dmg:"", pen:0, clip:1, rld:"1", wt:2, av:1, props:"Combi, Snare (2)" }),
  W(IMP_EXT, "Паутинник", { c:"basic", t:"exotic", rng:50, rof:"S/–/–", dmg:"", pen:0, clip:1, rld:"1", wt:5, av:1, props:"Blast (5), Linger (5), Snare (3)" }),
  W(IMP_EXT, "Тяжёлый Паутинник", { c:"heavy", t:"exotic", rng:80, rof:"S/–/–", dmg:"", pen:0, clip:4, rld:"3", wt:17, av:2, props:"Blast (6), Linger (10), Snare (4)" }),
  W(IMP_EXT, "Бритвенный Паутинник", { c:"basic", t:"exotic", rng:50, rof:"S/–/–", dmg:"1d10+2 X", pen:3, clip:6, rld:"2", wt:12, av:4, props:"Blast (2), Crippling (3), Snare (1)" }),
  W(IMP_EXT, "Архео-Револьвер", { c:"pistol", t:"exotic", rng:40, rof:"S/–/–", dmg:"2d10+5 I", pen:5, clip:6, rld:"2", wt:3, av:3, props:"Extreme (9), Proven (3), Recoil (6), Revolver" }),
  W(IMP_EXT, "Кинетический Деструктор", { c:"pistol", t:"exotic", rng:70, rof:"S/–/–", dmg:"2d10+9 I", pen:6, clip:9, rld:"2", wt:5, av:4, props:"Accurate, Extreme (9), Legion, Proven (4), Recoil (11), Reliable, Revolver" }),
  W(IMP_EXT, "Кинетический Облитератор", { c:"basic", t:"exotic", rng:150, rof:"S/3/5", dmg:"2d10+9 I", pen:6, clip:50, rld:"2", wt:9, av:4, props:"Accurate, Extreme (9), Proven (4), Reliable" }),
  W(IMP_EXT, "Пистолет Экзитус", { c:"pistol", t:"exotic", rng:70, rof:"S/3/5", dmg:"2d10+6 I", pen:9, clip:9, rld:"1", wt:2, av:4, props:"Accurate, Extreme (9), Precise, Proven (3), Tearing +Ammo Selector, Red Dot" }),
  W(IMP_EXT, "Винтовка Экзитус", { c:"basic", t:"exotic", rng:300, rof:"S/–/–", dmg:"2d10+6 I", pen:9, clip:10, rld:"1", wt:5, av:4, props:"Accurate, Extreme (9), Precise, Proven (3), Tearing +Ammo Selector, Omni-Scope" }),
  W(IMP_EXT, "Дарткастер", { c:"pistol", t:"exotic", rng:20, rof:"S/–/–", dmg:"1d10 R", pen:0, clip:6, rld:"2", wt:2.5, av:1, props:"Combi, Reliable, Precise, Revolver, Toxic (4)" }),
  W(IMP_EXT, "Воющая Винтовка", { c:"basic", t:"exotic", rng:180, rof:"S/–/–", dmg:"2d10 R", pen:4, clip:36, rld:"5", wt:16, av:2, props:"Accurate, Concussive, Maximal" }),
  W(IMP_EXT, "Силовой Проектор", { c:"pistol", t:"exotic", rng:30, rof:"S/–/–", dmg:"2d10 I(Cr)", pen:0, clip:0, rld:"–", wt:2, av:3, props:"Very Reliable", note:"Обойма ∞." }),
  W(IMP_EXT, "Хельморозный Пистолет", { c:"pistol", t:"exotic", rng:20, rof:"S/–/–", dmg:"†", pen:0, clip:8, rld:"2", wt:2.5, av:3, props:"Legion, Tearing" }),
  W(IMP_EXT, "Нейральный Шредер", { c:"pistol", t:"exotic", rng:20, rof:"S/–/–", dmg:"2d10+2 X", pen:4, clip:12, rld:"3", wt:2, av:4, props:"Maximal, Shocking, Spray" }),

  // ═══════════════════════════ ИМПЕРСКОЕ: ЭКЗОТИЧЕСКОЕ (МИСТИЧЕСКОЕ) ═══════════════════════════
  W(IMP_EXM, "Звуковой Пистолет", { c:"pistol", t:"exotic", rng:30, rof:"S/2/–", dmg:"1d10+9 X", pen:4, clip:0, rld:"†", wt:7, av:3, props:"Legion", note:"Обойма ∞." }),
  W(IMP_EXM, "Звуковой Бластер", { c:"basic", t:"exotic", rng:100, rof:"S/3/6", dmg:"1d10+9 X", pen:4, clip:0, rld:"†", wt:21, av:3, props:"Legion", note:"Обойма ∞." }),
  W(IMP_EXM, "Бластмастер [Альт]", { c:"basic", t:"exotic", rng:250, rof:"S/2/–", dmg:"1d10+12 X", pen:6, clip:0, rld:"†", wt:41, av:4, props:"Devastating (2), Legion, Storm (2)", note:"Обойма ∞. Альт. режим: 150 м, S/–/–, 3d10+10 X, Pen 8, Blast (4), Devastating (2), Legion." }),
  W(IMP_EXM, "Сирена Рока", { c:"pistol", t:"exotic", rng:30, rof:"S/–/–", dmg:"2d10+6 X", pen:9, clip:0, rld:"†", wt:18, av:4, props:"Extreme (6), Independent, Legion, Spray", note:"Обойма ∞." }),
  W(IMP_EXM, "Какофони", { c:"heavy", t:"exotic", rng:150, rof:"S/3/6", dmg:"1d10+6 X", pen:14, clip:0, rld:"†", wt:55, av:5, props:"Concussive (4), Felling (4), Legion, Tainted, Tearing", note:"Обойма ∞." }),
  W(IMP_EXM, "Эктоплазменная Пушка", { c:"heavy", t:"exotic", rng:60, rof:"S/–/–", dmg:"3d10+6 E", pen:8, clip:12, rld:"4", wt:35, av:2, props:"Blast (2), Maximal, Overheats" }),
  W(IMP_EXM, "Судьбокастер", { c:"basic", t:"lowtech", rng:200, rof:"S/–/–", dmg:"1d10+2+S.b R", pen:6, clip:1, rld:"–", wt:1, av:2, props:"Crippling (3), Piercing, Proven (3), Very Reliable", note:"Лук. Дальность S.b-зависимая. Урон 1d10+2+S.b R. Draw (9-12)." }),
  W(IMP_EXM, "Кристальный Кастер", { c:"pistol", t:"exotic", rng:15, rof:"S/2/–", dmg:"1d10+4 R", pen:0, clip:0, rld:"–", wt:0.5, av:1, props:"Razor Sharp, Crippling (6)", note:"Обойма ∞. Альт. эффект: / Shocking." }),
  W(IMP_EXM, "Нейро-Срыватель", { c:"pistol", t:"exotic", rng:30, rof:"S/–/–", dmg:"3d10", pen:10, clip:0, rld:"–", wt:0.5, av:4, props:"Shocking", note:"Обойма ∞." }),
  W(IMP_EXM, "Извиватель", { c:"pistol", t:"exotic", rng:30, rof:"S/–/–", dmg:"2d10+4 R", pen:3, clip:0, rld:"–", wt:1.5, av:4, props:"Accurate, Toxic (2), Tainted", note:"Обойма ∞." }),
  W(IMP_EXM, "Жалострел", { c:"pistol", t:"exotic", rng:20, rof:"S/–/–", dmg:"1d10 C(Tx)", pen:14, clip:6, rld:"–", wt:1.5, av:5, props:"Hallucinogenic (4), Shocking, Toxic (4)" }),
  W(IMP_EXM, "Длинная Винтовка Разоритель", { c:"basic", t:"exotic", rng:150, rof:"S/–/–", dmg:"1d10+4 E", pen:2, clip:4, rld:"1", wt:3, av:1, props:"Accurate, Felling (3), Hallucinogenic (0)" }),
  W(IMP_EXM, "Зуболом", { c:"basic", t:"exotic", rng:100, rof:"S/–/–", dmg:"1d10+2 C", pen:4, clip:7, rld:"1", wt:6, av:4, props:"Accurate, Toxic (3)" }),
  W(IMP_EXM, "Каи-Пушка", { c:"basic", t:"exotic", rng:80, rof:"S/4/–", dmg:"2d10+6 X", pen:5, clip:96, rld:"2", wt:7, av:4, props:"Tainted, Tearing" }),
  W(IMP_EXM, "Адское Копьё Каи", { c:"basic", t:"exotic", rng:20, rof:"S/–/–", dmg:"2d10+2 E", pen:12, clip:20, rld:"4", wt:8, av:5, props:"Linger (1d10), Spray, Warp Weapon" }),
  W(IMP_EXM, "Пушка Душ", { c:"heavy", t:"exotic", rng:75, rof:"S/–/–", dmg:"3d10 E", pen:0, clip:10, rld:"–", wt:55, av:5, props:"Flame (2d10), Shocking, Warp Weapon" }),
  W(IMP_EXM, "Псипушка", { c:"heavy", t:"exotic", rng:100, rof:"S/4/7", dmg:"1d10+6 R", pen:4, clip:200, rld:"2", wt:60, av:4, props:"Legion, Razor Sharp, Sanctified, Tearing" }),
  W(IMP_EXM, "Псайлгушитель", { c:"basic", t:"exotic", rng:50, rof:"–/–/10", dmg:"1d10 E", pen:0, clip:60, rld:"½", wt:35, av:5, props:"Force, Legion, Storm (2)" }),

  // ═══════════════════════════ ИМПЕРСКОЕ: ИМПРОВИЗИРОВАННОЕ ═══════════════════════════
  W(IMP_IMPR, "Лазрезак", { c:"basic", t:"laser", rng:3, rof:"S/–/–", dmg:"4d10+10 E(Ls)", pen:10, clip:60, rld:"5", wt:4, av:-2, props:"Reliable, Surge (3)" }),
  W(IMP_IMPR, "Шахтёрский Лазер", { c:"heavy", t:"laser", rng:80, rof:"S/–/–", dmg:"4d10+5 E(Ls)", pen:5, clip:60, rld:"5", wt:15, av:0, props:"Inaccurate, Surge (7), Wrecker (3)" }),
  W(IMP_IMPR, "Заклепочная Пушка", { c:"heavy", t:"exotic", rng:30, rof:"S/3/6", dmg:"2d10+3 R", pen:3, clip:12, rld:"5", wt:12, av:0, props:"Inaccurate, Piercing" }),
  W(IMP_IMPR, "Штормовая Сварка", { c:"heavy", t:"exotic", rng:10, rof:"S/2/–", dmg:"3d10 E", pen:6, clip:6, rld:"3", wt:12, av:0, props:"Inaccurate, Melta, Overheats" }),
  W(IMP_IMPR, "Сейсмическая Пушка", { c:"heavy", t:"exotic", rng:80, rof:"S/3/5", dmg:"2d10+3 X", pen:3, clip:30, rld:"–", wt:15, av:0, props:"Imprecise, Surge (3), Wrecker (2)", note:"Режим 2: S/2/–, 3d10+12 X, Pen 6, Imprecise, Surge (6), Wrecker (4)." }),

  // ═══════════════════════════ ИМПЕРСКОЕ: РУКОПАШНОЕ — ПРИМИТИВНОЕ ═══════════════════════════
  M(IMP_MPRIM, "Тычковый Кинжал", { t:"lowtech", grip:"1р", form:"Кулак", reach:"0", dmg:"1d5 R", pen:0, props:"Precise, Primitive", bl:-1, wt:0.2, av:-3 }),
  M(IMP_MPRIM, "Латная Перчатка", { t:"lowtech", grip:"1р", form:"Кулак.Б", reach:"0", dmg:"1d5+1 I(Cr)", pen:0, props:"Imprecise, Primitive", bl:-1, wt:0.6, av:-3 }),
  M(IMP_MPRIM, "Нож", { t:"lowtech", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"1d5 R", pen:0, props:"Precise, Primitive", bl:0, wt:0.2, av:-3 }),
  M(IMP_MPRIM, "Руки-Лезвия", { t:"lowtech", grip:"Л", form:"Когти.Р", reach:"1", dmg:"1d10-1 R", pen:0, props:"Primitive", bl:0, wt:0.3, av:-1 }),
  M(IMP_MPRIM, "Запястный Клинок", { t:"lowtech", grip:"П", form:"Когти.П", reach:"1", dmg:"1d10-2 R", pen:0, props:"Primitive", bl:0, wt:0.8, av:-1 }),
  M(IMP_MPRIM, "Гладий", { t:"lowtech", grip:"1р [Об]", form:"Меч", reach:"1–3", dmg:"1d10 R", pen:0, props:"Primitive", bl:1, wt:0.9, av:-2 }),
  M(IMP_MPRIM, "Меч", { t:"lowtech", grip:"1р [2р, Об, Бл, Мх]", form:"Меч", reach:"2–4", dmg:"1d10 R", pen:0, props:"Primitive", bl:1, wt:1.2, av:-2 }),
  M(IMP_MPRIM, "Рапира", { t:"lowtech", grip:"1р [Об, Бл]", form:"Рапира", reach:"3–5", dmg:"1d10 R", pen:0, props:"Primitive", bl:1, wt:1.2, av:-2 }),
  M(IMP_MPRIM, "Сабля", { t:"lowtech", grip:"1р [2р, Об]", form:"Сабля", reach:"2–3", dmg:"1d10 R", pen:0, props:"Primitive", bl:1, wt:1.1, av:-2 }),
  M(IMP_MPRIM, "Топор", { t:"lowtech", grip:"1р [2р, Кл]", form:"Топор", reach:"3", dmg:"1d10+1 R", pen:1, props:"Imprecise, Primitive", bl:-1, wt:0.8, av:-3 }),
  M(IMP_MPRIM, "Клевец", { t:"lowtech", grip:"1р [2р]", form:"Крюк", reach:"3", dmg:"1d10+1 R", pen:3, props:"Felling (2), Primitive", bl:-1, wt:1.2, av:-2 }),
  M(IMP_MPRIM, "Боевой Молот", { prof:[PF("Крюк", "3", "1d10+1 R", 3, "Felling (2), Primitive")], t:"lowtech", grip:"1р [2р, Бл]", form:"Молот", reach:"3", dmg:"1d10+2 I(Cr)", pen:0, props:"Imprecise, Primitive", bl:-1, wt:0.8, av:-3, note:"Крюк: 1d10+1 R, Pen 3, Felling (2), Primitive." }),
  M(IMP_MPRIM, "Булава", { t:"lowtech", grip:"1р [2р]", form:"Булава", reach:"3", dmg:"1d10+1 I(Cr)", pen:0, props:"Imprecise, Primitive", bl:-1, wt:0.8, av:-3 }),
  M(IMP_MPRIM, "Кистень", { t:"lowtech", grip:"1р", form:"Кистень", reach:"4", dmg:"1d10+1 I(Cr)", pen:0, props:"Flexible, Imprecise, Primitive", bl:-2, wt:1.2, av:-2 }),
  M(IMP_MPRIM, "Длинный Меч", { t:"lowtech", grip:"2р [1р, Бл, Мх]", form:"Меч", reach:"2–5", dmg:"1d10+2 R", pen:0, props:"Primitive", bl:2, wt:1.6, av:-2 }),
  M(IMP_MPRIM, "Двуручный Меч", { t:"lowtech", grip:"2р [Бл, Мх]", form:"Меч", reach:"3–6", dmg:"2d10 R", pen:0, props:"Primitive", bl:0, wt:2.5, av:-1 }),
  M(IMP_MPRIM, "Секира", { prof:[PF("Молот", "4", "2d10+1 I(Cr)", 0, "Concussive (-1), Imprecise, Primitive"), PF("Копьё", "4-5", "1d10 R", 0, "Primitive"), PSTAFF()], t:"lowtech", grip:"2р [1р, Бл, 1р+Кл]", form:"Топор", reach:"4", dmg:"2d10+1 R", pen:2, props:"Imprecise, Primitive", bl:-1, wt:3, av:-2, note:"Молот: 2d10+1 I(Cr), Pen 0, Concussive (-1), Imprecise, Primitive; Копьё (4–5): 1d10 R, Pen 0; Посох (2–4): 1d10-2 I(Cr), Imprecise." }),
  M(IMP_MPRIM, "Двуручный Молот", { prof:[PF("Крюк", "4", "2d10+1 R", 3, "Felling (2), Primitive"), PSTAFF()], t:"lowtech", grip:"2р [1р, 1р+Кл]", form:"Молот", reach:"4", dmg:"2d10+2 I(Cr)", pen:0, props:"Concussive (-1), Imprecise, Primitive", bl:-1, wt:3, av:-2, note:"Крюк: 2d10+1 R, Pen 3, Felling (2), Primitive; Посох (2–4): 1d10-2 I(Cr), Imprecise." }),
  M(IMP_MPRIM, "Двуручная Булава", { prof:[PSTAFF()], t:"lowtech", grip:"2р", form:"Булава", reach:"4", dmg:"2d10+1 I(Cr)", pen:0, props:"Concussive (-1), Imprecise, Primitive", bl:-1, wt:3, av:-2, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise." }),
  M(IMP_MPRIM, "Цеп", { prof:[PSTAFF()], t:"lowtech", grip:"2р", form:"Кистень", reach:"6–7", dmg:"2d10+1 I(Cr)", pen:0, props:"Flexible, Imprecise, Primitive", bl:-2, wt:3, av:-2, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise." }),
  M(IMP_MPRIM, "Посох", { t:"lowtech", grip:"2р [1р]", form:"Посох", reach:"2–4", dmg:"1d10-2 I(Cr)", pen:0, props:"Imprecise, Primitive", bl:1, wt:1, av:-4 }),
  M(IMP_MPRIM, "Копьё", { prof:[PSTAFF()], t:"lowtech", grip:"2р [1р, Бл, 1р+Об]", form:"Копьё", reach:"5–7", dmg:"1d10 R", pen:0, props:"Primitive", bl:0, wt:1.5, av:-2, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise." }),
  M(IMP_MPRIM, "Пика", { t:"lowtech", grip:"2р", form:"Копьё", reach:"8", dmg:"1d10+2 R", pen:0, props:"Primitive", bl:-2, wt:3.2, av:-3 }),
  M(IMP_MPRIM, "Глефа", { prof:[PSTAFF()], t:"lowtech", grip:"2р [Бл]", form:"Глефа", reach:"4–6", dmg:"1d10+4 R", pen:1, props:"Primitive", bl:1, wt:2.5, av:-2, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise." }),
  M(IMP_MPRIM, "Коса", { prof:[PSTAFF()], t:"lowtech", grip:"2р [Бл]", form:"Крюк", reach:"4", dmg:"2d10+2 R", pen:1, props:"Devastating (1), Extreme (9), Felling (2), Primitive", bl:-2, wt:3.5, av:-2, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise." }),
  M(IMP_MPRIM, "Билл", { prof:[PF("Крюк", "5", "1d10 R", 3, "Felling (2), Primitive"), PSTAFF()], t:"lowtech", grip:"2р [Бл]", form:"Глефа", reach:"4–5", dmg:"1d10+3 R", pen:0, props:"Primitive", bl:0, wt:1.5, av:-3, note:"Крюк (5): 1d10 R, Pen 3, Felling (2); Посох (2–4): 1d10-2 I(Cr), Imprecise." }),
  M(IMP_MPRIM, "Алебарда", { prof:[PF("Крюк", "5", "2d10 R", 3, "Felling (2), Primitive"), PF("Копьё", "5-6", "1d10 R", 0, "Primitive"), PSTAFF()], t:"lowtech", grip:"2р [Бл]", form:"Топор", reach:"4–5", dmg:"2d10+1 R", pen:2, props:"Imprecise, Primitive", bl:-1, wt:4, av:-2, note:"Крюк (5): 2d10 R, Pen 3, Felling (2); Копьё (5–6): 1d10 R, Pen 0; Посох (2–4): 1d10-2 I(Cr)." }),
  M(IMP_MPRIM, "Люцернский Молот", { prof:[PF("Крюк", "5", "2d10 R", 3, "Felling (2), Primitive"), PF("Копьё", "5-6", "1d10 R", 0, "Primitive"), PSTAFF()], t:"lowtech", grip:"2р [Бл]", form:"Молот", reach:"4–5", dmg:"2d10+1 I(Cr)", pen:0, props:"Concussive (-1), Imprecise, Primitive", bl:-1, wt:3, av:-2, note:"Крюк (5): 2d10 R, Pen 3, Felling (2); Копьё (5–6): 1d10 R; Посох (2–4): 1d10-2 I(Cr)." }),
  M(IMP_MPRIM, "Кнут", { t:"lowtech", grip:"1р", form:"Кнут", reach:"5–7", dmg:"1d5 I", pen:0, props:"Flexible, Imprecise, Primitive", bl:-2, wt:0.3, av:-3 }),
  M(IMP_MPRIM, "Штык (Винтовка)", { prof:[PSTAFF()], t:"lowtech", grip:"2р [Бл]", form:"Штык", reach:"3", dmg:"1d10 R", pen:0, props:"Primitive", bl:-1, wt:0, av:0, note:"Посох (2–3): 1d10-2 I(Cr), Imprecise." }),
  M(IMP_MPRIM, "Штык (Дл. Винтовка)", { prof:[PSTAFF5()], t:"lowtech", grip:"2р [Бл]", form:"Штык", reach:"4", dmg:"1d10 R", pen:0, props:"Primitive", bl:-1, wt:0, av:0, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise." }),
  // Примитивное — нестандартное:
  M(IMP_MPRIM, "Шанцевый Инструмент", { t:"lowtech", grip:"1р [2р]", form:"Топор", reach:"3", dmg:"1d10 R", pen:1, props:"Imprecise, Primitive", bl:-1, wt:0.8, av:-3 }),
  M(IMP_MPRIM, "Боевой Нож", { t:"lowtech", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"1d5 R", pen:2, props:"Precise", bl:1, wt:0.3, av:0 }),
  M(IMP_MPRIM, "Абордажная Пика", { prof:[PSTAFF()], t:"lowtech", grip:"2р", form:"Копьё", reach:"5–8", dmg:"1d10+2 R", pen:2, props:"", bl:0, wt:5, av:0, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive." }),
  M(IMP_MPRIM, "Людолов", { prof:[PSTAFF()], t:"lowtech", grip:"2р", form:"Копьё", reach:"5–7", dmg:"1d10-1 R", pen:0, props:"Imprecise, Primitive", bl:-1, wt:3, av:-1, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive." }),
  M(IMP_MPRIM, "Крюкомеч", { prof:[PF("Крюк", "3", "1d10-1 R", 2, "Felling (1), Primitive"), PF("Кулак", "0", "1d5-1 R", 0, "Imprecise, Primitive")], t:"lowtech", grip:"1р [Мх]", form:"Меч", reach:"2–3", dmg:"1d10 R", pen:0, props:"Primitive", bl:1, wt:1, av:0, note:"Крюк (3): 1d10-1 R, Pen 2, Felling (1), Primitive; Кулак (1): 1d5-1 R, Pen 0, Imprecise, Primitive." }),
  M(IMP_MPRIM, "Ямовая Сеть", { t:"lowtech", grip:"1р", form:"Сеть", reach:"3", dmg:"1d5+1 R", pen:0, props:"Flexible, Snare (2)", bl:-1, wt:2, av:1, note:"Exotic." }),
  M(IMP_MPRIM, "Плавящееся Кадило", { t:"lowtech", grip:"1р", form:"Кистень", reach:"4", dmg:"1d10+3 I(Cr)", pen:0, props:"Corrosive (3), Flexible, Imprecise", bl:-2, wt:2, av:1 }),
  M(IMP_MPRIM, "Бритвенный Клык", { t:"lowtech", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"1d5+4 R", pen:7, props:"Precise, Razor Sharp, Reinforced", bl:0, wt:0.2, av:3 }),
  M(IMP_MPRIM, "Гекатрийский Клинок", { t:"lowtech", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"1d5+2 R", pen:3, props:"Extreme (4), Precise, Razor Sharp, Reinforced, Tearing", bl:0, wt:0.1, av:3 }),

  // ═══════════════════════════ АСТАРТЕС: РУКОПАШНОЕ — ПРИМИТИВНОЕ ═══════════════════════════
  M(AST_MPRIM, "Боевой Нож Астартес", { t:"lowtech", grip:"1р [Об]", form:"Нож", reach:"1–2", dmg:"1d10 R", pen:2, props:"Legion, Precise", bl:1, wt:2, av:1 }),

  // ═══════════════════════════ ИМПЕРСКОЕ: РУКОПАШНОЕ — ЦЕПНОЕ ═══════════════════════════
  M(IMP_MCHN, "Пилонож", { t:"chain", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"1d5+2 R", pen:2, props:"Precise, Tearing", bl:0, wt:0.3, av:1 }),
  M(IMP_MCHN, "Пилокогти", { t:"chain", grip:"1р", form:"Когти.Р", reach:"1", dmg:"1d10+1 R", pen:2, props:"Tearing", bl:0, wt:0.4, av:2 }),
  M(IMP_MCHN, "Пилоклинок", { t:"chain", grip:"П", form:"Когти.П", reach:"1", dmg:"1d10 R", pen:2, props:"Tearing", bl:0, wt:1, av:1 }),
  M(IMP_MCHN, "Пилокортик", { t:"chain", grip:"1р [Об]", form:"Меч", reach:"1–3", dmg:"1d10+2 R", pen:2, props:"Tearing", bl:1, wt:0.9, av:0 }),
  M(IMP_MCHN, "Пиломеч", { t:"chain", grip:"1р [2р, Об, Бл, Мх]", form:"Меч", reach:"2–4", dmg:"1d10+2 R", pen:2, props:"Tearing", bl:1, wt:1.8, av:0 }),
  M(IMP_MCHN, "Пилосабля", { t:"chain", grip:"1р [2р, Об]", form:"Сабля", reach:"2–3", dmg:"1d10+2 R", pen:2, props:"Tearing", bl:1, wt:1.5, av:1 }),
  M(IMP_MCHN, "Пилотопор", { t:"chain", grip:"1р [2р, Кл]", form:"Топор", reach:"3", dmg:"1d10+3 R", pen:2, props:"Imprecise, Tearing", bl:-1, wt:1.9, av:0 }),
  M(IMP_MCHN, "Длинный Пиломеч", { t:"chain", grip:"2р [1р, Бл, Мх]", form:"Меч", reach:"2–5", dmg:"1d10+4 R", pen:2, props:"Tearing", bl:2, wt:2.1, av:1 }),
  M(IMP_MCHN, "Цепной Двуручный Меч", { t:"chain", grip:"2р [Бл, Мх]", form:"Меч", reach:"3–6", dmg:"2d10+2 R", pen:2, props:"Tearing", bl:0, wt:2.8, av:1 }),
  M(IMP_MCHN, "Пилосекира", { prof:[PF("Крюк", "4", "2d10+2 R", 5, "Felling (2)"), PSTAFF()], t:"chain", grip:"2р [1р, Бл, 1р+Кл]", form:"Топор", reach:"4", dmg:"2d10+3 R", pen:4, props:"Imprecise, Tearing", bl:-1, wt:5, av:1, note:"Крюк (4): 2d10+2 R, Pen 5, Felling (2); Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive." }),
  M(IMP_MCHN, "Пилокопьё", { prof:[PSTAFF()], t:"chain", grip:"2р [1р, Бл, 1р+Об]", form:"Копьё", reach:"5–7", dmg:"1d10+2 R", pen:2, props:"Tearing", bl:1, wt:1.8, av:1, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive." }),
  M(IMP_MCHN, "Пилоглефа", { prof:[PSTAFF()], t:"chain", grip:"2р [Бл]", form:"Глефа", reach:"4–6", dmg:"1d10+6 R", pen:3, props:"Tearing", bl:1, wt:3, av:1, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive." }),
  M(IMP_MCHN, "Пилокоса", { prof:[PSTAFF()], t:"chain", grip:"2р [Бл]", form:"Крюк", reach:"4", dmg:"2d10+4 R", pen:3, props:"Devastating (1), Extreme (9), Felling (2), Tearing", bl:-2, wt:4, av:1, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive." }),
  M(IMP_MCHN, "Пилоштык (Винтовка)", { prof:[PSTAFF()], t:"chain", grip:"2р [Бл]", form:"Штык", reach:"3", dmg:"1d10+2 R", pen:2, props:"Tearing", bl:-1, wt:0, av:0, note:"Посох (2–3): 1d10-2 I(Cr), Imprecise, Primitive." }),
  M(IMP_MCHN, "Пилоштык (Дл. Винтовка)", { prof:[PSTAFF5()], t:"chain", grip:"2р [Бл]", form:"Штык", reach:"4", dmg:"1d10+2 R", pen:2, props:"Tearing", bl:-1, wt:0, av:0, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive." }),
  // Цепное — нестандартное:
  M(IMP_MCHN, "Эвисцератор", { t:"chain", grip:"2р [Бл]", form:"Меч", reach:"3–6", dmg:"2d10+2 R", pen:6, props:"Imprecise, Power Field, Mighty, Tearing", bl:-2, wt:6, av:2 }),
  M(IMP_MCHN, "Пило Топоро-Крюк", { prof:[PF("Крюк", "3", "1d10+1 R", 4, "Felling (1)"), PF("Кулак", "0", "1d5-1 R", 2, "Imprecise")], t:"chain", grip:"1р [Мх]", form:"Топор", reach:"3", dmg:"1d10+2 R", pen:2, props:"Imprecise, Tearing", bl:0, wt:1.8, av:1, note:"Крюк (3): 1d10+2 R, Pen 4, Felling (1); Кулак (0): 1d5-1 R, Imprecise." }),
  M(IMP_MCHN, "Цепной Молот", { prof:[PSTAFF()], t:"chain", grip:"2р", form:"Булава", reach:"4", dmg:"2d10+4 R", pen:4, props:"Concussive (2), Imprecise, Tearing +Flanged", bl:-2, wt:8, av:2, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive." }),

  // ═══════════════════════════ ИМПЕРСКОЕ: РУКОПАШНОЕ — ШОКОВОЕ ═══════════════════════════
  M(IMP_MSHK, "Шоковая Дубинка", { t:"shock", grip:"1р", form:"Булава", reach:"2", dmg:"1d5+1 E(El)", pen:0, props:"Imprecise, Shocking", bl:0, wt:0.6, av:-1 }),
  M(IMP_MSHK, "Шоковая Палица", { t:"shock", grip:"1р [2р]", form:"Булава", reach:"3", dmg:"1d10+1 E(El)", pen:0, props:"Imprecise, Shocking", bl:-1, wt:0.8, av:0 }),
  M(IMP_MSHK, "Шоковый Посох", { t:"shock", grip:"2р [1р]", form:"Посох", reach:"3", dmg:"1d10+1 E(El)", pen:0, props:"Imprecise, Shocking", bl:1, wt:1, av:0 }),
  M(IMP_MSHK, "Молниевая Перчатка", { t:"shock", grip:"1р", form:"Кулак.Б", reach:"0", dmg:"1d10+1 E(El)", pen:0, props:"Shocking", bl:0, wt:0.4, av:1 }),
  M(IMP_MSHK, "Электро-Клевец", { t:"shock", grip:"1р [2р]", form:"Крюк", reach:"3", dmg:"1d10+1 E(El)", pen:3, props:"Felling (2), Shocking", bl:-1, wt:1.2, av:1 }),
  M(IMP_MSHK, "Электро-Кистень", { t:"shock", grip:"1р", form:"Кистень", reach:"4", dmg:"1d10+1 E(El)", pen:0, props:"Flexible, Imprecise, Shocking", bl:-2, wt:1.2, av:1 }),
  M(IMP_MSHK, "Нейральный Кнут", { t:"shock", grip:"1р", form:"Кнут", reach:"5–7", dmg:"1d10+1 E(El)", pen:0, props:"Flexible, Imprecise, Shocking", bl:-2, wt:0.3, av:1 }),
  // Шоковое — нестандартное:
  M(IMP_MSHK, "Шоковая Палица Аркус", { t:"shock", grip:"1р [2р]", form:"Булава", reach:"3", dmg:"1d10+1 I(Cr)", pen:0, props:"Imprecise, Reinforced, Shocking", bl:-1, wt:1, av:3, note:"Силовой режим [Power]: 1d10+7 E, Pen 5, Imprecise, Power Field." }),
  M(IMP_MSHK, "Электрошоковые Перчатки", { t:"shock", grip:"1р", form:"Кулак", reach:"0", dmg:"2d10+6 E(El)", pen:0, props:"Contained, Reinforced, Shocking", bl:0, wt:1, av:2 }),
  M(IMP_MSHK, "Электровытягивающий Посох", { t:"shock", grip:"2р", form:"Посох", reach:"2–4", dmg:"2d10+6 E(El)", pen:0, props:"Contained, Reinforced, Shocking", bl:1, wt:1.5, av:2 }),
  M(IMP_MSHK, "Тазерное Стрекало", { t:"shock", grip:"1р [2р]", form:"Рапира", reach:"2–4", dmg:"2d10+6 E(El)", pen:0, props:"Arc (6/2d10+6), Contained, Shocking", bl:0, wt:1.2, av:1 }),
  M(IMP_MSHK, "Тазерная Пика", { t:"shock", grip:"1р [2р]", form:"Копьё", reach:"5–8", dmg:"2d10+6 E(El)", pen:0, props:"Arc (6/2d10+6), Contained, Shocking", bl:-1, wt:1.3, av:1 }),
  M(IMP_MSHK, "Дуговая Палица", { t:"shock", grip:"1р [2р]", form:"Булава", reach:"3", dmg:"2d10+6 E(El)", pen:4, props:"Arc (7/2d10+6), Contained, Shocking, Haywire (0)", bl:-1, wt:0.8, av:2 }),
  M(IMP_MSHK, "Дуговая Клешня", { t:"shock", grip:"П+Л", form:"Когти.Р", reach:"0", dmg:"3d10+2 E(El)", pen:4, props:"Arc (8/3d10+2), Contained, Shocking, Haywire (0)", bl:-2, wt:5, av:3 }),

  // ═══════════════════════════ ИМПЕРСКОЕ: РУКОПАШНОЕ — СИЛОВОЕ ═══════════════════════════
  M(IMP_MPOW, "Силовой Шип", { t:"power", grip:"Л", form:"Кулак", reach:"0", dmg:"1d5+5 E", pen:5, props:"Power Field, Precise", bl:-1, wt:0.2, av:2 }),
  M(IMP_MPOW, "Силовая Перчатка", { t:"power", grip:"Л", form:"Кулак.Б", reach:"0", dmg:"1d10+5 E", pen:5, props:"Crunch, Imprecise, Power Field", bl:-1, wt:0.6, av:2 }),
  M(IMP_MPOW, "Силовой Кулак", { t:"power", grip:"Л+П", form:"Кулак.Б", reach:"0", dmg:"2d10 E", pen:8, props:"Crunch, Imprecise, Mighty, Power Field", bl:-2, wt:2, av:2 }),
  M(IMP_MPOW, "Силовой Нож", { t:"power", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"1d5+5 E", pen:5, props:"Power Field, Precise", bl:0, wt:0.2, av:2 }),
  M(IMP_MPOW, "Силовой Клинок", { t:"power", grip:"П", form:"Когти.П", reach:"1", dmg:"1d10+3 E", pen:5, props:"Power Field", bl:0, wt:0.8, av:2 }),
  M(IMP_MPOW, "Силовой Меч", { t:"power", grip:"1р [2р, Об]", form:"Меч", reach:"2–4", dmg:"1d10+5 E", pen:5, props:"Power Field", bl:1, wt:1.2, av:2 }),
  M(IMP_MPOW, "Силовая Рапира", { t:"power", grip:"1р [Об]", form:"Рапира", reach:"3–5", dmg:"1d10+5 E", pen:5, props:"Power Field", bl:1, wt:1.2, av:2 }),
  M(IMP_MPOW, "Силовая Сабля", { t:"power", grip:"1р [2р, Об]", form:"Сабля", reach:"2–3", dmg:"1d10+5 E", pen:5, props:"Power Field", bl:1, wt:1.1, av:2 }),
  M(IMP_MPOW, "Силовой Топор", { t:"power", grip:"1р [2р, Кл]", form:"Топор", reach:"3", dmg:"1d10+6 E", pen:6, props:"Imprecise, Power Field", bl:-1, wt:0.8, av:2 }),
  M(IMP_MPOW, "Силовая Булава", { g2h:[{ key:"concussive", rating:0 }], t:"power", grip:"1р [2р]", form:"Булава", reach:"3", dmg:"1d10+6 E", pen:4, props:"Imprecise, Power Field", bl:-1, wt:0.8, av:2, note:"В 2р хвате: Concussive (0)." }),
  M(IMP_MPOW, "Силовой Кистень", { g2h:[{ key:"concussive", rating:0 }], t:"power", grip:"1р [2р]", form:"Кистень", reach:"4", dmg:"1d10+6 E", pen:4, props:"Flexible, Imprecise, Power Field", bl:-2, wt:0.8, av:2, note:"В 2р хвате: Concussive (0)." }),
  M(IMP_MPOW, "Силовой Длинный Меч", { t:"power", grip:"2р [1р]", form:"Меч", reach:"2–5", dmg:"1d10+7 E", pen:5, props:"Power Field", bl:2, wt:1.6, av:2 }),
  M(IMP_MPOW, "Силовой Двуручный Меч", { t:"power", grip:"2р", form:"Меч", reach:"3–6", dmg:"2d10+5 E", pen:5, props:"Power Field", bl:1, wt:3, av:2 }),
  M(IMP_MPOW, "Силовая Секира", { prof:[PF("Молот", "4", "2d10+6 E", 5, "Concussive (1), Imprecise, Power Field"), PSTAFF()], t:"power", grip:"2р [1р, Бл, 1р+Кл]", form:"Топор", reach:"4", dmg:"2d10+6 E", pen:7, props:"Imprecise, Power Field", bl:-1, wt:3, av:2, note:"Молот: 2d10+6 E, Pen 5, Concussive (1), Imprecise, Power Field; Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive." }),
  M(IMP_MPOW, "Силовая Коса", { prof:[PSTAFF()], t:"power", grip:"2р [Бл]", form:"Крюк", reach:"4", dmg:"2d10+7 E", pen:6, props:"Devastating (1), Extreme (9), Felling (4), Power Field", bl:-2, wt:2.5, av:3, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive." }),
  M(IMP_MPOW, "Силовое Копьё", { prof:[PSTAFF_R()], t:"power", grip:"2р [1р, Бл, 1р+Об]", form:"Копьё", reach:"5–7", dmg:"1d10+5 E", pen:5, props:"Power Field", bl:0, wt:1.5, av:2, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive, Reinforced." }),
  M(IMP_MPOW, "Силовая Глефа", { prof:[PSTAFF_R()], t:"power", grip:"2р [Бл]", form:"Глефа", reach:"4–6", dmg:"1d10+9 E", pen:6, props:"Power Field", bl:1, wt:2.5, av:2, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive, Reinforced." }),
  M(IMP_MPOW, "Силовая Алебарда", { prof:[PF("Крюк", "5", "2d10+5 E", 8, "Felling (2), Power Field"), PF("Копьё", "5-6", "1d10+5 E", 5, "Power Field"), PSTAFF_R()], t:"power", grip:"2р [Бл]", form:"Топор", reach:"4–5", dmg:"2d10+6 E", pen:7, props:"Imprecise, Power Field", bl:-1, wt:4, av:2, note:"Крюк (5): 2d10+6 E, Pen 8, Felling (2), Power Field; Копьё (5–6): 1d10+6 E, Pen 5, Power Field; Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive, Reinforced." }),
  M(IMP_MPOW, "Силовой Кнут", { t:"power", grip:"1р", form:"Кнут", reach:"5–7", dmg:"1d10+4 E", pen:4, props:"Flexible, Imprecise, Power Field", bl:-2, wt:0.3, av:2 }),
  M(IMP_MPOW, "Силовой Штык (Винтовка)", { prof:[PSTAFF_R()], t:"power", grip:"2р [Бл]", form:"Штык", reach:"3", dmg:"1d10+5 E", pen:5, props:"Power Field", bl:-1, wt:0, av:2, note:"Посох (2–3): 1d10-2 I(Cr), Imprecise, Primitive." }),
  M(IMP_MPOW, "Силовой Штык (Дл. Винтовка)", { prof:[PSTAFF5("Imprecise, Primitive, Reinforced")], t:"power", grip:"2р [Бл]", form:"Штык", reach:"4", dmg:"1d10+5 E", pen:5, props:"Power Field", bl:-1, wt:0, av:2, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive, Reinforced." }),
  // Силовое — нестандартное:
  M(IMP_MPOW, "Штормовая Секира", { prof:[PF("Посох", "4", "1d10+6 E", 5, "Imprecise, Power Field")], t:"power", grip:"2р", form:"Топор", reach:"4", dmg:"2d10+6 E", pen:7, props:"Imprecise, Power Field", bl:0, wt:4, av:2 }),
  M(IMP_MPOW, "Штормовая Пика", { t:"power", grip:"1р (2р)", form:"Копьё", reach:"5–7", dmg:"1d10+4 E", pen:4, props:"Power Field", bl:-1, wt:1.3, av:2 }),
  M(IMP_MPOW, "Пилокулак", { t:"power", grip:"Л+П", form:"Кулак.Б", reach:"0", dmg:"2d10 E", pen:10, props:"Crunch, Imprecise, Mighty, Power Field, Tearing", bl:-2, wt:3, av:2 }),
  // Три модели молниевых когтей (стр. 211) — различаются хватом и удобством.
  M(IMP_MPOW, "Молниевые Когти (Крестоносец)", { t:"power", grip:"Л+П", form:"Когти.Р", reach:"1–2", dmg:"1d10+5 E", pen:7, props:"Power Field", bl:0, wt:0.3, av:2 , note:"Древняя модель с пальцами-лезвиями. +10 на приём Захват, атаки в Борьбе, Обезоруживание и Карабканье; −20 на использование предметов, модифицированных под её огромный хват, и вовсе нельзя использовать не модифицированные (в т.ч. гранаты)." }),
  M(IMP_MPOW, "Молниевые Когти (Ангелус)", { t:"power", grip:"Л+П", form:"Когти.Р", reach:"1–2", dmg:"1d10+5 E", pen:7, props:"Power Field", bl:0, wt:0.3, av:2 , note:"Современная модель с лезвиями на тыльной части ладони. Действует по обычным правилам хвата П+Л." }),
  M(IMP_MPOW, "Молниевые Когти (Корвус)", { t:"power", grip:"Л+П", form:"Когти.Р", reach:"1–2", dmg:"1d10+5 E", pen:7, props:"Power Field", bl:0, wt:0.3, av:3 , note:"Редкая модель с выдвижными когтями: втягиваются в броню предплечья свободным действием, позволяя без ограничений пользоваться этой рукой. Редкость +1 к базовой." }),
  M(IMP_MPOW, "Громовой Молот", { prof:[PF("Крюк", "4", "2d10+9 E", 9, "Felling (2), Power Field"), PSTAFF_R()], t:"power", grip:"2р [1р]", form:"Молот", reach:"4", dmg:"2d10+2 E", pen:8, props:"Concussive (3), Imprecise, Mighty, Power Field", bl:-2, wt:3, av:2, note:"Крюк: 2d10+9 E, Pen 4, Felling (2), Power Field; Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive, Reinforced." }),
  M(IMP_MPOW, "Молниевый Хопеш Кастир", { t:"power", grip:"1р [2р, Об]", form:"Сабля", reach:"2–3", dmg:"1d10+4 E", pen:4, props:"Flexible, Power Field", bl:1, wt:1.1, av:3 }),
  M(IMP_MPOW, "Тяжёлый Хопеш Поликс", { t:"power", grip:"2р [1р]", form:"Меч", reach:"2–5", dmg:"1d10+7 E", pen:8, props:"Power Field", bl:1, wt:4, av:3 }),
  M(IMP_MPOW, "Топор Омниссии", { prof:[PF("Копьё", "5-6", "1d10+5 E", 5, "Power Field"), PSTAFF_R()], t:"power", grip:"2р [Бл]", form:"Топор", reach:"4–5", dmg:"2d10+6 E", pen:6, props:"Imprecise, Power Field", bl:-1, wt:4, av:3, note:"Копьё (5–6): 1d10+6 E, Pen 5, Power Field; Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive, Reinforced." }),
  M(IMP_MPOW, "Тяжёлый Громовой Молот", { prof:[PF("Посох", "2-4", "1d10+1 I(Cr)", 0, "Imprecise, Reinforced")], t:"power", grip:"2р", form:"Молот", reach:"4–5", dmg:"3d10+4 E", pen:8, props:"Concussive (3), Imprecise, Mighty, Power Field", bl:-2, wt:5, av:4, note:"Посох (2–4): 1d10+1 I(Cr), Imprecise, Reinforced." }),
  M(IMP_MPOW, "Реликтовый Клинок", { t:"power", grip:"2р [1р]", form:"Меч", reach:"3–6", dmg:"2d10+7 E", pen:6, props:"Extreme (9), Power Field, Proven (3)", bl:1, wt:3.5, av:4 }),
  M(IMP_MPOW, "Совершенный Клинок", { t:"power", grip:"2р [1р, Бл, Мх]", form:"Меч", reach:"3–6", dmg:"2d10+9 R", pen:8, props:"Extreme (9), Power Field, Proven (3), Reinforced", bl:2, wt:3, av:5 }),

  // ═══════════════════════════ ИМПЕРСКОЕ: РУКОПАШНОЕ — ПСИХОСИЛОВОЕ (Force) ═══════════════════════════
  M(IMP_MPSY, "Психосиловой Посох", { t:"psychic", grip:"2р [1р]", form:"Посох", reach:"2–4", dmg:"1d10+1 I(Cr)", pen:0, props:"Force, Imprecise", bl:1, wt:1, av:3, note:"Является психофокусом." }),
  M(IMP_MPSY, "Хрустальная Перчатка", { t:"psychic", grip:"Л", form:"Кулак.Б", reach:"0", dmg:"1d5+3 I(Cr)", pen:0, props:"Force, Imprecise", bl:-1, wt:0.6, av:4 }),
  M(IMP_MPSY, "Психосиловой Нож", { t:"psychic", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"1d5+2 R", pen:2, props:"Force, Precise", bl:0, wt:0.2, av:4 }),
  M(IMP_MPSY, "Психосиловые Когти", { t:"psychic", grip:"Л", form:"Когти.Р", reach:"1", dmg:"1d10+1 R", pen:2, props:"Force", bl:0, wt:0.3, av:4 }),
  M(IMP_MPSY, "Психосиловой Запястный Клинок", { t:"psychic", grip:"П", form:"Когти.П", reach:"1", dmg:"1d10 R", pen:2, props:"Force", bl:0, wt:0.8, av:4 }),
  M(IMP_MPSY, "Психосиловой Меч", { t:"psychic", grip:"1р [2р, Об, Бл, Мх]", form:"Меч", reach:"2–4", dmg:"1d10+2 R", pen:2, props:"Force", bl:1, wt:1.2, av:4 }),
  M(IMP_MPSY, "Психосиловая Рапира", { t:"psychic", grip:"1р [Об, Бл]", form:"Рапира", reach:"3–5", dmg:"1d10+2 R", pen:2, props:"Force", bl:1, wt:1.2, av:4 }),
  M(IMP_MPSY, "Психосиловая Сабля", { t:"psychic", grip:"1р [2р, Об]", form:"Сабля", reach:"2–3", dmg:"1d10+2 R", pen:2, props:"Force", bl:1, wt:1.1, av:4 }),
  M(IMP_MPSY, "Психосиловой Топор", { t:"psychic", grip:"1р [2р, Кл]", form:"Топор", reach:"3", dmg:"1d10+3 R", pen:3, props:"Force", bl:-1, wt:0.8, av:4 }),
  M(IMP_MPSY, "Психосиловой Молот", { prof:[PF("Крюк", "3", "1d10+3 R", 5, "Felling (2), Force")], t:"psychic", grip:"1р [2р, Кл]", form:"Молот", reach:"3", dmg:"1d10+5 I(Cr)", pen:0, props:"Concussive (-1), Force, Imprecise", bl:-1, wt:0.8, av:4, note:"Крюк: 1d10+3 R, Pen 5, Felling (2), Force." }),
  M(IMP_MPSY, "Психосиловой Длинный Меч", { t:"psychic", grip:"2р [1р, Бл, Мх]", form:"Меч", reach:"2–5", dmg:"1d10+4 R", pen:2, props:"Force", bl:2, wt:1.6, av:4 }),
  M(IMP_MPSY, "Психосиловой Двуручный Меч", { t:"psychic", grip:"2р [Бл, Мх]", form:"Меч", reach:"3–6", dmg:"2d10+2 R", pen:2, props:"Force", bl:0, wt:2.5, av:4 }),
  M(IMP_MPSY, "Психосиловая Секира", { prof:[PF("Молот", "4", "2d10+4 I(Cr)", 0, "Concussive (-1), Force, Imprecise"), PSTAFF()], t:"psychic", grip:"2р [1р, Бл, 1р+Кл]", form:"Топор", reach:"4", dmg:"2d10+3 R", pen:4, props:"Force, Imprecise", bl:-1, wt:3, av:4, note:"Молот: 2d10+4 I(Cr), Pen 0, Force, Concussive (-1), Imprecise; Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive." }),
  M(IMP_MPSY, "Психосиловой Двуручный Молот", { prof:[PF("Крюк", "4", "2d10+3 R", 5, "Felling (2), Force"), PSTAFF()], t:"psychic", grip:"2р [1р, 1р+Кл]", form:"Молот", reach:"4", dmg:"2d10+5 I(Cr)", pen:0, props:"Force, Concussive (0), Imprecise", bl:-1, wt:3, av:4, note:"Крюк: 2d10+3 R, Pen 5, Force, Felling (2); Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive." }),
  M(IMP_MPSY, "Психосиловое Копьё", { prof:[PSTAFF()], t:"psychic", grip:"2р [1р, Бл, 1р+Об]", form:"Копьё", reach:"5–7", dmg:"1d10+2 R", pen:2, props:"Force", bl:0, wt:1.5, av:4, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive." }),
  M(IMP_MPSY, "Психосиловая Глефа", { prof:[PSTAFF()], t:"psychic", grip:"2р [Бл]", form:"Глефа", reach:"4–6", dmg:"1d10+6 R", pen:3, props:"Force", bl:1, wt:2.5, av:4, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive." }),
  M(IMP_MPSY, "Психосиловая Коса", { prof:[PSTAFF()], t:"psychic", grip:"2р [Бл]", form:"Крюк", reach:"4", dmg:"2d10+4 R", pen:3, props:"Devastating (1), Extreme (9), Felling (2), Force", bl:-2, wt:3.5, av:4, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive." }),
  M(IMP_MPSY, "Психосиловая Алебарда", { prof:[PF("Крюк", "5", "2d10+2 R", 5, "Felling (2), Force"), PF("Копьё", "5-6", "1d10+2 R", 2, "Force"), PSTAFF()], t:"psychic", grip:"2р [Бл]", form:"Топор", reach:"4–5", dmg:"2d10+3 R", pen:4, props:"Force, Imprecise", bl:-1, wt:4, av:4, note:"Крюк (5): 2d10+1 R, Force, Felling (2); Копьё (5–6): 1d10+2 R, Pen 2, Force; Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive." }),
  M(IMP_MPSY, "Психосиловой Кнут", { t:"psychic", grip:"1р", form:"Кнут", reach:"5–7", dmg:"1d5+3 I", pen:0, props:"Flexible, Force, Imprecise", bl:-2, wt:0.3, av:5 }),
  // Психосиловое — нестандартное:
  M(IMP_MPSY, "Посох Бедлама", { t:"psychic", grip:"2р [1р]", form:"Посох", reach:"2–4", dmg:"1d10 I(Cr)", pen:0, props:"Flame (2d10), Force, Imprecise, Hallucinogenic (2)", bl:0, wt:1, av:4, note:"Является психофокусом." }),
  M(IMP_MPSY, "Посох Варплоотвод", { t:"psychic", grip:"2р [1р]", form:"Посох", reach:"2–4", dmg:"1d10+1 I(Cr)", pen:0, props:"Force, Imprecise", bl:1, wt:1, av:4, note:"Является психофокусом." }),
  M(IMP_MPSY, "Посох Хека", { prof:[PF("Посох", "2-4", "1d10 I(Cr)", 0, "Force, Imprecise, Legion")], t:"psychic", grip:"2р [Бл]", form:"Глефа", reach:"4–6", dmg:"1d10+6 R", pen:3, props:"Force, Legion", bl:1, wt:2, av:4, note:"Является психофокусом. Посох (2–4): 1d10 I(Cr), Force, Imprecise, Legion." }),
  M(IMP_MPSY, "Ограждающий Посох", { t:"psychic", grip:"2р [1р]", form:"Посох", reach:"2–4", dmg:"1d10+1 I(Cr)", pen:0, props:"Force, Imprecise", bl:1, wt:1, av:5, note:"Является психофокусом." }),
  M(IMP_MPSY, "Посох Перемен", { t:"psychic", grip:"2р", form:"Посох", reach:"2–4", dmg:"1d10 I(Cr)", pen:0, props:"Force", bl:1, wt:3, av:5, note:"Является психофокусом." }),
  M(IMP_MPSY, "Немезис Меч", { t:"psychic", grip:"2р [Бл, Мх]", form:"Меч", reach:"3–6", dmg:"2d10+2 R", pen:2, props:"Force", bl:0, wt:2.5, av:5, note:"Немезис-оружие." }),
  M(IMP_MPSY, "Немезис Фальшионы", { t:"psychic", grip:"1р [2р, Об]", form:"Сабля", reach:"2–3", dmg:"1d10+2 R", pen:2, props:"Force", bl:1, wt:1.1, av:5, note:"Немезис-оружие." }),
  M(IMP_MPSY, "Немезис Алебарда", { prof:[PF("Посох", "2-4", "1d10+1 I(Cr)", 0, "Imprecise, Reinforced")], t:"psychic", grip:"2р [Бл]", form:"Глефа", reach:"4–6", dmg:"1d10+6 R", pen:3, props:"Force", bl:1, wt:2.5, av:5, note:"Немезис-оружие. Посох (2–4): 1d10+1 I(Cr), Imprecise, Reinforced." }),
  M(IMP_MPSY, "Немезис Молот Демонов", { prof:[PF("Посох", "2-4", "1d10+1 I(Cr)", 0, "Imprecise, Reinforced")], t:"psychic", grip:"2р", form:"Молот", reach:"4", dmg:"2d10+2 I(Cr)", pen:4, props:"Force, Concussive (2), Mighty, Imprecise", bl:-2, wt:5, av:5, note:"Немезис-оружие. Посох (2–4): 1d10+1 I(Cr), Imprecise, Reinforced." }),
  // Психосиловое оружие боевых псайкеров Эльдар (стр. 213-214).

  // ═══════════════════════════ ИМПЕРСКОЕ: РУКОПАШНОЕ — ЭКЗОТИЧЕСКОЕ (тех.) ═══════════════════════════
  M(IMP_MEXO, "Транзвуковая Бритва", { t:"exotic", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"1d5+2 R", pen:4, props:"Precise, Resonant", bl:0, wt:0.3, av:1 }),
  M(IMP_MEXO, "Транзвуковой Клинок", { t:"exotic", grip:"1р [Об]", form:"Меч", reach:"1–3", dmg:"1d10+2 R", pen:4, props:"Resonant", bl:1, wt:1.2, av:1 }),
  M(IMP_MEXO, "Аккордкоготь", { t:"exotic", grip:"Л", form:"Когти.Р", reach:"1", dmg:"1d10+4 R", pen:6, props:"Reinforced, Resonant", bl:-1, wt:0.3, av:2 }),
  M(IMP_MEXO, "Охотничья Пика", { prof:[PSTAFF()], t:"exotic", grip:"1р [2р, Бл, Об]", form:"Копьё", reach:"5–8", dmg:"1d10 R", pen:2, props:"", bl:0, wt:2.5, av:0, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive." }),
  M(IMP_MEXO, "Серво Клешня", { t:"exotic", grip:"П+Л", form:"Кулак.Б", reach:"0", dmg:"2d10+4 I(Cr)", pen:0, props:"Crunch, Imprecise, Reinforced", bl:-1, wt:2, av:1 }),
  M(IMP_MEXO, "Харонитовая Клешня", { t:"exotic", grip:"Л", form:"Кулак.Б", reach:"0", dmg:"2d10+4 R", pen:4, props:"Crunch, Mighty, Ogrynized, Tearing", bl:-1, wt:8, av:1 }),
  M(IMP_MEXO, "Метеоритный Молот", { t:"exotic", grip:"2р", form:"Молот", reach:"4", dmg:"2d10+2 I(Cr)", pen:0, props:"Concussive (4), Imprecise, Mighty", bl:-2, wt:4, av:1 }),
  M(IMP_MEXO, "Силовой Метеоритный Молот", { t:"exotic", grip:"2р", form:"Молот", reach:"4", dmg:"2d10+7 E", pen:5, props:"Concussive (4), Imprecise, Mighty, Power Field", bl:-2, wt:4, av:2 }),
  M(IMP_MEXO, "Энергетический Меч Солекс", { t:"exotic", grip:"1р [Об]", form:"Меч", reach:"2–4", dmg:"2d10+10 E", pen:12, props:"Contained, Power Field", bl:2, wt:0.1, av:3 }),
  M(IMP_MEXO, "Гравитонный Таран", { t:"exotic", grip:"П+Л", form:"Кулак.Б", reach:"0", dmg:"2d10+2 I(Cr)", pen:0, props:"Concussive (2), Haywire (0), Imprecise, Grav, Mighty, Wrecker (3)", bl:-2, wt:4, av:3 }),
  M(IMP_MEXO, "Гравитонный Молот", { t:"exotic", grip:"2р", form:"Молот", reach:"4", dmg:"2d10+4 I(Cr)", pen:0, props:"Concussive (2), Haywire (0), Imprecise, Grav, Mighty, Wrecker (3)", bl:-2, wt:5, av:4 }),
  M(IMP_MEXO, "Аксонная Бритва", { t:"exotic", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"1d5 E", pen:6, props:"Crippling (6), Precise, Razor Sharp", bl:0, wt:0.1, av:4 }),
  M(IMP_MEXO, "Фазовый Нож К'Тан", { t:"exotic", grip:"П", form:"Нож", reach:"1–3", dmg:"1d10+5 R", pen:14, props:"Felling (6), Power Field, Precise", bl:0, wt:0.8, av:4 }),
  M(IMP_MEXO, "Нейро Перчатка", { t:"exotic", grip:"Л", form:"Когти.Р", reach:"1", dmg:"1d10+3 R", pen:3, props:"Extreme (8), Reinforced, Toxic (4)", bl:-1, wt:1.2, av:4 }),
  M(IMP_MEXO, "Гремучий Нож", { t:"exotic", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"2d5+4 X", pen:4, props:"Precise, Reinforced, Tearing", bl:0, wt:0.1, av:4 }),
  M(IMP_MEXO, "Прожигающий Клинок", { t:"exotic", grip:"1р [2р, Об]", form:"Сабля", reach:"2–4", dmg:"1d10+6 E", pen:7, props:"Extreme (8), Power Field, Reinforced", bl:2, wt:1.1, av:5 }),

  // ═══════════════════════════ ИМПЕРСКОЕ: РУКОПАШНОЕ — ЭКЗОТИЧЕСКОЕ (мист.) ═══════════════════════════
  M(IMP_MEXM, "Чумной Нож", { t:"exotic", grip:"1р [Об]", form:"Нож", reach:"1–2", dmg:"1d10+1 R", pen:2, props:"Felling (4), Legion, Toxic (2)", bl:0, wt:2, av:4 }),
  M(IMP_MEXM, "Чумной Меч", { t:"exotic", grip:"1р [2р, Об]", form:"Меч", reach:"1–2", dmg:"1d10+3 R", pen:4, props:"Felling (4), Legion, Toxic (2)", bl:1, wt:2.5, av:4 }),
  M(IMP_MEXM, "Жнец Людей", { prof:[PSTAFF("Imprecise, Legion, Primitive, Reinforced")], t:"exotic", grip:"2р [Бл]", form:"Крюк", reach:"4", dmg:"2d10+7 E", pen:7, props:"Devastating (1), Felling (5), Legion, Power Field, Toxic (4)", bl:-2, wt:5, av:5, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Legion, Primitive, Reinforced." }),
  M(IMP_MEXM, "Плеть Мучения", { t:"exotic", grip:"1р", form:"Кнут", reach:"5–7", dmg:"1d10+6 R", pen:4, props:"Flexible, Multi-Strike (6), Reinforced, Snare (2), Tearing", bl:-2, wt:0.5, av:5 }),
  M(IMP_MEXM, "Адский Клинок", { t:"exotic", grip:"2р [1р, Бл, Мх]", form:"Меч", reach:"2–5", dmg:"1d10+3 R", pen:10, props:"Extreme (8), Power Field", bl:2, wt:0, av:4 }),
  M(IMP_MEXM, "Костяная Палица", { prof:[PSTAFF("Imprecise, Primitive, Reinforced, Tainted")], t:"exotic", grip:"2р", form:"Булава", reach:"4", dmg:"2d10+2 I(Cr)", pen:2, props:"Concussive (0), Imprecise, Reinforced, Tainted", bl:-1, wt:3, av:2, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive, Reinforced." }),
  M(IMP_MEXM, "Клинок Общины", { t:"exotic", grip:"2р", form:"Меч", reach:"3–6", dmg:"2d10+5 R", pen:5, props:"Reinforced, Tearing, Tainted", bl:1, wt:3, av:3 }),
  M(IMP_MEXM, "Эфиропроводящий Клинок", { t:"exotic", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"1d5+5 E", pen:5, props:"Power Field, Precise", bl:0, wt:0.2, av:3 }),
  M(IMP_MEXM, "Эфиропроводящий Меч", { t:"exotic", grip:"1р [2р, Об]", form:"Меч", reach:"2–4", dmg:"1d10+5 E", pen:5, props:"Power Field", bl:1, wt:1.2, av:3 }),
  M(IMP_MEXM, "Эфиропроводящее Копьё", { prof:[PSTAFF_R()], t:"exotic", grip:"2р [1р, Бл, 1р+Об]", form:"Копьё", reach:"5–7", dmg:"1d10+5 E", pen:5, props:"Power Field", bl:0, wt:1.5, av:3, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Primitive, Reinforced." }),
  M(IMP_MEXM, "Морозный Осколок", { t:"exotic", grip:"1р [2р, Об, Бл, Мх]", form:"Меч", reach:"2–4", dmg:"1d10+6 R", pen:8, props:"Felling (6), Reinforced", bl:1, wt:1.2, av:3 }),
  M(IMP_MEXM, "Крозиус Арканум", { g2h:[{ key:"concussive", rating:0 }], t:"power", grip:"1р [2р]", form:"Булава", reach:"3", dmg:"1d10+8 E", pen:5, props:"Imprecise, Legion, Power Field, Sanctified", bl:-1, wt:5, av:4, note:"В 2р хвате: Concussive (0)." }),
  M(IMP_MEXM, "Проклятый Крозиус", { g2h:[{ key:"concussive", rating:0 }], t:"power", grip:"1р [2р]", form:"Булава", reach:"3", dmg:"1d10+8 E", pen:5, props:"Imprecise, Legion, Power Field, Tainted", bl:-1, wt:5, av:4, note:"В 2р хвате: Concussive (0)." }),
  M(IMP_MEXM, "Чёрная Булава", { cor:[{ cor:30, text:"При попадании в технику её командир или пилот тоже получает попадание 2d10 E, Warp Weapon." },{ cor:45, text:"При попадании в подчинённого Владычеством демона контролирующий его персонаж получает попадание 2d10 E, Warp Weapon." },{ cor:60, text:"Убитое живое существо (или изгнанный из Вселения демон) взрывается: шаблон 3d10 C, Проб. 0, Blast (3), Corrosive (2), Flush, Toxic (2). Сам персонаж и до W.b его союзников по выбору иммунны." }], prof:[PF("Посох", "2-4", "2d10-2 I(Cr)", 0, "Imprecise, Reinforced, Tainted")], t:"exotic", grip:"2р", form:"Булава", reach:"4", dmg:"3d10+1 I(Cr)", pen:0, props:"Concussive (1), Imprecise, Reinforced, Tainted", bl:-1, wt:5, av:4, note:"Посох (2–4): 2d10-2 I(Cr), Imprecise, Reinforced, Tainted." }),
  M(IMP_MEXM, "Танцующий Клинок Р'Сулеира", { prof:[PF("Летающий клинок", "0", "1d10+2+I.b R", 4, "Contained, Crippling (3), Razor Sharp, Reinforced")], t:"exotic", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"1d10+2 R", pen:4, props:"Crippling (3), Razor Sharp, Reinforced", bl:1, wt:0.2, av:4 }),
  M(IMP_MEXM, "Секира Палача", { prof:[PSTAFF("Imprecise, Reinforced")], t:"exotic", grip:"2р [1р, Бл, 1р+Кл]", form:"Топор", reach:"4", dmg:"2d10+6 R", pen:7, props:"Extreme (8), Imprecise, Reinforced, Tearing", bl:-1, wt:3, av:4, note:"Посох (2–4): 1d10-2 I(Cr), Imprecise, Reinforced." }),
  M(IMP_MEXM, "Стеклянный Кинжал", { t:"exotic", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"3d5 R", pen:7, props:"Crippling (3), Reinforced, Tearing, Toxic (0)", bl:0, wt:0.2, av:4 }),
  M(IMP_MEXM, "Эфироклинок", { t:"exotic", grip:"2р [1р, Бл, Мх]", form:"Меч", reach:"3–6", dmg:"2d10+9 R", pen:8, props:"Extreme (9), Reinforced, Felling (4)", bl:2, wt:3, av:5 }),
  M(IMP_MEXM, "Шип Ужаса", { t:"exotic", grip:"1р [2р]", form:"Крюк", reach:"3", dmg:"2d10+1 R", pen:5, props:"Felling (4), Primitive, Sanctified", bl:-1, wt:1.2, av:5 }),
  M(IMP_MEXM, "Жертвенный Атам", { t:"exotic", grip:"1р [Об]", form:"Нож", reach:"1", dmg:"1d5 R", pen:0, props:"Precise, Reinforced, Sanctified, Warp Weapon", bl:0, wt:0.2, av:5 }),
  M(IMP_MEXM, "Рапира Велькир", { t:"exotic", grip:"1р [Об, Бл]", form:"Рапира", reach:"3–5", dmg:"1d10+8 R", pen:8, props:"Flexible, Precise, Reinforced, Razor Sharp", bl:2, wt:1, av:5 }),

  // ═══════════════════════════ ИМПЕРСКОЕ: РУКОПАШНОЕ — ИМПРОВИЗИРОВАННОЕ ═══════════════════════════
  M(IMP_MIMP, "Пилотесак", { t:"chain", grip:"1р [Кл]", form:"Топор", reach:"2", dmg:"1d10+2 R", pen:2, props:"Imprecise, Tearing", bl:-1, wt:3, av:-2 }),
  M(IMP_MIMP, "Силовая Кирка", { t:"power", grip:"1р [2р]", form:"Крюк", reach:"3", dmg:"1d10+6 R", pen:6, props:"Felling (2), Primitive, Wrecker (2)", bl:-2, wt:3, av:-1 }),
  M(IMP_MIMP, "Силовая Кувалда", { prof:[PF("Крюк", "2-4", "2d10+7 E", 9, "Felling (2), Power Field")], t:"power", grip:"2р", form:"Молот", reach:"4", dmg:"2d10+8 E", pen:8, props:"Concussive (3), Imprecise, Power Field, Wrecker (3)", bl:-2, wt:5, av:0, note:"Крюк (2–4): 2d10+7 E, Pen 9, Felling (2), Power Field." }),
  M(IMP_MIMP, "Тяжёлый Камнерез", { t:"exotic", grip:"2р", form:"Резак", reach:"3", dmg:"3d10+6 R", pen:10, props:"Contained, Crunch, Felling (6), Imprecise, Reinforced, Wrecker (2)", bl:-2, wt:15, av:0 }),
  M(IMP_MIMP, "Тяжёлая Камнедрель", { t:"exotic", grip:"2р", form:"Бур", reach:"3", dmg:"5d10 R", pen:4, props:"Contained, Extreme (9), Tearing, Imprecise, Reinforced, Wrecker (5)", bl:-2, wt:15, av:0 }),
  M(IMP_MIMP, "Тяжёлая Камнепила", { t:"exotic", grip:"2р", form:"Пила", reach:"2", dmg:"2d10+12 R", pen:4, props:"Contained, Tearing, Imprecise, Reinforced, Wrecker (2)", bl:-2, wt:15, av:0 }),

  // ═══════════════════════════ ИМПЕРСКОЕ: ЩИТЫ ═══════════════════════════
  // Щиты — рукопашное оружие со свойством Defensive (даёт +15 к Парированию).
  // Столбцы AP и «Защита» (зоны: Т торс / Р рука / П плечо / Г голова / Н нога; 1 — основная сторона) — в примечании.
  // ── Щиты (корбук стр. 215). AP и зоны — машинные поля sap/zones. ──
  // Зоны: Г голова, Т торс, Р1 рука со щитом, Р2 вторая рука, Н1/Н2 ноги.
  // В скобках — прикрывается лишь частично (нужно пригнуться/поднять щит).
  M(SHLD, "Баклер", { t:"lowtech", grip:"1р", form:"Баклер", reach:"0–2", dmg:"1d5+1 I(Cr)", pen:0, props:"Defensive, Primitive", bl:0, wt:1, av:-3, sap:0, zones:"", note:"AP 0. Защита: —. Не получает штраф на попадание от свойства Defensive и убирает бонус противника за более длинное оружие. Можно носить на поясе вместо спины." + SHLEG }),
  M(SHLD, "Тарг", { t:"lowtech", grip:"П", form:"Тарг", reach:"0–1", dmg:"1d5 I(Cr)", pen:0, props:"Defensive, Primitive", bl:0, wt:2.5, av:-3, sap:2, zones:"Р1", note:"AP 2. Защита: Р1. Позволяет держать в руке со щитом другое оружие или двуручное оружие; парировать можно, только если в руке со щитом на предплечье держат нож, кулак, пистолет или ничего." + SHLEG }),
  M(SHLD, "Экю", { t:"lowtech", grip:"1р+П", form:"Экю", reach:"0–3", dmg:"1d5 I(Cr)", pen:0, props:"Defensive, Primitive", bl:0, wt:4, av:-2, sap:4, zones:"Р1+Т+(Г)", note:"AP 4. Защита: Р1+Т+(Г). Позволяет парировать, даже когда рука со щитом на предплечье используется, чтобы держать стремена скакуна или руль байка." + SHLEG }),
  M(SHLD, "Круглый Щит", { t:"lowtech", grip:"1р+П", form:"Круглый", reach:"0–3", dmg:"1d5 I(Cr)", pen:0, props:"Defensive, Primitive", bl:0, wt:5, av:-3, sap:2, zones:"Т+Р1+Р2+(Г)", note:"AP 2. Защита: Т+Р1+Р2+(Г). Даёт штраф −10 на тесты Acrobatics, кроме Вольта и Группирования." + SHLEG }),
  M(SHLD, "Каплевидный Щит", { t:"lowtech", grip:"1р+П", form:"Каплевидный", reach:"0–2", dmg:"1d5 I(Cr)", pen:0, props:"Defensive, Primitive", bl:0, wt:4, av:-2, sap:2, zones:"Т+Р1+(Г)/(Н1+Н2)", note:"AP 2. Защита: Т+Р1+(Г)/(Н1+Н2). Даёт штраф −10 на тесты Acrobatics, кроме Вольта и Группирования. Уменьшает скорость Бега до скорости Натиска." + SHLEG }),
  M(SHLD, "Лёгкий Башенный Щит", { t:"lowtech", grip:"1р+П", form:"Л. Башенный", reach:"0–1", dmg:"1d5 I(Cr)", pen:0, props:"Defensive, Primitive", bl:0, wt:6, av:-1, sap:3, zones:"Т+Р1+Н1+Н2+(Г+Р2)", note:"AP 3. Защита: Т+Р1+Н1+Н2+(Г+Р2). Обеспечивает полное укрытие. Даёт штраф −10 на все тесты Акробатики. Не позволяет совершать Бег." + SHLEG }),
  M(SHLD, "Башенный Щит", { t:"lowtech", grip:"1р+П", form:"Башенный", reach:"0–1", dmg:"1d5 I(Cr)", pen:0, props:"Defensive, Primitive", bl:0, wt:8, av:-1, sap:4, zones:"Т+Р1+Р2+Н1+Н2+(Г)", note:"AP 4. Защита: Т+Р1+Р2+Н1+Н2+(Г). Обеспечивает полное укрытие. Удваивает штраф от свойства Defensive (обычно до −20). Даёт штраф −30 на все тесты Акробатики. Не позволяет совершать Бег, даже когда сложен за спину." + SHLEG }),

  M(SHLD, "Штурмовой Щит", { t:"lowtech", grip:"1р+П", form:"Башенный", reach:"0–3", dmg:"1d5 I(Cr)", pen:0, props:"Defensive", bl:0, wt:4, av:0, sap:4, zones:"Т+Р1+Р2+Н1+Н2+(Г)", note:"AP 4. Защита: Т+Р1+Р2+Н1+Н2+(Г)." + SHLEG }),
  M(SHLD, "Плитовой Щит", { t:"lowtech", grip:"1р+П", form:"Л. Башенный", reach:"0–3", dmg:"1d10 I(Cr)", pen:0, props:"Defensive, Ogrynized", bl:0, wt:30, av:0, sap:8, zones:"Т+Р1+Н1+Н2+(Г+Р2)", note:"AP 8. Защита: Т+Р1+Н1+Н2+(Г+Р2)." + SHLEG }),
  M(SHLD, "Серебряный Щит", { t:"lowtech", grip:"П", form:"Тарг", reach:"0–1", dmg:"1d5+1 I(Cr)", pen:0, props:"Defensive", bl:0, wt:3, av:0, sap:4, zones:"Т+Р1", note:"AP 4. Защита: Т+Р1." + SHLEG }),
  M(SHLD, "Абордажный Щит", { t:"lowtech", grip:"1р+П", form:"Башенный", reach:"0–3", dmg:"1d5 I(Cr)", pen:0, props:"Defensive", bl:0, wt:8, av:1, sap:6, zones:"Т+Р1+Р2+Н1+Н2+(Г)", note:"AP 6. Защита: Т+Р1+Р2+Н1+Н2+(Г)." + SHLEG }),
  M(SHLD, "Шоковый Щит", { t:"shock", grip:"1р+П", form:"Л. Башенный", reach:"0–3", dmg:"1d5 I(Cr)", pen:0, props:"Defensive, Shocking", bl:0, wt:4, av:2, sap:3, zones:"Т+Р1+Н1+Н2+(Г+Р2)", note:"AP 3. Защита: Т+Р1+Н1+Н2+(Г+Р2)." + SHLEG }),
  M(SHLD, "Оцепительный Щит", { t:"lowtech", grip:"1р+П", form:"Л. Башенный", reach:"0–3", dmg:"1d5 I(Cr)", pen:0, props:"Defensive", bl:0, wt:5, av:2, sap:4, zones:"Т+Р1+Н1+Н2+(Г+Р2)", note:"AP 4. Защита: Т+Р1+Н1+Н2+(Г+Р2)." + SHLEG }),
  M(SHLD, "Скутум Эндурант", { t:"lowtech", grip:"1р+П", form:"Башенный", reach:"0–3", dmg:"1d5 I(Cr)", pen:0, props:"Defensive, Reinforced", bl:0, wt:7, av:2, sap:6, zones:"Т+Р1+Р2+Н1+Н2+(Г)", note:"AP 6. Защита: Т+Р1+Р2+Н1+Н2+(Г)." + SHLEG }),
  M(SHLD, "Гоплон Кирофатис", { t:"lowtech", grip:"П", form:"Тарг", reach:"0–3", dmg:"1d10 I(Cr)", pen:0, props:"Defensive, Reinforced", bl:0, wt:5, av:2, sap:4, zones:"Т+Р1+Р2+Н1+Н2+(Г)", note:"AP 4. Защита: Т+Р1+Р2+Н1+Н2+(Г)." + SHLEG }),
  M(SHLD, "Энергетический Щит", { t:"power", grip:"П", form:"Тарг", reach:"0–3", dmg:"1d5+1 E", pen:0, props:"Defensive, Reinforced", bl:0, wt:0.5, av:3, sap:2, zones:"Т+Р1+Н1+Н2+(Г+Р2)", note:"AP 2. Защита: Т+Р1+Н1+Н2+(Г+Р2)." + SHLEG }),
  M(SHLD, "Штормовой Щит", { t:"power", grip:"1р+П", form:"Экю", reach:"0–3", dmg:"1d10 E", pen:0, props:"Defensive, Power Field, Reinforced", bl:0, wt:5, av:3, sap:4, zones:"Р1+Т+(Г)", note:"AP 4. Защита: Р1+Т+(Г)." + SHLEG }),
  M(SHLD, "Эльдарский Силовой Щит", { t:"power", grip:"П", form:"Тарг", reach:"0–1", dmg:"1d5 E", pen:0, props:"Defensive, Reinforced", bl:0, wt:0.5, av:4, sap:3, zones:"Всё", note:"AP 3. Защита: всё тело." + SHLEG }),
  M(SHLD, "Рунический Щит", { t:"lowtech", grip:"—", form:"Любой", reach:"0–2", dmg:"1d5+1 I(Cr)", pen:0, props:"Defensive, Reinforced, Tainted", bl:0, wt:5, av:4, sap:1, zones:"Как у стандартного", note:"AP 1 (сверх скопированного). Защита — как у скопированного стандартного щита. Альт-профиль (досяг. 3): 1d10−1 R, Pen 2. Псайкерский щит." + SHLEG }),
  M(SHLD, "Президиум Протектива", { t:"power", grip:"—", form:"Любой", reach:"0–3", dmg:"1d10 E", pen:0, props:"Defensive, Power Field, Reinforced, Sanctified", bl:0, wt:7, av:5, sap:5, zones:"Как у стандартного", note:"AP 5. Защита — как у скопированного стандартного щита. Псайкерский щит." + SHLEG }),
  M(SHLD, "Дисперсионный Щит", { t:"lowtech", grip:"1р+П", form:"Л. Башенный", reach:"0–1", dmg:"1d5 I(Cr)", pen:0, props:"Defensive, Reinforced", bl:0, wt:8, av:5, sap:8, zones:"Т+Р1+Н1+Н2+(Г+Р2)", note:"AP 8. Защита: Т+Р1+Н1+Н2+(Г+Р2)." + SHLEG }),

  // ═══════════════════════════ АСТАРТЕС: ЩИТЫ ═══════════════════════════
  M(AST_SHLD, "Боевой Щит Астартес", { t:"lowtech", grip:"П", form:"Тарг", reach:"0–1", dmg:"1d5 I(Cr)", pen:0, props:"Defensive, Legion, Reinforced", bl:0, wt:5, av:2, sap:3, zones:"Р1", note:"AP 3. Защита: Р1. Генерирует перед собой укрепляющее поле: не перегружающийся щит-дефлектор 1–30 от рукопашных атак, кроме как со спины." }),

  // ═══════════════════════════ АРЛЕКИНЫ: РУКОПАШНОЕ ═══════════════════════════
  // Снаряжение арлекинов: для арлекина редкость −2; работает только в одобренных руках;
  // иммунно к Haywire/Null-полям; трофей у не-арлекина — как Poor.Q.
  M(HQ_M, "Силовой Меч Арлекинов", { t:"exotic", grip:"1р [2р, Об]", form:"Меч", reach:"2–4", dmg:"1d10+9 E", pen:9, props:"Dueling Weapon, Eldar Precise, Eldar Razor Sharp, Felling (6), Power Field, Reinforced, Step By Step", bl:2, wt:0.1, av:4, note:"Парирует Flexible как обычное оружие. −25 рейтингу вражеских щитов. Proven (9) (−1 за каждый пункт Machine/Unnatural T цели, минимум Proven 4). Атака в сочленение: +1d10 и ещё +1d10 за каждые 3 успеха." }),
  M(HQ_M, "Ветряная Глефа", { t:"exotic", grip:"2р [1р, Бл]", form:"Глефа", reach:"4–6", dmg:"1d10+11 R", pen:9, props:"Dueling Weapon, Eldar Precise, Eldar Razor Sharp, Extreme (8), Felling (6), Power Field, Reinforced, Step By Step", bl:2, wt:0.4, av:4, note:"Режим посоха (досяг. 2–4): 1d10+2 I(Cr), Pen 2, Dueling Weapon, Eldar Precise, Power Field, Reinforced. По конечности без силовой брони +1d10. −10 рейтингу щитов. Proven (9) (минимум 4). Атака в сочленение: +1d10 и ещё +1d10 за каждые 3 успеха." }),
  M(HQ_M, "Поцелуй Арлекина", { t:"exotic", grip:"1р", form:"Кулак", reach:"0–1", dmg:"1d10+8 R", pen:9, props:"Crippling (4), Eldar Precise, Eldar Razor Sharp, Felling (6), Reinforced, Tearing, Toxic (7, 2d10), Wrist", bl:2, wt:0.1, av:4, note:"Extreme (1)…(6) — по 1 за пункт Machine/Unnatural T цели. Крит-эффект R+2. Встроен мононитевой пистолет (33 м, Pen 10, боезапас бесконечный). При попадании тест T−60 → провал: крит-эффект R = числу провалов +3." }),
  M(HQ_M, "Посох Туманов", { t:"exotic", grip:"1р [2р, Об]", form:"Посох", reach:"2–4", dmg:"1d10+4 I(Cr)", pen:3, props:"Extreme (6), Felling (4), Force, Power Field, Reinforced", bl:2, wt:0.9, av:4, note:"Best.Q Психофокус. Полудействием — круговой взмах (как галлюциногенная граната, центр на носителе). −10 рейтингу щитов, игнорирует колдовские щиты. Носитель и союзники получают +W.b×5 к Скрытности в радиусе бPR×500 м." }),
  // Артефакты Чёрной Библиотеки (рукопашные)
  M(HQ_M, "Меч-Сказитель", { t:"exotic", grip:"1р [2р, Об]", form:"Меч", reach:"2–4", dmg:"1d10+12 E", pen:11, props:"Dueling Weapon, Eldar Precise, Eldar Razor Sharp, Felling (14), Power Field, Reinforced, Step By Step", bl:2, wt:0.1, av:5, note:"Arts.Q. Unnatural A (+4). +3×A.b ко всем тестам/атакам; +A.b к Dmg/Pen. Враги −3×A.b на избегание; −3×A.b рейтингу щитов. Эльдар: свободным действием — ярость без штрафов, ×2 бонусы; урон −T.b−W.b−A.b (мин 1), нет крит/простых эффектов, +2 ОД, иммунитет к телепатии." }),
  M(HQ_M, "Роза Цегораха", { t:"exotic", grip:"1р", form:"Нож", reach:"0–2", dmg:"1d10+8 E", pen:11, props:"Dueling Weapon, Eldar Precise, Eldar Razor Sharp, Felling (12), Power Field, Reinforced, Step By Step", bl:2, wt:0.1, av:5, note:"Arts.Q. Unnatural A (+4). +3×A.b тестам/атакам; +A.b Dmg/Pen. Враги −3×A.b избегание; −3×A.b щитам. Непоглощённый урон → тест T−60: за каждые 3 провала попадание как Monofilament (9), игнор брони. Погибшая цель: тело Monofilament (20), Fear (3)." }),

  // ═══════════════════════════ АРЛЕКИНЫ: СТРЕЛКОВОЕ ═══════════════════════════
  W(HQ_R, "Сюрикен Пистолет Арлекинов", { c:"pistol", t:"shuriken", rng:30, rof:"S/3/5", dmg:"1d10+4 R", pen:6, clip:40, rld:"½", wt:0.9, av:4, props:"Eldar Precise, Eldar Razor Sharp, Extreme (9), Felling (6), Toxic (7, 2d10), Very Reliable", note:"Цель, погибшая от Toxic, оплавляется. Атака в сочленение: +1d10 и ещё +1d10 за каждые 3 успеха." }),
  W(HQ_R, "Фузионный Пистолет Арлекинов", { c:"pistol", t:"fusion", rng:30, rof:"S/2/3", dmg:"2d10+16 E", pen:20, clip:20, rld:"1", wt:2.1, av:4, props:"Eldar Precise, Felling (10), Maximal, Melta, Proven (4), Very Reliable, Wrecker (4)", note:"В упор игнорирует AP цели. Атака в сочленение: +1d10 и ещё +1d10 за каждые 3 успеха." }),
  W(HQ_R, "Объятие Арлекина", { c:"pistol", t:"monofilament", rng:30, rof:"S/–/–", dmg:"1d10+11 R", pen:9, clip:15, rld:"½", wt:0.2, av:4, props:"Blast (3), Eldar Precise, Eldar Razor Sharp, Monofilament (4), Tearing, Wrist", note:"Короткая дистанция: +4 Dmg/+2 Pen; в упор: +кубик урона, +6 Dmg/+3 Pen. 5+ успехов → избирательно в сочленение, Monofilament игнорирует броню. Проходит сквозь первую жертву во вторую; летит до Rng/3 м." }),
  W(HQ_R, "Сюрикенная Пушка Арлекинов", { c:"heavy", t:"shuriken", rng:120, rof:"S/4/6", dmg:"2d10+12 R", pen:6, clip:160, rld:"1", wt:5, av:4, props:"Eldar Razor Sharp, Extreme (8), Felling (6), Reliable, Storm (2), Tearing, Toxic (7, 2d10)", note:"Режим против техники: теряет Storm/Extreme/Toxic, Pen ×3 (обычно 18)." }),
  W(HQ_R, "Галлюциногенный Гранатомёт", { c:"basic", t:"launcher", rng:50, rof:"S/2/4", dmg:"", pen:0, clip:12, rld:"1", wt:5, av:3, props:"Carbine, Imprecise", note:"Стреляет гранатами (Смеха Арлекинов / эльдарскими / друкхари). +1 редкость → модификация Wrist." }),
  W(HQ_R, "Сюрикенная Пушка Шута Смерти (Крикун)", { c:"heavy", t:"shuriken", rng:120, rof:"S/4/6", dmg:"2d10+12 R", pen:6, clip:160, rld:"1", wt:16, av:5, props:"Eldar Razor Sharp, Extreme (7), Felling (8), Reliable, Tearing, Toxic (9, 3d10)", note:"Длинная очередь сверх макс. короткой → Blast (4) по линии. Доп. урон в S и T цели (металл игнорирует). Погибший от Toxic взрывается Blast (7, 2d10+6 R). Против техники: теряет Extreme/Toxic, Pen ×3. Встроен Силовой Меч Арлекинов." }),
  W(HQ_R, "Крещендо", { c:"pistol", t:"shuriken", rng:50, rof:"S/7/14", dmg:"1d10+6 R", pen:7, clip:240, rld:"½", wt:0.1, av:5, props:"Eldar Precise, Eldar Razor Sharp, Extreme (9), Felling (6), Storm (5), Toxic (7, 2d10), Very Reliable", note:"Arts.Q. +A.b к Dmg. +A.b×3 к атаке в сочленение; очередь в сочленение → +BS.b попаданий (до RoF). −1 рейтингу щита за попадание, −3 за атаку (сброс в конце боя). Если не двигался — все ОД (мин 2): BS+20, за каждый 3-й успех доп. атака." }),
  // Гранаты арлекинов (метательное)
  W(HQ_R, "Граната Смеха Арлекина", { c:"thrown", t:"grenade", rng:0, rof:"S/–/–", dmg:"", pen:0, clip:0, rld:"–", wt:0.2, av:3, props:"Blast (4)", note:"Нейротоксин-галлюциноген; игнорирует фильтры/защиту брони (кроме Best.Q или терминаторской) и трейты иммунитета к галлюциногенам." }),
  W(HQ_R, "Граната Ногопут", { c:"thrown", t:"grenade", rng:0, rof:"S/–/–", dmg:"1d10+11 I(Cr)", pen:0, clip:0, rld:"–", wt:0.3, av:3, props:"Blast (6), Concussive (3), Grav, Graviton, Haywire (6, 1d10+4), Linger (3)", note:"Арлекины иммунны к её эффекту." }),
  W(HQ_R, "Звёздный Болас", { c:"thrown", t:"grenade", rng:0, rof:"S/–/–", dmg:"2d10+6 E", pen:6, clip:0, rld:"–", wt:0.6, av:3, props:"Blast (4), Snare (5)", note:"Сначала Snare (1 цель); при провале спас-броска — неизбегаемый взрыв. 3 попадания в одну зону или 1 попадание → +1d10 / +4 Pen." }),

  // ═══════════════════════════ ИМПЕРСКОЕ: РАКЕТНЫЕ УСТАНОВКИ ═══════════════════════════
  // Пусковые установки сами по себе не имеют Dmg/Pen — их задаёт заряженная
  // ракета (папка «Ракеты»). Стандартные боеприпасы — Фраг и Крак.
  W(IMP_RKT, "Одноразовая Ракетница", { c:"heavy", t:"launcher", rng:200, rof:"S/–/–", dmg:"", pen:0, clip:1, rld:"–", wt:5, av:0, props:"Imprecise", note:"Не перезаряжается. Реквизируется по Редкости заряженной ракеты как расходник. " + LCH_NOTE }),
  W(IMP_RKT, "Ракетная Установка", { c:"heavy", t:"launcher", rng:300, rof:"S/–/–", dmg:"", pen:0, clip:1, rld:"1", wt:10, av:1, props:"Imprecise, Reliable", note:"Для максимальной скорострельности нужен заряжающий. " + LCH_NOTE }),
  W(IMP_RKT, "Установка Крот", { c:"heavy", t:"launcher", rng:50, rof:"S/–/–", dmg:"", pen:0, clip:1, rld:"2", wt:15, av:2, props:"Arcing, Imprecise, Reliable", note:"Стреляет только навесом и только по наземным целям. Игнорирует укрытия из земли и камня, поражает технику в днище (АР кормы). «Ракеты» к нему: Редкость +1, вес ×2. Встроенный Ауспекс на поиск пустот в земле. " + LCH_NOTE }),
  W(IMP_RKT, "Установка Протей", { c:"heavy", t:"launcher", rng:300, rof:"S/–/–", dmg:"", pen:0, clip:6, rld:"2", wt:35, av:3, props:"Imprecise, Legion", note:LCH_NOTE }),
  W(IMP_RKT, "Установка Тайфун", { c:"heavy", t:"launcher", rng:150, rof:"S/2/–", dmg:"", pen:0, clip:12, rld:"4", wt:40, av:4, props:"Imprecise, Independent, Twin-Linked, Legion", note:"Крепится на спину терминаторского доспеха. Можно зарядить смесью разных ракет и переключаться свободным действием, но нельзя стрелять смесью одной очередью или через Twin-Linked. " + LCH_NOTE }),

  // ═══════════════════════════ АСТАРТЕС: РАКЕТНЫЕ УСТАНОВКИ ═══════════════════════════
  W(AST_RKT, "Ракетная Установка (Астартес)", { c:"heavy", t:"launcher", rng:300, rof:"S/–/–", dmg:"", pen:0, clip:1, rld:"½", wt:15, av:2, props:"Imprecise, Reliable, Legion", note:"Астартес заряжает её, не снимая с плеча. " + LCH_NOTE }),
  W(AST_RKT, "Установка Крот (Астартес)", { c:"heavy", t:"launcher", rng:50, rof:"S/–/–", dmg:"", pen:0, clip:1, rld:"1", wt:20, av:3, props:"Arcing, Imprecise, Reliable, Legion", note:"Стреляет только навесом и только по наземным целям. Игнорирует укрытия из земли и камня, поражает технику в днище (АР кормы). " + LCH_NOTE }),

  // ═══════════════════════════ ИМПЕРСКОЕ: РАКЕТЫ ═══════════════════════════
  // Боеприпас для пусковых установок: задаёт Dmg/Pen/свойства выстрела.
  W(IMP_RKTA, "Ракета: Фраг", { c:"thrown", t:"rocket", rng:0, rof:"S/–/–", dmg:"2d10+2 X(Fr)", pen:2, clip:1, rld:"–", wt:2, av:-1, props:"Blast (5), Devastating (1), Tearing", note:"Ракета для пусковых установок." }),
  W(IMP_RKTA, "Ракета: Крак", { c:"thrown", t:"rocket", rng:0, rof:"S/–/–", dmg:"3d10+8 X", pen:8, clip:1, rld:"–", wt:2, av:0, props:"Concussive (3), Proven (2)", note:"Ракета для пусковых установок." }),
  W(IMP_RKTA, "Ракета: Зажигательная", { c:"thrown", t:"rocket", rng:0, rof:"S/–/–", dmg:"2d10+2 E(Fl)", pen:0, clip:1, rld:"–", wt:2, av:1, props:"Blast (4), Flame, Flush, Linger (1d5)", note:"Ракета для пусковых установок." }),
  W(IMP_RKTA, "Ракета: Зенитная", { c:"thrown", t:"rocket", rng:0, rof:"S/–/–", dmg:"3d10+4 X", pen:6, clip:1, rld:"–", wt:2, av:1, props:"Anti-Air, Concussive (2)", note:"Ракета для пусковых установок." }),
  W(IMP_RKTA, "Ракета: Искатель", { c:"thrown", t:"rocket", rng:0, rof:"S/–/–", dmg:"3d10+8 X", pen:8, clip:1, rld:"–", wt:2, av:2, props:"Concussive (3), Proven (3)", note:"При стрельбе в лобовую броню попадает по крыше машины (бортовая АР); по целям в силовой броне или с сильной тепловой сигнатурой бьёт сверху, потенциально игнорируя укрытие. Ракета для пусковых установок." }),
  W(IMP_RKTA, "Ракета: Рад", { c:"thrown", t:"rocket", rng:0, rof:"S/–/–", dmg:"1d10+4 X(Fr)", pen:0, clip:1, rld:"–", wt:2, av:2, props:"Blast (5), Rad (4d10)", note:"Ракета для пусковых установок." }),

  // ═══════════════════════════ ИМПЕРСКОЕ: ЭКЗОТИКА КСЕНО ═══════════════════════════
  // Только не-аэльдарское: пальцевое оружие Джокаэро и импульсное Тау.
  // Осколочное (друкхари) и сюрикеновое (эльдар) — в своих разделах.
  W(IMP_EXX, "Пальцевый Лазер", { c:"pistol", t:"laser", rng:5, rof:"S/–/–", dmg:"1d10+4 E(Ls)", pen:7, clip:1, rld:"–", wt:0.1, av:2, props:"Reliable", note:DIGITAL }),
  W(IMP_EXX, "Пальцевый Огнемёт", { c:"pistol", t:"flame", rng:5, rof:"S/–/–", dmg:"1d10+6 E(Fl)", pen:2, clip:1, rld:"–", wt:0.1, av:3, props:"Flame, Spray, Linger (1d5)", note:DIGITAL }),
  W(IMP_EXX, "Пальцевая Мельта", { c:"pistol", t:"melta", rng:5, rof:"S/–/–", dmg:"2d10+10 E", pen:15, clip:1, rld:"–", wt:0.1, av:3, props:"Melta", note:DIGITAL }),
  W(IMP_EXX, "Пальцевая Плазма", { c:"pistol", t:"plasma", rng:5, rof:"S/–/–", dmg:"1d10+8 E", pen:10, clip:1, rld:"–", wt:0.1, av:3, props:"Overheats", note:DIGITAL }),
  W(IMP_EXX, "Пальцевый Игольник", { c:"pistol", t:"needler", rng:10, rof:"S/2/4", dmg:"1d10+1 R", pen:2, clip:4, rld:"–", wt:0.1, av:3, props:"Precise, Toxic (1)", note:DIGITAL }),
  W(IMP_EXX, "Импульсный Пистолет (Тау)", { c:"pistol", t:"exotic", rng:40, rof:"S/2/–", dmg:"1d10+11 E", pen:4, clip:16, rld:"½", wt:2, av:4, props:"Gyro-Stabilized +Reflex Sight", note:PULSE }),
  W(IMP_EXX, "Импульсный Бластер (Тау)", { bands:[{label:"Боевая дистанция",pen:2},{label:"Короткая дистанция",dice:1,pen:4},{label:"В упор / в рукопашной",dice:2,pen:8}], c:"basic", t:"exotic", rng:30, rof:"S/2/–", dmg:"1d10+7 E", pen:2, clip:24, rld:"½", wt:4, av:4, props:"Carbine, Gyro-Stabilized +Reflex Sight", note:"Бонусы по дистанции: боевая +2 Pen; короткая +1d10 Dmg, +4 Pen; в упор/в рукопашной +2d10 Dmg, +8 Pen. " + PULSE }),
  W(IMP_EXX, "Импульсный Карабин (Тау)", { c:"basic", t:"exotic", rng:60, rof:"S/3/5", dmg:"1d10+12 E", pen:4, clip:24, rld:"½", wt:3, av:4, props:"Carbine, Gyro-Stabilized +Reflex Sight, Combi (Вспомогательный Гранатомёт)", note:PULSE }),
  W(IMP_EXX, "Импульсная Винтовка (Тау)", { c:"basic", t:"exotic", rng:150, rof:"S/3/–", dmg:"1d10+12 E", pen:4, clip:36, rld:"½", wt:4, av:4, props:"Accurate, Gyro-Stabilized +Reflex Sight", note:PULSE }),

  // ═══════════════════════════ ИМПЕРСКОЕ: ВАРИАНТЫ ИЗ [СКОБОК] ═══════════════════════════
  W(IMP_SP, "Стаб Карабин (Скитарии)", { c:"basic", t:"solid", rng:100, rof:"S/3/–", dmg:"1d10+3 I", pen:1, clip:30, rld:"1", wt:2, av:-1, props:"Carbine", note:"Высокотехнологичная версия с маг-стабилизаторами и гасителями отдачи: обычный штраф пистолетной рукоятки снят." }),
  W(IMP_SP, "Стаб Винтовка (револьвер)", { c:"basic", t:"solid", rng:120, rof:"S/–/–", dmg:"1d10+3 I", pen:1, clip:5, rld:"2", wt:4, av:-2, props:"Accurate, Reliable, Revolver" }),
  W(IMP_SP, "Ручная Пушка (револьвер)", { c:"pistol", t:"solid", rng:35, rof:"S/–/–", dmg:"1d10+5 I", pen:2, clip:5, rld:"4", wt:3, av:0, props:"Recoil (4), Reliable, Revolver" }),
  W(IMP_SP, "Стаб Пушка (револьвер)", { c:"pistol", t:"solid", rng:25, rof:"S/–/–", dmg:"1d10+7 I", pen:3, clip:5, rld:"4", wt:4, av:0, props:"Recoil (6), Revolver" }),
  W(IMP_SP, "Ручная Пушка Карнодон (револьвер)", { c:"pistol", t:"solid", rng:40, rof:"S/3/–", dmg:"1d10+4 I", pen:2, clip:6, rld:"2", wt:2.5, av:1, props:"Accurate, Recoil (6), Reliable, Revolver" }),
  W(IMP_SP, "Дуэльный Револьвер Ортхлак (дробовик)", { c:"pistol", t:"solid", rng:10, rof:"S/–/–", dmg:"1d10+4 I", pen:0, clip:1, rld:"3", wt:2, av:2, props:"Scatter, Recoil (4), Reliable", note:"Встроенный однозарядный дробовик, служащий осью барабана. Основной профиль — «Дуэльный Револьвер Ортхлак»." }),
  W(IMP_SP, "Спаренный Тяжёлый Стаббер (Огринский)", { c:"heavy", t:"solid", rng:120, rof:"S/–/10", dmg:"1d10+8 I", pen:3, clip:200, rld:"2", wt:75, av:1, props:"Twin-Linked, Ogrynized", note:"Укреплённая версия под силу Огрина: позволяет подавлять вражеские позиции на ходу." }),
  W(IMP_SHOT, "Дробовик Отбивная (второй режим)", { c:"basic", t:"solid", rng:20, rof:"S/–/–", dmg:"2d10+7 I", pen:0, clip:3, rld:"2", wt:6, av:1, props:"Recoil (8), Scatter, Spray, Tearing", note:"Выстрел тратит 3 патрона. Персонаж без S.b 6 сбивается с ног и Оглушается на 1 Раунд после выстрела." }),
  W(IMP_SHOT, "Дробовик Вокс-Леги (соосный ствол)", { c:"basic", t:"solid", rng:20, rof:"S/–/–", dmg:"1d10+4 I", pen:0, clip:1, rld:"½", wt:7, av:2, props:"Scatter", note:"Вторичный соосный дробовик обычного калибра для удобной зарядки специализированной амуниции на ходу. Основной профиль — «Дробовик Вокс-Леги»." }),


  // ═══════════════════════════ АСТАРТЕС: ВЕРСИИ ОРУЖИЯ ИЗ [СКОБОК] ═══════════════════════════
  // Профиль совпадает со смертной версией; отличие — свойство Legion
  // (нормально работает только в руках Астартес).
  W(AST_ACAN, "Автопушка (Астартес)", { c:"heavy", t:"solid", rng:300, rof:"S/3/–", dmg:"3d10+8 X", pen:6, clip:20, rld:"2", wt:40, av:2, props:"Reliable, Legion" }),
  W(AST_ACAN, "Фраг Пушка (Астартес)", { bands:[{label:"Короткая дистанция (Рассеивание как в упор)",dice:1}], c:"heavy", t:"solid", rng:30, rof:"S/2/4", dmg:"2d10+6 X(Fr)", pen:4, clip:20, rld:"2", wt:45, av:2, props:"Flush, Reliable, Scatter, Tearing, Legion" }),
  W(AST_ACAN, "Автопушка Икар (Астартес)", { c:"heavy", t:"solid", rng:300, rof:"S/3/–", dmg:"3d10+8 X", pen:6, clip:20, rld:"2×2", wt:100, av:3, props:"Anti-Air, Reliable, Twin-Linked, Legion +Tripod", note:"Обойма 20×2." }),
  W(AST_ACAN, "Противотанковая Винтовка (Астартес)", { c:"heavy", t:"solid", rng:300, rof:"S/–/–", dmg:"3d10+8 X", pen:6, clip:5, rld:"2", wt:40, av:3, props:"Accurate, Reliable, Legion +Scope" }),
  W(AST_LAS, "Лазпушка (Астартес)", { c:"heavy", t:"laser", rng:300, rof:"S/–/–", dmg:"5d10+10 E(Ls)", pen:10, clip:5, rld:"2", wt:55, av:3, props:"Proven (3), Legion" }),
  W(AST_BOLT, "Максима Болтер (Астартес)", { c:"basic", t:"bolt", rng:30, rof:"–/–/5", dmg:"1d10+9 X", pen:4, clip:90, rld:"4", wt:20, av:3, props:"Gyro-Stabilized, Storm (3), Tearing, Legion" }),
  W(AST_BOLT, "Болт Пушка Дробитель (Астартес)", { c:"heavy", t:"bolt", rng:100, rof:"S/4/6", dmg:"2d10+10 X", pen:7, clip:100, rld:"1", wt:75, av:4, props:"Tearing, Legion" }),
  W(AST_MEL, "Мультимельта (Астартес)", { c:"heavy", t:"melta", rng:60, rof:"S/–/–", dmg:"2d10+16 E", pen:15, clip:12, rld:"2", wt:40, av:3, props:"Blast (2), Melta, Legion" }),
  W(AST_MEL, "Термальное Копьё (Астартес)", { c:"heavy", t:"melta", rng:60, rof:"S/2/–", dmg:"2d10+16 E", pen:15, clip:12, rld:"2", wt:40, av:4, props:"Melta, Legion" }),
  W(AST_MEL, "Солнечный Атомизатор (Астартес)", { c:"basic", t:"melta", rng:40, rof:"S/–/–", dmg:"4d10+16 E", pen:15, clip:12, rld:"4", wt:15, av:4, props:"Blinding (2), Cognis, Imprecise, Melta, Legion" }),
  W(AST_VOL, "Волькитовый Бластер (Астартес)", { c:"heavy", t:"laser", rng:100, rof:"S/4/10", dmg:"3d10+3 E(Ls)", pen:4, clip:120, rld:"2", wt:32, av:2, props:"Cognis, Deflagrate (5), Legion" }),
  W(AST_VOL, "Волькитовая Серпента (Астартес)", { c:"pistol", t:"laser", rng:30, rof:"S/2/–", dmg:"2d10+5 E(Ls)", pen:4, clip:30, rld:"1", wt:6, av:4, props:"Deflagrate (3), Legion" }),
  W(AST_VOL, "Волькитовый Разрядник (Астартес)", { c:"basic", t:"laser", rng:75, rof:"S/3/–", dmg:"2d10+6 E(Ls)", pen:4, clip:60, rld:"1", wt:12, av:4, props:"Deflagrate (4), Legion" }),
  W(AST_VOL, "Комби-Волькит (Астартес)", { c:"basic", t:"laser", rng:75, rof:"S/3/–", dmg:"2d10+6 E(Ls)", pen:4, clip:9, rld:"10", wt:6, av:4, props:"Combi, Deflagrate (4), Legion" }),
  W(AST_VOL, "Волькитовый Каливер (Астартес)", { c:"basic", t:"laser", rng:150, rof:"S/4/6", dmg:"2d10+6 E(Ls)", pen:4, clip:60, rld:"1", wt:16, av:4, props:"Deflagrate (4), Legion" }),
  W(AST_VOL, "Волькитовая Кулеврина (Астартес)", { c:"heavy", t:"laser", rng:150, rof:"–/–/8", dmg:"3d10+3 E(Ls)", pen:4, clip:200, rld:"4", wt:40, av:4, props:"Deflagrate (5), Legion" }),
  W(AST_GRAV, "Гравитонный Пистолет (Астартес)", { c:"pistol", t:"exotic", rng:15, rof:"S/–/–", dmg:"1d10+4 I(Cr)", pen:0, clip:3, rld:"2", wt:4, av:4, props:"Concussive (3), Blast (3), Graviton, Linger (3), Haywire (3), Legion" }),
  W(AST_GRAV, "Гравитонное Ружьё (Астартес)", { c:"basic", t:"exotic", rng:30, rof:"S/–/–", dmg:"1d10+4 I(Cr)", pen:0, clip:4, rld:"2", wt:8, av:3, props:"Concussive (3), Graviton, Blast (5), Linger (5), Haywire (5), Legion" }),
  W(AST_GRAV, "Комби-Гравитон (Астартес)", { c:"basic", t:"exotic", rng:30, rof:"S/–/–", dmg:"1d10+4 I(Cr)", pen:0, clip:1, rld:"10", wt:4, av:3, props:"Combi, Concussive (3), Blast (5), Graviton, Linger (5), Haywire (5), Legion" }),
  W(AST_GRAV, "Грав Пистолет (Астартес)", { c:"pistol", t:"exotic", rng:20, rof:"S/–/–", dmg:"†", pen:15, clip:5, rld:"2", wt:6, av:3, props:"Grav, Imprecise, Legion" }),
  W(AST_GRAV, "Гравган (Астартес)", { c:"basic", t:"exotic", rng:80, rof:"S/2/–", dmg:"†", pen:15, clip:12, rld:"2", wt:12, av:3, props:"Grav, Imprecise, Legion" }),
  W(AST_GRAV, "Комби-Грав (Астартес)", { c:"basic", t:"exotic", rng:80, rof:"S/–/–", dmg:"†", pen:15, clip:1, rld:"10", wt:6, av:3, props:"Combi, Grav, Imprecise, Legion" }),
  W(AST_GRAV, "Грав Пушка (Астартес)", { c:"heavy", t:"exotic", rng:100, rof:"S/3/6", dmg:"†", pen:15, clip:36, rld:"2", wt:55, av:4, props:"Grav, Imprecise, Legion" }),
  W(AST_GRAV, "Грав-Усилитель (Астартес)", { c:"heavy", t:"exotic", rng:100, rof:"S/–/–", dmg:"†", pen:0, clip:12, rld:"1", wt:35, av:4, props:"Spray, Legion" }),
  W(AST_EXO, "Кинетический Облитератор (Астартес)", { c:"basic", t:"exotic", rng:150, rof:"S/3/5", dmg:"2d10+9 I", pen:6, clip:50, rld:"2", wt:9, av:4, props:"Accurate, Extreme (9), Proven (4), Reliable, Legion" }),
  W(AST_EXO, "Эктоплазменная Пушка (Астартес)", { c:"heavy", t:"exotic", rng:60, rof:"S/–/–", dmg:"3d10+6 E", pen:8, clip:12, rld:"4", wt:35, av:2, props:"Blast (2), Maximal, Overheats, Legion" }),
  W(AST_EXO, "Пальцевый Лазер (Астартес)", { c:"pistol", t:"laser", rng:5, rof:"S/–/–", dmg:"1d10+4 E(Ls)", pen:7, clip:1, rld:"–", wt:0.1, av:2, props:"Reliable, Legion", note:DIGITAL }),
  W(AST_EXO, "Пальцевый Огнемёт (Астартес)", { c:"pistol", t:"flame", rng:5, rof:"S/–/–", dmg:"1d10+6 E(Fl)", pen:2, clip:1, rld:"–", wt:0.1, av:3, props:"Flame, Spray, Linger (1d5), Legion", note:DIGITAL }),
  W(AST_EXO, "Пальцевая Мельта (Астартес)", { c:"pistol", t:"melta", rng:5, rof:"S/–/–", dmg:"2d10+10 E", pen:15, clip:1, rld:"–", wt:0.1, av:3, props:"Melta, Legion", note:DIGITAL }),
  W(AST_EXO, "Пальцевая Плазма (Астартес)", { c:"pistol", t:"plasma", rng:5, rof:"S/–/–", dmg:"1d10+8 E", pen:10, clip:1, rld:"–", wt:0.1, av:3, props:"Overheats, Legion", note:DIGITAL }),

  // ═══════════════════════ ОРУЖИЕ ИЗ СНАРЯЖЕНИЯ (стр. 243-252) ═══════════════════════
  // Часть снаряжения имеет в описании собственный боевой профиль. Раньше он
  // лежал текстом, и бросить его было нечем — теперь это обычные предметы,
  // работающие через окно атаки и HUD. Само снаряжение ссылается на них
  // полем system.linkedWeapon.
  W(IMP_GEARW, "Арканный Глаз (Анимус Спекулюм)", { c:"pistol", t:"exotic", rng:50, rof:"S/3/5", dmg:"1d10+6 E", pen:0, clip:50, rld:"–", wt:0, av:5,
    props:"Accurate, Extreme (9), Independent, Sanctified, Warp Weapon",
    note:"Стрельба доступна только Парии в Анимус Спекулюме: вместо боеприпаса тратится 5 накопленных психических зарядов (обойма показывает запас зарядов, максимум 50). За каждые полные 4 бPR цели-псайкера или полные 25 Inf цели-демона: +1 кубик урона и −1 к рейтингу Extreme (для демонов-псайкеров берётся больший бонус, а не сумма)." }),
  M(IMP_GEARW, "Нартеций (рукопашный профиль)", { t:"exotic", grip:"П", form:"Когти.П", reach:"0", dmg:"1d10+5 R", pen:12, props:"Contained, Tearing", bl:-1, wt:0, av:3,
    note:"Профиль самого Нартеция как оружия. Инъекции проводятся как рукопашные атаки и по дружественным целям всегда попадают. Тот же профиль у Рюкзака Хирургеон." }),
  M(IMP_GEARW, "Серебряные Клыки (укус)", { t:"exotic", grip:"—", form:"Зубы", reach:"0", dmg:"1d10+S.b R", pen:6, props:"Felling (4), Sanctified", bl:0, wt:0, av:5,
    note:"Атака Укусом в Борьбе. При нанесении урона персонаж съедает клок плоти и восстанавливает 1d5+1 Ран, а жертва проходит тест W+0 или становится Беспомощной на <Провалы> Раундов." }),
  W(IMP_GEARW, "Взрыв Сердца Кровавого Черепа", { c:"thrown", t:"explosive", rng:0, rof:"S/–/–", dmg:"2d10+Cor.b E", pen:0, clip:1, rld:"–", wt:0, av:3,
    props:"Blast (4), Concussive (2), Felling (4), Recharge",
    note:"Полудействие, только Кхорниту в Ярости. Нагрудник теряет 1 AP за каждый взрыв (считается пробитием для Sealed и Void), пока не будет починен. Good.Q: получает Flame, Tainted и Tearing против псайкеров. Best.Q: не повреждает нагрудник." }),
  W(IMP_GEARW, "Обсидиановая Паутина (удар)", { c:"thrown", t:"exotic", rng:0, rof:"S/–/–", dmg:"2d10 R", pen:0, clip:1, rld:"–", wt:0, av:5,
    props:"Warp Weapon",
    note:"Срабатывает по телепортирующимся или проявляющемуся демону в радиусе W.b км: +1d10 урона за каждый Размер цели свыше 0. Решение бить или пропустить принимается мгновенно." }),
  M(IMP_GEARW, "Хрустальная Длань (разбивание)", { t:"exotic", grip:"1р", form:"Кулак", reach:"0", dmg:"1d10+3 R", pen:0, props:"Crippling (3), Felling (4)", bl:0, wt:0, av:3,
    note:"Это НЕ атака: урон получает сам владелец, если использовать руку с Дланью для удара или парирования. Игнорирует броню. Poor.Q: добавляется S.b владельца. Осколки собираются за смену работы тестом Scholastic Lore (Occult) (A) −10." }),

  // ═══════════════════ ОРУЖИЕ ИЗ ИНСТРУМЕНТОВ (стр. 253-262) ═══════════════════
  M(IMP_GEARW, "Нуль Жезл", { t:"power", grip:"1р [2р]", form:"Булава", reach:"3", dmg:"1d10+6 E", pen:4,
    props:"Imprecise, Power Field, Sanctified", bl:-1, wt:1, av:4,
    prof:[PF("Булава (нимб втянут)", "3", "1d10+1 I(Cr)", 0, "Imprecise, Primitive, Reinforced, Sanctified")],
    note:"Включённый жезл бьёт как силовая булава; нажатием руны нимб втягивается — второй профиль. Попадание псайкеру в голову: до начала следующего Хода атакующего он теряет Трейт Psyker и прерывает поддержку всех психосил. Качество считается как у рукопашного оружия." }),
  M(IMP_GEARW, "Психосиловой Жезл", { t:"psychic", grip:"1р", form:"Посох", reach:"2–4", dmg:"1d10+1 I(Cr)", pen:0,
    props:"Force, Imprecise", bl:1, wt:1, av:5,
    note:"Как оружие — психосиловой посох, но только в одноручном хвате. Качество считается как у рукопашного оружия." }),
  M(IMP_GEARW, "Икона Хаоса", { t:"lowtech", grip:"2р [1р]", form:"Копьё", reach:"5–7", dmg:"1d10 R", pen:0,
    props:"Primitive", bl:-2, wt:6, av:1,
    prof:[PSTAFF()],
    note:"Икону можно использовать как копьё или посох. Качество влияет на бой и на Командование, но не на её мистическую функцию." }),
  M(IMP_GEARW, "Возвышенная Икона", { t:"lowtech", grip:"2р [1р]", form:"Копьё", reach:"5–7", dmg:"1d10 R", pen:0,
    props:"Primitive", bl:-2, wt:8, av:3,
    prof:[PSTAFF()],
    note:"Боевой профиль совпадает с обычной Иконой Хаоса; отличие — в эффектах покровительства Бога." }),
  M(IMP_GEARW, "Веническая Петля (бросок)", { t:"lowtech", grip:"1р", form:"Бола", reach:"0", dmg:"1d5+S.b I(Cr)", pen:0,
    props:"Imprecise, Primitive, Snare (1)", bl:-1, wt:2, av:1,
    note:"Метается по правилам Болы с Rng 5 м. Наброшенная на демона (или заключившая его в круг) даёт держащему конец верёвки +20 на Демоническое Владычество и социальные взаимодействия с ним." }),
  W(IMP_GEARW, "Хрустальный Шпиль (разрушение)", { c:"thrown", t:"explosive", rng:0, rof:"S/–/–", dmg:"1d10+5 E", pen:5, clip:1, rld:"–", wt:0, av:1,
    props:"Blast (10), Concussive (2)",
    note:"Срабатывает вместо Прорыва усиленной шпилем психосилы или Отвращения Варпа при ритуале — шпиль уничтожается. Каждый дополнительный шпиль, участвовавший в усилении, добавляет +5 к радиусу и +1d10 к урону." }),
  W(IMP_GEARW, "Огнетушитель (струя)", { c:"basic", t:"exotic", rng:5, rof:"S/–/–", dmg:"", pen:0, clip:10, rld:"–", wt:3, av:-3,
    props:"Spray",
    note:"Полудействие двумя руками, 1 заряд. Всё «стандартное» пламя (1d10 урона) в шаблоне гаснет. За более мощное бросается его урон: 10 и ниже — гаснет, выше — теряет один кубик урона на 1 Раунд." }),
  W(IMP_GEARW, "Проблескамень (облако)", { c:"thrown", t:"explosive", rng:0, rof:"S/–/–", dmg:"", pen:0, clip:1, rld:"–", wt:0.1, av:2,
    props:"Blast (3), Smoke (3)",
    note:"Полудействие псайкера: разряд через камень взрывает его облаком серой пыли радиусом 3 м, оседающим через 1d5 Ходов. В облаке псайкер игнорирует штрафы к PR и броскам Феноменов от уже поддерживаемых сил, но проходит тест W+0 или облако рассеивается досрочно." }),

  // ═══════════════════ ОРУЖИЕ ИЗ ИМПЛАНТОВ (стр. 263-278) ═══════════════════
  M(IMP_GEARW, "Когти-Лезвия (имплант)", { t:"exotic", grip:"Л", form:"Когти.Р", reach:"0", dmg:"1d5+2 R", pen:2,
    props:"Razor Sharp", bl:0, wt:0, av:1,
    note:"Выдвижные лезвия в пальцах. Как скальпели дают +5 на хирургию, Первую Помощь и пытки. Poor.Q: урон 1d5 R, Проб. 0. Good.Q: лезвия вибрируют — свойство Tearing. Best.Q: плюс железа с токсином — Toxic (0), можно заряжать другим ядом." }),
  W(IMP_GEARW, "Звуковой Крикун (имплант)", { c:"pistol", t:"exotic", rng:3, rof:"S/–/–", dmg:"2d10+5 X", pen:4, clip:1, rld:"–", wt:0, av:3,
    props:"Concussive (2), Extreme (8), Independent",
    note:"Направленный вой вместо голосовых связок. Перезарядка — час после каждого выстрела (Poor.Q 4 часа, Good.Q 10 минут, Best.Q 3 Хода). Три Хода после выстрела персонаж не может говорить." }),
  M(IMP_GEARW, "Когти Птераксии (имплант)", { t:"exotic", grip:"Ног", form:"Когти.Р", reach:"0–1", dmg:"1d10+2 R", pen:4,
    props:"Reinforced", bl:0, wt:0, av:1,
    note:"Ступни заменены артикулируемыми когтями с титановыми лезвиями. Позволяют хватать ногами предметы и врагов и атаковать в Борьбе, но −2 SPD пешком. Качество считается как у рукопашного оружия." }),
  M(IMP_GEARW, "Цепкий Даташип (имплант)", { t:"exotic", grip:"Хв", form:"Нож", reach:"0–3", dmg:"2d5+4 R", pen:2,
    props:"Contained, Haywire (0), Precise", bl:-2, wt:0, av:2,
    note:"Мехадендрит-жало снизу спины. Пробив броню цели с Трейтом Machine, Имплантами Механикум, Латами Скитарии или в силовой броне — союзные техножрецы получают Ноосферный контроль над её бионикой и бронёй с приоритетом над её вводами. Haywire этого оружия не отключает банки данных." }),

  // ═══════════════════ ДРУКХАРИ: УНИКАЛЬНОЕ ОРУЖИЕ ═══════════════════
  M(DUNIQ, "Бертен-Жар / Тело Смерти", { t:"exotic", grip:"2р", form:"Меч", reach:"3–6", dmg:"1d10+3 R", pen:4,
    props:"Eldar Precise, Eldar Razor Sharp, Corrosive (4), Extreme (7), Crippling (4), Tearing, Step By Step",
    bl:2, wt:4.1, av:4,
    note:"Двуручный клинок Избирателей Плоти, выполненный из Мерцающей Стали. Спровоцированный критический эффект увеличивается на 1. Спровоцированный экстремальный урон увеличивается на I.b носителя. Выдаётся вместе с элитным архетипом Избиратель Плоти." }),

  // ═══════════════════ АТАКИ МЕДУЗЫ (тест W) ═══════════════════
  // Y = число очков Боли у персонажа; бPR — базовый Пси-Ранг Медузы.
  // Несмотря на свойство Warp Weapon, эти атаки исходят не из Варпа, а от сил
  // самой Медузы: защита Парией и прочие анти-варп средства их не останавливают.
  W(DMEDU, "Глазная Вспышка / Eyeburst", { c:"pistol", t:"exotic", rng:30, rof:"S/–/–", dmg:"1d5 E", pen:3, clip:0, rld:"–", wt:0, av:0,
    props:"Blinding (1), Spray, Warp Weapon",
    note:"Атака совершается тестом W. Урон 1d5+бPR. Blinding (Y), где Y — очки Боли. Атака Незримая. Не от Варпа: Парии и анти-варп защита не помогают." }),
  W(DMEDU, "Эмпатия / Empathy", { c:"pistol", t:"exotic", rng:60, rof:"–/–/10", dmg:"1d5+3 E", pen:0, clip:0, rld:"–", wt:0, av:0,
    props:"Shocking, Warp Weapon",
    note:"Атака совершается тестом W. Pen = Y (очки Боли). Атака Незримая. Противник получает штраф −5×бPR (свой) против тестов свойств этой атаки. Не от Варпа." }),
  W(DMEDU, "Кома / Coma", { c:"pistol", t:"exotic", rng:60, rof:"S/5/–", dmg:"", pen:0, clip:0, rld:"–", wt:0, av:0,
    props:"Warp Weapon",
    note:"Атака совершается тестом W. Урона не наносит. Concussive (бPR−3). Атака Незримая. Противник получает штраф −5×бPR (свой) против тестов свойств этой атаки. Не от Варпа." }),
  W(DMEDU, "Вспышка / Flash", { c:"pistol", t:"exotic", rng:60, rof:"S/5/–", dmg:"", pen:0, clip:0, rld:"–", wt:0, av:0,
    props:"",
    note:"Атака совершается тестом W. Урона не наносит. Blinding (бPR−3). Атака Незримая." }),
  W(DMEDU, "Волна Эмпатии / Wave of Empathy", { c:"pistol", t:"exotic", rng:20, rof:"S/–/–", dmg:"1d10 E", pen:0, clip:0, rld:"–", wt:0, av:0,
    props:"Spray, Wrecker (3), Warp Weapon",
    note:"Атака совершается тестом W. Урон 1d10+бPR+Y, Pen = Y (очки Боли). Атака Незримая. Противник получает −5×бPR (свой) против тестов свойств. Повреждает ТОЛЬКО неживые объекты. Не от Варпа." }),

  // ═══════════════════ АТАКИ ЖИТЕЛЯ БЕЗДНЫ ═══════════════════
  W(DABYS, "Губительное Пламя / Doomfire", { c:"pistol", t:"exotic", rng:50, rof:"S/3/6", dmg:"1d10+11 E", pen:6, clip:0, rld:"–", wt:0, av:0,
    props:"Corrosive (6), Crippling (6)" }),
  W(DABYS, "Губительный Шок / Doomshock", { c:"pistol", t:"exotic", rng:50, rof:"S/5/10", dmg:"1d10+4 E", pen:4, clip:0, rld:"–", wt:0, av:0,
    props:"Arc (6/2d10), Shocking" }),
  W(DABYS, "Губительный Шторм / Doomstorm", { c:"pistol", t:"exotic", rng:150, rof:"S/–/–", dmg:"1d10+8 E", pen:8, clip:0, rld:"–", wt:0, av:0,
    props:"Blast (12), Corrosive (4)" }),
  W(DABYS, "Губительная Волна / Doomwave", { c:"pistol", t:"exotic", rng:20, rof:"S/–/–", dmg:"1d10 E", pen:4, clip:0, rld:"–", wt:0, av:0,
    props:"Corrosive (35), Crippling (3), Spray",
    note:"Урон 1d10 + рейтинг трейта Daemonic носителя." }),
];


// ════════════════ ВЫКЛЮЧЕННОЕ СИЛОВОЕ ОРУЖИЕ (стр. 211) ════════════════════
// «При отключении (в т.ч. свойством Haywire) оно используется как
// соответствующее примитивное оружие». Аналог ищем по названию: «Силовой Меч»
// -> «Меч». Найденный профиль кладём в system.offProfile, чтобы бросок мог
// подставить его сам, а не оставлять игроку сверку по книге.
{
  const byName = new Map(AELDARI_WEAPONS.map(w => [w.name, w]));
  const strip  = /^(Силовой|Силовая|Силовое)\s+/;
  for (const w of AELDARI_WEAPONS) {
    if (w.system?.weaponType !== "power" || !strip.test(w.name)) continue;
    const base = byName.get(w.name.replace(strip, ""));
    if (!base || base.system?.weaponType !== "lowtech") continue;
    w.system.offProfile = {
      name: base.name, damage: base.system.damage,
      damageType: base.system.damageType, penetration: base.system.penetration
    };
  }
}

// ════════════════════════ МЕХАДЕНДРИТЫ (оружие) ════════════════════════════
// Кибернетические дополнительные конечности как рукопашное оружие. Профили
// уже учитывают собственный S.b мехадендрита. Бой требует Mechadendrite Use
// (Weapon). Папка верхнего уровня «Мехадендриты» в паке оружия.
const MD = ["Мехадендриты"];
export const MECHADENDRITE_WEAPONS = [
  M(MD, "Dendrite Blade / Дендрит Лезвие", { t:"exotic", form:"Мехадендрит", reach:"0-8", dmg:"1d10+8 R", pen:3, props:"Flexible, Razor Sharp", bl:1, wt:3, av:1,
    note:"S 30 (Unn 3). Силовой профиль (улучшение): 1d10+12 E, Pen 7, Flexible, Power Field. Все рукопашные атаки по носителю −10 за каждое лезвие (макс −30); промах по нему на 3+ Провала → попадание дендритом. Принимает модификации рукопашного оружия (как нож)." }),
  M(MD, "Mechatendril / Мехатендрил", { t:"exotic", form:"Мехадендрит", reach:"0-8", dmg:"1d10+6 R", pen:0, props:"Flexible, Primitive", bl:0, wt:3, av:1,
    note:"S 40 (Unn 2). Доп. рука: инструменты, но не оружие; +5 на Крафт за каждый мехатендрил." }),
  M(MD, "Ballistic Mechadendrite / Баллистический Мехадендрит", { t:"exotic", form:"Мехадендрит", reach:"0-6", dmg:"1d5+1 I(Cr)", pen:0, props:"Flexible, Primitive", bl:0, wt:3, av:2,
    note:"S 20. Стрельба установленным пистолетом (Compact/Combi) по правилам мехадендритов; батарейные не тратят боеприпасы." }),
  M(MD, "Manipulator Mechadendrite / Манипулятор Мехадендрит", { t:"exotic", form:"Мехадендрит", reach:"1-5", dmg:"1d10+8 I(Cr)", pen:0, props:"Imprecise, Primitive", bl:-2, wt:6, av:2,
    note:"S 50 (Unn 5). Подъём тяжестей; уцепиться за опору (не сдвинуть с места) или +20 Карабканье. Не для тонких манипуляций." }),
  M(MD, "Medicae Mechadendrite / Медицинский Мехадендрит", { t:"exotic", form:"Мехадендрит", reach:"0-8", dmg:"1d5+3 R", pen:4, props:"Flexible, Razor Sharp, Toxic (0)", bl:0, wt:3, av:2,
    note:"S 30. +10 практические Medicae/Interrogate (пытки); 6 инъекторов (инъекции как атаки, всегда попадают по союзникам)." }),
  M(MD, "Optical Mechadendrite / Оптический Мехадендрит", { t:"exotic", form:"Мехадендрит", reach:"0-8", dmg:"1d5+1 I(Cr)", pen:0, props:"Flexible, Primitive", bl:0, wt:2, av:2,
    note:"S 15. Ночное/тепловое зрение, Good.Q магнокуляр, прожектор; +10 зрение (+20 осмотр), +10 тонкий Крафт; сжимается до 5мм." }),
  M(MD, "Technical Mechadendrite / Технический Мехадендрит", { t:"exotic", form:"Мехадендрит", reach:"0-8", dmg:"1d5+3 R", pen:2, props:"Flexible, Precise, Reinforced", bl:1, wt:3, av:2,
    note:"S 30. Комби-Инструмент + +10 Tech-Use (ремонт/запуск); встроенное Кадило (без газа: цель −5 WS/BS на 1 Раунд)." }),
  M(MD, "Fyceline Torch / Фуцелиновый Факел", { t:"exotic", form:"Мехадендрит", reach:"0-6", dmg:"1d10+9 E(Fl)", pen:4, props:"Contained, Flame, Imprecise", bl:0, wt:3, av:3,
    note:"S 30. Удар без факела: 1d10+3 I(Cr), Imprecise, Primitive. Стрельба как Легион-Огнемёт (Rng 5м); 2 бака альт. топлива. +10 Tech-Use/Trade ремонта (+30 перекраска)." }),
  M(MD, "Plasma Cutter / Плазменный Резак", { t:"exotic", form:"Мехадендрит", reach:"0-6", dmg:"1d10+10 E", pen:8, props:"Contained", bl:0, wt:3, av:3,
    note:"S 30. Удар без резака: 1d10+3 I(Cr), Imprecise. Резка/сварка корпусов; +20 Tech-Use/Trade. Стрельба как Легион-Плазменный Пистолет (Rng 5м, без Maximal)." }),
  M(MD, "Servo-Arm / Серво-Рука", { t:"exotic", form:"Мехадендрит (2 порта)", reach:"1-5", dmg:"2d10+14 I(Cr)", pen:0, props:"Imprecise, Primitive, Reinforced", bl:-2, wt:12, av:3,
    note:"S 75 (Unn 7). Подъём огромных тяжестей; уцепиться за опору или +20 Карабканье. Занимает 2 порта Кибер-Мантии." }),
  M(MD, "Servo-Talon / Серво-Коготь", { t:"exotic", form:"Мехадендрит (2 порта)", reach:"1-5", dmg:"2d10+18 E", pen:10, props:"Imprecise, Power Field", bl:-2, wt:12, av:4,
    note:"S 75 (Unn 7). Боевая версия Серво-Руки с генератором силового поля. Занимает 2 порта Кибер-Мантии." })
];
