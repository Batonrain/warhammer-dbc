// module/combat/aegis-of-will.mjs
// Эгида Воли (rules/aegis-of-will.mjs): окно «кого из накрытых исключить».
// Вызывается из hooks.mjs после размещения шаблона психосилы. Закрыли окно —
// цели остаются как есть.

import { esc } from "../helpers/utils.mjs";
import { aegisApplies, aegisLimit, psykerRatingOf, applyAegisExclusion } from "../rules/aegis-of-will.mjs";

export async function offerAegisExclusion(casterUuid, itemUuid, tokens) {
  if (!tokens?.length || !casterUuid || !itemUuid) return tokens;
  const casterDoc = await fromUuid(casterUuid).catch(() => null);
  const caster = casterDoc?.actor ?? casterDoc;
  const item = await fromUuid(itemUuid).catch(() => null);
  if (!aegisApplies(caster, item)) return tokens;
  const limit = aegisLimit(psykerRatingOf(caster));
  const rows = tokens.map(t =>
    `<label style="display:block"><input type="checkbox" name="aegis" value="${esc(t.id)}"> ${esc(t.name)}</label>`).join("");
  const picked = await foundry.applications.api.DialogV2.wait({
    window: { title: "Эгида Воли" },
    content: `<p>Исключить из воздействия до <b>${limit}</b> накрытых (½PR, окр. вверх):</p>${rows}`,
    buttons: [
      { action: "ok", label: "Исключить отмеченных", default: true,
        callback: (_ev, button) => [...button.form.querySelectorAll('input[name="aegis"]:checked')].map(i => i.value) },
      { action: "none", label: "Никого" }
    ],
    rejectClose: false
  }).catch(() => null);
  const ids = Array.isArray(picked) ? picked : [];
  if (ids.length > limit) ui.notifications?.warn(`Эгида Воли: можно исключить не больше ${limit} — взяты первые ${limit}.`);
  const kept = applyAegisExclusion(tokens, ids, limit);
  if (kept.length < tokens.length) {
    ui.notifications?.info(`Эгида Воли: исключено ${tokens.length - kept.length}.`);
  }
  return kept;
}
