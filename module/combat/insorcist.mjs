// module/combat/insorcist.mjs
// ════════════════════════════════════════════════════════════════════════
//  Инзорцист — кнопки Черт и Талантов (обвязка rules/insorcist-talents.mjs).
//
//   Печать Имени      — ритуал на выделенного демона (W.b + Inf.b Ходов, в бою
//                       считается в начале своего Хода), печать — флаг +
//                       ActiveEffect «T −Inf.b»; освобождение печатей.
//   Инзорцизм         — призыв запечатанного демона подчинённым (Миньоном),
//                       урон в голову от Inf 31+, запрет повторного призыва
//                       после изгнания; режимы Талантов:
//     Демоническое Ополчение — свита до Inf.b, полное действие;
//     Мимолётная Одержимость — демон в оружие в руках на W.b Ходов;
//     Чёрная Рука           — Атака Одержимостью демона через касание.
//   Метка Поработителя — Ненависть демонов: predicates.mjs::hatredTargetsOf;
//                       порог Пси-Чутья — карточкой.
//  Нестабильность у Инзорциста и учёт изгнания — combat/insorcist-warp.mjs.
// ════════════════════════════════════════════════════════════════════════

import {
  SEALS_FLAG, SEAL_RITUAL_FLAG, BLACK_HAND_FLAG, FLEETING_FLAG, SEAL_EFFECT_FLAG, GREATER_INF,
  hasInsorcism, hasNameSeal, hasMarkOfSubjugator, hasBlackHand, hasDaemonicLevy, hasFleetingPossession,
  demonInfOf, sealsOf, sealRitualTurns, sealTPenalty, insorcismHeadDamage, levyMax, summonStaySeconds,
  banishCooldownSeconds, sealBarredRemaining, markDetectionNeed, spanLabel
} from "../rules/insorcist-talents.mjs";
import { isDaemonActor } from "../rules/predicates.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import {
  possessionStep, possessionBarredRemaining, possessionBarKey, POSSESSION_GOAL, POSSESSION_BARRED_FLAG
} from "../rules/possession-attack.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { hasUnnaturalCharacteristic, unnaturalRating, unnaturalDegreeBonus } from "../rules/unnatural-characteristic.mjs";
import { applyWoundLoss } from "../rules/wounds.mjs";
import { expectedPhase } from "../constants/effect-keys.mjs";
import { addFlatDamage } from "../constants/demon-weapon.mjs";
import { defaultSpawnDemonFn } from "../apps/demon-summon.mjs";
import { possessHost } from "../apps/possession-attack.mjs";
import { spendActionPoints, apCostForActionType, isEncounterActive } from "./action-economy.mjs";
import { esc } from "../helpers/utils.mjs";
import { askSelect, askChecks, infoCard, actorsDistance, targetedActors } from "./psyker-elite-common.mjs";

const NS = "warhammer-dbc";
const line = html => `<div class="roll-threshold">${html}</div>`;
const ch = (actor, k, f = "bonus") => Math.max(0, Number(actor?.system?.characteristics?.[k]?.[f]) || 0);
const now = () => Number(globalThis.game?.time?.worldTime) || 0;
/** «Касаясь» — соседняя клетка. */
const TOUCH_M = 2;

const sealLabel = s => `${s.name}${Number(s.inf) ? ` (Inf ${s.inf})` : ""}`;

/** Печать из демона на сцене (W/Inf читаются в момент Запечатывания — Бестиарий игроку закрыт). */
export function sealFromDemon(demon) {
  const { inf, infB } = demonInfOf(demon);
  return {
    id: foundry.utils.randomID(16), name: String(demon?.name ?? "Демон"), inf, infB,
    wp: ch(demon, "wp", "total"), wpb: ch(demon, "wp"), unnatural: unnaturalRating(demon, "wp") || 0,
    bannedUntil: 0, summonedUntil: 0
  };
}

async function writeSeals(actor, seals) {
  await actor.setFlag(NS, SEALS_FLAG, seals);
}

