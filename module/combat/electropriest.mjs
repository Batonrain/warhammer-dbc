// module/combat/electropriest.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Кнопки Электрожреца (Элитные архетипы). Арифметика и гейт Силы Из Плоти —
//  rules/electropriest.mjs. Успех кнопки — undefined, отказ — строка.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { applyCharDamage } from "./char-damage.mjs";
import { computeWoundHealing } from "../sheets/tabs/wounds.mjs";
import { dealDamageToTarget } from "./gm-relay.mjs";
import {
  VOLTAGHEIST_BLAST_COST, BUBBLE_FLAG, BUBBLE_AIR_SECONDS,
  hasCoils, hasVoltagheistBlast, hasVoltagheistBubble, hasVoltaicAbsorption, hasVoltaicConfluence, hasVoltagheistShield,
  electropriestActive, coilsBare, coilsShieldAblative, coilsDamageRefund, voltagheistBlastProfile, absorptionRestore,
  shieldAblative, shieldAblativeChange, isLuminen, bubbleState
} from "../rules/electropriest.mjs";

const NS = "warhammer-dbc";
const ICON = "⚡ ";

const say = async (actor, title, lines, extra = {}, opts = {}) => {
  await postTestCard(actor, {
    icon: ICON, title: `${esc(title)} — ${esc(actor.name)}`,
    lines: lines.filter(Boolean).map(l => `<div class="roll-threshold">${l}</div>`), ...extra
  }, { sound: false, ...opts });
};
const warn = msg => { ui.notifications.warn(`⚠️ ${msg}`); return msg; };
const energyOf = actor => Math.max(0, Number(actor?.system?.energy?.value) || 0);

function archetypeGate(actor, ok, what) {
  if (!actor || !ok) return warn(`У актора нет «${what}».`);
  if (!electropriestActive(actor)) return warn("Сила Из Плоти: с Трейтом Machine эффекты Архетипа отключены (нужна мутация Механоид или Талант Fleshmetal).");
  return null;
}

// ── Катушки Электрожреца ─────────────────────────────────────────────────────

/** «За свободное действие может нанести себе 1d5 урона в T, чтобы восстановить 1 заряд». */
export async function useCoilsSelfCharge(actor) {
  const gate = archetypeGate(actor, hasCoils(actor), "Катушки Электрожреца");
  if (gate) return gate;
  const max = Number(actor.system?.energy?.maxTotal ?? actor.system?.energy?.max) || 0;
  if (energyOf(actor) >= max) return warn("Катушка Потенции и так полна.");
  const roll = await new Roll("1d5").evaluate();
  const hit = await applyCharDamage(actor, "t", roll.total);
  const before = energyOf(actor);
  await actor.update({ "system.energy.value": before + 1 });
  await say(actor, "Катушки: самозарядка", [
    `1d5 = <b>${roll.total}</b> урона в Стойкость (${hit.before} → ${hit.after}); Катушка +1 заряд (${before} → ${before + 1}).`
  ], {}, { rolls: [roll] });
  return undefined;
}

/** Без одежды, с Voltagheist Shield: «за 1 заряд +2×W.b Аблативных Ран (как щит-купол)». */
export async function useCoilsShield(actor) {
  const gate = archetypeGate(actor, hasCoils(actor), "Катушки Электрожреца");
  if (gate) return gate;
  if (!hasVoltagheistShield(actor)) return warn("Нужно Техночудо Voltagheist Shield.");
  if (!coilsBare(actor)) return warn("Только без брони на голове, торсе и руках.");
  if (energyOf(actor) < 1) return warn("Нет заряда в Катушке.");
  const gain = coilsShieldAblative(actor);
  const ch = shieldAblativeChange(actor, gain);
  await actor.update({ ...ch.update, "system.energy.value": energyOf(actor) - 1 });
  await say(actor, "Катушки: Вольтагейст Щит", [`−1 заряд: щит-купол +<b>${gain}</b> аблативных Ран (2×W.b); на щите теперь ${ch.contribution}.`]);
  return undefined;
}

/**
 * Без одежды, с Voltagheist Shield: «за 1 заряд уменьшение непоглощённого
 * урона на W.b (до минимума в 1)» — после попадания: вернуть Раны.
 */
