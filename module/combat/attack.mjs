import { CHARACTERISTICS }                         from "../constants/characteristics.mjs";
import { pickReroll } from "../rules/reroll-pick.mjs";
import { hasHitLocationShift } from "../rules/hit-location-shift.mjs";
import { criticalOutcome } from "../rules/roll-outcome.mjs";
import { critLineHtml } from "../rules/test-kind-widget.mjs";
import { WEAPON_CLASSES, DAMAGE_TYPES }            from "../constants/items.mjs";
import { MELEE_STANCES, parseGrips }                from "../constants/combat.mjs";
import { _getAmmoSpent, _buildAmmoModString, esc }  from "../helpers/utils.mjs";
import { getCriticalEffect }                        from "../../critical-tables.mjs";
import { resolveWeaponProps, resolveWeaponPropsList, aggregateAuto,
         jamThreshold, sprayJamFace, sprayJams, buildPropertyChatBlock,
         buildTargetEffectButtons, hasWeaponPropertyImmunity }
                                                      from "./weapon-properties.mjs";
import { hitCount, hitLocation, locationForHit, meleeStrengthBonus,
         attackPenetration, damageFormulaFor, bonusDamageDice,
         attackHitOutcome }                          from "./attack-outcome.mjs";
import { effectiveDamage, mergeExtraProps, weaponOffEffects } from "./attack-weapon.mjs";
import { attackIsMelee, FIRED_BRACED_FLAG, firedBracedHeavyIds,
         profileHasOwnFire, sysWithProfileFire, authoredProfileIndex, profileFireUpdate } from "./weapon-profiles.mjs";
import { isBraced } from "./brace-weapon.mjs";
import { tandemReliabilityPenalty } from "../rules/tandem.mjs";
import { hasBatpackDump, batpackStormRating, BATPACK_BONUS_DICE, BATPACK_ROF } from "../rules/batpack-dump.mjs";
import { isIntegralAttack } from "./equipped-melee.mjs";
import { unarmedLosesPrimitive, grappleUnparryable, wrestlerDodgeReroll, haymakerApplies, haymakerDamageBonus, HAYMAKER_FORFEIT_FLAG,
  goadingStrikeApplies, LEG_ATTACKS_FLAG } from "../rules/pugilist-talents.mjs";
import { goadingStrikeButtonHtml } from "./pugilist-strikes.mjs";
import { whackStrike, recordWhackSeen } from "./whack.mjs";
import { roundhouseButtonHtml, isKickWeapon } from "./roundhouse.mjs";
import { grappleCoverPartner } from "./grapple.mjs";
import { fanaticInterceptCandidates, backToBackFreeUseAvailable } from "./fanatic-redirect.mjs";
import { unholyDevotionCandidates } from "./unholy-devotion.mjs";
import { ammoIsFree } from "../rules/ammo-free.mjs";
import { attackCard, jamCard }                      from "./attack-card.mjs";
import { rollScatter }                               from "./scatter.mjs";
import { getModEffects, mergeWeaponPropEntries }    from "./weapon-mods.mjs";
import { qualityEffects, buildQualityChatBlock }    from "../constants/quality.mjs";
import { splinterFullAutoTearing, isSplinter, splinterReminders } from "../constants/drukhari-splinter.mjs";
import { vehicleHitLocation }                        from "../constants/vehicle.mjs";
import { isWalkerVehicle }                            from "../rules/walker.mjs";
import { minionCanCauseExtremeDamage }                from "../rules/squad-roles.mjs";
import { measureTokens }                              from "./tactical-map.mjs";
import { lockingContactTokenDocs, allContactTokenDocs } from "./free-attack.mjs";
import { feintBlocksEvasion } from "./feint-press.mjs";
import { resolveGrenadeMeleeFumble, resolveFlailMeleeFumble } from "./draw-action.mjs";
import { hidingInHordeSplit }                        from "./horde-tokens.mjs";
import { applyGrappleOnHit, isBiteWeapon }             from "./grapple.mjs";
import { bodyguardsFor }                               from "./bodyguard.mjs";
import { hasDodgeTalent }                              from "../rules/dodge-talents.mjs";
import { coveringDefendersOf, offerFreeAttack }        from "./free-attack.mjs";
import { rollOgrynWeaponBreak, ogrynBreakNote }      from "./ogryn-weapon-break.mjs";
import { getEvasionPool, poolAffordableHits }         from "./evasion-pool.mjs";
import { activeSwarm }                                from "../rules/ethereal-swarm.mjs";
import { consumeHiddenThreatPending }                 from "../rules/hidden-threat.mjs";
import { consumeHairTriggerUnseenPending }            from "../rules/hair-trigger.mjs";
import { isUnseenDetected }                           from "../rules/unseen-attack.mjs";
import { hasSixthSense, hasMusicOfBattle, hasBlindFighting, hasBackstab, isKnifeWeapon, hasSniperAssassin, isBlindsideMarked, consumeBlindsideMark } from "../rules/unseen-talents.mjs";
import { isOutsideDefenderView, resolveAttackerToken } from "./facing.mjs";
import { sabotageWeaponOf, hasRogueTalent, razorsEdgeBonus, razorsEdgeEvasionHits, coupDeGraceActive,
  criticalEffectFlatBonus, bladeJugglerMarkAgainst, consumeBladeJugglerMark } from "../rules/rogue-talents.mjs";
import { sabotageButtonHtml } from "./sabotage.mjs";
import { hasQuietElimination } from "../rules/quiet-elimination.mjs";
import { hasJanusRearVision } from "../rules/janus.mjs";
import { sunderingDamageFormula, SUNDERING_COPY_FLAG } from "../rules/sundering.mjs";
import { recoilRemaining as recoilPoolRemaining }     from "./recoil-pool.mjs";
import { suppressionTestMod }                         from "./suppression.mjs";
import { gunGuardCancelsDodgeBonus, savageExtraHits, pounderPair, firstHandHitNow, tyranthikosDiceNow }
                                                      from "../rules/dual-wield-talents.mjs";
import { attackedThisTurn }                           from "../rules/turn-flags.mjs";
import { prismaFireBonus, halvePrismaCharge }         from "./prisma.mjs";
import { attackEntropyRating } from "./touch-of-entropy.mjs";
import { touchOfPainActive } from "./touch-of-pain.mjs";
import { withWitchsEdge }                             from "./witchs-edge.mjs";
import { ironGardenRating, ironGardenQuality }        from "../rules/iron-garden.mjs";
import { hasHussar }                                  from "./sabre-second-attack.mjs";
import { dreadWailWeaponBonus }                       from "./dread-wail.mjs";
import { bloodFlameDamageBonus }                      from "../rules/blood-flame.mjs";
import { preciseLegacyDamageBonus, wrathLegacyDamageBonus, legacyWrathEffectiveRof, betrayalLegacyActive, legacyHistoryIs, excessLegacyExtraDeg, bloodLegacyDamageBonus, legacyChangeDamageBonus, takenMutationNames, swiftLegacyRangedDodgePenalty, swiftLegacyMeleeDodgePenalty, dishonorableLegacyActive, distractingLegacyActive, DISTRACTING_LEGACY_FLAG, LEGACY_GUARDIAN_FLAG, earlyDeathLegacyDamageBonus, markEarlyDeathLegacyUsed, adaptiveLegacyMeleeDamageBonus, pendulumLegacyFlagValue, incrementPunisherLegacyStack, soulboundLegacyDamageBonus, consumeSoulboundLegacyBonus, legacyDeadlyTrapEligible, legacyDeadlyTrapDamageDelta, consumeLegacySlaughterBonus, legacySlaughterAmmoReliability, patienceLegacyOverwatchWeapon, consumePatienceLegacyOverwatchPending } from "../rules/legacy-weapon.mjs";
import { adroitDegreeBonus } from "../rules/adroit.mjs";
import { isActorsOwnTurn } from "./delay-action.mjs";
import { meleeContactCount } from "./tactical-map.mjs";
import { betrayalRandomAllyToken } from "./legacy-weapon-betrayal.mjs";
import { actorInfamyValue, actorInfamyPath, spendFromInfamyPool } from "../apps/infamy-points.mjs";
import { handOfKhorneStrengthMultiplier, handOfKhorneBlocksRangedAttack } from "../rules/hand-of-khorne.mjs";
import { triggerAttackAnimation }                     from "../integrations/autoanimations.mjs";
import { assassinStrikeAvailable }                    from "./assassin-strike.mjs";
import { tankHunterForAttack }                        from "./tank-hunter.mjs";
import { clobberOfferFor, clobberOfferHtml }          from "./clobber.mjs";
import { resolveGrenadeCooking }                       from "./grenade-cooking.mjs";
import { terrorSniperEligible }                       from "../rules/terror-sniper.mjs";
import { misfireCandidates, hasTargetSelection }      from "../rules/target-selection.mjs";
import { laserDotOffered }                            from "../rules/laser-sight.mjs";
import { hasFlamerTalent, pyromaniacActive, torrentActive, torrentBlastRadius, torrentMaxDistance } from "../rules/flamer-talents.mjs";
import { freeShotLocksAim, hasBayonetCharge, BAYONET_SHOT_PENDING_FLAG } from "../rules/run-and-gun.mjs";
import { bayonetShotButtonsHtml } from "./free-shot.mjs";
import { evasionImperativeBonus, hasEvasionRecoilImperative } from "./imperative-bonuses.mjs";
import { isFusedByHandOfDeath }                       from "../rules/hand-of-death.mjs";
import { counterAttackTriggers, counterAttackSectionHtml } from "./counter-attack.mjs";
import { invocationNaturalAdd } from "../rules/invocation-natural.mjs";
import { suffersBlindness } from "../rules/blindness.mjs";
import { evadesHordeAsSingle } from "../rules/horde-single-target.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { POISONER_CAP } from "../rules/medic-talents.mjs";
import { hasTalentCapability } from "../rules/ability-by-key.mjs";
import { surgicalPrecisionButtonHtml } from "./surgical-precision.mjs";
import { balearicSbBonus, grenadierScatterReduce, volleyThrowApplies, volleyRof, grenadeCookingDodgePenalty } from "../rules/throwing-talents.mjs";
import { crushingBlowBonus, mightyShotDamage, plasmaExpertiseReliability, plasmaMasteryBonus } from "../rules/damage-talents.mjs";
import { maximalBlastRating, maximalBlastNote, maximalRange } from "../rules/maximal-mode.mjs";
import { COMMAND_SUPPRESSED_FLAG, commandSuppressedNow } from "../rules/command-suppression.mjs";
import { fleshRenderExtraDrop, raptorBonusDice, unstoppableChargeFelling, hamstringArmed, tenacityOffered } from "../rules/melee-talents.mjs";
import { hammerBlowEffect, killingStrikeApplies, KILLING_STRIKE_FLAG, furiousAssaultOffered, oneWillGoDownApplies } from "../rules/berserker-talents.mjs";
import { oneWillGoDownButtonHtml, rollOneWillGoDownHandDamage } from "./one-will-go-down.mjs";
import { markFullAttack, markFuriousChild } from "./full-attack-lock.mjs";
import { furiousAssaultButtonHtml } from "./furious-assault.mjs";
import { tenacityButtonHtml } from "./tenacity.mjs";
import { executionOfferHtml } from "./execution.mjs";
import { shockerGrantsShocking, wallopConcussiveRating, sparksAvailable, welderMarksHit, irradiateMode,
  lensTuningShot, LENS_CHARGES_FLAG, litanyReliability, litanyCoversWeapon, LITANY_CLEANED_FLAG,
  weaponTechShot, WEAPON_TECH_SPENT_FLAG, igniterZone, IGNITER_NOTES } from "../rules/gunsmith-talents.mjs";
import { saturationFireCoverShots, sureShotApplies, sureShotDodgePenalty, cageFiringApplies, CAGE_FIRING_EVADE_COST, controlledBurstApplies, controlledBurstRof, eyeOfVengeanceBonus, eyeOfVengeanceAvailable, EYE_OF_VENGEANCE_FLAG, crackShotBonus, cripplingStrikeBonus, doubleTapActive, doubleTapLocation, doubleTapHits, onThisMarkActive, appliedPhysicsShift } from "../rules/gunner-talents.mjs";
import { isBiteName } from "../rules/integral-rating.mjs";
import { VENOM_BITE_CAPABILITY, venomBiteDamage, isBiteAttack, ADAPTIVE_VENOM_DOSE_FLAG } from "../rules/naga-traits.mjs";
import { fieldDisablesWeapon, fieldForbidsShot } from "../rules/null-zones.mjs";
import { isHeadHit } from "./armor-properties.mjs";
import { COLD_KILLER } from "../rules/cold-killer.mjs";
import { LEGIONNAIRE_VIRTUOSO, isLegionRangedWeapon } from "../rules/legionnaire-virtuoso.mjs";
import { SKY_PREDATOR, activeDieResults, isChargeFromFlight, swapDiceFor } from "../rules/die-swap.mjs";
import { IN_FLIGHT_ALTITUDES } from "./movement-actions.mjs";
import { singleCombatBonus } from "./single-combat.mjs";
import { butcherStatus } from "./beastman-subrace.mjs";

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
 * @param {?Actor}  [attacker] стрелок/боец, нанёсший этот урон — нужен только
 *   для гейта Маловажных NPC ниже (wdbc-x1nz.2.51); null у путей, где стрелок
 *   не актор Foundry (карточки без атакующего) — тогда гейт не применяется.
 */
export async function rollExtremeDamage(dmgRoll, { wp, damageType, hitLocation = "Торс", targetIsVehicle = false, attacker = null, weapon = null }) {
  let hasExtreme = false;
  if (dmgRoll.terms) {
    for (const term of dmgRoll.terms) {
      if (term.faces && term.results) {
        const thr = wp.extremeThreshold < 10 ? wp.extremeThreshold : term.faces;
        for (const r of term.results) {
          if (r.active && r.result >= thr) hasExtreme = true;
          // Мучитель/merciless 10-10, Оружие Наследия (wdbc-1rno.35, стр.
          // 428): «Броски в 1 на кубиках урона оружия вызывают Экстремальный
          // Урон» — отдельное условие ПОВЕРХ обычного порога, не замена.
          if (wp.legacyExtremeOnOne && r.active && r.result === 1) hasExtreme = true;
        }
      }
    }
  }
  // Маловажные NPC (стр. 34, wdbc-x1nz.2.51): «не могут наносить Экстремальный
  // Урон» без Командного Присутствия «Экстремальный Урон» от своего Отряда/
  // Командира (rules/squad-roles.mjs::minionCanCauseExtremeDamage). Гасится
  // ДО броска d5 — не получивший способность миньон вообще не откатывает
  // Крит. Эффект, не только прячет его в карточке.
  if (hasExtreme && attacker && !minionCanCauseExtremeDamage(attacker)) hasExtreme = false;
  let extremeLevel = 0, critEffect = null, exRoll = null;
  if (hasExtreme) {
    // Трата Очка — в момент Экстремального Урона, а не при нажатии «Бросок»
    // (приёмка #516: промах или удар без Экстремального сжигал Очко впустую).
    // Одна на всю атаку — см. комментарий у legacyCleavingRollRequested.
    if (wp.legacyCleavingRollRequested && !wp.legacyCleavingRollSpent) {
      wp.legacyCleavingRollSpent = true;
      if (attacker && actorInfamyValue(attacker) >= 1) {
        const path = actorInfamyPath(attacker);
        const spend = await spendFromInfamyPool(attacker, 1, path);
        if (spend) {
          await attacker.update({ [path]: spend.poolValue });
          wp.legacyCleavingRollActive = true;
        }
      } else {
        ui.notifications?.warn("Кромсающее: нет Очков Бесчестия — обычный бросок 1d5+1.");
      }
    }
    // Кромсающее, второе предложение (wdbc-1rno.35, стр. 427): «...может
    // потратить Очко Бесчестия, чтобы бросить ВМЕСТО ЭТОГО 1d10−2(мин.1)» —
    // замена всего обычного «1d5+1» целиком, включая extremeLevelBonus,
    // которым как раз и представлен книжный «+1» самой Мутации выше.
    if (wp.legacyCleavingRollActive) {
      exRoll = await new Roll("1d10").evaluate();
      extremeLevel = Math.max(1, exRoll.total - 2);
    } else {
      exRoll = await new Roll("1d5").evaluate();
      // Monofilament (X): «+2 Экстремальный урон ИЛИ Крит. эффект» — здесь
      // extremeLevel сразу задаёт оба (getCriticalEffect читает его же).
      extremeLevel = exRoll.total + (wp.extremeLevelBonus || 0);
    }
    // Оппортунист/versatile 10-10, Оружие Наследия (wdbc-1rno.35, стр. 427):
    // «Оружие бросает на Экстремальный Урон два раза и выбирает больший
    // результат» — второй независимый бросок ТОЙ ЖЕ формулой, что и первый
    // (Кромсающее выше не встречается на одном оружии — Мутации берутся с
    // разных таблиц Характера, но если бы встретились, второй бросок тоже
    // пошёл бы по активной формуле, как и первый).
    // Хладнокровный Убийца (Избранный, rules/cold-killer.mjs): тот же второй
    // бросок, что у Оппортуниста, но от Черты атакующего, а не от оружия.
    if (wp.legacyOpportunistDoubleRoll || (attacker && hasRuleFlag(attacker, COLD_KILLER))) {
      const exRoll2 = await new Roll(wp.legacyCleavingRollActive ? "1d10" : "1d5").evaluate();
      const extremeLevel2 = wp.legacyCleavingRollActive
        ? Math.max(1, exRoll2.total - 2)
        : exRoll2.total + (wp.extremeLevelBonus || 0);
      if (extremeLevel2 > extremeLevel) { exRoll = exRoll2; extremeLevel = extremeLevel2; }
    }
    // Уличный Боец (стр. 62, rules/rogue-talents.mjs): +½WS.b (макс. +5) к Критическому
    // Эффекту ножа/кулаков — общий примитив «плоская прибавка к уровню Крит. Эффекта»;
    // тот же вызов стоит в damage.mjs для Критического урона от Отрицательных Ран.
    extremeLevel += criticalEffectFlatBonus(attacker, weapon);
    if (!targetIsVehicle) critEffect = getCriticalEffect(damageType, hitLocation, extremeLevel);
  }
  return { hasExtreme, extremeLevel, critEffect, exRoll };
}

/**
 * Бонус урона от Черт «Brutal Charge/Брутальный Натиск» — раньше не читался
 * НИГДЕ (оба существующих трейта сами это отмечали в своих notes: «бонус
 * привязан к Натиску, но нет read-хука»). Читает ДВА варианта:
 *   - «Brutal Charge (X) / Брутальный Натиск (X)» — общий, hasRating:true,
 *     фиксированное число в system.rating.
 *   - «Brutal Charge (WS.b) / Жестокий Натиск» — Суккуба, hasRating:false,
 *     величина = текущий Бонус Оружейного Мастерства актора.
 * Вызывающая сторона гейтит по rofMode==="charge" (только Натиск) — «или
 * Верховая Атака» из текста общей Черты сюда не входит: отдельное понятие
 * (actor.system.mount.uuid, module/sheets/attack-dialog.mjs:342), не
 * исследовано, оставлено как отдельный открытый пробел, не решается тут.
 */
export function brutalChargeDamageBonus(actor) {
  let total = 0;
  for (const i of actor?.items ?? []) {
    if (i.type !== "trait") continue;
    const name = i.name || "";
    if (/Brutal Charge \(WS\.b\)|Жестокий Натиск/i.test(name)) {
      total += Number(actor?.system?.characteristics?.ws?.bonus) || 0;
    } else if (/Brutal Charge|Брутальный Натиск/i.test(name)) {
      total += Number(i.system?.rating) || 0;
    }
  }
  return total;
}

