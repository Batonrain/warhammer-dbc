import { CHARACTERISTICS }                         from "../constants/characteristics.mjs";
import { pickReroll } from "../rules/reroll-pick.mjs";
import { criticalOutcome } from "../rules/roll-outcome.mjs";
import { critLineHtml } from "../rules/test-kind-widget.mjs";
import { WEAPON_CLASSES, DAMAGE_TYPES }            from "../constants/items.mjs";
import { MELEE_STANCES }                           from "../constants/combat.mjs";
import { _getAmmoSpent, _buildAmmoModString }       from "../helpers/utils.mjs";
import { getCriticalEffect }                        from "../../critical-tables.mjs";
import { resolveWeaponProps, resolveWeaponPropsList, aggregateAuto,
         jamThreshold, sprayJamFace, sprayJams, buildPropertyChatBlock,
         buildTargetEffectButtons, hasWeaponPropertyImmunity }
                                                      from "./weapon-properties.mjs";
import { hitCount, hitLocation, locationForHit, meleeStrengthBonus,
         attackPenetration, damageFormulaFor, bonusDamageDice,
         attackHitOutcome }                          from "./attack-outcome.mjs";
import { effectiveDamage, mergeExtraProps, weaponOffEffects } from "./attack-weapon.mjs";
import { attackIsMelee } from "./weapon-profiles.mjs";
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
import { resolveGrenadeMeleeFumble }                  from "./draw-action.mjs";
import { hidingInHordeSplit }                        from "./horde-tokens.mjs";
import { applyGrappleOnHit }                          from "./grapple.mjs";
import { rollOgrynWeaponBreak, ogrynBreakNote }      from "./ogryn-weapon-break.mjs";
import { getEvasionPool, poolAffordableHits }         from "./evasion-pool.mjs";
import { activeSwarm }                                from "../rules/ethereal-swarm.mjs";
import { consumeHiddenThreatPending }                 from "../rules/hidden-threat.mjs";
import { consumeHairTriggerUnseenPending }            from "../rules/hair-trigger.mjs";
import { isUnseenDetected }                           from "../rules/unseen-attack.mjs";
import { hasSixthSense, hasMusicOfBattle, hasBlindFighting, hasBackstab, isKnifeWeapon, hasSniperAssassin, isBlindsideMarked, consumeBlindsideMark } from "../rules/unseen-talents.mjs";
import { isOutsideDefenderView, resolveAttackerToken } from "./facing.mjs";
import { hasQuietElimination } from "../rules/quiet-elimination.mjs";
import { hasJanusRearVision } from "../rules/janus.mjs";
import { actorInfamyValue }                           from "../apps/infamy-points.mjs";
import { sunderingDamageFormula, SUNDERING_COPY_FLAG } from "../rules/sundering.mjs";
import { recoilRemaining as recoilPoolRemaining }     from "./recoil-pool.mjs";
import { suppressionTestMod }                         from "./suppression.mjs";
import { gunGuardCancelsDodgeBonus, savageExtraHits, pounderPair }
                                                      from "../rules/dual-wield-talents.mjs";
