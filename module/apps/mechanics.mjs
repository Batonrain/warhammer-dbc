// module/apps/mechanics.mjs
// ════════════════════════════════════════════════════════════════════════
//  Единый Конструктор — вкладка «МЕХАНИКА» на листе предмета. Заменяет
//  собой три ранее раздельных места (кнопка «🧙 Конструктор» на вкладке
//  «Эффекты», вкладку «Выдачи», вкладку «Скрипты») одним списком групп:
//  без кода, дроплистами + драг-н-дропом настраивается ВСЁ, что предмет
//  делает при получении актором — характеристики, Черты/Таланты/Навыки, а
//  для нестандартных случаев — свободный код (kind:"script", тот же
//  исполнитель, что и раньше, см. item-script.mjs).
//
//  Хранение: flags.warhammer-dbc.mechanics — массив ГРУПП:
//    { id, operator: "AND"|"OR", entries: [ЗАПИСЬ, ...] }
//  «И»-группа применяет ВСЕ свои записи; «ИЛИ»-группа при получении
//  предмета показывает диалог выбора, и применяется только ОДНА запись.
//
//  Виды записи (entry.kind):
//    corruption: { op:"add"|"subtract", corruptionValue }
//      → ОДНОРАЗОВАЯ ПЕРМАНЕНТНАЯ правка system.corruption.value (хранимое
//      состояние, не производное — как .advance/.supernatural у
//      характеристик, ActiveEffect тут не подходит). corruptionValue —
//      строка-формула: обычное число ("5") ИЛИ бросок XdY ("2d10"), Roll
//      разбирает оба варианта одинаково; результат броска идёт в чат для
//      прозрачности. Откат при снятии предмета — через тот же
//      flags.warhammer-dbc.poolApplied={pool,amount}, что раньше писали
//      скрипт-шаблоны «± Очки пула» (см. Hooks.on("deleteItem",...) в
//      warhammer-dbc.mjs — общий, ничего нового туда добавлять не пришлось).
//    characteristic: { charKey, field:"total"|"bonus",
//                       op:"add"|"subtract"|"multiply"|"divideUp"|"divideDown",
//                       value }
//      → создаёт ActiveEffect ПРЯМО НА ЭТОМ ПРЕДМЕТЕ (не на акторе) в момент
//      получения — тем самым он корректно снимается, если предмет уберут с
//      актора (embedded-документ уходит вместе с предметом), и одинаково
//      работает независимо от пути получения (покупка/драг-н-дроп/скрипт).
//      Раньше кнопка «Конструктор» создавала такой ActiveEffect СРАЗУ, не
//      дожидаясь актора, — сознательно отказались: единая точка приложения
//      (получение предмета) проще для понимания и не даёт эффекту повиснуть
//      на непривязанном предмете, лежащем в списке предметов мира/папке.
//    trait / talent: как в старой системе Выдач — sourceUuid/sourceName/
//      sourceImg/sourceHasRating (драг-н-дроп) + rating (Черта) или
//      specialization (Талант).
//    skill: skillScope:"plain"|"group", skillKey, specKey/specialty, rank.
//    script: { label, code } — свободный JS, исполняется через
//      executeItemCode() из item-script.mjs (тот же контекст: item, actor,
//      token, speaker, game, ui, ChatMessage, event).
//    weight: { weightScope:"all"|"carry"|"lift"|"push",
//               weightMode:"kg"|"index", weightValue }
//      → тоже ActiveEffect НА ПРЕДМЕТЕ. "kg" бьёт по готовому результату
//      (system.encumbrance.<carry|lift|push>, final-фаза — они пересчиты-
//      ваются с нуля каждый цикл, как и характеристики). "index" бьёт по
//      ВХОДНОМУ полю (system.encumbrance.indexBonus.<all|carry|lift|push>,
//      initial-фаза — читается actor.mjs ДО расчёта, сдвигает индекс
//      S.b+T.b по таблице стр. 27 нелинейно, "all" сдвигает разом все три
//      категории через общую базу).
//    rollmod: skillScope/skillKey/specKey/specialty (как у skill, без
//      rank) + value (число) + label (имя модификатора) → не создаёт
//      ничего сам по себе, а ДОПИСЫВАЕТ запись в flags.warhammer-dbc.
//      rollMods предмета (тот же массив, что читает _itemRollModsHtml() в
//      actor-sheet.mjs) — галочка в диалоге броска нужного навыка.
//    poolMax: { value } → ActiveEffect на system.fate.max (final-фаза,
//      тоже полностью пересчитывается каждый цикл — безопасно). Это одно и
//      то же поле для «Очков Судьбы» (Империум) и «Очков Бесчестья»/Infamy
//      (Хаоситы) — см. module/apps/infamy-points.mjs: лист лишь ПОДПИСЫВАЕТ
//      это поле по-разному в зависимости от мировоззрения, значение общее.
//    wounds: { op:"add"|"subtract"|"multiply"|"divide", woundsValue }
//      → ОДНОРАЗОВАЯ ПЕРМАНЕНТНАЯ правка system.wounds.max (хранимое
//      состояние, как у corruption выше — та же схема формулы/отката,
//      woundsApplied={amount} вместо poolApplied). ×/÷ округляют вниз.
//    movement: { movementTarget:"spd"|"halfMove"|"move"|"charge"|"run",
//                op:"add"|"subtract", movementValue }
//      → ActiveEffect НА ПРЕДМЕТЕ, как characteristic/weight. "spd" бьёт по
//      ВХОДНОМУ полю system.movement.spdBonus (initial-фаза — читается
//      actor.mjs ДО расчёта Полудвижения/Движения/Натиска/Бега, поэтому
//      каскадно меняет все четыре, как и штатный бонус SPD от Черт); прямой
//      выбор halfMove/move/charge/run бьёт по готовому результату (final-
//      фаза, тот же приём, что carry/lift/push у kind:"weight").
//    terrainIgnore: { ignoreTerrainProps: string[] } — ключи свойств Трудного
//      Ландшафта (см. module/regions/difficult-terrain.mjs TERRAIN_PROPS),
//      которые актор игнорирует при тесте A+0 (Бег/Натиск через зону).
//      НЕ создаёт ActiveEffect и вообще ничего не пишет при получении —
//      это ЖИВОЙ запрос: пока предмет на акторе, ignoredTerrainKeysForActor()
//      (module/combat/movement-terrain.mjs) читает его Механику напрямую;
//      уйдёт предмет — сам перестанет учитываться, без отдельного отката.
//    equipment: { equipMode:"direct"|"choice", equipQty,
//                 // direct — конкретный предмет из дропдауна (кэш компендиумов
//                 // GRANTABLE_CATEGORIES, см. equipmentOptionsHtml/_equipIndex):
//                 equipSourceUuid, equipSourceName, equipSourceImg,
//                 // choice — категория + фильтры, живой Обозреватель компендиумов
//                 // (openCompendiumBrowser pickMode) открывается В МОМЕНТ выдачи:
//                 equipCategoryPack, equipWeaponType, equipWeaponProp,
//                 equipArmorType, equipMaxAvailability }
//      → создаёт embedded-копию выбранного (direct) либо выбранного игроком/ГМ'ом
//      в момент выдачи (choice, Dialog-промис как у showMechChoiceDialog) предмета
//      НА АКТОРЕ, system.quantity := equipQty (если поле есть у типа), тегирует
//      flags.warhammer-dbc.grantedByItem — общий deleteItem-откат подхватывает
//      его так же, как Черты/Таланты. Отмена диалога выбора (choice) — просто
//      ничего не выдаётся, без ошибки.
//    group: { } — ВЛОЖЕННАЯ подгруппа И/ИЛИ (поле entry.group = {id,operator,
//      entries:[...]}, та же форма, что и группа верхнего уровня). Даёт выбор
//      между НАБОРАМИ из нескольких записей сразу — напр. ИЛИ: [И: Болтер +
//      4 обоймы] / [И: Болт-пистолет + 4 обоймы] — а не между одиночными
//      предметами. Рекурсивно: подгруппа может содержать свои вложенные
//      подгруппы, максимум 5 уровней (верхняя группа = уровень 1); дропдаун
//      «Вид записи» перестаёт предлагать «Вложенная группа» на 5-м уровне.
//      Применяется той же логикой, что и группа верхнего уровня (applyGroupEntries) —
//      И применяет все записи подгруппы, ИЛИ показывает диалог выбора одной.
//    cohesion: { cohesionRole:"any"|"leader"|"commander"|"coordinator"|
//                "subordinate", op:"add"|"subtract"|"multiply"|"divide",
//                cohesionValue }
//      → ОДНОРАЗОВАЯ ПЕРМАНЕНТНАЯ правка НЕ у актора-владельца предмета, а у
//      ОТРЯДА (Actor type:"squad"), в котором состоит этот актор — бьёт по
//      system.cohesion.base (постоянная Слаженность, не бой-к-бою). Роль
//      проверяется по square.system.posts.{leader,commander,coordinator}
//      .uuid + system.members[].uuid (см. squadRoleOf()/findMemberSquad() —
//      экспортированы отсюда же). "any" — достаточно просто состоять в
//      отряде. ×/÷ округляют вниз.
//      Это НЕ разовое правило "получил — применили" — состав/посты отряда
//      меняются в любой момент, а условие "роль подходит" должно оставаться
//      живым, поэтому reconcileCohesionForActor() (экспорт) перепроверяет
//      ВСЕ cohesion-записи актора заново и вызывается: (1) отсюда же при
//      получении предмета, (2) из Hooks.on("updateActor", ...) в
//      warhammer-dbc.mjs при каждом изменении состава/постов отряда —
//      подходит теперь — применяет, перестал подходить/вышел — откатывает
//      (flags.warhammer-dbc.cohesionApplied={squadUuid,amount} на предмете).
//      Откат при УДАЛЕНИИ предмета — отдельно, в Hooks.on("deleteItem",...),
//      т.к. предмета уже не будет к моменту, когда reconcile мог бы его найти.
//
//  Идемпотентность: flags.warhammer-dbc.mechanicsApplied — один раз при
//  createItem (см. Hooks.on("createItem", ...) в warhammer-dbc.mjs).
//
//  «Бесплатность» (★ на вкладке «Развитие» листа актора) — см. подробности
//  в описании applyMechEntry(): Талант получает granted/purchased/cost,
//  Навык — grantedRank; у Черт такой механики в схеме нет вообще.
// ════════════════════════════════════════════════════════════════════════

import { SKILLS_DEF, GROUP_SKILLS_DEF }      from "../constants/skills.mjs";
import { SKILL_RANKS, CHARACTERISTICS }       from "../constants/characteristics.mjs";
import { specOptions, findGroupEntry }        from "../constants/skill-specializations.mjs";
import { executeItemCode }                    from "./item-script.mjs";
import { TERRAIN_PROPS }                      from "../regions/difficult-terrain.mjs";
import { openCompendiumBrowser, GRANTABLE_CATEGORIES, coreWeaponTypeFolders } from "./compendium-browser.mjs";
import { AVAILABILITY }                       from "../constants/items.mjs";
import { WEAPON_PROPERTIES }                  from "../constants/weapon-properties.mjs";
import { isItemActive }                       from "./effects.mjs";
import { RACES }                              from "../constants/races.mjs";
import { ELITE_ARCHETYPES }                   from "../constants/elite-archetypes.mjs";
import { WARP_GODS, WARP_GODS_MAP }           from "../constants/veil.mjs";

