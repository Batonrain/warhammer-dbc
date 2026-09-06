// module/sheets/sheet-helpers.mjs

import { CHARACTERISTICS, APTITUDES }   from "../constants/characteristics.mjs";
import { SKILLS_DEF, GROUP_SKILLS_DEF }              from "../constants/skills.mjs";
import { SKILL_DESCRIPTIONS }                        from "../constants/skill-descriptions.mjs";
import { SKILL_SPECIALTY_DESCRIPTIONS }               from "../constants/skill-specialty-descriptions.mjs";
import { WEAPON_CLASSES, DAMAGE_TYPES,
         DRUG_CATEGORIES, DRUG_DELIVERY,
         DRUG_CHAR_KEYS, WEAPON_MOD_GROUPS,
         ARMOR_MOD_GROUPS }                          from "../constants/items.mjs";
import { MELEE_STANCES, MELEE_BASES }                from "../constants/combat.mjs";
import { PSY_POWER_TYPES, PSY_ACTIONS, PSY_NATURES } from "../constants/psyker.mjs";
import { isAeldariRace }                             from "../apps/race-library.mjs";
import { shieldCoverageLabel }                        from "../combat/hand-shield.mjs";
import { getLegion, getChapter, buildChapterOptions,
         buildCultureLegionOptions, resolveCulture } from "../constants/legions.mjs";
import { TECH_MIRACLE_TYPES, TECH_ACTIONS, NOOSPHERE_ACTIONS } from "../constants/tech.mjs";
import { PSY_DISCIPLINES, TECH_DISCIPLINES }         from "../constants/disciplines.mjs";
import { implantMech }                               from "../constants/implant-mechanics.mjs";
import { TALENT_LIBRARY }                            from "../constants/talents-library.mjs";
import { charAptitudeSet, resolveSkillCat } from "../constants/advancement.mjs";
import { isFriendlySpecialty }                       from "../rules/friendly-specialties.mjs";
import { canClearJam }                                from "../combat/weapon-properties.mjs";
import { ASPIRATION_TABLES } from "../constants/aspirations.mjs";
import { aspirationOptions, aspirationByKey } from "../apps/aspirations.mjs";
import { supportsInfoguard } from "../apps/infoguard.mjs";
import { xpLogEntries } from "../apps/xp-log.mjs";

// Карта «полное имя таланта → тип (папка корбука)» + порядок типов — строится один
// раз. Используется для группировки талантов на листе по типам (стр. 62-105).
const TALENT_TYPE = (() => {
  const byName = new Map(); const order = new Map(); let i = 0;
  for (const t of TALENT_LIBRARY) {
    const folder = t.folder || "Прочие";
    if (!order.has(folder)) order.set(folder, i++);
    byName.set(t.name, folder);
  }
  return { byName, order };
})();
import { getModEffects }                             from "../combat/weapon-mods.mjs";
import { qualityEffects }                            from "../constants/quality.mjs";
import { _buildAmmoModString, shortLabel }           from "../helpers/utils.mjs";
import { SHIELD_STATUS }                             from "../constants/shields.mjs";
import { CONDITIONS_DEF }                            from "../constants/conditions.mjs";
import { isMirroredCondition, isMirrorClearable, mirrorHint } from "../rules/condition-mirrors.mjs";
import { aptBindingContext } from "../rules/aptitude-binding.mjs";
import { buildBodyState, buildEcg, buildImplantsSvg, buildBodyLayers,
         implantCatColor }                          from "../constants/body-map.mjs";
import { VITALS, VITAL_MAX_STAGE, VITAL_TIME_FIELD, vitalEffectiveStage } from "../constants/vitals.mjs";
import { addictionItems, isAddictionUnsatisfied, addictionStatusLabel,
         addictionSubstanceLabel }                    from "../rules/addiction.mjs";
import { raceMatches }                               from "../rules/race.mjs";
import { ritualsContext }                            from "./tabs/rituals.mjs";
import { mergeAbilityItems, mergeAbilityEffects,
         abilityLabel }                              from "../rules/merge-abilities.mjs";
import { toggleParentId, toggleRows }                from "../rules/toggle-abilities.mjs";
import { ruleFlags, ruleFlagLabels, ruleFlagCost, scriptAbilities } from "../rules/flags.mjs";
import { CAPABILITIES }                              from "../constants/capabilities.mjs";
import { capabilityAutoHint }                        from "../constants/capability-forms.mjs";
import { capabilityCostLabel, capabilityCostGate }   from "../combat/capability-cost.mjs";
import { scriptAbilityRow }                          from "../apps/mechanics.mjs";
import { parseRangeMeters, rangeVerdict }            from "../rules/psy-range.mjs";
import { measureTokens }                             from "../combat/tactical-map.mjs";

// Определение всех Состояний листа — реестр constants/conditions.mjs
// (wdbc-w88h): label/desc/иконка/счётчик собраны там, здесь только реэкспорт
// под привычным именем (много мест листа читают его как CONDITIONS_DEF).
export { CONDITIONS_DEF };

// ── Навык ─────────────────────────────────────────────────────────────────────

/**
 * Подсказка к Навыку для тултипа наведения на вкладке ПОКАЗАТЕЛИ.
 *
 * Механическая шапка (Бросок/Основа/Склонность) — то, что система УЖЕ
 * проверенно знает про Навык: та же пара Характеристика+Склонность, что
 * решает цену покупки на вкладке РАЗВИТИЕ (aptitudeCat ниже). Ниже неё —
 * краткое книжное описание из SKILL_DESCRIPTIONS (Основная книга, стр.
 * 57-61, «ОПИСАНИЯ НАВЫКОВ»), собранное вручную по заголовкам отдельно на
 * каждый Навык — см. комментарий в constants/skill-descriptions.mjs, откуда
 * оно берётся, и почему автоматический разбор книжного HTML для этого не
 * годился (doombc-book-text-extraction).
 *
 * `rollLabel` — то, что раньше несло атрибут `title` («Бросок: …»): оба текста
 * сведены в один data-tooltip, чтобы не показывать на одном элементе сразу
 * два всплывающих окна — нативное по title и своё, Foundry-шное (см. вывод
 * ниже, откуда взят сам паттерн data-tooltip: horde-sheet.hbs, tab-social.hbs).
 * data-tooltip рендерится Foundry как sanitized HTML (TooltipManager,
 * foundry.utils.cleanHTML), поэтому `<br>` для переноса строки допустим.
 *
 * `specialty` (только для строк группового Навыка, см. вызов в buildGetData
 * ниже) — сырое `entry.specialty` с листа («Chymist»). Если для НЕЁ САМОЙ
 * нашлось описание в SKILL_SPECIALTY_DESCRIPTIONS[key] (wdbc-c0yf — книга
 * описывает каждую специализацию отдельным предложением, не только группу
 * целиком), тултип показывает именно его; иначе — как раньше, общее
 * описание группы из SKILL_DESCRIPTIONS. Так тултип на «Ремесло: Химик»
 * подсказывает химика, а не пересказ всей группы «Ремесло», и никогда не
 * остаётся пустым, если под конкретную специализацию текста ещё не набрано.
 */
function skillTip(key, def, rollLabel, specialty, mod = 0) {
  if (!def) return "";
  const ch   = CHARACTERISTICS[def.char];
  const base = ch ? `${ch.label} (${ch.abbr})` : def.char;
  const apt2 = APTITUDES[def.apt2] || def.apt2;
  // Постоянный модификатор (wdbc-q4wb) виден в Итоге, но по одному числу не
  // понять, откуда оно — поэтому названо в тултипе, и только когда не ноль.
  const modStr = mod ? ` · Модификатор: ${mod > 0 ? "+" : ""}${mod}` : "";
  const head = `Бросок: ${rollLabel} · Основа: ${base} · Склонность: ${apt2}${modStr}`;
  const desc = (specialty && SKILL_SPECIALTY_DESCRIPTIONS[key]?.[specialty])
    || SKILL_DESCRIPTIONS[key];
  return desc ? `${head}<br><br>${desc}` : head;
}

export function buildSkillDisplay(key, system) {
  const def = SKILLS_DEF[key];
  const sk  = system.skills?.[key] || {};
  const mod = Number(sk.mod) || 0;
  return { key, label: def.label, total: sk.total ?? -20, rank: sk.rank ?? "untrained",
    mod, tip: skillTip(key, def, def.label, undefined, mod) };
}

// ── Данные щитов ──────────────────────────────────────────────────────────────

