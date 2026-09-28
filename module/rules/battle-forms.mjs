// module/rules/battle-forms.mjs
// ════════════════════════════════════════════════════════════════════════════
//  БОЕВЫЕ ФОРМЫ «ДО КОНЦА БОЯ ИЛИ СЦЕНЫ» — ядро без Foundry.
//
//  Книга (глава I, субрасы Зверолюда) трижды даёт одну и ту же форму правила:
//  «за действие потратить Очко Бесчестия, чтобы до конца боя или сцены
//  получить …»:
//    Слаангор  — рука превращается в Клешню (Deadly Natural Weapons), обратно
//                бесплатно за полное действие, в конце боя/сцены — сама;
//    Пестигор  — Трейты Sturdy и Stuff of Nightmares;
//    Кхорнгор  — все Natural Weapons становятся Deadly Natural Weapons и
//                Трейт Brutal Charge (+2).
//
//  Раньше всё это лежало в данных ПОСТОЯННО (Черты выдавались субрасой
//  навсегда) — персонаж получал за 750 опыта то, за что книга просит платить
//  Бесчестием в каждом бою.
//
//  Здесь — только данные форм и чистый расчёт (что выдать, как перестроить
//  оружие, что откатить). Запись в актора, списание ОД, откат по концу боя и
//  кнопке «Новая сцена» — module/apps/battle-forms.mjs. Цена в Бесчестии —
//  не здесь: её списывает панель «ВОЗМОЖНОСТИ СЕЙЧАС» по записи Конструктора
//  kind:"script" с capabilityCostPool:"infamy" (apps/mechanics.mjs::
//  runMechScriptEntry), та же дорога, что у Даров Богов.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName } from "./predicates.mjs";

const NS = "warhammer-dbc";

/** Флаг на выданном/перестроенном предмете: { form } — какой форме он принадлежит. */
export const BATTLE_FORM_FLAG = "battleForm";

/** Флаг отката на перестроенном оружии: { form, weaponProps, penetration }. */
export const BATTLE_FORM_REVERT_FLAG = "battleFormRevert";

/** Полное действие — 2 ОД (книга, стр. 12). */
export const FULL_ACTION_AP = 2;

/**
 * Формы. `grant` — предметы компендиума, которые форма кладёт на актора на
 * время ({ pack, id, rating? }); `deadlyNaturalWeapons` — перестроить оружие
 * Черты Natural Weapons в профиль Deadly Natural Weapons; `activateAp` /
 * `endAp` — цена включения и ручного выключения в ОД (0 — свободное
 * действие); `manualEnd` — можно ли вернуть форму досрочно (только Клешня:
 * «может за полное действие превратить эту руку обратно бесплатно»).
 */
export const BATTLE_FORMS = {
  "slaangor.pincerClaw": {
    label: "Клешня Слаангора",
    activateAp: FULL_ACTION_AP, endAp: FULL_ACTION_AP, manualEnd: true,
    grant: [{ pack: "weapons", id: "uwzgmx72z7uZCbOu", equip: true }],
    text: "Одна рука превращается в Клешню (Deadly Natural Weapons: 1d10+2 R, Pen 3, Extreme (8), Razor Sharp, Reinforced, Tearing) до конца боя или сцены."
  },
  "pestigor.plagueFlesh": {
    label: "Чумная Плоть Пестигора",
    activateAp: FULL_ACTION_AP, endAp: 0, manualEnd: false,
    grant: [
      { pack: "traits", id: "ZPrppKroO0nNHfMf" },   // Sturdy / Надёжный
      { pack: "traits", id: "njhMytZB06EWtsQA" }    // Stuff of Nightmares / Существо из Кошмаров
    ],
    text: "До конца боя или сцены — Трейты Sturdy и Stuff of Nightmares."
  },
  "khorngor.bloodFury": {
    label: "Кровавая Ярость Кхорнгора",
    activateAp: 0, endAp: 0, manualEnd: false,
    grant: [{ pack: "traits", id: "IbofRJ9BzKCiA13D", rating: 2 }],   // Brutal Charge (+2)
    deadlyNaturalWeapons: true,
    text: "До конца боя или сцены — все Natural Weapons становятся Deadly Natural Weapons (без Primitive, Reinforced, Pen = рейтинг), и Brutal Charge (+2)."
  }
};

export function battleFormDef(key) {
  return BATTLE_FORMS[key] ?? null;
}

const flagsOf = item => item?.flags?.[NS] ?? {};

/** Форма, которой принадлежит предмет (выдан ею или перестроен), или "". */
export function itemBattleForm(item) {
  return String(flagsOf(item)[BATTLE_FORM_FLAG]?.form || flagsOf(item)[BATTLE_FORM_REVERT_FLAG]?.form || "");
}

/** Какие формы сейчас действуют на акторе — по меткам предметов. */
export function activeBattleForms(items) {
  const out = new Set();
  for (const i of items ?? []) {
    const f = itemBattleForm(i);
    if (f) out.add(f);
  }
  return out;
}

/** Предметы, выданные формой (удаляются при её окончании). */
export function grantedByForm(items, key) {
  return [...(items ?? [])].filter(i => flagsOf(i)[BATTLE_FORM_FLAG]?.form === key);
}

/** Оружие, перестроенное формой (откатывается при её окончании). */
export function patchedByForm(items, key) {
  return [...(items ?? [])].filter(i => flagsOf(i)[BATTLE_FORM_REVERT_FLAG]?.form === key);
}

/**
 * Оружие, выданное Чертой Natural Weapons (не Deadly): интегральные атаки,
 * чей grantedByItem — Черта с таким именем. Сравнение по половине имени
 * (itemHasName): «Natural Weapons» не совпадёт с «Deadly Natural Weapons».
 */
export function naturalWeaponsAttacks(items) {
  const list = [...(items ?? [])];
  const nw = new Map(list.filter(i => i?.type === "trait" && itemHasName(i, "Natural Weapons"))
    .map(i => [String(i.id ?? i._id), i]));
  return list
    .filter(i => i?.type === "weapon" && nw.has(String(flagsOf(i).grantedByItem || "")))
    .map(weapon => ({ weapon, trait: nw.get(String(flagsOf(weapon).grantedByItem)) }));
}

/**
 * Профиль Deadly Natural Weapons поверх профиля Natural Weapons (core.json,
 * Трейты): оружие теряет Primitive, получает Reinforced, Pen = рейтинг Черты
 * (если своё Пробитие не выше). Возвращает { patch, revert } или null, если
 * менять нечего (оружие уже такое).
 */
export function deadlyNaturalPatch(weaponSystem, rating) {
  const props = Array.isArray(weaponSystem?.weaponProps) ? weaponSystem.weaponProps : [];
  const pen = Number(weaponSystem?.penetration) || 0;
  const r = Math.max(0, Number(rating) || 0);
  const next = props.filter(p => p?.key !== "primitive");
  if (!next.some(p => p?.key === "reinforced")) next.push({ key: "reinforced" });
  const nextPen = Math.max(pen, r);
  const same = next.length === props.length && next.every((p, k) => p?.key === props[k]?.key) && nextPen === pen;
  if (same) return null;
  return {
    patch: { "system.weaponProps": next, "system.penetration": nextPen },
    revert: { weaponProps: props.map(p => ({ ...p })), penetration: pen }
  };
}