/** Завершить Запечатывание: печать + T −Inf.b эффектом. */
export async function completeSeal(actor, seal) {
  const seals = sealsOf(actor);
  seals.push(seal);
  await writeSeals(actor, seals);
  const pen = sealTPenalty(seal);
  if (pen > 0) {
    const key = "system.characteristics.t.totalFx";
    await actor.createEmbeddedDocuments("ActiveEffect", [{
      name: `Печать Имени: ${seal.name} (T −${pen})`, img: "icons/svg/padlock.svg",
      system: { changes: [{ key, type: "add", value: -pen, phase: expectedPhase(key), priority: 0 }] },
      disabled: false, flags: { [NS]: { [SEAL_EFFECT_FLAG]: seal.id } }
    }]);
  }
  await infoCard(actor, "Печать Имени", [
    line(`Имя <b>${esc(sealLabel(seal))}</b> запечатано в разуме и плоти — его можно призвать Инзорцизмом.`),
    line(pen > 0 ? `Пока печать держится: <b>T −${pen}</b> (эффект на листе).` : "T не снижается (Inf.b демона 0).")
  ], { icon: "🔏" });
}

/** Печать Имени: начать ритуал на выделенного демона или освободить печати. */
export async function useNameSeal(actor) {
  if (!hasNameSeal(actor)) return ui.notifications.warn("⚠️ Нет Черты Печать Имени.");
  const seals = sealsOf(actor);
  const ritual = actor.getFlag(NS, SEAL_RITUAL_FLAG);
  const opts = [{ value: "seal", label: "Запечатать имя выделенного демона" }];
  if (seals.length) opts.push({ value: "release", label: "Освободить печати (ритуал 1 час)" });
  if (ritual) opts.push({ value: "abort", label: `Прервать ритуал (${ritual.seal?.name ?? "?"})` });
  const mode = opts.length > 1 ? await askSelect("Печать Имени", "Что делать", opts) : "seal";
  if (!mode) return;

  if (mode === "abort") {
    await actor.unsetFlag(NS, SEAL_RITUAL_FLAG);
    return infoCard(actor, "Печать Имени", [line(`Ритуал Запечатывания «${esc(ritual.seal?.name ?? "")}» прерван.`)], { icon: "🔏" });
  }
  if (mode === "release") {
    const pick = await askChecks("Освободить печати", seals.map(s => ({ value: s.id, label: sealLabel(s) })),
      { hint: "Ритуал длится 1 час. T восстанавливается." });
    if (!pick?.length) return;
    await writeSeals(actor, seals.filter(s => !pick.includes(s.id)));
    const fx = actor.effects.filter(e => pick.includes(e.getFlag?.(NS, SEAL_EFFECT_FLAG))).map(e => e.id);
    if (fx.length) await actor.deleteEmbeddedDocuments("ActiveEffect", fx);
    const names = seals.filter(s => pick.includes(s.id)).map(s => esc(s.name)).join(", ");
    return infoCard(actor, "Печать Имени", [line(`Ритуал 1 час: печати освобождены — ${names}. T восстановлена.`)], { icon: "🔓" });
  }

  const demon = targetedActors()[0];
  if (!demon) return ui.notifications.warn("⚠️ Выделите демона, чьё Истинное Имя знает Инзорцист.");
  if (!isDaemonActor(demon)) return ui.notifications.warn(`⚠️ ${demon.name} — не демон.`);
  const wp = ch(actor, "wp", "total");
  const dist = actorsDistance(actor, demon);
  if (dist != null && dist > wp) return ui.notifications.warn(`⚠️ Демон дальше W (${wp} м) — ритуал не начать.`);
  const seal = sealFromDemon(demon);
  const turns = sealRitualTurns(ch(actor, "wp"), seal.infB);
  if (!isEncounterActive()) {
    await infoCard(actor, "Печать Имени", [line(`Ритуал Запечатывания: ${turns} Ходов (W.b + Inf.b) литаний на Истинном Языке — вне боя завершён сразу.`)], { icon: "🔏" });
    return completeSeal(actor, seal);
  }
  await actor.setFlag(NS, SEAL_RITUAL_FLAG, { targetUuid: demon.uuid, seal, left: turns });
  await infoCard(actor, "Печать Имени", [
    line(`Начат ритуал Запечатывания <b>${esc(seal.name)}</b>: <b>${turns}</b> Ходов (W.b ${ch(actor, "wp")} + Inf.b ${seal.infB}). Всё это время Инзорцист декламирует литании — <b>только Реакции</b>.`),
    line(`Демон понимает, что происходит, и попытается прервать ритуал или уйти дальше W (${wp} м). Счёт идёт сам в начале каждого Хода Инзорциста.`)
  ], { icon: "🔏" });
}

