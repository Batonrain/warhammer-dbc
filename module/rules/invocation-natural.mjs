// module/rules/invocation-natural.mjs
// ════════════════════════════════════════════════════════════════════════
//  Естественное оружие Даров Одержимости (wdbc-o368c).
//
//  Дары «Пасть», «Огромная Пасть», «Рога», «Звериные Ноги» (книга Хаоса,
//  Одержимость) дают Deadly Natural Weapon «с рейтингом как от Проявления».
//  Рейтинг Проявления — таблица Invocation / Проявление, строка «Deadly Nat.
//  Weap.»: Cor 1-35 → 0, 36-55 → 1, 56-70 → 1, 71-90 → 2, 91-100 → 2.
//  Это НЕ бонус Порчи (Cor.b): при Cor 50 книга даёт 1, а Cor.b — 5, поэтому
//  свойство deadlyNaturalCorB сюда не годится.
//
//  Свойства оружия (constants/weapon-properties.mjs):
//    invocationNaturalWeapon — +рейтинг к урону И к Пробитию (DNW: Pen X);
//    invocationNaturalDamage — +рейтинг только к урону (Пасть: «Bite с
//      рейтингом DNW» — у Bite (X) Пробитие 0).
//  Живой пересчёт на каждой атаке — Порча растёт, растёт и оружие.
// ════════════════════════════════════════════════════════════════════════

/** Рейтинг Deadly Natural Weapon от Проявления по Порче (таблица Invocation). */
export function invocationDnwRating(cor) {
  const c = Number(cor) || 0;
  if (c >= 71) return 2;
  if (c >= 36) return 1;
  return 0;
}

/** Прибавка к урону и Пробитию оружия с этими свойствами. */
export function invocationNaturalAdd(wp, actor) {
  if (!wp?.invocationNaturalWeapon && !wp?.invocationNaturalDamage) return { dmg: 0, pen: 0 };
  const r = invocationDnwRating(actor?.system?.corruption?.value);
  return { dmg: r, pen: wp.invocationNaturalWeapon ? r : 0 };
}
