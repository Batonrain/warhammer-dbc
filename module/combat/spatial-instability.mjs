// module/combat/spatial-instability.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Пространственная Нестабильность / Spatial Instability (wdbc-1rno.8) —
//  кнопки мутации. Арифметика — rules/spatial-instability.mjs.
//
//   • «Стать Бесплотным» — Incorporeal на Cor.b Раундов (метка tempGrant,
//     снимается сама на смену Раунда, rules/temp-grant.mjs), не чаще раза в
//     (12−Cor.b) часов игрового времени; субм. 2-3 — Flyer (20), 4-5 — Страх +1
//     на то же время;
//   • «Вернуться в реальность» — свободным действием раньше срока;
//   • субм. 1 «Продление» — Очко Бесчестия: +Cor.b Раундов, или втянуть
//     выбранного согласного персонажа (получает ту же Бесплотность до того же
//     срока и вернётся вместе с носителем);
//   • субм. 6 «Ходок Снов» — войти в сон/выйти: таймер Бесплотности стоит;
//   • субм. 8 «Ненависть сквозь Завесу» — тест W−20: одна рукопашная атака по
//     материальной цели с его Hatred (разрешение — флаг veilPierce, гасит
//     окно атаки, sheets/attack/dialog.mjs);
//   • субм. 9 «Власть над Варпом» — тест W−30 раз в Ход (карточка);
//   • субм. 10 «Прорыв Грани» — Очко Бесчестия, полное действие: Варп-Прорыв
//     (1d100 по таблице) на ближайшего материального персонажа.
//  Субм. 7 «Разрушитель» (AP предметов сцены вдвое) — у предметов сцены нет
//  AP в системе: строка-напоминание в карточке Бесплотности.
// ════════════════════════════════════════════════════════════════════════════

import {
  SPATIAL_COOLDOWN_FLAG, SPATIAL_GRANT_FLAG, SPATIAL_DREAM_FLAG, VEIL_PIERCE_FLAG,
  spatialCooldownSeconds, spatialSubKind, extendTempGrant, dreamPause, dreamResume
} from "../rules/spatial-instability.mjs";
import { worldTimeRemaining } from "../rules/cooldown.mjs";
import { isIncorporealNow } from "../rules/incorporeal.mjs";
import { hatredTargetsOf } from "../rules/predicates.mjs";
import { anyTargetMatches } from "../rules/talent-targets.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { getPeril } from "../constants/psyker-tables.mjs";
import { changeActorInfamy, actorInfamyValue } from "../apps/infamy-points.mjs";
import { postTestCard, rollStatLine, outcomeHtml } from "../helpers/test-card.mjs";
import { rollIcon } from "../constants/roll-icons.mjs";
import { esc } from "../helpers/utils.mjs";

const NS = "warhammer-dbc";
const ICON = () => rollIcon("warp", "#b9a3ff");
const norm = s => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
const corBonusOf = actor => Number(actor?.system?.corruptionBonus) || 0;
const subOf = item => spatialSubKind(item?.system?.submutation?.label);
/** Черты, выданные этой мутацией (Incorporeal, Flyer) на акторе. */
const grantedItems = actor => [...(actor?.items ?? [])].filter(i => i?.flags?.[NS]?.[SPATIAL_GRANT_FLAG]);

/** Кнопка субмутации: у мутации должна выпасть именно эта строка (кнопки Конструктора гейт when не читают). */
function requireSub(item, kind, title) {
  if (!item || subOf(item) === kind) return true;
  ui.notifications?.warn(`${title}: эта способность — другой субмутации (выпала «${item.system?.submutation?.label || "—"}»).`);
  return false;
}

async function card(actor, title, lines = [], extra = {}) {
  await postTestCard(actor, { icon: ICON(), title: `${esc(title)} — ${esc(actor.name)}`,
    lines: lines.map(l => `<div class="roll-threshold">${l}</div>`), ...extra }, { sound: false });
}

/** Сколько секунд до следующего раза; 0 — можно. */
export function spatialCooldownLeft(item, actor, worldTime = game.time.worldTime) {
  return worldTimeRemaining(item?.getFlag?.(NS, SPATIAL_COOLDOWN_FLAG), worldTime, spatialCooldownSeconds(corBonusOf(actor)));
}

/** Черты из пака по имени (англ. половина). */
async function traitDocs() {
  const pack = game.packs.get("warhammer-dbc.traits");
  return pack ? await pack.getDocuments() : [];
}

