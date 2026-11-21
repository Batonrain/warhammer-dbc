// module/combat/raven.mjs
// Ворон — Foundry-сторона rules/raven-talents.mjs: пул Клинков Судьбы по
// Ходам, Стойки Обмана, кнопки встречного WS (Пропустить, Перенаправить
// Удар), «заставить перебросить» за Очко и Подножка после приёма.

import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { gainResource } from "../apps/resource-pools.mjs";
import { resourcePoolValue } from "../rules/resource-pools.mjs";
import { actorHasInfamyPoint, actorInfamyPath, spendFromInfamyPool } from "../apps/infamy-points.mjs";
import { isThrottleReady, markThrottleUsed } from "../rules/cooldown.mjs";
import { sizeOf } from "../rules/predicates.mjs";
import {
  BLADES_POOL, RAVEN_STANCE_FLAG, RAVEN_STANCES, PASS_BY_COST,
  hasBladesOfFate, hasFlowReader, hasStancesOfDeceit, hasHiddenPatterns, hasAcupuncture,
  hasPassBy, hasRedirectBlow, maxRavenStances, ravenStancesOf, tripApplies
} from "../rules/raven-talents.mjs";
import { firstTargetActor, opposedTestCard, wsSide } from "./duelist-tests.mjs";

const NS = "warhammer-dbc";
const card = (actor, icon, title, lines) => postTestCard(actor, {
  icon, title: `${title} — ${esc(actor.name)}`,
  lines: lines.filter(Boolean).map(l => `<div class="roll-threshold">${l}</div>`)
}, { sound: false });

// ── Клинки Судьбы ──────────────────────────────────────────────────────────

/** Начало Хода в бою: +1 бонусное Очко (Чтец Течения — +2) в пул, не выше I.b. */
export async function processBladesOfFateTurnStart(actor) {
  if (!actor || !hasBladesOfFate(actor)) return;
  await gainResource(actor, BLADES_POOL, null,
    { label: hasFlowReader(actor) ? "Клинки Судьбы + Чтец Течения: начало Хода" : "Клинки Судьбы: начало Хода" });
}

/** Конец боя: бонусные Очки боя сгорают (Клинки Судьбы, Отец Крови). */
export async function clearBattlePools(combat, keys = [BLADES_POOL, "bloodFather"]) {
  for (const c of combat?.combatants ?? []) {
    const a = c.actor;
    if (!a) continue;
    const upd = {};
    for (const k of keys) if ((Number(a.system?.resourcePools?.[k]) || 0) > 0) upd[`system.resourcePools.${k}`] = 0;
    if (Object.keys(upd).length) await a.update(upd);
  }
}

/** Клинки Судьбы: Очко Бесчестия — враг перебрасывает успешную рукопашную атаку по Ворону. */
export async function forceEnemyMeleeReroll(actor) {
  if (!actor || !hasBladesOfFate(actor)) return ui.notifications.warn("⚠️ У актора нет Черты Клинки Судьбы.");
  if (!actorHasInfamyPoint(actor)) return ui.notifications.warn("⚠️ Нет Очка Бесчестия.");
  const path = actorInfamyPath(actor);
  const spend = await spendFromInfamyPool(actor, 1, path);
  if (!spend) return;
  if (spend.poolSpent) await actor.update({ [path]: spend.poolValue });
  const paid = spend.resourceSpent ? `${spend.resourceSpent.label} (осталось ${spend.resourceSpent.after})` : "Очко Бесчестия";
  await card(actor, "🪶", "Клинки Судьбы: переброс врагу", [
    `Потрачено: ${esc(paid)}. Атакующий перебрасывает успешную рукопашную атаку по ${esc(actor.name)} — ГМ: «Переброс» в меню карточки атаки, второе Очко не нужно, остаётся новый результат.`
  ]);
}

// ── Стойки Обмана ──────────────────────────────────────────────────────────

