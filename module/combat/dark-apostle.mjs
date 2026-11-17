// module/combat/dark-apostle.mjs
// ════════════════════════════════════════════════════════════════════════
//  Тёмный Апостол (Sahara 1-54b9) — Foundry-обвязка поверх чистой логики
//  rules/dark-apostle.mjs.
//
//   • Предвестник Ереси — convertNpc (Charm+0 против W+0), makeFaithful (Очко
//     Бесчестия + Charm+10): метка faithful на NPC; ×10 целей и переброс +10 —
//     rules/leadership-talents.mjs, rules/inspire-wrath.mjs, hooks.mjs.
//   • Тёмное Поклонение — buildMonument: Очко Бесчестия и запись монумента.
//   • Истинная Молитва — useTruePrayer: For.Lore(Heresy)+0, +1 Очко Бесчестия.
//   • Возложение Рук — useLayOnHands: Порча до Порога Мутации, три броска
//     Апостола с его Inf, выбор и выдача мутации цели (через ГМ-релей).
//   • Литания Хаоса — useLitanyOfChaos: метка и временные предметы
//     подчинённым до конца боя (clearLitanyOnCombatEnd).
//   • Мученик — useMartyr: For.Lore(Heresy)+0, демон на месте Правоверного.
//   • Смертный Инструмент — useMortalInstrument: раз в сессию, карточка ГМу
//     (мистический щит, мутация, демоны), mortalShieldOnDamage в урон.
// ════════════════════════════════════════════════════════════════════════

import {
  FAITHFUL_FLAG, LITANY_FLAG, BLESSING_FLAG, MORTAL_SHIELD_FLAG, MORTAL_USAGE, LAY_ON_HANDS_USAGE, MONUMENTS_FLAG,
  CONVERT_TEST_MOD, FAITHFUL_TEST_MOD, TRUE_PRAYER_MOD, MARTYR_MOD, LAY_ON_HANDS_ROLLS, LAY_ON_HANDS_RITUAL_MINUTES,
  LITANY_GODS, hasHarbingerOfHeresy, hasDarkDevotion, hasTruePrayer, hasLayOnHands, hasLitanyOfChaos, hasMartyr,
  hasMortalInstrument, isFaithfulOf, heresyThreshold, heresyLoreTotal, charmThreshold, willTotal,
  litanyOptions, litanyGodDef, litanyGrantsFor, litanyGrantItemData, isLitanyGrant, litanyMarks, activeLitany,
  layOnHandsPlan, layOnHandsPool, martyrChooser, mortalShieldAbsorbs, subordinateActors
} from "../rules/dark-apostle.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import { rollD100WithReroll } from "../rules/test-kind-widget.mjs";
import { isThrottleReady, markThrottleUsed } from "../rules/cooldown.mjs";
import { itemHasName } from "../rules/predicates.mjs";
import { mutationByRoll, mutationCatalog, mutationItemData } from "../constants/mutations.mjs";
import { actorInfamyMax, actorInfamyValue, changeActorInfamy } from "../apps/infamy-points.mjs";
import { spendInfamyPoint } from "./noise-marine.mjs";
import { isEncounterActive, spendActionPoints, apCostForActionType } from "./action-economy.mjs";
import { writeToTarget } from "./gm-relay.mjs";
import { isTokenInSight } from "../rules/vision-target.mjs";
import { nextMutationThreshold } from "../rules/character.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { MUTATIONS_AS_ASTARTES } from "../rules/squat-traits.mjs";
import { hasSubmutations } from "../rules/submutations.mjs";
import { rollSubmutation } from "../apps/submutations.mjs";
import { findBestiaryActor, spawnDemonOnScene, defaultSpawnDemonFn } from "../apps/demon-summon.mjs";
import { setDeceased } from "../sheets/tabs/body.mjs";

const NS = "warhammer-dbc";
const ICON = () => rollIcon("skull", "#b04adf");

const apostleAttr = a => esc(a.uuid);
const worldActors = () => [...(globalThis.game?.actors ?? [])];
const actorOfDoc = doc => doc?.actor ?? doc ?? null;
const targetedActor = () => actorOfDoc([...(globalThis.game?.user?.targets ?? [])][0]) ?? null;
const sceneTokenActors = () => [...(globalThis.canvas?.scene?.tokens ?? [])].map(t => t.actor).filter(Boolean);

