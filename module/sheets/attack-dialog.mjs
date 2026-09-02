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
import { MELEE_STANCES, MELEE_BASES, MELEE_MANEUVERS, GRIPS, parseGrips, gripEffects,
         RANGED_GRIPS, rangedGripEffects } from "../constants/combat.mjs";
import { WEAPON_PROPERTIES }                  from "../constants/weapon-properties.mjs";
import { rollIcon }                           from "../constants/roll-icons.mjs";
import { qualityEffects }                     from "../constants/quality.mjs";
import { _degWord, _buildAmmoModString, resolveCharFormula, esc } from "../helpers/utils.mjs";
import { _executeAttackRoll }                 from "../combat/attack.mjs";
import { attackThreshold }                    from "../combat/attack-threshold.mjs";
import { resolveWeaponPropsList, aggregateAuto } from "../combat/weapon-properties.mjs";
import { getModEffects, mergeWeaponPropEntries, getInstalledMods } from "../combat/weapon-mods.mjs";
import { hasRecoilSuppressor } from "../combat/armor-mods.mjs";
import { hasRuleFlag, ruleFlagLabels }        from "../rules/flags.mjs";
import { isRoundCapabilityAvailable, markRoundCapabilityUsed } from "../apps/game-session.mjs";
import { mountPairFor, mountSelectiveMod, SELECTIVE_MODS,
         mountRangedPenalty, MOUNT_SPEEDS, mountTraits, handsNeeded } from "../rules/mount.mjs";
import { vehicleCoverMod } from "../rules/vehicle.mjs";
import { legionAttackPenalty, LEGION_FIT_FLAG } from "../rules/legion-fit.mjs";
import { meleeTrainingStatus, weaponTrainingPenalty } from "../rules/weapon-training.mjs";
import { MELEE_CATEGORIES, sameCategory } from "../constants/weapon-categories.mjs";
import { isHandShield } from "../combat/hand-shield.mjs";
import { weaponHandsRequired, handsOccupied } from "../rules/hands.mjs";
import { isFusedByHandOfDeath } from "../rules/hand-of-death.mjs";
import { CAPABILITIES } from "../constants/capabilities.mjs";
import { ruleRollModsHtml, ruleRerollsHtml } from "../rules/roll-mods.mjs";
import { resolveTest } from "../rules/resolve-test.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { fatiguePenalty }                     from "./tabs/conditions.mjs";
import { diceModeHtml, mergeReroll } from "../rules/test-kind-widget.mjs";
import { spendActionPoints, apCostForActionType, spendReaction } from "../combat/action-economy.mjs";
import { measureTokens, meleeContactCount, hasHighGround } from "../combat/tactical-map.mjs";
import { rangeBandKey, rangeBandBoundaries }   from "../rules/tactical-map.mjs";
import { getTerrainInfoForToken }             from "../regions/difficult-terrain.mjs";
import { coverBonusForShot }                  from "../combat/cover.mjs";
import { hasDeathDance, deathDanceNextCost, markDeathDanceUsed } from "../combat/death-dance.mjs";
import { actorHasAspectPath } from "../constants/aeldari-paths.mjs";

// Локус Сокрушения (стр. 31): раз в Раунд любая рукопашная атака (с оружием
// и голыми руками) считается имеющей Базу «Полная Атака» — см. meleeBaseKey
// в showAttackDialog/showAttackDialogNoWeapon ниже.
const FULL_ATTACK_CAPABILITY = "technique.baseFullAttack";

