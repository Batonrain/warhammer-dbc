
import {
  BROKEN_FLAG, CELL_FLAG, WHIP_FLAG, RUN_DOWN_FLAG, RUN_DOWN_THROTTLE, REGEN_CARRY_FLAG, FORGE_LOG_FLAG,
  CELL_TURNS, CELL_WP_LOSS, CELL_INF_LOSS, FORGE_MAX_RARITY,
  RUN_DOWN_STRUCTURE, RUN_DOWN_HELPLESS, RUN_DOWN_WP_LOSS, RUN_DOWN_BONUS,
  CELL_DEVICE_TYPES,
  hasIronCage, hasWarpforgedPlate, hasSigilOfDominion, hasCellOfShame, hasEmpyreanWhip, hasForgeOfOne, hasRunDown,
  cageThreshold, cellThreshold, whipThreshold, resistThreshold, daemonLoreTotal, techUseTotal, cageRange,
  brokenOf, isCaged, isBrokenBySmith, flagSmithIs, cageFlag, cageMatured, brokenFlagMatured, cellFlag, cellBrokenFree,
  sigilItemData, findBrokenDominionTarget, regenIntervalSeconds, regenPlan, runDownChanges, runDownMarkOf, isCellDevice
} from "../rules/warpsmith.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import { rollD100WithReroll } from "../rules/test-kind-widget.mjs";
import { isThrottleReady, markThrottleUsed } from "../rules/cooldown.mjs";
import { grantTempInfamy, clearTempInfamy } from "../rules/temp-infamy.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { tokenDocEdgeDistance } from "../regions/auras.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { isWounded } from "../rules/healing-clock.mjs";
import { actorInfamyValue } from "../apps/infamy-points.mjs";
import { mechanicusImplantData } from "../apps/mechanicus-implant-grant.mjs";
import { hasAbility } from "../rules/ability-by-key.mjs";
import { computeWoundHealing } from "../sheets/tabs/wounds.mjs";
import { applyConditionWithDuration } from "./condition-effects.mjs";
import { applyCharDamage } from "./char-damage.mjs";
import { spendInfamyPoint } from "./noise-marine.mjs";
import { isEncounterActive, spendActionPoints, apCostForActionType } from "./action-economy.mjs";
import { writeToTarget } from "./gm-relay.mjs";
import { actorIdentityUuids } from "./command-state.mjs";

const NS = "warhammer-dbc";
const ICON = () => rollIcon("gear", "#e0a050");

const actorOfDoc = doc => doc?.actor ?? doc ?? null;
const targetedToken = () => [...(globalThis.game?.user?.targets ?? [])][0] ?? null;
const targetedActor = () => actorOfDoc(targetedToken());
const worldActors = () => [...(globalThis.game?.actors ?? [])];
const sceneTokens = () => [...(globalThis.canvas?.scene?.tokens ?? [])];
const sceneTokenActors = () => sceneTokens().map(t => t.actor).filter(Boolean);
const worldNow = () => Number(globalThis.game?.time?.worldTime) || 0;
const combatId = () => globalThis.game?.combat?.id ?? "";
const isCreature = actor => !!actor?.system?.characteristics;
const uuidsOf = actor => actorIdentityUuids(actor);

const tokenOfActor = actor => {
  const scene = globalThis.canvas?.scene;
  const tokens = [...(scene?.tokens ?? [])];
  return tokens.find(t => t.actor?.uuid === actor?.uuid || (actor?.id && t.actor?.id === actor.id)) ?? null;
};

function distanceBetween(actor, target) {
  const scene = globalThis.canvas?.scene;
  const a = tokenOfActor(actor);
  const b = tokenOfActor(target) ?? targetedToken()?.document ?? targetedToken();
  if (!scene || !a || !b) return null;
  return tokenDocEdgeDistance(a, b.document ?? b, scene.grid);
}

const confirm = (title, text, yes, no) => foundry.applications.api.DialogV2.confirm({
  window: { title }, content: `<p>${text}</p>`, yes: { label: yes }, no: { label: no }, rejectClose: false
}).then(r => !!r).catch(() => false);

