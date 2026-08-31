// module/sheets/attack-dialog.mjs
//
// Диалог атаки: собирает выбор игрока — режим огня, прицеливание, ситуативные
// модификаторы, условные эффекты боеприпаса и галочки правил — в один порог
// теста и отдаёт его конвейеру броска (module/combat/attack.mjs).
//
// Сам диалог ничего не решает про урон и попадание: он показывает, из чего
// сложился порог, и следит, чтобы показанное число совпадало с брошенным.
// Функции принимают актора, а не лист, поэтому проверяются без Foundry.
//
// Стойка/База/Приём/Хват/Профиль выбираются прямо в этом окне пилюлями (HUD
// хранит лишь стартовые значения, стр. 14-15, 39, 207-221) — Хват и Профиль
// пишутся во флаги предмета, Стойка/База персистентны на акторе, Приём живёт
// один бросок. Доступность каждой группы пересчитывается заново при смене
// любой другой (Приём зависит от Базы, Стойка/Приём/Хват — от Профиля через
// категорию оружия, categoryFor/trainingFor ниже).

import { CHARACTERISTICS }                    from "../constants/characteristics.mjs";
import { WEAPON_CLASSES, DAMAGE_TYPES }       from "../constants/items.mjs";
import { MELEE_STANCES, MELEE_BASES, MELEE_MANEUVERS, GRIPS, parseGrips, gripEffects } from "../constants/combat.mjs";
import { WEAPON_PROPERTIES }                  from "../constants/weapon-properties.mjs";
import { rollIcon }                           from "../constants/roll-icons.mjs";
import { qualityEffects }                     from "../constants/quality.mjs";
import { _degWord, _buildAmmoModString, resolveCharFormula, esc } from "../helpers/utils.mjs";
import { _executeAttackRoll }                 from "../combat/attack.mjs";
import { attackThreshold }                    from "../combat/attack-threshold.mjs";
import { resolveWeaponPropsList, aggregateAuto } from "../combat/weapon-properties.mjs";
import { getModEffects, mergeWeaponPropEntries } from "../combat/weapon-mods.mjs";
import { hasRuleFlag, ruleFlagLabels }        from "../rules/flags.mjs";
import { isRoundCapabilityAvailable, markRoundCapabilityUsed } from "../apps/game-session.mjs";
import { mountPairFor, mountSelectiveMod, SELECTIVE_MODS,
         mountRangedPenalty, MOUNT_SPEEDS } from "../rules/mount.mjs";
import { vehicleCoverMod } from "../rules/vehicle.mjs";
import { legionAttackPenalty, LEGION_FIT_FLAG } from "../rules/legion-fit.mjs";
import { meleeTrainingStatus, weaponTrainingPenalty } from "../rules/weapon-training.mjs";
import { MELEE_CATEGORIES, sameCategory } from "../constants/weapon-categories.mjs";
import { isHandShield } from "../combat/hand-shield.mjs";
import { CAPABILITIES } from "../constants/capabilities.mjs";
import { ruleRollModsHtml, ruleRerollsHtml } from "../rules/roll-mods.mjs";
import { resolveTest } from "../rules/resolve-test.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { fatiguePenalty }                     from "./tabs/conditions.mjs";
import { diceModeHtml, mergeReroll } from "../rules/test-kind-widget.mjs";
import { spendActionPoints, apCostForActionType } from "../combat/action-economy.mjs";
import { measureTokens, meleeContactCount }    from "../combat/tactical-map.mjs";
import { coverBonusForShot }                  from "../combat/cover.mjs";
import { hasDeathDance, deathDanceNextCost, markDeathDanceUsed } from "../combat/death-dance.mjs";

// Локус Сокрушения (стр. 31): раз в Раунд любая рукопашная атака (с оружием
// и голыми руками) считается имеющей Базу «Полная Атака» — см. meleeBaseKey
// в showAttackDialog/showAttackDialogNoWeapon ниже.
const FULL_ATTACK_CAPABILITY = "technique.baseFullAttack";

/**
 * Всё, что игрок отметил в окне, — одним чтением формы.
 *
 * Читатель намеренно ровно один. Раньше пересчёт в открытом окне и сам бросок
 * складывали модификаторы порознь, и расхождение между ними означало бы, что
 * игрок видит одно число, а кидается другое. Теперь это верно по построению.
 *
 * @param {HTMLFormElement} form       форма окна (DialogV2 отдаёт её в button.form)
 * @param {object[]}        ammoConds  условные эффекты боеприпаса, стр. 203
 */
function readAttackForm(form, ammoConds) {
  const el   = sel => form.querySelector(sel);
  const all  = sel => [...form.querySelectorAll(sel)];
  const on   = sel => !!el(sel)?.checked;
  const attr = (sel, key) => parseInt(el(sel)?.dataset?.[key]) || 0;

  const ROF = "input[name='atk-rof']:checked";
  const AIM = "input[name='atk-aiming']:checked";

  // Стойка/База/Приём/Хват/Профиль — undefined, если в форме нет такой
  // группы (стрелковое: только Профиль) или ничего не выбрано (не должно
  // случиться — по одному option всегда checked), resolveSelection тогда
  // берёт стартовое значение диалога.
  const stanceKey    = el("input[name='atk-stance']:checked")?.value;
  const baseKey      = el("input[name='atk-base']:checked")?.value;
  const maneuverKey  = el("input[name='atk-maneuver']:checked")?.value;
  const gripKeySel   = el("input[name='atk-grip']:checked")?.value;
  const profIdxRaw   = el("input[name='atk-profile']:checked")?.value;
  const profIdxSel   = profIdxRaw === undefined ? undefined : Number(profIdxRaw);

  const ammoSel = all(".atk-ammo-cond:checked")
    .map(cb => ammoConds[parseInt(cb.dataset.idx)]).filter(Boolean);

  // Галочки от реестра правил — тот же формат, что у Особенностей Происхождения
  // и предметных rollMods в диалоге броска навыка.
  let ruleMods = 0, halvePenalty = false;
  for (const cb of all(".rule-mod:checked")) {
    ruleMods += parseInt(cb.dataset.value) || 0;
    if (cb.dataset.halve === "1") halvePenalty = true;
  }

  const allOut = on("#atk-allout");

  // Выбранный переброс: −1 значит «без переброса». Именной (от правила)
  // важнее общего Кубика (Преимущество/Помеха) — тот же приём, что у диалога
  // Навыка/Характеристики (rules/test-kind-widget.mjs).
  const rerollEl = el(".rule-reroll-opt:checked");
  const rerollIdx = parseInt(rerollEl?.dataset?.idx ?? "-1");
  const namedReroll = rerollIdx >= 0
    ? { mode: rerollEl.dataset.mode, rolls: parseInt(rerollEl.dataset.rolls) || 2 }
    : null;
  const diceChoice = el(".dice-mode-opt:checked")?.value ?? "normal";

  return {
    reroll: mergeReroll(namedReroll, diceChoice),
    autoFail:   all(".atk-mod-cb[data-autofail]:checked").length > 0,
    // Беспомощная цель в упор/в рукопашной (см. specificMods выше) — авто-
    // успех и удвоенный урон вместо обычного порога, отдельно от autoFail.
    autoSuccess: all(".atk-mod-cb[data-autosuccess]:checked").length > 0,
    char:       el("#atk-char")?.value,
    modifier:   parseInt(el("#atk-modifier")?.value) || 0,
    dmgBonus:   parseInt(el("#atk-dmg-bonus")?.value) || 0,
    coverMod:   parseInt(el("#atk-cover")?.value) || 0,
    // Штраф стрельбы с седла (wdbc-8nz6) — раньше нигде не применялся к
    // настоящему броску, только показывался в панели «ВЕРХОМ». Авто-число
    // предполагает обычное личное оружие; для Интегрированного/турели
    // Коляски (штраф ниже/отсутствует) поле правится руками.
    mountRangedMod: parseInt(el("#atk-mount-ranged")?.value) || 0,
    rofMode:    el(ROF)?.value,
    rofBonus:   attr(ROF, "bonus"),
    aimVal:     el("#atk-aim")?.value,
    aimPenalty: attr("#atk-aim option:checked", "penalty"),
    // Кого выцеливают в паре «всадник + скакун» и во что это обходится. Штраф
    // берётся только вместе с зоной прицела: не-Избирательная атака никого не
    // выцеливает вовсе — там попадание делится по дублю (стр. 478).
    mountPick:    el("#atk-mount")?.value || "",
    mountPenalty: el("#atk-aim")?.value
      ? (parseInt(el("#atk-mount option:checked")?.dataset?.penalty) || 0) : 0,
    aiming:     el(AIM)?.value || "none",
    aimBonus:   attr(AIM, "bonus"),
    // Отмеченные ситуативные: сумма — в порог, список — в сводку заголовка.
    sitPicked:  all(".atk-mod-cb:checked"),
    // data-value уже 0 у автоуспеха (см. makeMods выше), поэтому отдельно
    // исключать его из суммы не нужно — селектор тот же, что и раньше.
    sitMods:    all(".atk-mod-cb:not([data-autofail]):checked")
      .reduce((n, cb) => n + (parseInt(cb.dataset.value) || 0), 0),
    ammoSel,
    ammoMods:   ammoSel.reduce((n, c) => n + (c.atk || 0), 0),
    ruleMods, halvePenalty,
    allOut,
    extraBonus: allOut ? 20 : 0,
    shortRange: on("#atk-shortrange"),
    // Перемены (Change, стр. 74 Книги Аэльдари): цель бездушна/техника → +X Pen.
    changeSoulless: on("#atk-change-soulless"),
    weaponOff:  on("#atk-weaponoff"),
    maximal:    on("#atk-maximal"),
    bandIdx:    Number(el("#atk-band")?.value ?? -1),
    stanceKey, baseKey, maneuverKey, gripKey: gripKeySel, profIdx: profIdxSel
  };
}

