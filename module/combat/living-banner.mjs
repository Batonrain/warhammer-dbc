// module/combat/living-banner.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Living Banner / Живой Стяг (Черта Герольда; Разобрать lg5r8). Кнопка
//  «▶ Запустить» Черты зовёт useLivingBanner: −1 Очко Бесчестия, тест
//  Command(F)+10 или Charm(F)+10 (берётся лучший из двух Навыков), при Успехе
//  каждый соратник, видящий Герольда (токены той же стороны в его поле зрения),
//  возвращает одно потраченное Очко. Слух система не моделирует — только зрение.
//  Чужим акторам Очко пишет ГМ (gm-relay.mjs, livingBannerBoon).
// ════════════════════════════════════════════════════════════════════════════

import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
import { esc, _degWord } from "../helpers/utils.mjs";
import { tokensThatCanSee } from "../rules/vision-target.mjs";
import { actorHasInfamyPoint, actorInfamyPath, spendFromInfamyPool, actorInfamyValue, actorInfamyMax } from "../apps/infamy-points.mjs";
import { hasLivingBanner, livingBannerSkill, livingBannerRecipients, LIVING_BANNER_MOD } from "../rules/living-banner.mjs";
import { writeToTarget } from "./gm-relay.mjs";

function alliesWhoSee(actor) {
  const token = actor?.getActiveTokens?.(false, true)?.[0] ?? null;
  if (!token || !canvas?.ready) return [];
  const side = token.document?.disposition ?? token.disposition;
  const candidates = canvas.tokens.placeables.filter(t => t.actor && t.actor !== actor
    && (t.document?.disposition ?? t.disposition) === side);
  const seen = tokensThatCanSee(token, candidates, canvas.grid);
  return [...new Map(seen.map(t => [t.actor.uuid, t.actor])).values()];
}

export async function useLivingBanner(actor) {
  if (!actor || !hasLivingBanner(actor)) return ui.notifications.warn("⚠️ У актора нет Черты Живой Стяг.");
  if (!actorHasInfamyPoint(actor)) return ui.notifications.warn(`⚠️ ${actor.name}: нет Очка Бесчестия.`);
  const path = actorInfamyPath(actor);
  const spend = await spendFromInfamyPool(actor, 1, path);
  if (!spend) return;
  if (spend.poolSpent) await actor.update({ [path]: spend.poolValue });

  const skill = livingBannerSkill(actor);
  const rm = collectTestMods(actor, { kind: "skill", skill: skill.key, char: "fel" });
  const threshold = skill.total + LIVING_BANNER_MOD + rm.total;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);

  let outcome;
  if (success) {
    const allies = livingBannerRecipients(alliesWhoSee(actor), { value: actorInfamyValue, max: actorInfamyMax });
    const done = [];
    for (const ally of allies) {
      if (await writeToTarget(ally, { kind: "livingBannerBoon" }, actor)) done.push(ally.name);
    }
    outcome = `<span class="roll-success">Успех — ${deg} ${_degWord(deg)}. ${done.length
      ? `+1 Очко Бесчестия: ${done.map(esc).join(", ")}.`
      : "Соратников с потраченными Очками в поле зрения нет."}</span>`;
  } else {
    outcome = `<span class="roll-failure">Провал — ${deg} ${_degWord(deg)}. Очко Бесчестия потрачено впустую.</span>`;
  }
  await postTestCard(actor, {
    icon: "🚩", title: `Живой Стяг — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: `${skill.label} (F)`, base: skill.total, parts: [`+${LIVING_BANNER_MOD}`, ...rm.parts], threshold, rv: roll.total }),
    outcome
  }, { rolls: [roll] });
  return { success, deg };
}
