import { IMPROVEMENT_BONUS, SKILL_RANKS } from "../constants/characteristics.mjs";
import { HAEM_STAGES, isHaemonculus } from "../constants/haemonculus.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF }   from "../constants/skills.mjs";
import { _calcMaxCarry }                   from "../helpers/utils.mjs";
import { getArmorModEffects, armorModApForLocation } from "../combat/armor-mods.mjs";
import { shieldArmorByLocation } from "../combat/hand-shield.mjs";
import { qualityEffects } from "../constants/quality.mjs";
import { fieldModeEffects } from "../constants/drukhari-armor-fields.mjs";
import { cloneFieldTier } from "../constants/drukhari-gear.mjs";
import { shipQualityMods, clampQuality } from "../constants/ship-quality.mjs";
import { classifyImplant } from "../constants/body-map.mjs";
import { implantMech, ironModForQuality } from "../constants/implant-mechanics.mjs";
import { readEnvForScene } from "../constants/scene-nexus.mjs";
import { computePathPassives } from "../constants/aeldari-paths.mjs";
import { manifestProfile } from "../constants/possession.mjs";
import { vitalCharMods } from "../constants/vitals.mjs";
import { spFromInfluence, parseWeaponCapacity, SHIP_WEAPON_ARCS, WC_ORDER } from "../constants/ship.mjs";
import { SHIP_PROPERTIES } from "../constants/ship-properties.mjs";
import { crossedThresholds, DAEMON_SHIP_DP, SHIP_DEFILEMENT_THRESHOLDS } from "../constants/ship-corruption.mjs";
import { COHESION_LIMIT, COHESION_START_CAP, RISK_LEVELS,
         cohesionBand, cohesionBonus, riskCap } from "../constants/squad.mjs";
import { TROOP_TYPES, TRAINING_LEVELS, FORMATION_SIZES, ORDERS, ATTRITION,
         totalStrength, defenceFrom, damageDice, effectiveSpeed, totalCover,
         attritionPenalty, availabilityMod } from "../constants/formation.mjs";
import { disabledActorTypes, featureForActorType, isFeatureEnabled,
         featureForRace, isRaceDisabled } from "../constants/features.mjs";
import { HOMEWORLD_BY_KEY } from "../constants/homeworlds.mjs";
import { PA_TABLES } from "../constants/power-armour-lore.mjs";

/**
 * Расчёт движения по таблице Warhammer FFG.
 * SPD = Ag.bonus + size (size — прямой модификатор, 0 = Человек)
 *
 * Таблица:
 * SPD | Полушаг | Шаг | Натиск | Бег
 * 0.5 |   0.5   |  1  |  1.5   |  3
 *  1  |    1    |  2  |   3    |  6
 *  2  |    2    |  4  |   6    | 12
 *  3  |    3    |  6  |   9    | 18
 *  4  |    4    |  8  |  12    | 24
 * ...и т.д. (SPD × 1, ×2, ×3, ×6)
 */
function calcMovement(agBonus, size) {
  // SPD = Ag.bonus + size_mod
  // size — прямой мод: 0=Человек, -1=Ребёнок, 1=Орк-нob, итд
  const spdRaw = agBonus + (size ?? 0);

  // Если SPD <= 0 → особый случай: SPD = 0.5
  const spd = spdRaw <= 0 ? 0.5 : spdRaw;

  return {
    spd,
    halfMove: spd,        // SPD × 1
    move:     spd * 2,    // SPD × 2
    charge:   spd * 3,    // SPD × 3
    run:      spd * 6     // SPD × 6
  };
}

// Метки боевого Размера Орды по Магнитуде (Размер в расчётах атак/Stealth).
const HORDE_SIZE_LABELS = {
  2: "небольшая толпа / стая",
  3: "толпа / отряд / выводок",
  4: "фаланга / орда",
  5: "массированное наступление",
  6: "огромная волна"
};

export class WarhammerActor extends Actor {
  prepareData() { super.prepareData(); }

  /**
   * Окно создания актора: типы выключенных подсистем в списке не показываем.
   * Настройка читается на лету, поэтому перезагрузка мира не нужна.
   */
  static async createDialog(data = {}, createOptions = {}, options = {}) {
    if (!options.types) {
      const off = disabledActorTypes();
      if (off.length) {
        const types = this.TYPES.filter(t => t !== "base" && !off.includes(t));
        if (types.length) options = { ...options, types };
      }
    }
    return super.createDialog(data, createOptions, options);
  }

  /** Создать актора выключенной подсистемы нельзя — с указанием, что включить. */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;

