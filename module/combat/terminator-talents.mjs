// module/combat/terminator-talents.mjs
// ════════════════════════════════════════════════════════════════════════
//  Кнопки Талантов Чемпиона Терминатора (правила — rules/terminator-talents.mjs).
//  Помазанник — тест FL (Heresy)(W)+10 при приёме попадания за союзника;
//  Атраментар — Страх 3 до конца сцены после убийства в рукопашной;
//  Саван Смерти — один бросок WS по всем врагам в 1 м.
// ════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { hasItemNamed } from "../rules/req-atom.mjs";
import { activateItemUntil } from "../apps/item-activation.mjs";
import { markFullAttack } from "./full-attack-lock.mjs";
import {
  ANOINTED_SHIELD_FLAG, ANOINTED_SHIELD_BONUS, isPolearm, deathShroudDamageFormula
} from "../rules/terminator-talents.mjs";
import {
  chooseOne, confirmBox, infoCard, payActions, payReaction, rollSkillCard, tokensAround, sameSide, setTargets, applyDamageButton
} from "./astartes-elite-ui.mjs";

const NS = "warhammer-dbc";

/** Anointed / Помазанник: принял попадание за союзника — FL (Heresy)(W)+10 → +35 к рейтингу щита на это попадание. */
export async function useAnointed(actor) {
  if (!hasItemNamed(actor, "Anointed", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Помазанник.") && "нет Таланта";
  const res = await rollSkillCard(actor, {
    group: "forbiddenLore", spec: /heresy|ерес/i, char: "wp", mod: 10, icon: "🛡️",
    title: "Помазанник: попадание за союзника",
    success: `Силовой щит брони: +${ANOINTED_SHIELD_BONUS} к рейтингу против этого попадания — учтётся само при броске щита`,
    failure: "Щит без прибавки"
  });
  if (res.success) await actor.setFlag(NS, ANOINTED_SHIELD_FLAG, true);
  return undefined;
}

/** Atramentar / Атраментар: убийство в рукопашной → Реакция (или Атака другой рукой) → Страх 3 до конца сцены. */
export async function useAtramentar(actor, item) {
  if (!hasItemNamed(actor, "Atramentar", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Атраментар.") && "нет Таланта";
  const pay = await chooseOne("Атраментар", [
    { id: "reaction", label: "Потратить Реакцию" },
    { id: "offhand", label: "Потратить неиспользованную Атаку другой рукой" }
  ], { prompt: `${actor.name} убил противника в рукопашной. Чем заплатить?` });
  if (!pay) return "отмена";
  if (pay.id === "reaction" && !(await payReaction(actor, "Атраментар"))) return "нет Реакции";
  const r = await activateItemUntil(item, { label: "Атраментар: Страх 3",
    text: `Убийство разрывает врага в клочья (${pay.id === "reaction" ? "Реакция" : "Атака другой рукой"} потрачена): Страх (3) против видевших его врагов.` });
  return r;
}

/** Death Shroud / Саван Смерти: полное действие, древковое в двуручном хвате — по всем врагам в 1 м одним броском. */
export async function useDeathShroud(actor) {
  if (!hasItemNamed(actor, "Death Shroud", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Саван Смерти.") && "нет Таланта";
  const poles = actor.items.filter(i => isPolearm(i) && i.system?.equipped);
  if (!poles.length) return ui.notifications.warn("⚠️ Нужно экипированное древковое оружие (Копьё, Глефа, Посох) в двуручном хвате.") && "нет оружия";
  const pick = await chooseOne("Саван Смерти", poles.map(w => ({ id: w.id, label: w.name })));
  if (!pick) return "отмена";
  const weapon = actor.items.get(pick.id);
  const foes = tokensAround(actor, 1).filter(t => !sameSide(actor, t));
  if (!foes.length) return ui.notifications.warn("⚠️ В 1 м нет противников.") && "нет целей";
  if (!(await confirmBox("Саван Смерти", `${esc(weapon.name)} держится двумя руками? Атака по ${foes.length} противн. в 1 м.`, "Да, атаковать", "Нет"))) return "отмена";
  if (!(await payActions(actor, 2, "Саван Смерти"))) return "нет ОД";
  setTargets(foes);
  const res = await rollSkillCard(actor, {
    char: "ws", mod: Number(weapon.system?.attackBonus) || 0, icon: "⚰️", title: `Саван Смерти: ${weapon.name}`,
    ctx: { kind: "attack", isMelee: true, weapon, weaponClass: "melee" },
    success: `Одно попадание по каждому из ${foes.length}`, failure: "Промах по всем"
  });
  await markFullAttack(actor, weapon);
  if (!res.success) {
    await infoCard(actor, "⚰️", "Саван Смерти", ["Уклоняться и Парировать нельзя до начала следующего Хода."]);
    return undefined;
  }
  const formula = deathShroudDamageFormula(actor, weapon);
  const rolls = [];
  const btns = [];
  for (const t of foes) {
    const roll = await new Roll(formula).evaluate();
    rolls.push(roll);
    btns.push(applyDamageButton({ damage: roll.total, pen: Number(weapon.system?.penetration) || 0,
      type: weapon.system?.damageType || "impact", label: weapon.name, attacker: actor, forceTarget: t.actor?.uuid ?? "",
      text: `${esc(t.name)}: ${roll.total} (${esc(formula)}), Pen ${Number(weapon.system?.penetration) || 0}` }));
  }
  await infoCard(actor, "⚰️", "Саван Смерти: попадания", [
    `Одно попадание по каждому врагу в 1 м (цели выделены): урон ${esc(formula)} на каждого.`,
    "Уклоняться и Парировать нельзя до начала следующего Хода."
  ], { rolls, sections: [btns.join("")] });
  return undefined;
}