function grantData(doc, tempGrant, owner) {
  const o = doc.toObject(); delete o._id;
  o.flags = { ...(o.flags || {}), [NS]: { ...(o.flags?.[NS] || {}), tempGrant, [SPATIAL_GRANT_FLAG]: owner } };
  return o;
}

/** Кнопка «Стать Бесплотным». */
export async function activateSpatialInstability(actor, item) {
  if (!actor || !item) return null;
  if (grantedItems(actor).length || isIncorporealNow(actor)) {
    ui.notifications?.warn("Пространственная Нестабильность: персонаж уже Бесплотен.");
    return null;
  }
  if (!game.combat) {
    ui.notifications?.warn("Пространственная Нестабильность: вне боя Раунды считать не от чего — Бесплотность действует Cor.b Раундов, выдайте Черту вручную, если нужно вне боя.");
    return null;
  }
  const left = spatialCooldownLeft(item, actor);
  if (left > 0) {
    const h = Math.floor(left / 3600), m = Math.ceil((left % 3600) / 60);
    ui.notifications?.warn(`Пространственная Нестабильность: снова можно через ${h} ч ${m} мин (раз в ${12 - corBonusOf(actor)} ч).`);
    return null;
  }
  const corB = corBonusOf(actor);
  const sub = subOf(item);
  const lib = await traitDocs();
  const byName = n => lib.find(doc => norm(doc.name.split("/")[0]) === n);
  const tempGrant = { unit: "round", combatId: game.combat.id, expiresAtRound: game.combat.round + corB, label: "Пространственная Нестабильность" };
  const docs = [];
  const extra = [];
  const inc = byName("incorporeal");
  if (inc) {
    const d = grantData(inc, tempGrant, actor.uuid);
    if (sub === "fear") {
      d.effects = [...(d.effects || []), {
        name: "Пространственная Нестабильность — Страх +1", img: d.img, transfer: true,
        system: { changes: [{ key: "system.fearRating", type: "add", value: 1, phase: "final", priority: 0 }] }
      }];
      extra.push("Страх +1");
    }
    docs.push(d);
  }
  if (sub === "fly") {
    const fly = lib.find(doc => norm(doc.name.split("/")[0]).startsWith("flyer"));
    if (fly) {
      const f = grantData(fly, tempGrant, actor.uuid);
      f.name = "Flyer (20) / Летун (20)";
      f.system = { ...(f.system || {}), hasRating: true, rating: 20 };
      docs.push(f);
      extra.push("Flyer (20)");
    }
  }
  if (docs.length) await actor.createEmbeddedDocuments("Item", docs);
  await item.setFlag(NS, SPATIAL_COOLDOWN_FLAG, game.time.worldTime);
  const lines = [`Incorporeal${extra.length ? ` и ${extra.join(", ")}` : ""} на <b>${corB}</b> Раунд(ов) — снимется сам; вернуться раньше — кнопкой «Вернуться в реальность».`,
    `Следующий раз — через ${12 - corB > 0 ? `${12 - corB} ч` : "любое время"} игрового времени.`];
  if (sub === "destroyer") lines.push("Разрушитель: предметы, сквозь которые проходит персонаж, теряют половину AP до починки (окр.▲), несущие конструкции могут рухнуть — отметьте на сцене.");
  await card(actor, "Пространственная Нестабильность", lines);
  return docs.length;
}

/** Кнопка «Вернуться в реальность» — снять Бесплотность (свою и втянутых). */
export async function returnToReality(actor) {
  const mine = grantedItems(actor);
  if (!mine.length) { ui.notifications?.warn("Пространственная Нестабильность: персонаж не Бесплотен."); return 0; }
  await actor.deleteEmbeddedDocuments("Item", mine.map(i => i.id));
  // Втянутые союзники материализуются одновременно с ним.
  let dragged = 0;
  for (const t of game.scenes?.current?.tokens ?? []) {
    const a = t.actor;
    if (!a || a === actor) continue;
    const theirs = [...a.items].filter(i => i.flags?.[NS]?.[SPATIAL_GRANT_FLAG] === actor.uuid);
    if (theirs.length && a.isOwner) { await a.deleteEmbeddedDocuments("Item", theirs.map(i => i.id)); dragged++; }
  }
  if (actor.getFlag?.(NS, SPATIAL_DREAM_FLAG) != null) await actor.unsetFlag(NS, SPATIAL_DREAM_FLAG);
  await card(actor, "Возвращение в реальность", [`Бесплотность снята${dragged ? `, вместе с ним материализовались втянутые (${dragged})` : ""}.`]);
  return mine.length;
}

