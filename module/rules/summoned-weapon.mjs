// module/rules/summoned-weapon.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Призванное оружие — общий механизм (Sahara 578-628b, wdbc-1rno.28).
//
//  Книга несколько раз даёт «оружие, которое появляется в руке и исчезает»:
//  Демоническое Вооружение (Черта: призвать/развоплотить, растворяется, если
//  выпало из рук), Телекинетический Клинок (психосила: клинки живут, пока сила
//  поддерживается). Общее у них одно — это ОБЫЧНЫЙ предмет-оружие на листе
//  (атаки, Парирование, свойства идут штатным путём), помеченный меткой
//  «призвано от источника»:
//    flags.warhammer-dbc.summonedBy = { sourceId, kind, psychic }
//      sourceId — id предмета-источника на том же акторе (Черта/психосила);
//      kind     — какой книжный источник (подпись и выбор правил);
//      psychic  — призвано психосилой: для Незримого это «психическая атака»
//                 (Варп-Зрение её засекает, rules/unseen-attack.mjs).
//
//  Демоническое Вооружение пишет свою старую метку (daemonicArmament) — она
//  признаётся здесь же, чтобы растворение «выпало из рук» было одно на всех.
//
//  Снятие (module/hooks.mjs):
//    • снята галочка «Снаряжено» или поставлено «Хранится» — оружие покинуло
//      руку и растворяется (dissolvesOnChange);
//    • источник исчез с листа или психосила больше не поддерживается —
//      призванное без источника растворяется (orphanedSummons).
// ════════════════════════════════════════════════════════════════════════════

import { isDaemonicArmament } from "./daemonic-armament.mjs";

const NS = "warhammer-dbc";
export const SUMMONED_FLAG = "summonedBy";

/** Метка призыва на предмете (или null). */
export function summonedBy(item) {
  return item?.flags?.[NS]?.[SUMMONED_FLAG] ?? item?.getFlag?.(NS, SUMMONED_FLAG) ?? null;
}

/** Призванный предмет — любой (новая метка или Демоническое Вооружение). */
export function isSummonedItem(item) {
  return !!summonedBy(item) || isDaemonicArmament(item);
}

/** Призвано психосилой — атака им психическая (засекается Варп-Зрением). */
export function isPsychicSummon(item) {
  return !!summonedBy(item)?.psychic;
}

/** Метка для данных создаваемого предмета. */
export function summonFlagData({ sourceId = "", kind = "", psychic = false } = {}) {
  return { [SUMMONED_FLAG]: { sourceId: String(sourceId), kind: String(kind), psychic: !!psychic } };
}

/** Предметы актора, призванные этим источником (по id предмета-источника). */
export function summonsOf(actor, sourceId) {
  if (!sourceId) return [];
  return [...(actor?.items ?? [])].filter(i => summonedBy(i)?.sourceId === String(sourceId));
}

/** Правка предмета, после которой призванное оружие покинуло руку. */
export function dissolvesOnChange(item, changes) {
  if (item?.type !== "weapon" || !isSummonedItem(item)) return false;
  const sys = changes?.system ?? {};
  return sys.equipped === false || sys.stored === true;
}

/**
 * Призванное без живого источника: источник снят с листа, либо это
 * психосила, которая больше не поддерживается. Демоническое Вооружение
 * (старая метка) сюда не попадает — оно живёт, пока не развоплощено.
 */
export function orphanedSummons(actor) {
  const items = [...(actor?.items ?? [])];
  const byId = new Map(items.map(i => [i.id, i]));
  return items.filter(i => {
    const s = summonedBy(i);
    if (!s?.sourceId) return false;
    const src = byId.get(s.sourceId);
    if (!src) return true;
    if (src.type === "psychicPower") return !src.system?.isSustained;
    return false;
  });
}
