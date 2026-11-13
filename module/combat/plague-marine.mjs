import {
  ABOMINABLE_FLAG, ABOMINABLE_FEAR_RATING, MIASMA_FLAG, MIASMA_USED_FLAG, MIASMA_RADIUS_M, MIASMA_DAMAGE, MIASMA_TURNS,
  MIASMA_WEAPON_NAME, BILE_SPIT_PEN_DICE, BLESSED_TOUCH_DAMAGE, BLESSED_WEAPON_NAME, INFECTION_DUE_FLAG, WASTELAND_REQUEST_FLAG,
  WASTELAND_SELF_DAMAGE, WASTELAND_SECONDS, RUST_FLAG, ROTSMITH_FLAG,
  hasAbominableReaction, hasInfectiousMiasma, hasPlagueGardener, hasRotsmith, hasBileSpit, hasGloriousRust,
  hasBlessedWithPus, hasWalkingWasteland,
  isNurgleDevoted, isBileSpitWeapon, abominableReduce, abominableThreshold, abominableReductionFor, abominableGuardNext,
  abominableFeared, miasmaStart, miasmaTick, miasmaActive, miasmaUsedIn, carrierDiseases, pickIndexByRoll,
  diseaseCopyData, sameDisease, isEnemyDisposition, infectionDueAdd, infectionGroups, rustQuality, rustApplies,
  isInfectableKnife, isSeveredHead, rotsmithResult, rotsmithMark, rotsmithDue, wastelandRect
} from "../rules/plague-marine.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { rollD100WithReroll } from "../rules/test-kind-widget.mjs";
import { tokensWithinRadius } from "../rules/aoe-target.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { combatOfActor } from "./actor-combat.mjs";
import { canSpendReaction, spendReaction } from "./action-economy.mjs";
import { rollInfectionTest } from "./disease-infection.mjs";
import { dealDamageToTarget } from "./gm-relay.mjs";
import { spendInfamyPoint } from "./noise-marine.mjs";
import { _executeFearRoll } from "./fear.mjs";

const NS = "warhammer-dbc";
const ICON = () => rollIcon("warp", "#9fd13f");

const isDeceased = actor => !!actor?.getFlag?.(NS, "deceased");
const actorOfUuid = async uuid => {
  const doc = uuid ? await fromUuid(uuid).catch(() => null) : null;
  return doc?.actor ?? doc ?? null;
};

const confirm = (title, text, yes, no) => foundry.applications.api.DialogV2.confirm({
  window: { title }, content: `<p>${text}</p>`, yes: { label: yes }, no: { label: no }
}).then(r => !!r).catch(() => false);

