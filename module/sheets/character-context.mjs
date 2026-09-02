// module/sheets/character-context.mjs
//
// Вторая половина сборки контекста листа персонажа. Первая —
// buildGetData() в sheet-helpers.mjs: она собирает списки вкладок (навыки,
// оружие, снаряжение, психосилы). Здесь — сам персонаж: сенсоры шапки,
// таблица характеристик, поглощение и порог Усталости, раса и происхождение,
// Пути Аэльдари, снятый шлем и вкладка Одержимости.
//
// Функция принимает актора, а не лист, поэтому проверяется без Foundry. На
// листе остаётся только то, что зависит от состояния окна (свёрнутые секции)
// и от переопределяемых им путей — Очки Бесчестия у Демон-Принца.

import { CHARACTERISTICS }                       from "../constants/characteristics.mjs";
import { CHAR_IMP_STEPS }                        from "./tabs/advance.mjs";
import { equippedMeleeWeapon } from "../combat/equipped-melee.mjs";
import { charAptitudeSet, resolveCharCat }       from "../constants/advancement.mjs";
import { fateTerm }                              from "../helpers/utils.mjs";
import { raceEntries, raceDef, subracesOf,
         isAeldariRace, raceGroupList,
         subraceEntries }                        from "../apps/race-library.mjs";
import { actorRaceItem, actorSubraceItem }       from "../apps/races.mjs";
import { AZURIANE_PATHS, PATH_GRADES, PATH_GRADE_ORDER,
         buildPathSelectOptions, buildGradeSelectOptions } from "../constants/aeldari-paths.mjs";
import { buildWorldSelectOptions, buildBandSelectOptions,
         getWorld, getBand }                     from "../constants/aeldari-origins.mjs";
import { buildDrukhariFactionOptions, getDrukhariFaction,
         buildDrukhariDistrictOptions, getDrukhariDistrict } from "../constants/drukhari-factions.mjs";
import { buildMasqueOptions, getMasque }         from "../constants/harlequin-masques.mjs";
import { BODY_TYPES }                            from "../constants/body-map.mjs";
import { isHaemonculus }                         from "../constants/haemonculus.mjs";
import { HELMETLESS_EFFECTS, HELMETLESS_ACTION } from "../constants/power-armour-lore.mjs";
import { actorCanFly, actorHasHalfStep, narrativeSpeed } from "../combat/movement-actions.mjs";
import { isFeatureEnabled, disabledRaceKeys }    from "../constants/features.mjs";
import { isHelmetMod,
         disabledArmourPeriodicTestRemaining }   from "../combat/armor-mods.mjs";
import { archetypeSheetContext }                 from "../apps/archetypes.mjs";
import { homeworldSheetContext }                 from "../apps/homeworlds.mjs";
import { itemHasName, hasEliteArchetype, isPossessed } from "../rules/predicates.mjs";
import { raceMatches } from "../rules/race.mjs";

/**
 * Текст всплывашки «Итого» (title, поддерживает перенос строки \n) — из чего
 * сложилось число: разборку строит documents/actor.mjs (тот же проход, что и
 * сам total/halfMove — char.totalBreakdown, system.movement.spdBreakdown).
 */
function charTotalTooltip(total, breakdown) {
  const lines = (breakdown || []).map(b => {
    if (b.cap != null)   return `${b.label}: не выше ${b.cap}`;
    if (b.floor != null) return `${b.label}: не ниже ${b.floor}`;
    if (b.label === "База") return `${b.label}: ${b.value}${b.note ? ` (${b.note})` : ""}`;
    const sign = b.value > 0 ? "+" : "−";
    return `${b.label}: ${sign}${Math.abs(b.value)}`;
  });
  return [`Итого: ${total}`, "", ...lines].join("\n");
}

/**
 * Есть ли у актора Элитный архетип с этим именем — предметом, строкой в шапке
 * (`system.eliteArchetype`) или в списке дополнительных (`eliteArchetypesExtra`).
 * Тот же трёхисточниковый пример, что и в sheets/item-picker.mjs (talentGroupLock):
 * архетип бывает и предметом (куплен пикером), и строкой (вписан руками/со
 * старого листа) — обе формы должны отпирать одно и то же.
 */