const dialogSelect = (title, label, options, hint = "", okLabel = "Применить") =>
  foundry.applications.api.DialogV2.prompt({
    window: { title },
    content: `<div class="atk-dlg-row"><label>${esc(label)}:</label><select name="pick" class="pm-input">${options.map(o =>
      `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select></div>${hint ? `<p class="dyn-hint">${hint}</p>` : ""}`,
    ok: { label: okLabel, callback: (event, button) => button.form.elements.pick.value },
    rejectClose: false
  }).catch(() => null);

const confirm = (title, text, yes, no) => foundry.applications.api.DialogV2.confirm({
  window: { title }, content: `<p>${text}</p>`, yes: { label: yes }, no: { label: no }, rejectClose: false
}).then(r => !!r).catch(() => false);

const textPrompt = (title, label, placeholder = "") => foundry.applications.api.DialogV2.prompt({
  window: { title },
  content: `<div class="atk-dlg-row"><label>${esc(label)}:</label><input type="text" name="text" class="pm-input" placeholder="${esc(placeholder)}"/></div>`,
  ok: { label: "Назвать", callback: (event, button) => String(button.form.elements.text.value ?? "").trim() },
  rejectClose: false
}).then(v => v || "").catch(() => "");

async function rollTest(threshold) {
  const { rv, rolls, rerollNote } = await rollD100WithReroll(null);
  return { rv, rolls, rerollNote, ...testOutcome(rv, threshold) };
}

// ── Истинная Молитва ──────────────────────────────────────────────────────

/** Полудействие, For.Lore(Heresy)+0: при успехе восстанавливается одно потраченное Очко Бесчестия. Только в бою. */
export async function useTruePrayer(actor) {
  if (!hasTruePrayer(actor)) return false;
  if (!isEncounterActive()) {
    ui.notifications?.warn("Истинная Молитва работает только в бою.");
    return false;
  }
  if (actorInfamyValue(actor) >= actorInfamyMax(actor)) {
    ui.notifications?.info("Все Очки Бесчестия на месте — восстанавливать нечего.");
    return false;
  }
  if (heresyLoreTotal(actor) == null) {
    ui.notifications?.warn("У Апостола нет Навыка Forbidden Lore (Heresy) — молитва невозможна.");
    return false;
  }
  const mods = collectTestMods(actor, { kind: "skill", group: "forbiddenLore", specialty: "Heresy", char: "int" });
  const threshold = heresyThreshold(actor, TRUE_PRAYER_MOD, mods.total);
  if (!await spendActionPoints(actor, apCostForActionType("Полудействие"), { physical: false })) return false;
  const { rv, rolls, rerollNote, success, deg } = await rollTest(threshold);
  let line = "";
  if (success) {
    const res = await changeActorInfamy(actor, 1);
    line = `<div class="roll-threshold">Очко Бесчестия восстановлено: ${res.after}/${res.max}.</div>`;
  }
  await postTestCard(actor, {
    icon: ICON(), title: `Истинная Молитва — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "For.Lore (Heresy)+0", base: heresyLoreTotal(actor), parts: mods.parts.map(esc), threshold, rv }),
    rerollNote, lines: [line],
    outcome: outcomeHtml(success, success ? `Успех (${deg}) — молитву услышали` : "Провал — молитва остаётся без ответа")
  }, { rolls });
  return success;
}

// ── Тёмное Поклонение ─────────────────────────────────────────────────────

const MONUMENT_SIZES = [
  { value: "altar", label: "Алтарь (минуты)" }, { value: "shrine", label: "Святилище (часы–дни)" },
  { value: "temple", label: "Храм (недели)" }, { value: "cathedral", label: "Собор (месяцы)" }
];