export async function abominableOnHit(actor, damageData) {
  const raw = Number(damageData?.rawDamage) || 0;
  if (!actor || raw <= 0 || !hasAbominableReaction(actor)) return damageData;
  const combat = combatOfActor(actor);
  if (!combat) return damageData;
  const attackerUuid = damageData.attackerUuid || "";
  const attackerName = damageData.attackerName || "противник";
  const flag = actor.getFlag(NS, ABOMINABLE_FLAG);
  const held = abominableReductionFor(flag, attackerUuid, combat.id);

  if (held > 0) {
    const { damage, reducedToZero } = abominableReduce(raw, held);
    await postTestCard(actor, {
      icon: ICON(), title: `Отвратная Физиология — ${esc(actor.name)}`,
      lines: [`<div class="roll-threshold">Урон от ${esc(attackerName)} уменьшен на <b>${held}</b>: ${raw} → <b>${damage}</b> (до начала следующего Хода).</div>`]
    }, { sound: false });
    if (reducedToZero && !abominableFeared(flag, attackerUuid)) {
      await actor.setFlag(NS, ABOMINABLE_FLAG, abominableGuardNext(flag, { attackerUuid, reduce: held, combatId: combat.id, feared: true }));
      await postAbominableFear(actor, attackerUuid, attackerName);
    }
    return { ...damageData, rawDamage: damage };
  }

  if (!canSpendReaction(actor, { physical: false })) return damageData;
  const toughness = Number(actor.system?.characteristics?.t?.total) || 0;
  const mods = collectTestMods(actor, { kind: "skill", char: "t" });
  const threshold = abominableThreshold(toughness, mods.total);
  const ok = await confirm("Отвратная Физиология",
    `${esc(actor.name)} получает попадание от ${esc(attackerName)}: Потратить Реакцию и пройти тест T+30 (порог ${threshold}), чтобы уменьшить весь урон от этого противника на Успехи до начала следующего Хода?`,
    "Потратить Реакцию", "Нет");
  if (!ok) return damageData;
  if (!await spendReaction(actor, { physical: false })) return damageData;

  const { rv, rolls } = await rollD100WithReroll(null);
  const { success, deg } = testOutcome(rv, threshold);
  let result = damageData;
  const lines = [];
  if (success) {
    const { damage, reducedToZero } = abominableReduce(raw, deg);
    if (attackerUuid) {
      await actor.setFlag(NS, ABOMINABLE_FLAG, abominableGuardNext(flag, { attackerUuid, reduce: deg, combatId: combat.id, feared: reducedToZero || undefined }));
    }
    lines.push(`<div class="roll-threshold">Весь урон от ${esc(attackerName)} уменьшен на <b>${deg}</b> (Успехи) до начала следующего Хода: ${raw} → <b>${damage}</b>${attackerUuid ? "" : " (только это попадание: нападающий не опознан)"}.</div>`);
    result = { ...damageData, rawDamage: damage };
    if (reducedToZero) lines.push(`<div class="roll-threshold">Урон сведён к нулю: ${esc(attackerName)} получает рейтинг Страха ${ABOMINABLE_FEAR_RATING} против носителя до конца боя.</div>`);
    await postTestCard(actor, {
      icon: ICON(), title: `Отвратная Физиология — ${esc(actor.name)}`,
      threshold: rollStatLine({ label: "T+30", base: toughness, parts: mods.parts.map(esc), threshold, rv }),
      lines, outcome: outcomeHtml(true, `Успех (${deg}) — урон ослаблен`)
    }, { rolls });
    if (reducedToZero) await postAbominableFear(actor, attackerUuid, attackerName);
  } else {
    await postTestCard(actor, {
      icon: ICON(), title: `Отвратная Физиология — ${esc(actor.name)}`,
      threshold: rollStatLine({ label: "T+30", base: toughness, parts: mods.parts.map(esc), threshold, rv }),
      outcome: outcomeHtml(false, "Провал — Реакция потрачена, урон прежний")
    }, { rolls });
  }
  return result;
}

async function postAbominableFear(actor, attackerUuid, attackerName) {
  if (!attackerUuid) return;
  await postTestCard(actor, {
    icon: ICON(), title: `Рейтинг Страха ${ABOMINABLE_FEAR_RATING} — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Урон сведён к нулю: ${esc(attackerName)} проходит тест Страха (${ABOMINABLE_FEAR_RATING}) против ${esc(actor.name)} (рейтинг действует до конца боя).</div>`],
    sections: [`<button class="wh-pm-fear-btn" type="button" data-target-uuid="${esc(attackerUuid)}" data-source-name="${esc(actor.name)}">Тест Страха (${ABOMINABLE_FEAR_RATING}): ${esc(attackerName)}</button>`]
  }, { sound: false });
}

export async function rollAbominableFear(target) {
  const infamy = Math.max(0, Number(target?.system?.characteristics?.inf?.total) || 0);
  const type = target?.hasPlayerOwner ? "important" : "normal";
  return _executeFearRoll(target, ABOMINABLE_FEAR_RATING, type, infamy, 0, {});
}

async function chooseDisease(carrier, diseases) {
  if (diseases.length < 2 || !hasPlagueGardener(carrier)) return null;
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: `Чумной Садовник — ${carrier.name}` },
    classes: ["wh-roll-dialog-window"],
    content: `<p>Какой из болезней заразить цели? (Чумной Садовник)</p>`,
    buttons: [
      ...diseases.map((d, i) => ({ action: `d${i}`, label: d.name, callback: () => d.id })),
      { action: "random", label: "Случайно", default: true, callback: () => null }
    ],
    rejectClose: false
  }).catch(() => null);
  return picked ? diseases.find(d => d.id === picked) ?? null : null;
}

async function randomDisease(diseases) {
  if (diseases.length === 1) return diseases[0];
  const roll = await new Roll(`1d${diseases.length}`).evaluate();
  return diseases[pickIndexByRoll(roll.total, diseases.length)];
}

