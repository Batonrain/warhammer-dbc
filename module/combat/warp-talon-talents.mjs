// module/combat/warp-talon-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Кнопки Черт и Талантов Когтя Варпа (правила — rules/warp-talon-talents.mjs).
//  Разрыватель Завесы — вход/выход из Варпа (активация до конца боя/сцены),
//  Варп Вспышка на входе и выходе, Разлом, Со Скоростью Мысли, Варп-След.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { hasItemNamed } from "../rules/req-atom.mjs";
import { changeActorInfamy, actorInfamyValue } from "../apps/infamy-points.mjs";
import { spendResource } from "../apps/resource-pools.mjs";
import { resourcePoolValue } from "../rules/resource-pools.mjs";
import { activateItemUntil, deactivateItem } from "../apps/item-activation.mjs";
import { activationState } from "../rules/item-activation.mjs";
import { canSpendActionPoints } from "./action-economy.mjs";
import {
  VULTURE_POOL, corBonus, veilRenderItem, inWarp, riftDice, riftSummons, riftHits,
  warpTrailMod, psyRatingOf, veilRenderPayOptions
} from "../rules/warp-talon-talents.mjs";
import {
  chooseOne, infoCard, payActions, rollSkillCard, targetedActors, tokensAround, setTargets, applyDamageButton
} from "./astartes-elite-ui.mjs";

/**
 * Цена разрыва Завесы: полудействие + Очко Бесчестия или очко Стервятника.
 * @returns {Promise<string|null>} подпись оплаты или null (отказ, игрок видел причину)
 */
async function payVeil(actor, label) {
  if (!canSpendActionPoints(actor, 1)) {
    ui.notifications?.warn(`⚠️ ${actor.name}: не хватает ОД на «${label}» (нужно полудействие).`);
    return null;
  }
  const opts = veilRenderPayOptions({
    infamy: actorInfamyValue(actor),
    vulture: hasItemNamed(actor, "Vulture", ["talent"]) ? resourcePoolValue(actor, VULTURE_POOL) : 0
  });
  if (!opts.length) {
    ui.notifications?.warn(`⚠️ ${actor.name}: нет ни Очков Бесчестия, ни очков Стервятника.`);
    return null;
  }
  const pick = await chooseOne(label, opts, { prompt: "Чем заплатить за разрыв Завесы?" });
  if (!pick) return null;
  if (pick.id === "vulture") {
    if (!(await spendResource(actor, VULTURE_POOL, 1, { label, silent: true }))) return null;
  } else {
    const r = await changeActorInfamy(actor, -1);
    if (!r.changed) return null;
  }
  if (!(await payActions(actor, 1, label))) return null;
  return pick.id === "vulture" ? "очко Стервятника" : "Очко Бесчестия";
}

/** Варп Вспышка: все в радиусе Cor.b м — P+0 или Ослеплены (кнопка на каждого, жмёт владелец/ГМ). */
export async function warpFlash(actor) {
  if (!hasItemNamed(actor, "Warp Flash", ["talent"])) return;
  const r = corBonus(actor);
  const toks = tokensAround(actor, r);
  const btns = toks.map(t => `<button class="wh-wprop-apply-btn" type="button"
      data-wp-label="Варп Вспышка" data-wp-key="" data-wp-immunity-alias="" data-wp-kind=""
      data-wp-condition="blinded" data-wp-test-char="per" data-wp-test-mod="0"
      data-wp-level-per-dop="0" data-wp-rounds="0" data-wp-fixed-rounds="1" data-wp-damage=""
      data-wp-rating="0" data-wp-provaly="0" data-wp-min-dop="1"
      data-wp-force-actor-uuid="${t.actor?.uuid ?? ""}">
      ${esc(t.name)}: тест P+0 или Ослеплён</button>`);
  await infoCard(actor, "🌑", "Варп Вспышка", [
    `Не-свет пожирает освещение: все в радиусе ${r} м (Cor.b) — тест P+0, при Провале Ослеплены до конца своего следующего Хода (1 Раунд).`,
    toks.length ? "Тест бросает владелец цели или ГМ — кнопкой ниже." : "В радиусе никого нет."
  ], { sections: btns.length ? [`<div class="roll-wprop-btns">${btns.join("")}</div>`] : [] });
}

/**
 * Veil Render / Разрыватель Завесы: вне Варпа — полудействие и Очко Бесчестия
 * (или Стервятника), войти в Варп; в Варпе — свободным действием вернуться.
 */
