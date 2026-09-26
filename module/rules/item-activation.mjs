// module/rules/item-activation.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Включаемая способность с ценой и сроком — арифметика без Foundry.
//
//  «Слаангор может за полное действие потратить Очко Бесчестия, чтобы
//  превратить одну из своих рук в … Он может за полное действие превратить
//  эту руку обратно в обычную бесплатно. В конце боя или сцены эта рука
//  автоматически превращается в обычную» (корбук гл. I, субрасы Зверолюда).
//  Та же формула у Пестигора (полное действие) и Кхорнгора (свободное).
//
//  Данные — system.activation (data/item/_activation.mjs). Здесь:
//    activationSpec  — нормализованная цена/срок предмета;
//    activationPlan  — что стоит нажатие тумблера прямо сейчас;
//    activationLabel — подсказка на кнопке листа;
//    endsWithCombat  — какие включённые предметы гасит конец боя.
//  Foundry-обвязка (списание, синхронизация выдач, хук конца боя) —
//  combat/item-activation.mjs.
// ════════════════════════════════════════════════════════════════════════════

/** Срок «до конца боя или сцены» — гасит хук deleteCombat. */
export const UNTIL_COMBAT = "combat";

const ACTION_WORD = { 0: "свободное действие", 1: "полудействие", 2: "полное действие" };
const POOL_GENITIVE = { infamy: "Бесчестия", fate: "Судьбы", pain: "Боли" };

/** Нормализованные цена и срок включения предмета. */
export function activationSpec(item) {
  const a = item?.system?.activation ?? {};
  const pool = String(a.costPool || "");
  return {
    cost: pool ? { pool, amount: Math.max(1, Number(a.costAmount) || 1) } : null,
    apOn: Math.max(0, Number(a.apOn) || 0),
    apOff: Math.max(0, Number(a.apOff) || 0),
    until: String(a.until || "")
  };
}

/**
 * Что стоит нажатие тумблера: включение — цена в пуле и apOn, выключение —
 * только apOff (книга: «обратно — бесплатно»). ОД в расчёт идут всегда,
 * решает ли их тратить экономика действий (вне боя — нет).
 */
export function activationPlan(item) {
  const spec = activationSpec(item);
  const turnOn = !item?.system?.active;
  return {
    turnOn,
    cost: turnOn ? spec.cost : null,
    ap: turnOn ? spec.apOn : spec.apOff
  };
}

function amountWord(n) {
  const m = Math.abs(n) % 100, d = m % 10;
  if (m > 10 && m < 20) return "Очков";
  if (d === 1) return "Очко";
  if (d >= 2 && d <= 4) return "Очка";
  return "Очков";
}

/** «Включить: полное действие + 1 Очко Бесчестия, до конца боя. Выключить: полное действие». */
export function activationLabel(item) {
  const spec = activationSpec(item);
  if (!spec.cost && !spec.apOn && !spec.apOff && !spec.until) return "";
  const on = [ACTION_WORD[spec.apOn] ?? `${spec.apOn} ОД`];
  if (spec.cost) on.push(`${spec.cost.amount} ${amountWord(spec.cost.amount)} ${POOL_GENITIVE[spec.cost.pool] || spec.cost.pool}`);
  const tail = spec.until === UNTIL_COMBAT ? ", до конца боя или сцены" : "";
  return `Включить: ${on.join(" + ")}${tail}. Выключить: ${ACTION_WORD[spec.apOff] ?? `${spec.apOff} ОД`}, бесплатно.`;
}

/** Включённые предметы, которые гаснут с концом боя. */
export function endsWithCombat(items) {
  return [...(items ?? [])].filter(i => i?.system?.activatable && i.system.active
    && activationSpec(i).until === UNTIL_COMBAT);
}