async function infectOne(victim, disease, via) {
  const existing = sameDisease(victim, disease);
  if (existing?.system?.active) return "already";
  let copy = existing;
  let created = false;
  if (!copy) {
    [copy] = await victim.createEmbeddedDocuments("Item", [diseaseCopyData(disease)]);
    created = true;
  }
  if (!copy) return null;
  const result = await rollInfectionTest(victim, copy, { vector: { label: via, char: "t", mod: 0 } });
  if (created && result !== "infected") await copy.delete();
  return result;
}

export async function infectVictims(carrier, victims, via) {
  const targets = victims.filter(v => v && !isDeceased(v));
  if (!targets.length) return [];
  const diseases = carrierDiseases(carrier);
  if (!diseases.length) {
    await postTestCard(carrier, {
      icon: ICON(), title: `Заражение — ${esc(carrier.name)}`,
      lines: [`<div class="roll-threshold">${esc(via)}: у носителя нет действующих болезней — заражать нечем.</div>`]
    }, { sound: false });
    return [];
  }
  const fixed = await chooseDisease(carrier, diseases);
  const out = [];
  for (const victim of targets) {
    const disease = fixed ?? await randomDisease(diseases);
    out.push({ victim, disease, result: await infectOne(victim, disease, via) });
  }
  return out;
}

export function infectiousMiasmaStatus(actor, combat = combatOfActor(actor)) {
  return {
    used: miasmaUsedIn(actor?.getFlag?.(NS, MIASMA_USED_FLAG), combat?.id),
    active: miasmaActive(actor?.getFlag?.(NS, MIASMA_FLAG), combat?.id),
    left: Number(actor?.getFlag?.(NS, MIASMA_FLAG)?.left) || 0
  };
}

export async function activateInfectiousMiasma(actor) {
  if (!hasInfectiousMiasma(actor)) return false;
  const combat = combatOfActor(actor);
  if (!combat) { ui.notifications?.warn("Заразные Миазмы — раз за бой: сначала начните бой."); return false; }
  if (infectiousMiasmaStatus(actor, combat).used) { ui.notifications?.warn("Заразные Миазмы уже выпускались в этом бою."); return false; }
  if (!await spendInfamyPoint(actor, "Заразные Миазмы")) return false;
  const roll = await new Roll(MIASMA_TURNS).evaluate();
  await actor.setFlag(NS, MIASMA_USED_FLAG, combat.id);
  await actor.setFlag(NS, MIASMA_FLAG, miasmaStart(roll.total, combat.id));
  await postTestCard(actor, {
    icon: ICON(), title: `Заразные Миазмы — ${esc(actor.name)}`,
    lines: [
      `<div class="roll-threshold">Облако демонических мух и трупных газов: <b>${roll.total}</b> (${MIASMA_TURNS}) Ходов.</div>`,
      `<div class="roll-threshold">В начале каждого Хода носителя все, кто не посвящён Нурглу, в радиусе ${MIASMA_RADIUS_M} м получают ${MIASMA_DAMAGE} C Toxic(0), игнорирующее негерметичную броню. По окончании врагам, получившим урон и выжившим, — тест T+0 или заражение.</div>`
    ]
  }, { sound: false, rolls: [roll] });
  return true;
}

async function toxicEffect(victim, label) {
  const { _applyWeaponPropEffect } = await import("../hooks.mjs");
  return _applyWeaponPropEffect({
    wpLabel: label, wpKey: "toxic", wpCondition: "poisoned", wpTestChar: "t", wpTestMod: "0", wpDamage: "1d10",
    wpRating: "0", wpOnBreach: "0", wpForceActorUuid: victim.uuid, wpDmgType: "chemical", wpHitLocation: "Торс"
  }, { force: true });
}

