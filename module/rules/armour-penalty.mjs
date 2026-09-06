// module/rules/armour-penalty.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Штраф выключенной силовой брони (стр. 233) — чистая часть, без Foundry и
//  без интерфейса: классификация и числа, которые кто-то другой применит.
//
//  Жила в module/combat/armor-mods.mjs и переехала сюда (wdbc-n17t), потому
//  что её понадобилось спрашивать ИЗ реестра правил (rules/situational.mjs), а
//  armor-mods.mjs тянет за собой лист (кнопки, чат, наложение Усталости) и
//  через него — сам реестр: получался круг импортов, на котором ES-загрузчик
//  vitest вставал насмерть. Круг разорван переносом, а не заплаткой: правило
//  не должно зависеть от того, кто рисует кнопку.
//
//  combat/armor-mods.mjs реэкспортирует всё отсюда — прежние импорты работают
//  как работали.
// ════════════════════════════════════════════════════════════════════════════

import { carryRow } from "../helpers/utils.mjs";

// Физические характеристики — база для «физических действий» из штрафа
// выключенной силовой брони. Toughness сюда сознательно НЕ входит (как и у
// fatiguePenalty в sheets/tabs/conditions.mjs) — книга говорит именно про
// физические ДЕЙСТВИЯ (двигаться, бить, стрелять), а не про стойкость тела.
// Экспортированы: тот же набор реюзает rules/encumbrance.mjs (общий перегруз
// инвентаря, wdbc-2l3x, — «штраф −10 на все движения и атаки» стр. 27
// дословно совпадает по формулировке с этой веткой армора).
export const PHYSICAL_CHARS = new Set(["ws", "bs", "s", "ag"]);
// «Физические реакции» (стр. 233) — в этой системе это конкретно два навыка.
export const REACTION_SKILLS = new Set(["dodge", "parry"]);

/**
 * Надета ли выключенная силовая броня — общая для штрафа действий/реакций
 * ниже и (при желании) для другого кода, которому важно то же условие.
 */
export function hasDisabledPowerArmour(actor) {
  // === false, не !active — см. комментарий у armorAgilityCap: пропавшее
  // поле значит «включена», а не «выключена».
  return (actor?.items ?? []).some(i =>
    i.type === "armor" && i.system?.equipped && i.system?.armorType === "power" && i.system?.active === false);
}

/** Суммарный вес выключенной силовой брони (кг) — для disabledArmourOverloadTier. */
export function disabledArmourWeight(actor) {
  return (actor?.items ?? [])
    .filter(i => i.type === "armor" && i.system?.equipped && i.system?.armorType === "power" && i.system?.active === false)
    .reduce((sum, i) => sum + (Number(i.system?.weight) || 0), 0);
}

/**
 * Штраф от выключенной силовой брони (стр. 233, «Выключенная Силовая
 * Броня») на конкретный тест: −10 на физические действия (характеристика
 * из PHYSICAL_CHARS — сам тест или характеристика навыка), −40 на
 * физические РЕАКЦИИ (Уклонение/Парирование — `skillKey`). Ни то ни другое
 * (тест ментальный/социальный) или броня включена/не надета — 0.
 *
 * Поверх этого плоского штрафа физическим ДЕЙСТВИЯМ (не реакциям — книга
 * отдельно говорит именно про «движения и атаки») добавляется ещё −10 от
 * каскада перевеса (disabledArmourOverloadTier), если он не погашен
 * исключением «Ношение по чистому S.b ≥5× веса брони» — тогда остаётся
 * только этот плоский −10/−40, как и было написано в книге для этого случая.
 */
export function disabledArmourPenalty(actor, { charKey, skillKey } = {}) {
  if (!hasDisabledPowerArmour(actor)) return 0;
  if (skillKey && REACTION_SKILLS.has(skillKey)) return -40;
  if (charKey && PHYSICAL_CHARS.has(String(charKey).toLowerCase())) {
    const overload = disabledArmourOverloadTier(actor, disabledArmourWeight(actor));
    return -10 + (overload ? overload.moveAtkMod : 0);
  }
  return 0;
}

/**
 * «Перевес» выключенной силовой брони по её СОБСТВЕННОМУ весу против
 * Ношения/Подъёма/Толкания актора (стр. 233, «Выключенная Силовая Броня») —
 * чистая функция: ничего не пишет и не бросает кубики, только классифицирует
 * тир и возвращает готовые числа-модификаторы для того, кто их применит
 * (движение/атака/SPD). Тир 3 — Беспомощен, читающий код должен сам не
 * пускать обычные действия, здесь только флаг.
 *
 * null — веса не хватает даже до Ношения (перевеса нет вовсе) ЛИБО сработало
 * исключение «Ношение по чистому S.b (без T.b) ≥5× веса брони» — тогда
 * действует только плоский −10/−40 из disabledArmourPenalty, каскада нет.
 *
 * Периодический тест «раз в T.b часов перевеса» и тест-развилка при смене
 * Хода/отключении брони (S+0 или Athletics(S)+10 → провал опускает Max.A до
 * 10) сюда СОЗНАТЕЛЬНО НЕ входят — это не расчёт, а игровое СОБЫТИЕ (нужны
 * диалог/кнопка и отслеживание игрового времени в состоянии перевеса,
 * которого в проекте пока нет ни для чего). `testPenalty` ниже — готовое
 * число для будущего диалога, сам тест эта функция не запускает.
 *
 * @param {Actor} actor
 * @param {number} armourWeight — вес самой выключенной силовой брони (кг)
 */
export function disabledArmourOverloadTier(actor, armourWeight) {
  const w = Number(armourWeight) || 0;
  if (w <= 0) return null;

  const enc   = actor?.system?.encumbrance || {};
  const carry = Number(enc.carry) || 0;
  const lift  = Number(enc.lift)  || 0;
  const push  = Number(enc.push)  || 0;
  if (w <= carry) return null; // веса не хватает даже до первого порога

  // Исключение: Ношение по ЧИСТОМУ S.b (без T.b) ≥5× веса брони — каскада нет.
  const sb = Number(actor?.system?.characteristics?.s?.bonus) || 0;
  if (carryRow(sb).carry * 5 >= w) return null;

  if (w <= lift) {
    return { tier: 1, moveAtkMod: -10, spdMod: -1, fullActionOnly: false, helpless: false, testPenalty: 0 };
  }
  if (w <= push) {
    return { tier: 2, moveAtkMod: -10, spdMod: -1, fullActionOnly: true, helpless: false, testPenalty: -20 };
  }
  return { tier: 3, moveAtkMod: -10, spdMod: -1, fullActionOnly: true, helpless: true, testPenalty: -20 };
}
