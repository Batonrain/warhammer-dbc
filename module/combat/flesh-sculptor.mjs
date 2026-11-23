// module/combat/flesh-sculptor.mjs
// ════════════════════════════════════════════════════════════════════════
//  Скульптор Плоти — кнопки (арифметика — rules/flesh-sculptor-talents.mjs).
//  Ритуал Лепки Плоти сам выдаёт подопытному Трейты из компендиума по
//  раскладке Успехов; Безумно Податливый — то же на себя, временно.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { applyUnnaturalChoice } from "../apps/unnatural-choice.mjs";
import { actorInfamyValue, changeActorInfamy } from "../apps/infamy-points.mjs";
import { gainResource, spendResource } from "../apps/resource-pools.mjs";
import { resourcePoolValue } from "../rules/resource-pools.mjs";
import { setDeceased } from "../sheets/tabs/body.mjs";
import { healActor } from "./heal-target.mjs";
import { secondaryCritHtml } from "./secondary-crit.mjs";
import {
  FLESHMOLD_FLAG, FLESHMOLD_GRANT_FLAG, FLESHMOLD_TEMP_FLAG, MALLEABLE_FLAG, SCULPTURITE_FLAG, FLESH_POOL,
  FLESHMOLD_TRAITS, FLESHMOLD_RATING_MAX,
  hasRiteOfFleshmolding, hasInsanelyMalleable, hasAppolyon, hasEidolon, hasNarcissus, hasSculpturite,
  fleshmoldModifier, sculpturiteMedicaeBonus, donorDice, fleshmoldTotal, fleshmoldCritFormula, fleshmoldCritLevel,
  fleshmoldPlanCheck, malleableAfterHour, trimGrantsToBudget, eidolonGain
} from "../rules/flesh-sculptor-talents.mjs";
import { NS, CANCEL, firstTarget, payActions, askNumber, askChoice, cultCard, rollCultTest } from "./cult-common.mjs";

const ICON = "🩸";
const worldTime = () => Number(globalThis.game?.time?.worldTime) || 0;
const canWrite = a => !!(game.user?.isGM || a?.isOwner);
const flagOf = (a, k) => a?.getFlag?.(NS, k);

/** Трейты раскладки на акторе: [{ item, key, rating }]. */
function grantsOn(actor, flag) {
  return (actor?.items ?? []).filter(i => i.type === "trait" && flagOf(i, flag))
    .map(i => ({ item: i, key: flagOf(i, flag).key, rating: Number(i.system?.rating) || 1 }));
}

/** Окно раскладки Успехов по Трейтам. null — отмена. */
async function askPlan(title, budget, current = {}) {
  const rows = FLESHMOLD_TRAITS.map(t => `<div class="atk-dlg-row"><label>${esc(t.label)}</label>
    <input type="number" name="${esc(t.key)}" min="0" max="${t.rated ? FLESHMOLD_RATING_MAX : 1}" value="${Number(current[t.key]) || 0}" class="pm-input" style="max-width:4em"/></div>`).join("");
  return foundry.applications.api.DialogV2.prompt({
    window: { title },
    content: `<p style="margin:4px 6px;">Успехов: <b>${budget}</b>. 1 Успех — Трейт без рейтинга (0/1) или +1 к рейтингу (до ${FLESHMOLD_RATING_MAX}).</p>
      <div style="max-height:420px;overflow:auto;">${rows}</div>`,
    ok: {
      label: "Применить",
      callback: (ev, button) => Object.fromEntries(FLESHMOLD_TRAITS.map(t => [t.key, Math.max(0, Math.trunc(Number(button.form.elements[t.key]?.value) || 0))]))
    },
    rejectClose: false
  }).catch(() => null);
}

/** Копия Трейта компендиума с рейтингом и меткой раскладки. */
async function traitData(def, rating, flag) {
  const src = await fromUuid(`Compendium.warhammer-dbc.traits.Item.${def.id}`).catch(() => null);
  if (!src) return null;
  const data = src.toObject();
  delete data._id;
  if (def.rated) data.system = { ...data.system, rating };
  let mech = data.flags?.[NS]?.mechanics ?? [];
  if (def.charKey) {
    mech = applyUnnaturalChoice(mech, def.charKey).groups
      .map(g => ({ ...g, entries: g.entries.map(e => e.kind === "script" ? { ...e, scriptOnGrant: false } : e) }));
  }
  data.flags = { ...(data.flags ?? {}), [NS]: { ...(data.flags?.[NS] ?? {}), mechanics: mech, [flag]: { key: def.key } } };
  return data;
}

