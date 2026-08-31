// module/rules/duplicate-grants.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Один и тот же Навык или Талант из разных источников.
//
//  Источников у персонажа много: Архетип, Раса, Элитный архетип, Субраса,
//  Происхождение, Предсказание, Стремления (Мотивация, Гордость, Позор),
//  Черты, Культура Астартес. Совпадения среди них — обычное дело, и раньше
//  второй источник пропадал впустую.
//
//  Правило стола:
//    Навык выше того, что есть, — просто заменяет: персонаж стал лучше;
//    Навык такой же или ниже — не даёт ничего, но возвращает опыт: столько,
//        сколько стоила бы прокачка ЭТОГО уровня с нуля при склонностях
//        персонажа (дают +10 — возвращается цена «+0» и «+10» вместе);
//    Талант, который уже есть, — возвращает свою цену. Специализация делает
//        Талант другим: обучение болтерам и лазганам совпадением не считается.
//
//  Возврат считается по СКЛОННОСТЯМ, а их персонаж выбирает в Мастере создания
//  до всякой выдачи (окно «Склонности»). Поэтому сверка идёт только после того,
//  как склонности подтверждены: посчитанный раньше возврат оказался бы не тем.
//
//  Здесь только решение «что делать» и до какого уровня считать цену. Сами
//  цены зависят от Склонностей и культуры конкретного персонажа — их считает
//  вызывающий теми же функциями, что и вкладка «Развитие», иначе возврат
//  разошёлся бы с покупкой.
// ════════════════════════════════════════════════════════════════════════════

import { SKILL_RANKS } from "../constants/characteristics.mjs";
import { SKILLS_DEF } from "../constants/skills.mjs";
import { TALENT_LIBRARY } from "../constants/talents-library.mjs";

const SYSTEM_ID = "warhammer-dbc";

/** Ранги по возрастанию: нетренированный, знает (+0), +10, +20, +30. */
export const RANK_ORDER = ["untrained", "knows", "trained", "veteran", "expert"];

/** Индекс ранга в порядке роста; неизвестный считаем нетренированным. */
export const rankIndex = rank => Math.max(0, RANK_ORDER.indexOf(rank || "untrained"));

/** Следующая ступень или null, если это уже потолок. */
export function nextRank(rank) {
  const i = rankIndex(rank);
  return i >= RANK_ORDER.length - 1 ? null : RANK_ORDER[i + 1];
}

/** Выше из двух рангов. */
export function higherOf(a, b) {
  return rankIndex(a) >= rankIndex(b) ? (a || "untrained") : (b || "untrained");
}

/**
 * Ступени покупки, которые пришлось бы оплатить, чтобы дойти до этого ранга с
 * нуля. Индексы — как в таблице цен Навыков: 0 = «+0», 1 = «+10», 2 = «+20»,
 * 3 = «+30». Для нетренированного ступеней нет: платить не за что.
 */
export function stepsUpTo(rank) {
  const i = rankIndex(rank);
  return i <= 0 ? [] : Array.from({ length: i }, (_, n) => n);
}

/**
 * Что делать с Навыком, который выдают ещё раз.
 *
 * @param {string} current  ранг, который уже стоит у персонажа
 * @param {string} granted  ранг, который даёт новый источник
 * @returns {{rank: string, refundSteps: number[], duplicate: boolean}}
 *   rank — каким ранг станет; refundSteps — ступени, чью цену вернуть
 *   (пусто, если возврата нет); duplicate — сработало ли правило совпадения.
 */
export function skillGrantOutcome(current, granted) {
  const cur = current || "untrained";

  // Источник даёт больше — заменяет: персонаж просто стал лучше.
  if (rankIndex(granted) > rankIndex(cur)) {
    return { rank: granted, refundSteps: [], duplicate: false };
  }

  // Навыка ещё нет вовсе — это первая выдача, а не совпадение.
  if (rankIndex(cur) === 0) {
    return { rank: granted || "knows", refundSteps: [], duplicate: false };
  }

  // Такой же или ниже: ранг не трогаем, возвращаем цену выдаваемого уровня,
  // посчитанную с нуля — как если бы игрок качал его сам.
  return { rank: cur, refundSteps: stepsUpTo(granted), duplicate: true };
}

/** Подпись ступени для журнала и чата: «+10», «+20», «+30». */
export function rankLabel(rank) {
  return SKILL_RANKS[rank]?.label || rank || "";
}

/**
 * Тот же ли это Талант. Специализация делает Талант другим: «Weapon Training
 * (Bolt)» и «…(Las)» — разные покупки, и совпадением не считаются.
 */
export function isSameTalent(a, b) {
  const name = t => String(t?.name || "").trim().toLowerCase();
  const spec = t => String(t?.system?.specialization || "").trim().toLowerCase();
  return !!name(a) && name(a) === name(b) && spec(a) === spec(b);
}

/** Есть ли уже такой Талант среди имеющихся. */
export function findSameTalent(items = [], talent) {
  return [...items].find(i => i?.type === "talent" && isSameTalent(i, talent)) || null;
}

/**
 * Существующий на акторе Талант, который повторная покупка должна поднять на
 * ранг, а не задвоить предметом. Срабатывает ТОЛЬКО когда сама запись
 * компендиума отмечена многократной (system.hasRating — та же пара полей,
 * что у Черты, см. data/item/trait.mjs; например Enemy/Враг, стр. 62) —
 * признак стоит не у всех «можно брать снова» Талантов книги, это решение
 * автора конкретной записи пака, а не всеобщее правило имени.
 */
