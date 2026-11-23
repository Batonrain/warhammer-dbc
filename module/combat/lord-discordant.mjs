// module/combat/lord-discordant.mjs
// ════════════════════════════════════════════════════════════════════════════
//  Лорд Дискордант (Элитные архетипы): кнопки Черт и Талантов и обход сцены
//  для ауры Порченной Ноосферы. Арифметика — rules/lord-discordant.mjs.
//  Успех кнопки — undefined, отказ — строка (цена/лимит не списываются).
// ════════════════════════════════════════════════════════════════════════════

import { esc } from "../helpers/utils.mjs";
import { postTestCard } from "../helpers/test-card.mjs";
import { sizeOf } from "../rules/predicates.mjs";
import {
  CORRUPTED_NOOSPHERE_PROCESS, UPLINK_COST, HELLBOUND_FLAG, SPIRIT_EFFECTS,
  hasDaemonicUplink, hasMachineSpiritThief, hasDiscordantDuo, hasHellbound, hasTorturedSpirit,
  isMounted, isTechPriest, noosphereAuraOn, noosphereRadius, stolenSpirits, spiritThiefRange, hellboundLimit, hellboundMark
} from "../rules/lord-discordant.mjs";

export { CORRUPTED_NOOSPHERE_PROCESS };

const NS = "warhammer-dbc";
const ICON = "☠️ ";
const warn = msg => { ui.notifications.warn(`⚠️ ${msg}`); return msg; };
const say = async (actor, title, lines, extra = {}, opts = {}) => {
  await postTestCard(actor, {
    icon: ICON, title: `${esc(title)} — ${esc(actor.name)}`,
    lines: lines.filter(Boolean).map(l => `<div class="roll-threshold">${l}</div>`), ...extra
  }, { sound: false, ...opts });
};

function distanceM(a, b) {
  const grid = globalThis.canvas?.grid ?? {};
  const size = Number(grid.size) || 100;
  const dist = Number(grid.distance) || 1;
  const ca = a.center ?? { x: a.x, y: a.y }, cb = b.center ?? { x: b.x, y: b.y };
  return Math.hypot(ca.x - cb.x, ca.y - cb.y) / size * dist;
}

const tokenOf = actor => actor?.getActiveTokens?.()?.[0] ?? null;
const mountName = actor => {
  const uuid = actor?.system?.mount?.uuid;
  return uuid ? (globalThis.fromUuidSync?.(uuid)?.name ?? "скакун") : "";
};

// ── Порченная Ноосфера ───────────────────────────────────────────────────────

/**
 * Corrupted Noosphere: «В ауре радиусом I.b м вокруг Лорда верхом на Адском
 * Сталкере все недружественные техножрецы увеличивают стоимость активации
 * Техночудес в 2 раза и суммарную стоимость Процессов на 2 Когниции».
 * @returns {Actor|null} Лорд, в чьей ауре стоит техножрец
 */
export function corruptedNoosphereLord(actor) {
  if (!isTechPriest(actor)) return null;
  const me = tokenOf(actor);
  if (!me) return null;
  const myDisp = me.document?.disposition ?? 0;
  for (const t of globalThis.canvas?.tokens?.placeables ?? []) {
    const lord = t.actor;
    if (!lord || lord === actor || !noosphereAuraOn(lord)) continue;
    if ((t.document?.disposition ?? 0) === myDisp) continue; // дружественный техножрец
    if (distanceM(me, t) <= noosphereRadius(lord)) return lord;
  }
  return null;
}

/**
 * «Каждый раз, когда недружественный техножрец опускает Когницию до 0, Лорд
 * получает 1 Когницию». Чужого Лорда (NPC Мастера) игрок записать не может —
 * тогда карточка просит Мастера.
 */
export async function corruptedNoosphereDrain(techPriest, lord, before, after) {
  if (!lord || !(Number(before) > 0) || Number(after) !== 0) return;
  const cog = lord.system?.cognition ?? {};
  const value = Number(cog.value) || 0;
  const max = Number(cog.max) || 0;
  const can = globalThis.game?.user?.isGM || lord.isOwner;
  if (can && value < max) await lord.update({ "system.cognition.value": value + 1 });
  await say(techPriest, "Порченная Ноосфера", [
    `Когниция опустилась до 0 в ауре ${esc(lord.name)} — Лорд получает 1 Когницию${can ? (value < max ? ` (${value} → ${value + 1})` : " (но уже на максимуме)") : " — Мастер, прибавьте её Лорду"}.`
  ]);
}

