// module/combat/dreadnought-talents.mjs
// Таланты Дредноутов вокруг Тарана (Книга Машин):
//  Bastion / Бастион — «Подвергшись Тарану, может пройти тест Parry+0 со штрафом
//  −10 за каждый Размер таранящей машины выше своего: при Успехе не получает
//  урона и не отбрасывается, на 3+ Успеха немедленно проводит по таранящей
//  машине рукопашную атаку одним орудием». Кнопка — на карточке Тарана
//  (combat/vehicle.mjs::_resolveRam), рядом с Виражом и Пируэтом.

import { esc, _degWord } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { hasItemNamed } from "../rules/req-atom.mjs";

/** Штраф Бастиона: −10 за каждый Размер таранящей машины выше своего. */
export function bastionMod(walkerSize, rammerSize) {
  return -10 * Math.max(0, (Number(rammerSize) || 0) - (Number(walkerSize) || 0));
}

/** Итог Бастиона по Степеням: 0 — провал, 1 — без урона, 2 — ещё и ответная атака. */
export function bastionResult(success, deg) {
  if (!success) return 0;
  return deg >= 3 ? 2 : 1;
}

/** Клик «Бастион»: walker — выбранный токен Дредноута, rammer — таранящая машина. */
export async function resolveBastion(walker, rammer) {
  const { walkerCrew, walkerMeleeWeapon } = await import("./walker.mjs");
  const { isWalkerVehicle } = await import("../rules/walker.mjs");
  if (!isWalkerVehicle(walker)) { ui.notifications.warn("⚠️ Бастион — только у Шагохода."); return false; }
  const crew = await walkerCrew(walker);
  const pilot = crew?.actor;
  if (!pilot || !hasItemNamed(pilot, "Bastion", ["talent"])) {
    ui.notifications.warn("⚠️ У пилота нет Таланта Бастион."); return false;
  }
  const weapon = walkerMeleeWeapon(walker);
  if (!weapon) { ui.notifications.warn("⚠️ У машины нет рукопашного орудия — Парировать нечем."); return false; }
  const { parryProfile } = await import("./defense.mjs");
  const { spendReaction, hasActionEconomy } = await import("./action-economy.mjs");
  const mod = bastionMod(walker.system?.size, rammer?.system?.size);
  const { wsTotal, threshold, modParts } = parryProfile(pilot, mod, weapon, { useCrossblock: false });
  if (hasActionEconomy(pilot) && !(await spendReaction(pilot, { forDefense: true }))) {
    ui.notifications.warn(`⚠️ ${pilot.name}: не хватает Реакции.`); return false;
  }
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  const res = bastionResult(success, deg);
  const parts = modParts.filter(p => !String(p).startsWith("приём "));
  if (mod) parts.push(`Размер тарана ${mod}`);
  let text = "Таран проходит как обычно.";
  if (res >= 1) text = `${esc(walker.name)} не получает урона от Тарана и не отбрасывается — урон с карточки Тарана не применяйте.`;
  if (res === 2) {
    text += ` 3+ Успеха: немедленная рукопашная атака одним орудием по ${esc(rammer?.name ?? "таранящей машине")} — машина взята в цель.`;
    const token = rammer?.getActiveTokens?.()?.[0] ?? null;
    if (token && canvas?.ready) token.setTarget(true, { user: game.user, releaseOthers: true });
  }
  await postTestCard(walker, {
    icon: rollIcon("sword"), title: `Бастион — ${esc(walker.name)}`,
    threshold: rollStatLine({ label: `Parry ${pilot.name}`, base: wsTotal, parts, threshold, rv: roll.total }),
    outcome: outcomeHtml(success, `${success ? "Успех" : "Провал"} — ${deg} ${_degWord(deg)}`),
    lines: [`<div class="roll-threshold">${text}</div>`]
  }, { rolls: [roll] });
  return true;
}

// ── Мантия Пепла ────────────────────────────────────────────────────────────
// «Может использовать орудия со свойством Spray, даже будучи связанным в
// рукопашной, и вместо обычного шаблона нанести попадание этим орудием по всем
// существам в пределах 2 м от себя (они всё ещё могут отменить попадание тестом
// A+0)». Запрета стрелять из связанности в системе нет — работать нечему; кольцо
// 2 м — кнопка на карточке атаки, отмечающая целями всех в 2 м.

export const ASH_MANTLE_RADIUS = 2;

/** Сам актор и, если это машина, её пилот — Таланты Дредноута живут на пилоте. */
export function selfAndPilot(actor, resolveUuid = u => globalThis.fromUuidSync?.(u) ?? null) {
  if (!actor) return [];
  if (actor.type !== "vehicle") return [actor];
  const station = (actor.system?.stations || []).find(s => String(s?.role ?? "").toLowerCase() === "pilot" && s?.uuid);
  const pilot = station ? resolveUuid(station.uuid) : null;
  return pilot ? [actor, pilot.actor ?? pilot] : [actor];
}