/** Очко Бесчестия — монумент Разрушительным Силам: запись на листе и карточка; бонусы к ритуалам — на усмотрение ГМа. */
export async function buildMonument(actor) {
  if (!hasDarkDevotion(actor)) return false;
  if (actorInfamyValue(actor) < 1) {
    ui.notifications?.warn("Нет Очка Бесчестия — монумент не соорудить.");
    return false;
  }
  const godOptions = LITANY_GODS.map(g => `<option value="${g.key}">${esc(g.label)}</option>`).join("");
  const sizeOptions = MONUMENT_SIZES.map(s => `<option value="${s.value}">${esc(s.label)}</option>`).join("");
  const form = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Тёмное Поклонение — ${actor.name}` },
    content: `<div class="atk-dlg-row"><label>Название:</label><input type="text" name="name" class="pm-input" placeholder="Алтарь из распятого трупа"/></div>
      <div class="atk-dlg-row"><label>Посвящён:</label><select name="god" class="pm-input">${godOptions}</select></div>
      <div class="atk-dlg-row"><label>Размах:</label><select name="size" class="pm-input">${sizeOptions}</select></div>
      <div class="atk-dlg-row"><label>Материалы:</label><input type="text" name="materials" class="pm-input"/></div>
      <p class="dyn-hint">Тратится 1 Очко Бесчестия. Время и ресурсы определяет размах; бонус (или штраф при несовместимом Боге) к ритуалам в нём и возле него назначает ГМ.</p>`,
    ok: { label: "Соорудить", callback: (event, button) => Object.fromEntries(new FormData(button.form)) },
    rejectClose: false
  }).catch(() => null);
  if (!form) return false;
  if (!await spendInfamyPoint(actor, "Тёмное Поклонение")) return false;
  const god = litanyGodDef(form.god)?.label ?? form.god;
  const size = MONUMENT_SIZES.find(s => s.value === form.size)?.label ?? form.size;
  const entry = {
    name: String(form.name || "Монумент Разрушительным Силам").trim(), god: form.god, size: form.size,
    materials: String(form.materials ?? "").trim(), at: globalThis.game?.time?.worldTime ?? 0,
    scene: globalThis.canvas?.scene?.name ?? ""
  };
  const list = actor.getFlag?.(NS, MONUMENTS_FLAG);
  await actor.setFlag(NS, MONUMENTS_FLAG, [...(Array.isArray(list) ? list : []), entry]);
  await postTestCard(actor, {
    icon: ICON(), title: `Тёмное Поклонение — ${esc(actor.name)}`,
    lines: [
      `<div class="roll-threshold"><b>${esc(entry.name)}</b> — посвящён: ${esc(god)}; ${esc(size)}${entry.materials ? `; ${esc(entry.materials)}` : ""}.</div>`,
      `<div class="roll-threshold">Потрачено: Очко Бесчестия. Бонусы к ритуалам в монументе и возле него определяет ГМ (размер, качество, материалы, совместимость Богов).</div>`
    ],
    outcome: outcomeHtml(true, "Монумент воздвигнут")
  }, { sound: false });
  return true;
}

// ── Предвестник Ереси ─────────────────────────────────────────────────────

/** Обратить дружественного NPC в свою веру: Charm+0 против W+0 цели (бросок за NPC автоматический). */
export async function convertNpc(actor, target = targetedActor()) {
  if (!hasHarbingerOfHeresy(actor)) return false;
  if (!target || target.uuid === actor.uuid) {
    ui.notifications?.warn("Наведите таргет (T) на дружественного NPC, которого обращаете.");
    return false;
  }
  const mods = collectTestMods(actor, { kind: "skill", skill: "charm", char: "fel", targetActor: target });
  const theirMods = collectTestMods(target, { kind: "skill", char: "wp", targetActor: actor });
  const mine = charmThreshold(actor, CONVERT_TEST_MOD, mods.total);
  const theirs = willTotal(target) + theirMods.total;
  const a = await rollTest(mine);
  const b = await rollTest(theirs);
  const { winner } = resolveOpposed({ ...a, threshold: mine }, { ...b, threshold: theirs });
  const win = winner === "mine";
  let note = "";
  if (win) {
    const ok = await writeToTarget(target, { kind: "harbingerMark", mark: "convert" }, actor);
    note = ok ? "" : " Метку записать некому (нет ГМа) — отметьте обращение вручную.";
  }
  await postTestCard(actor, {
    icon: ICON(), title: `Обращение в веру — ${esc(actor.name)} → ${esc(target.name)}`,
    lines: [
      `<div>${esc(actor.name)}: Charm+0 <b>${a.rv}</b> vs ${mine} ${a.success ? "(успех)" : "(провал)"}</div>`,
      a.rerollNote,
      `<div>${esc(target.name)}: W+0 <b>${b.rv}</b> vs ${theirs} ${b.success ? "(успех)" : "(провал)"}</div>`,
      b.rerollNote
    ],
    outcome: outcomeHtml(win, win ? `${esc(target.name)} разделяет веру Апостола.${note}` : `${esc(target.name)} не поддаётся`)
  }, { rolls: [...a.rolls, ...b.rolls] });
  return win;
}

/** Превратить разделяющего веру NPC в Правоверного: Очко Бесчестия и Charm+10. */
export async function makeFaithful(actor, target = targetedActor()) {
  if (!hasHarbingerOfHeresy(actor)) return false;
  if (!target || target.uuid === actor.uuid) {
    ui.notifications?.warn("Наведите таргет (T) на NPC, разделяющего веру Апостола.");
    return false;
  }
  if (isFaithfulOf(target, actor)) {
    ui.notifications?.info(`${target.name} уже Правоверный вашего Апостола.`);
    return false;
  }
  const converted = target.getFlag?.(NS, "converted")?.apostleUuid === actor.uuid;
  if (!converted && !await confirm("Правоверный", `${esc(target.name)} уже разделяет вашу веру? (обращённый тестом считается разделяющим автоматически)`, "Разделяет", "Нет")) return false;
  if (actorInfamyValue(actor) < 1) {
    ui.notifications?.warn("Нет Очка Бесчестия — Правоверного не сделать.");
    return false;
  }
  const mods = collectTestMods(actor, { kind: "skill", skill: "charm", char: "fel", targetActor: target });
  const threshold = charmThreshold(actor, FAITHFUL_TEST_MOD, mods.total);
  if (!await spendInfamyPoint(actor, "Правоверный")) return false;
  const { rv, rolls, rerollNote, success, deg } = await rollTest(threshold);
  let note = "";
  if (success) {
    const ok = await writeToTarget(target, { kind: "harbingerMark", mark: "faithful" }, actor);
    note = ok ? "" : " Метку записать некому (нет ГМа) — отметьте Правоверного вручную.";
  }
  await postTestCard(actor, {
    icon: ICON(), title: `Правоверный — ${esc(actor.name)} → ${esc(target.name)}`,
    threshold: rollStatLine({ label: "Charm+10", base: charmThreshold(actor), parts: [...mods.parts.map(esc), "посвящение +10"], threshold, rv }),
    rerollNote,
    lines: [`<div class="roll-threshold">Потрачено: Очко Бесчестия. Правоверный фанатично предан и получает +30 на сопротивление попыткам переубедить.</div>`],
    outcome: outcomeHtml(success, success ? `Успех (${deg}) — ${esc(target.name)} стал Правоверным${note}` : "Провал — Очко потрачено впустую")
  }, { rolls });
  return success;
}

// ── Литания Хаоса ─────────────────────────────────────────────────────────

const combatId = () => globalThis.game?.combat?.id ?? "";

async function litanyTemplate(pack, id) {
  return fromUuid(`Compendium.${NS}.${pack}.Item.${id}`).catch(() => null);
}

const hasNatural = (target, kind) => [...(target.items ?? [])].some(i => !isLitanyGrant(i) && (
  (kind === "frenzy" && i.type === "talent" && itemHasName(i, "Frenzy"))
  || (kind === "fanatic" && i.type === "trait" && itemHasName(i, "Fanatic"))));

/** Снять с актора метки и выданные литанией предметы (чужие и свои); false — снимать нечего. */
export async function clearLitanyFrom(actor, apostleUuid = "") {
  const grants = [...(actor.items ?? [])].filter(i => isLitanyGrant(i)
    && (!apostleUuid || i.getFlag?.(NS, "litanyGrant")?.apostleUuid === apostleUuid));
  if (grants.length) await actor.deleteEmbeddedDocuments("Item", grants.map(i => i.id));
  const had = actor.getFlag?.(NS, BLESSING_FLAG);
  if (had && (!apostleUuid || had.apostleUuid === apostleUuid)) await actor.unsetFlag(NS, BLESSING_FLAG);
  return grants.length > 0 || !!had;
}

/** Исполнитель записи «litanyBlessing»: метка, снятие прежней литании, временные предметы. */
export async function performLitanyBlessing(target, op, initiator) {
  await clearLitanyFrom(target);
  await target.setFlag(NS, BLESSING_FLAG, litanyMarks(op.god, initiator, combatId()).blessing);
  const items = [];
  for (const g of litanyGrantsFor(op.god)) {
    if (hasNatural(target, g.kind)) continue;
    const template = await litanyTemplate(g.pack, g.id);
    if (!template) { ui.notifications?.warn(`Шаблон «${g.kind}» не найден в компендиуме — предмет не выдан.`); continue; }
    items.push(litanyGrantItemData(template.toObject(), g.kind, initiator));
  }
  if (items.length) await target.createEmbeddedDocuments("Item", items);
  return true;
}

/** Подчинённые под Командным Присутствием Апостола: «Под моим Присутствием» и Отряды, где он Командир или Лидер. */
export function litanyRecipients(apostle) {
  return subordinateActors(apostle, worldActors(), uuid => globalThis.fromUuidSync?.(uuid) ?? null)
    .filter(a => !a.getFlag?.(NS, "deceased"));
}

/** Очко Бесчестия: один из бонусов Литании всем подчинённым до конца боя. */
export async function useLitanyOfChaos(actor) {
  if (!hasLitanyOfChaos(actor)) return false;
  if (!isEncounterActive()) {
    ui.notifications?.warn("Литания действует «до конца боя» — сначала начните бой.");
    return false;
  }
  const recipients = litanyRecipients(actor);
  if (!recipients.length) {
    ui.notifications?.warn("Под вашим Командным Присутствием никого нет (панель «Под моим Присутствием» или Отряд).");
    return false;
  }
  if (actorInfamyValue(actor) < 1) {
    ui.notifications?.warn("Нет Очка Бесчестия — Литания не произнесена.");
    return false;
  }
  const options = litanyOptions(actor);
  const god = options.length === 1 ? options[0].key
    : await dialogSelect(`Литания Хаоса — ${actor.name}`, "Бог", options.map(g => ({ value: g.key, label: `${g.label}: ${g.effect}` })),
      `Подчинённых: ${recipients.length}. Тратится 1 Очко Бесчестия, бонус действует до конца боя.`, "Произнести");
  const def = litanyGodDef(god);
  if (!def || !options.some(o => o.key === def.key)) return false;
  if (!await spendInfamyPoint(actor, "Литания Хаоса")) return false;

  const before = activeLitany(actor);
  const failed = [];
  for (const r of recipients) {
    const ok = await writeToTarget(r, { kind: "litanyBlessing", god: def.key }, actor);
    if (!ok) failed.push(r.name);
  }
  await actor.setFlag(NS, LITANY_FLAG, litanyMarks(def.key, actor, combatId(), recipients).apostle);
  await postTestCard(actor, {
    icon: ICON(), title: `Литания Хаоса — ${esc(actor.name)}: ${esc(def.label)}`,
    lines: [
      `<div class="roll-threshold">${esc(def.effect)} — до конца боя.</div>`,
      `<div class="roll-threshold">Благословлены (${recipients.length - failed.length}): ${esc(recipients.filter(r => !failed.includes(r.name)).map(r => r.name).join(", ") || "—")}.</div>`,
      failed.length ? `<div class="roll-threshold">Не записано (нет ГМа): ${esc(failed.join(", "))}.</div>` : "",
      before ? `<div class="roll-threshold">Прежняя литания (${esc(litanyGodDef(before.god)?.label ?? before.god)}) заменена.</div>` : ""
    ],
    outcome: outcomeHtml(true, "Литания произнесена")
  }, { sound: false });
  return true;
}

/** Конец боя: снять метки и временные предметы Литании со всех, у кого они есть (активный ГМ). */
export async function clearLitanyOnCombatEnd() {
  const seen = new Set();
  for (const actor of [...worldActors(), ...sceneTokenActors()]) {
    if (!actor?.uuid || seen.has(actor.uuid)) continue;
    seen.add(actor.uuid);
    const marked = actor.getFlag?.(NS, BLESSING_FLAG) || actor.getFlag?.(NS, LITANY_FLAG)
      || [...(actor.items ?? [])].some(i => isLitanyGrant(i));
    if (!marked || !actor.isOwner) continue;
    await clearLitanyFrom(actor);
    if (actor.getFlag?.(NS, LITANY_FLAG)) await actor.unsetFlag(NS, LITANY_FLAG);
  }
}

// ── Возложение Рук ────────────────────────────────────────────────────────

/** Порог Мутации цели (с учётом «мутирует как Космодесантник»). */
export function targetNextThreshold(target) {
  return nextMutationThreshold(target.system, { asAstartes: hasRuleFlag(target, MUTATIONS_AS_ASTARTES) });
}

/** Добровольной цели: Порча до следующего Порога, три броска Апостола (его Inf) и выбор мутации. */
export async function useLayOnHands(actor, target = targetedActor()) {
  if (!hasLayOnHands(actor)) return false;
  if (!target || target.uuid === actor.uuid || !target.system?.corruption) {
    ui.notifications?.warn("Наведите таргет (T) на добровольную цель — персонажа.");
    return false;
  }
  const willing = await confirm("Возложение Рук", `${esc(target.name)} — добровольная цель? Ритуал занимает ${LAY_ON_HANDS_RITUAL_MINUTES} минут.`, "Согласна", "Отмена");
  const plan = layOnHandsPlan({
    apostleCor: actor.system?.corruption?.value, targetCor: target.system.corruption.value,
    nextThreshold: targetNextThreshold(target), ready: isThrottleReady(target, LAY_ON_HANDS_USAGE, "month"), willing
  });
  if (!plan.ok) {
    ui.notifications?.warn(plan.reason);
    return false;
  }
  const thresholdAfter = (Number(target.system.corruption.value) || 0) + plan.needed;
  const infB = Number(actor.system?.characteristics?.inf?.bonus) || 0;
  const rolls = [];
  for (let i = 0; i < LAY_ON_HANDS_ROLLS; i++) rolls.push(await new Roll("1d100").evaluate());
  const names = layOnHandsPool(rolls.map(r => r.total), infB, mutationByRoll);
  const pool = mutationCatalog().common.filter(m => names.has(m.name));
  const mutation = await dialogSelect(`Возложение Рук — ${actor.name} → ${target.name}`, "Мутация",
    pool.map(m => ({ value: m.name, label: `${m.name} (d100 ${m.range})` })),
    `Броски: <b>${rolls.map(r => r.total).join(", ")}</b>, Inf.b Апостола ${infB}: достижимо ${pool.length}. Цель получит ${plan.needed} Порчи (до ${thresholdAfter}).`,
    "Даровать");
  if (!mutation || !pool.some(m => m.name === mutation)) return false;

  const ok = await writeToTarget(target, { kind: "layOnHands", corruption: plan.needed, mutation }, actor);
  await postTestCard(actor, {
    icon: ICON(), title: `Возложение Рук — ${esc(actor.name)} → ${esc(target.name)}`,
    lines: [
      `<div class="roll-statline"><span class="roll-stat"><label>Броски</label><b>${rolls.map(r => r.total).join(", ")}</b></span></div>`,
      `<div class="roll-threshold">Inf.b Апостола: ${infB}. Порча цели +${plan.needed}. Ритуал: ${LAY_ON_HANDS_RITUAL_MINUTES} минут; от Апостола эта цель получит Мутацию снова не раньше чем через месяц.</div>`
    ],
    outcome: ok ? outcomeHtml(true, `<b>${esc(mutation)}</b>`) : outcomeHtml(false, "Записать некому (нет ГМа) — выдайте Порчу и Мутацию вручную")
  }, { rolls, sound: false });
  return ok;
}

/** Исполнитель записи «layOnHands» (ГМ или владелец цели): Порча, мутация, отметка «раз в месяц». */
export async function performLayOnHands(target, op, initiator) {
  const threshold = targetNextThreshold(target);
  const cor = Number(target.system?.corruption?.value) || 0;
  if (threshold == null || threshold - cor !== op.corruption) {
    ui.notifications?.warn(`Возложение Рук: Порча цели изменилась (${target.name}) — повторите ритуал.`);
    return null;
  }
  const data = foundry.utils.deepClone(await mutationItemData(op.mutation, ""));
  delete data.folder; delete data.folderParent; delete data._id;
  await target.update({ "system.corruption.value": threshold });
  const [item] = await target.createEmbeddedDocuments("Item", [data]);
  await markThrottleUsed(target, LAY_ON_HANDS_USAGE, "month");
  if (item && hasSubmutations(item.system?.benefit || "")) await rollSubmutation(item, { actor: target });
  return item ?? null;
}

// ── Мученик ───────────────────────────────────────────────────────────────

/** Правоверные этого Апостола на сцене, не мёртвые и (если есть токен Апостола) в поле его зрения. */
export function faithfulInSight(apostle) {
  const scene = globalThis.canvas?.scene;
  const tokens = [...(scene?.tokens ?? [])];
  const mine = tokens.find(t => t.actor?.uuid === apostle.uuid || t.actor?.id === apostle.id);
  const out = new Map();
  for (const t of tokens) {
    const a = t.actor;
    if (!a || out.has(a.uuid) || !isFaithfulOf(a, apostle) || a.getFlag?.(NS, "deceased")) continue;
    if (mine && !isTokenInSight(mine, t, scene.grid)) continue;
    out.set(a.uuid, a);
  }
  return [...out.values()];
}

/** Исполнитель записи «martyrSummon»: демон на месте Правоверного, сам Правоверный погибает. */
export async function performMartyrSummon(target, op, initiator) {
  const name = String(op.name ?? "").trim();
  if (!name) return null;
  if (globalThis.game?.user?.isGM) {
    if (!await findBestiaryActor(name)) {
      ui.notifications?.warn(`Демон «${name}» не найден в Бестиарии — Мученик не состоялся, Правоверный жив.`);
      return null;
    }
    const res = await spawnDemonOnScene(name, target.uuid);
    if (!res.ok) { ui.notifications?.warn(res.reason); return null; }
  } else {
    await defaultSpawnDemonFn(name, target.uuid);
  }
  await setDeceased(target, true);
  if (target.getFlag?.(NS, FAITHFUL_FLAG)) await target.unsetFlag(NS, FAITHFUL_FLAG);
  return true;
}

export async function finishMartyr(apostle, faithful, name) {
  const sent = await writeToTarget(faithful, { kind: "martyrSummon", name }, apostle);
  const ranHere = !!globalThis.game?.user?.isGM || faithful.isOwner !== false;
  const ok = sent && (!ranHere || !!faithful.getFlag?.(NS, "deceased"));
  if (sent && !ok) {
    await postTestCard(apostle, {
      icon: ICON(), title: `Мученик — ${esc(apostle.name)}`,
      lines: [`<div class="roll-threshold">Демон «${esc(name)}» не явился: ${esc(faithful.name)} остаётся жив.</div>`],
      outcome: outcomeHtml(false, "Мученик не состоялся")
    }, { sound: false });
    return false;
  }
  await postTestCard(apostle, {
    icon: ICON(), title: `Мученик — ${esc(apostle.name)}`,
    lines: [`<div class="roll-threshold">${esc(faithful.name)} мучительно умирает, плоть искажается: <b>${esc(name)}</b>. Демон сражается на стороне Апостола, но подчиняется ГМу.</div>`],
    outcome: ok ? outcomeHtml(true, "Демон явился в мир") : outcomeHtml(false, "Записать некому (нет ГМа)")
  }, { sound: false });
  return ok;
}

/** GM: назвать демона по карточке Мученика (1–3 Успеха). */
export async function gmPickMartyrDemon(apostleUuid, faithfulUuid) {
  const apostle = actorOfDoc(await fromUuid(apostleUuid).catch(() => null));
  const faithful = actorOfDoc(await fromUuid(faithfulUuid).catch(() => null));
  if (!apostle || !faithful) return false;
  const name = await textPrompt(`Мученик — демон для ${faithful.name}`, "Демон из Бестиария", "Низший демон или демонический зверь");
  if (!name) return false;
  return finishMartyr(apostle, faithful, name);
}

/** Полное действие, For.Lore(Heresy)+0: низший демон или демонический зверь в Правоверном в поле зрения. */
export async function useMartyr(actor) {
  if (!hasMartyr(actor)) return false;
  const candidates = faithfulInSight(actor);
  if (!candidates.length) {
    ui.notifications?.warn("Нет Правоверных вашего Апостола в поле зрения (Предвестник Ереси: «Правоверный»).");
    return false;
  }
  if (heresyLoreTotal(actor) == null) {
    ui.notifications?.warn("У Апостола нет Навыка Forbidden Lore (Heresy) — ритуал невозможен.");
    return false;
  }
  const uuid = candidates.length === 1 ? candidates[0].uuid
    : await dialogSelect(`Мученик — ${actor.name}`, "Жертва", candidates.map(c => ({ value: c.uuid, label: c.name })), "", "Начать ритуал");
  const faithful = candidates.find(c => c.uuid === uuid);
  if (!faithful) return false;
  if (!await confirm("Мученик", `${esc(faithful.name)} принесёт себя в жертву: Правоверный погибнет, его плоть станет демоном. Начать ритуал (полное действие, For.Lore(Heresy)+0)?`, "Начать", "Отмена")) return false;
  const mods = collectTestMods(actor, { kind: "skill", group: "forbiddenLore", specialty: "Heresy", char: "int" });
  const threshold = heresyThreshold(actor, MARTYR_MOD, mods.total);
  if (!await spendActionPoints(actor, apCostForActionType("Полное действие"), { physical: false })) return false;
  const { rv, rolls, rerollNote, success, deg } = await rollTest(threshold);
  const chooser = martyrChooser(deg);
  await postTestCard(actor, {
    icon: ICON(), title: `Мученик — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "For.Lore (Heresy)+0", base: heresyLoreTotal(actor), parts: mods.parts.map(esc), threshold, rv }),
    rerollNote,
    lines: success ? [`<div class="roll-threshold">${deg} Успех(а): демона выбирает ${chooser === "apostle" ? "Апостол" : "ГМ"}.</div>`,
      chooser === "gm" ? `<div class="roll-defense-btns"><button type="button" class="wh-martyr-gm-btn" data-apostle-uuid="${apostleAttr(actor)}" data-faithful-uuid="${apostleAttr(faithful)}">ГМ: выбрать демона</button></div>` : ""] : [],
    outcome: outcomeHtml(success, success ? `Успех (${deg}) — ритуал удался` : "Провал — Правоверный остаётся жив")
  }, { rolls });
  if (!success) return false;
  if (chooser === "apostle") {
    const name = await textPrompt(`Мученик — демон для ${faithful.name}`, "Демон (назовите ГМу)", "Низший демон или демонический зверь");
    if (!name) {
      ui.notifications?.warn("Демон не назван — ГМ может выбрать по карточке.");
      return false;
    }
    return finishMartyr(actor, faithful, name);
  }
  return true;
}

