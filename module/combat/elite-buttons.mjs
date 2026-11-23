// module/combat/elite-buttons.mjs
// Кнопки Талантов Элитных архетипов, которым хватает уже готовых пулов листа
// (Реакции, Очки Бесчестия) и нет своей системы. Каждая функция — одна книжная
// фраза; имена Талантов — литералами в hasItemNamed (их ищет
// tools/capability-reachability.mjs).

import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { hasItemNamed } from "../rules/req-atom.mjs";
import { changeActorInfamy } from "../apps/infamy-points.mjs";

/**
 * Mortido / Мортидо (Моритат): «В начале своего Хода, если в его поле зрения
 * есть противники, может потратить все свои Реакции, чтобы восстановить одно
 * ранее потраченное Очко Бесчестия».
 */
export async function useMortido(actor) {
  if (!actor || !hasItemNamed(actor, "Mortido", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Мортидо.");
  const r = actor.system?.reactions ?? {};
  const total = (Number(r.value) || 0) + (Number(r.defenseValue) || 0);
  if (total <= 0) return ui.notifications.warn("⚠️ Реакций не осталось — тратить нечего.");
  const res = await changeActorInfamy(actor, 1);
  if (!res.changed) return ui.notifications.warn("⚠️ Очки Бесчестия и так полны.");
  await actor.update({ "system.reactions.value": 0, "system.reactions.defenseValue": 0 });
  await postTestCard(actor, {
    icon: "💀", title: `Мортидо — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Все Реакции (${total}) потрачены: восстановлено 1 Очко Бесчестия (${res.before} → ${res.after}). Условие — начало Хода и враги в поле зрения — за столом.</div>`]
  }, { sound: false });
}
