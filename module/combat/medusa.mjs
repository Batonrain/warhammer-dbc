// module/combat/medusa.mjs
// ════════════════════════════════════════════════════════════════════════
//  Медуза — кнопки Черт и Талантов (обвязка rules/medusa-talents.mjs).
//
//   Медуза            — питание сильной эмоцией (часы Календаря: голод через
//                       месяц), Плод Медузы из пяти наростов (пул medusaGrowth).
//   Эмоциональный Взрыв — эффект попадания: тест W цели −10−5×бPR, провал —
//                       Шок с Провалами как от Страха; Шок 101+ — ОД медузе
//                       в начале следующего Хода (+2, повторно +1).
//   Экстремальные Ощущения — тест W+10, вмешаться: +2 ОД сейчас; убитый так
//                       вражеский псайкер — +1 ОД каждый Ход до конца битвы.
//   Эмоциональное Зрение — тест W−30, пробить психический барьер.
//  Атаки Эмпата тестом W и +бPR — окно атаки (rules/medusa-talents.mjs::
//  empathAttackPreset); Чуждое Сознание — гейт Теста Сопротивления (hooks.mjs).
// ════════════════════════════════════════════════════════════════════════

import {
  MEDUSA_FED_FLAG, EXPLOSION_FLAG, EXTREME_FLAG, GROWTH_POOL, FRUIT_COST,
  hasMedusae, hasAlienConsciousness, hasEmotionalExplosion, hasEmotionalVision, hasExtremeSensations,
  medusaPr, explosionTestMod, explosionShockTotal, explosionApBonus, medusaHungry
} from "../rules/medusa-talents.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";
import { SHOCK_TABLE, lookupTable } from "../constants/fear-tables.mjs";
import { applyShockRow } from "./fear.mjs";
import { spendResource } from "../apps/resource-pools.mjs";
import { isEncounterActive } from "./action-economy.mjs";
import { esc } from "../helpers/utils.mjs";
import { eliteTest, infoCard, targetedActors, askSelect } from "./psyker-elite-common.mjs";

const NS = "warhammer-dbc";
const line = html => `<div class="roll-threshold">${html}</div>`;
const now = () => Number(globalThis.game?.time?.worldTime) || 0;
const medusaTrait = actor => [...(actor?.items ?? [])].find(i => i.type === "trait" && hasMedusae({ items: [i] })) ?? null;

/** Медуза: сильная эмоция съедена / Плод Медузы. */
export async function useMedusae(actor) {
  const trait = medusaTrait(actor);
  if (!trait) return ui.notifications.warn("⚠️ Нет Черты Медуза.");
  const pool = Number(actor.system?.resourcePools?.[GROWTH_POOL]) || 0;
  const what = await askSelect("Медуза", "Что произошло", [
    { value: "feed", label: "Медуза напиталась сильной эмоцией" },
    { value: "fruit", label: `Плод Медузы (${FRUIT_COST} наростов, сейчас ${pool})` }
  ]);
  if (!what) return;
  if (what === "feed") {
    await trait.setFlag(NS, MEDUSA_FED_FLAG, now());
    return infoCard(actor, "Медуза", [line("Медуза напиталась сильной эмоцией — следующий голод через месяц (часы Календаря следят сами).")], { icon: "🪼" });
  }
  if (!(await spendResource(actor, GROWTH_POOL, FRUIT_COST, { label: "Плод Медузы" }))) return;
  await infoCard(actor, "Плод Медузы", [line(`Пять наростов сливаются в <b>Плод Медузы</b> (−${FRUIT_COST} из пула наростов).`)], { icon: "🪼" });
}

/** Часы Календаря: голод медузы (обработчик CONDITION_CLOCK_HANDLERS). */
export async function medusaHungerClock(actor, { from, to }) {
  const trait = medusaTrait(actor);
  if (!trait) return;
  const fed = trait.getFlag(NS, MEDUSA_FED_FLAG);
  if (fed == null) { await trait.setFlag(NS, MEDUSA_FED_FLAG, Number(from) || 0); return; }
  if (!medusaHungry(fed, to) || trait.getFlag(NS, "medusaHungerWarned") === fed) return;
  await trait.setFlag(NS, "medusaHungerWarned", fed);
  await infoCard(actor, "Медуза голодна", [
    line("Больше месяца без сильной эмоции: медуза <b>дематериализуется в имматериум, убивая носителя</b>."),
    line("ГМ: примените исход. Если эмоция всё же была — кнопка Черты «Медуза» → «напиталась».")
  ], { icon: "🪼" });
}

