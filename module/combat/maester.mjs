// module/combat/maester.mjs
// ════════════════════════════════════════════════════════════════════════
//  Мейстер — кнопки Вируса Жизни, Культивации, Прожектора и Стадий Пакта
//  (арифметика — rules/maester-talents.mjs). Пулы «Инъекции» и
//  «Культивация» — записи resourcePool на Чертах и Стадиях.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { replaceAblativeContribution, woundLossUpdates } from "../rules/wounds.mjs";
import { resourcePoolValue, resourcePoolDef } from "../rules/resource-pools.mjs";
import { gainResource, spendResource } from "../apps/resource-pools.mjs";
import { roundsSinceDeath } from "../rules/medic-talents.mjs";
import { DECEASED_AT_FLAG } from "../sheets/tabs/death.mjs";
import { setDeceased } from "../sheets/tabs/body.mjs";
import { conditionRemoveFields, fatigueChangeFields } from "../sheets/tabs/conditions.mjs";
import { isCapabilityAvailable, markCapabilityUsed } from "../rules/cooldown.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { spendReaction } from "./action-economy.mjs";
import { projectorRegenValue, PROJECTOR_REGEN_FLAG } from "../rules/rubric-sorcerer.mjs";
import { healActor } from "./heal-target.mjs";
import {
  LIFE_VIRUS_FLAG, LV_PATIENTS_FLAG, DOSES_POOL, CULTIVATION_POOL, LIFE_VIRUS_SECONDS, AURA_RADIUS,
  STAGE3_MENU, STAGE4_MENU, hasLifeVirus, hasCultivation, maesterStage, lifeVirusRow, lifeVirusOf, lifeVirusActive,
  admitPatient, injectionAblative, projectorContribution, overchargeDecay, projectedRecently, cultivationSpoiled,
  harvestCultivation, reviveWindowOk, reviveCost, auraHordeDamage
} from "../rules/maester-talents.mjs";
import { NS, CANCEL, firstTarget, writeOrWarn, payActions, askNumber, askChoice, cultCard, rollCultTest } from "./cult-common.mjs";

const ICON = "🧬";
const now = () => Number(globalThis.game?.time?.worldTime) || 0;
const canWrite = a => !!(game.user?.isGM || a?.isOwner);
const REGEN_ID = "6cf11ucGdzYt6ndt";

/** Снять вирус с пациента: вклад в Аблативные Раны и Regeneration вируса. */
async function clearVirus(patient) {
  const f = lifeVirusOf(patient);
  if (!f || !canWrite(patient)) return false;
  const r = replaceAblativeContribution(patient.system, f.contribution, 0);
  await patient.update({ "system.wounds.ablative": r.ablative, "system.wounds.ablativeMax": r.ablativeMax,
    [`flags.${NS}.${LIFE_VIRUS_FLAG}.contribution`]: 0 }, { lifeVirusSwap: true });
  const regen = patient.items?.filter(i => i.getFlag?.(NS, "lifeVirusRegen")).map(i => i.id) ?? [];
  if (regen.length) await patient.deleteEmbeddedDocuments("Item", regen);
  return true;
}

/** Regeneration (X) вируса на пациенте на сутки. */
async function grantVirusRegen(patient, rating, expiresAt) {
  const old = patient.items?.filter(i => i.getFlag?.(NS, "lifeVirusRegen")).map(i => i.id) ?? [];
  if (old.length) await patient.deleteEmbeddedDocuments("Item", old);
  const src = await fromUuid(`Compendium.warhammer-dbc.traits.Item.${REGEN_ID}`).catch(() => null);
  if (!src) return;
  const d = src.toObject();
  delete d._id;
  d.system = { ...d.system, rating };
  d.flags = { ...(d.flags ?? {}), [NS]: { ...(d.flags?.[NS] ?? {}), lifeVirusRegen: true,
    tempGrant: { unit: "worldTime", expiresAt, label: "Regeneration (Вирус Жизни)" } } };
  await patient.createEmbeddedDocuments("Item", [d]);
}

/** Синтез дозы: 5 минут — +1 Инъекция (не больше максимума). */
export async function synthLifeVirus(actor) {
  if (!hasLifeVirus(actor)) return ui.notifications.warn("⚠️ Нет Черты Вирус Жизни.");
  const n = await askNumber("Вирус Жизни", "Синтезировать доз (5 минут каждая):", { min: 1, max: 14, value: 1 });
  if (!n) return CANCEL;
  await gainResource(actor, DOSES_POOL, n, { label: "Синтез Вируса Жизни" });
  return false;
}