// ── Смертный Инструмент ───────────────────────────────────────────────────

/** Раз в сессию, в смертельной опасности: Очко Бесчестия — карточка с помощью Богов; ответ выбирает ГМ. */
export async function useMortalInstrument(actor) {
  if (!hasMortalInstrument(actor)) return false;
  if (!isThrottleReady(actor, MORTAL_USAGE, "session")) {
    ui.notifications?.warn("Смертный Инструмент уже использован в этой сессии.");
    return false;
  }
  if (actorInfamyValue(actor) < 1) {
    ui.notifications?.warn("Нет Очка Бесчестия — воля Богов не услышит.");
    return false;
  }
  if (!await confirm("Смертный Инструмент", `${esc(actor.name)} находится в смертельной опасности и открывает душу воле Богов? Тратится Очко Бесчестия, повторить можно только в следующей сессии.`, "Открыть душу", "Отмена")) return false;
  if (!await spendInfamyPoint(actor, "Смертный Инструмент")) return false;
  await markThrottleUsed(actor, MORTAL_USAGE, "session");
  const gods = litanyOptions(actor);
  const who = gods.length === 1 ? `Только ${gods[0].label}` : "Наиболее заинтересованный Бог Пантеона";
  const uuid = esc(actor.uuid);
  const btn = (kind, label, title) => `<button type="button" class="wh-mortal-btn" data-kind="${kind}" data-actor-uuid="${uuid}" title="${esc(title)}">${label}</button>`;
  await postTestCard(actor, {
    icon: ICON(), title: `Смертный Инструмент — ${esc(actor.name)}`,
    lines: [
      `<div class="roll-threshold">${esc(who)} отвечает в меру своего интереса. Ответ выбирает ГМ:</div>`,
      `<div class="roll-defense-btns">
        ${btn("shield", "Мистический щит", "Отражает один смертельный удар по Апостолу (до конца сессии)")}
        ${btn("mutation", "Внезапная мутация", "Апостол бросает мутацию или Дар Бога")}
        ${btn("daemons", "Демоны", "Вторжение демонической армии или высшего демона — на усмотрение ГМа")}
      </div>`
    ],
    outcome: outcomeHtml(true, "Воля Богов услышана")
  }, { sound: false });
  return true;
}

