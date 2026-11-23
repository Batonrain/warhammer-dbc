// module/apps/resource-pools.mjs
// ════════════════════════════════════════════════════════════════════════
//  Пулы ресурсов элитных архетипов — Foundry-сторона rules/resource-pools.mjs
//  (там — что такое пул и откуда берётся его максимум).
//
//    spendResource(actor, key, n, opts)   — трата с карточкой в чат;
//    gainResource(actor, key, n, opts)    — пополнение (кнопка на листе);
//    refillResourcePools(event)           — до максимума в начале боя,
//                                           с новой сценой, в конце сессии;
//    chooseInfamyPayment(actor, options)  — «заплатить Очком Бесчестия или
//                                           Жаждой?» (apps/infamy-points.mjs).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { worldAndTokenActors } from "../migrations/unlinked-tokens.mjs";
import {
  resourcePoolDef, resourceSpendGate, resourceSpendUpdates, resourceGainUpdates,
  resourceRefillUpdates, resourceAmountLabel, roundKeyOf, KNOWN_RESOURCE_POOLS, resourcePoolMaxLabel
} from "../rules/resource-pools.mjs";

/**
 * Начатый бой, где участвует актор. Своя короткая копия поиска, а не
 * combat/actor-combat.mjs: тот тянет combat/command-state.mjs — источник
 * правил, а этот файл импортирует apps/infamy-points.mjs, который грузят
 * почти все (AGENTS.md, «Источники правил»).
 */
function startedCombatOf(actor) {
  if (!actor) return null;
  const ids = new Set([actor.id, actor.uuid, actor.token?.actor?.uuid].filter(Boolean));
  for (const c of globalThis.game?.combats ?? []) {
    if (!c?.started) continue;
    for (const cb of c.combatants ?? []) {
      const a = cb?.actor;
      if (a && (a === actor || ids.has(a.uuid) || (!a.isToken && ids.has(a.id)) || ids.has(cb.actorId) && !actor.isToken)) return c;
    }
  }
  return null;
}

/** Ключ Раунда боя, в котором участвует актор ("" — вне боя). */
export function actorRoundKey(actor) {
  return roundKeyOf(startedCombatOf(actor));
}

/** Гейт траты для кнопки: { disabled, title }. */
export function resourceCostGate(actor, key, amount, opts = {}) {
  const gate = resourceSpendGate(actor, key, amount, { ...opts, roundKey: actorRoundKey(actor) });
  return { disabled: !gate.ok, title: gate.ok ? "" : gate.reason };
}

async function poolCard(actor, title, line) {
  await postTestCard(actor, {
    icon: rollIcon("bolt", "#c98bff"), title: `${esc(title)} — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">${line}</div>`]
  }, { sound: false });
}

/**
 * Потратить из пула. null — не хватило / лимит Раунда (ничего не списано,
 * игрок видит причину). `silent` — без карточки (её пишет вызывающий).
 * @returns {Promise<?{before:number, after:number, max:number, label:string}>}
 */
export async function spendResource(actor, key, amount = 1, { asInfamy = false, ignoreRoundCap = false, label = "", silent = false } = {}) {
  const def = resourcePoolDef(actor, key);
  const roundKey = actorRoundKey(actor);
  const gate = resourceSpendGate(actor, key, amount, { asInfamy, roundKey, ignoreRoundCap, def });
  if (!gate.ok) {
    ui.notifications?.warn(`⚠️ ${actor?.name ?? ""}: ${gate.reason}`);
    return null;
  }
  const { update, before, after } = resourceSpendUpdates(actor, key, amount, { asInfamy, roundKey: ignoreRoundCap ? "" : roundKey, def });
  await actor.update(update);
  if (!silent) {
    await poolCard(actor, label || def.label,
      `Потрачено: <b>${esc(resourceAmountLabel(key, amount, def))}</b>${asInfamy ? " вместо Очка Бесчестия" : ""}. Осталось: <b>${after}</b> / ${resourcePoolMaxLabel(def)}.`);
  }
  return { before, after, max: def.max, label: def.label };
}