/** Начало Хода Инзорциста: ритуал Запечатывания и Мимолётная Одержимость. */
export async function processInsorcistTurnStart(actor) {
  if (!actor) return;
  const r = actor.getFlag?.(NS, SEAL_RITUAL_FLAG);
  if (r) {
    const left = (Number(r.left) || 0) - 1;
    if (left > 0) {
      await actor.setFlag(NS, SEAL_RITUAL_FLAG, { ...r, left });
    } else {
      await actor.unsetFlag(NS, SEAL_RITUAL_FLAG);
      const demon = r.targetUuid ? await fromUuid(r.targetUuid).catch(() => null) : null;
      const dist = demon ? actorsDistance(actor, demon) : null;
      const wp = ch(actor, "wp", "total");
      if (!demon || (dist != null && dist > wp)) {
        await infoCard(actor, "Печать Имени", [line(`Ритуал сорван: ${esc(r.seal?.name ?? "демон")} вне радиуса W (${wp} м).`)], { icon: "🔏" });
      } else await completeSeal(actor, r.seal);
    }
  }
  for (const w of actor.items ?? []) {
    const st = w?.type === "weapon" ? w.getFlag?.(NS, FLEETING_FLAG) : null;
    if (!st) continue;
    const t = (Number(st.turns) || 0) - 1;
    if (t > 0) await w.setFlag(NS, FLEETING_FLAG, { ...st, turns: t });
    else await endFleetingPossession(actor, w);
  }
}

/** Отметить изгнание печати: запрет призыва на W.b+Inf.b часов/месяцев. */
export async function markSealBanished(actor, sealId, { severe = false } = {}) {
  const seals = sealsOf(actor);
  const s = seals.find(x => x.id === sealId);
  if (!s) return null;
  const wait = banishCooldownSeconds(ch(actor, "wp"), s, { severe });
  s.bannedUntil = now() + wait;
  s.summonedUntil = 0;
  await writeSeals(actor, seals);
  return { seal: s, wait };
}

/** Снять Мимолётную Одержимость с оружия (демон считается Изгнанным). */
export async function endFleetingPossession(actor, weapon) {
  const st = weapon.getFlag(NS, FLEETING_FLAG);
  if (!st) return;
  const pre = st.pre ?? {};
  await weapon.update({
    "system.weaponProps": pre.props ?? weapon.system.weaponProps,
    "system.damage": pre.damage ?? weapon.system.damage,
    "system.penetration": pre.pen ?? weapon.system.penetration,
    "system.daemonWeapon.bound": false, "system.daemonWeapon.demonName": "", "system.daemonWeapon.demonWb": 0,
    "system.daemonWeapon.demonInf": 0, "system.daemonWeapon.subdued": false,
    [`flags.${NS}.-=${FLEETING_FLAG}`]: null
  });
  const res = await markSealBanished(actor, st.sealId);
  await infoCard(actor, "Мимолётная Одержимость", [
    line(`Демон покидает «${esc(weapon.name)}» — оружие снова обычное.`),
    res ? line(`${esc(res.seal.name)} считается Изгнанным: призвать снова — через ${spanLabel(res.wait)} (W.b + Inf.b часов).`) : ""
  ].filter(Boolean), { icon: "🗡" });
}

async function pickSeal(actor, title, { exclude = [] } = {}) {
  const t = now();
  const seals = sealsOf(actor).filter(s => !exclude.includes(s.id));
  if (!seals.length) { ui.notifications.warn("⚠️ Нет запечатанных имён (Черта Печать Имени)."); return null; }
  const opts = seals.map(s => {
    const wait = sealBarredRemaining(s, t);
    return { value: s.id, label: `${sealLabel(s)}${wait ? ` — изгнан, ещё ${spanLabel(wait)}` : ""}` };
  });
  const id = await askSelect(title, "Демон", opts);
  if (!id) return null;
  const s = seals.find(x => x.id === id);
  const wait = sealBarredRemaining(s, t);
  if (wait > 0) { ui.notifications.warn(`⚠️ ${s.name} изгнан — призыв возможен через ${spanLabel(wait)}.`); return null; }
  return s;
}

async function payAction(actor, type) {
  if (!isEncounterActive()) return true;
  if (await spendActionPoints(actor, apCostForActionType(type), { physical: false })) return true;
  ui.notifications.warn(`⚠️ Не хватает ОД (${type}).`);
  return false;
}

