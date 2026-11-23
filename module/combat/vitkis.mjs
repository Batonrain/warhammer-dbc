// module/combat/vitkis.mjs
// Виткис — Foundry-сторона rules/vitkis-talents.mjs: кнопка Провидца Войны
// (тест, выбор эффекта, флаг), Всеведающий (вопрос ГМу шёпотом с боевым
// профилем цели), Убийца Ведьм (Sanctified за Очко), Отец Крови (+1d5).

import { esc, _degWord } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { isThrottleReady, markThrottleUsed } from "../rules/cooldown.mjs";
import { gainResource } from "../apps/resource-pools.mjs";
import { actorHasInfamyPoint, actorInfamyPath, spendFromInfamyPool } from "../apps/infamy-points.mjs";
import {
  WAR_SEER_FLAG, WITCHSLAYER_FLAG, WAR_SEER_BONUS, WAR_SEER_EFFECTS,
  hasWarSeer, hasAllKnowing, bookParryReactionFlag, hasBloodFather, hasBookOfBattle, hasBrothersAtArms, hasWitchslayer,
  warSeerMaxSplits, harderTheyFallDeg, bloodFeudPersistent, mergeWarSeer, warSeerEntries, warSeerAtTurnStart
} from "../rules/vitkis-talents.mjs";
import { targetActors, firstTargetActor, groupSpecValue, rollTestCard } from "./duelist-tests.mjs";
import { PARRY_ONLY_REACTION_FLAG } from "./action-economy.mjs";

const NS = "warhammer-dbc";
const combatIdNow = () => (game.combat?.started ? game.combat.id : "");
const line = (actor, icon, title, lines, opts = {}) => postTestCard(actor, {
  icon, title: `${title} — ${esc(actor.name)}`,
  lines: lines.filter(Boolean).map(l => `<div class="roll-threshold">${l}</div>`)
}, { sound: false, ...opts });

