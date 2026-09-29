// module/rules/limited-lift.mjs
// ════════════════════════════════════════════════════════════════════════
//  Limited Lift / Ограниченная Подъёмная Сила (Гарпия, глава I): «Гарпия
//  может поднять в воздух только свой вес Ношения и не может летать с ношей,
//  тяжелее этого веса. Бонус к S от силовой брони не увеличивает ее вес
//  Ношения и броня не нивелирует свой собственный вес в расчете веса
//  Ношения для полета».
//
//  Отдельный от обычного расчёт Ношения — «для полёта»:
//   • S.b без той части, что добавила надетая броня (strengthBonus, rules/
//     character.mjs — прибавка к ЗНАЧЕНИЮ S, отсюда и вычитаем её из
//     значения, а не из Бонуса: Unnatural S остаётся);
//   • груз = обычный вес снаряжения + вес надетой брони, которая для ходьбы
//     «несёт себя сама» (силовая включённая / weightless).
//  Итог — system.encumbrance.flight {load, carry, canFly}; его читает окно
//  Полёта (combat/movement-actions.mjs::showFlightDialog) и не даёт взлететь.
//  Возможность trait.limitedLift раздаёт сама Черта.
// ════════════════════════════════════════════════════════════════════════

export const LIMITED_LIFT_CAPABILITY = "trait.limitedLift";

/**
 * S.b для Ношения в полёте.
 * @param {{bonus:number, total:number}} s — готовая Характеристика S
 * @param {number} armourS — прибавка брони к ЗНАЧЕНИЮ S
 */
export function flightStrengthBonus(s, armourS) {
  const total = Number(s?.total) || 0;
  const bonus = Number(s?.bonus) || 0;
  const a = Math.max(0, Number(armourS) || 0);
  if (!a) return bonus;
  return bonus - (Math.floor(total / 10) - Math.floor((total - a) / 10));
}

/** Можно ли взлететь с таким грузом. */
export function limitedLiftStatus({ load, carry }) {
  const l = Math.round((Number(load) || 0) * 100) / 100;
  const c = Number(carry) || 0;
  return { load: l, carry: c, canFly: l <= c };
}