const FLAG = "warhammer-dbc";
const SKILL_RANK_STEPS = { untrained: 0, knows: 1, trained: 2, veteran: 3, expert: 4 };
const higherRank = (a, b) => (SKILL_RANK_STEPS[a] ?? 0) >= (SKILL_RANK_STEPS[b] ?? 0) ? a : b;
const OP_OPTIONS = [
  { value: "add",        label: "+ прибавить" },
  { value: "subtract",   label: "− вычесть" },
  { value: "multiply",   label: "× умножить" },
  { value: "divideUp",   label: "÷ разделить (вверх)" },
  { value: "divideDown", label: "÷ разделить (вниз)" }
];
const OP_SIGN = { add: "+", subtract: "−", multiply: "×", divide: "÷", divideUp: "÷↑", divideDown: "÷↓" };
const CORRUPTION_OP_OPTIONS = [
  { value: "add",      label: "+ добавить" },
  { value: "subtract", label: "− вычесть" }
];
const FOUR_OP_OPTIONS = [
  { value: "add",      label: "+ добавить" },
  { value: "subtract", label: "− вычесть" },
  { value: "multiply", label: "× умножить" },
  { value: "divide",   label: "÷ разделить" }
];
// Движение (kind:"movement") — цель бонуса/штрафа. "spd" — общая скорость,
// от которой считаются остальные три (см. комментарий в шапке файла и
// actor.mjs); остальные — существующие параметры движения напрямую.
const MOVEMENT_TARGETS = [
  { key: "spd",      label: "SPD — общая скорость (пересчитывает всё ниже)" },
  { key: "halfMove", label: "Полудвижение" },
  { key: "move",     label: "Движение" },
  { key: "charge",   label: "Натиск" },
  { key: "run",      label: "Бег" }
];
const MOVEMENT_TARGET_LABELS = Object.fromEntries(MOVEMENT_TARGETS.map(t => [t.key, t.label]));
const TERRAIN_PROP_LABELS = Object.fromEntries(TERRAIN_PROPS.map(p => [p.key, p.label]));

// Типы брони (kind:"equipment", режим «Выбор» → фильтр system.armorType) —
// зеркалит дропдаун «Тип» на вкладке Брони (templates/item/parts/armor.hbs);
// отдельного экспортируемого списка констант в проекте для них нет.
const ARMOR_TYPES = {
  simple: "Простая", flak: "Флак", mesh: "Ячеистая",
  carapace: "Панцирная", power: "Силовая", aspect: "Аспектная"
};
const COHESION_ROLE_OPTIONS = [
  { value: "any",         label: "Любая (быть в отряде)" },
  { value: "coordinator", label: "Координатор" },
  { value: "leader",      label: "Лидер" },
  { value: "commander",   label: "Командир" },
  { value: "subordinate", label: "Подчинённый" }
];
const KIND_LABELS = {
  corruption: "Порча", wounds: "Раны", cohesion: "Слаженность отряда",
  characteristic: "Характеристика", trait: "Черта", talent: "Талант", skill: "Навык",
  weight: "Вес", rollmod: "Модификатор броска", poolMax: "Очки Судьбы или Бесчестья",
  weaponProp: "Оружие: Свойство",
  movement: "Движение: Скорость", terrainIgnore: "Движение: Ландшафт (игнор)",
  fatigue: "Усталость",
  equipment: "Снаряжение",
  group: "Вложенная группа",
  script: "Код"
};
// Максимальная глубина вложенности подгрупп (kind:"group") — верхняя группа
// вкладки МЕХАНИКА уже уровень 1, поэтому подгрупп-в-подгруппах допускается 4.
const MAX_GROUP_DEPTH = 5;
const WEIGHT_SCOPE_LABELS = { all: "Общее", carry: "Ношение", lift: "Подъём", push: "Толкание" };
// «Усталость» (kind:"fatigue") — каскад «действие → уточнение». Действие пока
// одно; список оставлен на вырост, чтобы будущее («Снять уровень», «Порог
// потери сознания») не ломало уже сохранённые записи.
const FATIGUE_ACTIONS = [["threshold", "Порог штрафа"]];
const FATIGUE_THRESHOLD_CHARS = [["t", "Бонус Стойкости (T.b)"], ["wp", "Бонус Воли (WP.b)"]];
// Действия над Свойством оружия (kind:"weaponProp"). increase/decrease появляются
// в дропдауне только когда перетащенное свойство обладает рейтингом (см.
// buildEntryFieldsHtml) — рейтинговых свойств большинство, но не все.
const WEAPON_PROP_ACTIONS = [
  ["add", "Добавить свойство"], ["remove", "Убрать свойство"], ["replace", "Заменить свойство"]
];
const WEAPON_PROP_ACTIONS_RATED = [["increase", "Увеличить рейтинг"], ["decrease", "Уменьшить рейтинг"]];

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Текст специализации для превью skill/rollmod — учитывает specKey:"__choice__". */
function specChoiceLabel(entry) {
  if (entry.specKey === "__choice__") {
    const n = (entry.specChoiceKeys || []).length;
    return n ? `по выбору из ${n}` : "по выбору (не выбрано ни одной)";
  }
  return entry.specialty || "?";
}

/** Строка-формула ("5" или "2d10") → { total, roll, isDice }. Пустая/битая — 0. */
async function evalFormula(formula) {
  const f = String(formula ?? "0").trim();
  try {
    const roll = await new Roll(f || "0").evaluate();
    return { total: roll.total, roll, isDice: /d\s*\d/i.test(f) };
  } catch (e) {
    return { total: Number(f) || 0, roll: null, isDice: false };
  }
}

/** +/−/×/÷ поверх текущего значения; результат всегда округляется вниз. */
function applyFourOp(cur, op, amount) {
  let result;
  switch (op) {
    case "subtract": result = cur - amount; break;
    case "multiply": result = cur * amount; break;
    case "divide":   result = amount ? cur / amount : cur; break;
    default:         result = cur + amount; break; // "add" и незнакомые значения
  }
  return Math.floor(result);
}

/** Нормализованный список групп механики предмета (только чтение). */
export function getItemMechanics(item) {
  const arr = item.getFlag(FLAG, "mechanics");
  return Array.isArray(arr) ? arr : [];
}

/**
 * Рекурсивный поиск группы по id — ищет и среди верхнеуровневых групп, и
 * внутри вложенных подгрупп (entry.kind==="group" → entry.group), на любую
 * глубину. Id всегда уникальны (randomID()), поэтому неоднозначности нет.
 */
export function findMechGroup(groups, groupId) {
  for (const g of groups || []) {
    if (g.id === groupId) return g;
    for (const e of g.entries || []) {
      if (e.kind === "group" && e.group) {
        const found = findMechGroup([e.group], groupId);
        if (found) return found;
      }
    }
  }
  return null;
}

/** Рекурсивный поиск записи по (groupId, entryId) — см. findMechGroup(). */
export function findMechEntry(groups, groupId, entryId) {
  const g = findMechGroup(groups, groupId);
  return g ? (g.entries || []).find(e => e.id === entryId) || null : null;
}

// ── Кэш компендиумов «Снаряжения» — для дропдауна kind:"equipment" режима
// «Непосредственно предмет» (buildEntryFieldsHtml — синхронная сборка HTML,
// pack.getIndex() асинхронный, поэтому читаем заранее построенный кэш, тот
// же приём, что PACKS/CACHE в module/apps/origin-shared.mjs). ──────────────
let _equipIndex = null;   // { [pack]: [{uuid, name, img}] }

async function _refreshEquipmentIndex() {
  const out = {};
  for (const { pack: id } of GRANTABLE_CATEGORIES) {
    const pack = game.packs.get(`warhammer-dbc.${id}`);
    if (!pack) { out[id] = []; continue; }
    const index = await pack.getIndex();
    out[id] = index.contents
      .map(it => ({ uuid: `Compendium.warhammer-dbc.${id}.${it._id}`, name: it.name, img: it.img }))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }
  _equipIndex = out;
}

/** Кэш строится после готовности мира и обновляется при правках компендиумов снаряжения. */
export function initEquipmentIndex() {
  Hooks.once("ready", () => _refreshEquipmentIndex());
  const packIds = new Set(GRANTABLE_CATEGORIES.map(c => `warhammer-dbc.${c.pack}`));
  for (const h of ["createItem", "deleteItem", "updateItem"])
    Hooks.on(h, doc => { if (doc?.pack && packIds.has(doc.pack)) _refreshEquipmentIndex(); });
}

/** <optgroup> по категориям для дропдауна режима «Непосредственно предмет». */
function equipmentOptionsHtml(selectedUuid) {
  if (!_equipIndex) return `<option value="">— компендиумы ещё загружаются, переоткройте лист —</option>`;
  return GRANTABLE_CATEGORIES.map(({ pack, label }) => {
    const items = _equipIndex[pack] || [];
    if (!items.length) return "";
    const opts = items.map(it => optHtml(it.uuid, it.name, it.uuid === selectedUuid)).join("");
    return `<optgroup label="${esc(label)}">${opts}</optgroup>`;
  }).join("");
}

export function blankMechEntry(kind = "characteristic") {
  return {
    id: foundry.utils.randomID(), kind,
    // group — вложенная И/ИЛИ подгруппа (см. шапку файла), только у kind:"group".
    group: kind === "group" ? blankMechGroup("AND") : null,
    // corruption (op — общее поле с characteristic)
    corruptionValue: "1",
    // wounds (op — общее поле)
    woundsValue: "1",
    // cohesion (op — общее поле)
    cohesionRole: "any", cohesionValue: "1",
    // characteristic
    charKey: "s", field: "total", op: "add", value: 1,
    // trait/talent
    sourceUuid: "", sourceName: "", sourceImg: "", sourceHasRating: false, rating: "", specialization: "",
    // skill / rollmod — specKey:"__choice__" => specChoiceKeys (несколько
    // кандидатов, актор выбирает один при получении, см. resolveEntrySpecChoice).
    skillScope: "plain", skillKey: "", specKey: "", specialty: "", specChoiceKeys: [], rank: "untrained",
    // weight
    weightScope: "all", weightMode: "kg", weightValue: 1,
    // movement (op — общее поле)
    movementTarget: "spd", movementValue: 1,
    // terrainIgnore
    ignoreTerrainProps: [],
    // fatigue — каскад: действие → характеристика (см. шапку файла)
    fatigueAction: "threshold", fatigueThresholdChar: "t",
    // equipment
    equipMode: "direct", equipQty: 1,
    equipSourceUuid: "", equipSourceName: "", equipSourceImg: "",
    equipCategoryPack: "weapons", equipWeaponType: "", equipWeaponProp: "",
    equipArmorType: "", equipMaxAvailability: 5,
    // weaponProp — «Свойство» перетаскивается (weaponPropKey/Label/HasRating[2]),
    // «Новое свойство» — только при weaponPropAction:"replace".
    weaponPropAction: "add",
    weaponPropKey: "", weaponPropLabel: "", weaponPropHasRating: false, weaponPropHasRating2: false,
    weaponPropValue: "1", weaponPropValue2: "0",
    weaponPropNewKey: "", weaponPropNewLabel: "", weaponPropNewHasRating: false, weaponPropNewHasRating2: false,
    weaponPropNewValue: "1", weaponPropNewValue2: "0",
    // script / rollmod (label) / poolMax (value, shared with characteristic)
    label: "", code: ""
  };
}

export function blankMechGroup(operator = "AND") {
  return { id: foundry.utils.randomID(), operator, entries: [blankMechEntry()] };
}

