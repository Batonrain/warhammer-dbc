// module/combat/the-hunter.mjs
// ════════════════════════════════════════════════════════════════════════
//  The Hunter / Загонщик (wdbc-1rno, Кхорн) — Foundry-обвязка поверх чистой
//  геометрии module/rules/the-hunter.mjs и уже готового призыва демона
//  (module/apps/demon-summon.mjs::spawnDemonOnScene). Три части:
//
//  1) spawnHunterHound — призывает Гончую, метит её (кто именно призвал —
//     нужно только точечной проверке в п.3), заводит ей Combatant рядом с
//     чемпионом и держит его инициативу сразу за ним (стр. 453-460:
//     «действует в его инициативу», тот же приём, что module/combat/
//     spirit-talk.mjs::_syncInitiativeAfterCaster — «ходит сразу после»).
//  2) defaultSpawnHunterHoundFn — ГМ напрямую/сокет-релей, тот же приём, что
//     defaultSpawnDemonFn (Бестиарий скрыт от игрока — поиск и создание
//     Актора делает активный ГМ).
//  3) huntReturnToWarpButtonHtml — кнопка «Гончая возвращается в Варп» для
//     карточки «Констатировать смерть» (module/hooks.mjs), появляется САМА,
//     если убийца — именно эта Гончая (по HUNTER_HOUND_FLAG на её Акторе).
//
//  «Нападает на ближайшего псайкера» (wdbc-1rno, разбор пробела 09.09.2026):
//  автоатак ни для одного существа в системе нет — здесь только подсказка в
//  карточке призыва (nearestVisiblePsyker), реальную атаку игрок/ГМ проводит
//  вручную обычной атакой этой Гончей.
// ════════════════════════════════════════════════════════════════════════

import { spawnDemonOnScene } from "../apps/demon-summon.mjs";
import { HOUND_NAME, HUNTER_HOUND_FLAG, nearestVisiblePsyker } from "../rules/the-hunter.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const FLAG = "warhammer-dbc";

/** Первый (обычный) Combatant этого актора в бою — тот же приём, что spirit-talk.mjs::findCombatant. */
function findCombatant(combat, actorId) {
  for (const c of combat?.combatants ?? []) if (c?.actorId === actorId) return c;
  return null;
}

/** Инициатива Гончей чуть ниже чемпиона — «действует в его инициативу»/«сразу после». */
async function syncHoundInitiative(houndCombatant, championCombatant) {
  const raw = championCombatant?.initiative;
  if (raw === null || raw === undefined) return; // чемпион ещё не бросил инициативу — синхронизация отложена
  const v = Number(raw);
  if (!Number.isFinite(v)) return;
  await houndCombatant.update({ initiative: v - 0.01 });
}

/**
 * GM-side: призывает Гончую Плоти, метит её HUNTER_HOUND_FLAG, встраивает в
 * очередь ходов рядом с чемпионом (если бой уже идёт и у чемпиона есть свой
 * Combatant), постит публичную карточку с подсказкой «ближайший псайкер».
 * Вызывается либо напрямую (вызывающий сам ГМ), либо из сокет-релея
 * (см. defaultSpawnHunterHoundFn и warhammer-dbc.mjs, action:"summonHunterHound") —
 * в обоих случаях исполняется на клиенте активного ГМа целиком, поэтому
 * тегирование/синхронизация не нуждаются в возврате данных вызывающей
 * стороне.
 */
export async function spawnHunterHound(championUuid, itemId) {
  const champion = await fromUuid(championUuid).catch(() => null);
  if (!champion) return { ok: false, reason: "Не удалось найти чемпиона." };

  const res = await spawnDemonOnScene(HOUND_NAME, championUuid);
  if (!res.ok) return res;

  const hound = res.actorUuid ? await fromUuid(res.actorUuid).catch(() => null) : null;
  if (hound) {
    await hound.setFlag(FLAG, HUNTER_HOUND_FLAG, { championUuid, itemId: itemId || "" });

    const combat = game.combat;
    if (combat) {
      const championCombatant = findCombatant(combat, champion.id);
      if (championCombatant) {
        let houndCombatant = findCombatant(combat, hound.id);
        if (!houndCombatant) {
          const houndToken = hound.getActiveTokens?.(false, true)?.[0];
          const [created] = await combat.createEmbeddedDocuments("Combatant",
            [{ actorId: hound.id, tokenId: houndToken?.id ?? null, initiative: null }]);
          houndCombatant = created;
        }
        if (houndCombatant) await syncHoundInitiative(houndCombatant, championCombatant);
      }
    }
  }

  const championToken = champion.getActiveTokens?.(false, true)?.[0];
  const nearest = championToken ? nearestVisiblePsyker(championToken) : null;
  const hintLine = nearest
    ? `<div class="roll-threshold">Ближайший видимый псайкер: <b>${esc(nearest.token.actor?.name || nearest.token.name || "?")}</b> (${nearest.distance.toFixed(1)} м) — атаку проводит игрок/ГМ вручную, обычной атакой Гончей.</div>`
    : "";
  await postTestCard(champion, {
    icon: rollIcon("burst", "#ff6b6b"), title: `Загонщик — ${esc(champion.name)}`,
    outcome: `Из Варпа явилась <b>${esc(res.actorName || HOUND_NAME)}</b>.`,
    lines: [hintLine]
  }, { sound: false });

  return res;
}

/** ГМ — напрямую; иначе сокет-релей (обработчик — warhammer-dbc.mjs, action:"summonHunterHound"). */
export async function defaultSpawnHunterHoundFn(championUuid, itemId) {
  if (!championUuid) return;
  if (game.user?.isGM) {
    const res = await spawnHunterHound(championUuid, itemId);
    if (!res.ok) ui.notifications?.warn(res.reason);
    return;
  }
  if (!game.users?.activeGM) {
    ui.notifications?.warn("Нет активного Мастера — Гончую нужно призвать вручную.");
    return;
  }
  game.socket?.emit("system.warhammer-dbc",
    { action: "summonHunterHound", userId: game.user?.id, championUuid, itemId });
}

/**
 * Кнопка «Гончая возвращается в Варп» — вставляется в карточку «Констатировать
 * смерть» (module/hooks.mjs), только если убийца — именно эта Гончая
 * (HUNTER_HOUND_FLAG на её Акторе, см. isHunterHoundActor в rules/the-hunter.mjs).
 * Удаление — тот же паттерн, что у .wh-destabilize-delete-btn: подтверждение
 * перед необратимым Actor.delete(), клик обрабатывается в hooks.mjs.
 */
export function huntReturnToWarpButtonHtml(houndActor) {
  if (!houndActor?.uuid) return "";
  return `<button type="button" class="wh-hunter-warp-btn" data-actor-uuid="${esc(houndActor.uuid)}">
    ${rollIcon("burst", "#ff6b6b")}Гончая возвращается в Варп
  </button>`;
}
