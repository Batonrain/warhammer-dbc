// module/combat/wild-psyker.mjs
// ════════════════════════════════════════════════════════════════════════
//  Дикий Псайкер — Foundry-обвязка поверх rules/wild-psyker-talents.mjs.
//
//   • Щит Цепей (Черта): попадание бьёт по Ранам Щита (chainShieldIntercept,
//     зовёт combat/damage.mjs::applyDamageToActor), регенерация в начале Хода
//     (processWildPsykerTurnStart, зовёт hooks.mjs::updateCombat).
//   • Отторжение Цепей (Черта): раз в неделю по Календарю 1 урона в S и T,
//     который не лечится отдыхом (порция без срока, chainRejectionClock в
//     combat/condition-clock.mjs).
//   • Шрамы Цепей: любой урон в Характеристики от Черт/Талантов архетипа идёт
//     через chainSelfDamage — тест Cor+10, урон минус Успехи.
//   • Кнопки Талантов: Пламя Сердца, Мощь Переполняет, Иссушающий Заряд,
//     Цепи Стремительности, Пожиратель Смерти.
//   • Остаточное Поглощение: снятие поддержания психосилы рядом — +эPR Ран
//     Щиту (onPsyPowerPreUpdate, хук preUpdateItem в warhammer-dbc.mjs).
// ════════════════════════════════════════════════════════════════════════

import {
  CHAIN_SHIELD_KEY, CHAIN_SHIELD_DOWN_FLAG, WITHERING_FLAG, ALACRITY_FLAG, REJECTION_FLAG,
  WITHERING_COST, HEART_FIRE_DIE, CHAIN_SCARS_MOD,
  hasShieldOfChains, hasChainRejection, hasChainScars, hasChainsOfAlacrity, hasDeathEater, hasHeartFire,
  hasPowerOverwhelming, hasResidualAbsorption, hasWitheringCharge,
  chainShieldMax, chainShieldValue, chainShieldDown, chainShieldTurnStart, chainShieldHit, chainScarsReduce,
  deathEaterMod, witheringActive, currentPr, charBonus, rejectionWeeks
} from "../rules/wild-psyker-talents.mjs";
import { veilStepsFor } from "../rules/veil-steps.mjs";
import { applyCharDamage } from "./char-damage.mjs";
import { spendReaction } from "./action-economy.mjs";
import { esc } from "../helpers/utils.mjs";
import { eliteTest, askNumber, infoCard, setTurnFlag, tickTurnFlags, actorsDistance } from "./psyker-elite-common.mjs";
import { setPendingManifest, pendingManifest } from "./psyker-elite-hooks-state.mjs";

const NS = "warhammer-dbc";
const SHIELD = "🛡";
const line = html => `<div class="roll-threshold">${html}</div>`;

const shieldPatch = (actor, value, down) => ({
  [`system.resourcePools.${CHAIN_SHIELD_KEY}`]: Math.max(0, value),
  [`flags.${NS}.${CHAIN_SHIELD_DOWN_FLAG}`]: !!down
});

// ── Шрамы Цепей: урон в Характеристики от самого архетипа ─────────────────

/**
 * Урон себе в Характеристики от Черт/Талантов Дикого Псайкера. Одно число на
 * каждую из `keys`. Шрамы Цепей: тест Cor+10, урон уменьшается на Успехи.
 * @param {Actor} actor
 * @param {number} amount
 * @param {{keys?:string[], source:string, portion?:object|null}} o
 * @returns {Promise<{lines:string[], applied:Record<string,number>, died:boolean}>}
 */