/** Человекочитаемое описание записи — для превью на листе и диалога выбора ИЛИ. */
export function describeMechEntry(entry) {
  switch (entry.kind) {
    case "corruption": {
      if (entry.corruptionValue === "" || entry.corruptionValue == null) return "Порча: (не задано)";
      const sign = entry.op === "subtract" ? "−" : "+";
      return `Порча: ${sign}${entry.corruptionValue}`;
    }
    case "wounds": {
      if (entry.woundsValue === "" || entry.woundsValue == null) return "Раны: (не задано)";
      const sign = OP_SIGN[entry.op] ?? entry.op;
      return `Раны (максимум): ${sign} ${entry.woundsValue}`;
    }
    case "cohesion": {
      const roleLabel = COHESION_ROLE_OPTIONS.find(r => r.value === entry.cohesionRole)?.label ?? entry.cohesionRole;
      if (entry.cohesionValue === "" || entry.cohesionValue == null) return `Слаженность отряда (${roleLabel}): (не задано)`;
      const sign = OP_SIGN[entry.op] ?? entry.op;
      return `Слаженность отряда (${roleLabel}): ${sign} ${entry.cohesionValue}`;
    }
    case "characteristic": {
      if (!entry.charKey) return "Характеристика: (не выбрана)";
      const abbr = CHARACTERISTICS[entry.charKey]?.abbr ?? entry.charKey;
      const fieldLabel = entry.field === "bonus" ? "бонус" : "значение";
      const sign = OP_SIGN[entry.op] ?? entry.op;
      return `Характеристика: ${abbr} — ${fieldLabel} ${sign} ${entry.value ?? ""}`;
    }
    case "trait": {
      if (!entry.sourceUuid) return "Черта: (перетащите предмет)";
      const rating = entry.rating !== "" && entry.rating != null ? ` (рейтинг ${entry.rating})` : "";
      return `Черта: ${entry.sourceName || "?"}${rating}`;
    }
    case "talent": {
      if (!entry.sourceUuid) return "Талант: (перетащите предмет)";
      const spec = entry.specialization ? ` (${entry.specialization})` : "";
      return `Талант: ${entry.sourceName || "?"}${spec}`;
    }
    case "skill": {
      if (!entry.skillKey) return "Навык: (не выбран)";
      const def = entry.skillScope === "group" ? GROUP_SKILLS_DEF[entry.skillKey] : SKILLS_DEF[entry.skillKey];
      const label = def?.label || entry.skillKey;
      const spec = entry.skillScope === "group" ? ` (${specChoiceLabel(entry)})` : "";
      const rankLabel = SKILL_RANKS[entry.rank]?.label || entry.rank;
      return `Навык: ${label}${spec} — ${rankLabel}`;
    }
    case "weight": {
      const scopeLabel = WEIGHT_SCOPE_LABELS[entry.weightScope] ?? entry.weightScope;
      if (entry.weightValue === "" || entry.weightValue == null) return `Вес: ${scopeLabel} (не задано)`;
      const sign = Number(entry.weightValue) >= 0 ? "+" : "";
      const unit = entry.weightMode === "index" ? "к индексу S.b+T.b" : "кг";
      return `Вес: ${scopeLabel} ${sign}${entry.weightValue} ${unit}`;
    }
    case "movement": {
      const label = MOVEMENT_TARGET_LABELS[entry.movementTarget] ?? entry.movementTarget;
      if (entry.movementValue === "" || entry.movementValue == null) return `Движение: ${label} (не задано)`;
      const sign = entry.op === "subtract" ? "−" : "+";
      return `Движение: ${label} ${sign}${entry.movementValue}`;
    }
    case "terrainIgnore": {
      if (!entry.ignoreTerrainProps?.length) return "Ландшафт: игнорировать (не выбрано)";
      const labels = entry.ignoreTerrainProps.map(k => TERRAIN_PROP_LABELS[k] || k);
      return `Ландшафт: игнорирует — ${labels.join(", ")}`;
    }
    case "fatigue": {
      if (entry.fatigueAction !== "threshold") return "Усталость: (действие не выбрано)";
      const charLabel = entry.fatigueThresholdChar === "wp" ? "Воли" : "Стойкости";
      return `Усталость: штраф начинается с Бонуса ${charLabel} (вместо 1)`;
    }
    case "equipment": {
      const qty = Math.max(1, parseInt(entry.equipQty) || 1);
      if (entry.equipMode === "choice") {
        const cat = GRANTABLE_CATEGORIES.find(c => c.pack === entry.equipCategoryPack)?.label ?? entry.equipCategoryPack;
        const bits = [];
        if (entry.equipCategoryPack === "weapons" && entry.equipWeaponType)
          bits.push(coreWeaponTypeFolders().find(f => f.id === entry.equipWeaponType)?.name);
        if (entry.equipCategoryPack === "weapons" && entry.equipWeaponProp) bits.push(WEAPON_PROPERTIES[entry.equipWeaponProp]?.label);
        if (entry.equipCategoryPack === "armor" && entry.equipArmorType) bits.push(ARMOR_TYPES[entry.equipArmorType]);
        const filt = bits.length ? ` (${bits.join(", ")})` : "";
        const r = Number(entry.equipMaxAvailability);
        const avail = Number.isFinite(r) && r < 5 ? `, R ≤ ${r >= 0 ? "+" : ""}${r}` : "";
        return `Снаряжение: выбор — «${cat}»${filt}${avail} ×${qty}`;
      }
      if (!entry.equipSourceUuid) return "Снаряжение: (выберите предмет)";
      return `Снаряжение: ${entry.equipSourceName || "?"} ×${qty}`;
    }
    case "rollmod": {
      if (!entry.skillKey) return "Модификатор броска: (не выбран навык)";
      const def = entry.skillScope === "group" ? GROUP_SKILLS_DEF[entry.skillKey] : SKILLS_DEF[entry.skillKey];
      const label = def?.label || entry.skillKey;
      const spec = entry.skillScope === "group" ? ` (${entry.specKey ? specChoiceLabel(entry) : "любая специализация"})` : "";
      const sign = Number(entry.value) >= 0 ? "+" : "";
      const name = entry.label ? `«${entry.label}» ` : "";
      return `Модификатор броска: ${name}${label}${spec} ${sign}${entry.value ?? ""}`;
    }
    case "poolMax": {
      if (entry.value === "" || entry.value == null) return "Очки Судьбы или Бесчестья: (не задано)";
      const sign = Number(entry.value) >= 0 ? "+" : "";
      return `Очки Судьбы или Бесчестья: ${sign}${entry.value} (максимум)`;
    }
    case "weaponProp": {
      if (!entry.weaponPropKey) return "Оружие: Свойство (перетащите свойство)";
      const action = entry.weaponPropAction || "add";
      if (action === "replace") {
        if (!entry.weaponPropNewKey) return `Оружие: заменить «${entry.weaponPropLabel}» на… (перетащите новое)`;
        const rating = entry.weaponPropNewHasRating ? ` (${entry.weaponPropNewValue ?? "?"})` : "";
        return `Оружие: заменить «${entry.weaponPropLabel}» → «${entry.weaponPropNewLabel}»${rating}`;
      }
      if (action === "increase" || action === "decrease") {
        const sign = action === "increase" ? "+" : "−";
        return `Оружие: «${entry.weaponPropLabel}» рейтинг ${sign}${entry.weaponPropValue ?? "?"}`;
      }
      if (action === "remove") return `Оружие: убрать «${entry.weaponPropLabel}»`;
      const rating = entry.weaponPropHasRating ? ` (${entry.weaponPropValue ?? "?"})` : "";
      return `Оружие: добавить «${entry.weaponPropLabel}»${rating}`;
    }
    case "script":
      return entry.label ? `Код: ${entry.label}` : (entry.code?.trim() ? "Код (без названия)" : "Код: (пусто)");
    case "group": {
      const g = entry.group;
      const entries = g?.entries || [];
      if (!entries.length) return "Вложенная группа: (пусто)";
      const opLabel = g.operator === "OR" ? "ИЛИ" : "И";
      const parts = entries.map(describeMechEntry);
      return `${opLabel}: ${parts.join(g.operator === "OR" ? " / " : ", ")}`;
    }
    default:
      return "?";
  }
}

/** Специализация группового навыка задана: конкретная/своя, либо «по выбору» хотя бы с одним кандидатом. */
function groupSpecOk(e) {
  if (e.specKey === "__choice__") return (e.specChoiceKeys || []).length > 0;
  return !!e.specKey || !!e.specialty;
}

function isEntryComplete(e) {
  const numOk = v => v !== "" && v != null && !Number.isNaN(Number(v));
  switch (e.kind) {
    case "corruption":
      return !!(e.corruptionValue && String(e.corruptionValue).trim());
    case "wounds":
      return !!(e.woundsValue && String(e.woundsValue).trim());
    case "cohesion":
      return !!e.cohesionRole && !!(e.cohesionValue && String(e.cohesionValue).trim());
    case "characteristic":
      return !!e.charKey && numOk(e.value);
    case "trait": case "talent":
      return !!e.sourceUuid;
    case "skill":
      if (!e.skillKey) return false;
      if (e.skillScope === "group" && !groupSpecOk(e)) return false;
      return true;
    case "weight":
      return !!e.weightScope && numOk(e.weightValue);
    case "movement":
      return !!e.movementTarget && numOk(e.movementValue);
    case "terrainIgnore":
      return Array.isArray(e.ignoreTerrainProps) && e.ignoreTerrainProps.length > 0;
    case "fatigue":
      return e.fatigueAction === "threshold" && !!e.fatigueThresholdChar;
    case "equipment":
      if (!numOk(e.equipQty) || Number(e.equipQty) <= 0) return false;
      return e.equipMode === "choice" ? !!e.equipCategoryPack : !!e.equipSourceUuid;
    case "rollmod":
      if (!e.skillKey) return false;
      if (e.skillScope === "group" && !groupSpecOk(e)) return false;
      return numOk(e.value);
    case "poolMax":
      return numOk(e.value);
    case "weaponProp":
      if (!e.weaponPropKey) return false;
      if (e.weaponPropAction === "replace") return !!e.weaponPropNewKey;
      return true;
    case "script":
      return !!(e.code && e.code.trim());
    case "group":
      return !!(e.group?.entries || []).some(isEntryComplete);
    default:
      return false;
  }
}

/**
 * Находит исходный документ Черты/Таланта по сохранённому UUID; если он
 * недоступен (напр. UUID указывал на embedded-предмет конкретного актора,
 * которого с тех пор удалили/переименовали) — тот же приём отказоустойчивости,
 * что и у buildTraits()/buildTalents() в module/apps/homeworlds.mjs: ищем по
 * имени в соответствующей библиотеке (warhammer-dbc.traits/.talents).
 */
async function resolveMechSource(entry) {
  if (entry.sourceUuid) {
    const doc = await fromUuid(entry.sourceUuid).catch(() => null);
    if (doc) return doc;
  }
  if (!entry.sourceName) return null;
  const packId = entry.kind === "trait" ? "warhammer-dbc.traits" : "warhammer-dbc.talents";
  const pack = game.packs.get(packId);
  if (!pack) return null;
  const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const index = await pack.getIndex();
  const hit = index.find(e => norm(e.name) === norm(entry.sourceName)
    || norm(e.name.split("/")[0]) === norm(entry.sourceName.split("/")[0]));
  return hit ? pack.getDocument(hit._id) : null;
}

// ── Слаженность отряда (kind:"cohesion") ─────────────────────────────────

/** Роль актора в КОНКРЕТНОМ отряде: пост важнее простого членства. null — не состоит вовсе. */
function squadRoleOf(squad, actorUuid) {
  if (!squad || !actorUuid) return null;
  const posts = squad.system?.posts || {};
  if (posts.leader?.uuid === actorUuid)      return "leader";
  if (posts.commander?.uuid === actorUuid)   return "commander";
  if (posts.coordinator?.uuid === actorUuid) return "coordinator";
  const inMembers = (squad.system?.members || []).some(m => m.uuid === actorUuid);
  return inMembers ? "subordinate" : null;
}