export async function useCoilsDamageReduction(actor) {
  const gate = archetypeGate(actor, hasCoils(actor), "Катушки Электрожреца");
  if (gate) return gate;
  if (!hasVoltagheistShield(actor)) return warn("Нужно Техночудо Voltagheist Shield.");
  if (!coilsBare(actor)) return warn("Только без брони на голове, торсе и руках.");
  if (energyOf(actor) < 1) return warn("Нет заряда в Катушке.");
  const dmg = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Катушки: снизить урон — ${actor.name}` },
    content: `<form style="padding:4px 6px;"><label>Непоглощённый урон попадания: <input type="number" name="d" min="1" value="1" style="width:60px;"/></label></form>`,
    ok: { label: "Снизить (−1 заряд)", callback: (_e, b) => Number(b.form.elements.d.value) || 0 },
    rejectClose: false
  }).catch(() => null);
  if (!dmg) return "отмена";
  const refund = coilsDamageRefund(actor, dmg);
  if (!refund) return warn("Урон и так 1 — снижать нечего.");
  await actor.update({ ...computeWoundHealing(actor.system, refund), "system.energy.value": energyOf(actor) - 1 });
  await say(actor, "Катушки: снижение урона", [`−1 заряд: урон попадания ${dmg} → ${dmg - refund} (−W.b, не ниже 1) — возвращено <b>${refund}</b> Ран.`]);
  return undefined;
}

// ── Вольтагейст Взрыв ────────────────────────────────────────────────────────

function tokenDistanceM(a, b) {
  const grid = canvas?.grid ?? {};
  const size = Number(grid.size) || 100;
  const dist = Number(grid.distance) || 1;
  const ca = a.center ?? { x: a.x, y: a.y }, cb = b.center ?? { x: b.x, y: b.y };
  return Math.hypot(ca.x - cb.x, ca.y - cb.y) / size * dist;
}

/**
 * Voltagheist Blast: «Совершая Натиск с Voltagheist Shield в Процессах, может в
 * конце своего Хода потратить 3 заряда, чтобы центрировать на себе шаблон
 * взрыва (Dmg 1d10+W.b E(El), Pen 0, Blast(½W.b окр.▲), Shocking), не задевая
 * себя и до W.b союзников по выбору».
 */
export async function useVoltagheistBlast(actor) {
  const gate = archetypeGate(actor, hasVoltagheistBlast(actor), "Вольтагейст Взрыв");
  if (gate) return gate;
  if (!hasVoltagheistShield(actor)) return warn("Нужно Техночудо Voltagheist Shield в Процессах.");
  if (energyOf(actor) < VOLTAGHEIST_BLAST_COST) return warn(`Нужно ${VOLTAGHEIST_BLAST_COST} заряда, есть ${energyOf(actor)}.`);
  const prof = voltagheistBlastProfile(actor);
  const self = actor.getActiveTokens?.()?.[0] ?? null;
  const inRange = self ? (canvas?.tokens?.placeables ?? [])
    .filter(t => t !== self && t.actor && tokenDistanceM(self, t) <= prof.radius) : [];
  const myDisp = self?.document?.disposition ?? 1;
  const rows = inRange.map((t, i) => {
    const ally = (t.document?.disposition ?? 0) === myDisp;
    return `<div><label><input type="checkbox" name="t${i}" ${ally ? "" : "checked"}/> ${esc(t.name)}${ally ? " (союзник)" : ""}</label></div>`;
  }).join("");
  const picked = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Вольтагейст Взрыв — ${actor.name}` },
    content: `<form style="padding:4px 6px;"><p>Blast(${prof.radius}) вокруг себя, ${prof.formula} E(El), Pen 0, Shocking; −${VOLTAGHEIST_BLAST_COST} заряда. Не задевает себя и до ${prof.allies} союзников по выбору.</p>
      ${rows || "<p><i>Токенов в радиусе нет (или нет токена на сцене) — урон будет брошен без целей.</i></p>"}</form>`,
    ok: { label: "Разрядить", callback: (_e, b) => inRange.filter((_, i) => b.form.elements[`t${i}`]?.checked) },
    rejectClose: false
  }).catch(() => null);
  if (!picked) return "отмена";
  const sparedAllies = inRange.filter(t => !picked.includes(t) && (t.document?.disposition ?? 0) === myDisp).length;
  if (sparedAllies > prof.allies) return warn(`Пощадить можно не больше ${prof.allies} союзников (W.b), снято ${sparedAllies}.`);
  await actor.update({ "system.energy.value": energyOf(actor) - VOLTAGHEIST_BLAST_COST });
  const roll = await new Roll(prof.formula).evaluate();
  for (const t of picked) {
    await dealDamageToTarget(t.actor, {
      rawDamage: roll.total, penetration: prof.pen, damageType: "energy", damageSubtype: "electric",
      hitLocation: "Торс", melee: false, attackerName: actor.name, attackerUuid: actor.uuid, weaponName: "Вольтагейст Взрыв"
    }, actor, "contact");
  }
  await say(actor, "Вольтагейст Взрыв", [
    `−${VOLTAGHEIST_BLAST_COST} заряда. Урон <b>${roll.total}</b> E(El), Pen 0, Blast(${prof.radius}) — применён: ${picked.length ? picked.map(t => esc(t.name)).join(", ") : "никому"}.`,
    "Shocking: задетые проходят тест против Оглушения (за столом). Цели могут потратить 2 оставшихся Успеха Уклонения на Отскок (Банк Уклонения). Не работает в вакууме и в жидкостях; только в конце Хода с Натиском."
  ], {}, { rolls: [roll] });
  return undefined;
}

