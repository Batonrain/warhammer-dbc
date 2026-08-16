// module/constants/advancement.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Автоматизация трат опыта по СКЛОННОСТЯМ (Black Crusade, стр. 23-24).
//  Персонаж выбирает 8 склонностей (+ «Общая» всегда 9-я). У каждого объекта
//  (характеристика/навык/талант) — 2 склонности. Категория цены:
//    2 совпадения → Дружественная (ally), 1 → Нейтральная (neutral), 0 → Враждебная (enemy).
//  «Общая» (general) считается у всех — участвует в совпадениях всегда.
// ════════════════════════════════════════════════════════════════════════════

// Склонности характеристик (стр. 24): Хар → [склонность хар-ки, склонность спец.].
export const CHAR_APTITUDES = {
  ws:  ["ws",  "offence"],
  bs:  ["bs",  "finesse"],
  s:   ["s",   "offence"],
  t:   ["t",   "defence"],
  ag:  ["ag",  "finesse"],
  int: ["int", "knowledge"],
  per: ["per", "fieldcraft"],
  wp:  ["wp",  "psyker"],
  fel: ["fel", "social"]
};

// Шаги продвижения характеристики (+5..+25) → индекс в таблице цен.
export const CHAR_STEPS = ["+5", "+10", "+15", "+20", "+25"];
// Ранги навыка (+0..+30) → индекс.
export const SKILL_STEPS = ["+0", "+10", "+20", "+30"];

// ── Таблицы цен (стр. 23) ────────────────────────────────────────────────────
export const CHAR_COST   = {   // +5/+10/+15/+20/+25
  ally:    [100, 250, 500, 750, 1000],
  neutral: [250, 500, 750, 1000, 1500],
  enemy:   [500, 750, 1000, 1500, 2500]
};
export const SKILL_COST  = {   // +0/+10/+20/+30
  ally:    [100, 200, 350, 550],
  neutral: [200, 350, 500, 750],
  enemy:   [300, 500, 700, 900]
};
export const TALENT_COST = {   // уровень 1/2/3
  ally:    [150, 300, 400],
  neutral: [250, 500, 750],
  enemy:   [400, 750, 1000]
};

export const ALIGN_LABEL = { ally: "Дружественная", neutral: "Нейтральная", enemy: "Враждебная" };

// Множество склонностей персонажа (+ всегда «general»).
export function charAptitudeSet(list) {
  const s = new Set((Array.isArray(list) ? list : []).map(x => String(x).trim()).filter(Boolean));
  s.add("general");
  return s;
}

// Категория по числу совпадений склонностей объекта со склонностями персонажа.
export function aptitudeCat(charApts, itemApts) {
  const set = (charApts instanceof Set) ? charApts : charAptitudeSet(charApts);
  const items = [...new Set((Array.isArray(itemApts) ? itemApts : []).filter(Boolean))];
  let matches = 0;
  for (const a of items) if (set.has(a)) matches++;
  return matches >= 2 ? "ally" : (matches === 1 ? "neutral" : "enemy");
}

const clampIdx = (v, max) => Math.max(0, Math.min(max, (parseInt(v) || 0)));

// ── Таланты с ценой из книги ────────────────────────────────────────────────
// У некоторых Талантов книга называет цену прямо, и таблица склонностей к ним
// не применяется: «Крепкое Телосложение — 100 ХР или 70 ХР при Покровительстве
// Нургла». Считать его как обычный Талант 1 уровня (150/250/400) неверно в
// любую сторону, поэтому такие цены перечислены здесь.
export const FIXED_TALENT_COST = [
  {
    match:    /Sound Constitution|Крепкое Телосложение/i,
    cost:     100,
    byPatron: { nurgle: 70 }
  }
];

/** Цена Таланта из книги или null, если у него обычная цена по склонностям. */
export function fixedTalentCost(name, patron = "") {
  const rule = FIXED_TALENT_COST.find(r => r.match.test(String(name ?? "")));
  if (!rule) return null;
  return rule.byPatron?.[String(patron || "")] ?? rule.cost;
}

