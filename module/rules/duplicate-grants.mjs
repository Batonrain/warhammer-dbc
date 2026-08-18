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