async function spendInfamy(actor, why) {
  if (actorInfamyValue(actor) < 1) { ui.notifications?.warn(`${why}: нет Очков Бесчестия.`); return false; }
  await changeActorInfamy(actor, -1);
  return true;
}

/**
 * Субм. 1 «Продление» (полудействие + Очко Бесчестия). Есть выбранные цели —
 * втягивает их (Бесплотность до того же срока), иначе +Cor.b Раундов себе.
 */
export async function extendSpatialInstability(actor, item, targets = []) {
  if (!requireSub(item, "extend", "Продление")) return null;
  const mine = grantedItems(actor);
  if (!mine.length) { ui.notifications?.warn("Продление: сначала станьте Бесплотным."); return null; }
  const tg = mine[0].flags[NS].tempGrant;
  const others = (targets ?? []).filter(a => a && a !== actor);
  if (!await spendInfamy(actor, "Продление")) return null;
  if (others.length) {
    const inc = (await traitDocs()).find(doc => norm(doc.name.split("/")[0]) === "incorporeal");
    const ok = [];
    for (const a of others) {
      if (!a.isOwner) continue;
      if (inc) await a.createEmbeddedDocuments("Item", [grantData(inc, tg, actor.uuid)]);
      ok.push(a.name);
    }
    await card(actor, "Продление Бесплотности", [`1 Очко Бесчестия: на ту сторону втянуты ${ok.map(esc).join(", ") || "— (нет прав на цели, выдайте Черту вручную)"} — материализуются вместе с ним.`]);
    return ok.length;
  }
  const next = extendTempGrant(tg, corBonusOf(actor));
  await actor.updateEmbeddedDocuments("Item", mine.map(i => ({ _id: i.id, [`flags.${NS}.tempGrant`]: next })));
  await card(actor, "Продление Бесплотности", [`1 Очко Бесчестия: +${corBonusOf(actor)} Раунд(ов), до конца Раунда ${next.expiresAtRound}.`]);
  return next.expiresAtRound;
}

/** Субм. 6 «Ходок Снов»: войти в сон (таймер стоит) / выйти (таймер идёт дальше). */
export async function toggleDreamWalk(actor, item = null) {
  if (!requireSub(item, "dream", "Ходок Снов")) return null;
  const mine = grantedItems(actor);
  if (!mine.length || !game.combat) { ui.notifications?.warn("Ходок Снов: персонаж должен быть Бесплотным в бою."); return null; }
  const tg = mine[0].flags[NS].tempGrant;
  const paused = actor.getFlag?.(NS, SPATIAL_DREAM_FLAG);
  if (paused == null) {
    const { left, tempGrant } = dreamPause(tg, game.combat.round);
    await actor.updateEmbeddedDocuments("Item", mine.map(i => ({ _id: i.id, [`flags.${NS}.tempGrant`]: tempGrant })));
    await actor.setFlag(NS, SPATIAL_DREAM_FLAG, left);
    await card(actor, "Ходок Снов", [`Вошёл в сновидения спящего/бессознательного — таймер Бесплотности стоит (осталось ${left} Раунд(ов)).`]);
    return "in";
  }
  const tempGrant = dreamResume(tg, game.combat.round, paused);
  await actor.updateEmbeddedDocuments("Item", mine.map(i => ({ _id: i.id, [`flags.${NS}.tempGrant`]: tempGrant })));
  await actor.unsetFlag(NS, SPATIAL_DREAM_FLAG);
  await card(actor, "Ходок Снов", [`Покинул сон — Бесплотность до конца Раунда ${tempGrant.expiresAtRound}.`]);
  return "out";
}

async function willTest(actor, mod, title) {
  const wp = Number(actor.system?.characteristics?.wp?.total) || 0;
  const mods = collectTestMods(actor, { kind: "skill", char: "wp" });
  const eff = wp + mod + mods.total;
  const roll = await new Roll("1d100").evaluate();
  const res = testOutcome(roll.total, eff);
  return { ...res, roll, eff, wp, parts: mods.parts, label: `W${mod}`, title };
}

