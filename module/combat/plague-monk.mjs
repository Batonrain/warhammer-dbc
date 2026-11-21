// module/combat/plague-monk.mjs
// ════════════════════════════════════════════════════════════════════════
//  Чумной Монах — кнопки Черт и Талантов (арифметика —
//  rules/plague-monk-talents.mjs). Рейтинг Unnatural T как кошелёк:
//  Горячечная Скорость тратит, Пожиратель Мертвечины и Слушающий Червей
//  наполняют, Чревоугодие держит «лишние» очки сверх максимума. Текущий
//  рейтинг ложится в Бонус Стойкости ActiveEffect'ом (t.bonusFx += delta).
//
//  Гнилостное Просвещение и Истинная Гниль — не кнопки: кнопка Toxic в
//  карточке атаки Монаха (combat/weapon-properties.mjs → hooks.mjs).
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { computeWoundHealing } from "../sheets/tabs/wounds.mjs";
import { isCapabilityAvailable, markCapabilityUsed } from "../rules/cooldown.mjs";
import { grantTimedEffect } from "./timed-effects.mjs";
import {
  FEVER_FLAG, FEVER_EFFECT_KEY, FEVER_OPTIONS, feverState, feverSpendPlan, feverRestorePlan, feverUnarmedLimit,
  trueRotRadCap, hasFeveredSpeed, hasCarrionEater, hasFeverStance, hasTrueRot, hasWormListener,
  WORM_POUCH_FLAG, wormPouchCap, wormPouches
} from "../rules/plague-monk-talents.mjs";
import { NS, CANCEL, firstTarget, payActions, askChoice, askNumber, cultCard } from "./cult-common.mjs";

const ICON = "🪱";
const EFFECT_NAME = "Горячечная Скорость: рейтинг Unnatural T";

/** Эффект «t.bonusFx += delta» на акторе: создать, поправить или снять. */
async function syncFeverEffect(actor, delta) {
  const mine = [...(actor.effects ?? [])].filter(e => e.getFlag?.(NS, FEVER_EFFECT_KEY));
  if (!delta) {
    if (mine.length) await actor.deleteEmbeddedDocuments("ActiveEffect", mine.map(e => e.id));
    return;
  }
  const changes = [{ key: "system.characteristics.t.bonusFx", type: "add", value: delta, phase: "initial", priority: 0 }];
  if (mine.length) {
    await actor.updateEmbeddedDocuments("ActiveEffect", [{ _id: mine[0].id, "system.changes": changes }]);
    return;
  }
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: EFFECT_NAME, img: "icons/svg/biohazard.svg", system: { changes },
    flags: { [NS]: { [FEVER_EFFECT_KEY]: true } }
  }]);
}

/** Записать кошелёк (флаг + эффект). */
async function writeFever(actor, { delta, excess }) {
  await actor.update({ [`flags.${NS}.${FEVER_FLAG}`]: { delta, excess } });
  await syncFeverEffect(actor, delta);
}

const walletLine = st => `Рейтинг Unnatural T: <b>${st.current}</b> (на листе ${st.base}, потолок ${st.cap})${st.excessCap ? `, «лишних» Чревоугодия: <b>${st.excess}</b>/${st.excessCap}` : ""}.`;

/** Потратить n рейтинга; null — не хватило (предупреждение показано). */
async function spendFever(actor, n) {
  const st = feverState(actor);
  const plan = feverSpendPlan(st, n);
  if (!plan.ok) { ui.notifications.warn(`⚠️ ${actor.name}: ${plan.reason}`); return null; }
  await writeFever(actor, plan);
  return feverState(actor);
}

/** Пожирание: +n к рейтингу до Cor.b+2, остаток — «лишние» Чревоугодия. */
export async function restoreFever(actor, n) {
  const st = feverState(actor);
  const plan = feverRestorePlan(st, n);
  await writeFever(actor, plan);
  return { plan, after: feverState(actor) };
}

