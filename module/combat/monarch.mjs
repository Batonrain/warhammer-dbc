// module/combat/monarch.mjs
// ════════════════════════════════════════════════════════════════════════════
//  МОНАРХ — кнопки Черт и Талантов и такт начала Хода (арифметика —
//  rules/monarch-talents.mjs). ОД вассалов — пулы ресурсов в шапке листа
//  (rules/resource-pools.mjs): «ОД вассала» (Корона Полентия) и «ОД вассала
//  (Дракон)» (Монарх Дракон).
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { CANCEL } from "./cult-common.mjs";
import { mech1Card, rollMech1Test, skillTotalWith, skillTestLabel } from "./mech1-rolls.mjs";
import { resourcePoolDef, resourcePoolValue, resourceGainUpdates } from "../rules/resource-pools.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import {
  VASSAL_POOLS, VASSAL_POOL, DRAGON_POOL, VASSAL_ACTION_COST, VASSAL_SWAP_START, vassalApCost, awakeningExtra,
  hasCerebralChanneling, hasAwakening, hasNeuronist, BRAIN_PREP_FLAG, BRAIN_PREP_GOAL, BRAIN_PREP_MOD,
  BRAIN_EXTRACT_MOD, brainExtractOutcome, brainPrepProgress
} from "../rules/monarch-talents.mjs";

const NS = "warhammer-dbc";
const num = v => Number(v) || 0;

/** Пулы вассалов, что есть у актора: [{key, def}]. */
export function vassalPoolsOf(actor) {
  return VASSAL_POOLS.map(key => ({ key, def: resourcePoolDef(actor, key) })).filter(p => p.def);
}

// ── Начало Хода ─────────────────────────────────────────────────────────────

/** Начало Хода Монарха: каждый активный вассал +1 ОД (до 4). */
export async function processMonarchTurnStart(actor) {
  const upd = {};
  for (const { key, def } of vassalPoolsOf(actor)) {
    const g = resourceGainUpdates(actor, key, 1, { def });
    if (g && g.after !== g.before) Object.assign(upd, g.update);
  }
  if (Object.keys(upd).length) await actor.update(upd);
}

const poolOptions = (pools, actor) => pools.map(({ key, def }) =>
  `<option value="${key}">${esc(def.label)}: ${resourcePoolValue(actor, key, def)}/${def.max}</option>`).join("");

// ── Психосила вассала ───────────────────────────────────────────────────────

/** Потратить ОД вассала на психосилу (1/2/4; поддержание — вдвое меньше с Церебральным Потоком). */
export async function useVassalAp(actor) {
  const pools = vassalPoolsOf(actor);
  if (!pools.length) return ui.notifications?.warn("⚠️ Нет пула «ОД вассала» (Корона Полентия).");
  const cerebral = hasCerebralChanneling(actor);
  const pick = await foundry.applications.api.DialogV2.prompt({
    window: { title: `ОД вассала — ${actor.name}` }, classes: ["warhammer-dbc", "wh-holo"],
    content: `${pools.length > 1 ? `<div class="form-group"><label>Вассал</label><select name="pool">${poolOptions(pools, actor)}</select></div>` : ""}
      <div class="form-group"><label>Действие психосилы</label><select name="act">
        <option value="free">Свободное — ${VASSAL_ACTION_COST.free} ОД</option>
        <option value="half" selected>Полудействие / Реакция — ${VASSAL_ACTION_COST.half} ОД</option>
        <option value="full">Полное действие — ${VASSAL_ACTION_COST.full} ОД</option></select></div>
      <div class="form-group"><label><input type="checkbox" name="sustain"/> Поддержание${cerebral ? " (Церебральный Поток: вдвое меньше, окр.▼)" : ""}</label></div>`,
    ok: { label: "Потратить", callback: (_ev, b) => ({
      pool: b.form.querySelector("[name=pool]")?.value ?? pools[0].key,
      act: b.form.querySelector("[name=act]")?.value ?? "half",
      sustain: !!b.form.querySelector("[name=sustain]")?.checked
    }) }
  }).catch(() => null);
  if (!pick) return;
  const cost = vassalApCost(VASSAL_ACTION_COST[pick.act] ?? 2, { sustain: pick.sustain, cerebral });
  if (!cost) return mech1Card(actor, { icon: "👑", title: "ОД вассала", lines: ["Поддержание за 0 ОД (Церебральный Поток)."] });
  const { spendResource } = await import("../apps/resource-pools.mjs");
  return spendResource(actor, pick.pool, cost, { label: pick.sustain ? "поддержание психосилы" : "психосила вассала" });
}