const dialogSelect = (title, label, options, hint = "", okLabel = "Выбрать") =>
  foundry.applications.api.DialogV2.prompt({
    window: { title },
    content: `<div class="atk-dlg-row"><label>${esc(label)}:</label><select name="pick" class="pm-input">${options.map(o =>
      `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select></div>${hint ? `<p class="dyn-hint">${hint}</p>` : ""}`,
    ok: { label: okLabel, callback: (event, button) => button.form.elements.pick.value },
    rejectClose: false
  }).catch(() => null);

async function rollTest(threshold) {
  const { rv, rolls, rerollNote } = await rollD100WithReroll(null);
  return { rv, rolls, rerollNote, ...testOutcome(rv, threshold) };
}

const roll = async formula => (await new Roll(formula).evaluate()).total;

export const hasMechanicumImplantsTrait = actor =>
  hasAbility(actor, "ability.mechanicumImplants", "Mechanicum Implants", "trait");

export async function syncMechanicumImplants(actor) {
  if (!actor || actor.type !== "character" || !hasMechanicumImplantsTrait(actor)) return 0;
  const implants = [...(actor.items ?? [])].filter(i => i.type === "implant");
  if (implants.some(i => i.system?.category === "mechanicus")) return 0;
  const existing = new Set(implants.map(i => i.name));
  const toAdd = await mechanicusImplantData(existing);
  if (!toAdd.length) return 0;
  await actor.createEmbeddedDocuments("Item", toAdd);
  return toAdd.length;
}

export async function warpforgedRegenClock(actor, { from, to }) {
  if (!hasWarpforgedPlate(actor)) return;
  const wounds = actor.system?.wounds;
  const carry = Number(actor.getFlag?.(NS, REGEN_CARRY_FLAG)) || 0;
  if (!isWounded(wounds)) {
    if (carry) await actor.unsetFlag(NS, REGEN_CARRY_FLAG);
    return;
  }
  const max = Number(wounds.effectiveMax ?? wounds.max) || 0;
  const missing = Math.max(0, max - (Number(wounds.value) || 0)) + (Number(wounds.critical) || 0);
  const plan = regenPlan({ elapsed: Number(to) - Number(from), carry, interval: regenIntervalSeconds(actor), missing });
  if (plan.heal > 0) {
    await actor.update(computeWoundHealing({ wounds }, plan.heal));
    await postTestCard(actor, {
      icon: rollIcon("heart", "#e0a050"), title: `Закалённые Варпом Латы — ${esc(actor.name)}`,
      lines: [`<div class="roll-threshold">Регенерация: +${plan.heal} Ран (1 Рана за ${Math.round(regenIntervalSeconds(actor) / 60)} мин).</div>`]
    }, { sound: false });
  }
  if (plan.carry !== carry) {
    if (plan.carry) await actor.setFlag(NS, REGEN_CARRY_FLAG, plan.carry);
    else if (carry) await actor.unsetFlag(NS, REGEN_CARRY_FLAG);
  }
}

export async function useIronCage(actor, target = targetedActor()) {
  if (!hasIronCage(actor)) return false;
  if (!target || target.uuid === actor.uuid) {
    ui.notifications?.warn("Наведите таргет (T) на демона в Истинной Форме, которого арканите.");
    return false;
  }
  const existing = brokenOf(target);
  if (existing && flagSmithIs(existing, actor, uuidsOf)) {
    ui.notifications?.info(`${target.name} уже ${existing.state === "broken" ? "Сломлен" : "заарканен"} вами.`);
    return false;
  }
  const range = cageRange(actor);
  const distance = distanceBetween(actor, target);
  if (distance != null && distance > range) {
    ui.notifications?.warn(`Железная Клеть достаёт на I.b = ${range} м, до ${target.name} — ${Math.round(distance)} м.`);
    return false;
  }
  if (!await confirm("Железная Клеть", `${esc(target.name)} — демон в Истинной Форме?`, "Да, в Истинной Форме", "Нет")) return false;
  if (isEncounterActive() && !await spendActionPoints(actor, apCostForActionType("Полное действие"), { physical: true })) return false;

  const mods = collectTestMods(actor, { kind: "skill", skill: "techUse", char: "int", targetActor: target });
  const theirMods = collectTestMods(target, { kind: "skill", char: "wp", targetActor: actor });
  const mine = cageThreshold(actor, mods.total);
  const theirs = resistThreshold(target, theirMods.total);
  const a = await rollTest(mine);
  const b = await rollTest(theirs);
  const { winner } = resolveOpposed({ ...a, threshold: mine }, { ...b, threshold: theirs });
  const win = winner === "mine";
  let note = "";
  if (win) {
    const ok = await writeToTarget(target, { kind: "warpsmith", action: "cage" }, actor);
    note = ok ? "" : " Метку записать некому (нет ГМа) — отметьте Клеть вручную.";
  }
  await postTestCard(actor, {
    icon: ICON(), title: `Железная Клеть — ${esc(actor.name)} → ${esc(target.name)}`,
    lines: [
      `<div>${esc(actor.name)}: Tech-Use−10 <b>${a.rv}</b> vs ${mine} ${a.success ? "(успех)" : "(провал)"}</div>`, a.rerollNote,
      `<div>${esc(target.name)}: W+0 <b>${b.rv}</b> vs ${theirs} ${b.success ? "(успех)" : "(провал)"}</div>`, b.rerollNote,
      win ? `<div class="roll-threshold">Демон парализован и стабилизирован в реальности, пока Кузнец не сдвинется с места. Через W.b = ${Math.max(1, Number(target.system?.characteristics?.wp?.bonus) || 0)} ч пытки он станет Сломленным.</div>` : ""
    ],
    outcome: outcomeHtml(win, win ? `${esc(target.name)} заарканен${note}` : `${esc(target.name)} вырвался из петель`)
  }, { rolls: [...a.rolls, ...b.rolls] });
  return win;
}

export async function ironCageClock(actor, { to }) {
  const flag = brokenOf(actor);
  if (!cageMatured(flag, to)) return;
  await actor.setFlag(NS, BROKEN_FLAG, brokenFlagMatured(flag));
  await postTestCard(actor, {
    icon: ICON(), title: `Железная Клеть — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Срок пытки вышел: демон подчинился воле Кузнеца (${esc(flag.smithName)}) и Сломлен — автоматически проваливает встречные тесты W против него.</div>`],
    outcome: outcomeHtml(true, "Сломлен")
  }, { sound: false });
}

export async function releaseCagesOnMove(tokenDoc) {
  const smith = tokenDoc?.actor;
  if (!smith || !hasIronCage(smith)) return 0;
  let released = 0;
  const tokens = [...(tokenDoc.parent?.tokens ?? sceneTokens())];
  for (const t of tokens) {
    const target = t.actor;
    if (!target || target.uuid === smith.uuid) continue;
    const flag = brokenOf(target);
    if (!flag || flag.state !== "caged" || !flagSmithIs(flag, smith, uuidsOf)) continue;
    if (await writeToTarget(target, { kind: "warpsmith", action: "cageRelease" }, smith)) released++;
    await postTestCard(smith, {
      icon: ICON(), title: `Железная Клеть — ${esc(smith.name)}`,
      lines: [`<div class="roll-threshold">${esc(smith.name)} сдвинулся с места — ${esc(target.name)} вырвался из петель, пытка прервана.</div>`]
    }, { sound: false });
  }
  return released;
}

export function initWarpsmithHooks() {
  Hooks.on("updateToken", async (tokenDoc, changes, options, userId) => {
    if (userId !== game.user?.id) return;
    if (!Object.hasOwn(changes, "x") && !Object.hasOwn(changes, "y")) return;
    await releaseCagesOnMove(tokenDoc);
  });
}

export async function forgeSigil(actor, target = targetedActor()) {
  if (!hasSigilOfDominion(actor)) return false;
  if (!target || !isBrokenBySmith(target, actor, uuidsOf)) {
    ui.notifications?.warn("Наведите таргет (T) на Сломленного вами демона — печать связывается с его духом.");
    return false;
  }
  if (!await spendInfamyPoint(actor, "Печать Владычества")) return false;
  const [item] = await actor.createEmbeddedDocuments("Item", [sigilItemData(actor, target)]);
  await postTestCard(actor, {
    icon: ICON(), title: `Печать Владычества — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Потрачено: Очко Бесчестия. Печать «${esc(target.name)}» лежит в снаряжении: тот, кто её держит, получает против этого демона те же преимущества, что и Кузнец — автопровал встречных тестов W и Владычество без броска. Передайте предмет тому, кому доверяете.</div>`],
    outcome: outcomeHtml(true, "Печать выкована")
  }, { sound: false });
  return item ?? true;
}

export async function useCellOfShame(actor, target = targetedActor()) {
  if (!hasCellOfShame(actor)) return false;
  if (!target || !isBrokenBySmith(target, actor, uuidsOf)) {
    ui.notifications?.warn("Наведите таргет (T) на Сломленного вами демона, которого заключаете в ячейку.");
    return false;
  }
  const flag = brokenOf(target);
  if (flag?.cell) {
    ui.notifications?.info(`${target.name} уже заключён в ячейку.`);
    return false;
  }
  const lore = daemonLoreTotal(actor);
  if (lore == null) {
    ui.notifications?.warn("У Кузнеца нет Навыка Forbidden Lore (Daemons) — ячейку не создать.");
    return false;
  }
  const devices = [...(actor.items ?? [])].filter(i => CELL_DEVICE_TYPES.includes(i.type) && !isCellDevice(i));
  const options = [{ value: "", label: "— устройство вне листа (запись в карточке) —" },
    ...devices.map(i => ({ value: i.id, label: `${i.name} (${i.type})` }))];
  const pick = await dialogSelect(`Ячейка Позора — ${actor.name}`, "Устройство", options,
    `Ячейка питания, батарея, реактор или бак горючего. Займёт ${CELL_TURNS} Ходов. Устройство не требует перезарядки.`, "Заключить");
  if (pick == null) return false;
  const device = pick ? actor.items.get(pick) : null;

  const mods = collectTestMods(actor, { kind: "skill", group: "forbiddenLore", specialty: "Daemons", char: "int" });
  const threshold = cellThreshold(actor, mods.total);
  const { rv, rolls, rerollNote, success, deg } = await rollTest(threshold);
  let note = "";
  if (success) {
    const ok = await writeToTarget(target, { kind: "warpsmith", action: "cell", deviceName: device?.name ?? "" }, actor);
    if (!ok) note = " Потерю W и Inf записать некому (нет ГМа) — внесите вручную.";
    if (device) await device.setFlag(NS, CELL_FLAG, cellFlag(actor, target, device.name));
  }
  await postTestCard(actor, {
    icon: ICON(), title: `Ячейка Позора — ${esc(actor.name)} → ${esc(target.name)}`,
    threshold: rollStatLine({ label: "For.Lore (Daemons)−20", base: lore, parts: mods.parts.map(esc), threshold, rv }),
    rerollNote,
    lines: [`<div class="roll-threshold">Работа заняла ${CELL_TURNS} Ходов${device ? `; устройство: ${esc(device.name)}` : ""}.</div>`,
      success ? `<div class="roll-threshold">Демон навсегда теряет ${CELL_WP_LOSS} W и ${CELL_INF_LOSS} Inf. Устройство не требует перезарядки и заправки и иммунно к Haywire; Критический Провал на его использование вызывает Феномен (вместо клина или перегрева).${note}</div>` : ""],
    outcome: outcomeHtml(success, success ? `Успех (${deg}) — ${esc(target.name)} заключён в ячейку` : "Провал — демон не поддался")
  }, { rolls });
  return success;
}

export async function releaseCellDemon(item) {
  const cell = item?.getFlag?.(NS, CELL_FLAG);
  if (!cell?.demonUuid) return false;
  const doc = await fromUuid(cell.demonUuid).catch(() => null);
  const demon = actorOfDoc(doc);
  if (!demon) return false;
  const initiator = item.actor ?? actorOfDoc(await fromUuid(cell.smithUuid).catch(() => null));
  await writeToTarget(demon, { kind: "warpsmith", action: "cellFree" }, initiator);
  await postTestCard(initiator ?? demon, {
    icon: ICON(), title: `Ячейка Позора разрушена — ${esc(demon.name)}`,
    lines: [`<div class="roll-threshold">${esc(cell.deviceName || item.name)} уничтожено: ${esc(demon.name)} вырывается на свободу в Истинной Форме. Он всё ещё Сломлен, но действует по своей воле, пока Кузнец не проведёт над ним Демоническое Владычество — и наверняка попытается сбежать или отомстить.</div>`]
  }, { sound: false });
  return true;
}

export function whipCandidates(actor) {
  const token = tokenOfActor(actor);
  if (!token) return [];
  return tokensWithinRadius(token, cageRange(actor)).map(t => t.actor)
    .filter(a => a && isBrokenBySmith(a, actor, uuidsOf));
}

export async function useEmpyreanWhip(actor) {
  if (!hasEmpyreanWhip(actor)) return false;
  if (!isEncounterActive()) {
    ui.notifications?.warn("Эмпирейная Плеть действует «до конца боя» — запускайте её в бою.");
    return false;
  }
  const machines = whipCandidates(actor);
  if (!machines.length) {
    ui.notifications?.warn(`В радиусе I = ${cageRange(actor)} м нет Сломленных вами демонических машин.`);
    return false;
  }
  const loreMods = collectTestMods(actor, { kind: "skill", group: "forbiddenLore", specialty: "Daemons", char: "int" });
  const threshold = whipThreshold(actor, loreMods.total);
  if (threshold == null) {
    ui.notifications?.warn("У Кузнеца нет Навыка Forbidden Lore (Daemons) — плеть не поднять.");
    return false;
  }
  if (!await spendActionPoints(actor, apCostForActionType("Полное действие"), { physical: false })) return false;
  const { rv, rolls, rerollNote, success, deg } = await rollTest(threshold);
  const names = machines.map(m => esc(m.name)).join(", ");
  let note = "";
  if (success) {
    for (const machine of machines) await writeToTarget(machine, { kind: "warpsmith", action: "whip" }, actor);
    note = ` До конца боя ${names} слушаются напрямую, как Миньоны.`;
  }
  await postTestCard(actor, {
    icon: ICON(), title: `Эмпирейная Плеть — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "наименьший из For.Lore (Daemons)−20 и Command(I)−10", base: null, parts: loreMods.parts.map(esc), threshold, rv }),
    rerollNote,
    lines: [`<div class="roll-threshold">В радиусе ${cageRange(actor)} м: ${names}.${note}</div>`],
    outcome: outcomeHtml(success, success ? `Успех (${deg}) — плеть держит машины` : "Провал — машины остаются сами по себе")
  }, { rolls });
  return success;
}