/** Отряд, в котором состоит актор (первый найденный — обычно он один). */
function findMemberSquad(actorUuid) {
  if (!actorUuid) return null;
  return game.actors.find(a => a.type === "squad" && squadRoleOf(a, actorUuid) !== null) || null;
}

function cohesionRoleMatches(entryRole, actualRole) {
  if (!actualRole) return false;
  return entryRole === "any" || entryRole === actualRole;
}

/**
 * Пересматривает ВСЕ записи kind:"cohesion" на предметах актора против его
 * ТЕКУЩЕГО членства/поста в отряде — применяет то, что теперь подходит,
 * откатывает то, что перестало (сменился отряд/пост/вышел). Идемпотентно:
 * сверяется с уже применённым flags.warhammer-dbc.cohesionApplied=
 * {squadUuid,amount} на каждом предмете. Вызывается и отсюда (получение
 * предмета), и из Hooks.on("updateActor", ...) в warhammer-dbc.mjs при
 * любом изменении состава/постов ЛЮБОГО отряда — единая точка правды,
 * не разрозненные join/leave-обработчики.
 */
export async function reconcileCohesionForActor(actor) {
  if (!actor || !(actor instanceof Actor)) return;
  const squad = findMemberSquad(actor.uuid);
  const role  = squad ? squadRoleOf(squad, actor.uuid) : null;

  for (const item of actor.items) {
    const entry = getItemMechanics(item)
      .flatMap(g => g.entries || [])
      .find(e => e.kind === "cohesion" && isEntryComplete(e));
    if (!entry) continue;

    const applied     = item.getFlag(FLAG, "cohesionApplied");
    const shouldApply = !!squad && cohesionRoleMatches(entry.cohesionRole, role);
    if (shouldApply && applied?.squadUuid === squad.uuid) continue; // уже верно приложено

    if (applied?.squadUuid && applied.amount) {
      const oldSquad = await fromUuid(applied.squadUuid).catch(() => null);
      if (oldSquad) {
        const cur = Number(oldSquad.system.cohesion?.base) || 0;
        await oldSquad.update({ "system.cohesion.base": cur - applied.amount });
      }
      await item.unsetFlag(FLAG, "cohesionApplied");
    }
    if (!shouldApply) continue;

    const { total } = await evalFormula(entry.cohesionValue);
    const curBase = Number(squad.system.cohesion?.base) || 0;
    const newBase = applyFourOp(curBase, entry.op, total);
    await squad.update({ "system.cohesion.base": newBase });
    await item.setFlag(FLAG, "cohesionApplied", { squadUuid: squad.uuid, amount: newBase - curBase });
  }
}

/** Диалог выбора ОДНОЙ специализации из нескольких кандидатов («по выбору»). */
function showSpecChoiceDialog(skillLabel, choices) {
  return new Promise(resolve => {
    let resolved = false;
    const rows = choices.map((c, i) => `<label class="grant-choice-row">
      <input type="radio" name="spec-choice" value="${i}" ${i === 0 ? "checked" : ""}/>
      <span>${esc(c.display)}</span></label>`).join("");
    new Dialog({
      title: `Выбор специализации — ${skillLabel}`,
      content: `<div class="wh-grant-choice"><p>Выберите специализацию:</p>${rows}</div>`,
      buttons: {
        pick: {
          icon: '<i class="fas fa-check"></i>', label: "Применить",
          callback: html => {
            if (resolved) return;
            resolved = true;
            const idx = parseInt(html.find('input[name="spec-choice"]:checked').val());
            resolve(choices[idx] ?? null);
          }
        },
        skip: { label: "Пропустить", callback: () => { if (!resolved) { resolved = true; resolve(null); } } }
      },
      default: "pick",
      close: () => { if (!resolved) { resolved = true; resolve(null); } }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo"], width: 380 }).render(true);
  });
}

/**
 * Если у записи skill/rollmod specKey:"__choice__" — просит актора выбрать ОДНУ
 * специализацию из отмеченных GM'ом кандидатов (specChoiceKeys) и возвращает
 * КОПИЮ записи с уже подставленными specKey/specialty; иначе — запись как есть.
 * Пропуск диалога (Пропустить/закрыть) → null, вызывающий код не применяет запись.
 */
async function resolveEntrySpecChoice(entry) {
  if (entry.specKey !== "__choice__") return entry;
  const def = GROUP_SKILLS_DEF[entry.skillKey];
  const keys = new Set(entry.specChoiceKeys || []);
  const choices = specOptions(entry.skillKey).filter(c => keys.has(c.key));
  if (!choices.length) return null;
  const chosen = await showSpecChoiceDialog(def?.label || entry.skillKey, choices);
  if (!chosen) return null;
  return { ...entry, specKey: chosen.key, specialty: chosen.display };
}

/** Применяет одну запись механики: создаёт ActiveEffect/предмет, правит навык, либо исполняет код. */
async function applyMechEntry(actor, entry, sourceItem) {
  if (entry.kind === "skill" || entry.kind === "rollmod") {
    const resolved = await resolveEntrySpecChoice(entry);
    if (!resolved) return;
    entry = resolved;
  }

  if (entry.kind === "corruption") {
    const formula = String(entry.corruptionValue || "0").trim();
    let total = 0, roll = null;
    try {
      roll = await new Roll(formula).evaluate();
      total = roll.total;
    } catch (e) {
      total = Number(formula) || 0;
    }
    const signed = entry.op === "subtract" ? -total : total;
    const cur = Number(actor.system.corruption?.value) || 0;
    await actor.update({ "system.corruption.value": Math.max(0, cur + signed) });
    // {pool, amount} — тот же формат, что раньше писали скрипт-шаблоны «± Очки
    // пула»: общий откат в Hooks.on("deleteItem", ...) читает его сам, без
    // отдельной логики для kind:"corruption".
    await sourceItem.setFlag(FLAG, "poolApplied", { pool: "corruption", amount: signed });
    // Бросок XdY — в чат, для прозрачности (флэт-число просто применяется тихо).
    if (roll && /d\s*\d/i.test(formula)) {
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: `${sourceItem.name}: Порча ${signed >= 0 ? "+" : ""}${signed}`
      });
    }
    return;
  }

  if (entry.kind === "wounds") {
    const { total, roll, isDice } = await evalFormula(entry.woundsValue);
    const cur = Number(actor.system.wounds?.max) || 0;
    const newMax = applyFourOp(cur, entry.op, total);
    await actor.update({ "system.wounds.max": Math.max(0, newMax) });
    // {amount} — как у poolApplied/charValueApplied, откат в Hooks.on("deleteItem",...).
    await sourceItem.setFlag(FLAG, "woundsApplied", { amount: newMax - cur });
    if (roll && isDice) {
      await roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor }),
        flavor: `${sourceItem.name}: Раны (максимум) ${newMax - cur >= 0 ? "+" : ""}${newMax - cur}`
      });
    }
    return;
  }

  if (entry.kind === "cohesion") {
    // Вся логика (поиск отряда, роль, откат/применение) — в reconcileCohesionForActor(),
    // она же вызывается при каждом изменении состава/постов отряда.
    await reconcileCohesionForActor(actor);
    return;
  }

  if (entry.kind === "group") {
    // Вложенная подгруппа — та же логика И/ИЛИ, что и у группы верхнего
    // уровня (applyGroupEntries), рекурсивно на любую глубину.
    await applyGroupEntries(actor, entry.group, sourceItem);
    return;
  }

  if (entry.kind === "characteristic") {
    const key = `system.characteristics.${entry.charKey}.${entry.field}`;
    await sourceItem.createEmbeddedDocuments("ActiveEffect", [{
      name: describeMechEntry(entry), img: sourceItem.img,
      system: { changes: [{ key, type: entry.op, value: Number(entry.value) || 0, phase: "final", priority: 0 }] }
    }]);
    return;
  }

  if (entry.kind === "script") {
    await executeItemCode(sourceItem, entry.code, null);
    return;
  }

  if (entry.kind === "weight") {
    const value = Number(entry.weightValue) || 0;
    let key;
    if (entry.weightMode === "index") {
      key = `system.encumbrance.indexBonus.${entry.weightScope}`;
      // initial-фаза: должно быть на месте ДО пересчёта в actor.mjs (сдвигает
      // входной индекс, а не готовый результат) — см. комментарий в шапке файла.
      await sourceItem.createEmbeddedDocuments("ActiveEffect", [{
        name: describeMechEntry(entry), img: sourceItem.img,
        system: { changes: [{ key, type: "add", value, phase: "initial", priority: 0 }] }
      }]);
    } else {
      const targets = entry.weightScope === "all" ? ["carry", "lift", "push"] : [entry.weightScope];
      const changes = targets.map(t => ({ key: `system.encumbrance.${t}`, type: "add", value, phase: "final", priority: 0 }));
      await sourceItem.createEmbeddedDocuments("ActiveEffect", [{
        name: describeMechEntry(entry), img: sourceItem.img, system: { changes }
      }]);
    }
    return;
  }

  if (entry.kind === "movement") {
    const isSpd = entry.movementTarget === "spd";
    const key   = isSpd ? "system.movement.spdBonus" : `system.movement.${entry.movementTarget}`;
    await sourceItem.createEmbeddedDocuments("ActiveEffect", [{
      name: describeMechEntry(entry), img: sourceItem.img,
      system: { changes: [{ key, type: entry.op, value: Number(entry.movementValue) || 0,
        phase: isSpd ? "initial" : "final", priority: 0 }] }
    }]);
    return;
  }

  if (entry.kind === "terrainIgnore") {
    // Ничего не пишем и не создаём — см. комментарий в шапке файла:
    // ignoredTerrainKeysForActor() читает Механику предмета напрямую, живьём.
    return;
  }

  if (entry.kind === "fatigue") {
    // Тоже живой запрос: fatigueGraceForActor() (rules/fatigue-grace.mjs)
    // читает Механику в момент теста, писать и откатывать нечего.
    return;
  }

  if (entry.kind === "equipment") {
    let uuid = entry.equipSourceUuid;
    if (entry.equipMode === "choice") {
      // Живой выбор в момент выдачи — Обозреватель компендиумов, сужен фильтрами
      // категории/типа/свойства/типа брони/макс. Редкости (см. compendium-browser.mjs
      // pickMode). Отмена (null) — просто ничего не выдаём, без ошибки.
      uuid = await openCompendiumBrowser(false, {
        pack: entry.equipCategoryPack,
        weaponFolderId: entry.equipCategoryPack === "weapons" ? (entry.equipWeaponType || null) : null,
        weaponProp:  entry.equipCategoryPack === "weapons" ? (entry.equipWeaponProp  || null) : null,
        armorType:   entry.equipCategoryPack === "armor"   ? (entry.equipArmorType   || null) : null,
        maxAvailability: Number.isFinite(Number(entry.equipMaxAvailability)) ? Number(entry.equipMaxAvailability) : null
      });
      if (!uuid) return;
    }
    const src = uuid ? await fromUuid(uuid).catch(() => null) : null;
    const data = src ? src.toObject() : {
      name: entry.equipSourceName || "?", type: "gear",
      img: entry.equipSourceImg || "icons/svg/item-bag.svg", system: {}
    };
    delete data._id;
    const qty = Math.max(1, parseInt(entry.equipQty) || 1);
    if ("quantity" in (data.system || {})) data.system.quantity = qty;
    // equipEntryId — какая именно запись Механики это выдала; читает
    // syncGrantedEquipment ниже, чтобы не плодить дубли и опознавать «своё»
    // при пересинхронизации по активности источника (импланты — installed/disabled).
    data.flags = { ...(data.flags || {}), [FLAG]: { ...(data.flags?.[FLAG] || {}), grantedByItem: sourceItem.id, equipEntryId: entry.id } };
    await actor.createEmbeddedDocuments("Item", [data]);
    return;
  }

  if (entry.kind === "rollmod") {
    const when = { kind: "skill" };
    if (entry.skillScope === "group") {
      when.group = entry.skillKey;
      if (entry.specKey || entry.specialty) when.specialty = entry.specialty || entry.specKey;
    } else {
      when.skill = entry.skillKey;
    }
    const cur = foundry.utils.deepClone(sourceItem.getFlag(FLAG, "rollMods") || []);
    cur.push({ when, value: Number(entry.value) || 0, label: entry.label || describeMechEntry(entry) });
    await sourceItem.setFlag(FLAG, "rollMods", cur);
    return;
  }

  if (entry.kind === "poolMax") {
    await sourceItem.createEmbeddedDocuments("ActiveEffect", [{
      name: describeMechEntry(entry), img: sourceItem.img,
      system: { changes: [{ key: "system.fate.max", type: "add", value: Number(entry.value) || 0, phase: "final", priority: 0 }] }
    }]);
    return;
  }

  if (entry.kind === "trait" || entry.kind === "talent") {
    const src = await resolveMechSource(entry);
    const data = src ? src.toObject() : {
      name: entry.sourceName || "?", type: entry.kind,
      img: entry.sourceImg || "icons/svg/aura.svg", system: {}
    };
    delete data._id;
    if (entry.kind === "trait") {
      if (entry.rating !== "" && entry.rating != null && data.system) {
        data.system.hasRating = true;
        data.system.rating = Number(entry.rating) || 0;
      }
    } else {
      data.system = {
        ...(data.system || {}),
        specialization: entry.specialization || data.system?.specialization || "",
        granted: true, purchased: false, cost: 0
      };
    }
    data.flags = { ...(data.flags || {}), [FLAG]: { ...(data.flags?.[FLAG] || {}), grantedByItem: sourceItem.id } };
    await actor.createEmbeddedDocuments("Item", [data]);
    return;
  }

  if (entry.kind !== "skill") return;

  if (entry.skillScope === "group") {
    const arr = foundry.utils.deepClone(actor.system.groupSkills?.[entry.skillKey] || []);
    const found = findGroupEntry(actor, entry.skillKey, entry.specKey || entry.specialty);
    const idx = found ? arr.findIndex(e =>
      (found.specKey && e.specKey === found.specKey) || (!found.specKey && e.specialty === found.specialty)) : -1;
    if (idx >= 0) {
      arr[idx].rank        = higherRank(arr[idx].rank || "untrained", entry.rank);
      arr[idx].grantedRank = higherRank(arr[idx].grantedRank || "untrained", entry.rank);
    } else {
      arr.push({
        specialty: entry.specialty || entry.specKey || "?",
        ...(entry.specKey ? { specKey: entry.specKey } : {}),
        rank: entry.rank, grantedRank: entry.rank, cost: 0
      });
    }
    await actor.update({ [`system.groupSkills.${entry.skillKey}`]: arr });
  } else {
    const cur = actor.system.skills?.[entry.skillKey] || {};
    const newRank    = higherRank(cur.rank || "untrained", entry.rank);
    const newGranted = higherRank(cur.grantedRank || "untrained", entry.rank);
    const upd = {
      [`system.skills.${entry.skillKey}.rank`]: newRank,
      [`system.skills.${entry.skillKey}.grantedRank`]: newGranted
    };
    // См. комментарий в history: точный пересчёт .cost требует skillCumCost()
    // (приватный замыкающий метод actor-sheet.mjs, завязан на Склонности и
    // культуру конкретного актора) — недоступен отсюда. Гарантированно верно,
    // когда выдаваемый ранг покрывает текущий целиком (стандартный случай —
    // навык «с нуля»): тогда цена точно 0. Если ранг уже был натренирован
    // выше выдаваемого — cost осознанно не трогаем, GM пересчитает вручную
    // кнопкой ★ на «Развитии».
    if (SKILL_RANK_STEPS[newGranted] >= SKILL_RANK_STEPS[newRank]) {
      upd[`system.skills.${entry.skillKey}.cost`] = 0;
    }
    await actor.update(upd);
  }
}