    const feature = featureForActorType(this.type);
    if (feature && !isFeatureEnabled(feature.key)) {
      ui.notifications?.warn(
        `Подсистема «${feature.name}» выключена. Включите её в Настройках Игры → Warhammer DBC, ` +
        `чтобы создавать акторов типа «${this.type}».`);
      return false;
    }
  }

  /**
   * Симметрично _preCreate, но для расы (не отдельный тип актора, а
   * значение system.race) — жёсткий бэкстоп поверх фильтра дропдауна в
   * шапке/Мастере: даже если запрос дошёл в обход UI (макрос, чужой
   * инструмент), выключенную расу выставить нельзя. Уже стоящую расу не
   * трогаем (не ломаем существующих персонажей) — блокируем только СМЕНУ на
   * выключенную.
   */
  async _preUpdate(data, options, user) {
    const allowed = await super._preUpdate(data, options, user);
    if (allowed === false) return false;

    const newRace = data.system?.race;
    if (newRace && newRace !== this.system.race && isRaceDisabled(newRace)) {
      const feature = featureForRace(newRace);
      ui.notifications?.warn(
        `Подсистема «${feature.name}» выключена. Включите её в Настройках Игры → Warhammer DBC, ` +
        `чтобы выбрать эту расу.`);
      return false;
    }
  }

  /**
   * Производные данные корабля: бюджеты Энергии/Пространства/Очков и эфф.
   * характеристики. Узлы — это вложенные Предметы типа "component"; корпус —
   * узел с kind="hull" (задаёт SPC/P.Gen/HI/характеристики/поворот/WC).
   */
  _prepareShipData(system) {
    const comps = this.items.filter(i => i.type === "component");
    let powerUsed = 0, powerExtra = 0, spaceUsed = 0, spSpent = 0;
    let moraleMaxBonus = 0, crewMaxBonus = 0, shipAimer = 0;
    let lcBonus = 0, pcBonus = 0;
    // Агрегаты свойств: модификаторы потерь экипажа, обороны, ремонта, DP, скрытности.
    let cmLossMod = 0, cpLossMod = 0, boardingDef = 0, repairHiBonus = 0;
    let dpReduce = 0, dpFloor = 0, dpExtra = 0, silentRun = 0, augurVs = 0;
    let suppliesMax = 0;
    const mods = { speed: 0, manoeuvrability: 0, detection: 0, voidShields: 0, armour: 0, turretRating: 0, hullIntegrity: 0 };
    let hullItem = null;

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

    for (const it of comps) {
      const s = it.system;
      // Качество узла меняет энергию, пространство, цену и профиль орудия.
      const qm = shipQualityMods(s);
      s.qualityMods = qm;                                   // для листа узла
      spSpent += (Number(s.sp) || 0) + qm.sp;
      lcBonus += Number(s.lcBonus) || 0;   // грузоподъёмность от грузовых узлов
      pcBonus += Number(s.pcBonus) || 0;   // пассажировместимость от пассажирских узлов
      if (s.kind === "hull") { hullItem = it; applyAuto(s.shipProps, false); continue; }
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
    const cargoItems = this.items.filter(i => i.type === "cargo");
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

  /** Сводка звёздной системы: подсчёт тел по типам и ресурсам. */
  _prepareStarSystemData(system) {
    const bodies = this.items.filter(i => i.type === "celestialBody");
    const counts = {};
    const RES_KEYS = ["ore", "promethium", "adamantium", "phlogiston", "organics",
      "plasteel", "weapons", "tech", "provisions", "manpower", "archeotech", "xenotech", "heretek"];
    const res = {}; for (const k of RES_KEYS) res[k] = 0;
    let habitable = 0, stars = 0;
    for (const b of bodies) {
      const t = b.system.bodyType || "other";
      counts[t] = (counts[t] || 0) + 1;
      if (t === "star") stars++;
      const r = b.system.resources || {};
      // Учитываем бонусы от улучшений колонии.
      const bonus = {};
      for (const imp of (b.system.improvements || [])) for (const k in (imp.res || {})) bonus[k] = (bonus[k] || 0) + Number(imp.res[k] || 0);
      for (const k of RES_KEYS) res[k] += (Number(r[k]) || 0) + (Number(bonus[k]) || 0);
      const h = b.system.habitability;
      if (h && h !== "inhospitable") habitable++;
    }
    system.derived = { total: bodies.length, counts, stars, habitable, resources: res };
  }

  /**
   * Производные данные Отряда: Слаженность (зажатая в ±40) и её толкование,
   * потолок Успехов по уровню Риска, признак Сломленного Отряда.
   *
   * Здесь — только чистая арифметика по собственным данным отряда. Всё, что
   * требует чтения связанных акторов (Командир, участники), считается в листе:
   * прочитать чужой документ в prepareDerivedData на этапе загрузки мира нельзя.
   */
  _prepareSquadData(system) {
    const coh = system.cohesion || (system.cohesion = { base: 0, start: 0, value: 0 });
    const clamp = (v, lim) => Math.max(-lim, Math.min(lim, Math.round(Number(v) || 0)));

    coh.base  = clamp(coh.base,  COHESION_START_CAP);
    coh.start = clamp(coh.start, COHESION_START_CAP);
    coh.value = clamp(coh.value, COHESION_LIMIT);

    const value = coh.value;
    const band  = cohesionBand(value);
    const risk  = Math.max(1, Math.min(5, Number(system.risk) || 1));
    system.risk = risk;

    system.derived = {
      cohesion:        value,
      cohesionCmd:     cohesionBonus(value, false),   // модификатор Команд Командира/Лидера
      cohesionCoord:   cohesionBonus(value, true),    // модификатор Команд Координатора
      cohesionBand:    band.key,
      cohesionLabel:   band.label,
      cohesionHint:    band.hint,
      // Шкала −40…+40 в процентах (для полосы состояния).
      cohesionPct:     Math.round((value + COHESION_LIMIT) / (COHESION_LIMIT * 2) * 100),
      belowStart:      value < coh.start,             // условие Детальной Команды «Сплочение»
      broken:          value < 0,                     // отряд может проходить тесты Сломленного Отряда
      risk,
      riskCap:         riskCap(risk),
      riskLabel:       RISK_LEVELS.find(r => r.level === risk)?.label || "",
      memberCount:     Array.isArray(system.members) ? system.members.length : 0
    };
  }

  /**
   * Производные данные Формирования («Книга Битв»): итоговая Сила, Оборона,
   * кости урона, скорость по ландшафту, укрытие, истощение и пороги боевого духа.
   *
   * Инициатива формирования — 1к10 + бонус характеристики войск (Выучка/10),
   * поэтому пишем её в system.initiative: боевой трекер системы считает
   * «1d10 + @initiative + @initiativeMod» и работает без отдельной логики.
   */
  _prepareFormationData(system) {
    const troop = TROOP_TYPES[system.troopType] || {};
    const train = TRAINING_LEVELS[system.training] || {};
    const size  = FORMATION_SIZES[system.size] || {};

    const s   = totalStrength(system);
    const def = defenceFrom(s);

    // Ситуативные модификаторы костей урона от текущего приказа и состояния.
    const st = system.status || (system.status = {});
    let diceMod = 0;
    if (system.order?.key === "advance") diceMod -= 1;   // марш: на кость меньше
    if (st.exhausted) diceMod -= 3;                      // после форсированного марша
    const dice = damageDice(system.size, diceMod);

    // Скорость: ландшафт × множитель приказа.
    const orderFx   = ORDERS[system.order?.key]?.effect || {};
    const speedMult = orderFx.speedMult ?? 1;
    const spd = effectiveSpeed({
      troopType: system.troopType, terrain: system.terrain,
      speedMult, speedOverride: system.speedOverride
    });

    const cover = totalCover({
      terrain: system.terrain, dugIn: system.cover?.dugIn,
      aaCover: system.cover?.aa, coverMod: system.cover?.mod
    });

    // Численность и боевой дух.
    const num     = system.numbers || (system.numbers = { value: 0, max: 0 });
    const mor     = system.morale  || (system.morale  = { value: 0, max: 0, gearRoll: 0 });
    const numMax  = Math.max(0, Number(num.max) || 0);
    const numVal  = Math.max(0, Number(num.value) || 0);
    // Предел боевого духа: подготовка + разовый бросок за качество снаряжения.
    const morMax  = Math.max(0, (Number(mor.max) || 0));
    const morVal  = Math.max(0, Number(mor.value) || 0);

    // Титаны не имеют боевого духа и все его тесты проходят автоматически.
    const fearless = !!troop.fearless;

    const numLost = Math.max(0, numMax - numVal);
    const morLost = Math.max(0, morMax - morVal);
    const penalty = fearless ? 0 : attritionPenalty(morMax, morVal);

    const halfMorale    = Math.floor(morMax * ATTRITION.thresholds[0]);
    const quarterMorale = Math.floor(morMax * ATTRITION.thresholds[1]);

    // Инициатива: бонус характеристики войск = Выучка / 10.
    const skill = Number(train.skill) || 0;
    system.initiative = Math.floor(skill / 10);

    system.derived = {
      // Боевые показатели
      strength: s,
      defence:  def,
      dice,
      diceMod,
      damageFormula: dice > 0 ? `${dice}d10 + ${s}` : `${s}`,
      speed: spd,
      baseSpeed: troop.spd ?? 0,
      range: troop.rng ?? null,
      rangeLabel: troop.rng == null ? "С" : `${troop.rng} км`,
      rangeNote: troop.rngNote || "",
      cover,
      rating: troop.r ?? 0,
      category: troop.cat || "",
      isAir: troop.cat === "air",
      isAA:  troop.cat === "aa",
      isArmour: troop.cat === "armour" || troop.cat === "mech",
      aaRadius: troop.aaRadius ?? 0,
      aaGrant:  troop.aaCover ?? 0,
      fearless,

      // Тесты формирования (когда командует не герой, а его офицеры)
      skillValue: skill,
      testValue:  skill + penalty + (Number(st.disorder) || 0),
      moraleBase: Number(train.morale) || 0,

      // Истощение
      numbersLost: numLost,
      numbersPct:  numMax > 0 ? Math.round(numVal / numMax * 100) : 0,
      moraleLost:  morLost,
      moralePct:   morMax > 0 ? Math.round(morVal / morMax * 100) : 0,
      penalty,
      halfMorale, quarterMorale,
      atHalf:    !fearless && morMax > 0 && morVal <= halfMorale,
      atQuarter: !fearless && morMax > 0 && morVal <= quarterMorale,
      broken:    numMax > 0 && numVal <= 0,
      routed:    !fearless && morMax > 0 && morVal <= 0,

      // Организация
      sizeLabel:    size.label || "",
      sizeHeadcount: size.headcount || "",
      isFormation:  size.formation !== false,
      availability: availabilityMod(system.techLevel, system.training),
      attachedCount: Array.isArray(system.attached) ? system.attached.length : 0
    };
  }

  /**
   * Производные данные Орды: Характеристики (total/bonus), Размер и боевые
   * показатели по текущей Магнитуде, движение, состояние (Ослаблена/Сломлена).
   */
  _prepareHordeData(system) {
    // Характеристики: total = база + продвижение; бонус = ⌊total/10⌋.
    for (const char of Object.values(system.characteristics || {})) {
      char.total = (Number(char.base) || 0) + (Number(char.advance) || 0);
      char.bonus = Math.floor(char.total / 10);
    }
    const mag   = system.magnitude || (system.magnitude = { value: 0, start: 0 });
    const value = Math.max(0, Number(mag.value) || 0);
    const start = Math.max(0, Number(mag.start) || 0);

    // Боевой Размер по Магнитуде (не влияет на SPD).
    const magSize = value >= 120 ? 6 : value >= 90 ? 5 : value >= 60 ? 4
                  : value >= 30 ? 3 : value >= 10 ? 2 : 1;
    // Бонус к урону от Магнитуды.
    const magDamageDice = value >= 20 ? 2 : value >= 10 ? 1 : 0;

    // Движение: SPD = Ag.bonus + собственный размер существа (не Размер Орды).
    const agB = system.characteristics?.ag?.bonus ?? 0;
    system.movement = calcMovement(agB, Number(system.sizeMod) || 0);

    // Боевые показатели Орды.
    const meleeTargets = Math.max(1, Math.floor(value / 5));
    const enemiesMelee = Math.max(0, Number(system.enemiesInMelee) || 0);
    const rangedShots  = Math.max(0, Math.floor(value / 10) - Math.floor(enemiesMelee / 2));

    // Состояние по доле от стартовой Магнитуды.
    const pct = start > 0 ? value / start : 1;
    const immune = !!system.immuneFear;
    let state = "steady";                       // боеспособна
    if (!immune && pct <= 0.25) state = "broken";        // Сломлена (рассыпается)
    else if (pct <= 0.50) state = "weakened";            // Ослаблена (−10 W)

    system.derived = {
      magSize,
      magSizeLabel: HORDE_SIZE_LABELS[magSize] || "",
      magDamageDice,
      magDamageStr: magDamageDice ? `+${magDamageDice}d10` : "—",
      meleeTargets,
      rangedShots,
      psychTestBonus: value,                    // бонус к тестам Страха/Запугивания/Подавления = Магнитуда
      pct: Math.round(pct * 100),
      state,
      immune,
      lost: Math.max(0, start - value),
      psychDamage: Math.max(0, Number(system.psychDamage) || 0),
      halfThreshold: Math.floor(start * 0.5),
      quarterThreshold: Math.floor(start * 0.25),
      massDamageThreshold: Math.ceil(start * 0.25)   // 25%+ за раунд → тест W+Магнитуда
    };
  }

  /**
   * Производные данные Техники: эффективная SPD (с учётом повреждений Ходовой),
   * дистанции хода, суммарный модификатор Маневрирования (Ходовая + повреждения),
   * состояние (полуразрушена при Структуре ≤ 0).
   */
  _prepareVehicleData(system) {
    const ch      = system.chassis || (system.chassis = {});
    const type    = ch.type || "tracked";

    // ── Агрегация авто-эффектов Черт техники (Item type=vehicleTrait) ──
    const tf = {
      openTopped: false, manoeuvreMod: 0, spdMod: 0, spdDamageReduce: 0, noMove: false,
      swerveDisabled: false, fullMoveSpdMult: 0, smallMoveOnly: false, ignoreDifficultTerrain: false,
      critHalved: false, trackHitsToHull: false, siege: false, reloadRapid: false,
      commandBonus: 0, repairBonus: 0,
      deflector: 0, deflectorDaemonic: false, ignoreCrewCrits: false,
      autonomous: false, autonomousBS: 0, autonomousOperate: 0, autonomousAwareness: 0,
      flickerfield: false
    };
    for (const it of this.items) {
      if (it.type !== "vehicleTrait") continue;
      const e = it.system.effects || {};
      if (e.openTopped)             tf.openTopped = true;
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
      tf.spdDamageReduce += Number(e.spdDamageReduce) || 0;
      tf.commandBonus    += Number(e.commandBonus)    || 0;
      tf.repairBonus     += Number(e.repairBonus)     || 0;
      const fm = Number(e.fullMoveSpdMult) || 0;
      if (fm > tf.fullMoveSpdMult) tf.fullMoveSpdMult = fm;
    }
    // Open Topped теперь задаётся Чертой (ручной чекбокс убран из Обзора).
    system.openTopped = tf.openTopped;

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

  prepareDerivedData() {
    const system = this.system;

    // ── Корабль: отдельная модель данных ─────────────────────────────────────
    if (this.type === "ship") { this._prepareShipData(system); return; }

    // ── Техника: Структура вместо Ран, броня по сторонам ─────────────────────
    if (this.type === "vehicle") { this._prepareVehicleData(system); return; }

    // ── Звёздная система: сводка по небесным телам ───────────────────────────
    if (this.type === "starSystem") { this._prepareStarSystemData(system); return; }

    // ── Орда: Магнитуда вместо Ран, Размер по Магнитуде ──────────────────────
    if (this.type === "horde") { this._prepareHordeData(system); return; }

    // ── Отряд: Слаженность, Риск, командная вертикаль ────────────────────────
    if (this.type === "squad") { this._prepareSquadData(system); return; }

    // ── Формирование: Сила/Оборона, численность, боевой дух («Книга Битв») ───
    if (this.type === "formation") { this._prepareFormationData(system); return; }

    const chars  = system.characteristics;

    // Защита: списки должны быть массивами (могли стать объектом из-за старого бага ввода)
    if (system.aptitudes && !Array.isArray(system.aptitudes)) {
      system.aptitudes = Object.values(system.aptitudes);
    }
    if (system.advanceTalents && !Array.isArray(system.advanceTalents)) {
      system.advanceTalents = Object.values(system.advanceTalents);
    }
    if (system.paths && !Array.isArray(system.paths)) {
      system.paths = Object.values(system.paths);
    }

    // ── Модификаторы от активных препаратов ────────────────────────────────
    // Пока препарат активен, его модификаторы характеристик применяются прямо
    // к total/bonus (а значит — и к навыкам, боевым порогам, защите).
    // Если запущен пост-эффект — вместо основных применяются модификаторы
    // пост-эффекта.
    const drugCharMods = {};
    for (const item of this.items) {
      if (item.type !== "drug") continue;
      const ae = item.system.activeEffect;
      if (!ae?.isActive) continue;
      const mods = ae.isAfterEffect
        ? (item.system.afterEffectStatMods || {})
        : (item.system.statMods || {});
      for (const [k, v] of Object.entries(mods)) {
        if (typeof v === "number" && v !== 0) {
          drugCharMods[k] = (drugCharMods[k] || 0) + v;
        }
      }

      // Урон в характеристику пост-эффекта: брошен один раз при запуске
      // пост-эффекта (см. _triggerAfterEffect) и держится, пока он активен.
      if (ae.isAfterEffect && ae.charDamageStat && (ae.charDamageAmount || 0) > 0) {
        const stat = ae.charDamageStat;
        drugCharMods[stat] = (drugCharMods[stat] || 0) - ae.charDamageAmount;
      }
    }
    system.drugCharMods = drugCharMods;

    // ── Эффекты от черт (трейтов) ──────────────────────────────────────────
    // Ядро автоматизации: +X к бонусу характеристики (Unnatural), естественная
    // броня (+AP везде), рейтинг Страха, модификатор Размера.
    const traitCharBonus = {};
    const traitCharValueBonus = {}; // обычные плюсы к ЗНАЧЕНИЮ характеристики (не Unnatural)
    let traitArmourAll = 0;
    // Пер-локационная броня от имплантов/черт (напр. Боевые Латы Скитарии 6/7/7/5/5)
    const traitArmorLoc = { head: 0, body: 0, leftArm: 0, rightArm: 0, leftLeg: 0, rightLeg: 0 };
    let traitFearRating = 0;
    let traitSizeMod = 0;
    let traitInitMod = 0;
    let traitSpeedMod = 0;
    // ── Кибернетика Механикум: авто-автоматизация Техночудес ────────────────
    let implantEnergyMax   = 0;   // +N к максимуму Катушки Потенции (Manipulus и т.п.)
    let implantCompBonus   = 0;   // лучший бонус к тесту Компенсатора среди имплантов
    const techFocusInstalled = []; // Технофокусы (Железо): {name, quality, mod}
    // Черты, импланты и таланты дают авто-эффекты всегда; психосилы — пока
    // поддерживаются; техночудеса — пока поддерживаются либо пассивные.
    for (const item of this.items) {
      const t = item.type;
      const isActivePower =
        (t === "psychicPower" && item.system.isSustained) ||
        (t === "techPower" && (item.system.sustained || item.system.miracleType === "passive"));
      // Модификация брони даёт бонусы, если установлена на надетую броню
      const isActiveArmorMod = t === "armorMod" && item.system.installedOn &&
        this.items.get(item.system.installedOn)?.system?.equipped;
      // Предмет-Родной мир несёт модификаторы Характеристик своего мира.
      if (t !== "trait" && t !== "implant" && t !== "talent" && t !== "homeworld"
          && !isActivePower && !isActiveArmorMod) continue;
      // Импланты дают эффекты ТОЛЬКО когда хирургически установлены (флаг из окна Хирургеона).
      if (t === "implant" && !item.getFlag("warhammer-dbc", "installed")) continue;
      // «Не работает» — орган на месте (виден на карте тела), но неисправен:
      // его эффекты не считаются, пока GM/игрок не переключит статус обратно.
      if (t === "implant" && item.getFlag("warhammer-dbc", "disabled")) continue;
      // Бионические конечности: +2 к эффективному Поглощению этой частью тела.
      if (t === "implant" && item.system.category === "bionic") {
        const k = classifyImplant(item.name, item.system.installed)?.kind;
        const side = item.getFlag("warhammer-dbc", "bodySide");
        if (k === "arm") traitArmorLoc[side === "left" ? "leftArm" : "rightArm"] += 2;
        else if (k === "leg") traitArmorLoc[side === "left" ? "leftLeg" : "rightLeg"] += 2;
      }
      // Роспись механик: авто-числовое (Unnatural/бонусы х-к, броня по локациям).
      if (t === "implant") {
        const mech = implantMech(item.name);
        if (mech) {
          if (mech.un)  for (const [k, v] of Object.entries(mech.un))  traitCharBonus[k]      = (traitCharBonus[k]      || 0) + v;
          if (mech.val) for (const [k, v] of Object.entries(mech.val)) traitCharValueBonus[k] = (traitCharValueBonus[k] || 0) + v;
          if (mech.ap) {
            if (mech.ap.all)  for (const kk of Object.keys(traitArmorLoc)) traitArmorLoc[kk] += mech.ap.all;
            if (mech.ap.head) traitArmorLoc.head += mech.ap.head;
            if (mech.ap.body) traitArmorLoc.body += mech.ap.body;
            if (mech.ap.arms) { traitArmorLoc.leftArm += mech.ap.arms; traitArmorLoc.rightArm += mech.ap.arms; }
            if (mech.ap.legs) { traitArmorLoc.leftLeg += mech.ap.legs; traitArmorLoc.rightLeg += mech.ap.legs; }
          }
          // Кибернетика Механикум — Техночудеса
          const q = item.system.quality || "common";
          if (mech.energyMax) implantEnergyMax += mech.energyMax;
          if (mech.compensator && (mech.compensator[q] ?? 0) > implantCompBonus)
            implantCompBonus = mech.compensator[q] ?? 0;
          if (mech.ironFocus)
            techFocusInstalled.push({ name: item.name, quality: q, mod: ironModForQuality(q) });
        }
      }
      // Мигрированные предметы несут ту же механику как embedded ActiveEffect
      // (см. migrations/item-effects.mjs) — читать старое поле тоже
      // означало бы посчитать бонус дважды.
      const e = item.getFlag("warhammer-dbc", "migratedEffect") ? {} : (item.system.effects || {});
      // Одиночный бонус (legacy)
      if (e.charBonusStat && (e.charBonusValue || 0) !== 0) {
        traitCharBonus[e.charBonusStat] = (traitCharBonus[e.charBonusStat] || 0) + e.charBonusValue;
      }
      // Множественные бонусы характеристик (к бонусу, Unnatural)
      if (Array.isArray(e.charBonuses)) {
        for (const cb of e.charBonuses) {
          if (cb?.stat && (cb.value || 0) !== 0) {
            traitCharBonus[cb.stat] = (traitCharBonus[cb.stat] || 0) + cb.value;
          }
        }
      }
      // Обычные бонусы к ЗНАЧЕНИЮ характеристики (как +S/+W от брони)
      if (Array.isArray(e.charValueBonuses)) {
        for (const cb of e.charValueBonuses) {
          if (cb?.stat && (cb.value || 0) !== 0) {
            traitCharValueBonus[cb.stat] = (traitCharValueBonus[cb.stat] || 0) + cb.value;
          }
        }
      }
      if (e.armourAll)  traitArmourAll  += e.armourAll;
      // Пер-локационная броня (apAll/apHead/apBody/apArms/apLegs) — как у Боевых Лат.
      // ВАЖНО: AP модификаций брони (armorMod) сюда НЕ добавляем — они уже учтены
      // в armorFromItems через getArmorModEffects (иначе AP считался бы дважды,
      // напр. «Гребень» +1 к шлему давал +2).
      if (t !== "armorMod") {
        if (e.apAll)  { for (const k of Object.keys(traitArmorLoc)) traitArmorLoc[k] += e.apAll; }
        if (e.apHead) traitArmorLoc.head += e.apHead;
        if (e.apBody) traitArmorLoc.body += e.apBody;
        if (e.apArms) { traitArmorLoc.leftArm += e.apArms; traitArmorLoc.rightArm += e.apArms; }
        if (e.apLegs) { traitArmorLoc.leftLeg += e.apLegs; traitArmorLoc.rightLeg += e.apLegs; }
      }
      if (e.fearRating) traitFearRating  = Math.max(traitFearRating, e.fearRating);
      if (e.sizeMod)    traitSizeMod    += e.sizeMod;
      if (e.initMod)    traitInitMod    += e.initMod;
      if (e.speedMod)   traitSpeedMod   += e.speedMod;
    }
    // ── Одержимый: авто-эффекты Проявления (DoomBC 129-132) ─────────────────
    // Пока демон проявлен, профиль (по Cor) даёт Unnatural S, Daemonic (→T.b),
    // Fear; активные Дары-предметы («Дар: …») добавляют свои числовые эффекты.
    // Всё вливается в общий конвейер трейтов — снимается автоматически при
    // заключении демона. Синхронизировано с Cor и составом Даров на акторе.
    system.possessionActive = null;
    if (system.possessed && system.possession?.manifested && system.alignment === "heretic") {
      const cor  = system.corruption?.value ?? 0;
      const corB = Math.floor(cor / 10);
      const prof = manifestProfile(cor);
      const applied = [];
      // База Проявления
      traitCharBonus.s = (traitCharBonus.s || 0) + prof.unnaturalS;   // Unnatural S
      traitCharBonus.t = (traitCharBonus.t || 0) + prof.daemonic;     // Daemonic → T.b (соглашение бестиария)
      traitFearRating  = Math.max(traitFearRating, prof.fear);        // Fear
      applied.push(`Unnatural S +${prof.unnaturalS}`, `Daemonic ${prof.daemonic} (T.b)`, `Fear ${prof.fear}`);
      // Активные Дары (предметы-таланты с именем «Дар: …») с числовыми эффектами
      const giftNames = new Set(this.items.filter(i => i.type === "talent").map(i => i.name));
      const hasGift = (n) => giftNames.has(`Дар: ${n}`);
      if (hasGift("Панцирь"))               { traitArmourAll += corB; applied.push(`Панцирь: Natural Armour ${corB}`); }
      if (hasGift("Гигант"))                { traitSizeMod += 1; traitCharValueBonus.s = (traitCharValueBonus.s || 0) + 10; applied.push("Гигант: +1 Размер, +10 S"); }
      if (hasGift("Демоническая Скорость")) { const a = Math.floor(corB / 2); traitCharBonus.ag = (traitCharBonus.ag || 0) + a; applied.push(`Демон. Скорость: Unnatural A +${a}`); }
      system.possessionActive = { prof, corB, applied };
    }

    // ── Гемункул: прибавки открытых ступеней (0–5) ────────────────────────
    // Unnatural I и Fear даются самими ступенями и от I.b не зависят, поэтому
    // применяются здесь, до пересчёта характеристик.
    if (this.type === "character" && isHaemonculus(this)) {
      const hStage = Math.max(0, Math.min(5, Number(system.haemonculus?.stage) || 0));
      let hUnI = 0, hFear = 0;
      for (const st of HAEM_STAGES) {
        if (st.stage > hStage) break;
        hUnI  += st.grants.unnaturalI || 0;
        hFear += st.grants.fear       || 0;
      }
      traitCharBonus.int = (traitCharBonus.int || 0) + hUnI;
      traitFearRating    = Math.max(traitFearRating, hFear);
      system.haemActive  = { stage: hStage, unnaturalI: hUnI, fear: hFear, woundBonus: 0, regen: 0 };
    } else {
      system.haemActive = null;
    }

    // ── Клонирующее Поле: сила строго по редкости надетого поля ───────────
    // Голографическая защита, а не силовая: не поглощает попадания, а срывает
    // их. Носителю — бонус на избегание и Stealth, противнику — штраф на атаки.
    {
      const cf = this.items.find(i => /Clone Field|Клонирующее Поле/i.test(i.name)
                                   && i.system?.worn !== false);
      system.cloneField = cf
        ? cloneFieldTier(cf.system?.availability ?? 2, cf.system?.quality)
        : null;
    }

    system.traitCharBonus      = traitCharBonus;
    system.traitCharValueBonus = traitCharValueBonus;
    system.fearRating     = traitFearRating;
    system.talentInitMod  = traitInitMod;
    system.traitSpeedMod  = traitSpeedMod;

    // ── Пассивные авто-бонусы от Путей Аэльдари ─────────────────────────────
    // Unnatural характеристики и лимит Порчи (кумулятивно по достигнутым
    // градациям, без двойного учёта). Ситуативные боевые эффекты не авто.
    const pathPassives = computePathPassives(system.paths);
    system.pathCharBonus = pathPassives.charBonus;

    // ── Бонусы от надетой брони к характеристикам ───────────────────────────
    // Силовая броня → +S; Аспектная броня Аэльдари → +S и +W (Сила Воли).
    // Прибавляются к значению характеристики (total), пока броня надета.
    const armorCharBonus = { s: 0, wp: 0 };
    for (const item of this.items) {
      if (item.type !== "armor" || !item.system.equipped) continue;
      armorCharBonus.s  += item.system.strengthBonus || 0;
      armorCharBonus.wp += item.system.wpBonus       || 0;
    }
    system.armorCharBonus = armorCharBonus;

    // ── Характеристики ────────────────────────────────────────────────────
    const charDamage = system.charDamage || {};
    // Авто-дебафф от потребностей (Голод/Жажда) — отдельно от ручного charDamage.
    const vitalMods = (this.type === "character") ? vitalCharMods(system.vitals) : {};
    for (const [key, char] of Object.entries(chars)) {
      const impBonus  = IMPROVEMENT_BONUS[char.improvement] || 0;
      const drugMod   = drugCharMods[key]   || 0;
      const traitMod  = traitCharBonus[key] || 0; // Unnatural — добавляется к бонусу
      const pathMod   = pathPassives.charBonus[key] || 0; // Unnatural от Путей
      const armorMod  = armorCharBonus[key] || 0; // +S/+W от брони (к значению)
      const valueMod  = traitCharValueBonus[key] || 0; // импланты/черты — к значению
      const dmgMod    = charDamage[key]     || 0; // урон в характеристику (редактируемый дебафф)
      const vitalMod  = vitalMods[key]      || 0; // Голод/Жажда — авто-дебафф
      char.drugMod    = drugMod;
      char.charDamage = dmgMod;
      char.vitalMod   = vitalMod;
      // База не трогается; урон и потребности — отдельные временные модификаторы
      char.total   = (char.base || 0) + (char.advance || 0) + impBonus + drugMod + armorMod + valueMod - dmgMod - vitalMod;
      char.bonus   = Math.floor(char.total / 10) + (char.supernatural || 0) + traitMod + pathMod;
    }

    // Гемункул, Стадия 1 (Идеал Плоти): +I.b к максимуму Ран и Regeneration
    // (+½ I.b, окр. ▲). Считается уже по итоговому I.b — с Unnatural I ступеней.
    if (system.haemActive?.stage >= 1) {
      const ib = chars.int?.bonus || 0;
      system.haemActive.woundBonus = ib;
      system.haemActive.regen      = Math.ceil(ib / 2);
    }

    // Лимит Порчи: база 100 + бонус от Путей (Путь Проклятия и т.п.)
    if (system.corruption) {
      system.corruption.limit = 100 + (pathPassives.corLimit || 0);
    }

    system.insanityBonus   = Math.floor((system.insanity?.value   || 0) / 10);
    system.corruptionBonus = Math.floor((system.corruption?.value || 0) / 10);

    // Порог Усталости = T.b + W.b (потеря сознания при превышении).
    if (system.fatigue) {
      system.fatigue.max = (chars.t?.bonus ?? 0) + (chars.wp?.bonus ?? 0);
    }

    // Мёртвое Могущество (Иннари): максимум = W.b × 3
    if (system.deadMight) {
      system.deadMight.max = (chars.wp?.bonus ?? 0) * 3;
      if ((system.deadMight.value ?? 0) > system.deadMight.max)
        system.deadMight.value = system.deadMight.max;
    }

    // ── Очки Боли (Друкхари) ───────────────────────────────────────────────
    // Друкхари вместо Судьбы/Бесчестья используют Очки Боли (расовые Трейты
    // «Через Боль» и «Безбожник»). Максимум = W.b × (1 + «Бездонная Душа», до 3 раз).
    // Пул «Судьба» на листе друкхари уже подписан «Очки Боли» (см. fateTerm).
    system.painActive  = false;
    system.fateMaxAuto = false;
    if (system.race === "drukhari" && system.fate) {
      const wb = chars.wp?.bonus ?? 0;
      const bottomless = Math.min(3, this.items.filter(i =>
        i.type === "talent" && /Bottomless Soul|Бездонная Душа/i.test(i.name)).length);
      system.fate.max = wb * (1 + bottomless);
      if ((system.fate.value ?? 0) > system.fate.max) system.fate.value = system.fate.max;
      system.painActive  = true;
      system.fateMaxAuto = true;
    }

    const tb = chars.t?.bonus ?? 0;

    // ── Броня ─────────────────────────────────────────────────────────────
    const armorFromItems = {
      head: 0, body: 0,
      leftArm: 0, rightArm: 0,
      leftLeg: 0, rightLeg: 0
    };

    // Бонусы AP против типов урона от модов брони (всегда складываются)
    const armorVsType = { energy: 0, impact: 0, rending: 0, blast: 0 };

    for (const item of this.items) {
      if (item.type !== "armor" || !item.system.equipped) continue;
      const s = item.system;
      // Эффективная броня этого предмета с учётом установленных модификаций
      const aFx = getArmorModEffects(this, item);
      const ap = {
        head:     (s.head     || 0) + armorModApForLocation(aFx, "head"),
        body:     (s.body     || 0) + armorModApForLocation(aFx, "body"),
        leftArm:  (s.leftArm  || 0) + armorModApForLocation(aFx, "leftArm"),
        rightArm: (s.rightArm || 0) + armorModApForLocation(aFx, "rightArm"),
        leftLeg:  (s.leftLeg  || 0) + armorModApForLocation(aFx, "leftLeg"),
        rightLeg: (s.rightLeg || 0) + armorModApForLocation(aFx, "rightLeg")
      };
      // Качество брони: Best.Q даёт +1 AP всем частям (сочленения +2 — напоминание).
      const qArmor = qualityEffects(item).auto;
      if (qArmor.apAll) { for (const k of Object.keys(ap)) ap[k] += qArmor.apAll; }
      // Активный режим поля друкхарийской брони: Амортизирующее даёт Protective,
      // Подавляющее — Blunted и штраф чужим психотестам, Рассеивающее — Nimble.
      const fld = fieldModeEffects(item);
      if (fld.protective)      system.fieldProtective = fld.protective;
      if (fld.nimble != null)  system.fieldNimble  = fld.nimble;
      if (fld.blunted != null) system.fieldBlunted = fld.blunted;
      if (fld.psyMod)          system.fieldPsyMod  = fld.psyMod;
      if (fld.shield)          system.fieldShield  = fld.shield;

      armorVsType.energy  += aFx.vs.energy;
      armorVsType.impact  += aFx.vs.impact;
      armorVsType.rending += aFx.vs.rending;
      armorVsType.blast   += aFx.vs.blast;

      // Особенность комплекта (истории силовой брони): «Под взглядом богов»
      // даёт +1 ОБ всем зонам, «Уничтоженный и восстановленный» — ±1 по зонам.
      const hist = s.history;
      if (hist?.table && isFeatureEnabled("armourHistories")) {
        const def = PA_TABLES[hist.table]?.entries.find(e => e.name === hist.name);
        if (def?.apAll) for (const k of Object.keys(ap)) ap[k] += def.apAll;
        for (const [k, v] of Object.entries(hist.zones || {})) {
          if (k in ap) ap[k] += Number(v) || 0;
        }
      }

      if (s.stacks) {
        for (const k of Object.keys(ap)) armorFromItems[k] += ap[k];
      } else {
        for (const k of Object.keys(ap)) armorFromItems[k] = Math.max(armorFromItems[k], ap[k]);
      }
    }

    // ── Снятый шлем ────────────────────────────────────────────────────────
    // Показатель «сколько ОБ на голову даёт снаряжение» считается ДО снятия:
    // иначе галочка исчезла бы вместе с бронёй и шлем нельзя было бы надеть.
    system.gearHeadAP = armorFromItems.head;
    const helmetOff = !!system.helmetOff && isFeatureEnabled("helmetless");
    system.helmetlessActive = helmetOff && armorFromItems.head > 0;
    // Теряются все ОБ на голове от носимой брони (естественная броня остаётся).
    if (system.helmetlessActive) armorFromItems.head = 0;

    const armorManual = system.armor || {};
    // Ручные щиты (стр. 215): прикрывают зоны своим AP. Щит держат ПОВЕРХ брони,
    // поэтому не суммируем, а берём лучшее по каждой зоне — как и прочие AP.
    const shieldAP = shieldArmorByLocation(this);
    system.shieldArmor = shieldAP;
    const best = (k) => Math.max(armorFromItems[k], armorManual[k] || 0, shieldAP[k] || 0);
    // Складываемая надбавка AP от эффектов (естественная броня Черт, броня
    // имплантов, что угодно ещё). Хранимое поле схемы — эффекты целятся в него
    // в фазе "initial", то есть ДО этого расчёта, тем же приёмом, что и
    // encumbrance.indexBonus. Ложится рядом с traitArmourAll: после снятия
    // шлема, поэтому естественная броня головы вместе с ним не теряется.
    const fxArmor = system.armorBonus || {};
    // Естественная броня (трейты) + пер-локационная от имплантов складываются с носимой/ручной
    const armorAP = {
      head:     best("head")     + traitArmourAll + traitArmorLoc.head     + (fxArmor.head     || 0),
      body:     best("body")     + traitArmourAll + traitArmorLoc.body     + (fxArmor.body     || 0),
      leftArm:  best("leftArm")  + traitArmourAll + traitArmorLoc.leftArm  + (fxArmor.leftArm  || 0),
      rightArm: best("rightArm") + traitArmourAll + traitArmorLoc.rightArm + (fxArmor.rightArm || 0),
      leftLeg:  best("leftLeg")  + traitArmourAll + traitArmorLoc.leftLeg  + (fxArmor.leftLeg  || 0),
      rightLeg: best("rightLeg") + traitArmourAll + traitArmorLoc.rightLeg + (fxArmor.rightLeg || 0),
    };

    system.absorption = {
      head:           armorAP.head     + tb,
      body:           armorAP.body     + tb,
      leftArm:        armorAP.leftArm  + tb,
      rightArm:       armorAP.rightArm + tb,
      leftLeg:        armorAP.leftLeg  + tb,
      rightLeg:       armorAP.rightLeg + tb,
      toughnessBonus: tb,
      armorOnly:      armorAP,
      vsType:         armorVsType
    };

    // ── Навыки ────────────────────────────────────────────────────────────
    const skills = system.skills || {};
    for (const [key, sk] of Object.entries(skills)) {
      const def     = SKILLS_DEF[key];
      const charVal = def ? (chars[def.char]?.total ?? 0) : 0;
      sk.total = charVal + (SKILL_RANKS[sk.rank]?.bonus ?? -20);
    }

    // ── Групповые навыки ──────────────────────────────────────────────────
    const groupSkills = system.groupSkills || {};
    for (const [groupKey, entries] of Object.entries(groupSkills)) {
      if (!Array.isArray(entries)) continue;
      const def     = GROUP_SKILLS_DEF[groupKey];
      for (const entry of entries) {
        // Спец-навык может иметь свою базовую характеристику (entry.char),
        // иначе берётся характеристика группы по умолчанию.
        const entryChar = entry.char || def?.char;
        const charVal   = entryChar ? (chars[entryChar]?.total ?? 0) : 0;
        entry.total = charVal + (SKILL_RANKS[entry.rank]?.bonus ?? -20);
      }
    }

    // ── Вес ───────────────────────────────────────────────────────────────
    // Надетая силовая броня (armorType power/aspect) несёт свой вес сама —
    // сервоприводы разгружают носителя, поэтому её вес не учитывается в нагрузке.
    const POWER_ARMOR_TYPES = new Set(["power", "aspect"]);
    let totalWeight = 0;
    for (const item of this.items) {
      const s = item.system;
      const w = parseFloat(s.weight) || 0;
      if (item.type === "armor" && s.equipped && POWER_ARMOR_TYPES.has(s.armorType)) {
        continue; // силовая броня носит себя сама
      }
      if (["gear","drug","tool","ammo"].includes(item.type)) {
        totalWeight += w * (parseInt(s.quantity) || 1);
      } else {
        totalWeight += w;
      }
    }
    system.encumbrance.current = Math.round(totalWeight * 100) / 100;

    // ── Гравитация сцены (виджет «Окружающая Среда») ────────────────────────
    // Вес снаряжения ×G (стр. 483-484) — берём сцену конкретного токена
    // (важно для несвязанных токенов одного актёра на разных сценах),
    // иначе текущую сцену канвы/её замену. Ёмкость (carry/lift/push ниже)
    // не трогаем — она посчитана как «ёмкость при 1G», штраф/бонус
    // гравитации применяется к текущему весу снаряжения, а не к ней.
    const envScene = this.token?.parent ?? canvas?.scene ?? game.scenes?.current ?? null;
    const gravity  = envScene ? (Number(readEnvForScene(envScene).gravity) || 1) : 1;
    system.encumbrance.gravity          = gravity;
    system.encumbrance.effectiveCurrent = Math.round(totalWeight * gravity * 100) / 100;

    const sb = chars.s?.bonus ?? 0;
    // Феодальный мир, «Житие тяжкое»: +1 к S.b именно для грузоподъёмности.
    const hwCarry = HOMEWORLD_BY_KEY[this.items.find(i => i.type === "homeworld")?.system?.key]?.carryBonus || 0;
    // ── Ношение/Подъём/Толкание (стр. 27) ───────────────────────────────────
    // Таблица _calcMaxCarry(idx) даёт Ношение; Подъём и Толкание — та же
    // таблица со сдвигом индекса на +1/+2 строки (подтверждено построчным
    // сравнением с таблицей книги: Ношение(idx+1) === Подъём(idx), и т.д.).
    // indexBonus.all сдвигает БАЗОВЫЙ индекс — значит одинаково влияет на все
    // три (за счёт того, что Подъём/Толкание уже определены через тот же
    // базовый индекс), тогда как indexBonus.carry/.lift/.push бьёт только по
    // своей категории поверх базы — так Конструктор («Механика», запись
    // kind:"weight") реализует и «Общее», и точечные категории одним
    // механизмом. indexBonus.* — обычные ХРАНИМЫЕ поля (см. template.json),
    // безопасные целью для ActiveEffect в фазе "initial" (СТАВИТСЯ ДО этого
    // расчёта, не после — в отличие от .carry/.lift/.push/.max, которые сами
    // производные и берут "final").
    const ib = system.encumbrance.indexBonus || {};
    const baseIdx = sb + tb + hwCarry + (ib.all || 0);
    system.encumbrance.carry = _calcMaxCarry(baseIdx + (ib.carry || 0));
    system.encumbrance.lift  = _calcMaxCarry(baseIdx + 1 + (ib.lift || 0));
    system.encumbrance.push  = _calcMaxCarry(baseIdx + 2 + (ib.push || 0));
    system.encumbrance.max = system.encumbrance.carry;
    system.homeworldCarryBonus = hwCarry;

        // ── Опыт ──────────────────────────────────────────────────────────────
    // Автосумма цен характеристик
    let autoCharCost = 0;
    for (const char of Object.values(chars)) {
      autoCharCost += (char.cost || 0);
    }
    system.experience.spentChar = autoCharCost;

    let autoSkillCost = 0;
    for (const sk of Object.values(skills)) autoSkillCost += (sk.cost || 0);
    for (const group of Object.values(groupSkills)) {
      if (Array.isArray(group)) {
        for (const entry of group) autoSkillCost += (entry.cost || 0);
      }
    }
    system.experience.spentSkills = autoSkillCost;

    // Автосумма цен талантов: ручной список «Развития» + купленные таланты-предметы
    // (через пикер; стартовые с генерации имеют cost 0 и не учитываются, стр. 23-24).
    let autoTalentCost = 0;
    if (Array.isArray(system.advanceTalents)) {
      for (const t of system.advanceTalents) autoTalentCost += (parseInt(t?.cost) || 0);
    }
    for (const it of this.items) {
      if (it.type === "talent") autoTalentCost += (parseInt(it.system?.cost) || 0);
    }
    system.experience.spentTalents = autoTalentCost;

    // Автосумма цен психосил и техночудес (item.system.cost) — синхронно с
    // вкладками «ПСИ»/«Техно».
    let autoPsyCost = 0;
    for (const it of this.items) {
      if (it.type === "psychicPower" || it.type === "techPower") autoPsyCost += (parseInt(it.system?.cost) || 0);
    }
    system.experience.spentPsy = autoPsyCost;

    const spentTotal =
      (system.experience.spentChar    || 0) +
      (system.experience.spentSkills  || 0) +
      (system.experience.spentTalents || 0) +
      (system.experience.spentPsy     || 0) +
      (system.experience.spentOther   || 0);

    system.experience.spent   = spentTotal;
    system.experience.current = (system.experience.total || 0) - spentTotal;

    // ── Движение (авторасчёт) ─────────────────────────────────────────────
    const agBonus = chars.ag?.bonus ?? 0;
    // 0 = Человек; трейт Размера сдвигает SPD (прямой мод)
    const size    = (system.size ?? 0) + traitSizeMod;
    system.sizeMod   = traitSizeMod;          // вклад Черт в Размер
    system.sizeTotal = size;                  // итоговый Размер (база + Черты)
    const stance  = system.meleeStance || "standard";

    let { spd, halfMove, move, charge, run } = calcMovement(agBonus, size);

    // Бонус к базовой скорости (SPD) от Черт/имплантов/талантов/психосил, плюс
    // system.movement.spdBonus — входное поле для kind:"movement" (Конструктор,
    // цель "SPD"), ставится ActiveEffect'ом в фазе "initial" (см. mechanics.mjs),
    // т.е. уже на месте к этому моменту расчёта.
    const spdBonus = Number(system.movement.spdBonus) || 0;
    if (traitSpeedMod || spdBonus) {
      spd = Math.max(0.5, spd + traitSpeedMod + spdBonus);
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

    system.movement.halfMove = halfMove;
    system.movement.move     = move;
    system.movement.charge   = charge;
    system.movement.run      = run;

    // ── Инициатива ────────────────────────────────────────────────────────
    // Хранит Ag.bonus + модификаторы Талантов (Combat Formation, Paranoia).
    // Сам бросок = 1d10 + system.initiative.
    system.initiative = agBonus + (traitInitMod || 0);

    // ── Когниция (Техножрец) ───────────────────────────────────────────────
    // Пул Когниции = Int.bonus; в начале Хода восстанавливается ½ Int.b.
    if (system.cognition) {
      const ib = chars.int?.bonus ?? 0;
      system.cognition.max   = ib;
      system.cognition.regen = Math.ceil(ib / 2);
    }

    // ── Энергия (Катушка Потенции) + Техночудеса Кибернетики Механикум ──────
    // energy.max — база (ручной ввод); maxTotal = база + бонусы имплантов
    // (Мотивные Банки +5 и т.п.). Активация/зарядка используют maxTotal.
    if (system.energy) {
      system.energy.bonusMax = implantEnergyMax;
      system.energy.maxTotal = Math.max(0, (system.energy.max || 0) + implantEnergyMax);
      if ((system.energy.value || 0) > system.energy.maxTotal)
        system.energy.value = system.energy.maxTotal;
    }
    // Бонус к тесту Компенсатора (лучший среди имплантов) и установленные
    // Технофокусы (Железо) — для активации Техночудес и показа на листе.
    system.techCompBonus   = implantCompBonus;
    system.techFocus       = techFocusInstalled;

    // ── Пси-Рейтинг ────────────────────────────────────────────────────────
    // Текущий PR = базовый − сумма цен поддержания активных психосил (обычно по 1).
    if (system.psyker) {
      let sustainedCost = 0;
      for (const i of this.items) {
        if (i.type === "psychicPower" && i.system.isSustained) sustainedCost += (i.system.sustainCost ?? 1);
      }
      system.psyker.sustain       = sustainedCost;
      system.psyker.currentRating = Math.max(0, (system.psyker.rating || 0) - sustainedCost);
    }
  }
}