export async function clearWhipOnCombatEnd() {
  const seen = new Set();
  for (const actor of [...worldActors(), ...sceneTokenActors()]) {
    if (!actor?.uuid || seen.has(actor.uuid)) continue;
    seen.add(actor.uuid);
    const mark = actor.getFlag?.(NS, WHIP_FLAG);
    if (!mark || !actor.isOwner) continue;
    if (isCreature(actor) && actor.system?.masterUuid === mark.smithUuid) {
      await actor.update({ "system.masterUuid": mark.prevMasterUuid ?? "" });
    }
    await actor.unsetFlag(NS, WHIP_FLAG);
  }
}

export async function useForgeOfOne(actor) {
  if (!hasForgeOfOne(actor)) return false;
  if (actorInfamyValue(actor) < 1) {
    ui.notifications?.warn("Нет Очка Бесчестия — сборка из обломков невозможна.");
    return false;
  }
  const form = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Кузница Одного — ${actor.name}` },
    content: `<div class="atk-dlg-row"><label>Что собираем:</label><input type="text" name="what" class="pm-input" placeholder="Паттерн техники / оболочка демонической машины"/></div>
      <div class="atk-dlg-row"><label>Редкость (R):</label><input type="number" name="rarity" class="pm-input" value="1" min="0" max="10"/></div>
      <div class="atk-dlg-row"><label>Из чего:</label><input type="text" name="source" class="pm-input" placeholder="обломки вражеского танка, детали из стен хаб-блока"/></div>
      <p class="dyn-hint">Известный вам паттерн техники или оболочка демонической машины R${FORGE_MAX_RARITY} и ниже; сутки непрерывной работы, тратится 1 Очко Бесчестия. Ремонт в поле без кузницы — без кнопки.</p>`,
    ok: { label: "Собрать", callback: (event, button) => Object.fromEntries(new FormData(button.form)) },
    rejectClose: false
  }).catch(() => null);
  if (!form) return false;
  const rarity = Number(form.rarity) || 0;
  if (rarity > FORGE_MAX_RARITY) {
    ui.notifications?.warn(`Кузница Одного собирает не выше R${FORGE_MAX_RARITY}, а не R${rarity}.`);
    return false;
  }
  const what = String(form.what ?? "").trim() || "Паттерн техники";
  if (!await spendInfamyPoint(actor, "Кузница Одного")) return false;
  const log = actor.getFlag?.(NS, FORGE_LOG_FLAG);
  const entry = { what, rarity, source: String(form.source ?? "").trim(), at: worldNow() };
  await actor.setFlag(NS, FORGE_LOG_FLAG, [...(Array.isArray(log) ? log : []), entry]);
  await postTestCard(actor, {
    icon: ICON(), title: `Кузница Одного — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold"><b>${esc(what)}</b> (R${rarity})${entry.source ? ` из: ${esc(entry.source)}` : ""} — сутки непрерывной работы, готово в конце суток. Потрачено: Очко Бесчестия.</div>`],
    outcome: outcomeHtml(true, "Сборка начата")
  }, { sound: false });
  return true;
}

