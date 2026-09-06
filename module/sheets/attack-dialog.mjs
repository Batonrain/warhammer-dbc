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
import { DAMAGE_TYPES }                       from "../constants/items.mjs";
import { MELEE_STANCES, MELEE_BASES, parseGrips } from "../constants/combat.mjs";
import { WEAPON_PROPERTIES }                  from "../constants/weapon-properties.mjs";
import { rollIcon }                           from "../constants/roll-icons.mjs";
import { openAttackDialog } from "./attack/dialog.mjs";
import { buildAttackContent } from "./attack/markup.mjs";
import { situationalMods } from "./attack/mods.mjs";
import { buildSelection } from "./attack/selection.mjs";
import { AUTO_HIT_CAPABILITY, FULL_ATTACK_CAPABILITY } from "./attack/form.mjs";
import { qualityEffects }                     from "../constants/quality.mjs";
import { _degWord, _buildAmmoModString, resolveCharFormula, esc } from "../helpers/utils.mjs";
import { attackThreshold }                    from "../combat/attack-threshold.mjs";
import { resolveWeaponPropsList, aggregateAuto } from "../combat/weapon-properties.mjs";
import { mergeExtraProps } from "../combat/attack-weapon.mjs";
import { getModEffects, mergeWeaponPropEntries, getInstalledMods } from "../combat/weapon-mods.mjs";
import { hasRuleFlag }                        from "../rules/flags.mjs";
import { isStunnedOrDazed, isBlindedActor }    from "../rules/predicates.mjs";
import { isHallucinatingCannotAttack }         from "../combat/hallucinogenic.mjs";
import { isRoundCapabilityAvailable, markRoundCapabilityUsed } from "../apps/game-session.mjs";
import { mountPairFor, mountSelectiveMod, SELECTIVE_MODS,
         mountRangedPenalty, MOUNT_SPEEDS, mountTraits, handsNeeded } from "../rules/mount.mjs";
import { vehicleCoverMod } from "../rules/vehicle.mjs";
import { legionAttackPenalty, LEGION_FIT_FLAG, OVERSIZED_FIT_FLAG } from "../rules/legion-fit.mjs";
import { ogrynAttackPenalty, OGRYN_FIT_FLAG } from "../rules/ogryn-fit.mjs";
import { meleeTrainingStatus, weaponTrainingPenalty } from "../rules/weapon-training.mjs";
import { MELEE_CATEGORIES, sameCategory } from "../constants/weapon-categories.mjs";
import { isHandShield } from "../combat/hand-shield.mjs";
import { weaponHandsRequired, handsOccupied } from "../rules/hands.mjs";
import { isFusedByHandOfDeath } from "../rules/hand-of-death.mjs";
import { collectTestMods, ruleRollModsHtml, ruleRerollsHtml } from "../rules/roll-mods.mjs";
import { resolveTest } from "../rules/resolve-test.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { postTestCard, thresholdLine } from "../helpers/test-card.mjs";
import { oneAgainstAHundredAdvantage } from "../rules/one-against-a-hundred.mjs";
import { measureTokens }                      from "../combat/tactical-map.mjs";
import { rangeBandBoundaries }                from "../rules/tactical-map.mjs";
import { coverBonusForShot }                  from "../combat/cover.mjs";
import { weaponProfiles, attackIsMelee }         from "../combat/weapon-profiles.mjs";
import { isIntegralAttack }                    from "../combat/equipped-melee.mjs";

// Локус Сокрушения (стр. 31): раз в Раунд любая рукопашная атака (с оружием
// и голыми руками) считается имеющей Базу «Полная Атака» — см. meleeBaseKey
// в showAttackDialog/showAttackDialogNoWeapon ниже.

// Локус Неизбежности (стр. 30, wdbc-smc): раз в Раунд рукопашная атака может
// попасть автоматически с 1 Успехом (вместо броска) — штраф −10 до начала
// следующего Хода ставится флагом, читает module/rules/sources.mjs
// (daemonInevitability), снимает action-economy.mjs::resetActionEconomy.

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

