// module/combat/battle-music.mjs
// Воин Ноты: Ария и Увертюра — источники музыки (rules/battle-music.mjs).

import { esc, _degWord } from "../helpers/utils.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { hasItemNamed } from "../rules/req-atom.mjs";
import { isBladeWeapon } from "../rules/melee-talents.mjs";
import { MUSIC_FLAG, SYMPHONY_MIN, musicMark, ariaWeaponOk } from "../rules/battle-music.mjs";
import { actorHasInfamyPoint, actorInfamyPath, spendFromInfamyPool } from "../apps/infamy-points.mjs";

const NS = "warhammer-dbc";
const activeCombat = () => (game.combat?.started ? game.combat : null);

/** Trade(Dancer): обученный — Итог строки группы, иначе A−20. */
function dancerValue(actor) {
  const list = actor?.system?.groupSkills?.trade;
  const hit = Array.isArray(list) ? list.find(e => /dancer|танц/i.test(String(e?.specialty ?? e?.name ?? ""))) : null;
  if (hit && hit.total != null) return Number(hit.total) || 0;
  return (Number(actor?.system?.characteristics?.ag?.total) || 0) - 20;
}

/** Ария: раз в Ход свободным действием Trade(Dancer)−10 — клинки поют до следующего Хода. */
export async function useAria(actor) {
  if (!actor || !hasItemNamed(actor, "Aria", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Ария.");
  const blade = [...actor.items].find(i => i.system?.equipped && ariaWeaponOk(i, isBladeWeapon));
  if (!blade) return ui.notifications.warn("⚠️ Нужно клинковое оружие с Балансом не ниже 0 в руках.");
  const base = dancerValue(actor);
  const rm = collectTestMods(actor, { kind: "skill", skill: "trade", char: "ag" });
  const threshold = base - 10 + rm.total;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  if (success) await actor.setFlag(NS, MUSIC_FLAG, musicMark(deg, activeCombat(), { rounds: 1, now: game.time?.worldTime ?? 0 }));
  await postTestCard(actor, {
    icon: "🎼", title: `Ария — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "Trade (Dancer)", base, parts: ["Ария −10", ...rm.parts], threshold, rv: roll.total }),
    outcome: outcomeHtml(success, `${success ? "Успех" : "Провал"} — ${deg} ${_degWord(deg)}`),
    lines: [`<div class="roll-threshold">${success
      ? `${esc(blade.name)} поёт: музыка на ${deg} ${_degWord(deg)} вживую до следующего Хода.${deg >= SYMPHONY_MIN && hasItemNamed(actor, "Symphony", ["talent"]) ? " Симфония: рукопашные и метательные атаки получают Felling и Precise — ставится само." : ""} В вакууме и под водой не звучит.`
      : "Клинки молчат."}</div>`]
  }, { rolls: [roll] });
}

/** Увертюра: 1 Очко Бесчестия — музыка на Cor.b Успехов на 1 Раунд вокруг (Cor м). */
export async function useOverture(actor) {
  if (!actor || !hasItemNamed(actor, "Overture", ["talent"])) return ui.notifications.warn("⚠️ У актора нет Таланта Увертюра.");
  if (!actorHasInfamyPoint(actor)) return ui.notifications.warn("⚠️ Нет Очка Бесчестия.");
  const path = actorInfamyPath(actor);
  const spend = await spendFromInfamyPool(actor, 1, path);
  if (!spend) return;
  if (spend.poolSpent) await actor.update({ [path]: spend.poolValue });
  const cor = Number(actor.system?.corruption?.value) || 0;
  const corB = Number(actor.system?.corruptionBonus) || Math.floor(cor / 10);
  await actor.setFlag(NS, MUSIC_FLAG, musicMark(corB, activeCombat(), { rounds: 0, now: game.time?.worldTime ?? 0 }));
  await postTestCard(actor, {
    icon: "🎼", title: `Увертюра — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Потрачено 1 Очко Бесчестия: на 1 Раунд ${esc(actor.name)} и все в ${cor} м слышат божественную музыку на ${corB} ${_degWord(corB)} — сквозь глухоту, шум и вакуум.${corB >= SYMPHONY_MIN && hasItemNamed(actor, "Symphony", ["talent"]) ? " Симфония включена." : ""}</div>`]
  }, { sound: false });
}