/** ГМ выбрал «мистический щит»: ближайший смертельный удар по Апостолу будет отражён. */
export async function grantMortalShield(actor) {
  await actor.setFlag(NS, MORTAL_SHIELD_FLAG, true);
  await postTestCard(actor, {
    icon: ICON(), title: `Мистический щит — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Следующий смертельный удар по Апостолу будет отражён (щит держится до этого удара).</div>`],
    outcome: outcomeHtml(true, "Щит Богов поднят")
  }, { sound: false });
}

/** ГМ выбрал демонов: назвать демона из Бестиария — он явится рядом с Апостолом. */
export async function summonMortalDaemon(actor) {
  const name = await textPrompt(`Смертный Инструмент — демон для ${actor.name}`, "Демон из Бестиария", "Высший демон или демон армии");
  if (!name) return false;
  const res = await spawnDemonOnScene(name, actor.uuid);
  if (!res.ok) ui.notifications?.warn(res.reason);
  return res.ok;
}

/** Слой конвейера урона: смертельный удар по Апостолу с мистическим щитом отражён, щит снят. */
export async function mortalShieldOnDamage(actor, net) {
  if (!(net > 0) || !mortalShieldAbsorbs(actor, net)) return { net, note: "" };
  await actor.unsetFlag(NS, MORTAL_SHIELD_FLAG);
  return { net: 0, note: `Мистический щит Богов отразил смертельный удар (${net} Ран), щит рассеялся.` };
}