/** Пополнить пул на `amount` (по умолчанию — сколько даёт кнопка пула). */
export async function gainResource(actor, key, amount = null, { label = "", silent = false } = {}) {
  const def = resourcePoolDef(actor, key);
  if (!def) {
    ui.notifications?.warn(`${actor?.name ?? ""}: нет пула «${KNOWN_RESOURCE_POOLS[key]?.label ?? key}».`);
    return null;
  }
  const n = amount == null ? Math.max(1, def.gainAmount || 1) : Number(amount) || 0;
  const res = resourceGainUpdates(actor, key, n, { def });
  if (!res) return null;
  if (res.after === res.before) {
    ui.notifications?.info(`${actor.name}: «${def.label}» уже на максимуме (${resourcePoolMaxLabel(def)}).`);
    return res;
  }
  await actor.update(res.update);
  if (!silent) {
    await poolCard(actor, label || def.gainLabel || def.label,
      `+${res.after - res.before} — «${esc(def.label)}»: <b>${res.after}</b> / ${resourcePoolMaxLabel(def)}.`);
  }
  return res;
}

/**
 * До максимума — у всех акторов мира и несвязанных токенов, чьи пулы
 * наполняются на `event` ("battle" | "scene" | "session"). Только ГМ.
 * `actors` — ограничить (бойцы начатого боя).
 */
export async function refillResourcePools(event, actors = null) {
  if (!game.user?.isGM) return;
  const list = actors ?? worldAndTokenActors();
  const seen = new Set();
  for (const actor of list) {
    if (!actor || seen.has(actor.uuid)) continue;
    seen.add(actor.uuid);
    const { update, filled } = resourceRefillUpdates(actor, event);
    if (!filled.length) continue;
    await actor.update(update);
    const what = filled.map(f => `${esc(f.label)}: ${f.before} → <b>${f.after}</b>`).join(", ");
    await poolCard(actor, "Пул восполнен", what);
  }
}

/** Начало боя: пулы бойцов с пополнением «в начале боя». */
export async function refillResourcePoolsOnCombatStart(combat) {
  const actors = [...(combat?.combatants ?? [])].map(c => c.actor).filter(Boolean);
  await refillResourcePools("battle", actors);
}

/**
 * Чем заплатить вместо Очка Бесчестия: "infamy" — обычным пулом, ключ —
 * пулом ресурса, null — отказ. Когда обычного Очка нет, а пул один —
 * без вопроса.
 */
export async function chooseInfamyPayment(actor, options, { regularAvailable = true } = {}) {
  if (!options?.length) return regularAvailable ? "infamy" : null;
  if (!regularAvailable && options.length === 1) return options[0].key;
  const buttons = [];
  if (regularAvailable) buttons.push({ action: "infamy", label: "Очко Бесчестия", default: true, callback: () => "infamy" });
  for (const d of options) {
    buttons.push({ action: `res-${d.key}`, label: `${d.label} (1)`, default: !regularAvailable && buttons.length === 0, callback: () => d.key });
  }
  const notes = options.map(d => {
    const parts = [];
    if (d.asInfamyCor != null) parts.push(`Порча при этом считается не выше ${d.asInfamyCor}`);
    if (d.asInfamyNote) parts.push(d.asInfamyNote);
    return parts.length ? `<li><b>${esc(d.label)}</b>: ${esc(parts.join("; "))}.</li>` : "";
  }).join("");
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: "Чем заплатить?" },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="margin:4px 6px;">${esc(actor.name)} может заплатить вместо Очка Бесчестия.</p>${notes ? `<ul style="margin:4px 6px;">${notes}</ul>` : ""}`,
    rejectClose: false,
    buttons
  });
  return choice ?? null;
}
