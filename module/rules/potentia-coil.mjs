// module/rules/potentia-coil.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Катушка Потенции и Электу-Индукторы (Импланты Механикум, книга) — чистая
//  арифметика двух действий вкладки ТЕХ:
//   • «Персонаж может тратить заряды, снимая Усталость по цене 2к1, но не
//     убирая потребность во сне (в т.ч. вне своего Хода)» — кнопка «−1
//     Усталость» у Катушки;
//   • «Позволяют за полное действие заряжать Катушки Потенции … тестом
//     Tech-Use+0, восстанавливая 1 заряд за каждый Успех до максимума» —
//     кнопка «Зарядка» у Катушки (модификатор по Качеству Индукторов — запись
//     Конструктора на самом импланте, область «coilCharge»).
//  Кнопки и запись в актора — module/sheets/tabs/tech.mjs.
// ════════════════════════════════════════════════════════════════════════════

/** Зарядов ⚡ за 1 снятую Усталость. */
export const COIL_FATIGUE_COST = 2;

/**
 * Снять 1 Усталость за заряды Катушки.
 * @returns {{ok:true, energy:number, fatigue:number}|{ok:false, reason:"energy"|"fatigue"}}
 */
export function coilFatigueRelief({ energy = 0, fatigue = 0 } = {}) {
  const en = Math.max(0, Number(energy) || 0);
  const fat = Math.max(0, Number(fatigue) || 0);
  if (fat < 1) return { ok: false, reason: "fatigue" };
  if (en < COIL_FATIGUE_COST) return { ok: false, reason: "energy" };
  return { ok: true, energy: en - COIL_FATIGUE_COST, fatigue: fat - 1 };
}

/** Сколько зарядов вернула зарядка: 1 за Успех, не выше максимума Катушки. */
export function electooChargeGain({ success = false, deg = 0, energy = 0, max = 0 } = {}) {
  if (!success) return 0;
  const room = Math.max(0, (Number(max) || 0) - (Number(energy) || 0));
  return Math.max(0, Math.min(Math.max(1, Number(deg) || 0), room));
}
