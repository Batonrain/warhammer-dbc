// module/sheets/attack/mods.mjs
// ══════════════════════════════════════════════════════════════════════════
//  СИТУАТИВНЫЕ МОДИФИКАТОРЫ окна атаки (wdbc-uh56).
//
//  Список галочек «Общие» и «Рукопашные/Стрелковые» — тот, что живёт в
//  свёрнутом блоке диалога. Ничего не рисует: отдаёт данные, вёрстку из них
//  собирает markup.mjs.
//
//  Шов узкий по замеру (tools/seam-measure.mjs): 12 значений внутрь, 4 наружу
//  на 117 строк. Поперёк функции такого места больше нет — в середине через
//  границу идёт 90–106 значений.
// ══════════════════════════════════════════════════════════════════════════

import { ruleFlagLabels, hasRuleFlag } from "../../rules/flags.mjs";
import { isStunnedOrDazed }       from "../../rules/predicates.mjs";
import { meleeContactCount, hasHighGround } from "../../combat/tactical-map.mjs";
import { rangeBandKey }           from "../../rules/tactical-map.mjs";
import { getTerrainInfoForToken } from "../../regions/difficult-terrain.mjs";
import { actorHasAspectPath }     from "../../constants/aeldari-paths.mjs";
import { hasBlackEyesDarknessImmunity } from "../../rules/black-eyes.mjs";
import { isBraced } from "../../combat/brace-weapon.mjs";
import { lockingContactTokenDocs, coveringDefendersOf } from "../../combat/free-attack.mjs";
import { hasQuietElimination, isQuietEliminationWeapon } from "../../rules/quiet-elimination.mjs";
import { legacyHistoryIs, legacyChangeTestBonus, bloodthirstyLegacyMeleeActive, takenMutationNames, DISTRACTING_LEGACY_FLAG, adaptiveLegacyMeleeWsBonus, adaptiveLegacyDefenderPenalty, punisherLegacyBonus, legacySlaughterThresholdDelta, patienceLegacyOverwatchBonus, patienceLegacyMeleeChargeInterruptActive } from "../../rules/legacy-weapon.mjs";
import { isNearestUndamagedEnemy } from "../../combat/legacy-weapon-mutations.mjs";
import { isActorsOwnTurn } from "../../combat/delay-action.mjs";
import { meleeEffectiveRange, parseGrips } from "../../constants/combat.mjs";
import { longerWeaponBonus, closeQuartersPenalty, closeQuartersRange } from "../../rules/weapon-length.mjs";
import { getHeldHand, weaponHandsRequired } from "../../rules/hands.mjs";
import { BODY_SIDES, fingersLostOn } from "../../rules/limb-loss.mjs";
import { longRangeImmunityReason } from "../../rules/range-penalty-immunity.mjs";
import { lightPenaltyImmunityReason, smokePenaltyImmunityReason } from "../../rules/vision-penalty-immunity.mjs";
import { getInstalledMods } from "../../combat/weapon-mods.mjs";

/**
 * Атака оружием в руке без пальцев (мутация Потеря Конечности, субмутации
 * 1/6): рука назначена кнопкой Л/П — она; двуручное — любая из двух; без
 * назначенной руки у одноручного сторона неизвестна — штрафа нет.
 */
export function fingersPenalty(actor, weapon) {
  if (!weapon) return false;
  const side = getHeldHand(weapon);
  if (side) return fingersLostOn(actor?.system, side);
  if (weaponHandsRequired(weapon, actor) >= 2) return BODY_SIDES.some(s => fingersLostOn(actor?.system, s));
  return false;
}
/**
 * @param {object} v состояние броска: оружие, токены, замеренная дистанция
 * @returns {{commonMods: object[], specificMods: object[], charSwapWhy: string[], bandKey: string|null}}
 */
