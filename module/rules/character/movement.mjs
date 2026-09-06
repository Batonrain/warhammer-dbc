// module/rules/character/movement.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ДВИЖЕНИЕ ЛИСТА: итоговый Размер, SPD и его разбор по слагаемым, Полудвижение,
//  Бег, Натиск, Перевес инвентаря и штрафы выключенной брони (wdbc-neez).
//
//  Второй раздел, вынесенный из prepareCharacterDerived. Он самый связанный из
//  всех: принимает три накопителя, собранных проходами по предметам выше
//  (вклад Черт в Размер — отдельно тот, что двигает SPD, и тот, что не двигает,
//  — плюс прямую прибавку к скорости). Именно поэтому «один проход по
//  предметам» и «разбиение по разделам» тянут в разные стороны (wdbc-uvap):
//  единый проход эти накопители и создаёт.
// ════════════════════════════════════════════════════════════════════════════

import { calcMovement } from "../movement.mjs";
import { inventoryOverloadTier } from "../encumbrance.mjs";
import { disabledArmourOverloadTier, disabledArmourWeight } from "../../combat/armor-mods.mjs";

/**
 * @param {object} actor   актор — для предметов и флагов
 * @param {object} system  system актора, правится на месте
 * @param {object} deps
 * @param {object} deps.chars             готовые характеристики
 * @param {number} deps.agBonus           бонус Ловкости
 * @param {number} deps.traitSizeMod      вклад Черт в Размер (двигает SPD)
 * @param {number} deps.traitSizeModNoSpd вклад в Размер БЕЗ влияния на SPD
 * @param {number} deps.traitSpeedMod     прямая прибавка к SPD от Черт/имплантов
 */