import { divinationSheetContext }                from "../apps/divinations.mjs";
import { haemonculusContext }                    from "./tabs/haemonculus.mjs";
import { possessionContext }                     from "./tabs/possession.mjs";
import { hasSkillfulTorture }                    from "../apps/skillful-torture.mjs";
import { hasAvatarOfSlaughter }                  from "../combat/avatar-of-slaughter.mjs";
import { hasDreadWail }                          from "../combat/dread-wail.mjs";
import { hasResplendentRaiment }                 from "../combat/resplendent-raiment.mjs";
import { hasAdrenalineRush }                     from "../combat/adrenaline-rush.mjs";
import { hasBoneSong }                           from "../combat/bone-song.mjs";
import { hasPreservation }                       from "../combat/preservation.mjs";
import { hasSongOfSwiftness }                    from "../combat/song-of-swiftness.mjs";
import { hasReformationSong }                    from "../combat/reformation-song.mjs";
import { hasBeastmanShamanTalent, hasBeastmanShamanTrait } from "../combat/beastman-shaman.mjs";
import { hasConjureWraith }                      from "../combat/conjure-wraith.mjs";
import { MELEE_BASES, MELEE_CONTESTS, MELEE_STANCES } from "../constants/combat.mjs";
import { hasActionEconomy, isEncounterActive, effectiveDefenseReactionMax,
         effectiveActionPointsMax,
         apSpendGate, reactionSpendGate }         from "../combat/action-economy.mjs";
import { recoilRemaining, recoilLimit }           from "../combat/recoil-pool.mjs";
import { hasSpiritTalk, spiritTalkGate } from "../combat/spirit-talk.mjs";
import { hasDeadlyEffectiveness, deadlyEffectivenessGate } from "../combat/deadly-effectiveness.mjs";
import { hasBowToAudience, bowToAudienceGate } from "../combat/bow-to-audience.mjs";

// Метка характеристики с учётом мировоззрения: у Хаосита «Влияние» → «Бесчестие».
export function charLabel(key, alignment) {
  if (key === "inf" && alignment === "heretic") return "Бесчестие";
  return CHARACTERISTICS[key]?.label ?? key;
}