/** Инъекция: пациент (T) получает Аблативные Раны по Стадии на сутки и Regeneration. */
export async function injectLifeVirus(actor) {
  if (!hasLifeVirus(actor)) return ui.notifications.warn("⚠️ Нет Черты Вирус Жизни.");
  const patient = firstTarget();
  if (!patient) return ui.notifications.warn("⚠️ Вирус Жизни: выберите пациента (T на токене).");
  if (!canWrite(patient)) return ui.notifications.warn(`⚠️ «${patient.name}» не ваш — инъекцию внесёт ГМ.`);
  const stage = maesterStage(actor);
  const row = lifeVirusRow(stage);
  let foreign = false;
  if (stage >= 2) {
    const pick = await askChoice("Вирус Жизни", "Доза:", [
      { value: "own", label: `Приготовлена под этого пациента — ${row.ablative} Аблативных Ран` },
      { value: "foreign", label: "Чужая доза (Стадия 2) — 3 Аблативные Раны" }]);
    if (!pick) return CANCEL;
    foreign = pick === "foreign";
  }
  if (!await spendResource(actor, DOSES_POOL, 1, { silent: true })) return CANCEL;
  const prev = lifeVirusOf(patient);
  const contribution = injectionAblative(stage, { foreign });
  const r = replaceAblativeContribution(patient.system, prev?.contribution, contribution);
  const expiresAt = now() + LIFE_VIRUS_SECONDS;
  await patient.update({
    "system.wounds.ablative": r.ablative, "system.wounds.ablativeMax": r.ablativeMax,
    [`flags.${NS}.${LIFE_VIRUS_FLAG}`]: { by: actor.uuid, contribution, expiresAt,
      cultivation: prev?.by === actor.uuid ? Number(prev.cultivation) || 0 : 0,
      cultivationSince: prev?.by === actor.uuid ? Number(prev.cultivationSince) || 0 : 0, projected: null }
  }, { lifeVirusSwap: true });
  await grantVirusRegen(patient, row.regen, expiresAt);
  const { list, dropped } = admitPatient(actor.getFlag(NS, LV_PATIENTS_FLAG), patient.uuid, row.patients);
  await actor.update({ [`flags.${NS}.${LV_PATIENTS_FLAG}`]: list });
  const lines = [
    `«${esc(patient.name)}»: <b>${contribution}</b> Аблативных Ран (не складываются), Regeneration (${row.regen}) на сутки; иммунитет к симптомам болезней, лечение как на постельном режиме.`,
    `Пациентов: ${list.length} из ${row.patients}. Инъекций осталось: ${resourcePoolValue(actor, DOSES_POOL)}.`
  ];
  for (const u of dropped) {
    const p = await fromUuid(u).catch(() => null);
    const a = p?.actor ?? p;
    if (a && await clearVirus(a)) lines.push(`«${esc(a.name)}» — самый давний пациент — теряет вирус.`);
    else if (a) lines.push(`«${esc(a.name)}» — самый давний пациент — теряет вирус (снимет ГМ).`);
  }
  await cultCard(actor, "Вирус Жизни", lines, { icon: ICON });
  return false;
}