export async function chainSelfDamage(actor, amount, { keys = ["t", "s"], source = "", portion = null } = {}) {
  let dmg = Math.max(0, Number(amount) || 0);
  const lines = [];
  if (dmg > 0 && hasChainScars(actor)) {
    const t = await eliteTest(actor, {
      what: { cor: true }, mod: CHAIN_SCARS_MOD, title: `Шрамы Цепей (${source})`, icon: SHIELD,
      success: d => `урон в Характеристики −${d}`, failure: "урон не уменьшен"
    });
    if (t.success) {
      const after = chainScarsReduce(dmg, t.deg);
      lines.push(line(`Шрамы Цепей: урон ${dmg} → <b>${after}</b> (−${t.deg} Успехов Cor+10).`));
      dmg = after;
    }
  }
  const applied = {};
  let died = false;
  for (const k of keys) {
    if (dmg <= 0 || died) { applied[k] = 0; continue; }
    const r = await applyCharDamage(actor, k, dmg, portion ? { portion: { ...portion } } : {});
    applied[k] = r.applied;
    died = died || r.died;
  }
  lines.push(line(`Урон в ${keys.map(k => k.toUpperCase()).join(" и ")}: <b>${keys.map(k => `${k.toUpperCase()} −${applied[k] ?? 0}`).join(", ")}</b>${portion ? " (не лечится отдыхом и медитацией)" : ""}.`));
  if (died) lines.push(line(`<b>T упала до нуля — ${esc(actor.name)} погибает.</b>`));
  return { lines, applied, died };
}

// ── Щит Цепей: урон ────────────────────────────────────────────────────────

/**
 * Попадание по актору со Щитом Цепей. Зовёт applyDamageToActor до обычного
 * поглощения. { handled:true } — урон целиком ушёл в Щит (или пропал как
 * «лишний»), дальше считать нечего.
 */
export async function chainShieldIntercept(actor, { rawDamage = 0, penetration = 0, ignored = false, weaponName = "" } = {}) {
  if (!actor || !hasShieldOfChains(actor) || ignored) return { handled: false };
  const max = chainShieldMax(actor);
  const pool = chainShieldValue(actor);
  if (max <= 0 || pool <= 0 || chainShieldDown(actor)) return { handled: false };
  const boosted = witheringActive(actor);
  const hit = chainShieldHit({
    damage: rawDamage, penetration, pr: Number(actor.system?.psyker?.rating) || 0,
    wb: charBonus(actor, "wp"), pool, boosted
  });
  await actor.update(shieldPatch(actor, hit.after, hit.broke));
  await infoCard(actor, `Щит Цепей${weaponName ? `: ${weaponName}` : ""}`, [
    line(`Урон <b>${Number(rawDamage) || 0}</b> − AP Щита ${hit.effAp}${hit.ap !== hit.effAp ? ` (бPR ${hit.ap}, Pen ${penetration})` : ""} − W.b ${hit.wb}${boosted ? " (Иссушающий Заряд: ×2)" : ""} = <b>${hit.net}</b> по Щиту.`),
    line(`Раны Щита: ${hit.before} → <b>${hit.after}</b> / ${max}.`),
    hit.broke ? line(`<b>Щит отключён</b>${hit.wasted ? `: лишний урон ${hit.wasted} проигнорирован` : ""}. Пока он не восстановит все Раны, урон идёт по псайкеру как обычно.`) : ""
  ], { icon: SHIELD });
  return { handled: true, hit };
}

// ── Начало Хода ────────────────────────────────────────────────────────────