export async function showAttackDialog(actor, item, techniqueOpts = {}) {
  const sys     = item.system;
  // Стартовое значение «Доп. мод» — напр. Контратака (стр. 12, требует Талант
  // Counter Attack): «−10» уже вписаны, когда открывается окно, а не молча
  // сидят в пороге — игрок видит и волен поправить/убрать.
  const presetModifier = Number(techniqueOpts.modifier) || 0;
  // forceMelee: стрелковое/метательное оружие используется как рукопашное
  // (приклад/в упор либо метательное — как рукопашное, стр. 40) — тест по WS,
  // рукопашные режимы/модификаторы. Метательное (Гранаты и т.п.) по умолчанию
  // бросается по BS — стр. 40: «В рукопашной оно МОЖЕТ использоваться как
  // рукопашное», это не значение по умолчанию.
  const forceMelee = !!techniqueOpts.forceMelee;
  const isMelee = sys.weaponClass === "melee" || forceMelee;
  const charKey = isMelee ? "ws" : "bs";

  // ── Хват и профиль: значения по умолчанию (из HUD-флагов оружия или opts) ──
  //   Теперь выбираются прямо в этом окне (см. resolveSelection ниже) — эти
  //   переменные лишь стартовые значения, с которых открывается диалог.
  const gripList  = isMelee ? parseGrips(sys.grips) : [];
  const primGrip  = gripList[0] || "";
  const gripKey   = techniqueOpts.gripKey
                 ?? item.getFlag?.("warhammer-dbc", "hudGrip")
                 ?? primGrip;
  const atkProfiles = Array.isArray(sys.profiles) ? sys.profiles : [];
  let   profIdx   = techniqueOpts.profileIdx;
  if (profIdx === undefined || profIdx === null) profIdx = item.getFlag?.("warhammer-dbc", "hudProfile");
  profIdx = Number.isFinite(Number(profIdx)) ? Number(profIdx) : -1;

  // ── Особые свойства оружия (+ модификации + боеприпас) ───────────────────
  const modFx       = getModEffects(actor, item);
  let _entries      = mergeWeaponPropEntries(item, modFx);
  // Свойства заряженного боеприпаса (стр. 203) — чтобы порог и памятки в
  // диалоге совпадали с тем, что реально применит бросок.
  {
    const _ammo = sys.loadedAmmoId ? actor.items.get(sys.loadedAmmoId) : null;
    // Боеприпас бывает и отнимает свойство (Инферно Тзинча гасит Tearing).
    const _drop = new Set((_ammo?.system?.removeProps || []).map(k => String(k)));
    if (_drop.size) _entries = _entries.filter(e => !_drop.has(e.key));
    for (const p of (_ammo?.system?.properties || [])) {
      const key = typeof p === "string" ? p : p.key;
      if (!key || _entries.some(x => x.key === key)) continue;
      _entries.push({ key,
        rating:  typeof p === "string" ? 0 : (p.rating  || 0),
        rating2: typeof p === "string" ? 0 : (p.rating2 || 0) });
    }
  }
  const wProps      = resolveWeaponPropsList(_entries);
  const wp           = aggregateAuto(wProps);
  // Качество: рукопашное даёт мод на тесты с оружием (Poor −10 / Good +5 / Best +10)
  const qTestMod     = isMelee ? (qualityEffects(item).auto.testMod || 0) : 0;
  // Легион (стр. 179): своё оружие Астартес берут без штрафа, чужое — со
  // штрафом, и наоборот — не-Астартес не сладит с легионным хватом.
  const legionFit = legionAttackPenalty({
    hasLegion:  _entries.some(e => e.key === "legion"),
    fitsLegion: hasRuleFlag(actor, LEGION_FIT_FLAG),
    size:       actor.system.size ?? 0,
    sBonus:     actor.system.characteristics?.s?.bonus ?? 0,
    isGrenade:  sys.weaponType === "grenade"
  });
  // Арсенал (стр. 62): без Weapon Training на класс оружия — штраф −20.
  const weaponTraining = weaponTrainingPenalty({
    actor, weaponType: sys.weaponType, weaponClass: sys.weaponClass,
    isGrenade: sys.weaponType === "grenade"
  });

  // ── Правила из реестра (module/rules/) ───────────────────────────────────
  //   Атака — такой же тест конвейера, как бросок навыка: вид теста «attack»,
  //   область эффекта «attack» или «weapon:<класс>». Актор цели нужен
  //   правилам, чей отбор зависит от того, по кому бьют (targetHasTrait).
  const attackCtx = {
    kind: "attack",
    weaponClass: sys.weaponClass,
    isMelee,
    char: charKey,
    targetActor: [...(game.user?.targets ?? [])][0]?.actor ?? null
  };

  // ── Тактическая карта (wdbc-8k0i): дистанция/контакт/Укрытие по токенам ───
  // сцены. Меряется один раз при открытии окна (позиции не двигаются, пока
  // диалог открыт) — подсказка и автоподстановка, всё остаётся правимо рукой.
  // Именно placeable (второй аргумент false): coverBonusForShot меряет по
  // .center, которого у TokenDocument нет — с документом Укрытие молча даёт 0.
  const attackerToken = actor.getActiveTokens?.(true)?.[0] ?? null;
  const targetToken    = [...(game.user?.targets ?? [])][0] ?? null;
  const measured        = (attackerToken && targetToken) ? measureTokens(attackerToken, targetToken) : null;
  // Укрытие ВНУТРИ техники (Закрытая/Открытая(X), wdbc-y33b) — независимо от
  // Укрытия местности выше (можно быть и в машине, и в её укрытии сразу),
  // поэтому складываются, а не выбирается большее.
  const vehicleCover    = attackCtx.targetActor
    ? vehicleCoverMod(attackCtx.targetActor, [...(game.actors ?? [])]) : 0;
  const autoCoverMod    = ((attackerToken && targetToken) ? coverBonusForShot(attackerToken, targetToken) : 0)
    + vehicleCover;

  // Штраф стрельбы с седла (стр. 478, wdbc-8nz6) — до сих пор нигде не
  // применялся к настоящему броску атаки, только показывался в панели
  // «ВЕРХОМ» (см. doombc-mount-ranged-penalty-dead-parameters). Считается для
  // ОБЫЧНОГО личного оружия (integral/sidecarTurret не проверяются — нет
  // персистентной связи weapon→«это интегрированное орудие/турель этого
  // байка» в схеме предмета); для Интегрированного Оружия/турели Коляски
  // штраф ниже или отсутствует — поле правится руками, как #atk-cover.
  const mountUuid       = actor.system?.mount?.uuid || "";
  const attackerMount   = (!isMelee && mountUuid)
    ? [...(game.actors ?? [])].find(a => a?.uuid === mountUuid) : null;
  const autoMountRangedMod = attackerMount
    ? mountRangedPenalty(
        actor.system.mount.speed in MOUNT_SPEEDS ? actor.system.mount.speed : "still",
        attackerMount)
    : 0;

  const ruleMods = ruleRollModsHtml(actor, attackCtx);
  // Перебросы от правил (Локус Буйства — «перебросить любой тест атаки»).
  // Отдельным блоком: складывать их не с чем, выбирается один.
  const ruleRerolls = ruleRerollsHtml(actor, attackCtx);
  // Перебросы, навязанные ЦЕЛИ (Локус Кровопролития), в свой блок не идут:
  // бросает их защищающийся у себя. Они уезжают атрибутом на кнопки защиты в
  // карточке атаки — см. combat/attack-card.mjs.
  const forcedDefenceReroll = (resolveTest({ actor, ...attackCtx }).rerolls || [])
    .find(r => r.who === "target")?.mode || "";

  // Стойка цели (стр. 15, Защитная/Прикрывающая) меняет ЧУЖИЕ атаки против
  // неё — читается с targetActor, а не с атакующего, и складывается прямо в
  // wpAttackMod (тот же слот, что Легион/Арсенал ниже).
  const targetStance    = (isMelee && attackCtx.targetActor) ? (attackCtx.targetActor.system?.meleeStance || "standard") : "";
  const targetStanceDef = targetStance ? MELEE_STANCES[targetStance] : null;
  const targetStanceMod = targetStanceDef?.attackerMod ?? 0;
  const targetStanceBadge = targetStanceMod
    ? `<span class="atk-training-warn" title="Стойка цели меняет порог атаки по ней">🎯 Цель: ${esc(targetStanceDef.label)} (${targetStanceMod >= 0 ? "+" : ""}${targetStanceMod})</span>`
    : "";

  // Агрессивная Стойка (стр. 15): теряет 1 Реакцию в конце Хода, а если
  // терять было нечего — до начала следующего Хода все рукопашные атаки по
  // ней получают +20 (module/combat/action-economy.mjs, applyTurnEndStanceEffects
  // ставит flags.warhammer-dbc.exposedAggressive). Снимается там же —
  // resetActionEconomy в начале следующего Хода цели.
  const targetExposed = isMelee && !!attackCtx.targetActor?.getFlag?.("warhammer-dbc", "exposedAggressive");
  const exposedMod = targetExposed ? 20 : 0;
  const exposedBadge = targetExposed
    ? `<span class="atk-training-warn" title="Агрессивная Стойка: цель уже потеряла все Реакции в конце своего Хода">⚔️ Цель раскрыта (+20)</span>`
    : "";

  // Бег (стр. 32): до начала следующего Хода бегущего вся Стрельба по нему
  // −20, вся Рукопашная +20 (module/combat/movement-actions.mjs, declareRun
  // ставит флаг; снимается resetActionEconomy — action-economy.mjs).
  const targetRunning = !!attackCtx.targetActor?.getFlag?.("warhammer-dbc", "running");
  const runningMod = targetRunning ? (isMelee ? 20 : -20) : 0;
  const runningBadge = targetRunning
    ? `<span class="atk-training-warn" title="Цель Бежит (стр. 32)">🏃 Цель Бежит (${isMelee ? "+20" : "−20"})</span>`
    : "";

  // Беспомощная цель: рукопашная (и выстрел в упор/в рукопашной, стр. ...) бьёт
  // автоматически и удваивает урон до Поглощения; прочая стрельба — только
  // +30. Рукопашный случай безусловен (badge), стрелковый «в упор/в рукопашной»
  // зависит от дистанции конкретного выстрела — это ситуативный факт, а не
  // хранимое состояние, поэтому решается галочкой рядом с прочими такими же
  // («Дистанция в упор» и т.п.) в specificMods ниже, не авточтением флага.
  const targetHelpless      = !!attackCtx.targetActor?.system?.conditions?.helpless;
  const helplessAutoMelee   = targetHelpless && isMelee;
  const helplessRangedMod   = (targetHelpless && !isMelee) ? 30 : 0;
  const targetHelplessBadge = helplessAutoMelee
    ? `<span class="atk-training-warn" title="Беспомощная цель: рукопашная бьёт автоматически">🪢 Цель Беспомощна: авто-успех, урон ×2</span>`
    : helplessRangedMod
      ? `<span class="atk-training-warn" title="Беспомощная цель: бонус к стрельбе">🪢 Цель Беспомощна (+${helplessRangedMod})</span>`
      : "";

  // Шаг За Шагом (стр. 73 Книги Аэльдари): +10, пока персонаж инициировал
  // рукопашный бой или продолжает в нём находиться — то есть практически
  // всегда, когда идёт рукопашная атака этим оружием; безусловно, без галочки.
  const stepByStepMod = (isMelee && wp.stepByStep) ? 10 : 0;
  const wpAttackMod  = (wp.attackMod || 0) + (modFx.attackMod || 0) + qTestMod + legionFit.total + weaponTraining.total + targetStanceMod + exposedMod + helplessRangedMod + runningMod + stepByStepMod;
  const meleeCategory = sys.meleeCategory || "";
  // Категория оружия по выбранному Профилю (стр. 14, «Композиция Рукопашной
  // Атаки»): у многопрофильного оружия каждый альт-профиль — фактически
  // другая «голова» («Крюк»/«Копьё»/«Посох» у «Психокостяной Алебарды» и
  // т.п.), со своей категорией для Приёма/Стойки/Тренировки — метка профиля
  // и есть эта категория. «Основной» профиль (idx -1) — категория предмета.
  // Хват/Баланс — свойства физического древка, от Профиля не зависят.
  // Метка профиля не всегда категория («Unarmed Warrior», «Подавительный»,
  // «Булава (нимб втянут)») — неизвестная списку MELEE_CATEGORIES метка
  // трактуется как пустая: тот же «мягкий» пропуск, что у предмета без
  // meleeCategory, а не ложный гейт «нет Тренировки (Подавительный)».
  function categoryFor(pIdx) {
    const p = isMelee && pIdx >= 0 ? atkProfiles[pIdx] : null;
    const raw = p?.label || meleeCategory;
    return MELEE_CATEGORIES.some(c => sameCategory(c, raw)) ? raw : "";
  }
  // Melee Training (стр. 62) — используется ниже resolveSelection, чтобы
  // ограничить доступные Стойку/Хват/Приём. Категория неизвестна (данные
  // ещё не дошли из packs-src, см. память doombc-arsenal-weapon-training) —
  // meleeTrainingStatus сама трактует пустую категорию как «владеет».
  // Тренировка выдаётся по категории, а не по предмету — пересчитывается
  // заново на каждый выбранный Профиль (см. updateTotal ниже).
  function trainingFor(pIdx) {
    return isMelee ? meleeTrainingStatus(actor, categoryFor(pIdx)) : { trained: true, source: "" };
  }
  const wantShortBox = !isMelee && (wp.meltaShort || wp.scatter);
  const wantMaximal  = !isMelee && wp.maximal;

  // Стойка/База — персистентны на акторе, стартовые значения для resolveSelection
  // ниже (выбор в этом диалоге может их поменять — см. кнопку «Бросок!»).
  const stance = actor.system.meleeStance || "standard";

  // Локус Сокрушения подменяет Базу на «Полная Атака», пока способность не
  // потрачена в текущем Раунде (см. FULL_ATTACK_CAPABILITY выше) — расходуется
  // самим броском, а не открытием окна (см. кнопку «Бросок!» ниже).
  const fullAttackForced = isMelee
    && hasRuleFlag(actor, FULL_ATTACK_CAPABILITY)
    && isRoundCapabilityAvailable(actor, FULL_ATTACK_CAPABILITY);
  // forceBase — нейтральная стартовая База вместо персистентной (Контратака,
  // стр. 12: это атака со штрафом −10, персистентная «Полная Атака» +30 сюда
  // протекать не должна). Игрок волен сменить её в окне, как обычно.
  const meleeBaseKey = fullAttackForced ? "fullatk"
    : (techniqueOpts.forceBase || actor.system.meleeBase || "standard");

  // Верховая Атака (стр. 12) — только персонажам верхом на байке/скакуне,
  // ссылку на него держит сам всадник (module/rules/mount.mjs, тот же
  // принцип, что у mountPairFor ниже). Защитная Стойка (стр. 15) без щита
  // запрещает атаки вовсе — щит определяется тем же полем, что и в HUD/
  // sheet-helpers (system.shieldAP != null, module/combat/hand-shield.mjs).
  const isMounted        = isMelee && !!actor.system?.mount?.uuid;
  const hasShieldEquipped = isMelee && actor.items.some(i => i.system?.equipped && isHandShield(i));

  const currentAiming = actor.system.aiming || "none";
  const aimingBonus   = currentAiming === "half" ? 10 : currentAiming === "full" ? 20 : 0;
  const aimingLabel   = currentAiming === "half"
    ? "Полу-прицеливание (+10)"
    : currentAiming === "full" ? "Полное прицеливание (+20)" : "";

  const loadedAmmo = sys.loadedAmmoId ? actor.items.get(sys.loadedAmmoId) : null;
  const ammoSys    = loadedAmmo?.system;
  const ammoAtkMod = ammoSys?.attackMod ?? 0;

  const maneuverKeyDefault = techniqueOpts.technique || "standard";

  // ── Доступность Стойки/Хвата/Базы/Приёма (стр. 14-15, 62 Melee Training) ─
  // Без Рукопашной Тренировки на категорию оружия книга разрешает только
  // Обычную Атаку, Стандартную Стойку и Базовый (первый) Хват — База книгой
  // не ограничена, остаётся полностью на выбор. Приём дополнительно всегда
  // сверяется со списком совместимых категорий (MELEE_MANEUVERS[*].categories),
  // независимо от тренировки — но только если категория оружия известна:
  // много предметов пока без meleeCategory (пак не пересобран), и в этом
  // случае фильтр не применяется — лучше показать лишнее, чем незаслуженно
  // запереть Приёмы там, где данных попросту ещё нет.
  // Стойка дополнительно сверяется со своим categories/minBalance (Частокол:
  // Глефа/Копьё/Штык; Пружинящая: Баланс не ниже 0, стр. 15) — так же, как
  // Приём сверяется со своим categories ниже. Частокол — исключение из
  // «мягкого» пропуска при неизвестной категории (def.strictCategory,
  // MELEE_STANCES.rapidstrike): это требование к самой геометрии оружия
  // (длинное древковое), а не к Тренировке персонажа, поэтому неизвестная
  // категория не должна ошибочно предлагать Частокол любому оружию.
  //
  // Стойки книгой (стр. 15, «Композиция Рукопашной Атаки») применимы только
  // в пешем бою: верхом, за люком техники, в полёте и т.п. — только
  // Стандартная. Из перечисленных книгой состояний система живьём отслеживает
  // только «верхом» (actor.system.mount.uuid, тот же isMounted, что у Базы
  // «Верховая Атака» выше) — люк техники/полёт этот код не моделирует.
  // Стойка/Хват тоже зависят от выбранного Профиля (categoryFor/trainingFor
  // выше) — пересчитываются заново при его смене (см. updateTotal ниже), как
  // Приём — при смене Базы.
  function computeStanceOptions(pIdx) {
    const category = categoryFor(pIdx);
    const trained  = trainingFor(pIdx).trained;
    return Object.entries(MELEE_STANCES).map(([key, def]) => {
      const trainingOk = trained || key === "standard";
      const groundedOk = key === "standard" || !isMounted;
      const fitOk = def.categories
        ? (def.strictCategory ? (!!category && def.categories.includes(category))
                               : (!category || def.categories.includes(category)))
        : def.minBalance != null ? ((sys.balance ?? 0) >= def.minBalance)
        : true;
      const reason = !trainingOk
        ? `Нужна Рукопашная Тренировка (${category})`
        : (!groundedOk ? "Стойки — только в пешем бою (сейчас верхом)"
          : (!fitOk ? (def.categories
              ? (category ? `Не подходит категории «${category}»` : `Требуется профиль: ${def.categories.join("/")}`)
              : `Нужен Баланс не ниже ${def.minBalance}`) : ""));
      return { key, label: def.label, allowed: trainingOk && groundedOk && fitOk, reason };
    });
  }
  function computeGripOptions(pIdx) {
    const trained = trainingFor(pIdx).trained;
    return gripList.map(key => ({
      key, label: GRIPS[key]?.label || key,
      allowed: trained || key === primGrip
    }));
  }
  // "freeattack" (Свободная Атака, стр. 12) — Реакция доступная всем, как и
  // Обычная Атака: книга не требует Тренировки для неё отдельно.
  // Приём дополнительно завязан на текущую выбранную Базу (стр. 14: у каждого
  // Приёма своя «База» — MELEE_MANEUVERS[*].bases, отсутствие поля = «Любая»,
  // как у книжного «База: Любая»). Совпадать должны оба условия сразу —
  // категория оружия И База, поэтому пересчитывается заново при смене Базы
  // ИЛИ Профиля (см. updateTotal ниже), как Базы — при смене Стойки. Приёмы
  // из Талантов (Быстрая/Молниеносная Атака) добавляют requiresCapability и
  // minBalance — тот же приём, что у альт-профиля Профиля и у Пружинящей
  // Стойки соответственно.
  function computeManeuverOptions(baseKeyNow, pIdx) {
    const category = categoryFor(pIdx);
    const trained  = trainingFor(pIdx).trained;
    return Object.entries(MELEE_MANEUVERS).map(([key, def]) => {
      const categoryOk = key === "standard" || key === "freeattack" || !def.categories || !category || def.categories.includes(category);
      const baseOk     = !def.bases || def.bases.includes(baseKeyNow);
      const trainingOk = trained || key === "standard" || key === "freeattack";
      const balanceOk  = def.minBalance == null || ((sys.balance ?? 0) >= def.minBalance);
      const capOk      = !def.requiresCapability || hasRuleFlag(actor, def.requiresCapability);
      const reason = !trainingOk
        ? `Нужна Рукопашная Тренировка (${category})`
        : (!categoryOk ? `Не подходит категории «${category}»`
          : (!baseOk ? `Только с Базой: ${def.bases.map(b => MELEE_BASES[b]?.label ?? b).join(", ")}`
            : (!balanceOk ? `Нужен Баланс не ниже ${def.minBalance}`
              : (!capOk ? `Нужно: ${CAPABILITIES[def.requiresCapability]?.source || def.requiresCapability}` : ""))));
      return { key, label: def.label, allowed: trainingOk && categoryOk && baseOk && balanceOk && capOk, reason };
    });
  }
  /**
   * Пилюли Базы зависят от ТЕКУЩЕЙ Стойки (Частокол запрещает Натиск, стр. 15)
   * и от Верховой Атаки (только верхом) — пересчитываются заново на каждое
   * изменение формы (см. #atk-base-pills в updateTotal), а не один раз.
   */
  function computeBaseOptions(stanceKeyNow) {
    const noCharge = MELEE_STANCES[stanceKeyNow]?.noCharge === true;
    return Object.entries(MELEE_BASES).map(([key, def]) => {
      let allowed = !fullAttackForced || key === "fullatk";
      let reason = "";
      if (allowed && def.requiresMount && !isMounted) { allowed = false; reason = "Только верхом на байке/скакуне"; }
      if (allowed && noCharge && key === "charge") { allowed = false; reason = "Недоступно в Стойке «Частокол»"; }
      return { key, label: def.label, allowed, reason };
    });
  }
  // Профиль (стр. 207-221) не завязан на Тренировку — доступен всегда, кроме
  // альт-профилей с requiresCapability (напр. «Unarmed Warrior»/Безоружный
  // Воин, стр. 40, module/constants/capabilities.mjs: unarmed.warriorProfile) —
  // такой профиль лежит на том же предмете, но выбрать его можно только с
  // Талантом.
  const profileOptions = atkProfiles.length ? [
    { idx: -1, label: sys.profileLabel || "Основной", dmg: sys.damage || "", allowed: true },
    ...atkProfiles.map((p, i) => {
      const allowed = !p.requiresCapability || hasRuleFlag(actor, p.requiresCapability);
      const reason  = allowed ? "" : `Нужно: ${CAPABILITIES[p.requiresCapability]?.source || p.requiresCapability}`;
      return { idx: i, label: p.label || `Проф. ${i + 1}`, dmg: p.damage || "", allowed, reason };
    })
  ] : [];
  function computeLockNoteHtml(pIdx) {
    const category = categoryFor(pIdx);
    const trained  = trainingFor(pIdx).trained;
    return (isMelee && category && !trained)
      ? `<span class="atk-training-warn" title="Без Рукопашной Тренировки (${esc(category)}) книга разрешает только Обычную Атаку, Стандартную Стойку и Базовый Хват">🔒 Без Тренировки (${esc(category)})</span>`
      : "";
  }

  /** Бонусы по текущему выбору (по умолчанию — стартовые значения диалога). */
  function resolveSelection(sel = {}) {
    const stanceKey = sel.stanceKey ?? stance;
    const stDef     = MELEE_STANCES[stanceKey] || MELEE_STANCES.standard;
    const stanceBon = isMelee ? (stDef.wsBonus ?? 0) : 0;

    const baseKey = fullAttackForced ? "fullatk" : (sel.baseKey ?? meleeBaseKey);
    const bDef    = MELEE_BASES[baseKey] || MELEE_BASES.standard;
    const baseBon = isMelee ? (bDef.wsBonus ?? 0) : 0;

    const maneuverKey = isMelee ? (sel.maneuverKey ?? maneuverKeyDefault) : "standard";
    const mDef        = MELEE_MANEUVERS[maneuverKey] || MELEE_MANEUVERS.standard;
    const maneuverBon = isMelee ? (mDef.wsBonus ?? 0) : 0;

    const gKey = sel.gripKey ?? gripKey;
    const gDef = GRIPS[gKey] ? gripEffects(gKey, gKey !== primGrip) : null;
    const gWs  = gDef ? gDef.ws : 0;

    const pIdx = sel.profIdx ?? profIdx;
    const prof = (pIdx >= 0) ? (atkProfiles[pIdx] || null) : null;

    // Избегания ЦЕЛИ против ЭТОЙ атаки — Приём и Стойка складываются (стр.
    // 14-15): например Взмах (−10 Уклонение) + Агрессивная (−10 Уклонение).
    const targetDodgeMod = (mDef.targetDodgeMod ?? 0) + (stDef.targetDodgeMod ?? 0);
    const targetParryMod = (mDef.targetParryMod ?? 0) + (stDef.targetParryMod ?? 0);

    // Защитная Стойка без щита (стр. 15) — персонаж не может атаковать вовсе.
    const blocked = isMelee && stanceKey === "defensive" && stDef.noAttackWithoutShield && !hasShieldEquipped;

    const note = [
      prof ? `Профиль: ${prof.label || "доп."}${prof.damage ? ` (${prof.damage})` : ""}` : "",
      gDef ? `Хват: ${gDef.label}${gDef.ws ? ` · WS ${gDef.ws >= 0 ? "+" : ""}${gDef.ws}` : ""}${gDef.dmgFlat ? ` · урон ${gDef.dmgFlat >= 0 ? "+" : ""}${gDef.dmgFlat}` : ""}${gDef.sbHalf ? " · ½S.b" : ""} — ${gDef.note}` : ""
    ].filter(Boolean).join("<br>");

    return {
      stanceKey, stDef, stanceBon, baseKey, bDef, baseBon,
      maneuverKey, mDef, maneuverBon, gKey, gDef, gWs, pIdx, prof,
      techBon: baseBon + maneuverBon, targetDodgeMod, targetParryMod, blocked, note
    };
  }

  /**
   * То же, что resolveSelection, но недоступный, а всё ещё отмеченный вариант
   * (disabled+checked пилюля: readAttackForm читает :checked независимо от
   * disabled) сбрасывается на standard/базовый Хват. Одно место и для живого
   * пересчёта (updateTotal), и для самого броска — иначе смена Базы, делающая
   * выбранный Приём недоступным, всё равно уносила бы его в бросок.
   */
  function resolveSelectionSafe(f = {}) {
    const sel = resolveSelection(f);
    if (!isMelee) return sel;
    const ok = (opts, key, field = "key") =>
      opts.find(o => o[field] === key)?.allowed ?? true;
    const fix = {};
    if (!ok(computeStanceOptions(sel.pIdx), sel.stanceKey)) fix.stanceKey = "standard";
    const stanceKey = fix.stanceKey ?? sel.stanceKey;
    if (!ok(computeBaseOptions(stanceKey), sel.baseKey)) fix.baseKey = "standard";
    const baseKey = fix.baseKey ?? sel.baseKey;
    if (!ok(computeManeuverOptions(baseKey, sel.pIdx), sel.maneuverKey)) fix.maneuverKey = "standard";
    if (gripList.length && !ok(computeGripOptions(sel.pIdx), sel.gKey)) fix.gripKey = primGrip;
    return Object.keys(fix).length ? resolveSelection({ ...f, ...fix }) : sel;
  }

  const dyn0 = resolveSelection();

  function badgesHtml(sel) {
    const stanceBadge = (isMelee && sel.stanceBon !== 0)
      ? `<span class="atk-stance-badge">${rollIcon("sword")}Стойка: ${sel.stanceBon >= 0 ? "+" : ""}${sel.stanceBon}</span>`
      : "";
    const baseBadge = isMelee
      ? `<span class="atk-base-badge">${rollIcon("sword")}База: ${sel.bDef?.label ?? "Стандартная Атака"} (${sel.baseBon >= 0 ? "+" : ""}${sel.baseBon})${fullAttackForced ? " — Локус Сокрушения" : ""}</span>`
      : "";
    const blockedBadge = sel.blocked
      ? `<span class="atk-training-warn" title="Защитная Стойка без щита запрещает атаки (стр. 15)">🚫 Защитная Стойка — атака запрещена</span>`
      : "";
    return `${baseBadge}${stanceBadge}${blockedBadge}${computeLockNoteHtml(sel.pIdx)}${targetStanceBadge}${exposedBadge}${runningBadge}${targetHelplessBadge}${ammoBadge}${fatigueBadge}${drugAtkBadge}`;
  }

  // Недоступные варианты (без Рукопашной Тренировки/не подходит категории) не
  // дизейблятся серым — совсем убираются из списка, чтобы не создавать шум
  // в диалоге. Исключение — уже выбранный ключ: если текущее (стартовое)
  // значение вдруг оказалось недоступным, пилюля остаётся видна (заблокирована),
  // иначе в группе не окажется ни одной отмеченной радиокнопки.
  function pillsHtml(name, options, currentKey, keyField = "key") {
    return options.filter(o => o.allowed || o[keyField] === currentKey).map(o => {
      const key      = o[keyField];
      const checked  = key === currentKey ? "checked" : "";
      const disabled = o.allowed ? "" : "disabled";
      const cls      = o.allowed ? "av-pill" : "av-pill av-pill-disabled";
      const title    = o.reason ? ` title="${esc(o.reason)}"` : "";
      return `<label class="${cls}"${title}><input type="radio" name="${name}" value="${key}" ${checked} ${disabled}/><span>${esc(o.label)}</span></label>`;
    }).join("");
  }

  const charVal = (actor.system.characteristics[charKey]?.total ?? 0) + (sys.attackBonus || 0)
    + wpAttackMod + dyn0.techBon + dyn0.stanceBon + dyn0.gWs + (wp.noAim ? 0 : aimingBonus) + ammoAtkMod;

  // Штраф усталости (мод препаратов уже учтён в char.total)
  const hasFatigue = (actor.system.fatigue?.value ?? 0) >= 1;

  const rofModes = [];
  if (isMelee) {
    // Бонус Базы (Стандартная/Натиск/Полная/Осторожная) теперь персистентен
    // на акторе (system.meleeBase, панель «БАЗА») и уже вошёл в techBonus —
    // здесь только один вариант без своего бонуса, чтобы не задваивать.
    rofModes.push({ value: "melee",  label: "Рукопашная атака",      bonus: 0  });
  } else {
    if (sys.rof_single > 0)
      rofModes.push({ value: "single", label: "Одиночный выстрел (+10)", bonus: 10 });
    // Импульсное (стр. 73 Книги Аэльдари): +10 к очередям. Удвоение «если
    // оружие не двигали с прошлого раунда» — не автоматизировано (нет
    // трекинга движения по раундам), считается за ГМ вручную.
    const impulseBonus = wp.impulse ? 10 : 0;
    const fmtMod = n => n === 0 ? "±0" : (n > 0 ? `+${n}` : `${n}`);
    if (sys.rof_semi > 0)
      rofModes.push({ value: "semi",   label: `Короткая очередь (${fmtMod(impulseBonus)}, ${sys.rof_semi} выстр.)`,  bonus: impulseBonus   });
    if (sys.rof_full > 0)
      rofModes.push({ value: "full",   label: `Длинная очередь (${fmtMod(impulseBonus - 10)}, ${sys.rof_full} выстр.)`,  bonus: impulseBonus - 10 });
    if (sys.rof_semi > 0 || sys.rof_full > 0)
      rofModes.push({ value: "suppression", label: "Стрельба на подавление (−20)", bonus: -20 });
  }

  const rofHtml = rofModes.map((m, i) =>
    `<label class="atk-rof-label">
      <input type="radio" name="atk-rof" value="${m.value}"
             data-bonus="${m.bonus}" ${i === 0 ? "checked" : ""}/>
      <span>${m.label}</span>
     </label>`
  ).join("");

  // Точное (Precise): −20 к штрафу Избирательных по сочленениям и глазам
  const csMod = wp.calledShotMod || 0;
  let aimTargets = [
    { value: "",       label: "— Без прицела —",      penalty:   0 },
    { value: "torso",  label: "Торс (−10)",            penalty: -10 },
    { value: "leg",    label: "Нога (−15)",             penalty: -15 },
    { value: "arm",    label: "Рука (−20)",             penalty: -20 },
    { value: "head",   label: "Голова (−20)",           penalty: -20 },
    { value: "joint",  label: "Сочленение/Шея",         penalty: -40, precise: true },
    { value: "eye",    label: "Глаз",                   penalty: -50, precise: true }
  ];
  // Неточное / Взрывное (Imprecise): «не для прицельных атак в сочленения и
  // глаза» — то есть закрыты ровно эти две цели, а по конечностям, торсу и
  // голове бить прицельно можно.
  if (wp.noCalledShot) aimTargets = aimTargets.filter(t => !t.precise);
  // Взрывное: можно целиться не в цель, а ПОД неё — тогда промах не пропадает
  // бесследно, а смещает взрыв по розе (attack.mjs, module/combat/scatter.mjs).
  // Штраф и статус Избирательной — тот же механизм, что у обычного прицела в
  // зону; ничего сверх aimVal/aimPenalty не требуется.
  if (wp.blastRating > 0) {
    aimTargets.splice(1, 0, { value: "underfoot", label: "Под цель (Взрывное, −20)", penalty: -20 });
  }
  const aimHtml = aimTargets.map(t => {
    const pen = (t.precise && csMod) ? Math.min(0, t.penalty + csMod) : t.penalty;
    const lbl = t.value && !t.label.includes("(")
      ? `${t.label} (${pen})`
      : t.label;
    return `<option value="${t.value}" data-penalty="${pen}">${lbl}</option>`;
  }).join("");

  // ── Цель верхом (стр. 478) ──────────────────────────────────────────────
  //  Книга делит попадания между двумя телами: не-Избирательная атака бьёт
  //  скакуна, и лишь дубль достаётся всаднику, а выцелить всадника можно
  //  Избирательной атакой с дополнительным штрафом (−10, а под «Укрытием»
  //  демона −30). Стрелок целится в один токен, поэтому пара ищется по нему —
  //  всё равно, кого он выбрал, всадника или скакуна.
  const mountPair = mountPairFor(attackCtx.targetActor, [...(game.actors ?? [])]);
  const mountRiderPen = mountPair ? mountSelectiveMod("rider", mountPair.mount) : 0;
  const mountHtml = mountPair ? `
      <div class="av-row">
        <label>Цель верхом</label>
        <select id="atk-mount" class="av-input av-wide">
          <option value="" data-penalty="0">— не выцеливать: попадание делится —</option>
          <option value="mount" data-penalty="0">В скакуна: ${esc(mountPair.mount.name)} (±0)</option>
          <option value="rider" data-penalty="${mountRiderPen}">Во всадника: ${esc(mountPair.rider.name)} (${mountRiderPen})</option>
        </select>
      </div>
      <div class="atk-range-info av-mount-note" style="font-size:0.82em;">
        Не-Избирательная атака бьёт скакуна; попаданием по всаднику считается дубль на броске.
        Выцеливание всадника — только Избирательной атакой («Прицельно в…»), штраф
        <b>${mountRiderPen}</b>${mountRiderPen === SELECTIVE_MODS.riderCovered ? " (Укрытие)" : ""} сверх штрафа зоны.
      </div>` : "";

  let rangeInfoHtml = "";
  if (!isMelee && sys.range > 0) {
    const rng     = sys.range;
    const rngMult = ammoSys?.rangeMultiplier ?? 1;
    const rngAdd  = ammoSys?.rangeMod ?? 0;
    const effRng  = Math.round(rng * rngMult) + rngAdd;
    rangeInfoHtml = `
      <div class="atk-range-info">
        <div class="atk-range-title">
          📏 Дистанции (Rng = ${rng}м${rngMult !== 1 ? ` ×${rngMult}` : ""}${rngAdd !== 0 ? ` ${rngAdd >= 0 ? "+" : ""}${rngAdd}м` : ""} = ${effRng}м)
        </div>
        <div class="atk-range-grid">
          <span class="atr-zone atr-pb">В упор: 0,5–3м → <b>+30</b></span>
          <span class="atr-zone atr-sh">Короткая: 3–${Math.ceil(effRng / 2)}м → <b>+10</b></span>
          <span class="atr-zone atr-cb">Боевая: ${Math.ceil(effRng / 2)}–${effRng}м → <b>±0</b></span>
          <span class="atr-zone atr-lg">Дальняя: ${effRng}–${effRng * 2}м → <b>−10</b></span>
          <span class="atr-zone atr-ex">Экстрем.: ${effRng * 2}–${effRng * 3}м → <b>−30</b></span>
        </div>
        <div class="atk-range-note" style="font-size:0.82em;opacity:0.8;">В ближнем бою — дистанция в упор, но модификатор ±0.</div>
      </div>`;
  }

  let ammoDialogHtml = "";
  if (!isMelee) {
    const magCur   = sys.magazineCur || 0;
    const magMax   = sys.magazineMax || 0;
    const magCls   = magCur === 0 ? "ammo-empty"
      : magCur <= Math.ceil(magMax * 0.25) ? "ammo-low" : "";
    const ammoMods = loadedAmmo ? _buildAmmoModString(ammoSys) : "";
    ammoDialogHtml = `
      <div class="atk-ammo-block">
        <span class="atk-ammo-label">${rollIcon("spark","#8fd0ff")}Боеприпасы:</span>
        <span class="atk-ammo-name">${loadedAmmo ? esc(loadedAmmo.name) : "стандартные"}</span>
        ${ammoMods ? `<span class="atk-ammo-mods">(${ammoMods})</span>` : ""}
        <span class="atk-ammo-mag ${magCls}">Магазин: <b>${magCur}/${magMax}</b></span>
      </div>`;
  }

  const aimingHtml = `
    <div class="atk-dlg-modifiers">
      <div class="atk-mods-title">Прицеливание</div>
      <div class="atk-aiming-block">
        <label class="atk-aiming-label">
          <input type="radio" name="atk-aiming" value="none" data-bonus="0"
                 ${currentAiming === "none" ? "checked" : ""}/>
          <span>Без прицеливания (±0)</span>
        </label>
        <label class="atk-aiming-label">
          <input type="radio" name="atk-aiming" value="half" data-bonus="10"
                 ${currentAiming === "half" ? "checked" : ""}/>
          <span>Полу-прицеливание (+10)</span>
        </label>
        <label class="atk-aiming-label">
          <input type="radio" name="atk-aiming" value="full" data-bonus="20"
                 ${currentAiming === "full" ? "checked" : ""}/>
          <span>Полное прицеливание (+20)</span>
        </label>
      </div>
    </div>`;

  const commonMods = [
    { label: "Усталость",     value: -10, autoCheck: hasFatigue },
    { label: "Слабый свет",   value: -10 },
    { label: "Дым / туман",   value: isMelee ? -10 : -20 },
    { label: "Тьма",          value: isMelee ? -20 : -30 },
    { label: "Ослеплён",      value: isMelee ? -30 : -99, autofail: !isMelee },
    { label: "Цель лежит",    value: isMelee ?  20 : -20 },
    { label: "Цель бежит",    value: isMelee ?  20 : -20 },
    { label: "Цель Оглушена", value: 20 },
    { label: "Цель Врасплох", value: 30, immuneFlag: "attack.surpriseImmune" },
    { label: "Скрытая атака", value: 30, note: "цель не знает" }
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
  const charSwapWhy  = ruleFlagLabels(actor, "charSwap.wp.forWsS", attackCtx);
  const twoWeaponWhy = ruleFlagLabels(actor, "penalty.twoWeapon.off", attackCtx);
  const twoWeaponOff  = twoWeaponWhy.length > 0;
  // Дуэлянтское (стр. 73 Книги Аэльдари): бой 1-на-1, когда никто не мешает,
  // — +5 на все тесты с оружием. Считаем реальные контакты на карте
  // (meleeContactCount), а не спрашиваем игрока на глаз — галочка лишь
  // подтверждает то, что уже видно на сцене, и её можно снять руками.
  const duelContacts = (wp.duelingParry && attackerToken) ? meleeContactCount(attackerToken) : null;
  const specificMods = isMelee ? [
    { label: "Трудный ландшафт",       value: -10 },
    { label: "Очень трудный ландшафт", value: -20 },
    { label: "Числ. перевес 2к1",      value:  10 },
    { label: "Числ. перевес 3к1",      value:  20 },
    { label: "Положение выше",         value:  10 },
    { label: "Более длинное оружие",   value:   5 },
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
    { label: "Стрельба в рукопашную",   value: -20 },
    { label: "Дистанция в упор",        value:  30 },
    { label: "Короткая дистанция",      value:  10 },
    { label: "Боевая дистанция",        value:   0 },
    { label: "Дальняя дистанция",       value: -10 },
    { label: "Экстремальная дистанция", value: -30 },
    // Беспомощная цель, выстрел в упор/в рукопашной: как рукопашная — авто-
    // успех и удвоенный урон, а не просто +30 (см. targetHelpless выше). Это
    // ситуативный факт про конкретный выстрел (дистанция), а не хранимое
    // состояние — поэтому галочка, а не автоматика, ровно как «Дистанция в упор».
    ...(targetHelpless ? [{
      id: "atk-helpless-close", label: "Беспомощная цель: в упор / в рукопашной",
      value: 0, autosuccess: true,
      note: "заменяет +30 на авто-успех и ×2 урона"
    }] : [])
  ];

  const makeMods = arr => arr.map(m => {
    const isAF      = m.autofail === true;
    const isAS      = m.autosuccess === true;
    const isChecked = m.autoCheck === true;
    // Погашенный правилом цели модификатор не прячем: игрок должен видеть,
    // ПОЧЕМУ бонуса нет, а не гадать, куда делся пункт списка.
    const dispVal   = m.immune ? "иммунитет"
                    : (isAF ? "провал" : (isAS ? "авто-успех, ×2" : (m.value >= 0 ? `+${m.value}` : `${m.value}`)));
    const note      = m.note ? ` [${m.note}]` : "";
    return `<label class="attack-mod-check${isChecked ? " atk-mod-auto" : ""}${m.immune ? " atk-mod-immune" : ""}">
      <input type="checkbox" class="atk-mod-cb"
             ${m.id ? `id="${m.id}"` : ""}
             data-value="${(isAF || isAS) ? 0 : m.value}"
             ${isAF    ? 'data-autofail="true"' : ""}
             ${isAS    ? 'data-autosuccess="true"' : ""}
             ${m.immune ? "disabled" : ""}
             ${isChecked ? "checked" : ""}/>
      <span>${m.label} (${dispVal})${note}${isChecked ? " 😓" : ""}</span>
    </label>`;
  }).join("");

  const ammoBadge = (!isMelee && ammoAtkMod !== 0)
    ? `<span class="atk-ammo-badge">${rollIcon("spark","#8fd0ff")}Боеприпасы: ${ammoAtkMod >= 0 ? "+" : ""}${ammoAtkMod}</span>`
    : "";

  // ── Условные модификаторы боеприпаса (стр. 203) ──────────────────────────
  // «+10 против целей с душами», «+30 против псайкеров и демонов» и т.п.
  // Безусловно применять нельзя (зависит от цели), поэтому даём галочки —
  // и НЕ прячем в свёрнутый блок: их легко упустить, а они крупные.
  const ammoConds = (!isMelee && Array.isArray(ammoSys?.condMods)) ? ammoSys.condMods : [];
  const ammoCondHtml = ammoConds.length ? `
      <div class="av-ammo-cond">
        <div class="av-sec-lbl">${rollIcon("spark","#8fd0ff")}Боеприпас: ${esc(loadedAmmo?.name || "")}</div>
        ${ammoConds.map((c, i) => {
          const parts = [];
          if (c.atk) parts.push(`${c.atk > 0 ? "+" : ""}${c.atk}`);
          if (c.dmg) parts.push(`${c.dmg > 0 ? "+" : ""}${c.dmg} урона`);
          for (const k of (c.wp || [])) parts.push(WEAPON_PROPERTIES[k]?.label || k);
          const val = parts.length ? `<span class="avc-val">${parts.join(", ")}</span>` : "";
          const note = c.note ? `<span class="avc-note">${esc(c.note)}</span>` : "";
          // Пункты без числовых эффектов — просто памятка, без галочки.
          const isNote = !c.atk && !c.dmg && !(c.wp || []).length;
          return isNote
            ? `<div class="avc-row avc-row-note">${esc(c.label)} ${note}</div>`
            : `<label class="avc-row"><input type="checkbox" class="atk-ammo-cond"
                 data-idx="${i}" data-atk="${c.atk || 0}"/>
                 <span class="avc-lbl">${esc(c.label)}</span> ${val} ${note}</label>`;
        }).join("")}
      </div>` : "";
  const fatigueBadge = hasFatigue
    ? `<span class="atk-fatigue-badge">${rollIcon("warn","#ffb84d")}−10</span>`
    : "";
  // Бейдж препарата: показываем, если активные препараты меняют выбранную характеристику
  const drugCharMod  = actor.system.drugCharMods?.[charKey] ?? 0;
  const drugAtkBadge = drugCharMod !== 0
    ? `<span class="atk-drug-badge" title="Уже учтено в пороге">💊 ${drugCharMod > 0 ? "+" : ""}${drugCharMod}</span>`
    : "";

  // Свойства оружия — напоминание + чекбокс короткой дистанции + перезарядка
  const wpDialogList = wProps.map(p => {
    const r = p.def.rating ? ` (${p.rating ?? 0}${p.def.rating2 ? "/" + (p.rating2 ?? 0) : ""})` : "";
    const tip = esc(p.def.desc);
    return `<span class="atk-wprop-badge" title="${tip}">${p.def.label}${r}</span>`;
  }).join("");
  // Штраф Легиона уже сидит в пороге — здесь показываем, из чего он сложился.
  const legionHtml = legionFit.parts.length ? `
    <div class="atk-dlg-modifiers atk-legion-note">
      <div class="atk-mods-title">${rollIcon("gear","#ffb84d")}Легион: ${legionFit.total} к тесту</div>
      <div class="atk-wprops-list">${legionFit.parts
        .map(p => `<span class="atk-wprop-badge">${esc(p.label)} (${p.value})</span>`).join("")}</div>
    </div>` : "";
  // Штраф Арсенала (Weapon Training) — тот же приём, что у Легиона выше.
  const weaponTrainingHtml = weaponTraining.parts.length ? `
    <div class="atk-dlg-modifiers atk-legion-note">
      <div class="atk-mods-title">${rollIcon("gear","#ffb84d")}Арсенал: ${weaponTraining.total} к тесту</div>
      <div class="atk-wprops-list">${weaponTraining.parts
        .map(p => `<span class="atk-wprop-badge">${esc(p.label)} (${p.value})</span>`).join("")}</div>
    </div>` : "";
  const wpDialogHtml = (wProps.length ? `
    <div class="atk-dlg-modifiers">
      <div class="atk-mods-title">${rollIcon("gear","#8fd0ff")}Свойства оружия</div>
      <div class="atk-wprops-list">${wpDialogList}</div>
    </div>` : "") + legionHtml + weaponTrainingHtml;
  // Тактическая карта (wdbc-8k0i): «Короткая дистанция» по половине Дальности
  // (устоявшееся правило Мельты/Рассеивания в WH40k-семействе систем) — авто-
  // галочка, но её всё ещё можно снять руками, если ситуация особая.
  const autoShortRange = !!(measured && !isMelee && Number(sys.range) > 0
    && measured.edgeM <= Number(sys.range) / 2);
  const shortRangeHtml = wantShortBox ? `
    <label class="attack-mod-check">
      <input type="checkbox" id="atk-shortrange" class="atk-mod-cb" data-value="${wp.scatter ? 10 : 0}" ${autoShortRange ? "checked" : ""}/>
      <span>${rollIcon("target","#4dffa6")}Короткая дистанция / в упор${wp.meltaShort ? " — Мельта ×2 Проб." : ""}${wp.scatter ? " — Рассеив. +10/+1d10" : ""}</span>
    </label>` : "";
  // Полосы дальности: у оружия свой список бонусов по дистанции (стр. 193-197).
  // Числовых порогов (min/max, м) у контента пока почти нигде нет — где их
  // авторы проставят, выбор подставится сам; иначе остаётся текстовая подсказка
  // с измеренной дистанцией ниже, а полосу игрок выбирает по описанию сам.
  const bands = Array.isArray(sys.rangeBands) ? sys.rangeBands : [];
  const autoBandIdx = measured
    ? bands.findIndex(b => b.min != null && b.max != null && measured.edgeM >= b.min && measured.edgeM <= b.max)
    : -1;
  const bandHtml = bands.length ? `
    <label class="attack-mod-check attack-mod-select">
      <span>${rollIcon("target", "#8fd0ff")}Дистанция</span>
      <select id="atk-band">
        <option value="-1" ${autoBandIdx < 0 ? "selected" : ""}>Обычная — без бонусов</option>
        ${bands.map((b, i) => {
          const bits = [];
          if (b.dice) bits.push(`+${b.dice}d10 урона`);
          if (b.dmg)  bits.push(`+${b.dmg} урона`);
          if (b.pen)  bits.push(`+${b.pen} Проб.`);
          return `<option value="${i}" ${autoBandIdx === i ? "selected" : ""}>${b.label}${bits.length ? " — " + bits.join(", ") : ""}</option>`;
        }).join("")}
      </select>
    </label>` : "";
  const distanceHintHtml = measured ? `
    <div class="atk-distance-hint">${rollIcon("target","#8fd0ff")}Измеренная дистанция: ${measured.edgeM} м${Number(sys.range) ? ` (Дальность оружия: ${sys.range} м)` : ""}</div>` : "";
  // Выключенное оружие (стр. 209-211): цепное/шоковое/силовое можно погасить
  // свободным действием, и полем Haywire — принудительно.
  const OFF_HINT = { chain: "−2 урона, −1 Проб., без Рвущего",
                     shock: "как примитивное, −2 урона",
                     power: sys.offProfile?.name ? `как «${sys.offProfile.name}»` : "как примитивное" };
  const canOff  = ["chain", "shock", "power"].includes(sys.weaponType);
  const offHtml = (isMelee && canOff) ? `
    <label class="attack-mod-check">
      <input type="checkbox" id="atk-weaponoff"/>
      <span>${rollIcon("bolt", "#ff9d4d")}Оружие выключено / подавлено ЭМИ — ${OFF_HINT[sys.weaponType]}</span>
    </label>` : "";
  const maximalHtml = wantMaximal ? `
    <label class="attack-mod-check">
      <input type="checkbox" id="atk-maximal"/>
      <span>${rollIcon("bolt","#ffb84d")}Максимальный режим (+1d10 урона, +2 Проб., Взрыв(2), ×2 расход, Перезарядка)</span>
    </label>` : "";
  const rechargeWarnHtml = (!isMelee && sys.needsRecharge)
    ? `<div class="atk-recharge-warn">${rollIcon("bolt","#6fe6ff")}Оружие на подзарядке — стрельба раз в 2 хода.</div>`
    : "";

  // Режим атаки и прицеливание — компактными пилюлями (радио под ними).
  const rofPills = rofModes.map((mm, i) =>
    `<label class="av-pill"><input type="radio" name="atk-rof" value="${mm.value}" data-bonus="${mm.bonus}" ${i === 0 ? "checked" : ""}/><span>${mm.label}</span></label>`
  ).join("");
  const aimingPills = [["none", 0, "Без прицела"], ["half", 10, "Полу +10"], ["full", 20, "Полное +20"]].map(([v, bon, lbl]) =>
    `<label class="av-pill"><input type="radio" name="atk-aiming" value="${v}" data-bonus="${bon}" ${currentAiming === v ? "checked" : ""}/><span>${lbl}</span></label>`
  ).join("");

  // ── Стойка/База/Приём/Хват/Профиль — теперь выбираются прямо в диалоге ───
  // Под пилюлями каждой группы — своя заметка с полным текстом эффекта
  // текущего выбора (id для updateTotal ниже), тем же приёмом, что раньше
  // был только у Хвата/Профиля (общий atk-gripnote).
  // Тактическая карта (wdbc-8k0i): вид контакта — чисто информационно (нет
  // автоматических триггеров «Свободной Атаки», это ручная Реакция, стр. 12),
  // подсказывает игроку/ГМ, легален ли рукопашный Приём вообще.
  const CONTACT_BADGE = {
    deep: `<span class="atk-training-warn" title="Базы налагаются — как при переносе раненого">🔶 Глубокий контакт</span>`,
    base: `<span class="atk-training-warn" title="Грани Баз соприкасаются">⚔ Базовый контакт</span>`,
    none: `<span class="atk-training-warn" title="Базы не касаются — рукопашная может быть недоступна">⚠ Нет контакта</span>`
  };
  const contactBadgeHtml = (isMelee && measured) ? CONTACT_BADGE[measured.contact] : "";
  const maneuverBlockHtml = isMelee ? `
    <div class="av-section">
      ${contactBadgeHtml}
      <div class="av-sec-lbl">Приём</div>
      <div class="av-pills" id="atk-maneuver-pills">${pillsHtml("atk-maneuver", computeManeuverOptions(dyn0.baseKey, dyn0.pIdx), dyn0.maneuverKey)}</div>
      <div class="av-opt-note" id="atk-maneuver-note">${dyn0.mDef.note}</div>
    </div>` : "";
  const stanceBlockHtml = isMelee ? `
    <div class="av-section">
      <div class="av-sec-lbl">Стойка</div>
      <div class="av-pills" id="atk-stance-pills">${pillsHtml("atk-stance", computeStanceOptions(dyn0.pIdx), dyn0.stanceKey)}</div>
      <div class="av-opt-note" id="atk-stance-note">${dyn0.stDef.note}</div>
    </div>` : "";
  // Пилюли Базы зависят от Стойки (Частокол запрещает Натиск) — контейнер с
  // id, чтобы updateTotal мог перерисовать их при смене Стойки, не открывая
  // окно заново (см. render ниже).
  const baseBlockHtml = isMelee ? `
    <div class="av-section">
      <div class="av-sec-lbl">База</div>
      <div class="av-pills" id="atk-base-pills">${pillsHtml("atk-base", computeBaseOptions(dyn0.stanceKey), dyn0.baseKey)}</div>
      <div class="av-opt-note" id="atk-base-note">${dyn0.bDef.note}</div>
    </div>` : "";
  const gripBlockHtml = (isMelee && gripList.length > 1) ? `
    <div class="av-section">
      <div class="av-sec-lbl">Хват</div>
      <div class="av-pills" id="atk-grip-pills">${pillsHtml("atk-grip", computeGripOptions(dyn0.pIdx), dyn0.gKey)}</div>
    </div>` : "";
  // "Основной" тоже вариант выбора — поэтому порог "больше одного" по общему
  // числу опций (главный + доп. профили), а не только по числу доп. профилей.
  const profileBlockHtml = profileOptions.length > 1 ? `
    <div class="av-section">
      <div class="av-sec-lbl">Профиль</div>
      <div class="av-pills">${pillsHtml("atk-profile", profileOptions, dyn0.pIdx, "idx")}</div>
    </div>` : "";
  const techSectionsHtml = `${maneuverBlockHtml}${stanceBlockHtml}${baseBlockHtml}${gripBlockHtml}${profileBlockHtml}`;

  // Не <form>: содержимое DialogV2 уже лежит внутри его собственной формы, а
  // вложенная форма недопустима — браузер её выбросит вместе с оформлением.
  const content = `
    <div class="wh-attack-form wh-atk-v2">
      <div class="av-header">
        <span class="av-name">${esc(item.name)}</span>
        <span class="av-class">${forceMelee ? "в упор / приклад" : (WEAPON_CLASSES[sys.weaponClass] || "")}</span>
        <span class="av-badges" id="atk-badges">${badgesHtml(dyn0)}</span>
      </div>

      <div class="av-preview">
        <div class="av-prev-lbl">Итоговый порог теста</div>
        <div class="av-prev-total" id="atk-total-display">${charVal}</div>
      </div>

      ${ammoDialogHtml}${rechargeWarnHtml}${wpDialogHtml}

      <div class="av-row">
        <label>Характеристика</label>
        <select id="atk-char" class="av-input">
          ${Object.entries(CHARACTERISTICS).map(([k, m]) => {
            const v = actor.system.characteristics[k]?.total ?? 0;
            // Список характеристик и так полный — ГМ волен бросить чем угодно.
            // Локус Мутации (стр. 28, 32) делает бросок по Воле вместо WS/S
            // законным, и это подписывается прямо в пункте: иначе игрок не
            // отличит разрешённую книгой подмену от самоуправства.
            const swap = (k === "wp" && charSwapWhy.length)
              ? ` — вместо ${isMelee ? "WS" : "BS"}: ${charSwapWhy.join(", ")}` : "";
            return `<option value="${k}" ${k === charKey ? "selected" : ""}>${m.abbr} (${v})${swap}</option>`;
          }).join("")}
        </select>
        <label>Доп. мод</label>
        <input id="atk-modifier" class="av-input av-num" type="number" value="${presetModifier}"/>
      </div>
      <div class="av-row">
        <label>Бонус урона</label>
        <input id="atk-dmg-bonus" class="av-input av-num" type="number" value="0"
               title="Ручной бонус к урону этой атаки — прибавляется к итоговому урону после броска, отдельно от порога теста"/>
      </div>
      ${(isMelee && hasDeathDance(actor)) ? `
      <div class="av-row" id="atk-death-dance-row">
        <label>Death Dance</label>
        <button type="button" id="atk-death-dance-btn" class="av-pill av-pill-disabled" disabled><span>+ Brutal Charge</span></button>
        <span class="av-opt-note" id="atk-death-dance-status"></span>
      </div>` : ""}
      ${wp.changeRating ? `
      <div class="av-row">
        <label class="attack-mod-check">
          <input type="checkbox" id="atk-change-soulless"/>
          Цель бездушна/техника (Перемены: +${wp.changeRating} Pen, не к попаданию)
        </label>
      </div>` : ""}
      <div class="av-row">
        <label>Укрытие</label>
        <input id="atk-cover" class="av-input av-num" type="number" value="${autoCoverMod}"
               title="Авто по зоне Укрытия на линии огня (regions/cover.mjs) — всегда можно поправить руками"/>
      </div>
      ${attackerMount ? `
      <div class="av-row">
        <label>Штраф стрельбы с седла</label>
        <input id="atk-mount-ranged" class="av-input av-num" type="number" value="${autoMountRangedMod}"
               title="Авто по скорости скакуна/байка на панели «ВЕРХОМ» — для Интегрированного Оружия (0) или турели Коляски (сниженный штраф) поправьте вручную"/>
      </div>` : ""}

      ${techSectionsHtml}
      <div class="av-opt-note" id="atk-gripnote">${dyn0.note}</div>

      <div class="av-section">
        <div class="av-sec-lbl">Режим атаки</div>
        <div class="av-pills">${rofPills}</div>
      </div>
      <div class="av-section">
        <div class="av-sec-lbl">Прицеливание</div>
        <div class="av-pills">${aimingPills}</div>
      </div>

      <div class="av-row">
        <label>Избирательная атака</label>
        <select id="atk-aim" class="av-input av-wide">${aimHtml}</select>
      </div>
      ${mountHtml}

      ${rangeInfoHtml}
      ${distanceHintHtml}
      ${shortRangeHtml}${bandHtml}${offHtml}${maximalHtml}
      ${ammoCondHtml}
      ${ruleMods.html}
      ${ruleRerolls.html}
      ${diceModeHtml()}

      <details class="av-adv">
        <summary>Ситуативные модификаторы<span class="av-adv-hint">— разверни, если нужны</span></summary>
        <div class="av-mod-block">
          <div class="av-mod-head">Общие</div>
          <div class="av-mod-grid">${makeMods(commonMods)}</div>
        </div>
        <div class="av-mod-block">
          <div class="av-mod-head">${isMelee ? "Рукопашные" : "Стрелковые"}</div>
          <div class="av-mod-grid">${makeMods(specificMods)}</div>
        </div>
        <div class="av-mod-block">
          <div class="av-mod-head">Особые атаки</div>
          <div class="av-mod-col">
            <!-- Быстрая/Молниеносная Атака переехали в Приём (стр. 14, требуют
                 соответствующий Талант) — см. MELEE_MANEUVERS.swift/lightning. -->
            <label class="attack-mod-check"><input type="checkbox" id="atk-allout"/><span>Атака всем телом (+20, теряет Уклонение)</span></label>
          </div>
        </div>
      </details>
    </div>`;

  /**
   * Порог теста по прочитанной форме. Мод хвата и мод препаратов (в char.total)
   * уже внутри базы; характеристику игрок может сменить в окне, а Стойка/База/
   * Приём/Хват — прямо в этом же диалоге, поэтому база считается здесь заново
   * из текущего выбора (resolveSelection), а не берётся из charVal.
   */
  const thresholdOf = f => {
    const sel = resolveSelectionSafe(f);
    return attackThreshold({
      base: (actor.system.characteristics[f.char]?.total ?? 0)
            + (sys.attackBonus || 0) + wpAttackMod + sel.techBon + sel.stanceBon + ammoAtkMod + sel.gWs
            + (wp.noAim ? 0 : f.aimBonus),
      mods: [f.modifier, f.coverMod, f.mountRangedMod, f.sitMods + f.ammoMods + f.ruleMods, f.rofBonus, f.aimPenalty,
             f.mountPenalty, f.extraBonus],
      halvePenalty: f.halvePenalty
    });
  };

  // .then ниже: DialogV2 резолвит результат как `(await callback(...)) ?? action`
  // (scripts/foundry.mjs, #_onSubmit) — вернуть отсюда null нельзя, он подменится
  // на строку «roll»/«cancel». Кнопки возвращают false, а «отменой» его делает
  // этот же .then — контракт «null — отмена» остаётся прежним.
  return foundry.applications.api.DialogV2.wait({
    window: { title: `Атака: ${item.name}` },
    classes: ["warhammer-dbc", "wh-holo", "wh-attack-dialog", "wh-atk-dialog"],
    position: { width: 420 },
    content,
    // Закрыть окно — это отмена, а не ошибка: вызывающий ждёт null, а не бросок.
    rejectClose: false,
    buttons: [
      {
        action: "roll", label: "Бросок!", icon: "fas fa-dice-d10", class: "roll", default: true,
        callback: async (event, button) => {
          const f = readAttackForm(button.form, ammoConds);

          if (f.autoFail) {
            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: actor }),
              content: `<div class="wh-roll-result">
                <div class="roll-header">${rollIcon("sword")}${esc(item.name)}</div>
                <div class="roll-outcome">
                  <span class="roll-failure">Автоматический провал (Ослеплён)</span>
                </div></div>`
            });
            return false;
          }

          const sel = resolveSelectionSafe(f);

          if (sel.blocked) {
            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: actor }),
              content: `<div class="wh-roll-result">
                <div class="roll-header">${rollIcon("sword")}${esc(item.name)}</div>
                <div class="roll-outcome">
                  <span class="roll-failure">Защитная Стойка без щита — атака запрещена (стр. 15)</span>
                </div></div>`
            });
            return false;
          }

          // Экономика действий (стр. 12, wdbc-niv7): рукопашная атака тратит
          // ОД по actionType выбранной Базы (MELEE_BASES) — Натиск/Полная
          // Атака и т.п. уже несут это поле. Стрелковые режимы (rofModes)
          // пока не несут своего actionType (нерешённая часть wdbc-niv7,
          // не связанная с Движением) — для них ОД сознательно не тратятся.
          const apCost = isMelee ? apCostForActionType(sel.bDef.actionType) : 0;
          if (!await spendActionPoints(actor, apCost)) {
            ui.notifications.warn("⚠️ Не хватает ОД.");
            return false;
          }

          // Стойка/База — персистентны на акторе (как радио на вкладке БОЙ),
          // Хват/Профиль — во флагах предмета (как раньше в HUD): выбор в этом
          // диалоге должен остаться в силе и после закрытия окна, а не сбрасываться.
          const actorUpdates = { "system.aiming": "none" };
          if (isMelee && sel.stanceKey !== stance) actorUpdates["system.meleeStance"] = sel.stanceKey;
          if (isMelee && !fullAttackForced && sel.baseKey !== meleeBaseKey) actorUpdates["system.meleeBase"] = sel.baseKey;
          await actor.update(actorUpdates);
          if (isMelee && sel.gKey !== gripKey) await item.setFlag?.("warhammer-dbc", "hudGrip", sel.gKey);
          if (sel.pIdx !== profIdx) await item.setFlag?.("warhammer-dbc", "hudProfile", sel.pIdx);
          // Локус Сокрушения тратится реальным броском — отменённая или
          // закрытая атака способность не расходует (см. meleeBaseKey выше).
          if (fullAttackForced) await markRoundCapabilityUsed(actor, FULL_ATTACK_CAPABILITY);

          // Приём выбран в этом же окне — свежий techniqueOpts под конкретный
          // выбор (targetDodgeMod/targetParryMod/chatNote и т.п. зависят от него).
          const finalTechniqueOpts = isMelee ? {
            ...techniqueOpts,
            technique:      sel.maneuverKey,
            techniqueLabel: sel.mDef.label,
            techniqueNote:  sel.mDef.note,
            chatNote:       sel.mDef.chatNote,
            targetDodgeMod: sel.targetDodgeMod,
            targetParryMod: sel.targetParryMod,
            extraBonus:     sel.mDef.wsBonus,
            stanceLabel:    sel.stDef.label
          } : techniqueOpts;

          // Беспомощная цель: рукопашная — всегда, стрелковая — только если
          // отмечена галочка «в упор / в рукопашной» (см. specificMods выше).
          const helplessAutoHit = helplessAutoMelee || f.autoSuccess;

          await _executeAttackRoll(
            actor, item, f.char, thresholdOf(f),
            f.rofMode || rofModes[0]?.value,
            aimTargets.find(t => t.value === f.aimVal),
            {
              forceHit: helplessAutoHit, doubleDamage: helplessAutoHit,
              // Быстрая/Молниеносная — теперь Приём (стр. 14), а не отдельная
              // галочка: множитель попаданий включается выбором пилюли.
              isSwift: sel.maneuverKey === "swift", isLightning: sel.maneuverKey === "lightning",
              isAllOut: f.allOut,
              // Переброс от правила (Локус Буйства) или общий Кубик —
              // бросок катает несколько кубов и оставляет один — см.
              // combat/attack.mjs. crit — расширение диапазона Критического
              // Успеха/Провала тем же правилом (kind:"critRangeMod"); сам
              // натуральный диапазон 1-5/96-100 применяется уже в attack.mjs.
              reroll: f.reroll,
              crit: resolveTest({ actor, ...attackCtx }).crit,
              forcedDefenceReroll,
              techniqueOpts: finalTechniqueOpts,
              dmgBonus: f.dmgBonus, changeSoulless: f.changeSoulless,
              shortRange: f.shortRange, maximal: f.maximal, bandIdx: f.bandIdx,
              profile: sel.prof, attackNote: sel.note,
              weaponOff: f.weaponOff, gripKey: sel.gKey,
              gripProps: sel.gDef ? sel.gDef.addProps : [],
              gripDmgFlat: sel.gDef ? sel.gDef.dmgFlat : 0,
              gripSbHalf: sel.gDef ? sel.gDef.sbHalf : false,
              // Условные эффекты боеприпаса, отмеченные игроком (стр. 203).
              ammoCondProps:  f.ammoSel.flatMap(c => c.wp || []),
              ammoCondDmg:    f.ammoSel.reduce((n, c) => n + (c.dmg || 0), 0),
              ammoCondLabels: f.ammoSel.map(c => c.label),
              aimingLabel: (f.aiming !== "none" && !wp.noAim)
                ? (f.aiming === "half" ? "Полу-прицеливание (+10)" : "Полное прицеливание (+20)")
                : "",
              // Кого выцелили в паре: урон применяют к листу, а на сцене у пары
              // обычно один токен — без этой строки попадание во всадника ушло
              // бы скакуну просто потому, что кликнули по видимому токену.
              mountNote: mountPair && f.mountPick && f.aimVal
                ? (f.mountPick === "rider"
                    ? `Верхом: попадание во ВСАДНИКА — ${mountPair.rider.name}`
                    : `Верхом: попадание в скакуна — ${mountPair.mount.name}`)
                : (mountPair
                    ? `Верхом: не-Избирательная атака — попадание в скакуна (${mountPair.mount.name}), дубль на броске — во всадника (${mountPair.rider.name})`
                    : "")
            }
          );
          return true;
        }
      },
      // `false`, а не `null`: `null` DialogV2 подменяет на сам action («cancel»)
      // — см. комментарий у pickFromList (sheets/item-sheet.mjs).
      { action: "cancel", label: "Отмена", callback: () => false }
    ],
    render: (event, dialog) => {
      const form    = dialog.element.querySelector("form");
      const display = form.querySelector("#atk-total-display");
      const hint    = form.querySelector(".av-adv-hint");

      const badgesEl        = form.querySelector("#atk-badges");
      const noteEl          = form.querySelector("#atk-gripnote");
      const stanceNoteEl    = form.querySelector("#atk-stance-note");
      const baseNoteEl      = form.querySelector("#atk-base-note");
      const maneuverNoteEl  = form.querySelector("#atk-maneuver-note");
      const basePillsEl     = form.querySelector("#atk-base-pills");
      const stancePillsEl   = form.querySelector("#atk-stance-pills");
      const gripPillsEl     = form.querySelector("#atk-grip-pills");
      const maneuverPillsEl = form.querySelector("#atk-maneuver-pills");
      let lastStanceKey = dyn0.stanceKey;
      let lastBaseKey   = dyn0.baseKey;
      let lastProfIdx   = dyn0.pIdx;

      const updateTotal = () => {
        const f = readAttackForm(form, ammoConds);
        // Стойка/База/Приём/Хват/Профиль меняются прямо в форме — заголовок и
        // сводки эффектов должны обновляться вместе с порогом, иначе бейджи и
        // заметки показывают устаревший выбор до следующего открытия окна.
        const sel = resolveSelectionSafe(f);
        if (badgesEl)       badgesEl.innerHTML       = badgesHtml(sel);
        if (noteEl)         noteEl.innerHTML         = sel.note;
        if (stanceNoteEl)   stanceNoteEl.innerHTML   = sel.stDef.note;
        if (baseNoteEl)     baseNoteEl.innerHTML     = sel.bDef.note;
        if (maneuverNoteEl) maneuverNoteEl.innerHTML = sel.mDef.note;
        // База зависит от выбранной Стойки (Частокол запрещает Натиск, стр. 15) —
        // перерисовываем пилюли только когда Стойка реально поменялась, чтобы
        // не сбрасывать фокус на каждый несвязанный ввод в форме.
        if (basePillsEl && sel.stanceKey !== lastStanceKey) {
          lastStanceKey = sel.stanceKey;
          basePillsEl.innerHTML = pillsHtml("atk-base", computeBaseOptions(sel.stanceKey), sel.baseKey);
        }
        // Смена Профиля меняет категорию оружия (у альт-профиля своя «голова»,
        // см. categoryFor выше) — вместе с ней и доступность Стойки/Хвата, а
        // через Тренировку — и Приёма. Приём вдобавок зависит от Базы (см. ниже).
        const profChanged = sel.pIdx !== lastProfIdx;
        if (stancePillsEl && profChanged) {
          stancePillsEl.innerHTML = pillsHtml("atk-stance", computeStanceOptions(sel.pIdx), sel.stanceKey);
        }
        if (gripPillsEl && profChanged) {
          gripPillsEl.innerHTML = pillsHtml("atk-grip", computeGripOptions(sel.pIdx), sel.gKey);
        }
        // Приём зависит от выбранной Базы (стр. 14, MELEE_MANEUVERS[*].bases) И
        // от категории по Профилю — перерисовываем при смене любого из них.
        if (maneuverPillsEl && (sel.baseKey !== lastBaseKey || profChanged)) {
          maneuverPillsEl.innerHTML = pillsHtml("atk-maneuver", computeManeuverOptions(sel.baseKey, sel.pIdx), sel.maneuverKey);
        }
        lastBaseKey = sel.baseKey;
        lastProfIdx = sel.pIdx;
        if (sel.blocked) {
          display.textContent = "ЗАБЛОКИРОВАНО";
          display.style.color = "#8b0000";
          return;
        }
        if (f.autoFail) {
          display.textContent = "ПРОВАЛ";
          display.style.color = "#8b0000";
          return;
        }
        if (helplessAutoMelee || f.autoSuccess) {
          display.textContent = "АВТО-УСПЕХ ×2";
          display.style.color = "#ff6b6b";
          return;
        }
        display.textContent = thresholdOf(f);
        display.style.color = "";
        // Блок ситуативных свёрнут по умолчанию, поэтому его сводка должна быть
        // видна в заголовке — иначе авто-отметки (Усталость, Ослеплён) молча
        // уходят в порог, и непонятно, откуда взялся модификатор.
        if (f.sitPicked.length) {
          const names = f.sitPicked.map(cb =>
            (cb.closest?.("label")?.textContent ?? "").trim().replace(/\s+/g, " "));
          const sign  = f.sitMods > 0 ? "+" : "";
          hint.classList.add("is-active");
          hint.textContent =
            `— активно ${f.sitPicked.length}${f.sitMods ? ` (${sign}${f.sitMods})` : ""}: ${names.join(", ")}`;
        } else {
          hint.classList.remove("is-active");
          hint.textContent = "— разверни, если нужны";
        }
      };

      // Death Dance / Смертельный Танец (wdbc-sk8s) — кнопка живёт своим
      // слушателем рядом с общим updateTotal: активна только при выбранной
      // Базе «Натиск» и хватающих Очках Судьбы на эскалирующую цену (см.
      // module/combat/death-dance.mjs). Добавляет +A.b в то же поле «Бонус
      // урона», что игрок и так может вписать руками — не отдельный путь
      // в attack.mjs.
      const ddBtn    = form.querySelector("#atk-death-dance-btn");
      const ddStatus = form.querySelector("#atk-death-dance-status");
      if (ddBtn) {
        const refreshDeathDance = () => {
          const sel = resolveSelectionSafe(readAttackForm(form, ammoConds));
          const isCharge   = sel.baseKey === "charge";
          const cost       = deathDanceNextCost(actor);
          const fate       = actor.system.fate?.value ?? 0;
          const affordable = cost === 0 || fate >= cost;
          ddBtn.disabled   = !isCharge || !affordable;
          ddBtn.classList.toggle("av-pill-disabled", !isCharge || !affordable);
          ddStatus.textContent = !isCharge
            ? "— доступно только при Базе «Натиск»"
            : cost === 0
              ? "— бесплатно (первый раз в этом бою)"
              : `— цена ${cost} Очков Судьбы${affordable ? "" : " (не хватает)"}`;
        };
        ddBtn.addEventListener("click", async ev => {
          ev.preventDefault();
          const sel = resolveSelectionSafe(readAttackForm(form, ammoConds));
          if (sel.baseKey !== "charge") return;
          const cost = deathDanceNextCost(actor);
          const fate = actor.system.fate?.value ?? 0;
          if (cost > 0) {
            if (fate < cost) return ui.notifications.warn("Не хватает Очков Судьбы для повторного Смертельного Танца.");
            await actor.update({ "system.fate.value": fate - cost });
          }
          await markDeathDanceUsed(actor);
          const agBonus  = Number(actor.system.characteristics?.ag?.bonus) || 0;
          const dmgInput = form.querySelector("#atk-dmg-bonus");
          dmgInput.value = (parseInt(dmgInput.value) || 0) + agBonus;
          ui.notifications.info(`Смертельный Танец: +${agBonus} к Бонусу урона (Brutal Charge).`);
          refreshDeathDance();
          updateTotal();
        });
        form.addEventListener("change", refreshDeathDance);
        form.addEventListener("input",  refreshDeathDance);
        refreshDeathDance();
      }

      // Один слушатель на форму вместо списка селекторов: события всплывают,
      // и новая галочка в разметке не требует правки этого места.
      form.addEventListener("change", updateTotal);
      form.addEventListener("input",  updateTotal);
      // Сворачивание «Ситуативные модификаторы» — подгоняем высоту окна.
      form.querySelector(".av-adv")
          ?.addEventListener("toggle", () => dialog.setPosition({ height: "auto" }));
      updateTotal();
    }
  }).then(res => res === false ? null : res);
}

