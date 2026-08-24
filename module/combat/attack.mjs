import { CHARACTERISTICS }                         from "../constants/characteristics.mjs";
import { pickReroll } from "../rules/reroll-pick.mjs";
import { WEAPON_CLASSES, DAMAGE_TYPES }            from "../constants/items.mjs";
import { MELEE_STANCES }                           from "../constants/combat.mjs";
import { _getAmmoSpent, _buildAmmoModString }       from "../helpers/utils.mjs";
import { getCriticalEffect }                        from "../../critical-tables.mjs";
import { resolveWeaponProps, resolveWeaponPropsList, aggregateAuto,
         jamThreshold, buildPropertyChatBlock,
         buildTargetEffectButtons }                 from "./weapon-properties.mjs";
import { hitCount, hitLocation, locationForHit, meleeStrengthBonus,
         attackPenetration, damageFormulaFor, bonusDamageDice } from "./attack-outcome.mjs";
import { effectiveDamage, mergeExtraProps, weaponOffEffects } from "./attack-weapon.mjs";
import { attackCard, jamCard }                      from "./attack-card.mjs";
import { getModEffects, mergeWeaponPropEntries }    from "./weapon-mods.mjs";
import { qualityEffects, buildQualityChatBlock }    from "../constants/quality.mjs";
import { splinterFullAutoTearing, isSplinter, splinterReminders } from "../constants/drukhari-splinter.mjs";
import { vehicleHitLocation }                        from "../constants/vehicle.mjs";
import { hidingInHordeSplit }                        from "./horde-tokens.mjs";

/**
 * Экстремальный урон (стр. 166-170): куб урона выбросил Х+ — порог берётся из
 * свойства Extreme (wp.extremeThreshold), а без него — собственный максимум
 * кубика. Сработавшее даёт отдельный бросок 1d5 на Критический Результат и
 * переводит его в Критический Эффект (кроме техники — там Экстремальный уходит
 * в отрицательную Структуру при применении урона, а не по этой таблице).
 *
 * Общий код для оружия, психосил и техночудес (module/sheets/tabs/psychic.mjs,
 * tech.mjs): раньше те считали урон в обход этой проверки и не подхватывали ни
 * Экстремальный урон, ни другие дайс-моды свойств атаки (см. applyDamageDiceMods,
 * который вызывающая сторона обязана применить к формуле ДО броска).
 *
 * @param {Roll}    dmgRoll  уже брошенный урон — проверяются его кубы
 * @param {object}  wp       агрегат aggregateAuto(...) для этой атаки
 */
export async function rollExtremeDamage(dmgRoll, { wp, damageType, hitLocation = "Торс", targetIsVehicle = false }) {
  let hasExtreme = false;
  if (dmgRoll.terms) {
    for (const term of dmgRoll.terms) {
      if (term.faces && term.results) {
        const thr = wp.extremeThreshold < 10 ? wp.extremeThreshold : term.faces;
        for (const r of term.results) {
          if (r.active && r.result >= thr) hasExtreme = true;
        }
      }
    }
  }
  let extremeLevel = 0, critEffect = null, exRoll = null;
  if (hasExtreme) {
    exRoll = await new Roll("1d5").evaluate();
    extremeLevel = exRoll.total;
    if (!targetIsVehicle) critEffect = getCriticalEffect(damageType, hitLocation, extremeLevel);
  }
  return { hasExtreme, extremeLevel, critEffect, exRoll };
}