/** Сменить контейнер: поддержание прежнего прекращается, новый стартует с 1 ОД. */
export async function useVassalSwap(actor) {
  const pools = vassalPoolsOf(actor);
  if (!pools.length) return ui.notifications?.warn("⚠️ Нет пула «ОД вассала» (Корона Полентия).");
  let key = pools[0].key;
  if (pools.length > 1) {
    key = await foundry.applications.api.DialogV2.prompt({
      window: { title: `Смена контейнера — ${actor.name}` }, classes: ["warhammer-dbc", "wh-holo"],
      content: `<div class="form-group"><label>Какой вассал</label><select name="pool">${poolOptions(pools, actor)}</select></div>`,
      ok: { label: "Сменить", callback: (_ev, b) => b.form.querySelector("[name=pool]")?.value }
    }).catch(() => null);
    if (!key) return CANCEL;
  }
  await actor.update({ [`system.resourcePools.${key}`]: VASSAL_SWAP_START });
  await mech1Card(actor, { icon: "🧠", title: "Смена контейнера",
    lines: [`Свободное действие, раз в Ход. Новый вассал стартует с <b>${VASSAL_SWAP_START}</b> ОД; поддержание психосил прежнего прекращается.`] });
  // Кнопка «▶ Запустить» тратит «раз в Ход» только на пустом возврате
  // (apps/mechanics.mjs::runMechScriptEntry): отказ и отмена — truthy.
  return undefined;
}

// ── Пробуждение ─────────────────────────────────────────────────────────────

