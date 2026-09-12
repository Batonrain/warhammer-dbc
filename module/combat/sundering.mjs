// module/combat/sundering.mjs
// ════════════════════════════════════════════════════════════════════════
//  Sundering / Разделение (Тзинч, wdbc-1rno) — Foundry-обвязка поверх
//  чистых преобразований module/rules/sundering.mjs. Три части:
//
//  1) spawnSunderingCopies — на смерти чемпиона (вызывается из death-save
//     диалога, sheets/tabs/death.mjs, ПОСЛЕ списания Очка Бесчестия) создаёт
//     двух Акторов-копий из toObject() САМОГО чемпиона (не из Бестиария —
//     единственная находка сессии, клонирующая самого игрового персонажа, а
//     не готовый бестиарный статблок), ставит им токены рядом с токеном
//     чемпиона, скрывает токен чемпиона («тело исчезло»), синхронизирует их
//     Combatant-инициативу с чемпионской (тот же приём, что the-hunter.mjs::
//     syncHoundInitiative — «действуют в его Инициативу»).
//  2) defaultSpawnSunderingFn — ГМ напрямую/сокет-релей, тот же приём, что
//     defaultSpawnDemonFn/defaultSpawnHunterHoundFn: создание нового Актора
//     обычно требует прав ГМа, не полагаемся на то, что умирающий игрок сам
//     их имеет.
//  3) revertSunderingOnSceneEnd — «в конце сцены обе копии исчезают, чемпион
//     возникает с 0 Ран на месте ОДНОЙ ИЗ НИХ (по выбору персонажа)»: диалог
//     выбора, если у копий разные позиции на холсте, иначе просто первая.
//     Вызывается тем же тактом, что уже даёт Кровавому Пламени
//     apps/game-session.mjs (breakBloodFlameOnSceneEnd) — «конец сцены» в
//     этой системе уже один общий сигнал, не два разных.
//
//  «Если обе копии убиты/изгнаны — смерть как обычно» — НЕ обрабатывается
//  отдельной кнопкой: флаг warhammer-dbc.deceased у чемпиона остаётся true
//  всё время, пока Разделение активно (тело реально «исчезло», это и есть
//  честная модель «формально ещё не ожил») — обычный диалог Спасения от
//  смерти (showDeathSaveDialog) уже открывается по этому же флагу в любой
//  момент, включая «обе копии пали»; отдельного триггера книга не даёт.
// ════════════════════════════════════════════════════════════════════════

import { sunderingCloneSystem, sunderingCloneTraits, SUNDERING_COPY_FLAG, SUNDERING_ACTIVE_FLAG }
  from "../rules/sundering.mjs";
import { currentScene } from "../constants/scene-nexus.mjs";
import { esc } from "../helpers/utils.mjs";

const FLAG = "warhammer-dbc";

/** Первый Combatant этого актора в бою — тот же приём, что the-hunter.mjs::findCombatant. */
function findCombatant(combat, actorId) {
  for (const c of combat?.combatants ?? []) if (c?.actorId === actorId) return c;
  return null;
}

/** Инициатива копии чуть ниже чемпиона (offset разный у двух копий, чтобы не совпасть). */
async function syncCopyInitiative(copyCombatant, championCombatant, offset) {
  const raw = championCombatant?.initiative;
  if (raw === null || raw === undefined) return;
  const v = Number(raw);
  if (!Number.isFinite(v)) return;
  await copyCombatant.update({ initiative: v - offset });
}

/**
 * Создаёт ОДНОГО Актора-копию + токен на сцене чемпиона, рядом с его
 * токеном (grid-смещение по X, разное у двух копий — index различает их).
 */
async function createSunderingCopy(champion, championToken, scene, index) {
  const data = champion.toObject();
  delete data._id;
  data.name = `${champion.name} (Копия ${index})`;
  data.system = sunderingCloneSystem(data.system);
  data.items = [...(data.items ?? []), ...sunderingCloneTraits()];
  data.flags = {
    ...(data.flags ?? {}),
    [FLAG]: {
      ...(data.flags?.[FLAG] ?? {}),
      [SUNDERING_COPY_FLAG]: { championUuid: champion.uuid, index }
    }
  };
  const copy = await Actor.create(data);
  if (!copy) return null;

  const grid = scene?.grid?.size || 100;
  const baseX = championToken ? championToken.x : (scene?.dimensions?.width ?? 2000) / 2;
  const baseY = championToken ? championToken.y : (scene?.dimensions?.height ?? 2000) / 2;
  const x = baseX + grid * index;
  const y = baseY + grid;
  const tokenDoc = await copy.getTokenDocument({ x, y });
  const [placed] = await scene.createEmbeddedDocuments("Token", [tokenDoc.toObject()]);
  return { actor: copy, token: placed };
}

/**
 * GM-side: две копии чемпиона на его смерти. Вызывающая сторона
 * (sheets/tabs/death.mjs) уже списала Очко Бесчестия ДО этого вызова —
 * здесь только спавн, метки и синхронизация инициативы.
 * @returns {Promise<{ok:boolean, reason?:string, copyUuids?:string[]}>}
 */