export async function useRunDown(actor, target = targetedActor()) {
  if (!hasRunDown(actor)) return false;
  if (!isEncounterActive()) {
    ui.notifications?.warn("Загнать — приём боя.");
    return false;
  }
  if (!target || !isBrokenBySmith(target, actor, uuidsOf)) {
    ui.notifications?.warn("Наведите таргет (T) на Сломленную вами демоническую машину.");
    return false;
  }
  if (runDownMarkOf(target)) {
    ui.notifications?.info(`${target.name} уже загнана до следующего Хода Кузнеца.`);
    return false;
  }
  if (!isThrottleReady(actor, RUN_DOWN_THROTTLE, "round")) {
    ui.notifications?.warn("Загнать — раз в Ход.");
    return false;
  }
  if (!await spendInfamyPoint(actor, "Загнать")) return false;
  const ok = await writeToTarget(target, { kind: "warpsmith", action: "runDown" }, actor);
  if (!ok) return false;
  await markThrottleUsed(actor, RUN_DOWN_THROTTLE, "round");
  await postTestCard(actor, {
    icon: ICON(), title: `Загнать — ${esc(actor.name)} → ${esc(target.name)}`,
    lines: [
      `<div class="roll-threshold">Потрачено: Очко Бесчестия. ${esc(target.name)}: +${RUN_DOWN_BONUS} ко всем Характеристикам и 1 Очко Бесчестия до начала следующего Хода Кузнеца.</div>`,
      `<div class="roll-threshold">В начале следующего Хода Кузнеца машина теряет ${RUN_DOWN_STRUCTURE} Структуры, становится Беспомощной на ${RUN_DOWN_HELPLESS} Раундов, а демон внутри навсегда теряет ${RUN_DOWN_WP_LOSS} W — это произойдёт само.</div>`
    ],
    outcome: outcomeHtml(true, "Узы впились в дух демона")
  }, { sound: false });
  return true;
}

