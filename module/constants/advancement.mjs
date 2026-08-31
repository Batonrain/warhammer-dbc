// module/constants/advancement.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Автоматизация трат опыта по СКЛОННОСТЯМ (Black Crusade, стр. 23-24).
//  Персонаж выбирает 8 склонностей (+ «Общая» всегда 9-я). У каждого объекта
//  (характеристика/навык/талант) — 2 склонности. Категория цены:
//    2 совпадения → Дружественная (ally), 1 → Нейтральная (neutral), 0 → Враждебная (enemy).
//  «Общая» (general) считается у всех — участвует в совпадениях всегда.
// ════════════════════════════════════════════════════════════════════════════

import { specChar } from "./skill-specializations.mjs";
import { effectivePricingMode, charPatronCat, skillPatronCat, talentPatronCat, mixedCat }
  from "./patronage.mjs";

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
// если она у этого Таланта своя. `opts.actor` — включает диспетчер режима цены
// (constants/patronage.mjs, effectivePricingMode): без него (вызывающий не
// передал актора) поведение прежнее — всегда по Склонностям, ничего не ломает
// в местах, куда актор ещё не прокинут.
//
// Категория по действующему режиму цены персонажа: Склонности (как раньше),
// Покровительство (Бог объекта ↔ patronGod персонажа) или Смешанная (обе
// сразу, module/constants/patronage.mjs → mixedCat). Без актора — всегда
// Склонности (безопасный дефолт для мест, ещё не прокинувших актора).
export function resolveCharCat(charKey, charApts, actor) {
  const apt = () => aptitudeCat(charApts, CHAR_APTITUDES[charKey] || []);
  const mode = actor ? effectivePricingMode(actor) : "aptitude";
  if (mode === "aptitude") return apt();
  const patron = () => charPatronCat(charKey, actor.system?.patronGod, actor.system?.patronStereotype);
  return mode === "patronage" ? patron() : mixedCat(apt(), patron());
}
export function resolveSkillCat(skillKey, specialty, itemApts, charApts, actor) {
  const apt = () => aptitudeCat(charApts, itemApts);
  const mode = actor ? effectivePricingMode(actor) : "aptitude";
  if (mode === "aptitude" || !skillKey) return apt();
  const patron = () => skillPatronCat(skillKey, specialty, actor.system?.patronGod);
  return mode === "patronage" ? patron() : mixedCat(apt(), patron());
}
export function resolveTalentCat(talentName, itemApts, charApts, actor) {
  const apt = () => aptitudeCat(charApts, itemApts);
  const mode = actor ? effectivePricingMode(actor) : "aptitude";
  if (mode === "aptitude" || !talentName) return apt();
  const patron = () => talentPatronCat(talentName, actor.system?.patronGod);
  return mode === "patronage" ? patron() : mixedCat(apt(), patron());
}

export function talentCostXP(tier, itemApts, charApts, cultCat = null, opts = {}) {
  const fixed = fixedTalentCost(opts.name, opts.patron);
  if (fixed !== null) return fixed;
  const cat = cultCat || resolveTalentCat(opts.name, itemApts, charApts, opts.actor);
  return TALENT_COST[cat][clampIdx((parseInt(tier) || 1) - 1, 2)];
}
export function charCostXP(stepIndex, charKey, charApts, cultCat = null, opts = {}) {
  const cat = cultCat || resolveCharCat(charKey, charApts, opts.actor);
  return CHAR_COST[cat][clampIdx(stepIndex, 4)];
}
export function skillCostXP(rankIndex, itemApts, charApts, cultCat = null, opts = {}) {
  const cat = cultCat || resolveSkillCat(opts.skillKey, opts.specialty, itemApts, charApts, opts.actor);
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
// «Миньон Хаоса» — та же динамика (стр. 111 + стр. 62): вторая склонность
// талант берёт не из компендиума, а у Характеристики выбранной группы Хозяина
// (masterChar — Fel у Человека, Per у Зверя и т.д.), потому от группы зависит
// и цена. В паке у Таланта в аптитьюдах статично лежит только "social" —
// это верно для группы «Человек» (CHAR_APTITUDES.fel = ["fel","social"]), но
// не подставляется автоматически ни для других групп, ни само по себе не
// поднимает категорию до Дружественной при наличии ОБЕИХ склонностей fel
// (wdbc-ije: «Soc, F» для миньонов-людей).
export const DYNAMIC_APT_TALENTS = {
  "beyond human": "char",
  "за гранью человека": "char",
  "mastery": "skill",
  "мастерство": "skill",
  "minion of chaos": "char",
  "миньон хаоса": "char"
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

  // Привязка «Мастерства» бывает и специализацией группы — «forbiddenLore:daemons».
  // Первая склонность тогда берётся у самой специализации: Навигация (Варп) —
  // это Воля, а не Интеллект группы.
  const [groupKey, spec] = String(specKey).split(":");
  const def = (defs.skills || {})[groupKey] || (defs.groupSkills || {})[groupKey];
  if (!def) return Array.isArray(ownApts) ? ownApts : [];
  const char = spec ? specChar(groupKey, spec, def.char) : def.char;
  return [char, def.apt2].filter(Boolean);
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