export async function processMiasmaTurnStart(actor, tokenDoc, combat = combatOfActor(actor)) {
  if (!actor || !tokenDoc || !combat) return;
  const state = actor.getFlag(NS, MIASMA_FLAG);
  if (!miasmaActive(state, combat.id)) return;
  const { applyDamageToActor } = await import("./damage.mjs");
  const lines = [];
  const infectable = [];
  const rolls = [];
  for (const t of tokensWithinRadius(tokenDoc, MIASMA_RADIUS_M, { includeHidden: true })) {
    const victim = t.actor;
    if (!victim || isNurgleDevoted(victim) || isDeceased(victim) || victim.type === "vehicle") continue;
    if (victim.system?.sealedFullSuit) {
      lines.push(`<div>${esc(victim.name)}: герметичный комплект — миазмы бессильны</div>`);
      continue;
    }
    const dmg = await new Roll(MIASMA_DAMAGE).evaluate();
    rolls.push(dmg);
    const before = Number(victim.system?.wounds?.value);
    await applyDamageToActor(victim, {
      rawDamage: dmg.total, penetration: 0, damageType: "chemical", damageSubtype: "toxic", ignoreArmour: true,
      hitLocation: "Торс", melee: false, attackerName: actor.name, attackerUuid: actor.uuid, weaponName: MIASMA_WEAPON_NAME
    });
    const lost = Number.isFinite(before) && Number(victim.system?.wounds?.value) < before;
    let note = `${dmg.total} C(Tx)`;
    if (lost) {
      await toxicEffect(victim, "Заразные Миазмы: Toxic (0)");
      note += ", непоглощённый урон — Toxic(0)";
      if (isEnemyDisposition(tokenDoc.disposition, t.disposition)) infectable.push(victim.uuid);
    }
    lines.push(`<div>${esc(victim.name)}: ${note}</div>`);
  }
  const { state: next, last } = miasmaTick(state, infectable);
  await postTestCard(actor, {
    icon: ICON(), title: `Заразные Миазмы — ${esc(actor.name)} (осталось Ходов: ${next.left})`,
    lines: lines.length ? lines : [`<div><i>Никого в радиусе ${MIASMA_RADIUS_M} м</i></div>`]
  }, { sound: false, rolls });
  if (last) {
    await actor.unsetFlag(NS, MIASMA_FLAG);
    await finishMiasma(actor, next.victims);
  } else {
    await actor.setFlag(NS, MIASMA_FLAG, next);
  }
}

async function finishMiasma(actor, victimUuids) {
  const victims = [];
  for (const uuid of victimUuids) {
    const v = await actorOfUuid(uuid);
    if (v && !isDeceased(v)) victims.push(v);
  }
  await postTestCard(actor, {
    icon: ICON(), title: `Миазмы рассеялись — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Выжившие враги, получившие урон: ${victims.length ? victims.map(v => esc(v.name)).join(", ") : "нет"}. Тест T+0 против заражения.</div>`]
  }, { sound: false });
  await infectVictims(actor, victims, "Заразные Миазмы");
}

export async function recordInfectionDue(victim, carrierUuid, via) {
  const combat = combatOfActor(victim);
  if (!combat || !carrierUuid) return false;
  const next = infectionDueAdd(victim.getFlag(NS, INFECTION_DUE_FLAG), { combatId: combat.id, carrierUuid, via });
  await victim.setFlag(NS, INFECTION_DUE_FLAG, next);
  return true;
}

export async function bileSpitPenBonus(actor, item) {
  if (!isBileSpitWeapon(item) || !hasBileSpit(actor)) return { pen: 0 };
  const roll = await new Roll(BILE_SPIT_PEN_DICE).evaluate();
  return { pen: roll.total };
}

export async function plagueMarineOnDamage(victim, damageData, netDamage) {
  if (!victim || !(Number(netDamage) > 0)) return "";
  const notes = [];
  const attackerUuid = damageData?.attackerUuid || "";
  const weaponName = damageData?.weaponName || "";
  const marked = isBileSpitWeapon(weaponName) || weaponName === BLESSED_WEAPON_NAME;
  const attacker = marked && attackerUuid ? await actorOfUuid(attackerUuid) : null;
  if (attacker && attacker.uuid !== victim.uuid && !isDeceased(victim)) {
    let via = "";
    if (hasBileSpit(attacker) && isBileSpitWeapon(weaponName)) via = "Жёлчный Плевок";
    else if (hasBlessedWithPus(attacker) && weaponName === BLESSED_WEAPON_NAME) via = "Благословенный Гноем";
    if (via && !isNurgleDevoted(victim) && await recordInfectionDue(victim, attacker.uuid, via)) {
      notes.push(`<div class="dmg-tb-note">${ICON()} ${esc(via)}: в конце боя ${esc(victim.name)} — тест T+0 или заражение болезнью ${esc(attacker.name)}.</div>`);
    }
  }
  if (hasWalkingWasteland(victim) && combatOfActor(victim) && !victim.getFlag(NS, WASTELAND_REQUEST_FLAG)) {
    await victim.setFlag(NS, WASTELAND_REQUEST_FLAG, { at: Date.now() });
    notes.push(`<div class="dmg-tb-note">${ICON()} Ходячая Пустошь: поле боя вокруг ${esc(victim.name)} заражается.</div>`);
  }
  return notes.join("");
}

