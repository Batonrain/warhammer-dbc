// module/combat/medic-chemistry.mjs
// Кнопки Талантов Медика поверх химии (чистая часть — rules/medic-chemistry.mjs): Повар, Противоядие,
// Глубокая Детоксикация, Плацебо. Запись на чужой лист идёт через ГМа (gm-relay, op.kind "medicChem").

import { esc, _degWord } from "../helpers/utils.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { spendInfamyPoint } from "./noise-marine.mjs";
import { actorHasInfamyPoint } from "../apps/infamy-points.mjs";
import { writeToTarget } from "./gm-relay.mjs";
import { startWithdrawal } from "./drug-withdrawal.mjs";
import { readWithdrawalEntries, isAddictedEntry, drugKey } from "../rules/drug-withdrawal.mjs";
import { conditionApplyFields } from "../sheets/tabs/conditions.mjs";
import { conditionLevelField } from "../constants/conditions.mjs";
import { sideValue } from "./opposed-contest.mjs";
import {
  MEDIC_STOCK_FLAG, PLACEBO_FLAG, ANTIVENOM_FLAG, PLACEBO_SCENE_FLAG, ANTIVENOM_SECONDS, SECONDS_PER_ROUND,
  hasCook, hasAntivenom, hasDeepDetox, hasPlacebo, medicStock, stockAdd, stockKey, cookBatch,
  deepDetoxStunMinutes, groupSkillValue, CHYMISTRY_RE, placeboFlag, stockUpdateData, isChemSupply
} from "../rules/medic-chemistry.mjs";

const NS = "warhammer-dbc";

function firstTarget(actor) {
  return [...(game.user?.targets ?? [])].map(t => t.actor).find(a => a && a !== actor) ?? null;
}

async function pick(title, label, options) {
  if (!options.length) return null;
  if (options.length === 1) return options[0].value;
  return foundry.applications.api.DialogV2.prompt({
    window: { title }, rejectClose: false,
    content: `<div class="form-group"><label>${esc(label)}</label><select name="pick">${
      options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select></div>`,
    ok: { label: "Выбрать", callback: (_e, b) => b.form.elements.pick.value }
  }).catch(() => null);
}

const findItem = (actor, re) => [...(actor?.items ?? [])].find(i => isChemSupply(i, re));
const DETOX_RE = /detox|детокс/i;
const STIMM_RE = /stimm|стимм/i;

/** Списать дозы расходника (Детокс, Стимм). false — не хватает, ничего не списано. */
async function spendDoses(actor, needs) {
  const found = needs.map(n => ({ ...n, item: findItem(actor, n.re) }));
  const short = found.filter(n => (Number(n.item?.system?.quantity) || 0) < n.qty);
  if (short.length) {
    ui.notifications.warn(`⚠️ Не хватает: ${short.map(n => `${n.label} ×${n.qty}`).join(", ")}.`);
    return false;
  }
  for (const n of found) await n.item.update({ "system.quantity": (Number(n.item.system.quantity) || 0) - n.qty });
  return true;
}

async function saveStock(actor, kind, name, n) {
  const prev = medicStock(actor);
  await actor.update(stockUpdateData(prev, stockAdd(prev, kind, name, n), NS));
}

/** Наркотики, от которых можно готовить: препараты с Зависимостью на листе и зависимости актора/цели. */
function addictiveDrugNames(actor, target) {
  const names = new Set();
  for (const i of actor?.items ?? []) if (i.type === "drug" && i.system?.addiction?.hasAddiction) names.add(i.name);
  for (const a of [actor, target]) {
    for (const e of Object.values(readWithdrawalEntries(a) ?? {})) if (isAddictedEntry(e) && e.name) names.add(e.name);
  }
  return [...names];
}

async function rollChem(actor, title, { label, base, mod = 0 }) {
  const rm = collectTestMods(actor, { kind: "skill", char: "int" });
  const threshold = base + mod + rm.total;
  const roll = await new Roll("1d100").evaluate();
  const res = testOutcome(roll.total, threshold);
  return { ...res, roll, line: rollStatLine({ label, base, parts: [mod ? `${mod > 0 ? "+" : ""}${mod}` : "", ...rm.parts].filter(Boolean), threshold, rv: roll.total }) };
}

// ── Повар ───────────────────────────────────────────────────────────────────