export async function runDownTurnStart(actor) {
  if (!hasRunDown(actor)) return 0;
  let paid = 0;
  const seen = new Set();
  for (const target of [...worldActors(), ...sceneTokenActors()]) {
    if (!target?.uuid || seen.has(target.uuid)) continue;
    seen.add(target.uuid);
    const mark = runDownMarkOf(target);
    if (!mark || !(mark.smithUuids ?? [mark.smithUuid]).some(u => uuidsOf(actor).has(u))) continue;
    const structure = await roll(RUN_DOWN_STRUCTURE);
    const helpless = await roll(RUN_DOWN_HELPLESS);
    const wp = await roll(RUN_DOWN_WP_LOSS);
    const ok = await writeToTarget(target, { kind: "warpsmith", action: "runDownPay", structure, helpless, wp }, actor);
    await postTestCard(actor, {
      icon: ICON(), title: `Загнать — расплата ${esc(target.name)}`,
      lines: [`<div class="roll-threshold">${esc(target.name)} теряет <b>${structure}</b> Структуры (${RUN_DOWN_STRUCTURE}), Беспомощна <b>${helpless}</b> Раунд(ов), демон навсегда теряет <b>${wp}</b> W.${ok ? "" : " Записать некому (нет ГМа) — внесите вручную."}</div>`]
    }, { sound: false });
    paid++;
  }
  return paid;
}