export async function resolvePlagueMarineCombatEnd(combat) {
  if (!combat) return;
  const activeGM = globalThis.game?.users?.activeGM;
  if (activeGM && !activeGM.isSelf) return;
  const victims = [];
  for (const combatant of combat.combatants ?? []) {
    const actor = combatant.actor;
    if (!actor) continue;
    const miasma = actor.getFlag?.(NS, MIASMA_FLAG);
    if (miasmaActive(miasma, combat.id)) {
      await actor.unsetFlag(NS, MIASMA_FLAG);
      await finishMiasma(actor, miasma.victims ?? []);
    }
    const due = actor.getFlag?.(NS, INFECTION_DUE_FLAG);
    if (due && due.combatId === combat.id) {
      victims.push({ victim: actor, entries: due.entries ?? [] });
    }
    if (due) await actor.unsetFlag(NS, INFECTION_DUE_FLAG);
    for (const key of [MIASMA_FLAG, MIASMA_USED_FLAG, ABOMINABLE_FLAG]) {
      if (actor.getFlag?.(NS, key) != null) await actor.unsetFlag(NS, key);
    }
  }
  for (const [carrierUuid, list] of infectionGroups(victims)) {
    const carrier = await actorOfUuid(carrierUuid);
    if (!carrier) continue;
    const byVia = new Map();
    for (const { victim, via } of list) {
      if (!byVia.has(via)) byVia.set(via, []);
      byVia.get(via).push(victim);
    }
    for (const [via, group] of byVia) await infectVictims(carrier, group, via);
  }
}

export async function blessedTouch(actor) {
  if (!hasBlessedWithPus(actor)) return false;
  const victim = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  if (!victim) { ui.notifications?.warn("Наведите таргет (T) на того, кто коснулся голой кожей."); return false; }
  if (isNurgleDevoted(victim)) { ui.notifications?.info(`${victim.name} под покровительством Нургла — гной ему не вредит.`); return false; }
  const dmg = await new Roll(BLESSED_TOUCH_DAMAGE).evaluate();
  const wasBefore = Number(victim.system?.wounds?.value);
  const dealt = await dealDamageToTarget(victim, {
    rawDamage: dmg.total, penetration: 0, damageType: "chemical", damageSubtype: "toxic", hitLocation: "Торс",
    melee: true, attackerName: actor.name, attackerUuid: actor.uuid, weaponName: BLESSED_WEAPON_NAME
  }, actor, "contact");
  if (dealt && game.user?.isGM && Number.isFinite(wasBefore) && Number(victim.system?.wounds?.value) < wasBefore) {
    await toxicEffect(victim, "Благословенный Гноем: Toxic (0)");
  }
  await postTestCard(actor, {
    icon: ICON(), title: `Благословенный Гноем — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">${esc(victim.name)} коснулся(ась) голой кожи: <b>${dmg.total}</b> (${BLESSED_TOUCH_DAMAGE}) C Toxic(0)${dealt ? "" : " — применить некому (нет ГМа)"}.</div>`]
  }, { sound: false, rolls: [dmg] });
  return dealt;
}

export async function startWasteland(actor) {
  if (!hasWalkingWasteland(actor)) return false;
  const token = tokenOfActor(actor);
  if (!token?.parent) { ui.notifications?.warn("Ходячей Пустоши нужен токен на сцене."); return false; }
  const ok = await confirm("Ходячая Пустошь",
    `${esc(actor.name)} нанесёт себе ${WASTELAND_SELF_DAMAGE} непоглощаемого R урона, чтобы намеренно заразить местность вокруг (до 1 гектара, держится не меньше 7 дней).`,
    "Заразить", "Отмена");
  if (!ok) return false;
  await applyWoundLoss(actor, WASTELAND_SELF_DAMAGE);
  await actor.setFlag(NS, WASTELAND_REQUEST_FLAG, { at: Date.now(), voluntary: true });
  return true;
}

