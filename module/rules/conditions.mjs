// module/rules/conditions.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Condition — момент срабатывания блока Requirement+Condition+Effect
//  (doombc-req-condition-effect-plan, Атлас Механики часть IV/II).
//
//  МОДЕЛЬ: Condition НЕ опрашивает состояние сам и НЕ подписывается на хуки —
//  он описывает, на какое СОБЫТИЕ реагирует, а `conditionMatches()` чистой
//  функцией сравнивает его с уже случившимся событием (см. event ниже). Живой
//  код в месте события (createItem/deleteItem, resolveTest, testOutcome(),
//  applyDamageToActor, rules/wounds.mjs, isItemActive, reconcileCohesionFor-
//  Actor и т.п.) должен САМ собрать событие и позвать conditionMatches —
//  это НЕ реализовано в этой правке (следующий шаг, см. подвал файла).
//
//  Для каждого вида отмечено, есть ли уже готовая опора в коде (Атлас часть II):
//    onGrant/onRemove        — да, createItem/deleteItem (warhammer-dbc.mjs)
//    onRoll                  — да, item-rules.mjs уже строит rules-движок
//    onTestResult            — да, module/rules/roll-outcome.mjs testOutcome()
//    onActivate               — да, isItemActive()/armor-mod паттерн
//    onSquadRole              — да, squadRoleOf()/reconcileCohesionForActor()
//    onResourceSpend           — да, module/rules/fate-save.mjs
//    onIncomingDamage          — да, applyDamageToActor incomingDamageReduction
//    onWoundsLoss              — да, module/rules/wounds.mjs
//    onAttach                  — НЕТ, installGearMod()/uninstallGearMod() не
//                                 трогают ни Механику, ни Condition вообще
//
//  event = { kind, ...уточнения по виду (см. conditionMatches) }.
// ════════════════════════════════════════════════════════════════════════════

export const CONDITION_KINDS = [
  { key: "onGrant",         label: "При получении предмета",        support: "ready" },
  { key: "onRemove",        label: "При удалении предмета",         support: "ready" },
  { key: "onRoll",          label: "При тесте/броске",               support: "ready" },
  { key: "onTestResult",    label: "Успех/провал теста",             support: "ready" },
  { key: "onActivate",      label: "Активация способности",          support: "ready" },
  { key: "onSquadRole",     label: "Роль/Слаженность в Отряде",      support: "ready" },
  { key: "onResourceSpend", label: "Трата Очка Судьбы/Бесчестья",    support: "ready" },
  { key: "onIncomingDamage",label: "Входящий урон",                  support: "ready" },
  { key: "onWoundsLoss",    label: "Понижение Ран",                  support: "ready" },
  { key: "onAttach",        label: "Установлен на носитель (мод)",   support: "missing" }
];

const KIND_KEYS = new Set(CONDITION_KINDS.map(k => k.key));

/** Есть ли уже готовая точка встраивания в коде для этого вида (Атлас часть II). */
export function conditionSupport(kind) {
  return CONDITION_KINDS.find(k => k.key === kind)?.support || "missing";
}

export function blankCondition(kind = "onGrant") {
  return {
    kind: KIND_KEYS.has(kind) ? kind : "onGrant",
    // onTestResult
    outcome: "success", // "success" | "fail"
    // onActivate
    activateTo: "active", // "active" | "inactive"
    // onSquadRole
    squadRole: "any", // "any" | "leader" | "commander" | "coordinator" | "subordinate"
    // onAttach
    attachTo: "attached" // "attached" | "detached"
  };
}

const ROLE_LABEL = { any: "любая роль", leader: "Лидер", commander: "Командир", coordinator: "Координатор", subordinate: "рядовой" };

export function describeCondition(condition) {
  const def = CONDITION_KINDS.find(k => k.key === condition?.kind);
  if (!def) return "?";
  switch (condition.kind) {
    case "onTestResult":
      return `${def.label}: ${condition.outcome === "fail" ? "провал" : "успех"}`;
    case "onActivate":
      return `${def.label}: ${condition.activateTo === "inactive" ? "выключена" : "включена"}`;
    case "onSquadRole":
      return `${def.label}: ${ROLE_LABEL[condition.squadRole] || condition.squadRole}`;
    case "onAttach":
      return `${def.label}: ${condition.attachTo === "detached" ? "снят" : "установлен"}`;
    default:
      return def.label;
  }
}

/**
 * Подходит ли Condition блока к уже случившемуся событию.
 * @param {object} condition  запись блока (см. blankCondition)
 * @param {object} event      { kind, outcome?, active?, squadRole?, attached? }
 */
export function conditionMatches(condition, event) {
  if (!condition || !event || condition.kind !== event.kind) return false;
  switch (condition.kind) {
    case "onTestResult":
      return condition.outcome === event.outcome;
    case "onActivate":
      return condition.activateTo === (event.active ? "active" : "inactive");
    case "onSquadRole":
      return condition.squadRole === "any" || condition.squadRole === event.squadRole;
    case "onAttach":
      return condition.attachTo === (event.attached ? "attached" : "detached");
    default:
      return true; // onGrant/onRemove/onRoll/onResourceSpend/onIncomingDamage/onWoundsLoss — без уточнений
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  СЛЕДУЮЩИЙ ШАГ (НЕ в этой правке): живая врезка `conditionMatches()` в
//  фактические точки события — createItem/deleteItem (warhammer-dbc.mjs),
//  testOutcome() (roll-outcome.mjs), isItemActive()/syncItemEffectsDisabled
//  (apps/effects.mjs), reconcileCohesionForActor (apps/mechanics.mjs),
//  fate-save.mjs, applyDamageToActor (combat/damage.mjs), rules/wounds.mjs —
//  и НОВАЯ точка под onAttach в installGearMod/uninstallGearMod (sheets/tabs/
//  gear.mjs), которой сейчас нет вообще. Не сделано здесь намеренно: каждый
//  из этих файлов сегодня активно правят параллельные сессии — см.
//  doombc-packs-src-concurrent-session-collision.
// ════════════════════════════════════════════════════════════════════════════