export function buildShieldData(actor) {
  // Собираем щиты из двух источников: предметы forcefield (state в system.*) и
  // импланты со встроенным дефлектором (state в system.shield.*, напр. Боевые Латы).
  const sources = [];
  for (const i of actor.items.contents) {
    if (i.type === "forcefield") sources.push({ item: i, s: i.system });
    else if (i.type === "implant" && i.system.shield?.enabled)
      sources.push({ item: i, s: i.system.shield });
  }
  const allShields = sources.map(({ item: i, s }) => {
    const status = SHIELD_STATUS[s.status] || SHIELD_STATUS.inactive;
    return {
      id:                i.id,
      name:              i.name,
      shieldNature:      s.shieldNature       || "technological",
      shieldType:        s.shieldType         || "dome",
      ratingMin:         s.ratingMin          ?? 0,
      ratingMax:         s.ratingMax          ?? 0,
      overloadThreshold: s.overloadThreshold  ?? 0,
      isSpecialRating:   s.isSpecialRating    || false,
      currentRating:     s.currentRating      ?? 0,
      equipped:          s.equipped           || false,
      status:            s.status             || "inactive",
      statusKey:         s.status             || "inactive",
      statusLabel:       status.label,
      statusIcon:        status.icon,
      statusCss:         status.css,
      needsRepair:       (s.status === "overloaded" || s.status === "damaged"),
      weight:            s.weight             ?? (i.system.weight ?? 0),
      quality:           s.quality            || i.system.quality || "common"
    };
  });

  const activeRaw    = allShields.find(s => s.equipped && s.status === "active");
  const activeShield = activeRaw
    ? { ...activeRaw, overloadMax: activeRaw.currentRating + activeRaw.overloadThreshold }
    : null;

  const inactiveShields = allShields.filter(s => s.status === "inactive");

  return { gearForcefields: allShields, activeShield, inactiveShields };
}

// ── Сводка специальных эффектов препарата ─────────────────────────────────────

function _buildSpecialSummary(sys) {
  const fx    = sys.specialEffects || {};
  const lines = [];

  if (fx.removesBleedingLevels > 0)
    lines.push(`🩸 Снимает ${fx.removesBleedingLevels} ур. Кровотечения`);
  if (fx.removesFatigueLevels > 0)
    lines.push(`😓 Снимает ${fx.removesFatigueLevels} ур. Усталости`);
  if (fx.removesWounds > 0)
    lines.push(`❤️ Снимает ${fx.removesWounds} Ран`);
  if (fx.healsWoundsPerRound)
    lines.push(`❤️ Лечит ${fx.healsWoundsPerRound} Ран/раунд`);
  if (fx.removesCondition)
    lines.push(`Снимает: ${fx.removesCondition}`);
  if (fx.grantsCondition)
    lines.push(`🔴 Накладывает: ${fx.grantsCondition}`);
  if (fx.immuneToPoisons)
    lines.push(`🛡️ Иммунитет к ядам`);
  if (fx.bonusVsPoisons && fx.bonusVsPoisons !== 0)
    lines.push(`🛡️ Бонус против ядов: +${fx.bonusVsPoisons}`);
  if (fx.counteractsDrugs)
    lines.push(`🔄 Нейтрализует активные препараты`);
  if (fx.removesRadiation)
    lines.push(`☢️ Снимает радиацию`);
  if (fx.reduceDamageOnHit && fx.reduceDamageOnHit !== 0)
    lines.push(`🛡️ Уменьш. урон: −${fx.reduceDamageOnHit}`);
  if (fx.noSleepNeeded)
    lines.push(`💡 Не нужен сон`);
  if (fx.noFatigueFromMarch)
    lines.push(`🥾 Нет Усталости от марша`);
  if (fx.customEffect)
    lines.push(`📌 ${fx.customEffect}`);

  return lines;
}

// ── Сводка специальных эффектов ПОСТ-эффекта ─────────────────────────────────

function _buildAfterSpecialSummary(sys) {
  const fx    = sys.afterEffectSpecial || {};
  const lines = [];

  if (fx.removesBleedingLevels > 0)
    lines.push(`🩸 Снимает ${fx.removesBleedingLevels} ур. Кровотечения`);
  if (fx.removesFatigueLevels > 0)
    lines.push(`😓 Снимает ${fx.removesFatigueLevels} ур. Усталости`);
  if (fx.removesWounds > 0)
    lines.push(`❤️ Снимает ${fx.removesWounds} Ран`);
  if (fx.grantsCondition) {
    const lvl = fx.grantsConditionLevel ?? 1;
    lines.push(`🔴 Накладывает${lvl > 1 ? ` ${lvl} ур.` : ""}: ${fx.grantsCondition}`);
  }
  if (fx.customEffect)
    lines.push(`📌 ${fx.customEffect}`);

  return lines;
}

// ── Строка модификаторов характеристик ───────────────────────────────────────

function _buildStatModsDisplay(statMods) {
  const parts = [];
  for (const [k, v] of Object.entries(statMods || {})) {
    if (v && v !== 0) {
      parts.push(`${DRUG_CHAR_KEYS[k] ?? k} ${v > 0 ? "+" : ""}${v}`);
    }
  }
  return parts.join(", ");
}

// ── Данные одного препарата ───────────────────────────────────────────────────

function _buildDrugData(item) {
  const s = item.system;

  const isAfterEffect = (s.activeEffect?.isActive && s.activeEffect?.isAfterEffect) || false;

  // Модификаторы для текущего режима (основной или пост)
  const currentStatMods = isAfterEffect
    ? (s.afterEffectStatMods || {})
    : (s.statMods || {});

  return {
    id:              item.id,
    name:            item.name,
    drugCategory:    s.drugCategory     || "medicine",
    categoryLabel:   DRUG_CATEGORIES[s.drugCategory] ?? s.drugCategory,
    deliveryMethod:  s.deliveryMethod   || "injection",
    deliveryLabel:   DRUG_DELIVERY[s.deliveryMethod] ?? s.deliveryMethod,
    quantity:        s.quantity         ?? 0,
    weight:          s.weight           ?? 0,
    totalWeight:     Math.round((s.weight || 0) * (s.quantity || 0) * 100) / 100,
    duration:        s.duration         || "",
    // Основной эффект
    effect:          s.effect           || "",
    statMods:        s.statMods         || {},
    statModsDisplay: _buildStatModsDisplay(currentStatMods),
    specialEffects:  s.specialEffects   || {},
    specialSummary:  isAfterEffect
      ? _buildAfterSpecialSummary(s)
      : _buildSpecialSummary(s),
    // Пост-эффект
    hasAfterEffect:         s.hasAfterEffect           || false,
    afterEffect:            s.afterEffect              || "",
    afterEffectDice:        s.afterEffectDice          || "",
    afterEffectStatMods:    s.afterEffectStatMods      || {},
    afterEffectSpecial:     s.afterEffectSpecial       || {},
    // Состояние активности
    isActive:        s.activeEffect?.isActive          || false,
    isAfterEffect:   isAfterEffect,
    isAfterActive:   isAfterEffect,
    roundsRemaining: s.activeEffect?.roundsRemaining   || 0,
    // Активный урон в характеристику (во время пост-эффекта)
    charDamageDisplay: (isAfterEffect && s.activeEffect?.charDamageStat && (s.activeEffect?.charDamageAmount || 0) > 0)
      ? `${CHARACTERISTICS[s.activeEffect.charDamageStat]?.abbr ?? s.activeEffect.charDamageStat.toUpperCase()} −${s.activeEffect.charDamageAmount}`
      : "",
    // Зависимость
    addiction:           s.addiction                       || {},
    hasAddiction:        s.addiction?.hasAddiction         || false,
    isAddicted:          s.addiction?.isAddicted           || false,
    addictionTestChar:   (s.addiction?.testChar || "t").toLowerCase(),
    addictionTestMod:    s.addiction?.testMod ?? 0,
    // Яды
    poisonVector:    s.poisonVector     || [],
    poisonTestChar:  s.poisonTestChar   || "t",
    poisonTestMod:   s.poisonTestMod    || 0,
    poisonEffect:    s.poisonEffect     || ""
  };
}

// ── Активные состояния для отображения ───────────────────────────────────────

function _buildActiveConditions(system, actor = null) {
  const conds  = system.conditions || {};
  const result = [];

  for (const [key, def] of Object.entries(CONDITIONS_DEF)) {
    if (!conds[key]) continue;
    result.push({
      key,
      label:    def.label,
      icon:     def.icon,
      svg:      def.svg,
      color:    def.color,
      css:      def.css,
      hasLevel: def.hasLevel,
      level:    def.hasLevel && def.levelField ? (conds[def.levelField] ?? 0) : null,
      // Подсказка тега = общее описание Состояния + то, ЧЕМ оно поднято прямо
      // сейчас (wdbc-5uae.2): «Аватар Резни — Кхарн», «Проклятая Метка
      // (Кхорн)», «вид: форсированный». Нагрузка при этом остаётся у своего
      // правила — сюда приходит только готовая строка (rules/condition-
      // mirrors.mjs::mirrorHint), второго места правды не заводится.
      desc:     [def.desc || "", actor ? mirrorHint(actor, key) : ""].filter(Boolean).join(" "),
      // Показывать ли крестик «снять» (wdbc-5uae). Раньше единственное
      // исключение — «Усталость» — было зашито прямо в шаблон условием по
      // ключу; теперь шаблон спрашивает данные, и исключений стало три класса:
      //  — «Усталость»: зеркало счётчика с вкладки ТЕЛО, крестик там бессилен;
      //  — метка, живущая на ПРЕДМЕТЕ («Щит поднят»): снимается своей кнопкой,
      //    патчем актора её не достать;
      //  — всё остальное снимается как снималось.
      // Крестик, который ничего не делает, хуже отсутствующего.
      removable: key !== "fatigued" && (!isMirroredCondition(key) || isMirrorClearable(key))
    });
  }

  return result;
}