/**
 * Переложить Трейты раскладки `flag` на акторе по плану: прежние снимаются,
 * новые выдаются из компендиума.
 */
async function applyPlan(subject, plan, flag) {
  const old = grantsOn(subject, flag).map(g => g.item.id);
  if (old.length) await subject.deleteEmbeddedDocuments("Item", old);
  const create = [];
  for (const def of FLESHMOLD_TRAITS) {
    const v = Math.trunc(Number(plan[def.key]) || 0);
    if (!v) continue;
    const d = await traitData(def, def.rated ? v : 1, flag);
    if (d) create.push(d);
  }
  if (create.length) await subject.createEmbeddedDocuments("Item", create);
  return create.map(d => `${d.name}${d.system?.hasRating ? ` (${d.system.rating})` : ""}`);
}

/** Раскладка Успехов по Трейтам (окно + выдача). */
async function distribute(subject, budget, flag, title) {
  if (!canWrite(subject)) { ui.notifications.warn(`⚠️ «${subject.name}» не ваш — Трейты выдаст ГМ (Успехов: ${budget}).`); return null; }
  const current = Object.fromEntries(grantsOn(subject, flag).map(g => [g.key, g.rating]));
  const plan = await askPlan(title, budget, current);
  if (!plan) return null;
  const check = fleshmoldPlanCheck(plan, budget);
  if (!check.ok) { ui.notifications.warn(`⚠️ ${check.reason}`); return null; }
  return applyPlan(subject, plan, flag);
}

