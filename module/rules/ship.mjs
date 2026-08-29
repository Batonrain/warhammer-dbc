// module/rules/ship.mjs
// ════════════════════════════════════════════════════════════════════════════
//  АГРЕГАЦИЯ КОРАБЛЯ — бюджеты Энергии/Пространства/Очков и эфф. характеристики.
//  Узлы — вложенные Предметы типа "component"; Корпус — отдельный тип
//  "shipHull" (задаёт SPC/P.Gen/HI/характеристики/поворот/WC), выбирается
//  пикером в шапке листа (sheets/hull-picker.mjs), а не узлом среди прочих —
//  на корабле он всегда один (apps/ship-hull.mjs). Вызывается из
//  documents/actor.mjs (_prepareShipData) — сам вынесенный из монолита
//  prepareDerivedData (wdbc-yo4n).
// ════════════════════════════════════════════════════════════════════════════

import { shipQualityMods, clampQuality } from "../constants/ship-quality.mjs";
import { parseWeaponCapacity, SHIP_WEAPON_ARCS, WC_ORDER } from "../constants/ship.mjs";
import { SHIP_PROPERTIES } from "../constants/ship-properties.mjs";
import { crossedThresholds, DAEMON_SHIP_DP, SHIP_DEFILEMENT_THRESHOLDS } from "../constants/ship-corruption.mjs";

/**
 * Производные данные корабля. Мутирует system.derived, а также
 * system.qualityMods узлов/Корпуса (нужны листу узла/Корпуса для отображения).
 *
 * @param {object[]} items  предметы актора (this.items)
 * @param {object}   system system актора (мутируется)
 */