export function characterContext(actor) {
  const system  = actor.system;
  const context = {};

  // ── Архетип (шапка): селектор из компендиума, только доступные текущей расе ──
  context.archetype = archetypeSheetContext(actor);

  // ── Бой: Стойка/База — постоянное состояние актора (system.meleeStance/
  // meleeBase), диалог атаки лишь ЧИТАЕТ его как стартовое значение и умеет
  // сменить на разовый бросок (module/sheets/attack-dialog.mjs) — но нигде,
  // кроме диалога, было не посмотреть и не сменить текущий выбор без начала
  // атаки. Панель на БОЙ восстановлена — та же пара полей, что пишет диалог,
  // так что оба места остаются в силе автоматически, простой read/write
  // одного и того же actor.update. Состязания (Повалить/Финт/Давление/
  // Напролом) в диалог атаки не переехали — это отдельный встречный тест без
  // диалога атаки вовсе (module/combat/techniques.mjs, _showContestDialog),
  // их панель на вкладке БОЙ была и остаётся нужна.
  const meleeBaseKey  = system.meleeBase in MELEE_BASES ? system.meleeBase : "standard";
  const meleeStanceKey = system.meleeStance in MELEE_STANCES ? system.meleeStance : "standard";
  context.combatStanceOptions = Object.entries(MELEE_STANCES)
    .map(([key, s]) => ({ key, label: s.label, desc: s.shortDesc, active: key === meleeStanceKey }));
  context.combatBaseOptions = Object.entries(MELEE_BASES)
    .map(([key, b]) => ({ key, label: b.label, desc: b.shortDesc, active: key === meleeBaseKey }));
  // Тот же экипированный рукопашный/метательный предмет, что берёт клик по
  // кнопке Состязания (module/sheets/tabs/combat.mjs) — его категория решает,
  // какие кнопки показывать (Повалить книгой ограничен Оружием и Базой, стр.
  // 14). Без экипированного рукопашного оружия категория неизвестна — тот же
  // «мягкий» пропуск, что и в диалоге атаки.
  // Интегральные атаки (кулак/пинок) надеты всегда — берутся только фолбэком
  // (см. equipped-melee.mjs), иначе категория «Кулаки» затирала бы меч.
  const meleeItem     = equippedMeleeWeapon(actor);
  const meleeCategory = meleeItem?.system?.meleeCategory || "";
  // Финт/Давление/Напролом книгой в этом разделе не ограничены (приходят из
  // Талантов, у которых своих ограничений в этом коде нет) — только Повалить.
  context.combatContestOptions = Object.entries(MELEE_CONTESTS)
    .filter(([key, c]) => {
      const categoryOk = !c.categories || !meleeCategory || c.categories.includes(meleeCategory);
      const baseOk     = !c.bases || c.bases.includes(meleeBaseKey);
      return categoryOk && baseOk;
    })
    .map(([key, c]) => ({ key, label: c.label, modLabel: c.modLabel }));

  // ── Бой: Очки Действия / Реакции (стр. 12) ──────────────────────────────
  // Только отображение и статус — сама трата/сброс идёт через
  // module/combat/action-economy.mjs (спенд уже вшит в Уклонение/Парирование,
  // остальные действия тратятся кнопками combat.mjs::activateCombatListeners).
  if (hasActionEconomy(actor)) {
    const defenseMax = effectiveDefenseReactionMax(actor);
    context.actionEconomy = {
      ap:        { value: system.actionPoints?.value ?? 0, max: effectiveActionPointsMax(actor) },
      reactions: { value: system.reactions?.value ?? 0, max: system.reactions?.max ?? 0 },
      // Доп. Реакции «только на Избегание» видны лишь пока есть что показать —
      // вне Защитной Стойки (или без надбавки от будущего Таланта) их 0,
      // отдельная строка на листе была бы пустым шумом.
      defense: (system.reactions?.defenseValue || defenseMax)
        ? { value: system.reactions?.defenseValue ?? 0, max: defenseMax }
        : null,
      encounterActive: isEncounterActive(),
      exposed: !!actor.getFlag("warhammer-dbc", "exposedAggressive"),
      // Отскок (стр. 12, wdbc-9wvm): дистанция за Раунд, тот же честный
      // «∞ вне боя» принцип, что у остальной экономики действий —
      // recoilRemaining/recoilLimit сами отдают Infinity вне Encounter.
      recoil: { value: recoilRemaining(actor), max: recoilLimit(actor) }
    };
    // Гейт кнопок ДО клика (wdbc-qjnk): движение (Полушаг/Шаг/Бег — Натиск
    // ОД на объявлении не тратит, см. apSpendGate) и ручная трата ae-spend-btn
    // на вкладке БОЙ — тот же disabled+title, что у disabled-armour-periodic-
    // test-btn. Вне активного Encounter apSpendGate/reactionSpendGate сами
    // всегда {disabled:false} — кнопки остаются активны, как и раньше.
    context.moveGate = {
      half: apSpendGate(actor, 1),
      full: apSpendGate(actor, 2),
      run:  apSpendGate(actor, 2)
    };
    context.aeSpendGate = { ap1: apSpendGate(actor, 1), ap2: apSpendGate(actor, 2), reaction: reactionSpendGate(actor) };
    // Spirit Talk/Духовный Разговор (wdbc-q30d): гейт зависит от game.user.
    // targets (единственная Техника)/ОД/боя/кулдауна сессии (spirit-talk.mjs).
    if (hasSpiritTalk(actor)) context.spiritTalkGate = spiritTalkGate(actor);
    // Deadly Effectiveness/Смертоносная Эффективность (wdbc-1rno): кнопка
    // видна только владельцу Таланта, гейт — cooldown.mjs "раз в Раунд".
    if (hasDeadlyEffectiveness(actor)) context.deadlyEffectivenessGate = deadlyEffectivenessGate(actor);
    // Bow to the Audience/Поклон Публике (wdbc-1rno): та же видимость только
    // владельцу Таланта, гейт зависит от game.user.targets/ОД (bow-to-audience.mjs).
    if (hasBowToAudience(actor)) context.bowToAudienceGate = bowToAudienceGate(actor);
  }

  // Кнопка «Полёт» на вкладке БОЙ (module/combat/movement-actions.mjs, стр.
  // 30) видна только с Чертой Flyer/Hoverer — та же проверка, что и в самой
  // кнопке Token HUD/меню, продублирована здесь только ради видимости кнопки.
  context.movementCanFly = actorCanFly(actor);
  // Полушаг (wdbc-9wvm) — та же видимость «только с Талантом», что у Полёта.
  context.movementCanHalfStep = actorHasHalfStep(actor);

  // Откуда число (wdbc-zbiz): мод-бейдж Полушага (= SPD×1) — тот же приём,
  // что charTotalTooltip у характеристик; breakdown строит documents/actor.mjs.
  context.spdTooltip = charTotalTooltip(system.movement?.halfMove, system.movement?.spdBreakdown);

  // Дистанции-превью на кнопках вкладки БОЙ (стр. 29): базовая часть
  // формулы без бросков (Карабканье — SPD/2, Плавание — ½S.b, те же
  // формулы, что показывает сам диалог в movement-actions.mjs); Прыжок и
  // Падение зависят от выбора в диалоге/броска — превью для них не строим.
  {
    const _halfMove = Number(system.movement?.halfMove) || 0;
    const _sBonus = Number(system.characteristics?.s?.bonus) || 0;
    context.movementDist = {
      climb: (_halfMove / 2).toFixed(1),
      swim: (_sBonus / 2).toFixed(1)
    };
  }
  // Базовая нарративная скорость (таблица «Движение в нарративном
  // времени», стр. 29) — строка-подсказка над кнопками маршей: марши
  // умножают именно эту базу (×2/×3/как обычно).
  context.movementNarrative = narrativeSpeed(system.movement?.halfMove);

  // ── Снаряжение: сенсор нагрузки (когитатор) ─────────────────────────────
  const _enc = system.encumbrance || {};
  const _encMax = Number(_enc.max) || 0, _encCur = Number(_enc.effectiveCurrent ?? _enc.current) || 0;
  const _pct = _encMax ? Math.round((_encCur / _encMax) * 100) : 0;
  context.encumbrancePct   = Math.max(0, Math.min(100, _pct));
  context.encumbranceOver  = _pct > 100;
  context.encumbranceLevel = _pct >= 100 ? "over" : _pct >= 66 ? "heavy" : "ok";
  // T.b + S.b — база строки Ношение/Подъём/Толкание (стр. 27, carryRow) —
  // напоказ перед тремя числами: не сама итоговая цифра (та ещё учитывает
  // Родной мир и Мод. Экзоскелета/подобных через Механику, kind:"weight"),
  // а именно голая сумма бонусов, как попросил пользователь.
  context.encumbranceIndexSum =
    (Number(system.characteristics?.t?.bonus) || 0) + (Number(system.characteristics?.s?.bonus) || 0);

  // ── Показатели: сенсоры Порчи/Безумия (когитатор) ───────────────────────
  const _cor = system.corruption || {};
  const _corLimit = Number(_cor.limit) || 100;
  const _corPct = Math.round(((Number(_cor.value) || 0) / _corLimit) * 100);
  context.corruptionPct = Math.max(0, Math.min(100, _corPct));
  context.corruptionLevel = _corPct >= 80 ? "over" : _corPct >= 50 ? "heavy" : "ok";
  const _insPct = Math.round(Number(system.insanity?.value) || 0);
  context.insanityPct = Math.max(0, Math.min(100, _insPct));
  context.insanityLevel = _insPct >= 70 ? "over" : _insPct >= 40 ? "heavy" : "ok";

  // ── Прочие сенсоры (шапка + Развитие) ───────────────────────────────────
  const _xp = system.experience || {};
  const _xpTot = Number(_xp.total) || 0, _xpSpent = Number(_xp.spent) || 0;
  context.xpPct = _xpTot ? Math.max(0, Math.min(100, Math.round((_xpSpent / _xpTot) * 100))) : 0;
  // Очки Судьбы — пипсы
  const _fVal = Number(system.fate?.value) || 0, _fMax = Number(system.fate?.max) || 0;
  context.fatePips = Array.from({ length: Math.min(10, Math.max(0, _fMax)) }, (_, i) => ({ on: (i + 1) <= _fVal }));
  // Усталость — шкала
  const _fatVal = Number(system.fatigue?.value) || 0, _fatMax = Number(system.fatigue?.max) || 0;
  const _fatPct = _fatMax ? Math.round((_fatVal / _fatMax) * 100) : 0;
  context.fatiguePct = Math.max(0, Math.min(100, _fatPct));
  context.fatigueLevel = _fatPct >= 100 ? "over" : _fatPct >= 66 ? "heavy" : "ok";

  // Родные миры — опциональное расширение: дропдаун «Происхождение» в шапке.
  context.homeworld = homeworldSheetContext(actor);
  context.divination = divinationSheetContext(actor);

  // Снятый шлем: галочка показывается, только если снаряжение вообще даёт
  // ОБ на голову (т.е. на персонаже есть шлем).
  if (isFeatureEnabled("helmetless") && (system.gearHeadAP || 0) > 0) {
    // Системы, стоящие в шлеме: со снятым шлемом не работают, кроме вокс-линка.
    const helmetMods = actor.items.filter(i =>
      i.type === "armorMod" && i.system.modGroup === "helmet" && i.system.installedOn);
    context.helmetless = {
      on: !!system.helmetOff, headAP: system.gearHeadAP,
      effects: HELMETLESS_EFFECTS, action: HELMETLESS_ACTION,
      disabled: helmetMods.filter(isHelmetMod).map(i => i.name),
      kept:     helmetMods.filter(i => !isHelmetMod(i)).map(i => i.name)
    };
  } else context.helmetless = null;

  // Перевес выключенной силовой брони: секунд до следующего теста T+0 «раз
  // в T.b часов» (стр. 233) — таймер держит флаг актора, ставит/снимает его
  // хук в hooks.mjs (module/combat/armor-mods.mjs), здесь только чтение для
  // кнопки на листе.
  if (system.disabledArmourOverload) {
    const tb = Number(system.characteristics?.t?.bonus) || 0;
    const testAt = actor.getFlag?.("warhammer-dbc", "disabledArmourOverloadTestAt");
    const remaining = disabledArmourPeriodicTestRemaining(testAt, game.time?.worldTime ?? 0, tb);
    context.disabledArmourPeriodicReady = remaining <= 0;
    context.disabledArmourPeriodicRemainingLabel = remaining > 0
      ? `${Math.floor(remaining / 3600)}ч ${String(Math.floor((remaining % 3600) / 60)).padStart(2, "0")}м`
      : null;
  } else {
    context.disabledArmourPeriodicReady = false;
    context.disabledArmourPeriodicRemainingLabel = null;
  }

  context.races = raceEntries();
  // Сгруппированный список рас для optgroup — расы выключенных подсистем
  // (напр. «Книга Эльдар») из списка убираем, кроме уже стоящей у этого
  // актора: так подсистему можно выключить, не сломав существующих
  // персонажей (та же логика, что и у disabledActorTypes()). Список в шапке
  // теперь не используется (слот открывает пикер), но остаётся частью
  // контракта get-data — им может пользоваться другой потребитель.
  const offRaces = disabledRaceKeys();
  context.raceGroups = raceGroupList().map(g => ({
    label: g.label,
    races: g.races.filter(r => r.key === system.race || !offRaces.includes(r.key))
  })).filter(g => g.races.length);
  context.availableSubraces = subracesOf(system.race);
  context.hasSubraces = context.availableSubraces.length > 0;
  // Слот субрасы стоит всегда, как у расы, но выбирать есть что не всегда.
  // Подсказка — причина отказа, показанная заранее: пустой слот, открывающий
  // пикер ради предупреждения «сначала выберите расу», врал бы игроку.
  // У Астартес субрас не бывает вовсе: их место занимают Легион и Орден
  // (Геносемя, стр. 489-506), и слот с вечным «Субрас нет» только отнимал
  // строку в шапке. Прочие расы без субрас слот сохраняют: у них он пустой
  // временно — субрасу могут добавить компендиумом.
  context.showSubrace = system.race !== "astartes";
  context.subraceHint = context.hasSubraces
    ? ""
    // Коротко: ячейка узкая, а имя расы рядом в соседнем слоте — в подсказке
    // оно только съедало ширину и обрезалось многоточием. Полная фраза — в title.
    : (system.race ? "Субрас нет" : "Сначала выберите расу");

  // Слот показывает предмет-носитель, а если его нет — расу по ключу-зеркалу
  // с пометкой «не применена»: так выглядят персонажи, созданные до переезда.
  const raceItem = actorRaceItem(actor);
  const raceKey  = system.race || "";
  context.raceSlot = raceItem
    ? { id: raceItem.id, key: raceKey, name: raceItem.name, img: raceItem.img, applied: true }
    : (raceKey ? { id: "", key: raceKey, name: raceDef(raceKey)?.label || raceKey,
                   img: "icons/svg/oak.svg", applied: false } : null);

  const subItem = actorSubraceItem(actor);
  const subKey  = system.subrace || "";
  context.subraceSlot = subItem
    ? { id: subItem.id, key: subKey, name: subItem.name, img: subItem.img, applied: true }
    : (subKey ? { id: "", key: subKey, name: subraceEntries()[subKey]?.label || subKey,
                  img: "icons/svg/oak.svg", applied: false } : null);
  context.isAeldari = isAeldariRace(system.race);
  context.isYnnari  = system.race === "ynnari";
  // Фактор Прибыли (Вольный Торговец): бонус = ФП ÷ 10 (как у характеристик)
  context.profitFactorBonus = Math.floor((Number(system.aspirations?.profitFactor) || 0) / 10);
  // Иннари: выбор «Прошлого» (бывшей расы) и её бонусы + Черты Иннари.
  context.ynnariPast      = system.ynnariPast || "";
  context.ynnariPastLabel = raceDef(system.ynnariPast)?.label || "";
  context.ynnariPastOptions = (raceDef("ynnari")?.pastRaces || [])
    .map(k => ({ key: k, label: raceDef(k)?.label || k }));
  // Арлекин: выбор «Прошлого» (изначальной расы) и её бонусы + Черты Арлекина.
  context.isHarlequin        = system.race === "harlequin";
  context.harlequinPast      = system.harlequinPast || "";
  context.harlequinPastLabel = raceDef(system.harlequinPast)?.label || "";
  context.harlequinPastOptions = (raceDef("harlequin")?.pastRaces || [])
    .map(k => ({ key: k, label: raceDef(k)?.label || k }));
  context.masqueOptions  = buildMasqueOptions(system.harlequinMasque || "");
  context.selectedMasque = getMasque(system.harlequinMasque || "");

  // Пути Аэльдари: для каждой строки — селект пути, селект градации,
  // полный текст выбранной градации и метка авто-бонусов.
  const pathRows = Array.isArray(system.paths) ? system.paths
    : (system.paths ? Object.values(system.paths) : []);
  context.charPaths = pathRows.map((row, idx) => {
    const key   = row.key || "";
    const grade = row.grade || "";
    const path  = AZURIANE_PATHS[key];
    const gradeIdx = PATH_GRADE_ORDER.indexOf(grade);
    // Градации КУМУЛЯТИВНЫ: показываем все достигнутые (Новичок..выбранная).
    const gradesShown = [];
    const cumChar = {};
    let cumCor = 0;
    if (path && gradeIdx >= 0) {
      for (let i = 0; i <= gradeIdx; i++) {
        const gk = PATH_GRADE_ORDER[i];
        const g  = path.grades?.[gk];
        if (!g) continue;
        gradesShown.push({ gradeLabel: PATH_GRADES[gk], desc: g.desc || "" });
        if (g.auto?.charBonus) {
          for (const [ck, cv] of Object.entries(g.auto.charBonus)) {
            cumChar[ck] = (cumChar[ck] || 0) + cv; // Unnatural суммируется по градациям
          }
        }
        if (g.auto?.corLimit) cumCor = Math.max(cumCor, g.auto.corLimit);
      }
    }
    const autoBits = [];
    for (const [ck, cv] of Object.entries(cumChar)) {
      const abbr = CHARACTERISTICS[ck]?.abbr || ck.toUpperCase();
      autoBits.push(`Unnatural ${abbr} (+${cv})`);
    }
    if (cumCor) autoBits.push(`+${cumCor} к лимиту Порчи`);
    return {
      idx,
      key, grade,
      pathOptions:  buildPathSelectOptions(key),
      gradeOptions: buildGradeSelectOptions(path, grade),
      label:        path?.label || "",
      group:        path?.group || "",
      gradesShown,
      autoLabel:    autoBits.join(", ")
    };
  });

  // Происхождение Аэльдари: Мир-Корабль и Корсарская Банда (вкладка Записи)
  // У Друкхари вместо этого — Кабал/Культ Ведьм/Ковен.
  // Друкхари бывает не только по расе: Иннари и Арлекин выбирают «Прошлое», и
  // выбравшему Друкхари полагается Кабал/Культ/Ковен, а не Мир-Корабль.
  // Управляет только показом друкхарийских вкладок/полей — пул Очков Боли
  // (actor.mjs, painActive) сознательно завязан строго на system.race==='drukhari',
  // Прошлое на него не влияет (решение владельца 31.08.2026).
  context.isDrukhari     = raceMatches(system, "drukhari");
  // Кнопка «Искусная Пытка» на вкладке БОЙ (wdbc-sk8s) — только владельцам Таланта.
  context.hasSkillfulTorture = hasSkillfulTorture(actor);
  // Кнопка «Аватар Резни» на вкладке БОЙ (wdbc-sk8s) — только владельцам Черты.
  context.hasAvatarOfSlaughter = hasAvatarOfSlaughter(actor);
  // Кнопка «Грозный Вопль» на вкладке БОЙ (wdbc-sk8s) — только владельцам Черты.
  context.hasDreadWail = hasDreadWail(actor);
  // Кнопка «Блистательные Одеяния» на вкладке БОЙ (wdbc-sk8s) — только владельцам Дара.
  context.hasResplendentRaiment = hasResplendentRaiment(actor);
  // Кнопка «Прилив Адреналина» на вкладке БОЙ (wdbc-ks1r) — только владельцам Таланта.
  context.hasAdrenalineRush = hasAdrenalineRush(actor);
  // Кнопки Певцов Кости на вкладке БОЙ (wdbc-sk8s) — только владельцам соответствующего Таланта.
  context.hasBoneSong = hasBoneSong(actor);
  context.hasPreservation = hasPreservation(actor);
  context.hasSongOfSwiftness = hasSongOfSwiftness(actor);
  context.hasReformationSong = hasReformationSong(actor);
  // Кнопки Шамана Зверолюдей на вкладке БОЙ (wdbc-xxb7) — только владельцам
  // соответствующего Таланта/Черты; god-ответвление читается живьём по
  // system.patronGod при клике, не здесь.
  context.hasPrimalHowl = hasBeastmanShamanTalent(actor, "Primal Howl / Первобытный Вой");
  context.hasWarpTaintedAura = hasBeastmanShamanTalent(actor, "Warp-Tainted Aura / Аура Скверны");
  context.hasRiteOfSelfSacrifice = hasBeastmanShamanTalent(actor, "Rite of Self-Sacrifice / Ритуал Самопожертвования");
  context.hasHexMarkedPrey = hasBeastmanShamanTalent(actor, "Hex-Marked Prey / Проклятая Метка");
  context.hasBoneRuneEtching = hasBeastmanShamanTalent(actor, "Bone-Rune Etching / Костяная Рунопись");
  context.hasRitualBloodletting = hasBeastmanShamanTrait(actor, "Ritual Bloodletting / Ритуал Кровопускания");
  context.hasConjureWraith = hasConjureWraith(actor);
  context.showWorldOrigin = context.isAeldari && !context.isDrukhari;
  context.worldOptions   = buildWorldSelectOptions(system.world || "");
  context.bandOptions    = buildBandSelectOptions(system.band || "");
  context.selectedWorld  = getWorld(system.world || "");
  context.selectedBand   = getBand(system.band || "");
  context.drukhariFactionOptions = buildDrukhariFactionOptions(system.drukhariFaction || "");
  context.selectedDrukhariFaction = getDrukhariFaction(system.drukhariFaction || "");
  context.drukhariDistrictOptions = buildDrukhariDistrictOptions(system.drukhariDistrict || "");
  context.selectedDrukhariDistrict = getDrukhariDistrict(system.drukhariDistrict || "");

  // Телосложение: набор PNG-масок фигуры на вкладке «ТЕЛО». Есть у любого
  // персонажа, поэтому считается вне ветки хаоситов.
  context.bodyTypes = Object.entries(BODY_TYPES).map(([key, label]) =>
    ({ key, label, selected: (system.bodyType || "male") === key }));


  // ── Одержимый (DoomBC_Core 129-132): синергия хоста и Двойного Духа ──────
  context.isHeretic = system.alignment === "heretic";

  // ── Гемункул: путь возвышения (стадии 0–5) и таблицы трейтов ──────────
  context.isHaemonculus = isHaemonculus(actor);
  if (context.isHaemonculus) context.haem = haemonculusContext(actor);

  // ── Одержимый (DoomBC_Core 129-132): синергия хоста и Двойного Духа ──────
  // Вкладка теперь отпирается ещё и Элитным архетипом «Одержимый» — не только
  // ручным чекбоксом у Хаосита.
  context.hasPossessedArchetype = hasEliteArchetype(actor, "Одержимый");
  context.possessed = isPossessed(actor);
  if (context.possessed) context.possession = possessionContext(actor);

  // ── Мистика (бывш. Пси): вкладка доступна всегда, но психосилы внутри
  // показываем только Псайкерам (Черта) и Чернокнижникам (Элитный архетип) —
  // остальным там теперь ещё и Ритуалы (переехали со СПОСОБНОСТЕЙ), которые
  // от этого условия не зависят.
  // system.isPsyker — канонический признак (его ставят архетипы Ведьмы и
  // Псайкера-ренегата, мастер создания, азуриане); Черта «Псайкер» и
  // Чернокнижник — дополнительные пути, у которых флага может не быть.
  context.hasMysticPowers = !!system.isPsyker
    || actor.items.some(i => i.type === "trait" && itemHasName(i, "Псайкер"))
    || hasEliteArchetype(actor, "Чернокнижник");

  // ── Тех: вкладка доступна ещё и по Черте «Импланты Механикум», не только
  // по ручному чекбоксу «Техножрец».
  context.hasMechImplants = actor.items.some(i => i.type === "trait" && itemHasName(i, "Импланты Механикум"));

  const _charApts = charAptitudeSet(system.aptitudes);
  context.chars = Object.entries(CHARACTERISTICS).map(([key, meta]) => {
    const total = system.characteristics[key]?.total ?? 0;
    const bonus = system.characteristics[key]?.bonus ?? 0;
    // Обычный Бонус, каким он был бы просто от Итога (floor/10) — если
    // сохранённый Бонус отличается, значит его подняли Чертой/Талантом/
    // Сверхъестественным и т.п., и на листе это стоит показать надстрочно.
    const naturalBonus = Math.floor(total / 10);
    const improvement = system.characteristics[key]?.improvement ?? "none";
    // Ступеней куплено (0-5) — тот же счётчик, что считает цену (advance.mjs).
    // Ряд из 5 меток под ячейкой (module/sheets/tabs/advance.mjs
    // CHAR_IMP_STEPS) — по образцу fatePips ниже: массив с {on} строится тут,
    // а не хелпером в hbs.
    const improvementSteps = CHAR_IMP_STEPS[improvement] ?? 0;
    return {
      key,
      // Категория цены по склонностям (стр. 24) — для подсветки в «Развитии».
      aptCat:       resolveCharCat(key, _charApts, actor),
      label:        charLabel(key, system.alignment),
      abbr:         meta.abbr,
      base:         system.characteristics[key]?.base         ?? 0,
      advance:      system.characteristics[key]?.advance      ?? 0,
      supernatural: system.characteristics[key]?.supernatural ?? 0,
      improvement,
      improvementSteps,
      improvementPips: Array.from({ length: 5 }, (_, i) => ({ on: i < improvementSteps })),
      grantedImp:   system.characteristics[key]?.grantedImp   ?? "none",
      // Помечено ли улучшение как выданное архетипом/расой (кнопка ★).
      isGranted:   (system.characteristics[key]?.grantedImp ?? "none") !== "none",
      total,
      bonus,
      naturalBonus,
      bonusModified: bonus !== naturalBonus,
      totalTooltip: charTotalTooltip(total, system.characteristics[key]?.totalBreakdown),
      cost:         system.characteristics[key]?.cost         ?? 0,
      charDamage:   system.charDamage?.[key]                  ?? 0
    };
  });

  context.absorption = system.absorption || {
    head: 0, body: 0, leftArm: 0, rightArm: 0,
    leftLeg: 0, rightLeg: 0, toughnessBonus: 0,
    armorOnly: { head:0, body:0, leftArm:0, rightArm:0, leftLeg:0, rightLeg:0 }
  };

  context.fateLabel = fateTerm(system).plural;

  const tb = system.characteristics?.t?.bonus ?? 0;
  const wb = system.characteristics?.wp?.bonus ?? 0;
  const fatigueThreshold = tb + wb;
  context.fatigueThreshold = fatigueThreshold;
  context.fatigueValue     = system.fatigue?.value ?? 0;
  context.fatigueMax       = system.fatigue?.max   ?? fatigueThreshold;

  // Доп. AP против типов урона (от модификаций брони) — строка для боя
  const vs = system.absorption?.vsType || {};
  const vsLabels = { energy: "Энерг.", impact: "Удар.", rending: "Реж.", blast: "Взрыв." };
  context.armorVsTypeStr = Object.entries(vsLabels)
    .filter(([k]) => (vs[k] || 0) !== 0)
    .map(([k, l]) => `${l} +${vs[k]}`)
    .join(" · ");

  // Свойства оружия wdbc-plsf: Corrosive/Piercing/Crippling — есть ли что
  // показать в блоке под бронёй (сами значения читаются в hbs напрямую
  // из system.armorCorrosion/piercingWounds/crippledWounds).
  const corrosion = system.armorCorrosion || {};
  const piercing  = system.piercingWounds || {};
  context.hasWeaponPropWounds =
    Object.values(corrosion).some(v => (Number(v) || 0) > 0) ||
    Object.values(piercing).some(Boolean) ||
    (system.crippledWounds?.length > 0);

  return context;
}