/** Диалог выбора одной записи из ИЛИ-группы при получении предмета. */
function showMechChoiceDialog(item, entries) {
  return new Promise(resolve => {
    let resolved = false;
    const rows = entries.map((e, i) => `<label class="grant-choice-row">
      <input type="radio" name="mech-choice" value="${i}" ${i === 0 ? "checked" : ""}/>
      <span>${esc(describeMechEntry(e))}</span></label>`).join("");
    new Dialog({
      title: `Выбор — ${item.name}`,
      content: `<div class="wh-grant-choice">
        <p>Предмет «${esc(item.name)}» предлагает один из вариантов на выбор:</p>${rows}</div>`,
      buttons: {
        pick: {
          icon: '<i class="fas fa-check"></i>', label: "Применить",
          callback: html => {
            if (resolved) return;
            resolved = true;
            const idx = parseInt(html.find('input[name="mech-choice"]:checked').val());
            resolve(entries[idx] ?? null);
          }
        },
        skip: { label: "Пропустить", callback: () => { if (!resolved) { resolved = true; resolve(null); } } }
      },
      default: "pick",
      close: () => { if (!resolved) { resolved = true; resolve(null); } }
    }, { classes: ["dialog", "warhammer-dbc", "wh-holo"], width: 420 }).render(true);
  });
}

/**
 * kind:"weaponProp" — не разовая правка «получил предмет → применили», а живая
 * конфигурация модификации оружия: пересчитывает system.effects.mechAddProps/
 * mechRemoveProps ЦЕЛИКОМ из ВСЕХ завершённых записей weaponProp на предмете
 * при КАЖДОМ изменении (не только при createItem, как остальные виды) — иначе
 * правки на уже лежащей на акторе модификации (обычный сценарий: weaponMod
 * создаётся на месте и настраивается, а не «выдаётся» готовым из библиотеки)
 * не подхватывались бы. Отдельные поля mechAddProps/mechRemoveProps (не
 * addProps/removeProps) — чтобы не задевать ручной раздел «Даруемые свойства»
 * на листе модификации; getModEffects (combat/weapon-mods.mjs) сливает оба
 * источника при броске. Идемпотентно — пишет, только если результат отличается.
 */
export async function syncWeaponPropItemEffects(item) {
  const groups = getItemMechanics(item);
  const entries = groups.flatMap(g => g.entries || []).filter(e => e.kind === "weaponProp" && isEntryComplete(e));
  const addProps = [], removeProps = [];
  for (const e of entries) {
    const action = e.weaponPropAction || "add";
    if (action === "remove" || action === "replace") removeProps.push(e.weaponPropKey);
    if (action === "add") {
      addProps.push({ key: e.weaponPropKey, rating: Number(e.weaponPropValue) || 0, rating2: Number(e.weaponPropValue2) || 0 });
    } else if (action === "replace") {
      addProps.push({ key: e.weaponPropNewKey, rating: Number(e.weaponPropNewValue) || 0, rating2: Number(e.weaponPropNewValue2) || 0 });
    } else if (action === "increase") {
      addProps.push({ key: e.weaponPropKey, ratingDelta: Number(e.weaponPropValue) || 0 });
    } else if (action === "decrease") {
      addProps.push({ key: e.weaponPropKey, ratingDelta: -(Number(e.weaponPropValue) || 0) });
    }
  }
  const cur = item.system.effects || {};
  const same = JSON.stringify(cur.mechAddProps ?? []) === JSON.stringify(addProps)
            && JSON.stringify(cur.mechRemoveProps ?? []) === JSON.stringify(removeProps);
  if (same) return;
  await item.update({ "system.effects.mechAddProps": addProps, "system.effects.mechRemoveProps": removeProps });
}

// Записи kind:"equipment" (equipMode:"direct" — фиксированный предмет, не
// «выбор») из АНД-цепочек: верхнеуровневая группа + вложенные АНД-подгруппы.
// ИЛИ-ветки сознательно пропускаются — там выбор делается ОДИН РАЗ диалогом
// в момент выдачи (showMechChoiceDialog/applyMechEntry), переигрывать его
// при каждой пересинхронизации активности источника не нужно и не должно.
function collectDirectEquipmentEntries(groups) {
  const out = [];
  const walk = (entries, operator) => {
    if (operator === "OR") return;
    for (const e of entries) {
      if (e.kind === "equipment" && e.equipMode !== "choice" && isEntryComplete(e)) out.push(e);
      else if (e.kind === "group" && e.group) walk(e.group.entries || [], e.group.operator);
    }
  };
  for (const g of groups) walk(g.entries || [], g.operator);
  return out;
}

/**
 * Живая пересинхронизация записей kind:"equipment" (снаряжение/оружие,
 * которое Черта/Талант/Имплант ВЫДАЁТ предметом на актора) с активностью
 * источника — см. isItemActive() в module/apps/effects.mjs. У большинства
 * типов (Черта/Талант) источник активен всегда, пока он на акторе — там это
 * не меняет уже существующее поведение (выдано один раз при createItem,
 * остаётся навсегда). А вот у Импланта есть собственное состояние —
 * хирургически установлен/снят, исправен/неисправен (installed/disabled) —
 * и выданное им оружие (напр. Кислотный плевок Железы Бетчера) должно
 * появляться и исчезать вместе с этим состоянием, а не жить вечно после
 * однократной выдачи. Вызывается и из applyItemMechanics (первая выдача —
 * если источник родился неактивным, тут же откатит лишнее), и из мест,
 * переключающих installed/disabled (surgeon.mjs, .geneseed-state-select
 * в actor-sheet.mjs) — тот же приём, что syncItemEffectsDisabled для
 * ActiveEffect-грантов (характеристики и т.п.), но для embedded-предметов.
 */
export async function syncGrantedEquipment(sourceItem) {
  const actor = sourceItem.parent;
  if (!(actor instanceof Actor)) return;
  const entries = collectDirectEquipmentEntries(getItemMechanics(sourceItem));
  if (!entries.length) return;

  const grantedNow = actor.items.filter(i =>
    i.getFlag(FLAG, "grantedByItem") === sourceItem.id && i.getFlag(FLAG, "equipEntryId"));

  if (!isItemActive(sourceItem)) {
    if (grantedNow.length) await actor.deleteEmbeddedDocuments("Item", grantedNow.map(i => i.id));
    return;
  }

  const haveIds = new Set(grantedNow.map(i => i.getFlag(FLAG, "equipEntryId")));
  const toCreate = [];
  for (const e of entries) {
    if (haveIds.has(e.id)) continue;
    const src = e.equipSourceUuid ? await fromUuid(e.equipSourceUuid).catch(() => null) : null;
    const data = src ? src.toObject() : {
      name: e.equipSourceName || "?", type: "gear",
      img: e.equipSourceImg || "icons/svg/item-bag.svg", system: {}
    };
    delete data._id;
    const qty = Math.max(1, parseInt(e.equipQty) || 1);
    if ("quantity" in (data.system || {})) data.system.quantity = qty;
    data.flags = { ...(data.flags || {}), [FLAG]: { ...(data.flags?.[FLAG] || {}), grantedByItem: sourceItem.id, equipEntryId: e.id } };
    toCreate.push(data);
  }
  if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
}

/**
 * Применяет ОДНУ группу (И — все записи, ИЛИ с >1 завершённой записью —
 * диалог выбора одной) — общая для верхнеуровневых групп И ВЛОЖЕННЫХ
 * подгрупп (kind:"group"), рекурсия идёт через applyMechEntry ⇄ здесь.
 */