// Локус Неизбежности (стр. 30, wdbc-smc): раз в Раунд рукопашная атака может
// попасть автоматически с 1 Успехом (вместо броска) — штраф −10 до начала
// следующего Хода ставится флагом, читает module/rules/sources.mjs
// (daemonInevitability), снимает action-economy.mjs::resetActionEconomy.
const AUTO_HIT_CAPABILITY = "autoHit.melee.oncePerRound";

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
    // Fanning / Быстрый Курок (wdbc-fy33): RoF Длинной очереди 2..BS.b по
    // выбору — 0 значит «поля в форме нет» (Талант неактивен для этого броска).
    fanningRof: parseInt(el("#atk-fanning-rof")?.value) || 0,
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
    autoHit: on("#atk-autohit"),
    shortRange: on("#atk-shortrange"),
    // Карабин (wdbc-z56a): нужен на исполнении броска, чтобы дать цели +10
    // вместо +30 на Уклонение — см. #atk-melee-shot в specificMods выше.
    meleeShot:  on("#atk-melee-shot"),
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

  // ── Хват и профиль: значения по умолчанию (из HUD-флагов оружия или opts) ──
  //   Теперь выбираются прямо в этом окне (см. resolveSelection ниже) — эти
  //   переменные лишь стартовые значения, с которых открывается диалог.
  //   sys.grips — общее поле обоих классов оружия (module/data/item/weapon.mjs),
  //   parseGrips тот же для рукопашного и дальнобойного (wdbc-3hxg) — токены
  //   "1р"/"2р" валидны в обоих реестрах (GRIPS и RANGED_GRIPS).
  //   Доп. хваты сверх собственного sys.grips предмета (только дальнобойное):
  //   Pistol Grip (weaponMod.grantsGrip, wdbc-8vp1), Commando (карабин 1р как
  //   пистолет, wdbc-eduq) и Double Grip (пистолет 2р, wdbc-mu6v) — их самих
  //   на предмете нет, добавляются здесь.
  const installedMods   = isMelee ? [] : getInstalledMods(actor, item);
  const modGrantedGrips = installedMods.map(m => m.system?.grantsGrip).filter(Boolean);
  const commandoGrip    = (!isMelee && wp.carbine && hasRuleFlag(actor, "weapon.commandoCarbine")) ? "1р" : null;
  const doubleGripGrip  = (!isMelee && sys.weaponClass === "pistol" && hasRuleFlag(actor, "weapon.doubleGripPistol")) ? "2р" : null;
  const extraGrips = [...modGrantedGrips, ...(commandoGrip ? [commandoGrip] : []), ...(doubleGripGrip ? [doubleGripGrip] : [])];
  const ownGrips = parseGrips(sys.grips);
  // Предмет без собственного sys.grips (пак ещё не заполнен, стр. 171) —
  // добавляем природный Хват по классу, иначе доп. Хват окажется в списке
  // ОДИН, а пилюли Хвата рисуются только при >1 варианте (gripBlockHtml ниже).
  const classDefaultGrip = ["pistol", "thrown"].includes(sys.weaponClass) ? "1р" : "2р";
  const baseGrips = (ownGrips.length || !extraGrips.length) ? ownGrips : [classDefaultGrip];
  // Рука Смерти (wdbc-hftn, стр. 46): сросшееся оружие — всегда «1р», никаких
  // альтернативных хватов (Об/Бл/Кл/Мх/Хв) и никакого «2р» даже у профильно
  // двуручного/тяжёлого — единственный пункт списка, пилюли Хвата не рисуются.
  const gripList  = isFusedByHandOfDeath(item) ? ["1р"] : [...new Set([...baseGrips, ...extraGrips])];
  const primGrip  = gripList[0] || "";
  // S.b — нужен только для гейта Отдачи (стр. 166): персонаж с S.b меньше
  // рейтинга свойства не может выбрать "1р", должен стрелять "2р".
  const sBonus    = actor.system.characteristics?.s?.bonus ?? 0;
  // Рука Смерти форсирует "1р" безусловно — игнорирует и techniqueOpts, и
  // сохранённый hudGrip (тот же выбор, что currentMeleeGrip в hands.mjs).
  const gripKey   = isFusedByHandOfDeath(item) ? primGrip
                 : (techniqueOpts.gripKey
                 ?? item.getFlag?.("warhammer-dbc", "hudGrip")
                 ?? primGrip);
  // Double Grip (wdbc-mu6v, стр. 62): держа пистолет "2р", Прицеливание
  // +15/+30 вместо +10/+20, Короткие/Длинные очереди +5/+10 сверх обычного.
  // Вычисляется один раз от СТАРТОВОГО Хвата (как qTestMod/legionFit ниже) —
  // если сменить Хват прямо в открытом окне, число не переоткроется само.
  const doubleGripActive = !!doubleGripGrip && gripKey === "2р";
  // Fanning / Быстрый Курок (wdbc-fy33, стр. 39): револьвер в одной руке +
  // свободная вторая — Длинная очередь без обычного штрафа −10, RoF 2..BS.b
  // по выбору игрока (вместо фиксированного sys.rof_full) и без бонуса
  // Прицеливания именно в этом режиме броска.
  // Без exclude: revolver сам уже сидит в handHeldItems (равно, если экипирован) —
  // нужна ЛИШНЯЯ свободная рука сверх той, что держит сам револьвер.
  const fanningActive = !isMelee && wp.revolver && gripKey === "1р"
    && hasRuleFlag(actor, "weapon.fanningRevolver")
    && handsOccupied(actor).free >= 1;
  const bsBonus = actor.system.characteristics?.bs?.bonus ?? 0;
  // Потолок выбора — не меньше 2 (текст Таланта), даже если BS.b мал.
  const fanningRofMax = Math.max(2, bsBonus);

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
  const mountSpeedKey   = actor.system.mount?.speed in MOUNT_SPEEDS ? actor.system.mount.speed : "still";
  // Гиро-Стабилизированное (wdbc-z56a, стр. 168): «игнорирует штрафы... за
  // нестабильную платформу (в т.ч. верхом)» — тот же штраф, что и «стрельба с
  // седла» выше (Dragoon правит эту же цифру по книге, только на -10, а не
  // до нуля — тот Талант не автоматизирован, здесь трогать нечего).
  const autoMountRangedMod = attackerMount
    ? (wp.gyroStabilized ? 0 : mountRangedPenalty(mountSpeedKey, attackerMount))
    : 0;
  // Рука на поводьях/руле (стр. 477, wdbc-3xqh): пока едет со скоростью,
  // требующей управления руками (не Стойка/Связь/Боевая Тренировка вне
  // Натиска-Бега — handsNeeded уже учитывает все три исключения), одна рука
  // занята вне зависимости от того, что в ней держат — бюджет hands.mjs
  // об этом ничего не знает (он статичный, экипировка не привязана к Ходу),
  // поэтому вычитается только тут, в информационном бейдже.
  const mountHands = attackerMount
    ? handsNeeded(mountSpeedKey, attackerMount,
        { traits: mountTraits(attackerMount), linked: !!actor.system.mount?.linked }).hands
    : 0;

  // Один обход правил актора на диалог: mods/rerolls/crit из одного результата.
  const resolvedAttack = resolveTest({ actor, ...attackCtx });
  const ruleMods = ruleRollModsHtml(actor, attackCtx, resolvedAttack);
  // Перебросы от правил (Локус Буйства — «перебросить любой тест атаки»).
  // Отдельным блоком: складывать их не с чем, выбирается один.
  const ruleRerolls = ruleRerollsHtml(actor, attackCtx, resolvedAttack);
  // Перебросы, навязанные ЦЕЛИ (Локус Кровопролития), в свой блок не идут:
  // бросает их защищающийся у себя. Они уезжают атрибутом на кнопки защиты в
  // карточке атаки — см. combat/attack-card.mjs.
  const forcedDefenceReroll = (resolvedAttack.rerolls || [])
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

  // Bow to the Audience/Поклон Публике (wdbc-1rno): метка живёт на
  // АТАКУЮЩЕМ (module/combat/bow-to-audience.mjs), не на цели — бонус/штраф
  // действует только пока бьёт именно отметивший, до начала его следующего
  // Хода (снимается hooks.mjs::updateCombat, тот же такт, что Dread Wail).
  const bowMark = actor.getFlag?.("warhammer-dbc", "bowToAudienceMark");
  const bowMarked = !!(bowMark?.targetIds?.includes(attackCtx.targetActor?.id));
  const bowMarkedMod = bowMarked ? (Number(bowMark.bonus) || 0) : 0;
  const bowMarkedBadge = bowMarkedMod
    ? `<span class="atk-training-warn" title="Поклон Публике: цель отмечена, действует до конца этого эффекта">🎭 Поклон Публике (+${bowMarkedMod})</span>`
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
  const wpAttackMod  = (wp.attackMod || 0) + (modFx.attackMod || 0) + qTestMod + legionFit.total + weaponTraining.total + targetStanceMod + exposedMod + helplessRangedMod + runningMod + stepByStepMod + bowMarkedMod;
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

  // Локус Неизбежности: галочка предлагается, только если ещё не потрачена
  // в этом Раунде — сама трата решается игроком (галочка), не молча.
  const autoHitAvailable = isMelee
    && hasRuleFlag(actor, AUTO_HIT_CAPABILITY)
    && isRoundCapabilityAvailable(actor, AUTO_HIT_CAPABILITY);
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
  const halfAimBonus  = doubleGripActive ? 15 : 10;
  const fullAimBonus  = doubleGripActive ? 30 : 20;
  const aimingBonus   = currentAiming === "half" ? halfAimBonus : currentAiming === "full" ? fullAimBonus : 0;
  const aimingLabel   = currentAiming === "half"
    ? `Полу-прицеливание (+${halfAimBonus})`
    : currentAiming === "full" ? `Полное прицеливание (+${fullAimBonus})` : "";

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
  // Дальнобойный Хват (wdbc-3hxg) — не про Тренировку, а про Отдачу (стр. 166):
  // "1р" запрещён, если на оружии есть свойство Отдача(X) и S.b персонажа
  // меньше X — иначе персонаж обязан стрелять "2р". "2р" всегда доступен.
  // Подавители Отдачи (wdbc-cnju, armorMod на руках) снимают гейт Отдачи
  // целиком у винтовки/длинной винтовки (weaponClass "basic") — своей
  // категории у «длинной винтовки» в схеме нет, обе лежат в "basic".
  const recoilSuppressed = !isMelee && sys.weaponClass === "basic" && hasRecoilSuppressor(actor);
  // Рука Смерти форсирует "1р" безусловно (стр. 46) — Отдача её не блокирует,
  // тот же принцип, что и подавители Отдачи, гейт снят наравне с ними.
  const handOfDeathFused = isFusedByHandOfDeath(item);
  function computeRangedGripOptions() {
    return gripList.map(key => {
      const recoilBlocked = key === "1р" && !recoilSuppressed && !handOfDeathFused
        && wp.recoilRating > 0 && sBonus < wp.recoilRating;
      return {
        key, label: RANGED_GRIPS[key]?.label || key,
        allowed: !recoilBlocked,
        reason: recoilBlocked ? `Отдача: нужен S.b ≥ ${wp.recoilRating} для стрельбы одной рукой (сейчас ${sBonus})` : ""
      };
    });
  }
  function computeGripOptions(pIdx) {
    if (!isMelee) return computeRangedGripOptions();
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
   * Пилюли Базы зависят от ТЕКУЩЕЙ Стойки (Частокол запрещает Натиск, стр. 15),
   * от Верховой Атаки (только верхом) и от Запрещённого Приёма (Cheap Shot,
   * стр. 166: «считается Стандартной Атакой» — свойство либо у самого оружия
   * (wp.cheapShot), либо временно даёт текущий Хват, см. GRIPS.Хв.addProp) —
   * пересчитываются заново на каждое изменение формы (см. #atk-base-pills в
   * updateTotal), а не один раз.
   */
  function computeBaseOptions(stanceKeyNow, gKeyNow) {
    const noCharge = MELEE_STANCES[stanceKeyNow]?.noCharge === true;
    const gDefNow = GRIPS[gKeyNow] ? gripEffects(gKeyNow, gKeyNow !== primGrip) : null;
    const cheapShotActive = !!(wp.cheapShot || gDefNow?.addProps?.includes("cheapShot"));
    return Object.entries(MELEE_BASES).map(([key, def]) => {
      let allowed = !fullAttackForced || key === "fullatk";
      let reason = "";
      if (allowed && cheapShotActive && key !== "standard") {
        allowed = false;
        reason = "Запрещённый Приём (Cheap Shot): только Стандартная Атака, тратит Реакцию";
      }
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

    const gKey = sel.gripKey ?? gripKey;
    const gDef = isMelee
      ? (GRIPS[gKey] ? gripEffects(gKey, gKey !== primGrip) : null)
      : (RANGED_GRIPS[gKey] ? rangedGripEffects(gKey) : null);
    const gWs  = gDef ? gDef.ws : 0;

    // Запрещённый Приём (Cheap Shot, стр. 166): тратит Реакцию вместо
    // действия, но «считается Стандартной Атакой» — База принудительно
    // становится standard, как fullAttackForced принудительно ставит fullatk.
    const cheapShotActive = isMelee && !!(wp.cheapShot || gDef?.addProps?.includes("cheapShot"));

    const baseKey = fullAttackForced ? "fullatk" : (cheapShotActive ? "standard" : (sel.baseKey ?? meleeBaseKey));
    const bDef    = MELEE_BASES[baseKey] || MELEE_BASES.standard;
    const baseBon = isMelee ? (bDef.wsBonus ?? 0) : 0;

    const maneuverKey = isMelee ? (sel.maneuverKey ?? maneuverKeyDefault) : "standard";
    const mDef        = MELEE_MANEUVERS[maneuverKey] || MELEE_MANEUVERS.standard;
    // Щупальце (Мутация, wdbc-vkwe): «+20 на приём Захват» — модификатор
    // конкретного манёвра, не Стойки/Базы (те целятся во ВСЕ манёвры разом).
    // Нет общего вида записи «+N к манёвру X» в Конструкторе — решение по
    // тикету: точечный capability-флаг вместо новой инфраструктуры modScope,
    // тот же приём, что stanceWs/FULL_ATTACK_CAPABILITY выше в этом файле.
    // «...и все тесты в Борьбе» (module/combat/grapple.mjs, Сжать/Метнуть)
    // НЕ подключено — отдельная точка входа (_showContestDialog), не эта.
    const maneuverCapBonus = (isMelee && maneuverKey === "grapple" && hasRuleFlag(actor, "mutation.tentacle")) ? 20 : 0;
    const maneuverBon = isMelee ? (mDef.wsBonus ?? 0) + maneuverCapBonus : 0;

    const pIdx = sel.profIdx ?? profIdx;
    const prof = (pIdx >= 0) ? (atkProfiles[pIdx] || null) : null;

    // Избегания ЦЕЛИ против ЭТОЙ атаки — Приём и Стойка складываются (стр.
    // 14-15): например Взмах (−10 Уклонение) + Агрессивная (−10 Уклонение).
    // Поклон Публике (wdbc-1rno): «равный штраф на их физические Избегания» —
    // тот же bowMarkedMod, что уже прибавлен атакующему в wpAttackMod выше
    // (замыкание, bowMark читается один раз на актора-атакующего).
    const targetDodgeMod = (mDef.targetDodgeMod ?? 0) + (stDef.targetDodgeMod ?? 0) - bowMarkedMod;
    const targetParryMod = (mDef.targetParryMod ?? 0) + (stDef.targetParryMod ?? 0) - bowMarkedMod;

    // Защитная Стойка без щита (стр. 15) — персонаж не может атаковать вовсе.
    const blocked = isMelee && stanceKey === "defensive" && stDef.noAttackWithoutShield && !hasShieldEquipped;

    const note = [
      prof ? `Профиль: ${prof.label || "доп."}${prof.damage ? ` (${prof.damage})` : ""}` : "",
      gDef ? `Хват: ${gDef.label}${gDef.ws ? ` · WS ${gDef.ws >= 0 ? "+" : ""}${gDef.ws}` : ""}${gDef.dmgFlat ? ` · урон ${gDef.dmgFlat >= 0 ? "+" : ""}${gDef.dmgFlat}` : ""}${gDef.sbHalf ? " · ½S.b" : ""} — ${gDef.note}` : "",
      maneuverCapBonus ? `Щупальце: +${maneuverCapBonus} на приём Захват` : ""
    ].filter(Boolean).join("<br>");

    return {
      stanceKey, stDef, stanceBon, baseKey, bDef, baseBon,
      maneuverKey, mDef, maneuverBon, gKey, gDef, gWs, pIdx, prof,
      cheapShotActive,
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
    const ok = (opts, key, field = "key") =>
      opts.find(o => o[field] === key)?.allowed ?? true;
    if (!isMelee) {
      // Только Хват может стать недоступным у дальнобойного (Отдача) — тот же
      // приём сброса на безопасное значение, что у рукопашного ниже, просто
      // без Стойки/Базы/Приёма (у них тут нет пилюль вовсе).
      if (gripList.length && !ok(computeRangedGripOptions(), sel.gKey)) {
        const fallback = computeRangedGripOptions().find(o => o.allowed)?.key ?? "2р";
        return resolveSelection({ ...f, gripKey: fallback });
      }
      return sel;
    }
    const fix = {};
    if (!ok(computeStanceOptions(sel.pIdx), sel.stanceKey)) fix.stanceKey = "standard";
    const stanceKey = fix.stanceKey ?? sel.stanceKey;
    if (!ok(computeBaseOptions(stanceKey, sel.gKey), sel.baseKey)) fix.baseKey = "standard";
    const baseKey = fix.baseKey ?? sel.baseKey;
    if (!ok(computeManeuverOptions(baseKey, sel.pIdx), sel.maneuverKey)) fix.maneuverKey = "standard";
    if (gripList.length && !ok(computeGripOptions(sel.pIdx), sel.gKey)) fix.gripKey = primGrip;
    return Object.keys(fix).length ? resolveSelection({ ...f, ...fix }) : sel;
  }

  const dyn0 = resolveSelection();

  /**
   * Занятость рук (wdbc-3xqh) — только дальнобойное: сколько рук требует
   * ВЫБРАННЫЙ прямо в диалоге Хват (ещё не обязательно сохранённый во флаг)
   * против того, что реально свободно у актора помимо этого оружия
   * (module/rules/hands.mjs), минус рука на поводьях/руле (mountHands выше,
   * стр. 477) — она не входит в статичный бюджет hands.mjs (тот не знает про
   * скорость Хода), поэтому вычитается только здесь. Чисто информационно, не
   * блокирует бросок — легальность самой связки снаряжения уже проверяет
   * экипировка (sheets/tabs/gear.mjs).
   */
  function handsBadge(sel) {
    if (isMelee) return "";
    const need = gripList.length && (sel.gKey === "1р" || sel.gKey === "2р")
      ? (sel.gKey === "1р" ? 1 : 2)
      : weaponHandsRequired(item, actor);
    if (need <= 0) return "";
    const { free: freeBase, max } = handsOccupied(actor, { exclude: item.id });
    const free  = Math.max(0, freeBase - mountHands);
    const short = need > free;
    const mountNote = mountHands ? `, из них на поводьях/руле: ${mountHands}` : "";
    return `<span class="atk-hands-badge${short ? " atk-training-warn" : ""}" title="Свободно рук помимо этого оружия: ${free} из ${max}${mountNote}">🖐️ Руки: ${need}${short ? ` (не хватает, свободно ${free})` : ""}</span>`;
  }

  function badgesHtml(sel) {
    const stanceBadge = (isMelee && sel.stanceBon !== 0)
      ? `<span class="atk-stance-badge">${rollIcon("sword")}Стойка: ${sel.stanceBon >= 0 ? "+" : ""}${sel.stanceBon}</span>`
      : "";
    const baseBadge = isMelee
      ? `<span class="atk-base-badge">${rollIcon("sword")}База: ${sel.bDef?.label ?? "Стандартная Атака"} (${sel.baseBon >= 0 ? "+" : ""}${sel.baseBon})${fullAttackForced ? " — Локус Сокрушения" : (sel.cheapShotActive ? " — Запрещённый Приём: тратит Реакцию" : "")}</span>`
      : "";
    const blockedBadge = sel.blocked
      ? `<span class="atk-training-warn" title="Защитная Стойка без щита запрещает атаки (стр. 15)">🚫 Защитная Стойка — атака запрещена</span>`
      : "";
    return `${baseBadge}${stanceBadge}${blockedBadge}${computeLockNoteHtml(sel.pIdx)}${targetStanceBadge}${exposedBadge}${runningBadge}${bowMarkedBadge}${targetHelplessBadge}${ammoBadge}${fatigueBadge}${drugAtkBadge}${handsBadge(sel)}`;
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
    // Импульсное (стр. 73 Книги Аэльдари): +10 к очередям, вдвое (+20/+10),
    // если сам стрелок не двигался в этом Ходу — flags.warhammer-dbc.
    // movedThisTurn ставят Действия Движения и реальное перемещение токена
    // (module/combat/movement-actions.mjs), снимает resetActionEconomy в
    // начале следующего Хода (action-economy.mjs).
    const impulseStationary = !!wp.impulse && !actor.getFlag?.("warhammer-dbc", "movedThisTurn");
    const impulseBonus = wp.impulse ? (impulseStationary ? 20 : 10) : 0;
    const fmtMod = n => n === 0 ? "±0" : (n > 0 ? `+${n}` : `−${-n}`);
    const impulseHint = impulseStationary ? ", не двигался ×2" : "";
    // Secondary Grip (wdbc-aj6t, стр. 166): стрельба от бедра без Прицеливания
    // — бонус только пока не Прицелились И не держат "1р" (мод сам этого не
    // даёт, стр. 166: «не работает при стрельбе одной рукой»).
    const hipFireOk   = !isMelee && currentAiming === "none" && gripKey !== "1р";
    const hipFireSemi = hipFireOk ? installedMods.reduce((n, m) => n + (Number(m.system?.hipFireSemiMod) || 0), 0) : 0;
    const hipFireFull = hipFireOk ? installedMods.reduce((n, m) => n + (Number(m.system?.hipFireFullMod) || 0), 0) : 0;
    const hipFireSupp = hipFireOk ? installedMods.reduce((n, m) => n + (Number(m.system?.hipFireSuppressionMod) || 0), 0) : 0;
    // Double Grip (wdbc-mu6v): пистолет "2р" — те же +5/+10 короткой/длинной.
    const dgSemi = doubleGripActive ? 5 : 0;
    const dgFull = doubleGripActive ? 10 : 0;
    const extraHint = (hip, dg) => [hip ? `от бедра ${fmtMod(hip)}` : "", dg ? `Double Grip ${fmtMod(dg)}` : ""]
      .filter(Boolean).map(s => `, ${s}`).join("");
    if (sys.rof_semi > 0) {
      const semiBonus = impulseBonus + hipFireSemi + dgSemi;
      rofModes.push({ value: "semi", label: `Короткая очередь (${fmtMod(semiBonus)}${impulseHint}${extraHint(hipFireSemi, dgSemi)}, ${sys.rof_semi} выстр.)`, bonus: semiBonus });
    }
    if (sys.rof_full > 0) {
      // Fanning / Быстрый Курок (wdbc-fy33, стр. 39): револьвер "1р" со
      // свободной второй рукой — Длинная очередь БЕЗ обычного штрафа −10,
      // вместо обычного расчёта (RoF 2..BS.b по выбору не смоделирован).
      const fullBonus = fanningActive ? 0 : (impulseBonus - 10 + hipFireFull + dgFull);
      const label = fanningActive
        ? `Длинная очередь — Быстрый Курок (${fmtMod(fullBonus)}, RoF 2..BS.b по выбору, без бонуса Прицеливания)`
        : `Длинная очередь (${fmtMod(fullBonus)}${impulseHint}${extraHint(hipFireFull, dgFull)}, ${sys.rof_full} выстр.)`;
      rofModes.push({ value: "full", label, bonus: fullBonus });
    }
    if (sys.rof_semi > 0 || sys.rof_full > 0) {
      const suppBonus = -20 + hipFireSupp;
      rofModes.push({ value: "suppression", label: `Стрельба на подавление (${fmtMod(suppBonus)}${extraHint(hipFireSupp, 0)})`, bonus: suppBonus });
    }
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
  // Локус Подношения (стр. 31, wdbc-smc): штраф Избирательной в голову меньше на 20.
  const headPenalty = -20 + (hasRuleFlag(actor, "penalty.calledShot.head.reduce20") ? 20 : 0);
  const headPenaltyLabel = headPenalty === 0 ? "0" : `−${-headPenalty}`;
  let aimTargets = [
    { value: "",       label: "— Без прицела —",      penalty:   0 },
    { value: "torso",  label: "Торс (−10)",            penalty: -10 },
    { value: "leg",    label: "Нога (−15)",             penalty: -15 },
    { value: "arm",    label: "Рука (−20)",             penalty: -20 },
    { value: "head",   label: `Голова (${headPenaltyLabel})`, penalty: headPenalty },
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

  // Pistol Grip (wdbc-8vp1, стр. 166): Дальность ×0.5 действует ТОЛЬКО пока
  // выбран Хват, который дал сам мод (в отличие от безусловного modFx.rangeMult
  // выше) — считается один раз от стартового gripKey, как doubleGripActive.
  const gripRangeMult = installedMods
    .filter(m => m.system?.grantsGrip && m.system.grantsGrip === gripKey)
    .reduce((mult, m) => mult * (Number(m.system?.gripRangeMult) || 1), 1);
  const gripRange = Math.round((Number(sys.range) || 0) * gripRangeMult);

  let rangeInfoHtml = "";
  if (!isMelee && sys.range > 0) {
    const rng     = gripRange;
    const rngMult = ammoSys?.rangeMultiplier ?? 1;
    const rngAdd  = ammoSys?.rangeMod ?? 0;
    const effRng  = Math.round(rng * rngMult) + rngAdd;
    const bounds  = rangeBandBoundaries(effRng);
    rangeInfoHtml = `
      <div class="atk-range-info">
        <div class="atk-range-title">
          📏 Дистанции (Rng = ${rng}м${rngMult !== 1 ? ` ×${rngMult}` : ""}${rngAdd !== 0 ? ` ${rngAdd >= 0 ? "+" : ""}${rngAdd}м` : ""} = ${effRng}м)
        </div>
        <div class="atk-range-grid">
          <span class="atr-zone atr-pb">В упор: 0,5–${bounds.pointBlank}м → <b>+30</b></span>
          <span class="atr-zone atr-sh">Короткая: ${bounds.pointBlank}–${bounds.short}м → <b>+10</b></span>
          <span class="atr-zone atr-cb">Боевая: ${bounds.short}–${bounds.combat}м → <b>±0</b></span>
          <span class="atr-zone atr-lg">Дальняя: ${bounds.combat}–${bounds.long}м → <b>−10</b></span>
          <span class="atr-zone atr-ex">Экстрем.: ${bounds.long}–${bounds.extreme}м → <b>−30</b></span>
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
  // Тактическая карта: полоса дальности из уже измеренной дистанции и Rng
  // оружия (стр. 40: в упор 0,5–3 м / короткая до Rng/2 / боевая до Rng /
  // дальняя до Rng×2 / экстремальная до Rng×3, дальше выстрел невозможен).
  // Автоотметка ровно одной галочки — все они по-прежнему снимаются руками,
  // ГМ-клапан сохраняется. За 3×Rng — видимый warning у измеренной дистанции.
  const bandKey  = (!isMelee && measured) ? rangeBandKey(measured.edgeM, gripRange) : null;
  const bandNote = k => (bandKey === k ? `по измеренной дистанции ${measured.edgeM} м` : undefined);
  // «Положение выше» (+10): сравнение elevation токенов атакующего и цели.
  const highGround = (isMelee && measured) ? hasHighGround(attackerToken, targetToken) : null;
  // «Трудный ландшафт» в рукопашной: зона Трудного Ландшафта под атакующим.
  // Зона «очень трудный» не различает — автоотмечаем обычный (−10), сильнее руками.
  const meleeTerrain = (isMelee && attackerToken)
    ? getTerrainInfoForToken(attackerToken.document ?? attackerToken) : null;
  const specificMods = isMelee ? [
    { label: "Трудный ландшафт",       value: -10, autoCheck: !!meleeTerrain?.inTerrain,
      note: meleeTerrain?.inTerrain ? "зона Трудного Ландшафта под атакующим" : undefined },
    { label: "Очень трудный ландшафт", value: -20 },
    { label: "Числ. перевес 2к1",      value:  10, autoCheck: outnumberCount === 2,
      note: outnumberCount == null ? undefined : `в контакте с целью: ${outnumberCount}` },
    { label: "Числ. перевес 3к1",      value:  20, autoCheck: outnumberCount != null && outnumberCount >= 3,
      note: outnumberCount == null ? undefined : `в контакте с целью: ${outnumberCount}` },
    { label: "Положение выше",         value:  10, autoCheck: highGround === true,
      note: highGround === true ? "elevation токена выше цели" : undefined },
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
    // id нужен readAttackForm — Карабин (wdbc-z56a) читает именно этот флаг,
    // чтобы решить, дать ли цели в рукопашной +30 или +10 на Уклонение.
    { id: "atk-melee-shot", label: "Стрельба в рукопашную",   value: -20 },
    { label: "Дистанция в упор",        value:  30, autoCheck: bandKey === "pointBlank", note: bandNote("pointBlank") },
    { label: "Короткая дистанция",      value:  10, autoCheck: bandKey === "short",      note: bandNote("short") },
    { label: "Боевая дистанция",        value:   0, autoCheck: bandKey === "combat",     note: bandNote("combat") },
    { label: "Дальняя дистанция",       value: -10, autoCheck: bandKey === "long",       note: bandNote("long") },
    { label: "Экстремальная дистанция", value: -30, autoCheck: bandKey === "extreme",    note: bandNote("extreme") },
    // Беспомощная цель, выстрел в упор/в рукопашной: как рукопашная — авто-
    // успех и удвоенный урон, а не просто +30 (см. targetHelpless выше). Это
    // ситуативный факт про конкретный выстрел (дистанция), а не хранимое
    // состояние — поэтому галочка, а не автоматика, ровно как «Дистанция в упор».
    ...(targetHelpless ? [{
      id: "atk-helpless-close", label: "Беспомощная цель: в упор / в рукопашной",
      value: 0, autosuccess: true,
      note: "заменяет +30 на авто-успех и ×2 урона"
    }] : []),
    // ── Ситуативные штрафы боя (wdbc-z56a, стр. 32/166): теснота/высота-
    // скорость цели/нестабильная платформа — раньше в диалоге не существовали
    // вовсе, поэтому Anti-Air/Gyro-Stabilized нечего было гасить. ──────────
    // Высота цели (стр. 32): Низкая –10 к попаданию, Высокая — попасть в
    // принципе нельзя без Зенитного (не просто штраф, отсюда autofail, как у
    // «Ослеплён» выше), Зенитное снимает оба штрафа целиком.
    { label: "Низкая высота цели",  value: wp.antiAir ? 0 : -10, immune: wp.antiAir,
      note: wp.antiAir ? "снято: Зенитное" : "цель на Низкой высоте (полёт)" },
    { label: "Высокая высота цели", value: 0, autofail: !wp.antiAir, immune: wp.antiAir,
      note: wp.antiAir ? "снято: Зенитное" : "без Зенитного попасть в принципе нельзя" },
    // Тяжёлое оружие (стр. 40): –30 без Закрепления, ещё –10 если стрелок
    // Двигался в этот Ход — Гиро-Стабилизированное снижает первое до –10 и
    // полностью снимает второе (стр. 168).
    { label: "Тяжёлое оружие: без Закрепления", value: wp.gyroStabilized ? -10 : -30,
      note: wp.gyroStabilized ? "Гиро-стаб.: –30 снижено до –10" : undefined },
    { label: "Тяжёлое оружие: стрельба на ходу", value: wp.gyroStabilized ? 0 : -10, immune: wp.gyroStabilized,
      note: wp.gyroStabilized ? "снято: Гиро-стаб." : undefined }
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
  const autoShortRange = !!(measured && !isMelee && gripRange > 0
    && measured.edgeM <= gripRange / 2);
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
    <div class="atk-distance-hint">${rollIcon("target","#8fd0ff")}Измеренная дистанция: ${measured.edgeM} м${gripRange ? ` (Дальность оружия: ${gripRange} м${gripRangeMult !== 1 ? ` — ×${gripRangeMult} на этом Хвате, база ${sys.range} м` : ""})` : ""}</div>${bandKey === "out" ? `
    <div class="atk-recharge-warn">${rollIcon("warn","#ff6b6b")}Цель вне дальности: ${measured.edgeM} м при максимуме ${gripRange * 3} м (3×Rng)</div>` : ""}` : "";
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
  const aimingPills = [["none", 0, "Без прицела"], ["half", halfAimBonus, `Полу +${halfAimBonus}`], ["full", fullAimBonus, `Полное +${fullAimBonus}`]].map(([v, bon, lbl]) =>
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
      <div class="av-pills" id="atk-base-pills">${pillsHtml("atk-base", computeBaseOptions(dyn0.stanceKey, dyn0.gKey), dyn0.baseKey)}</div>
      <div class="av-opt-note" id="atk-base-note">${dyn0.bDef.note}</div>
    </div>` : "";
  const gripBlockHtml = (gripList.length > 1) ? `
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
        <div class="av-prev-breakdown" id="atk-threshold-breakdown"></div>
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
        <label>Смертельный Танец</label>
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
               title="Авто по скорости скакуна/байка на панели «ВЕРХОМ» (0 при Гиро-Стабилизированном) — для Интегрированного Оружия (0) или турели Коляски (сниженный штраф) поправьте вручную"/>
      </div>` : ""}

      ${techSectionsHtml}
      <div class="av-opt-note" id="atk-gripnote">${dyn0.note}</div>

      <div class="av-section">
        <div class="av-sec-lbl">Режим атаки</div>
        <div class="av-pills">${rofPills}</div>
      </div>
      ${fanningActive ? `
      <div class="av-row">
        <label>Быстрый Курок: RoF Длинной очереди</label>
        <input id="atk-fanning-rof" class="av-input av-num" type="number"
               min="2" max="${fanningRofMax}" value="${fanningRofMax}"
               title="2..BS.b (${fanningRofMax}) по выбору — заменяет фиксированный RoF револьвера в режиме Длинной очереди. Без бонуса Прицеливания."/>
      </div>` : ""}
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
            ${autoHitAvailable ? `<label class="attack-mod-check"><input type="checkbox" id="atk-autohit"/><span>Локус Неизбежности: авто-попадание (1 Успех, −10 до след. Хода)</span></label>` : ""}
          </div>
        </div>
      </details>
    </div>`;

  /**
   * Порог теста по прочитанной форме, построчно (wdbc-53lh): каждое
   * слагаемое, из которого складывался porog (раньше — одно число под
   * итогом), плюс поправка на ополовинивание штрафа (halvePenalty бьёт по
   * СУММЕ мод-слагаемых, не по каждому отдельно — attackThreshold считает её
   * ОДИН раз, здесь та же функция вызывается для total, чтобы округление не
   * разъехалось с диалогом броска навыка, см. attack-threshold.mjs). Мод
   * хвата и мод препаратов (в char.total) уже внутри базы; характеристику
   * игрок может сменить в окне, а Стойка/База/Приём/Хват — прямо в этом же
   * диалоге, поэтому база считается здесь заново из текущего выбора
   * (resolveSelection), а не берётся из charVal.
   *
   * @returns {{parts: {label:string, value:number}[], total: number}}
   */
  const thresholdParts = f => {
    const sel = resolveSelectionSafe(f);
    const baseParts = [
      { label: CHARACTERISTICS[f.char]?.abbr || f.char, value: actor.system.characteristics[f.char]?.total ?? 0 },
      { label: "Бонус оружия",       value: sys.attackBonus || 0 },
      { label: "Свойства оружия",    value: wp.attackMod || 0 },
      { label: "Модификации",        value: modFx.attackMod || 0 },
      { label: "Качество",           value: qTestMod },
      { label: "Легион",             value: legionFit.total },
      { label: "Тренировка",         value: weaponTraining.total },
      { label: "Стойка цели",        value: targetStanceMod },
      { label: "Цель раскрыта",      value: exposedMod },
      { label: "Беспомощная цель",   value: helplessRangedMod },
      { label: "Цель бежит",         value: runningMod },
      { label: "Поклон Публике",     value: bowMarkedMod },
      { label: "Шаг за шагом",       value: stepByStepMod },
      { label: "База",               value: sel.baseBon },
      { label: "Приём",              value: sel.maneuverBon },
      { label: "Стойка",             value: sel.stanceBon },
      { label: "Боеприпас",          value: ammoAtkMod },
      { label: "Хват",               value: sel.gWs },
      // Fanning: «без бонусов от Прицеливания» — только в режиме Длинной
      // очереди, которую этот Талант и меняет (stanceKey/база и т.п. живут своей
      // жизнью, тут проверяется именно выбранный rofMode этого броска).
      { label: "Прицеливание",       value: (fanningActive && f.rofMode === "full") ? 0 : (wp.noAim ? 0 : f.aimBonus) }
    ];
    const modParts = [
      { label: "Доп. модификатор",     value: f.modifier },
      { label: "Укрытие",              value: f.coverMod },
      { label: "Ситуативные",          value: f.sitMods },
      { label: "Боеприпас: условия",   value: f.ammoMods },
      { label: "Спецправила",          value: f.ruleMods },
      { label: "Режим огня",           value: f.rofBonus },
      { label: "Избирательная атака",  value: f.aimPenalty },
      { label: "Верхом",               value: f.mountPenalty },
      // Штраф стрельбы с седла (wdbc-8nz6) — отдельная строка от "Верхом"
      // (f.mountPenalty — штраф Избирательной атаки по зоне пары): это два
      // разных мода одной верховой атаки, см. комментарий у readAttackForm.
      { label: "Штраф стрельбы с седла", value: f.mountRangedMod },
      { label: "Атака всем телом",     value: f.extraBonus }
    ];
    const base         = baseParts.reduce((n, p) => n + (Number(p.value) || 0), 0);
    const rawModsSum    = modParts.reduce((n, p) => n + (Number(p.value) || 0), 0);
    const total = attackThreshold({ base, mods: modParts.map(p => p.value), halvePenalty: f.halvePenalty });
    // Разница между «в лоб сложенным» и «ополовиненным Закалкой» штрафом —
    // единственная поправка, которая не раскладывается на отдельные галочки:
    // halvePenalty бьёт по итоговой сумме штрафов, а не по каждой отдельно.
    const halveAdjust = total - base - rawModsSum;
    const parts = [...baseParts, ...modParts];
    if (halveAdjust) parts.push({ label: "Ополовинено (округление в пользу игрока)", value: halveAdjust });
    return { parts: parts.filter(p => (Number(p.value) || 0) !== 0), total };
  };
  const thresholdOf = f => thresholdParts(f).total;

  /** Построчный список слагаемых порога под итогом — обновляется вместе с ним (updateTotal). */
  function breakdownHtml(parts) {
    return parts.map(p => {
      const v = Number(p.value) || 0;
      return `<span class="av-bd-item">${esc(p.label)} <b>${v >= 0 ? "+" : ""}${v}</b></span>`;
    }).join("");
  }

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
          // Запрещённый Приём (Cheap Shot, стр. 166, wdbc-hmcx): вместо ОД
          // тратит Реакцию — sel.cheapShotActive уже вынудил Базу быть
          // "standard" (resolveSelection), здесь остаётся только сменить
          // ресурс списания на тот же spendReaction, что у Уклонения/Парирования.
          if (isMelee && sel.cheapShotActive) {
            if (!await spendReaction(actor)) {
              ui.notifications.warn("⚠️ Не хватает Реакций (Запрещённый Приём).");
              return false;
            }
          } else {
            const apCost = isMelee ? apCostForActionType(sel.bDef.actionType) : 0;
            if (!await spendActionPoints(actor, apCost)) {
              ui.notifications.warn("⚠️ Не хватает ОД.");
              return false;
            }
          }

          // Стойка/База — персистентны на акторе (как радио на вкладке БОЙ),
          // Хват/Профиль — во флагах предмета (как раньше в HUD): выбор в этом
          // диалоге должен остаться в силе и после закрытия окна, а не сбрасываться.
          const actorUpdates = { "system.aiming": "none" };
          if (isMelee && sel.stanceKey !== stance) actorUpdates["system.meleeStance"] = sel.stanceKey;
          if (isMelee && !fullAttackForced && sel.baseKey !== meleeBaseKey) actorUpdates["system.meleeBase"] = sel.baseKey;
          await actor.update(actorUpdates);
          if (sel.gKey !== gripKey) await item.setFlag?.("warhammer-dbc", "hudGrip", sel.gKey);
          if (sel.pIdx !== profIdx) await item.setFlag?.("warhammer-dbc", "hudProfile", sel.pIdx);
          // Локус Сокрушения тратится реальным броском — отменённая или
          // закрытая атака способность не расходует (см. meleeBaseKey выше).
          if (fullAttackForced) await markRoundCapabilityUsed(actor, FULL_ATTACK_CAPABILITY);

          // Локус Неизбежности — тем же приёмом: тратится реальным броском,
          // не открытием окна. Штраф −10 ставится сразу же (до начала
          // следующего Хода актора, снимает action-economy.mjs).
          const autoHitUsed = autoHitAvailable && f.autoHit;
          if (autoHitUsed) {
            await markRoundCapabilityUsed(actor, AUTO_HIT_CAPABILITY);
            await actor.setFlag("warhammer-dbc", "inevitabilityPenalty", true);
          }

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
              fixedSuccessDeg: autoHitUsed ? 1 : undefined,
              // Быстрая/Молниеносная — теперь Приём (стр. 14), а не отдельная
              // галочка: множитель попаданий включается выбором пилюли.
              isSwift: sel.maneuverKey === "swift", isLightning: sel.maneuverKey === "lightning",
              isAllOut: f.allOut,
              // База рукопашной («Натиск» и т.п.): rofMode у рукопашной всегда
              // "melee", по нему Brutal Charge не отличить (wdbc-ревью стопки 3).
              baseKey: sel.baseKey ?? null,
              // Переброс от правила (Локус Буйства) или общий Кубик —
              // бросок катает несколько кубов и оставляет один — см.
              // combat/attack.mjs. crit — расширение диапазона Критического
              // Успеха/Провала тем же правилом (kind:"critRangeMod"); сам
              // натуральный диапазон 1-5/96-100 применяется уже в attack.mjs.
              reroll: f.reroll,
              crit: resolvedAttack.crit,
              forcedDefenceReroll,
              techniqueOpts: finalTechniqueOpts,
              dmgBonus: f.dmgBonus, changeSoulless: f.changeSoulless,
              meleeShot: f.meleeShot,
              shortRange: f.shortRange, maximal: f.maximal, bandIdx: f.bandIdx,
              profile: sel.prof, attackNote: sel.note,
              weaponOff: f.weaponOff, gripKey: sel.gKey,
              gripProps: sel.gDef ? sel.gDef.addProps : [],
              gripDmgFlat: sel.gDef ? sel.gDef.dmgFlat : 0,
              gripSbHalf: sel.gDef ? sel.gDef.sbHalf : false,
              // Fanning / Быстрый Курок (wdbc-fy33): RoF 2..BS.b по выбору
              // заменяет фиксированный sys.rof_full только в режиме "full".
              rofCapOverride: (fanningActive && f.rofMode === "full") ? f.fanningRof : 0,
              // Условные эффекты боеприпаса, отмеченные игроком (стр. 203).
              ammoCondProps:  f.ammoSel.flatMap(c => c.wp || []),
              ammoCondDmg:    f.ammoSel.reduce((n, c) => n + (c.dmg || 0), 0),
              ammoCondLabels: f.ammoSel.map(c => c.label),
              aimingLabel: (f.aiming !== "none" && !wp.noAim)
                ? (f.aiming === "half" ? `Полу-прицеливание (+${f.aimBonus})` : `Полное прицеливание (+${f.aimBonus})`)
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
      const form      = dialog.element.querySelector("form");
      const display   = form.querySelector("#atk-total-display");
      const breakdown = form.querySelector("#atk-threshold-breakdown");
      const hint      = form.querySelector(".av-adv-hint");

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
      let lastGKey      = dyn0.gKey;

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
        // База зависит от выбранной Стойки (Частокол запрещает Натиск, стр. 15)
        // И от Хвата (Хвост временно даёт Cheap Shot, см. computeBaseOptions) —
        // перерисовываем пилюли только когда что-то из этого реально
        // поменялось, чтобы не сбрасывать фокус на каждый несвязанный ввод.
        if (basePillsEl && (sel.stanceKey !== lastStanceKey || sel.gKey !== lastGKey)) {
          lastStanceKey = sel.stanceKey;
          lastGKey      = sel.gKey;
          basePillsEl.innerHTML = pillsHtml("atk-base", computeBaseOptions(sel.stanceKey, sel.gKey), sel.baseKey);
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
          if (breakdown) breakdown.innerHTML = "";
          return;
        }
        if (f.autoFail) {
          display.textContent = "ПРОВАЛ";
          display.style.color = "#8b0000";
          if (breakdown) breakdown.innerHTML = "";
          return;
        }
        if (helplessAutoMelee || f.autoSuccess) {
          display.textContent = "АВТО-УСПЕХ ×2";
          display.style.color = "#ff6b6b";
          if (breakdown) breakdown.innerHTML = "";
          return;
        }
        // wdbc-53lh: один вызов thresholdParts даёт и итог, и построчную
        // разбивку под ним — сумма списка равна показанному итогу по построению
        // (thresholdOf выше — тот же total, просто без списка).
        const { parts: bdParts, total } = thresholdParts(f);
        display.textContent = total;
        display.style.color = "";
        if (breakdown) breakdown.innerHTML = breakdownHtml(bdParts);
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

  // Доп. секция при попадании (wdbc-w8ws, Раковое Исцеление и подобные
  // безоружные касания с эффектом сверх урона) — сырой HTML от вызывающего
  // кода, обычно кнопка с data-*-uuid, обрабатываемая своим делегированным
  // слушателем в hooks.mjs (тот же приём, что у wh-apply-dmg-btn: клик может
  // прийти от другого клиента, после того как цель отыграет Уклонение/
  // Парирование выше). НЕ вызывается автоматически из этой функции — она
  // решает только «было ли попадание», прикладной эффект остаётся за кнопкой.
  const hitExtraSection = (hit && techDef.hitSectionHtml) ? techDef.hitSectionHtml : "";

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
        ${hitExtraSection}
      </div>`,
    rolls: allRolls, sound: CONFIG.sounds.dice
  }, rollMode));
}