/** Обход пациентов: срок вируса, порча Культивации (7 часов → тест T+0). */
export async function lifeVirusRounds(actor) {
  if (!hasLifeVirus(actor)) return ui.notifications.warn("⚠️ Нет Черты Вирус Жизни.");
  const list = actor.getFlag(NS, LV_PATIENTS_FLAG) ?? [];
  const keep = [];
  const lines = [];
  for (const u of list) {
    const doc = await fromUuid(u).catch(() => null);
    const p = doc?.actor ?? doc;
    if (!p) continue;
    const f = lifeVirusOf(p);
    if (!f || f.by !== actor.uuid) continue;
    if (cultivationSpoiled(f, now())) {
      await writeOrWarn(p, { [`flags.${NS}.${LIFE_VIRUS_FLAG}.cultivation`]: 0, [`flags.${NS}.${LIFE_VIRUS_FLAG}.cultivationSince`]: 0 }, "порчу Культивации");
      const t = await rollCultTest(p, { title: "Несобранная Культивация", icon: "🦠", tests: [{ char: "t", mod: 0 }],
        failure: "заражение случайной болезнью по выбору ГМа" });
      lines.push(`«${esc(p.name)}»: Культивация испортилась — тест T+0 ${t.success ? "пройден" : "<b>провален</b>: болезнь"}.`);
    }
    if (!lifeVirusActive(p, now())) {
      // Срок вышел: Аблативные Раны уходят (это тоже потеря — +1 Культивации, если они ещё были).
      if (Number(f.contribution) > 0 && Number(p.system?.wounds?.ablative) > 0 && canWrite(p))
        await p.update({ [`flags.${NS}.${LIFE_VIRUS_FLAG}.cultivation`]: Math.min(3, (Number(f.cultivation) || 0) + 1),
          [`flags.${NS}.${LIFE_VIRUS_FLAG}.cultivationSince`]: Number(f.cultivationSince) || now() });
      await clearVirus(p);
      lines.push(`«${esc(p.name)}»: вирус истёк.`);
      if (Number(lifeVirusOf(p)?.cultivation) > 0) keep.push(u);
      continue;
    }
    keep.push(u);
    lines.push(`«${esc(p.name)}»: ${f.contribution} вклада, Культивации ${Number(f.cultivation) || 0}, до конца — ${Math.max(0, Math.ceil((Number(f.expiresAt) - now()) / 3600))} ч.`);
  }
  await actor.update({ [`flags.${NS}.${LV_PATIENTS_FLAG}`]: keep });
  await cultCard(actor, "Обход пациентов", lines.length ? lines : ["Пациентов нет."], { icon: ICON });
  return false;
}

/**
 * Сбор Культивации с пациента (T): полное действие; цель Прожектора на Стадии 2+ —
 * Реакцией; Стадия 4 — без Реакции, но не больше 1.
 */
export async function harvestFrom(actor) {
  if (!hasCultivation(actor)) return ui.notifications.warn("⚠️ Нет Черты Культивация.");
  const p = firstTarget();
  const f = lifeVirusOf(p);
  if (!f || f.by !== actor.uuid) return ui.notifications.warn("⚠️ Выберите своего пациента (T на токене).");
  const have = Number(f.cultivation) || 0;
  if (!have) return ui.notifications.warn(`⚠️ У «${p.name}» Культивации нет.`);
  const stage = maesterStage(actor);
  const opts = [{ value: "full", label: "Полное действие — всю" }];
  if (stage >= 2) opts.push({ value: "reaction", label: "Реакция (цель Прожектора) — всю" });
  if (stage >= 4) opts.push({ value: "free", label: "Без Реакции (цель Прожектора) — не больше 1" });
  const how = opts.length > 1 ? await askChoice("Культивация", "Как собрать:", opts) : "full";
  if (!how) return CANCEL;
  if (how === "full" && !await payActions(actor, 2, { what: "Сбор Культивации" })) return CANCEL;
  if (how === "reaction" && !await spendReaction(actor)) return CANCEL;
  const def = resourcePoolDef(actor, CULTIVATION_POOL);
  const room = Math.max(0, (def?.max ?? 0) - resourcePoolValue(actor, CULTIVATION_POOL));
  const { take } = harvestCultivation(have, room, { capOne: how === "free" });
  await writeOrWarn(p, { [`flags.${NS}.${LIFE_VIRUS_FLAG}.cultivation`]: 0, [`flags.${NS}.${LIFE_VIRUS_FLAG}.cultivationSince`]: 0 }, "сбор Культивации");
  if (take) await gainResource(actor, CULTIVATION_POOL, take, { silent: true });
  await cultCard(actor, "Культивация", [
    `С «${esc(p.name)}» собрано <b>${take}</b> из ${have}${take < have ? " (остальное потеряно — пул полон или сбор без Реакции)" : ""}. Культивации: ${resourcePoolValue(actor, CULTIVATION_POOL)} / ${def?.max ?? "?"}.`
  ], { icon: ICON });
  return false;
}

