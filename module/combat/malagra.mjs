// module/combat/malagra.mjs
// ════════════════════════════════════════════════════════════════════════════
//  МАЛАГРА — кнопки Черт и Талантов и такт начала Хода (арифметика —
//  rules/malagra-talents.mjs). Йовекс и Совершенная Катушка в самой активации
//  Техночуда — sheets/tabs/tech.mjs::activateTechMiracle.
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { mech1Card, rollMech1Test } from "./mech1-rolls.mjs";
import { expectedPhase, legacyEffectsToChanges } from "../constants/effect-keys.mjs";
import { hasMechanicusImplants } from "../rules/archmagos-talents.mjs";
import {
  hasAstralConverter, astralRegen, hasParagonCoil, PARAGON_FLAG, PARAGON_COST, paragonIntBonus,
  hasVenefactor, VENEFACTOR_AP, VENEFACTOR_REACTION, fellDischargeEffect, FELL_DISCHARGE_SUCCESSES,
  MAGNETO_OPTIONS, magnetoPlan, magnetoLift
} from "../rules/malagra-talents.mjs";

const NS = "warhammer-dbc";
const num = v => Number(v) || 0;
const firstTarget = () => [...(game.user?.targets ?? [])].map(t => t.actor).find(Boolean) ?? null;

// ── Начало Хода ─────────────────────────────────────────────────────────────

/**
 * Начало Хода Малагры (активный ГМ, после сброса ОД): Астральный Конвертер
 * +1 заряд, Совершенная Катушка гаснет, Вэнефактор +1 ОД и +1 Реакция.
 */
export async function processMalagraTurnStart(actor) {
  const upd = {};
  if (hasAstralConverter(actor) && actor.system?.energy) {
    const add = astralRegen(actor.system.energy);
    if (add) upd["system.energy.value"] = num(actor.system.energy.value) + add;
  }
  if (actor.getFlag?.(NS, PARAGON_FLAG)) upd[`flags.${NS}.-=${PARAGON_FLAG}`] = null;
  // Вэнефактор: только если Ход не заперт (Оглушение и т.п. уже обнулили ОД).
  if (hasVenefactor(actor) && num(actor.system?.actionPoints?.value) > 0) {
    upd["system.actionPoints.value"] = num(actor.system.actionPoints.value) + VENEFACTOR_AP;
    upd["system.reactions.value"] = num(actor.system?.reactions?.value) + VENEFACTOR_REACTION;
  }
  if (Object.keys(upd).length) await actor.update(upd);
}

// ── Совершенная Катушка ─────────────────────────────────────────────────────

/** Потратить 1 заряд: ½P / ½P.b к I и I.b в эффектах Техночудес до начала следующего Хода. */
export async function useParagonCoil(actor) {
  if (!actor || !hasParagonCoil(actor)) return ui.notifications?.warn("⚠️ У актора нет Черты Совершенная Катушка.");
  if (actor.getFlag?.(NS, PARAGON_FLAG)) return ui.notifications?.info("Совершенная Катушка уже активирована до начала следующего Хода.");
  const v = num(actor.system?.energy?.value);
  if (v < PARAGON_COST) return ui.notifications?.warn(`⚠️ В Катушке Потенции нет заряда (${v}).`);
  await actor.update({ "system.energy.value": v - PARAGON_COST, [`flags.${NS}.${PARAGON_FLAG}`]: true });
  const b = paragonIntBonus(actor);
  return mech1Card(actor, {
    icon: "🧲", title: "Совершенная Катушка",
    lines: [
      `−${PARAGON_COST} ⚡ (${v} → ${v - PARAGON_COST}). До начала следующего Хода: I +<b>${b.i}</b>, I.b +<b>${b.ib}</b> в эффектах Техночудес.`,
      "Учитывается при активации Техночуда сама; гаснет, если Катушка опустеет."
    ]
  });
}

// ── Цифровой Призрак ────────────────────────────────────────────────────────

/** Stealth(P)+0: Успехи отнимаются от Успехов Ноосферного Сканирования. */
export async function useDigitalGhost(actor) {
  return rollMech1Test(actor, {
    title: "Цифровой Призрак", icon: "👻", skill: "stealth", char: "per",
    lines: ["<div class=\"roll-threshold\" style=\"font-size:0.85em;\">Действие, засекаемое Ноосферным Сканированием.</div>"],
    success: "Столько Успехов отнимается от Успехов Ноосферного Сканирования наблюдателя"
  });
}

// ── Жестокая Разрядка ───────────────────────────────────────────────────────