export async function _executeAttackRoll(actor, item, charKey, threshold, rofMode, aimTarget, opts = {}) {
  const rawSys  = item.system;
  // Наследие Ярости/Rage, ranged-ветка (wdbc-1rno.35, стр. 427): «+1 к
  // наибольшей RoF, или S/2− вместо S/−/−» — клон sys, реальный предмет не
  // трогаем, тот же приём, что Fanning (rofOverride) ниже подмешивает клон
  // поверх клона. С этой точки sys — уже эффективный (с бонусом), все
  // нижеидущие чтения rof_semi/rof_full (счёт попаданий, расход патронов,
  // потолок Подавления) видят применённую Историю.
  // Свой ствол профиля (комби-оружие, wdbc-jho9, combat/weapon-profiles.mjs):
  // скорострельность, магазин и боеприпас второго ствола подменяют поля
  // оружия ДО всего остального — счёт попаданий, расход патронов, клин.
  const ownFireIdx = profileHasOwnFire(opts.profile)
    ? authoredProfileIndex(item, opts.profile, opts.profileIdx) : -1;
  const sys     = legacyWrathEffectiveRof(sysWithProfileFire(rawSys, opts.profile), item);
  // Куда писать остаток магазина: в профиль (свой ствол) или в оружие.
  const magazineUpdate = (value, extra = {}) => ownFireIdx >= 0
    ? { ...profileFireUpdate(item, ownFireIdx, { magazineCur: value }), ...extra }
    : { "system.magazineCur": value, ...extra };
  // Метательное (Граната и т.п.) по умолчанию бросается по BS — стр. 40:
  // «В рукопашной оно МОЖЕТ использоваться как рукопашное», это не default.
  // Решение «рукопашная ли это атака» одно на окно и на бросок
  // (combat/weapon-profiles.mjs::attackIsMelee, wdbc-bs0q): выбранный ПРОФИЛЬ
  // важен наравне с классом оружия, иначе «Ударить оружием» катилось бы тестом по
  // WS, но считался стрельбой — без прибавки S.b к урону и с кнопками защиты
  // из стрелковой ветки.
  const isMelee = attackIsMelee(sys, { forceMelee: opts.forceMelee, profile: opts.profile });
  // По Этим Координатам (rules/gunner-talents.mjs): выстрел по засечённой только координатами цели
  // «не может быть Избирательным» — на случай прямого вызова мимо окна атаки (там select заперт).
  const onThisMarkOn = onThisMarkActive(actor, { opts, isMelee });
  if (onThisMarkOn && aimTarget?.value) aimTarget = null;
  // Он же «не получает преимуществ Прицеливания» — не только строки порога в окне, но и Меткого,
  // Снайпера-Убийцы, Сверхточного Наследия и Снайпера Ужаса ниже.
  const aiming = onThisMarkOn ? "none" : opts.aiming;
  // Стрельба от Бедра / Огонь с Вытягивания (combat/free-shot.mjs): «не Избирательный» — тот же запас прочности.
  if (freeShotLocksAim(opts.freeShot) && aimTarget?.value) aimTarget = null;
  // Поле Дискорданта: электрическое стрелковое не стреляет. Окно атаки
  // отказывает раньше, но не все пути идут через него (огонь с листа техники,
  // оружие класса «рукопашное» со стрелковым профилем — task-be12): отказ
  // здесь, до патронов и броска, чтобы ничего не списалось. Только для НОВОГО
  // выстрела: перерасчёт уже сделанного (переброс за Очко, +10 за Очко, Огневая
  // Точка, Горжет, сдвиг места — все идут со skipAmmo) отказывать не должен, их
  // вызывающие уже списали Очко/кнопку и не узнали бы, что выстрела не вышло.
  if (!opts.skipAmmo && fieldForbidsShot(actor, item, isMelee)) {
    ui.notifications?.warn(`⚠️ «${item.name}»: в поле Дискорданта электрическое оружие не стреляет.`);
    return;
  }
  // Выбранный профиль атаки (стр. 207-221) и хват (стр. 39) переопределяют урон.
  const P = opts.profile || null;
  const gripDmgFlat = Number(opts.gripDmgFlat) || 0;
  const eff = effectiveDamage({ sys, profile: P, gripDmgFlat });
  let   effDamage  = eff.damage;
  // Адаптивная Отрава Наги (rules/naga-traits.mjs): «Укус Наги использует
  // кубик 1d10 вместо 1d5» — тот же сдвиг, что в Борьбе (grapple.mjs::_doBite).
  if (isBiteName(item) && hasRuleFlag(actor, VENOM_BITE_CAPABILITY)) effDamage = venomBiteDamage(effDamage);
  const effDmgType = eff.damageType;
  const effDmgSubtype = eff.damageSubtype;
  const effPen0    = eff.penetration;

  // ── Особые свойства оружия (+ от установленных модификаций) ───────────────
  //   Если выбран доп. профиль со своими свойствами (Крюк/Посох) — берём их
  //   вместо базовых (у профилей разные наборы: Devastating vs Primitive и т.п.).
  const modFx     = getModEffects(actor, item, { profile: P });
  // Заряженный боеприпас нужен уже здесь: он может добавлять свойства оружия.
  const loadedAmmo = sys.loadedAmmoId ? actor.items.get(sys.loadedAmmoId) : null;
  // Тандем: у встроенного оружия свойства СВОИ, даже пустые — иначе оно подхватило бы свойства тяжёлого носителя.
  const _propSource = (P && Array.isArray(P.weaponProps) && (P.weaponProps.length || P.tandem))
    ? { system: { weaponProps: P.weaponProps } }
    : item;
  let _mergedEntries = mergeExtraProps(mergeWeaponPropEntries(_propSource, modFx), {
    gripProps:   opts.gripProps || [],
    gripKey:     opts.gripKey,
    gripProps2h: sys.gripProps2h || [],
    ammoProps:   loadedAmmo?.system?.properties || [],
    condProps:   opts.ammoCondProps || [],
    // Свойства от правила (wdbc-w8z4): уже отобраны диалогом атаки по `when`
    // (см. attack-dialog.mjs, resolveTest(...).weaponProps) — здесь только долив.
    ruleProps:   opts.ruleProps || [],
    removeProps: loadedAmmo?.system?.removeProps || []
  });
  // Колдовское Лезвие (стр. 74 Книги Аэльдари): выбор бонуса на Encounter
  // (флаг на предмете, module/combat/witchs-edge.mjs) добавляет свои записи.
  _mergedEntries = withWitchsEdge(item, _mergedEntries);

  // ── Выключенное оружие (стр. 209-211) ────────────────────────────────────
  // Поле Дискорданта (rules/null-zones.mjs): электрическое рукопашное бьёт
  // выключенным, даже если окно атаки обошли (другие пути до броска).
  const fieldOff = fieldDisablesWeapon(actor, item);
  const off = weaponOffEffects({
    sys, entries: _mergedEntries, on: !!opts.weaponOff || fieldOff, basePen: effPen0, gripDmgFlat
  });
  _mergedEntries = off.entries;
  // Прочая электрика ближнего боя (экзотика «тех» и т.п.) своей строки в
  // weaponOffEffects не имеет — в поле Дискорданта она просто примитивная.
  let fieldOffNote = "";
  if (fieldOff && !off.note) {
    if (!_mergedEntries.some(e => e.key === "primitive")) _mergedEntries.push({ key: "primitive", rating: 0, rating2: 0 });
    fieldOffNote = "Поле Дискорданта: оружие выключено, работает как примитивное.";
  }
  const offDmgMod = off.dmgMod, offPenMod = off.penMod, offNote = off.note || fieldOffNote;
  if (off.damage) effDamage = off.damage;

  // Осколочное оружие: длинная очередь рвёт плоть — добавляем Tearing к этому
  // выстрелу до сборки свойств, чтобы он попал и в формулу урона, и в карточку.
  if (splinterFullAutoTearing(sys, rofMode) && !_mergedEntries.some(x => x.key === "tearing")) {
    _mergedEntries.push({ key: "tearing" });
  }
  // Touch of Pain/Касание Боли (wdbc-1rno, Дар Слаанеш): безоружные/природные
  // атаки носителя получают Shocking СИНТЕТИЧЕСКИ — только для ЭТОГО выстрела,
  // не записано на сам предмет Кулака/Пинка (иначе получили бы все персонажи
  // с голыми руками). Тот же приём добавления, что Tearing выше.
  const touchOfPainOn = touchOfPainActive(actor, item);
  if (touchOfPainOn && !_mergedEntries.some(x => x.key === "shocking")) {
    _mergedEntries.push({ key: "shocking" });
  }
  // Шокер (rules/gunsmith-talents.mjs, Sahara 3-9d40): Избирательное попадание
  // Гальванического оружия в голову получает Shocking — синтетически, только
  // для этого выстрела, тем же приёмом, что Касание Боли выше.
  const shockerOn = shockerGrantsShocking(actor, { item, isMelee, aimValue: aimTarget?.value });
  if (shockerOn && !_mergedEntries.some(x => x.key === "shocking")) {
    _mergedEntries.push({ key: "shocking" });
  }
  // Трепка (там же): Избирательный выстрел с короткой дистанции из оружия со
  // Scatter даёт Concussive на ПЕРВОЕ попадание (после Избеганий). Свойство
  // карточки одно на всю атаку, поэтому оговорка «только первое» — строкой в
  // карточке (damageTalentNotes ниже). Своё Concussive у оружия не трогаем.
  const wallopRating = wallopConcussiveRating(actor, {
    isMelee, aimValue: aimTarget?.value, shortRange: !!opts.shortRange,
    wp: { scatter: _mergedEntries.some(x => x.key === "scatter") }
  });
  // Поджигатель (там же): Избирательный выстрел Фосфорным оружием — эффект по месту; кнопки
  // свойств несут зону (data-wp-igniter), а Blinding/Flame считаются в hooks.mjs::_applyWeaponPropEffect.
  const igniter = igniterZone(actor, { item, isMelee, aimValue: aimTarget?.value }) || "";
  const wallopOn = wallopRating != null && !_mergedEntries.some(x => x.key === "concussive");
  if (wallopOn) _mergedEntries.push({ key: "concussive", rating: wallopRating });
  // Выпуск Батареи (rules/batpack-dump.mjs): лаз-оружию с Power Setting на эту атаку — Storm(2), +1d10 Dmg (ниже),
  // длинная очередь RoF 10 (rofCapOverride из окна), оружие ломается после атаки.
  const batpackOn = !!opts.batpackDump && !isMelee && hasBatpackDump(actor);
  if (batpackOn) {
    const stormEntry = _mergedEntries.find(x => x.key === "storm");
    if (stormEntry) stormEntry.rating = batpackStormRating(stormEntry.rating);
    else _mergedEntries.push({ key: "storm", rating: batpackStormRating(0) });
  }
  // Настройка Линз (rules/gunsmith-talents.mjs): заряд лаз-оружия даёт Felling(I.b) и Precise на эту атаку;
  // заряды лежат флагом на оружии. Перебросы того же выстрела (skipAmmo) заряд повторно не тратят.
  const lens = lensTuningShot(actor, { item, isMelee, toggles: opts.talentToggles,
    charges: item.getFlag?.("warhammer-dbc", LENS_CHARGES_FLAG), replay: !!opts.talentPaid?.lens });
  if (lens.use) {
    const fel = _mergedEntries.find(x => x.key === "felling");
    if (fel) fel.rating = Math.max(Number(fel.rating) || 0, lens.felling);
    else _mergedEntries.push({ key: "felling", rating: lens.felling });
    if (!_mergedEntries.some(x => x.key === "precise")) _mergedEntries.push({ key: "precise" });
  }
  if (!opts.talentPaid?.lens && (lens.tuned || lens.use)) await item.setFlag?.("warhammer-dbc", LENS_CHARGES_FLAG, lens.charges);
  if (lens.empty) ui.notifications?.warn("Настройка Линз: зарядов нет — настройте линзы (5 минут) или отключите галочку.");

  // Тесное помещение (стр. 36, wdbc-x1nz.2.63): галочка ГМа в диалоге атаки
  // (attack-dialog.mjs::confinedSpaceHtml, видна только Взрывному) — «взрывы,
  // наносящие E Dmg, получают Рвущее, а Оглушающие повышают рейтинг Concussive
  // на 1». Тот же приём добавления/правки _mergedEntries ДО сборки wProps, что
  // Осколочное/Touch of Pain выше — попадает и в карточку, и в расчёт урона.
  // +1d10 и ×1.5 радиуса для X Dmg — отдельно, ниже по функции (bonusDamageDice/
  // шаблон), они не выражаются добавкой свойства.
  const confinedSpaceOn = !!opts.confinedSpace && _mergedEntries.some(x => x.key === "blast");
  if (confinedSpaceOn && effDmgType === "energy" && !_mergedEntries.some(x => x.key === "tearing")) {
    _mergedEntries.push({ key: "tearing" });
  }
  if (confinedSpaceOn) {
    const concussiveEntry = _mergedEntries.find(x => x.key === "concussive");
    if (concussiveEntry) concussiveEntry.rating = (Number(concussiveEntry.rating) || 0) + 1;
  }

  // Молот/Топор по лежащей или прижатой к стене цели (core.json, «Типы
  // Рукопашного Оружия»): «+1d10 Dmg и получает свойство Concussive(–1)/
  // Felling(2), или +1 к рейтингу, если оно уже имело это свойство». Та же
  // мутация _mergedEntries ДО сборки wProps, что у Тесного помещения выше.
  // Чтение game.user.targets тут же, инлайн (не ждём defenderActor ниже по
  // функции — тот определяется позже, а этот блок обязан успеть до wProps).
  // «Лежащая» — статус Повержен цели, тот же conditions.prone, что читает
  // attack-dialog.mjs для proneMod; «прижата к стене» система не отслеживает
  // (нет геометрии стен) — решает ГМ галочкой (opts.targetAgainstWall,
  // attack-dialog.mjs::targetAgainstWallHtml).
  const meleeTypeToken = [...(game.user?.targets ?? [])][0] ?? null;
  const meleeTypeTargetActor = meleeTypeToken?.actor ?? meleeTypeToken?.document?.actor ?? null;
  const meleeType = sys.meleeCategory;
  const meleeTypeBonusOn = isMelee && (meleeType === "Молот" || meleeType === "Топор")
    && (!!meleeTypeTargetActor?.system?.conditions?.prone || !!opts.targetAgainstWall);
  if (meleeTypeBonusOn) {
    const propKey = meleeType === "Молот" ? "concussive" : "felling";
    const typeEntry = _mergedEntries.find(x => x.key === propKey);
    if (typeEntry) typeEntry.rating = (Number(typeEntry.rating) || 0) + 1;
    else _mergedEntries.push({ key: propKey, rating: meleeType === "Молот" ? -1 : 2 });
  }

  // Удар Молота (Берсерк, rules/berserker-talents.mjs) и Неостановимый Натиск (Всадник, rules/melee-talents.mjs):
  // свойства оружия зависят от Базы ЭТОЙ атаки (opts.baseKey — выбор окна), поэтому правятся здесь же,
  // той же мутацией _mergedEntries ДО сборки wProps, что Молот/Топор выше. Уже имеющееся свойство не
  // понижается и не складывается — берётся большее рейтинга.
  const talentWsBonus = actor.system?.characteristics?.ws?.bonus;
  const hammerBlow = hammerBlowEffect(actor, { isMelee, baseKey: opts.baseKey, wsBonus: talentWsBonus });
  if (hammerBlow.concussive) {
    const own = _mergedEntries.find(x => x.key === "concussive");
    if (own) own.rating = Math.max(Number(own.rating) || 0, hammerBlow.concussive);
    else _mergedEntries.push({ key: "concussive", rating: hammerBlow.concussive });
  }
  // Обратный Удар (MELEE_MANEUVERS.reverseStrike): вторая атака профилем посоха получает Concussive(0),
  // если у оружия нет его с более высоким рейтингом.
  if (opts.reverseStrikeSecond) {
    const own = _mergedEntries.find(x => x.key === "concussive");
    if (own) own.rating = Math.max(Number(own.rating) || 0, 0);
    else _mergedEntries.push({ key: "concussive", rating: 0 });
  }
  // Удар с Колена в голову (Пугилист, combat/pugilist-strikes.mjs): «дать ему свойство Concussive (0)» — выше рейтинг оружия не понижается.
  if (opts.techniqueOpts?.kneeStrike?.head) {
    const own = _mergedEntries.find(x => x.key === "concussive");
    if (own) own.rating = Math.max(Number(own.rating) || 0, 0);
    else _mergedEntries.push({ key: "concussive", rating: 0 });
  }
  const unstoppableFelling = unstoppableChargeFelling(actor, {
    isMelee, baseKey: opts.baseKey, mounted: !!actor.system?.mount?.uuid, wsBonus: talentWsBonus
  });
  if (unstoppableFelling) {
    const own = _mergedEntries.find(x => x.key === "felling");
    if (own) own.rating = Math.max(Number(own.rating) || 0, unstoppableFelling);
    else _mergedEntries.push({ key: "felling", rating: unstoppableFelling });
  }
  // Железный Сад (rules/iron-garden.mjs, Sahara 3-cc96 п.10): несколько одноимённых
  // мехадендритов бьют как одно оружие с Multi-strike (X). Свойство уже имеющееся не
  // понижается — берётся большее.
  const ironGarden = isMelee ? ironGardenRating(actor, item) : 0;
  if (ironGarden) {
    const own = _mergedEntries.find(x => x.key === "multiStrike");
    if (own) own.rating = Math.max(Number(own.rating) || 0, ironGarden);
    else _mergedEntries.push({ key: "multiStrike", rating: ironGarden });
  }
  const wProps    = resolveWeaponPropsList(_mergedEntries);
  const wp         = aggregateAuto(wProps);
  wp.reliabilityScore += modFx.reliabilityMod || 0;
  // Облучить (rules/gunsmith-talents.mjs, Sahara 3-9d40): до броска — удвоить Felling Рад-оружия
  // ЛИБО считать пробитие брони для Rad без удвоения AP цели (data-breach-no-double → damage.mjs).
  const toggles = opts.talentToggles ?? {};
  const irradiate = irradiateMode(actor, { toggles, isMelee, wProps });
  if (irradiate === "felling") wp.fellingRating = (wp.fellingRating || 0) * 2;
  wp.breachNoDouble = irradiate === "noDouble";
  // Поток (Талант Огнемётчика, rules/flamer-talents.mjs): расход боеприпасов ×2, шаблон — Blast(Rng/5+1).
  const torrentOn = torrentActive(actor, { item, isMelee, toggles });
  // Легионер-Виртуоз (Искатель, rules/legionnaire-virtuoso.mjs): стрелковое
  // оружие Легиона — +1 кубик урона, наименьший отбрасывается. Проверяется
  // само оружие (rawSys), не профиль: приклад и штык книга включает прямо.
  if (isLegionRangedWeapon(rawSys) && hasRuleFlag(actor, LEGIONNAIRE_VIRTUOSO)) {
    wp.extraDropLowest = (wp.extraDropLowest || 0) + 1;
  }
  // Терзатель Плоти (rules/melee-talents.mjs, Sahara 3-8dc5): рукопашное с Tearing —
  // не +1, а +2 куба урона и два наименьших отбрасываются (Рвущее даёт первый куб само).
  const fleshRenderDrop = fleshRenderExtraDrop(actor, { isMelee, tearing: wp.tearing });
  if (fleshRenderDrop) wp.extraDropLowest = (wp.extraDropLowest || 0) + fleshRenderDrop;
  // Максимальный режим (Maximal) — флаг из диалога. Радиус Взрыва в нём растёт (+2 при уже имеющемся
  // Blast, Мастерство Плазмы по выбору стрелка — ещё +2 или Blast (2) у оружия без него,
  // rules/maximal-mode.mjs): правится в том же wp.blastRating, откуда берут радиус шаблон, рассеивание
  // и счёт попаданий по Орде, и ДО ×1.5 Тесного помещения ниже (оно множит уже итоговый радиус оружия).
  const maximalOn  = !!(opts.maximal && wp.maximal);
  const masteryBlast = plasmaMasteryBonus(actor, { isMelee, sys, maximalOn, blastChosen: !!opts.plasmaBlast }).blast;
  const baseBlastRating = Number(wp.blastRating) || 0;
  if (maximalOn) wp.blastRating = maximalBlastRating({ blast: baseBlastRating, maximalOn, masteryBlast });
  const maximalBlastLine = maximalBlastNote({ blast: baseBlastRating, maximalOn, masteryBlast });
  // Тесное помещение, продолжение (стр. 36, wdbc-x1nz.2.63): X Dmg — радиус
  // ×1.5 (окр.▲). Правится прямо в wp.blastRating — единая точка, откуда
  // берут радиус и шаблон (attack-card.mjs), и рассеивание (blastScatter
  // ниже), и счёт лишних попаданий по Орде (тот же рейтинг, книга не отделяет
  // «увеличенный радиус» от обычного для этих целей).
  if (confinedSpaceOn && effDmgType === "blast" && wp.blastRating > 0) {
    wp.blastRating = Math.ceil(wp.blastRating * 1.5);
  }
  // Призма (стр. 74 Книги Аэльдари): текущий заряд живёт на предмете, не в
  // реестре — обогащаем wp здесь же, до того как его читают downstream
  // (bonusDamageDice/attackPenetration/расход патронов).
  const prisma = prismaFireBonus(item, wp);
  wp.prismaAtMax = prisma.atMax;
  wp.prismaCharge = prisma.charge;
  // Касание Энтропии (wdbc-1rno, Дар Нургла): безоружные и природные атаки
  // носителя съедают AP места попадания ДО урона. Считается здесь, где ещё
  // известны и атакующий, и оружие; применяется в damage.mjs (там известно
  // место попадания). 0 у всех прочих — атрибут карточки просто пустеет.
  wp.entropyRating = attackEntropyRating(actor, item);
  // Touch of Pain: T.b Поглощения этой атаки игнорируется целиком (не
  // сравнимо с Разящим — тот бьёт только Сверхъест. часть, здесь весь T.b).
  wp.touchOfPainIgnoreTb = touchOfPainOn;
  // Кромсающее/fearsome 10-10, Оружие Наследия (wdbc-1rno.35, стр. 427):
  // «При Экстремальном Уроне бросает 1d5+1 на Критический Результат» —
  // тот же примитив, что Monofilament (constants/weapon-properties.mjs,
  // auto.extremeLevelBonus:2), только +1 и по Мутации, а не по свойству.
  // Второе предложение («может потратить Очко Бесчестия, чтобы бросить
  // 1d10−2 (мин.1) вместо») — галочка attack-dialog.mjs (видна только при
  // наличии Мутации и ≥1 Очка Бесчестия), opts.legacyCleavingRoll долетает
  // сюда тем же приёмом, что confinedSpace. Трата — в rollExtremeDamage, ОДНА на всю атаку
  // (не за каждое попадание Очереди с Экстремальным Уроном по отдельности:
  // книга не разбирает многократное срабатывание, субъективное упрощение).
  if (takenMutationNames(item).has("Кромсающее")) wp.extremeLevelBonus = (wp.extremeLevelBonus || 0) + 1;
  wp.legacyCleavingRollRequested = takenMutationNames(item).has("Кромсающее") && !!opts.legacyCleavingRoll;
  // Мучитель/merciless 10-10, Оружие Наследия (wdbc-1rno.35, стр. 428):
  // «Броски в 1 на кубиках урона вызывают Экстремальный Урон» — синтетический
  // флаг для rollExtremeDamage (см. заголовок выше в этом файле).
  if (takenMutationNames(item).has("Мучитель")) wp.legacyExtremeOnOne = true;
  // Оппортунист/versatile 10-10, Оружие Наследия (wdbc-1rno.35, стр. 427):
  // двойной бросок Экстремального Урона (см. rollExtremeDamage) — второй
  // синтетический флаг тем же приёмом, что и Мучитель выше. legacyOpportunistFloor
  // читается ниже по цепочке (attack-card.mjs → hooks.mjs → damage.mjs) для
  // «1d10−2(мин.1) вместо 1» на непробитом Экстремальном.
  if (takenMutationNames(item).has("Оппортунист")) {
    wp.legacyOpportunistDoubleRoll = true;
    wp.legacyOpportunistFloor = true;
  }

  // Sniper Assassin / Снайпер-Убийца (wdbc-1rno.2, rules/unseen-talents.mjs)
  // — ДО блока unseen ниже: сам ставит wp.unseen, тот читается следующей
  // строкой. Прицеливание читается из opts.aiming, а НЕ из actor.system.
  // aiming: к моменту броска диалог его уже сбросил в "none" (sheets/attack/
  // dialog.mjs::actorUpdates, плюс _maybeClearAiming на списании ОД) — тот же
  // захваченный до сброса снимок, которым ниже пользуются Меткое и
  // bonusDamageDice. По живому полю условие не выполнялось никогда, и Талант
  // не срабатывал вовсе (приёмка стопки #482-#504).
  const sniperAssassinActive = wp.accurate && rofMode === "single"
    && aiming === "full" && hasSniperAssassin(actor);
  if (sniperAssassinActive) { wp.unseen = true; wp.sniperAssassin = true; }

  // targetToken/defenderActor (wdbc-1rno.2): вынесены СЮДА, раньше, чем были
  // (изначально считались только у секции Орды/пула Уклонения, ниже) — нужны
  // Blindside следующим блоком, до формулы урона. game.user.targets не
  // зависит от hit/остального состояния атаки, переносить безопасно.
  const targetToken = [...(game.user?.targets ?? [])][0] ?? null;
  const defenderActor = targetToken?.actor ?? targetToken?.document?.actor ?? null;
  // Гусар (3-cross-actor-5482): «верховые атаки против Орды… получают Devastating (2)».
  if (isMelee && opts.baseKey === "mounted" && defenderActor?.type === "horde" && hasHussar(actor)) {
    wp.devastatingRating = Math.max(wp.devastatingRating || 0, 2);
  }

  // Скрытная Атака (стр. 32, wdbc-1rno.3): «атакующий весь свой Ход
  // находился вне обзора цели ... эта атака получает тип Незримое» —
  // снимок геометрии на момент атаки (combat/facing.mjs::
  // isOutsideDefenderView, детали приближения и честная граница — там же),
  // не слежение за позицией по всему Ходу. defenderActor может быть
  // токеном без владельца или без цели вовсе — тогда геометрии посчитать
  // не из чего, sneakAttackUnseen остаётся false (не наказываем).
  // Janus (wdbc-1rno.3, rules/janus.mjs): у защищающегося практически
  // круговой обзор — эта геометрическая проверка на него не срабатывает
  // вовсе (structural wp.unseen/Сокрытая Угроза продолжают действовать как
  // обычно, это исключение только для facing-детекта).
  const attackerToken = await resolveAttackerToken(actor.uuid);
  const sneakAttackUnseen = !!(targetToken && attackerToken && !hasJanusRearVision(defenderActor)
    && isOutsideDefenderView(targetToken, attackerToken));
  if (sneakAttackUnseen) wp.unseen = true;

  // Blindside / Из Слепой Зоны (wdbc-1rno.2, rules/unseen-talents.mjs):
  // «При победе, если его следующее действие — атака ножом по этой цели,
  // эта атака считается Незримой». Метка target-scoped (не как у Hidden
  // Threat — «следующая атака ЛЮБЫМ оружием по ЛЮБОЙ цели»), ставится
  // кнопкой на предмете (пак: kind:"script"). «Раз в Ход»/«численное
  // преимущество»/сам встречный тест Stealth vs Awareness — НЕ проверяются
  // движком (см. текст кнопки) — честная граница, см. capabilities.mjs.
  // Отклонение от буквы книги (задокументировано, не скрыто): «его СЛЕДУЮЩЕЕ
  // действие» строго значит consume-на-любом-следующем-действии; здесь метка
  // переживает промежуточные НЕ-ножевые/не-по-этой-цели действия и ждёт
  // первую подходящую атаку — нет общего хука «актор совершил действие» вне
  // атак, чтобы честно снять метку раньше.
  const blindsideActive = defenderActor && isKnifeWeapon(item)
    && isBlindsideMarked(actor, defenderActor.uuid);
  if (blindsideActive) { wp.unseen = true; await consumeBlindsideMark(actor); }

  // ── Таланты Разбойника (rules/rogue-talents.mjs, Sahara 3-bfbf) ─────────────
  // Саботаж: цель прицела «Оружие цели» — удар по оружию, а не по телу. Урона по
  // существу нет (кнопка «Саботаж» на карточке после попадания), Избегание — как обычно.
  const sabotageWeapon = (isMelee && defenderActor && isKnifeWeapon(item) && hasRogueTalent(actor, "sabotage"))
    ? sabotageWeaponOf(aimTarget, defenderActor) : null;
  const sabotageOn = !!sabotageWeapon;
  // На Лезвии Бритвы: +разница Инициатив к Dmg ножа (в плоскую прибавку, не в Пробитие).
  const razorBonus = isMelee ? razorsEdgeBonus(actor, item, defenderActor) : 0;
  // Жонглёр Клинком: метка на этой цели — штраф на её Избегания от этой атаки ножом.
  // Переигровка той же атаки (skipAmmo) берёт штраф из storedOpts: метка снята первым броском.
  const bladeJugglerPenalty = opts.skipAmmo ? (Number(opts.bladeJugglerPenalty) || 0)
    : (isMelee && defenderActor && isKnifeWeapon(item)) ? bladeJugglerMarkAgainst(actor, defenderActor.uuid) : 0;
  if (bladeJugglerPenalty && !opts.skipAmmo) await consumeBladeJugglerMark(actor);

  // Незримое (стр. 32, wdbc-1rno.2): считается ЗДЕСЬ, до формулы урона —
  // Backstab (rules/unseen-talents.mjs, ниже) должен знать unseen раньше,
  // чем damageFormulaFor построит dmgFormula. Сокрытая Угроза / Hidden
  // Threat (wdbc-1rno.1, rules/hidden-threat.mjs) снимается РОВНО здесь, на
  // самой следующей атаке АТАКУЮЩЕГО, независимо от hit/засечения (RAW даёт
  // тип ОДНОЙ следующей атаке, не длящемуся эффекту) — раньше эта строка
  // стояла ближе к концу функции, смысл переноса не изменился, только такт.
  const hiddenThreatFlag = await consumeHiddenThreatPending(actor);
  // Hair Trigger/Палец на Спуске (wdbc-1rno.27/.37, rules/hair-trigger.mjs):
  // «выигранный встречный тест — выстрел из Караула считается Незримым».
  // Та же одноразовая пометка, снятая тем же тактом, что Hidden Threat выше.
  const hairTriggerFlag = await consumeHairTriggerUnseenPending(actor);
  // Ослеплённая цель (wdbc-x1nz.2.89, «Раны и Урон», «Статусы»):
  // «Ослепленный персонаж считает все атаки Незримыми» — со всеми
  // последствиями Незримого ниже: Уклонение/Парирование заперты, пока атаку
  // не засекли (Психочутьё/Ноосфера/Варп-Зрение), Бой Вслепую (−20 в
  // рукопашной), Шестое Чувство и т.п. Sonar Sense/Unnatural Senses цели
  // снимают это вместе с остальными штрафами слепоты (rules/blindness.mjs).
  const targetBlindedUnseen = !!defenderActor && suffersBlindness(defenderActor);
  const unseen = !!(wp.unseen || hiddenThreatFlag || hairTriggerFlag || targetBlindedUnseen);
  // Сокрытая Угроза добавляет реактивному тесту засечения её собственный
  // −50 (её книжный текст, не общее правило стр. 32 — там штрафа нет).
  const unseenPenalty = hiddenThreatFlag ? -50 : 0;

  // Backstab / Удар в Спину (wdbc-1rno.2, rules/unseen-talents.mjs):
  // «Незримой Избирательной атакой ножом — удваивает базовые кубики урона».
  // Избирательная — aimTarget.value непусто (то же условие, что читает
  // notes.aim ниже); нож — meleeCategory "Нож" на самом предмете.
  const backstabDoubled = unseen && isMelee && !!aimTarget?.value
    && hasBackstab(actor) && isKnifeWeapon(item);
  if (backstabDoubled) wp.doubleDice = true;

  // Knife Fighter / Боец на Ножах (rogue.core.knifeFighter): «ножи, наносящие
  // d10 урона, в его руках получают свойство Extreme (9)». «Перебрасывать
  // броски на урон от ножей» — не сделано (нет общего примитива «переброс
  // урона», тот же разрыв у Poisoner/Медик — wdbc-obo8v).
  if (isMelee && isKnifeWeapon(item) && /d10/i.test(String(item?.system?.damage ?? ""))
    && hasRuleFlag(actor, "rogue.core.knifeFighter")) {
    wp.extremeThreshold = Math.min(wp.extremeThreshold, 9);
  }

  // Quiet Elimination / Тихое Устранение (wdbc-1rno.3, rules/quiet-
  // elimination.mjs): «Если персонаж атакует противника врасплох — +1 куб
  // урона, цель не издаёт звука при гибели». Завязано на per-attack галочку
  // «Цель Врасплох» (opts.targetSurprised, любое оружие) — НЕ на «Незримое»
  // (unseen выше — другое правило, стр. 32 иначе сформулировано) и не
  // ограничено ножом/пистолетом (тот отдельный +10 — situational-мод,
  // sheets/attack/mods.mjs). «Не издаёт звука» — честно только строка в
  // карточке ниже (formatNotes), детектора смерти на этом такте ещё нет.
  const targetSurprised = !!opts.targetSurprised;
  const quietEliminationActive = targetSurprised && hasQuietElimination(actor);
  if (quietEliminationActive) wp.quietEliminationBonus = true;
  // ── Качество оружия ──────────────────────────────────────────────────────
  //   Стрелковое: ±Надёжность; Рукопашное Best: +1 урон; Best: теряет Primitive.
  //   (Мод теста для рукопашного применяется в _showAttackDialog → threshold.)
  // Железный Сад: группа дендритов бьёт по наименьшему Качеству (null — своё Качество).
  const gardenQuality = isMelee ? ironGardenQuality(actor, item) : null;
  const qAuto = qualityEffects(item, gardenQuality).auto;
  if (!isMelee) wp.reliabilityScore += qAuto.reliabilityMod || 0;
  // Plasma Expertise / Эксперт Плазмы (weaponsmith.core.plasmaExpertise): +1
  // Надёжность плазме со свойством Overheats (rules/damage-talents.mjs).
  const plasmaExpertiseRel = plasmaExpertiseReliability(actor, { isMelee, sys, wProps });
  wp.reliabilityScore += plasmaExpertiseRel;
  // Литания Чистки (rules/gunsmith-talents.mjs): оружие выбранного типа, чищенное за последние сутки, — +1 Надёжность.
  // Галочка окна («чищено») пишет метку на актора по типу оружия; сама прибавка читает метку.
  let litanyCleaned = actor.getFlag?.("warhammer-dbc", LITANY_CLEANED_FLAG) ?? {};
  const nowTime = Number(game.time?.worldTime) || 0;
  const litanyAlive = litanyReliability(actor, { item, isMelee, cleaned: litanyCleaned, worldTime: nowTime }) > 0;
  // Пока метка жива, заново не пишем: запертая галочка не должна продлевать чистку выстрелом.
  if (opts.talentToggles?.litanyCleaned && !opts.skipAmmo && !litanyAlive && litanyCoversWeapon(actor, item)) {
    litanyCleaned = { ...litanyCleaned, [item.system.weaponType]: nowTime };
    await actor.setFlag?.("warhammer-dbc", LITANY_CLEANED_FLAG, litanyCleaned);
  }
  const litanyRel = litanyReliability(actor, { item, isMelee, cleaned: litanyCleaned, worldTime: nowTime });
  wp.reliabilityScore += litanyRel;
  // Тандем (rules/tandem.mjs): «В руках персонажа без этого Таланта установка получает –2 к Надежности».
  wp.reliabilityScore += tandemReliabilityPenalty(actor, P);
  if (qAuto.losesPrimitive) wp.primitive = false;
  // Unarmed Master / Безоружный Мастер (стр. 62): безоружные атаки теряют Primitive.
  if (unarmedLosesPrimitive(actor, item)) wp.primitive = false;
  // Наследие Бойни (H1, стр. 426), стрелковая ветка: «Понижает СВОЮ Надёжность
  // ДО −2 при стрельбе нелетальными боеприпасами» — абсолютное значение, не
  // дельта, поэтому присваивание, а не += (rules/legacy-weapon.mjs::
  // legacySlaughterAmmoReliability, закрытый список нелетальных боеприпасов
  // по имени — структурного поля «нелетальный» в системе нет).
  if (!isMelee) {
    const slaughterReliability = legacySlaughterAmmoReliability(item, loadedAmmo);
    if (slaughterReliability != null) wp.reliabilityScore = slaughterReliability;
  }
  // Мельта/Рассеивание зависят от дистанции — флаг приходит из диалога
  const shortRange = !!opts.shortRange;
  // Выбранная полоса дальности (у оружия со своими бонусами по дистанции).
  const bandList = Array.isArray(sys.rangeBands) ? sys.rangeBands : [];
  const band     = bandList[Number(opts.bandIdx)] || null;

  const ammoSys    = loadedAmmo?.system;
  const ammoDmgMod    = ammoSys?.damageMod         ?? 0;
  const ammoPenMod    = ammoSys?.penetrationMod     ?? 0;
  const ammoRngMult   = ammoSys?.rangeMultiplier    ?? 1;
  const ammoRngAdd    = ammoSys?.rangeMod           ?? 0;
  const ammoDmgType   = ammoSys?.damageTypeOverride || "";
  const ammoDmgSubtype = ammoSys?.damageSubtypeOverride || "";
  const ammoSpecial   = ammoSys?.special            || "";

  // forcedRoll задаётся при перебросе/+10 за Очко Судьбы — повторяем ту же
  // атаку с заданным значением d100 (а не бросаем заново).
  //
  // opts.reroll — другое: переброс от правила (Локус Буйства и подобные,
  // module/rules/item-rules.mjs). Он не повторяет прошлую атаку, а катает
  // несколько кубов сразу и оставляет один. Какой — решает pickReroll: на d100
  // «лучший» это МЕНЬШИЙ, и это знание живёт в одном месте на всю систему.
  // forcedRoll старше: если атаку переигрывают, перебрасывать уже нечего.
  // Выдержка Гранаты (rules/throwing-talents.mjs, Sahara 3-8318): тест Logic(I)+0 ДО броска гранаты, если в окне стоит галочка;
  // при перебросах той же атаки результат берётся из opts.talentPaid.cooking, а не бросается заново.
  const cooking = await resolveGrenadeCooking(actor, { sys, isMelee, toggles, paid: opts.talentPaid?.cooking });
  const cookingPenalty = grenadeCookingDodgePenalty(cooking);
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
  // Локус Неизбежности (стр. 30, wdbc-smc): «попадает автоматически с 1
  // Успехом» — не «минимум 1» (как opts.forceHit/testOutcome ниже), а РОВНО
  // 1, независимо от броска. d100 всё равно катается (нужен ChatMessage) и
  // проверяется на Критический Провал/Успех (criticalOutcome ниже читает rv
  // сам), но исход и степень отсюда не берутся вовсе.
  // Распыление (стр. 168, wdbc-p06s): броска на попадание у Spray нет вовсе —
  // поток попадает автоматически по всем в конусе, а отменяет попадание сама
  // цель тестом A+0 (кнопка в карточке). Решает это attackHitOutcome, чтобы
  // правило проверялось тестом без Foundry.
  // Длань Кхорна (wdbc-1rno): «стрелковые атаки этой рукой автоматически
  // проваливаются» — читается с самого оружия атаки (module/rules/
  // hand-of-khorne.mjs::isHandOfKhorneWeapon, занимает ли оно бронзовую руку
  // ПРЯМО СЕЙЧАС), не с actor/item отдельным флагом.
  const handOfKhorneForceFail = !isMelee && handOfKhorneBlocksRangedAttack(item);
  const { success: hit, deg: rolledDeg, auto: autoHitKind } = attackHitOutcome({
    rv, threshold, isMelee, wp,
    forceHit: opts.forceHit, forceFail: handOfKhorneForceFail, fixedSuccessDeg: opts.fixedSuccessDeg
  });
  // Наследие Бойни (H1, стр. 426): +20/−30 уже сложены в порог ДО этого
  // броска (sheets/attack/selection.mjs для рукопашной ветки, sheets/attack/
  // mods.mjs для стрелковой) — здесь только гасим флаг, «следующая атака»
  // состоялась независимо от того, попала она или нет.
  if (legacyHistoryIs(item, "Наследие Бойни")) await consumeLegacySlaughterBonus(actor, item);
  // Терпение/vigilant 3-4, стрелковая ветка (wdbc-1rno.35/wdbc-1rno.41):
  // +30 уже сложены в порог ДО этого броска (sheets/attack/mods.mjs) — здесь
  // только гасим пометку «выстрел из Караула состоялся».
  if (!isMelee && patienceLegacyOverwatchWeapon(item)) await consumePatienceLegacyOverwatchPending(actor);
  // Перегруппировка/vigilant 1-2, Оружие Наследия (wdbc-1rno.35, стр. 427):
  // «После успешной атаки этим оружием (даже если цель Избежала её)» — тот
  // же «hit», что здесь, ДО любого разбора Уклонения/Парирования ниже.
  // Кнопка карточки — combat/legacy-weapon-regroup.mjs::activateLegacyRegroup.
  const regroupLegacyActive = hit && takenMutationNames(item).has("Перегруппировка");
  // Сабля, Верховая Атака (core.json, «Типы Рукопашного Оружия»): «может
  // проигнорировать бонус +20, чтобы совершить две атаки вместо одной, но по
  // разным целям на пути» — +20 уже отменён в самом threshold (галочка
  // диалога, attack-dialog.mjs), вторая атака взведена диалогом до конца Хода
  // (combat/sabre-second-attack.mjs, wdbc-f6j9y). Карточка первой атаки
  // несёт кнопку второй; карточка второй — только подпись. «На пути» система
  // не проверяет (геометрии пути нет) — кто это, решает стол.
  // Гусар (Талант Всадника, 3-cross-actor-5482): та же вторая атака, но с сохранением +20
  // и любым оружием — opts.hussarSecondAttack ставит окно атаки (sheets/attack/dialog.mjs).
  const hussarFirst = !!opts.hussarSecondAttack && !opts.sabreSecondAttackIsSecond;
  const sabreSecondAttackNote = opts.sabreSecondAttackIsSecond
    ? (opts.hussarSecondAttack ? "Гусар: вторая Верховая Атака — бонусное верховое полудействие." : "Сабля: вторая атака Верховой Атаки — без ОД, без +20.")
    : (opts.sabreSecondAttack
      ? "Сабля: +20 Верховой Атаки проигнорирован — до конца Хода доступна вторая атака этим оружием по другой цели на пути, без ОД. Выберите цель и нажмите кнопку."
      : (hussarFirst
        ? "Гусар: до конца Хода доступна вторая Верховая Атака по другой цели на пути (по той же Орде — тоже можно) за бонусное верховое полудействие. Выберите цель и нажмите кнопку."
        : ""));
  const sabreSecondAttackItemId = ((opts.sabreSecondAttack || hussarFirst) && !opts.sabreSecondAttackIsSecond) ? String(item.id ?? "") : "";
  // Маятник, Оружие Наследия (wdbc-1rno.35, vigilant 7-7, стр. 427): «Если
  // персонаж атаковал этим оружием в свой Ход...» — Свободная Атака/Контратака
  // в чужой Ход флаг не пишут (wdbc-t3c3t.5). Не гейтится попаданием
  // (книга говорит «атаковал», не «попал»), поэтому пишется тут же, до
  // разбора Уклонения/Парирования цели. Модификатор атаки = порог теста
  // МИНУС голая характеристика — ровно то, что диалог атаки насчитал сверху.
  const pendulumFlag = isActorsOwnTurn(actor) && pendulumLegacyFlagValue(item, threshold - (Number(actor.system?.characteristics?.[charKey]?.total) || 0));
  if (pendulumFlag) await actor.setFlag("warhammer-dbc", "legacyPendulumBonus", pendulumFlag);
  // Дикарь (стр. 62, wdbc-pb60): парными когтями — «+2 Успеха при успешной
  // атаке». Прибавляется к СТЕПЕНИ, а не к порогу: от степени зависят и число
  // попаданий (Быстрая/Молниеносная), и остаточные Успехи приёмов.
  const savageBonus = (hit && isMelee) ? savageExtraHits(actor, item) : 0;
  // Наследие Излишеств, Оружие Наследия (wdbc-1rno.35, История 6, стр. 427):
  // «+1 Успех на все успешные тесты WS и BS с этим оружием» — WS/BS здесь
  // ровно те же тесты, что вообще проходят через _executeAttackRoll (charKey
  // атаки всегда ws/bs), отдельного гейта по charKey не нужно.
  const excessBonus = excessLegacyExtraDeg({ hit, weapon: item });
  // Бой Один На Один (Палач, combat/single-combat.mjs): +1 Успех к успешной
  // рукопашной атаке (тест WS/S/A), пока на сцене ровно один враг в контакте.
  const singleCombatDeg = (hit && isMelee) ? singleCombatBonus(actor, { success: hit, charKey }) : 0;
  // Искусный (Adroit, Ренегат — rules/adroit.mjs): +1 Успех к успешной атаке
  // на выбранной WS/BS. Только когда исход решил бросок (autoHitKind пуст):
  // Распыление и «ровно N Успехов» тестом Характеристики не являются.
  const adroitBonus = autoHitKind ? 0 : adroitDegreeBonus(actor, charKey, hit);
  // Bolter Drill / Болтерная Муштра (weaponsmith.core.bolterDrill): «Успешные
  // тесты на стрельбу Болт оружием получают +1 Успех».
  const bolterDrillBonus = (hit && charKey === "bs" && item?.system?.weaponType === "bolt"
    && hasTalentCapability(actor, "weaponsmith.core.bolterDrill")) ? 1 : 0;
  // Очко Бесчестия «Успех» из меню карточки (apps/infamy-success.mjs): атака переигрывается тем же кубом
  // с дописанными Успехами — только к успешному попаданию.
  const infamySuccessDeg = hit ? Math.max(0, Math.trunc(Number(opts.extraDeg) || 0)) : 0;
  const deg = rolledDeg + savageBonus + excessBonus + singleCombatDeg + adroitBonus + bolterDrillBonus + infamySuccessDeg;
  // Посох/Крюк (core.json, «Типы Рукопашного Оружия»): «При Избирательном
  // попадании в Ногу [Посохом]... может потратить Реакцию, чтобы провести
  // против цели прием Повалить» / «На 3+ Успеха на попадание [Крюком]...».
  // Строка причины — и доступность кнопки, и её подпись разом; пусто = кнопки
  // нет. aimTarget?.value — тот же параметр, что уже определяет
  // Избирательность атаки везде выше по функции.
  const reactionKnockdownReason = (isMelee && hit && sys.meleeCategory === "Посох" && aimTarget?.value === "leg")
    ? "Посох: Избирательное попадание в Ногу"
    : (isMelee && hit && sys.meleeCategory === "Крюк" && deg >= 3)
      ? "Крюк: 3+ Успеха на попадание"
      : "";
  // Крит-диапазон (натуральные 1-5/96-100, стр. 25) — не путать с «Критическим
  // Результатом/Эффектом» ниже: тот триггерится свойством Extreme оружия по
  // граням урона, этот — только по натуральному броску атаки, независимо от
  // оружия. Расширяется правилом kind:"critRangeMod", см. attack-dialog.mjs.
  // Крит-диапазон читается по броску АТАКИ — у Распыления его нет (d100 всё
  // равно катается: он нужен ChatMessage и анимации кубов), поэтому строка
  // Критического Успеха/Провала для Spray не печатается вовсе.
  const critOutcome = autoHitKind === "spray" ? null : criticalOutcome(rv, opts.crit);
  const critLine = critOutcome ? critLineHtml(critOutcome) : "";
  // Критический Успех на попадание (стр. 34, wdbc-x1nz.2.47): «накладывает
  // штраф −30 на Избегания от этого попадания» — считается один раз здесь и
  // прибавляется к dodgeMod/dodgeModRecoil/parryMod ниже, которые уже
  // одинаково читают Уклонение/Парирование/Вираж/Уклонение верхом. Скрытая
  // атака (hiddenAttack, -999) Избегание уже блокирует целиком — прибавлять
  // сюда нечего, поэтому там веток нет.
  const critHitPenalty = (hit && critOutcome?.success) ? -30 : 0;
  // Концентрация огня (Командное Присутствие, эффект 2; combat/command-state.mjs
  // ::declareFocusFire): атака за тройку подчинённых — попадания получают −20
  // на все тесты Избегания и +2 куба урона. Метка на атакующем, одна атака.
  // Рисовка (Талант «Рукопашных»): потерявший Командование эту метку не использует (rules/command-suppression.mjs).
  const focusFire = commandSuppressedNow(actor.getFlag?.("warhammer-dbc", COMMAND_SUPPRESSED_FLAG), globalThis.game?.combat)
    ? null : actor.getFlag?.("warhammer-dbc", "focusFire");
  const focusFireOn = !!focusFire && focusFire.weaponName === item.name;
  // «Быстрые и Мёртвые» (Размер < 2): атака «Тройки» для них — атака
  // одиночного персонажа, ни −20, ни +2 куба (rules/horde-single-target.mjs).
  // Метка всё равно гасится ниже — Тройка свою атаку совершила.
  const focusFireBonusOn = focusFireOn && !evadesHordeAsSingle(defenderActor);
  const focusEvasion = focusFireBonusOn ? -20 : 0;

  // Граната, Критический Промах (стр. 40, wdbc-x1nz.2.59): «граната падает
  // персонажу под ноги и взрывается» — весь остаток обычного разбора атаки
  // (попадание по намеченной цели, урон по ней, Уклонение) для этого броска
  // не нужен вовсе, поэтому короткое замыкание здесь же, как у Клина ниже.
  // Формулировка книги не привязывает эту строку к рукопашному «нацепить»
  // отдельно от обычного броска — стоит последним предложением всего абзаца
  // «Граната», поэтому применяется к любому броску этим оружием.
  if (sys.weaponType === "grenade" && critOutcome?.failure) {
    await resolveGrenadeMeleeFumble(actor, item);
    return;
  }

  // Кистень/Кнут, Критический Промах (core.json, «Типы Рукопашного Оружия»):
  // «При Критическом Промахе наносит попадание по себе в случайную часть
  // тела» — тот же приём короткого замыкания, что у гранаты выше. Кнут
  // дополнительно не получает бонус Силы к этому попаданию (книга).
  if (isMelee && critOutcome?.failure
    && (sys.meleeCategory === "Кистень" || sys.meleeCategory === "Кнут")) {
    await resolveFlailMeleeFumble(actor, item, { noStrengthBonus: sys.meleeCategory === "Кнут" });
    return;
  }

  // ── Заклинивание (только для дальнобойного оружия со свойством надёжности) ──
  // Распыление клинит не по броску атаки, а по первому кубику урона (стр. 168,
  // sprayJamFace) — общий порог по d100 к нему неприменим, см. sprayJam ниже.
  const jamAt    = jamThreshold(wp);
  // Метательное (стр. 40, wdbc-x1nz.2.58): «При Критическом Промахе,
  // метательное оружие не Заклинивает» — исключено из общего механизма
  // Заклинивания по Надёжности целиком, не только на натуральном крите.
  const jammed   = !isMelee && !wp.spray && sys.weaponClass !== "thrown" && jamAt !== null && rv >= jamAt;
  if (jammed) {
    // wdbc-vwfk: раньше заклинивание было только строкой в чате, без
    // последствий — теперь пишет реальное состояние предмета (weaponClass
    // проверен isMelee выше), которое блокирует кнопку «Атака» на листе
    // (sheet-helpers.mjs::weaponView) до «Расклинить»
    // (weapon-properties.mjs::clearWeaponJam).
    // Клин портит 2×RoF патронов из магазина (стр. 41, wdbc-x1nz.2.61) — не
    // пропадают насовсем, а уходят в jammedAmmo: «Расклин» их не трогает,
    // возвращает в magazineCur отдельный тест Trade(Weaponsmith)+10 вне боя
    // (combat/clear-jam.mjs::rollRestoreJammedAmmo).
    const curMag = sys.magazineCur || 0;
    // Выпуск Батареи: очередь идёт с RoF 10 (не со своей скорострельностью оружия) и ломает оружие даже при клине.
    const spoiled = Math.min(2 * (_getAmmoSpent({ system: batpackOn ? { ...sys, rof_full: BATPACK_ROF } : sys }, rofMode) || 0), curMag);
    await item.update(magazineUpdate(curMag - spoiled, {
      "system.jammed": true,
      "system.jammedAmmo": (sys.jammedAmmo || 0) + spoiled,
      ...(batpackOn && !opts.skipAmmo ? { "system.destroyed": true } : {})
    }));
    const jamData = ChatMessage.applyRollMode({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: jamCard({
        weaponName: item.name, rv, blocks: { props: buildPropertyChatBlock(wProps) },
        spoiled
      }),
      rolls: [roll],
      sound: CONFIG.sounds.dice
    }, rollMode);
    await ChatMessage.create(jamData);
    return;
  }

  // ── Оружие не по руке в лапах Огрина (wdbc-flai) ──────────────────────────
  // Бросок ПОСЛЕ атаки и независимо от попадания: Огрин ломает человеческую
  // рукоять самим ударом. Стрелкового не касается — там своя цена (−20 к
  // тесту, rules/ogryn-fit.mjs).
  //
  // wdbc-2gn (находка 4, ревью 07.09.2026): гейт тот же opts.skipAmmo, что
  // выше не даёт патронам расходоваться повторно (комментарий строкой выше:
  // «При перебросе/+10 за Очко Судьбы это тот же выстрел»). «Сдвинуть место
  // попадания», Горжет и оба переброса за Судьбу (hooks.mjs) переигрывают ЭТУ
  // ЖЕ атаку через opts.forcedRoll поверх той же карточки — без гейта один
  // физический удар катал 2-3 независимых броска на поломку рукояти, в т.ч.
  // по клику ЗАЩИЩАЮЩЕГОСЯ (кнопка Горжета жмётся с его стороны стола).
  const ogrynBreak = opts.skipAmmo ? null : await rollOgrynWeaponBreak({
    actor, item, isMelee,
    hasOgrynized: wProps.some(p => (p?.key ?? p) === "ogryned")
  });

  // Место попадания. locationShift — сдвиг результата (±A.b) от Таланта/Черты
  // «сдвинуть место попадания» (kind:"script" Конструктора ставит на предмет
  // flags.warhammer-dbc.hitLocationShift = true; см. кнопки ниже, у карточки,
  // и обработчик в hooks.mjs — они переигрывают эту же атаку с тем же rv
  // через opts.forcedRoll, добавляя opts.locationShift).
  const { locRoll, label: rolledLoc } = hitLocation({ rv, hit, shift: opts.locationShift, aimTarget });
  let hitLocLabel = sabotageOn ? `оружие «${sabotageWeapon.name}»` : rolledLoc;

  // ── Цель — техника: место попадания по таблице машины (реверс броска),
  //    либо по указанной части при Избирательной атаке (aimTarget.vehiclePart).
  const targetIsVehicle = [...(game.user?.targets ?? [])]
    .some(t => (t.actor ?? t.document?.actor)?.type === "vehicle");
  // Шагоход среди целей — отдельный вопрос: только у него книга даёт машине
  // Парирование и Уклонение (wdbc-6wzt, rules/walker.mjs::isWalkerVehicle).
  const targetIsWalker = [...(game.user?.targets ?? [])]
    .some(t => isWalkerVehicle(t.actor ?? t.document?.actor));
  let vehPart = null;
  if (targetIsVehicle) {
    vehPart = aimTarget?.vehiclePart || vehicleHitLocation(locRoll).label;
    hitLocLabel = vehPart;
  }

  // Атаки по площади (стр. 34, wdbc-x1nz.2.48): «Атаки по площади всегда
  // попадают в торс» — Взрывное и Распыление (шаблон/облако накрывает
  // область, а не целится точно) перезаписывают и обычную реверс-таблицу, и
  // прицел/таблицу техники выше. У техники своей «части тела» нет — ближайший
  // книжный аналог «центра масс» это Корпус (locationForHit уже посылает туда
  // третье и далее попадание по технике тем же смыслом).
  if (hit && (wp.blastRating > 0 || wp.spray)) {
    if (targetIsVehicle) vehPart = "Корпус";
    hitLocLabel = targetIsVehicle ? "Корпус" : "Торс";
  }

  // Керамит (wdbc-nquc, DoomBC IV. Арсенал, стр. 231): иммунитет к
  // СВОЙСТВАМ оружия Deflagrate/Melta — отдельно от иммунитета к типу/
  // подвиду урона (absorption.vsSubtype.flame), который у Керамита уже
  // смоделирован ActiveEffect'ом. Оба свойства запекаются прямо в бросок
  // атаки (доп. кубик Выгорания ниже, удвоение Пробития у attackPenetration)
  // — не отдельным "rating"-полем, применяемым позже в damage.mjs, как
  // Corrosive/Piercing/Crippling/Haywire, — поэтому цель читается здесь же,
  // тем же приёмом, что у Горжета чуть ниже: первый выцеленный токен на
  // сцене на момент броска.
  const wpImmunityToken  = [...(game.user?.targets ?? [])][0] ?? null;
  const wpImmunityActor  = wpImmunityToken?.actor ?? wpImmunityToken?.document?.actor ?? null;
  const meltaImmune      = hasWeaponPropertyImmunity(wpImmunityActor, "melta");
  const deflagrateImmune = hasWeaponPropertyImmunity(wpImmunityActor, "deflagrate");

  // Горжет (стр. 228, wdbc-8b5): случайное (не Избирательное) попадание в
  // голову можно попытаться перевести в Торс — кнопка на карточке бросает
  // 1d10 и, на X+ рейтинга свойства Gorget надетого шлема цели, шлёт сюда же
  // opts.gorgetRoll через переигровку этой же карточки (тот же приём, что и
  // opts.locationShift выше). Читает цель заново из game.user.targets на
  // момент клика — тот же риск/точность, что у locationShift.
  let gorget = null;
  if (!targetIsVehicle && !aimTarget?.value && hitLocLabel === "Голова") {
    const gorgetTargetToken = [...(game.user?.targets ?? [])][0] ?? null;
    const gorgetDefender = gorgetTargetToken?.actor ?? gorgetTargetToken?.document?.actor ?? null;
    const rating = Number(gorgetDefender?.system?.absorption?.propFlags?.head?.gorgetRating) || 0;
    if (rating > 0) {
      gorget = { rating, outcome: null };
      if (opts.gorgetRoll) {
        const roll = Number(opts.gorgetRoll) || 0;
        const success = roll >= rating;
        gorget.outcome = { roll, success };
        if (success) hitLocLabel = "Торс";
      }
    }
  }

  // Кнут (core.json, «Типы Рукопашного Оружия»): «При попадании в конечность
  // кнутом персонаж может выбрать дать ему свойство Snare (–2)» — «может
  // выбрать» реализовано кнопкой применения к цели (buildTargetEffectButtons
  // ниже, тот же путь, что у любого другого targetEffect-свойства вроде
  // Оглушающего) — решение это клик по ней, отдельная галочка не нужна.
  // wProps — тот же массив, что читает buildTargetEffectButtons в конце
  // функции (общая ссылка, мутация видна там же); guard на уже имеющийся
  // Snare — не переписывать собственное свойство оружия, если оно уже есть.
  // Обе формы места попадания — случайный бросок ("П. Рука"/"Л. Рука"/
  // "П. Нога"/"Л. Нога") и Избирательная атака (aimTarget → "Рука"/"Нога",
  // без стороны, см. AIM_LOCATIONS в attack-outcome.mjs) — книга не различает
  // сторону конечности, обе считаются «конечностью».
  if (isMelee && hit && sys.meleeCategory === "Кнут"
    && ["П. Рука", "Л. Рука", "П. Нога", "Л. Нога", "Рука", "Нога"].includes(hitLocLabel)
    && !wProps.some(p => p.key === "snare")) {
    wProps.push(...resolveWeaponPropsList([{ key: "snare", rating: -2 }]));
  }

  // Место конкретного попадания: у техники 1-е и 2-е — в часть, остальные в Корпус;
  // у существ — множественные (3+) идут в Торс.
  // Импульсное (aeldari.json): каждый 4-й натуральный выстрел очереди попадает
  // в Сочленение/Шею — даже неприцельно. "Сочленение / Шея" уже сквозная
  // локация в движке (AP÷3 в armor-properties.mjs, crit-таблица "голова" в
  // critical-tables.mjs) — переиспользуем её, не заводя новую метку. Storm/
  // Twin-linked (wp.extraHits) домножают/добавляют попадания поверх
  // естественного RoF, и книга не оговаривает порядок «естественных» среди
  // уже умноженных — не гадаем, авто-подстановка ограничена оружием без
  // extraHits (техника исключена: у неё locForHit целит в части машины).
  // Двойной Выстрел (rules/gunner-talents.mjs): 1-е попадание — Торс, 2-е —
  // Голова, остальные отброшены (hitsCount ниже). Жёстко, до Избеганий.
  const doubleTapOn = doubleTapActive(actor, { opts, isMelee, rofMode, aimValue: aimTarget?.value, targetIsVehicle });
  const locForHit = (i) => {
    if (doubleTapOn) return doubleTapLocation(i);
    if (wp.impulse && !targetIsVehicle && !wp.extraHits && (i + 1) % 4 === 0) return "Сочленение / Шея";
    return locationForHit(i, { label: hitLocLabel, hitsCount, targetIsVehicle, vehiclePart: vehPart });
  };

  // Fanning / Быстрый Курок (wdbc-fy33, стр. 39): RoF Длинной очереди 2..BS.b
  // по выбору игрока заменяет фиксированный sys.rof_full — только для
  // потолка попаданий и расхода патронов этого броска, реальный предмет не
  // трогаем (клон, не мутация sys).
  // Залповый Бросок (rules/throwing-talents.mjs): метательный нож/флешета в режиме "full" — RoF 2..4 по выбору,
  // зажимается здесь же, чтобы подделанное значение окна не дало больше четырёх.
  const volleyOn = rofMode === "full" && volleyThrowApplies(actor, sys);
  const rofOverride = volleyOn ? volleyRof(opts.rofCapOverride) : (Number(opts.rofCapOverride) || 0);
  const fanningSys = (rofMode === "full" && rofOverride > 0)
    ? { ...sys, rof_full: rofOverride } : sys;
  // Широкая Очередь (стр. 35, wdbc-x1nz.2.53): «уменьшая RoF (но не расход
  // боеприпасов) на 2» — режет ТОЛЬКО потолок попаданий (hitCountSys ниже),
  // расход патронов (_getAmmoSpent) намеренно читает fanningSys БЕЗ этого
  // урезания. Доступна только при базовом RoF выбранного режима ≥3
  // (attack-dialog.mjs гейтит галочку тем же условием, здесь — своя честная
  // проверка на случай прямого вызова с opts.wideBurst).
  const wideBurstKey = rofMode === "semi" ? "rof_semi" : rofMode === "full" ? "rof_full" : null;
  const wideBurst = !!opts.wideBurst && !!wideBurstKey && (Number(sys[wideBurstKey]) || 0) >= 3;
  // Огневая Клеть (rules/gunner-talents.mjs): Широкая Длинная очередь — эффективный RoF ещё на 3 меньше,
  // а цель тратит вдвое больше Успехов на Уклонение (evadeCost → кнопки Уклонения карточки).
  const cageFiring = cageFiringApplies(actor, { toggles, isMelee, rofMode, wideBurst });
  wp.evadeCost = cageFiring ? CAGE_FIRING_EVADE_COST : 1;
  const hitCountSys = wideBurst
    ? { ...fanningSys, [wideBurstKey]: Math.max(0, (Number(fanningSys[wideBurstKey]) || 0) - 2 - (cageFiring ? 3 : 0)) }
    : fanningSys;
  const wideBurstPenalty = wideBurst ? -20 : 0;
  // Верный Выстрел (rules/gunner-talents.mjs): после успешного одиночного выстрела 1 Очко Бесчестия —
  // Уклонение цели от этого выстрела −10 за каждый Успех на попадание. Очко платится один раз
  // (перебросы того же выстрела — skipAmmo — не платят повторно, но штраф сохраняют).
  let sureShotOn = sureShotApplies(actor, { toggles, isMelee, rofMode, hit });
  // Оплата Очка запоминается в opts.talentPaid (storedOpts → перебросы): переброс заплаченного выстрела не платит,
  // а переброс, где промах стал попаданием, или выстрел без Очков — не получает штраф бесплатно.
  if (sureShotOn && !opts.talentPaid?.sureShot) {
    if (actorInfamyValue(actor) >= 1) {
      const path = actorInfamyPath(actor);
      const spend = await spendFromInfamyPool(actor, 1, path);
      if (spend) await actor.update({ [path]: spend.poolValue });
      else sureShotOn = false;
    } else {
      ui.notifications?.warn("Верный Выстрел: нет Очков Бесчестия.");
      sureShotOn = false;
    }
  }
  const sureShotPaid = sureShotOn || !!opts.talentPaid?.sureShot;
  const sureShotPenalty = sureShotOn ? sureShotDodgePenalty(deg) : 0;

  // Смертельный Удар (Берсерк, rules/berserker-talents.mjs): Полная Атака + Очко Бесчестия — Избегания
  // цели от этой атаки невозможны (кнопки Уклонения/Парирования гаснут, как у скрытой атаки). Платится при
  // попадании (промах Избегать нечего), раз в Ход (метка killingStrikeThisTurn); переброс той же атаки не
  // платит повторно, но эффект сохраняет (opts.talentPaid → storedOpts).
  const killingStrikeReplay = !!opts.talentPaid?.killingStrike;
  let killingStrikeOn = hit && killingStrikeApplies(actor, {
    isMelee, baseKey: opts.baseKey, toggles, replay: killingStrikeReplay });
  if (killingStrikeOn && !killingStrikeReplay) {
    if (actorInfamyValue(actor) >= 1) {
      const path = actorInfamyPath(actor);
      const spend = await spendFromInfamyPool(actor, 1, path);
      if (spend) {
        await actor.update({ [path]: spend.poolValue });
        await actor.setFlag?.("warhammer-dbc", KILLING_STRIKE_FLAG, true);
      } else killingStrikeOn = false;
    } else {
      ui.notifications?.warn("Смертельный Удар: нет Очков Бесчестия.");
      killingStrikeOn = false;
    }
  }
  const killingStrikePaid = killingStrikeOn || killingStrikeReplay;

  // Один Из Нас Падёт (Берсерк, rules/berserker-talents.mjs, combat/one-will-go-down.mjs): Полная Атака по
  // Ненавистной цели — Dmg ×2 (ниже, вместе с Беспомощной целью — удвоение одно) и 1d5 непоглощаемого урона
  // в руку носителю ПРИ ЛЮБОМ исходе, даже при промахе. Переброс той же атаки (opts.talentPaid → storedOpts)
  // сохраняет ×2, но руку второй раз не ранит. Усталость — по итогу: кнопка на карточке или карточка урона.
  const owgdReplay = !!opts.talentPaid?.oneWillGoDown;
  const owgdOn = oneWillGoDownApplies(actor, { isMelee, baseKey: opts.baseKey, toggles, targetActor: defenderActor, replay: owgdReplay });
  if (toggles.oneWillGoDown && !owgdOn && !owgdReplay) {
    ui.notifications?.warn("Один Из Нас Падёт не сработал: нужны Полная Атака и Ненавистная цель (выделите её на сцене). Руке ничего не стоило.");
  }
  const owgdHand = (owgdOn && !owgdReplay) ? await rollOneWillGoDownHandDamage(actor) : null;

  // Тяжёлый Хук (Пугилист, rules/pugilist-talents.mjs, combat/pugilist-strikes.mjs): атака кулаком с отказом от второй
  // руки — +½T.b Dmg (окр.▼) и, если цель получила попадание, встречный тест S+0 vs S+0 (кнопка карточки урона).
  // Отказ ставит метку Хода (закрывает «Обе руки»); переброс оплаченной атаки метку не пишет, бонус сохраняет.
  const haymakerReplay = !!opts.talentPaid?.haymaker;
  const haymakerOn = haymakerApplies(actor, { weapon: item, isMelee, toggles, replay: haymakerReplay });
  if (haymakerOn && !haymakerReplay) await actor.setFlag?.("warhammer-dbc", HAYMAKER_FORFEIT_FLAG, true);
  const haymakerBonus = haymakerOn ? haymakerDamageBonus(actor) : 0;
  // Направляющий Удар: штраф −20 уже в пороге окна; здесь только кнопка свободного Давления при Успехе (на карточке).
  const goadingOn = goadingStrikeApplies(actor, { weapon: item, isMelee, toggles });
  // Удар с Колена: «ногой, которой он еще не атаковал в этот Ход» — любой удар ногой (интегральная атака с Хватом «Ног»)
  // засчитывается в счётчик Хода; переброс той же атаки (forcedRoll/skipAmmo) — не новый удар.
  if (isMelee && isKickWeapon(item) && !opts.forcedRoll && !opts.skipAmmo) {
    await actor.setFlag?.("warhammer-dbc", LEG_ATTACKS_FLAG, (Number(actor.getFlag?.("warhammer-dbc", LEG_ATTACKS_FLAG)) || 0) + 1);
  }

  // Попадания и расход патронов
  const { count: hitsCountBase, label: rofLabel } = hitCount({
    hit, isMelee, rofMode, deg, wp, sys: hitCountSys,
    isSwift: opts.isSwift, isLightning: opts.isLightning,
    // Потолок попаданий Быстрой/Молниеносной — бонус WS атакующего (стр. 14).
    wsBonus: Number(actor.system?.characteristics?.ws?.bonus) || 0
  });
  // Двойной Выстрел: дальше второго попадания — «пролетают над целью, промахи».
  const hitsCount = doubleTapOn ? doubleTapHits(hitsCountBase) : hitsCountBase;
  let ammoSpent = 0;
  let controlledBurstSaved = 0;
  let burstRofUsed = null;   // RoF очереди после Контролируемой Очереди — от него считается Насыщение

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
  const hasLocShiftTalent = hasHitLocationShift(actor.items);
  const canShiftLoc = hit && hitsCount === 1 && (isRangedSingle || isMeleeStandard)
    && (!aimTarget?.value || aimTarget.value === "underfoot") && agBonus > 0 && hasLocShiftTalent;

  // Тратим патроны
  let ammoWarning = "";
  // Рука Смерти (wdbc-hftn, стр. 46): сросшееся дальнобойное генерирует
  // боеприпасы из метаболизма носителя — вместо нового класса расходуемого
  // ресурса (которого в системе нет вовсе) магазин просто не расходуется.
  // Оба книжных источника «выстрел не тратит патрон» — Рука Смерти и Дар
  // «Рука-Пушка» — живут в rules/ammo-free.mjs, см. его шапку.
  const infiniteAmmo = ammoIsFree(item, actor);
  if (!isMelee && rofMode !== "melee" && !infiniteAmmo) {
    // Контролируемая Очередь (rules/gunner-talents.mjs): расчётный RoF — не меньше половины и не меньше
    // попаданий+1 (без бонусных от Storm/Twin-linked).
    let ammoRof = _getAmmoSpent({ system: fanningSys }, rofMode);
    if (controlledBurstApplies(actor, { toggles, isMelee, rofMode, wideBurst })) {
      const naturalHits = wp.extraHits === "storm" ? Math.ceil(hitsCountBase / (wp.stormRating || 2))
        : wp.extraHits === "twinLinked" ? Math.max(0, hitsCountBase - 1) : hitsCountBase;
      const reduced = controlledBurstRof({ rof: ammoRof, hits: naturalHits });
      if (reduced < ammoRof) { controlledBurstSaved = ammoRof - reduced; ammoRof = reduced; }
    }
    burstRofUsed = ammoRof;
    ammoSpent = ammoRof * (wp.ammoMult || 1) * (maximalOn ? 2 : 1) * (torrentOn ? 2 : 1) + prisma.extraAmmo;
    // При перебросе/+10 за Очко Судьбы это тот же выстрел — патроны не тратятся повторно.
    if (!opts.skipAmmo) {
      if (ammoSpent > 0) {
        const curMag = sys.magazineCur || 0;
        const newMag = Math.max(0, curMag - ammoSpent);
        await item.update(magazineUpdate(newMag));
        if (newMag === 0) {
          ammoWarning = `<div class="roll-allout-note">Магазин пуст! Требуется перезарядка.</div>`;
        } else if (newMag <= Math.ceil((sys.magazineMax || 1) * 0.25)) {
          ammoWarning = `<div class="roll-ammo-low">Патроны на исходе: ${newMag}/${sys.magazineMax}</div>`;
        }
      }
      // Призма сбрасывается наполовину (окр. вниз) после ЛЮБОГО выстрела —
      // wdbc-8zi (п.5): раньше висело внутри `ammoSpent > 0` — концептуально
      // неверная связка (сброс должен зависеть от «это не переброс/Очко
      // Судьбы», а не от того, потратился ли патрон), хотя на СЕГОДНЯШНЕМ
      // составе свойств она и не давала наблюдаемого расхождения:
      // prisma.extraAmmo = заряд×рейтинг уже входит в ammoSpent, так что при
      // заряде>0 (единственный случай, где halvePrismaCharge вообще что-то
      // меняет) ammoSpent и без него положителен. Разъезд стал бы реальным
      // при любом будущем свойстве/режиме, зануляющем ammoMult или базовый
      // расход, — на всякое такое незачем городить отдельный частный случай.
      await halvePrismaCharge(item, wp);
    }
  }

  // Выпуск Батареи: после этой атаки оружие ломается и бесполезно (system.destroyed, как у Огрина и Песни
  // Перерождения); перебросы того же выстрела (skipAmmo) повторно не ломают — оно уже сломано.
  if (batpackOn && !opts.skipAmmo) await item.update({ "system.destroyed": true });

  // Граната в рукопашной (стр. 40, wdbc-x1nz.2.60): «...то граната не
  // тратится» сказано ТОЛЬКО про промах — читаем это как обратное для
  // попадания. Не через ammoSpent/magazineCur выше (это не магазин) — тот же
  // счётчик quantity и та же логика «>1 — decrement, иначе удалить предмет»,
  // что у «Вырвать чеку»/детонации на Крит-Промахе (draw-action.mjs).
  if (isMelee && hit && sys.weaponType === "grenade" && !opts.skipAmmo) {
    const qty = Number(sys.quantity) || 1;
    if (qty > 1) await item.update({ "system.quantity": qty - 1 });
    else await item.delete();
  }

  // Урон
  const chars     = actor.system.characteristics || {};   // у техники нет характеристик
  const isPsyker  = !!actor.system.isPsyker;
  const pr        = actor.system.psyker?.currentRating ?? 0;
  // Психосиловое в руках псайкера: +PR к урону и Pen (макс +10)
  const forceBonus = (wp.forcePR && isPsyker) ? Math.min(pr, 10) : 0;

  // Перемены (Change, стр. 74 Книги Аэльдари): +X Pen, если цель отмечена
  // бездушной/техникой в диалоге атаки (галочка, не авто — трейта «бездушный»
  // на акторе нет).
  const changePenBonus = (opts.changeSoulless && wp.changeRating) ? wp.changeRating : 0;
  // Грозный Вопль/Dread Wail (wdbc-sk8s) — усилитель звукового оружия, живёт
  // до начала следующего Хода (module/combat/dread-wail.mjs).
  const dreadWailBonus = dreadWailWeaponBonus(actor, item);
  // Керамит (wdbc-nquc): цель с иммунитетом к Melta не получает удвоение
  // Пробития в упор — attackPenetration остаётся чистой функцией без Foundry,
  // поэтому иммунитет гасится здесь, клоном wp только для этого вызова
  // (bonusDamageDice ниже по-прежнему видит настоящий wp.meltaShort — оно
  // делит поле shortRange с Рассеиванием/Scatter, которое Керамит не гасит).
  const penWp = meltaImmune ? { ...wp, meltaShort: false } : wp;
  // Смертоносное Природное Оружие (Cor.b)/Deadly Natural Weapons (wdbc-ux8a):
  // +Cor.b владельца И к Пробитию (здесь), И к урону (flatBonus ниже) —
  // живой пересчёт на каждой атаке, отдельный флаг от tainted (другая находка).
  const deadlyNaturalCorBAdd = wp.deadlyNaturalCorB ? (actor.system.corruptionBonus ?? 0) : 0;
  // Естественное оружие Даров Одержимости (wdbc-o368c): рейтинг DNW от
  // Проявления по Порче — rules/invocation-natural.mjs.
  const invocationAdd = invocationNaturalAdd(wp, actor);
  // Plasma Mastery / Мастерство Плазмы (weaponsmith.core.plasmaMastery): в
  // Максимальном режиме плазмы ещё +2 Pen (здесь) и +2 Dmg (flatBonus ниже) —
  // после удвоений, тем же местом, что собственные +2 Pen Maximal.
  const plasmaMastery = plasmaMasteryBonus(actor, { isMelee, sys, maximalOn, blastChosen: !!opts.plasmaBlast });
  // Око Мщения (rules/gunner-talents.mjs): Очко Бесчестия платится ОДИН раз, при включении галочки
  // (не при перебросах того же выстрела); дальше флаг на акторе держит усиление за этим оружием
  // до начала следующего Хода (rules/turn-flags.mjs).
  let eyeActiveId = actor.getFlag?.("warhammer-dbc", EYE_OF_VENGEANCE_FLAG) ?? null;
  if (toggles.eyeOfVengeance && eyeActiveId !== item.id && !opts.skipAmmo && eyeOfVengeanceAvailable(actor, { isMelee })) {
    if (actorInfamyValue(actor) >= 1) {
      const path = actorInfamyPath(actor);
      const spend = await spendFromInfamyPool(actor, 1, path);
      if (spend) {
        await actor.update({ [path]: spend.poolValue });
        await actor.setFlag?.("warhammer-dbc", EYE_OF_VENGEANCE_FLAG, item.id);
        eyeActiveId = item.id;
      }
    } else {
      ui.notifications?.warn("Око Мщения: нет Очков Бесчестия.");
    }
  }
  const eyeBonus = eyeOfVengeanceBonus(actor, { item, isMelee, activeWeaponId: eyeActiveId });
  // Тех-Оружейник (rules/gunsmith-talents.mjs): +I.b к Dmg и Pen, раз на оружие до новой настройки (метка на оружии).
  const weaponTech = weaponTechShot(actor, { item, isMelee, toggles, replay: !!opts.talentPaid?.weaponTech,
    spent: item.getFlag?.("warhammer-dbc", WEAPON_TECH_SPENT_FLAG) });
  if (!opts.talentPaid?.weaponTech) {
    if (weaponTech.retune) await item.setFlag?.("warhammer-dbc", WEAPON_TECH_SPENT_FLAG, false);
    if (weaponTech.spend) await item.setFlag?.("warhammer-dbc", WEAPON_TECH_SPENT_FLAG, true);
  }
  if (weaponTech.refused) ui.notifications?.warn("Тех-Оружейник: оружие уже давало усиленный выстрел — перенастройте его (5 минут) заново.");
  const weaponTechBonus = weaponTech.bonus;
  // Охотник на Танки (rules/tank-hunter.mjs): +2×I.b к Pen против опознанной в этом бою модели техники.
  const tankHunter = tankHunterForAttack(actor, { isMelee, targetActor: defenderActor });
  const pen = attackPenetration({
    base: effPen0 + ammoPenMod + (modFx.penMod || 0) + offPenMod + (qAuto.penMod || 0) + changePenBonus + dreadWailBonus.pen + deadlyNaturalCorBAdd + invocationAdd.pen + eyeBonus + weaponTechBonus + tankHunter.penBonus + hammerBlow.pen,
    wp: penWp, hit, deg, shortRange, maximal: maximalOn, band, forceBonus: forceBonus + plasmaMastery.pen
  });

  const corVal   = Number(actor.system?.corruption?.value ?? 0);
  const dtLabel = DAMAGE_TYPES[ammoDmgType || effDmgType] || ammoDmgType || effDmgType;
  const sb      = chars.s?.bonus ?? 0;

  // Бонус Силы в рукопашной: Могучее ×2, Сдержанное = 0, Обратный хват ½
  const sbHalf = !!opts.gripSbHalf;
  // Длань Кхорна (wdbc-1rno): «удваивает S.b в расчёте атак ЕЮ» — отдельный
  // множитель поверх Могучего/Сдержанного/Обратного хвата (читает саму эту
  // атаку, module/rules/hand-of-khorne.mjs::isHandOfKhorneWeapon), не
  // заменяет их: тот же принцип, что у stacking модификаторов урона выше.
  const sbEff  = meleeStrengthBonus({ sb, wp, sbHalf }) * (isMelee ? handOfKhorneStrengthMultiplier(item) : 1);
  // Обратный Хват + Выпад Полной Атакой (стр. 39): sbHalf сюда уже приходит
  // false (module/sheets/attack/selection.mjs гасит его для этой связки), т.е.
  // sbEff — полный S.b. Книга поверх него добавляет ЕЩЁ +½S.b (окр.▲) —
  // именно добавляет, а не заменяет половину на целое (это она уже дала выше).
  const reverseThrustBonus = (isMelee && opts.reverseThrustBonus) ? Math.ceil(sbEff / 2) : 0;
  // Порча: +Cor.b владельца к урону
  const taintedAdd = wp.taintedCorB ? (actor.system.corruptionBonus ?? 0) : 0;

  const ammoCondDmg = Number(opts.ammoCondDmg) || 0;
  const bandDmg     = Number(band?.dmg) || 0;
  // Ручной бонус к урону из диалога атаки (поле «Бонус урона», ГМ/игрок
  // вписывает число вручную — напр. Экстремальный урон правила, разовая
  // ситуативная надбавка без отдельного галочки в реестре модификаторов).
  const dmgBonus    = Number(opts.dmgBonus) || 0;
  // Brutal Charge/Брутальный Натиск — только при Базе «Натиск». rofMode у
  // рукопашной всегда "melee" (база живёт в opts.baseKey из диалога) —
  // прежний гейт rofMode==="charge" не срабатывал никогда.
  const chargeBonus = (isMelee && opts.baseKey === "charge") ? brutalChargeDamageBonus(actor) : 0;
  // Кровавое Пламя (wdbc-1rno): +2 Dmg за каждого убитого этим оружием с
  // начала усиления, до +8 — читается заново на каждый бросок с самого
  // оружия (module/rules/blood-flame.mjs), не хранится отдельным числом.
  const bloodFlameBonus = bloodFlameDamageBonus(item);
  // Метательное (стр. 40, wdbc-x1nz.2.58): «+S.b к урону» — даже брошенное
  // (не рукопашное использование), в отличие от прочего стрелкового, которое
  // S.b к урону никогда не получает.
  // Балеарец (3-8318): ½A.b (окр.▲) прибавляется к САМОМУ S.b, поэтому идёт
  // под те же множители/обнуление, что и S.b (Могучее ×2, Сдержанное = 0) —
  // а не отдельным слагаемым сверху.
  const balearicSb = (!isMelee && sys.weaponClass === "thrown") ? balearicSbBonus(actor, chars.ag?.bonus) : 0;
  const thrownSbBonus = (!isMelee && sys.weaponClass === "thrown")
    ? (balearicSb ? meleeStrengthBonus({ sb: sb + balearicSb, wp, sbHalf }) : sbEff) : 0;
  // aimed читает opts.aiming — actor.system.aiming к этому моменту уже сброшен
  // в "none" диалогом (attack/dialog.mjs:217, ДО этого вызова), поэтому
  // значение приходит явным параметром, захваченным до сброса (wdbc-1rno.5).
  // Считается здесь же (раньше bonusDamageDice ниже), чтобы им же могла
  // воспользоваться Сверхточное/Legacy Мутация (wdbc-1rno.35) в flatBonus.
  const aimed = !!aiming && aiming !== "none";
  // Сверхточное/Оружие Наследия, skilled 9-9 (wdbc-1rno.35, rules/
  // legacy-weapon.mjs): +1 Dmg за каждый чётный Успех, одиночный выстрел или
  // рукопашная атака с Прицеливанием.
  const preciseLegacyBonus = preciseLegacyDamageBonus({ weapon: item, hit, deg, rofMode, isMelee, aimed });
  // Когти.Р (core.json, «Типы Рукопашного Оружия»): «получают +1 Dmg за
  // каждый нечетный Успех на попадание, кроме первого (3, 5, 7, и т.д.)» —
  // только хват «Л»/«П+Л» (Когти.Р); «П» (Когти.П, ладонь свободна) бонуса не
  // даёт. Текущий хват — opts.gripKey (тот же, что уже приходит для gripProps
  // выше) — выбор ИМЕННО этого броска; без него (вызов не из диалога) —
  // первый хват из sys.grips, тот же фолбэк, что currentMeleeGrip (hands.mjs).
  const clawsHandGrip = opts.gripKey || parseGrips(sys.grips)[0] || "";
  const clawsHandBonus = (isMelee && hit && sys.meleeCategory === "Когти"
    && (clawsHandGrip === "Л" || clawsHandGrip === "П+Л"))
    ? Math.max(0, Math.floor(((Number(deg) || 0) - 1) / 2))
    : 0;
  // Наследие Гнева/wrath, Оружие Наследия (wdbc-1rno.35, rules/legacy-weapon.mjs):
  // +2 Dmg против цели Ненависти носителя — переиспользует hatredTargetsOf/
  // anyTargetMatches (rules/hatred.mjs), defenderActor уже известен выше.
  const wrathLegacyBonus = wrathLegacyDamageBonus({ weapon: item, actor, hit, targetActor: defenderActor });
  // Наследие Крови, Оружие Наследия (wdbc-1rno.35, История 8): +1 Dmg, всегда.
  const bloodLegacyBonus = bloodLegacyDamageBonus({ weapon: item, hit });
  // Наследие Перемен, Оружие Наследия (wdbc-1rno.35, История 9): дубль на
  // броске 2d5 старта Хода — результат кубика идёт в урон вместо теста.
  const changeLegacyBonus = legacyChangeDamageBonus(actor, item, hit);
  // Наследие Предательства, Оружие Наследия (wdbc-1rno.35, История 4, стр.
  // 427): +1d5 Dmg против цели, что не видит персонажа, или Застигнута
  // Врасплох — unseen/targetSurprised уже посчитаны выше (Backstab/Quiet
  // Elimination). Натуральная 100 на попадание («оружие попадает по
  // случайному союзнику») — честно НЕ реализована отдельным решением
  // (wdbc-1rno.35, см. bd comment): переадресация уже разрешённого попадания
  // на другого актора — примитив, которого в движке нет вообще ни для одной
  // находки, не точечная правка этого файла.
  const betrayalActive = betrayalLegacyActive({ weapon: item, hit, unseen, targetSurprised });
  const betrayalRoll = betrayalActive ? await new Roll("1d5").evaluate() : null;
  const betrayalBonus = betrayalRoll?.total || 0;
  // Бесчестное/skilled 10-10, Оружие Наследия (wdbc-1rno.35, стр. 428):
  // +1d10 Dmg против цели, что не видит персонажа, или Застигнута Врасплох —
  // те же unseen/targetSurprised, что Наследие Предательства, другая Мутация
  // и другой куб. Второе +1d10 («если считают персонажа союзником») честно
  // НЕ реализовано — см. dishonorableLegacyActive.
  const dishonorableActive = dishonorableLegacyActive({ weapon: item, hit, unseen, targetSurprised });
  const dishonorableRoll = dishonorableActive ? await new Roll("1d10").evaluate() : null;
  const dishonorableBonus = dishonorableRoll?.total || 0;
  // Скорая Кончина/versatile 7-7, Оружие Наследия (wdbc-1rno.35, стр. 428):
  // +3 Dmg на первое успешное попадание этим оружием за бой.
  const earlyDeathBonus = earlyDeathLegacyDamageBonus({ weapon: item, actor, hit });
  // Адаптивное/versatile 8-8, Оружие Наследия, рукопашная ветка (wdbc-1rno.35,
  // стр. 428): +1 Dmg, когда противник имеет численный перевес в рукопашной
  // (враги атакующего в контакте с НИМ САМИМ, не с целью).
  const attackerContactCount = (isMelee && attackerToken) ? meleeContactCount(attackerToken) : null;
  const adaptiveBonus = adaptiveLegacyMeleeDamageBonus({ weapon: item, hit, attackerContactCount });
  // Отвлекающее/skilled 3-4, Оружие Наследия, стрелковая ветка (wdbc-1rno.35,
  // стр. 427-428): попадание метит цель — «все остальные» получают +10 по
  // ней (sheets/attack/mods.mjs читает флаг обратно).
  if (hit && defenderActor && distractingLegacyActive(item)) {
    await defenderActor.setFlag?.("warhammer-dbc", DISTRACTING_LEGACY_FLAG, true);
  }
  // Защитник/vigilant 8-8, Оружие Наследия, стрелковая ветка (wdbc-1rno.35,
  // стр. 428): цель получает метку — атаки ПО СТРЕЛКУ получают −30 до
  // начала её следующего Хода (predicates.mjs::legacyGuardianMarked).
  if (hit && !isMelee && defenderActor && takenMutationNames(item).has("Защитник") && item.system?.weaponClass !== "melee") {
    await defenderActor.setFlag?.("warhammer-dbc", LEGACY_GUARDIAN_FLAG, { shooterUuid: actor.uuid });
  }
  // Каратель/merciless 8-8, Оружие Наследия (wdbc-1rno.35, стр. 428): «За
  // каждое успешное попадание оружие получает накапливающийся +3 на
  // попадание по НЕМУ до конца боя. Атаки с множественными попаданиями
  // считаются как одно» — инкремент здесь, ОДИН раз за вызов
  // _executeAttackRoll, независимо от числа готовых попаданий (hits) ниже
  // по функции. Счётчик — на ЦЕЛИ, ключ id ЭТОГО оружия (несколько разных
  // Карателей по одной цели копят независимо).
  if (hit && defenderActor && takenMutationNames(item).has("Каратель")) {
    await incrementPunisherLegacyStack(defenderActor, item);
  }
  // Душесвязанное/skilled 7-7, Оружие Наследия (wdbc-1rno.35, стр. 427):
  // заряженный кнопкой листа оружия (apps/legacy-weapon.mjs::
  // activateSoulboundLegacyBonus) бонус к урону следующего попадания.
  const soulboundLegacyBonus = soulboundLegacyDamageBonus(actor, item, hit);
  // Смертельная Ловушка/vigilant 10-10, Оружие Наследия (wdbc-1rno.35, стр.
  // 427): доступность необязательной кнопки на карточке урона (боевой
  // конвейер не решает Уклонение/Парирование здесь — см. wdbc-1rno.44,
  // поэтому кнопка, а не автоприбавка, читает решение стола постфактум).
  const deadlyTrapLegacyEligible = legacyDeadlyTrapEligible({
    weapon: item, actor, hit, isOwnTurn: isActorsOwnTurn(actor)
  });
  const deadlyTrapLegacyDelta = deadlyTrapLegacyEligible ? legacyDeadlyTrapDamageDelta(actor) : 0;
  // Кхорнгор Мясник (wdbc-gao07): сколько кубиков запаса можно добавить к урону этого попадания.
  const butcherDice = (hit && isMelee) ? butcherStatus(actor).left : 0;
  // Адаптивная Отрава Наги (wdbc-s4ql0): укус при попадании и доза «(яд в клыках)» на листе.
  const fangVenomDose = (hit && isBiteAttack(item?.name))
    ? ([...(actor.items ?? [])].find(i => i.getFlag?.("warhammer-dbc", ADAPTIVE_VENOM_DOSE_FLAG))?.name ?? "")
    : "";
  // Crushing Blow / Крушащий Удар (+½WS.b рукопашному урону) и Mighty Shot /
  // Могучий Выстрел (+½BS.b стрелковому, кроме урона по площади) — Таланты
  // «Рукопашные»/«Стрелок» (rules/damage-talents.mjs, Sahara 3-8dc5/3-5fbf).
  // Прибавка стоит прямо во flatBonus: она идёт к броску урона каждого
  // попадания, как S.b, и видна в формуле карточки. Пути урона вне этой
  // функции (Захват: когти/укус, Быстрый Выхват, Орда, ответ на Парирование)
  // считают свою формулу сами и Таланты не видят.
  // Без привязки к попаданию: та же dmgFormula бросается и для шальных пуль
  // промаха по цели в рукопашной (misfireHits), а «ко всему урону» их включает.
  const crushingBlow = crushingBlowBonus(actor, { isMelee, wsBonus: chars.ws?.bonus });
  // Натиск в полёте: общий признак для Хищника Небес (ниже) и Раптора (rules/melee-talents.mjs);
  // кубы Раптора идут в bonusDice (бросаются отдельно, первому попаданию).
  const chargeFromFlight = isChargeFromFlight({
    charge: isMelee && opts.baseKey === "charge", altitude: actor.system?.movement?.altitude,
    inFlightAltitudes: IN_FLIGHT_ALTITUDES
  });
  const raptorDice = hit ? raptorBonusDice(actor, { chargeFromFlight, deg }) : 0;
  const mightyShot = mightyShotDamage(actor, { isMelee, bsBonus: chars.bs?.bonus, wp });
  // Ку де Гра (rules/rogue-talents.mjs): ×2 урона по сочленениям/глазам Оглушённой или Лежащей цели.
  const coupDeGrace = hit && coupDeGraceActive({
    actor, weapon: item, gripKey: opts.gripKey, aimValue: aimTarget?.value, targetActor: defenderActor, isMelee });
  const flatBonus = razorBonus + crushingBlow + mightyShot.bonus + plasmaMastery.dmg + eyeBonus + weaponTechBonus + (isMelee ? sbEff : 0) + thrownSbBonus + reverseThrustBonus + taintedAdd + deadlyNaturalCorBAdd + invocationAdd.dmg + (isMelee ? 0 : ammoDmgMod + ammoCondDmg) + forceBonus + bandDmg + offDmgMod + (modFx.damageMod || 0) + (qAuto.damageMod || 0) + dmgBonus + chargeBonus + dreadWailBonus.dmg + bloodFlameBonus + haymakerBonus + preciseLegacyBonus + wrathLegacyBonus + betrayalBonus + bloodLegacyBonus + changeLegacyBonus + dishonorableBonus + earlyDeathBonus + adaptiveBonus + soulboundLegacyBonus + clawsHandBonus;
  // Строки карточки: игрок должен видеть, ОТКУДА взялась прибавка, а не искать
  // лишние очки в формуле (цель проекта — видимая причина).
  // Сварщик (rules/gunsmith-talents.mjs): признак на кнопки «Применить урон» — доп.
  // Критический Эффект при непоглощённом уроне по технике считает combat/vehicle.mjs.
  const applied = appliedPhysicsShift(actor, { blastRating: wp.blastRating, bsBonus: chars.bs?.bonus });
  // Стрельба на Насыщение (rules/gunner-talents.mjs): половина непопавших выстрелов очереди — в укрытие цели.
  const saturationShots = saturationFireCoverShots(actor, { rofMode, isMelee, rof: burstRofUsed ?? _getAmmoSpent({ system: hitCountSys }, rofMode), hits: hit ? hitsCountBase : 0 });
  const welderOn = hit && welderMarksHit(actor, { wProps, aimValue: aimTarget?.value, targetIsVehicle });
  // Искры: кнопка «Искры» на каждом попадании дугового оружия (attack-card.mjs).
  const sparksOn = hit && sparksAvailable(actor, { item, isMelee });
  wp.welderMark = welderOn;
  // Часть машины, в которую целился стрелок: Сварщик кладёт доп. Критический Эффект именно в неё
  // (а не туда, куда легло конкретное попадание очереди, — третье и дальнейшие идут в Корпус).
  wp.welderPart = welderOn ? (aimTarget?.vehiclePart || "") : "";
  // Пробивной Удар (rules/gunner-talents.mjs): +2 к урону, если попадание уведёт Раны
  // цели в минус — решает damage.mjs при применении (там известны Раны цели).
  // Калечащий Удар — то же для рукопашной атаки (оба Таланта самоограничены по isMelee).
  // Разрубить (combat/cleave.mjs): дополнительная атака Таланта новых не порождает — метка едет на кнопку урона.
  wp.cleaveChild = !!opts.techniqueOpts?.cleave;
  // Один Из Нас Падёт: метка на кнопки урона — карточка урона сама засчитает «1 Усталости», если цель выведена из строя.
  wp.oneWillGoDown = owgdOn;
  // Тяжёлый Хук: метка на кнопки урона — карточка урона предложит встречный тест S+0 vs S+0 (сбить с ног).
  wp.haymaker = haymakerOn;
  // Жнец (combat/reaper-chain.mjs): удар с Базой «Натиск» — метка на кнопку урона (там решает, убила ли атака цель).
  wp.chargeBase = isMelee && opts.baseKey === "charge";
  // Окончательная Казнь (combat/final-execution.mjs): удар проведён с вооружённым Талантом — метка на кнопку урона
  // (конвейер урона метит жертву; убийство в том же Раунде дарит Страх (2) на 1 Раунд).
  wp.finalExecution = isMelee && !!opts.finalExecution;
  // Подрезать Сухожилья (combat/hamstring.mjs): Избирательное попадание рукопашной в Ногу не Приёмом Быстрой/Молниеносной — метка на кнопку урона.
  wp.hamstring = hamstringArmed(actor, { isMelee, hit, aimValue: aimTarget?.value,
    technique: opts.isSwift ? "swift" : opts.isLightning ? "lightning" : opts.techniqueOpts?.technique });
  wp.negWoundsBonus = hit ? crackShotBonus(actor, { isMelee }) + cripplingStrikeBonus(actor, { isMelee }) : 0;
  // Штыковая Атака (rules/run-and-gun.mjs): попадание Приёмом даёт свободный выстрел в упор — метка + кнопки на карточке.
  const bayonetShotOn = hit && isMelee && meleeTech === "bayonetCharge" && hasBayonetCharge(actor);
  if (bayonetShotOn) await actor.setFlag?.("warhammer-dbc", BAYONET_SHOT_PENDING_FLAG, true);
  const damageTalentNotes = [
    (hit && shockerOn) ? "⚡ Шокер: Избирательное попадание Гальванического оружия в голову — Шокирующее (цель: T+0 или Оглушение)." : "",
    (hit && igniter) ? IGNITER_NOTES[igniter] : "",
    (hit && wallopOn) ? `💥 Трепка: Оглушающее (${wallopRating}) — только на ПЕРВОЕ попадание (после Избеганий); применяйте эффект один раз.` : "",
    welderOn ? "🔥 Сварщик: если по технике пройдёт непоглощённый урон — в ту же часть машины ещё Критический Эффект 1d5+1 (бросок при применении урона)." : "",
    batpackOn ? `🔋 Выпуск Батареи: длинная очередь RoF 10, +1d10 Dmg и Storm (2) (уже учтены), расход зарядов ${ammoSpent}. Оружие сломано — починка занимает смену работы.` : "",
    controlledBurstSaved ? `🔫 Контролируемая Очередь: расход патронов меньше на ${controlledBurstSaved}.` : "",
    saturationShots ? `🧱 Стрельба на Насыщение: промахнувшие выстрелы очереди ушли в укрытие цели — ${saturationShots} шт. (половина непопавших, окр.▲). AP укрытия −${saturationShots} (1 за выстрел, если урон выше AP укрытия) — снимите вручную, система износ укрытия здесь не ведёт.` : "",
    cooking ? (cooking.success
      ? `🍳 Выдержка Гранаты: Logic(I)+0 удалась (${cooking.deg} Усп.) — Уклонение от этой гранаты ${cookingPenalty} (уже в кнопках).`
      : "🍳 Выдержка Гранаты: Logic(I)+0 провалена — граната получает Очень Ненадёжное (метательное оружие в системе не клинит, отметка справочная); её всё равно метнули.") : "",
    volleyOn ? `🗡️ Залповый Бросок: метнуто до ${rofOverride} (длинная очередь +0 вместо −10, без бонуса Прицеливания).` : "",
    (hit && sureShotOn) ? `🎯 Верный Выстрел: потрачено Очко Бесчестия — Уклонение цели от этого выстрела ${sureShotPenalty} (−10 за каждый Успех на попадание, уже в кнопках).` : "",
    (hit && cageFiring) ? "🕸️ Огневая Клеть: эффективный RoF ещё −3; цель тратит вдвое больше Успехов на Уклонение (кнопки учитывают)." : "",
    (hit && doubleTapOn) ? `🎯 Двойной Выстрел: 1-е попадание — Торс, 2-е — Голова${hitsCountBase > hitsCount ? `, остальные (${hitsCountBase - hitsCount}) — промахи` : ""}. Порядок задан до Избеганий: если Уклонение снимет попадания, «торс, голова» остаются за оставшимися.` : "",
    onThisMarkOn ? "📡 По Этим Координатам: цель засечена не глазами — штрафов за невидимость нет; выстрел не Избирательный и без бонуса Прицеливания." : "",
    (hit && applied) ? `🧮 Прикладная Физика: после Избеганий можно сместить шаблон взрыва на до ${applied} м (½BS.b, окр.▲); цели, уже уклонившиеся от взрыва, могут уклоняться снова, если хватает SPD.` : "",
    (hit && weaponTechBonus) ? `🔧 Тех-Оружейник: +${weaponTechBonus} к Dmg и Pen (I.b, уже учтено); оружие до новой настройки усиленного выстрела не даст.` : "",
    weaponTech.refused ? "🔧 Тех-Оружейник: оружие не настроено заново — бонуса нет." : "",
    lens.use ? `🔍 Настройка Линз: заряд потрачен — Felling (${lens.felling}) и Precise на эту атаку; осталось зарядов: ${lens.charges}.` : "",
    litanyRel ? "🧼 Литания Чистки: оружие чищено за последние сутки — Надёжность +1." : "",
    (hit && tankHunter.penBonus) ? `🎯 Охотник на Танки: +${tankHunter.penBonus} к Pen (2×I.b, уже учтено) — слабые места этой модели техники опознаны.` : "",
    (!isMelee && wp.spray && hasFlamerTalent(actor, "friendlyFire")) ? "🔥 Дружественный Огонь: тест отмены Распыления у всех, кто не враг стрелка по токенам, получает +30 (кнопка теста считает сама)." : "",
    torrentOn ? `🌊 Поток: расход боеприпасов удвоен (${ammoSpent}); вместо конуса — шаблон Blast(${torrentBlastRadius(Number(sys.range) || 0)} м) в пределах ${torrentMaxDistance(Number(sys.range) || 0)} м и прямой видимости, попадание по правилам Spray (тест на отмену у каждой цели).` : "",
    (hit && pyromaniacActive(actor, { spray: wp.spray, flame: wp.flame })) ? "🔥 Пироман: цели перебрасывают успешный тест против загорания, а в укрытии — ещё −20 (кнопка «Горение» считает сама). Укрытия под шаблоном (кнопка «Разместить шаблон») загорятся на 1d5+1 Раундов, стоящий в них в конце Хода — тоже." : "",
    (hit && eyeBonus) ? `👁️ Око Мщения: +${eyeBonus} к Dmg и Pen (Inf.b, уже учтено) до конца Хода.` : "",
    (irradiate && hit) ? (irradiate === "felling" ? `☢️ Облучить: рейтинг Felling удвоен (${wp.fellingRating}).` : "☢️ Облучить: пробитие брони для Rad считается без удвоения AP цели.") : "",
    wp.negWoundsBonus ? `🎯 ${isMelee ? "Калечащий Удар" : "Пробивной Удар"}: если попадание уведёт Раны цели в минус — +${wp.negWoundsBonus} к урону (прибавится при применении).` : "",
    sparksOn ? "⚡ Искры: у каждого попадания есть кнопка — 2d10 вместо наименьшего кубика урона (дубль — двух). Один раз за атаку." : "",
    (hit && crushingBlow) ? `🗡️ Крушащий Удар: +${crushingBlow} к урону (½WS.b, уже в формуле).` : "",
    raptorDice ? `🦅 Раптор: Натиск в полёте, ${deg} Успехов — +${raptorDice}d10 к урону первого попадания (уже в сумме).` : "",
    killingStrikeOn ? "☠️ Смертельный Удар: потрачено Очко Бесчестия — Избегания (Уклонение и Парирование) цели от этой атаки невозможны, они считаются проваленными. Раз в Ход." : "",
    (hit && hammerBlow.pen) ? `🔨 Удар Молота: Полная Атака — +${hammerBlow.pen} к Pen (½WS.b, уже учтено) и свойство Оглушающее (${hammerBlow.concussive}).` : "",
    unstoppableFelling ? `🐎 Неостановимый Натиск: верхом на Натиске — оружие получает Felling (${unstoppableFelling}) (½WS.b).` : "",
    (hit && fleshRenderDrop) ? "🪚 Терзатель Плоти: Рвущее даёт +2 куба урона вместо +1, два наименьших отброшены (уже в формуле)." : "",
    (hit && mightyShot.bonus) ? `🎯 Могучий Выстрел: +${mightyShot.bonus} к урону (½BS.b, уже в формуле).` : "",
    (hit && mightyShot.centerBonus)
      ? `🎯 Могучий Выстрел: цель в центре шаблона Взрыва получает +${mightyShot.centerBonus} к урону — прибавьте вручную; остальным в радиусе бонуса нет.` : "",
    (hit && plasmaMastery.dmg)
      ? "⚡ Мастерство Плазмы: в Максимальном режиме +2 Dmg и +2 Pen (уже учтено). +2 к радиусу Взрыва — на выбор стрелка, вручную." : "",
    plasmaExpertiseRel ? "♨️ Эксперт Плазмы: Надёжность +1 — Перегрев не понижает её." : "",
    (hit && razorBonus) ? `🔪 На Лезвии Бритвы: +${razorBonus} к урону (разница Инициатив, уже в формуле; к Пробитию не идёт).` : "",
    coupDeGrace ? "🗡️ Ку де Гра: цель Оглушена/Лежит, удар в сочленение или глаз — урон ×2 (как по Беспомощной)." : "",
    haymakerOn ? `🥊 Тяжёлый Хук: отказ от второй руки в этот Ход — +${haymakerBonus} Dmg (½T.b, уже в сумме). Если цель получит попадание — встречный тест S+0 vs S+0 (кнопка в карточке урона), иначе Ничком.` : "",
    (goadingOn && hit) ? "🥊 Направляющий Удар: штраф −20 уже в пороге; Успех — кнопка свободного Давления ниже (даже если цель Избежит удара)." : "",
    owgdOn ? `💢 Один Из Нас Падёт: Полная Атака по Ненавистной цели — Dmg ×2 до Поглощения (уже в сумме).${owgdHand ? ` Носитель получает ${owgdHand.roll.total} непоглощаемого R Dmg в руку (Раны ${owgdHand.loss.currentWounds} → ${owgdHand.loss.newWounds}).` : " Урон в руку за эту атаку уже списан."} Усталость — по итогу удара: кнопка «Подвести итог» на карточке (или карточка урона, если цель выведена из строя).` : "",
    sabotageOn ? `🔧 Саботаж: удар по оружию цели «${sabotageWeapon.name}» — урона существу нет.` : ""
  ].filter(Boolean).join("<br>");
  if (earlyDeathBonus) await markEarlyDeathLegacyUsed(actor, item, hit);
  if (soulboundLegacyBonus) await consumeSoulboundLegacyBonus(actor, item, hit);
  let dmgFormula = damageFormulaFor({
    damage: effDamage, flatBonus, chars,
    corruptionBonus: actor.system.corruptionBonus ?? 0, wp, isMelee
  });
  // Sundering/Разделение (Тзинч, wdbc-1rno): «урон ВСЕХ атак копий» — не
  // способность носителя, а клеймо самой копии (module/combat/sundering.mjs
  // ставит SUNDERING_COPY_FLAG прямо на актора-копию при спавне, это не
  // grantFlag правило — не hasRuleFlag). Покрывает основной боевой конвейер
  // (обычная атака оружием); честно НЕ покрыты более редкие пути урона того
  // же актора — psychic.mjs/tech.mjs/counter-attack.mjs/horde-sheet.mjs
  // (тоже зовут applyDamageDiceMods, но отдельными формулами вне attack.mjs).
  if (actor.getFlag?.("warhammer-dbc", SUNDERING_COPY_FLAG)) dmgFormula = sunderingDamageFormula(dmgFormula);

  // Доп. кубы урона: Меткое (одиночный, по СУ, ТОЛЬКО с Прицеливанием — книга
  // «При одиночных выстрелах С Прицеливанием»), Рассеивание (кор. дист.),
  // Максимальный режим (+1d10). Эти кубы НЕ вызывают Экстремальный урон.
  // Тирантикос (Sahara 10-2d10-2): окно атаки решило всё, что знало до броска
  // второй руки (rules/dual-wield-talents.mjs::tyranthikosSecondAttackDice),
  // здесь остаётся «попала и вторая». Кубы — к первому попаданию, как в книге.
  // Первую руку могли перебросить уже ПОСЛЕ броска второй (за Очко Судьбы, +10, Огневую Точку): карточки пары
  // связаны dualPairId, и «попала ли первая» берётся по её последней карточке в чате, а не по решению окна
  // (rules/dual-wield-talents.mjs::tyranthikosDiceNow); решение окна — только запасное, если чат первой руки не найден.
  const tyranthikosEligible = hit && Number(opts.tyranthikosEligible) > 0 && !!opts.dualPairId
    ? Number(opts.tyranthikosEligible) : 0;
  const tyranthikosDice = !hit ? 0 : tyranthikosEligible
    ? tyranthikosDiceNow({
        eligible: tyranthikosEligible, fallback: opts.tyranthikosDice,
        firstHit: firstHandHitNow(game.messages?.contents ?? game.messages, opts.dualPairId) })
    : Math.max(0, Number(opts.tyranthikosDice) || 0);
  // Bring It Down!/Валите Это! (rules/leadership-talents.mjs): окно атаки
  // решило, что цель — та самая, назначенная Короткой Командой
  // (sheets/attack/dialog.mjs), сюда приезжает уже готовое число кубов.
  const bringItDownDice = hit ? Math.max(0, Number(opts.bringItDownDice) || 0) : 0;
  const bonusDice = (focusFireBonusOn && hit ? 2 : 0) + tyranthikosDice + bringItDownDice + raptorDice + (batpackOn && hit ? BATPACK_BONUS_DICE : 0) + bonusDamageDice({
    wp, rofMode, hit, deg, shortRange, maximal: maximalOn, band,
    ammoDice: ammoSys?.damageDiceMod,
    aimed,
    confinedSpace: confinedSpaceOn, damageType: effDmgType,
    meleeTypeBonusDie: meleeTypeBonusOn
  });

  const damageRolls = [];
  // Хищник Небес (Раптор, rules/die-swap.mjs): Натиск, пока персонаж в воздухе.
  const skyPredatorOn = chargeFromFlight && hasRuleFlag(actor, SKY_PREDATOR);
  const allRolls    = [roll];
  if (owgdHand) allRolls.push(owgdHand.roll);
  if (betrayalRoll) allRolls.push(betrayalRoll);
  if (dishonorableRoll) allRolls.push(dishonorableRoll);

  // Клин Распыления (стр. 168): решается ПЕРВЫМ кубиком урона, а не броском
  // атаки — { face, at } первого попадания, либо null, если не заклинило.
  let sprayJam = null;

  // Взрывное «под цель» (Избирательная, −20, attack-dialog.mjs): промах не
  // пропадает бесследно — взрыв смещается по розе смещения (module/combat/
  // scatter.mjs), и может всё ещё задеть исходную цель или тех, кто рядом.
  // Без этого прицела промах Взрывного — обычный промах, как и у любого
  // другого оружия (не додумываем точку, откуда мог бы лететь снаряд).
  let blastScatter = null;
  if (!hit && aimTarget?.value === "underfoot" && wp.blastRating > 0) {
    const sc = await rollScatter();
    allRolls.push(sc.distRoll, sc.dirRoll);
    blastScatter = { distance: sc.distance, dir: sc.dir, radius: wp.blastRating };
    // Гренадер (rules/throwing-talents.mjs): промах гранаты — уменьшить смещение на BS.b / перебросить направление.
    const grenadierReduce = grenadierScatterReduce(actor, { sys, isMelee, bsBonus: chars.bs?.bonus });
    if (grenadierReduce) blastScatter.grenadier = { reduce: grenadierReduce };
  }

  // Саботаж бьёт по оружию цели, а не по телу: урона существу не бросается (sabotageOn).
  if (hit && hitsCount > 0 && (effDamage || isMelee) && !sabotageOn) {
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
      // Замена кубика на Успехи (стр. 34, wdbc-x1nz.2.49): «атакующий может
      // выбрать заменить результат броска ОДНОГО кубика в броске на урон... на
      // количество Успехов в тесте на атаку» — первый кубик формулы урона,
      // тот же приём извлечения, что и у Клина Распыления ниже. Сама подмена —
      // кнопка на карточке (attack-card.mjs), сюда попадает только число для
      // неё; выбор «на какой из нескольких попаданий тратить» и «только один
      // из целей площадной атаки» — решение игрока/ГМа за столом, не гейт кода.
      const baseDieResult = (dmgRoll.terms ?? [])
        .find(t => t.faces && Array.isArray(t.results) && t.results.length)?.results?.[0]?.result ?? null;
      // Кубики на замену Успехами — только ОСТАВЛЕННЫЕ (rules/die-swap.mjs):
      // обычно один, у Хищника Небес на Натиске с полёта — до двух.
      const swapDice = swapDiceFor(activeDieResults(dmgRoll), { skyPredator: skyPredatorOn });
      // Клин Распыления (стр. 168): 9 у обычного, 8-9 у Ненадёжного и хуже,
      // никогда у Надёжного и лучше — по ПЕРВОМУ кубику на урон (первому
      // брошенному, а не оставленному Рвущим), и только у первого попадания.
      if (i === 0 && !isMelee && wp.spray && sprayJamFace(wp) !== null) {
        if (sprayJams(baseDieResult, wp)) sprayJam = { face: baseDieResult, at: sprayJamFace(wp) };
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
      // Выгорание (Deflagrate): на 7–10 куба урона — доп. 1d10+X энерг. урона.
      // Керамит (wdbc-nquc): иммунитет к свойству Deflagrate гасит именно
      // этот доп. кубик, не базовый урон попадания.
      let deflagrateNote = 0;
      if (wp.deflagrate && deflagrateHit && !deflagrateImmune) {
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
      // Ку де Гра (rules/rogue-talents.mjs::coupDeGraceActive): «как если бы цель была Беспомощной» — тот же ×2.
      // Один Из Нас Падёт: «удвоить ее Dmg (до Поглощения)» — то же ×2 до Поглощения, не складывается с Беспомощной.
      if (opts.doubleDamage || coupDeGrace || owgdOn) total *= 2;
      // У техники Экстремальный урон переводится в её Критический Эффект через
      // отрицательную Структуру (при применении урона), а не по таблице существ.
      const { hasExtreme, extremeLevel, critEffect, exRoll } = await rollExtremeDamage(dmgRoll, {
        wp, damageType: effDmgType, hitLocation: locForHit(i), targetIsVehicle, attacker: actor, weapon: item
      });
      if (exRoll) allRolls.push(exRoll);
      // Кромсающее, второе предложение (wdbc-1rno.35, стр. 427): карточка
      // должна называть РЕАЛЬНО брошенный куб (1d10−2), не «d5» по умолчанию —
      // иначе игрок видит подпись «d5: 7», хотя катался d10.
      damageRolls.push({ total, extremeLevel, hasExtreme, critEffect, bonusNote, deflagrateNote, msPenalty,
        baseDieResult, swapDice, skyPredator: skyPredatorOn, successes: deg, cleavingRoll: !!wp.legacyCleavingRollActive,
        sparksDice: sparksOn ? activeDieResults(dmgRoll) : [],
        opportunistFloor: !!wp.legacyOpportunistFloor });
    }
  }

  // Место каждого попадания считается один раз: карточка печатает его и в
  // строке урона, и в кнопке применения урона.
  const hits = damageRolls.map((d, i) => ({ ...d, loc: locForHit(i) }));

  // I(Cr) по голове (Виды Урона, wdbc-x1nz.2.80): «получает свойство
  // Concussive (–1), попадая в голову» — или +1 к рейтингу, если оно уже было
  // (тот же приём, что Молот по лежащему выше). Место известно только теперь,
  // поэтому свойства карточки пересобираются здесь; на урон Concussive не влияет.
  const crushingHead = (ammoDmgSubtype || effDmgSubtype) === "crushing" && hits.some(h => isHeadHit(h.loc));
  const cardProps = crushingHead ? (() => {
    const entries = _mergedEntries.map(e => ({ ...e }));
    const conc = entries.find(e => e.key === "concussive");
    if (conc) conc.rating = (Number(conc.rating) || 0) + 1;
    else entries.push({ key: "concussive", rating: -1 });
    return resolveWeaponPropsList(entries);
  })() : wProps;

  // Наследие Предательства, Оружие Наследия (wdbc-1rno.35, История 4, стр.
  // 427): нат. 100 на попадание — «оружие попадает по случайному союзнику»
  // ВМЕСТО исходной цели. rv (roll.total) — тот же сырой d100, что дал сам
  // hit. Союзника и геометрию (контакт в рукопашной / 3м от цели в
  // стрелковой — разные книжные условия для каждой ветки Истории) считает
  // combat/legacy-weapon-betrayal.mjs. Нет подходящего союзника рядом —
  // книга это не разбирает, попадание остаётся по исходной цели как обычно.
  const betrayalHits = [];
  if (hit && rv === 100 && legacyHistoryIs(item, "Наследие Предательства")) {
    const allyToken = betrayalRandomAllyToken({ isMelee, attackerToken, targetToken });
    const allyActor = allyToken?.actor ?? allyToken?.document?.actor ?? null;
    if (allyActor) {
      for (const d of hits) betrayalHits.push({ total: d.total, loc: d.loc, targetName: allyActor.name, targetUuid: allyActor.uuid });
      hits.length = 0;
    }
  }

  // Борьба как укрытие (стр. 12, wdbc-x1nz.2.77): не-Избирательная атака по
  // сцепившемуся с той стороны, где его прикрывает партнёр, «попадает вместо
  // этого по другому» (а меньшего за большим и Избирательной не выцелить).
  // Та же форма перенаправления, что у Наследия Предательства выше.
  const grappleCoverHits = [];
  if (hits.length) {
    const coverPartner = grappleCoverPartner({ attackerToken, targetToken, targetActor: defenderActor, aimed: !!aimTarget?.value });
    if (coverPartner) {
      for (const d of hits) grappleCoverHits.push({ total: d.total, loc: d.loc, targetName: coverPartner.name, targetUuid: coverPartner.uuid });
      hits.length = 0;
    }
  }

  // Спиной к Спине/Back to Back (combat/fanatic-redirect.mjs): носители
  // Fanatic в базовом контакте с целью — только показ кандидатов и остатка
  // «раз в Раунд без Реакции» в карточке, перенос урона остаётся выбором
  // стола через обычную кнопку «Применить урон» (выделить токен Фанатика).
  const fanaticIntercepts = hits.length
    ? fanaticInterceptCandidates(targetToken, game.actors ?? [], { excludeUuids: [defenderActor?.uuid] })
        .map(a => ({ uuid: a.uuid, name: a.name, freeUse: backToBackFreeUseAvailable(a) }))
    : [];

  // Нечестивая Преданность/Unholy Devotion (combat/unholy-devotion.mjs):
  // Миньоны Хозяина-цели в пределах их Полудвижения — карточка даёт кнопку
  // «Принять удар» (A+0, +30 при ≤2 м, раз в Раунд на Миньона).
  const devotionIntercepts = hits.length
    ? unholyDevotionCandidates(targetToken, defenderActor, game.actors ?? [])
    : [];

  // Промах по цели, Связанной в Рукопашной (стр. 30, wdbc-x1nz.2.64):
  // одиночный выстрел, промахнувший на 1-2 Провала, попадает в случайного
  // персонажа в контакте с целью (враг или союзник); Короткая/Длинная
  // Очередь — половина ПОТЕНЦИАЛЬНЫХ выстрелов (RoF), что не стали
  // попаданиями (окр.▼), туда же. Получателя выбирает бросок d100 (не ГМ) —
  // тот же принцип, что у остальных «случайных целей» книги (Стрельба на
  // Подавление и т.п.), только здесь без ручного распределения за столом.
  const misfireHits = [];
  if (!isMelee && !wp.spray && rofMode !== "suppression") {
    const primaryToken = [...(game.user?.targets ?? [])][0] ?? null;
    const targetTokenDoc = primaryToken?.document ?? primaryToken;
    const targetLockedForMisfire = targetTokenDoc ? lockingContactTokenDocs(targetTokenDoc).length > 0 : false;
    if (targetLockedForMisfire) {
      // Выбор Целей (rules/target-selection.mjs): у носителя Таланта союзники стрелка (и он сам) в рикошет не попадают.
      const shooterTokenDoc = attackerToken?.document ?? attackerToken ?? null;
      const contactPool = misfireCandidates(allContactTokenDocs(targetTokenDoc), {
        targetSelection: hasTargetSelection(actor),
        shooterTokenId: shooterTokenDoc?.id ?? "",
        shooterDisposition: shooterTokenDoc?.disposition ?? actor?.prototypeToken?.disposition ?? 0
      }).map(d => d.actor).filter(Boolean);
      let scatterCount = 0;
      if (rofMode === "single") {
        scatterCount = (!hit && deg <= 2) ? 1 : 0;
      } else if (rofMode === "semi" || rofMode === "full") {
        const potentialShots = rofMode === "semi" ? (Number(hitCountSys.rof_semi) || 0) : (Number(hitCountSys.rof_full) || 0);
        scatterCount = Math.floor(Math.max(0, potentialShots - hitsCount) / 2);
      }
      for (let i = 0; i < scatterCount && contactPool.length > 0; i++) {
        const pickRoll = await new Roll("1d100").evaluate();
        allRolls.push(pickRoll);
        const idx = Math.min(contactPool.length - 1, Math.floor((pickRoll.total - 1) * contactPool.length / 100));
        const misfireActor = contactPool[idx];
        const locRoll = await new Roll("1d100").evaluate();
        allRolls.push(locRoll);
        const { label: loc } = hitLocation({ rv: locRoll.total, hit: true });
        const dmgRoll = await new Roll(dmgFormula).evaluate();
        allRolls.push(dmgRoll);
        misfireHits.push({ total: dmgRoll.total, loc, targetName: misfireActor.name, targetUuid: misfireActor.uuid });
      }
    }
  }

  // Вторичные цели Короткой/Длинной Очереди (стр. 35, wdbc-x1nz.2.55): «может
  // распределить попадания по другим целям не более чем в 2м от основной
  // (с разрешения ГМа — цели дальше, если угловое расстояние небольшое)... но
  // ни одна из вторичных целей не может получить больше попаданий, чем
  // основная. Вторичные цели всегда получают попадания в торс.» Дистанция —
  // настоящий замер (tactical-map.mjs::measureTokens), не на глаз. САМО
  // распределение (какому токену сколько из уже готовых попаданий) и лимит
  // «не больше основной» остаются за столом — карточка только подсказывает
  // список и дистанции, тем же честным приёмом, что у Стрельбы на Подавление
  // чуть ниже (ГМ применяет готовые кнопки «Применить урон N» на выбранный
  // токен — эта же machinery, без второй копии).
  const burstSecondaryTargets = (hit && !isMelee && hitsCount > 1 && (rofMode === "semi" || rofMode === "full"))
    ? (() => {
        const primaryToken = [...(game.user?.targets ?? [])][0] ?? null;
        if (!primaryToken) return [];
        return (canvas?.tokens?.placeables ?? [])
          .filter(t => t !== primaryToken && (t.actor ?? t.document?.actor))
          .map(t => ({ name: (t.actor ?? t.document?.actor)?.name ?? "?", measured: measureTokens(primaryToken, t) }))
          .filter(e => e.measured && e.measured.edgeM <= 2)
          .map(e => ({ name: e.name, distanceM: e.measured.edgeM }));
      })()
    : [];

  // Стр. 35: ГМ распределяет одно попадание в торс за каждый нечётный Успех
  // (1, 3, 5…) до максимума в выбранный RoF, по СЛУЧАЙНЫМ целям в секторе —
  // поэтому урон не бросается автоматически, карточка лишь называет их число.
  // Штраф теста Подавления зависит от RoF (полуавтомат −10 / автомат −20,
  // module/combat/suppression.mjs), не от класса оружия. Импульсное (стр. 73
  // Книги Аэльдари) добавляет ещё −10 цели.
  const supCap      = sys.rof_full || sys.rof_semi || 1;
  const suppression = (rofMode === "suppression" && hit)
    ? { testMod: suppressionTestMod(sys) - (wp.impulse ? 10 : 0),
        hits: Math.min(Math.ceil(deg / 2), supCap), cap: supCap }
    : null;

  // Огонь из Всех Орудий (стр. 62, wdbc-pb60): обе атаки парного выстрела —
  // очереди по одной цели → цель проходит тест Подавления (модификатор уже
  // посчитан снаружи, module/rules/dual-wield-talents.mjs::allGunsBlazingMod
  // — он один знает режимы ОБЕИХ рук, эта функция видит только свою). Не
  // путать с suppression выше: та рождается из режима «Стрельба на
  // Подавление» ЭТОГО выстрела, а этот — из пары обычных очередей.
  const allGunsBlazing = (opts.allGunsBlazingMod != null)
    ? { testMod: opts.allGunsBlazingMod } : null;

  // ── «Прячась в Орде» ─────────────────────────────────────────────────────
  // Цель стоит внутри союзной Орды (токены наложены), и не-Избирательный
  // выстрел половиной попаданий уходит в толпу: одиночный — по чётности броска,
  // очередь — каждым нечётным попаданием.
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

  // Остаток пула неизрасходованных Успехов Уклонения/Парирования с ДРУГИХ
  // атак этого же противника в этом Ходу (стр. 12, «Избегание множественных
  // попаданий и атак» — вторая половина правила, module/combat/evasion-pool.mjs).
  // Считается здесь: этот модуль один касается документов Foundry (актор цели),
  // attack-card.mjs только рисует уже готовое число.
  const evasionPoolEntry = hit && defenderActor
    ? getEvasionPool(defenderActor, actor.uuid || "") : null;
  // canRecoil (wdbc-16ss, Voltagheist Blast): банк можно пустить в Отскок
  // вместо негации, но только от СТРЕЛКОВОЙ атаки (тот же !isMelee-гейт, что
  // у обычной кнопки Отскока, см. recoil.mjs) и пока в этом Раунде ещё есть
  // остаток дистанции — иначе диалог открывать не на что.
  const evasionPool = evasionPoolEntry
    ? { successes: evasionPoolEntry.successes,
        ...poolAffordableHits(evasionPoolEntry, techOpts.targetDodgeMod ?? 0, hitsCount, defenderActor, wp.evadeCost ?? 1),
        canRecoil: !isMelee && evasionPoolEntry.successes >= 2 && recoilPoolRemaining(defenderActor) > 0,
        // Захват (стр. 12, wdbc-x1nz.2.66.13): «Парируется со штрафом −30
        // (или тратит +3 Успеха от предыдущего Парирования)» — по правилу
        // пула −30 = +3 к цене снятия: 2+3=5 Успехов без броска (wdbc-t3c3t.6).
        canWaiveGrappleParry: isMelee && techOpts.technique === "grapple"
          && !grappleUnparryable(actor, techOpts.technique)
          && poolAffordableHits(evasionPoolEntry, techOpts.targetParryMod ?? 0, 1, defenderActor).hits > 0 }
    : null;

  // Ethereal Swarm / Эфирная Стая (wdbc-1rno, rules/ethereal-swarm.mjs) —
  // тот же принцип, что evasionPool выше: считается здесь (документы Foundry
  // цели уже под рукой), attack-card.mjs только рисует готовое число.
  const etherealSwarm = hit && defenderActor
    ? activeSwarm(defenderActor, game.time?.worldTime) : null;

  // Незримое (стр. 32, wdbc-1rno.2): unseen/hiddenThreatFlag уже посчитаны
  // выше (до формулы урона — нужны Backstab'у, rules/unseen-talents.mjs).
  // Гейт Уклонения/Парирования и кнопки засечения в карточке рендерятся
  // только при hit — тот же гейт, что у Уклонения/Парирования ниже
  // (defenderActor неизвестен раньше).
  const unseenRolledDetected = unseen && defenderActor
    ? isUnseenDetected(defenderActor, { isPsychic: item?.type === "psychicPower", isRadiation: !!wp.radiationSourced })
    : false;
  // Blind Fighting / Бой Вслепую (wdbc-1rno.2, rules/unseen-talents.mjs):
  // «Может Избегать от Незримых атак в рукопашной со штрафом −20» — НЕ
  // тест засечения, альтернативный канал доступности, только в рукопашной.
  // Пока эта бонус-скидка активна, дальше карточка ведёт себя так, как
  // если бы атака уже была засечена (unseenDetected=true) — только с
  // прибавленным штрафом в самом dodgeMod/parryMod ниже.
  const blindFightingBypass = unseen && !unseenRolledDetected && isMelee
    && defenderActor && hasBlindFighting(defenderActor);
  const unseenDetected = unseenRolledDetected || blindFightingBypass;
  // Sixth Sense/Music of Battle (wdbc-1rno.2): кнопки «потратить Очко
  // Бесчестия» в карточке — доступны при locked-состоянии (unseen ещё не
  // detected НИКАК, включая Bлind Fighting выше) и наличии хотя бы 1 Очка.
  const unseenLockedForBypass = unseen && !unseenDetected;
  const sixthSenseBypassAvailable = unseenLockedForBypass && defenderActor
    && hasSixthSense(defenderActor) && actorInfamyValue(defenderActor) >= 1;
  const musicOfBattleBypassAvailable = unseenLockedForBypass && defenderActor
    && hasMusicOfBattle(defenderActor) && actorInfamyValue(defenderActor) >= 1;

  // Стр. 12: успешный Приём «Захват» связывает обоих Борьбой (module/combat/
  // grapple.mjs) — состояние conditions.grappling, как у Оглушения/Беспомощного.
  // Не блокирует построение карточки: чат-сообщение о связывании уходит своим,
  // отдельным сообщением следом.
  if (hit && techOpts.technique === "grapple") applyGrappleOnHit(actor, targetToken, hit, techOpts);

  // Прикрывающая Стойка (стр. 15, wdbc-x1nz.2.66.7): «Когда противник в
  // контакте атакует союзника персонажа, персонаж может совершить по нему
  // свободную атаку» — предлагается независимо от исхода (попадание/промах),
  // тот же принцип «момент триггера на усмотрение стола», что у обычной
  // Свободной Атаки выше по файлу; очерёдность («первым действует тот, у
  // кого выше Ag») не автоматизирована — решает стол, как и там.
  if (isMelee && targetToken && attackerToken) {
    const targetTokenDoc = targetToken.document ?? targetToken;
    const attackerTokenDoc = attackerToken.document ?? attackerToken;
    for (const defenderDoc of coveringDefendersOf(targetTokenDoc)) {
      offerFreeAttack(defenderDoc, attackerTokenDoc,
        `${esc(actor.name)} атакует ${esc(defenderActor?.name ?? "союзника")} рядом с ${esc(defenderDoc.name)}`);
    }
  }

  // Встречная атака (wdbc-2wy7, Шипы/Цепные Бандольеры, module/combat/
  // counter-attack.mjs, kind:"counterAttack" Конструктора): defenderActor
  // (цель ЭТОЙ атаки) бьёт actor (атакующего) в ответ, если он промахнулся
  // рукопашной по ней ИЛИ провёл против неё безоружную атаку/приём «Захват» —
  // независимо от исхода Захвата (контакт с шипами уже случился), поэтому
  // считается отдельно от applyGrappleOnHit выше (тот только про состояние
  // Борьбы после УСПЕШНОГО Захвата).
  let counterAttackBlock = "";
  if (defenderActor) {
    const ccTriggers = counterAttackTriggers({
      isMelee, hit, technique: techOpts.technique || "", meleeCategory: sys.meleeCategory || "",
      unarmed: isIntegralAttack(item)
    });
    if (ccTriggers.onMiss || ccTriggers.onUnarmedOrGrapple) {
      const cc = await counterAttackSectionHtml(defenderActor, actor, ccTriggers);
      counterAttackBlock = cc.html;
      allRolls.push(...cc.rolls);
    }
  }

  // Перезарядка: оружие с Recharge и Максимальный режим стреляют раз в 2 хода
  // (wdbc-ai0o) — rechargeTurnsRemaining:1 читает combat/recharge.mjs на
  // старте следующего Хода носителя: тот Ход остаётся заблокирован, снимается
  // только на Ходе ПОСЛЕ него.
  // Бонус цели на Уклонение от выстрела в рукопашной (стр. 40): Винтовка +30,
  // Карабин +10. Пистолет (стр. 40, wdbc-x1nz.2.57) стреляет в рукопашную
  // «без каких-либо штрафов» вовсе — ни бонуса цели, ни штрафа стрелку (тот
  // гасится рядом, в mods.mjs::situationalMods). Талант «Винтовочная Гарда»
  // (стр. 62, wdbc-pb60) гасит бонус Винтовки/Карабина целиком, если в другой
  // руке рукопашное оружие с Балансом не ниже −1 — считается один раз здесь,
  // потому что ниже тот же бонус нужен и обычной кнопке Уклонения, и её
  // recoil-варианту.
  const meleeShotDodgeBonus = techOpts.targetDodgeMod
    ?? ((opts.meleeShot && sys.weaponClass !== "pistol" && !gunGuardCancelsDodgeBonus(actor, item)) ? (wp.carbine ? 10 : 30) : 0);

  // Скрытая атака (стр. 12, wdbc-x1nz.2.29): «Избегание невозможно от атаки,
  // о которой цель не знает» — атакующий сам объявляет это галочкой в окне
  // (attack/mods.mjs, #atk-mod-hidden), книга не даёт теста на автоопределение
  // (то же честное решение, что уже у «Застал Врасплох», combat/devourer-of-
  // time.mjs). ≤ -900 — тот же порог, что attack-card.mjs::defenseSection
  // читает как cannotDodge/cannotParry у Атаки Всем Телом и подобных.
  const hiddenAttack = !!opts.hiddenAttack;

  // Финт (стр. 31, wdbc-x1nz.2.65): «цель не может совершать Избегание от
  // его атак до конца его Хода» — тот же порог −999, что «Скрытая атака»
  // выше, но проверка не одноразовая галочка, а персистентный флаг ЦЕЛИ
  // (module/combat/feint-press.mjs), снимается в конце Хода АТАКУЮЩЕГО,
  // а не этим выстрелом.
  const feintBlocked = !hiddenAttack && feintBlocksEvasion(defenderActor, actor);

  // Затрещина (Талант Пугилиста, стр. 62, combat/whack.mjs): безоружный удар
  // рукой с одноручным оружием — первый раз по не видевшему приём −30 на
  // Уклонение и Парирование. Память «видел» пишется сразу после решения; переигровка той же
  // атаки (skipAmmo) берёт решение из storedOpts — цель «видела» приём уже после первого броска.
  const noWhack = { active: false, penalty: 0, note: "" };
  const whack = opts.skipAmmo ? (opts.whack ?? noWhack) : isMelee ? whackStrike(actor, item, targetToken) : noWhack;
  if (whack.active && !opts.skipAmmo) await recordWhackSeen(actor, attackerToken, targetToken);

  // Молотильщик (стр. 62, wdbc-pb60): пара топоров/булав/молотов — успешно
  // Парировавший теряет все неиспользованные Успехи и парирует второе оружие
  // отдельным тестом. Строка в карточке, а не расчёт: «неиспользованных
  // Успехов защиты» система не хранит, а второй тест назначает стол.
  const pounderWeapon = isMelee ? pounderPair(actor) : null;
  const pounderNote = (pounderWeapon && hit)
    ? "🔨 Молотильщик: успешно Парировавший этот удар теряет все неиспользованные Успехи "
      + "и парирует второе оружие пары отдельным тестом (если остались Реакции)."
    : "";

  // Чем актор атаковал в этом Ходу (wdbc-pb60): Мэн-Гош даёт переброс
  // Парирования ножом, которым НЕ били в предыдущий Ход, и без этого следа
  // ответить на его вопрос нечем. Список переезжает на Ход назад в
  // resetActionEconomy (rules/turn-flags.mjs::turnStartAttackCarryOver).
  if (item?.id && typeof actor.setFlag === "function") {
    const already = attackedThisTurn(actor);
    if (!already.includes(String(item.id)))
      await actor.setFlag("warhammer-dbc", "attackedThisTurn", [...already, String(item.id)]);
  }

  // Полная Атака (core, «Полная Атака»): «До начала своего следующего Хода он не
  // может совершать Физические Избегания» — метка на Ход, независимо от попадания
  // (combat/defense.mjs отказывает Уклонению и Парированию). Успешная
  // дополнительная атака Яростного Штурма открывает Реприз (Парирование).
  if (isMelee && opts.baseKey === "fullatk") {
    await markFullAttack(actor, item);
    if (hit && opts.techniqueOpts?.furiousAssault) await markFuriousChild(actor);
  }

  // Закреплённое тяжёлое (core.json, «Безоружный Бой»): «персонаж с таким
  // оружием считается безоружным до начала своего следующего Хода, если он
  // стрелял из него» — метка на Ход (rules/turn-flags.mjs), её читают профиль
  // «Ударить оружием» и Парирование (combat/weapon-profiles.mjs::braceBlocksMelee).
  if (!isMelee && item?.id && typeof actor.setFlag === "function" && isBraced(actor, item)) {
    const fired = firedBracedHeavyIds(actor);
    if (!fired.includes(String(item.id)))
      await actor.setFlag("warhammer-dbc", FIRED_BRACED_FLAG, [...fired, String(item.id)]);
  }

  const needsRecharge = !isMelee && (wp.recharge || maximalOn);
  if (needsRecharge) await item.update({ "system.needsRecharge": true, "system.rechargeTurnsRemaining": 1 });

  // Клин Распыления пишется ПОСЛЕ выстрела: в отличие от обычного клина
  // (jamCard выше, вместо атаки) поток уже поразил цели, и заклинило оружие на
  // этом же кубике урона — карточка атаки остаётся полной, только с пометкой.
  if (sprayJam) await item.update({ "system.jammed": true });

  // Просмотр кубов (#7) — стандартные «коробочки» Foundry, разворачиваемые кликом
  const renderedDice = (await Promise.all(allRolls.map(r => r.render()))).join("");

  const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: attackCard({
      actorName: actor.name, weaponName: item.name,
      // Пила/Оглушить (стр. 14, wdbc-x1nz.2.67/.66.3) — свойства самого Приёма,
      // не оружия, поэтому не в aggregateAuto(wProps) — домешиваются сюда же,
      // откуда карточка уже читает wp.* для data-атрибутов кнопки «Применить
      // урон» (combat/damage.mjs::_rollActiveShield читает ignoreDomeShields;
      // applyDamageToActor читает stunManeuver; wp.primitive=false для Оглушить
      // переиспользует уже существующий data-primitive без нового атрибута).
      wp: {
        ...wp,
        ignoreDomeShields: isMelee && techOpts.technique === "saw",
        stunManeuver: isMelee && techOpts.technique === "stun",
        primitive: (isMelee && techOpts.technique === "stun") ? false : wp.primitive
      },
      threshold, rv, hit, deg, hitsCount, hits, rerollDropped, critLine,
      // На Лезвии Бритвы (rules/rogue-talents.mjs): более медленная цель должна перебить ВСЕ Успехи
      // одиночного удара ножа — кнопкам Избегания идёт «столько попаданий, сколько Успехов» (null — обычно).
      evasionHits: hit ? razorsEdgeEvasionHits(actor, item, defenderActor, { hitsCount, deg }) : null,
      // Почему исход не от броска: "spray" — авто-попадание Распыления.
      autoHit: autoHitKind,
      modeLine: (isMelee && rofMode === "melee") ? "Рукопашная" : rofLabel,
      hitLocLabel, locRoll,
      locShift: canShiftLoc ? { max: agBonus, current: opts.locationShift || 0 } : null,
      tyranthikos: tyranthikosEligible ? { applied: tyranthikosDice } : null,
      gorget,
      isMelee, dtLabel, damageType: ammoDmgType || effDmgType,
      damageSubtype: ammoDmgSubtype || effDmgSubtype, pen,
      assassinStrike: isMelee && assassinStrikeAvailable(actor),
      tankHunterOffer: tankHunter.offer,
      // Поколотить (Талант Метания, combat/clobber.mjs): попадание метательным оружием — S-тест цели по весу снаряда.
      clobberHtml: (!isMelee && sys.weaponClass === "thrown" && hit && defenderActor)
        ? clobberOfferHtml(clobberOfferFor(actor, { projectileKg: sys.weight, target: defenderActor }), actor.uuid || "")
        : "",
      bayonetShotHtml: bayonetShotOn ? bayonetShotButtonsHtml(actor) : "",
      // Яростный Штурм (rules/berserker-talents.mjs): успешная Полная Атака носителя — кнопка доп. атаки за Реакцию.
      furiousAssaultHtml: furiousAssaultOffered(actor, { isMelee, baseKey: opts.baseKey, hit, furiousChild: !!opts.techniqueOpts?.furiousAssault })
        ? furiousAssaultButtonHtml({ attackerUuid: actor.uuid || "", weaponUuid: item.uuid || "", technique: opts.techniqueOpts?.technique || "" })
        : "",
      // Упорство (rules/melee-talents.mjs): одиночная единственная рукопашная атака Хода — кнопка повтора, если она не нанесла урона.
      tenacityHtml: tenacityOffered(actor, {
        isMelee, technique: opts.isSwift ? "swift" : opts.isLightning ? "lightning" : opts.techniqueOpts?.technique, dual: !!opts.isDual || !!opts.sabreSecondAttackIsSecond,
        attacksThisTurn: Number(actor.getFlag?.("warhammer-dbc", "attackActionsThisTurn")) || 0,
        tenacityChild: !!opts.techniqueOpts?.tenacityRepeat, showOffChild: !!opts.techniqueOpts?.showOffFree
      })
        ? tenacityButtonHtml({ attackerUuid: actor.uuid || "", weaponUuid: item.uuid || "", baseKey: opts.baseKey || "", technique: opts.techniqueOpts?.technique || "", hit: !!hit })
        : "",
      // Казнь (Черта Мастера Казней, combat/execution.mjs): двуручное оружие в двуручном хвате — кнопка «ещё атака, если цель жива».
      executionHtml: executionOfferHtml(actor, {
        isMelee, weapon: item, gripKey: opts.gripKey, defender: defenderActor,
        defenderTokenUuid: targetToken?.document?.uuid ?? targetToken?.uuid ?? "", baseKey: opts.baseKey || ""
      }),
      // Снайпер Ужаса (rules/terror-sniper.mjs): Избирательное попадание Accurate-оружием после Прицеливания.
      terrorSniperOffer: terrorSniperEligible(actor, { isMelee, hit, accurate: wp.accurate, aimValue: aimTarget?.value, aiming })
        ? { targetTokenUuid: targetToken?.document?.uuid ?? targetToken?.uuid ?? "" } : null,
      sbEff, sbHalf, reverseThrustBonus, taintedAdd, vehicleSide: opts.vehicleSide || "",
      ammo: isMelee ? null : {
        name:   loadedAmmo?.name || "",
        mods:   loadedAmmo ? _buildAmmoModString(ammoSys) : "",
        magCur: sys.magazineCur ?? "?", magMax: sys.magazineMax ?? "?",
        spent:  ammoSpent, special: ammoSpecial,
        condLabels: opts.ammoCondLabels || [], warning: ammoWarning
      },
      band, suppression, allGunsBlazing, corVal, corEffects: sys.corEffects || [],
      burstSecondaryTargets,
      misfireHits,
      betrayalHits,
      grappleCoverHits,
      fanaticIntercepts,
      devotionIntercepts,
      devotionMasterUuid: defenderActor?.uuid ?? "",
      regroupLegacyActive,
      deadlyTrapLegacyDelta,
      fangVenomDose,
      butcherDice,
      pyromaniac: pyromaniacActive(actor, { spray: wp.spray, flame: wp.flame }),
      reactionKnockdownReason,
      sabreSecondAttackNote,
      sabreSecondAttackItemId,
      // Урон по Орде: Rng нужен Распылению, burst — Таланту «Свинцовый Дождь»,
      // uuid — чтобы найти Таланты и Размер стрелка.
      // Максимальный режим: +10 Rng (длина конуса Распыления тоже)
      weaponRange: maximalRange(Number(sys.range) || 0, maximalOn),
      torrent: torrentOn ? { radius: torrentBlastRadius(Number(sys.range) || 0), maxDistance: torrentMaxDistance(Number(sys.range) || 0) } : null,
      burst: rofMode === "semi" || rofMode === "full",
      // One Against A Hundred (wdbc-u0by): Преимущество защищающемуся против
      // атаки Орды — только буквальный actor.type "horde" честно детектируем
      // (Низшие Миньоны такого поля не хранят нигде на акторе, см. bd).
      attackerIsHorde: actor.type === "horde",
      attackerUuid: actor.uuid || "",
      // itemUuid — только для кнопки шаблона зоны поражения (Automated
      // Animations читает его в module/hooks.mjs, см. triggerBlastAnimation).
      itemUuid: item.uuid || "",
      hordeHits,
      pool: evasionPool,
      swarm: etherealSwarm,
      unseen, unseenDetected, unseenPenalty,
      sixthSenseBypassAvailable, musicOfBattleBypassAvailable,
      // Выжигание Души: Психосиловое оружие в руках псайкера при попадании.
      soulBurnActorId: (hit && wp.forcePR && isPsyker) ? actor.id : null,
      defense: {
        // Карабин (wdbc-z56a, стр. 40): «Винтовка» в рукопашной даёт цели
        // +30 на Уклонение, Карабин — только +10 (весь остальной стрелковый
        // арсенал в диалоге атаки типы Пистолет/Винтовка/Тяжёлое не
        // различает — тот же весовой штраф −20 «Стрельба в рукопашную» уже
        // применяется одинаково ко всем, так что и бонус цели считаем так же
        // единообразно, без отдельной схемы «Тип оружия»).
        // Императив (wdbc-yu32): плоский бонус/штраф активного Императива
        // цели к тесту Избегания — суммируется с базовым модификатором, не
        // заменяет его (у Карабина/рукопашной стрельбы своя причина бонуса).
        // wdbc-hdxj: dodgeModRecoil — тот же базовый модификатор, но с
        // recoil-специфичным знаком Императива вместо обычного (null, если у
        // защищающегося нет активного Evasion/Fortress Imperative — тогда
        // defenseSection не рендерит декларацию «планирую Отскочить» вовсе).
        // Винтовочная Гарда (стр. 62, wdbc-pb60): с рукопашным оружием Баланса
        // не ниже −1 в другой руке выстрел в рукопашной НЕ даёт цели бонуса
        // вовсе — ни +30 винтовки, ни +10 Карабина.
        // Широкая Очередь (стр. 35, wdbc-x1nz.2.53): книга штрафует только
        // «попытки Уклонения» — не Парирование, поэтому wideBurstPenalty
        // прибавлен ниже лишь к dodgeMod/dodgeModRecoil.
        // Быстрое/skilled 8-8, Оружие Наследия (wdbc-1rno.35, стр. 428):
        // рукопашная −10 (уже имело Flexible при получении), стрелковая −20
        // (безусловно) — у одного оружия сразу оба быть не могут (разные
        // weaponClass-ветки самой записи).
        dodgeMod: (hiddenAttack || feintBlocked || killingStrikeOn) ? -999
          : meleeShotDodgeBonus + evasionImperativeBonus(defenderActor) + (blindFightingBypass ? -20 : 0) + critHitPenalty + wideBurstPenalty + sureShotPenalty + cookingPenalty + focusEvasion
            + swiftLegacyMeleeDodgePenalty(item) + swiftLegacyRangedDodgePenalty(item) + whack.penalty - bladeJugglerPenalty,
        dodgeModRecoil: (!hiddenAttack && !feintBlocked && !killingStrikeOn && hasEvasionRecoilImperative(defenderActor))
          ? meleeShotDodgeBonus + evasionImperativeBonus(defenderActor, { planningRecoil: true }) + (blindFightingBypass ? -20 : 0) + critHitPenalty + wideBurstPenalty + sureShotPenalty + cookingPenalty + focusEvasion
            + swiftLegacyMeleeDodgePenalty(item) + swiftLegacyRangedDodgePenalty(item) + whack.penalty - bladeJugglerPenalty
          : null,
        // Unarmed Master (стр. 62): Захват мастера Парировать нельзя — тот же порог −999.
        parryMod: (hiddenAttack || feintBlocked || killingStrikeOn || (isMelee && grappleUnparryable(actor, techOpts.technique))) ? -999 : (techOpts.targetParryMod ?? 0) + (blindFightingBypass ? -20 : 0) + critHitPenalty + focusEvasion + whack.penalty - bladeJugglerPenalty,
        // Переброс, НАВЯЗАННЫЙ защищающемуся (Локус Кровопролития): бросает его
        // цель у себя, а знает о нём атакующий — поэтому он едет атрибутом на
        // кнопках защиты в карточке.
        // Борец (стр. 62): против его Захвата успешное Уклонение перебрасывается.
        forcedDefenceReroll: opts.forcedDefenceReroll || (isMelee ? wrestlerDodgeReroll(actor, techOpts.technique) : ""),
        // Шагоход (wdbc-6wzt, п.5): у него, в отличие от прочей техники, есть
        // не только Вираж, но и настоящие Парирование/Уклонение — свои кнопки
        // на карточке, потому что считает их ПИЛОТ, а не машина.
        targetIsVehicle, targetIsWalker,
        // Таланты Избегания (глава 3): атака Захватом (Ускользнуть), Кусака у
        // цели, Телохранители рядом с атакующим.
        grapple: isMelee && techOpts.technique === "grapple",
        chomper: isMelee && hasDodgeTalent(defenderActor, "chomper")
          && [...(defenderActor?.items ?? [])].some(i => isBiteWeapon(i)),
        bodyguards: bodyguardsFor({ attackerToken, targetToken }),
        allyName: defenderActor?.name ?? "",
        // Бой Вслепую (wdbc-1rno.2): −20 выше уже применён — здесь только
        // подпись, откуда он взялся, чтобы не выглядеть немотивированным штрафом.
        note: [techOpts.chatNote, whack.note,
          bladeJugglerPenalty ? `🔪 Жонглёр Клинком: Избегания цели от этой атаки −${bladeJugglerPenalty}.` : "",
          blindFightingBypass ? "Бой Вслепую: Незримая атака, Уклонение/Парирование в рукопашной −20 без засечения." : ""]
          .filter(Boolean).join(" ")
      },
      notes: {
        shelter: shelter
          ? `Цель прикрыта Ордой «${shelter.hordeToken.name ?? shelter.horde?.name}»: `
            + `${shelter.count} из ${hitsCount} попадан${shelter.count === 1 ? "ия уходит" : "ий уходят"} в толпу.`
          : "",
        attack:    tyranthikosDice
          ? [opts.attackNote, `Тирантикос: обе тяжёлые попали по цели Размера 2+ — первое попадание этой атаки +${tyranthikosDice}d10 Dmg (уже в уроне).`]
              .filter(Boolean).join(" · ")
          : opts.attackNote,
        // Строки о Состоянии цели. Ослеплённая (wdbc-x1nz.2.89) — сюда же:
        // defense.note карточка не рисует, а игрок должен видеть, ПОЧЕМУ
        // кнопки защиты заперты «не засечена».
        helpless:  [opts.doubleDamage
          ? "🪢 Цель Беспомощна: попадание автоматическое, урон ×2 (до Поглощения)."
          : "",
          (targetBlindedUnseen && hit)
          ? "🙈 Цель Ослеплена: для неё все атаки Незримые — Уклонение/Парирование только после засечения."
          : ""].filter(Boolean).join("<br>"),
        // Quiet Elimination / Тихое Устранение (wdbc-1rno.3): «цель не издаёт
        // звука при гибели» — честно только строка, нет детектора смерти на
        // этом такте (формула урона ещё не разрешена, killstate решается позже).
        quietElimination: (quietEliminationActive && hit)
          ? "🔇 Тихое Устранение: +1 куб урона (уже в формуле); при гибели цель не издаёт звука."
          : "",
        // Таланты боевых бонусов (rules/damage-talents.mjs): Крушащий Удар, Могучий
        // Выстрел, Эксперт/Мастерство Плазмы.
        damageTalents: damageTalentNotes,
        technique: { label: techOpts.techniqueLabel, stance: techOpts.stanceLabel, note: techOpts.chatNote },
        aiming:    opts.aimingLabel,
        aim:       aimTarget?.value ? aimTarget.label.replace(/\s*\(.*\)/, "") : "",
        blastScatter,
        mount:     opts.mountNote || "",
        allOut:    !!opts.isAllOut,
        off:       offNote,
        pounder:   pounderNote,
        maximal:   maximalOn,
        maximalBlast: maximalBlastLine,
        recharge:  needsRecharge,
        // Поломка человеческого оружия в руках Огрина (wdbc-flai): пустая
        // строка, когда бросок не требовался вовсе.
        ogrynBreak: ogrynBreakNote(ogrynBreak, item.name),
        // Клин Распыления (стр. 168) — попадания в силе, оружие заклинило.
        sprayJam: sprayJam
          ? `⚙️ Оружие заклинило: первый кубик урона — <b>${sprayJam.face}</b> (клин на ${sprayJam.at}${sprayJam.at === 8 ? "-9" : ""}). Требуется действие на устранение Клина.`
          : "",
        // Граната как рукопашное оружие, 3+ Успеха (стр. 40, wdbc-x1nz.2.60):
        // «...то он не задет собственным взрывом» — только информационная
        // строка (GM решает, кого ещё накрыло Взрывом), как у Вторичных целей
        // Очереди выше — вторая машинерия разметки области здесь не нужна.
        grenadeSelfImmune: (isMelee && sys.weaponType === "grenade" && wp.blastRating > 0 && hit && deg >= 3)
          ? `Атакующий нанёс удар с ${deg}+ Успехами — он не задет собственным Взрывом (стр. 40).`
          : ""
      },
      blocks: {
        props:         buildPropertyChatBlock(cardProps),
        quality:       buildQualityChatBlock(item, gardenQuality),
        splinter:      isSplinter(sys) ? splinterReminders() : "",
        // ammoName (wdbc-utaw) — какой боеприпас заряжен на ЭТОТ выстрел, для
        // спец-боеприпасов, чей эффект зависит от собственной идентичности
        // (Гиперрост), не только от ключа свойства Toxic.
        targetEffects: buildTargetEffectButtons(cardProps, { hit, ammoName: loadedAmmo?.name || "",
          damageType: effDmgType, hitLocation: hits[0]?.loc || "",
          poisoner: !!aimTarget?.value && hasTalentCapability(actor, POISONER_CAP),
          pyromaniac: pyromaniacActive(actor, { spray: wp.spray, flame: wp.flame }),
          pyromaniacAttackerUuid: actor.uuid ?? "", igniter })
          // Хирургическая Точность (Медик): кнопка только у Избирательной атаки.
          + surgicalPrecisionButtonHtml(actor, { selective: !!aimTarget?.value, hit, attackerUuid: actor.uuid }),
        // Пинок с Разворота (Талант Пугилиста, combat/roundhouse.mjs): кнопка
        // состязания после попадания Пинком с Натиска — едет вместе с блоком
        // встречных/послеатакующих кнопок.
        counterAttack: counterAttackBlock + ((goadingOn && hit) ? goadingStrikeButtonHtml({ actor, targetActor: defenderActor }) : "") + (owgdOn ? oneWillGoDownButtonHtml({ attackerUuid: actor.uuid || "", targetName: defenderActor?.name ?? "" }) : "") + (isMelee
          ? roundhouseButtonHtml({ actor, weapon: item, baseKey: opts.baseKey, hit, targetActor: defenderActor }) : "")
          // Саботаж (rules/rogue-talents.mjs, combat/sabotage.mjs): итог — по кнопке после Избегания цели.
          + ((sabotageOn && hit) ? sabotageButtonHtml({ actor, targetActor: defenderActor, weapon: sabotageWeapon }) : ""),
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
  const { forcedRoll, updateMessageId, ...storedOptsBase } = opts;
  // Что в этом выстреле уже оплачено (Очко Бесчестия, метка Тех-Оружейника, заряд Линз) — перебросы
  // того же выстрела (+10, Очко Судьбы, сдвиг места) повторно не платят, но и бесплатно бонус не получают.
  const storedOpts = { ...storedOptsBase, whack, bladeJugglerPenalty, talentPaid: {
    sureShot: sureShotPaid, killingStrike: killingStrikePaid, oneWillGoDown: owgdOn, haymaker: haymakerOn, weaponTech: weaponTech.bonus > 0, lens: !!lens.use, cooking: cooking ?? undefined } };
  messageData.flags = foundry.utils.mergeObject(messageData.flags || {}, {
    "warhammer-dbc": { attack: {
      actorId: actor.id, itemId: item.id, charKey, rv,
      // Цель этой атаки: +10 за Очко и Переброс сверяют её с Ненавистью (Сфокусированный Гнев,
      // combat/focused-wrath.mjs) — выделение на сцене к клику по меню могло смениться.
      targetUuid: defenderActor?.uuid ?? null,
      // Фактическое попадание карточки (Длань Кхорна, Атака Ненависти, беспомощная цель меняют его против куба):
      // от него зависит, принимает ли карточка «Успех» за Очко (apps/infamy-success.mjs).
      hit: !!hit,
      // Сколько кубов Тирантикоса лежит на этой карточке второй руки: кнопка «Пересчитать» (hooks.mjs) сверяет с ним.
      tyranthikosApplied: tyranthikosDice,
      threshold, rofMode, aimTarget: aimTarget ?? null, opts: storedOpts
    } }
  });

  // Сдвиг места попадания (кнопки карточки, см. attack-card.mjs/hooks.mjs) правит
  // СРАЗУ ТУ ЖЕ карточку — без updateMessageId (обычная атака, переброс, +10 и
  // т.п.) по-прежнему создаётся новое сообщение, как раньше.
  if (updateMessageId) {
    const existing = game.messages.get(updateMessageId);
    if (existing) { await existing.update(messageData); return { hit }; }
  }
  await ChatMessage.create(messageData);
  // Лазерный Прицел (rules/laser-sight.mjs): точку лазера могут заметить — после любой дальнобойной
  // атаки с ним ГМу сам уходит шёпот со строками врагов (решение владельца 30.10.2026: не кнопка на
  // карточке стрелка, которому нажимать невыгодно). Переброс той же атаки (forcedRoll) точку не включает заново.
  // Переброс за Очко Судьбы / Огневую Точку / Мастера Клинка идёт с skipAmmo без forcedRoll — тоже «та же атака».
  if (!forcedRoll && !opts.skipAmmo && laserDotOffered({ isMelee, laserDot: modFx.laserDot })) {
    try {
      const { whisperLaserDotToGM } = await import("./laser-sight.mjs");
      await whisperLaserDotToGM(actor, targetToken?.document?.uuid ?? targetToken?.uuid ?? "");
    } catch (e) { console.warn("Warhammer DBC | Лазерная точка:", e); }
  }
  // Командование (глава «Командование»): метка Концентрации огня гасится
  // атакой; Синхронный Натиск и счётчик Залпового Огня — после атаки
  // подчинённого (combat/command-state.mjs). Переброс (forcedRoll) — та же
  // атака, второй раз не считается.
  if (!forcedRoll) {
    try {
      const cs = await import("./command-state.mjs");
      if (focusFireOn) await cs.updateOrRelay(actor, { "flags.warhammer-dbc.-=focusFire": null });
      await cs.afterSubordinateAttack(actor, { isMelee, isThrown: sys.weaponClass === "thrown", defenderActor });
    } catch (e) { console.warn("Warhammer DBC | Командование после атаки:", e); }
  }
  // Automated Animations (если установлен и включён) — см. module/integrations/autoanimations.mjs.
  triggerAttackAnimation({ actor, item, hit });
  // Итог броска наружу: окну атаки нужно знать, попала ли основная рука, чтобы
  // решить про вторую (Тирантикос). Ранние отказы выше отдают undefined —
  // броска не было, «попал/промахнулся» о нём не скажешь.
  return { hit };
}
