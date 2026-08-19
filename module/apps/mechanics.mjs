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
//    reroll: { rerollScope:"all"|"char"|"skill"|"attack"|"initiative"|"social",
//              rerollChar / skillKey (уточнение области), rerollMode:"keepBest"|
//              "keepWorst", label }
//      → ЖИВОЙ ЗАПРОС, как terrainIgnore: при получении предмета не пишет
//      ничего. В момент броска rulesFromItemMechanics (module/rules/
//      item-rules.mjs) превращает запись в правило формата docs/rules-format.md
//      с эффектом `rollMode`, и диалог броска показывает переброс отдельной
//      строкой. Область (`target`) — та же, что у модификаторов: «+10 к тестам
//      Ловкости» и «переброс теста Ловкости» обязаны срабатывать на одних
//      бросках. Активность источника решает общий isItemActive: выключенный
//      Локус Герольда перебросов не даёт.
//      Заведено под Локусы Герольдов (DoomBC — Хаос, стр. 27-32), где книга
//      раздаёт перебросы россыпью: «раз в Раунд перебросить любой тест A».
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
//    armour: { armourLocation:"all"|"head"|"body"|"leftArm"|"rightArm"|
//               "leftLeg"|"rightLeg", op:"add"|"subtract", armourValue }
//      → ActiveEffect НА ПРЕДМЕТЕ на system.armorBonus.<локация> — ту самую
//      СКЛАДЫВАЕМУЮ надбавку AP, которой пользуются Естественная Броня и
//      подкожные импланты (см. AP_LOCATIONS в constants/effect-keys.mjs). Фаза
//      "initial": поле хранимое, расчёт листа читает его в середине
//      prepareDerivedData, рядом с бронёй от Черт, а не после. "all" — шесть
//      изменений разом, по одному на локацию.
//      Заведено потому, что Черта «Natural Armour (X)» раздаёт AP только СРАЗУ
//      НА ВСЕ шесть локаций, и выдать «+4 только в торс» (Чёрный Панцирь) ею
//      было нечем: rescaleTraitByRating масштабирует значение, но не сужает
//      набор локаций.
//    integralAttack: { equipSourceUuid, equipSourceName, equipSourceImg }
//      → ВСТРОЕННАЯ АТАКА: то же создание предмета-оружия на акторе, что и у
//      equipment режима "direct", но с двумя отличиями, ради которых она и
//      заведена отдельным видом. Первое: выданное оружие сразу
//      system.equipped = true — и боевой HUD (equippedWeapons() в apps/hud.mjs),
//      и вкладка БОЙ (combatMeleeWeapons/combatRangedWeapons в sheets/
//      sheet-helpers.mjs) отбирают оружие ровно по этому полю, так что надетому
//      предмету не нужно ни строчки нового кода, чтобы там появиться. Второе:
//      на предмете ставится flags.warhammer-dbc.integralAttack, по которому
//      хуки preUpdateItem/preDeleteItem (warhammer-dbc.mjs) не дают его ни снять,
//      ни удалить, пока источник на акторе и активен — это часть тела (Кислотный
//      Плевок Железы Бетчера) или машины (Пинок Дредноута), а не снаряжение,
//      которое игрок волен отложить.
//      Живёт и снимается тем же syncGrantedEquipment, что и equipment "direct":
//      сняли имплант в Хирургиконе — атака ушла вместе с ним.
//    loyalty: { loyaltyMinionType:""|"human"|"beast"|"machine"|"daemon",
//               loyaltyOp:"add"|"subtract", loyaltyValue }
//      → ОДНОРАЗОВАЯ ПЕРМАНЕНТНАЯ правка system.loyalty.value у ВСЕХ Миньонов
//      владельца предмета (module/apps/minions.mjs: отдельные акторы
//      character/daemon с system.masterUuid === actor.uuid), опционально
//      суженная одним из четырёх типов миньона книги (стр. 111-113); "" —
//      любой тип. Как corruption/wounds — хранимое состояние, а не
//      производное, поэтому ActiveEffect тут не годится.
//      Отката при снятии предмета НЕТ, и это осознанный пробел: правка
//      нескольких ЧУЖИХ акторов сразу не укладывается в откат deleteItem,
//      который работает по флагу на предмете владельца.
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
import { skillGrantOutcome, findSameTalent, createOrRankTalent } from "../rules/duplicate-grants.mjs";
import { refundXP, skillStepsCost, talentCost, skillReason, talentReason }
  from "./duplicate-refund.mjs";
import { MINION_TYPES, minionsOf, loyaltyAfterChange } from "./minions.mjs";
import { SKILL_RANKS, CHARACTERISTICS }       from "../constants/characteristics.mjs";
import { specOptions, findGroupEntry }        from "../constants/skill-specializations.mjs";
import { dynamicAptKind }                     from "../constants/advancement.mjs";
import { masteryTargets, masteryAptitudes, masteryLabel } from "../rules/mastery-targets.mjs";
import { normalizeBudget, BUDGET_XP, BUDGET_MODES } from "../rules/pick-budget.mjs";
import { pickXPCost }                          from "../rules/pick-xp-cost.mjs";
import { ITEM_QUALITY, ITEM_QUALITY_LIST }     from "../constants/quality.mjs";
import { MINION_GROUPS, MINION_TIERS }         from "../constants/minions.mjs";
import { isMinionTalent }                      from "../rules/minion-build.mjs";
import { applyMinionSlot, promptMinionSlot }   from "./minion-talent.mjs";
import { executeItemCode }                    from "./item-script.mjs";
import { TERRAIN_PROPS }                      from "../regions/difficult-terrain.mjs";
import { openCompendiumBrowser, GRANTABLE_CATEGORIES, coreWeaponTypeFolders } from "./compendium-browser.mjs";
import { AVAILABILITY }                       from "../constants/items.mjs";
import { WEAPON_PROPERTIES }                  from "../constants/weapon-properties.mjs";
import { isItemActive }                       from "./effects.mjs";
import { expectedPhase, AP_LOCATIONS }        from "../constants/effect-keys.mjs";
import { raceEntries, raceDef }               from "./race-library.mjs";
import { ELITE_ARCHETYPES }                   from "../constants/elite-archetypes.mjs";
import { WARP_GODS, WARP_GODS_MAP }           from "../constants/veil.mjs";
import { CAPABILITIES, CAPABILITY_OPTIONS } from "../constants/capabilities.mjs";
import { hasRuleFlag }                      from "../rules/flags.mjs";
import { esc } from "../helpers/utils.mjs";

const FLAG = "warhammer-dbc";
const SKILL_RANK_STEPS = { untrained: 0, knows: 1, trained: 2, veteran: 3, expert: 4 };
const higherRank = (a, b) => (SKILL_RANK_STEPS[a] ?? 0) >= (SKILL_RANK_STEPS[b] ?? 0) ? a : b;
// Операции записи «± Характеристика» — только складываемые. Её эффект целится
// в ХРАНИМУЮ надбавку (characteristicEffectKey → bonusFx/totalFx): только
// оттуда число доходит до брони, навыков и перемещений, которые считаются тем
// же проходом. Надбавка начинается с нуля, поэтому «×2» дало бы ровно ноль —
// пункт в списке был, а механики за ним никакой. Умножение осталось там, где
// работает: Раны и Слаженность (FOUR_OP_OPTIONS) — разовые правки хранимого
// числа, их applyFourOp считает от текущего значения.
const OP_OPTIONS = [
  { value: "add",        label: "+ прибавить" },
  { value: "subtract",   label: "− вычесть" }
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
  reroll: "Переброс",
  testMod: "Модификатор теста",
  capability: "Возможность",
  armour: "Очки Брони (локация)",
  equipment: "Снаряжение",
  integralAttack: "Интегральная атака",
  loyalty: "Лояльность миньонов",
  group: "Вложенная группа",
  script: "Код"
};
// Максимальная глубина вложенности подгрупп (kind:"group") — верхняя группа
// вкладки МЕХАНИКА уже уровень 1, поэтому подгрупп-в-подгруппах допускается 4.
const MAX_GROUP_DEPTH = 5;
const WEIGHT_SCOPE_LABELS = { all: "Общее", carry: "Ношение", lift: "Подъём", push: "Толкание" };
// Области «Переброса» (kind:"reroll"). Совпадают с областями `target` в
// docs/rules-format.md: одна и та же область обязана значить одно и то же и в
// «+10 к тестам Ловкости», и в «перебросить тест Ловкости».
const REROLL_SCOPES = [
  ["all",        "любой тест"],
  ["char",       "тест характеристики"],
  ["skill",      "тест навыка"],
  ["attack",     "тест атаки"],
  ["initiative", "Инициатива"],
  ["social",     "социальные навыки"],
  ["shield",     "тесты на щиты"],
  ["opposed",    "встречные тесты"]
];
const REROLL_SCOPE_LABEL = (e) => {
  switch (e.rerollScope) {
    case "char":  return e.rerollChar ? `тест ${CHARACTERISTICS[e.rerollChar]?.label || e.rerollChar}` : "";
    case "skill": return e.skillKey ? `тест «${SKILLS_DEF[e.skillKey]?.label || e.skillKey}»` : "";
    default: return REROLL_SCOPES.find(([v]) => v === e.rerollScope)?.[1] || "";
  }
};

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

