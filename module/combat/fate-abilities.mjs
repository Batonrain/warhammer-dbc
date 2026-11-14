// module/combat/fate-abilities.mjs — Foundry-обвязка Крови Героев и Выступления (правила — rules/fate-abilities.mjs).
import { hasRuleFlag } from "../rules/flags.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";
import { CHARACTERISTICS } from "../constants/characteristics.mjs";
import { spendReaction } from "./action-economy.mjs";
import {
  BLOOD_HEROES_CAP, PERFORMANCE_CAP, BLOOD_HEROES_USED_FLAG, BLOOD_HEROES_CHANGED_FLAG, PERFORMANCE_ROUND_FLAG,
  UNNATURAL_CHARS, battleKey, bloodHeroesAvailable, bloodHeroesThreshold, bloodHeroesChanges,
  performanceAvailable, performanceRoundKey, performanceChanges
} from "../rules/fate-abilities.mjs";

const NS = "warhammer-dbc";
const flagOf = (actor, k) => actor?.flags?.[NS]?.[k] ?? actor?.getFlag?.(NS, k);
const bloodEffects = actor => [...(actor?.effects ?? [])].filter(e => e.flags?.[NS]?.bloodOfHeroes);

/** Кровь Героев: тест W+10 (смена — W−10); успех — Unnatural (+1) на выбранную Характеристику до конца битвы. */
export async function useBloodOfHeroes(actor) {
  if (!actor || !hasRuleFlag(actor, BLOOD_HEROES_CAP)) return ui.notifications.warn("Кровь Героев: у персонажа нет такой Черты.");
  const combat = game.combat?.started ? game.combat : null;
  const existing = bloodEffects(actor);
  const { mode } = bloodHeroesAvailable({
    used: flagOf(actor, BLOOD_HEROES_USED_FLAG), changed: flagOf(actor, BLOOD_HEROES_CHANGED_FLAG), hasEffect: existing.length > 0
  }, combat);
  if (!mode) return ui.notifications.warn("Кровь Героев: в этой битве уже использовано (раз на начало и раз на смену).");
  const wp = Number(actor.system?.characteristics?.wp?.total) || 0;
  const threshold = bloodHeroesThreshold(wp, mode);
  const roll = await new Roll("1d100").evaluate();
  const { success } = testOutcome(roll.total, threshold);
  const key = battleKey(combat);
  await actor.update({ [`flags.${NS}.${mode === "start" ? BLOOD_HEROES_USED_FLAG : BLOOD_HEROES_CHANGED_FLAG}`]: key || "no-combat" });
  await postTestCard(actor, {
    icon: rollIcon("sword", "#e08a3a"), title: `Кровь Героев — ${esc(actor.name)} (${mode === "start" ? "W+10" : "смена, W−10"})`,
    threshold: `W (<b>${wp}</b>) ${mode === "start" ? "+10" : "−10"} = <b>${threshold}</b>: <b>${roll.total}</b>`,
    outcome: success ? `<span class="roll-success">Успех</span>` : `<span class="roll-failure">Провал — эффекта нет</span>`
  }, { rolls: [roll] });
  if (!success) return;
  const buttons = UNNATURAL_CHARS.map(k => ({ action: k, label: CHARACTERISTICS[k]?.abbr ?? k.toUpperCase() }));
  const pick = await foundry.applications.api.DialogV2.wait({
    window: { title: "Кровь Героев — Unnatural (+1)" }, content: "<p>На какую Характеристику повесить Unnatural (+1) до конца битвы?</p>",
    rejectClose: false, buttons
  });
  const changes = bloodHeroesChanges(pick);
  if (!changes.length) return;
  if (existing.length) await actor.deleteEmbeddedDocuments("ActiveEffect", existing.map(e => e.id));
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: `Кровь Героев: Unnatural ${CHARACTERISTICS[pick]?.abbr ?? pick} (+1)`,
    img: "systems/warhammer-dbc/assets/item-icons/trait.svg",
    system: { changes }, flags: { [NS]: { bloodOfHeroes: true } }
  }]);
  ui.notifications.info(`${actor.name}: Unnatural ${CHARACTERISTICS[pick]?.abbr ?? pick} (+1) до конца битвы.`);
}

/** Конец боя: снять эффекты Крови Героев и пометки. */
export async function clearBloodOfHeroes(combat) {
  for (const c of combat?.combatants ?? []) {
    const a = c.actor;
    if (!a) continue;
    const ids = bloodEffects(a).map(e => e.id);
    if (ids.length) await a.deleteEmbeddedDocuments("ActiveEffect", ids);
    if (flagOf(a, BLOOD_HEROES_USED_FLAG) != null || flagOf(a, BLOOD_HEROES_CHANGED_FLAG) != null) {
      await a.update({ [`flags.${NS}.-=${BLOOD_HEROES_USED_FLAG}`]: null, [`flags.${NS}.-=${BLOOD_HEROES_CHANGED_FLAG}`]: null });
    }
  }
}

/** Выступление: Реакция + Очко Судьбы — +A.b к AP всех зон до начала следующего Хода. */
export async function usePerformance(actor) {
  if (!actor || !hasRuleFlag(actor, PERFORMANCE_CAP)) return ui.notifications.warn("Выступление: у персонажа нет такой Черты.");
  const combat = game.combat?.started ? game.combat : null;
  if (!performanceAvailable(flagOf(actor, PERFORMANCE_ROUND_FLAG), combat)) return ui.notifications.warn("Выступление: уже использовано в этом Раунде.");
  const fate = Number(actor.system?.fate?.value) || 0;
  if (fate < 1) return ui.notifications.warn("Выступление: нет Очков Судьбы.");
  if (combat && !(await spendReaction(actor))) return;
  const changes = performanceChanges(actor.system?.characteristics?.ag?.bonus);
  if (!changes.length) return ui.notifications.warn("Выступление: A.b равен 0 — прибавлять нечего.");
  const key = performanceRoundKey(combat);
  await actor.update({
    "system.fate.value": fate - 1,
    ...(key ? { [`flags.${NS}.${PERFORMANCE_ROUND_FLAG}`]: key } : {})
  });
  await actor.createEmbeddedDocuments("ActiveEffect", [{
    name: `Выступление: +${changes[0].value} AP`, img: "systems/warhammer-dbc/assets/item-icons/trait.svg",
    system: { changes }, duration: { value: 1, units: "rounds", expiry: "turnStart" }, flags: { [NS]: { performance: true } }
  }]);
  await postTestCard(actor, {
    icon: rollIcon("shield", "#8fd0ff"), title: `Выступление — ${esc(actor.name)}`,
    outcome: `<span class="roll-success">+${changes[0].value} к поглощению (AP) во всех зонах до начала следующего Хода. Очко Судьбы потрачено (осталось ${fate - 1}).</span>`
  }, { sound: false });
}
