// module/rules/vehicle.mjs
// ════════════════════════════════════════════════════════════════════════════
//  АГРЕГАЦИЯ ТЕХНИКИ — эффективная SPD (с учётом повреждений Ходовой),
//  дистанции хода, суммарный модификатор Маневрирования (Ходовая +
//  повреждения), состояние (полуразрушена при Структуре ≤ 0). Вызывается из
//  documents/actor.mjs (_prepareVehicleData) — вынесена из монолита
//  prepareDerivedData (wdbc-yo4n).
//
//  Движение здесь СВОЁ, не через rules/movement.mjs: у Техники другая таблица
//  множителей (по типу шасси, Open Topped/Громоздкая/Быстрая и т.п.), не общая
//  SPD×1/2/3/6 Персонажа/Орды.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Производные данные Техники. Мутирует system.derived и system.openTopped.
 *
 * @param {object[]} items  предметы актора (this.items)
 * @param {object}   system system актора (мутируется)
 */
export function prepareVehicleDerived(items, system) {
  const ch      = system.chassis || (system.chassis = {});
  const type    = ch.type || "tracked";

  // ── Агрегация авто-эффектов Черт техники (Item type=vehicleTrait) ──
  // vehicleTrait не входит в MIGRATE_EFFECT_TYPES (migrations/item-effects.mjs)
  // и не будет: это отдельная, самостоятельная система бонусов техники, не
  // легаси-счётчик, ожидающий переноса в ActiveEffect — задокументированное
  // исключение (wdbc-ng6c, B5).
  const tf = {
    openTopped: false, openToppedRating: 0, manoeuvreMod: 0, spdMod: 0, spdDamageReduce: 0, noMove: false,
    swerveDisabled: false, fullMoveSpdMult: 0, smallMoveOnly: false, ignoreDifficultTerrain: false,
    critHalved: false, trackHitsToHull: false, siege: false, reloadRapid: false,
    commandBonus: 0, repairBonus: 0,
    deflector: 0, deflectorDaemonic: false, ignoreCrewCrits: false,
    autonomous: false, autonomousBS: 0, autonomousOperate: 0, autonomousAwareness: 0,
    flickerfield: false,
    amphibious: false, ceramitePlating: false, sidecarStructure: 0, voidShieldCount: 0,
    volatile: false, fallBreaks: false, orbitalDeployment: false,
    onslaught: false, multiTargeter: false, advancedTargeting: false, advancedControls: false,
    sideHatches: false, assaultRamp: false, enclosed: false, sealed: false,
    daemonicAbsorb: 0
  };
  for (const it of items) {
    if (it.type !== "vehicleTrait") continue;
    const e = it.system.effects || {};
    if (e.openTopped) {
      tf.openTopped = true;
      // Открытая(X): рейтинг 0/½/1 — степень укрытия экипажа (wdbc-y33b,
      // vehicleCoverMod ниже). Максимум, если несколько предметов Черты.
      tf.openToppedRating = Math.max(tf.openToppedRating, Number(it.system.rating) || 0);
    }
    if (e.noMove)                 tf.noMove = true;
    if (e.swerveDisabled)         tf.swerveDisabled = true;
    if (e.smallMoveOnly)          tf.smallMoveOnly = true;
    if (e.ignoreDifficultTerrain) tf.ignoreDifficultTerrain = true;
    if (e.critHalved)             tf.critHalved = true;
    if (e.trackHitsToHull)        tf.trackHitsToHull = true;
    if (e.siege)                  tf.siege = true;
    if (e.reloadRapid)            tf.reloadRapid = true;
    if (e.ignoreCrewCrits)        tf.ignoreCrewCrits = true;
    if (e.flickerfield)           tf.flickerfield = true;
    if (e.amphibious)             tf.amphibious = true;
    if (e.ceramitePlating)        tf.ceramitePlating = true;
    if (e.volatile)               tf.volatile = true;
    if (e.fallBreaks)             tf.fallBreaks = true;
    if (e.orbitalDeployment)      tf.orbitalDeployment = true;
    if (e.onslaught)              tf.onslaught = true;
    if (e.multiTargeter)          tf.multiTargeter = true;
    if (e.advancedTargeting)      tf.advancedTargeting = true;
    if (e.advancedControls)       tf.advancedControls = true;
    if (e.sideHatches)            tf.sideHatches = true;
    if (e.assaultRamp)            tf.assaultRamp = true;
    if (e.enclosed)               tf.enclosed = true;
    if (e.sealed)                 tf.sealed = true;
    // Демонический (X): +X к поглощению — берём максимум, если несколько.
    if (e.daemonicAbsorb) tf.daemonicAbsorb = Math.max(tf.daemonicAbsorb, Number(it.system.rating) || 0);
    // Щит-дефлектор 1-X: X = рейтинг черты (берём максимальный).
    if (e.deflectorShield) {
      const x = Number(it.system.rating) || 0;
      if (x > tf.deflector) { tf.deflector = x; tf.deflectorDaemonic = !!e.deflectorDaemonic; }
    }
    // Автопилот: рейтинги = Operate(X)/BS(Y)/Awareness(Z) — заменяет экипаж.
    if (e.autonomous) {
      tf.autonomous = true;
      tf.autonomousOperate   = Math.max(tf.autonomousOperate,   Number(it.system.rating)  || 0);
      tf.autonomousBS        = Math.max(tf.autonomousBS,        Number(it.system.rating2) || 0);
      tf.autonomousAwareness = Math.max(tf.autonomousAwareness, Number(it.system.rating3) || 0);
    }
    tf.manoeuvreMod    += Number(e.manoeuvreMod)    || 0;
    tf.spdMod          += Number(e.spdMod)          || 0;
    // Многоногая (X) и подобные — флаг + X = рейтинг Черты (тот же приём, что
    // deflectorShield/autonomous выше): значение X разное у каждого шагохода,
    // общий шаблон пака не может нести готовое число (wdbc-07a6).
    if (e.spdDamageReduce) tf.spdDamageReduce += Number(it.system.rating) || 0;
    // Коляска (X): +X Структуры байку (стр. 478).
    if (e.sidecarStructure) tf.sidecarStructure += Number(it.system.rating) || 0;
    // Пустотные Щиты (X): X = число отдельных щитов.
    if (e.voidShields) tf.voidShieldCount += Number(it.system.rating) || 0;
    tf.commandBonus    += Number(e.commandBonus)    || 0;
    tf.repairBonus     += Number(e.repairBonus)     || 0;
    const fm = Number(e.fullMoveSpdMult) || 0;
    if (fm > tf.fullMoveSpdMult) tf.fullMoveSpdMult = fm;
  }
  // Open Topped теперь задаётся Чертой (ручной чекбокс убран из Обзора).
  system.openTopped = tf.openTopped;
  // Коляска (X): +X Структуры прибавляется к базовому максимуму байка (тот же
  // приём, что у openTopped выше — не персистится, пересчитывается заново
  // каждый раз из авторского значения).
  if (tf.sidecarStructure && system.structure) {
    system.structure.max = (Number(system.structure.max) || 0) + tf.sidecarStructure;
  }
  // Пустотные Щиты (X): рабочий массив на этот проход подгоняется под X —
  // новые щиты (Черта появилась/рейтинг вырос) начинают полными (20). Это
  // мутация ТОЛЬКО рабочей копии (тот же приём, что у openTopped/structure.max
  // выше) — сохранённый в БД документ не трогается, пока не придёт явный
  // actor.update(); если рейтинг временно упал, старые значения щитов сверх X
  // просто не читаются этим проходом, а не стираются из хранилища.
  const rawShields = Array.isArray(system.voidShields) ? system.voidShields : [];
  const shields = [];
  for (let i = 0; i < tf.voidShieldCount; i++) {
    const v = rawShields[i];
    shields.push(typeof v === "number" ? Math.max(0, Math.min(20, v)) : 20);
  }
  system.voidShields = shields;

  const baseSpd = Number(ch.spd) || 0;
  // Многоногая (X) снижает урон Ходовой к SPD.
  const spdDmg  = Math.max(0, (Number(ch.spdDamage) || 0) - tf.spdDamageReduce);
  let effSpd    = Math.max(0, baseSpd + tf.spdMod - spdDmg);
  if (tf.noMove) effSpd = 0;   // Неподвижная

  const CHASSIS_BONUS = { wheeled: 10, tracked: 0, walker: 0, skimmer: 10, plane: 0 };
  const manoeuvreDmg  = Math.max(0, Number(ch.manoeuvreDamage) || 0);
  const manoeuvreMod  = (Number(system.manoeuvrability) || 0)
                      + (CHASSIS_BONUS[type] || 0)
                      - manoeuvreDmg + tf.manoeuvreMod;

  // Шагоход: Бег = 4×SPD, прочие манёвры машины — до SPD×2 (Большой/Полный Ход).
  const runMult = type === "walker" ? 4 : 6;
  // Полный Ход: Быстрая = ×3 SPD; Громоздкая — только Малый Ход.
  const fullMult = tf.fullMoveSpdMult > 0 ? tf.fullMoveSpdMult : 2;
  const fullMove = tf.smallMoveOnly ? effSpd : effSpd * fullMult;

  const strMod  = Number(ch.strength) || 0;
  const unS     = Number(ch.unnaturalS) || 0;
  const sBonus  = Math.floor((strMod + unS) / 10);   // S.b шагохода

  const structVal = Number(system.structure?.value) || 0;
  const structMax = Number(system.structure?.max) || 0;

  system.derived = {
    chassisType:  type,
    effSpd,
    spdDamaged:   spdDmg > 0,
    movement: {
      smallMove: effSpd,        // Малый Ход / Хаотичное / Погрузка (SPD×1)
      fullMove,                 // Большой / Полный Ход / Таран
      run:       effSpd * runMult
    },
    manoeuvreMod,
    swerveMod:    -(Number(system.size) || 0) * 10 + (type === "tracked" ? -10 : 0),
    swerveDisabled: tf.swerveDisabled || tf.noMove,
    walker:       type === "walker",
    skimmer:      type === "skimmer",
    plane:        type === "plane",
    strengthBonus: sBonus,
    liftKg:       sBonus * 2,   // расчётная база подъёма (S.b×2)
    halfWrecked:  structMax > 0 && structVal <= 0,
    deflector:    tf.deflector,
    deflectorDaemonic: tf.deflectorDaemonic,
    ignoreCrewCrits:   tf.ignoreCrewCrits,
    autonomous:        tf.autonomous,
    autonomousBS:      tf.autonomousBS,
    autonomousOperate: tf.autonomousOperate,
    autonomousAwareness: tf.autonomousAwareness,
    flickerfield:      tf.flickerfield,
    traitFlags:   tf
  };
}

