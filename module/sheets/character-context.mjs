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
import { isHelmetMod }                           from "../combat/armor-mods.mjs";
import { archetypeSheetContext }                 from "../apps/archetypes.mjs";
import { homeworldSheetContext }                 from "../apps/homeworlds.mjs";
import { divinationSheetContext }                from "../apps/divinations.mjs";
import { haemonculusContext }                    from "./tabs/haemonculus.mjs";
import { possessionContext }                     from "./tabs/possession.mjs";

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

  // ── Бой: метка стойки для свёрнутого заголовка ──────────────────────────
  const _STANCE_NAMES = { standard: "Стандартная", aggressive: "Агрессивная",
    defensive: "Защитная", covering: "Прикрывающая", springing: "Пружинящая", rapidstrike: "Частокол" };
  context.combatStanceLabel = _STANCE_NAMES[system.meleeStance] || "Стандартная";

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
  context.isDrukhari     = system.race === "drukhari";
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
  context.possessed = context.isHeretic && !!system.possessed;
  if (context.possessed) context.possession = possessionContext(actor);

  const _charApts = charAptitudeSet(system.aptitudes);
  context.chars = Object.entries(CHARACTERISTICS).map(([key, meta]) => ({
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
    total:        system.characteristics[key]?.total        ?? 0,
    bonus:        system.characteristics[key]?.bonus        ?? 0,
    cost:         system.characteristics[key]?.cost         ?? 0,
    charDamage:   system.charDamage?.[key]                  ?? 0
  }));

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