/** Носитель Мантии: сам актор или пилот Дредноута, из чьего орудия стреляют. */
export function ashMantleActive(actor, resolveUuid) {
  return selfAndPilot(actor, resolveUuid).some(a => hasItemNamed(a, "Ash Mantle", ["talent"]));
}

/** Строка заметки карточки атаки с кнопкой «все в 2 м». */
export function ashMantleNote(actor) {
  return `🔥 Мантия Пепла: вместо конуса можно накрыть всех в ${ASH_MANTLE_RADIUS} м от себя — у каждого остаётся тест отмены A+0. <button type="button" class="wh-ash-mantle-btn" data-attacker-uuid="${esc(actor?.uuid ?? "")}">Цели: все в ${ASH_MANTLE_RADIUS} м</button>`;
}

/** Клик: целями становятся все токены (кроме своего) в 2 м от стрелка. */
export async function targetAshMantleRing(attackerUuid) {
  const doc = attackerUuid ? await fromUuid(attackerUuid).catch(() => null) : null;
  const actor = doc?.actor ?? doc;
  const self = actor?.getActiveTokens?.()?.[0] ?? null;
  if (!self || !canvas?.ready) { ui.notifications.warn("⚠️ Токен стрелка на сцене не найден."); return false; }
  const { tokenDistance } = await import("./facing.mjs");
  const near = canvas.tokens.placeables.filter(t => t !== self && t.actor && tokenDistance(self, t) <= ASH_MANTLE_RADIUS);
  game.user.targets.forEach(t => t.setTarget(false, { user: game.user, releaseOthers: false }));
  near.forEach((t, i) => t.setTarget(true, { user: game.user, releaseOthers: i === 0 }));
  ui.notifications.info(`🔥 Мантия Пепла: целей в ${ASH_MANTLE_RADIUS} м — ${near.length}. Примените урон «Всем», каждая может пройти тест отмены.`);
  return true;
}

// ── Пригоршня Грома ─────────────────────────────────────────────────────────
// «Попав по цели рукопашным орудием, может немедленно атаковать встроенным в
// него орудием ту же цель или другую в базовом контакте с ним и изначальной
// целью, если ещё не стрелял из этого орудия в этот Ход. При стрельбе в ту же
// цель она не может Избегать от второй атаки». Связи «кулак → встроенное» в
// данных нет: кнопка на карточке попадания помечает стрелка, следующая его
// дальнобойная атака по той же цели в этом Ходу идёт без Избеганий
// (combat/attack.mjs, тот же порог −999, что у Финта).

export const FISTFUL_FLAG = "fistfulOfThunder";

export function fistfulActive(actor, resolveUuid) {
  return selfAndPilot(actor, resolveUuid).some(a => hasItemNamed(a, "Fistful of Thunder", ["talent"]));
}

const turnKey = combat => combat?.id ? { combatId: combat.id, round: combat.round ?? 0, turn: combat.turn ?? 0 } : null;

/** Действует ли метка против этой цели сейчас (вне боя — пока не израсходована). */
export function fistfulBlocks(attacker, defender, combat) {
  const f = attacker?.getFlag?.("warhammer-dbc", FISTFUL_FLAG);
  if (!f || !defender || f.targetUuid !== defender.uuid) return false;
  const k = turnKey(combat);
  if (!k || !f.combatId) return !k && !f.combatId;
  return f.combatId === k.combatId && f.round === k.round && f.turn === k.turn;
}

/** Строка заметки карточки рукопашной атаки. */
export function fistfulNote(actor, target) {
  if (!target) return "";
  return `👊 Пригоршня Грома: немедленный выстрел встроенным орудием (если оно ещё не стреляло в этот Ход) — по той же цели без Избеганий. <button type="button" class="wh-fistful-btn" data-attacker-uuid="${esc(actor?.uuid ?? "")}" data-target-uuid="${esc(target.uuid ?? "")}">Стрелять встроенным</button>`;
}

/** Клик: метка на стрелке (до конца Хода) и цель взята под прицел. */
export async function markFistful(attackerUuid, targetUuid) {
  const doc = attackerUuid ? await fromUuid(attackerUuid).catch(() => null) : null;
  const actor = doc?.actor ?? doc;
  if (!actor?.isOwner) { ui.notifications.warn("⚠️ Нет прав на атакующего."); return false; }
  const tdoc = targetUuid ? await fromUuid(targetUuid).catch(() => null) : null;
  const target = tdoc?.actor ?? tdoc;
  const k = turnKey(game.combat?.started ? game.combat : null) ?? {};
  await actor.setFlag("warhammer-dbc", FISTFUL_FLAG, { targetUuid: target?.uuid ?? "", ...k });
  const token = target?.getActiveTokens?.()?.[0] ?? null;
  if (token && canvas?.ready) token.setTarget(true, { user: game.user, releaseOthers: true });
  ui.notifications.info(`👊 Пригоршня Грома: стреляйте встроенным орудием — по ${target?.name ?? "той же цели"} без Избеганий.`);
  return true;
}
