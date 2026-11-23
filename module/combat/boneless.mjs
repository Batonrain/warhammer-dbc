// module/combat/boneless.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Бескостный / Boneless (wdbc-1rno.9) — кнопки мутации. Логика —
//  rules/boneless.mjs; −20 S и +30 Карабканье аморфной формы —
//  rules/library/boneless.mjs; ½ I(Cr) и переломы — combat/damage.mjs.
//
//   • «Устоять на ногах»: в полном жёстком доспехе тест не нужен (и осевший
//     встаёт); без опоры — Athletics+0, провал — Черты Amorphous и Crawler
//     (оседает на землю), успех — осевший поднимается (Черты снимаются);
//   • «Четвероногий (1)»: броня торса модифицирована — Quadruped (1)
//     выдаётся/снимается по желанию игрока.
// ════════════════════════════════════════════════════════════════════════════

import { wearsFullRigidArmour, BONELESS_GRANT_FLAG } from "../rules/boneless.mjs";
import { skillTotalWith } from "./mech1-rolls.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";
const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const grants = (actor, kind) => [...(actor?.items ?? [])].filter(i => i?.flags?.[NS]?.[BONELESS_GRANT_FLAG] === kind);

async function packTraits(names) {
  const pack = game.packs.get("warhammer-dbc.traits");
  const lib = pack ? await pack.getDocuments() : [];
  return names.map(n => lib.find(d => norm(d.name.split("/")[0]).startsWith(n))).filter(Boolean);
}

function grantData(doc, kind, patch = {}) {
  const o = doc.toObject(); delete o._id;
  o.flags = { ...(o.flags || {}), [NS]: { ...(o.flags?.[NS] || {}), [BONELESS_GRANT_FLAG]: kind } };
  return foundry.utils.mergeObject(o, patch);
}

/** Кнопка «Устоять на ногах». @returns {Promise<"armour"|"stood"|"collapsed"|null>} */
export async function bonelessStand(actor) {
  if (!actor) return null;
  const collapsed = grants(actor, "collapse");
  if (wearsFullRigidArmour(actor)) {
    if (collapsed.length) await actor.deleteEmbeddedDocuments("Item", collapsed.map(i => i.id));
    await postTestCard(actor, { title: `Бескостный — ${esc(actor.name)}`,
      outcome: outcomeHtml(true, `Полный жёсткий доспех держит плоть как внешний скелет — тест не нужен${collapsed.length ? ", персонаж снова на ногах" : ""}`) }, { sound: false });
    return "armour";
  }
  const base = skillTotalWith(actor, { skill: "athletics" }) ?? 0;
  const mods = collectTestMods(actor, { kind: "skill", skill: "athletics", char: "s" });
  // Осевший встаёт тем же тестом — со своим −20 S аморфной формы (тест
  // Athletics идёт от S, книга исключает из штрафа только Карабканье).
  const eff = base + mods.total;
  const roll = await new Roll("1d100").evaluate();
  const { success, deg } = testOutcome(roll.total, eff);
  let result;
  if (success) {
    if (collapsed.length) await actor.deleteEmbeddedDocuments("Item", collapsed.map(i => i.id));
    result = "stood";
  } else {
    if (!collapsed.length) {
      const docs = await packTraits(["amorphous", "crawler"]);
      if (docs.length) await actor.createEmbeddedDocuments("Item", docs.map(d => grantData(d, "collapse")));
    }
    result = "collapsed";
  }
  await postTestCard(actor, {
    title: `Бескостный: устоять на ногах — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "Athletics+0", base, parts: mods.parts, threshold: eff, rv: roll.total }),
    outcome: success
      ? outcomeHtml(true, `Успех (${deg}) — стоит на ногах${collapsed.length ? " (поднялся)" : ""}`)
      : outcomeHtml(false, `Провал (${deg}) — оседает на землю: Amorphous и Crawler, −20 к тестам S, +30 Карабканье`)
  }, { rolls: [roll] });
  return result;
}

/** Кнопка «Четвероногий (1)»: выдать/снять Quadruped (1). */
export async function toggleBonelessQuadruped(actor) {
  const mine = grants(actor, "quadruped");
  if (mine.length) {
    await actor.deleteEmbeddedDocuments("Item", mine.map(i => i.id));
    ui.notifications?.info(`${actor.name}: Четвероногий (1) снят.`);
    return false;
  }
  const [doc] = await packTraits(["quadruped"]);
  if (!doc) { ui.notifications?.warn("Бескостный: Черта Quadruped не найдена в компендиуме."); return null; }
  await actor.createEmbeddedDocuments("Item", [grantData(doc, "quadruped", {
    name: "Quadruped (1) / Четвероногий (1)", system: { hasRating: true, rating: 1 } })]);
  ui.notifications?.info(`${actor.name}: Четвероногий (1) — броня торса модифицирована для гибкости хребта.`);
  return true;
}