// ── Вор Духов Машины / Истерзанный Дух ───────────────────────────────────────

function dmgButton(actor, { damage, pen = 0, type = "energy", subtype = "", name, ignoreArmour = false }) {
  return `<button class="wh-apply-dmg-btn" type="button" data-damage="${damage}" data-penetration="${pen}"
    data-damage-type="${type}" data-damage-subtype="${subtype}" data-hit-location="Торс"
    data-weapon-name="${esc(name)}" data-attacker="${esc(actor.name)}" data-attacker-uuid="${actor.uuid}"
    data-ignore-armour="${ignoreArmour ? 1 : 0}">Применить урон: ${damage} → цели</button>`;
}

/**
 * Machine Spirit Thief: «Когда верхом… уничтожает технику или существо с
 * Трейтом Machine, Латами Скитарии или Имплантами Механикум, получает 1
 * украденный дух за каждый пункт Размера цели или каждые 3 пункта его I.b (что
 * больше), тратя сразу. За каждый дух вызывает один эффект…».
 * spirits — готовое число (Истерзанный Дух: 1); иначе считается по цели.
 */
export async function useMachineSpiritThief(actor, { spirits = null, source = "Вор Духов Машины" } = {}) {
  if (!actor || !hasMachineSpiritThief(actor)) return warn("У актора нет Черты Вор Духов Машины.");
  if (!isMounted(actor)) return warn("Только верхом на Адском Сталкере.");
  let n = spirits;
  if (n == null) {
    const victim = [...(game.user?.targets ?? [])][0]?.actor ?? null;
    const size = victim ? sizeOf(victim) : 0;
    const intB = Number(victim?.system?.characteristics?.int?.bonus) || 0;
    const raw = await foundry.applications.api.DialogV2.prompt({
      window: { title: `${source} — ${actor.name}` },
      content: `<form style="padding:4px 6px;"><p>Уничтоженная цель${victim ? `: <b>${esc(victim.name)}</b>` : " (выделите её целью или впишите числа)"}.</p>
        <label>Размер: <input type="number" name="size" value="${size}" style="width:50px;"/></label>
        <label>I.b: <input type="number" name="ib" value="${intB}" style="width:50px;"/></label></form>`,
      ok: { label: "Украсть духи", callback: (_e, b) => stolenSpirits({ size: b.form.elements.size.value, intB: b.form.elements.ib.value }) },
      rejectClose: false
    }).catch(() => null);
    if (raw == null) return "отмена";
    n = raw;
  }
  if (!(n > 0)) return warn("Духов не украдено (Размер и I.b цели слишком малы).");
  const range = spiritThiefRange(actor);
  const opts = Object.entries(SPIRIT_EFFECTS).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("");
  const rows = Array.from({ length: n }, (_, i) => `<div><label>Дух ${i + 1}: <select name="e${i}">${opts}</select></label></div>`).join("");
  const chosen = await foundry.applications.api.DialogV2.prompt({
    window: { title: `${source}: ${n} дух(а) — ${actor.name}` },
    content: `<form style="padding:4px 6px;"><p>Каждый эффект — на цели в пределах ${range} м (I×0,5).</p>${rows}</form>`,
    ok: { label: "Выпустить", callback: (_e, b) => Array.from({ length: n }, (_, i) => b.form.elements[`e${i}`].value) },
    rejectClose: false
  }).catch(() => null);
  if (!chosen) return "отмена";
  const rolls = [];
  const lines = [`Украдено духов: <b>${n}</b>; эффекты в пределах ${range} м.`];
  const sections = [];
  for (const key of chosen) {
    if (key === "beam") {
      const r = await new Roll("2d5").evaluate();
      rolls.push(r);
      lines.push(`🔆 Луч: <b>${r.total}</b> непоглощаемого урона технике в прямой видимости (выделите её целью).`);
      sections.push(dmgButton(actor, { damage: r.total, name: "Вор Духов: луч", ignoreArmour: true }));
    } else lines.push(`• ${esc(SPIRIT_EFFECTS[key])}.`);
  }
  await say(actor, source, lines, { sections }, { rolls });
  return undefined;
}

/** Tortured Spirit: «Раз в Ход может за ментальное полудействие использовать Трейт Machine Spirit Thief, как если бы получил 1 украденный дух». */
export async function useTorturedSpirit(actor) {
  if (!actor || !hasTorturedSpirit(actor)) return warn("У актора нет Таланта Истерзанный Дух.");
  return useMachineSpiritThief(actor, { spirits: 1, source: "Истерзанный Дух" });
}

