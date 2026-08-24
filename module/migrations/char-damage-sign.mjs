// module/migrations/char-damage-sign.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Одноразовая инверсия знака system.charDamage.* у существующих актёров.
//
//  Поле сменило смысл: было «Урон в характеристику» (положительное число,
//  ВЫЧИТАЛОСЬ из Итого, инпут с min="0"), стало знаковым «Мод.» (прибавляется:
//  плюс — бонус, минус — штраф). Сохранённые положительные значения означали
//  штраф — без инверсии персонаж с уроном 10 в Силу получил бы +10 вместо
//  −10, молча, разброс в 20 очков.
//
//  Писателей у поля, кроме инпута листа, нет — миграция ограничивается одним
//  проходом по актёрам мира.
// ════════════════════════════════════════════════════════════════════════════

/** Обновление для одного актора: пары путь→значение с обращённым знаком. */
export function charDamageSignUpdate(system = {}) {
  const upd = {};
  for (const [key, val] of Object.entries(system.charDamage || {})) {
    const n = Number(val) || 0;
    if (n !== 0) upd[`system.charDamage.${key}`] = -n;
  }
  return upd;
}

/** Инвертирует знак charDamage у всех актёров мира. */
export async function migrateCharDamageSign() {
  if (!game.user?.isGM) { ui.notifications?.warn("Знак Мод. характеристик: только для ГМа."); return; }
  let actorCount = 0;

  try {
    for (const actor of game.actors) {
      const upd = charDamageSignUpdate(actor.system);
      if (Object.keys(upd).length) { await actor.update(upd); actorCount++; }
    }
  } catch (e) { console.error("Warhammer DBC | Знак Мод. характеристик:", e); }

  const msg = `Знак Мод. характеристик обращён у ${actorCount} актёров.`;
  console.log("Warhammer DBC |", msg);
  if (actorCount) ui.notifications?.info("Warhammer DBC: " + msg);
  return { actorCount };
}