export async function spawnSunderingCopies(championUuid) {
  const champion = await fromUuid(championUuid).catch(() => null);
  if (!champion) return { ok: false, reason: "Не удалось найти чемпиона." };

  const scene = currentScene();
  if (!scene) return { ok: false, reason: "Нет активной сцены — копии не размещены." };
  const championToken = champion.getActiveTokens?.(false, true)?.[0] ?? null;

  const first  = await createSunderingCopy(champion, championToken, scene, 1);
  const second = await createSunderingCopy(champion, championToken, scene, 2);
  if (!first || !second) return { ok: false, reason: "Не удалось создать одну из копий." };

  const combat = game.combat;
  if (combat) {
    const championCombatant = findCombatant(combat, champion.id);
    if (championCombatant) {
      for (const [copy, offset] of [[first, 0.01], [second, 0.02]]) {
        let copyCombatant = findCombatant(combat, copy.actor.id);
        if (!copyCombatant) {
          const [created] = await combat.createEmbeddedDocuments("Combatant",
            [{ actorId: copy.actor.id, tokenId: copy.token?.id ?? null, initiative: null }]);
          copyCombatant = created;
        }
        if (copyCombatant) await syncCopyInitiative(copyCombatant, championCombatant, offset);
      }
    }
  }

  if (championToken) await championToken.update({ hidden: true });
  await champion.setFlag(FLAG, SUNDERING_ACTIVE_FLAG, {
    copyUuids: [first.actor.uuid, second.actor.uuid],
    tokenHidden: !!championToken
  });

  return { ok: true, copyUuids: [first.actor.uuid, second.actor.uuid] };
}

/** ГМ — напрямую; иначе сокет-релей (обработчик — warhammer-dbc.mjs, action:"spawnSundering"). */
export async function defaultSpawnSunderingFn(championUuid) {
  if (!championUuid) return;
  if (game.user?.isGM) {
    const res = await spawnSunderingCopies(championUuid);
    if (!res.ok) ui.notifications?.warn(res.reason);
    return;
  }
  if (!game.users?.activeGM) {
    ui.notifications?.warn("Нет активного Мастера — копии Разделения нужно создать вручную.");
    return;
  }
  game.socket?.emit("system.warhammer-dbc", { action: "spawnSundering", userId: game.user?.id, championUuid });
}

/** Удаляет Актора-копию (если ещё существует) и, вместе с ним, её токен на текущей сцене. */
async function deleteSunderingCopy(uuid) {
  const copy = await fromUuid(uuid).catch(() => null);
  if (!copy) return null;
  const token = copy.getActiveTokens?.(false, true)?.[0] ?? null;
  await copy.delete();
  return token;
}

/**
 * Конец сцены/сессии (module/apps/game-session.mjs, тот же такт, что
 * breakBloodFlameOnSceneEnd) — для каждого актора с активным Разделением:
 * удаляет обе копии, возвращает чемпиона на сцену с 0 Ран на месте одной из
 * копий (по выбору игрока — диалог, если у копий разные позиции; иначе
 * первая позиция без диалога), снимает флаг.
 */
export async function revertSunderingOnSceneEnd() {
  for (const champion of game.actors ?? []) {
    const active = champion.getFlag?.(FLAG, SUNDERING_ACTIVE_FLAG);
    if (!active?.copyUuids?.length) continue;

    const positions = [];
    for (const uuid of active.copyUuids) {
      const copy = await fromUuid(uuid).catch(() => null);
      const token = copy?.getActiveTokens?.(false, true)?.[0] ?? null;
      if (token) positions.push({ x: token.x, y: token.y });
    }
    for (const uuid of active.copyUuids) await deleteSunderingCopy(uuid);

    const championToken = champion.getActiveTokens?.(false, true)?.[0] ?? null;
    let chosen = positions[0] ?? null;
    if (positions.length > 1 && championToken) {
      chosen = await new Promise(resolve => new Dialog({
        title: `${esc(champion.name)}: где возникнуть после Разделения?`,
        content: `<p>Обе копии исчезают — выберите, на месте какой из них возникает ${esc(champion.name)}.</p>`,
        buttons: {
          first:  { label: "Копия 1", callback: () => resolve(positions[0]) },
          second: { label: "Копия 2", callback: () => resolve(positions[1]) }
        },
        default: "first",
        close: () => resolve(positions[0])
      }).render(true));
    }
    if (championToken && chosen) await championToken.update({ x: chosen.x, y: chosen.y, hidden: false });
    else if (championToken && active.tokenHidden) await championToken.update({ hidden: false });

    // «Возникает... с 0 Ран» — буквально 0, не полное исцеление (та же
    // граница «0 Ран» — начало Критических, book's «на грани смерти», не
    // «здоров»): прямая установка, не computeWoundHealing (та лечит НА
    // сколько-то очков, а не «до» конкретного значения).
    await champion.update({
      "system.wounds.value": 0, "system.wounds.critical": 0,
      [`flags.${FLAG}.deceased`]: false
    });
    await champion.unsetFlag(FLAG, SUNDERING_ACTIVE_FLAG);
  }
}