/** Разрядить Катушку Потенции цели (T) после Numerica Dominion с 3+ Успехами. */
export async function useFellDischarge(actor) {
  const target = firstTarget();
  if (!target) return ui.notifications?.warn("⚠️ Выберите целью (T) того, чью Катушку Потенции разряжаете.");
  const known = target.system?.energy ? num(target.system.energy.value) : null;
  const raw = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Жестокая Разрядка — ${actor.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="margin:4px 6px;">Numerica Dominion прошёл с <b>${FELL_DISCHARGE_SUCCESSES}+</b> Успехами? Тогда Катушка ${esc(target.name)} разряжается.</p>
      <div class="form-group"><label>Зарядов в Катушке цели</label><input type="number" name="n" min="0" value="${known ?? 0}" ${known != null ? "" : "autofocus"}/></div>`,
    ok: { label: "Разрядить", callback: (_ev, b) => b.form.querySelector("[name=n]")?.value }
  }).catch(() => null);
  if (raw == null) return;
  const charges = Math.max(0, Math.trunc(num(raw)));
  const fx = fellDischargeEffect(charges);
  const lines = [`${esc(target.name)}: Катушка разряжена (${charges} ⚡ → 0) — <b>${fx.damage}</b> непоглощаемого E(El) урона, <b>${fx.fatigue}</b> Усталости, Оглушение на 1 Раунд (Паралич).`];
  const mine = game.user?.isGM || target.isOwner;
  const { writeToTarget } = await import("./gm-relay.mjs");
  if (mine) {
    const upd = {};
    if (target.system?.energy) upd["system.energy.value"] = 0;
    const { statusApplyFields } = await import("./status-resist.mjs");
    const { conditionLevelField } = await import("../constants/conditions.mjs");
    const lf = conditionLevelField("stunned");
    const cur = lf ? num(target.system?.conditions?.[lf]) : 0;
    const stun = await statusApplyFields(target, "stunned", Math.max(1, cur), { attacker: actor, source: "Жестокая Разрядка" });
    Object.assign(upd, stun?.fields ?? {});
    if (stun?.note) lines.push(stun.note);
    if (Object.keys(upd).length) await target.update(upd);
    // «Непоглощаемый» — мимо брони и Стойкости, прямо в Раны (как у Разгона Траллов).
    if (fx.damage) {
      const { applyWoundLoss } = await import("../rules/wounds.mjs");
      const loss = await applyWoundLoss(target, fx.damage);
      lines.push(`Раны ${loss?.currentWounds ?? "?"} → ${loss?.newWounds ?? "?"}.`);
    }
  } else lines.push(`Цель не ваша: Мастеру — обнулить Катушку, снять ${fx.damage} Ран мимо брони и Стойкости, наложить Оглушение на 1 Раунд.`);
  if (fx.fatigue) await writeToTarget(target, { kind: "addFatigue", amount: Math.min(20, fx.fatigue) }, actor);
  return mech1Card(actor, { icon: "⚡", title: "Жестокая Разрядка", lines });
}

// ── Магнитоморфоз ───────────────────────────────────────────────────────────

export const MAGNETO_FLAG = "magnetomorphosis";
const magnetoEffectsOf = a => [...(a?.effects ?? [])].filter(e => e.getFlag?.(NS, MAGNETO_FLAG) ?? e.flags?.[NS]?.[MAGNETO_FLAG]);

/** Эффект Магнитоморфоза: кокон — +AP всем частям тела, форма чудовищ — Страх 2. */
export function magnetoEffectData(picks = {}) {
  const changes = [];
  const cocoon = Math.max(0, Math.trunc(num(picks.cocoon)));
  if (cocoon) changes.push(...legacyEffectsToChanges({ armourAll: cocoon }));
  if (num(picks.beast) > 0) changes.push({ key: "system.fearRating", type: "upgrade", value: 2, phase: expectedPhase("system.fearRating"), priority: 0 });
  if (!changes.length) return null;
  return { name: "Магнитоморфоз", img: "icons/svg/lightning.svg", system: { changes }, flags: { [NS]: { [MAGNETO_FLAG]: true } } };
}

/** Активация Ferric Commandment вместо двух рук: распределить I.b баллов. */
export async function useMagnetomorphosis(actor) {
  const old = magnetoEffectsOf(actor).map(e => e.id).filter(Boolean);
  if (old.length) {
    const drop = await foundry.applications.api.DialogV2.confirm({
      window: { title: `Магнитоморфоз — ${actor.name}` },
      content: "<p>Магнитоморфоз уже действует. Снять кокон и форму чудовищ?</p>", rejectClose: false
    });
    if (drop) await actor.deleteEmbeddedDocuments("ActiveEffect", old);
    return;
  }
  const ib = num(actor.system?.characteristics?.int?.bonus);
  const rows = Object.entries(MAGNETO_OPTIONS).map(([k, o]) =>
    `<div class="form-group"><label>${esc(o.label)} — ${o.cost}б</label><input type="number" name="${k}" min="0" value="0"/></div>`).join("");
  const picks = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Магнитоморфоз — ${actor.name}` },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="margin:4px 6px;">Баллов: <b>${ib}</b> (I.b). Варианты можно брать несколько раз.</p>${rows}`,
    ok: { label: "Готово", callback: (_ev, b) => Object.fromEntries(Object.keys(MAGNETO_OPTIONS).map(k => [k, num(b.form.querySelector(`[name=${k}]`)?.value)])) }
  }).catch(() => null);
  if (!picks) return;
  const plan = magnetoPlan(picks, ib);
  if (!plan.ok) return ui.notifications?.warn(`⚠️ ${plan.reason}`);
  const fx = magnetoEffectData(picks);
  if (fx) await actor.createEmbeddedDocuments("ActiveEffect", [fx]);
  const lift = magnetoLift(ib);
  const lines = [`Потрачено ${plan.spent} из ${ib} баллов.`];
  if (picks.hand) lines.push(`Магнитных рук: <b>${picks.hand}</b>.`);
  if (picks.cocoon) lines.push(`Кокон: +<b>${picks.cocoon}</b> AP всем частям тела (эффект на листе). На земле нейтрализует E(El) атаки, −2 к интенсивности Haywire.`);
  if (picks.beast) lines.push("Кокону придана форма чудовищ: рейтинг Страха 2.");
  if (picks.lift) lines.push(`Подъём: до <b>${lift.kg}</b> кг (наполовину металлическая цель или в тяжёлой металлической броне), левитация на <b>${lift.m}</b> м. Целей: ${picks.lift}.`);
  lines.push("Снять — та же кнопка ещё раз.");
  return mech1Card(actor, { icon: "🧲", title: "Магнитоморфоз", lines });
}

// ── Пресконтакс ─────────────────────────────────────────────────────────────

/** Numerica Delving незаметно: жертва проваливает встречный тест с 1 Провалом, +1d5 воспоминаний. */
export async function usePrescontax(actor) {
  const roll = await new Roll("1d5").evaluate();
  const { postTestCard } = await import("../helpers/test-card.mjs");
  return postTestCard(actor, {
    icon: "🧠", title: `Пресконтакс — ${esc(actor.name)}`,
    lines: [
      "<div class=\"roll-threshold\">Жертва не засекла активацию Numerica Delving: встречный тест проваливается сам с 1 Провалом.</div>",
      `<div class="roll-threshold">Дополнительно считывается воспоминаний: <b>${roll.total}</b> (1d5).</div>`
    ]
  }, { rolls: [roll] });
}

// ── Рогоекс ─────────────────────────────────────────────────────────────────

const ROGOEX_SKILLS = { scrutiny: "Пристальность (Scrutiny)", intimidate: "Запугивание (Intimidate)", interrogate: "Допрос (Interrogate)" };

/** For.Lore (Mechanicum)(I) вместо Scrutiny, Intimidate или Interrogate против посвящённых. */
export async function useRogoex(actor) {
  const target = firstTarget();
  const which = await foundry.applications.api.DialogV2.wait({
    window: { title: `Рогоекс — ${actor.name}` }, classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="margin:4px 6px;">Какой Навык заменить тестом For.Lore (Mechanicum)(I)?${target ? ` Цель: ${esc(target.name)}.` : ""}</p>`,
    buttons: Object.entries(ROGOEX_SKILLS).map(([k, label], i) => ({ action: k, label, default: i === 0, callback: () => k })),
    rejectClose: false
  });
  if (!which) return;
  const lines = [`<div class="roll-threshold" style="font-size:0.85em;">Вместо: ${ROGOEX_SKILLS[which]}.</div>`];
  if (target && !hasMechanicusImplants(target)) {
    lines.push(`<div class="roll-threshold" style="font-size:0.85em;">⚠️ У ${esc(target.name)} не видно Имплантов Механикум — Рогоекс работает только против них и носящих Латы Скитариев.</div>`);
  }
  return rollMech1Test(actor, { title: "Рогоекс", icon: "🔍", group: "forbiddenLore", specialty: "Mechanicum", char: "int", lines });
}
