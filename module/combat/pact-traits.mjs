// module/combat/pact-traits.mjs
// ════════════════════════════════════════════════════════════════════════
//  Кнопки оставшихся Черт Пакта: Испивающий Души (Вампир), Каменное
//  Сердце (Когитор). Арифметика — rules/pact-traits.mjs.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { gainResource } from "../apps/resource-pools.mjs";
import { setDeceased } from "../sheets/tabs/body.mjs";
import { fatigueChangeFields } from "../sheets/tabs/conditions.mjs";
import { healActor } from "./heal-target.mjs";
import {
  SOUL_DRUNK_FLAG, HEART_SHOT_PENALTY, SOUL_DRINKER_OPTIONS, hasSoulDrinker, hasHeartOfStone, soulDrinkerGains
} from "../rules/pact-traits.mjs";
import { NS, CANCEL, firstTarget, writeOrWarn, askChoice, cultCard, rollCultTest } from "./cult-common.mjs";

/** Испивающий Души: укус опустил W жертвы (T) до 0 — Жажда +½W.b и один эффект. */
export async function useSoulDrinker(actor) {
  if (!hasSoulDrinker(actor)) return ui.notifications.warn("⚠️ Нет Черты Испивающий Души.");
  const victim = firstTarget();
  if (!victim || victim === actor) return ui.notifications.warn("⚠️ Испивающий Души: выберите жертву укуса (T на токене).");
  const g = soulDrinkerGains(victim.system?.characteristics?.wp?.bonus);
  const pick = await askChoice("Испивающий Души", "Эффект:", SOUL_DRINKER_OPTIONS.map(o => ({ value: o.key, label: o.label })),
    { hint: `Укус опустил W «${esc(victim.name)}» до 0: жертва умирает, Жажда +${g.thirst} (½W.b, окр.▲).` });
  if (!pick) return CANCEL;
  const lines = [`«${esc(victim.name)}» мёртв — часть его души слилась с Вампиром: воскресить нельзя, пока Вампир жив; демон изгоняется ослабленным.`];
  if (game.user?.isGM || victim.isOwner) {
    await setDeceased(victim, true);
    await victim.update({ [`flags.${NS}.${SOUL_DRUNK_FLAG}`]: actor.uuid });
  } else lines.push("Смерть жертвы отметит ГМ.");
  const t = await gainResource(actor, "thirst", g.thirst, { silent: true });
  lines.push(`Жажда +${g.thirst}${t ? `: ${t.after} / ${t.max}` : ""}.`);
  switch (pick) {
    case "heal": {
      await healActor(actor, g.heal, { healer: actor });
      lines.push(`Восстановлено до <b>${g.heal}</b> Ран.`);
      break;
    }
    case "crits": {
      const f = fatigueChangeFields(actor, 0);
      await actor.update(f.fields);
      lines.push("Усталость снята. Критические Эффекты — снимите с листа (все).");
      break;
    }
    case "chars": lines.push(`Восстановите до <b>${g.charHeal}</b> урона Характеристик на листе.`); break;
    default: lines.push(`${esc(SOUL_DRINKER_OPTIONS.find(o => o.key === pick)?.label ?? "")} — W.b жертвы ${g.traits}.`);
  }
  await cultCard(actor, "Испивающий Души", lines, { icon: "🩸" });
  return false;
}

/**
 * Каменное Сердце: враг (T) пытается понять, куда бить — комбинированный
 * For.Lore(Heresy)−10 и For.Lore(Warp)−20. Успех — враг знает: Избирательная
 * атака в сердце −40.
 */
export async function heartOfStoneInsight(actor) {
  if (!hasHeartOfStone(actor)) return ui.notifications.warn("⚠️ Нет Черты Каменное Сердце.");
  const enemy = firstTarget();
  if (!enemy || enemy === actor) return ui.notifications.warn("⚠️ Каменное Сердце: выберите врага, который разгадывает (T на токене).");
  const r = await rollCultTest(enemy, {
    title: `Каменное Сердце — разгадать ${actor.name}`, icon: "🫀",
    tests: [{ group: "forbiddenLore", spec: "heresy", specLabel: "Heresy", mod: -10 }, { group: "forbiddenLore", spec: "warp", specLabel: "Warp", mod: -20 }],
    success: `душа в сердце — бить Избирательно в сердце (${HEART_SHOT_PENALTY})`, failure: "загадка не разгадана"
  });
  if (r.success) await writeOrWarn(enemy, { [`flags.${NS}.heartOfStoneKnown.${actor.id}`]: true }, "отметку «знает про сердце»");
  return false;
}