export async function showAttackDialogNoWeapon(actor, techDef) {
  const ws       = actor.system.characteristics.ws?.total ?? 0;
  const stance   = actor.system.meleeStance || "standard";
  const stBon    = MELEE_STANCES[stance]?.wsBonus ?? 0;
  // База (стр. 13) — та же логика, что в showAttackDialog: складывается с
  // бонусом Приёма, а не заменяет его. Локус Сокрушения подменяет её на
  // «Полная Атака», пока не потрачена в текущем Раунде (см. FULL_ATTACK_CAPABILITY
  // выше) — здесь бросок безусловный (нет кнопки/отмены), поэтому расходуется
  // сразу, вместе с чтением.
  const fullAttackForced = hasRuleFlag(actor, FULL_ATTACK_CAPABILITY)
    && isRoundCapabilityAvailable(actor, FULL_ATTACK_CAPABILITY);
  if (fullAttackForced) await markRoundCapabilityUsed(actor, FULL_ATTACK_CAPABILITY);
  const meleeBaseKey = fullAttackForced ? "fullatk" : (actor.system.meleeBase || "standard");
  const baseBon  = MELEE_BASES[meleeBaseKey]?.wsBonus ?? 0;
  const fatigue  = fatiguePenalty(actor, "ws");
  // WS уже включает мод препаратов (см. prepareDerivedData)
  const final    = ws + techDef.wsBonus + baseBon + stBon + fatigue;

  // Беспомощная цель, рукопашная (в т.ч. безоружная) — авто-успех и ×2 урона,
  // как и в showAttackDialog (см. helplessAutoMelee там же).
  const targetHelpless = !!([...(game.user?.targets ?? [])][0]?.actor)?.system?.conditions?.helpless;

  const roll     = await new Roll("1d100").evaluate();
  const rv       = roll.total;
  const { success: hit, deg } = testOutcome(rv, final, { autoSuccess: targetHelpless });
  const rollMode = game.settings.get("core", "rollMode");
  const outcome  = hit
    ? `<span class="roll-success">Попадание — ${deg} ${_degWord(deg)}</span>`
    : `<span class="roll-failure">Промах — ${deg} ${_degWord(deg)}</span>`;
  const helplessNote = targetHelpless
    ? `<div class="roll-allout-note">🪢 Цель Беспомощна: попадание автоматическое, урон ×2 (до Поглощения).</div>`
    : "";

  const defButtons = hit ? `
    <div class="roll-defense-section">
      <div class="roll-defense-title">${rollIcon("shield","#4dffa6")}Защита цели (выберите токен защищающегося):</div>
      <div class="roll-defense-btns">
        <button class="wh-dodge-btn" type="button" data-extra-mod="0">Уклонение</button>
        <button class="wh-parry-btn" type="button" data-extra-mod="0">Парирование</button>
      </div>
    </div>` : "";

  // Урон безоружного удара, стр. 40 (сейчас сюда доходит только импровизация
  // стрелковым оружием в упор — gunMeleeStrike в apps/hud.mjs; Кулак/Пинок/
  // Удар головой переехали в обычные Item'ы, module/sheets/attack-dialog.mjs
  // showAttackDialog, с альт-профилем Unarmed Warrior вместо этой ветки).
  const allRolls = [roll];
  let unarmedDmgSection = "";
  if (hit && techDef.damage) {
    const dmgFormula = resolveCharFormula(techDef.damage, actor.system.characteristics, actor.system.corruptionBonus ?? 0);
    try {
      const dmgRoll = await new Roll(dmgFormula).evaluate();
      allRolls.push(dmgRoll);
      const dmgTotal = targetHelpless ? dmgRoll.total * 2 : dmgRoll.total;
      const dtLabel = DAMAGE_TYPES[techDef.damageType] || techDef.damageType || "Ударный";
      unarmedDmgSection = `
        <div class="roll-damage-section">
          <div class="roll-damage-label">Урон (${dtLabel}, Проб. ${techDef.pen || 0}): <b>${dmgTotal}</b>${techDef.props ? ` · ${techDef.props}` : ""}</div>
          <button class="wh-apply-dmg-btn" type="button"
            data-damage="${dmgTotal}" data-penetration="${techDef.pen || 0}"
            data-damage-type="${techDef.damageType || "impact"}" data-hit-location="Торс"
            data-primitive="1" data-weapon-name="${techDef.label}" data-attacker="${actor.name}">
            Применить урон: ${dmgTotal} → Торс
          </button>
        </div>`;
    } catch (e) { console.error("Безоружный урон:", e); }
  }

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-technique-block">${rollIcon("sword")}Приём: <b>${techDef.label}</b>
          ${techDef.chatNote
            ? `<div class="roll-technique-note">${techDef.chatNote}</div>` : ""}
        </div>
        <div class="roll-header">${rollIcon("sword")}${techDef.label} ${techDef.headerSuffix ? `— ${techDef.headerSuffix}` : "(без оружия)"}</div>
        <div class="roll-threshold">
          WS: <b>${ws}</b>
          база ${baseBon >= 0 ? "+" : ""}${baseBon}${fullAttackForced ? " (Локус Сокрушения)" : ""}
          ${stBon !== 0 ? ` стойка ${stBon >= 0 ? "+" : ""}${stBon}` : ""}
          ${techDef.wsBonus !== 0 ? ` ${techDef.wsBonus >= 0 ? "+" : ""}${techDef.wsBonus}` : ""}
          ${fatigue !== 0 ? ` усталость ${fatigue}` : ""}
          → Порог: <b>${final}</b>
        </div>
        <div class="roll-dice">Бросок: <b>${rv}</b></div>
        <div class="roll-outcome">${outcome}</div>
        ${helplessNote}
        ${unarmedDmgSection}
        ${defButtons}
      </div>`,
    rolls: allRolls, sound: CONFIG.sounds.dice
  }, rollMode));
}