export async function showAttackDialog(actor, item, techniqueOpts = {}) {
  // Галлюцинации, грань «Я маленький...» (стр. 168, wdbc-r5o7.8): «не может
  // совершать Атаки» — жёсткий запрет, тот же приём, что Повален блокирует
  // Натиск/Бег (movement-actions.mjs).
  if (isHallucinatingCannotAttack(actor))
    return ui.notifications.warn("⚠️ Галлюцинации («Я маленький...») — не может совершать Атаки.");
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

  // Профили считаются ДО isMelee, а не после (wdbc-bs0q): «Удар в упор» —
  // рукопашный профиль у стрелкового оружия, и если о нём не знать заранее,
  // весь дальнейший расчёт уедет по BS вместо WS. Список общий с HUD
  // (combat/weapon-profiles.mjs), поэтому индексы выбора совпадают.
  const atkProfiles = weaponProfiles(item, { isIntegralAttack });
  let   profIdx   = techniqueOpts.profileIdx;
  if (profIdx === undefined || profIdx === null) profIdx = item.getFlag?.("warhammer-dbc", "hudProfile");
  profIdx = Number.isFinite(Number(profIdx)) ? Number(profIdx) : -1;
  const startProfile = profIdx >= 0 ? (atkProfiles[profIdx] || null) : null;

  // Вид теста фиксируется на ВХОДЕ в окно и внутри него не меняется: от него
  // зависит около восьмидесяти мест расчёта (см. wdbc-uh56 — окно атаки это
  // одна длинная последовательная сборка). Поэтому рукопашный профиль у
  // стрелкового выбирается ДО открытия окна — в HUD, — и приходит сюда уже
  // выбранным.
  //
  // Что список профилей внутри окна не предложит профиль ДРУГОГО вида — не
  // само собой разумеется, а отдельно обеспечено фильтром в
  // attack/selection.mjs (profileOptions). Без него игрок переключал бы вид
  // теста уже после того, как окно посчитало порог, и бросок расходился бы с
  // окном — там же разобрано, чем именно.
  const isMelee = attackIsMelee(sys, { forceMelee, profile: startProfile });
  const charKey = isMelee ? "ws" : "bs";

  // ── Правила из реестра (module/rules/) ───────────────────────────────────
  //   Атака — такой же тест конвейера, как бросок навыка: вид теста «attack»,
  //   область эффекта «attack» или «weapon:<класс>». Актор цели нужен
  //   правилам, чей отбор зависит от того, по кому бьют (targetHasTrait).
  //   Считается ЗДЕСЬ, раньше свойств оружия ниже: grantWeaponProp-эффекты
  //   (wdbc-w8z4 — доп. Особое Свойство от метки на цели/Дара и т.п.) обязаны
  //   попасть в _entries ДО resolveWeaponPropsList/aggregateAuto, иначе wp
  //   (урон/порог/памятки) не увидит их вовсе.
  const attackCtx = {
    kind: "attack",
    weaponClass: sys.weaponClass,
    isMelee,
    char: charKey,
    targetActor: [...(game.user?.targets ?? [])][0]?.actor ?? null
  };
  const resolvedAttack = resolveTest({ actor, ...attackCtx });

  // ── Особые свойства оружия (+ модификации + боеприпас + правило) ─────────
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
  // Свойства от правила (wdbc-w8z4): уже отобраны по `when` конвейером теста
  // выше — не галочка, применяются так же безусловно, как ammo/gripProps.
  _entries = mergeExtraProps(_entries, { ruleProps: resolvedAttack.weaponProps });
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
  // Эффекты модификации лежат во ВЛОЖЕННОМ system.effects (схема
  // module/data/item/weapon-mod.mjs), как их и читает getModEffects
  // (combat/weapon-mods.mjs:38). Здесь они раньше читались плоско из
  // system.*, из-за чего Pistol Grip и Secondary Grip не работали вовсе:
  // DataModel плоское поле отбрасывает, так что у реальных модов там всегда
  // undefined (wdbc-xwe0).
  const modFxOf = m => m.system?.effects || {};
  const modGrantedGrips = installedMods.map(m => modFxOf(m).grantsGrip).filter(Boolean);
  const commandoGrip    = (!isMelee && wp.carbine && hasRuleFlag(actor, "weapon.commandoCarbine")) ? "1р" : null;
  const doubleGripGrip  = (!isMelee && sys.weaponClass === "pistol" && hasRuleFlag(actor, "weapon.doubleGripPistol")) ? "2р" : null;
  // Откатная Перчатка / Подавители Отдачи / Рука-Пушка (wdbc-f7iw, wdbc-6tzk):
  // винтовку и длинную винтовку (обе в классе basic, стр. 171) можно держать
  // одной рукой. Тот же список собирает rules/hands.mjs::availableRangedGrips —
  // иначе окно атаки разрешило бы хват, которого бюджет рук не знает.
  const oneHandRifleGrip = (!isMelee && sys.weaponClass === "basic"
                         && hasRuleFlag(actor, "weapon.oneHandedRifle")) ? "1р" : null;
  const extraGrips = [...modGrantedGrips, ...(commandoGrip ? [commandoGrip] : []),
                      ...(doubleGripGrip ? [doubleGripGrip] : []),
                      ...(oneHandRifleGrip ? [oneHandRifleGrip] : [])];
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
    isGrenade:  sys.weaponType === "grenade",
    // Best.Q Откатная Перчатка (wdbc-vsma): человек берёт легионное оружие без
    // штрафов за Размер и Силу, «неудобная форма» −10 остаётся.
    ignoresSizeStrength: hasRuleFlag(actor, OVERSIZED_FIT_FLAG)
  });
  // Огрины (wdbc-flai): свойство Ogrynized устроено как Legion выше — чужак не
  // сладит с огринским хватом, а Огрин не пролезет пальцем в человеческую
  // скобу (−10, для стрелкового −20). Best.Q Откатная Перчатка снимает те же
  // два слагаемых, что и у Легиона: книга даёт её сразу для обоих.
  const ogrynFit = ogrynAttackPenalty({
    hasOgrynized: _entries.some(e => e.key === "ogryned"),
    fitsOgryn:    hasRuleFlag(actor, OGRYN_FIT_FLAG),
    size:         actor.system.size ?? 0,
    sBonus:       actor.system.characteristics?.s?.bonus ?? 0,
    isRanged:     !isMelee,
    ignoresSizeStrength: hasRuleFlag(actor, OVERSIZED_FIT_FLAG)
  });
  // Арсенал (стр. 62): без Weapon Training на класс оружия — штраф −20.
  const weaponTraining = weaponTrainingPenalty({
    actor, weaponType: sys.weaponType, weaponClass: sys.weaponClass,
    isGrenade: sys.weaponType === "grenade"
  });

  // ── Тактическая карта (wdbc-8k0i): дистанция/контакт/Укрытие по токенам ───
  // сцены. Меряется один раз при открытии окна (позиции не двигаются, пока
  // диалог открыт) — подсказка и автоподстановка, всё остаётся правимо рукой.
  // Именно placeable (второй аргумент false): coverBonusForShot меряет по
  // .center, которого у TokenDocument нет — с документом Укрытие молча даёт 0.
  // Первый аргумент — false (найдено live-тестом): getActiveTokens(true, …)
  // фильтрует по actorLink и возвращает пусто для токена без «Синхронизировать
  // с актором» (обычное состояние вручную перетащенного на карту персонажа) —
  // Укрытие/дистанция тогда молча не подставлялись даже с верно оттаргеченной
  // целью. false подхватывает токен независимо от привязки.
  const attackerToken = actor.getActiveTokens?.(false)?.[0] ?? null;
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

  // Один обход правил актора на диалог: mods/rerolls/crit/weaponProps из
  // одного результата, посчитанного выше (до сборки _entries/wp).
  const ruleMods = ruleRollModsHtml(actor, attackCtx, resolvedAttack);
  // Перебросы от правил (Локус Буйства — «перебросить любой тест атаки»).
  // Отдельным блоком: складывать их не с чем, выбирается один.
  const ruleRerolls = ruleRerollsHtml(actor, attackCtx, resolvedAttack);
  // Перебросы, навязанные ЦЕЛИ (Локус Кровопролития), в свой блок не идут:
  // бросает их защищающийся у себя. Они уезжают атрибутом на кнопки защиты в
  // карточке атаки — см. combat/attack-card.mjs.
  const forcedDefenceReroll = (resolvedAttack.rerolls || [])
    .find(r => r.who === "target")?.mode || "";

  // Один Против Сотни (wdbc-u0by): авто-обнаружение, не чекбокс — цель Орда
  // проверяется программно (game.user.targets), самоотчёт тут не нужен.
  const oneVsHundred = oneAgainstAHundredAdvantage(actor, attackCtx.targetActor?.type === "horde");
  const oneVsHundredHtml = oneVsHundred
    ? `<div class="roll-defense-note">⚔️ Один Против Сотни: Преимущество на атаку (цель — Орда)</div>`
    : "";

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

  // Повален (стр. 30-31, wdbc-r5o7.2): «Стрельба по нему −20, рукопашная —
  // +20» — та же форма, что у Бега (runningMod) чуть выше, тем же приёмом,
  // что уже сделан для Беспомощной цели (badge, не «Спецправила»/rollBonus:
  // безусловное книжное правило, не галочка на усмотрение игрока).
  const targetProne    = !!attackCtx.targetActor?.system?.conditions?.prone;
  const proneMod       = targetProne ? (isMelee ? 20 : -20) : 0;
  const proneBadge     = targetProne
    ? `<span class="atk-training-warn" title="Цель Повалена (стр. 30-31)">🧎 Цель Повалена (${isMelee ? "+20" : "−20"})</span>`
    : "";

  // Оглушение/Ступор цели (стр. 30-31, wdbc-r5o7.3): «все атаки по нему
  // получают +20» — безусловно, тем же приёмом, что Повален/Беспомощна
  // выше. isStunnedOrDazed — Ступор считается Оглушением «для прочих
  // эффектов» (rules/predicates.mjs). Название бейджа/строки НЕ «Цель
  // Оглушена» буквально — эта фраза уже занята независимым ручным
  // чекбоксом «Ситуативные» (commonMods ниже, для случаев, которые система
  // не отследит сама), тот же приём, что различают «Цель лежит»
  // (ручной)/«Цель Повалена» (авто) и «Цель бежит» (тот и другой).
  const targetStunned  = isStunnedOrDazed(attackCtx.targetActor);
  const stunnedMod     = targetStunned ? 20 : 0;
  const stunnedBadge   = targetStunned
    ? `<span class="atk-training-warn" title="Цель Оглушена/в Ступоре (стр. 30-31)">💫 Цель Оглушена/в Ступоре (+20)</span>`
    : "";

  // Шаг За Шагом (стр. 73 Книги Аэльдари): +10, пока персонаж инициировал
  // рукопашный бой или продолжает в нём находиться — то есть практически
  // всегда, когда идёт рукопашная атака этим оружием; безусловно, без галочки.
  const stepByStepMod = (isMelee && wp.stepByStep) ? 10 : 0;
  const wpAttackMod  = (wp.attackMod || 0) + (modFx.attackMod || 0) + qTestMod + legionFit.total + ogrynFit.total + weaponTraining.total + targetStanceMod + exposedMod + helplessRangedMod + runningMod + stepByStepMod + bowMarkedMod + proneMod + stunnedMod;
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
    // Явная категория профиля важнее метки (wdbc-bs0q): у «Удара в упор» метка
    // должна читаться игроком как «Удар в упор», а категория при этом — та,
    // которой книга велит бить («как Булава», «как Посох»). Раньше категория
    // выводилась только из метки, и у выводимого профиля она выходила пустой,
    // то есть Тренировка молча не спрашивалась вовсе.
    const raw = p?.meleeCategory || p?.label || meleeCategory;
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

  const loadedAmmo = sys.loadedAmmoId ? actor.items.get(sys.loadedAmmoId) : null;
  const ammoSys    = loadedAmmo?.system;
  const ammoAtkMod = ammoSys?.attackMod ?? 0;

  const maneuverKeyDefault = techniqueOpts.technique || "standard";
  // Что предложить в списках Профиля/Стойки/Хвата/Базы/Приёма и что даёт
  // выбранная связка — в sheets/attack/selection.mjs (wdbc-uh56).
  const {
    profileOptions, computeStanceOptions, computeGripOptions, computeBaseOptions,
    computeManeuverOptions, computeLockNoteHtml, resolveSelectionSafe, dyn0
  } = buildSelection({
    actor,
    atkProfiles,
    bowMarkedMod,
    categoryFor,
    fullAttackForced,
    gripKey,
    gripList,
    hasShieldEquipped,
    isMelee,
    isMounted,
    item,
    maneuverKeyDefault,
    meleeBaseKey,
    primGrip,
    profIdx,
    sBonus,
    stance,
    sys,
    trainingFor,
    wp,
  });

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
    return `${baseBadge}${stanceBadge}${blockedBadge}${computeLockNoteHtml(sel.pIdx)}${targetStanceBadge}${exposedBadge}${runningBadge}${bowMarkedBadge}${targetHelplessBadge}${proneBadge}${stunnedBadge}${ammoBadge}${fatigueBadge}${drugAtkBadge}${handsBadge(sel)}`;
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
  // Ослеплён (стр. 30-31, wdbc-r5o7.4): автопровал BS, −30 WS — тот же
  // приём, что Усталость выше (autoCheck на реальном состоянии, галочка
  // остаётся ручной для случаев, которые система не отследит сама, напр.
  // ослепление вспышкой без хранимого флага). isBlindedActor — свой флаг
  // ИЛИ Потеря обоих глаз (rules/predicates.mjs).
  const isBlinded = isBlindedActor(actor);
  // Потеря глаз (частичная, book: «−10 на BS», независимо от полной
  // слепоты) — читает флаг напрямую, не через isBlindedActor: тут именно
  // «хоть один глаз потерян», а не производное «оба потеряны = Ослеплён».
  const hasLostEyes = !!actor.system.conditions?.lostEyes;

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
    const hipFireSemi = hipFireOk ? installedMods.reduce((n, m) => n + (Number(modFxOf(m).hipFireSemiMod) || 0), 0) : 0;
    const hipFireFull = hipFireOk ? installedMods.reduce((n, m) => n + (Number(modFxOf(m).hipFireFullMod) || 0), 0) : 0;
    const hipFireSupp = hipFireOk ? installedMods.reduce((n, m) => n + (Number(modFxOf(m).hipFireSuppressionMod) || 0), 0) : 0;
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
    .filter(m => modFxOf(m).grantsGrip && modFxOf(m).grantsGrip === gripKey)
    .reduce((mult, m) => mult * (Number(modFxOf(m).gripRangeMult) || 1), 1);
  const gripRange = Math.round((Number(sys.range) || 0) * gripRangeMult);

  let rangeInfoHtml = "";
  if (!isMelee && sys.range > 0) {
    const rng     = gripRange;
    const rngMult = ammoSys?.rangeMultiplier ?? 1;
    const rngAdd  = ammoSys?.rangeMod ?? 0;
    const effRng  = Math.round(rng * rngMult) + rngAdd;
    const bounds  = rangeBandBoundaries(effRng);
    // У короткоствольного оружия (Rng ≤ 6) «короткая»/«боевая» вырождены упором
    // (см. rangeBandBoundaries) — их границы совпадают, строку не показываем,
    // иначе игрок увидит бессмысленное "Короткая: 3–3м".
    const zones = [
      { cls: "atr-pb", label: "В упор",   mod: "+30", lo: 0.5,            hi: bounds.pointBlank },
      { cls: "atr-sh", label: "Короткая", mod: "+10", lo: bounds.pointBlank, hi: bounds.short },
      { cls: "atr-cb", label: "Боевая",   mod: "±0",  lo: bounds.short,      hi: bounds.combat },
      { cls: "atr-lg", label: "Дальняя",  mod: "−10", lo: bounds.combat,     hi: bounds.long },
      { cls: "atr-ex", label: "Экстрем.", mod: "−30", lo: bounds.long,       hi: bounds.extreme }
    ].filter(z => z.hi > z.lo);
    const zonesHtml = zones
      .map(z => `<span class="atr-zone ${z.cls}">${z.label}: ${z.lo}–${z.hi}м → <b>${z.mod}</b></span>`)
      .join("\n          ");
    rangeInfoHtml = `
      <div class="atk-range-info">
        <div class="atk-range-title">
          📏 Дистанции (Rng = ${rng}м${rngMult !== 1 ? ` ×${rngMult}` : ""}${rngAdd !== 0 ? ` ${rngAdd >= 0 ? "+" : ""}${rngAdd}м` : ""} = ${effRng}м)
        </div>
        <div class="atk-range-grid">
          ${zonesHtml}
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


  // Ситуативные модификаторы вынесены в sheets/attack/mods.mjs (wdbc-uh56):
  // данные без вёрстки, шов замерен (12 внутрь, 4 наружу).
  const { bandKey, charSwapWhy, commonMods, specificMods } = situationalMods({
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
    wProps,
    wp,
  });

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
  // Штраф Огринов — тот же приём и та же вёрстка, что у Легиона выше.
  const ogrynHtml = ogrynFit.parts.length ? `
    <div class="atk-dlg-modifiers atk-legion-note">
      <div class="atk-mods-title">${rollIcon("gear","#ffb84d")}Огрины: ${ogrynFit.total} к тесту</div>
      <div class="atk-wprops-list">${ogrynFit.parts
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
    </div>` : "") + legionHtml + ogrynHtml + weaponTrainingHtml;
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
  // Сборка разметки вынесена в sheets/attack/markup.mjs (wdbc-uh56): второй
  // односторонний шов — значения только входят, наружу идёт одна строка.
  const content = buildAttackContent({
    actor,
    aimHtml,
    aimingPills,
    ammoCondHtml,
    ammoDialogHtml,
    attackerMount,
    autoCoverMod,
    autoHitAvailable,
    autoMountRangedMod,
    badgesHtml,
    bandHtml,
    charKey,
    charSwapWhy,
    charVal,
    commonMods,
    distanceHintHtml,
    dyn0,
    fanningActive,
    fanningRofMax,
    forceMelee,
    isMelee,
    item,
    makeMods,
    maximalHtml,
    mountHtml,
    offHtml,
    oneVsHundredHtml,
    presetModifier,
    rangeInfoHtml,
    rechargeWarnHtml,
    rofPills,
    ruleMods,
    ruleRerolls,
    shortRangeHtml,
    specificMods,
    sys,
    techSectionsHtml,
    wp,
    wpDialogHtml,
  });

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
      { label: "Огрины",             value: ogrynFit.total },
      { label: "Тренировка",         value: weaponTraining.total },
      { label: "Стойка цели",        value: targetStanceMod },
      { label: "Цель раскрыта",      value: exposedMod },
      { label: "Беспомощная цель",   value: helplessRangedMod },
      { label: "Цель бежит",         value: runningMod },
      { label: "Цель Повалена",      value: proneMod },
      { label: "Оглушение/Ступор цели", value: stunnedMod },
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
  // Подключение окна — кнопки, обработчики полей, пересчёт порога на лету —
  // вынесено в sheets/attack/dialog.mjs (wdbc-uh56). Это единственный
  // ОДНОСТОРОННИЙ шов функции: последний оператор, после него ничего нет, и
  // значения идут только внутрь. Замер ширины интерфейса по всей длине
  // функции дал 90–106 значений в середине и узкие места только по краям.
  return openAttackDialog({
    actor,
    item,
    content,
    techniqueOpts,
    isMelee,
    forceMelee,
    wp,
    stance,
    gripKey,
    profIdx,
    meleeBaseKey,
    dyn0,
    resolvedAttack,
    rofModes,
    ammoConds,
    aimTargets,
    mountPair,
    oneVsHundred,
    fanningActive,
    autoHitAvailable,
    fullAttackForced,
    forcedDefenceReroll,
    helplessAutoMelee,
    badgesHtml,
    breakdownHtml,
    pillsHtml,
    thresholdOf,
    thresholdParts,
    resolveSelectionSafe,
    computeBaseOptions,
    computeGripOptions,
    computeManeuverOptions,
    computeStanceOptions,
  });
}

export async function showAttackDialogNoWeapon(actor, techDef) {
  if (isHallucinatingCannotAttack(actor))
    return ui.notifications.warn("⚠️ Галлюцинации («Я маленький...») — не может совершать Атаки.");
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
  // Штрафы состояния тела — из конвейера (wdbc-kuun): раньше считалась одна
  // Усталость, а выключенная силовая броня и Перевес инвентаря до приёма без
  // оружия не доезжали, хотя это физическое действие.
  //
  // collectTestMods, а НЕ autoTestMods: у ЭТОГО пути диалога с галочками нет
  // вовсе — бросок безусловный, по клику (см. комментарий про Локус
  // Сокрушения выше). Галочки правил показывает соседний showAttackDialog, а
  // здесь спрашивать негде, и autoTestMods молча терял бы всё, что реестр
  // даёт атаке: «+10 к любому удару» с Черты просто не доезжал (wdbc-t8dt,
  // найдено живой проверкой — синтетическое правило area:attack не попадало
  // ни в сумму, ни в карточку).
  const bodyMods = collectTestMods(actor, { kind: "attack", isMelee: true, char: "ws" });
  const fatigue  = bodyMods.total;
  // WS уже включает мод препаратов (см. prepareDerivedData)
  const final    = ws + techDef.wsBonus + baseBon + stBon + fatigue;

  // Беспомощная цель, рукопашная (в т.ч. безоружная) — авто-успех и ×2 урона,
  // как и в showAttackDialog (см. helplessAutoMelee там же).
  const targetHelpless = !!([...(game.user?.targets ?? [])][0]?.actor)?.system?.conditions?.helpless;

  const roll     = await new Roll("1d100").evaluate();
  const rv       = roll.total;
  const { success: hit, deg } = testOutcome(rv, final, { autoSuccess: targetHelpless });
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

  // Урон безоружного удара, стр. 40. Кулак/Пинок/Удар головой переехали в
  // обычные Item'ы (showAttackDialog выше, альт-профиль Unarmed Warrior), а
  // удар стрелковым в упор — в профиль оружия (wdbc-bs0q), так что ни один из
  // прежних поставщиков этой ветки в неё больше не заходит. Живой остаётся
  // из-за apps/cancerous-healing.mjs — он единственный зовёт
  // showAttackDialogNoWeapon.
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

  // Слагаемые Порога — подписями из самого сбора (wdbc-kuun). Раньше
  // вся сумма bodyMods показывалась одним числом с подписью «усталость» —
  // и выключенная броня, Перевес и «+10 к любому удару» с Черты приходили
  // игроку под чужим именем или сливались в одно непонятное число.
  const thresholdParts = [
    `база ${baseBon >= 0 ? "+" : ""}${baseBon}${fullAttackForced ? " (Локус Сокрушения)" : ""}`,
    stBon !== 0 ? `стойка ${stBon >= 0 ? "+" : ""}${stBon}` : "",
    techDef.wsBonus !== 0 ? `${techDef.wsBonus >= 0 ? "+" : ""}${techDef.wsBonus}` : "",
    ...bodyMods.parts
  ];

  await postTestCard(actor, {
    // Предисловие — блок выше шапки: название Приёма и его пометка.
    prelude: `<div class="roll-technique-block">${rollIcon("sword")}Приём: <b>${techDef.label}</b>
          ${techDef.chatNote
            ? `<div class="roll-technique-note">${techDef.chatNote}</div>` : ""}
        </div>`,
    icon: rollIcon("sword"),
    title: `${techDef.label} ${techDef.headerSuffix ? `— ${techDef.headerSuffix}` : "(без оружия)"}`,
    threshold: thresholdLine({ label: "WS", base: ws, parts: thresholdParts, threshold: final }),
    rv, outcome,
    sections: [helplessNote, unarmedDmgSection, defButtons, hitExtraSection]
  }, { rolls: allRolls });
}
