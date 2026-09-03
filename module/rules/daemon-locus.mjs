// module/rules/daemon-locus.mjs
// ════════════════════════════════════════════════════════════════════════
//  Радиус Локуса Герольда (Книга Хаоса, стр. 27, «Демонические Герольды»):
//  «Все дружественные демоны того же Бога, кроме высших демонов и
//  Демон-Принцев, в пределах ½W м от герольда считаются в радиусе его
//  Локуса.» Здесь — только минимум, нужный Локусу Фанатизма (wdbc-smc):
//  найти демонов рангом строго ниже герольда в этом радиусе и выдать им
//  cross-actor Трейт. Полный «раз в Ход переключить один из эффектов Локуса
//  свободным действием» (тот же абзац книги, общий для всех 26 Локусов) —
//  отдельная, гораздо более широкая задача, сюда не входит (см. wdbc-smc,
//  комментарий сессии 31.08.2026, и doombc-region-aoe-engine).
// ════════════════════════════════════════════════════════════════════════

import { DEMON_RANKS } from "../constants/demon-mechanics.mjs";
import { tokenDocDistance } from "../regions/auras.mjs";
import { esc } from "../helpers/utils.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";

const RANK_INDEX = Object.fromEntries(DEMON_RANKS.map((r, i) => [r.key, i]));

/**
 * Демоны того же Бога, рангом строго ниже герольда, в пределах ½W м на его
 * текущей сцене (стр. 27). Требует у герольда активный токен — без него
 * определить «радиус» не от чего.
 * @param {Actor} heraldActor
 * @returns {Actor[]}
 */
export function demonsInHeraldLocus(heraldActor) {
  const heraldToken = heraldActor?.getActiveTokens?.(false)?.[0];
  if (!heraldToken || !canvas?.scene) return [];
  const radius = (Number(heraldActor.system?.characteristics?.w?.total) || 0) / 2;
  const heraldRankIdx = RANK_INDEX[heraldActor.system?.rank] ?? RANK_INDEX.lesser;

  const out = [];
  for (const other of canvas.scene.tokens) {
    if (other.id === heraldToken.id) continue;
    const actor = other.actor;
    if (!actor || actor.type !== "daemon") continue;
    if (actor.system?.allegiance !== heraldActor.system?.allegiance) continue;
    const rankIdx = RANK_INDEX[actor.system?.rank];
    // Строго ниже герольда — тот же порядок автоматически исключает Высших
    // демонов/Демон-Принцев (они выше в DEMON_RANKS), как и требует книга.
    if (rankIdx === undefined || rankIdx >= heraldRankIdx) continue;
    if (tokenDocDistance(heraldToken, other, canvas.scene.grid) > radius) continue;
    out.push(actor);
  }
  return out;
}

const TOUCHED_BY_FATES_NAME = "Touched by the Fates";

/**
 * Локус Фанатизма (стр. 28, wdbc-smc): герольд даёт каждому демону рангом
 * ниже себя в радиусе Локуса Трейт Touched by the Fates (1) — а если он у
 * демона уже есть, восстанавливает 1 потраченное Очко Судьбы вместо
 * повторной выдачи. Списание цены (1 Очко Бесчестия) остаётся на вызывающем
 * коде (module/combat/capability-cost.mjs, тот же гейт ДО клика, что у
 * остальных возможностей с ценой) — эта функция только про сам эффект.
 * @param {Actor} heraldActor
 * @returns {Promise<boolean>} false — целей не нашлось, ничего не сделано
 */
export async function applyTouchedByFates(heraldActor) {
  const targets = demonsInHeraldLocus(heraldActor);
  if (!targets.length) {
    ui.notifications.warn("⚠️ Нет демонов рангом ниже в радиусе Локуса (½W м).");
    return false;
  }

  const traitPack = game.packs.get("warhammer-dbc.traits");
  const traitIndex = traitPack ? await traitPack.getIndex() : null;
  const traitEntry = traitIndex?.find(e => e.name.startsWith(TOUCHED_BY_FATES_NAME));
  const traitSource = traitEntry ? await traitPack.getDocument(traitEntry._id) : null;
  if (!traitSource) {
    ui.notifications.error("⚠️ Не найден Трейт Touched by the Fates в компендиуме traits.");
    return false;
  }

  const granted = [], restored = [];
  for (const actor of targets) {
    const has = actor.items.find(i => i.type === "trait" && i.name.startsWith(TOUCHED_BY_FATES_NAME));
    if (has) {
      const fate = actor.system.fate ?? {};
      const value = Math.min((Number(fate.value) || 0) + 1, Number(fate.max) || 0);
      if (value !== fate.value) await actor.update({ "system.fate.value": value });
      restored.push(actor.name);
    } else {
      const data = traitSource.toObject();
      delete data._id;
      await actor.createEmbeddedDocuments("Item", [data]);
      granted.push(actor.name);
    }
  }

  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor: heraldActor }),
    content: `<div class="wh-roll-result">
      <div class="roll-header">${rollIcon("bolt", "#c98bff")}Локус Фанатизма — ${esc(heraldActor.name)}</div>
      ${granted.length ? `<div class="roll-threshold">Получили Touched by the Fates: <b>${granted.map(esc).join(", ")}</b></div>` : ""}
      ${restored.length ? `<div class="roll-threshold">Восстановлено Очко Судьбы: <b>${restored.map(esc).join(", ")}</b></div>` : ""}
    </div>`
  }, game.settings.get("core", "rollMode")));
  return true;
}