/** Распределить Успехи: [{ target, effect, deg }] или null (отмена). */
async function distributeWarSeer(actor, targets, deg) {
  const splits = warSeerMaxSplits(actor);
  const brothers = hasBrothersAtArms(actor);
  const effRows = Object.entries(WAR_SEER_EFFECTS);
  if (splits <= 1) {
    const t = targets[0];
    const radios = effRows.map(([k, e], i) =>
      `<label style="display:block;margin:2px 6px;"><input type="radio" name="eff" value="${k}" ${i === 1 ? "checked" : ""}/> <b>${esc(e.label)}</b> — ${esc(e.text)}</label>`).join("");
    const brotherBox = brothers ? `<label style="display:block;margin:6px;"><input type="checkbox" name="orders"/> Братья по Оружию: в рукопашной с целью — те же Успехи ещё и на Приказы</label>` : "";
    const res = await foundry.applications.api.DialogV2.wait({
      window: { title: `Провидец Войны: ${t.name}` }, classes: ["warhammer-dbc", "wh-holo"],
      content: `<p style="margin:4px 6px;">${deg} ${_degWord(deg)} против ${esc(t.name)}. Эффект:</p>${radios}${brotherBox}`,
      rejectClose: false,
      buttons: [{ action: "ok", label: "Принять", default: true, callback: (ev, b) => ({
        eff: b.form.elements.eff.value, orders: !!b.form.elements.orders?.checked }) }]
    });
    if (!res) return null;
    const out = [{ target: t, effect: res.eff, deg }];
    if (res.orders && res.eff !== "orders") out.push({ target: t, effect: "orders", deg });
    return out;
  }
  // Разделённое Видение: числа по парам «цель × эффект», сумма ≤ Успехов, не больше P.b пар.
  const rows = targets.map((t, ti) => `<tr><td>${esc(t.name)}</td>${effRows.map(([k]) =>
    `<td><input type="number" min="0" name="n.${ti}.${k}" value="0" style="width:3em"/></td>`).join("")}</tr>`).join("");
  const res = await foundry.applications.api.DialogV2.wait({
    window: { title: "Провидец Войны: Разделённое Видение" }, classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="margin:4px 6px;">${deg} ${_degWord(deg)} — разделите на до ${splits} целей/эффектов.</p>
      <table><tr><th></th>${effRows.map(([, e]) => `<th style="font-size:0.8em">${esc(e.label)}</th>`).join("")}</tr>${rows}</table>
      ${brothers ? `<p style="font-size:0.85em;margin:4px 6px;">Братья по Оружию: Приказы против цели в рукопашной можно ставить теми же Успехами, что и другой эффект.</p>` : ""}`,
    rejectClose: false,
    buttons: [{ action: "ok", label: "Принять", default: true, callback: (ev, b) => Object.fromEntries(new FormData(b.form)) }]
  });
  if (!res) return null;
  const out = [];
  for (const [k, v] of Object.entries(res)) {
    const n = Math.max(0, Math.trunc(Number(v) || 0));
    if (!n) continue;
    const [, ti, eff] = k.split(".");
    out.push({ target: targets[Number(ti)], effect: eff, deg: n });
  }
  const spent = out.filter(o => !(brothers && o.effect === "orders")).reduce((s, o) => s + o.deg, 0);
  if (spent > deg) { ui.notifications.warn(`⚠️ Распределено ${spent} Успехов, а есть ${deg}.`); return null; }
  if (out.length > splits) { ui.notifications.warn(`⚠️ Не больше ${splits} целей/эффектов (P.b).`); return null; }
  return out;
}

/** Провидец Войны: раз в Ход свободным действием Common Lore(War)(I)+10 по цели (целям). */
export async function useWarSeer(actor) {
  if (!actor || !hasWarSeer(actor)) return ui.notifications.warn("⚠️ У актора нет Черты Провидец Войны.");
  const flagKey = "vitkis.warSeer";
  if (!isThrottleReady(actor, flagKey, "round")) return ui.notifications.warn("⚠️ Провидец Войны — раз в Ход, уже было.");
  const all = targetActors().filter(t => t !== actor);
  if (!all.length) return ui.notifications.warn("⚠️ Наведите цель (с Разделённым Видением — несколько).");
  const targets = all.slice(0, warSeerMaxSplits(actor));
  await markThrottleUsed(actor, flagKey, "round");
  const lore = groupSpecValue(actor, "commonLore", "war", "int");
  const res = await rollTestCard(actor, {
    icon: "👁️", title: "Провидец Войны", label: "Common Lore (War)", base: lore.value,
    mod: WAR_SEER_BONUS, modLabel: "Провидец Войны", ctx: { kind: "skill", char: "int", skill: "commonLore" },
    lines: r => [r.success ? `Точное местоположение: ${targets.map(t => esc(t.name)).join(", ")} — до начала следующего Хода.` : "Поток битвы не раскрылся."]
  });
  if (!res.success) return;
  const picks = await distributeWarSeer(actor, targets, res.deg);
  if (!picks?.length) return;
  const entries = picks.map(p => {
    const deg = harderTheyFallDeg(actor, p.deg, p.target);
    return {
      targetUuid: p.target.uuid, targetId: p.target.id, targetName: p.target.name,
      effect: p.effect, deg, persistent: bloodFeudPersistent(actor, p.target),
      book: hasBookOfBattle(actor) && (p.effect === "dmg" || p.effect === "hit")
    };
  });
  const cid = combatIdNow();
  const prev = warSeerEntries(actor, cid);
  await actor.setFlag(NS, WAR_SEER_FLAG, { combatId: cid, entries: mergeWarSeer(prev, entries) });
  // Книга Битвы: +1 Реакция только на Парирование атак цели (не в общий пул Избеганий; Sahara 586-961c).
  const bookFlag = bookParryReactionFlag(entries);
  const book = !!bookFlag;
  if (bookFlag) await actor.setFlag(NS, PARRY_ONLY_REACTION_FLAG, bookFlag);
  await line(actor, "👁️", "Провидец Войны: эффект", [
    ...entries.map(e => `<b>${esc(e.targetName)}</b> — ${esc(WAR_SEER_EFFECTS[e.effect].text).replace("Успехи", `Успехи (${e.deg})`)}${e.persistent ? " — Кровная Вражда: до конца боя" : " — до начала следующего Хода"}.`),
    entries.some(e => e.deg !== picks.find(p => p.target.uuid === e.targetUuid && p.effect === e.effect)?.deg) ? "Тем Больнее Им Падать: Успехи умножены на Размер цели." : "",
    book ? "Книга Битвы: цель получает −3×Успехи на атаки по Виткису (ставится само); +1 Реакция только на Парирование её атак до начала следующего Хода (тратится сама, раньше общей)." : "",
    "Атака, урон, встречные тесты и Избегания цели считаются сами; Приказы — галочка в окне Командования; «не обмануть»: Финт цели проигрывается сам, прочие тесты обмана — за столом."
  ]);
}

/** Начало Хода Виткиса: временные эффекты гаснут, Кровная Вражда остаётся. */
export async function expireWarSeerAtTurnStart(actor) {
  const f = actor?.getFlag?.(NS, WAR_SEER_FLAG);
  if (!f) return;
  const next = warSeerAtTurnStart(f);
  if (next) await actor.setFlag(NS, WAR_SEER_FLAG, next);
  else await actor.unsetFlag(NS, WAR_SEER_FLAG);
}

/** Конец боя: эффекты Провидца и метка Убийцы Ведьм снимаются. */
export async function clearWarSeer(combat) {
  for (const c of combat?.combatants ?? []) {
    const a = c.actor;
    if (a?.getFlag?.(NS, WAR_SEER_FLAG)) await a.unsetFlag(NS, WAR_SEER_FLAG);
    if (a?.getFlag?.(NS, WITCHSLAYER_FLAG)) await a.unsetFlag(NS, WITCHSLAYER_FLAG);
  }
}

/** Убийца Ведьм: Очко Бесчестия — следующая рукопашная атака под Провидцем (урон/попадание) получает Sanctified. */
export async function useWitchslayer(actor) {
  if (!actor || !hasWitchslayer(actor)) return ui.notifications.warn("⚠️ У актора нет Таланта Убийца Ведьм.");
  const active = warSeerEntries(actor, combatIdNow()).some(e => e.effect === "dmg" || e.effect === "hit");
  if (!active) return ui.notifications.warn("⚠️ Нужен действующий Провидец Войны на урон или попадание рукопашных атак.");
  if (!actorHasInfamyPoint(actor)) return ui.notifications.warn("⚠️ Нет Очка Бесчестия.");
  const path = actorInfamyPath(actor);
  const spend = await spendFromInfamyPool(actor, 1, path);
  if (!spend) return;
  if (spend.poolSpent) await actor.update({ [path]: spend.poolValue });
  await actor.setFlag(NS, WITCHSLAYER_FLAG, true);
  await line(actor, "🗡️", "Убийца Ведьм", [
    "Потрачено 1 Очко Бесчестия: следующая рукопашная атака получает свойство Sanctified — ставится само.",
    "Для личной Команды атаковать — Sanctified получает атака подчинённого (ГМ отмечает вручную)."
  ]);
}

/** Всеведающий: раз в Ход вопрос ГМу о боевых способностях цели — ГМу уходит её боевой профиль. */
export async function useAllKnowing(actor) {
  if (!actor || !hasAllKnowing(actor)) return ui.notifications.warn("⚠️ У актора нет Черты Всеведающий.");
  const flagKey = "vitkis.allKnowing";
  if (!isThrottleReady(actor, flagKey, "round")) return ui.notifications.warn("⚠️ Всеведающий — раз в Ход, уже было.");
  const t = firstTargetActor();
  if (!t) return ui.notifications.warn("⚠️ Наведите цель — персонажа, о котором вопрос.");
  const question = await foundry.applications.api.DialogV2.wait({
    window: { title: `Всеведающий: ${t.name}` }, classes: ["warhammer-dbc", "wh-holo"],
    content: `<p style="margin:4px 6px;">Вопрос ГМу о боевых способностях ${esc(t.name)}:</p><input type="text" name="q" style="width:100%"/>`,
    rejectClose: false,
    buttons: [{ action: "ok", label: "Спросить", default: true, callback: (ev, b) => String(b.form.elements.q.value ?? "").trim() }]
  });
  if (!question) return;
  await markThrottleUsed(actor, flagKey, "round");
  const names = type => [...(t.items ?? [])].filter(i => i.type === type).map(i => esc(i.name));
  const weapons = [...(t.items ?? [])].filter(i => i.type === "weapon" && i.system?.equipped).map(i => esc(i.name));
  const gms = game.users?.filter?.(u => u.isGM).map(u => u.id) ?? [];
  await line(actor, "👁️", `Всеведающий: вопрос о ${esc(t.name)}`, [
    `«${esc(question)}»`,
    `<b>Оружие в руках:</b> ${weapons.join(", ") || "—"}`,
    `<b>Таланты:</b> ${names("talent").join(", ") || "—"}`,
    `<b>Черты:</b> ${names("trait").join(", ") || "—"}`,
    "ГМ: ответить честно, но только о боевых способностях и без объяснения, как они работают. Дары другого чемпиона не раскрываются, кроме Даров Кхорна."
  ], { whisper: gms });
  await line(actor, "👁️", "Всеведающий", [`Вопрос о ${esc(t.name)} задан ГМу.`]);
}

/** Отец Крови: особо внушительный подвиг — ГМ даёт +1d5 бонусных Очков (только на Командование). */
export async function useBloodFatherFeat(actor) {
  if (!actor || !hasBloodFather(actor)) return ui.notifications.warn("⚠️ У актора нет Черты Отец Крови.");
  const roll = await new Roll("1d5").evaluate();
  await gainResource(actor, "bloodFather", roll.total, { label: `Отец Крови: особый подвиг (+${roll.total})` });
}
