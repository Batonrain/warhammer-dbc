// module/combat/frontline-medic.mjs
// ═══════════════════════════════════════════════════════════════════════════
//  Frontline Medic / Фронтовой Медик (Талант Медика; Sahara 571-1, 585-frontline-medic).
//  Книга: «За полное действие персонаж может подвигаться на до дистанции Натиска
//  (считается Натиском) к союзнику и сделать одно из: остановить Кровотечение
//  (Medicae−10 или без теста с Good.Q аптечкой/нартецием); прекратить Crippling/Piercing
//  (Medicae+0, нартеций); потушить Горящего (A+20); применить Химию; вылечить Fast
//  Stitches (нартеций, нужен Талант); или забросить Оглушённую/Беспомощную цель на
//  плечо…».
//
//  Составное действие собрано из готовых частей, без общего «действия с перемещением»:
//   • полное действие (2 ОД) списывается здесь один раз;
//   • перемещение — бюджет пути Натиска (rules/movement-path.mjs::grantMoveAllowance)
//     и отметки «двигался», как у кнопки Натиска; токен игрок тянет сам;
//   • дальше — существующая кнопка с ОД = 0: Кровотечение — sheets/tabs/healing.mjs
//     (stopBleeding, apCost:0, autoPass), тушение — combat/extinguish.mjs (mod +20,
//     apCost:0), Быстрые Стежки — Первая Помощь (fastStitches), Химия —
//     sheets/tabs/drugs.mjs::applyDrug. Калечение — свой тест Medicae+0 ниже.
//  «Забросить на плечо» — только карточка: переноски тел в системе нет
//  (бонусы на атаки по цели и Избегание за неё — на столе).
//  «Piercing» как Состояния в системе нет — снимается одно Калечение.
// ═══════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { hasTalentCapability } from "../rules/ability-by-key.mjs";
import { FAST_STITCHES_CAP } from "../rules/medic-talents.mjs";
import { isEncounterActive, hasActionEconomy, canSpendActionPoints, spendActionPoints } from "./action-economy.mjs";
import { askSelect, targetedActors } from "./psyker-elite-common.mjs";
import { postTestCard, outcomeHtml } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const line = html => `<div class="roll-threshold">${html}</div>`;

export const hasFrontlineMedic = actor =>
  [...(actor?.items ?? [])].some(i => i?.type === "talent" && itemHasName(i, "Frontline Medic"));

/** Нартеций у медика — по имени предмета (как sheets/tabs/healing.mjs::hasNarthecium). */
export const frontlineNarthecium = medic =>
  [...(medic?.items ?? [])].some(i => /narthec|нартец/i.test(i?.name ?? ""));

const GOOD_Q = new Set(["good", "best"]);

/** Почему Кровотечение останавливается без теста: Нартеций или Аптечка Good.Q и лучше; "" — тест. */
export function frontlineBleedAuto(medic) {
  if (frontlineNarthecium(medic)) return "Нартеций";
  const kit = [...(medic?.items ?? [])].find(i => /medkit|medi-kit|аптечк/i.test(i?.name ?? "")
    && GOOD_Q.has(String(i?.system?.quality ?? "")));
  return kit ? `${kit.name}, ${kit.system.quality === "best" ? "Best.Q" : "Good.Q"}` : "";
}

/** Препараты медика, которые можно ввести союзнику (не яды, доза есть). */
export const frontlineDrugs = medic => [...(medic?.items ?? [])].filter(i => i?.type === "drug"
  && (Number(i.system?.quantity) || 0) > 0 && i.system?.drugCategory !== "poison");

/**
 * Что Фронтовой Медик может сделать для этого пациента прямо сейчас. Чистая функция.
 * @returns {{value:string,label:string}[]}
 */
export function frontlineMedicOptions(medic, patient) {
  const c = patient?.system?.conditions ?? {};
  const narthecium = frontlineNarthecium(medic);
  const out = [];
  if (c.bleeding) {
    const auto = frontlineBleedAuto(medic);
    out.push({ value: "bleeding", label: `Остановить Кровотечение (${auto ? `без теста — ${auto}` : "Medicae−10"})` });
  }
  if (c.crippling && narthecium) out.push({ value: "crippling", label: "Снять Калечение (Medicae+0, Нартеций)" });
  if (c.burning) out.push({ value: "burning", label: "Потушить (A+20)" });
  if (frontlineDrugs(medic).length) out.push({ value: "chem", label: "Применить Химию (препарат с листа)" });
  if (narthecium && hasTalentCapability(medic, FAST_STITCHES_CAP)) {
    out.push({ value: "stitches", label: "Быстрые Стежки (Первая Помощь, Нартеций)" });
  }
  if (c.stunned || c.helpless) out.push({ value: "carry", label: "Забросить на плечо" });
  return out;
}