/** Инзорцизм: призыв / оружие / Чёрная Рука / отметка изгнания. */
export async function useInsorcism(actor) {
  if (!hasInsorcism(actor)) return ui.notifications.warn("⚠️ Нет Черты Инзорцизм.");
  const modes = [{ value: "summon", label: "Призвать демона в Истинной Форме (полудействие)" }];
  if (hasFleetingPossession(actor)) modes.push({ value: "weapon", label: "Мимолётная Одержимость: демон в оружие в руках" });
  if (hasBlackHand(actor)) modes.push({ value: "hand", label: "Чёрная Рука: Атака Одержимостью через касание" });
  modes.push({ value: "banished", label: "Отметить: демон изгнан" });
  const mode = await askSelect("Инзорцизм", "Что делать", modes);
  if (!mode) return;
  if (mode === "hand") return useBlackHand(actor);
  if (mode === "banished") return markBanishedDialog(actor);
  if (mode === "weapon") return fleetingIntoWeapon(actor);

  const seal = await pickSeal(actor, "Инзорцизм");
  if (!seal) return;
  // Демоническое Ополчение: сильный демон ведёт свиту — полное действие.
  let retinue = [];
  const lmax = hasDaemonicLevy(actor) ? levyMax(seal) : 0;
  if (lmax > 0) {
    const t = now();
    const others = sealsOf(actor).filter(s => s.id !== seal.id && !sealBarredRemaining(s, t));
    if (others.length) {
      const pick = await askChecks(`Демоническое Ополчение (до ${lmax})`, others.map(s => ({ value: s.id, label: sealLabel(s) })),
        { hint: `Низшие демоны или звери того же Бога. Выбор свиты делает действие полным. Не больше ${lmax} (Inf.b).` });
      if (pick == null) return;
      if (pick.length > lmax) return ui.notifications.warn(`⚠️ Свита не больше ${lmax} (Inf.b ${esc(seal.name)}).`);
      retinue = others.filter(s => pick.includes(s.id));
    }
  }
  if (!(await payAction(actor, retinue.length ? "Полное действие" : "Полудействие"))) return;

  await defaultSpawnDemonFn(seal.name, actor.uuid, { asMinion: true });
  for (const s of retinue) await defaultSpawnDemonFn(s.name, actor.uuid, { asMinion: false });

  const wpb = ch(actor, "wp");
  const until = now() + summonStaySeconds(wpb);
  const seals = sealsOf(actor).map(s => (s.id === seal.id || retinue.some(r => r.id === s.id)) ? { ...s, summonedUntil: until } : s);
  await writeSeals(actor, seals);

  const lines = [
    line(`<b>${esc(seal.name)}</b> призван в Истинной Форме (не дальше W.b ${wpb} м), уже подчинён Владычеству — в панели Миньонов.`),
    line(`Остаётся до <b>${wpb} суток</b> (W.b). Пока не дальше W (${ch(actor, "wp", "total")} м) от Инзорциста — тесты Нестабильности проходит сам.`)
  ];
  if (retinue.length) lines.push(line(`Демоническое Ополчение (полное действие): свита — ${retinue.map(s => esc(s.name)).join(", ")}; подчиняется своему лидеру, не Инзорцисту.`));
  const head = insorcismHeadDamage(seal);
  if (head > 0) {
    const loss = await applyWoundLoss(actor, head);
    lines.push(line(`Душа-якорь: <b>${head}</b> непоглощаемого R-урона в голову (Inf.b демона с Inf ${GREATER_INF}+) — Раны ${loss.currentWounds}→${loss.newWounds}.`));
  }
  await infoCard(actor, "Инзорцизм", lines, { icon: "👁" });
}

async function markBanishedDialog(actor) {
  const seals = sealsOf(actor);
  if (!seals.length) return ui.notifications.warn("⚠️ Нет запечатанных имён.");
  const id = await askSelect("Демон изгнан", "Демон", seals.map(s => ({ value: s.id, label: sealLabel(s) })));
  if (!id) return;
  const how = await askSelect("Демон изгнан", "Как", [
    { value: "plain", label: "Обычное изгнание — W.b + Inf.b часов" },
    { value: "severe", label: "Экзорцизм или выжигание души — W.b + Inf.b месяцев" }
  ]);
  if (!how) return;
  const res = await markSealBanished(actor, id, { severe: how === "severe" });
  if (res) await infoCard(actor, "Инзорцизм", [line(`${esc(res.seal.name)} изгнан: призвать снова — через <b>${spanLabel(res.wait)}</b>.`)], { icon: "👁" });
}

