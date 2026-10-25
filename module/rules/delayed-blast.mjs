// module/rules/delayed-blast.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ОЧЕРЕДЬ «ВЗРЫВ ЧЕРЕЗ N РАУНДОВ» (Sahara 3-9d40, Расплавление / Meltdown).
//
//  Универсальная очередь отложенных взрывов: запись лежит флагом на акторе,
//  отсчёт ведёт начало Хода ВЛАДЕЛЬЦА записи — книга говорит «через 1d5 Раундов
//  (в начале Хода персонажа)». Каждое начало его Хода убавляет `turnsLeft` на 1;
//  дошло до 0 — взрыв. Пока запись скрыта (`hidden`), её срок знает только ГМ.
//
//  Запись: { id, label, turnsLeft, hidden, damage ("3d10+10"), pen, blast (м),
//            damageType, damageSubtype, weaponName, itemIds (что уничтожить) }
//
//  Чистые функции без Foundry: поток (флаг, карточка, уничтожение предметов) —
//  combat/delayed-blast.mjs. Не импортируется из rules/sources.mjs.
// ════════════════════════════════════════════════════════════════════════════

/** Флаг актора: очередь отложенных взрывов. */
export const DELAYED_BLASTS_FLAG = "delayedBlasts";

/** Запись очереди из полей (числа приводятся, лишнее отбрасывается). */
export function makeDelayedBlast(o = {}) {
  return {
    id: String(o.id ?? ""),
    label: String(o.label ?? "Взрыв"),
    turnsLeft: Math.max(0, Math.floor(Number(o.turnsLeft) || 0)),
    hidden: !!o.hidden,
    damage: String(o.damage ?? "0"),
    pen: Number(o.pen) || 0,
    blast: Number(o.blast) || 0,
    damageType: String(o.damageType ?? "blast"),
    damageSubtype: String(o.damageSubtype ?? ""),
    weaponName: String(o.weaponName ?? o.label ?? "Взрыв"),
    itemIds: Array.isArray(o.itemIds) ? o.itemIds.map(String) : []
  };
}

/**
 * Начался Ход владельца: срок каждой записи −1. Дошедшие до 0 — к взрыву.
 * @param {object[]} list
 * @returns {{remaining: object[], due: object[]}}
 */
export function tickDelayedBlasts(list) {
  const remaining = [], due = [];
  for (const e of Array.isArray(list) ? list : []) {
    const left = Math.max(0, (Number(e?.turnsLeft) || 0) - 1);
    if (left <= 0) due.push({ ...e, turnsLeft: 0 });
    else remaining.push({ ...e, turnsLeft: left });
  }
  return { remaining, due };
}

/** Сколько записей ждут (для подписи). */
export const pendingDelayedBlasts = actor => {
  const v = actor?.getFlag?.("warhammer-dbc", DELAYED_BLASTS_FLAG);
  return Array.isArray(v) ? v : [];
};