export function prepareShipDerived(items, system) {
  const comps = items.filter(i => i.type === "component");
  const hullItem = items.find(i => i.type === "shipHull") || null;
  let powerUsed = 0, powerExtra = 0, spaceUsed = 0, spSpent = 0;
  let moraleMaxBonus = 0, crewMaxBonus = 0, shipAimer = 0;
  let lcBonus = 0, pcBonus = 0;
  // Агрегаты свойств: модификаторы потерь экипажа, обороны, ремонта, DP, скрытности.
  let cmLossMod = 0, cpLossMod = 0, boardingDef = 0, repairHiBonus = 0;
  let dpReduce = 0, dpFloor = 0, dpExtra = 0, silentRun = 0, augurVs = 0;
  let suppliesMax = 0;
  const mods = { speed: 0, manoeuvrability: 0, detection: 0, voidShields: 0, armour: 0, turretRating: 0, hullIntegrity: 0 };

  // Применение авто-свойств узла (Aspects) к производным значениям корабля.
  const applyAuto = (props, isWeapon) => {
    for (const p of (Array.isArray(props) ? props : [])) {
      const a = SHIP_PROPERTIES[p.key]?.auto;
      if (!a) continue;
      const r = Number(p.rating) || 0;
      if (a.charKey && mods[a.charKey] !== undefined) mods[a.charKey] += (a.per || 0) * r;
      if (a.powerGenPer) powerExtra      += a.powerGenPer * r;
      if (a.hiPer)       mods.hullIntegrity += a.hiPer * r;
      if (a.moralePer)   moraleMaxBonus  += a.moralePer * r;
      if (a.crewPer)     crewMaxBonus    += a.crewPer * r;
      if (a.aimer && !isWeapon) shipAimer += r; // на не-орудии Aimer — всем орудиям
      if (a.cmLossPer)      cmLossMod     += a.cmLossPer * r;
      if (a.cpLossPer)      cpLossMod     += a.cpLossPer * r;
      if (a.boardingDefPer) boardingDef   += a.boardingDefPer * r;
      if (a.repairHiPer)    repairHiBonus += a.repairHiPer * r;
      if (a.dpReducePer)    dpReduce      += a.dpReducePer * r;
      if (a.dpFloor)        dpFloor        = Math.max(dpFloor, Number(p.rating2) || 0);
      if (a.dpExtraPer)     dpExtra       += a.dpExtraPer * r;
      if (a.silentRunPer)   silentRun     += a.silentRunPer * r;
      if (a.augurVsPer)     augurVs       += a.augurVsPer * (Number(p.rating2) || 0);
      // Запасы путешествия задают максимум месяцев (берём наибольший узел).
      if (a.suppliesMonths) suppliesMax    = Math.max(suppliesMax, r);
    }
  };

  // Корпус — не узел (не в comps): свои SP/качество и авто-свойства считаем отдельно.
  if (hullItem) {
    const hs = hullItem.system;
    const qm = shipQualityMods(hs);
    hs.qualityMods = qm;                                  // для листа Корпуса
    spSpent += (Number(hs.sp) || 0) + qm.sp;
    applyAuto(hs.shipProps, false);
  }

  for (const it of comps) {
    const s = it.system;
    // Качество узла меняет энергию, пространство, цену и профиль орудия.
    const qm = shipQualityMods(s);
    s.qualityMods = qm;                                   // для листа узла
    spSpent += (Number(s.sp) || 0) + qm.sp;
    lcBonus += Number(s.lcBonus) || 0;   // грузоподъёмность от грузовых узлов
    pcBonus += Number(s.pcBonus) || 0;   // пассажировместимость от пассажирских узлов
    // Узел не работает, если помечен damaged ИЛИ его статус не «невредим»
    // (обесточен/повреждён/уничтожен — таблица повреждений).
    const dmg = !!s.damaged || (s.status && s.status !== "intact");
    const p   = clampQuality(s.power, qm.power);  // >0 потребляет, <0 вырабатывает
    if (!dmg) { if (p > 0) powerUsed += p; else powerExtra += -p; }
    // Внешние узлы — снаружи корпуса, пространства не занимают.
    if (!s.external) spaceUsed += clampQuality(s.space, qm.space);
    if (!dmg) {
      if (s.modChar && mods[s.modChar] !== undefined) mods[s.modChar] += Number(s.modValue) || 0;
      applyAuto(s.shipProps, s.kind === "weapon");
    }
  }

  const hb = hullItem?.system.hull  || {};
  const hc = hullItem?.system.chars || {};
  const powerGen = (Number(hb.powerGen) || 0) + powerExtra;
  const spaceMax = Number(hb.spaceMax) || 0;
  // Бюджет Очков Корабля задаётся вручную (поле «Очки Корабля (макс.)» в Записях).
  const spBudget = Number(system.spMax) || 0;
  const cv = (k) => (Number(hc[k]) || 0) + mods[k];

  // ── Грузы и пассажиры ──
  // Базовая LC = полный SPC корабля; узлы добавляют LC. Базовая PC = 1 за каждую
  // полную десятку SPC; пассажирские узлы добавляют PC.
  // LC у груза — объём ОДНОЙ единицы; занятый трюм = объём × количество.
  // Груз для обслуживания корабля (shipSupply) трюм не занимает.
  const cargoItems = items.filter(i => i.type === "cargo");
  let lcUsed = 0, lcSupply = 0, cargoValue = 0, cargoUnits = 0;
  for (const c of cargoItems) {
    const vol = (Number(c.system.lc) || 0) * (Number(c.system.quantity) || 0);
    cargoUnits += Number(c.system.quantity) || 0;
    cargoValue += (Number(c.system.price) || 0) * (Number(c.system.quantity) || 0);
    if (c.system.shipSupply) lcSupply += vol; else lcUsed += vol;
  }
  const lcBase   = spaceMax;
  const lcMax    = lcBase + lcBonus;
  const pcBase   = Math.floor(spaceMax / 10);
  const pcMax    = pcBase + pcBonus;
  const pcAboard = Number(system.passengersAboard) || 0;
  // Каждое занятое БАЗОВОЕ место пассажира даёт Weak Spirit (1): чужаки на
  // борту давят на мораль. Места от пассажирских узлов этого не делают.
  const pcWeakSpirit = Math.min(pcAboard, pcBase);

  // ── Запасы путешествия ──
  // Базово хватает на полгода; свойство Travel Supplies (X) задаёт свой максимум.
  const supMax  = suppliesMax || 6;
  const supNow  = Math.min(Number(system.supplies?.value ?? supMax) || 0, supMax);

  // ── Осквернение (DP) ──
  // ── Орудийная оснащённость (WC): слоты по позициям и их занятость ──
  const wcMax  = parseWeaponCapacity(hb.weaponCapacity || "");
  const wcUsed = { prow: 0, dorsal: 0, port: 0, star: 0, keel: 0 };
  let wcUnassigned = 0;
  for (const it of comps) {
    if (it.system.kind !== "weapon") continue;
    if (it.system.weapon?.wType === "bay") continue;   // ангар — не орудие
    const a = it.system.weapon?.arc;
    if (wcUsed[a] !== undefined) wcUsed[a]++; else wcUnassigned++;
  }
  const wcPositions = WC_ORDER
    .map(k => ({ key: k, label: SHIP_WEAPON_ARCS[k], used: wcUsed[k], max: wcMax[k], over: wcUsed[k] > wcMax[k] }))
    .filter(p => p.max > 0 || p.used > 0);
  const wcOver = wcPositions.some(p => p.over) || (wcUnassigned > 0);

  const dp        = Number(system.defilement) || 0;
  const crossed   = crossedThresholds(dp);
  const isDaemon  = dp >= DAEMON_SHIP_DP;
  // Weak Spirit (5) за каждый пересечённый порог — если экипаж не хаоситы.
  const weakSpiritDp = system.crewIsChaos ? 0 : crossed.length;
  const nextThr   = SHIP_DEFILEMENT_THRESHOLDS.find(t => dp < t.dp);

  system.derived = {
    hasHull:  !!hullItem,
    hullName: hullItem?.name || "",
    power: { generated: powerGen, used: powerUsed, free: powerGen - powerUsed },
    space: { max: spaceMax, used: spaceUsed, free: spaceMax - spaceUsed },
    sp:    { budget: spBudget, spent: spSpent, free: spBudget - spSpent },
    chars: {
      speed: cv("speed"), manoeuvrability: cv("manoeuvrability"), detection: cv("detection"),
      voidShields: system.voidShieldsDown ? 0 : cv("voidShields"),  // эфф. (0 при схлопнутых)
      armour: cv("armour"), turretRating: cv("turretRating")
    },
    voidShieldsBase: cv("voidShields"),
    voidShieldsDown: !!system.voidShieldsDown,
    hullIntegrityMax: (Number(hb.hullIntegrity) || 0) + mods.hullIntegrity,
    // Полуразрушен: Прочность на нуле. Перегруз: не сходится любой из бюджетов.
    crippled:   (Number(system.hullIntegrity?.value) || 0) <= 0,
    overBudget: (powerGen - powerUsed < 0) || (spaceMax - spaceUsed < 0) || (spBudget - spSpent < 0),
    turnArc:        hb.turnArc || "—",
    weaponCapacity: hb.weaponCapacity || "—",
    wc: { positions: wcPositions, over: wcOver, unassigned: wcUnassigned },
    componentCount: comps.length,
    moraleMaxBonus, crewMaxBonus, aimer: shipAimer,
    lc: {
      base: lcBase, bonus: lcBonus, max: lcMax, used: lcUsed, free: lcMax - lcUsed,
      supply: lcSupply, over: lcUsed > lcMax,
      pct: lcMax > 0 ? Math.min(100, Math.round((lcUsed / lcMax) * 100)) : 0,
      value: cargoValue, units: cargoUnits, entries: cargoItems.length
    },
    pc: {
      base: pcBase, bonus: pcBonus, max: pcMax, aboard: pcAboard, free: pcMax - pcAboard,
      over: pcAboard > pcMax, weakSpirit: pcWeakSpirit,
      pct: pcMax > 0 ? Math.min(100, Math.round((pcAboard / pcMax) * 100)) : 0
    },
    supplies: {
      value: supNow, max: supMax, custom: !!suppliesMax,
      pct: supMax > 0 ? Math.min(100, Math.round((supNow / supMax) * 100)) : 0,
      low: supNow <= 1, empty: supNow <= 0
    },
    // Итоговые модификаторы потерь экипажа: DP и пассажиры добавляют Weak Spirit.
    crewMods: {
      cmLoss: cmLossMod + (weakSpiritDp * 5) + pcWeakSpirit,
      cpLoss: cpLossMod, boardingDef, repairHiBonus, silentRun, augurVs
    },
    dpMods: { reduce: dpReduce, floor: dpFloor, extra: dpExtra },
    defilement: {
      value: dp, crossed: crossed.length, levels: crossed.map(t => t.name),
      weakSpirit: weakSpiritDp, isDaemon, nextDp: nextThr?.dp || null
    }
  };
}
