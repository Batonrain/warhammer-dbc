// module/combat/capability-cost.mjs
// ════════════════════════════════════════════════════════════════════════
//  Цена в пуле у записи Конструктора kind:"capability" (wdbc-1dc8, стр. 438
//  и далее — десятки способностей текста «стоит Очко Бесчестия/Судьбы/Боли»
//  без общего механизма списания). Кнопка — тот же образец, что .ae-spend-btn
//  (module/combat/action-economy.mjs, wdbc-qjnk): disabled+title ДО клика,
//  а не тост после.
//
//  Storage: «Бесчестие»/«Судьба»/«Боль» — ТРИ РАЗНЫХ ТЕРМИНА одного и того же
//  хранимого поля (module/helpers/utils.mjs::fateTerm выбирает подпись по расе/
//  мировоззрению актора, а не заводит три отдельных пула):
//    system.fate.{value,max}           — Судьба (Империум) / Бесчестие (Хаосит,
//                                         но НЕ Демон-Принц) / Боль (Друкхари,
//                                         module/sheets/tabs/pain.mjs).
//    system.dp.ip + Inf.b (расчётный максимум) — Демон-Принц (тот же путь,
//    что actor-sheet.mjs::_infamyPath/_infamyMax и apps/hud.mjs::fate).
//  cost.pool — для этих трёх не адрес хранения, а АВТОРСКАЯ подпись (что
//  говорит книга у конкретной способности): три ключа делят одно поле актора.
//
//  ЧЕТВЁРТЫЙ ПУЛ УСТРОЕН ИНАЧЕ (wdbc-m7we). "action" — Очки Действия, и это
//  настоящее другое хранилище (system.actionPoints.value), а не ещё одна
//  подпись к тому же полю. Заведён потому, что самая частая форма способности
//  без читателя — «Полудействие: сделать X» (113 таких подписей в реестре), и
//  сказать про эту цену ДАННЫМИ было нечем: автор писал её текстом, игрок
//  тратил действие по памяти. Счёт и гейт переиспользуют существующий API
//  экономики действий (combat/action-economy.mjs), а не заводят второй счёт —
//  в том числе его правило «вне Encounter экономика не проверяется вовсе».
// ════════════════════════════════════════════════════════════════════════

import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { canSpendActionPoints, spendActionPoints } from "./action-economy.mjs";

/** label — пункт выпадающего списка в Конструкторе; genitive — для «N Очков <genitive>» на листе. */
export const CAPABILITY_COST_POOLS = {
  infamy: { label: "Очки Бесчестия",  genitive: "Бесчестия" },
  fate:   { label: "Очки Судьбы",     genitive: "Судьбы" },
  pain:   { label: "Очки Боли",       genitive: "Боли" },
  // Единственный пул со своим хранилищем — см. шапку файла. Подпись «ОД», а не
  // «Очки Действия»: за столом их называют так, и в ячейку панели длинное имя
  // не влезает.
  action: { label: "Очки Действия (ОД)", genitive: "Действия", short: "ОД",
            storage: "system.actionPoints.value" }
};

/** Цена берётся из экономики действий, а не из общего поля Судьбы/Бесчестия. */
const isActionPool = cost => cost?.pool === "action";

/** «1 Очко Бесчестия» / «2 Очка Судьбы» / «5 Очков Боли» — родительный падеж числительного. */
function amountWord(n) {
  n = Math.abs(n) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return "Очков";
  if (n1 === 1) return "Очко";
  if (n1 >= 2 && n1 <= 4) return "Очка";
  return "Очков";
}

/** Человекочитаемая цена — для описания записи в Конструкторе и подсказки кнопки. */
export function capabilityCostLabel(cost) {
  if (!cost?.pool) return "";
  const amount = Math.max(1, Number(cost.amount) || 1);
  if (isActionPool(cost)) return `${amount} ${CAPABILITY_COST_POOLS.action.short}`;
  const genitive = CAPABILITY_COST_POOLS[cost.pool]?.genitive || cost.pool;
  return `${amount} ${amountWord(amount)} ${genitive}`;
}