export function wastelandZonesOf(scene, carrierUuid) {
  return [...(scene?.regions ?? [])].filter(r =>
    [...(r.behaviors ?? [])].some(b => b.type === "wastelandZone" && b.system?.carrierUuid === carrierUuid));
}

function tokenOfActor(actor) {
  const own = actor?.getActiveTokens?.(false, true)?.[0];
  if (own) return own;
  const scenes = [globalThis.game?.combat?.scene, ...(globalThis.game?.scenes ?? [])].filter(Boolean);
  for (const sc of scenes) {
    const found = [...(sc.tokens?.contents ?? sc.tokens ?? [])].find(t => t.actor && (t.actor.uuid === actor.uuid || (!t.actor.isToken && t.actorId === actor.id)));
    if (found) return found;
  }
  return null;
}

export async function processWastelandRequest(actor) {
  const request = actor?.getFlag?.(NS, WASTELAND_REQUEST_FLAG);
  if (!request) return;
  const token = tokenOfActor(actor);
  const scene = token?.parent;
  if (!scene) {
    ui.notifications?.warn(`Ходячая Пустошь: токен ${actor.name} не найден ни на сцене боя, ни на активной — зона не создана.`);
    await actor.unsetFlag(NS, WASTELAND_REQUEST_FLAG);
    return;
  }
  await actor.unsetFlag(NS, WASTELAND_REQUEST_FLAG);
  const now = Number(game.time?.worldTime) || 0;
  const live = wastelandZonesOf(scene, actor.uuid).filter(r =>
    [...r.behaviors].some(b => b.type === "wastelandZone" && Number(b.system?.expiresAt) > now));
  if (live.length) return;
  const grid = scene.grid;
  const size = Number(grid?.size) || 100;
  const rect = wastelandRect(token.x + (Number(token.width) || 1) * size / 2, token.y + (Number(token.height) || 1) * size / 2,
    size, Number(grid?.distance) || 1);
  const diseases = carrierDiseases(actor);
  const chosen = diseases.length > 1 ? await chooseDisease(actor, diseases) : null;
  await scene.createEmbeddedDocuments("Region", [{
    name: `Заражённая местность — ${actor.name}`,
    color: "#7a9a2a",
    shapes: [{ type: "rectangle", ...rect, rotation: 0, hole: false }],
    behaviors: [{
      name: "Ходячая Пустошь", type: "wastelandZone",
      system: { carrierUuid: actor.uuid, diseaseId: chosen?.id ?? "", expiresAt: now + WASTELAND_SECONDS, tested: {} }
    }]
  }]);
  await postTestCard(actor, {
    icon: ICON(), title: `Ходячая Пустошь — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">${request.voluntary ? "Носитель намеренно заразил" : "Кровь и ошмётки заразили"} поле боя (квадрат 100×100 м): каждый, не посвящённый Нурглу, кто окажется внутри (в том числе уже стоящие) без герметичной брони, — тест T+0 или заражение. Держится 7 дней; убрать зону с карты — когда местность очистили чисткой, кислотой или огнём.</div>`]
  }, { sound: false });
}

export async function onWastelandEnter(system, tokenDoc, regionName) {
  const victim = tokenDoc?.actor;
  if (!victim || isDeceased(victim) || isNurgleDevoted(victim) || victim.type === "vehicle") return;
  const carrier = await actorOfUuid(system.carrierUuid);
  if (!carrier || victim.uuid === carrier.uuid) return;
  const now = Number(game.time?.worldTime) || 0;
  if (!(Number(system.expiresAt) > now)) return;
  if (victim.system?.sealedFullSuit) return;
  const diseases = carrierDiseases(carrier);
  if (!diseases.length) return;
  const disease = diseases.find(d => d.id === system.diseaseId) ?? await randomDisease(diseases);
  await infectOne(victim, disease, regionName || "Заражённая местность");
}