/** Эмоциональный Взрыв: эффект попадания по выделенной цели. */
export async function useEmotionalExplosion(actor) {
  if (!hasEmotionalExplosion(actor)) return ui.notifications.warn("⚠️ Нет Таланта Эмоциональный Взрыв.");
  const target = targetedActors()[0];
  if (!target) return ui.notifications.warn("⚠️ Выделите цель, в которую попал Эмоциональный Взрыв.");
  const pr = medusaPr(actor);
  // Иммунитет к Страху даёт +30 вместо иммунитета; Чуждые Силы не видят «Извне» противника.
  const fromBeyond = hasAbility(target, "psychic.mindImmune", "Извне", "trait");
  const fearImmune = hasAbility(target, "fear.immune", "Извне", "trait") && !(fromBeyond && hasAlienConsciousness(actor));
  const mod = explosionTestMod(pr, { fearImmune });
  const t = await eliteTest(target, {
    what: { char: "wp" }, mod, title: `Эмоциональный Взрыв (${actor.name})`, icon: "💥",
    extraParts: [`−10−5×бPR ${pr}`, ...(fearImmune ? ["+30 вместо иммунитета к Страху"] : [])],
    success: "эмоции устояли", failure: "бросок Шока"
  });
  if (!t.ok || t.success) return;
  const sRoll = await new Roll("1d100").evaluate();
  const total = explosionShockTotal(sRoll.total, t.deg);
  const row = lookupTable(SHOCK_TABLE, total);
  const lines = [line(`Шок: ${sRoll.total}${t.deg > 1 ? ` + ${10 * (t.deg - 1)}` : ""} = <b>${total}</b> — ${row?.text ?? "—"}`)];
  if (target.isOwner || game.user?.isGM) {
    const applied = await applyShockRow(target, row);
    if (applied?.html) lines.push(applied.html);
  } else lines.push(line("ГМ: строка Шока наносится цели (нет прав на неё)."));
  if (total >= 101) {
    const combatId = isEncounterActive() ? game.combat?.id : null;
    const st = actor.getFlag(NS, EXPLOSION_FLAG);
    const bonus = explosionApBonus(st, combatId);
    await actor.setFlag(NS, EXPLOSION_FLAG, { combatId, gained: true, pending: bonus });
    lines.push(line(`Шок 101+: медуза пирует — <b>+${bonus} ОД</b> в начале её следующего Хода${bonus === 1 ? " (повтор в этой битве)" : ""}.`));
  }
  await infoCard(actor, `Эмоциональный Взрыв → ${target.name}`, lines, { icon: "💥", rolls: [sRoll] });
}

/** Экстремальные Ощущения: вмешаться в Ход врага (+2 ОД) / убитый псайкер (+1 ОД до конца битвы). */
export async function useExtremeSensations(actor) {
  if (!hasExtremeSensations(actor)) return ui.notifications.warn("⚠️ Нет Таланта Экстремальные Ощущения.");
  const combatId = isEncounterActive() ? game.combat?.id : null;
  const st = actor.getFlag(NS, EXTREME_FLAG);
  if (st?.used) {
    if (st.killBonus || st.combatId !== combatId) return ui.notifications.warn("⚠️ Экстремальные Ощущения срабатывают лишь один раз.");
    await actor.setFlag(NS, EXTREME_FLAG, { ...st, killBonus: true });
    return infoCard(actor, "Экстремальные Ощущения", [line("Вражеский псайкер убит этим вмешательством: <b>+1 ОД</b> в начале каждого Хода до конца битвы.")], { icon: "⚡" });
  }
  const t = await eliteTest(actor, {
    what: { char: "wp" }, mod: 10, title: "Экстремальные Ощущения", icon: "⚡",
    success: "медуза объявляет свой Ход немедленно", failure: "момент упущен"
  });
  if (!t.ok) return;
  await actor.setFlag(NS, EXTREME_FLAG, { used: true, combatId, killBonus: false });
  if (!t.success) return;
  const ap = Number(actor.system?.actionPoints?.value) || 0;
  await actor.update({ "system.actionPoints.value": ap + 2 });
  await infoCard(actor, "Экстремальные Ощущения", [
    line(`Вражеский псайкер получил первый критический эффект — медуза прерывает его действия: <b>+2 ОД</b> (сейчас ${ap + 2}) на психосилы, прицеливание и атаку.`),
    line("Убьёт им этого псайкера — нажмите кнопку Таланта ещё раз: +1 ОД до конца битвы.")
  ], { icon: "⚡" });
}

/** Эмоциональное Зрение: пробить психический барьер или круг (тест W−30). */
export async function useEmotionalVision(actor) {
  if (!hasEmotionalVision(actor)) return ui.notifications.warn("⚠️ Нет Таланта Эмоциональное Зрение.");
  await eliteTest(actor, {
    what: { char: "wp" }, mod: -30, title: "Эмоциональное Зрение: сквозь барьер", icon: "👁",
    success: "атака проходит сквозь оберег или ритуальный круг", failure: "барьер держит"
  });
}

/** Начало Хода медузы: ОД от Эмоционального Взрыва и Экстремальных Ощущений. */
export async function processMedusaTurnStart(actor) {
  if (!actor?.getFlag) return;
  const combatId = game.combat?.id ?? null;
  let add = 0;
  const lines = [];
  const ex = actor.getFlag(NS, EXPLOSION_FLAG);
  if (ex?.pending) {
    add += Number(ex.pending) || 0;
    lines.push(`Эмоциональный Взрыв: +${ex.pending} ОД`);
    await actor.setFlag(NS, EXPLOSION_FLAG, { ...ex, pending: 0 });
  }
  const es = actor.getFlag(NS, EXTREME_FLAG);
  if (es?.killBonus && es.combatId === combatId) {
    add += 1;
    lines.push("Экстремальные Ощущения: +1 ОД");
  }
  if (!add) return;
  const ap = Number(actor.system?.actionPoints?.value) || 0;
  await actor.update({ "system.actionPoints.value": ap + add });
  await infoCard(actor, "Медуза", [line(`${lines.map(esc).join("; ")} — ОД ${ap} → <b>${ap + add}</b>.`)], { icon: "🪼" });
}

export const MEDUSA_API = { useMedusae, useEmotionalExplosion, useExtremeSensations, useEmotionalVision };