export async function _executeAttackRoll(actor, item, charKey, threshold, rofMode, aimTarget, opts = {}) {
  const sys     = item.system;
  const isMelee = sys.weaponClass === "melee" || sys.weaponClass === "thrown";
  // Выбранный профиль атаки (стр. 207-221) и хват (стр. 39) переопределяют урон.
  const P = opts.profile || null;
  const gripDmgFlat = Number(opts.gripDmgFlat) || 0;
  const eff = effectiveDamage({ sys, profile: P, gripDmgFlat });
  let   effDamage  = eff.damage;
  const effDmgType = eff.damageType;
  const effPen0    = eff.penetration;

  // ── Особые свойства оружия (+ от установленных модификаций) ───────────────
  //   Если выбран доп. профиль со своими свойствами (Крюк/Посох) — берём их
  //   вместо базовых (у профилей разные наборы: Devastating vs Primitive и т.п.).
  const modFx     = getModEffects(actor, item);
  // Заряженный боеприпас нужен уже здесь: он может добавлять свойства оружия.
  const loadedAmmo = sys.loadedAmmoId ? actor.items.get(sys.loadedAmmoId) : null;
  const _propSource = (P && Array.isArray(P.weaponProps) && P.weaponProps.length)
    ? { system: { weaponProps: P.weaponProps } }
    : item;
  let _mergedEntries = mergeExtraProps(mergeWeaponPropEntries(_propSource, modFx), {
    gripProps:   opts.gripProps || [],
    gripKey:     opts.gripKey,
    gripProps2h: sys.gripProps2h || [],
    ammoProps:   loadedAmmo?.system?.properties || [],
    condProps:   opts.ammoCondProps || [],
    removeProps: loadedAmmo?.system?.removeProps || []
  });

  // ── Выключенное оружие (стр. 209-211) ────────────────────────────────────
  const off = weaponOffEffects({
    sys, entries: _mergedEntries, on: !!opts.weaponOff, basePen: effPen0, gripDmgFlat
  });
  _mergedEntries = off.entries;
  const offDmgMod = off.dmgMod, offPenMod = off.penMod, offNote = off.note;
  if (off.damage) effDamage = off.damage;

  // Осколочное оружие: длинная очередь рвёт плоть — добавляем Tearing к этому
  // выстрелу до сборки свойств, чтобы он попал и в формулу урона, и в карточку.
  if (splinterFullAutoTearing(sys, rofMode) && !_mergedEntries.some(x => x.key === "tearing")) {
    _mergedEntries.push({ key: "tearing" });
  }

  const wProps    = resolveWeaponPropsList(_mergedEntries);
  const wp         = aggregateAuto(wProps);
  wp.reliabilityScore += modFx.reliabilityMod || 0;
  // ── Качество оружия ──────────────────────────────────────────────────────
  //   Стрелковое: ±Надёжность; Рукопашное Best: +1 урон; Best: теряет Primitive.
  //   (Мод теста для рукопашного применяется в _showAttackDialog → threshold.)
  const qAuto = qualityEffects(item).auto;
  if (!isMelee) wp.reliabilityScore += qAuto.reliabilityMod || 0;
  if (qAuto.losesPrimitive) wp.primitive = false;
  // Мельта/Рассеивание зависят от дистанции — флаг приходит из диалога
  const shortRange = !!opts.shortRange;
  // Выбранная полоса дальности (у оружия со своими бонусами по дистанции).
  const bandList = Array.isArray(sys.rangeBands) ? sys.rangeBands : [];
  const band     = bandList[Number(opts.bandIdx)] || null;
  // Максимальный режим (Maximal) — флаг из диалога
  const maximalOn  = !!(opts.maximal && wp.maximal);

  const ammoSys    = loadedAmmo?.system;
  const ammoDmgMod    = ammoSys?.damageMod         ?? 0;
  const ammoPenMod    = ammoSys?.penetrationMod     ?? 0;
  const ammoRngMult   = ammoSys?.rangeMultiplier    ?? 1;
  const ammoRngAdd    = ammoSys?.rangeMod           ?? 0;
  const ammoDmgType   = ammoSys?.damageTypeOverride || "";
  const ammoSpecial   = ammoSys?.special            || "";

  // forcedRoll задаётся при перебросе/+10 за Очко Судьбы — повторяем ту же
  // атаку с заданным значением d100 (а не бросаем заново).
  //
  // opts.reroll — другое: переброс от правила (Локус Буйства и подобные,
  // module/rules/item-rules.mjs). Он не повторяет прошлую атаку, а катает
  // несколько кубов сразу и оставляет один. Какой — решает pickReroll: на d100
  // «лучший» это МЕНЬШИЙ, и это знание живёт в одном месте на всю систему.
  // forcedRoll старше: если атаку переигрывают, перебрасывать уже нечего.
  let rerollDropped = [];
  let roll;
  if (opts.forcedRoll != null) {
    roll = await new Roll(String(Math.max(1, Math.min(100, opts.forcedRoll)))).evaluate();
  } else if (opts.reroll) {
    const rolls = [];
    for (let i = 0; i < Math.max(2, opts.reroll.rolls || 2); i++) rolls.push(await new Roll("1d100").evaluate());
    const picked = pickReroll(rolls.map(r => r.total), opts.reroll.mode);
    roll = rolls[picked.index];
    rerollDropped = picked.dropped;
  } else {
    roll = await new Roll("1d100").evaluate();
  }
  const rv       = roll.total;
  const rollMode = game.settings.get("core", "rollMode");
  // Беспомощная цель (стр. ...): рукопашная/выстрел в упор или в рукопашной
  // против неё автоматически успешны, независимо от того, что выпало на
  // d100 — рвётся из attack-dialog.mjs (opts.forceHit), а не проверяется тут
  // заново, потому что «в упор/в рукопашной» — ситуативная галочка игрока,
  // не хранимое состояние на акторе.
  const hit      = !!opts.forceHit || rv <= threshold;

  // ── Заклинивание (только для дальнобойного оружия со свойством надёжности) ──
  const jamAt    = jamThreshold(wp);
  const jammed   = !isMelee && jamAt !== null && rv >= jamAt;
  if (jammed) {
    const jamData = ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: jamCard({
        weaponName: item.name, rv, blocks: { props: buildPropertyChatBlock(wProps) }
      }),
      rolls: [roll],
      sound: CONFIG.sounds.dice
    }, rollMode);
    await ChatMessage.create(jamData);
    return;
  }

  // Место попадания. locationShift — сдвиг результата (±A.b) от Таланта/Черты
  // «сдвинуть место попадания» (kind:"script" Конструктора ставит на предмет
  // flags.warhammer-dbc.hitLocationShift = true; см. кнопки ниже, у карточки,
  // и обработчик в hooks.mjs — они переигрывают эту же атаку с тем же rv
  // через opts.forcedRoll, добавляя opts.locationShift).
  const { locRoll, label: rolledLoc } = hitLocation({ rv, hit, shift: opts.locationShift, aimTarget });
  let hitLocLabel = rolledLoc;

  // ── Цель — техника: место попадания по таблице машины (реверс броска),
  //    либо по указанной части при Избирательной атаке (aimTarget.vehiclePart).
  const targetIsVehicle = [...(game.user?.targets ?? [])]
    .some(t => (t.actor ?? t.document?.actor)?.type === "vehicle");
  let vehPart = null;
  if (targetIsVehicle) {
    vehPart = aimTarget?.vehiclePart || vehicleHitLocation(locRoll).label;
    hitLocLabel = vehPart;
  }

  // Место конкретного попадания: у техники 1-е и 2-е — в часть, остальные в Корпус;
  // у существ — множественные (3+) идут в Торс.
  const locForHit = (i) => locationForHit(i, {
    label: hitLocLabel, hitsCount, targetIsVehicle, vehiclePart: vehPart
  });

  // Math.max(1, …) не меняет обычный бросок (rv<=threshold уже даёт >=1) —
  // защищает только forceHit, когда рвущий d100 сам по себе был бы промахом.
  const deg = hit
    ? Math.max(1, Math.floor((threshold - rv) / 10) + 1)
    : Math.floor((rv - threshold) / 10) + 1;

  // Попадания и расход патронов
  const { count: hitsCount, label: rofLabel } = hitCount({
    hit, isMelee, rofMode, deg, wp, sys,
    isSwift: opts.isSwift, isLightning: opts.isLightning,
    // Потолок попаданий Быстрой/Молниеносной — бонус WS атакующего (стр. 14).
    wsBonus: Number(actor.system?.characteristics?.ws?.bonus) || 0
  });
  let ammoSpent = 0;

  // Талант/Черта «сдвинуть место попадания» (flags.warhammer-dbc.hitLocationShift
  // на предмете — ставится kind:"script" Конструктора при получении). «Одиночная
  // атака» — по формулировке пользователя это НЕ конкретно RoF-режим "single":
  // для стрелкового — да, "single" (Одиночный выстрел); для рукопашного — приём
  // "Обычная Атака" (module/constants/combat.mjs, MELEE_MANEUVERS.standard) или
  // вовсе без выбранного приёма (обычный клик по оружию, минуя вкладку «Приёмы»),
  // при режиме "melee"/"charge" (Натиск — тоже обычная атака, просто со штрафом/
  // бонусом на попадание, не меняет число ударов). Everywhere — ровно 1 попадание
  // (hitsCount===1: Стремительный/Молниеносный/Мульти-удар дают больше одного,
  // тогда сдвигать один результат на всех не имеет смысла) и не Избирательная
  // атака (там место уже выбрано вручную, locRoll не участвует).
  const meleeTech      = opts.techniqueOpts?.technique;
  const isMeleeStandard = isMelee && (rofMode === "melee" || rofMode === "charge")
    && (!meleeTech || meleeTech === "standard");
  const isRangedSingle  = !isMelee && rofMode === "single";
  const agBonus = Number(actor.system?.characteristics?.ag?.bonus) || 0;
  const hasLocShiftTalent = (actor.items ?? []).some(i =>
    (i.type === "trait" || i.type === "talent") && i.getFlag("warhammer-dbc", "hitLocationShift"));
  const canShiftLoc = hit && hitsCount === 1 && (isRangedSingle || isMeleeStandard)
    && !aimTarget?.value && agBonus > 0 && hasLocShiftTalent;

  // Тратим патроны
  let ammoWarning = "";
  if (!isMelee && rofMode !== "melee") {
    ammoSpent = _getAmmoSpent(item, rofMode) * (wp.ammoMult || 1) * (maximalOn ? 2 : 1);
    // При перебросе/+10 за Очко Судьбы это тот же выстрел — патроны не тратятся повторно.
    if (ammoSpent > 0 && !opts.skipAmmo) {
      const curMag = sys.magazineCur || 0;
      const newMag = Math.max(0, curMag - ammoSpent);
      await item.update({ "system.magazineCur": newMag });
      if (newMag === 0) {
        ammoWarning = `<div class="roll-allout-note">Магазин пуст! Требуется перезарядка.</div>`;
      } else if (newMag <= Math.ceil((sys.magazineMax || 1) * 0.25)) {
        ammoWarning = `<div class="roll-ammo-low">Патроны на исходе: ${newMag}/${sys.magazineMax}</div>`;
      }
    }
  }

  // Урон
  const chars     = actor.system.characteristics || {};   // у техники нет характеристик
  const isPsyker  = !!actor.system.isPsyker;
  const pr        = actor.system.psyker?.currentRating ?? 0;
  // Психосиловое в руках псайкера: +PR к урону и Pen (макс +10)
  const forceBonus = (wp.forcePR && isPsyker) ? Math.min(pr, 10) : 0;

  const pen = attackPenetration({
    base: effPen0 + ammoPenMod + (modFx.penMod || 0) + offPenMod + (qAuto.penMod || 0),
    wp, hit, deg, shortRange, maximal: maximalOn, band, forceBonus
  });

  const corVal   = Number(actor.system?.corruption?.value ?? 0);
  const dtLabel = DAMAGE_TYPES[ammoDmgType || effDmgType] || ammoDmgType || effDmgType;
  const sb      = chars.s?.bonus ?? 0;

  // Бонус Силы в рукопашной: Могучее ×2, Сдержанное = 0, Обратный хват ½
  const sbHalf = !!opts.gripSbHalf;
  const sbEff  = meleeStrengthBonus({ sb, wp, sbHalf });
  // Порча: +Cor.b владельца к урону
  const taintedAdd = wp.taintedCorB ? (actor.system.corruptionBonus ?? 0) : 0;

  const ammoCondDmg = Number(opts.ammoCondDmg) || 0;
  const bandDmg     = Number(band?.dmg) || 0;
  const flatBonus = (isMelee ? sbEff : 0) + taintedAdd + (isMelee ? 0 : ammoDmgMod + ammoCondDmg) + forceBonus + bandDmg + offDmgMod + (modFx.damageMod || 0) + (qAuto.damageMod || 0);
  const dmgFormula = damageFormulaFor({
    damage: effDamage, flatBonus, chars,
    corruptionBonus: actor.system.corruptionBonus ?? 0, wp, isMelee
  });

  // Доп. кубы урона: Меткое (одиночный, по СУ), Рассеивание (кор. дист.),
  // Максимальный режим (+1d10). Эти кубы НЕ вызывают Экстремальный урон.
  const bonusDice = bonusDamageDice({
    wp, rofMode, hit, deg, shortRange, maximal: maximalOn, band,
    ammoDice: ammoSys?.damageDiceMod
  });

  const damageRolls = [];
  const allRolls    = [roll];
  if (hit && hitsCount > 0 && (effDamage || isMelee)) {
    for (let i = 0; i < hitsCount; i++) {
      let dmgRoll = await new Roll(dmgFormula).evaluate();
      allRolls.push(dmgRoll);
      // Артиллерия (стр. 169): при прямом попадании бросает урон 2 раза и
      // выбирает лучший результат.
      if (wp.doubleDamageRoll) {
        const second = await new Roll(dmgFormula).evaluate();
        allRolls.push(second);
        if (second.total > dmgRoll.total) dmgRoll = second;
      }
      let deflagrateHit = false;
      if (dmgRoll.terms) {
        for (const term of dmgRoll.terms) {
          if (term.faces && term.results) {
            for (const r of term.results) {
              if (r.active && r.result >= 7) deflagrateHit = true;
            }
          }
        }
      }
      // Доп. кубы (Меткое/Рассеивание/Максимальное) — только к первому попаданию
      let total = dmgRoll.total;
      let bonusNote = 0;
      if (i === 0 && bonusDice > 0) {
        const bRoll = await new Roll(`${bonusDice}d10`).evaluate();
        allRolls.push(bRoll);
        total += bRoll.total;
        bonusNote = bRoll.total;
      }
      // Выгорание (Deflagrate): на 7–10 куба урона — доп. 1d10+X энерг. урона
      let deflagrateNote = 0;
      if (wp.deflagrate && deflagrateHit) {
        const dRoll = await new Roll(`1d10 + ${wp.deflagrateRating}`).evaluate();
        allRolls.push(dRoll);
        total += dRoll.total;
        deflagrateNote = dRoll.total;
      }
      // Мульти-удар (стр. 169): каждое попадание после первого получает
      // накапливающийся штраф −3 к урону (−3 на 2-е, −6 на 3-е, −9 на 4-е …).
      let msPenalty = 0;
      if (wp.multiStrikeRating > 0 && i > 0) {
        msPenalty = 3 * i;
        total = Math.max(0, total - msPenalty);
      }
      // Беспомощная цель: весь урон попадания ×2 ДО Поглощения (которое
      // применяется позже, отдельно, когда урон принимают по кнопке карточки).
      if (opts.doubleDamage) total *= 2;
      // У техники Экстремальный урон переводится в её Критический Эффект через
      // отрицательную Структуру (при применении урона), а не по таблице существ.
      const { hasExtreme, extremeLevel, critEffect, exRoll } = await rollExtremeDamage(dmgRoll, {
        wp, damageType: effDmgType, hitLocation: locForHit(i), targetIsVehicle
      });
      if (exRoll) allRolls.push(exRoll);
      damageRolls.push({ total, extremeLevel, hasExtreme, critEffect, bonusNote, deflagrateNote, msPenalty });
    }
  }

  // Место каждого попадания считается один раз: карточка печатает его и в
  // строке урона, и в кнопке применения урона.
  const hits = damageRolls.map((d, i) => ({ ...d, loc: locForHit(i) }));

  // Стр. 35: ГМ распределяет одно попадание в торс за каждый нечётный Успех
  // (1, 3, 5…) до максимума в выбранный RoF, по СЛУЧАЙНЫМ целям в секторе —
  // поэтому урон не бросается автоматически, карточка лишь называет их число.
  const supCap      = sys.rof_full || sys.rof_semi || 1;
  const suppression = (rofMode === "suppression" && hit)
    ? { pen:  sys.weaponClass === "heavy" ? "−20" : "±0",
        hits: Math.min(Math.ceil(deg / 2), supCap), cap: supCap }
    : null;

  // ── «Прячась в Орде» ─────────────────────────────────────────────────────
  // Цель стоит внутри союзной Орды (токены наложены), и не-Избирательный
  // выстрел половиной попаданий уходит в толпу: одиночный — по чётности броска,
  // очередь — каждым нечётным попаданием.
  const targetToken = [...(game.user?.targets ?? [])][0] ?? null;
  const shelter = hit && targetToken
    ? hidingInHordeSplit(targetToken, {
        hitsCount, rv, isMelee,
        burst: rofMode === "semi" || rofMode === "full",
        selective: !!aimTarget?.value
      })
    : null;
  const hordeHits = shelter
    ? shelter.mask.map(inHorde => inHorde ? (shelter.horde?.uuid || "") : "")
    : null;

  const techOpts = opts.techniqueOpts || {};

  // Перезарядка: оружие с Recharge и Максимальный режим стреляют раз в 2 хода.
  const needsRecharge = !isMelee && (wp.recharge || maximalOn);
  if (needsRecharge) await item.update({ "system.needsRecharge": true });

  // Просмотр кубов (#7) — стандартные «коробочки» Foundry, разворачиваемые кликом
  const renderedDice = (await Promise.all(allRolls.map(r => r.render()))).join("");

  const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: attackCard({
      actorName: actor.name, weaponName: item.name, wp,
      threshold, rv, hit, deg, hitsCount, hits, rerollDropped,
      modeLine: (isMelee && rofMode === "melee") ? "Рукопашная" : rofLabel,
      hitLocLabel, locRoll,
      locShift: canShiftLoc ? { max: agBonus, current: opts.locationShift || 0 } : null,
      isMelee, dtLabel, damageType: ammoDmgType || effDmgType, pen,
      sbEff, sbHalf, taintedAdd, vehicleSide: opts.vehicleSide || "",
      ammo: isMelee ? null : {
        name:   loadedAmmo?.name || "",
        mods:   loadedAmmo ? _buildAmmoModString(ammoSys) : "",
        magCur: sys.magazineCur ?? "?", magMax: sys.magazineMax ?? "?",
        spent:  ammoSpent, special: ammoSpecial,
        condLabels: opts.ammoCondLabels || [], warning: ammoWarning
      },
      band, suppression, corVal, corEffects: sys.corEffects || [],
      // Урон по Орде: Rng нужен Распылению, burst — Таланту «Свинцовый Дождь»,
      // uuid — чтобы найти Таланты и Размер стрелка.
      weaponRange: Number(sys.range) || 0,
      burst: rofMode === "semi" || rofMode === "full",
      attackerUuid: actor.uuid || "",
      hordeHits,
      // Выжигание Души: Психосиловое оружие в руках псайкера при попадании.
      soulBurnActorId: (hit && wp.forcePR && isPsyker) ? actor.id : null,
      defense: {
        dodgeMod: techOpts.targetDodgeMod ?? 0,
        parryMod: techOpts.targetParryMod ?? 0,
        // Переброс, НАВЯЗАННЫЙ защищающемуся (Локус Кровопролития): бросает его
        // цель у себя, а знает о нём атакующий — поэтому он едет атрибутом на
        // кнопках защиты в карточке.
        forcedDefenceReroll: opts.forcedDefenceReroll || "",
        targetIsVehicle, note: techOpts.chatNote
      },
      notes: {
        shelter: shelter
          ? `Цель прикрыта Ордой «${shelter.hordeToken.name ?? shelter.horde?.name}»: `
            + `${shelter.count} из ${hitsCount} попадан${shelter.count === 1 ? "ия уходит" : "ий уходят"} в толпу.`
          : "",
        attack:    opts.attackNote,
        helpless:  opts.doubleDamage
          ? "🪢 Цель Беспомощна: попадание автоматическое, урон ×2 (до Поглощения)."
          : "",
        technique: { label: techOpts.techniqueLabel, stance: techOpts.stanceLabel, note: techOpts.chatNote },
        aiming:    opts.aimingLabel,
        aim:       aimTarget?.value ? aimTarget.label.replace(/\s*\(.*\)/, "") : "",
        mount:     opts.mountNote || "",
        allOut:    !!opts.isAllOut,
        off:       offNote,
        maximal:   maximalOn,
        recharge:  needsRecharge
      },
      blocks: {
        props:         buildPropertyChatBlock(wProps),
        quality:       buildQualityChatBlock(item),
        splinter:      isSplinter(sys) ? splinterReminders() : "",
        targetEffects: buildTargetEffectButtons(wProps, { hit, netDamageKnown: false }),
        dice:          renderedDice
      }
    }),
    rolls: allRolls,
    sound: CONFIG.sounds.dice
  }, rollMode);

  // Сохраняем контекст атаки, чтобы переброс/+10 за Очко Судьбы могли
  // повторить именно эту атаку целиком (с местом попадания, уроном, защитой).
  // updateMessageId тоже выкидываем — это разовый маршрутизирующий флаг для
  // ЭТОГО вызова (см. ниже), а не часть повторяемого контекста атаки.
  const { forcedRoll, updateMessageId, ...storedOpts } = opts;
  messageData.flags = foundry.utils.mergeObject(messageData.flags || {}, {
    "warhammer-dbc": { attack: {
      actorId: actor.id, itemId: item.id, charKey, rv,
      threshold, rofMode, aimTarget: aimTarget ?? null, opts: storedOpts
    } }
  });

  // Сдвиг места попадания (кнопки карточки, см. attack-card.mjs/hooks.mjs) правит
  // СРАЗУ ТУ ЖЕ карточку — без updateMessageId (обычная атака, переброс, +10 и
  // т.п.) по-прежнему создаётся новое сообщение, как раньше.
  if (updateMessageId) {
    const existing = game.messages.get(updateMessageId);
    if (existing) { await existing.update(messageData); return; }
  }
  await ChatMessage.create(messageData);
}
