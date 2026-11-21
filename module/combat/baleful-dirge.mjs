// module/combat/baleful-dirge.mjs
// Мрачный Плач — кнопки (чистая часть и штраф — rules/baleful-dirge.mjs).

import { esc, _degWord } from "../helpers/utils.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { hasItemNamed } from "../rules/req-atom.mjs";
import { DIRGE_SINGING_FLAG, DIRGE_TARGET_FLAG, DIRGE_RADIUS } from "../rules/baleful-dirge.mjs";

const NS = "warhammer-dbc";

/** Кнопка Таланта: свободное действие — запеть (или продолжить) до начала следующего Хода. */
export async function useBalefulDirge(actor) {
  if (!actor || !hasItemNamed(actor, "Baleful Dirge", ["talent"])) {
    return ui.notifications.warn("⚠️ У актора нет Таланта Мрачный Плач.");
  }
  const combat = game.combat?.started ? game.combat : null;
  await actor.setFlag(NS, DIRGE_SINGING_FLAG, combat ? { combatId: combat.id, round: combat.round ?? 0 } : { at: game.time?.worldTime ?? 0 });
  await postTestCard(actor, {
    icon: "🎶", title: `Мрачный Плач — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Свободное действие: ${esc(actor.name)} поёт до начала своего следующего Хода и не может говорить (даже телепатически или через ноосферу). Все, кто слышит его в ${DIRGE_RADIUS} м, в начале своего Хода проходят W+0 — провал даёт −10 ко всем тестам, кроме T, пока песня длится или пока цель не пройдёт W. Чтобы продолжать, жмите кнопку Таланта каждый Ход.</div>`],
    sections: [`<div class="roll-defense-section"><button type="button" class="wh-dirge-test-btn" data-singer-uuid="${esc(actor.uuid)}">🎶 W+0 против Плача — выберите свой токен</button></div>`]
  }, { sound: false });
}

/** Слушатель проходит W+0: провал — метка, успех — метка снята. */
export async function resistBalefulDirge(listener, singerUuid) {
  if (!listener || !singerUuid) return false;
  if (listener.uuid === singerUuid) { ui.notifications.warn("⚠️ Певец не слушает себя."); return false; }
  const base = Number(listener.system?.characteristics?.wp?.total) || 0;
  const rm = collectTestMods(listener, { kind: "characteristic", char: "wp" });
  const threshold = base + rm.total;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, threshold);
  if (success) await listener.unsetFlag(NS, DIRGE_TARGET_FLAG);
  else await listener.setFlag(NS, DIRGE_TARGET_FLAG, { byUuid: singerUuid });
  await postTestCard(listener, {
    icon: "🎶", title: `Мрачный Плач — ${esc(listener.name)}`,
    threshold: rollStatLine({ label: "W", base, parts: rm.parts, threshold, rv: roll.total }),
    outcome: outcomeHtml(success, `${success ? "Успех" : "Провал"} — ${deg} ${_degWord(deg)}`),
    lines: [`<div class="roll-threshold">${success ? "Песня больше не давит." : "−10 ко всем тестам, кроме T, пока певец поёт (ставится само)."}</div>`]
  }, { rolls: [roll] });
  return true;
}