// ── Зависимости: собираем список препаратов с зависимостью ───────────────────
// Показываем только те, у которых hasAddiction === true
// (независимо от того, активен ли сейчас препарат)

function _buildAddictions(allItems) {
  const result = [];

  for (const item of allItems) {
    if (item.type !== "drug") continue;
    const s   = item.system;
    const add = s.addiction || {};
    // В панель «Зависимости» попадают только ФАКТИЧЕСКИЕ зависимости персонажа
    if (!add.hasAddiction || !add.isAddicted) continue;

    const testCharKey   = (add.testChar || "t").toLowerCase();
    const testCharUpper = testCharKey.toUpperCase();
    const testMod       = add.testMod ?? 0;

    result.push({
      id:           item.id,
      name:         item.name,
      drugCategory: s.drugCategory || "medicine",
      testCharKey:  testCharKey,
      testChar:     testCharUpper,
      testMod:      testMod,
      frequency:    add.frequency || "",
      penalty:      add.penalty   || "",
      minDose:      add.minDose   || 0,
      isAddicted:   add.isAddicted || false
    });
  }

  return result;
}

// ── Основные данные листа персонажа ──────────────────────────────────────────

export function buildGetData(actor) {
  const system   = actor.system;
  const allItems = actor.items.contents;

  const context = {};
  context.system          = system;
  context.characteristics = CHARACTERISTICS;

  // ── Навыки ────────────────────────────────────────────────────────────────
  // Четыре колонки вместо двух — базовые Навыки почти все умещаются в один
  // экран без прокрутки. Размер колонки почти ровный (21 Навык → 6/5/5/5),
  // остаток уходит в первые колонки.
  const skillKeys    = Object.keys(SKILLS_DEF);
  const SKILL_COLS    = 4;
  const skillColBase = Math.floor(skillKeys.length / SKILL_COLS);
  const skillColRem  = skillKeys.length % SKILL_COLS;
  const skillCols = [];
  for (let c = 0, idx = 0; c < SKILL_COLS; c++) {
    const size = skillColBase + (c < skillColRem ? 1 : 0);
    skillCols.push(skillKeys.slice(idx, idx + size).map(k => buildSkillDisplay(k, system)));
    idx += size;
  }
  [context.skillsCol1, context.skillsCol2, context.skillsCol3, context.skillsCol4] = skillCols;

  // Групповые навыки (Знания/Языки/Ремёсла и т.п.) — своя плитка на каждую
  // группу (заголовок + список специализаций), а не одна общая колонка со
  // сплошным перечнем: пустые группы вовсе не рисуются. Порядок плиток — по
  // GROUP_SKILLS_DEF, а не по порядку ключей в system.groupSkills (тот зависит
  // от того, в каком порядке специализации заводились на листе).
  context.skillGroupBoxes = [];
  for (const [groupKey, def] of Object.entries(GROUP_SKILLS_DEF)) {
    const entries = system.groupSkills?.[groupKey];
    if (!Array.isArray(entries) || entries.length === 0) continue;
    context.skillGroupBoxes.push({
      groupKey,
      label: def.label,
      entries: entries.map((entry, idx) => ({
        entryIndex: idx,
        specialty:  entry.specialty,
        total:      entry.total ?? -20,
        mod:        Number(entry.mod) || 0,
        tip:        skillTip(groupKey, def, `${def.label}: ${entry.specialty}`, entry.specialty, Number(entry.mod) || 0)
      }))
    });
  }

  const _skApts = charAptitudeSet(system.aptitudes);
  context.skillsAdvance = Object.entries(SKILLS_DEF).map(([key, def]) => {
    const sk = system.skills?.[key] || {};
    return {
      key, label: def.label,
      char:  CHARACTERISTICS[def.char]?.abbr ?? def.char,
      rank:  sk.rank  ?? "untrained",
      grantedRank: sk.grantedRank ?? "untrained",
      // Помечен ли текущий уровень как выданный архетипом/расой (кнопка ★).
      isGranted: (sk.grantedRank ?? "untrained") !== "untrained",
      total: sk.total ?? -20,
      cost:  sk.cost  ?? 0,
      aptCat: resolveSkillCat(key, "", [def.char, def.apt2], _skApts, actor),
      // Привязка Склонностей (wdbc-1pvq): что показать в подсказке и надо ли
      // пометить строку как переопределённую. Кликом по значку Д/Н/В её
      // меняют — отдельной колонки под это нет намеренно, вкладка и так
      // плотная.
      ...aptBindingContext(actor, "skill", key, [def.char, def.apt2], a => APTITUDES[a] || a)
    };
  });

  const GS_CHAR_KEYS = ["ws", "bs", "s", "t", "ag", "int", "per", "wp", "fel"];
  context.groupSkillsAdvance = Object.entries(GROUP_SKILLS_DEF).map(([groupKey, def]) => {
    const entries = system.groupSkills?.[groupKey] ?? [];
    // Только Ремесло (trade) позволяет выбирать базовую характеристику у каждого спец-навыка.
    const selectable = groupKey === "trade";
    return {
      groupKey, label: def.label, selectable,
      char: CHARACTERISTICS[def.char]?.abbr ?? def.char,
      // Отношение группы к склонностям (стр. 24) — по [char группы, apt2].
      // Общие знания и Ремесло всегда Дружественные (стр. 58, 61).
      alwaysAlly: !!def.alwaysAlly,
      aptCat: def.alwaysAlly ? "ally" : resolveSkillCat(groupKey, "", [def.char, def.apt2], _skApts, actor),
      entries: entries.map((e, i) => {
        const charKey = e.char || def.char;
        return {
          ...e, index: i, groupKey,
          charAbbr: CHARACTERISTICS[charKey]?.abbr ?? charKey,
          grantedRank: e.grantedRank ?? "untrained",
          isGranted: (e.grantedRank ?? "untrained") !== "untrained",
          aptCat: def.alwaysAlly ? "ally"
            : isFriendlySpecialty(actor, groupKey, e.specialty) ? "ally"
            : resolveSkillCat(groupKey, e.specialty, [charKey, def.apt2], _skApts, actor),
          charOptions: GS_CHAR_KEYS.map(k => ({
            key: k, abbr: CHARACTERISTICS[k]?.abbr ?? k.toUpperCase(), selected: k === charKey
          }))
        };
      })
    };
  });

  // ── Боевые оружия ─────────────────────────────────────────────────────────
  const equippedWeapons = allItems.filter(i => i.type === "weapon" && i.system.equipped);

  const makeCombatWeapon = (i) => {
    const s     = i.system;
    const melee = s.weaponClass === "melee" || s.weaponClass === "thrown";
    const ck    = melee ? "ws" : "bs";
    const stance = system.meleeStance || "standard";
    const stBon  = melee ? (MELEE_STANCES[stance]?.wsBonus ?? 0) : 0;
    // База (стр. 13) — так же, как Стойка, читается напрямую с актора и
    // складывается в общий порог: без неё колонка «Порог» врала бы на −10
    // против того, что реально покажет диалог атаки (Стандартная Атака +10).
    const meleeBaseKey = system.meleeBase || "standard";
    const baseBon = melee ? (MELEE_BASES[meleeBaseKey]?.wsBonus ?? 0) : 0;

    const compatAmmo = melee ? [] : allItems
      .filter(item =>
        item.type === "ammo" &&
        (item.system.weaponTypes || []).some(t =>
          t === s.weaponType || t === s.weaponClass || t === "any"
        )
      )
      .map(item => ({
        id:       item.id,
        name:     item.name,
        quantity: item.system.quantity || 0,
        loaded:   item.id === s.loadedAmmoId,
        modStr:   _buildAmmoModString(item.system)
      }));

    // ── Эффекты установленных модификаций ──────────────────────────────────
    const modFx     = getModEffects(actor, i);
    const hasMods   = modFx.names.length > 0;
    const effRange  = Math.round((s.range || 0) * (modFx.rangeMult || 1)) + (modFx.rangeMod || 0);
    const effClipMax = Math.round((s.magazineMax || 0) * (modFx.clipMult || 1)) + (modFx.clipMod || 0);
    const effPen    = (s.penetration || 0) + (modFx.penMod || 0);
    // Качество: рукопашное Best — +1 урон; рукопашное — мод теста (Poor −10/Good +5/Best +10)
    const qAuto     = qualityEffects(i).auto;
    const qDmgMod   = melee ? (qAuto.damageMod || 0) : 0;
    const qTestMod  = melee ? (qAuto.testMod   || 0) : 0;
    const totalDmgMod = (modFx.damageMod || 0) + qDmgMod;
    const dmgSuffix = totalDmgMod ? ` ${totalDmgMod > 0 ? "+" : ""}${totalDmgMod}` : "";

    const magLow   = !melee && (s.magazineCur || 0) > 0
                     && (s.magazineCur || 0) <= Math.ceil((effClipMax || 1) * 0.25);
    const magEmpty = !melee && (s.magazineCur || 0) === 0 && (effClipMax || 0) > 0;

    return {
      id: i.id, name: i.name,
      weaponClass:     WEAPON_CLASSES[s.weaponClass] ?? s.weaponClass,
      weaponType:      s.weaponType,
      range:           effRange,
      balance:         (s.balance || 0) + (modFx.balanceMod || 0),
      damage:          (s.damage || "") + dmgSuffix,
      damageType:      DAMAGE_TYPES[s.damageType] ?? s.damageType,
      penetration:     effPen,
      rof:             `${s.rof_single}/${s.rof_semi + (modFx.rofSemiMod || 0)}/${s.rof_full + (modFx.rofFullMod || 0)}`,
      magazineCur:     s.magazineCur || 0,
      magazineMax:     effClipMax || 0,
      special:         s.special,
      // Ручной щит (стр. 215): AP, прикрываемые зоны и состояние «поднят».
      isShield:        s.shieldAP != null,
      shieldAP:        s.shieldAP ?? 0,
      shieldHand:      i.getFlag?.("warhammer-dbc", "shieldHand") || "left",
      shieldRaised:    !!i.getFlag?.("warhammer-dbc", "shieldRaised"),
      shieldCoverage:  s.shieldAP != null ? shieldCoverageLabel(i) : "",
      // В какой руке оружие (module/apps/hud.mjs, карточки правая/левая) — без
      // дефолта, в отличие от shieldHand: одиночное оружие руку не форсирует.
      hand:            i.getFlag?.("warhammer-dbc", "weaponHand") || "",
      hasMods,
      modNames:        modFx.names.join(", "),
      attackThreshold: (system.characteristics[ck]?.total ?? 0) + (s.attackBonus || 0) + baseBon + stBon + (modFx.attackMod || 0) + qTestMod,
      compatAmmo, magLow, magEmpty,
      // Заклинило (wdbc-vwfk) — блокирует «Атака» тем же приёмом, что magEmpty;
      // «Расклинить» показывается только пока canClearJam не лжив (см.
      // combat/weapon-properties.mjs — блокировка Reformation Song на раунд).
      jammed:       !melee && !!s.jammed,
      canClearJam:  !melee && !!s.jammed && canClearJam(i),
      // Перезарядка (wdbc-ai0o): тот же гейт кнопки «Атака», что у jammed выше.
      needsRecharge: !melee && !!s.needsRecharge
    };
  };

  context.combatMeleeWeapons  = equippedWeapons
    .filter(i => i.system.weaponClass === "melee" || i.system.weaponClass === "thrown")
    .map(makeCombatWeapon);
  context.combatRangedWeapons = equippedWeapons
    .filter(i => i.system.weaponClass !== "melee" && i.system.weaponClass !== "thrown")
    .map(makeCombatWeapon);

  // ── Снаряжение ────────────────────────────────────────────────────────────
  // Моды показываются вложенно под носителем (оружием/бронёй), на который они
  // установлены (installedOn); не установленные — в отдельном «свободном» списке
  // с выпадашкой целей для инлайн-установки прямо из окна снаряжения.
  const weaponItems = allItems.filter(i => i.type === "weapon");
  const armorItems  = allItems.filter(i => i.type === "armor");
  const armorIds    = new Set(armorItems.map(a => a.id));

  // Интегральные атаки (Кулак, Кислотный Плевок, Пинок Дредноута и т.п.) —
  // часть тела/машины, а не Снаряжение: живут только на вкладке БОЙ
  // (combatMeleeWeapons/combatRangedWeapons выше, уже включают их — equipped
  // всегда true), сюда — ни строкой в списке, ни целью для установки мода.
  const gearWeaponItems = weaponItems.filter(i => !i.getFlag?.("warhammer-dbc", "integralAttack"));
  // weaponIds — носители МОДОВ оружия (gearWeaponModsFree ниже): именно
  // gearWeaponItems, не все weaponItems. Иначе мод, установленный на
  // интегральную атаку, считался бы «носитель есть» (integralAttack всё ещё
  // в weaponItems) и не попадал бы в список свободных — а строки самого
  // носителя в таблице Снаряжения уже нет (gearWeaponItems выше), значит мод
  // пропадал бы с листа насовсем, снять его было бы нельзя.
  const weaponIds   = new Set(gearWeaponItems.map(w => w.id));

  const weaponModView = (i) => {
    const cat = i.system.category || "ranged";
    return {
      id: i.id, name: i.name,
      groupLabel:  WEAPON_MOD_GROUPS[cat]?.[i.system.modGroup] ?? "",
      weight:      i.system.weight ?? 0,
      quality:     i.system.quality || "common",
      benefit:     i.system.description || "",
      installedOn: i.system.installedOn || ""
    };
  };
  const armorModView = (i) => {
    const cat = i.system.category || "armor";
    return {
      id: i.id, name: i.name,
      groupLabel:  ARMOR_MOD_GROUPS[cat]?.[i.system.modGroup] ?? "",
      weight:      i.system.weight ?? 0,
      powerSystem: cat === "powerSystem",
      activatable: !!i.system.activatable,
      active:      !!i.system.active,
      benefit:     i.system.description || "",
      installedOn: i.system.installedOn || ""
    };
  };

  const allWeaponMods = allItems.filter(i => i.type === "weaponMod");
  const allArmorMods  = allItems.filter(i => i.type === "armorMod");

  // Цели установки (мемоизируем один раз): моды оружия → любое оружие;
  // моды брони → любая броня, а системы силовой брони — только «Силовая».
  const weaponTargets = gearWeaponItems.map(w => ({ id: w.id, name: w.name, equipped: w.system.equipped ?? false }));
  const armorTargetsAll   = armorItems.map(a => ({ id: a.id, name: a.name, equipped: a.system.equipped ?? false }));
  const armorTargetsPower = armorItems.filter(a => a.system.armorType === "power")
    .map(a => ({ id: a.id, name: a.name, equipped: a.system.equipped ?? false }));

  context.gearWeapons = gearWeaponItems.map(i => ({
    id: i.id, name: i.name, equipped: i.system.equipped ?? false,
    weaponClass: WEAPON_CLASSES[i.system.weaponClass] ?? i.system.weaponClass,
    weaponType:  i.system.weaponType,
    damage:      i.system.damage,
    damageType:  DAMAGE_TYPES[i.system.damageType] ?? i.system.damageType,
    magazineCur: i.system.magazineCur,
    magazineMax: i.system.magazineMax,
    weight:      i.system.weight,
    infoguard:   supportsInfoguard(i) ? (i.system.infoguard || 0) : null,
    mods:        allWeaponMods.filter(m => m.system.installedOn === i.id).map(weaponModView)
  }));

  // Свободные моды оружия (не установлены или носитель удалён)
  context.gearWeaponModsFree = allWeaponMods
    .filter(m => !weaponIds.has(m.system.installedOn))
    .map(m => ({ ...weaponModView(m), targets: weaponTargets, noTargets: weaponTargets.length === 0 }));

  context.gearAmmo = allItems.filter(i => i.type === "ammo").map(i => ({
    id: i.id, name: i.name,
    weaponTypes: (i.system.weaponTypes || []).join(", "),
    quantity:    i.system.quantity,
    weight:      i.system.weight,
    totalWeight: Math.round((i.system.weight || 0) * (i.system.quantity || 0) * 100) / 100
  }));

  context.gearArmor = armorItems.map(i => ({
    id:        i.id,
    name:      i.name,
    equipped:  i.system.equipped   ?? false,
    armorType: i.system.armorType  ?? "simple",
    isPower:   ["power", "aspect"].includes(i.system.armorType),
    head:      i.system.head       ?? 0,
    body:      i.system.body       ?? 0,
    leftArm:   i.system.leftArm    ?? 0,
    rightArm:  i.system.rightArm   ?? 0,
    leftLeg:   i.system.leftLeg    ?? 0,
    rightLeg:  i.system.rightLeg   ?? 0,
    weight:    i.system.weight     ?? 0,
    stacks:    i.system.stacks     ?? false,
    infoguard: supportsInfoguard(i) ? (i.system.infoguard || 0) : null,
    mods:      allArmorMods.filter(m => m.system.installedOn === i.id).map(armorModView)
  }));

  // Свободные моды/системы брони (не установлены или носитель удалён).
  // Системам силовой брони предлагаются только цели «Силовая»; если таких нет —
  // noTargets, и в шаблоне выводится подсказка.
  context.gearArmorModsFree = allArmorMods
    .filter(m => !armorIds.has(m.system.installedOn))
    .map(m => {
      const v = armorModView(m);
      const targets = v.powerSystem ? armorTargetsPower : armorTargetsAll;
      return { ...v, targets, noTargets: targets.length === 0 };
    });

  // ── Силовые поля ──────────────────────────────────────────────────────────
  const shieldData = buildShieldData(actor);
  context.gearForcefields = shieldData.gearForcefields;
  context.activeShield    = shieldData.activeShield;
  context.inactiveShields = shieldData.inactiveShields;

  // ── Препараты ─────────────────────────────────────────────────────────────
  const allDrugs         = allItems.filter(i => i.type === "drug").map(_buildDrugData);
  context.gearDrugs      = allDrugs;
  context.activeDrugs    = allDrugs.filter(d => d.isActive);

  // ── Зависимости ───────────────────────────────────────────────────────────
  // Все препараты у которых hasAddiction === true — всегда показываем в блоке
  context.addictions = _buildAddictions(allItems);

  // ── Ментальные расстройства ─────────────────────────────────────────────────
  context.mentalDisorders = allItems.filter(i => i.type === "mentalDisorder").map(i => {
    const abbr = CHARACTERISTICS[i.system.testChar]?.abbr ?? "W";
    const mod  = i.system.testMod || 0;
    return {
      id: i.id, name: i.name,
      desc: i.system.description || "",
      testLabel: `${abbr}${mod >= 0 ? "+" : ""}${mod}`,
      testCharKey: i.system.testChar || "wp",
      testMod: mod
    };
  });

  // ── Ментальные травмы ───────────────────────────────────────────────────────
  // Форма записи та же, что у Расстройств, и тест им катает одна и та же
  // функция: «Подавление Травмы» и «Подавление Расстройства» различаются
  // только фильтром по типу предмета.
  context.mentalTraumas = allItems.filter(i => i.type === "mentalTrauma").map(i => {
    const abbr = CHARACTERISTICS[i.system.testChar]?.abbr ?? "W";
    const mod  = i.system.testMod || 0;
    return {
      id: i.id, name: i.name,
      desc: i.system.description || "",
      testLabel: `${abbr}${mod >= 0 ? "+" : ""}${mod}`,
      testCharKey: i.system.testChar || "wp",
      testMod: mod
    };
  });

  // ── Болезни ─────────────────────────────────────────────────────────────────
  const DIS_GODS = { "": "", nurgle: "Нургл", tzeentch: "Тзинч", slaanesh: "Слаанеш", khorne: "Кхорн", other: "Иное" };
  const DIS_SEV  = { light: "Лёгкая", severe: "Тяжёлая", deadly: "Смертельная" };
  context.diseases = allItems.filter(i => i.type === "disease").map(i => {
    const s = i.system;
    return {
      id: i.id, name: i.name,
      isWarp: s.diseaseType === "warp",
      typeLabel: s.diseaseType === "warp" ? "Варп" : "Обычная",
      severityLabel: DIS_SEV[s.severity] || "",
      godLabel: DIS_GODS[s.god] || "",
      symptoms: s.symptoms || "", vectors: s.vectors || "",
      incubation: s.incubation || "", cure: s.cure || "",
      active: !!s.active
    };
  });

  // ── Состояния ─────────────────────────────────────────────────────────────
  context.activeConditions = _buildActiveConditions(system, actor);
  context.conditionsDef    = CONDITIONS_DEF;

  // ── Прочее снаряжение ─────────────────────────────────────────────────────
  context.gearGear = allItems.filter(i => i.type === "gear").map(i => ({
    id: i.id, name: i.name,
    quantity:    i.system.quantity,
    weight:      i.system.weight,
    totalWeight: Math.round((i.system.weight || 0) * (i.system.quantity || 0) * 100) / 100,
    infoguard:   supportsInfoguard(i) ? (i.system.infoguard || 0) : null
  }));

  context.gearTools = allItems.filter(i => i.type === "tool").map(i => ({
    id: i.id, name: i.name,
    quantity: i.system.quantity,
    weight:   i.system.weight,
    infoguard: supportsInfoguard(i) ? (i.system.infoguard || 0) : null
  }));

  context.gearCybernetics = allItems.filter(i => i.type === "cybernetic").map(i => ({
    id: i.id, name: i.name,
    installed: i.system.installed,
    quality:   i.system.quality,
    weight:    i.system.weight
  }));

  // ── Импланты (Механикус/Бионика/Кибернетика) ────────────────────────────────
  const IMPL_CAT = { mechanicus: "Механикус", mechEnergy: "Механикус", mechFocus: "Механикус", mechOther: "Механикус", mechadendrite: "Механикус", bionic: "Бионика", "bionic-arm": "Бионика", "bionic-leg": "Бионика", cybernetic: "Кибернетика", psybernetic: "Псибернетика", archeotech: "Археотех", skitarii: "Скитарии", bioimplant: "Биоимплант", astartes: "Импланты Астартес" };
  const QUAL = { poor: "Poor.Q", common: "Comm.Q", good: "Good.Q", best: "Best.Q" };
  // Органы Астартес (category "astartes") показаны отдельным блоком ГЕНОСЕМЯ
  // на вкладке ТЕЛО (context.geneSeedOrgans ниже) — здесь исключены, чтобы не
  // дублироваться в общей таблице Имплантов.
  context.gearImplants = allItems.filter(i => i.type === "implant" && i.system.category !== "astartes").map(i => ({
    id: i.id, name: i.name,
    category:  IMPL_CAT[i.system.category] ?? i.system.category ?? "",
    quality:   QUAL[i.system.quality] ?? i.system.quality ?? "",
    installed: i.system.installed || "",
    effect:    i.system.effect || ""
  }));

  // ── ТЕЛО (медицинский когитатор) ────────────────────────────────────────────
  {
    // На фигуре показываем ТОЛЬКО хирургически установленные импланты (флаг),
    // а не всё, что лежит в снаряжении. Установка — через окно хирургикона.
    const implItems = allItems.filter(i => i.type === "implant" && i.getFlag?.("warhammer-dbc", "installed"));
    const rawImplants = implItems.map(i => {
      const side = i.getFlag?.("warhammer-dbc", "bodySide");
      return {
        name: i.name, category: i.system.category || "cybernetic",
        installed: i.system.installed || "",
        side: side === "left" || side === "right" ? side : undefined
      };
    });
    const bodyState = buildBodyState(rawImplants);
    const legend = bodyState.cats.map(c => ({ label: IMPL_CAT[c] ?? c, color: implantCatColor(c) }));
    const deceased = !!actor.getFlag?.("warhammer-dbc", "deceased");
    const impl = buildImplantsSvg(bodyState, system.bodyType || "male");

    context.body = {
      layers:        buildBodyLayers(bodyState, system.bodyType || "male", system.race),
      implantsBack:  impl.back,
      implantsFront: impl.front,
      skinColor:     bodyState.overlays.skin ? implantCatColor(bodyState.overlays.skin) : "",
      mechMark:      rawImplants.some(i => /cyber-?mantle|кибер-?мантия/i.test(i.name)),
      ecg:      buildEcg(system, deceased),
      // Отдельно от ecg.dead: тот флагуется ещё и при wounds.value<=0 без
      // констатации («НЕТ СИГНАЛА»), а Спасение/Воскресить (стр. 232-233,
      // module/sheets/tabs/death.mjs) должны показываться ровно по флагу.
      deceased,
      legend,
      mechCount:    bodyState.mechadendrites,
      conditionCount: context.activeConditions.length,
      diseaseCount:   context.diseases.length,
      disorderCount:  context.mentalDisorders.length,
      drugCount:      context.activeDrugs.length,
      // Жизненные потребности (корбук 483): Голод/Жажда/Сон — стадия двигается
      // сама по game.time.worldTime, см. vitalEffectiveStage (wdbc-jnqj).
      life: VITALS.map(v => {
        const vitalCtx = { tb: Number(system.characteristics?.t?.bonus) || 0, isAstartes: raceMatches(system, "astartes") };
        const val = vitalEffectiveStage(v.key, system.vitals?.[v.key], system.vitals?.[VITAL_TIME_FIELD[v.key]],
          game.time?.worldTime ?? 0, vitalCtx);
        const st  = v.stages[val];
        return {
          key: v.key, label: v.label, icon: v.icon, tone: v.tone, action: v.action,
          stage: val, max: VITAL_MAX_STAGE, stageLabel: st.label, fx: st.fx,
          pen: st.pen, scope: v.scope,
          pips: [1, 2, 3].map(n => ({ on: n <= val })),
          alert: val > 0, crit: val >= VITAL_MAX_STAGE
        };
      }),
      // Зависимость (мутация «Addiction», wdbc-5inv) — одна строка на каждый
      // предмет-носитель (обычно один). Пусто, если мутации нет вовсе — блок
      // на листе тогда не рисуется (см. tab-effects.hbs).
      dependencies: addictionItems(actor).map(item => {
        const worldTime = game.time?.worldTime ?? 0;
        const unsatisfied = isAddictionUnsatisfied(item, worldTime);
        return {
          itemId: item.id,
          substance: addictionSubstanceLabel(item) || "(не определено)",
          status: addictionStatusLabel(item, worldTime),
          unsatisfied
        };
      })
    };
  }

  // ── Способности / Таланты ─────────────────────────────────────────────────
  // Одинаковые Таланты из разных источников идут ОДНОЙ строкой: с общим
  // рейтингом и со списком специализаций (rules/merge-abilities.mjs). Предметы
  // при этом остаются раздельными — строка ведёт к первому из них, и удаление
  // снимает источники по одному.
  // Подспособности переключаемой способности (Локус Герольда и подобные) в
  // общий список не идут: они рисуются вложенными под своим родителем, со
  // своей кнопкой вкл./выкл. Иначе шесть эффектов Локуса засорили бы таблицу
  // Талантов шестью самостоятельными строками, а склейка одноимённых
  // (mergeAbilityItems) ещё и слепила бы одинаковые Локусы разных Герольдов.
  context.abilityTalents = mergeAbilityItems(allItems.filter(i => i.type === "talent" && !toggleParentId(i))).map(g => {
    const i  = g.first;
    const e  = mergeAbilityEffects(g.items);
    const fx = [];
    for (const [stat, value] of Object.entries(e.charBonus))
      fx.push(`💪 ${value > 0 ? "+" : ""}${value} к ${(CHARACTERISTICS[stat]?.abbr ?? stat)}`);
    if (e.initMod)    fx.push(`⚡ ${e.initMod > 0 ? "+" : ""}${e.initMod} Иниц.`);
    if (e.fearRating) fx.push(`😱 Страх ${e.fearRating}`);
    return {
      id:             g.id,
      // Рейтинг у Талантов своей колонки не имеет (в отличие от Черт), поэтому
      // и он, и специализации живут в подписи.
      name:           abilityLabel(g),
      tier:           i.system.tier || 1,
      god:            i.system.god || "",
      specialization: g.specs.join(", "),
      requirement:    i.system.requirement || "",
      aptitudes:      (i.system.aptitudes || []).map(k => APTITUDES[k] ?? k).join(", "),
      effectSummary:  fx.join(" · "),
      benefit:        i.system.benefit || i.system.description || "",
      // Тип (папка корбука) ищется по имени как его записал источник: в
      // библиотеке имя лежит целиком, вместе с «(X)».
      typeGroup:      TALENT_TYPE.byName.get(i.name) || "Прочие",
      toggles:        toggleRows(allItems, i)
    };
  });
  // Группировка талантов по типам корбука (стр. 62-105) для читаемого списка.
  {
    const gm = new Map();
    for (const t of context.abilityTalents) {
      if (!gm.has(t.typeGroup)) gm.set(t.typeGroup, []);
      gm.get(t.typeGroup).push(t);
    }
    context.abilityTalentGroups = [...gm.entries()]
      .sort((a, b) => (TALENT_TYPE.order.get(a[0]) ?? 999) - (TALENT_TYPE.order.get(b[0]) ?? 999))
      .map(([label, items]) => ({ label, items: items.sort((x, y) => (x.tier - y.tier) || x.name.localeCompare(y.name, "ru")) }));
  }

  // Купленные за опыт Таланты-предметы (пикер «＋» на вкладке Способности) —
  // показываем их в «Развитии» рядом с ручным списком, чтобы трата опыта была
  // видна там же, где она считается (спис. цены суммирует actor.mjs).
  // Показываем ВСЕ таланты-предметы, а не только купленные: выданные при
  // генерации тоже должны быть видны, чтобы их можно было пометить/снять ★.
  // Здесь склейки НЕТ и быть не должно: считается опыт, а каждая
  // специализация — своя покупка со своей ценой. Чтобы строки не выглядели
  // тремя одинаковыми «Сопротивлениями», специализация видна в подписи.
  context.purchasedTalents = actor.items
    .filter(i => i.type === "talent")
    .map(i => {
      const cost = parseInt(i.system?.cost) || 0;
      return {
        id:   i.id,
        name: abilityLabel(mergeAbilityItems([i])[0]),
        cost,
        tier: i.system?.tier || 1,
        // ★ — «выдан архетипом/расой, опыт не тратится»
        isGranted: !!i.system?.granted || (cost === 0 && !i.system?.purchased),
        // Цена вписана ГМом руками (wdbc-cct) — держится, пока не сбросят
        // явно кнопкой ↺: авто-пересчёт по Склонностям такую цену не трогает.
        costManual: !!i.system?.costManual
      };
    })
    .sort((a, b) => (a.tier - b.tier) || a.name.localeCompare(b.name, "ru"));

  // Готовый список склонностей для выбора в «Развитии» (без «Общей» — она у всех).
  context.aptitudeChoices = Object.entries(APTITUDES)
    .filter(([k]) => k !== "general")
    .map(([key, label]) => ({ key, label }));

  // Стремления (стр. 22): ЖЁСТКО фиксированные 3 слота, по одному на таблицу
  // (Гордыня/Позор/Мотивация) — раньше был свободный список до 3 из любой
  // таблицы, но по месту решили закрепить по смыслу. Позиция = категория:
  // [0]=pride, [1]=disgrace, [2]=motivation.
  //
  // Лежат в system.aspirations.slots, а не в самом `aspirations`: то поле —
  // объект (там же Фактор Прибыли), и записанный в него массив схема молча
  // отбрасывала, то есть выбор не доживал до перерисовки листа.
  const aspirRaw = Array.isArray(system.aspirations?.slots) ? system.aspirations.slots : [];
  // Журнал опыта живёт в отдельном окне (apps/xp-log.mjs, wdbc-ng7q) — здесь
  // нужен только счётчик записей для кнопки, что открывает то окно.
  context.xpLog = xpLogEntries(system);

  context.aspirationSlots = ASPIRATION_TABLES.map((t, idx) => {
    const a = aspirRaw[idx];
    const options = aspirationOptions(t.key).map(e => ({ id: e.key, name: e.name, mods: e.mods }));
    if (a && a.custom) return { idx, table: t.key, label: t.label, options, custom: true, id: "", name: a.name || "", mods: a.mods || "", desc: a.desc || "" };
    const e = aspirationByKey(a?.id || a);
    return { idx, table: t.key, label: t.label, options, custom: false, id: a?.id || a || "", name: e?.name || "", mods: e?.mods || "", desc: e?.desc || "" };
  });

  // Доп. элитные архетипы (кнопка «+» в шапке, поверх основного eliteArchetype).
  context.eliteArchetypesExtra = (Array.isArray(system.eliteArchetypesExtra) ? system.eliteArchetypesExtra : [])
    .map((value, idx) => ({ idx, value }));

  context.abilityAbilities = allItems.filter(i => i.type === "ability").map(i => ({
    id:      i.id,
    name:    i.name,
    benefit: i.system.benefit || ""
  }));

  // ── Ритуалы (стр. 393-425) ──────────────────────────────────────────────
  context.rituals = ritualsContext(actor);

  // ── Черты (трейты) ──────────────────────────────────────────────────────
  // Как и Таланты, одинаковые Черты из разных источников склеиваются в одну
  // строку с общим рейтингом: «Nimble (5)» дважды — это Nimble (10).
  // Возможности, которые актор имеет прямо сейчас (записи Конструктора вида
  // «Возможность» с активных предметов — включённые Локусы и всё прочее).
  // Панель нужна затем, что часть возможностей пока не имеет читателя в
  // расчёте: за столом их применяет ГМ, и он должен видеть список, а не
  // вспоминать, какой Локус включён.
  {
    const flags = ruleFlags(actor, { kind: "skill" });
    const capabilityRows = [...flags]
      .map(key => {
        // Цена в пуле (wdbc-1dc8) — не у каждой записи; когда задана, на
        // строке появляется кнопка «Потратить» (тот же гейт ДО клика, что
        // wdbc-qjnk у ae-spend-btn — apSpendGate/capabilityCostGate).
        const cost = ruleFlagCost(actor, key, { kind: "skill" });
        // Подпись в реестре — текст книги целиком (медиана 120 символов, есть
        // и на 2266): в ячейке таблицы она ломает ровно то, ради чего панель
        // заведена — быстрый взгляд «что у меня сейчас есть». В ячейку идёт
        // шапка, полный текст — в подсказку (helpers/utils.mjs::shortLabel).
        const label = CAPABILITIES[key]?.label || key;
        return {
          key,
          label: shortLabel(label),
          labelFull: label,
          sources: ruleFlagLabels(actor, key, { kind: "skill" }).join(", "),
          // Есть ли код, который эту возможность читает. Ложь честнее молчания:
          // ГМ должен знать, что вот это система сама не посчитает.
          //
          // Одного слова «вручную» за столом мало: у иммунитета и у «раз за
          // бой потратить Очко» это две разные заботы, и первая ГМа не
          // касается, пока по персонажу не бьют. Поэтому рядом идёт форма —
          // что именно делать руками (constants/capability-forms.mjs).
          auto: !!CAPABILITIES[key]?.reader,
          autoHint: capabilityAutoHint(!!CAPABILITIES[key]?.reader, label),
          cost,
          costLabel: cost ? capabilityCostLabel(cost) : "",
          spendGate: cost ? capabilityCostGate(actor, cost) : null
        };
      });
    // kind:"script" записи с ценой/частотой (wdbc-suwp) — та же панель, но
    // кнопка «▶ Запустить» (запускает код) вместо «Потратить» (просто
    // списывает пул): раньше такая запись была видна только внутри листа
    // СВОЕГО предмета (Дара/Мутации), игроку приходилось помнить, у какого
    // именно предмета она лежит. scriptAbilityRow пересчитывает готовность
    // живьём на каждый рендер (троттлинг/пул могли смениться после прошлого
    // открытия листа) — та же логика, что уже строит кнопку на листе предмета.
    const scriptRows = scriptAbilities(actor, { kind: "skill" })
      .map(sa => {
        const item = actor.items.get(sa.itemId);
        const row = scriptAbilityRow(item, sa.groupId, sa.entryId);
        if (!row) return null; // предмет сняли/запись удалили между рендерами
        return {
          key: `script-${sa.itemId}-${sa.entryId}`,
          label: shortLabel(row.label),
          labelFull: row.label,
          sources: item?.name || sa.ruleLabel || "",
          auto: true,
          autoHint: capabilityAutoHint(true, row.label),
          isScript: true,
          itemId: sa.itemId, groupId: sa.groupId, entryId: sa.entryId,
          scriptReady: row.ready,
          scriptStatus: row.statusLabel,
          costLabel: row.costLabel
        };
      })
      .filter(Boolean);
    context.activeCapabilities = [...capabilityRows, ...scriptRows]
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }

  // Подспособности сюда тоже не идут — см. комментарий у Талантов выше.
  context.traits = mergeAbilityItems(allItems.filter(i => i.type === "trait" && !toggleParentId(i))).map(g => {
    const e  = mergeAbilityEffects(g.items);
    const fx = [];
    for (const [stat, value] of Object.entries(e.charBonus))
      fx.push(`💪 ${value > 0 ? "+" : ""}${value} к ${(CHARACTERISTICS[stat]?.abbr ?? stat)}`);
    if (e.armourAll)  fx.push(`🛡️ +${e.armourAll} AP`);
    if (e.fearRating) fx.push(`😱 Страх ${e.fearRating}`);
    if (e.sizeMod)    fx.push(`📏 Размер ${e.sizeMod > 0 ? "+" : ""}${e.sizeMod}`);

    return {
      id:            g.id,
      // У Черты рейтинг показывает своя колонка, поэтому в подписи остаются
      // только имя и специализации (у Черт схемы их нет, но имя бывает общим).
      name:          g.specs.length ? `${g.baseName} (${g.specs.join(", ")})` : g.baseName,
      ratingDisplay: g.ratingText,
      effectSummary: fx.join(" · "),
      benefit:       g.first.system.benefit || "",
      toggles:       toggleRows(allItems, g.first)
    };
  });

  // Мутации и Дары Богов — один тип предмета, разделяются по полю system.god
  // (стр. 440 — общая таблица; стр. 453-460 — таблицы Даров четырёх Богов).
  // Один общий пул на листе (не два раздельных подраздела) — см. mutgift-*.
  const GOD_LABEL = { khorne: "Кхорн", slaanesh: "Слаанеш", nurgle: "Нургл", tzeentch: "Тзинч" };
  const allMut = allItems.filter(i => i.type === "mutation");
  context.mutationsAndGifts = allMut.map(i => {
    // Выпавшая субмутация (стр. 440) показывается прямо в строке: у мутации с
    // таблицей значение имеет именно она, а не общее описание.
    const sub = i.system.submutation || {};
    return {
      id:       i.id,
      name:     i.name,
      subName:  sub.name || "",
      godLabel: i.system.god ? (GOD_LABEL[i.system.god] || i.system.god) : "",
      benefit:    i.system.benefit || i.system.description || "",
      subText:    sub.name ? `${sub.label} — ${sub.name}: ${sub.text}` : "",
      activatable: !!i.system.activatable,
      active:      !!i.system.active
    };
  });

  context.abilityPsychicPowers = allItems.filter(i => i.type === "psychicPower").map(i => ({
    id:   i.id,
    name: i.name,
    cost: i.system.cost || 0
  }));

  // ── Психосилы (для вкладки ПСИ) ─────────────────────────────────────────────
  // Превью порога психотеста: charVal + 5×тПР + мод (при эPR = тПР по умолчанию).
  const _psyTpr   = Number(actor.system.psyker?.currentRating) || 0;
  const _psyChars = actor.system.characteristics ?? {};
  const _psyAbbr  = { wp: "WP", int: "Int", per: "Per", fel: "Fel", cor: "Cor", psyniscience: "Псин" };
  // Дальность до цели (wdbc-iy0c): мерим один раз на весь список, не на силу —
  // тот же снимок «текущая цель на сцене», что у attackerToken/targetToken в
  // диалоге атаки (game.user.targets в момент рендера, не живой хук).
  const _psyAttackerToken = actor.getActiveTokens?.(false)?.[0] ?? null;
  const _psyTargetToken   = [...(game.user?.targets ?? [])][0] ?? null;
  const _psyMeasured = (_psyAttackerToken && _psyTargetToken)
    ? measureTokens(_psyAttackerToken, _psyTargetToken) : null;
  context.psyPowers = allItems.filter(i => i.type === "psychicPower").map(i => {
    const s = i.system;
    // Порог считаем только для тестов по характеристике (не Порча/Псинаука-навык).
    const stdChar = (s.testChar && s.testChar !== "cor" && s.testChar !== "psyniscience") ? s.testChar : null;
    const charVal = stdChar && _psyChars[stdChar] ? (_psyChars[stdChar].total || 0) : 0;
    const threshold = stdChar ? (charVal + 5 * _psyTpr + (Number(s.testMod) || 0)) : null;
    const _rangeM = _psyMeasured ? parseRangeMeters(s.range, _psyTpr) : null;
    const _verdict = _rangeM != null ? rangeVerdict(_psyMeasured.edgeM, _rangeM) : null;
    return {
      id:           i.id,
      name:         i.name,
      typeLabel:    PSY_POWER_TYPES[s.powerType] ?? s.powerType ?? "",
      testAbbr:     _psyAbbr[s.testChar] ?? (s.testChar || "").toUpperCase(),
      threshold,
      prRequired:   s.prRequired ?? 0,
      cost:         s.cost ?? 0,
      disciplineLabel: PSY_DISCIPLINES[s.discipline]?.label ?? "",
      subtype:      s.subtype || "",
      actionLabel:  PSY_ACTIONS[s.action] ?? s.action ?? "",
      range:        s.range || "—",
      rangeVerdictText: _verdict
        ? `до цели: ${_verdict.edgeM} м — ${_verdict.inBounds ? "В ПРЕДЕЛАХ" : "ВНЕ"}`
        : null,
      rangeInBounds: _verdict ? _verdict.inBounds : null,
      sustainable:  s.sustainable || false,
      isSustained:  s.isSustained || false,
      sustainedDegree: s.sustainedDegree ?? null,
      sustainCost:  s.sustainCost ?? 1,
      sustainActionLabel: PSY_ACTIONS[s.sustainAction] ?? s.sustainAction ?? "Свободное",
      damage:       s.damage || "",
      damageType:   DAMAGE_TYPES[s.damageType] ?? s.damageType ?? "",
      penetration:  s.penetration ?? 0,
      effect:       s.effect || s.description || ""
    };
  });

  // ── Силы навигатора (вкладка НАВ) ───────────────────────────────────────────
  context.navigatorPowers = allItems.filter(i => i.type === "navigatorPower").map(i => {
    const s = i.system;
    const abbr = CHARACTERISTICS[s.testChar]?.abbr ?? s.testChar ?? "";
    const mod  = s.testMod || 0;
    return {
      id: i.id, name: i.name,
      testLabel:   `${abbr}${mod >= 0 ? "+" : ""}${mod}${s.opposed ? " встр." : ""}`,
      actionLabel: PSY_ACTIONS[s.action] ?? s.action ?? "",
      range:       s.range || "—",
      requirement: s.requirement || "",
      powerKind:   s.powerKind || "",
      sustainable: s.sustainable || false,
      isSustained: s.isSustained || false,
      sustainedDegree: s.sustainedDegree ?? null,
      effect:      s.effect || s.description || ""
    };
  });

  // ── Геносемя (для Астартес) ─────────────────────────────────────────────────
  context.isAstartes      = system.race === "astartes";
  context.geneSeedOrigin  = system.geneSeed?.origin || "";
  // Селекты панели «Происхождение и легион» ушли вместе с панелью — легион и
  // культура задаются мастером создания (character-wizard.mjs, у него свои
  // options-билдеры). Здесь остаётся только то, что читает шапка.
  context.selectedLegion  = getLegion(system.geneSeed?.legion || "");
  context.selectedChapter = getChapter(system.geneSeed?.legion || "", system.geneSeed?.chapter || "");
  // Культура — независимый выбор (можно перенять у другого легиона, стр. 489-506)
  context.cultureLegionOptions  = buildCultureLegionOptions(system.geneSeed?.cultureLegion || "");
  context.cultureChapterOptions = buildChapterOptions(system.geneSeed?.cultureLegion || "", system.geneSeed?.cultureChapter || "");
  context.hasCultureOverride    = !!system.geneSeed?.cultureLegion;
  context.resolvedCulture       = system.geneSeed?.cultureLegion
    ? resolveCulture(system.geneSeed.cultureLegion, system.geneSeed?.cultureChapter) : null;
  // Гайд по имплантам Геносемени на вкладке ТЕЛО — на него ссылается
  // описание Черты «Геносемя» ("см. гайд на вкладке ТЕЛО"). Органы
  // выдаёт Конструктор той Черты обычными предметами-имплантами категории
  // "astartes" (module/apps/mechanics.mjs, kind:"equipment"), поэтому гайд не
  // хранит свою копию текста, а читает то же поле system.effect, что и карточка
  // импланта на вкладке ТЕЛО — расхождения быть не может по построению.
  context.geneSeedOrgans = allItems
    .filter(i => i.type === "implant" && i.system.category === "astartes")
    .map(i => ({
      id: i.id, name: i.name,
      effect:      i.system.effect || "",
      description: i.system.description || "",
      installed:   i.system.installed || ""
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  // Имя источника Геносемя/Культуры для шапки — ЧИСТОЕ имя легиона/варбанды
  // (без номера легиона, который несёт resolvedCulture.name/legion-info-title
  // на «Заметках» — там уместен, в компактной шапке нет).
  context.headerGeneSeedName = context.selectedChapter?.name || context.selectedLegion?.name || "";
  if (context.hasCultureOverride) {
    const cultureLegion  = getLegion(system.geneSeed.cultureLegion);
    const cultureChapter = getChapter(system.geneSeed.cultureLegion, system.geneSeed?.cultureChapter || "");
    context.headerCultureName = cultureChapter?.name || cultureLegion?.name || "";
  } else {
    context.headerCultureName = context.headerGeneSeedName;
  }
  // Текст «что даёт» — для read-only панели на Записях (мутации Геносемени,
  // склонности/бонусы Культуры). Своя культура берётся из того же
  // легиона/ордена, что и Геносемя, если перенятой культуры нет.
  context.geneSeedText = context.selectedChapter?.geneseed || context.selectedLegion?.geneseed || "";
  context.cultureText  = context.hasCultureOverride
    ? (context.resolvedCulture?.culture || "")
    : (context.selectedChapter?.culture || context.selectedLegion?.culture || "");

  // ── Псайкер (сводка для вкладки) ────────────────────────────────────────────
  const isEldarPsyker = isAeldariRace(system.race);
  const psyBPR = system.psyker?.rating ?? 0;
  const psyTPR = system.psyker?.currentRating ?? 0;
  context.psyker = {
    class:         system.psyker?.class || "bound",
    isEldar:       isEldarPsyker,
    themeKey:      isEldarPsyker ? "eldar" : (system.psyker?.class || "bound"),
    natureLabel:   isEldarPsyker ? "Древнее Мастерство"
                                 : (PSY_NATURES[system.psyker?.class]?.label ?? "Связанный"),
    rating:        psyBPR,
    currentRating: psyTPR,
    sustain:       system.psyker?.sustain ?? 0,
    // Проводник Варпа: пипсы 1..бPR — заряжённые (доступны, ≤тPR) / истощённые (на поддержание).
    prPips:        Array.from({ length: Math.min(12, Math.max(0, psyBPR)) },
                     (_, i) => ({ charged: (i + 1) <= psyTPR })),
    overload:      psyTPR < 0
  };

  context.abilityTechPowers = allItems.filter(i => i.type === "techPower").map(i => ({
    id:   i.id,
    name: i.name
  }));

  // ── Техночудеса (для вкладки ТЕХ) ───────────────────────────────────────────
  context.techMiracles = allItems.filter(i => i.type === "techPower").map(i => {
    const s = i.system;
    return {
      id:            i.id,
      name:          i.name,
      typeLabel:     TECH_MIRACLE_TYPES[s.miracleType]?.label ?? s.miracleType ?? "",
      disciplineLabel: TECH_DISCIPLINES[s.discipline]?.label ?? "",
      subtype:       s.subtype || "",
      rating:        s.rating ?? 0,
      cognitionCost: s.cognitionCost ?? 0,
      energyCost:    s.energyCost ?? 0,
      cost:          s.cost ?? 0,
      sustainCost:   s.sustainCost ?? 0,
      sustainActionLabel: TECH_ACTIONS[s.sustainAction] ?? s.sustainAction ?? "Свободное",
      actionLabel:   TECH_ACTIONS[s.action] ?? s.action ?? "",
      range:         s.range || "—",
      damage:        s.damage || "",
      damageType:    DAMAGE_TYPES[s.damageType] ?? s.damageType ?? "",
      penetration:   s.penetration ?? 0,
      sustained:     s.sustained || false,
      effect:        s.effect || s.description || ""
    };
  });
  const cogVal = system.cognition?.value ?? 0, cogMax = system.cognition?.max ?? 0;
  context.cognition = {
    value: cogVal, max: cogMax, regen: system.cognition?.regen ?? 0,
    pips: Array.from({ length: Math.min(14, Math.max(0, cogMax)) }, (_, i) => ({ on: (i + 1) <= cogVal }))
  };
  const enVal = system.energy?.value ?? 0;
  const enMaxTotal = system.energy?.maxTotal ?? (system.energy?.max ?? 0);
  context.energy = {
    value:    enVal,
    max:      system.energy?.max ?? 0,
    bonusMax: system.energy?.bonusMax ?? 0,
    maxTotal: enMaxTotal,
    pips: Array.from({ length: Math.min(16, Math.max(0, enMaxTotal)) }, (_, i) => ({ on: (i + 1) <= enVal }))
  };
  context.noosphereActions = NOOSPHERE_ACTIONS;

  // ── Инфограждение: сводка по высокотехнологичному снаряжению персонажа ────
  // (module/apps/infoguard.mjs) — та же кнопка «Наложить», что и на листе
  // предмета, но списком на вкладке Тех, где игрок и так работает с Tech-Use.
  context.infoguardItems = allItems
    .filter(i => supportsInfoguard(i))
    .map(i => ({ id: i.id, name: i.name, successes: i.system.infoguard || 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));

  // ── Кибернетика Механикум: кнопки генерации ⚙/⚡ и тумблеры от имплантов ──────
  // Только установленные (флаг) импланты с директивами gen/toggle в IMPLANT_MECH.
  const RES_LABEL = { cognition: "Когниция", energy: "Энергия" };
  const techGen = [], techToggles = [], techFocusList = [];
  for (const it of allItems) {
    if (it.type !== "implant" || !it.getFlag?.("warhammer-dbc", "installed")) continue;
    const mech = implantMech(it.name);
    if (!mech) continue;
    const q = it.system.quality || "common";
    if (Array.isArray(mech.gen)) {
      mech.gen.forEach((g, gi) => {
        techGen.push({
          itemId: it.id, genIdx: gi,
          implant: it.name.split("/")[0].trim(),
          res: g.res, resLabel: RES_LABEL[g.res] || g.res,
          amount: g.amount, label: g.label,
          fromCognition: g.fromCognition ?? 0
        });
      });
    }
    if (mech.toggle) {
      techToggles.push({
        itemId: it.id,
        implant: it.name.split("/")[0].trim(),
        label: mech.toggle.label, note: mech.toggle.note || "",
        active: !!it.getFlag?.("warhammer-dbc", "techActive")
      });
    }
    if (mech.ironFocus) {
      const IRON = { poor: "−10", common: "0", good: "+5", best: "+10" };
      techFocusList.push({ implant: it.name.split("/")[0].trim(), quality: q, mod: IRON[q] ?? "0" });
    }
  }
  context.techGenActions = techGen;
  context.techToggles    = techToggles;
  context.techFocusList  = techFocusList;

  return context;
}