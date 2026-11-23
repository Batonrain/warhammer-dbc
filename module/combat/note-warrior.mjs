// module/combat/note-warrior.mjs
// Воин Ноты — кнопки Талантов поверх музыки (rules/note-warrior-talents.mjs):
// Финале (Реакция, Trade(Dancer)−40 против W+0 всех видевших врагов —
// восстановление Очков Бесчестия) и Лейтмотив (музыка от вражеского чемпиона,
// тест Trade(Musician)(P) раз за сцену — ГМу уходит боевой профиль чемпиона).

import { esc, _degWord } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { resolveOpposed } from "../rules/test-kind.mjs";
import { isThrottleReady, markThrottleUsed } from "../rules/cooldown.mjs";
import { changeActorInfamy } from "../apps/infamy-points.mjs";
import { MUSIC_FLAG, musicMark, musicDeg } from "../rules/battle-music.mjs";
import {
  hasFinale, hasLeitmotif, dancerAgValue, finaleRestore, leitmotifDeg, LEITMOTIF_MIN_INF
} from "../rules/note-warrior-talents.mjs";
import { rollSide, rollTestCard, targetActors, firstTargetActor, groupSpecValue } from "./duelist-tests.mjs";

const NS = "warhammer-dbc";
const FINALE_MOD = -40;

/** Враги сцены: цели игрока, иначе все токены враждебного расположения. */
function finaleAudience(actor) {
  const picked = targetActors().filter(a => a !== actor);
  if (picked.length) return picked;
  const me = actor.getActiveTokens?.(false, true)?.[0];
  const myDisp = me?.disposition ?? 1;
  return (canvas?.tokens?.placeables ?? [])
    .filter(t => t.actor && t.actor !== actor && t.document?.disposition !== undefined
      && t.document.disposition !== 0 && t.document.disposition !== myDisp)
    .map(t => t.actor);
}

/** Финале: после убийства/паралича чемпиона, монстра или машины рукопашной/метательной атакой. */
export async function useFinale(actor) {
  if (!actor || !hasFinale(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Финале.");
  const foes = finaleAudience(actor);
  if (!foes.length) return ui.notifications.warn("⚠️ Нет видевших врагов — наведите цели или расставьте враждебные токены.");
  const { spendReaction } = await import("./action-economy.mjs");
  if (!(await spendReaction(actor))) return ui.notifications.warn("⚠️ Нет Реакции.");
  const me = await rollSide(actor, { label: "Trade (Dancer)", base: dancerAgValue(actor), mod: FINALE_MOD, modLabel: "Финале",
    ctx: { kind: "skill", char: "ag", skill: "trade" } });
  const rows = [];
  const rolls = [me.roll];
  let losers = 0;
  for (const f of foes) {
    const w = await rollSide(f, { label: "W", base: Number(f.system?.characteristics?.wp?.total) || 0, ctx: { kind: "skill", char: "wp" } });
    rolls.push(w.roll);
    const { winner } = resolveOpposed({ success: me.success, deg: me.deg, threshold: me.threshold }, { success: w.success, deg: w.deg, threshold: w.threshold });
    const lost = winner === "mine";
    if (lost) losers++;
    rows.push(`${esc(f.name)}: W ${w.threshold}, бросок ${w.rv} — ${w.success ? "Успех" : "Провал"} ${w.deg} ${_degWord(w.deg)} → ${lost ? "<b>сломлен</b>" : "держится"}`);
  }
  const restore = finaleRestore(losers, foes.length);
  let restored = 0;
  if (restore) {
    const n = restore === "1d5" ? (await new Roll("1d5").evaluate()).total : 1;
    const res = await changeActorInfamy(actor, n);
    restored = res.changed ? (res.after - res.before) : 0;
  }
  await postTestCard(actor, {
    icon: "💃", title: `Финале — ${esc(actor.name)}`, threshold: me.line,
    lines: [`<div class="roll-threshold">Потрачена Реакция. ${rows.join("<br>")}</div>`,
      `<div class="roll-threshold">${!restore ? "Никто не дрогнул — Очки не восстановлены."
        : `Проиграли ${losers} из ${foes.length}: восстановлено ${restored} Очк. Бесчестия${restore === "1d5" ? " (все, не меньше 6 — 1d5)" : ""}.`}</div>`,
      `<div class="roll-threshold" style="font-size:0.85em;">Условие — убит или парализован вражеский чемпион, монстр или машина рукопашной/метательной атакой — за столом.</div>`]
  }, { rolls });
}

/** Лейтмотив: на Воине внимание вражеского чемпиона с Inf 30+ — музыка ½Inf.b Успехов; раз за сцену тест Trade(Musician)(P). */
export async function useLeitmotif(actor) {
  if (!actor || !hasLeitmotif(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Лейтмотив.");
  const champ = firstTargetActor();
  if (!champ) return ui.notifications.warn("⚠️ Наведите цель — вражеского чемпиона, чьё внимание на Воине.");
  const deg = leitmotifDeg(champ);
  if (!deg) return ui.notifications.warn(`⚠️ У ${champ.name} Inf ниже ${LEITMOTIF_MIN_INF} — мелодии нет.`);
  const combat = game.combat?.started ? game.combat : null;
  const now = game.time?.worldTime ?? 0;
  if (deg > musicDeg(actor, { combat, now })) await actor.setFlag(NS, MUSIC_FLAG, musicMark(deg, combat, { rounds: 0, now }));
  const flag = `noteWarrior.leitmotif.${champ.id}`;
  if (!isThrottleReady(actor, flag, "scene")) {
    return postTestCard(actor, { icon: "🎵", title: `Лейтмотив — ${esc(actor.name)}`,
      lines: [`<div class="roll-threshold">Мелодия ${esc(champ.name)} звучит: музыка на ${deg} ${_degWord(deg)} (вживую). Тест на тайны чемпиона в этой сцене уже был.</div>`] }, { sound: false });
  }
  await markThrottleUsed(actor, flag, "scene");
  const mus = groupSpecValue(actor, "trade", "musician", "per");
  const res = await rollTestCard(actor, {
    icon: "🎵", title: "Лейтмотив", label: "Trade (Musician)(P)", base: mus.value, ctx: { kind: "skill", char: "per", skill: "trade" },
    lines: r => [`Оба слышат мелодию на ${deg} ${_degWord(deg)} (вживую).`,
      r.success ? `ГМ в общих чертах расскажет об особенностях боевого стиля и тактики ${esc(champ.name)}.` : "Мелодия ничего не открыла."]
  });
  if (!res.success) return;
  const gms = game.users?.filter?.(u => u.isGM).map(u => u.id) ?? [];
  const names = type => [...(champ.items ?? [])].filter(i => i.type === type).map(i => esc(i.name)).join(", ") || "—";
  await postTestCard(actor, {
    icon: "🎵", title: `Лейтмотив: тайны ${esc(champ.name)}`,
    lines: [`<div class="roll-threshold"><b>Таланты:</b> ${names("talent")}<br><b>Черты:</b> ${names("trait")}</div>`,
      `<div class="roll-threshold">ГМ: в общих чертах рассказать о стиле и тактике чемпиона.</div>`]
  }, { sound: false, whisper: gms });
}