/**
 * Текущее значение/максимум пула актора — тот же путь, что apps/hud.mjs::fate
 * и actor-sheet.mjs::_infamyPath/_infamyMax (Демон-Принц — dp.ip/Inf.b, все
 * остальные — fate.value/fate.max). Один общий пул на актора, cost.pool сам
 * по себе на выбор хранилища не влияет — см. заголовок файла.
 */
export function capabilityPoolValue(actor) {
  const sys = actor?.system ?? {};
  return Math.max(0, actor?.type === "demonPrince" ? (Number(sys.dp?.ip) || 0) : (Number(sys.fate?.value) || 0));
}
export function capabilityPoolMax(actor) {
  const sys = actor?.system ?? {};
  return (actor?.type === "demonPrince" || sys.alignment === "heretic")
    ? Math.max(0, Number(sys.characteristics?.inf?.bonus) || 0)
    : Math.max(0, Number(sys.fate?.max) || 0);
}

/** {disabled, title} для кнопки списания — гейт виден ДО клика (wdbc-qjnk, apSpendGate). */
export function capabilityCostGate(actor, cost) {
  if (!cost?.pool) return { disabled: false, title: "" };
  const amount = Math.max(1, Number(cost.amount) || 1);
  if (isActionPool(cost)) {
    // Спрашиваем экономику действий, а не своё представление о ней: там же
    // живёт правило «вне Encounter не проверяем» и учёт Калечащего.
    const ok = canSpendActionPoints(actor, amount);
    const have = Number(actor?.system?.actionPoints?.value) || 0;
    return { disabled: !ok, title: ok ? "" : `Не хватает: нужно ${capabilityCostLabel(cost)}, есть ${have}` };
  }
  const have = capabilityPoolValue(actor);
  const ok = have >= amount;
  return {
    disabled: !ok,
    title: ok ? "" : `Не хватает: нужно ${capabilityCostLabel(cost)}, есть ${have}`
  };
}

/**
 * Списать цену возможности и запостить карточку в чат. Возвращает false, если
 * в пуле не хватило (ничего не списано) — тот же контракт, что spendActionPoints.
 */
export async function spendCapabilityCost(actor, cost, label) {
  if (!cost?.pool) return true;
  const gate = capabilityCostGate(actor, cost);
  if (gate.disabled) {
    ui.notifications.warn(`⚠️ ${gate.title}`);
    return false;
  }
  const amount = Math.max(1, Number(cost.amount) || 1);
  if (isActionPool(cost)) {
    // Списывает сама экономика действий — она же ведёт учёт физических
    // действий и Калечащего, дублировать её вычитанием поля нельзя.
    const before = Number(actor?.system?.actionPoints?.value) || 0;
    if (!(await spendActionPoints(actor, amount))) return false;
    await postTestCard(actor, {
      icon: rollIcon("bolt", "#c98bff"), title: `${esc(label || "Возможность")} — ${esc(actor.name)}`,
      lines: [`<div class="roll-threshold">Потрачено: <b>${capabilityCostLabel(cost)}</b>. Осталось: <b>${Math.max(0, before - amount)}</b>.</div>`]
    }, { sound: false });
    return true;
  }
  const path = actor.type === "demonPrince" ? "system.dp.ip" : "system.fate.value";
  const have = capabilityPoolValue(actor);
  await actor.update({ [path]: have - amount });
  await postTestCard(actor, {
    icon: rollIcon("bolt", "#c98bff"), title: `${esc(label || "Возможность")} — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Потрачено: <b>${capabilityCostLabel(cost)}</b>. Осталось: <b>${have - amount}</b> / ${capabilityPoolMax(actor)}.</div>`]
  }, { sound: false });
  return true;
}
