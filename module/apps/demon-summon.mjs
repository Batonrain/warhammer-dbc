// module/apps/demon-summon.mjs
// ════════════════════════════════════════════════════════════════════════
//  Токен призванного демона на сцене — при успехе ритуала движкового типа
//  "summon" (module/apps/ritual-cast.mjs). Бестиарий (packs/bestiary) держит
//  ownership.PLAYER:"NONE" (стр. секретности статблоков, system.json) —
//  игрок НЕ может читать компендиум напрямую, поэтому в диалоге проведения
//  (module/sheets/ritual-cast-dialog.mjs) он вписывает имя демона и его Inf
//  ВРУЧНУЮ (ГМ называет их за столом), а поиск в Бестиарии по этому имени и
//  создание Актора/Токена делает активный ГМ — напрямую или сокет-релеем
//  (action:"summonDemon", тот же приём, что у veilShift/itemUpdate в
//  warhammer-dbc.mjs).
//
//  Каждый вызов создаёт НОВУЮ копию Актора из Бестиария (не переиспользует
//  прежний): два одновременно призванных демона одного вида не должны шарить
//  Раны/состояния (тот же принцип, что у выдачи Миньона, apps/minion-creator.mjs).
// ════════════════════════════════════════════════════════════════════════

import { currentScene } from "../constants/scene-nexus.mjs";

const BESTIARY_PACK = "warhammer-dbc.bestiary";

/** "English Name / Русское Имя" → русская часть, как в doombc-english-names-project. */
function ruName(name) {
  const parts = String(name || "").split(" / ");
  return (parts.length > 1 ? parts.at(-1) : name).trim();
}

/** Точное (без учёта регистра) совпадение по русской или полной подписи. */
async function findBestiaryActor(name) {
  const pack = game.packs?.get(BESTIARY_PACK);
  if (!pack) return null;
  const index = await pack.getIndex();
  const needle = String(name || "").trim().toLowerCase();
  if (!needle) return null;
  const hit = index.find(e =>
    e.name.toLowerCase() === needle || ruName(e.name).toLowerCase() === needle);
  return hit ? pack.getDocument(hit._id) : null;
}

/**
 * Создать нового Актора-демона (копия из Бестиария) и токен на текущей
 * сцене — рядом с токеном ритуалиста, если он выбран на холсте, иначе в
 * центре сцены. Только ГМ: вызывающий код сам решает прямой вызов/релей
 * (см. defaultSpawnDemonFn ниже).
 * @returns {Promise<{ok:boolean, reason?:string, actorName?:string}>}
 */
export async function spawnDemonOnScene(name, ritualistUuid = "") {
  const src = await findBestiaryActor(name);
  if (!src) return { ok: false, reason: `Демон «${name}» не найден в Бестиарии — разместите токен вручную.` };

  const scene = currentScene();
  if (!scene) return { ok: false, reason: "Нет активной сцены — токен демона не размещён." };

  const data = src.toObject();
  delete data._id;
  const actor = await Actor.create(data);
  if (!actor) return { ok: false, reason: "Не удалось создать Актора демона." };

  let x = scene.dimensions?.width ? scene.dimensions.width / 2 : 1000;
  let y = scene.dimensions?.height ? scene.dimensions.height / 2 : 1000;
  const ritualistActor = ritualistUuid ? await fromUuid(ritualistUuid).catch(() => null) : null;
  const ritualistToken = ritualistActor
    ? canvas?.tokens?.placeables?.find(t => t.actor?.uuid === ritualistActor.uuid) : null;
  if (ritualistToken) {
    const grid = scene.grid?.size || 100;
    x = ritualistToken.document.x + grid;
    y = ritualistToken.document.y + grid;
  }

  const tokenDoc = await actor.getTokenDocument({ x, y });
  await scene.createEmbeddedDocuments("Token", [tokenDoc.toObject()]);
  return { ok: true, actorName: actor.name };
}

/**
 * ГМ — напрямую; иначе — сокет-релей (обработчик — warhammer-dbc.mjs,
 * action:"summonDemon"). Не бросает: результат уходит уведомлением ГМу
 * (нет активного ГМа — предупреждение игроку, без токена).
 */
export async function defaultSpawnDemonFn(name, ritualistUuid) {
  if (!name) return;
  if (game.user?.isGM) {
    const res = await spawnDemonOnScene(name, ritualistUuid);
    if (!res.ok) ui.notifications?.warn(res.reason);
    return;
  }
  if (!game.users?.activeGM) {
    ui.notifications?.warn("Нет активного Мастера — токен демона не размещён, разместите вручную.");
    return;
  }
  game.socket?.emit("system.warhammer-dbc",
    { action: "summonDemon", userId: game.user?.id, name, ritualistUuid });
}
