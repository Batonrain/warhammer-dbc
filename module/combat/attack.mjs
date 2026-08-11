import { CHARACTERISTICS }                         from "../constants/characteristics.mjs";
import { WEAPON_CLASSES, DAMAGE_TYPES }            from "../constants/items.mjs";
import { MELEE_STANCES }                           from "../constants/combat.mjs";
import { _degWord, _getAmmoSpent, _buildAmmoModString } from "../helpers/utils.mjs";
import { getCriticalEffect }                        from "../../critical-tables.mjs";
import { resolveWeaponProps, resolveWeaponPropsList, aggregateAuto,
         jamThreshold, buildPropertyChatBlock,
         buildTargetEffectButtons }                 from "./weapon-properties.mjs";
import { hitCount, hitLocation, locationForHit, meleeStrengthBonus,
         attackPenetration, damageFormulaFor, bonusDamageDice } from "./attack-outcome.mjs";
import { effectiveDamage, mergeExtraProps, weaponOffEffects } from "./attack-weapon.mjs";
import { getModEffects, mergeWeaponPropEntries }    from "./weapon-mods.mjs";
import { qualityEffects, buildQualityChatBlock }    from "../constants/quality.mjs";
import { splinterFullAutoTearing, isSplinter, splinterReminders } from "../constants/drukhari-splinter.mjs";
import { vehicleHitLocation }                        from "../constants/vehicle.mjs";

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
    condProps:   opts.ammoCondProps || []
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
  const roll     = (opts.forcedRoll != null)
    ? await new Roll(String(Math.max(1, Math.min(100, opts.forcedRoll)))).evaluate()
    : await new Roll("1d100").evaluate();
  const rv       = roll.total;
  const rollMode = game.settings.get("core", "rollMode");
  const hit      = rv <= threshold;

  // ── Заклинивание (только для дальнобойного оружия со свойством надёжности) ──
  const jamAt    = jamThreshold(wp);
  const jammed   = !isMelee && jamAt !== null && rv >= jamAt;
  if (jammed) {
    const jamData = ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="wh-roll-result">
          ${buildPropertyChatBlock(wProps)}
          <div class="roll-header">${item.name}</div>
          <div class="roll-statline">
            <span class="roll-stat"><label>Бросок</label><b>${rv}</b></span>
          </div>
          <div class="roll-outcome">
            <span class="roll-failure">Оружие заклинило! Требуется действие на устранение Клина.</span>
          </div>
        </div>`,
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

  const deg = hit
    ? Math.floor((threshold - rv) / 10) + 1
    : Math.floor((rv - threshold) / 10) + 1;

  // Попадания и расход патронов
  const { count: hitsCount, label: rofLabel } = hitCount({
    hit, isMelee, rofMode, deg, wp, sys,
    isSwift: opts.isSwift, isLightning: opts.isLightning
  });
  let ammoSpent = 0;

  // Талант/Черта «сдвинуть место попадания» (flags.warhammer-dbc.hitLocationShift
  // на предмете — ставится kind:"script" Конструктора при получении). «Одиночная
  // атака» — по формулировке пользователя это НЕ конкретно RoF-режим "single":
  // для стрелкового — да, "single" (Одиночный выстрел); для рукопашного — приём
  // "Обычная Атака" (module/constants/combat.mjs, MELEE_TECHNIQUES.standard) или
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
  // Кнопки правят СРАЗУ эту же карточку (см. hooks.mjs) — не переигрывают
  // атаку заново отдельным сообщением, поэтому доступны и на уже сдвинутой
  // карточке (можно передумать, потыкать ещё раз до применения урона).
  const locShiftHtml = canShiftLoc ? `
    <div class="roll-defense-section roll-loc-shift">
      <div class="roll-defense-title">Сдвинуть место попадания (±${agBonus}, A.b) — только ${actor.name}</div>
      <div class="roll-defense-btns">
        ${Array.from({ length: agBonus }, (_, i) => agBonus - i)
          .map(n => `<button type="button" class="wh-locshift-btn" data-shift="-${n}" ${(opts.locationShift || 0) === -n ? "disabled" : ""}>−${n}</button>`).join("")}
        <button type="button" class="wh-locshift-btn" data-shift="0" ${!opts.locationShift ? "disabled" : ""}>Без сдвига</button>
        ${Array.from({ length: agBonus }, (_, i) => i + 1)
          .map(n => `<button type="button" class="wh-locshift-btn" data-shift="${n}" ${(opts.locationShift || 0) === n ? "disabled" : ""}>+${n}</button>`).join("")}
      </div>
    </div>` : "";

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

  // Эффекты, открывающиеся по Порче владельца (стр. 220, Чёрная Булава):
  // печатаем только те, что уже доступны при текущей Cor, — остальные молчат.
  const corVal   = Number(actor.system?.corruption?.value ?? 0);
  const corNotes = (sys.corEffects || [])
    .filter(e => corVal >= (Number(e.cor) || 0))
    .map(e => `<div class="roll-wprop-note">Порча ${e.cor}+: ${e.text}</div>`)
    .join("");

  const dtLabel = DAMAGE_TYPES[ammoDmgType || effDmgType] || ammoDmgType || effDmgType;
  const sb      = chars.s?.bonus ?? 0;

  // Бонус Силы в рукопашной: Могучее ×2, Сдержанное = 0
  const sbEff = meleeStrengthBonus({ sb, wp });
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
      let hasExtreme = false;
      let deflagrateHit = false;
      if (dmgRoll.terms) {
        for (const term of dmgRoll.terms) {
          if (term.faces && term.results) {
            // Экстремальное (X): порог = рейтинг; иначе максимум кубика
            const thr = wp.extremeThreshold < 10 ? wp.extremeThreshold : term.faces;
            for (const r of term.results) {
              if (r.active && r.result >= thr) hasExtreme = true;
              if (r.active && r.result >= 7)   deflagrateHit = true;
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
      let extremeLevel = 0, critEffect = null;
      if (hasExtreme) {
        const exRoll = await new Roll("1d5").evaluate();
        allRolls.push(exRoll);
        extremeLevel = exRoll.total;
        // У техники Экстремальный урон переводится в её Критический Эффект через
        // отрицательную Структуру (при применении урона), а не по таблице существ.
        if (!targetIsVehicle) {
          const thisLoc = locForHit(i);
          critEffect = getCriticalEffect(effDmgType, thisLoc, extremeLevel);
        }
      }
      damageRolls.push({ total, extremeLevel, hasExtreme, critEffect, bonusNote, deflagrateNote, msPenalty });
    }
  }

  const hitLines = damageRolls.map((d, i) => {
    const loc    = locForHit(i);
    const extStr = d.hasExtreme ? `
      <div class="roll-extreme-block">
        <b>Экстремальный урон</b> · d5: ${d.extremeLevel}
        ${d.critEffect ? `<div class="roll-crit-effect">${d.critEffect}</div>` : ""}
      </div>` : "";
    const bonusStr = d.bonusNote
      ? `<span class="roll-bonus-dice">+${d.bonusNote} доп.</span>` : "";
    const deflStr = d.deflagrateNote
      ? `<span class="roll-bonus-dice">+${d.deflagrateNote} выгор.</span>` : "";
    const msStr = d.msPenalty
      ? `<span class="roll-hit-pen">−${d.msPenalty} мульти-удар</span>` : "";
    return `<div class="roll-hit-line">
      <span class="roll-hit-idx">Попадание ${i + 1}</span>
      <span class="roll-hit-dmg">${d.total}</span>
      <span class="roll-hit-loc">${loc}</span>
      ${bonusStr || deflStr || msStr ? `<span class="roll-hit-extra">${bonusStr}${deflStr}${msStr}</span>` : ""}
    </div>${extStr}`;
  }).join("");

  let suppressionHtml = "";
  if (rofMode === "suppression" && hit) {
    const supPen = sys.weaponClass === "heavy" ? "−20" : "±0";
    // Стр. 35: ГМ распределяет одно попадание в торс за каждый нечётный Успех
    // (1, 3, 5…) до максимума в выбранный RoF, по СЛУЧАЙНЫМ целям в секторе —
    // поэтому не бросаем урон автоматически, а подсказываем число попаданий.
    const supCap  = sys.rof_full || sys.rof_semi || 1;
    const supHits = Math.min(Math.ceil(deg / 2), supCap);
    suppressionHtml = `<div class="roll-suppression">
      Подавление: все в секторе 45° проходят тест Подавление (${supPen})<br>
      ГМ распределяет <b>${supHits}</b> попадан${supHits === 1 ? "ие" : supHits < 5 ? "ия" : "ий"} в торс
      по случайным целям в секторе (нечётные Успехи, максимум RoF ${supCap})
    </div>`;
  }

  const allOutNote = opts.isAllOut
    ? `<div class="roll-allout-note">Атака всем телом — Уклонение недоступно до следующего хода</div>`
    : "";

  const techOpts      = opts.techniqueOpts || {};
  const techniqueHtml = techOpts.techniqueLabel ? `
    <div class="roll-technique-block">
      Приём: <b>${techOpts.techniqueLabel}</b>
      ${techOpts.stanceLabel ? ` | Стойка: <b>${techOpts.stanceLabel}</b>` : ""}
      ${techOpts.chatNote ? `<div class="roll-technique-note">${techOpts.chatNote}</div>` : ""}
    </div>` : "";

  const aimingNote = opts.aimingLabel
    ? `<div class="roll-aiming-note">${opts.aimingLabel}</div>` : "";

  let ammoInfoHtml = "";
  if (!isMelee) {
    const modStr = loadedAmmo ? _buildAmmoModString(ammoSys) : "";
    const magCur = sys.magazineCur ?? "?";
    const magMax = sys.magazineMax ?? "?";
    ammoInfoHtml = `
      <div class="roll-ammo-block${!loadedAmmo ? " roll-ammo-none" : ""}">
        Боеприпасы: <b>${loadedAmmo ? loadedAmmo.name : "стандартные"}</b>
        ${modStr ? `<span class="roll-ammo-mods">(${modStr})</span>` : ""}
        | Магазин: <b>${magCur}/${magMax}</b>
        ${ammoSpent > 0 ? `<span class="roll-ammo-spent">(израсходовано: ${ammoSpent})</span>` : ""}
        ${ammoSpecial ? `<div class="roll-ammo-special">${ammoSpecial}</div>` : ""}
        ${(opts.ammoCondLabels || []).length
          ? `<div class="roll-ammo-cond">Учтено: ${opts.ammoCondLabels.join("; ")}</div>` : ""}
      </div>
      ${ammoWarning}`;
  }

  const targetDodgeMod = techOpts.targetDodgeMod ?? 0;
  const targetParryMod = techOpts.targetParryMod ?? 0;
  const cannotDodge    = targetDodgeMod <= -900;
  // Гибкое оружие: эту атаку нельзя парировать
  const cannotParry    = wp.flexible || targetParryMod <= -900;
  // (targetIsVehicle вычислен выше — Вираж предлагаем только по технике.)

  const defenseButtons = hit ? `
    <div class="roll-defense-section">
      <div class="roll-section-head">Защита цели <span class="roll-head-hint">— выберите токен защищающегося</span></div>
      <div class="roll-defense-btns">
        ${cannotDodge
          ? `<button class="wh-dodge-btn wh-dodge-disabled" disabled>
               Уклонение (невозможно)
             </button>`
          : `<button class="wh-dodge-btn" type="button" data-extra-mod="${targetDodgeMod}" data-attack-deg="${deg}">
               Уклонение${targetDodgeMod !== 0 ? ` (${targetDodgeMod >= 0 ? "+" : ""}${targetDodgeMod})` : ""}
             </button>`
        }
        ${cannotParry
          ? `<button class="wh-parry-btn wh-dodge-disabled" disabled>
               Парирование (невозможно${wp.flexible ? " — Гибкое" : ""})
             </button>`
          : `<button class="wh-parry-btn" type="button" data-extra-mod="${targetParryMod}" data-attack-deg="${deg}">
               Парирование${targetParryMod !== 0 ? ` (${targetParryMod >= 0 ? "+" : ""}${targetParryMod})` : ""}
             </button>`
        }
        ${targetIsVehicle
          ? `<button class="wh-swerve-btn" type="button" data-extra-mod="0" data-attack-deg="${deg}"
               title="Техника: Operate − Размер×10">Вираж</button>`
          : ""}
      </div>
      ${techOpts.chatNote && (targetDodgeMod !== 0 || targetParryMod !== 0 || cannotDodge)
        ? `<div class="roll-defense-note">${techOpts.chatNote}</div>` : ""}
    </div>` : "";

// В конце _executeAttackRoll, перед ChatMessage.create:

// Кнопка применения урона (только если было попадание и есть урон)
const applyDmgButtons = (hit && damageRolls.length > 0) ? damageRolls.map((d, i) => {
  const loc    = locForHit(i);
  return `<button class="wh-apply-dmg-btn" type="button"
    data-damage="${d.total}"
    data-penetration="${pen}"
    data-damage-type="${ammoDmgType || effDmgType}"
    data-hit-location="${loc}"
    data-vehicle-side="${opts.vehicleSide || ""}"
    data-weapon-name="${item.name}"
    data-attacker="${actor.name}"
    data-felling="${wp.fellingRating}"
    data-primitive="${wp.primitive ? 1 : 0}"
    data-ignore-shield="${wp.ignoreShield ? 1 : 0}"
    data-warp-soak="${wp.warpSoak ? 1 : 0}"
    data-lance="${wp.lance ? 1 : 0}"
    data-sanctified="${wp.sanctified ? 1 : 0}">
    Применить урон ${i+1}: <b>${d.total}</b> → ${loc}
  </button>`;
}).join("") : "";

const applyDmgSection = applyDmgButtons ? `
  <div class="roll-apply-dmg-section">
    <div class="roll-section-head">Применить к цели <span class="roll-head-hint">— выберите токен</span></div>
    ${applyDmgButtons}
  </div>` : "";

  const hitCountNote  = hitsCount > 1 ? ` (${hitsCount} попадани${hitsCount < 5 ? "я" : "й"})` : "";
  const modeLine      = (isMelee && rofMode === "melee") ? "Рукопашная" : rofLabel;
  const outcomeHtml   = hit
    ? `<span class="roll-success">Попадание — ${deg} ${_degWord(deg)}${hitCountNote}</span>`
    : `<span class="roll-failure">Промах — ${deg} ${_degWord(deg)}</span>`;
  const aimNote = aimTarget?.value
    ? `<div class="roll-aim-note">Прицел: <b>${aimTarget.label.replace(/\s*\(.*\)/, "")}</b></div>`
    : "";
  const sbNote = isMelee
    ? `, S.b +${sbEff}${wp.mightySB ? " (Могучее ×2)" : wp.containedSB ? " (Сдержанное)" : ""}`
    : "";
  const taintedNote = taintedAdd ? `, Порча +${taintedAdd}` : "";
  const damageSection = damageRolls.length > 0 ? `
    <div class="roll-damage-section">
      <div class="roll-section-head">Урон</div>
      <div class="roll-damage-meta">${dtLabel} · Пробитие ${pen}${sbNote}${taintedNote}</div>
      ${hitLines}
    </div>` : "";

  // Блок особых свойств и кнопки эффектов на цель
  const wPropsBlock     = buildPropertyChatBlock(wProps);
  const targetEffectBtns = buildTargetEffectButtons(wProps, { hit, netDamageKnown: false });

  // Выжигание Души: для Психосилового оружия в руках псайкера при попадании
  const soulBurnBtn = (hit && wp.forcePR && isPsyker) ? `
    <div class="roll-wprop-effects">
      <button class="wh-soulburn-btn" type="button" data-attacker-id="${actor.id}">
        Выжигание Души (выберите токен цели)
      </button>
    </div>` : "";

  // Перезарядка: пометить, что оружие требует подзарядки (Recharge или Максимальный режим)
  let rechargeNote = "";
  if ((wp.recharge || maximalOn) && !isMelee) {
    await item.update({ "system.needsRecharge": true });
    rechargeNote = `<div class="roll-allout-note">Перезарядка: следующий ход — подзарядка (стрелять можно раз в 2 хода).</div>`;
  }
  const maximalNote = maximalOn
    ? `<div class="roll-allout-note">Максимальный режим: +1d10 урона, +2 Проб., Взрыв(2), ×2 расход, Перезарядка.</div>`
    : "";

  // Просмотр кубов (#7) — стандартные «коробочки» Foundry, разворачиваемые кликом
  const renderedDice = (await Promise.all(allRolls.map(r => r.render()))).join("");
  const diceDetails = `
    <details class="roll-dice-details">
      <summary>Показать кубы</summary>
      ${renderedDice}
    </details>`;

    const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        ${techniqueHtml}
        ${aimingNote}
        ${ammoInfoHtml}
        <div class="roll-header">${item.name}</div>
        ${opts.attackNote
          ? `<details class="roll-collapsible roll-note-collapsible">
               <summary class="roll-section-head"><span class="roll-sum-title">Хват и приёмы</span></summary>
               <div class="roll-threshold" style="font-size:0.82em;">${opts.attackNote}</div>
             </details>`
          : ""}
        ${wPropsBlock}
        ${buildQualityChatBlock(item)}
        ${isSplinter(sys) ? splinterReminders() : ""}
        <div class="roll-statline">
          <span class="roll-stat"><label>Порог</label><b>${threshold}</b></span>
          <span class="roll-stat"><label>Режим</label><b>${modeLine}</b></span>
          <span class="roll-stat"><label>Бросок</label><b>${rv}</b></span>
        </div>
        <div class="roll-outcome">${outcomeHtml}</div>
        ${hit && hitsCount > 0
          ? `<div class="roll-location">Место попадания: <b>${hitLocLabel}</b> (${locRoll})</div>`
          : ""}
        ${locShiftHtml}
        ${aimNote}
        ${damageSection}
        ${maximalNote}
        ${offNote ? `<div class="roll-wprop-note">${offNote}</div>` : ""}
        ${corNotes}
        ${band ? `<div class="roll-wprop-note">Дистанция: ${band.label}${band.dice ? ` (+${band.dice}d10 урона)` : ""}${band.dmg ? ` (+${band.dmg} урона)` : ""}${band.pen ? ` (+${band.pen} Проб.)` : ""}</div>` : ""}
        ${wp.devastatingRating ? `<div class="roll-wprop-note">Опустошительное (${wp.devastatingRating}): по Орде +${wp.devastatingRating} урона в Магнитуду</div>` : ""}
        ${wp.wreckerRating ? `<div class="roll-wprop-note">Крушитель (${wp.wreckerRating}): +${wp.wreckerRating}d10 по земле/камню/рокриту/стеклу, AP таких укрытий вдвое меньше</div>` : ""}
        ${wp.ordnance ? `<div class="roll-wprop-note">Артиллерия: все прочие атаки стрелка до начала его следующего Хода получают ${wp.otherAttacksMod}</div>` : ""}
        ${suppressionHtml}
        ${allOutNote}
        ${rechargeNote}
        ${diceDetails}
        ${defenseButtons}
        ${applyDmgSection}
        ${soulBurnBtn}
        ${targetEffectBtns}
      </div>`,
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

  // Сдвиг места попадания (см. locShiftHtml/hooks.mjs) правит СРАЗУ ТУ ЖЕ
  // карточку — без updateMessageId (обычная атака, переброс, +10 и т.п.)
  // по-прежнему создаёт новое сообщение, как раньше.
  if (updateMessageId) {
    const existing = game.messages.get(updateMessageId);
    if (existing) { await existing.update(messageData); return; }
  }
  await ChatMessage.create(messageData);
}