// module/apps/absorb-pain.mjs
// «Впитать боль» — кнопка на Черте «Через Боль»: цель из game.user.targets, радиус P.b м, Реакция,
// +1 Очко Боли (пул fate друкхари), раз в Раунд с одной цели. Правило — rules/absorb-pain.mjs.
import {
  absorbPainRoundKey, absorbPainAvailable, absorbPainInRange, absorbPainGain, ABSORB_PAIN_FLAG
} from "../rules/absorb-pain.mjs";
import { spendReaction } from "../combat/action-economy.mjs";
import { measureTokens } from "../combat/tactical-map.mjs";

const NS = "warhammer-dbc";
const tokenOf = a => a?.getActiveTokens?.(true)?.[0] ?? null;

export async function absorbPain(actor) {
  if (!actor?.system?.painActive) return ui.notifications.warn("Впитать боль: у персонажа нет пула Очков Боли (раса Друкхари).");
  const target = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  if (!target) return ui.notifications.warn("Впитать боль: выберите цель (T на токене).");
  const combat = game.combat?.started ? game.combat : null;
  const map = actor.getFlag(NS, ABSORB_PAIN_FLAG) ?? {};
  if (!absorbPainAvailable(map, target.uuid, combat)) {
    return ui.notifications.warn(`Впитать боль: ${target.name} уже отдавал боль в этом Раунде.`);
  }
  const pb = Number(actor.system?.characteristics?.per?.bonus) || 0;
  const a = tokenOf(actor), b = tokenOf(target);
  const dist = a && b ? measureTokens(a, b)?.edgeM ?? null : null;
  if (!absorbPainInRange(dist, pb)) return ui.notifications.warn(`Впитать боль: цель дальше P.b (${pb} м).`);
  if (combat && !(await spendReaction(actor))) return;
  const { value, gained } = absorbPainGain(actor.system.fate?.value, actor.system.fate?.max);
  const key = absorbPainRoundKey(combat);
  await actor.update({
    "system.fate.value": value,
    ...(key ? { [`flags.${NS}.${ABSORB_PAIN_FLAG}`]: { ...map, [target.uuid]: key } } : {})
  });
  ui.notifications.info(gained
    ? `${actor.name}: впитывает боль ${target.name} — Очки Боли ${value}/${actor.system.fate?.max}.`
    : `${actor.name}: запас Очков Боли уже полон (${value}).`);
}
