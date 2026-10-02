// module/combat/beastman-subrace.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Foundry-обвязка Субрас Зверолюда (wdbc-gao07; правила — rules/
//  beastman-subrace.mjs):
//   • khorngorRageTest — тест W+10 Кхорнгора при уроне (combat/damage.mjs);
//   • mournerOffer / mournerTb — Плакальщик Пестигора в конвейере урона;
//   • butcherStatus / addButcherDice — запас кубиков Мясника и кнопка на
//     карточке попадания (hooks.mjs, .wh-butcher-btn).
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { autoTestMods } from "../rules/roll-mods.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { isThrottleCountAvailable, incrementThrottleCount } from "../rules/cooldown.mjs";
import { SECONDS_PER_ROUND } from "../rules/condition-duration.mjs";
import {
  KHORNGOR_RAGE_CAPABILITY, KHORNGOR_BUTCHER_CAPABILITY, PESTIGOR_MOURNER_CAPABILITY,
  BUTCHER_FLAG, MOURNER_FLAG, MOURNER_USAGE, KHORNGOR_RAGE_MOD,
  butcherPool, butcherPerHitCap, butcherUsed, butcherAvailable, damageDieFaces,
  mournerTbFactor, mournerCanReduce
} from "../rules/beastman-subrace.mjs";

const NS = "warhammer-dbc";

const confirm = (title, text, yes, no) => foundry.applications.api.DialogV2.confirm({
  window: { title }, content: `<p>${text}</p>`, yes: { label: yes }, no: { label: no }
}).then(r => !!r).catch(() => false);

// ── Кхорнгор: Ярость от урона ─────────────────────────────────────────────

/**
 * «Каждый раз, когда он получает урон … W+10, или впасть в Ярость (может при
 * желании намеренно провалить)». Уже в Ярости — тест не нужен. Оскорбления и
 * угрозы — события за столом: движок видит только урон (как у Вспыльчивости,
 * rules/quick-to-anger.mjs).
 */
export async function khorngorRageTest(actor) {
  if (!actor || actor.system?.inRage || !hasRuleFlag(actor, KHORNGOR_RAGE_CAPABILITY)) return;
  const deliberate = await confirm("Кхорнгор: Ярость",
    `${esc(actor.name)} получил урон. Намеренно провалить тест W+10 и впасть в Ярость?`,
    "Впасть в Ярость", "Бросить тест");
  if (deliberate) {
    await actor.update({ "system.inRage": true });
    return postTestCard(actor, {
      icon: "😠", title: `Ярость Кхорнгора — ${esc(actor.name)}`,
      outcome: `<span class="roll-failure">Намеренно проваливает тест — впадает в Ярость</span>`
    }, { sound: false });
  }
  const wp = Number(actor.system?.characteristics?.wp?.total) || 0;
  const ruleMods = autoTestMods(actor, { kind: "skill", char: "wp" });
  const threshold = wp + KHORNGOR_RAGE_MOD + ruleMods.total;
  const roll = await new Roll("1d100").evaluate();
  const success = roll.total <= threshold;
  if (!success) await actor.update({ "system.inRage": true });
  await postTestCard(actor, {
    icon: "😠", title: `Ярость Кхорнгора — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "W", base: wp, parts: [`+${KHORNGOR_RAGE_MOD}`, ...ruleMods.parts], threshold, rv: roll.total }),
    outcome: success
      ? `<span class="roll-success">Успех — сдержался</span>`
      : `<span class="roll-failure">Провал — впадает в Ярость</span>`
  }, { rolls: [roll] });
}

// ── Пестигор Плакальщик ───────────────────────────────────────────────────

/** T.b с учётом Плакальщика: ×2 в течение 1 Раунда после его применения. */
export function mournerTb(actor, tb) {
  const until = actor?.getFlag?.(NS, MOURNER_FLAG);
  return (Number(tb) || 0) * mournerTbFactor(until, globalThis.game?.time?.worldTime ?? 0);
}

/**
 * Предложить Плакальщика после расчёта непоглощённого урона: «раз за бой —
 * уменьшить его до 1 и на 1 Раунд удвоить T.b». Возвращает итоговый урон и
 * строку для карточки ("" — не применялось).
 */
export async function mournerOffer(actor, netDamage) {
  const net = Number(netDamage) || 0;
  if (!actor || !hasRuleFlag(actor, PESTIGOR_MOURNER_CAPABILITY) || !mournerCanReduce(net)
      || !isThrottleCountAvailable(actor, MOURNER_USAGE, "battle", 1)) return { net, note: "" };
  const ok = await confirm("Пестигор Плакальщик",
    `${esc(actor.name)} получает непоглощённый урон: <b>${net}</b>. Уменьшить его до 1 и на 1 Раунд удвоить T.b (раз за бой)?`,
    "Уменьшить до 1", "Нет");
  if (!ok) return { net, note: "" };
  await incrementThrottleCount(actor, MOURNER_USAGE, "battle", 1);
  await actor.setFlag(NS, MOURNER_FLAG, (globalThis.game?.time?.worldTime ?? 0) + SECONDS_PER_ROUND);
  return { net: 1, note: `🕯 Плакальщик: непоглощённый урон ${net} → 1; T.b ×2 на 1 Раунд.` };
}

// ── Кхорнгор Мясник ───────────────────────────────────────────────────────

/** Состояние запаса кубиков Мясника: размер, потрачено, можно на одно попадание. */
export function butcherStatus(actor) {
  if (!actor || !hasRuleFlag(actor, KHORNGOR_BUTCHER_CAPABILITY)) return { pool: 0, used: 0, cap: 0, left: 0 };
  const pool = butcherPool(actor);
  const used = butcherUsed(actor.getFlag?.(NS, BUTCHER_FLAG), globalThis.game?.combat?.id ?? "");
  const cap = butcherPerHitCap(actor);
  return { pool, used, cap, left: butcherAvailable(pool, used, cap) };
}

/**
 * Потратить n кубиков Мясника и бросить добавочные кубики урона оружия.
 * @returns {Promise<{n:number, faces:number, rolls:Roll, total:number, extreme:boolean}|null>}
 */
export async function addButcherDice(actor, weapon) {
  const st = butcherStatus(actor);
  if (st.left < 1) { ui.notifications?.warn("Мясник: кубиков не осталось."); return null; }
  const n = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Кхорнгор Мясник — ${actor.name}` },
    content: `<form style="padding:4px 6px;">
      <p style="margin:4px 0;">Запас: <b>${st.pool - st.used}</b> из ${st.pool}; на это попадание — до <b>${st.left}</b> (½W.b).</p>
      <label>Сколько кубиков:</label>
      <input type="number" name="n" min="1" max="${st.left}" value="${st.left}" style="width:70px;"/></form>`,
    ok: { label: "Добавить", callback: (_e, button) => Number(button.form.elements.n.value) },
    rejectClose: false
  }).catch(() => null);
  const count = Math.max(0, Math.min(st.left, Math.floor(Number(n) || 0)));
  if (!count) return null;
  const faces = damageDieFaces(weapon?.system?.damage);
  const roll = await new Roll(`${count}d${faces}`).evaluate();
  const extreme = roll.dice.some(d => d.results.some(r => r.result === faces));
  await actor.setFlag(NS, BUTCHER_FLAG, { combatId: globalThis.game?.combat?.id ?? "", used: st.used + count });
  return { n: count, faces, roll, total: roll.total, extreme };
}