/** Мимолётная Одержимость: общий пакет демонического оружия на W.b Ходов. */
async function fleetingIntoWeapon(actor) {
  const weapons = [...actor.items].filter(i => i.type === "weapon" && i.system?.equipped && !i.system?.daemonWeapon?.bound);
  if (!weapons.length) return ui.notifications.warn("⚠️ Нет оружия в руках (снаряжённого и не демонического).");
  const wid = await askSelect("Мимолётная Одержимость", "Оружие", weapons.map(w => ({ value: w.id, label: w.name })),
    { hint: "Машину, которой касается, вселяют вручную (на листе машины)." });
  if (!wid) return;
  const seal = await pickSeal(actor, "Мимолётная Одержимость");
  if (!seal) return;
  if (!(await payAction(actor, "Полудействие"))) return;
  const w = actor.items.get(wid);
  const props = foundry.utils.deepClone(w.system.weaponProps || []);
  const damage = w.system.damage || "";
  const pen = Number(w.system.penetration) || 0;
  const wb = Number(seal.wpb) || 0;
  const next = props.filter(p => p.key !== "primitive" && p.key !== "sanctified")
    .concat(props.some(p => p.key === "reinforced") ? [] : [{ key: "reinforced" }]);
  const turns = Math.max(1, ch(actor, "wp"));
  await w.update({
    "system.weaponProps": next, "system.damage": addFlatDamage(damage, wb), "system.penetration": pen + wb,
    "system.daemonWeapon.bound": true, "system.daemonWeapon.demonName": seal.name, "system.daemonWeapon.demonWb": wb,
    "system.daemonWeapon.demonInf": Number(seal.inf) || 0, "system.daemonWeapon.subdued": true,
    [`flags.${NS}.${FLEETING_FLAG}`]: { sealId: seal.id, ownerUuid: actor.uuid, turns, pre: { props, damage, pen } }
  });
  await infoCard(actor, "Мимолётная Одержимость", [
    line(`<b>${esc(seal.name)}</b> вселён в «${esc(w.name)}»: +${wb} к Dmg и Pen (W.b демона), Reinforced, без Primitive/Sanctified; игнорирует T.b и иммунитеты Daemonic, не тратит боеприпасы, игнорирует Haywire. Особых демонических свойств нет.`),
    line(`Через <b>${turns}</b> Ходов (W.b Инзорциста, включая этот) демон уйдёт сам — оружие вернётся к прежнему виду, демон считается Изгнанным.`)
  ], { icon: "🗡" });
}

async function rollWillOf(actor) {
  const mods = collectTestMods(actor, { kind: "characteristic", char: "wp" });
  const threshold = ch(actor, "wp", "total") + (Number(mods.total) || 0);
  const roll = await new Roll("1d100").evaluate();
  const o = testOutcome(roll.total, threshold);
  const deg = o.success ? o.deg + unnaturalDegreeBonus(unnaturalRating(actor, "wp")) : o.deg;
  return { roll, threshold, success: o.success, deg, unnatural: hasUnnaturalCharacteristic(actor, "wp") };
}

async function rollWillOfSeal(seal) {
  const threshold = Number(seal.wp) || 0;
  const roll = await new Roll("1d100").evaluate();
  const o = testOutcome(roll.total, threshold);
  const deg = o.success ? o.deg + unnaturalDegreeBonus(Number(seal.unnatural) || 0) : o.deg;
  return { roll, threshold, success: o.success, deg, unnatural: (Number(seal.unnatural) || 0) > 0 };
}

