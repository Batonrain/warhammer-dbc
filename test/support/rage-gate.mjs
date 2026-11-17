// test/support/rage-gate.mjs
//
// Тестовая замена хука preUpdateActor из warhammer-dbc.mjs для запрета повторного входа в Ярость
// (module/combat/frenzy.mjs::blockRageReentry): оборачивает actor.update так, как это делает Foundry —
// правка system.inRage:true проходит через гейт, а остальное применяется как обычно.

import { blockRageReentry } from "../../module/combat/frenzy.mjs";

export function withRageGate(actor) {
  const inner = actor.update.bind(actor);
  actor.update = async (data, options = {}) => {
    const patch = { ...data };
    if (patch["system.inRage"] === true) {
      const changes = { system: { inRage: true } };
      if (blockRageReentry(actor, changes, options)) delete patch["system.inRage"];
    }
    return inner(patch, options);
  };
  return actor;
}