async function applyGroupEntries(actor, group, sourceItem) {
  const entries = (group?.entries || []).filter(isEntryComplete);
  if (!entries.length) return;
  if (group.operator === "OR" && entries.length > 1) {
    const chosen = await showMechChoiceDialog(sourceItem, entries);
    if (chosen) await applyMechEntry(actor, chosen, sourceItem);
  } else {
    for (const e of entries) await applyMechEntry(actor, e, sourceItem);
  }
}

/** Применяет ВСЕ группы механики предмета к актору — вызывается из createItem хука. */
export async function applyItemMechanics(item) {
  const groups = getItemMechanics(item);
  if (!groups.length) return;
  if (item.getFlag(FLAG, "mechanicsApplied")) return;
  const actor = item.parent;
  if (!(actor instanceof Actor)) return;

  for (const group of groups) await applyGroupEntries(actor, group, item);
  await syncWeaponPropItemEffects(item);
  // Источник мог родиться неактивным (напр. Имплант создан ещё не
  // установленным) — откатывает то, что applyMechEntry(equipment) уже
  // успел выдать выше, чтобы конечное состояние сразу было верным.
  await syncGrantedEquipment(item);
  await item.setFlag(FLAG, "mechanicsApplied", true);
}

// ── HTML-разметка вкладки (собирается в JS, не в .hbs — см. обоснование в
// истории doombc-grants-system: форма записи слишком по-разному выглядит
// по kind, глубокая вложенная логика на чистом Handlebars была бы хрупкой
// без возможности живого рендера). Инжектируется через {{{ }}}.

function optHtml(value, label, selected) {
  return `<option value="${esc(value)}" ${selected ? "selected" : ""}>${esc(label)}</option>`;
}

function buildEntryFieldsHtml(groupId, ent, isGM) {
  const dis = isGM ? "" : "disabled";
  if (ent.kind === "corruption") {
    const opOpts = CORRUPTION_OP_OPTIONS.map(o => optHtml(o.value, o.label, (ent.op || "add") === o.value)).join("");
    return `<select class="mech-corruption-op" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${opOpts}</select>
      <input type="text" class="mech-corruption-value" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.corruptionValue ?? "")}" placeholder="напр. 5 или 2d10" ${dis}/>`;
  }

  if (ent.kind === "wounds") {
    const opOpts = FOUR_OP_OPTIONS.map(o => optHtml(o.value, o.label, (ent.op || "add") === o.value)).join("");
    return `<select class="mech-wounds-op" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${opOpts}</select>
      <input type="text" class="mech-wounds-value" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.woundsValue ?? "")}" placeholder="напр. 5 или 2d10" ${dis}/>`;
  }

  if (ent.kind === "cohesion") {
    const roleOpts = COHESION_ROLE_OPTIONS.map(o => optHtml(o.value, o.label, (ent.cohesionRole || "any") === o.value)).join("");
    const opOpts = FOUR_OP_OPTIONS.map(o => optHtml(o.value, o.label, (ent.op || "add") === o.value)).join("");
    return `<select class="mech-cohesion-role" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${roleOpts}</select>
      <select class="mech-cohesion-op" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${opOpts}</select>
      <input type="text" class="mech-cohesion-value" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.cohesionValue ?? "")}" placeholder="напр. 5 или 2d10" ${dis}/>`;
  }

  if (ent.kind === "characteristic") {
    const charOpts = Object.entries(CHARACTERISTICS).map(([k, m]) => optHtml(k, `${m.abbr} — ${m.label}`, ent.charKey === k)).join("");
    const fieldOpts = [["total", "Итоговое значение"], ["bonus", "Бонус (÷10)"]]
      .map(([v, l]) => optHtml(v, l, (ent.field || "total") === v)).join("");
    const opOpts = OP_OPTIONS.map(o => optHtml(o.value, o.label, (ent.op || "add") === o.value)).join("");
    return `<select class="mech-char-key" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${charOpts}</select>
      <select class="mech-char-field" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${fieldOpts}</select>
      <select class="mech-char-op" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${opOpts}</select>
      <input type="number" class="mech-char-value" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.value ?? "")}" ${dis}/>`;
  }

  if (ent.kind === "trait" || ent.kind === "talent") {
    const dropInner = ent.sourceUuid
      ? `<img src="${esc(ent.sourceImg || "icons/svg/item-bag.svg")}" class="grant-drop-img"/>
         <span class="grant-drop-name">${esc(ent.sourceName || "?")}</span>
         ${isGM ? `<button type="button" class="grant-drop-clear" data-group-id="${groupId}" data-entry-id="${ent.id}" title="Убрать предмет">✕</button>` : ""}`
      : `<span class="grant-drop-placeholder">${isGM ? `Перетащите ${ent.kind === "trait" ? "Черту" : "Талант"} сюда` : "—"}</span>`;
    let out = `<div class="grant-drop-zone" data-group-id="${groupId}" data-entry-id="${ent.id}">${dropInner}</div>`;
    if (ent.kind === "trait" && ent.sourceHasRating) {
      out += `<input type="number" class="grant-entry-rating" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.rating ?? "")}" placeholder="Рейтинг" ${dis}/>`;
    }
    if (ent.kind === "talent" && ent.sourceUuid) {
      out += `<input type="text" class="grant-entry-spec" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.specialization || "")}" placeholder="Специализация" ${dis}/>`;
    }
    return out;
  }

  if (ent.kind === "skill") {
    let out = buildSkillSelectorHtml(groupId, ent, dis);
    const rankOpts = Object.entries(SKILL_RANKS).map(([k, d]) => optHtml(k, d.label, (ent.rank || "untrained") === k)).join("");
    out += `<select class="grant-entry-rank" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${rankOpts}</select>`;
    return out;
  }

  if (ent.kind === "weight") {
    const scopeOpts = Object.entries(WEIGHT_SCOPE_LABELS).map(([v, l]) => optHtml(v, l, (ent.weightScope || "all") === v)).join("");
    const modeOpts = [["kg", "В килограммах (+/−)"], ["index", "Бонус к индексу S.b+T.b"]]
      .map(([v, l]) => optHtml(v, l, (ent.weightMode || "kg") === v)).join("");
    return `<select class="mech-weight-scope" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${scopeOpts}</select>
      <select class="mech-weight-mode" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${modeOpts}</select>
      <input type="number" class="mech-weight-value" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.weightValue ?? "")}" ${dis}/>`;
  }

  if (ent.kind === "movement") {
    const targetOpts = MOVEMENT_TARGETS.map(t => optHtml(t.key, t.label, (ent.movementTarget || "spd") === t.key)).join("");
    const opOpts = CORRUPTION_OP_OPTIONS.map(o => optHtml(o.value, o.label, (ent.op || "add") === o.value)).join("");
    return `<select class="mech-move-target" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${targetOpts}</select>
      <select class="mech-move-op" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${opOpts}</select>
      <input type="number" class="mech-move-value" step="1" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.movementValue ?? "")}" ${dis}/>`;
  }

  if (ent.kind === "terrainIgnore") {
    const chosen = new Set(ent.ignoreTerrainProps || []);
    const opts = TERRAIN_PROPS.map(p =>
      `<option value="${esc(p.key)}" ${chosen.has(p.key) ? "selected" : ""}>${esc(p.label)} (${p.mod >= 0 ? "+" : ""}${p.mod})</option>`
    ).join("");
    return `<select class="mech-terrain-ignore" multiple size="6" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${opts}</select>`;
  }

  if (ent.kind === "fatigue") {
    // Каскад: сначала ЧТО делать с Усталостью, потом уточнение. Действие пока
    // одно, но выбор оставлен списком — чтобы будущие действия («Снять
    // уровень» и т.п.) не потребовали переделки уже сохранённых записей.
    const actionOpts = FATIGUE_ACTIONS
      .map(([v, l]) => optHtml(v, l, (ent.fatigueAction || "threshold") === v)).join("");
    const charOpts = FATIGUE_THRESHOLD_CHARS
      .map(([v, l]) => optHtml(v, l, (ent.fatigueThresholdChar || "t") === v)).join("");
    const charSelect = (ent.fatigueAction || "threshold") === "threshold"
      ? `<select class="mech-fatigue-char" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${charOpts}</select>`
      : "";
    return `<select class="mech-fatigue-action" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${actionOpts}</select>${charSelect}`;
  }

  if (ent.kind === "equipment") {
    const mode = ent.equipMode || "direct";
    const modeOpts = [["direct", "Непосредственно предмет"], ["choice", "Выбор (категория + фильтры)"]]
      .map(([v, l]) => optHtml(v, l, mode === v)).join("");
    let out = `<select class="mech-equip-mode" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${modeOpts}</select>`;

    if (mode === "direct") {
      out += `<select class="mech-equip-source" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>
        <option value="">— выберите предмет —</option>
        ${equipmentOptionsHtml(ent.equipSourceUuid)}
      </select>`;
    } else {
      const cat = ent.equipCategoryPack || "weapons";
      const catOpts = GRANTABLE_CATEGORIES.map(c => optHtml(c.pack, c.label, cat === c.pack)).join("");
      out += `<select class="mech-equip-cat" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${catOpts}</select>`;
      if (cat === "weapons") {
        // «Тип» — папка компендиума корбука (Авто и стаб/Дробовики/Автопушки/
        // Силовое/Шоковое/...), не поле в системе предмета — см. coreWeaponTypeFolders().
        const typeOpts = [`<option value="">— любой тип —</option>`]
          .concat(coreWeaponTypeFolders().map(f => optHtml(f.id, f.name, (ent.equipWeaponType || "") === f.id))).join("");
        const propOpts = [`<option value="">— любое свойство —</option>`]
          .concat(Object.values(WEAPON_PROPERTIES).map(p => optHtml(p.key, p.label, (ent.equipWeaponProp || "") === p.key))).join("");
        out += `<select class="mech-equip-wtype" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${typeOpts}</select>
          <select class="mech-equip-wprop" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${propOpts}</select>`;
      }
      if (cat === "armor") {
        const atOpts = [`<option value="">— любой тип —</option>`]
          .concat(Object.entries(ARMOR_TYPES).map(([v, l]) => optHtml(v, l, (ent.equipArmorType || "") === v))).join("");
        out += `<select class="mech-equip-atype" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${atOpts}</select>`;
      }
      const availOpts = Object.entries(AVAILABILITY)
        .map(([v, l]) => optHtml(v, l, String(ent.equipMaxAvailability ?? 5) === v)).join("");
      out += `<select class="mech-equip-avail" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${availOpts}</select>`;
    }
    out += `<input type="number" class="mech-equip-qty" min="1" step="1" placeholder="Кол-во" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.equipQty ?? 1)}" ${dis}/>`;
    return out;
  }

  if (ent.kind === "rollmod") {
    let out = buildSkillSelectorHtml(groupId, ent, dis);
    out += `<input type="text" class="mech-rollmod-label" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.label || "")}" placeholder="Имя модификатора" ${dis}/>
      <input type="number" class="mech-rollmod-value" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.value ?? "")}" placeholder="±значение" ${dis}/>`;
    return out;
  }

  if (ent.kind === "poolMax") {
    return `<input type="number" class="mech-poolmax-value" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.value ?? "")}" placeholder="±значение" ${dis}/>`;
  }

  if (ent.kind === "weaponProp") {
    // Свойство выбирается драг-н-дропом предмета типа «weaponProperty» (компендиум
    // «Свойства оружия»), не дропдауном — та же зона .grant-drop-zone, что у
    // Черты/Таланта, но с классом .wprop-drop-zone (свой обработчик _onDrop в
    // item-sheet.mjs) и data-slot ("prop" | "newProp" — второй только у replace).
    const actionOpts = WEAPON_PROP_ACTIONS
      .concat(ent.weaponPropHasRating ? WEAPON_PROP_ACTIONS_RATED : [])
      .map(([v, l]) => optHtml(v, l, (ent.weaponPropAction || "add") === v)).join("");
    const dropZone = (slot, key, label) => {
      const inner = key
        ? `<span class="grant-drop-name">${esc(label || key)}</span>
           ${isGM ? `<button type="button" class="wprop-drop-clear" data-group-id="${groupId}" data-entry-id="${ent.id}" data-slot="${slot}" title="Убрать">✕</button>` : ""}`
        : `<span class="grant-drop-placeholder">${isGM ? "Перетащите Свойство оружия сюда" : "—"}</span>`;
      return `<div class="grant-drop-zone wprop-drop-zone" data-group-id="${groupId}" data-entry-id="${ent.id}" data-slot="${slot}">${inner}</div>`;
    };
    const action = ent.weaponPropAction || "add";
    let out = `<select class="wprop-action" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${actionOpts}</select>`;
    out += dropZone("prop", ent.weaponPropKey, ent.weaponPropLabel);
    if (action === "add") {
      if (ent.weaponPropHasRating)
        out += `<input type="number" class="wprop-value" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.weaponPropValue ?? "")}" placeholder="Рейтинг" ${dis}/>`;
      if (ent.weaponPropHasRating2)
        out += `<input type="number" class="wprop-value2" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.weaponPropValue2 ?? "")}" placeholder="Рейтинг Y" ${dis}/>`;
    } else if (action === "increase" || action === "decrease") {
      out += `<input type="number" class="wprop-value" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.weaponPropValue ?? "")}" min="0" placeholder="На сколько" ${dis}/>`;
    } else if (action === "replace") {
      out += dropZone("newProp", ent.weaponPropNewKey, ent.weaponPropNewLabel);
      if (ent.weaponPropNewHasRating)
        out += `<input type="number" class="wprop-new-value" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.weaponPropNewValue ?? "")}" placeholder="Рейтинг" ${dis}/>`;
      if (ent.weaponPropNewHasRating2)
        out += `<input type="number" class="wprop-new-value2" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.weaponPropNewValue2 ?? "")}" placeholder="Рейтинг Y" ${dis}/>`;
    }
    return out;
  }

  if (ent.kind === "script") {
    return `<input type="text" class="mech-script-label" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.label || "")}" placeholder="Название (для себя)" ${dis}/>
      <textarea class="mech-script-code" data-group-id="${groupId}" data-entry-id="${ent.id}" spellcheck="false" placeholder="// произвольный JS — item, actor, token, speaker, game, ui, ChatMessage, event" ${dis}>${esc(ent.code || "")}</textarea>`;
  }

  return "";
}