export async function cookMixes(actor) {
  if (!actor || !hasCook(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Повар.");
  const drug = await pick("Повар", "Против какого наркотика смеси?", addictiveDrugNames(actor, firstTarget(actor)).map(n => ({ value: n, label: n })));
  if (!drug) return ui.notifications.warn("⚠️ Нет наркотика с Зависимостью ни на листе, ни у вас, ни у цели.");
  if (!(await spendInfamyPoint(actor, "Повар"))) return;
  const n = cookBatch(actor);
  await saveStock(actor, "cook", drug, n);
  await postTestCard(actor, {
    icon: "🧪", title: `Повар — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Потрачено 1 Очко Бесчестия, 5 минут: <b>${n}</b> смес${n === 1 ? "ь" : "ей"} против «${esc(drug)}» (I.b). Запас: ${medicStock(actor).cook[stockKey(drug)] ?? n}. Смесь утоляет зависимость как полноценная доза — кнопка «Дать смесь».</div>`]
  }, { sound: false });
}

export async function giveCookMix(actor) {
  if (!actor || !hasCook(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Повар.");
  const stock = medicStock(actor).cook;
  const drug = await pick("Повар", "Какую смесь дать?", Object.entries(stock).map(([k, v]) => ({ value: k, label: `${k} (${v})` })));
  if (!drug) return ui.notifications.warn("⚠️ Готовых смесей нет.");
  const target = firstTarget(actor) ?? actor;
  if (!isAddictedEntry(readWithdrawalEntries(target)?.[drugKey(drug)])) {
    return ui.notifications.warn(`⚠️ ${target.name} не зависим(а) от «${drug}» — смесь не нужна.`);
  }
  // Запас уменьшается, только если запись на цель ушла (нет ГМа — смесь остаётся).
  if (!(await writeToTarget(target, { kind: "medicChem", action: "cook", drug }, actor))) return;
  await saveStock(actor, "cook", drug, -1);
  await postTestCard(actor, {
    icon: "🧪", title: `Смесь Повара → ${esc(target.name)}`,
    lines: [`<div class="roll-threshold">Зависимость от «${esc(drug)}» утолена как полноценной дозой: штраф снят, отсчёт частоты приёма заново.</div>`]
  }, { sound: false });
}

// ── Противоядие ─────────────────────────────────────────────────────────────

export async function makeAntivenom(actor) {
  if (!actor || !hasAntivenom(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Противоядие.");
  const poisons = [...(actor.items ?? [])].filter(i => i.type === "drug" && i.system?.drugCategory === "poison");
  const poison = await pick("Противоядие", "Против какого яда (образец на листе)?", poisons.map(p => ({ value: p.name, label: p.name })));
  if (!poison) return ui.notifications.warn("⚠️ На листе нет образца яда. Против неизвестного яда нужен образец или обследование (Medicae(P)−20).");
  // Очко проверяется до списания Детокса: без Очка расходники не сгорают.
  if (!actorHasInfamyPoint(actor)) return ui.notifications.warn("Нет Очка Бесчестия — Противоядие не активирован.");
  if (!(await spendDoses(actor, [{ re: DETOX_RE, qty: 3, label: "Детокс" }]))) return;
  if (!(await spendInfamyPoint(actor, "Противоядие"))) return;
  const sk = groupSkillValue(actor, "scholasticLore", CHYMISTRY_RE);
  const r = await rollChem(actor, "Противоядие", { label: "Scholastic Lore (Chymistry)", base: sk.value });
  if (r.success) await saveStock(actor, "antivenom", poison, r.deg);
  await postTestCard(actor, {
    icon: "💉", title: `Противоядие: ${esc(poison)} — ${esc(actor.name)}`,
    threshold: r.line,
    outcome: r.success
      ? outcomeHtml(true, `Успех — ${r.deg} ${_degWord(r.deg)}: ${r.deg} доз(ы) противоядия. Кнопка «Ввести противоядие» гасит яд у цели и даёт иммунитет на 24 часа.`)
      : outcomeHtml(false, `Провал — ${r.deg} ${_degWord(r.deg)}. Детокс и Очко потрачены впустую.`)
  }, { rolls: [r.roll] });
}

export async function giveAntivenom(actor) {
  if (!actor || !hasAntivenom(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Противоядие.");
  const stock = medicStock(actor).antivenom;
  const poison = await pick("Противоядие", "Какое противоядие ввести?", Object.entries(stock).map(([k, v]) => ({ value: k, label: `${k} (${v})` })));
  if (!poison) return ui.notifications.warn("⚠️ Готовых доз противоядия нет.");
  const target = firstTarget(actor) ?? actor;
  if (!(await writeToTarget(target, { kind: "medicChem", action: "antivenom", poison }, actor))) return;
  await saveStock(actor, "antivenom", poison, -1);
  await postTestCard(actor, {
    icon: "💉", title: `Противоядие → ${esc(target.name)}`,
    lines: [`<div class="roll-threshold">Полудействие: действие «${esc(poison)}» прекращено, иммунитет к этому яду на 24 часа игрового времени.</div>`]
  }, { sound: false });
}

// ── Глубокая Детоксикация ───────────────────────────────────────────────────

export async function makeDeepDetox(actor) {
  if (!actor || !hasDeepDetox(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Глубокая Детоксикация.");
  const names = [...new Set([...(actor.items ?? [])].filter(i => i.type === "drug" && i.system?.hasAfterEffect).map(i => i.name)
    .concat(addictiveDrugNames(actor, firstTarget(actor))))];
  const drug = await pick("Глубокая Детоксикация", "Против какого наркотика?", names.map(n => ({ value: n, label: n })));
  if (!drug) return ui.notifications.warn("⚠️ Нет наркотика с пост-эффектом на листе.");
  if (!(await spendDoses(actor, [{ re: DETOX_RE, qty: 2, label: "Детокс" }, { re: STIMM_RE, qty: 1, label: "Стимм" }]))) return;
  const sk = groupSkillValue(actor, "trade", CHYMISTRY_RE);
  const r = await rollChem(actor, "Глубокая Детоксикация", { label: "Trade (Chymist)", base: sk.value });
  if (r.success) await saveStock(actor, "deepDetox", drug, 1);
  await postTestCard(actor, {
    icon: "💉", title: `Глубокая Детоксикация: ${esc(drug)} — ${esc(actor.name)}`,
    threshold: r.line,
    outcome: r.success
      ? outcomeHtml(true, `Успех — ${r.deg} ${_degWord(r.deg)}: доза готова. Введённая страдающему от пост-эффекта, она снимет его и Оглушит на 1d5+1−${r.deg} минут.`)
      : outcomeHtml(false, `Провал — ${r.deg} ${_degWord(r.deg)}. Детокс и Стимм потрачены впустую.`)
  }, { rolls: [r.roll] });
  if (r.success) await actor.setFlag(NS, "deepDetoxDeg", { ...(actor.getFlag(NS, "deepDetoxDeg") ?? {}), [stockKey(drug)]: r.deg });
}

export async function giveDeepDetox(actor) {
  if (!actor || !hasDeepDetox(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Глубокая Детоксикация.");
  const stock = medicStock(actor).deepDetox;
  const drug = await pick("Глубокая Детоксикация", "Какую дозу ввести?", Object.entries(stock).map(([k, v]) => ({ value: k, label: `${k} (${v})` })));
  if (!drug) return ui.notifications.warn("⚠️ Готовых доз нет.");
  const target = firstTarget(actor) ?? actor;
  const deg = Number(actor.getFlag(NS, "deepDetoxDeg")?.[drug]) || 0;
  const d5 = await new Roll("1d5").evaluate();
  const stun = deepDetoxStunMinutes(d5.total, deg);
  if (!(await writeToTarget(target, { kind: "medicChem", action: "deepDetox", drug, stun: Math.min(6, stun) }, actor))) return;
  await saveStock(actor, "deepDetox", drug, -1);
  if (!medicStock(actor).deepDetox[drug]) await actor.update({ [`flags.${NS}.deepDetoxDeg.-=${drug}`]: null });
  await postTestCard(actor, {
    icon: "💉", title: `Глубокая Детоксикация → ${esc(target.name)}`,
    lines: [`<div class="roll-threshold">Пост-эффект «${esc(drug)}» снят. Оглушение: 1d5 (${d5.total}) +1 −${deg} = <b>${stun}</b> мин.</div>`]
  }, { rolls: [d5] });
}

// ── Плацебо ─────────────────────────────────────────────────────────────────

export async function usePlacebo(actor) {
  if (!actor || !hasPlacebo(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Плацебо.");
  const target = firstTarget(actor);
  if (!target) return ui.notifications.warn("⚠️ Возьмите в цель того, кому вводите «лекарство».");
  const sceneKey = `${game.combat?.id ?? canvas?.scene?.id ?? ""}`;
  const used = actor.getFlag(NS, PLACEBO_SCENE_FLAG) ?? {};
  if (used.key === sceneKey && (used.targets ?? []).includes(target.uuid)) {
    return ui.notifications.warn(`⚠️ Плацебо на ${target.name} уже применено в этой сцене/бою.`);
  }
  // Комбинированный тест: один бросок против обоих Порогов, Успехи — по худшему (стр. 25).
  // Книга: Deceive(I)+0 и Medicae(I)−10 — Обман от Интеллекта, не от Товарищества.
  const dec = sideValue(actor, { skill: "deceive", char: "int" });
  const med = sideValue(actor, { skill: "medicae", char: "int" });
  const rmD = collectTestMods(actor, { kind: "skill", skill: "deceive", char: "int" });
  const rmM = collectTestMods(actor, { kind: "skill", skill: "medicae", char: "int" });
  const tD = dec + rmD.total, tM = med - 10 + rmM.total;
  const roll = await new Roll("1d100").evaluate();
  const a = testOutcome(roll.total, tD), b = testOutcome(roll.total, tM);
  const success = a.success && b.success;
  const deg = success ? Math.min(a.deg, b.deg) : Math.max(a.success ? 0 : a.deg, b.success ? 0 : b.deg);
  // «Раз за сцену на цель» отмечается, только если запись на цель ушла.
  if (success && await writeToTarget(target, { kind: "medicChem", action: "placebo", rounds: Math.max(1, Math.min(30, deg)) }, actor)) {
    await actor.setFlag(NS, PLACEBO_SCENE_FLAG, { key: sceneKey, targets: [...(used.key === sceneKey ? used.targets ?? [] : []), target.uuid] });
  }
  await postTestCard(actor, {
    icon: "💊", title: `Плацебо → ${esc(target.name)}`,
    threshold: `<div class="roll-threshold">Комбинированный тест: Deceive(I) ${tD} и Medicae−10 ${tM}, бросок <b>${roll.total}</b></div>`,
    outcome: success
      ? outcomeHtml(true, `Успех — ${deg} ${_degWord(deg)}: ${esc(target.name)} не получает штрафа Усталости ${deg} Раунд(ов). Иммунитет к урону в Характеристики и уже полученным Критическим эффектам — за столом.`)
      : outcomeHtml(false, `Провал — ${deg} ${_degWord(deg)}.`)
  }, { rolls: [roll] });
}

// ── ГМ-сторона записи ───────────────────────────────────────────────────────

/** Исполнить «medicChem» на листе цели (у ГМа или у владельца цели). */
export async function performMedicChemWrite(target, op) {
  const now = game.time?.worldTime ?? 0;
  if (op.action === "cook") return startWithdrawal(target, { name: op.drug }, now);
  if (op.action === "antivenom") {
    const key = stockKey(op.poison);
    for (const it of target.items ?? []) {
      if (it.type === "drug" && stockKey(it.name) === key && it.system?.activeEffect?.isActive) {
        await it.update({ "system.activeEffect.isActive": false, "system.activeEffect.isAfterEffect": false,
          "system.activeEffect.roundsRemaining": 0, "system.activeEffect.expiresAt": null });
      }
    }
    return target.setFlag(NS, ANTIVENOM_FLAG, { ...(target.getFlag(NS, ANTIVENOM_FLAG) ?? {}), [key]: now + ANTIVENOM_SECONDS });
  }
  if (op.action === "deepDetox") {
    const key = stockKey(op.drug);
    for (const it of target.items ?? []) {
      if (it.type === "drug" && stockKey(it.name) === key && it.system?.activeEffect?.isAfterEffect) {
        await it.update({ "system.activeEffect.isActive": false, "system.activeEffect.isAfterEffect": false,
          "system.activeEffect.roundsRemaining": 0, "system.activeEffect.expiresAt": null });
      }
    }
    if (op.stun > 0) {
      const lf = conditionLevelField("stunned");
      const cur = lf ? (Number(target.system?.conditions?.[lf]) || 0) : 0;
      const rounds = op.stun * Math.round(60 / SECONDS_PER_ROUND);
      await target.update(conditionApplyFields("stunned", lf ? cur + rounds : null, target));
    }
    return true;
  }
  if (op.action === "placebo") {
    return target.setFlag(NS, PLACEBO_FLAG, placeboFlag(op.rounds, { now, combat: game.combat }));
  }
  return null;
}