export function repeatableTalentTarget(items = [], data) {
  if (!data || data.type !== "talent" || !data.system?.hasRating) return null;
  return findSameTalent(items, data);
}

/**
 * Покупка Таланта в пикере (module/sheets/item-picker.mjs, kind:"equipment"
 * Конструктора): если это повторная покупка уже взятого многократного
 * Таланта, поднимает system.rating существующему предмету вместо второй
 * копии — раньше Enemy/Sound Constitution задваивались строкой на каждой
 * покупке. Прочие Таланты и любые не-Таланты создаются как обычно.
 * @returns {Promise<{item: Item, ranked: boolean, rating: number}>}
 */
export async function createOrRankTalent(actor, data) {
  const existing = repeatableTalentTarget(actor.items, data);
  if (existing) {
    const rating = (Number(existing.system?.rating) || 0) + 1;
    await existing.update({ "system.rating": rating });
    return { item: existing, ranked: true, rating };
  }
  const [item] = await actor.createEmbeddedDocuments("Item", [data]);
  return { item, ranked: false, rating: item?.system?.rating ?? 0 };
}

// ════════════════════════════════════════════════════════════════════════════
//  Настройка ГМ: что делать с повтором Таланта/Навыка из РАЗНЫХ источников
//  Механики (Архетип/Раса/Происхождение/Предсказание/Стремления/Черты/
//  Культура — kind:"talent"/kind:"skill" в applyMechEntry, module/apps/
//  mechanics.mjs). Ручные покупки (вкладка «Развитие», драг-дроп из
//  компендиума) эту настройку не читают — там дублей не проверяют вовсе,
//  это отдельная задача.
// ════════════════════════════════════════════════════════════════════════════

export const TALENT_DUP_POLICIES = {
  refund:    "Компенсация опытом",
  altTalent: "Выбор альтернативного Таланта (той же Группы и Ступени)"
};
// "raise" — нынешнее (единственное до этой настройки) поведение
// skillGrantOutcome() выше: остаётся дефолтом, чтобы не менять уже идущие
// игры молча.
export const SKILL_DUP_POLICIES = {
  raise:    "Подъём навыка",
  refund:   "Компенсация опытом",
  altSkill: "Выбор альтернативного Навыка"
};

export function talentDuplicatePolicy() {
  try { return game.settings.get(SYSTEM_ID, "talentDuplicatePolicy") || "refund"; }
  catch (e) { return "refund"; }
}
export function skillDuplicatePolicy() {
  try { return game.settings.get(SYSTEM_ID, "skillDuplicatePolicy") || "raise"; }
  catch (e) { return "raise"; }
}

export function registerDuplicateGrantSettings() {
  game.settings.register(SYSTEM_ID, "talentDuplicatePolicy", {
    name: "Повтор Таланта из разных источников",
    hint: "Что делать, когда Механика (Архетип/Раса/Происхождение и т.п.) выдаёт персонажу Талант, который у него уже есть.",
    scope: "world", config: true, type: String,
    choices: TALENT_DUP_POLICIES, default: "refund"
  });
  game.settings.register(SYSTEM_ID, "skillDuplicatePolicy", {
    name: "Повтор Навыка из разных источников",
    hint: "Что делать, когда Механика выдаёт персонажу Навык (или Специализацию), который у него уже есть на этой или более высокой ступени.",
    scope: "world", config: true, type: String,
    choices: SKILL_DUP_POLICIES, default: "raise"
  });
}

/** Группа (папка) и Ступень Таланта по его имени — из статической библиотеки
 * (module/constants/talents-library.mjs), не из предмета на акторе: у
 * встроенного в актора Таланта своей папки нет, она есть только у записи
 * библиотеки/компендиума. */
export function talentGroupOf(name) {
  const entry = TALENT_LIBRARY.find(t => t.name === name);
  return entry ? { folder: entry.folder, tier: entry.system.tier } : null;
}

/** Полная запись библиотеки по имени — чтобы выдать выбранную альтернативу
 * как обычный Талант (те же поля, что дал бы компендиум). */
export function talentLibraryEntry(name) {
  return TALENT_LIBRARY.find(t => t.name === name) || null;
}

/**
 * Таланты той же Группы и Ступени, что и уже имеющийся дублирующий, минус те,
 * что персонаж уже взял (по имени, без учёта регистра).
 */
export function altTalentCandidates(name, ownedNames = []) {
  const grp = talentGroupOf(name);
  if (!grp) return [];
  const owned = new Set(ownedNames.map(n => String(n || "").trim().toLowerCase()));
  return TALENT_LIBRARY
    .filter(t => t.folder === grp.folder && t.system.tier === grp.tier
      && !owned.has(String(t.name).trim().toLowerCase()))
    .map(t => ({ name: t.name, tier: t.system.tier, folder: t.folder }));
}

/** Другие обычные (не групповые) Навыки, ещё не достигшие выдаваемого ранга. */
export function altSkillCandidates(skillKey, actorSkills = {}) {
  return Object.entries(SKILLS_DEF)
    .filter(([k]) => k !== skillKey)
    .map(([k, def]) => ({ key: k, label: def.label, rank: actorSkills[k]?.rank || "untrained" }));
}