/** Дроплисты выбора навыка (+специализации, для групповых) — общие для kind:"skill" и kind:"rollmod". */
function buildSkillSelectorHtml(groupId, ent, dis) {
  const curVal = ent.skillKey ? `${ent.skillScope}:${ent.skillKey}` : "";
  const plainOpts = Object.entries(SKILLS_DEF).map(([k, d]) => optHtml(`plain:${k}`, d.label, curVal === `plain:${k}`)).join("");
  const groupOpts = Object.entries(GROUP_SKILLS_DEF).map(([k, d]) => optHtml(`group:${k}`, d.label, curVal === `group:${k}`)).join("");
  let out = `<select class="grant-entry-skillref" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>
    <option value="">— выберите навык —</option>
    <optgroup label="Обычные">${plainOpts}</optgroup>
    <optgroup label="Групповые">${groupOpts}</optgroup>
  </select>`;
  if (ent.skillScope === "group" && ent.skillKey) {
    const specs = specOptions(ent.skillKey);
    const isChoice = ent.specKey === "__choice__";
    const isCustom = !isChoice && !ent.specKey && !!ent.specialty;
    const specOpts = specs.map(s => optHtml(s.key, s.display, ent.specKey === s.key)).join("");
    out += `<select class="grant-entry-specialty" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>
      <option value="">— специализация —</option>
      ${specOpts}
      <option value="__custom__" ${isCustom ? "selected" : ""}>Своя…</option>
      <option value="__choice__" ${isChoice ? "selected" : ""}>По выбору при получении…</option>
    </select>`;
    if (isCustom) {
      out += `<input type="text" class="grant-entry-spec-custom" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.specialty)}" placeholder="Название специализации" ${dis}/>`;
    }
    // «По выбору» — отметьте checkbox'ами НЕСКОЛЬКО кандидатов; актор выбирает
    // ОДИН из них диалогом в момент получения предмета (resolveEntrySpecChoice).
    if (isChoice) {
      const chosen = new Set(ent.specChoiceKeys || []);
      const rows = specs.map(s => `<label class="grant-spec-choice-row">
        <input type="checkbox" class="grant-entry-spec-choice" data-group-id="${groupId}" data-entry-id="${ent.id}" data-key="${esc(s.key)}" ${chosen.has(s.key) ? "checked" : ""} ${dis}/>
        <span>${esc(s.display)}</span></label>`).join("");
      out += `<div class="grant-spec-choice-list">${rows || "<em>Нет вариантов специализации</em>"}</div>`;
    }
  }
  return out;
}

/**
 * depth — глубина ГРУППЫ, содержащей эту запись (верхний уровень = 1).
 * «Вложенная группа» пропадает из дропдауна «Вид записи», когда её выбор
 * создал бы подгруппу глубже MAX_GROUP_DEPTH — но текущий kind:"group" не
 * скрывается сам у себя, даже если данные почему-то оказались глубже (напр.
 * после ручной правки JSON) — иначе выбор в <select> не совпал бы ни с
 * одним <option> и вид записи visually «съехал» бы на другой.
 */
function buildEntryHtml(groupId, ent, isGM, depth = 1) {
  const kindEntries = Object.entries(KIND_LABELS)
    .filter(([k]) => k !== "group" || ent.kind === "group" || depth < MAX_GROUP_DEPTH);
  const kindOpts = kindEntries.map(([k, l]) => optHtml(k, l, ent.kind === k)).join("");
  const isScript = ent.kind === "script";
  const isGroup  = ent.kind === "group";
  return `<div class="grant-entry ${isScript ? "grant-entry-script" : ""} ${isGroup ? "grant-entry-group" : ""}" data-group-id="${groupId}" data-entry-id="${ent.id}">
    <div class="grant-entry-row">
      <select class="grant-entry-kind" data-group-id="${groupId}" data-entry-id="${ent.id}" ${isGM ? "" : "disabled"}>${kindOpts}</select>
      ${buildEntryFieldsHtml(groupId, ent, isGM)}
      ${isGM ? `<button type="button" class="grant-entry-remove" data-group-id="${groupId}" data-entry-id="${ent.id}" title="Удалить запись">✕</button>` : ""}
    </div>
    <div class="grant-entry-preview">${esc(describeMechEntry(ent))}</div>
    ${isGroup ? buildGroupHtml(ent.group || blankMechGroup(), isGM, depth + 1, true) : ""}
  </div>`;
}

/**
 * nested — true для подгрупп (kind:"group" внутри записи): скрывает кнопку
 * «✕ Удалить группу» (удаление — через «✕» самой записи-контейнера у
 * родителя, отдельной кнопки не нужно), но оставляет переключатель И/ИЛИ.
 */
function buildGroupHtml(grp, isGM, depth = 1, nested = false) {
  const entriesHtml = (grp.entries || []).map(e => buildEntryHtml(grp.id, e, isGM, depth)).join("")
    || `<div class="grant-empty-hint"><em>Записей нет</em></div>`;
  const opHint = grp.operator === "OR" ? "актор выбирает одну запись" : "применяются все записи";
  return `<div class="grant-group ${nested ? "grant-group-nested" : ""}" data-group-id="${grp.id}">
    <div class="grant-group-head">
      <span class="grant-op-badge grant-op-${grp.operator}">${grp.operator === "OR" ? "ИЛИ" : "И"}</span>
      <span class="grant-op-hint">${opHint}</span>
      ${isGM ? `<button type="button" class="grant-op-toggle" data-group-id="${grp.id}" title="Переключить И/ИЛИ">⇄</button>` : ""}
      ${isGM && !nested ? `<button type="button" class="grant-group-remove" data-group-id="${grp.id}" title="Удалить группу">✕</button>` : ""}
    </div>
    <div class="grant-entries">${entriesHtml}</div>
    ${isGM ? `<button type="button" class="grant-entry-add" data-group-id="${grp.id}">➕ Запись</button>` : ""}
  </div>`;
}

/** Собирает HTML всех групп механики предмета — идёт в контекст листа предмета. */
export function buildMechanicsTabHtml(item, isGM) {
  return getItemMechanics(item).map(g => buildGroupHtml(g, isGM)).join("");
}

// ══════════════════ ТРЕБОВАНИЯ (условия-предпосылки) ══════════════════
//
// Второй конструктор рядом с Механикой: те же группы И/ИЛИ, но записи не
// ЧТО-ТО ДЕЛАЮТ, а ПРОВЕРЯЮТСЯ на акторе. Заведён ради предмета-Ритуала
// (требования к ритуалисту и отдельно к ассистентам, стр. 393-425), но сам
// движок ни к чему ритуальному не привязан — годится любому предмету.
//
// Хранение: flags.warhammer-dbc.<flagKey> — массив групп той же формы, что и
// mechanics: { id, operator:"AND"|"OR", entries:[...] }. Вложенных подгрупп
// здесь сознательно нет: двух уровней хватает на любое требование книги, а
// плоский список читается легче.

export const REQ_KIND_LABELS = {
  reqSkill:      "Навык",
  reqTalent:     "Талант",
  reqTrait:      "Черта",
  reqRace:       "Раса",
  reqArchetype:  "Элитный архетип",
  reqPatron:     "Покровительство Бога"
};

/** Сравнение имён: регистр и лишние пробелы значения не имеют. */
const normReq = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

/** Пустая запись-требование. */
export function blankReqEntry(kind = "reqSkill") {
  return {
    id: foundry.utils.randomID(), kind,
    // reqSkill
    skillScope: "plain", skillKey: "", specKey: "", specialty: "", rank: "knows",
    // reqTalent / reqTrait — источник перетаскивается, рейтинг необязателен
    sourceUuid: "", sourceName: "", sourceImg: "", sourceHasRating: false, rating: "",
    // reqRace / reqArchetype / reqPatron
    raceKey: "", archetypeName: "", patronKey: ""
  };
}

export function blankReqGroup(operator = "AND") {
  return { id: foundry.utils.randomID(), operator, entries: [blankReqEntry()] };
}

/** Нормализованный список групп-требований предмета (только чтение). */
export function getItemRequirements(item, flagKey) {
  const arr = item.getFlag(FLAG, flagKey);
  return Array.isArray(arr) ? arr : [];
}