/** Текст специализации для превью skill/rollmod — учитывает specKey:"__choice__". */
function specChoiceLabel(entry) {
  if (entry.specKey === "__choice__") {
    const n = (entry.specChoiceKeys || []).length;
    if (!n) return "по выбору (не выбрано ни одной)";
    const need = Math.max(1, Number(entry.specChoiceCount) || 1);
    return need > 1 ? `любые ${need} из ${n}` : `по выбору из ${n}`;
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

/**
 * Ключ эффекта для записи «± Характеристика».
 *
 * «Бонус (÷10)» целится не в `.bonus`, а в хранимое `.bonusFx`: `.bonus`
 * считается расчётом листа (documents/actor.mjs), и эффект поверх готового
 * числа менял бы лист, но не броню, навыки и перемещения, которые считаются
 * тем же проходом ниже (wdbc-5wm). Фазу к ключу подбирает expectedPhase.
 */
export function characteristicEffectKey(entry) {
  const field = (entry.field || "total") === "bonus" ? "bonusFx" : "totalFx";
  return `system.characteristics.${entry.charKey}.${field}`;
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

/**
 * <optgroup> по категориям для дропдауна режима «Непосредственно предмет».
 * onlyPacks — сузить список паков (интегральной атакой может быть только
 * оружие: её кладут в руки боевому HUD, а он умеет бросать лишь weapon).
 */
function equipmentOptionsHtml(selectedUuid, onlyPacks = null) {
  if (!_equipIndex) return `<option value="">— компендиумы ещё загружаются, переоткройте лист —</option>`;
  const cats = onlyPacks ? GRANTABLE_CATEGORIES.filter(c => onlyPacks.includes(c.pack)) : GRANTABLE_CATEGORIES;
  return cats.map(({ pack, label }) => {
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
    // «Миньон Хаоса» — один Талант на двадцать разных слуг (стр. 111): пара
    // «группа + сила» решает и уровень Таланта, и что покажет блок в СОЦИУМе.
    minionGroup: "", minionTier: "",
    // skill / rollmod — specKey:"__choice__" => specChoiceKeys (кандидаты) и
    // specChoiceCount (сколько РАЗНЫХ из них берёт актор при получении,
    // см. resolveEntrySpecChoice): «Общие знания (любые 4)».
    skillScope: "plain", skillKey: "", specKey: "", specialty: "",
    specChoiceKeys: [], specChoiceCount: 1, rank: "untrained",
    // weight
    weightScope: "all", weightMode: "kg", weightValue: 1,
    // movement (op — общее поле)
    movementTarget: "spd", movementValue: 1,
    // armour (op — общее поле): "all" = все шесть локаций разом
    armourLocation: "body", armourValue: 1,
    // terrainIgnore
    ignoreTerrainProps: [],
    // reroll — «Переброс»: живой запрос, читается в момент броска
    // (module/rules/item-rules.mjs), при получении предмета ничего не делает.
    rerollScope: "all", rerollChar: "ag", rerollMode: "keepBest",
    // testMod — «Модификатор теста»: тот же живой запрос, области общие
    // с «Перебросом» (rerollChar/skillKey переиспользуются как уточнение).
    modScope: "all", modValueMode: "flat", modCharBonus: "inf",
    // reroll: чей бросок перебрасывается — свой или навязанный цели.
    rerollWho: "self",
    // capability — имя возможности из constants/capabilities.mjs
    capabilityKey: "",
    // fatigue — каскад: действие → характеристика (см. шапку файла)
    fatigueAction: "threshold", fatigueThresholdChar: "t",
    // equipment
    equipMode: "direct", equipQty: 1,
    equipSourceUuid: "", equipSourceName: "", equipSourceImg: "",
    equipCategoryPack: "weapons", equipWeaponType: "", equipWeaponProp: "",
    equipArmorType: "", equipMaxAvailability: 5,
    // Качество выданного («Narthecium (Good.Q)») и фильтры небоевых паков:
    // ступень Таланта, потолок Пси-Рейтинга.
    equipQuality: "common", equipTalentTier: "", equipMaxPsyRating: "", equipImplantCategory: "",
    // Бюджет выбора (rules/pick-budget.mjs): штуками или опытом.
    equipBudgetMode: "count", equipBudgetValue: 1,
    // loyalty — тип миньона ("" = любой), знак и величина (см. шапку файла)
    loyaltyMinionType: "", loyaltyOp: "add", loyaltyValue: 1,
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
    case "armour": {
      const loc = entry.armourLocation === "all"
        ? "все локации" : (AP_LOCATIONS[entry.armourLocation] ?? entry.armourLocation);
      if (entry.armourValue === "" || entry.armourValue == null) return `Очки Брони: ${loc} (не задано)`;
      const sign = entry.op === "subtract" ? "−" : "+";
      return `Очки Брони: ${loc} ${sign}${entry.armourValue}`;
    }
    case "terrainIgnore": {
      if (!entry.ignoreTerrainProps?.length) return "Ландшафт: игнорировать (не выбрано)";
      const labels = entry.ignoreTerrainProps.map(k => TERRAIN_PROP_LABELS[k] || k);
      return `Ландшафт: игнорирует — ${labels.join(", ")}`;
    }
    case "capability": {
      if (!entry.capabilityKey) return "Возможность: (не выбрана)";
      return `Возможность: ${CAPABILITIES[entry.capabilityKey]?.label || entry.capabilityKey}`;
    }
    case "testMod": {
      const scope = REROLL_SCOPE_LABEL({ ...entry, rerollScope: entry.modScope });
      if (!scope) return "Модификатор теста: (область не выбрана)";
      const val = entry.modValueMode === "charBonus"
        ? `+Бонус ${CHARACTERISTICS[entry.modCharBonus]?.label || entry.modCharBonus}`
        : `${Number(entry.value) >= 0 ? "+" : ""}${entry.value}`;
      return `Модификатор теста: ${scope} — ${val}`;
    }
    case "reroll": {
      const modeLabel = entry.rerollMode === "keepWorst" ? "худший из двух" : "лучший из двух";
      const scope = REROLL_SCOPE_LABEL(entry);
      return scope ? `Переброс: ${scope} — ${modeLabel}` : "Переброс: (область не выбрана)";
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
    case "integralAttack": {
      if (!entry.equipSourceUuid) return "Интегральная атака: (выберите оружие)";
      return `Интегральная атака: ${entry.equipSourceName || "?"} — надета всегда, снять и удалить нельзя`;
    }
    case "loyalty": {
      const typeLabel = entry.loyaltyMinionType
        ? (MINION_TYPES[entry.loyaltyMinionType]?.label || entry.loyaltyMinionType)
        : "любой тип";
      if (entry.loyaltyValue === "" || entry.loyaltyValue == null)
        return `Лояльность: (не задано) — миньоны (${typeLabel})`;
      const sign = entry.loyaltyOp === "subtract" ? "−" : "+";
      return `Лояльность: ${sign}${entry.loyaltyValue} миньонам (${typeLabel})`;
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
    case "armour":
      return !!e.armourLocation && numOk(e.armourValue);
    case "terrainIgnore":
      return Array.isArray(e.ignoreTerrainProps) && e.ignoreTerrainProps.length > 0;
    case "fatigue":
      return e.fatigueAction === "threshold" && !!e.fatigueThresholdChar;
    case "reroll":
      if (e.rerollScope === "char")  return !!e.rerollChar;
      if (e.rerollScope === "skill") return !!e.skillKey;
      return !!e.rerollScope;
    case "testMod":
      if (e.modScope === "char")  return !!e.rerollChar;
      if (e.modScope === "skill") return !!e.skillKey;
      if (e.modValueMode === "charBonus") return !!e.modCharBonus;
      return !!e.modScope && numOk(e.value);
    case "capability":
      return !!e.capabilityKey;
    case "equipment":
      if (!numOk(e.equipQty) || Number(e.equipQty) <= 0) return false;
      return e.equipMode === "choice" ? !!e.equipCategoryPack : !!e.equipSourceUuid;
    case "integralAttack":
      return !!e.equipSourceUuid;
    case "loyalty":
      return numOk(e.loyaltyValue);
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

/**
 * Черта-шаблон «(X)» несёт эффект, равный своему рейтингу — так заведён пак
 * (проверено на всех шести параметрических Чертах с эффектами). Выдача с другим
 * рейтингом обязана двигать и эффект: иначе рейтинг остаётся только в тексте, а
 * «Сверхъест. Сила (4)» даёт +1, как шаблонная единица.
 *
 * Меняются ТОЛЬКО числа, равные рейтингу шаблона. Всё прочее к рейтингу
 * отношения не имеет: у «Машины (3)» броня равна рейтингу, а порог теста — нет.
 *
 * @param {object} data   копия документа Черты (src.toObject()), правится на месте
 * @param {number|string} rating  рейтинг выдачи
 * @returns {object} тот же data — для сцепления с вызовом
 */
export function rescaleTraitByRating(data, rating) {
  const base = Number(data?.system?.rating) || 0;
  const next = Number(rating) || 0;
  if (!base || !next || base === next) return data;
  const swap = v => (Number(v) === base ? next : v);

  for (const eff of data.effects || [])
    for (const ch of (eff.system?.changes || eff.changes || [])) ch.value = swap(ch.value);

  const e = data.system.effects;
  if (e) {
    for (const k of ["charBonusValue", "armourAll", "fearRating", "sizeMod", "initMod", "speedMod"])
      if (Number(e[k])) e[k] = swap(e[k]);
    for (const cb of [...(e.charBonuses || []), ...(e.charValueBonuses || [])])
      if (cb) cb.value = swap(cb.value);
  }
  return data;
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

// ── Коллектор простых ИЛИ/спец-выборов ───────────────────────────────────
// По умолчанию showMechChoiceDialog/showSpecChoiceDialog сами открывают
// Dialog. Вызывающий, который хочет собрать эти выборы в СВОЙ UI (Мастер
// создания персонажа — Этап 3), оборачивает свой вызов в withMechCollector:
// пока коллектор активен, оба диалога отдают выбор ЕМУ вместо Dialog, а он
// сам решает, как и когда его получить (напр. отрисовать строку в форме
// шага и ждать клика). Бюджетные покупки (kind:"equipment" →
// openCompendiumBrowser) коллектор НЕ перехватывает — им нужен полноценный
// экран (дерево компендиума, поиск), в маленькую форму шага не влезают,
// остаются отдельным окном независимо от коллектора.
let _activeMechCollector = null;

/**
 * @param {{choose:(item,entries)=>Promise, chooseSpec:(label,choices,need)=>Promise}} collector
 * @param {() => Promise<any>} fn
 */
export function withMechCollector(collector, fn) {
  const prev = _activeMechCollector;
  _activeMechCollector = collector;
  const restore = () => { _activeMechCollector = prev; };
  return Promise.resolve().then(fn).then(r => { restore(); return r; }, e => { restore(); throw e; });
}

/** Диалог выбора ОДНОЙ специализации из нескольких кандидатов («по выбору»). */
function showSpecChoiceDialog(skillLabel, choices, need = 1) {
  if (_activeMechCollector) return _activeMechCollector.chooseSpec(skillLabel, choices, need);
  return new Promise(resolve => {
    let resolved = false;
    // Одну выбирают радиокнопками, несколько — галочками: у рас сплошь
    // «Общие знания (любые 4)», и там нужны РАЗНЫЕ четыре, а не одна четырежды.
    const many = need > 1;
    const rows = choices.map((c, i) => `<label class="grant-choice-row">
      <input type="${many ? "checkbox" : "radio"}" name="spec-choice" value="${i}" ${!many && i === 0 ? "checked" : ""}/>
      <span>${esc(c.display)}</span></label>`).join("");
    new Dialog({
      title: `Выбор специализации — ${skillLabel}`,
      content: `<div class="wh-grant-choice">
        <p>${many ? `Выберите ${need} разных специализации:` : "Выберите специализацию:"}</p>
        ${rows}
        ${many ? `<p class="grant-choice-count" data-need="${need}"></p>` : ""}</div>`,
      buttons: {
        pick: {
          icon: '<i class="fas fa-check"></i>', label: "Применить",
          callback: html => {
            if (resolved) return;
            const picked = [...html.find('input[name="spec-choice"]:checked')]
              .map(el => choices[parseInt(el.value)]).filter(Boolean);
            resolved = true;
            resolve(many ? picked : (picked[0] ?? null));
          }
        },
        skip: { label: "Пропустить", callback: () => { if (!resolved) { resolved = true; resolve(many ? [] : null); } } }
      },
      default: "pick",
      close: () => { if (!resolved) { resolved = true; resolve(many ? [] : null); } },
      render: html => {
        if (!many) return;
        // Кнопка «Применить» ждёт ровно нужное число: недобор молча съел бы
        // слоты, перебор выдал бы лишнее.
        const btn = html.closest(".app").find('button[data-button="pick"]');
        const upd = () => {
          const n = html.find('input[name="spec-choice"]:checked').length;
          html.find(".grant-choice-count").text(`Выбрано ${n} из ${need}`);
          btn.prop("disabled", n !== need);
        };
        html.find('input[name="spec-choice"]').on("change", upd);
        upd();
      }
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
  if (entry.specKey !== "__choice__") return [entry];
  const def = GROUP_SKILLS_DEF[entry.skillKey];
  const keys = new Set(entry.specChoiceKeys || []);
  const choices = specOptions(entry.skillKey).filter(c => keys.has(c.key));
  if (!choices.length) return [];
  const need = Math.min(Math.max(1, Number(entry.specChoiceCount) || 1), choices.length);
  const chosen = await showSpecChoiceDialog(def?.label || entry.skillKey, choices, need);
  const list = Array.isArray(chosen) ? chosen : (chosen ? [chosen] : []);
  return list.map(c => ({ ...entry, specKey: c.key, specialty: c.display }));
}

/** Применяет одну запись механики: создаёт ActiveEffect/предмет, правит навык, либо исполняет код. */
async function applyMechEntry(actor, entry, sourceItem, fromChoice = false, applied = new Set()) {
  // Подгруппа — не запись, а узел И/ИЛИ: отыгрываются её листья, отметку
  // получают тоже они.
  if (entry.kind === "group") {
    await applyGroupEntries(actor, entry.group, sourceItem, applied);
    return;
  }

  // Каждая запись отыгрывается по одному разу — Порча не бросается дважды,
  // выданная Черта не приезжает второй копией. Долговечные записи при этом
  // ничего не делают (их эффекты ведёт syncMechanicsEffects), но отметку
  // получают тоже: по ней видно, какая ветка ИЛИ-группы уже выбрана.
  if (applied.has(entry.id)) return;
  applied.add(entry.id);

  if (entry.kind === "skill" || entry.kind === "rollmod") {
    const resolved = await resolveEntrySpecChoice(entry);
    if (!resolved.length) return;
    // «Любые N» разворачиваются в N записей с уже выбранными специализациями.
    // Отметку о применении несёт каждая своя — иначе вторая и третья сочлись бы
    // за уже применённые и молча пропали.
    if (resolved.length > 1) {
      for (const e of resolved) {
        await applyMechEntry(actor, { ...e, id: `${entry.id}:${e.specKey}` }, sourceItem, fromChoice, applied);
      }
      return;
    }
    entry = resolved[0];
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

  // Характеристика/вес/перемещение — долговечные записи: их эффект заводит и
  // потом ведёт syncMechanicsEffects, чтобы правка на листе доходила до актора
  // (wdbc-473). Здесь остаётся только ИЛИ-ветка: выбранная в диалоге запись в
  // пересборку не попадает, и эффект ей нужен прямо сейчас.
  if (DURABLE_MECH_KINDS.has(entry.kind)) {
    if (fromChoice) await sourceItem.createEmbeddedDocuments("ActiveEffect", [mechEffectData(entry, sourceItem)]);
    return;
  }

  if (entry.kind === "script") {
    await executeItemCode(sourceItem, entry.code, null);
    return;
  }

  if (entry.kind === "terrainIgnore") {
    // Ничего не пишем и не создаём — см. комментарий в шапке файла:
    // ignoredTerrainKeysForActor() читает Механику предмета напрямую, живьём.
    return;
  }

  if (entry.kind === "reroll" || entry.kind === "testMod" || entry.kind === "capability") {
    // Живой запрос, как terrainIgnore выше: правило собирается в момент броска
    // (rulesFromItemMechanics в module/rules/item-rules.mjs). Писать и
    // откатывать нечего — уйдёт предмет или выключат Локус, и переброс сам
    // перестанет предлагаться.
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
      const filters = {};
      if (entry.equipCategoryPack === "weapons" && entry.equipWeaponType) filters.folderId = entry.equipWeaponType;
      if (entry.equipCategoryPack === "weapons" && entry.equipWeaponProp) filters.weaponProp = entry.equipWeaponProp;
      if (entry.equipCategoryPack === "armor"   && entry.equipArmorType)  filters.armorType = entry.equipArmorType;
      if (entry.equipTalentTier !== "" && entry.equipTalentTier != null)   filters.talentTier = Number(entry.equipTalentTier);
      if (entry.equipMaxPsyRating !== "" && entry.equipMaxPsyRating != null) filters.maxPsyRating = Number(entry.equipMaxPsyRating);
      if (entry.equipCategoryPack === "implants" && entry.equipImplantCategory) filters.implantCategory = entry.equipImplantCategory;
      if (Number.isFinite(Number(entry.equipMaxAvailability))) filters.maxAvailability = Number(entry.equipMaxAvailability);

      const budget = normalizeBudget({ mode: entry.equipBudgetMode, value: entry.equipBudgetValue });
      const picked = await openCompendiumBrowser(false, {
        pack: entry.equipCategoryPack, filters, budget,
        prompt: describeMechEntry(entry),
        // Цена в опыте считается для ЭТОГО актора: у Талантов она зависит от
        // Склонностей и культуры, а не лежит в записи компендиума.
        xpCost: budget.mode === BUDGET_XP ? (it => pickXPCost(actor, it)) : null
      });
      if (!picked) return;
      // Бюджет больше одной штуки — Обозреватель отдаёт список.
      const list = Array.isArray(picked) ? picked : [picked];
      if (list.length > 1) {
        for (const u of list) {
          await applyMechEntry(actor, { ...entry, equipMode: "direct", equipSourceUuid: u, equipQty: 1,
                                        id: `${entry.id}:${u}` }, sourceItem, fromChoice, applied);
        }
        return;
      }
      uuid = list[0];
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
    // «Narthecium (Good.Q)» — качество часть выдачи, а не украшение: от него
    // зависят и Надёжность, и модификаторы. Ставим только там, где поле есть.
    if (entry.equipQuality && entry.equipQuality !== "common"
        && "quality" in (data.system || {})) data.system.quality = entry.equipQuality;
    // equipEntryId — какая именно запись Механики это выдала; читает
    // syncGrantedEquipment ниже, чтобы не плодить дубли и опознавать «своё»
    // при пересинхронизации по активности источника (импланты — installed/disabled).
    data.flags = { ...(data.flags || {}), [FLAG]: { ...(data.flags?.[FLAG] || {}), grantedByItem: sourceItem.id, equipEntryId: entry.id } };
    // Многократный Талант (system.hasRating — Enemy и т.п.), уже взятый
    // раньше, не задваивается: createOrRankTalent поднимает ему ранг вместо
    // создания второго предмета. Для любых других выдач — обычное создание.
    await createOrRankTalent(actor, data);
    return;
  }

  if (entry.kind === "integralAttack") {
    const data = await buildIntegralAttackData(entry, sourceItem);
    if (data) await actor.createEmbeddedDocuments("Item", [data]);
    return;
  }

  if (entry.kind === "loyalty") {
    // Правим ЧУЖИХ акторов — миньонов владельца предмета. Ограничение по типу
    // необязательно: пустое значение означает «любой тип».
    const amount = (entry.loyaltyOp === "subtract" ? -1 : 1) * (Number(entry.loyaltyValue) || 0);
    const targets = minionsOf(actor, [...(game.actors ?? [])])
      .filter(m => !entry.loyaltyMinionType || m.system.minionType === entry.loyaltyMinionType);
    for (const minion of targets) {
      await minion.update({ "system.loyalty.value": loyaltyAfterChange(minion, amount) });
    }
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

  if (entry.kind === "trait" || entry.kind === "talent") {
    const src = await resolveMechSource(entry);
    const data = src ? src.toObject() : {
      name: entry.sourceName || "?", type: entry.kind,
      img: entry.sourceImg || "icons/svg/aura.svg", system: {}
    };
    delete data._id;

    // Привязка «Мастерства» хранится в записи ключом Навыка, а на самом Таланте
    // живёт подписью («Запретные знания (Демоны)»): по ней его читают на листе и
    // с ней же сравнивают повторную выдачу. Разводим одно и другое здесь, до
    // проверки на повтор, — иначе ключ никогда не совпал бы с подписью и второе
    // «Мастерство» тем же Навыком легло бы вторым предметом.
    const isMastery = entry.kind === "talent" && dynamicAptKind(data.name) === "skill";
    const specKey   = entry.specialization || data.system?.specialization || "";
    const spec      = isMastery && specKey ? (masteryLabel(specKey) || specKey) : specKey;

    // Тот же Талант из второго источника повторить нечем — вместо копии
    // возвращается его цена: столько он стоил бы самому персонажу.
    if (entry.kind === "talent") {
      const same = findSameTalent(actor.items, { name: data.name, system: { specialization: spec } });
      if (same) {
        await refundXP(actor, talentCost(actor, same),
          talentReason(same.name, same.system?.specialization));
        return;
      }
    }
    if (entry.kind === "trait") {
      if (entry.rating !== "" && entry.rating != null && data.system) {
        rescaleTraitByRating(data, entry.rating);   // пока system.rating — рейтинг шаблона
        data.system.hasRating = true;
        data.system.rating = Number(entry.rating) || 0;
      }
    } else {
      data.system = {
        ...(data.system || {}),
        specialization: spec,
        granted: true, purchased: false, cost: 0
      };
      // «Мастерство» наследует склонности того Навыка, которым овладело
      // (стр. 62). Выдано оно даром, но склонности всё равно нужны: по ним
      // считается цена следующих покупок, а не его собственная.
      if (isMastery && specKey) {
        const apts = masteryAptitudes(specKey);
        if (apts.length) { data.system.aptitudes = apts; data.system.aptSource = specKey; }
      }
      // Талант Миньона без пары «группа + сила» — Миньон ниоткуда: блок в
      // СОЦИУМе не поймёт, какой это слот, а счётчик занятых поедет.
      if (entry.kind === "talent" && isMinionTalent({ type: "talent", name: data.name })) {
        if (entry.minionGroup && entry.minionTier) {
          const def = MINION_TIERS[entry.minionTier];
          applyMinionSlot(data, {
            group: entry.minionGroup, tier: entry.minionTier,
            talentTier: def?.talentTier ?? 1,
            label: `${MINION_GROUPS[entry.minionGroup]?.label || entry.minionGroup}, ${def?.label || entry.minionTier}`
          });
        } else {
          // Книга называет не всё: «Minion (Средний)» задаёт силу, а группу
          // оставляет на выбор. Недостающее спрашиваем тем же окном, что и при
          // покупке с листа, — выдумывать за книгу нельзя.
          const pick = await promptMinionSlot(actor, src || { name: data.name, system: data.system });
          if (!pick) return;
          // То, что книга назвала, за ней и остаётся: спрашивали недостающее.
          const tier = entry.minionTier || pick.tier;
          const group = entry.minionGroup || pick.group;
          const def = MINION_TIERS[tier];
          applyMinionSlot(data, {
            group, tier, talentTier: def?.talentTier ?? pick.talentTier,
            label: `${MINION_GROUPS[group]?.label || group}, ${def?.label || tier}`
          });
        }
      }
    }
    // abilityEntryId — не для отката при удалении предмета-источника (тот
    // работает по одному grantedByItem), а для ЖИВОЙ пересинхронизации:
    // syncGrantedAbilities ниже по нему отличает свою выдачу от чужой и от
    // копии, которую ГМ положил руками.
    data.flags = { ...(data.flags || {}), [FLAG]: { ...(data.flags?.[FLAG] || {}),
      grantedByItem: sourceItem.id, abilityEntryId: entry.id } };
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
      // Тот же групповой Навык из второго источника: ступень выше, а на
      // потолке — возврат опыта (rules/duplicate-grants.mjs).
      const prev = arr[idx].rank || "untrained";
      const out  = skillGrantOutcome(prev, entry.rank);
      arr[idx].rank        = out.rank;
      arr[idx].grantedRank = higherRank(arr[idx].grantedRank || "untrained", out.rank);
      if (out.refundSteps.length) {
        await refundXP(actor,
          skillStepsCost(actor, entry.skillKey, out.refundSteps, { group: true }),
          skillReason(`${GROUP_SKILLS_DEF[entry.skillKey]?.label || entry.skillKey}`
            + ` (${arr[idx].specialty || arr[idx].specKey || "?"})`, entry.rank, prev));
      }
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
    // Тот же Навык из второго источника поднимает ступень, а на потолке
    // возвращает цену третьей покупки (rules/duplicate-grants.mjs).
    const out = skillGrantOutcome(cur.rank || "untrained", entry.rank);
    const newRank    = out.rank;
    const newGranted = higherRank(cur.grantedRank || "untrained", out.rank);
    if (out.refundSteps.length) {
      await refundXP(actor,
        skillStepsCost(actor, entry.skillKey, out.refundSteps, { entryChar: entry.char }),
        skillReason(SKILLS_DEF[entry.skillKey]?.label || entry.skillKey, entry.rank, cur.rank));
    }
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
  if (_activeMechCollector) return _activeMechCollector.choose(item, entries);
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

/**
 * Данные предмета для записи kind:"integralAttack" — общий сборщик для первой
 * выдачи (applyMechEntry) и для пересинхронизации (syncGrantedEquipment):
 * оба пути обязаны класть на актора ОДИН И ТОТ ЖЕ предмет, иначе снятая и
 * заново выданная интегральная атака отличалась бы от первоначальной.
 *
 * Источник не нашёлся (запись ссылается на удалённый предмет пака) — вернём
 * null и ничего не выдадим: подделывать боевой профиль заглушкой нельзя, в
 * отличие от kind:"equipment", где заглушкой становится безобидный gear.
 */
async function buildIntegralAttackData(entry, sourceItem) {
  const src = entry.equipSourceUuid ? await fromUuid(entry.equipSourceUuid).catch(() => null) : null;
  if (!src) {
    ui.notifications?.warn(`${sourceItem.name}: интегральная атака «${entry.equipSourceName || "?"}» не найдена в компендиуме.`);
    return null;
  }
  const data = src.toObject();
  delete data._id;
  // Надета всегда: и HUD, и вкладка БОЙ отбирают оружие по system.equipped,
  // а снять её игрок не сможет — см. preUpdateItem в warhammer-dbc.mjs.
  data.system = { ...(data.system || {}), equipped: true };
  data.flags = { ...(data.flags || {}), [FLAG]: { ...(data.flags?.[FLAG] || {}),
    grantedByItem: sourceItem.id, equipEntryId: entry.id, integralAttack: true } };
  return data;
}

// Записи, выдающие предмет на актора «намертво»: kind:"equipment" в режиме
// "direct" (фиксированный предмет, не «выбор») и kind:"integralAttack" — из
// АНД-цепочек: верхнеуровневая группа + вложенные АНД-подгруппы.
// ИЛИ-ветки сознательно пропускаются — там выбор делается ОДИН РАЗ диалогом
// в момент выдачи (showMechChoiceDialog/applyMechEntry), переигрывать его
// при каждой пересинхронизации активности источника не нужно и не должно.
function collectDirectEquipmentEntries(groups) {
  const out = [];
  const walk = (entries, operator) => {
    if (operator === "OR") return;
    for (const e of entries) {
      if (e.kind === "integralAttack" && isEntryComplete(e)) out.push(e);
      else if (e.kind === "equipment" && e.equipMode !== "choice" && isEntryComplete(e)) out.push(e);
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
 * и выданное им оружие должно появляться и исчезать вместе с этим
 * состоянием, а не жить вечно после однократной выдачи. Вызывается и из
 * applyItemMechanics (первая выдача — если источник родился неактивным, тут
 * же откатит лишнее), и из мест, переключающих installed/disabled
 * (surgeon.mjs) — тот же приём, что syncItemEffectsDisabled для
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
    if (e.kind === "integralAttack") {
      const data = await buildIntegralAttackData(e, sourceItem);
      if (data) toCreate.push(data);
      continue;
    }
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

// Записи, выдающие Черту или Талант, из тех же АНД-цепочек. ИЛИ-ветки
// пропускаются по той же причине, что и у снаряжения: выбор там сделан один
// раз диалогом, переигрывать его на каждом включении нельзя.
function collectDirectAbilityEntries(groups) {
  const out = [];
  const walk = (entries, operator) => {
    if (operator === "OR") return;
    for (const e of entries) {
      if ((e.kind === "trait" || e.kind === "talent") && isEntryComplete(e)) out.push(e);
      else if (e.kind === "group" && e.group) walk(e.group.entries || [], e.group.operator);
    }
  };
  for (const g of groups) walk(g.entries || [], g.operator);
  return out;
}

/**
 * Живая пересинхронизация выдачи Черт и Талантов с активностью источника —
 * сестра syncGrantedEquipment выше, и заведена ровно тогда, когда у источника
 * появилось выключаемое состояние: подспособность переключаемой способности
 * (Локус Герольда, module/rules/toggle-abilities.mjs). Пока источниками были
 * только Черты, Таланты и Расы, «активен всегда» держалось само собой, и
 * разовой выдачи при createItem хватало.
 *
 * Отличие от первой выдачи (applyMechEntry) сознательное: там Талант умеет
 * не задвоиться и вернуть опыт за совпадение (findSameTalent/refundXP), здесь
 * — нет. Локус даёт Hatred на бой, а не покупает его персонажу: возвращать за
 * него опыт при каждом переключении значило бы печатать опыт кнопкой.
 * Поэтому включение кладёт СВОЮ копию с меткой abilityEntryId, а выключение
 * снимает ровно её, не трогая одноимённый Талант, купленный персонажем.
 */
export async function syncGrantedAbilities(sourceItem) {
  const actor = sourceItem.parent;
  if (!(actor instanceof Actor)) return;
  const entries = collectDirectAbilityEntries(getItemMechanics(sourceItem));
  if (!entries.length) return;

  const grantedNow = actor.items.filter(i =>
    i.getFlag(FLAG, "grantedByItem") === sourceItem.id && i.getFlag(FLAG, "abilityEntryId"));

  if (!isItemActive(sourceItem)) {
    if (grantedNow.length) await actor.deleteEmbeddedDocuments("Item", grantedNow.map(i => i.id));
    return;
  }

  const haveIds = new Set(grantedNow.map(i => i.getFlag(FLAG, "abilityEntryId")));
  const toCreate = [];
  for (const e of entries) {
    if (haveIds.has(e.id)) continue;
    const src = await resolveMechSource(e);
    const data = src ? src.toObject() : {
      name: e.sourceName || "?", type: e.kind,
      img: e.sourceImg || "icons/svg/aura.svg", system: {}
    };
    delete data._id;
    if (e.kind === "trait" && e.rating !== "" && e.rating != null && "rating" in (data.system || {})) {
      data.system.rating = Number(e.rating) || 0;
    }
    if (e.kind === "talent" && e.specialization) data.system.specialization = e.specialization;
    data.flags = { ...(data.flags || {}), [FLAG]: { ...(data.flags?.[FLAG] || {}),
      grantedByItem: sourceItem.id, abilityEntryId: e.id } };
    toCreate.push(data);
  }
  if (toCreate.length) await actor.createEmbeddedDocuments("Item", toCreate);
}

// ── Живая пересборка эффектов ───────────────────────────────────────────────
//
// Долговечные записи — не разовое действие «получил предмет → применили», а
// конфигурация: их эффекты пересобираются при КАЖДОЙ правке Механики, иначе
// настройка предмета, уже лежащего на акторе, никуда не доходит (wdbc-473).
// Тем же приёмом живёт kind:"weaponProp" (syncWeaponPropItemEffects выше).
//
// Разовых записей (Порча, Раны, Слаженность, выдача предмета/Черты/Таланта,
// Код) это не касается: повтор бросил бы кубик заново и выдал второй предмет.
export const DURABLE_MECH_KINDS = new Set(["characteristic", "weight", "movement", "poolMax", "armour"]);

/** Эффект, отыгрывающий одну долговечную запись. Метка — id самой записи. */
function mechEffectData(entry, sourceItem) {
  const changes = [];
  if (entry.kind === "characteristic") {
    const key = characteristicEffectKey(entry);
    changes.push({ key, type: entry.op, value: Number(entry.value) || 0,
                   phase: expectedPhase(key), priority: 0 });
  } else if (entry.kind === "weight") {
    const value = Number(entry.weightValue) || 0;
    if (entry.weightMode === "index") {
      const key = `system.encumbrance.indexBonus.${entry.weightScope}`;
      changes.push({ key, type: "add", value, phase: expectedPhase(key), priority: 0 });
    } else {
      const targets = entry.weightScope === "all" ? ["carry", "lift", "push"] : [entry.weightScope];
      for (const t of targets) {
        const key = `system.encumbrance.${t}`;
        changes.push({ key, type: "add", value, phase: expectedPhase(key), priority: 0 });
      }
    }
  } else if (entry.kind === "movement") {
    const key = entry.movementTarget === "spd"
      ? "system.movement.spdBonus" : `system.movement.${entry.movementTarget}`;
    changes.push({ key, type: entry.op, value: Number(entry.movementValue) || 0,
                   phase: expectedPhase(key), priority: 0 });
  } else if (entry.kind === "poolMax") {
    const key = "system.fate.max";
    changes.push({ key, type: "add", value: Number(entry.value) || 0,
                   phase: expectedPhase(key), priority: 0 });
  } else if (entry.kind === "armour") {
    const locs = entry.armourLocation === "all"
      ? Object.keys(AP_LOCATIONS) : [entry.armourLocation];
    for (const loc of locs) {
      const key = `system.armorBonus.${loc}`;
      changes.push({ key, type: entry.op === "subtract" ? "subtract" : "add",
                     value: Number(entry.armourValue) || 0,
                     phase: expectedPhase(key), priority: 0 });
    }
  }
  return {
    name: describeMechEntry(entry), img: sourceItem.img,
    system: { changes },
    flags: { [FLAG]: { mechEntry: entry.id } }
  };
}

/**
 * Долговечные записи И-цепочек и id ВСЕХ записей предмета.
 *
 * ИЛИ-ветки пропускаются намеренно, как и в collectDirectEquipmentEntries:
 * выбор в них делается ОДИН РАЗ диалогом при получении предмета, и пересборка
 * либо переиграла бы его, либо отыграла бы сразу все альтернативы.
 */
function collectMechEntries(groups) {
  const durable = [], allIds = new Set();
  const walk = (entries, operator) => {
    for (const e of entries || []) {
      allIds.add(e.id);
      if (e.kind === "group" && e.group) { walk(e.group.entries, e.group.operator); continue; }
      if (operator !== "OR" && DURABLE_MECH_KINDS.has(e.kind) && isEntryComplete(e)) durable.push(e);
    }
  };
  for (const g of groups || []) walk(g.entries, g.operator);
  return { durable, allIds };
}

/**
 * Приводит эффекты предмета в соответствие с его Механикой. Идемпотентна:
 * совпало — не пишет. Трогает только СВОИ эффекты (метка mechEntry): ручной
 * эффект ГМа и след миграции остаются на месте.
 */
export async function syncMechanicsEffects(item) {
  const { durable, allIds } = collectMechEntries(getItemMechanics(item));
  const wanted = new Map(durable.map(e => [e.id, mechEffectData(e, item)]));

  const toDelete = [], toCreate = [];
  const seen = new Set();
  for (const fx of item.effects ?? []) {
    const entryId = fx.getFlag?.(FLAG, "mechEntry");
    if (!entryId) continue;
    // Запись убрали с листа — уносим и её эффект.
    if (!allIds.has(entryId)) { toDelete.push(fx.id); continue; }
    const want = wanted.get(entryId);
    if (!want) continue;                       // ИЛИ-ветка либо разовая запись
    seen.add(entryId);
    const same = fx.name === want.name
      && JSON.stringify(fx.system?.changes ?? []) === JSON.stringify(want.system.changes);
    if (!same) { toDelete.push(fx.id); toCreate.push(want); }
  }
  for (const [id, want] of wanted) if (!seen.has(id)) toCreate.push(want);

  if (toDelete.length) await item.deleteEmbeddedDocuments("ActiveEffect", toDelete);
  if (toCreate.length) await item.createEmbeddedDocuments("ActiveEffect", toCreate);
}

/**
 * Применяет ОДНУ группу (И — все записи, ИЛИ с >1 завершённой записью —
 * диалог выбора одной) — общая для верхнеуровневых групп И ВЛОЖЕННЫХ
 * подгрупп (kind:"group"), рекурсия идёт через applyMechEntry ⇄ здесь.
 */
async function applyGroupEntries(actor, group, sourceItem, applied) {
  const entries = (group?.entries || []).filter(isEntryComplete);
  if (!entries.length) return;
  if (group.operator === "OR" && entries.length > 1) {
    // Выбор делается ОДИН раз: если одна из веток уже отыграна, вопрос задан и
    // отвечен — переспрашивать на каждой правке Механики нельзя.
    if (entries.some(e => applied.has(e.id))) return;
    const chosen = await showMechChoiceDialog(sourceItem, entries);
    if (chosen) await applyMechEntry(actor, chosen, sourceItem, true, applied);
  } else {
    for (const e of entries) await applyMechEntry(actor, e, sourceItem, false, applied);
  }
}

/**
 * id записей, чьё РАЗОВОЕ применение уже состоялось.
 *
 * Флаг был булевым «предмет свою механику отработал» — этого хватало, пока
 * применение случалось единственный раз, на createItem. Но настраивают предмет
 * и уже лежащим на акторе (Черта из библиотеки приезжает пустой), и вопрос
 * стоит поштучно: какая ИМЕННО запись уже сработала. Старое `true` читается как
 * «всё, что тогда лежало», иначе первый же прогон на живом мире переиграл бы
 * Порчу, Раны и выдачи по второму разу.
 */
function appliedEntryIds(item) {
  const flag = item.getFlag(FLAG, "mechanicsApplied");
  if (Array.isArray(flag)) return new Set(flag);
  // Читать `true` как «всё, что лежит СЕЙЧАС» можно только один раз, и делает
  // это миграция (materializeMechanicsApplied) — при загрузке мира, когда
  // ничего дописать ещё не успели. Здесь такая же догадка проглотила бы
  // запись, дописанную до первого прогона.
  if (flag === true) return allMechEntryIds(item);
  return new Set();
}

/** id всех записей механики предмета, включая вложенные подгруппы. */
export function allMechEntryIds(item) {
  return collectMechEntries(getItemMechanics(item)).allIds;
}

// Очередь применений — по одной на предмет.
//
// Идемпотентность держится на флаге mechanicsApplied, а он читается в НАЧАЛЕ
// применения и пишется в КОНЦЕ. Пока два применения одного предмета не
// перекрывались, этого хватало. Но стартов бывает несколько и они независимы:
// прямой вызов из applyRace рядом с хуком createItem (для этого и заведён
// SKIP_MECHANICS_HOOK), а на холодном мире — и просто два хука, разошедшиеся
// во времени из-за сетевых round-trip'ов на каждую выдачу. Оба читают ещё
// ПУСТОЙ флаг, оба считают себя первыми и оба выдают всё целиком: Черта
// Геносемя раздавала 38 органов вместо 19, архетип Апотекарий — два Нартеция.
// Ловилось только вживую: Hooks в тестовом стенде — пустышка, и одиночный
// прогон ничего про эту гонку не доказывал.
//
// Лечится не подавлением второго вызова, а его ОЧЕРЕДЬЮ: второй ждёт первого и
// начинает, когда флаг уже записан, — то есть видит применённое и пропускает
// его. Законный повтор (ГМ дописал запись на листе) при этом работает как
// прежде, просто не внахлёст. Ключ — uuid: он уникален и у вложенных
// предметов, тогда как id повторяется между акторами.
const _mechRuns = new Map();

export function applyItemMechanics(item) {
  const key = item?.uuid || item?.id;
  if (!key) return _applyItemMechanics(item);
  // Провал предыдущего применения не должен рвать очередь следующему.
  const run = (_mechRuns.get(key) ?? Promise.resolve())
    .catch(() => {})
    .then(() => _applyItemMechanics(item));
  _mechRuns.set(key, run);
  // Хвост очереди убираем, только если за это время его не сменил новый вызов.
  run.catch(() => {}).finally(() => { if (_mechRuns.get(key) === run) _mechRuns.delete(key); });
  return run;
}

/**
 * Применяет механику предмета к актору. Зовётся из хуков createItem и
 * updateItem (warhammer-dbc.mjs): дописать запись на предмет, который УЖЕ у
 * актора, — обычный сценарий, и он обязан работать так же, как настройка
 * предмета в списке мира до броска на лист.
 */
async function _applyItemMechanics(item) {
  const actor = item.parent;
  if (!(actor instanceof Actor)) return;

  const applied = appliedEntryIds(item);
  const before  = applied.size;
  for (const group of getItemMechanics(item)) await applyGroupEntries(actor, group, item, applied);
  await syncMechanicsEffects(item);
  await syncWeaponPropItemEffects(item);
  // Источник мог родиться неактивным (напр. Имплант создан ещё не
  // установленным) — откатывает то, что applyMechEntry(equipment) уже
  // успел выдать выше, чтобы конечное состояние сразу было верным.
  await syncGrantedEquipment(item);
  // Пишем, только если что-то действительно отыгралось: иначе каждый прогон
  // правил бы предмет и будил хук updateItem по кругу.
  if (applied.size !== before) await item.setFlag(FLAG, "mechanicsApplied", [...applied]);
}

// ── HTML-разметка вкладки (собирается в JS, не в .hbs — см. обоснование в
// истории doombc-grants-system: форма записи слишком по-разному выглядит
// по kind, глубокая вложенная логика на чистом Handlebars была бы хрупкой
// без возможности живого рендера). Инжектируется через {{{ }}}.

function optHtml(value, label, selected) {
  return `<option value="${esc(value)}" ${selected ? "selected" : ""}>${esc(label)}</option>`;
}

function buildEntryFieldsHtml(groupId, ent, canEdit) {
  const dis = canEdit ? "" : "disabled";
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
         ${canEdit ? `<button type="button" class="grant-drop-clear" data-action="grantDropClear" data-group-id="${groupId}" data-entry-id="${ent.id}" title="Убрать предмет">✕</button>` : ""}`
      : `<span class="grant-drop-placeholder">${canEdit ? `Перетащите ${ent.kind === "trait" ? "Черту" : "Талант"} сюда` : "—"}</span>`;
    let out = `<div class="grant-drop-zone" data-group-id="${groupId}" data-entry-id="${ent.id}">${dropInner}</div>`;
    if (ent.kind === "trait" && ent.sourceHasRating) {
      out += `<input type="number" class="grant-entry-rating" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.rating ?? "")}" placeholder="Рейтинг" ${dis}/>`;
    }
    if (ent.kind === "talent" && ent.sourceUuid) {
      // «Мастерство» владеет конкретным Навыком (стр. 62), и от того, каким,
      // зависят его склонности и цена. Поэтому у него не строка, а список: с
      // произвольной подписью привязку было бы не с чем сверить.
      // «Миньон Хаоса» — один Талант на двадцать слуг: пара «группа + сила»
      // решает и уровень Таланта, и что покажет блок в СОЦИУМе.
      if (isMinionTalent({ type: "talent", name: ent.sourceName })) {
        const gOpts = Object.entries(MINION_GROUPS)
          .map(([k, d]) => optHtml(k, d.label, (ent.minionGroup || "") === k)).join("");
        const tOpts = Object.entries(MINION_TIERS)
          .map(([k, d]) => optHtml(k, d.label, (ent.minionTier || "") === k)).join("");
        out += `<select class="mech-minion-group" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>
            ${optHtml("", "— группа —", !ent.minionGroup)}${gOpts}</select>
          <select class="mech-minion-tier" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>
            ${optHtml("", "— сила —", !ent.minionTier)}${tOpts}</select>`;
      } else if (dynamicAptKind(ent.sourceName) === "skill") {
        const opts = masteryTargets()
          .map(t => optHtml(t.key, t.label, ent.specialization === t.key)).join("");
        out += `<select class="grant-entry-spec" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>
          ${optHtml("", "— выберите Навык —", !ent.specialization)}${opts}</select>`;
      } else {
        out += `<input type="text" class="grant-entry-spec" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.specialization || "")}" placeholder="Специализация" ${dis}/>`;
      }
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

  if (ent.kind === "armour") {
    const locOpts = [optHtml("all", "Все локации", (ent.armourLocation || "body") === "all")]
      .concat(Object.entries(AP_LOCATIONS)
        .map(([k, l]) => optHtml(k, l, (ent.armourLocation || "body") === k))).join("");
    const opOpts = CORRUPTION_OP_OPTIONS.map(o => optHtml(o.value, o.label, (ent.op || "add") === o.value)).join("");
    return `<select class="mech-armour-loc" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${locOpts}</select>
      <select class="mech-armour-op" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${opOpts}</select>
      <input type="number" class="mech-armour-value" step="1" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.armourValue ?? "")}" ${dis}/>`;
  }

  if (ent.kind === "terrainIgnore") {
    const chosen = new Set(ent.ignoreTerrainProps || []);
    const opts = TERRAIN_PROPS.map(p =>
      `<option value="${esc(p.key)}" ${chosen.has(p.key) ? "selected" : ""}>${esc(p.label)} (${p.mod >= 0 ? "+" : ""}${p.mod})</option>`
    ).join("");
    return `<select class="mech-terrain-ignore" multiple size="6" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${opts}</select>`;
  }

  if (ent.kind === "capability") {
    const opts = CAPABILITY_OPTIONS
      .map(([k, l]) => `<option value="${esc(k)}" ${ent.capabilityKey === k ? "selected" : ""}>${esc(l)}</option>`).join("");
    return `<select class="mech-capability-key" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>
        <option value="">— возможность —</option>${opts}</select>
      <input type="text" class="mech-reroll-label" placeholder="подпись" value="${esc(ent.label || "")}"
             data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}/>`;
  }

  if (ent.kind === "testMod") {
    const scopeOpts = REROLL_SCOPES
      .map(([v, l]) => `<option value="${v}" ${ent.modScope === v ? "selected" : ""}>${esc(l)}</option>`).join("");
    const modeOpts = [["flat", "число"], ["charBonus", "бонус характеристики"]]
      .map(([v, l]) => `<option value="${v}" ${ent.modValueMode === v ? "selected" : ""}>${esc(l)}</option>`).join("");
    const charSel = (cls, val) => `<select class="${cls}" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${
      Object.entries(CHARACTERISTICS).map(([k, c]) =>
        `<option value="${k}" ${val === k ? "selected" : ""}>${esc(c.label || k)}</option>`).join("")}</select>`;
    let detail = "";
    if (ent.modScope === "char") detail = charSel("mech-reroll-char", ent.rerollChar);
    else if (ent.modScope === "skill") {
      detail = `<select class="mech-reroll-skill" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>
        <option value="">— навык —</option>${Object.entries(SKILLS_DEF).map(([k, d]) =>
          `<option value="${k}" ${ent.skillKey === k ? "selected" : ""}>${esc(d.label || k)}</option>`).join("")}</select>`;
    }
    const valueField = ent.modValueMode === "charBonus"
      ? charSel("mech-mod-char", ent.modCharBonus)
      : `<input type="number" class="mech-entry-value" value="${esc(ent.value)}"
                data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}/>`;
    return `<select class="mech-mod-scope" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${scopeOpts}</select>
      ${detail}
      <select class="mech-mod-valuemode" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${modeOpts}</select>
      ${valueField}
      <input type="text" class="mech-reroll-label" placeholder="подпись в диалоге" value="${esc(ent.label || "")}"
             data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}/>`;
  }

  if (ent.kind === "reroll") {
    const scopeOpts = REROLL_SCOPES
      .map(([v, l]) => `<option value="${v}" ${ent.rerollScope === v ? "selected" : ""}>${esc(l)}</option>`).join("");
    const modeOpts = [["keepBest", "лучший из двух"], ["keepWorst", "худший из двух"]]
      .map(([v, l]) => `<option value="${v}" ${ent.rerollMode === v ? "selected" : ""}>${esc(l)}</option>`).join("");
    // Уточнение показывается только там, где оно есть: у «любого теста»,
    // атаки, Инициативы и социальных навыков области хватает самой по себе.
    let detail = "";
    if (ent.rerollScope === "char") {
      const opts = Object.entries(CHARACTERISTICS)
        .map(([k, c]) => `<option value="${k}" ${ent.rerollChar === k ? "selected" : ""}>${esc(c.label || k)}</option>`).join("");
      detail = `<select class="mech-reroll-char" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${opts}</select>`;
    } else if (ent.rerollScope === "skill") {
      const opts = Object.entries(SKILLS_DEF)
        .map(([k, d]) => `<option value="${k}" ${ent.skillKey === k ? "selected" : ""}>${esc(d.label || k)}</option>`).join("");
      detail = `<select class="mech-reroll-skill" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>
        <option value="">— навык —</option>${opts}</select>`;
    }
    const whoOpts = [["self", "свой бросок"], ["target", "навязать цели"]]
      .map(([v, l]) => `<option value="${v}" ${ent.rerollWho === v ? "selected" : ""}>${esc(l)}</option>`).join("");
    return `<select class="mech-reroll-scope" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${scopeOpts}</select>
      ${detail}
      <select class="mech-reroll-who" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${whoOpts}</select>
      <select class="mech-reroll-mode" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${modeOpts}</select>
      <input type="text" class="mech-reroll-label" placeholder="подпись в диалоге" value="${esc(ent.label || "")}"
             data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}/>`;
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

  if (ent.kind === "integralAttack") {
    // Тот же класс, что у «Снаряжения»: обработчик .mech-equip-source в
    // item-sheet.mjs пишет equipSourceUuid/Name по id группы и записи, вида
    // записи не касаясь, — своего слушателя тут заводить незачем.
    return `<select class="mech-equip-source" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>
      <option value="">— выберите оружие —</option>
      ${equipmentOptionsHtml(ent.equipSourceUuid, ["weapons"])}
    </select>`;
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
      if (cat === "talents") {
        // «7 талантов 1 уровня» — это ступень Таланта, а не его цена.
        const tierOpts = [`<option value="">— любая ступень —</option>`]
          .concat([1, 2, 3].map(t => optHtml(String(t), `Ступень ${t}`, String(ent.equipTalentTier ?? "") === String(t)))).join("");
        out += `<select class="mech-equip-tier" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${tierOpts}</select>`;
      }
      if (cat === "psychic-powers") {
        out += `<input type="number" class="mech-equip-pr" min="0" step="1" placeholder="до ПР"
          data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.equipMaxPsyRating ?? "")}" ${dis}/>`;
      }
      const availOpts = Object.entries(AVAILABILITY)
        .map(([v, l]) => optHtml(v, l, String(ent.equipMaxAvailability ?? 5) === v)).join("");
      out += `<select class="mech-equip-avail" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${availOpts}</select>`;

      // Бюджет: штуками («7 талантов») или опытом («500хр на Психосилы»).
      const bmOpts = BUDGET_MODES.map(m => optHtml(m.key, m.label, (ent.equipBudgetMode || "count") === m.key)).join("");
      out += `<select class="mech-equip-budget-mode" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${bmOpts}</select>
        <input type="number" class="mech-equip-budget-value" min="0" step="1" placeholder="Бюджет"
          data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.equipBudgetValue ?? 1)}" ${dis}/>`;
    }
    // Качество — часть выдачи: «Narthecium (Good.Q)» отличается от обычного и
    // Надёжностью, и модификаторами.
    const qOpts = ITEM_QUALITY_LIST
      .map(k => optHtml(k, ITEM_QUALITY[k].label, (ent.equipQuality || "common") === k)).join("");
    out += `<select class="mech-equip-quality" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${qOpts}</select>`;
    if (mode === "direct") {
      out += `<input type="number" class="mech-equip-qty" min="1" step="1" placeholder="Кол-во" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.equipQty ?? 1)}" ${dis}/>`;
    }
    return out;
  }

  if (ent.kind === "loyalty") {
    const typeOpts = [`<option value="">— любой тип —</option>`]
      .concat(Object.entries(MINION_TYPES)
        .map(([k, d]) => optHtml(k, d.label, (ent.loyaltyMinionType || "") === k))).join("");
    const opOpts = CORRUPTION_OP_OPTIONS
      .map(o => optHtml(o.value, o.label, (ent.loyaltyOp || "add") === o.value)).join("");
    return `<select class="mech-loyalty-type" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${typeOpts}</select>
      <select class="mech-loyalty-op" data-group-id="${groupId}" data-entry-id="${ent.id}" ${dis}>${opOpts}</select>
      <input type="number" class="mech-loyalty-value" data-group-id="${groupId}" data-entry-id="${ent.id}" value="${esc(ent.loyaltyValue ?? 1)}" ${dis}/>`;
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
           ${canEdit ? `<button type="button" class="wprop-drop-clear" data-action="wpropDropClear" data-group-id="${groupId}" data-entry-id="${ent.id}" data-slot="${slot}" title="Убрать">✕</button>` : ""}`
        : `<span class="grant-drop-placeholder">${canEdit ? "Перетащите Свойство оружия сюда" : "—"}</span>`;
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

/**
 * <select> выбора навыка: обычные и групповые двумя optgroup, значение
 * кодируется как «scope:key». Один и тот же список нужен обоим конструкторам
 * предмета — Механике и Требованиям, — а различаются они только классом и
 * набором data-атрибутов, поэтому и те и другие приходят параметром
 * (wdbc-c4o). Специализация сюда не входит: у Механики в ней есть «Своя…» и
 * «По выбору при получении…», у Требований — «любая», и это разные списки.
 */
function skillRefSelectHtml(cls, dataAttrs, ent, dis) {
  const curVal = ent.skillKey ? `${ent.skillScope}:${ent.skillKey}` : "";
  const plainOpts = Object.entries(SKILLS_DEF).map(([k, d]) => optHtml(`plain:${k}`, d.label, curVal === `plain:${k}`)).join("");
  const groupOpts = Object.entries(GROUP_SKILLS_DEF).map(([k, d]) => optHtml(`group:${k}`, d.label, curVal === `group:${k}`)).join("");
  return `<select class="${cls}" ${dataAttrs} ${dis}>
    <option value="">— выберите навык —</option>
    <optgroup label="Обычные">${plainOpts}</optgroup>
    <optgroup label="Групповые">${groupOpts}</optgroup>
  </select>`;
}

/** Дроплисты выбора навыка (+специализации, для групповых) — общие для kind:"skill" и kind:"rollmod". */
function buildSkillSelectorHtml(groupId, ent, dis) {
  let out = skillRefSelectHtml("grant-entry-skillref",
    `data-group-id="${groupId}" data-entry-id="${ent.id}"`, ent, dis);
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
    // из них диалогом в момент получения предмета (resolveEntrySpecChoice).
    // Сколько именно — задаёт счётчик: у рас сплошь «Общие знания (любые 4)»,
    // и четырьмя отдельными записями это не написать — диалог четырежды
    // предложил бы тот же список, а повторный выбор занял бы один слот.
    if (isChoice) {
      const chosen = new Set(ent.specChoiceKeys || []);
      out += `<label class="grant-spec-choice-count" title="Сколько РАЗНЫХ специализаций выбирает актор при получении">
        любые <input type="number" class="grant-entry-spec-count" data-group-id="${groupId}" data-entry-id="${ent.id}"
                     min="1" value="${Math.max(1, Number(ent.specChoiceCount) || 1)}" ${dis}/>
      </label>`;
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
function buildEntryHtml(groupId, ent, canEdit, depth = 1) {
  const kindEntries = Object.entries(KIND_LABELS)
    .filter(([k]) => k !== "group" || ent.kind === "group" || depth < MAX_GROUP_DEPTH);
  const kindOpts = kindEntries.map(([k, l]) => optHtml(k, l, ent.kind === k)).join("");
  const isScript = ent.kind === "script";
  const isGroup  = ent.kind === "group";
  return `<div class="grant-entry ${isScript ? "grant-entry-script" : ""} ${isGroup ? "grant-entry-group" : ""}" data-group-id="${groupId}" data-entry-id="${ent.id}">
    <div class="grant-entry-row">
      <select class="grant-entry-kind" data-group-id="${groupId}" data-entry-id="${ent.id}" ${canEdit ? "" : "disabled"}>${kindOpts}</select>
      ${buildEntryFieldsHtml(groupId, ent, canEdit)}
      ${canEdit ? `<button type="button" class="grant-entry-remove" data-action="grantEntryRemove" data-group-id="${groupId}" data-entry-id="${ent.id}" title="Удалить запись">✕</button>` : ""}
    </div>
    <div class="grant-entry-preview">${esc(describeMechEntry(ent))}</div>
    ${isGroup ? buildGroupHtml(ent.group || blankMechGroup(), canEdit, depth + 1, true) : ""}
  </div>`;
}

/**
 * nested — true для подгрупп (kind:"group" внутри записи): скрывает кнопку
 * «✕ Удалить группу» (удаление — через «✕» самой записи-контейнера у
 * родителя, отдельной кнопки не нужно), но оставляет переключатель И/ИЛИ.
 */
function buildGroupHtml(grp, canEdit, depth = 1, nested = false) {
  const entriesHtml = (grp.entries || []).map(e => buildEntryHtml(grp.id, e, canEdit, depth)).join("")
    || `<div class="grant-empty-hint"><em>Записей нет</em></div>`;
  const opHint = grp.operator === "OR" ? "актор выбирает одну запись" : "применяются все записи";
  return `<div class="grant-group ${nested ? "grant-group-nested" : ""}" data-group-id="${grp.id}">
    <div class="grant-group-head">
      <span class="grant-op-badge grant-op-${grp.operator}">${grp.operator === "OR" ? "ИЛИ" : "И"}</span>
      <span class="grant-op-hint">${opHint}</span>
      ${canEdit ? `<button type="button" class="grant-op-toggle" data-action="grantOpToggle" data-group-id="${grp.id}" title="Переключить И/ИЛИ">⇄</button>` : ""}
      ${canEdit && !nested ? `<button type="button" class="grant-group-remove" data-action="grantGroupRemove" data-group-id="${grp.id}" title="Удалить группу">✕</button>` : ""}
    </div>
    <div class="grant-entries">${entriesHtml}</div>
    ${canEdit ? `<button type="button" class="grant-entry-add" data-action="grantEntryAdd" data-group-id="${grp.id}">➕ Запись</button>` : ""}
  </div>`;
}

/**
 * Записать механику предмета. Настраивают её все за столом, а не один Мастер:
 * Черты, Таланты и снаряжение лежат в компендиумах и в мире, и своими для
 * игрока не бывают. Клиенту чужой предмет писать не дают, поэтому без прав на
 * документ правка уходит Мастеру по системному сокету (обработчик —
 * warhammer-dbc.mjs), а он пишет её у себя.
 *
 * Досчёт system.effects.mechAddProps/mechRemoveProps идёт при КАЖДОМ
 * сохранении, а не только из полей weaponProp: иначе смена kind или удаление
 * записи не подчистили бы то, что раньше построил kind:"weaponProp".
 *
 * Пересборку эффектов отсюда НЕ зовём: на неё подписан хук updateItem — он
 * ловит любую правку Механики, не только с листа предмета.
 */
export async function saveItemMechanics(item, groups) {
  if (!item) return;
  if (item.isOwner) {
    await item.setFlag("warhammer-dbc", "mechanics", groups);
    await syncWeaponPropItemEffects(item);
    return;
  }
  if (!game.users?.activeGM) {
    return ui.notifications?.warn(
      "Правка не сохранена: предмет не ваш, а Мастера нет в игре — записать её некому.");
  }
  game.socket?.emit("system.warhammer-dbc",
    { action: "itemMechanics", uuid: item.uuid, groups, userId: game.user.id });
}

/**
 * Собирает HTML всех групп механики предмета — идёт в контекст листа предмета.
 * `canEdit` — можно ли вообще править этот предмет: запертый компендиум не
 * перепишет и Мастер. Роль здесь ни при чём — механику настраивают все.
 */
export function buildMechanicsTabHtml(item, canEdit) {
  return getItemMechanics(item).map(g => buildGroupHtml(g, canEdit)).join("");
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
  reqPatron:     "Покровительство Бога",
  reqCapability: "Возможность"
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
    raceKey: "", archetypeName: "", patronKey: "",
    // reqCapability — имя из constants/capabilities.mjs. Так книжное «доступно
    // только пилоту Дредноута» становится проверяемым условием, а не примечанием.
    capabilityKey: ""
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
      return e.raceKey ? `Раса: ${raceDef(e.raceKey)?.label || e.raceKey}` : "Раса: (не выбрана)";
    case "reqArchetype":
      return e.archetypeName ? `Элитный архетип: ${e.archetypeName}` : "Элитный архетип: (не выбран)";
    case "reqPatron":
      return e.patronKey
        ? `Покровительство: ${WARP_GODS_MAP[e.patronKey]?.label || e.patronKey}`
        : "Покровительство: (не выбрано)";
    case "reqCapability":
      return e.capabilityKey
        ? (CAPABILITIES[e.capabilityKey]?.label || e.capabilityKey)
        : "Возможность: (не выбрана)";
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
    case "reqCapability": return !!e.capabilityKey;
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
    // Возможность спрашивается у общего реестра правил (module/rules/flags.mjs),
    // а не у полей актора: «пилот Дредноута» — это ссылка с ЧУЖОГО актора
    // (место экипажа саркофага), и в system персонажа её нет вовсе.
    case "reqCapability":
      return hasRuleFlag(actor, e.capabilityKey);
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
      const ranks = Object.entries(SKILL_RANKS).map(([k, def]) => optHtml(k, def.label, (e.rank || "knows") === k)).join("");
      let out = skillRefSelectHtml("req-skillref", d, e, dis)
        + `<select class="req-rank" ${d} ${dis}>${ranks}</select>`;
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
           ${dis ? "" : `<button type="button" class="req-drop-clear" data-action="reqDropClear" ${d} title="Убрать">✕</button>`}`
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
      const opts = Object.values(raceEntries()).map(r => optHtml(r.key, r.label, e.raceKey === r.key)).join("");
      return `<select class="req-race" ${d} ${dis}><option value="">— выберите расу —</option>${opts}</select>`;
    }
    case "reqArchetype": {
      const names = [...new Set(ELITE_ARCHETYPES.map(a => a.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
      const opts = names.map(n => optHtml(n, n, e.archetypeName === n)).join("");
      return `<select class="req-archetype" ${d} ${dis}><option value="">— выберите архетип —</option>${opts}</select>`;
    }
        case "reqCapability": {
      const opts = CAPABILITY_OPTIONS
        .map(([k, l]) => `<option value="${esc(k)}" ${e.capabilityKey === k ? "selected" : ""}>${esc(l)}</option>`).join("");
      return `<select class="req-capability-key" ${d} ${dis}>
        <option value="">— возможность —</option>${opts}</select>`;
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
        ${isGM ? `<button type="button" class="req-entry-remove" data-action="reqEntryRemove" data-req="${reqKey}" data-group-id="${grp.id}" data-entry-id="${e.id}" title="Удалить условие">✕</button>` : ""}
      </div>
      <div class="grant-entry-preview">${esc(describeReqEntry(e))}</div>
    </div>`;
  }).join("") || `<div class="grant-empty-hint"><em>Условий нет</em></div>`;

  const opHint = grp.operator === "OR" ? "достаточно одного условия" : "нужны все условия";
  return `<div class="grant-group" data-req="${reqKey}" data-group-id="${grp.id}">
    <div class="grant-group-head">
      <span class="grant-op-badge grant-op-${grp.operator}">${grp.operator === "OR" ? "ИЛИ" : "И"}</span>
      <span class="grant-op-hint">${opHint}</span>
      ${isGM ? `<button type="button" class="req-op-toggle" data-action="reqOpToggle" ${d} title="Переключить И/ИЛИ">⇄</button>` : ""}
      ${isGM ? `<button type="button" class="req-group-remove" data-action="reqGroupRemove" ${d} title="Удалить группу">✕</button>` : ""}
    </div>
    <div class="grant-entries">${entries}</div>
    ${isGM ? `<div class="mech-group-add-row">
      <button type="button" class="req-entry-add" data-action="reqEntryAdd" ${d}>➕ Условие</button>
    </div>` : ""}
  </div>`;
}

/** Собирает HTML всех групп требований предмета — идёт в контекст листа. */
export function buildRequirementsHtml(item, flagKey, isGM) {
  const groups = getItemRequirements(item, flagKey);
  if (!groups.length) return `<div class="grant-empty-hint"><em>Требований нет — доступно всем</em></div>`;
  return groups.map(g => buildReqGroupHtml(flagKey, g, isGM)).join("");
}
