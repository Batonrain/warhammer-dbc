// module/combat/bodyguard.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Bodyguard / Телохранитель (Талант Избегания, глава 3): «Он может парировать
//  атаки по союзнику, если атакующий находится на расстоянии удара от
//  персонажа. При наличии Талантов, позволяющих парировать стрелковые атаки, он
//  также может парировать стрелковые атаки по союзнику, если они проходят на
//  расстоянии удара от самого персонажа.»
//
//  Карточку атаки пишет атакующий, а кто из соседей может вступиться, знает
//  только сцена: при отрисовке карточки перебираем токены, и для каждого
//  носителя Таланта в контакте с атакующим (на одной стороне с целью) на
//  карточке появляется кнопка «Телохранитель: <имя>». Нажатие — обычное
//  Парирование этого персонажа (combat/defense.mjs::_performParry), его Реакцией
//  и его оружием; условия «контакт для стрельбы» и «Талант на парирование
//  стрельбы» проверяет само Парирование, уже относительно телохранителя.
// ════════════════════════════════════════════════════════════════════════════

import { hasDodgeTalent, bodyguardTokens } from "../rules/dodge-talents.mjs";
import { contactType } from "../rules/tactical-map.mjs";
import { tokenRect } from "./horde-tokens.mjs";

/**
 * Кто может вступиться за цель этой атаки.
 * @param {{attackerToken:object, targetToken:object, tokens?:object[]}} p
 * @returns {{uuid:string, name:string}[]}
 */
export function bodyguardsFor({ attackerToken, targetToken, tokens = globalThis.canvas?.tokens?.placeables ?? [] } = {}) {
  if (!attackerToken || !targetToken) return [];
  const attackerRect = tokenRect(attackerToken);
  if (!attackerRect) return [];
  const describe = t => {
    const actor = t.actor ?? t.document?.actor ?? null;
    const rect = tokenRect(t);
    return {
      id: t.id ?? t.document?.id, actor, name: t.name ?? actor?.name ?? "?",
      disposition: Number((t.document ?? t).disposition) || 0,
      hasTalent: !!actor && hasDodgeTalent(actor, "bodyguard"),
      inContact: !!rect && contactType(rect, attackerRect) !== "none"
    };
  };
  const targetDoc = targetToken.document ?? targetToken;
  const list = bodyguardTokens(tokens.map(describe), {
    targetId: targetToken.id ?? targetDoc.id, attackerId: attackerToken.id ?? attackerToken.document?.id,
    targetDisposition: Number(targetDoc.disposition) || 0
  });
  return list.map(t => ({ uuid: t.actor.uuid, name: t.name }));
}