/** Целительный Прожектор (Стадия 1+): пациент (T) под вирусом. */
export async function useProjector(actor) {
  const stage = maesterStage(actor);
  if (stage < 1) return ui.notifications.warn("⚠️ Целительный Прожектор — со Стадии Пакта 1.");
  const p = firstTarget();
  const f = lifeVirusOf(p);
  if (!f || !lifeVirusActive(p, now())) return ui.notifications.warn("⚠️ Прожектор: выберите пациента под Вирусом Жизни (T на токене).");
  if (!canWrite(p)) return ui.notifications.warn(`⚠️ «${p.name}» не ваш — Прожектор применит ГМ.`);
  const freeOk = isCapabilityAvailable(actor, "maesterProjector");
  const modes = [];
  if (freeOk) modes.push({ value: "free", label: "Свободное действие (раз в Ход)" });
  if (stage >= 2) modes.push({ value: "half", label: "Полудействие (Стадия 2+)" });
  if (stage >= 5 && isCapabilityAvailable(actor, "maesterProjectorS5")) modes.push({ value: "s5", label: "Полудействие Стадии 5 (только Прожектор)" });
  if (!modes.length) return ui.notifications.warn("⚠️ Прожектор уже применён в этот Ход.");
  const effects = [{ value: "ablative", label: "+3 Аблативные Раны" }];
  if (stage >= 3) effects.push(...STAGE3_MENU.map(m => ({ value: m.key, label: m.label })));
  if (stage >= 4) effects.push(...STAGE4_MENU.map(m => ({ value: `k${m.cost}`, label: `${m.cost} Культивации: ${m.label}` })));
  const w = p.system?.wounds ?? {};
  const pick = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Целительный Прожектор — ${p.name}` },
    content: `<p style="margin:4px 6px;">Раны: ${w.value}/${w.effectiveMax ?? w.max}, Аблативные ${w.ablative}/${w.ablativeMax}. Состояния: ${STAGE3_MENU.filter(m => needs(p, m.key)).map(m => esc(m.label)).join("; ") || "нет нужды"}.</p>
      <div class="atk-dlg-row"><label>Действие:</label><select name="mode" class="pm-input">${modes.map(m => `<option value="${m.value}">${esc(m.label)}</option>`).join("")}</select></div>
      <div class="atk-dlg-row"><label>Эффект:</label><select name="eff" class="pm-input">${effects.map(m => `<option value="${m.value}">${esc(m.label)}</option>`).join("")}</select></div>
      ${stage >= 3 ? `<div class="atk-dlg-row"><label>Повторов за Культивацию (Стадия 3):</label><input type="number" name="extra" min="0" max="7" value="0" class="pm-input"/></div>` : ""}`,
    ok: { label: "Применить", callback: (ev, b) => ({ mode: b.form.elements.mode.value, eff: b.form.elements.eff.value,
      extra: Math.max(0, Math.trunc(Number(b.form.elements.extra?.value) || 0)) }) },
    rejectClose: false
  }).catch(() => null);
  if (!pick) return CANCEL;
  if (pick.mode !== "free" && !await payActions(actor, 1, { what: "Целительный Прожектор" })) return CANCEL;
  let kCost = pick.eff.startsWith("k") ? Number(pick.eff.slice(1)) : 0;
  const times = 1 + (stage >= 3 && !kCost ? pick.extra : 0);
  kCost += stage >= 3 && !kCost ? pick.extra : 0;
  if (kCost && !await spendResource(actor, CULTIVATION_POOL, kCost, { silent: true })) return CANCEL;
  if (pick.mode === "free") await markCapabilityUsed(actor, "maesterProjector", "round");
  if (pick.mode === "s5") await markCapabilityUsed(actor, "maesterProjectorS5", "round");
  const combat = game.combat?.started ? game.combat : null;
  const lines = [];
  const upd = { [`flags.${NS}.${LIFE_VIRUS_FLAG}.projected`]: combat ? { combat: combat.id, round: combat.round } : null };
  if (pick.eff === "ablative") {
    const next = projectorContribution(f.contribution, stage, times);
    const r = replaceAblativeContribution(p.system, f.contribution, next);
    Object.assign(upd, { "system.wounds.ablative": r.ablative, "system.wounds.ablativeMax": r.ablativeMax,
      [`flags.${NS}.${LIFE_VIRUS_FLAG}.contribution`]: next });
    lines.push(`Аблативные Раны вируса: ${f.contribution} → <b>${next}</b> (Сверхукрепление до ${lifeVirusRow(stage).overcharge}). Бонус к следующему тесту T на Regeneration: ${lifeVirusRow(stage).regenBonus}.`);
    // Бонус ложится меткой на пациента и сам тратится его следующим тестом T
    // Регенерации (combat/rubric-sorcerer.mjs::rollRegeneration, task-4ae5).
    const regenBonus = projectorRegenValue(lifeVirusRow(stage).regenBonus);
    if (regenBonus != null) upd[`flags.${NS}.${PROJECTOR_REGEN_FLAG}`] = regenBonus;
  } else {
    for (let i = 0; i < times; i++) lines.push(...await projectorEffect(p, pick.eff, upd));
  }
  await p.update(upd, { lifeVirusSwap: true });
  await cultCard(actor, `Целительный Прожектор — ${p.name}`, [...lines, kCost ? `Потрачено Культивации: ${kCost}.` : ""], { icon: "🔦" });
  return false;
}

/** Нужен ли пациенту эффект меню Стадии 3 (Мейстер узнаёт до выбора). */
function needs(p, key) {
  const c = p.system?.conditions ?? {};
  switch (key) {
    case "fatigue": return Number(p.system?.fatigue?.value) > 0;
    case "poison": return !!c.poisoned;
    case "bleed": return !!c.bleeding || Number(c.haemorrhagingLevel) > 0;
    case "crippling": return !!c.crippling;
    case "senses": return !!c.blinded || !!c.deafened;
    case "stun": return !!c.stunned;
    case "burning": return !!c.burning;
    default: return false;
  }
}

/** Один эффект меню Стадий 3–4: правит `upd`, возвращает строки карточки. */
async function projectorEffect(p, key, upd) {
  const c = p.system?.conditions ?? {};
  switch (key) {
    case "regen": return ["Пациент немедленно делает дополнительную попытку Regeneration (тест T)."];
    case "fatigue": {
      Object.assign(upd, fatigueChangeFields(p, Math.max(0, (Number(p.system?.fatigue?.value) || 0) - 1)).fields);
      const r = await new Roll("1d5").evaluate();
      return [`−1 Усталости; восстановить <b>${r.total}</b> урона одной Характеристики (выберите на листе).`];
    }
    case "poison": Object.assign(upd, conditionRemoveFields("poisoned")); return ["Отравление и эффекты ядов/наркотиков сняты."];
    case "bleed": {
      Object.assign(upd, conditionRemoveFields("bleeding"));
      const h = Math.max(0, (Number(c.haemorrhagingLevel) || 0) - 2);
      upd["system.conditions.haemorrhagingLevel"] = h;
      if (!h) upd["system.conditions.haemorrhaging"] = false;
      return ["Кровотечение снято, Обескровливание −2."];
    }
    case "crippling": Object.assign(upd, conditionRemoveFields("crippling")); return ["Чужеродный предмет вытолкнут из раны: Калечение снято."];
    case "senses": Object.assign(upd, conditionRemoveFields("blinded"), conditionRemoveFields("deafened")); return ["Слух и зрение вернулись."];
    case "stun": {
      const n = Math.max(0, (Number(c.stunnedRounds) || 0) - 1);
      upd["system.conditions.stunnedRounds"] = n;
      if (!n) upd["system.conditions.stunned"] = false;
      return [`Оглушение: осталось ${n} Раунд(ов).`];
    }
    case "burning": Object.assign(upd, conditionRemoveFields("burning")); return ["Пламя потушено."];
    default: {
      const m = STAGE4_MENU.find(x => `k${x.cost}` === key);
      return m ? [`${m.label} — эффект явно проявляется (снимите на листе / отметьте; щит — до начала следующего Хода цели).`] : [];
    }
  }
}

/** Начало Хода пациента: Сверхукрепление без Прожектора спадает на 3 (вызывается из hooks.mjs). */
export async function lifeVirusTurnStart(patient, combat) {
  const f = lifeVirusOf(patient);
  if (!f || !(Number(f.contribution) > 0) || !combat || !canWrite(patient)) return;
  if (projectedRecently(f, combat.id, combat.round)) return;
  const maester = await fromUuid(f.by).catch(() => null);
  const stage = maesterStage(maester);
  const next = overchargeDecay(f.contribution, stage);
  if (next === Number(f.contribution)) return;
  const r = replaceAblativeContribution(patient.system, f.contribution, next);
  await patient.update({ "system.wounds.ablative": r.ablative, "system.wounds.ablativeMax": r.ablativeMax,
    [`flags.${NS}.${LIFE_VIRUS_FLAG}.contribution`]: next }, { lifeVirusSwap: true });
}

/** «Вернуть к жизни» (Стадия 2+): 2 Культивации + 1 Инъекция, полудействие, умер ≤ 12 Раундов назад. */
export async function maesterRevive(actor) {
  const stage = maesterStage(actor);
  if (stage < 2) return ui.notifications.warn("⚠️ Оживление — со Стадии Пакта 2.");
  const p = firstTarget();
  if (!p?.getFlag?.(NS, "deceased")) return ui.notifications.warn("⚠️ Выберите мёртвое существо в прямом контакте (T на токене).");
  const combat = game.combat;
  const ago = roundsSinceDeath(p.getFlag(NS, DECEASED_AT_FLAG), { worldTime: game.time?.worldTime, combatId: combat?.id ?? null, round: combat?.round });
  if (!reviveWindowOk(ago)) return ui.notifications.warn(`⚠️ «${p.name}» умер слишком давно (${ago ?? "?"} Раундов; можно до 12).`);
  let selectiveKill = false;
  if (stage >= 3) {
    const v = await askChoice("Оживление", "Как умер:", [
      { value: "other", label: "Обычно — полудействие, 2 Культивации" },
      { value: "sel", label: "Убит мной Избирательной рукопашной атакой — свободное действие, 1 Культивация" }]);
    if (!v) return CANCEL;
    selectiveKill = v === "sel";
  }
  const cost = reviveCost(stage, { selectiveKill });
  if (resourcePoolValue(actor, CULTIVATION_POOL) < cost.cultivation) return ui.notifications.warn(`⚠️ Нужно ${cost.cultivation} Культивации.`);
  if (resourcePoolValue(actor, DOSES_POOL) < cost.doses) return ui.notifications.warn("⚠️ Нужна Инъекция Вируса Жизни.");
  if (!canWrite(p)) return ui.notifications.warn(`⚠️ «${p.name}» не ваш — оживит ГМ.`);
  if (cost.ap && !await payActions(actor, cost.ap, { what: "Оживление" })) return CANCEL;
  await spendResource(actor, CULTIVATION_POOL, cost.cultivation, { silent: true });
  await spendResource(actor, DOSES_POOL, cost.doses, { silent: true });
  await setDeceased(p, false);
  await p.update({ [`flags.${NS}.maesterRevived`]: { by: actor.uuid } });
  await cultCard(actor, `Оживление — ${p.name}`, [
    "Существо вернулось: Критические Эффекты смерти остаются, Раны не восстанавливаются; Беспомощно, пока Раны не поднимутся до −7, но в сознании и умирает только от нового урона.",
    "Вылечить нельзя, пока не заменены потерянные жизненно важные органы."
  ], { icon: ICON });
  return false;
}

/** Аура Стадии 5: раз в Ход всем в 7 м — +1 Рана или 1 непоглощаемого C(Tx) в торс (Ордам — 1 за полные 10 Магнитуды). */
export async function maesterAura(actor) {
  if (maesterStage(actor) < 5) return ui.notifications.warn("⚠️ Аура — Стадия Пакта 5.");
  if (!isCapabilityAvailable(actor, "maesterAura")) return ui.notifications.warn("⚠️ Аура уже применена в этот Ход.");
  const tok = actor.getActiveTokens?.(false, true)?.[0];
  if (!tok) return ui.notifications.warn("⚠️ Мейстер не на сцене.");
  const mode = await askChoice("Аура Мейстера", "Всем в 7 м (кроме выбранных T):", [
    { value: "heal", label: "Восстановить 1 Рану" }, { value: "harm", label: "1 непоглощаемого C(Tx) урона в торс" }]);
  if (!mode) return CANCEL;
  const excluded = new Set([...(game.user?.targets ?? [])].map(t => t.actor?.uuid));
  const inAura = tokensWithinRadius(tok, AURA_RADIUS).map(t => t.actor).filter(a => a && !excluded.has(a.uuid));
  await markCapabilityUsed(actor, "maesterAura", "round");
  const lines = [];
  for (const a of inAura) {
    if (!canWrite(a)) { lines.push(`«${esc(a.name)}» — внесёт ГМ.`); continue; }
    if (mode === "heal") {
      if (a.type === "horde") continue;
      await healActor(a, 1, { healer: actor });
      lines.push(`«${esc(a.name)}»: +1 Рана.`);
    } else if (a.type === "horde") {
      const dmg = auraHordeDamage(a.system?.magnitude?.value);
      if (dmg) await a.update({ "system.magnitude.value": Math.max(0, Number(a.system.magnitude.value) - dmg) });
      lines.push(`Орда «${esc(a.name)}»: −${dmg} Магнитуды.`);
    } else {
      await a.update(woundLossUpdates(a.system, 1));
      lines.push(`«${esc(a.name)}»: 1 урона C(Tx) в торс (мимо брони, T.b и иммунитета Daemonic/Stuff of Nightmares).`);
    }
  }
  await cultCard(actor, "Аура Мейстера", lines.length ? lines : ["В ауре никого."], { icon: "✴️" });
  return false;
}