export async function startRotsmith(actor) {
  if (!hasRotsmith(actor)) return false;
  const items = [...actor.items].filter(i => (isInfectableKnife(i) || isSeveredHead(i)) && !i.getFlag(NS, ROTSMITH_FLAG));
  const options = items.map(i => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join("");
  const content = `<div class="wh-wizard-form" style="padding:6px;">
    <div class="atk-dlg-row"><label>Предмет:</label><select name="item">${options}<option value="__head">Отрубленная голова (новая)</option></select></div>
    <div class="roll-threshold">5 минут работы; через 7 часов нож станет чумным ножом, голова — Моровой гранатой.</div></div>`;
  const choice = await foundry.applications.api.DialogV2.wait({
    window: { title: "Кузнец Гнили" }, classes: ["wh-attack-dialog", "warhammer-dbc"], content, rejectClose: false,
    buttons: [
      { action: "go", label: "Заразить", default: true, callback: (_e, button) => button.form.querySelector("[name=item]")?.value },
      { action: "cancel", label: "Отмена", callback: () => null }
    ]
  }).catch(() => null);
  if (!choice) return false;
  let item = actor.items.get(choice);
  if (choice === "__head") {
    [item] = await actor.createEmbeddedDocuments("Item", [{
      name: "Severed Head / Отрубленная голова", type: "gear", img: "icons/svg/skull.svg",
      system: { quantity: 1, weight: 3 }
    }]);
  }
  const result = rotsmithResult(item);
  if (!result) return false;
  const mark = rotsmithMark(game.time?.worldTime ?? 0, result.kind);
  await item.setFlag(NS, ROTSMITH_FLAG, mark);
  await postTestCard(actor, {
    icon: ICON(), title: `Кузнец Гнили — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">«${esc(item.name)}» заражён Гнилью Нургла (5 минут работы). Через 7 часов игрового времени станет ${result.kind === "plagueKnife" ? "чумным ножом" : "Моровой гранатой"}.</div>`]
  }, { sound: false });
  return true;
}

export async function rotsmithClock(actor, { to }) {
  for (const item of [...(actor.items ?? [])]) {
    const mark = item.getFlag?.(NS, ROTSMITH_FLAG);
    if (!rotsmithDue(mark, to)) continue;
    const result = rotsmithResult(item);
    const src = result ? await fromUuid(result.uuid).catch(() => null) : null;
    if (!src) { await item.unsetFlag(NS, ROTSMITH_FLAG); continue; }
    const data = src.toObject();
    delete data._id;
    if (mark.kind === "plagueKnife" && "equipped" in (data.system ?? {})) data.system.equipped = !!item.system?.equipped;
    if ("quantity" in (data.system ?? {})) data.system.quantity = 1;
    await actor.createEmbeddedDocuments("Item", [data]);
    const oldName = item.name;
    const stack = Number(item.system?.quantity) || 1;
    if (stack > 1) {
      await item.update({ "system.quantity": stack - 1 });
      await item.unsetFlag(NS, ROTSMITH_FLAG);
    }
    else await item.delete();
    await postTestCard(actor, {
      icon: ICON(), title: `Кузнец Гнили — ${esc(actor.name)}`,
      lines: [`<div class="roll-threshold">Гниль укоренилась: «${esc(oldName)}» стал ${esc(src.name)}.</div>`]
    }, { sound: false });
  }
}

export async function gloriousRustClock(actor, { from, to }) {
  if (!hasGloriousRust(actor)) return;
  const updates = [];
  const lines = [];
  for (const item of [...(actor.items ?? [])]) {
    if (!rustApplies(item)) continue;
    const mark = item.getFlag?.(NS, RUST_FLAG);
    if (!mark) { updates.push({ _id: item.id, [`flags.${NS}.${RUST_FLAG}`]: { since: Number(from) || 0 } }); continue; }
    const step = rustQuality(item.system.quality, (Number(to) || 0) - (Number(mark.since) || 0));
    if (!step.changed) continue;
    updates.push({ _id: item.id, "system.quality": step.quality });
    lines.push(`<div>${esc(item.name)}: ${step.steps.includes("common>poor") ? "поржавел (Poor.Q) и " : ""}закалился до Good.Q</div>`);
  }
  if (updates.length) await actor.updateEmbeddedDocuments("Item", updates);
  if (lines.length) {
    await postTestCard(actor, { icon: ICON(), title: `Славная Ржавчина — ${esc(actor.name)}`, lines }, { sound: false });
  }
}