// ── Лист ──────────────────────────────────────────────────────────────────

/** Сводка для вкладки БОЙ: Правоверные на сцене, действующая литания, щит, ограничения. */
export function darkApostleStatus(actor) {
  const litany = activeLitany(actor);
  const sessionReady = isThrottleReady(actor, MORTAL_USAGE, "session");
  return {
    litanyLabel: litany ? (litanyGodDef(litany.god)?.label ?? litany.god) : "",
    monuments: (actor.getFlag?.(NS, MONUMENTS_FLAG) ?? []).length,
    mortalReady: sessionReady,
    mortalShield: !!actor.getFlag?.(NS, MORTAL_SHIELD_FLAG),
    faithfulCount: sceneTokenActors().filter(a => isFaithfulOf(a, actor)).length,
    infamy: actorInfamyValue(actor),
    infamyMax: actorInfamyMax(actor),
    inCombat: isEncounterActive()
  };
}

/** Исполнитель записей «harbingerMark» / «martyrSummon» / «layOnHands» / «litanyBlessing» (gm-relay.performTargetWrite). */
export async function performDarkApostleWrite(target, op, initiator) {
  if (op.kind === "harbingerMark") {
    if (op.mark === "faithful") {
      return target.setFlag(NS, FAITHFUL_FLAG, { apostleUuid: initiator?.uuid ?? "", apostleName: initiator?.name ?? "" });
    }
    return target.setFlag(NS, "converted", { apostleUuid: initiator?.uuid ?? "", apostleName: initiator?.name ?? "" });
  }
  if (op.kind === "litanyBlessing") return performLitanyBlessing(target, op, initiator);
  if (op.kind === "layOnHands") return performLayOnHands(target, op, initiator);
  if (op.kind === "martyrSummon") return performMartyrSummon(target, op, initiator);
  return null;
}