async function removeRunDownEffects(target) {
  const ids = [...(target.effects ?? [])].filter(e => (e.getFlag?.(NS, RUN_DOWN_FLAG) ?? e.flags?.[NS]?.[RUN_DOWN_FLAG])).map(e => e.id);
  if (ids.length) await target.deleteEmbeddedDocuments("ActiveEffect", ids);
}

export async function performWarpsmithWrite(target, op, initiator) {
  const smithIds = [...uuidsOf(initiator)];
  switch (op.action) {
    case "cage":
      return target.setFlag(NS, BROKEN_FLAG, cageFlag(initiator, target, worldNow(), smithIds));
    case "cageRelease":
      return isCaged(target) ? target.unsetFlag(NS, BROKEN_FLAG) : null;
    case "cell": {
      if (isCreature(target)) {
        await applyCharDamage(target, "wp", CELL_WP_LOSS, { portion: { hours: 0, source: "Ячейка Позора" } });
        await applyCharDamage(target, "inf", CELL_INF_LOSS, { portion: { hours: 0, source: "Ячейка Позора" } });
      }
      const flag = brokenOf(target);
      return target.setFlag(NS, BROKEN_FLAG, { ...flag, cell: { deviceName: String(op.deviceName ?? ""), at: worldNow() } });
    }
    case "cellFree": {
      const flag = brokenOf(target);
      return flag ? target.setFlag(NS, BROKEN_FLAG, { ...cellBrokenFree(flag), cell: null }) : null;
    }
    case "whip": {
      const prev = isCreature(target) ? String(target.system?.masterUuid ?? "") : "";
      if (isCreature(target)) await target.update({ "system.masterUuid": initiator.uuid });
      return target.setFlag(NS, WHIP_FLAG, { smithUuid: initiator.uuid, prevMasterUuid: prev, combatId: combatId() });
    }
    case "runDown": {
      await removeRunDownEffects(target);
      if (isCreature(target)) {
        await target.createEmbeddedDocuments("ActiveEffect", [{
          name: "Загнать: +30 ко всем Характеристикам", img: "icons/svg/upgrade.svg",
          system: { changes: runDownChanges().map(c => ({ priority: 0, ...c, phase: "initial" })) },
          flags: { [NS]: { [RUN_DOWN_FLAG]: true } }
        }]);
      }
      await grantTempInfamy(target, 1, { source: "Загнать", restriction: "" });
      return target.setFlag(NS, RUN_DOWN_FLAG, { smithUuid: initiator.uuid, smithUuids: smithIds, combatId: combatId(), at: worldNow() });
    }
    case "runDownPay": {
      await removeRunDownEffects(target);
      await clearTempInfamy(target);
      if (target.type === "vehicle") {
        const cur = Number(target.system?.structure?.value) || 0;
        await target.update({ "system.structure.value": Math.max(0, cur - op.structure) });
      } else if (isCreature(target)) {
        await applyWoundLoss(target, op.structure);
        if (op.helpless > 0) await applyConditionWithDuration(target, "helpless", { value: op.helpless, unit: "rounds" });
        await applyCharDamage(target, "wp", op.wp, { portion: { hours: 0, source: "Загнать" } });
      }
      return target.unsetFlag(NS, RUN_DOWN_FLAG);
    }
    default:
      return null;
  }
}