async function chargeMove(actor) {
  // Лениво: movement-actions.mjs тянет за собой весь HUD Движения.
  const { markMovedThisTurn, markMoveDegreeThisTurn, grantMoveAllowance, showReachRing } = await import("./movement-actions.mjs");
  const meters = actor.system?.movement?.charge;
  await markMovedThisTurn(actor);
  await markMoveDegreeThisTurn(actor, "full");
  await grantMoveAllowance(actor, "charge", meters);
  showReachRing(actor, meters);
  return meters;
}

async function removeCrippling(medic, patient) {
  const { medicaeEff } = await import("../sheets/tabs/healing.mjs");
  const { conditionRemoveFields } = await import("../sheets/tabs/conditions.mjs");
  const eff = medicaeEff(medic, patient, 0);
  const roll = await new Roll("1d100").evaluate();
  const success = roll.total <= eff;
  const lines = [];
  if (success) {
    try { await patient.update(conditionRemoveFields("crippling")); lines.push(line("Калечение снято.")); }
    catch { lines.push(line(`Нет прав на лист ${esc(patient.name)} — снимите Калечение вручную.`)); }
  }
  await postTestCard(medic, {
    icon: rollIcon("heart", "#ff8a8a"), title: `Фронтовой Медик: Калечение — ${esc(patient.name)}`,
    threshold: line(`Medicae+0 (Нартеций) → порог <b>${eff}</b>, бросок <b>${roll.total}</b>`),
    lines, outcome: outcomeHtml(success, success ? "Калечение снято" : "Не удалось")
  }, { rolls: [roll] });
  return success;
}

/** Кнопка Таланта: Натиск к выделенному союзнику и одно из шести действий. */
export async function useFrontlineMedic(actor) {
  if (!actor || !hasFrontlineMedic(actor)) return ui.notifications.warn("⚠️ Нет Таланта Фронтовой Медик.");
  const patient = targetedActors().find(a => a !== actor && a.uuid !== actor.uuid);
  if (!patient) return ui.notifications.warn("⚠️ Выделите союзника, к которому бежит медик.");
  const options = frontlineMedicOptions(actor, patient);
  if (!options.length) return ui.notifications.warn(`⚠️ ${patient.name}: нечего делать (нет Кровотечения, Горения, Калечения, Оглушения; нет препаратов и Нартеция).`);
  const mode = options.length === 1 ? options[0].value
    : await askSelect("Фронтовой Медик", `Что сделать для ${patient.name}`, options,
      { hint: "Полное действие: перемещение до дистанции Натиска (считается Натиском) и одно действие." });
  if (!mode) return;
  let drug = null;
  if (mode === "chem") {
    const drugs = frontlineDrugs(actor);
    const id = drugs.length === 1 ? drugs[0].id
      : await askSelect("Фронтовой Медик", "Препарат", drugs.map(d => ({ value: d.id, label: `${d.name} (${d.system.quantity})` })));
    drug = id ? actor.items.get(id) : null;
    if (!drug) return;
  }
  const inCombat = isEncounterActive() && hasActionEconomy(actor);
  if (inCombat) {
    if (!canSpendActionPoints(actor, 2, { physical: true })) return ui.notifications.warn(`⚠️ ${actor.name}: нужно полное действие.`);
    if (!await spendActionPoints(actor, 2, { physical: true })) return;
    await chargeMove(actor);
  }
  const head = inCombat ? `Полное действие: перемещение до ${Number(actor.system?.movement?.charge) || 0} м (Натиск) к ${esc(patient.name)}.` : `К ${esc(patient.name)}.`;
  if (mode === "carry") {
    return postTestCard(actor, {
      icon: rollIcon("heart", "#ff8a8a"), title: `Фронтовой Медик — ${esc(actor.name)}`,
      lines: [line(head), line(`${esc(patient.name)} заброшен на плечо: бонусы атак по нему пропадают, медик может Избегать за него. Нужны свободная рука и вес подъёма — на столе.`)]
    }, { sound: false });
  }
  await postTestCard(actor, { icon: rollIcon("heart", "#ff8a8a"), title: `Фронтовой Медик — ${esc(actor.name)}`, lines: [line(head)] }, { sound: false });
  if (mode === "bleeding") {
    const { applyHealing } = await import("../sheets/tabs/healing.mjs");
    return applyHealing(actor, patient, { mode: "stopBleeding", mod: 0, assistants: 0, tourniquet: false, patientActive: false,
      apCost: 0, autoPass: frontlineBleedAuto(actor) });
  }
  if (mode === "crippling") return removeCrippling(actor, patient);
  if (mode === "burning") {
    const { extinguishBurning } = await import("./extinguish.mjs");
    return extinguishBurning(actor, patient, { mod: 20, apCost: 0 });
  }
  if (mode === "stitches") {
    const { applyHealing } = await import("../sheets/tabs/healing.mjs");
    return applyHealing(actor, patient, { mode: "firstAid", mod: 0, assistants: 0, fastStitches: true });
  }
  if (mode === "chem") {
    const { applyDrug } = await import("../sheets/tabs/drugs.mjs");
    return applyDrug(actor, drug, patient);
  }
}