/** Ритуал Лепки Плоти: подопытный — T на токене (с Нарциссом — можно себя без цели). */
export async function useFleshmolding(actor) {
  if (!hasRiteOfFleshmolding(actor)) return ui.notifications.warn("⚠️ Нет Черты Ритуал Лепки Плоти.");
  const subject = firstTarget() ?? (hasNarcissus(actor) ? actor : null);
  if (!subject) return ui.notifications.warn("⚠️ Ритуал Лепки Плоти: выберите подопытного (T на токене).");
  const self = subject === actor || subject.uuid === actor.uuid;
  if (self && !hasNarcissus(actor)) return ui.notifications.warn("⚠️ Ритуал на себе — только с Талантом Нарцисс.");
  const appolyonOk = hasAppolyon(actor) && !self;
  const res = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Ритуал Лепки Плоти — ${subject.name}` },
    content: `<p style="margin:4px 6px;">Операционная-храм Слаанеш, 6 часов. Все доноры погибают при любом исходе.</p>
      <div class="atk-dlg-row"><label>Доноров:</label><input type="number" name="donors" min="1" max="30" value="1" class="pm-input"/></div>
      <div class="atk-dlg-row"><label>Из них близких Скульптору:</label><input type="number" name="friends" min="0" max="30" value="0" class="pm-input"/></div>
      <div class="atk-dlg-row"><label><input type="checkbox" name="unwilling"/> Подопытный в сознании, не обезболен и не доброволец (+20)</label></div>
      ${appolyonOk ? `<div class="atk-dlg-row"><label><input type="checkbox" name="appolyon"/> Аполион: Очко Бесчестия — Успехи прибавляются к прежним (Провал — смерть подопытного; T подопытного дней)</label></div>` : ""}`,
    ok: {
      label: "Начать", callback: (ev, b) => ({
        donors: Math.max(1, Math.trunc(Number(b.form.elements.donors.value) || 1)),
        friends: Math.max(0, Math.trunc(Number(b.form.elements.friends.value) || 0)),
        unwilling: !!b.form.elements.unwilling.checked,
        appolyon: !!b.form.elements.appolyon?.checked
      })
    },
    rejectClose: false
  }).catch(() => null);
  if (!res) return CANCEL;
  if (res.appolyon) {
    if (actorInfamyValue(actor) < 1) return ui.notifications.warn("⚠️ Аполион: нет Очка Бесчестия.");
    await changeActorInfamy(actor, -1);
  }
  const scBonus = sculpturiteMedicaeBonus(actor, subject);
  const prev = Number(flagOf(subject, FLESHMOLD_FLAG)?.successes) || 0;
  const r = await rollCultTest(actor, {
    title: "Ритуал Лепки Плоти", icon: ICON, tests: [{ skill: "medicae", mod: 0 }],
    extraMod: fleshmoldModifier({ unwilling: res.unwilling, friends: res.friends, sculpturiteBonus: scBonus }),
    extraLabel: "Ритуал (−10, подопытный, близкие доноры, Скульптурит)",
    success: "плоть податлива", failure: "плоть отвергает изменения", targetActor: subject
  });
  const lines = [`Доноров: ${res.donors} — все погибают (уходят в материал).`];
  if (r.success) {
    const n = donorDice(res.donors);
    const dr = n ? await new Roll(`${n}d5`).evaluate() : null;
    const gained = r.deg + (dr?.total ?? 0);
    const total = fleshmoldTotal({ prev, gained, appolyon: res.appolyon });
    const wrote = canWrite(subject);
    if (wrote) await subject.update({ [`flags.${NS}.${FLESHMOLD_FLAG}`]: { successes: total, sculptor: actor.uuid } });
    lines.push(`Успехов: ${r.deg} теста + ${n ? `${n}d5 доноров = ${dr.total}` : "0"} → <b>${gained}</b>; у подопытного теперь <b>${total}</b> (прежде ${prev}${res.appolyon ? ", Аполион — сумма" : ", не хуже прежнего"}).`);
    await cultCard(actor, `Ритуал Лепки Плоти — ${subject.name}`, lines, { icon: ICON });
    const given = await distribute(subject, total, FLESHMOLD_GRANT_FLAG, `Лепка Плоти — ${subject.name}`);
    if (given) await cultCard(actor, "Лепка Плоти: Трейты", [given.length ? given.map(esc).join(", ") : "Трейты сняты."], { icon: ICON });
    return false;
  }
  // Провал: R Критический Эффект в торс, прежние Трейты ритуала пропадают; Аполион — смерть.
  const cr = await new Roll(fleshmoldCritFormula(r.deg)).evaluate();
  const level = fleshmoldCritLevel(cr.total);
  lines.push(`Провал: R Критический Эффект ${fleshmoldCritFormula(r.deg)} = ${cr.total} → <b>${level}</b> в торс.`);
  if (canWrite(subject)) {
    const old = grantsOn(subject, FLESHMOLD_GRANT_FLAG).map(g => g.item.id);
    if (old.length) { await subject.deleteEmbeddedDocuments("Item", old); lines.push(`Прежние Трейты ритуала пропали: ${old.length}.`); }
    if (prev) await subject.update({ [`flags.${NS}.${FLESHMOLD_FLAG}`]: { successes: 0, sculptor: actor.uuid } });
    if (res.appolyon) { await setDeceased(subject, true); lines.push("Аполион: подопытный умирает."); }
  } else lines.push("Подопытный не ваш — снять Трейты ритуала и последствия внесёт ГМ.");
  lines.push(await secondaryCritHtml(subject, { gotCritical: true, newCritical: level }, { damageType: "rending", hitLocation: "Торс" }));
  await cultCard(actor, `Ритуал Лепки Плоти — ${subject.name}`, lines, { icon: ICON });
  return false;
}

/** Безумно Податливый: полудействие + Очко Бесчестия (цена записи) + Medicae−10 → временные Успехи на себя. */
export async function useInsanelyMalleable(actor) {
  if (!hasInsanelyMalleable(actor)) return ui.notifications.warn("⚠️ Нет Черты Безумно Податливый.");
  // Цена — Очко Бесчестия или, с Эйдолоном, 1 Плоть («тратить её как Очки Бесчестия для Безумно Податливого»).
  const flesh = hasEidolon(actor) ? resourcePoolValue(actor, FLESH_POOL) : 0;
  const infamy = actorInfamyValue(actor);
  if (!flesh && infamy < 1) return ui.notifications.warn("⚠️ Безумно Податливый: нет Очка Бесчестия.");
  let pay = flesh ? "flesh" : "infamy";
  if (flesh && infamy >= 1) {
    pay = await askChoice("Безумно Податливый", "Чем платить:", [
      { value: "flesh", label: `Плоть Эйдолона (${flesh})` }, { value: "infamy", label: `Очко Бесчестия (${infamy})` }]);
    if (!pay) return CANCEL;
  }
  if (!await payActions(actor, 1, { what: "Безумно Податливый" })) return CANCEL;
  if (pay === "flesh") { if (!await spendResource(actor, FLESH_POOL, 1, { asInfamy: false, silent: true })) return CANCEL; }
  else await changeActorInfamy(actor, -1);
  const r = await rollCultTest(actor, {
    title: "Безумно Податливый", icon: ICON, tests: [{ skill: "medicae", mod: -10 }],
    success: "плоть перестраивается", failure: "плоть не слушается"
  });
  if (!r.success) return false;
  const m = flagOf(actor, MALLEABLE_FLAG) ?? {};
  const temp = (Number(m.temp) || 0) + r.deg;
  await actor.update({ [`flags.${NS}.${MALLEABLE_FLAG}`]: { temp, nextCheck: worldTime() + 3600 } });
  const given = await distribute(actor, temp, FLESHMOLD_TEMP_FLAG, `Безумно Податливый — ${temp} Успехов`);
  await cultCard(actor, "Безумно Податливый", [
    `Временных Успехов: <b>${temp}</b>.${given ? ` Трейты: ${given.map(esc).join(", ") || "—"}.` : ""}`,
    "Каждый час — тест W+0 (кнопка «Час податливости»): Провалы снимают Успехи и «лишние» Трейты."
  ], { icon: ICON });
  return false;
}

/** Безумно Податливый: часовой тест W+0. */
export async function malleableHour(actor) {
  const m = flagOf(actor, MALLEABLE_FLAG) ?? {};
  const temp = Number(m.temp) || 0;
  if (!temp) return ui.notifications.warn("⚠️ Временных Успехов Безумно Податливого нет.");
  const r = await rollCultTest(actor, { title: "Безумно Податливый: час", icon: ICON, tests: [{ char: "wp", mod: 0 }],
    success: "форма держится", failure: "плоть оплывает" });
  const left = malleableAfterHour(temp, r);
  const { drop } = trimGrantsToBudget(grantsOn(actor, FLESHMOLD_TEMP_FLAG).map(g => ({ key: g.key, rating: g.rating, id: g.item.id })), left);
  if (drop.length) await actor.deleteEmbeddedDocuments("Item", drop.map(d => d.id));
  await actor.update({ [`flags.${NS}.${MALLEABLE_FLAG}`]: { temp: left, nextCheck: worldTime() + 3600 } });
  await cultCard(actor, "Безумно Податливый: час", [
    `Временных Успехов: ${temp} → <b>${left}</b>.${drop.length ? ` Сняты последние Трейты: ${drop.length}.` : ""}`
  ], { icon: ICON });
  return false;
}

/** Безумно Податливый: полное действие и Medicae−10 — переложить Успехи (временные; с Нарциссом — и постоянные). */
export async function malleableRedistribute(actor) {
  if (!hasInsanelyMalleable(actor)) return ui.notifications.warn("⚠️ Нет Черты Безумно Податливый.");
  if (!await payActions(actor, 2, { what: "Перераспределение плоти" })) return CANCEL;
  const r = await rollCultTest(actor, { title: "Перераспределение плоти", icon: ICON, tests: [{ skill: "medicae", mod: -10 }] });
  if (!r.success) return false;
  const temp = Number(flagOf(actor, MALLEABLE_FLAG)?.temp) || 0;
  const perm = hasNarcissus(actor) ? Number(flagOf(actor, FLESHMOLD_FLAG)?.successes) || 0 : 0;
  if (perm) await distribute(actor, perm, FLESHMOLD_GRANT_FLAG, `Нарцисс — постоянные ${perm} Успехов`);
  if (temp) await distribute(actor, temp, FLESHMOLD_TEMP_FLAG, `Безумно Податливый — ${temp} Успехов`);
  if (!perm && !temp) ui.notifications.warn("⚠️ Перекладывать нечего: нет Успехов.");
  return false;
}

/** Эйдолон: три полных действия и Medicae+0 — убить жертву (T) и получить Плоть = T.b жертвы. */
export async function eidolonAbsorb(actor) {
  if (!hasEidolon(actor)) return ui.notifications.warn("⚠️ Нет Таланта Эйдолон.");
  const victim = firstTarget();
  if (!victim || victim === actor) return ui.notifications.warn("⚠️ Эйдолон: выберите жертву в рукопашной (T на токене).");
  if (!await payActions(actor, 2, { what: "Эйдолон (первое из трёх полных действий)" })) return CANCEL;
  const r = await rollCultTest(actor, { title: "Эйдолон", icon: "🐍", tests: [{ skill: "medicae", mod: 0 }],
    success: "жертва становится Плотью", failure: "жертва вырвалась", targetActor: victim });
  if (!r.success) return false;
  const tb = eidolonGain(victim.system?.characteristics?.t?.bonus);
  const res = await gainResource(actor, FLESH_POOL, tb, { silent: true });
  if (canWrite(victim)) await setDeceased(victim, true);
  await cultCard(actor, "Эйдолон", [
    `«${esc(victim.name)}» мёртв${canWrite(victim) ? "" : " (отметит ГМ)"}. Плоть +${tb} (T.b жертвы): <b>${res?.after ?? "?"}</b> / ${res?.max ?? "Cor.b×2"}.`,
    "В бою — ещё два полных действия (отметьте Ходы)."
  ], { icon: "🐍" });
  return false;
}

/** Эйдолон: свободным действием залечить Раны — 1 Плоть за Рану. */
export async function eidolonHeal(actor) {
  if (!hasEidolon(actor)) return ui.notifications.warn("⚠️ Нет Таланта Эйдолон.");
  const have = resourcePoolValue(actor, FLESH_POOL);
  const w = actor.system?.wounds ?? {};
  const missing = Math.max(0, (Number(w.effectiveMax ?? w.max) || 0) - (Number(w.value) || 0)) + (Number(w.critical) || 0);
  const cap = Math.min(have, missing);
  if (!cap) return ui.notifications.warn(`⚠️ Эйдолон: ${have ? "Раны целы" : "Плоти нет"}.`);
  const n = await askNumber("Эйдолон: залечить", "Ран (1 Плоть за Рану):", { min: 1, max: cap, value: cap });
  if (!n) return CANCEL;
  if (!await spendResource(actor, FLESH_POOL, n, { silent: true })) return CANCEL;
  await healActor(actor, n, { healer: actor });
  await cultCard(actor, "Эйдолон", [`Плоть −${n}: залечено <b>${n}</b> Ран.`], { icon: "🐍" });
  return false;
}

/** Скульптурит: Миньон (T) получает Sycophant и Monodevotant, метку Скульптора. */
export async function makeSculpturite(actor) {
  if (!hasSculpturite(actor)) return ui.notifications.warn("⚠️ Нет Таланта Скульптурит.");
  const m = firstTarget();
  if (!m || m === actor) return ui.notifications.warn("⚠️ Скульптурит: выберите Миньона-человека (T на токене).");
  if (!canWrite(m)) return ui.notifications.warn(`⚠️ «${m.name}» не ваш — Трейты выдаст ГМ.`);
  const create = [];
  for (const [id, name] of [["z0ktCYeNDSOBiyeL", "Sycophant"], ["bT9oct32j6wei1RX", "Monodevotant"]]) {
    if (m.items?.some(i => i.type === "trait" && String(i.name).startsWith(name))) continue;
    const src = await fromUuid(`Compendium.warhammer-dbc.traits.Item.${id}`).catch(() => null);
    if (!src) continue;
    const d = src.toObject();
    delete d._id;
    create.push(d);
  }
  if (create.length) await m.createEmbeddedDocuments("Item", create);
  await m.update({ [`flags.${NS}.${SCULPTURITE_FLAG}`]: actor.uuid });
  await cultCard(actor, "Скульптурит", [
    `«${esc(m.name)}» — Скульптурит: Трейты Sycophant и Monodevotant (без Очков Трейтов). Medicae Скульптора на нём: +Cor.b×5.`
  ], { icon: ICON });
  return false;
}

/** Скульптурит: полное действие и Medicae+0 (+Cor.b×5) — переложить Успехи на модификации Скульптурита (T). */
export async function redistributeSculpturite(actor) {
  if (!hasSculpturite(actor)) return ui.notifications.warn("⚠️ Нет Таланта Скульптурит.");
  const m = firstTarget();
  const bonus = sculpturiteMedicaeBonus(actor, m);
  if (!bonus) return ui.notifications.warn("⚠️ Выберите своего Скульптурита в рукопашной (T на токене).");
  const budget = Number(flagOf(m, FLESHMOLD_FLAG)?.successes) || 0;
  if (!budget) return ui.notifications.warn(`⚠️ У «${m.name}» нет Успехов Лепки Плоти.`);
  if (!await payActions(actor, 2, { what: "Скульптурит" })) return CANCEL;
  const r = await rollCultTest(actor, { title: "Скульптурит: перераспределение", icon: ICON,
    tests: [{ skill: "medicae", mod: 0 }], extraMod: bonus, extraLabel: "Скульптурит (Cor.b×5)", targetActor: m });
  if (!r.success) return false;
  await distribute(m, budget, FLESHMOLD_GRANT_FLAG, `Скульптурит — ${budget} Успехов`);
  return false;
}