// ── Вольтагейст Пузырь ───────────────────────────────────────────────────────

/**
 * Voltagheist Bubble: «может получить иммунитет к эффектам вакуума и газов…
 * в атмосфере захватывает воздух на 15 минут, в вакууме — инертный азот».
 * Кнопка включает/выключает; тест вакуума читает метку (rules/vacuum.mjs).
 */
export async function useVoltagheistBubble(actor) {
  const gate = archetypeGate(actor, hasVoltagheistBubble(actor), "Вольтагейст Пузырь");
  if (gate) return gate;
  if (!hasVoltagheistShield(actor)) return warn("Нужно Техночудо Voltagheist Shield в Процессах.");
  const now = game.time?.worldTime ?? 0;
  if (bubbleState(actor, now).on) {
    await actor.unsetFlag(NS, BUBBLE_FLAG);
    await say(actor, "Вольтагейст Пузырь", ["Пузырь снят."]);
    return undefined;
  }
  const vacuum = await foundry.applications.api.DialogV2.wait({
    window: { title: `Вольтагейст Пузырь — ${actor.name}` },
    content: "<p>Где включает пузырь?</p>",
    buttons: [{ action: "air", label: "В атмосфере (15 минут воздуха)", default: true }, { action: "vac", label: "В вакууме (азот)" }],
    rejectClose: false
  }).catch(() => null);
  if (!vacuum) return "отмена";
  await actor.setFlag(NS, BUBBLE_FLAG, { at: now, vacuum: vacuum === "vac" });
  await say(actor, "Вольтагейст Пузырь", [vacuum === "vac"
    ? "Пузырь изолирован; импланты наполнили его инертным азотом — от газов защищает, дышать нечем (тест вакуума остаётся)."
    : `Пузырь захватил воздух на ${BUBBLE_AIR_SECONDS / 60} минут: тест вакуума не нужен, пока воздух не кончится (по Летоисчислению); газы не действуют (за столом).`]);
  return undefined;
}

// ── Вольтаическое Поглощение ─────────────────────────────────────────────────

/**
 * Voltaic Absorption: «Когда имеет Аблативные Раны на щите и успешно Оглушает
 * или убивает цель любым Люминен Техночудом, восстанавливает 1 Аблативную Рану
 * щиту. Также может потратить 1 заряд, чтобы восстановить щиту W.b Аблативных Ран».
 * mode: "charge" — за заряд; "kill" — за Оглушение/убийство.
 */
export async function useVoltaicAbsorption(actor, mode = "charge") {
  const gate = archetypeGate(actor, hasVoltaicAbsorption(actor), "Вольтаическое Поглощение");
  if (gate) return gate;
  if (mode === "kill") {
    if (shieldAblative(actor) <= 0) return warn("На щите нет Аблативных Ран — Поглощение не срабатывает.");
    const ch = shieldAblativeChange(actor, 1);
    await actor.update(ch.update);
    await say(actor, "Вольтаическое Поглощение", [`Цель Оглушена/убита Люминен Техночудом: щит +1 аблативная Рана (теперь ${ch.contribution}).`]);
    return undefined;
  }
  if (energyOf(actor) < 1) return warn("Нет заряда в Катушке.");
  const gain = absorptionRestore(actor);
  const ch = shieldAblativeChange(actor, gain);
  await actor.update({ ...ch.update, "system.energy.value": energyOf(actor) - 1 });
  await say(actor, "Вольтаическое Поглощение", [`−1 заряд: щиту +<b>${gain}</b> аблативных Ран (W.b); теперь ${ch.contribution}.`]);
  return undefined;
}

// ── Вольтаическое Слияние ────────────────────────────────────────────────────

/**
 * Voltaic Confluence: «тратить Аблативные Раны щита на переброс тестов
 * активации и бросков урона Люминен Техночудес, 1 Рана на переброс».
 * Спрашивает и списывает; true — перебрасывать. Зовёт sheets/tabs/tech.mjs.
 */
export async function voltaicConfluenceReroll(actor, power, text = "") {
  if (!isLuminen(power) || !hasVoltaicConfluence(actor) || !electropriestActive(actor)) return false;
  const have = shieldAblative(actor);
  if (have < 1) return false;
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: `Вольтаическое Слияние — ${actor.name}` },
    content: `<p>${esc(text)} Потратить 1 аблативную Рану щита (есть ${have}) и перебросить?</p>`,
    yes: { label: "Перебросить (−1 аблативная Рана)" }, no: { label: "Нет" }, rejectClose: false
  }).catch(() => false);
  if (!ok) return false;
  await actor.update(shieldAblativeChange(actor, -1).update);
  return true;
}