/** Горячечная Скорость: выбрать рывок, списать рейтинг, применить. */
export async function useFeveredSpeed(actor) {
  if (!hasFeveredSpeed(actor)) return ui.notifications.warn("⚠️ Нет Черты Горячечная Скорость.");
  const st = feverState(actor);
  const choice = await askChoice("Горячечная Скорость", "Рывок:",
    FEVER_OPTIONS.map(o => ({ value: o.key, label: `${o.label} — ${o.cost} Un.T` })),
    { hint: walletLine(st) });
  if (!choice) return CANCEL;
  const opt = FEVER_OPTIONS.find(o => o.key === choice);
  if (opt.key === "unarmed") {
    const limit = feverUnarmedLimit(actor.system?.characteristics?.ag?.bonus);
    if (limit < 1) return ui.notifications.warn("⚠️ ½ A.b (окр.▼) = 0 — безоружных атак Горячечной Скорости нет.");
    const used = Number(actor.getFlag(NS, "feverUnarmed")?.round === game.combat?.round ? actor.getFlag(NS, "feverUnarmed").n : 0) || 0;
    if (game.combat?.started && used >= limit) return ui.notifications.warn(`⚠️ Уже ${used} из ${limit} безоружных атак в этот Ход.`);
    if (game.combat?.started) await actor.setFlag(NS, "feverUnarmed", { round: game.combat.round, n: used + 1 });
  }
  const after = await spendFever(actor, opt.cost);
  if (!after) return CANCEL;
  const lines = [`Потрачено <b>${opt.cost}</b> Un.T: ${esc(opt.label)}.`];
  if (opt.key === "agility") {
    await grantTimedEffect(actor, { key: "feverAgility", name: "Горячечная Скорость: Unnatural A (+2)",
      img: "icons/svg/wingfoot.svg", changes: [{ key: "system.characteristics.ag.bonusFx", value: 2 }] });
    lines.push("A.b +2 до начала следующего Хода — уже в листе.");
  } else if (opt.key === "reaction") {
    const r = Number(actor.system?.reactions?.value) || 0;
    await actor.update({ "system.reactions.value": r + 1 });
    lines.push(`Реакции: ${r} → <b>${r + 1}</b> (можно и вне своего Хода).`);
  } else if (opt.key === "unarmed") {
    lines.push("Безоружная атака свободным действием — бросьте её с листа, ОД не нужны.");
  } else if (opt.key === "halfMove") {
    lines.push("Полудвижение свободным действием.");
  } else {
    lines.push(`Оружие ближнего боя покрыто трупным ядом: Toxic (2) и Corrosive (2) на ${Number(actor.system?.corruptionBonus) || 0} Раундов (Cor.b).`);
  }
  lines.push(walletLine(after), "Потраченный рейтинг вернёт только пожирание трупов.");
  await cultCard(actor, "Горячечная Скорость", lines, { icon: "🌡️" });
  return false;
}

/** Пожиратель Мертвечины: труп (T) — 1d5 + T.b Ран; старый/отравленный — ещё +1d5 к рейтингу. */
export async function devourCorpse(actor) {
  if (!hasCarrionEater(actor)) return ui.notifications.warn("⚠️ Нет Черты Пожиратель Мертвечины.");
  const corpse = firstTarget();
  if (!corpse) return ui.notifications.warn("Пожрать труп: выберите труп (T на токене).");
  const ans = await askChoice("Пожиратель Мертвечины", "Труп:", [
    { value: "fresh", label: "Свежий, умер обычной смертью" },
    { value: "blessed", label: "Старше 7 дней или умер от яда, болезни, радиации, трупного яда" }
  ], { hint: `«${esc(corpse.name)}»: 7 минут пиршества.` });
  if (!ans) return CANCEL;
  const tb = Number(corpse.system?.characteristics?.t?.bonus) || 0;
  return feast(actor, { name: corpse.name, tb, blessed: ans === "blessed" }, "Пожиратель Мертвечины");
}

/** Лечение 1d5 + T.b трупа и (для благословенного трупа) +1d5 к рейтингу. */
async function feast(actor, { name, tb, blessed }, title) {
  const roll = await new Roll("1d5").evaluate();
  const amount = roll.total + (Number(tb) || 0);
  const w = actor.system?.wounds ?? {};
  const before = Number(w.value) || 0;
  await actor.update(computeWoundHealing(actor.system, amount));
  const lines = [`Труп «${esc(name)}»: 1d5 (${roll.total}) + T.b (${tb}) = <b>${amount}</b> Ран (было ${before}).`];
  if (blessed) {
    const r2 = await new Roll("1d5").evaluate();
    const { plan, after } = await restoreFever(actor, r2.total);
    lines.push(`Благословенный труп: Unnatural T +1d5 (<b>${r2.total}</b>) — в рейтинг ${plan.toRating}${plan.toExcess ? `, в «лишние» ${plan.toExcess}` : ""}${plan.lost ? `, сверх потолка пропало ${plan.lost}` : ""}.`, walletLine(after));
  }
  await cultCard(actor, title, lines, { icon: "🍖" });
  return false;
}

/** Стойка Горячки: раз в Ход безоружная атака свободным действием, рейтинг не тратится. */
export async function useFeverStance(actor) {
  if (!hasFeverStance(actor)) return ui.notifications.warn("⚠️ Нет Таланта Стойка Горячки.");
  if (!isCapabilityAvailable(actor, "feverStance", "round")) return ui.notifications.warn("⚠️ Стойка Горячки: уже использована в этот Ход.");
  await markCapabilityUsed(actor, "feverStance", "round");
  await cultCard(actor, "Стойка Горячки", [
    "Безоружная атака свободным действием, без траты рейтинга Unnatural T — бросьте её с листа.",
    "Условие: двуручное оружие в двух руках или свободная рука."
  ], { icon: "👊" });
  return false;
}