/** Субм. 8 «Ненависть сквозь Завесу»: тест W−20 → одна рукопашная атака по материальной цели с Hatred. */
export async function hatredThroughVeil(actor, target, item = null) {
  if (!requireSub(item, "hatred", "Ненависть сквозь Завесу")) return null;
  if (!grantedItems(actor).length && !isIncorporealNow(actor)) { ui.notifications?.warn("Ненависть сквозь Завесу: персонаж должен быть Бесплотным."); return null; }
  if (!target) { ui.notifications?.warn("Ненависть сквозь Завесу: выберите цель."); return null; }
  if (!anyTargetMatches(hatredTargetsOf(actor), { targetActor: target })) {
    ui.notifications?.warn(`Ненависть сквозь Завесу: у ${actor.name} нет Таланта Hatred против ${target.name}.`);
    return null;
  }
  const t = await willTest(actor, -20, "Ненависть сквозь Завесу");
  if (t.success) await actor.setFlag(NS, VEIL_PIERCE_FLAG, { targetUuid: target.uuid, melee: true });
  await postTestCard(actor, {
    icon: ICON(), title: `Ненависть сквозь Завесу — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: t.label, base: t.wp, parts: ["Ненависть сквозь Завесу −20", ...t.parts], threshold: t.eff, rv: t.roll.total }),
    outcome: outcomeHtml(t.success, t.success
      ? `Успех (${t.deg}) — можно атаковать ${esc(target.name)} рукопашной сквозь Завесу (одна атака)`
      : `Провал (${t.deg}) — Завеса не пускает`)
  }, { rolls: [t.roll] });
  return t.success;
}

/** Субм. 9 «Власть над Варпом»: раз в Ход тест W−30 — психосилы по другому плану. */
export async function warpDominionTest(actor, item = null) {
  if (!requireSub(item, "warpPower", "Власть над Варпом")) return null;
  const t = await willTest(actor, -30, "Власть над Варпом");
  await postTestCard(actor, {
    icon: ICON(), title: `Власть над Варпом — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: t.label, base: t.wp, parts: ["Власть над Варпом −30", ...t.parts], threshold: t.eff, rv: t.roll.total }),
    outcome: outcomeHtml(t.success, t.success
      ? `Успех (${t.deg}) — в этот Ход психосилы действуют через Завесу (бесплотный → материальные или наоборот)`
      : `Провал (${t.deg}) — психосилы через Завесу в этот Ход не проходят`)
  }, { rolls: [t.roll] });
  return t.success;
}

/** Ближайший материальный персонаж к токену. */
function nearestMaterial(token) {
  const scene = token?.parent ?? game.scenes?.current;
  if (!token || !scene) return null;
  const grid = scene.grid?.size || 100;
  const cx = token.x + (token.width * grid) / 2, cy = token.y + (token.height * grid) / 2;
  let best = null;
  for (const t of scene.tokens) {
    if (t.id === token.id || t.hidden || !t.actor || isIncorporealNow(t.actor)) continue;
    const d = Math.hypot(t.x + (t.width * grid) / 2 - cx, t.y + (t.height * grid) / 2 - cy);
    if (!best || d < best.d) best = { t, d };
  }
  return best?.t ?? null;
}

/** Субм. 10 «Прорыв Грани»: полное действие + Очко Бесчестия → Варп-Прорыв на ближайшего материального. */
export async function breachTheVeil(actor, token, item = null) {
  if (!requireSub(item, "breach", "Прорыв Грани")) return null;
  if (!grantedItems(actor).length && !isIncorporealNow(actor)) { ui.notifications?.warn("Прорыв Грани: персонаж должен быть Бесплотным."); return null; }
  const tok = token?.document ?? token ?? actor.getActiveTokens?.(false, true)?.[0];
  const victim = nearestMaterial(tok);
  if (!victim) { ui.notifications?.warn("Прорыв Грани: рядом нет материальных персонажей."); return null; }
  if (!await spendInfamy(actor, "Прорыв Грани")) return null;
  const roll = await new Roll("1d100").evaluate();
  const peril = getPeril(roll.total);
  await postTestCard(actor, {
    icon: ICON(), title: `Прорыв Грани — ${esc(actor.name)}`,
    lines: [`<div class="roll-threshold">Полное действие, 1 Очко Бесчестия. Варп-Прорыв обрушивается на ближайшего материального: <b>${esc(victim.name)}</b>.</div>`,
            `<div class="roll-threshold">Варп-Прорыв ${roll.total}: <b>${esc(peril.label)}</b> — ${esc(peril.text)}</div>`]
  }, { rolls: [roll] });
  return { victim: victim.actor, peril };
}
