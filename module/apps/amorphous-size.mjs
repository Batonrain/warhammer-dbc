// module/apps/amorphous-size.mjs
// Аморфный: действие «Сменить Размер» (±1/±2, раз в Ход). Кнопка — запись kind:"script" на Черте;
// правило и флаги — rules/amorphous.mjs; смещение входит в sizeTotal (rules/character/movement.mjs).

import { hasRuleFlag } from "../rules/flags.mjs";
import {
  AMORPHOUS_SIZE_CAP, AMORPHOUS_SIZE_FLAG, AMORPHOUS_SIZE_ROUND_FLAG, AMORPHOUS_SIZE_STEPS,
  amorphousSizeShiftOf, amorphousSizeAvailable, amorphousNextShift, amorphousRoundKey
} from "../rules/amorphous.mjs";
import { esc } from "../helpers/utils.mjs";

export async function shiftAmorphousSize(actor) {
  if (!actor || !hasRuleFlag(actor, AMORPHOUS_SIZE_CAP)) return ui.notifications.warn("Аморфный: у персонажа нет такой Черты.");
  const combat = game.combat ?? null;
  if (!amorphousSizeAvailable(actor, combat)) return ui.notifications.warn(`${actor.name}: Размер уже менялся в этом Раунде (раз в Ход).`);
  const cur = amorphousSizeShiftOf(actor);
  const step = await foundry.applications.api.DialogV2.wait({
    window: { title: `Аморфный — ${actor.name}` },
    content: `<p>Размер сейчас: <b>${esc(String(actor.system?.sizeTotal ?? "?"))}</b> (смещение ${cur >= 0 ? "+" : ""}${cur}). Раз в Ход — на 1 или 2, на SPD не влияет.</p>`,
    rejectClose: false,
    buttons: [
      ...AMORPHOUS_SIZE_STEPS.map(s => ({ action: String(s), label: `${s > 0 ? "+" : ""}${s} Размер` })),
      { action: "cancel", label: "Отмена" }
    ]
  });
  const next = amorphousNextShift(cur, step);
  if (next === null) return;
  const key = amorphousRoundKey(combat);
  await actor.update({
    [`flags.warhammer-dbc.${AMORPHOUS_SIZE_FLAG}`]: next,
    ...(key ? { [`flags.warhammer-dbc.${AMORPHOUS_SIZE_ROUND_FLAG}`]: key } : {})
  });
  ui.notifications.info(`${actor.name}: Размер ${Number(step) > 0 ? "увеличен" : "уменьшен"} на ${Math.abs(Number(step))} (смещение ${next >= 0 ? "+" : ""}${next}).`);
}