/** Начало Хода Дикого Псайкера: метки Талантов и регенерация Щита. */
export async function processWildPsykerTurnStart(actor) {
  if (!actor || !hasShieldOfChains(actor)) return;
  const gone = await tickTurnFlags(actor, [WITHERING_FLAG, ALACRITY_FLAG]);
  const veil = veilStepsFor(actor).total;
  const r = chainShieldTurnStart(actor, veil);
  const lines = [];
  if (gone.includes(WITHERING_FLAG)) lines.push(line("Иссушающий Заряд кончился: AP и поглощение Щита снова обычные."));
  if (gone.includes(ALACRITY_FLAG)) lines.push(line("Цепи Стремительности кончились: Hoverer и Acrobatics/Dodge снова обычные."));
  if (r.after !== r.before || r.wasDown !== r.down) {
    await actor.update(shieldPatch(actor, r.after, r.down));
    lines.push(line(`Регенерация: +${r.after - r.before} (${veil >= 3 ? `бPR — Завеса ${veil}` : "тPR"}) → <b>${r.after}</b> / ${r.max}.`));
    if (r.wasDown && !r.down) lines.push(line("<b>Щит снова включён</b> — все Раны восстановлены."));
    else if (r.down) lines.push(line("Щит отключён, пока не восстановит все Раны."));
  } else if (veil < 0 && r.before < r.max) {
    lines.push(line(`Завеса ${veil} (освящённое место): Щит не регенерирует.`));
  }
  if (lines.length) await infoCard(actor, "Щит Цепей", lines, { icon: SHIELD });
}

// ── Отторжение Цепей: часы Календаря ───────────────────────────────────────

/** Обработчик CONDITION_CLOCK_HANDLERS: 1 урона в S и T за каждую полную неделю. */
export async function chainRejectionClock(actor, { from, to }) {
  if (!hasChainRejection(actor)) return;
  const trait = [...actor.items].find(i => i.type === "trait" && hasChainRejection({ items: [i] }));
  if (!trait) return;
  const mark = trait.getFlag(NS, REJECTION_FLAG);
  if (mark == null) { await trait.setFlag(NS, REJECTION_FLAG, Number(from)); return; }
  const { weeks, next } = rejectionWeeks(mark, to);
  if (weeks <= 0) return;
  await trait.setFlag(NS, REJECTION_FLAG, next);
  const lines = [line(`Прошло недель: <b>${weeks}</b> — Порванные Цепи высасывают жизнь.`)];
  for (let i = 0; i < weeks; i++) {
    const r = await chainSelfDamage(actor, 1, {
      source: "Отторжение Цепей",
      portion: { hours: 0, source: "Отторжение Цепей / Chain Rejection" }
    });
    lines.push(...r.lines);
    if (r.died) break;
  }
  lines.push(line("Лечат только эликсиры и биомантия (лечение «сверхъестественным» разрешено)."));
  await infoCard(actor, "Отторжение Цепей", lines, { icon: "⛓" });
}

// ── Кнопки Талантов ────────────────────────────────────────────────────────

/** Пламя Сердца: 1d5 урона в T и S, тот же кубик — +эPR следующей манифестации. */
export async function useHeartFire(actor) {
  if (!hasHeartFire(actor)) return ui.notifications.warn("⚠️ Нет Таланта Пламя Сердца.");
  if (pendingManifest(actor).heartFire) return ui.notifications.warn("⚠️ Пламя Сердца уже ждёт следующей манифестации.");
  const roll = await new Roll(HEART_FIRE_DIE).evaluate();
  const dmg = await chainSelfDamage(actor, roll.total, { source: "Пламя Сердца" });
  await setPendingManifest(actor, { heartFire: roll.total });
  await infoCard(actor, "Пламя Сердца", [
    line(`1d5 = <b>${roll.total}</b>: +${roll.total} к эPR следующей манифестации (окно манифестации прибавит само).`),
    ...dmg.lines
  ], { icon: "🔥", rolls: [roll] });
}