// ── Укрытие экипажа/пассажиров техники (wdbc-y33b) ─────────────────────────

/**
 * В какой технике сидит этот актор — экипаж/пассажир на station, а не
 * всадник (та связь — rules/mount.mjs, ссылку хранит всадник). Реверс к
 * прямому station.find (vehicle-sheet.mjs/combat/vehicle.mjs): там ищут
 * место по id, здесь — технику по uuid сидящего.
 * @param {string} actorUuid
 * @param {object[]} actors  весь список акторов мира (game.actors)
 * @returns {?{vehicle:object, station:object}}
 */
export function stationOf(actorUuid, actors = []) {
  if (!actorUuid) return null;
  for (const a of actors) {
    if (a?.type !== "vehicle") continue;
    const station = (a.system?.stations || []).find(s => s?.uuid === actorUuid);
    if (station) return { vehicle: a, station };
  }
  return null;
}

/**
 * Укрытие экипажа/пассажира ВНУТРИ техники — штраф к порогу атакующего
 * (тот же смысл, что coverBonusForShot от местности, combat/cover.mjs).
 * Закрытая — полное укрытие всегда (АР стороны машины). Открытая(X) — по
 * рейтингу: 0 — нет, ½ — приближение к половине АР (книжное «укрытие в
 * торс/ноги» зависит от места попадания, которое на момент диалога атаки ещё
 * не известно — упрощение), 1 — полное (книжное исключение «кроме Раунда,
 * когда сами атакуют из машины» не проверяется, оно требует знать, стрелял
 * ли ЭТОТ персонаж в этом же Раунде). Герметичная укрытия не даёт вовсе —
 * она про газы/жидкости, не про боевую защиту (см. описание Черты).
 * @param {object} targetActor
 * @param {object[]} actors  весь список акторов мира (game.actors)
 * @param {string} [side]  сторона брони — по умолчанию Бортовая, тот же
 *   дефолт, что у side в combat/vehicle.mjs::applyDamageToVehicle
 * @returns {number} 0 или отрицательное число
 */
export function vehicleCoverMod(targetActor, actors = [], side = "side") {
  const hit = stationOf(targetActor?.uuid, actors);
  if (!hit) return 0;
  const tf = hit.vehicle.system?.derived?.traitFlags || {};
  const ap = Number(hit.vehicle.system?.armour?.[side]) || 0;
  if (!ap) return 0;
  if (tf.enclosed) return -ap;
  if (tf.openTopped) {
    if (tf.openToppedRating >= 1) return -ap;
    if (tf.openToppedRating > 0) return -Math.ceil(ap / 2);
  }
  return 0;
}