import { attackedThisTurn }                           from "../rules/turn-flags.mjs";
import { prismaFireBonus, halvePrismaCharge }         from "./prisma.mjs";
import { attackEntropyRating } from "./touch-of-entropy.mjs";
import { touchOfPainActive } from "./touch-of-pain.mjs";
import { withWitchsEdge }                             from "./witchs-edge.mjs";
import { dreadWailWeaponBonus }                       from "./dread-wail.mjs";
import { bloodFlameDamageBonus }                      from "../rules/blood-flame.mjs";
import { handOfKhorneStrengthMultiplier, handOfKhorneBlocksRangedAttack } from "../rules/hand-of-khorne.mjs";
import { triggerAttackAnimation }                     from "../integrations/autoanimations.mjs";
import { assassinStrikeAvailable }                    from "./assassin-strike.mjs";
import { evasionImperativeBonus, hasEvasionRecoilImperative } from "./imperative-bonuses.mjs";
import { isFusedByHandOfDeath }                       from "../rules/hand-of-death.mjs";
import { counterAttackTriggers, counterAttackSectionHtml } from "./counter-attack.mjs";

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
export async function rollExtremeDamage(dmgRoll, { wp, damageType, hitLocation = "Торс", targetIsVehicle = false, attacker = null }) {
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
  // Маловажные NPC (стр. 34, wdbc-x1nz.2.51): «не могут наносить Экстремальный
  // Урон» без Командного Присутствия «Экстремальный Урон» от своего Отряда/
  // Командира (rules/squad-roles.mjs::minionCanCauseExtremeDamage). Гасится
  // ДО броска d5 — не получивший способность миньон вообще не откатывает
  // Крит. Эффект, не только прячет его в карточке.
  if (hasExtreme && attacker && !minionCanCauseExtremeDamage(attacker)) hasExtreme = false;
  let extremeLevel = 0, critEffect = null, exRoll = null;
  if (hasExtreme) {
    exRoll = await new Roll("1d5").evaluate();
    // Monofilament (X): «+2 Экстремальный урон ИЛИ Крит. эффект» — здесь
    // extremeLevel сразу задаёт оба (getCriticalEffect читает его же).
    extremeLevel = exRoll.total + (wp.extremeLevelBonus || 0);
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
  const sys     = item.system;
  // Метательное (Граната и т.п.) по умолчанию бросается по BS — стр. 40:
  // «В рукопашной оно МОЖЕТ использоваться как рукопашное», это не default.
  // Решение «рукопашная ли это атака» одно на окно и на бросок
  // (combat/weapon-profiles.mjs::attackIsMelee, wdbc-bs0q): выбранный ПРОФИЛЬ
  // важен наравне с классом оружия, иначе «Ударить оружием» катилось бы тестом по
  // WS, но считался стрельбой — без прибавки S.b к урону и с кнопками защиты
  // из стрелковой ветки.
  const isMelee = attackIsMelee(sys, { forceMelee: opts.forceMelee, profile: opts.profile });
  // Выбранный профиль атаки (стр. 207-221) и хват (стр. 39) переопределяют урон.
  const P = opts.profile || null;
  const gripDmgFlat = Number(opts.gripDmgFlat) || 0;
  const eff = effectiveDamage({ sys, profile: P, gripDmgFlat });
  let   effDamage  = eff.damage;
  const effDmgType = eff.damageType;
  const effDmgSubtype = eff.damageSubtype;
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
    // Свойства от правила (wdbc-w8z4): уже отобраны диалогом атаки по `when`
    // (см. attack-dialog.mjs, resolveTest(...).weaponProps) — здесь только долив.
    ruleProps:   opts.ruleProps || [],
    removeProps: loadedAmmo?.system?.removeProps || []
  });
  // Колдовское Лезвие (стр. 74 Книги Аэльдари): выбор бонуса на Encounter
  // (флаг на предмете, module/combat/witchs-edge.mjs) добавляет свои записи.
  _mergedEntries = withWitchsEdge(item, _mergedEntries);

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
  // Touch of Pain/Касание Боли (wdbc-1rno, Дар Слаанеш): безоружные/природные
  // атаки носителя получают Shocking СИНТЕТИЧЕСКИ — только для ЭТОГО выстрела,
  // не записано на сам предмет Кулака/Пинка (иначе получили бы все персонажи
  // с голыми руками). Тот же приём добавления, что Tearing выше.
  const touchOfPainOn = touchOfPainActive(actor, item);
  if (touchOfPainOn && !_mergedEntries.some(x => x.key === "shocking")) {
    _mergedEntries.push({ key: "shocking" });
  }

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

  const wProps    = resolveWeaponPropsList(_mergedEntries);
  const wp         = aggregateAuto(wProps);
  wp.reliabilityScore += modFx.reliabilityMod || 0;
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

  // Sniper Assassin / Снайпер-Убийца (wdbc-1rno.2, rules/unseen-talents.mjs)
  // — ДО блока unseen ниже: сам ставит wp.unseen, тот читается следующей
  // строкой. actor.system.aiming — персистентное поле актора (то же самое,
  // что sheets/attack-dialog.mjs::currentAiming читает для бонуса
  // Прицеливания), не диалоговая опция.
  const sniperAssassinActive = wp.accurate && rofMode === "single"
    && actor.system?.aiming === "full" && hasSniperAssassin(actor);
  if (sniperAssassinActive) { wp.unseen = true; wp.sniperAssassin = true; }

  // targetToken/defenderActor (wdbc-1rno.2): вынесены СЮДА, раньше, чем были
  // (изначально считались только у секции Орды/пула Уклонения, ниже) — нужны
  // Blindside следующим блоком, до формулы урона. game.user.targets не
  // зависит от hit/остального состояния атаки, переносить безопасно.
  const targetToken = [...(game.user?.targets ?? [])][0] ?? null;
  const defenderActor = targetToken?.actor ?? targetToken?.document?.actor ?? null;

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
  const unseen = !!(wp.unseen || hiddenThreatFlag || hairTriggerFlag);
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
  // Дикарь (стр. 62, wdbc-pb60): парными когтями — «+2 Успеха при успешной
  // атаке». Прибавляется к СТЕПЕНИ, а не к порогу: от степени зависят и число
  // попаданий (Быстрая/Молниеносная), и остаточные Успехи приёмов.
  const savageBonus = (hit && isMelee) ? savageExtraHits(actor, item) : 0;
  const deg = rolledDeg + savageBonus;
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
    const spoiled = Math.min(2 * (_getAmmoSpent({ system: sys }, rofMode) || 0), curMag);
    await item.update({
      "system.jammed": true,
      "system.magazineCur": curMag - spoiled,
      "system.jammedAmmo": (sys.jammedAmmo || 0) + spoiled
    });
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
  let hitLocLabel = rolledLoc;

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
  const locForHit = (i) => {
    if (wp.impulse && !targetIsVehicle && !wp.extraHits && (i + 1) % 4 === 0) return "Сочленение / Шея";
    return locationForHit(i, { label: hitLocLabel, hitsCount, targetIsVehicle, vehiclePart: vehPart });
  };

  // Fanning / Быстрый Курок (wdbc-fy33, стр. 39): RoF Длинной очереди 2..BS.b
  // по выбору игрока заменяет фиксированный sys.rof_full — только для
  // потолка попаданий и расхода патронов этого броска, реальный предмет не
  // трогаем (клон, не мутация sys).
  const rofOverride = Number(opts.rofCapOverride) || 0;
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
  const hitCountSys = wideBurst
    ? { ...fanningSys, [wideBurstKey]: Math.max(0, (Number(fanningSys[wideBurstKey]) || 0) - 2) }
    : fanningSys;
  const wideBurstPenalty = wideBurst ? -20 : 0;

  // Попадания и расход патронов
  const { count: hitsCount, label: rofLabel } = hitCount({
    hit, isMelee, rofMode, deg, wp, sys: hitCountSys,
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
    ammoSpent = _getAmmoSpent({ system: fanningSys }, rofMode) * (wp.ammoMult || 1) * (maximalOn ? 2 : 1) + prisma.extraAmmo;
    // При перебросе/+10 за Очко Судьбы это тот же выстрел — патроны не тратятся повторно.
    if (!opts.skipAmmo) {
      if (ammoSpent > 0) {
        const curMag = sys.magazineCur || 0;
        const newMag = Math.max(0, curMag - ammoSpent);
        await item.update({ "system.magazineCur": newMag });
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
  const pen = attackPenetration({
    base: effPen0 + ammoPenMod + (modFx.penMod || 0) + offPenMod + (qAuto.penMod || 0) + changePenBonus + dreadWailBonus.pen + deadlyNaturalCorBAdd,
    wp: penWp, hit, deg, shortRange, maximal: maximalOn, band, forceBonus
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
  const thrownSbBonus = (!isMelee && sys.weaponClass === "thrown") ? sbEff : 0;
  const flatBonus = (isMelee ? sbEff : 0) + thrownSbBonus + reverseThrustBonus + taintedAdd + deadlyNaturalCorBAdd + (isMelee ? 0 : ammoDmgMod + ammoCondDmg) + forceBonus + bandDmg + offDmgMod + (modFx.damageMod || 0) + (qAuto.damageMod || 0) + dmgBonus + chargeBonus + dreadWailBonus.dmg + bloodFlameBonus;
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
  // aimed читает opts.aiming — actor.system.aiming к этому моменту уже сброшен
  // в "none" диалогом (attack/dialog.mjs:217, ДО этого вызова), поэтому
  // значение приходит явным параметром, захваченным до сброса (wdbc-1rno.5).
  const bonusDice = bonusDamageDice({
    wp, rofMode, hit, deg, shortRange, maximal: maximalOn, band,
    ammoDice: ammoSys?.damageDiceMod,
    aimed: !!opts.aiming && opts.aiming !== "none",
    confinedSpace: confinedSpaceOn, damageType: effDmgType
  });

  const damageRolls = [];
  const allRolls    = [roll];

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
  }

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
      // Замена кубика на Успехи (стр. 34, wdbc-x1nz.2.49): «атакующий может
      // выбрать заменить результат броска ОДНОГО кубика в броске на урон... на
      // количество Успехов в тесте на атаку» — первый кубик формулы урона,
      // тот же приём извлечения, что и у Клина Распыления ниже. Сама подмена —
      // кнопка на карточке (attack-card.mjs), сюда попадает только число для
      // неё; выбор «на какой из нескольких попаданий тратить» и «только один
      // из целей площадной атаки» — решение игрока/ГМа за столом, не гейт кода.
      const baseDieResult = (dmgRoll.terms ?? [])
        .find(t => t.faces && Array.isArray(t.results) && t.results.length)?.results?.[0]?.result ?? null;
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
      if (opts.doubleDamage) total *= 2;
      // У техники Экстремальный урон переводится в её Критический Эффект через
      // отрицательную Структуру (при применении урона), а не по таблице существ.
      const { hasExtreme, extremeLevel, critEffect, exRoll } = await rollExtremeDamage(dmgRoll, {
        wp, damageType: effDmgType, hitLocation: locForHit(i), targetIsVehicle, attacker: actor
      });
      if (exRoll) allRolls.push(exRoll);
      damageRolls.push({ total, extremeLevel, hasExtreme, critEffect, bonusNote, deflagrateNote, msPenalty,
        baseDieResult, successes: deg });
    }
  }

  // Место каждого попадания считается один раз: карточка печатает его и в
  // строке урона, и в кнопке применения урона.
  const hits = damageRolls.map((d, i) => ({ ...d, loc: locForHit(i) }));

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
      const contactPool = allContactTokenDocs(targetTokenDoc).map(d => d.actor).filter(Boolean);
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
        ...poolAffordableHits(evasionPoolEntry, techOpts.targetDodgeMod ?? 0, hitsCount, defenderActor),
        canRecoil: !isMelee && evasionPoolEntry.successes >= 2 && recoilPoolRemaining(defenderActor) > 0 }
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
      isMelee, hit, technique: techOpts.technique || "", meleeCategory: sys.meleeCategory || ""
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
      actorName: actor.name, weaponName: item.name, wp,
      threshold, rv, hit, deg, hitsCount, hits, rerollDropped, critLine,
      // Почему исход не от броска: "spray" — авто-попадание Распыления.
      autoHit: autoHitKind,
      modeLine: (isMelee && rofMode === "melee") ? "Рукопашная" : rofLabel,
      hitLocLabel, locRoll,
      locShift: canShiftLoc ? { max: agBonus, current: opts.locationShift || 0 } : null,
      gorget,
      isMelee, dtLabel, damageType: ammoDmgType || effDmgType,
      damageSubtype: ammoDmgSubtype || effDmgSubtype, pen,
      assassinStrike: isMelee && assassinStrikeAvailable(actor),
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
      // Урон по Орде: Rng нужен Распылению, burst — Таланту «Свинцовый Дождь»,
      // uuid — чтобы найти Таланты и Размер стрелка.
      weaponRange: Number(sys.range) || 0,
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
        dodgeMod: (hiddenAttack || feintBlocked) ? -999
          : meleeShotDodgeBonus + evasionImperativeBonus(defenderActor) + (blindFightingBypass ? -20 : 0) + critHitPenalty + wideBurstPenalty,
        dodgeModRecoil: (!hiddenAttack && !feintBlocked && hasEvasionRecoilImperative(defenderActor))
          ? meleeShotDodgeBonus + evasionImperativeBonus(defenderActor, { planningRecoil: true }) + (blindFightingBypass ? -20 : 0) + critHitPenalty + wideBurstPenalty
          : null,
        parryMod: (hiddenAttack || feintBlocked) ? -999 : (techOpts.targetParryMod ?? 0) + (blindFightingBypass ? -20 : 0) + critHitPenalty,
        // Переброс, НАВЯЗАННЫЙ защищающемуся (Локус Кровопролития): бросает его
        // цель у себя, а знает о нём атакующий — поэтому он едет атрибутом на
        // кнопках защиты в карточке.
        forcedDefenceReroll: opts.forcedDefenceReroll || "",
        // Шагоход (wdbc-6wzt, п.5): у него, в отличие от прочей техники, есть
        // не только Вираж, но и настоящие Парирование/Уклонение — свои кнопки
        // на карточке, потому что считает их ПИЛОТ, а не машина.
        targetIsVehicle, targetIsWalker,
        // Бой Вслепую (wdbc-1rno.2): −20 выше уже применён — здесь только
        // подпись, откуда он взялся, чтобы не выглядеть немотивированным штрафом.
        note: [techOpts.chatNote, blindFightingBypass ? "Бой Вслепую: Незримая атака, Уклонение/Парирование в рукопашной −20 без засечения." : ""]
          .filter(Boolean).join(" ")
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
        // Quiet Elimination / Тихое Устранение (wdbc-1rno.3): «цель не издаёт
        // звука при гибели» — честно только строка, нет детектора смерти на
        // этом такте (формула урона ещё не разрешена, killstate решается позже).
        quietElimination: (quietEliminationActive && hit)
          ? "🔇 Тихое Устранение: +1 куб урона (уже в формуле); при гибели цель не издаёт звука."
          : "",
        technique: { label: techOpts.techniqueLabel, stance: techOpts.stanceLabel, note: techOpts.chatNote },
        aiming:    opts.aimingLabel,
        aim:       aimTarget?.value ? aimTarget.label.replace(/\s*\(.*\)/, "") : "",
        blastScatter,
        mount:     opts.mountNote || "",
        allOut:    !!opts.isAllOut,
        off:       offNote,
        pounder:   pounderNote,
        maximal:   maximalOn,
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
        props:         buildPropertyChatBlock(wProps),
        quality:       buildQualityChatBlock(item),
        splinter:      isSplinter(sys) ? splinterReminders() : "",
        // ammoName (wdbc-utaw) — какой боеприпас заряжен на ЭТОТ выстрел, для
        // спец-боеприпасов, чей эффект зависит от собственной идентичности
        // (Гиперрост), не только от ключа свойства Toxic.
        targetEffects: buildTargetEffectButtons(wProps, { hit, netDamageKnown: false, ammoName: loadedAmmo?.name || "" }),
        counterAttack: counterAttackBlock,
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
  // Automated Animations (если установлен и включён) — см. module/integrations/autoanimations.mjs.
  triggerAttackAnimation({ actor, item, hit });
}