/** Сменить Стойку (с Акупунктурой — до двух сразу). */
export async function chooseRavenStance(actor) {
  if (!actor || !hasStancesOfDeceit(actor)) return ui.notifications.warn("⚠️ У актора нет Черты Стойки Обмана.");
  const max = maxRavenStances(actor);
  const cur = ravenStancesOf(actor);
  const rows = Object.entries(RAVEN_STANCES).map(([k, s]) =>
    `<label style="display:block;margin:3px 6px;"><input type="checkbox" name="st" value="${k}" ${cur.includes(k) ? "checked" : ""}/> <b>${esc(s.label)}</b> — <span style="font-size:0.85em;">${esc(s.text)}</span></label>`).join("");
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: "Стойки Обмана" },
    classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="margin:4px 6px;">Выберите ${max > 1 ? "до двух Стоек (Акупунктура)" : "Стойку"}. Пусто — без Стойки.</p>${rows}`,
    rejectClose: false,
    buttons: [{ action: "ok", label: "Принять", default: true,
      callback: (ev, btn) => [...btn.form.querySelectorAll("input[name=st]:checked")].map(i => i.value) }]
  });
  if (!Array.isArray(picked)) return;
  if (picked.length > max) return ui.notifications.warn(`⚠️ Одновременно — не больше ${max}.`);
  await actor.setFlag(NS, RAVEN_STANCE_FLAG, picked);
  await card(actor, "🪶", "Стойки Обмана", [
    picked.length ? picked.map(k => `<b>${esc(RAVEN_STANCES[k].label)}</b>: ${esc(RAVEN_STANCES[k].text)}`).join("<br>") : "Без Стойки.",
    hasAcupuncture(actor) ? "Акупунктура: смена Стойки — полудействие, даже после атаки в этот Ход; две Стойки сразу, пока не сменит." : "",
    hasHiddenPatterns(actor) ? "Скрытые Узоры: пси-чутьё и прочие тесты, засекающие энергии Варпа, замечают работу Стойки только Критическим Успехом." : ""
  ]);
}

// ── Встречный WS ───────────────────────────────────────────────────────────

/** Пропустить: после Избегания на 5+ Успехов — 4 Успеха и WS vs WS с атакующим (в цели). */
export async function usePassBy(actor) {
  if (!actor || !hasPassBy(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Пропустить.");
  const target = firstTargetActor();
  if (!target) return ui.notifications.warn("⚠️ Наведите цель — атакующего, от которого только что ушли.");
  const me = wsSide(actor), them = wsSide(target);
  await opposedTestCard(actor, target, {
    icon: "🪶", title: "Пропустить",
    mine: { label: me.label, base: me.value, ctx: me.ctx }, theirs: { label: them.label, base: them.value, ctx: them.ctx },
    lines: r => [`Цена: ${PASS_BY_COST} Успеха из Избегания на 5+.`, r.winner === "mine"
      ? `${esc(target.name)} проходит сквозь ${esc(actor.name)} на противоположную сторону, остаётся к нему спиной и немедленно заканчивает свой Ход — сдвиньте токен.`
      : "Атакующий не поддался."]
  });
}

// Ключ отметки «раз в Раунд». Не «const flag = …»: tools/capability-reachability.mjs
// разворачивает одноимённые константы в цели grantFlag (sources.mjs → for (const flag of …)).
const REDIRECT_THROTTLE = "raven.redirectBlow";

/** Перенаправить Удар: раз в Раунд промах по Ворону — WS vs WS с другим врагом в схватке; Успех — попадание по нему с 1 Успехом. */
export async function useRedirectBlow(actor) {
  if (!actor || !hasRedirectBlow(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Перенаправить Удар.");
  if (!isThrottleReady(actor, REDIRECT_THROTTLE, "round")) return ui.notifications.warn("⚠️ Перенаправить Удар — раз в Раунд, уже было.");
  const target = firstTargetActor();
  if (!target) return ui.notifications.warn("⚠️ Наведите цель — другого врага в этой схватке (не самого атакующего).");
  await markThrottleUsed(actor, REDIRECT_THROTTLE, "round");
  const me = wsSide(actor), them = wsSide(target);
  await opposedTestCard(actor, target, {
    icon: "🪶", title: "Перенаправить Удар",
    mine: { label: me.label, base: me.value, ctx: me.ctx }, theirs: { label: them.label, base: them.value, ctx: them.ctx },
    lines: r => ["Условие: у врагов нет численного превосходства в этой схватке.", r.winner === "mine"
      ? `Промах считается попаданием по ${esc(target.name)} с 1 Успехом — ГМ бросает урон оружием атакующего по нему.`
      : "Промах остаётся промахом."]
  });
}

/** Подножка: после победы во встречном WS-приёме на 5+ — цель Размером до 1 Ничком. */
export async function tripAfterContest(actor, target, { side, margin } = {}) {
  if (!actor || !target || !tripApplies(actor, { side, margin, targetSize: sizeOf(target) })) return false;
  if (target.system?.conditions?.prone) return false;
  const { statusApplyFields } = await import("./status-resist.mjs");
  const { writeToTarget } = await import("./gm-relay.mjs");
  const { fields, resisted, note } = await statusApplyFields(target, "prone", null, { attacker: actor, melee: true, source: "Подножка" });
  if (Object.keys(fields).length) await writeToTarget(target, { kind: "update", data: fields }, actor);
  await card(actor, "🪶", "Подножка", [resisted ? esc(note) : `Перевес ${margin} во встречном WS — ${esc(target.name)} сбит(а) с ног (Ничком).`]);
  return true;
}

/** Для листа: сколько бонусных Очков Клинков Судьбы сейчас. */
export const bladesOfFateLeft = actor => resourcePoolValue(actor, BLADES_POOL);