// Культура легиона может объявить Навык или Талант дружественным/враждебным
// «независимо от Покровительства» — это перебивает обычный подсчёт склонностей.
// cultCat: "ally" | "enemy" | null (см. legions.mjs → cultureCat).
//
// `opts` — имя Таланта и Покровитель персонажа: по ним берётся цена из книги,
// если она у этого Таланта своя.
export function talentCostXP(tier, itemApts, charApts, cultCat = null, opts = {}) {
  const fixed = fixedTalentCost(opts.name, opts.patron);
  if (fixed !== null) return fixed;
  const cat = cultCat || aptitudeCat(charApts, itemApts);
  return TALENT_COST[cat][clampIdx((parseInt(tier) || 1) - 1, 2)];
}
export function charCostXP(stepIndex, charKey, charApts) {
  return CHAR_COST[aptitudeCat(charApts, CHAR_APTITUDES[charKey] || [])][clampIdx(stepIndex, 4)];
}
export function skillCostXP(rankIndex, itemApts, charApts, cultCat = null) {
  const cat = cultCat || aptitudeCat(charApts, itemApts);
  return SKILL_COST[cat][clampIdx(rankIndex, 3)];
}

// ════════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ С ДИНАМИЧЕСКИМИ СКЛОННОСТЯМИ (стр. 62)
//  У «Mastery / Мастерство» и «Beyond Human / За Гранью Человека» в книге
//  вместо фиксированных склонностей стоит «как у Характеристики» / «как у
//  Навыка»: талант наследует ОБЕ склонности того объекта, к которому привязан.
//  Поэтому его цена (стр. 23) зависит от выбранной специализации, а не от
//  записи в компендиуме — считаем её через resolveTalentAptitudes().
// ════════════════════════════════════════════════════════════════════════════

// Ключ таланта → чем параметризуется: "char" (характеристика) | "skill" (навык).
export const DYNAMIC_APT_TALENTS = {
  "beyond human": "char",
  "за гранью человека": "char",
  "mastery": "skill",
  "мастерство": "skill"
};

const normName = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Определяет, наследует ли талант склонности от Характеристики/Навыка.
 * Имя может быть двуязычным («Mastery / Мастерство») — проверяем обе части.
 * @returns {"char"|"skill"|null}
 */
export function dynamicAptKind(talentName) {
  for (const part of String(talentName || "").split("/")) {
    const k = DYNAMIC_APT_TALENTS[normName(part)];
    if (k) return k;
  }
  return null;
}

/**
 * Склонности таланта с учётом привязки. Для обычных талантов — их собственные.
 * @param {string} talentName  имя таланта (для определения динамики)
 * @param {string[]} ownApts   склонности из компендиума (запасной вариант)
 * @param {string}   specKey   ключ характеристики ("ws") или навыка ("dodge"/"commonLore")
 * @param {object}   defs      { CHAR_APTITUDES?, skills, groupSkills } — таблицы навыков
 */
export function resolveTalentAptitudes(talentName, ownApts, specKey, defs = {}) {
  const kind = dynamicAptKind(talentName);
  if (!kind || !specKey) return Array.isArray(ownApts) ? ownApts : [];
  if (kind === "char") return CHAR_APTITUDES[specKey] || (Array.isArray(ownApts) ? ownApts : []);
  const def = (defs.skills || {})[specKey] || (defs.groupSkills || {})[specKey];
  return def ? [def.char, def.apt2].filter(Boolean)
             : (Array.isArray(ownApts) ? ownApts : []);
}

// ════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ, ВСЕГДА ДРУЖЕСТВЕННЫЕ ОПРЕДЕЛЁННОЙ РАСЕ
//  Ключ — раса из RACES, значения — английские части названий талантов.
//  Например, Total Recall: «Всегда дружественный для Космодесантников».
// ════════════════════════════════════════════════════════════════════════
export const RACE_ALLY_TALENTS = {
  astartes: ["total recall"]
};

/** Талант всегда Дружественный для этой расы? Сравнение по англ. части имени. */
export function raceAllyTalent(race, talentName) {
  const list = RACE_ALLY_TALENTS[race];
  if (!list?.length) return false;
  const n = String(talentName || "").split("/")[0].toLowerCase().replace(/\s+/g, " ").trim();
  return list.some(x => n === x || n.startsWith(x + " ") || n.startsWith(x));
}