export async function confirmDominionOver(target) {
  const flag = brokenOf(target);
  if (!flag?.freeWill) return false;
  await target.setFlag(NS, BROKEN_FLAG, { ...flag, freeWill: false });
  return true;
}

export function findBrokenDominionDemon(actor, demonName) {
  const seen = new Set();
  const candidates = [...worldActors(), ...sceneTokenActors()].filter(a => a?.uuid && !seen.has(a.uuid) && seen.add(a.uuid));
  return findBrokenDominionTarget(actor, demonName, candidates, uuidsOf);
}

export function warpsmithStatus(actor) {
  const seen = new Set();
  let caged = 0;
  let broken = 0;
  for (const a of [...worldActors(), ...sceneTokenActors()]) {
    if (!a?.uuid || seen.has(a.uuid)) continue;
    seen.add(a.uuid);
    const flag = brokenOf(a);
    if (!flag || !flagSmithIs(flag, actor, uuidsOf)) continue;
    if (flag.state === "caged") caged++;
    else if (flag.state === "broken") broken++;
  }
  return {
    caged, broken, inCombat: isEncounterActive(),
    infamy: actorInfamyValue(actor),
    runDownReady: isThrottleReady(actor, RUN_DOWN_THROTTLE, "round"),
    techUse: techUseTotal(actor)
  };
}