/** Мощь Переполняет: Щит полон — потратить все Раны, эPR следующей силы ×2 и Варп-Прорыв. */
export async function usePowerOverwhelming(actor) {
  if (!hasPowerOverwhelming(actor)) return ui.notifications.warn("⚠️ Нет Таланта Мощь Переполняет.");
  const max = chainShieldMax(actor), cur = chainShieldValue(actor);
  if (!hasShieldOfChains(actor) || max <= 0 || cur < max || chainShieldDown(actor))
    return ui.notifications.warn(`⚠️ Щит Цепей не полон (${cur}/${max}) — Мощь Переполняет недоступна.`);
  if (pendingManifest(actor).overwhelming) return ui.notifications.warn("⚠️ Мощь Переполняет уже ждёт следующей манифестации.");
  await actor.update(shieldPatch(actor, 0, true));
  await setPendingManifest(actor, { overwhelming: charBonus(actor, "wp") || 1 });
  await infoCard(actor, "Мощь Переполняет", [
    line(`Все Раны Щита (${max}) потрачены — Щит отключён до полной регенерации.`),
    line("Следующая манифестация: <b>эPR ×2</b> (после всех бонусов) и <b>Варп-Прорыв</b> сверх обычных Феноменов — окно манифестации сделает само."),
    line(`Поддерживаемая так сила развеивается через W.b = ${charBonus(actor, "wp")} Ходов.`)
  ], { icon: "⚡" });
}

/** Иссушающий Заряд: Реакция, 2d10+5 в T и S — Щит полон, AP и W.b Щита ×2 до конца следующего Хода. */
export async function useWitheringCharge(actor) {
  if (!hasWitheringCharge(actor)) return ui.notifications.warn("⚠️ Нет Таланта Иссушающий Заряд.");
  if (!hasShieldOfChains(actor)) return ui.notifications.warn("⚠️ Нет Черты Щит Цепей.");
  if (!(await spendReaction(actor, { physical: false }))) return ui.notifications.warn("⚠️ Реакций не осталось.");
  const roll = await new Roll(WITHERING_COST).evaluate();
  const dmg = await chainSelfDamage(actor, roll.total, { source: "Иссушающий Заряд" });
  const max = chainShieldMax(actor);
  await actor.update(shieldPatch(actor, max, false));
  await setTurnFlag(actor, WITHERING_FLAG, 2);
  await infoCard(actor, "Иссушающий Заряд", [
    line(`2d10+5 = <b>${roll.total}</b> (Реакция потрачена).`),
    ...dmg.lines,
    line(`Щит Цепей полон: <b>${max}</b> / ${max}, до конца следующего Хода AP и поглощение через W.b <b>×2</b> (урон по Щиту посчитает сам).`)
  ], { icon: "💀", rolls: [roll] });
}

/** Цепи Стремительности: тPR непоглощаемого урона Щиту — Hoverer ×2, W вместо A до начала следующего Хода. */
export async function useChainsOfAlacrity(actor) {
  if (!hasChainsOfAlacrity(actor)) return ui.notifications.warn("⚠️ Нет Таланта Цепи Стремительности.");
  if (!hasShieldOfChains(actor) || chainShieldDown(actor) || chainShieldValue(actor) <= 0)
    return ui.notifications.warn("⚠️ Щит Цепей отключён — платить нечем.");
  const cost = currentPr(actor);
  const before = chainShieldValue(actor);
  const after = Math.max(0, before - cost);
  const broke = after <= 0;
  await actor.update(shieldPatch(actor, after, broke));
  await setTurnFlag(actor, ALACRITY_FLAG, 1);
  await infoCard(actor, "Цепи Стремительности", [
    line(`Щиту — тPR = ${cost} непоглощаемого урона: ${before} → <b>${after}</b>${broke ? " (Щит отключён)" : ""}.`),
    line("До начала следующего Хода: рейтинг Hoverer <b>×2</b> (скорость полёта на листе уже удвоена), в Acrobatics и Dodge — <b>W вместо A</b> (итог Навыков на листе уже пересчитан)."),
    line("Книга: «в начале своего Хода, сразу после регенерации Щита» — момент за столом.")
  ], { icon: "💨" });
}