/** Истинная Гниль: раз за бой до ½ W.b рейтинга → Rad (+1d5) трупному яду за каждый. */
export async function useTrueRotRad(actor) {
  if (!hasTrueRot(actor)) return ui.notifications.warn("⚠️ Нет Таланта Истинная Гниль.");
  if (!isCapabilityAvailable(actor, "trueRotRad", "battle")) return ui.notifications.warn("⚠️ Истинная Гниль: в этом бою уже вливали рейтинг в яд.");
  const st = feverState(actor);
  const cap = Math.min(trueRotRadCap(actor.system?.characteristics?.wp?.bonus), st.available);
  if (cap < 1) return ui.notifications.warn("⚠️ Нечего вливать: ½ W.b или рейтинг Unnatural T равны 0.");
  const n = await askNumber("Истинная Гниль", "Рейтинга в яд:", { min: 1, max: cap, value: cap, hint: walletLine(st) });
  if (!n) return CANCEL;
  const after = await spendFever(actor, n);
  if (!after) return CANCEL;
  await markCapabilityUsed(actor, "trueRotRad", "battle");
  await cultCard(actor, "Истинная Гниль", [
    `Потрачено <b>${n}</b> Un.T: трупный яд получает <b>Rad (+${n}d5)</b> до конца боя.`, walletLine(after)
  ], { icon: "☢️" });
  return false;
}

/** Слушающий Червей: 7 минут над трупом (T) — мешочек лучших кусков (не больше Cor.b). */
export async function cutWormPouch(actor) {
  if (!hasWormListener(actor)) return ui.notifications.warn("⚠️ Нет Таланта Слушающий Червей.");
  const corpse = firstTarget();
  if (!corpse) return ui.notifications.warn("Слушающий Червей: выберите труп (T на токене).");
  const list = wormPouches(actor);
  const cap = wormPouchCap(actor);
  if (list.length >= cap) return ui.notifications.warn(`⚠️ Мешочков уже ${list.length} из ${cap} (Cor.b).`);
  const ans = await askChoice("Слушающий Червей", "Труп:", [
    { value: "fresh", label: "Свежий, умер обычной смертью" },
    { value: "blessed", label: "Старше 7 дней или умер от яда, болезни, радиации, трупного яда" }
  ], { hint: `«${esc(corpse.name)}»: 7 минут. Сам труп после этого не даёт преимуществ пожирания.` });
  if (!ans) return CANCEL;
  const pouch = { name: corpse.name, tb: Number(corpse.system?.characteristics?.t?.bonus) || 0, blessed: ans === "blessed" };
  await actor.update({ [`flags.${NS}.${WORM_POUCH_FLAG}`]: [...list, pouch] });
  await cultCard(actor, "Слушающий Червей", [
    `Мешочек с кусками «${esc(pouch.name)}» (T.b ${pouch.tb}${pouch.blessed ? ", благословенный" : ""}). Мешочков: <b>${list.length + 1}</b>/${cap}.`
  ], { icon: ICON });
  return false;
}

/** Слушающий Червей: съесть мешочек за полудействие — как пожирание трупа. */
export async function eatWormPouch(actor) {
  if (!hasWormListener(actor)) return ui.notifications.warn("⚠️ Нет Таланта Слушающий Червей.");
  const list = wormPouches(actor);
  if (!list.length) return ui.notifications.warn("⚠️ Мешочков нет.");
  const idx = list.length === 1 ? "0" : await askChoice("Слушающий Червей", "Мешочек:",
    list.map((p, i) => ({ value: String(i), label: `${p.name} (T.b ${p.tb}${p.blessed ? ", благословенный" : ""})` })));
  if (idx == null) return CANCEL;
  if (!await payActions(actor, 1, { what: "Съесть мешочек" })) return CANCEL;
  const pouch = list[Number(idx)];
  await actor.update({ [`flags.${NS}.${WORM_POUCH_FLAG}`]: list.filter((_, i) => i !== Number(idx)) });
  return feast(actor, pouch, "Слушающий Червей: мешочек");
}

/** Чревоугодие: показать кошелёк рейтинга Unnatural T. */
export async function showFeverWallet(actor) {
  const st = feverState(actor);
  await cultCard(actor, "Чревоугодие: рейтинг Unnatural T", [
    walletLine(st),
    st.excessCap ? `«Лишние» копятся сверх потолка Cor.b+2 до ${st.excessCap} (2 за каждую копию Таланта) и тратятся раньше рейтинга.` : "Чревоугодия нет — сверх потолка ничего не копится."
  ], { icon: "🍽️" });
  return false;
}