/** Вассал восстанавливает 4 ОД вместо 1; встречный W+0 vs W+0. */
export async function useAwakening(actor) {
  if (!hasAwakening(actor)) return ui.notifications?.warn("⚠️ У актора нет Таланта Пробуждение.");
  const pools = vassalPoolsOf(actor);
  if (!pools.length) return ui.notifications?.warn("⚠️ Нет пула «ОД вассала» (Корона Полентия).");
  const pick = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Пробуждение — ${actor.name}` }, classes: ["warhammer-dbc", "wh-holo"],
    content: `${pools.length > 1 ? `<div class="form-group"><label>Вассал</label><select name="pool">${poolOptions(pools, actor)}</select></div>` : ""}
      <div class="form-group"><label>Сила Воли (W) псайкера</label><input type="number" name="w" min="0" value="35" autofocus/></div>`,
    ok: { label: "Пробудить", callback: (_ev, b) => ({
      pool: b.form.querySelector("[name=pool]")?.value ?? pools[0].key, w: num(b.form.querySelector("[name=w]")?.value) }) }
  }).catch(() => null);
  if (!pick) return CANCEL;
  const def = resourcePoolDef(actor, pick.pool);
  const have = resourcePoolValue(actor, pick.pool, def);
  const add = awakeningExtra(have, def?.max);
  if (add) await actor.update({ [`system.resourcePools.${pick.pool}`]: have + add });
  const myW = num(actor.system?.characteristics?.wp?.total);
  const r1 = await new Roll("1d100").evaluate(), r2 = await new Roll("1d100").evaluate();
  const mine = { ...testOutcome(r1.total, myW), threshold: myW };
  const theirs = { ...testOutcome(r2.total, pick.w), threshold: pick.w };
  const res = resolveOpposed(mine, theirs);
  const verdict = res.winner === "mine" ? "<span class=\"roll-success\">Монарх удержал контроль.</span>"
    : res.winner === "theirs" ? "<span class=\"roll-failure\">Псайкер контролирует действия Монарха до начала его следующего Хода включительно.</span>"
    : "Полная ничья — решает Мастер.";
  const { postTestCard } = await import("../helpers/test-card.mjs");
  await postTestCard(actor, {
    icon: "⚡", title: `Пробуждение — ${esc(actor.name)}`,
    lines: [
      `<div class="roll-threshold">ОД вассала: +${add} (восстанавливает 4 вместо 1) → <b>${have + add}</b>.</div>`,
      `<div class="roll-threshold">Монарх W+0: ${r1.total} / ${myW} — ${mine.success ? "Успех" : "Провал"} ${mine.deg}.</div>`,
      `<div class="roll-threshold">Псайкер W+0: ${r2.total} / ${pick.w} — ${theirs.success ? "Успех" : "Провал"} ${theirs.deg}.</div>`
    ],
    outcome: verdict
  }, { rolls: [r1, r2] });
  return undefined; // пусто — использовано (runMechScriptEntry тратит «раз в Раунд»)
}

// ── Нейронист ───────────────────────────────────────────────────────────────

/** Потратить свой опыт на психосилу вассала (строка «На прочее»). */
export async function useNeuronist(actor) {
  if (!hasNeuronist(actor)) return ui.notifications?.warn("⚠️ У актора нет Таланта Нейронист.");
  const free = num(actor.system?.experience?.current);
  const pick = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Нейронист — ${actor.name}` }, classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="margin:4px 6px;">Свободно опыта: <b>${free}</b>. Цена — по таблице психосил вассала.</p>
      <div class="form-group"><label>Вассал и психосила</label><input type="text" name="what" autofocus/></div>
      <div class="form-group"><label>Опыт</label><input type="number" name="xp" min="0" value="0"/></div>`,
    ok: { label: "Потратить", callback: (_ev, b) => ({ what: b.form.querySelector("[name=what]")?.value ?? "", xp: Math.trunc(num(b.form.querySelector("[name=xp]")?.value)) }) }
  }).catch(() => null);
  if (!pick || pick.xp <= 0) return;
  if (pick.xp > free) return ui.notifications?.warn(`⚠️ Не хватает опыта: нужно ${pick.xp}, свободно ${free}.`);
  await actor.update({ "system.experience.spentOther": num(actor.system?.experience?.spentOther) + pick.xp });
  return mech1Card(actor, { icon: "📚", title: "Нейронист",
    lines: [`Потрачено <b>${pick.xp}</b> опыта (строка «На прочее»): ${esc(pick.what || "психосила вассала")}. Внесите психосилу на лист контейнера.`] });
}

// ── Извлечение Мозга ────────────────────────────────────────────────────────

/** Подготовка контейнера: расширенный комбинированный Tech-Use−20 / Medicae−20, 20 Успехов. */
export async function useBrainContainerPrep(actor) {
  const tu = skillTotalWith(actor, { skill: "techUse" }), md = skillTotalWith(actor, { skill: "medicae" });
  const threshold = Math.min(num(tu), num(md)) + BRAIN_PREP_MOD;
  const roll = await new Roll("1d100").evaluate();
  const out = testOutcome(roll.total, threshold);
  const before = num(actor.getFlag?.(NS, BRAIN_PREP_FLAG));
  const prog = brainPrepProgress(before, out);
  await actor.update({ [`flags.${NS}.${BRAIN_PREP_FLAG}`]: prog.done ? 0 : prog.after });
  const { postTestCard, outcomeHtml } = await import("../helpers/test-card.mjs");
  return postTestCard(actor, {
    icon: "🫙", title: `Контейнер для мозга — ${esc(actor.name)}`,
    lines: [
      `<div class="roll-threshold">Комбинированный ${skillTestLabel({ skill: "techUse", mod: BRAIN_PREP_MOD })} / ${skillTestLabel({ skill: "medicae", mod: BRAIN_PREP_MOD })}: ${roll.total} / ${threshold}.</div>`,
      `<div class="roll-threshold">Успехов: ${before} → <b>${Math.min(prog.after, BRAIN_PREP_GOAL)}</b> из ${BRAIN_PREP_GOAL}.</div>`
    ],
    outcome: outcomeHtml(prog.done, prog.done ? "Контейнер готов — можно извлекать мозг." : `${out.success ? "Успех" : "Провал"} — ${out.deg}`)
  }, { rolls: [roll] });
}

/** Извлечение мозга: Medicae−30, 4+ Провала — мозг погиб. */
export async function useBrainExtract(actor) {
  const res = await rollMech1Test(actor, {
    title: "Извлечение мозга", icon: "🧠", skill: "medicae", mod: BRAIN_EXTRACT_MOD,
    lines: ["<div class=\"roll-threshold\" style=\"font-size:0.85em;\">Минута (12 Ходов), пустой контейнер; псайкер жив или умер не более 3 минут назад.</div>"],
    success: "Мозг в контейнере",
    failure: "4+ Провала — мозг непоправимо повреждён, иначе можно повторить"
  });
  return res ? brainExtractOutcome(res) : null;
}

export { VASSAL_POOL, DRAGON_POOL };
