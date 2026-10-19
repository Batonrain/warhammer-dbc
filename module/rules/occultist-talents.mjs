// module/rules/occultist-talents.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ТАЛАНТЫ ОККУЛЬТИСТА (глава 3) — перепроверка Sahara 3-2a39 (19.10.2026)
//  нашла готовые приёмы для части находок, которые исходный разбор задачи
//  посчитал неавтоматизируемыми или не упомянул вовсе:
//
//  - Erudite-Infernal — штрафы «недостаточных знаний о демоне» уже лежат
//    отдельными строками в RITUAL_SUMMON_MODS (littleKnown/nothingKnown/
//    falseKnow, module/constants/rituals.mjs) — Талант их гасит, см.
//    module/apps/ritual-cast.mjs::ritualThreshold.
//  - Infernal Master — задача пересказала только половину книжного текста.
//    «+10 Лояльности демон-Миньонам» подключена в module/rules/
//    minion-build.mjs::minionLoyalty тем же приёмом, что Beloved Leader.
//    Подмена теста командования (Forbidden Lore(Daemons)(W) вместо Command)
//    — тот же rollBonus-приём разницы итогов, которым leadership-talents.mjs
//    только что (19.10.2026, Sahara 3-ac78) решил Living Legend (Inf вместо
//    F) — не «неисследованный класс», как решила исходная задача, а уже
//    проверенная техника.
//  - Glorious Purpose — тот же rollBonus-приём разницы (Inf вместо W/F),
//    гейт — «использует демоническое оружие» (system.daemonWeapon.bound на
//    снаряжённом оружии) И цель броска — демон (уже существующий предикат
//    isDaemonActor, module/rules/predicates.mjs — покрывает тип актора
//    daemon/demonPrince и Черту Daemonic).
//  - Rite Puzzler — задача пересказала только половину книжного текста.
//    Вторая половина («на месте следов ритуала — I−20 / I+0 если
//    присутствовал — чтобы выучить его») — обычный тест Характеристики с
//    модификатором, без привязки к конкретному предмету-ритуалу: в системе
//    получение ритуала уже ничем не гейтится («＋» на вкладке Ритуалы,
//    module/sheets/tabs/rituals.mjs::activateRitualListeners, открывает
//    Обозреватель без проверок) — поэтому здесь только число для теста,
//    сам тест и перенос предмета на лист — за столом, как и у остальных
//    находок главы без выделенной кнопки.
//
//  [допущение] Подмена характеристики/навыка выбрана БЕЗУСЛОВНО, а не как
//  выбор игрока «только если выгоднее» — тот же риск (редкий отрицательный
//  итог, если «своя» характеристика выше замещающей), который Сергей уже
//  принял для Living Legend по той же причине (один rollBonus на разницу
//  безопаснее точечной правки char в каждом месте расчёта).
//
//  [допущение] «Демонхост», «демоническая машина» и «Одержимый с
//  доминирующей личностью демона» (книжный список целей Infernal Master)
//  отдельных признаков в системе не имеют — предикат isDaemonActor считает
//  их демонами ровно тогда, когда у конкретного актора есть Черта Daemonic
//  (как у обычного демона-бестиария) ИЛИ тип актора daemon/demonPrince. Это
//  не новая граница, а использование уже существующего предиката как есть.
// ════════════════════════════════════════════════════════════════════════════

import { itemHasName, isDaemonActor } from "./predicates.mjs";
import { findGroupEntry } from "../constants/skill-specializations.mjs";

function hasOccultistTalent(actor, names) {
  return [...(actor?.items ?? [])].some(i =>
    i?.type === "talent" && names.some(n => itemHasName(i, n)));
}

const ERUDITE_INFERNAL_NAMES = ["Erudite-Infernal", "Эрудит-Инфернал"];
const INFERNAL_MASTER_NAMES  = ["Infernal Master", "Инфернальный Владыка"];
const GLORIOUS_PURPOSE_NAMES = ["Glorious Purpose", "Славное Назначение"];
const RITE_PUZZLER_NAMES     = ["Rite Puzzler", "Разгадыватель Ритуалов"];

export function hasEruditeInfernal(actor) {
  return hasOccultistTalent(actor, ERUDITE_INFERNAL_NAMES);
}

export function hasInfernalMaster(actor) {
  return hasOccultistTalent(actor, INFERNAL_MASTER_NAMES);
}

export function hasGloriousPurpose(actor) {
  return hasOccultistTalent(actor, GLORIOUS_PURPOSE_NAMES);
}

export function hasRitePuzzler(actor) {
  return hasOccultistTalent(actor, RITE_PUZZLER_NAMES);
}

function charTotal(actor, key) {
  return Number(actor?.system?.characteristics?.[key]?.total) || 0;
}

/** Снаряжённое оружие с вселённым демоном (Инфернальный Оруженосец и т.п., system.daemonWeapon.bound). */
function wieldsDaemonWeapon(actor) {
  return [...(actor?.items ?? [])].some(i =>
    i?.type === "weapon" && i?.system?.equipped && i?.system?.daemonWeapon?.bound);
}