export function situationalMods(v) {
  const {
    actor,
    attackCtx,
    attackerToken,
    gripRange,
    hasFatigue,
    hasLostEyes,
    isBlinded,
    isMelee,
    measured,
    targetHelpless,
    targetToken,
    weapon = null,
    wProps,
    wp,
    // Штраф за огринское оружие в чужих руках (rules/ogryn-fit.mjs) — число
    // со знаком минус или 0. Нужен, чтобы предложить его снять Закреплением.
    ogrynBracePenalty = 0,
  } = v;

  // Без Предупреждения, Оружие Наследия (wdbc-1rno.35, versatile 9-9, стр.
  // 428), второе предложение: «В первый Раунд боя оружие может атаковать
  // врагов, чья Инициатива вдвое ниже или меньше, как если бы они были
  // Застигнуты Врасплох» — синтетически ставит autoCheck на УЖЕ
  // существующую галочку «Цель Врасплох» (id: atk-mod-surprised, читается
  // ниже как opts.targetSurprised), а не заводит отдельный путь.
  const legacyForewarnedSurprise = (weapon && game.combat?.round === 1 && attackCtx.targetActor) ? (() => {
    if (!takenMutationNames(weapon).has("Без Предупреждения")) return false;
    const attackerCombatant = game.combat.combatants?.find(c => c.actorId === actor.id);
    const targetCombatant   = game.combat.combatants?.find(c => c.actorId === attackCtx.targetActor.id);
    const ai = attackerCombatant?.initiative, ti = targetCombatant?.initiative;
    return ai != null && ti != null && ai >= ti * 2;
  })() : false;

  // Борьба (стр. 12, wdbc-x1nz.2.74): «другие персонажи получают бонус +20 на
  // атаки по ним» — по любому из сцепившихся, кроме его же партнёра.
  const tgt = attackCtx?.targetActor ?? null;
  const tgtGrappled = !!tgt?.system?.conditions?.grappling;
  const tgtPartnerUuid = tgt?.getFlag?.("warhammer-dbc", "grapplePartnerUuid") ?? tgt?.flags?.["warhammer-dbc"]?.grapplePartnerUuid;
  const vsGrappled = tgtGrappled && tgtPartnerUuid !== actor?.uuid;
  // Те же условия, по которым окно атаки само даёт ±20 (attack-dialog.mjs,
  // proneMod/stunnedMod) — wdbc-x1nz.2.97 п.6.
  const tgtProneAuto   = !!tgt?.system?.conditions?.prone;
  // Антиприцел (Странная Неуязвимость, субмутация 11, wdbc-1rno.24): «Атаки,
  // что получают преимущества Прицеливания, автоматически промахиваются».
  const aimingOn = !!actor?.system?.aiming && actor.system.aiming !== "none";
  const tgtAntiAim = !!tgt && hasRuleFlag(tgt, "attack.antiAim");
  const tgtSurprisedRound1 = !!tgt?.system?.conditions?.surprised
    && (typeof game !== "undefined" ? game.combat?.round : null) === 1;
  const tgtStunnedAuto = isStunnedOrDazed(tgt);
  const commonMods = [
    ...(tgtAntiAim ? [{ label: "Антиприцел цели", value: 0, autofail: true, autoCheck: aimingOn,
      note: aimingOn ? "вы прицелились — атака автоматически промахивается (Странная Неуязвимость)"
                     : "атаки с Прицеливанием по этой цели автоматически промахиваются" }] : []),
    { label: "Усталость",     value: -10, autoCheck: hasFatigue },
    { label: "Цель в Борьбе (не ваш Захват)", value: 20, autoCheck: vsGrappled,
      note: vsGrappled ? "стр. 12: +20 на атаки по сцепившимся" : undefined },
    // visionPenalty (wdbc-1rno.1, Чёрные Глаза/Black Eyes, Cor 60+) — три
    // галочки ниже гасятся у АТАКУЮЩЕГО (не у цели, поэтому не immuneFlag —
    // тот гасит только возможности ЦЕЛИ, см. цикл ниже).
    // Слабый свет (стр. 34, wdbc-x1nz.2.46): штраф только стрелковой — у
    // рукопашной книжная таблица «Стандартные Модификаторы Атаки» даёт
    // пустую ячейку (0), в отличие от Дыма/Тьмы ниже, где штраф есть у обеих.
    { label: "Слабый свет",   value: isMelee ? 0 : -10, visionPenalty: "light" },
    { label: "Дым / туман",   value: isMelee ? -10 : -20, visionPenalty: "smoke" },
    { label: "Тьма",          value: isMelee ? -20 : -30, visionPenalty: "light" },
    // Ослеплён (wdbc-x1nz.2.89, решение владельца 4): при распознанном
    // Ослеплении (свой флаг/оба глаза/щит на голове, без Sonar Sense и
    // Unnatural Senses — rules/blindness.mjs) галочка заперта — автопровал BS
    // и −30 WS руками не снимаются. Без него — ручная, как раньше.
    { label: "Ослеплён",      value: isMelee ? -30 : -99, autofail: !isMelee, autoCheck: isBlinded, locked: isBlinded },
    // Потеря глаз (частичная): −10 на BS и «тесты определения расстояний»
    // (последнее не автоматизировано — нет отдельного типа теста «на глаз»)
    // — только стрелковая, книга не даёт штрафа рукопашной от неё отдельно.
    ...(isMelee ? [] : [{ label: "Потеря глаз", value: -10, autoCheck: hasLostEyes }]),
    // «Пальцы» мутации Потеря Конечности (wdbc-1rno.6.1, решение владельца
    // 24.09.2026): рука держит оружие, но атака им — −10.
    ...(fingersPenalty(actor, weapon) ? [{ label: "Нет пальцев (мутация)", value: -10, autoCheck: true }] : []),
    // «Цель лежит»/«Цель Оглушена» (wdbc-x1nz.2.97 п.6): распознанное
    // Состояние цели уже дало свои ±20 автоматически (attack-dialog.mjs,
    // proneMod/stunnedMod). Тогда ручная галочка отмечена, заперта и стоит
    // 0 — один источник бонуса, а не два; без распознанного Состояния она
    // ручная, как раньше (цель без листа, лежит «по сюжету»).
    tgtProneAuto
      ? { label: "Цель лежит", value: 0, autoCheck: true, locked: true,
          note: `Цель Повалена — ${isMelee ? "+20" : "−20"} учтено автоматически` }
      : { label: "Цель лежит", value: isMelee ?  20 : -20 },
    { label: "Цель бежит",    value: isMelee ?  20 : -20 },
    tgtStunnedAuto
      ? { label: "Цель Оглушена", value: 0, autoCheck: true, locked: true,
          note: "Оглушение/Ступор цели — +20 учтено автоматически" }
      : { label: "Цель Оглушена", value: 20 },
    // id нужен readAttackForm (wdbc-1rno.3, стр. 32 «Скрытная Атака»):
    // «Взятие Врасплох» читается как именованный флаг attack.mjs::
    // targetSurprised (Quiet Elimination: +1 куб урона/тихая смерть ПО
    // ЛЮБОЙ атаке, отмеченной Врасплох, не только ножом/пистолетом — см.
    // rules/quiet-elimination.mjs), а не только суммируется в общий Порог.
    // Состояние «Врасплох» цели в 1-м Раунде (стр. 12: «Застигнутые Врасплох…
    // В первый Раунд любая атака по ним получает бонус +30», wdbc-1rno.3.1) —
    // галочка ставится сама, снимается рукой.
    { id: "atk-mod-surprised", label: "Цель Врасплох", value: 30, immuneFlag: "attack.surpriseImmune",
      autoCheck: legacyForewarnedSurprise || tgtSurprisedRound1,
      ...(legacyForewarnedSurprise ? { note: "Без Предупреждения: Инициатива цели вдвое ниже, 1-й Раунд" }
        : tgtSurprisedRound1 ? { note: "цель Застигнута Врасплох, 1-й Раунд (стр. 12)" } : {}) },
    // id нужен readAttackForm (стр. 12, wdbc-x1nz.2.29): «Избегание невозможно
    // от атаки, о которой цель не знает» — атакующий сам объявляет это
    // галочкой (со спины/из засады/невидимый-неслышный снаряд книга не даёт
    // теста на автоопределение), а не только получает +30 к попаданию.
    // Без +30 (решение владельца 26.09.2026, wdbc-1rno.3.1): стр. 12 даёт тут
    // только «Избегание невозможно», +30 — это «Цель Врасплох» выше; вместе
    // они давали +60 за одно книжное правило.
    { id: "atk-mod-hidden", label: "Скрытая атака", value: 0, note: "цель не знает — Избегание невозможно" },
    // Тихое Устранение / Quiet Elimination (стр. …, wdbc-1rno.3): «нож или
    // игольчатый/осколочный пистолет — +10 к тестам атаки», независимо от
    // Врасплох — авто-галочка, вычисляется прямо здесь (actor/weapon уже в
    // области видимости, тот же приём, что у hasBlackEyesDarknessImmunity
    // ниже).
    ...(hasQuietElimination(actor) && weapon && isQuietEliminationWeapon(weapon) ? [{
      label: "Тихое Устранение (нож/игольчатый/осколочный пистолет)", value: 10, autoCheck: true
    }] : []),
    // Наследие Ярости/Rage, Оружие Наследия, рукопашная ветка (wdbc-1rno.35,
    // стр. 427): «+10 к атакам ЭТИМ оружием» — весь бой, не только Натиск,
    // поэтому auto, не отдельная ситуативная галочка.
    ...(isMelee && weapon && legacyHistoryIs(weapon, "Наследие Ярости") ? [{
      label: "Наследие Ярости (История): +10 этим оружием", value: 10, autoCheck: true
    }] : []),
    // Единство/versatile 3-4, Оружие Наследия (wdbc-1rno.35, стр. 428): «Все
    // тесты WS и BS этим оружием +5.» Второе предложение («штраф с внешних
    // факторов не хуже −10») честно НЕ реализовано — нужно клампить итоговую
    // сумму всех прочих модификаторов диалога, посчитанную ПОСЛЕ этого
    // списка, не однострочная правка внутри самого списка галочек.
    ...(weapon && takenMutationNames(weapon).has("Единство") ? [{
      label: "Единство (Мутация): +5 этим оружием", value: 5, autoCheck: true
    }] : []),
    // Адаптивное/versatile 8-8, рукопашная (wdbc-1rno.35, стр. 428): «когда
    // перевес 2к1 — ещё и +10 на тесты WS». +1 Dmg того же условия — в
    // combat/attack.mjs::adaptiveLegacyMeleeDamageBonus (flatBonus, не мод
    // диалога — Dmg туда не попадает).
    ...(weapon && takenMutationNames(weapon).has("Адаптивное") ? (() => {
      const wsBonus = adaptiveLegacyMeleeWsBonus({ weapon, attackerContactCount });
      return wsBonus ? [{
        label: "Адаптивное (Мутация): +10 WS — перевес 2к1", value: wsBonus, autoCheck: true,
        note: `врагов у атакующего в контакте: ${attackerContactCount}`
      }] : [];
    })() : []),
    // Наследие Крови, Оружие Наследия (wdbc-1rno.35, История 8, стр. 427):
    // «+10 на попадание по Псайкерам» — тот же признак system.isPsyker, что
    // talent-targets.mjs::psyker.test.
    ...(weapon && legacyHistoryIs(weapon, "Наследие Крови") && attackCtx.targetActor?.system?.isPsyker ? [{
      label: "Наследие Крови: +10 по Псайкеру", value: 10, autoCheck: true
    }] : []),
    // Наследие Перемен, Оружие Наследия (wdbc-1rno.35, История 9, стр. 427):
    // «2d5 в начале Хода — бонус ко всем тестам WS/BS этим оружием до
    // следующего Хода» — бросок и хранение уже сделаны на старте Хода
    // (combat/action-economy.mjs::resetActionEconomy), здесь только чтение
    // готового флага. 0 не показываем — нечего галочкой подтверждать.
    ...(weapon ? (() => {
      const v = legacyChangeTestBonus(actor, weapon);
      return v ? [{ label: `Наследие Перемен: ${v >= 0 ? "+" : ""}${v} (бросок этого Хода)`, value: v, autoCheck: true }] : [];
    })() : []),
    // Наследие Бойни (H1, стр. 426), стрелковая ветка: +20 к следующей атаке
    // после убийства этим оружием — флэт, без Приёмов (те — только
    // рукопашные). Рукопашная ветка (включая −30 на Оглушить) уже сложена в
    // sheets/attack/selection.mjs::maneuverBon, здесь она бы задвоилась.
    ...(!isMelee && weapon ? (() => {
      const v = legacySlaughterThresholdDelta(actor, weapon);
      return v ? [{ label: `Наследие Бойни (История): +${v} — заряжено убийством этим оружием`, value: v, autoCheck: true }] : [];
    })() : []),
    // Терпение/vigilant 3-4, Оружие Наследия, стрелковая ветка (wdbc-1rno.35/
    // wdbc-1rno.41, стр. 427-428): «+30 на выстрелы в Карауле» — заряжено
    // combat/overwatch.mjs при клике режима огня, гасится в attack.mjs на
    // фактическом броске (тот же приём, что hairTriggerUnseenPending).
    ...(!isMelee && weapon ? (() => {
      const v = patienceLegacyOverwatchBonus(actor);
      return v ? [{ label: `Терпение (Мутация): +${v} — выстрел из Караула`, value: v, autoCheck: true }] : [];
    })() : []),
    // Терпение, рукопашная половина (wdbc-1rno.41, стр. 427): «атакует
    // Задержкой идущего в Натиск противника — всегда первым, +30». Детект —
    // решение пользователя 21.09.2026: банкованное 1 ОД (Задержка) + цель в
    // Натиске (rules/legacy-weapon.mjs::patienceLegacyMeleeChargeInterruptActive,
    // не может сама проверить «не свой Ход» — цикл через action-economy.mjs,
    // см. комментарий там), плюс !isActorsOwnTurn здесь.
    ...(isMelee && weapon && attackCtx.targetActor && !isActorsOwnTurn(actor)
      && patienceLegacyMeleeChargeInterruptActive({ actor, weapon, defenderActor: attackCtx.targetActor })
      ? [{ label: "Терпение (Мутация): +30 — атака Задержкой по идущему в Натиск, действует первым", value: 30, autoCheck: true }]
      : []),
    // Каратель/merciless 8-8, Оружие Наследия (wdbc-1rno.35, стр. 428): «+3
    // накопительно на попадание по НЕЙ до конца боя» — счётчик живёт на
    // цели, ключ id ЭТОГО оружия (rules/legacy-weapon.mjs::punisherLegacyBonus).
    ...(weapon && attackCtx.targetActor ? (() => {
      const v = punisherLegacyBonus(attackCtx.targetActor, weapon);
      return v ? [{ label: `Каратель (Мутация): +${v} — накоплено по этой цели`, value: v, autoCheck: true }] : [];
    })() : []),
    // Отвлекающее/skilled 3-4, Оружие Наследия, стрелковая ветка (wdbc-1rno.35,
    // стр. 427-428): «Все остальные персонажи +10 по цели, в которую попало
    // это оружие» — метка живёт на ЦЕЛИ, не привязана к атакующему оружию.
    ...(attackCtx.targetActor?.getFlag?.("warhammer-dbc", DISTRACTING_LEGACY_FLAG) ? [{
      label: "Отвлекающее (Мутация): +10 — цель отмечена", value: 10, autoCheck: true
    }] : []),
    // Кровожадное/fearsome 1-2, Оружие Наследия (wdbc-1rno.35, стр. 427).
    // Рукопашная: «+20, когда совершал Натиск» (весь Ход, system.meleeBase).
    ...(weapon && bloodthirstyLegacyMeleeActive(actor, weapon) ? [{
      label: "Кровожадное (Мутация): +20 — совершал Натиск", value: 20, autoCheck: true
    }] : []),
    // Кровожадное, стрелковая ветка: «+20 по ближайшей неповреждённой цели».
    ...(!isMelee && weapon && weapon.system?.weaponClass !== "melee" && takenMutationNames(weapon).has("Кровожадное")
      && attackerToken && isNearestUndamagedEnemy({ attackerToken, targetToken }) ? [{
      label: "Кровожадное (Мутация): +20 — ближайшая неповреждённая цель", value: 20, autoCheck: true
    }] : []),
    // Закрепление (Полудействие, Физическое: оружие ставится на укрытие,
    // лафет, бипод или трипод). Книга свойства Ogrynized: «Закрепление оружия
    // убирает все эти штрафы». Отдельного состояния «закреплено» в системе
    // нет — Закрепление и для тяжёлого оружия живёт галочкой этого списка, —
    // поэтому здесь оно тоже галочка, и она РОВНО компенсирует уже посчитанный
    // штраф, каким бы он ни сложился (−10, −20 или −30).
    ...(ogrynBracePenalty ? [{
      label: "Огринское оружие Закреплено",
      value: -ogrynBracePenalty,
      note: "полудействие: на укрытие/лафет/бипод — снимает штрафы за Размер, Силу и форму рук"
    }] : [])
  ];
  // Возможности ЦЕЛИ, гасящие модификатор атакующего (Мир смерти, «Паранойя
  // Выжившего»: по нему не работает бонус за Неожиданность). Цель — тот же
  // attackCtx.targetActor, что и у правил; нет цели — нечего гасить.
  for (const m of commonMods) {
    if (!m.immuneFlag || !attackCtx.targetActor) continue;
    // Контекст не передаём: он описывает бросок АТАКУЮЩЕГО, а спрашиваем мы
    // возможность цели — правило цели про чужое оружие ничего не знает.
    const why = ruleFlagLabels(attackCtx.targetActor, m.immuneFlag);
    if (!why.length) continue;
    m.value  = 0;
    m.immune = true;
    m.note   = `${attackCtx.targetActor.name}: ${why[0]}`;
  }
  // Чёрные Глаза / Black Eyes (wdbc-1rno.1, rules/black-eyes.mjs): Cor 60+ —
  // АТАКУЮЩИЙ видит сквозь дым/тьму/слабый свет, штрафы гасятся у него
  // самого (в отличие от immuneFlag выше, который гасит возможности ЦЕЛИ).
  if (hasBlackEyesDarknessImmunity(actor)) {
    for (const m of commonMods) {
      if (!m.visionPenalty) continue;
      m.value  = 0;
      m.immune = true;
      m.note   = "Чёрные Глаза: видит сквозь тьму/дым/слабый свет (Cor 60+)";
    }
  }
  // Ночное Зрение, Охотничий Визор, Термальный и Джинн-Прицел (wdbc-1rno.36,
  // rules/vision-penalty-immunity.mjs) — тем же приёмом, что Чёрные Глаза:
  // Слабый свет/Тьма и Дым гасятся раздельно.
  {
    const mods = weapon ? getInstalledMods(actor, weapon) : [];
    const aiming = actor?.system?.aiming;
    const why = {
      light: lightPenaltyImmunityReason(actor, mods, { aiming }),
      smoke: smokePenaltyImmunityReason(actor, mods, { aiming })
    };
    for (const m of commonMods) {
      const reason = m.visionPenalty && !m.immune ? why[m.visionPenalty] : null;
      if (!reason) continue;
      m.value  = 0;
      m.immune = true;
      m.note   = `${reason}: штрафа нет`;
    }
  }
  // Aspect (wdbc-8b5/wdbc-28ld, стр. 168): без соответствующего Пути — −30 на
  // тесты использования. wProps хранит текст рейтинга (не число, см. aspect
  // в constants/weapon-properties.mjs — rating:true, ratingText:true).
  // Галочка, не auto: R3-модификация оружия снимает штраф для не-Асуриан/
  // Иннари, а отдельного реестра «установленных модификаций» под этот
  // конкретный случай в системе нет (weaponMod — свободные предметы ГМа) —
  // проще снять галочку руками, чем заводить новый распознаваемый эффект.
  const aspectText = wProps.find(p => p.key === "aspect")?.rating;
  if (aspectText) {
    const hasPath = actorHasAspectPath(actor.system, aspectText);
    commonMods.push({
      label: `Аспект: нет Пути «${aspectText}»`, value: -30,
      autoCheck: !hasPath,
      note: hasPath ? "Путь есть — снимите галочку" : "снимите галочку, если на оружии стоит модификация R3"
    });
  }
  // Зенитное (wdbc-z56a, стр. 166): «игнорирует все штрафы на попадание за
  // скорость цели, вроде –20 за Бег» — гасит именно эту строку, не отдельный
  // штраф (в диалоге атаки его отдельно и не было, штрафа скорости цели вне
  // «Цель бежит» книга не даёт числом).
  if (!isMelee && wp.antiAir) {
    const runMod = commonMods.find(m => m.label === "Цель бежит");
    if (runMod && !runMod.immune) {
      runMod.value = 0;
      runMod.immune = true;
      runMod.note = "Зенитное: игнорирует штраф скорости цели";
    }
  }
  const charSwapWhy  = ruleFlagLabels(actor, "charSwap.wp.forWsS", attackCtx);
  const twoWeaponWhy = ruleFlagLabels(actor, "penalty.twoWeapon.off", attackCtx);
  const twoWeaponOff  = twoWeaponWhy.length > 0;
  // Дуэлянтское (стр. 73 Книги Аэльдари): бой 1-на-1, когда никто не мешает,
  // — +5 на все тесты с оружием. Считаем реальные контакты на карте
  // (meleeContactCount), а не спрашиваем игрока на глаз — галочка лишь
  // подтверждает то, что уже видно на сцене, и её можно снять руками.
  const duelContacts = (wp.duelingParry && attackerToken) ? meleeContactCount(attackerToken) : null;
  // Числовой перевес (2к1/3к1): та же meleeContactCount, но ОБРАТНЫЙ обход —
  // считаем не врагов у атакующего, а «врагов цели» (т.е. атакующего и его
  // союзников) в контакте с целью (wdbc-5il7, п.5).
  const outnumberCount = (isMelee && targetToken) ? meleeContactCount(targetToken) : null;
  // Адаптивное/versatile 8-8, Оружие Наследия (wdbc-1rno.35, стр. 428): та же
  // meleeContactCount, но от АТАКУЮЩЕГО — «противник имеет численный перевес
  // [над атакующим]», не над целью (outnumberCount выше — другое направление).
  const attackerContactCount = (isMelee && attackerToken) ? meleeContactCount(attackerToken) : null;
  // Тактическая карта: полоса дальности из уже измеренной дистанции и Rng
  // оружия (стр. 40: в упор 0,5–3 м / короткая до Rng/2 / боевая до Rng /
  // дальняя до Rng×2 / экстремальная до Rng×3, дальше выстрел невозможен).
  // Автоотметка ровно одной галочки — все они по-прежнему снимаются руками,
  // ГМ-клапан сохраняется. За 3×Rng — видимый warning у измеренной дистанции.
  const bandKey  = (!isMelee && measured) ? rangeBandKey(measured.edgeM, gripRange) : null;
  const bandNote = k => (bandKey === k ? `по измеренной дистанции ${measured.edgeM} м` : undefined);
  // «Положение выше» (+10): сравнение elevation токенов атакующего и цели.
  const highGround = (isMelee && measured) ? hasHighGround(attackerToken, targetToken) : null;
  // Полёт (стр. 30, wdbc-x1nz.2): высота ЦЕЛИ решает разрешён ли контакт —
  // Низкая недосягаема рукопашной (но не стрелковым, там штраф −10 вместо
  // блока), Высокая недосягаема стрелковым вовсе без Зенитного, рукопашной —
  // всегда. Атакующий на ТОЙ ЖЕ высоте снимает оба правила целиком (бой
  // на равной высоте — книга не даёт для него ни штрафа, ни блока).
  const targetAltitude   = attackCtx.targetActor?.system?.movement?.altitude;
  const attackerAltitude = actor?.system?.movement?.altitude;
  const sameAltitude = attackerAltitude != null && attackerAltitude === targetAltitude;
  const targetAtLow  = targetAltitude === "low"  && !sameAltitude;
  const targetAtHigh = targetAltitude === "high" && !sameAltitude;
  // «Трудный ландшафт» в рукопашной: зона Трудного Ландшафта под атакующим.
  // Зона «очень трудный» не различает — автоотмечаем обычный (−10), сильнее руками.
  const meleeTerrain = (isMelee && attackerToken)
    ? getTerrainInfoForToken(attackerToken.document ?? attackerToken) : null;
  // Связан в Рукопашной (стр. 30, wdbc-x1nz.2.64): стрелок сам заперт врагом
  // с рукопашным оружием/Пистолетом в Базовом/Глубоком контакте — «не может
  // стрелять в цели ВНЕ рукопашной». Геометрия та же, что у Свободной Атаки.
  const lockedByEnemies = (!isMelee && attackerToken)
    ? lockingContactTokenDocs(attackerToken.document ?? attackerToken) : [];
  const inContactWithTarget = !!measured?.contact && measured.contact !== "none";
  // Стрельба ПО цели, которая сама Связана в Рукопашной с кем-то ТРЕТЬИМ (не
  // самим стрелком — тот случай уже покрыт «Стрельба в рукопашную» ниже, со
  // своим исключением для Пистолета) — отдельный штраф −20 без исключений.
  const targetLocked = (!isMelee && targetToken && !inContactWithTarget)
    ? lockingContactTokenDocs(targetToken.document ?? targetToken).length > 0 : false;
  // Длина Оружия (wdbc-x1nz.2.67, стр. 39): действующий Rng атакующего
  // оружия на основной Хват, Приём «Стандартная» — этот список галочек
  // считается один раз ДО того, как игрок переключает пилюли Хвата/Приёма
  // в этом же окне, поэтому автогалочки ниже — подсказка по базовой связке
  // оружия, а не гарантированно точное число после Выпада/другого Хвата;
  // как и остальные автогалочки этого файла, их можно поправить руками.
  const meleeAttackerRange = (isMelee && weapon)
    ? meleeEffectiveRange(weapon.system?.range, parseGrips(weapon.system?.grips)[0] ?? null, "standard", false,
        Math.max(0, Number(actor?.system?.size) || 0))
    : 0;
  const longerWeaponAuto  = isMelee ? longerWeaponBonus(meleeAttackerRange, attackCtx.targetActor) : false;
  const closeQuartersAuto = (isMelee && inContactWithTarget && weapon) ? closeQuartersPenalty(closeQuartersRange(weapon.system)) : 0;
  // Прикрывающая Стойка (стр. 15, wdbc-x1nz.2.66.7): −20 рукопашным атакам
  // по союзникам, стоящим в Базовом/Глубоком контакте с персонажем в этой
  // Стойке — то же соседство, что Свободная Атака/Связан в Рукопашной
  // (module/combat/free-attack.mjs::coveringDefendersOf).
  const coveringDefenders = (isMelee && targetToken)
    ? coveringDefendersOf(targetToken.document ?? targetToken) : [];
  const specificMods = isMelee ? [
    ...(coveringDefenders.length ? [{
      label: "Прикрывающая Стойка союзника рядом", value: -20, autoCheck: true,
      note: `${coveringDefenders.map(d => d.name).join(", ")} прикрывает цель (стр. 15)`
    }] : []),
    { label: "Трудный ландшафт",       value: -10, autoCheck: !!meleeTerrain?.inTerrain,
      note: meleeTerrain?.inTerrain ? "зона Трудного Ландшафта под атакующим" : undefined },
    { label: "Очень трудный ландшафт", value: -20 },
    { label: "Числ. перевес 2к1",      value:  10, autoCheck: outnumberCount === 2,
      note: outnumberCount == null ? undefined : `в контакте с целью: ${outnumberCount}` },
    { label: "Числ. перевес 3к1",      value:  20, autoCheck: outnumberCount != null && outnumberCount >= 3,
      note: outnumberCount == null ? undefined : `в контакте с целью: ${outnumberCount}` },
    // Адаптивное у ЦЕЛИ, третья ступень (стр. 428, wdbc-bjy1.13): «когда 3к1 —
    // враги получают −10 на рукопашные атаки по персонажу».
    ...(adaptiveLegacyDefenderPenalty({ targetActor: attackCtx.targetActor, targetContactCount: outnumberCount, isMelee }) ? [{
      label: "Адаптивное у цели: −10 — перевес 3к1", value: -10, autoCheck: true,
      note: `в контакте с целью: ${outnumberCount}`
    }] : []),
    { label: "Положение выше",         value:  10, autoCheck: highGround === true,
      note: highGround === true ? "elevation токена выше цели" : undefined },
    // Полёт (стр. 30, wdbc-x1nz.2): Низкая/Высокая — «вне досягаемости
    // рукопашных атак наземных персонажей» — не штраф, а полный блок.
    // Приземная сюда не попадает (targetAtLow/targetAtHigh уже false) —
    // книга прямо говорит «без всяких ограничений».
    { label: "Цель в полёте (Низкая/Высокая) — рукопашная недосягаема",
      value: 0, autofail: true, autoCheck: targetAtLow || targetAtHigh,
      note: (targetAtLow || targetAtHigh) ? `цель на высоте «${targetAltitude}» (стр. 30)` : undefined },
    { label: "Более длинное оружие",   value:   5, autoCheck: longerWeaponAuto,
      note: longerWeaponAuto ? `Rng ${meleeAttackerRange} длиннее макс. оружия цели (Длина Оружия, стр. 39)` : undefined },
    ...(closeQuartersAuto < 0 ? [{
      label: "Слишком длинное оружие вблизи", value: closeQuartersAuto, autoCheck: true,
      note: `Rng ${meleeAttackerRange} в Базовом контакте — −5 за каждый пункт выше 5 (Длина Оружия, стр. 39)`
    }] : []),
    ...(wp.duelingParry ? [{
      label: "Дуэлянтское: бой 1-на-1 (никто не мешает)", value: 5,
      autoCheck: duelContacts === 1,
      note: duelContacts === null ? "нет токена атакующего — отметьте вручную"
          : `врагов в контакте: ${duelContacts}; Финт/Давление в такой дуэли — с Преимуществом (отметьте на кубике)`
    }] : []),
    // Локус Быстроты (стр. 29) снимает этот штраф. Строку не прячем, а обнуляем
    // с подписью: игрок должен видеть, ЧТО его сняло, иначе исчезнувшая галочка
    // выглядит как баг диалога.
    twoWeaponOff
      ? { label: "Бой несколькими руками", value: 0,
          note: `штраф снят: ${twoWeaponWhy.join(", ")}` }
      : { label: "Бой несколькими руками", value: -20, note: "осн./неосн. рука" }
  ] : [
    // Стр. 33: Подавленный персонаж в укрытии получает −20 ко всем тестам BS.
    // «В укрытии относительно источника» не проверяем (ситуативно) — авто-
    // отмечаем по самому факту Подавления, галочку можно снять руками.
    { label: "Подавлен огнём", value: -20, autoCheck: !!actor.system.conditions?.pinned },
    // id нужен readAttackForm — Карабин (wdbc-z56a) читает именно этот флаг,
    // чтобы решить, дать ли цели в рукопашной +30 или +10 на Уклонение.
    // Пистолет (стр. 40, wdbc-x1nz.2.57): «может использоваться для стрельбы
    // в ближнем бою без каких-либо штрафов» — ни этого штрафа, ни бонуса
    // Уклонения цели (тот гасится отдельно, attack.mjs::meleeShotDodgeBonus).
    { id: "atk-melee-shot", label: "Стрельба в рукопашную",
      value: weapon?.system?.weaponClass === "pistol" ? 0 : -20,
      note: weapon?.system?.weaponClass === "pistol" ? "Пистолет: без штрафов в рукопашную" : undefined },
    // Связан в Рукопашной (стр. 30, wdbc-x1nz.2.64): полный запрет стрелять в
    // цели ВНЕ рукопашной, если стрелок сам заперт врагом с рукопашным
    // оружием/Пистолетом в контакте. Тот же autofail-приём, что у «Тяжёлое/
    // Длинная Винтовка» ниже — галочка есть всегда, бьёт (autoCheck) только
    // когда стрелок реально заперт и целится МИМО своей рукопашной.
    { label: "Связан в Рукопашной: нельзя стрелять вне рукопашной",
      value: 0,
      autofail: lockedByEnemies.length > 0,
      immune: lockedByEnemies.length === 0,
      autoCheck: lockedByEnemies.length > 0 && !inContactWithTarget,
      note: lockedByEnemies.length > 0
        ? `в контакте с врагом (рукопашное/Пистолет): ${lockedByEnemies.map(d => d.name).join(", ")} (стр. 30)`
        : undefined },
    // Стрельба ПО цели в рукопашной с ТРЕТЬИМ лицом (стр. 30) — отдельно от
    // «Стрельба в рукопашную» выше (та про самого стрелка, с исключением для
    // Пистолета): здесь исключения нет, стрелок сам не в этой рукопашной.
    { label: "Цель связана в рукопашной (с другим персонажем)", value: -20,
      autoCheck: targetLocked,
      note: targetLocked ? "стр. 30 — штраф без исключений, даже Пистолету" : undefined },
    // Тяжёлое оружие и Длинная Винтовка (стр. 40, wdbc-x1nz.2.57): «не может
    // использоваться для стрельбы в ближнем бою» вовсе — в отличие от
    // Пистолета/Винтовки выше, это не штраф, а полный запрет самого выстрела
    // по цели, с которой стрелок в контакте Баз. Тот же приём autofail, что
    // у «Высокая высота цели» ниже: галочка есть всегда, но реально бьёт
    // (autoCheck) только когда выстрел ДЕЙСТВИТЕЛЬНО идёт в рукопашную —
    // wp.noMeleeFire — Длинная Винтовка (constants/weapon-properties.mjs),
    // weaponClass "heavy" гейтится напрямую, без отдельного флага в паке.
    { label: "Тяжёлое/Длинная Винтовка: нельзя стрелять в рукопашную",
      value: 0,
      autofail: weapon?.system?.weaponClass === "heavy" || !!wp.noMeleeFire,
      immune: !(weapon?.system?.weaponClass === "heavy" || !!wp.noMeleeFire),
      autoCheck: !!measured?.contact && measured.contact !== "none",
      note: (weapon?.system?.weaponClass === "heavy" || !!wp.noMeleeFire)
        ? "класс оружия не допускает стрельбу в ближнем бою (стр. 40)" : undefined },
    // Стр. 40: «Стрельба в ближнем бою считается дистанцией в упор, но имеет
    // модификатор на попадание +0, как будто это боевая дистанция» — контакт
    // Баз (measured.contact, tactical-map.mjs::measureTokens) уже даёт
    // расстояние в диапазоне «в упор» (0–3м), поэтому геометрия сама
    // отличает «просто стреляю с 1м, никого не трогая» (честные +30) от
    // «стреляю в того, с кем сцепился врукопашную» (книжные +0).
    { label: "Дистанция в упор",
      value: (!!measured?.contact && measured.contact !== "none") ? 0 : 30,
      autoCheck: bandKey === "pointBlank",
      note: (!!measured?.contact && measured.contact !== "none")
        ? "стрельба в ближнем бою — как боевая дистанция (стр. 40)"
        : bandNote("pointBlank") },
    { label: "Короткая дистанция",      value:  10, autoCheck: bandKey === "short",      note: bandNote("short") },
    { label: "Боевая дистанция",        value:   0, autoCheck: bandKey === "combat",     note: bandNote("combat") },
    { label: "Дальняя дистанция",       value: -10, autoCheck: bandKey === "long",       note: bandNote("long") },
    { label: "Экстремальная дистанция", value: -30, autoCheck: bandKey === "extreme",    note: bandNote("extreme") },
    // Беспомощная цель, выстрел в упор/в рукопашной: как рукопашная — авто-
    // успех и удвоенный урон, а не просто +30 (см. targetHelpless выше).
    // wdbc-x1nz.2.88 п.2: отмечается сама по той же замеренной дистанции, что
    // «Дистанция в упор» (bandKey pointBlank), и по контакту Баз — стрельба
    // в рукопашной. Без токенов/замера — ручная, как раньше.
    ...(targetHelpless ? (() => {
      const closeAuto = bandKey === "pointBlank" || (!!measured?.contact && measured.contact !== "none");
      return [{
        id: "atk-helpless-close", label: "Беспомощная цель: в упор / в рукопашной",
        value: 0, autosuccess: true, autoCheck: closeAuto,
        note: closeAuto
          ? "дистанция в упор / в рукопашной — авто-успех и ×2 урона вместо +30"
          : "заменяет +30 на авто-успех и ×2 урона"
      }];
    })() : []),
    // ── Ситуативные штрафы боя (wdbc-z56a, стр. 32/166): теснота/высота-
    // скорость цели/нестабильная платформа — раньше в диалоге не существовали
    // вовсе, поэтому Anti-Air/Gyro-Stabilized нечего было гасить. ──────────
    // Высота цели (стр. 32): Низкая –10 к попаданию, Высокая — попасть в
    // принципе нельзя без Зенитного (не просто штраф, отсюда autofail, как у
    // «Ослеплён» выше), Зенитное снимает оба штрафа целиком.
    { label: "Низкая высота цели",  value: wp.antiAir ? 0 : -10, immune: wp.antiAir,
      autoCheck: targetAtLow,
      note: wp.antiAir ? "снято: Зенитное" : (targetAtLow ? "цель на Низкой высоте (полёт)" : undefined) },
    { label: "Высокая высота цели", value: 0, autofail: !wp.antiAir, immune: wp.antiAir,
      autoCheck: targetAtHigh,
      note: wp.antiAir ? "снято: Зенитное" : (targetAtHigh ? "без Зенитного попасть в принципе нельзя" : undefined) },
    // Тяжёлое оружие (стр. 40): –30 без Закрепления, ещё –10 если стрелок
    // Двигался в этот Ход — Гиро-Стабилизированное снижает первое до –10 и
    // полностью снимает второе (стр. 168). Закрепление (стр. 35, wdbc-x1nz.2.56)
    // теперь настоящее Действие с состоянием (combat/brace-weapon.mjs) —
    // галочка сама снимается, пока оружие реально Закреплено этим же токеном.
    { label: "Тяжёлое оружие: без Закрепления", value: wp.gyroStabilized ? -10 : -30,
      autoCheck: weapon?.system?.weaponClass === "heavy" && !isBraced(actor, weapon),
      note: wp.gyroStabilized ? "Гиро-стаб.: –30 снижено до –10"
          : (weapon?.system?.weaponClass === "heavy" && isBraced(actor, weapon) ? "Закреплено" : undefined) },
    { label: "Тяжёлое оружие: стрельба на ходу", value: wp.gyroStabilized ? 0 : -10, immune: wp.gyroStabilized,
      note: wp.gyroStabilized ? "снято: Гиро-стаб." : undefined }
  ];

  // Низкая высота цели (wdbc-1rno.29): Прицел на Упреждение («следующий
  // выстрел игнорировал все штрафы… за скорость цели, высоту», стр. 62) и
  // Предсказатель Движения при Прицеливании («игнорирует штрафы за скорость
  // и высоту цели», стр. 171; то же поле aimIgnoresRunning — книга даёт обе
  // половины одной фразой) снимают −10. Запрет «Высокая высота» они НЕ
  // снимают — это не штраф (вопрос владельцу в тикете).
  if (!isMelee) {
    const aiming = actor?.system?.aiming;
    const tracking = !!(actor?.getFlag?.("warhammer-dbc", "trackingAimActive")
      ?? actor?.flags?.["warhammer-dbc"]?.trackingAimActive);
    const predictor = !!aiming && aiming !== "none" && weapon
      && getInstalledMods(actor, weapon).some(m => !!m.system?.effects?.aimIgnoresRunning);
    const why = tracking ? "Прицел на Упреждение" : predictor ? "Предсказатель Движения" : null;
    const row = why && specificMods.find(m => m.label === "Низкая высота цели" && !m.immune);
    if (row) { row.value = 0; row.immune = true; row.note = `снято: ${why}`; }
  }
  // Дальняя/экстремальная дистанция (wdbc-1rno.31): Снайпер, Холодные Глаза
  // и оптические прицелы при Прицеливании снимают оба штрафа — тем же
  // приёмом, что Зенитное гасит «Цель бежит» (выше).
  if (!isMelee) {
    const why = longRangeImmunityReason(actor, weapon ? getInstalledMods(actor, weapon) : [],
                                        { aiming: actor?.system?.aiming });
    if (why) {
      for (const m of specificMods) {
        if ((m.label === "Дальняя дистанция" || m.label === "Экстремальная дистанция") && !m.immune) {
          m.value = 0;
          m.immune = true;
          m.note = `${why}: нет штрафа дальней/экстремальной дистанции`;
        }
      }
    }
  }
  return { bandKey, charSwapWhy, commonMods, specificMods };
}