/** Пожиратель Смерти: умершие рядом — тест Cor+0 (+5 за каждого после первого), Успехи → Раны Щита. */
export async function useDeathEater(actor) {
  if (!hasDeathEater(actor)) return ui.notifications.warn("⚠️ Нет Таланта Пожиратель Смерти.");
  if (!hasShieldOfChains(actor)) return ui.notifications.warn("⚠️ Нет Черты Щит Цепей.");
  const cor = Number(actor.system?.corruption?.value) || 0;
  const deaths = await askNumber("Пожиратель Смерти", `Сколько разумных с душой умерло в пределах ${cor} м с начала прошлого Хода`, 1, { min: 0, max: 50 });
  if (!deaths) return;
  const mod = deathEaterMod(deaths);
  const t = await eliteTest(actor, {
    what: { cor: true }, mod, title: "Пожиратель Смерти", icon: SHIELD,
    extraParts: mod ? [`+${mod} за ${deaths - 1} умерших сверх первого`] : [],
    success: d => `+${d} Ран Щиту`, failure: "эхо смерти ускользает"
  });
  if (!t.success) return;
  const max = chainShieldMax(actor);
  const before = chainShieldValue(actor);
  const after = Math.min(max, before + t.deg);
  const down = chainShieldDown(actor) && after < max;
  await actor.update(shieldPatch(actor, after, down));
  await infoCard(actor, "Пожиратель Смерти", [
    line(`Раны Щита: ${before} → <b>${after}</b> / ${max}${chainShieldDown(actor) && !down ? " — Щит снова включён" : ""}.`)
  ], { icon: SHIELD });
}

// ── Остаточное Поглощение ──────────────────────────────────────────────────

/**
 * preUpdateItem: снимается поддержание психосилы. Пока предмет ещё помнит
 * эPR поддержания — все Дикие Псайкеры с Талантом в пределах W.b м от
 * псайкера-владельца силы получают эPR Ран в Щит.
 */
export function onPsyPowerPreUpdate(item, changes) {
  if (item?.type !== "psychicPower" || !item.system?.isSustained) return;
  if (foundry.utils.getProperty(changes, "system.isSustained") !== false) return;
  const caster = item.actor;
  if (!caster) return;
  const epr = Number(item.system?.sustainedEpr ?? caster.system?.psyker?.currentRating) || 0;
  if (epr <= 0) return;
  residualAbsorption(caster, epr, item.name).catch(err => console.error("warhammer-dbc | Остаточное Поглощение:", err));
}

async function residualAbsorption(caster, epr, powerName) {
  const scene = [...(globalThis.canvas?.scene?.tokens ?? [])].map(t => t.actor).filter(Boolean);
  const pool = scene.length ? scene : [caster];
  const seen = new Set();
  for (const a of pool) {
    if (seen.has(a.uuid)) continue;
    seen.add(a.uuid);
    if (!hasResidualAbsorption(a) || !hasShieldOfChains(a)) continue;
    const dist = a === caster ? 0 : actorsDistance(a, caster);
    const wb = charBonus(a, "wp");
    if (dist == null || dist > wb) continue;
    const max = chainShieldMax(a), before = chainShieldValue(a);
    const after = Math.min(max, before + epr);
    if (after === before) continue;
    const down = chainShieldDown(a) && after < max;
    if (!a.isOwner) {
      await infoCard(a, "Остаточное Поглощение", [line(`Развеялась «${esc(powerName)}» (эPR ${epr}) в ${Math.round(dist)} м — ГМу: Щит Цепей ${before} → ${after}.`)], { icon: SHIELD });
      continue;
    }
    await a.update(shieldPatch(a, after, down));
    await infoCard(a, "Остаточное Поглощение", [
      line(`Развеялась поддерживаемая «${esc(powerName)}» (эPR ${epr}) в пределах W.b ${wb} м: Щит Цепей ${before} → <b>${after}</b> / ${max}${chainShieldDown(a) && !down ? " — Щит снова включён" : ""}.`)
    ], { icon: SHIELD });
  }
}

export const WILD_PSYKER_API = {
  useHeartFire, usePowerOverwhelming, useWitheringCharge, useChainsOfAlacrity, useDeathEater
};