// ── Glorious Purpose / Славное Назначение ────────────────────────────────────
// [книга] «При использовании демонического оружия персонаж может использовать
// свой Inf вместо W или F для всех тестов против демона.»
//
// Область действия — `char:wp`/`char:fel` (module/rules/resolve-test.mjs::
// effectAppliesTo): это ТОЛЬКО тесты самой характеристики (ctx.skill
// отсутствует), не тесты Навыков, основанных на W/F — у области `char:X`
// в системе ровно такая граница («char:int не подхватывается броском
// навыка на Интеллекте», тот же комментарий резолвера). Книжное «для всех
// тестов против демона» шире одной записи реестра (десятки Навыков на W/F)
// — честно покрыта только прямая характеристика; Навыки на W/F (Scrutiny,
// Intimidate и т.п.) НЕ подхватывают эту разницу.

/** Разница Inf−char для Glorious Purpose: 0, если условия не выполнены. */
export function gloriousPurposeBonus(actor, ctx = {}, char) {
  if (char !== "wp" && char !== "fel") return 0;
  if (!hasGloriousPurpose(actor)) return 0;
  if (!wieldsDaemonWeapon(actor)) return 0;
  if (!isDaemonActor(ctx?.targetActor)) return 0;
  return charTotal(actor, "inf") - charTotal(actor, char);
}

// ── Infernal Master / Инфернальный Владыка ───────────────────────────────────
// [книга] «Персонаж может использовать Forbidden Lore (Daemons)(W) вместо
// Command в тестах командования демонами, демонхостами, демоническими
// машинами и Одержимыми с доминирующей личностью демона. Его Миньоны-демоны
// получают +10 Лояльности.»
//
// Половина про +10 Лояльности — module/rules/minion-build.mjs::minionLoyalty
// (hasInfernalMaster + группа Миньона "daemon", тот же приём, что Beloved
// Leader). Здесь — подмена теста командования.

/** Итог Forbidden Lore(Daemons), посчитанный от W вместо собственной характеристики специализации. */
function forbiddenLoreDaemonsOnWillpower(actor) {
  const entry = findGroupEntry(actor, "forbiddenLore", "Daemons");
  if (!entry) return null;
  const entryChar = entry.char || "int";
  // entry.total уже содержит (charVal + ранг + мод) — вычитаем вклад СВОЕЙ
  // характеристики и подставляем W, тот же приём, что ritual-cast.mjs
  // (ritualThreshold::charAdj) и dark-seer.mjs (darkSeerSwapChar).
  const rankPlusMod = (Number(entry.total) || 0) - charTotal(actor, entryChar);
  return charTotal(actor, "wp") + rankPlusMod;
}

/** Разница FL(Daemons)(W)−Command для теста Команды против демона: 0, если условия не выполнены. */
export function infernalMasterCommandBonus(actor, ctx = {}) {
  if (!hasInfernalMaster(actor)) return 0;
  if (!isDaemonActor(ctx?.targetActor)) return 0;
  const flTotal = forbiddenLoreDaemonsOnWillpower(actor);
  // Нет самой специализации Forbidden Lore (Daemons) на листе — подменять
  // нечем, Талант не спасает от незнания Навыка, который он замещает.
  if (flTotal == null) return 0;
  const commandTotal = Number(actor?.system?.skills?.command?.total) || 0;
  return flTotal - commandTotal;
}

// ── Rite Puzzler / Разгадыватель Ритуалов ────────────────────────────────────
// [книга] «...На месте проведения ритуала с его следами он может пройти
// I−20, чтобы выучить ритуал (I+0, если присутствовал на нём).»
//
// Сам предмет-ритуал система не привязывает к месту/следам (нет такой
// сущности), поэтому здесь только число теста — без него строка книги
// читалась бы «ничем не смоделировано» с нуля при следующей сверке главы.

/** Модификатор теста Int на «выучить ритуал по следам»: null — Таланта нет. */
export function ritePuzzlerLearnMod(actor, wasPresent) {
  if (!hasRitePuzzler(actor)) return null;
  return wasPresent ? 0 : -20;
}

/**
 * Правила реестра (rules/sources.mjs) — тот же формат, что
 * leadership-talents.mjs::leadershipTalentRules: пушим rollBonus только
 * когда он реально ненулевой, иначе пустая строка «+0: Талант» мусорила бы
 * карточку теста без надобности.
 */
export function occultistTalentRules(actor, ctx = {}) {
  const rules = [];
  for (const char of ["wp", "fel"]) {
    const bonus = gloriousPurposeBonus(actor, ctx, char);
    if (bonus) {
      rules.push({
        id: `gloriousPurpose.${char}`, label: "Славное Назначение", when: {},
        effects: [{ kind: "rollBonus", target: `char:${char}`, value: bonus, label: "Славное Назначение" }]
      });
    }
  }
  const commandBonus = infernalMasterCommandBonus(actor, ctx);
  if (commandBonus) {
    rules.push({
      id: "infernalMaster.command", label: "Инфернальный Владыка", when: {},
      effects: [{ kind: "rollBonus", target: "skill:command", value: commandBonus, label: "Инфернальный Владыка" }]
    });
  }
  return rules;
}