/** Чёрная Рука: один Ход Атаки Одержимостью демона по тому, кого касается Инзорцист. */
export async function useBlackHand(actor) {
  if (!hasBlackHand(actor)) return ui.notifications.warn("⚠️ Нет Таланта Чёрная Рука.");
  const target = targetedActors()[0];
  const st = actor.getFlag(NS, BLACK_HAND_FLAG);
  if (!target) return ui.notifications.warn("⚠️ Выделите того, кого касается Инзорцист.");
  const dist = actorsDistance(actor, target);
  if (dist != null && dist > TOUCH_M) {
    if (st?.targetUuid === target.uuid) {
      await actor.unsetFlag(NS, BLACK_HAND_FLAG);
      return infoCard(actor, "Чёрная Рука", [line(`${esc(target.name)} разорвал контакт с рукой — Атака Одержимостью прекращена.`)], { icon: "✋" });
    }
    return ui.notifications.warn("⚠️ Нужно касание (соседняя клетка).");
  }
  if (hasRuleFlag(target, "possession.immune")) return ui.notifications.warn(`⚠️ ${target.name} не может быть одержим.`);
  const t = now();
  const barred = possessionBarredRemaining(actor.getFlag(NS, POSSESSION_BARRED_FLAG), target.uuid, t);
  if (barred > 0) return ui.notifications.warn(`⚠️ ${target.name} уже отбросил демона — снова через ${Math.ceil(barred / 3600)} ч.`);

  let seal = null, tally = 0;
  if (st?.targetUuid === target.uuid) {
    seal = sealsOf(actor).find(s => s.id === st.sealId) ?? null;
    tally = Number(st.tally) || 0;
  }
  if (!seal) {
    seal = await pickSeal(actor, "Чёрная Рука");
    if (!seal) return;
    if (!(await payAction(actor, "Полудействие"))) return;
    tally = 0;
  }
  const mine = await rollWillOfSeal(seal);
  const theirs = await rollWillOf(target);
  const step = possessionStep(tally, mine, theirs);
  const side = (n, r) => `W (${esc(n)}): <b>${r.threshold}</b> → бросок <b>${r.roll.total}</b> — ${r.success ? "Успех" : "Провал"} ${r.deg}`;
  const lines = [line(side(seal.name, mine)), line(side(target.name, theirs)),
    line(`Счёт: ${tally} ${step.delta >= 0 ? "+" : "−"} ${Math.abs(step.delta)} = <b>${step.tally}</b> (нужно ±${POSSESSION_GOAL})`)];
  if (step.outcome === "possessed") {
    await actor.unsetFlag(NS, BLACK_HAND_FLAG);
    try {
      const bonus = await possessHost(target, { uuid: actor.uuid, name: `${seal.name} (${actor.name})` });
      lines.push(line(`<span class="roll-success">${esc(seal.name)} вселяется в ${esc(target.name)}!</span> Демонхост подчиняется Инзорцисту как подчинённый демон: +10 S, +10 T, +${bonus} Ран.`));
    } catch (e) {
      console.warn("warhammer-dbc | Чёрная Рука: вселение", e);
      lines.push(line(`<span class="roll-success">${esc(seal.name)} вселяется в ${esc(target.name)}!</span> Применить вселение не удалось (нет прав на цель) — ГМ: контроль Инзорцисту, +10 S/T, +1d10+3 Ран.`));
    }
  } else if (step.outcome === "repelled") {
    await actor.unsetFlag(NS, BLACK_HAND_FLAG);
    await actor.setFlag(NS, POSSESSION_BARRED_FLAG, { ...(actor.getFlag(NS, POSSESSION_BARRED_FLAG) ?? {}), [possessionBarKey(target.uuid)]: t });
    lines.push(line(`<span class="roll-failure">${esc(target.name)} отбрасывает демона</span> — новая попытка против него через 24 ч.`));
  } else {
    await actor.setFlag(NS, BLACK_HAND_FLAG, { targetUuid: target.uuid, sealId: seal.id, tally: step.tally });
    lines.push(line("Борьба продолжается — нажать снова в конце следующего Хода, пока рука касается жертвы."));
  }
  await infoCard(actor, `Чёрная Рука → ${target.name}`, lines, { icon: "✋", rolls: [mine.roll, theirs.roll] });
  return step;
}

/** Метка Поработителя: карточка с порогом Пси-Чутья. */
export async function useMarkOfSubjugator(actor) {
  if (!hasMarkOfSubjugator(actor)) return ui.notifications.warn("⚠️ Нет Черты Метка Поработителя.");
  const need = markDetectionNeed(sealsOf(actor));
  await infoCard(actor, "Метка Поработителя", [
    line("Демоны узнают в нём поработителя с первого взгляда; их Ненависть к нему учитывается сама (+10 в рукопашной по нему, перебросы социальных тестов и Морали)."),
    line(need ? `Псайкер засечёт Метку Пси-Чутьём при <b>${need}</b>+ Успехах (по сильнейшей печати).` : "Печать демона Inf 71+: любой псайкер рядом засекает Метку <b>автоматически</b>.")
  ], { icon: "⛓" });
}

export const INSORCIST_API = { useNameSeal, useInsorcism, useBlackHand, useMarkOfSubjugator };