/** Человекочитаемое описание требования — для превью и строки на листе. */
export function describeReqEntry(e) {
  switch (e.kind) {
    case "reqSkill": {
      if (!e.skillKey) return "Навык: (не выбран)";
      const def = e.skillScope === "group" ? GROUP_SKILLS_DEF[e.skillKey] : SKILLS_DEF[e.skillKey];
      const spec = e.skillScope === "group" && e.specialty ? ` (${e.specialty})` : "";
      const rank = SKILL_RANKS[e.rank]?.label || e.rank;
      return `Навык: ${def?.label || e.skillKey}${spec} — не ниже «${rank}»`;
    }
    case "reqTalent":
    case "reqTrait": {
      const what = e.kind === "reqTalent" ? "Талант" : "Черта";
      if (!e.sourceName) return `${what}: (перетащите)`;
      const r = (e.kind === "reqTrait" && e.rating !== "" && e.rating != null)
        ? ` — рейтинг не ниже ${e.rating}` : "";
      return `${what}: ${e.sourceName || "?"}${r}`;
    }
    case "reqRace":
      return e.raceKey ? `Раса: ${RACES[e.raceKey]?.label || e.raceKey}` : "Раса: (не выбрана)";
    case "reqArchetype":
      return e.archetypeName ? `Элитный архетип: ${e.archetypeName}` : "Элитный архетип: (не выбран)";
    case "reqPatron":
      return e.patronKey
        ? `Покровительство: ${WARP_GODS_MAP[e.patronKey]?.label || e.patronKey}`
        : "Покровительство: (не выбрано)";
    default:
      return "(неизвестное требование)";
  }
}

/** Заполнено ли требование настолько, чтобы его можно было проверять. */
export function isReqComplete(e) {
  switch (e.kind) {
    case "reqSkill":     return !!e.skillKey;
    // Сверка идёт по имени, поэтому один только UUID проверять нечем.
    case "reqTalent":
    case "reqTrait":     return !!e.sourceName;
    case "reqRace":      return !!e.raceKey;
    case "reqArchetype": return !!e.archetypeName;
    case "reqPatron":    return !!e.patronKey;
    default:             return false;
  }
}

/** Выполняет ли актор ОДНО требование. */
export function actorMeetsReq(actor, e) {
  if (!actor) return false;
  switch (e.kind) {
    case "reqSkill": {
      const need = SKILL_RANK_STEPS[e.rank] ?? 0;
      if (e.skillScope === "group") {
        const arr = actor.system.groupSkills?.[e.skillKey] || [];
        // Специализация не задана — годится любая специализация группы.
        if (!e.specKey && !e.specialty)
          return arr.some(x => (SKILL_RANK_STEPS[x.rank] ?? 0) >= need);
        // Задана — ищем её общим сопоставителем: в данных специализация
        // лежит то ключом, то английской меткой, то русской (Конструктор
        // персонажа пишет русскую), и сравнение строк напрямую не сходится.
        // Ранг спрашивается у НАЙДЕННОЙ записи: «Запретные знания (Демоны)
        // на Ветеране» не закрываются Ветераном по Варпу.
        const hit = findGroupEntry(actor, e.skillKey, e.specKey || e.specialty);
        return !!hit && (SKILL_RANK_STEPS[hit.rank] ?? 0) >= need;
      }
      return (SKILL_RANK_STEPS[actor.system.skills?.[e.skillKey]?.rank] ?? 0) >= need;
    }
    case "reqTalent":
    case "reqTrait": {
      const type = e.kind === "reqTalent" ? "talent" : "trait";
      const want = normReq(e.sourceName);
      // Пустое имя не выполняется ничем: сверка вхождением сделала бы пустую
      // строку подходящей к любому предмету.
      if (!want) return false;
      // Сверяем по ИМЕНИ целиком: перетащенный из компендиума образец и
      // лежащий на акторе предмет — разные документы, общее у них только
      // name. Вхождением сверять нельзя — «Железная Воля» закрыла бы «Волю».
      // Специализацию в скобках у имени предмета при этом отбрасываем, как
      // это делает hasTalent (constants/talent-requirements.mjs).
      const bare = s => normReq(s).replace(/\s*\([^)]*\)\s*$/, "");
      const hits = actor.items.filter(i =>
        i.type === type && (normReq(i.name) === want || bare(i.name) === want));
      if (!hits.length) return false;
      // Рейтинг есть только у Черты: в схеме Таланта поля rating нет, и
      // требование по нему было бы невыполнимо навсегда.
      if (e.kind !== "reqTrait" || e.rating === "" || e.rating == null) return true;
      const need = Number(e.rating) || 0;
      return hits.some(i => (Number(i.system?.rating) || 0) >= need);
    }
    case "reqRace":
      return actor.system.race === e.raceKey;
    case "reqArchetype": {
      const want = normReq(e.archetypeName);
      // Элитные архетипы лежат и в поле актора, и списком «дополнительных».
      const own = [actor.system.eliteArchetype, ...(actor.system.eliteArchetypesExtra || [])];
      return own.some(a => normReq(a) === want);
    }
    case "reqPatron":
      return actor.system.patronGod === e.patronKey;
    default:
      return false;
  }
}

/**
 * Проверка всех групп требований. И-группа — нужны ВСЕ её записи, ИЛИ-группа
 * — хотя бы одна; между группами всегда И, как и в Механике. Незаполненные
 * записи игнорируются, пустой список требований = «годится любой».
 * @returns {{ok:boolean, failed:string[]}}
 */
export function checkRequirements(actor, groups) {
  const failed = [];
  for (const g of groups || []) {
    const entries = (g.entries || []).filter(isReqComplete);
    if (!entries.length) continue;
    const ok = g.operator === "OR"
      ? entries.some(e => actorMeetsReq(actor, e))
      : entries.every(e => actorMeetsReq(actor, e));
    if (!ok) {
      failed.push(g.operator === "OR"
        ? `одно из: ${entries.map(describeReqEntry).join(" / ")}`
        : entries.filter(e => !actorMeetsReq(actor, e)).map(describeReqEntry).join("; "));
    }
  }
  return { ok: failed.length === 0, failed };
}

/** Поля одной записи-требования. reqKey — какой набор групп правим (data-req). */
function buildReqFieldsHtml(reqKey, groupId, e, dis) {
  const d = `data-req="${reqKey}" data-group-id="${groupId}" data-entry-id="${e.id}"`;
  switch (e.kind) {
    case "reqSkill": {
      const cur = e.skillKey ? `${e.skillScope}:${e.skillKey}` : "";
      const plain = Object.entries(SKILLS_DEF).map(([k, def]) => optHtml(`plain:${k}`, def.label, cur === `plain:${k}`)).join("");
      const grp   = Object.entries(GROUP_SKILLS_DEF).map(([k, def]) => optHtml(`group:${k}`, def.label, cur === `group:${k}`)).join("");
      const ranks = Object.entries(SKILL_RANKS).map(([k, def]) => optHtml(k, def.label, (e.rank || "knows") === k)).join("");
      let out = `<select class="req-skillref" ${d} ${dis}>
        <option value="">— выберите навык —</option>
        <optgroup label="Обычные">${plain}</optgroup>
        <optgroup label="Групповые">${grp}</optgroup>
      </select>
      <select class="req-rank" ${d} ${dis}>${ranks}</select>`;
      if (e.skillScope === "group" && e.skillKey) {
        const specs = specOptions(e.skillKey).map(s => optHtml(s.key, s.display, e.specKey === s.key)).join("");
        out += `<select class="req-spec" ${d} ${dis}>
          <option value="">— любая специализация —</option>${specs}
        </select>`;
      }
      return out;
    }
    case "reqTalent":
    case "reqTrait": {
      const what = e.kind === "reqTalent" ? "Талант" : "Черту";
      const inner = (e.sourceUuid || e.sourceName)
        ? `<img src="${esc(e.sourceImg || "icons/svg/aura.svg")}" class="grant-drop-img"/>
           <span class="grant-drop-name">${esc(e.sourceName || "?")}</span>
           ${dis ? "" : `<button type="button" class="req-drop-clear" ${d} title="Убрать">✕</button>`}`
        : `<span class="grant-drop-placeholder">${dis ? "—" : `Перетащите ${what} сюда`}</span>`;
      let out = `<div class="grant-drop-zone req-drop-zone" ${d}>${inner}</div>`;
      // Рейтинг только у Черты. У Таланта поля rating в схеме нет
      // (module/data/item/talent.mjs), и требование по нему нельзя было бы
      // выполнить никогда — поле не показываем, чтобы не заводить ловушку.
      // Внутри Черты спрашиваем всегда: у перетащенного из компендиума
      // образца hasRating может быть не выставлен.
      if (e.kind === "reqTrait") {
        out += `<input type="number" class="req-rating" ${d} value="${esc(e.rating ?? "")}"
                       placeholder="рейтинг ≥" title="Минимальный рейтинг (пусто — не важен)" ${dis}/>`;
      }
      return out;
    }
    case "reqRace": {
      const opts = Object.entries(RACES).map(([k, r]) => optHtml(k, r.label || k, e.raceKey === k)).join("");
      return `<select class="req-race" ${d} ${dis}><option value="">— выберите расу —</option>${opts}</select>`;
    }
    case "reqArchetype": {
      const names = [...new Set(ELITE_ARCHETYPES.map(a => a.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
      const opts = names.map(n => optHtml(n, n, e.archetypeName === n)).join("");
      return `<select class="req-archetype" ${d} ${dis}><option value="">— выберите архетип —</option>${opts}</select>`;
    }
    case "reqPatron": {
      const opts = WARP_GODS.map(g => optHtml(g.key, g.label, e.patronKey === g.key)).join("");
      return `<select class="req-patron" ${d} ${dis}><option value="">— выберите Бога —</option>${opts}</select>`;
    }
    default:
      return "";
  }
}

/** Одна группа требований. */
function buildReqGroupHtml(reqKey, grp, isGM) {
  const dis = isGM ? "" : "disabled";
  const d = `data-req="${reqKey}" data-group-id="${grp.id}"`;
  const entries = (grp.entries || []).map(e => {
    const kindOpts = Object.entries(REQ_KIND_LABELS).map(([k, l]) => optHtml(k, l, e.kind === k)).join("");
    return `<div class="grant-entry" data-req="${reqKey}" data-group-id="${grp.id}" data-entry-id="${e.id}">
      <div class="grant-entry-row">
        <select class="req-entry-kind" data-req="${reqKey}" data-group-id="${grp.id}" data-entry-id="${e.id}" ${dis}>${kindOpts}</select>
        ${buildReqFieldsHtml(reqKey, grp.id, e, dis)}
        ${isGM ? `<button type="button" class="req-entry-remove" data-req="${reqKey}" data-group-id="${grp.id}" data-entry-id="${e.id}" title="Удалить условие">✕</button>` : ""}
      </div>
      <div class="grant-entry-preview">${esc(describeReqEntry(e))}</div>
    </div>`;
  }).join("") || `<div class="grant-empty-hint"><em>Условий нет</em></div>`;

  const opHint = grp.operator === "OR" ? "достаточно одного условия" : "нужны все условия";
  return `<div class="grant-group" data-req="${reqKey}" data-group-id="${grp.id}">
    <div class="grant-group-head">
      <span class="grant-op-badge grant-op-${grp.operator}">${grp.operator === "OR" ? "ИЛИ" : "И"}</span>
      <span class="grant-op-hint">${opHint}</span>
      ${isGM ? `<button type="button" class="req-op-toggle" ${d} title="Переключить И/ИЛИ">⇄</button>` : ""}
      ${isGM ? `<button type="button" class="req-group-remove" ${d} title="Удалить группу">✕</button>` : ""}
    </div>
    <div class="grant-entries">${entries}</div>
    ${isGM ? `<div class="mech-group-add-row">
      <button type="button" class="req-entry-add" ${d}>➕ Условие</button>
    </div>` : ""}
  </div>`;
}

/** Собирает HTML всех групп требований предмета — идёт в контекст листа. */
export function buildRequirementsHtml(item, flagKey, isGM) {
  const groups = getItemRequirements(item, flagKey);
  if (!groups.length) return `<div class="grant-empty-hint"><em>Требований нет — доступно всем</em></div>`;
  return groups.map(g => buildReqGroupHtml(flagKey, g, isGM)).join("");
}