export function prepareMovementDerived(actor, system, { chars, agBonus, traitSizeMod,
                                                        traitSizeModNoSpd, traitSpeedMod }) {
  // ── Движение (авторасчёт) ─────────────────────────────────────────────
  // 0 = Человек; трейт Размера сдвигает SPD (прямой мод). Трейт «Size/Hulking»
  // выдаётся как embedded ActiveEffect с ключом system.sizeMod, фаза "initial"
  // (см. packs-src/traits) — на этом месте он уже применён (Foundry вызывает
  // applyActiveEffects("initial") ДО prepareDerivedData), поэтому traitSizeMod
  // (легаси-петля выше, которая нарочно пропускает migratedEffect-предметы,
  // чтобы не посчитать их дважды) складывается С этим значением, а не
  // затирает его — иначе SPD/Инициатива персонажа с расовым Размером считались
  // бы без него, при этом бейдж «Размер» на листе показывал бы верное число
  // (было найдено на живых данных: sizeMod=1, sizeTotal=0 у всех Астартес).
  let sizeMod = traitSizeMod + (Number(system.sizeMod) || 0);
  // system.sizeModNoSpd — ActiveEffect-ключ Конструктора (kind:"characteristic",
  // charKey:"sizeNoSpd", см. apps/mechanics.mjs) для источников Размера, что
  // намеренно НЕ двигают SPD. Складывается с тем, что уже мог записать
  // легаси-эффект тем же ключом (тот же приём, что traitSizeMod/sizeMod выше).
  const sizeModNoSpd = traitSizeModNoSpd + (Number(system.sizeModNoSpd) || 0);
  const size    = (system.size ?? 0) + sizeMod;
  system.sizeMod   = sizeMod;          // вклад Черт в Размер (двигает SPD)
  system.sizeModNoSpd = sizeModNoSpd;  // вклад в Размер БЕЗ влияния на SPD
  system.sizeTotal = size + sizeModNoSpd; // итоговый Размер (база + оба вклада)
  const stance  = system.meleeStance || "standard";

  let { spd, halfMove, move, charge, run } = calcMovement(agBonus, size);
  // Снимок базового SPD (Ag.b + Размер, до модификаторов) — для breakdown
  // ниже (wdbc-zbiz), тем же приёмом, что charTotalTooltip у характеристик.
  const spdBase = spd;

  // Бонус к базовой скорости (SPD) от Черт/имплантов/талантов/психосил, плюс
  // system.movement.spdBonus — входное поле для kind:"movement" (Конструктор,
  // цель "SPD"), ставится ActiveEffect'ом в фазе "initial" (см. mechanics.mjs),
  // т.е. уже на месте к этому моменту расчёта.
  const spdBonus = Number(system.movement.spdBonus) || 0;
  // Перевес выключенной силовой брони (стр. 233) — SPD −1 с тира 1 и выше;
  // остальные последствия каскада (штраф теста, только Полное действие на
  // движение, Беспомощность) — не расчёт, а игровое событие, выведены
  // read-only на лист (system.disabledArmourOverload) для ручного учёта,
  // не блокируются здесь. См. wdbc-rdd.
  const overload = disabledArmourOverloadTier(actor, disabledArmourWeight(actor));
  system.disabledArmourOverload = overload;
  const overloadSpdMod = overload?.spdMod || 0;
  // Перевес ОБЩЕГО инвентаря (стр. 27, wdbc-2l3x) — независимый источник от
  // перевеса выключенной силовой брони выше (может действовать одновременно,
  // не смешиваются): «носит больше Ношения, но меньше Подъёма» → SPD −1 и
  // −10 на движения/атаки (штраф теста подключён в combat/defense.mjs и
  // sheets/actor-sheet.mjs, не здесь — тут только вклад в SPD).
  const inventoryOverload = inventoryOverloadTier(actor);
  system.inventoryOverload = inventoryOverload;
  const inventoryOverloadSpdMod = inventoryOverload?.spdMod || 0;
  // Свойство оружия Piercing (wdbc-plsf): снаряд в ране торса/ноги — плоский
  // −1 SPD, пока не извлечён (не складывается за несколько таких ран —
  // книга не описывает накопление, см. combat/damage.mjs, где рана ставится).
  const pw = system.piercingWounds || {};
  const piercingSpdMod = (pw.body || pw.leftLeg || pw.rightLeg) ? -1 : 0;
  if (traitSpeedMod || spdBonus || overloadSpdMod || inventoryOverloadSpdMod || piercingSpdMod) {
    spd = Math.max(0.5, spd + traitSpeedMod + spdBonus + overloadSpdMod + inventoryOverloadSpdMod + piercingSpdMod);
    halfMove = spd;  move = spd * 2;  charge = spd * 3;  run = spd * 6;
  }

  // Пружинящая стойка: SPD −2 для движения
  if (stance === "springing") {
    const spdMod = Math.max(0.5, spd - 2);
    halfMove = spdMod;
    move     = spdMod * 2;
    charge   = spdMod * 3;
    run      = spdMod * 6;
  }

  // Повален (стр. 30-31, wdbc-r5o7.2): SPD вдвое — применяется к уже
  // посчитанным halfMove/move/charge/run (после Стойки и прочих модов
  // выше, а не к сырому spd — итог тот же за счёт линейности, но так
  // работает независимо от того, что ещё поменяло эти четыре числа).
  // «Нельзя Бег и Натиск» — отдельный запрет в combat/movement-actions.mjs
  // (declareCharge/declareRun), не про число.
  if (system.conditions?.prone) {
    halfMove = Math.max(0.5, halfMove / 2);
    move     = Math.max(0.5, move / 2);
    charge   = Math.max(0.5, charge / 2);
    run      = Math.max(0.5, run / 2);
  }

  // Потеря стоп/ног (стр. 30-31, wdbc-r5o7.5): «SPD уменьшена вдвое (окр.
  // вниз)» — в отличие от Поваленного (обычное ÷2, минимум 0.5), здесь
  // явное книжное округление вниз, поэтому Math.floor, не Math.max(0.5,…);
  // одна потерянная стопа/нога уже даёт полный штраф — книга не говорит
  // «за каждую», считаем булево (есть хоть одна — эффект применён), не по
  // счётчику count. Без ОБЕИХ ног — «не может ходить» вообще, это сильнее
  // деления и обнуляет Движение целиком (см. lostLegsCount ниже);
  // Уклонение при потере ног — отдельно, combat/defense.mjs.
  const lostFeetOrLeg = !!(system.conditions?.lostFeet || system.conditions?.lostLegs);
  const bothLegsLost  = (Number(system.conditions?.lostLegsCount) || 0) >= 2;
  if (bothLegsLost) {
    halfMove = 0; move = 0; charge = 0; run = 0;
  } else if (lostFeetOrLeg) {
    halfMove = Math.floor(halfMove / 2);
    move     = Math.floor(move / 2);
    charge   = Math.floor(charge / 2);
    run      = Math.floor(run / 2);
  }

  system.movement.halfMove = halfMove;
  system.movement.move     = move;
  system.movement.charge   = charge;
  system.movement.run      = run;
  // Откуда число (wdbc-zbiz): те же слагаемые, что складываются выше —
  // Черты/импланты, Конструктор (kind:"movement"), Перевес брони, Piercing,
  // Пружинящая Стойка. Полушаг = SPD×1, поэтому его breakdown суммируется в
  // halfMove без остатка (Полное/Натиск/Бег — те же слагаемые, ×2/3/6).
  const spdBreakdown = [{ label: "База", value: spdBase, note: "Ag.b + Размер" }];
  if (traitSpeedMod)           spdBreakdown.push({ label: "Черты/импланты",              value: traitSpeedMod });
  if (spdBonus)                spdBreakdown.push({ label: "Механика (Конструктор)",      value: spdBonus });
  if (overloadSpdMod)          spdBreakdown.push({ label: "Перевес выключенной брони",   value: overloadSpdMod });
  if (inventoryOverloadSpdMod) spdBreakdown.push({ label: "Перевес инвентаря",           value: inventoryOverloadSpdMod });
  if (piercingSpdMod)          spdBreakdown.push({ label: "Piercing (снаряд в ране)",     value: piercingSpdMod });
  if (stance === "springing")  spdBreakdown.push({ label: "Пружинящая Стойка",           value: -2 });
  // Минимум SPD — 0.5 (стр. 28): сумма слагаемых может уйти в минус, порог
  // это ловит раньше breakdown. Повален не складывается, а делит пополам —
  // считаем ожидаемое ДО сравнения с halfMove, иначе halfMove≠sum срабатывал
  // бы всегда при Поваленном, даже без реального клампа по минимуму.
  const spdRawSum = spdBreakdown.reduce((s, b) => s + b.value, 0);
  let expectedHalfMove = spdRawSum;
  if (system.conditions?.prone) {
    spdBreakdown.push({ label: "Повален", value: null, halved: true });
    expectedHalfMove /= 2;
  }
  if (bothLegsLost) {
    spdBreakdown.push({ label: "Потеря обеих ног", value: null, immobile: true });
    expectedHalfMove = 0;
  } else if (lostFeetOrLeg) {
    spdBreakdown.push({ label: "Потеря стопы/ноги", value: null, halvedFloor: true });
    expectedHalfMove = Math.floor(expectedHalfMove / 2);
  }
  if (expectedHalfMove !== halfMove) spdBreakdown.push({ label: "Минимум SPD", value: null, floor: 0.5 });
  system.movement.spdBreakdown = spdBreakdown;

}