export async function useVeilRender(actor, item = null) {
  const trait = item ?? veilRenderItem(actor);
  if (!trait) return ui.notifications.warn("⚠️ У актора нет Черты Разрыватель Завесы.") && "нет Черты";
  if (activationState(trait)) {
    await deactivateItem(trait, { silent: true });
    await infoCard(actor, "🌀", "Разрыватель Завесы: возвращение", ["Свободное действие: Коготь Варпа вышел из Варпа в реальность."]);
    await warpFlash(actor);
    return undefined;
  }
  const paid = await payVeil(actor, "Разрыватель Завесы");
  if (!paid) return "отмена";
  await activateItemUntil(trait, { label: "Разрыватель Завесы: в Варпе",
    text: `Оплачено: ${paid} и полудействие. Unnatural Senses (P) — видит реальность сквозь Завесу; засечь его могут только псайкеры и те, кто заглядывает за Завесу. Вернуться — та же кнопка (свободное действие, в т.ч. во время Натиска).` });
  await warpFlash(actor);
  return undefined;
}

/** Rift / Разлом: вместо входа детонировать разрыв (та же цена, что у Разрывателя Завесы). */
export async function useRift(actor) {
  if (!hasItemNamed(actor, "Rift", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Разлом.") && "нет Таланта";
  if (!veilRenderItem(actor)) return ui.notifications.warn("⚠️ Разлом открывается Чертой Разрыватель Завесы — её нет.") && "нет Черты";
  const paid = await payVeil(actor, "Разлом");
  if (!paid) return "отмена";
  const n = riftDice(actor);
  const r = corBonus(actor);
  const roll = await new Roll(`${n}d10`).evaluate();
  const faces = roll.dice[0]?.results?.map(x => x.result) ?? [];
  const toks = tokensAround(actor, r).filter(t => riftHits(t.actor));
  setTargets(toks);
  const summons = riftSummons(faces);
  const btns = toks.map(t => applyDamageButton({ damage: roll.total, pen: 10, type: "energy", label: "Разлом",
    attacker: actor, forceTarget: t.actor?.uuid ?? "", text: `${esc(t.name)}: ${roll.total} E, Pen 10` }));
  await infoCard(actor, "💥", "Разлом", [
    `Оплачено: ${paid} и полудействие. Разрыв детонирует: <b>${n}d10 = ${roll.total}</b> E, Pen 10 (кубы: ${faces.join(", ")}).`,
    `Радиус ${r} м (Cor.b), все кроме носителей Daemonic: ${toks.length ? toks.map(t => esc(t.name)).join(", ") : "никого"} — они же выделены целями.`,
    ...summons.map(s => `😈 Две ${s.face}: разлом призывает в Реальность 1d5 — <b>${s.daemon}</b> в Истинной Форме (выставляет ГМ).`)
  ], { rolls: [roll], sections: btns.length ? [`<div class="roll-wprop-btns">${btns.join("")}</div>`] : [] });
  return undefined;
}

/** Speed of Thought / Со Скоростью Мысли: в Варпе, полное действие, Navigation (Warp)+0. */
export async function useSpeedOfThought(actor) {
  if (!hasItemNamed(actor, "Speed of Thought", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Со Скоростью Мысли.") && "нет Таланта";
  if (!inWarp(actor)) return ui.notifications.warn("⚠️ Сначала войдите в Варп Разрывателем Завесы.") && "не в Варпе";
  if (!(await payActions(actor, 2, "Со Скоростью Мысли"))) return "нет ОД";
  const res = await rollSkillCard(actor, {
    group: "navigation", spec: /warp|варп/i, icon: "🌌", title: "Со Скоростью Мысли",
    success: "Переместился в любое знакомое место звёздной системы",
    failure: "Заблудился в Варпе — ищет путь на следующий Ход"
  });
  if (res.crit === "failure" && !res.success) {
    await infoCard(actor, "🌌", "Со Скоростью Мысли: Критический Провал", [
      "Дезориентирован и пропадает в Варпе до конца боя/сцены, затем выпадает в реальность в случайном обитаемом месте звёздной системы (выбирает ГМ)."
    ]);
  }
  return undefined;
}

/** Warp Trail / Варп-След: Awareness−30 (+5×PR цели-псайкера). */
export async function useWarpTrail(actor) {
  if (!hasItemNamed(actor, "Warp Trail", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Варп-След.") && "нет Таланта";
  const target = targetedActors()[0] ?? null;
  const pr = psyRatingOf(target);
  await rollSkillCard(actor, {
    skill: "awareness", mod: warpTrailMod(target), icon: "👁️",
    title: `Варп-След${target ? ` → ${target.name}` : ""}${pr ? ` (псайкер PR ${pr}: −30+${5 * pr})` : " (−30)"}`,
    success: "Варп-след жертвы выделен — можно идти по нему",
    failure: "След души не различить"
  });
  return undefined;
}