// ── Демоническое Подключение ─────────────────────────────────────────────────

const UPLINK_CHARS = { ws: "WS", bs: "BS", int: "I", per: "P" };

/**
 * Daemonic Uplink: «Когда в пределах I.b м дружественная одержимая/демоническая
 * машина совершает тест WS, BS, I или P, Лорд может потратить 2 Когниции,
 * чтобы машина использовала его Характеристику и/или уровень продвижения
 * соответствующего Навыка». Машина — выделенная цель.
 */
export async function useDaemonicUplink(actor) {
  if (!actor || !hasDaemonicUplink(actor)) return warn("У актора нет Черты Демоническое Подключение.");
  const cog = Number(actor.system?.cognition?.value) || 0;
  if (cog < UPLINK_COST) return warn(`Нужно ${UPLINK_COST} Когниции, есть ${cog}.`);
  const target = [...(game.user?.targets ?? [])][0] ?? null;
  if (!target?.actor) return warn("Выделите целью дружественную одержимую/демоническую машину.");
  const me = tokenOf(actor);
  const radius = noosphereRadius(actor);
  if (me && distanceM(me, target) > radius) return warn(`${target.name} дальше I.b (${radius} м).`);
  const key = await foundry.applications.api.DialogV2.wait({
    window: { title: `Демоническое Подключение — ${actor.name}` },
    content: `<p>Тест машины ${esc(target.name)}:</p>`,
    buttons: Object.entries(UPLINK_CHARS).map(([k, l]) => ({ action: k, label: l })),
    rejectClose: false
  }).catch(() => null);
  if (!key) return "отмена";
  await actor.update({ "system.cognition.value": cog - UPLINK_COST });
  const total = Number(actor.system?.characteristics?.[key]?.total) || 0;
  await say(actor, "Демоническое Подключение", [
    `−${UPLINK_COST} Когниции (${cog} → ${cog - UPLINK_COST}). ${esc(target.name)} в этом тесте ${UPLINK_CHARS[key]} берёт Характеристику Лорда: <b>${total}</b>${key === "per" || key === "int" ? " — и, если тест Навыка, уровень продвижения Навыка Лорда" : ""}.`
  ]);
  return undefined;
}

// ── Дискордантный Дуэт ───────────────────────────────────────────────────────

/**
 * Discordant Duo: «Верхом на Адском Сталкере может тратить свои Очки
 * Бесчестия на эффекты на Сталкере вместо себя». Очко списывает цена записи.
 */
export async function useDiscordantDuo(actor) {
  if (!actor || !hasDiscordantDuo(actor)) return warn("У актора нет Таланта Дискордантный Дуэт.");
  if (!isMounted(actor)) return warn("Только верхом на Адском Сталкере.");
  await say(actor, "Дискордантный Дуэт", [`Очко Бесчестия Лорда потрачено на эффект скакуна (${esc(mountName(actor))}) — какой эффект, назовите за столом.`]);
  return undefined;
}

// ── Адосвязанный ─────────────────────────────────────────────────────────────

/**
 * Hellbound: «Может за смену работы отметить машину доп. рунами связывания, но
 * не может держать такие руны на более чем ½W.b (окр.▲) машин (при нанесении
 * „лишней“ самая старая теряет силу)». Машина — выделенная цель.
 */
export async function useHellbound(actor) {
  if (!actor || !hasHellbound(actor)) return warn("У актора нет Таланта Адосвязанный.");
  const machine = [...(game.user?.targets ?? [])][0]?.actor ?? null;
  if (!machine) return warn("Выделите целью машину, которую отмечаете рунами.");
  const limit = hellboundLimit(actor);
  const { list, dropped } = hellboundMark(actor.getFlag?.(NS, HELLBOUND_FLAG) ?? [], machine, limit);
  await actor.setFlag(NS, HELLBOUND_FLAG, list);
  await say(actor, "Адосвязанный", [
    `Руны связывания на «${esc(machine.name)}» (смена работы). Отмечено ${list.length}/${limit}: ${list.map(m => esc(m.name)).join(", ")}.`,
    dropped ? `Руны на «${esc(dropped.name)}» теряют силу — это была самая старая.` : "",
    "Демон в отмеченной машине может брать свои WS, BS или A вместо сгенерированных; при уничтожении машины — переброс кубика затягивания остова в Варп."
  ]);
  return undefined;
}
