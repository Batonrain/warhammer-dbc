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
import { equippedMeleeWeapon } from "../combat/equipped-melee.mjs";
import { aptitudeCat, charAptitudeSet,
         CHAR_APTITUDES }                        from "../constants/advancement.mjs";
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
import { isFeatureEnabled, disabledRaceKeys }    from "../constants/features.mjs";
import { isHelmetMod,
         disabledArmourPeriodicTestRemaining }   from "../combat/armor-mods.mjs";
import { archetypeSheetContext }                 from "../apps/archetypes.mjs";
import { homeworldSheetContext }                 from "../apps/homeworlds.mjs";
import { itemHasName, hasEliteArchetype, isPossessed } from "../rules/predicates.mjs";

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
import { MELEE_BASES, MELEE_CONTESTS }           from "../constants/combat.mjs";
import { hasActionEconomy, isEncounterActive,
         effectiveDefenseReactionMax }            from "../combat/action-economy.mjs";

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

  // ── Бой: Состязания — Стойка/База/обычные Приёмы теперь выбираются прямо в
  // диалоге атаки (module/sheets/attack-dialog.mjs) и своей постоянной панели
  // на листе больше не имеют. Состязания (Повалить/Финт/Давление/Напролом) в
  // диалог не переехали — это отдельный встречный тест без диалога атаки
  // вовсе (module/combat/techniques.mjs, _showContestDialog), поэтому свою
  // панель на вкладке БОЙ сохраняют: без неё их вообще нечем запустить.
  const meleeBaseKey  = system.meleeBase in MELEE_BASES ? system.meleeBase : "standard";
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
      ap:        { value: system.actionPoints?.value ?? 0, max: system.actionPoints?.max ?? 0 },
      reactions: { value: system.reactions?.value ?? 0, max: system.reactions?.max ?? 0 },
      // Доп. Реакции «только на Избегание» видны лишь пока есть что показать —
      // вне Защитной Стойки (или без надбавки от будущего Таланта) их 0,
      // отдельная строка на листе была бы пустым шумом.
      defense: (system.reactions?.defenseValue || defenseMax)
        ? { value: system.reactions?.defenseValue ?? 0, max: defenseMax }
        : null,
      encounterActive: isEncounterActive(),
      exposed: !!actor.getFlag("warhammer-dbc", "exposedAggressive")
    };
  }

  // ── Снаряжение: сенсор нагрузки (когитатор) ─────────────────────────────
  const _enc = system.encumbrance || {};
  const _encMax = Number(_enc.max) || 0, _encCur = Number(_enc.effectiveCurrent ?? _enc.current) || 0;
  const _pct = _encMax ? Math.round((_encCur / _encMax) * 100) : 0;
  context.encumbrancePct   = Math.max(0, Math.min(100, _pct));
  context.encumbranceOver  = _pct > 100;
  context.encumbranceLevel = _pct >= 100 ? "over" : _pct >= 66 ? "heavy" : "ok";

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
  const pastRace = system.race === "ynnari"    ? system.ynnariPast
                 : system.race === "harlequin" ? system.harlequinPast
                 : "";
  context.isDrukhari     = system.race === "drukhari" || pastRace === "drukhari";
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
    return {
      key,
      // Категория цены по склонностям (стр. 24) — для подсветки в «Развитии».
      aptCat:       aptitudeCat(_charApts, CHAR_APTITUDES[key] || []),
      label:        charLabel(key, system.alignment),
      abbr:         meta.abbr,
      base:         system.characteristics[key]?.base         ?? 0,
      advance:      system.characteristics[key]?.advance      ?? 0,
      supernatural: system.characteristics[key]?.supernatural ?? 0,
      improvement:  system.characteristics[key]?.improvement  ?? "none",
      grantedImp:   system.characteristics[key]?.grantedImp   ?? "none",
      // Помечено ли улучшение как выданное архетипом/расой (кнопка ★).
      isGranted:   (system.characteristics[key]?.grantedImp ?? "none") !== "none",
      total,
      bonus,
      naturalBonus,
      bonusModified: bonus !== naturalBonus,
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

  return context;
}
