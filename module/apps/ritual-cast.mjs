// module/apps/ritual-cast.mjs
// ════════════════════════════════════════════════════════════════════════
//  Бросок Ритуала (стр. 393-425) — чистая математика порога и резолюция
//  провала (Отвращение Варпа/Феномен/Прорыв/Проклятье), вынесенные из
//  GM-консоли «Завеса и Мистика» (module/apps/veil.mjs), чтобы их мог звать
//  и диалог «Провести ритуал» на листе персонажа (module/sheets/
//  ritual-cast-dialog.mjs) — раньше кидать ритуал мог только ГМ через окно
//  Завесы, теперь каждый со своего листа.
//
//  Требования к ритуалисту гейтят бросок, требования к ассистентам — нет
//  (они проверяются по каждому помощнику отдельно, гейта на них не бывает,
//  см. checkRequirements в module/apps/mechanics.mjs).
//
//  Сдвиг Завесы при Отвращении Варпа — привилегированная запись: у не-ГМ
//  `veilShift` (module/constants/scene-nexus.mjs) тихо не срабатывает,
//  поэтому по умолчанию не-ГМ шлёт его сокет-релеем (action:"veilShift",
//  обработчик — warhammer-dbc.mjs), а ГМ — напрямую.
// ════════════════════════════════════════════════════════════════════════

import { RITUAL_TYPES_MAP, RITUAL_SUMMON_MODS, CURSE_FAMILIARITY, CURSE_SYMPATHY,
         lookupAversion, buildRitualSkills, ritualSkillOption, ritualDegrees, charAbbr,
         applyRitualItem } from "../constants/rituals.mjs";
import { getPhenomenon, getPeril } from "../constants/psyker-tables.mjs";
import { veilShift } from "../constants/scene-nexus.mjs";
import { checkRequirements, getItemRequirements } from "./mechanics.mjs";
import { veilIcon } from "../constants/veil-icons.mjs";
import { CONDITIONS_DEF } from "../constants/conditions.mjs";
import { defaultSpawnDemonFn } from "./demon-summon.mjs";
import { isHerdSpiritsRitual } from "./herd-spirits-summon.mjs";
import { esc } from "../helpers/utils.mjs";
import { hasDominator } from "../rules/dominator.mjs";
import { pickReroll } from "../rules/reroll-pick.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";

const sgn = n => (n >= 0 ? "+" : "") + n;

/** Максимум псайкер-бонуса ритуалиста (стр. 393: «до +2×PR»). */
export function psykerMaxBonus(actor) {
  return actor?.system?.psyker ? 2 * (actor.system.psyker.rating || 0) : 0;
}

/** Начальное состояние броска для предмета-Ритуала: путь проведения из книги. */
export function newRitualState(actor, item, buildSkills = buildRitualSkills) {
  return {
    name: item?.name || "", type: "summon",
    skillValue: "", testChar: "", gmMod: 0,
    assistants: 0, assistSacrificed: 0, assistBonus: 10,
    summon: {}, curseFam: "close", curseSymp: {},
    numerology: {}, numMod: 0, psyker: false, psykerBonus: 0,
    aversionPerFail: 5, extraMods: [], extraSel: {},
    // Демон, объявленный ГМом за столом (Бестиарий игроку не виден,
    // ownership.PLAYER:"NONE") — имя ищет и токен на сцене создаёт ГМ
    // (module/apps/demon-summon.mjs), Inf уходит модификатором в порог.
    demonName: "", demonInf: 0,
    ...applyRitualItem(actor, item, buildSkills)
  };
}

/**
 * Порог теста и разбивка — та же математика, что раньше держала
 * VeilMystic._ritualData() (module/apps/veil.mjs), без частей, специфичных
 * для GM-консоли (список акторов/пресетов/предметов на выбор — там их
 * незачем считать: актор и предмет уже известны диалогу).
 */
export function ritualThreshold(R, actor, item) {
  const chars = actor?.system?.characteristics || {};
  const skills = actor ? buildRitualSkills(actor) : [];
  const skillOpt = ritualSkillOption(skills, R.skillValue);
  const testChar = R.testChar || skillOpt?.char || "int";

  const charAdj = (skillOpt && testChar !== skillOpt.char)
    ? ((chars[testChar]?.total ?? 0) - (chars[skillOpt.char]?.total ?? 0)) : 0;
  const baseVal = skillOpt ? skillOpt.total + charAdj : -20;

  const isCurse = R.type === "curse";
  const isSummonLike = ["summon", "dominion", "binding", "gate"].includes(R.type);
  // Бонус даёт не число присутствующих ассистентов, а число ПРИНЕСЁННЫХ В
  // ЖЕРТВУ (стр. 393-425: «+10 за каждого ассистента, которого в конце
  // ритуала принесли в жертву») — не больше, чем их вообще участвовало.
  const sacrificed = Math.min(Math.max(0, R.assistSacrificed || 0), R.assistants || 0);
  const assistTotal = sacrificed * (R.assistBonus || 0);
  const summonTotal = RITUAL_SUMMON_MODS.reduce((s, m) => s + (R.summon?.[m.key] ? m.value : 0), 0);
  const famVal = isCurse ? (CURSE_FAMILIARITY.find(f => f.key === R.curseFam)?.value || 0) : 0;
  const sympTotal = isCurse ? CURSE_SYMPATHY.reduce((s, m) => s + (R.curseSymp?.[m.key] ? m.value : 0), 0) : 0;
  const prMax = psykerMaxBonus(actor);
  const prBonus = R.psyker ? Math.min(R.psykerBonus || 0, prMax) : 0;
  const numMod = R.numMod || 0;
  const extraTotal = (R.extraMods || []).reduce((s, m, i) => s + (R.extraSel?.[i] ? (Number(m.value) || 0) : 0), 0);
  // −Inf призываемого демона (напр. Призыв Демонического Владыки) — узнаётся
  // только если ритуалист вписал Inf (демона называет ГМ, см. demonInf выше).
  const demonMod = isSummonLike ? -(Number(R.demonInf) || 0) : 0;

  const threshold = baseVal + (R.gmMod || 0) + assistTotal + summonTotal + famVal + sympTotal + prBonus + numMod + extraTotal + demonMod;

  const rows = [
    { label: skillOpt ? `${skillOpt.label} (${charAbbr(testChar)})` : "— навык —", val: baseVal, primary: true },
    { label: "Сложность ритуала", val: R.gmMod || 0 },
    ...(assistTotal ? [{ label: `Жертва ассистентов ×${sacrificed}`, val: assistTotal }] : []),
    ...(summonTotal ? [{ label: "Модификаторы призыва", val: summonTotal }] : []),
    ...(isCurse && famVal ? [{ label: "Знакомство с целью", val: famVal }] : []),
    ...(isCurse && sympTotal ? [{ label: "Симпатия", val: sympTotal }] : []),
    ...(prBonus ? [{ label: "Псайкер (+2×PR)", val: prBonus }] : []),
    ...(numMod ? [{ label: "Нумерология", val: numMod }] : []),
    ...(extraTotal ? [{ label: "Модификаторы ритуала", val: extraTotal }] : []),
    ...(demonMod ? [{ label: `−Inf демона${R.demonName ? ` (${R.demonName})` : ""}`, val: demonMod }] : [])
  ].map(r => ({ ...r, signed: sgn(r.val) }));

  const req = item ? checkRequirements(actor, getItemRequirements(item, "req")) : { ok: true, failed: [] };

  return {
    isCurse, isSummonLike, testChar,
    rows, threshold, thresholdSigned: sgn(threshold), prMax,
    reqOk: req.ok, reqFailed: req.failed
  };
}

/** Требования не выполнены — подтвердить или отменить (дефолтный confirmUnmet). */
export async function confirmUnmetRequirements(actor, failed) {
  return Dialog.confirm({
    title: "Требования ритуала не выполнены",
    content: `<p><b>${esc(actor.name)}</b> не проходит требования ритуала:</p>
      <ul>${failed.map(f => `<li>${esc(f)}</li>`).join("")}</ul>
      <p>Провести всё равно?</p>`,
    defaultYes: false
  });
}

/**
 * Состояния (CONDITIONS_DEF), которые предмет-Ритуал накладывает при
 * успехе (item.system.conditionsGranted) — пилюлями с draggable=true.
 * Ритуал редко имеет фиксированную цель на листе (демон/жертва/третье лицо
 * ещё не токен), поэтому не применяется автоматически: ГМ тащит пилюлю на
 * лист актора, которому состояние действительно принадлежит (module/hooks.mjs
 * ловит dragstart, module/sheets/actor-sheet.mjs — drop).
 */
function conditionPillsHtml(item) {
  const list = item?.system?.conditionsGranted || [];
  const pills = list.map(c => {
    const def = CONDITIONS_DEF[c.key];
    if (!def) return "";
    const lvlTxt = def.hasLevel && c.level ? ` ${c.level}` : "";
    const noteTxt = c.note ? ` (${esc(c.note)})` : "";
    const payload = esc(JSON.stringify({ type: "wh-condition", key: c.key, level: c.level || 0 }));
    return `<span class="wh-cond-drag" draggable="true" data-payload="${payload}"
      title="Перетащите на лист актора, подверженного состоянию">
      ${def.svg || def.icon} ${esc(def.label)}${lvlTxt}${noteTxt}</span>`;
  }).filter(Boolean).join("");
  return pills ? `<div class="wh-ritual-conditions"><b>Накладывает:</b> ${pills}</div>` : "";
}

// Сдвиг Завесы: ГМ — напрямую, иначе — сокет-релей (см. заголовок файла).
async function defaultVeilShiftFn(delta, note) {
  if (game.user?.isGM) { await veilShift(delta, note); return; }
  game.socket?.emit("system.warhammer-dbc", { action: "veilShift", userId: game.user?.id, delta, note });
}

/** Резолюция провала: Отвращение Варпа / Феномен / Прорыв / «Что Посеешь…» / ничего. */
async function ritualFailure(R, failures, prMax, allRolls, veilShiftFn) {
  const kind = RITUAL_TYPES_MAP[R.type]?.failure || "phenomenon";
  if (kind === "none") return "";
  const prBonus = R.psyker ? Math.min(R.psykerBonus || 0, prMax) : 0;
  const extra = Math.max(0, failures - 1) * (R.aversionPerFail || 5) + prBonus;
  const extraTxt = extra ? ` +${extra}` : "";

  if (kind === "aversion") {
    const aRoll = await new Roll("1d100").evaluate(); allRolls.push(aRoll);
    const total = aRoll.total + extra;
    const a = lookupAversion(total);
    if (a.veil) await veilShiftFn(a.veil, `Отвращение Варпа: ${a.name}`);
    return `<div class="wh-ritual-fail wv-tier-torn">
      <div class="rf-title">${veilIcon("spiral")} Отвращение Варпа: ${aRoll.total}${extraTxt} = <b>${total}</b> → ${esc(a.name)}</div>
      <div class="rf-text">${esc(a.text)}</div>
      ${a.veil ? `<div class="rf-veil">Завеса истончается на +${a.veil}.</div>` : ""}</div>`;
  }
  if (kind === "curse") {
    return `<div class="wh-ritual-fail wv-tier-torn">
      <div class="rf-title">${veilIcon("demon")} «Что Посеешь…»</div>
      <div class="rf-text">Вырвавшиеся энергии проклинают самого Ритуалиста. При наличии ассистентов проклятье падает на главного Ритуалиста, но он может пройти Scholastic Lore (Occult) −20, чтобы перенаправить его на ассистента.</div></div>`;
  }
  // phenomenon / breach
  const fRoll = await new Roll("1d100").evaluate(); allRolls.push(fRoll);
  const total = fRoll.total + extra;
  const asBreach = kind === "breach" || total >= 75;
  const obj = asBreach ? getPeril(total) : getPhenomenon(total);
  const nm = obj.label || obj.name || (asBreach ? "Варп-Прорыв" : "Феномен");
  const tx = obj.text || obj.effect || obj.desc || "";
  const failLabel = asBreach ? `${veilIcon("storm")} Варп-Прорыв` : `${veilIcon("star")} Психический Феномен`;
  return `<div class="wh-ritual-fail wv-tier-thin">
    <div class="rf-title">${failLabel}: ${fRoll.total}${extraTxt} = <b>${total}</b> → ${esc(nm)}</div>
    ${tx ? `<div class="rf-text">${esc(tx)}</div>` : ""}</div>`;
}

/**
 * Провести ритуал: гейт требований → бросок 1d100 → резолюция провала →
 * карточка в чат. `item` нужен для гейта требований (checkRequirements);
 * без него (совместимость со старым «руками, без предмета») гейт молчит.
 * @returns {Promise<{success:boolean, deg:number, threshold:number, roll:number}|null>}
 *   null — отменено подтверждением требований.
 */
export async function castRitual(R, actor, {
  item = null, confirmUnmet = confirmUnmetRequirements, veilShiftFn = defaultVeilShiftFn,
  spawnDemonFn = defaultSpawnDemonFn
} = {}) {
  if (!actor) { ui.notifications?.warn("Ритуал: не выбран Ритуалист."); return null; }
  const d = ritualThreshold(R, actor, item);
  if (!d.reqOk) {
    const proceed = await confirmUnmet(actor, d.reqFailed);
    if (!proceed) return null;
  }
  // Общий сбор модификаторов (wdbc-ct65.3): Порог ритуала считался целиком
  // ритуальной арифметикой (ritualThreshold), мимо реестра правил — Усталость
  // Ритуалиста и его Черты в него не попадали.
  const ruleMods = collectTestMods(actor, { kind: "skill", char: "wp" });
  const threshold = d.threshold + ruleMods.total;
  // Dominator / Покоритель (wdbc-u0by): «Преимущество на тесты Демонического
  // Владычества» — безусловно для R.type==="dominion", авто (кнопка «Провести
  // ритуал» катает сразу, без отдельного шага под переброс).
  const advantage = R.type === "dominion" && hasDominator(actor);
  const rolled = [];
  for (let i = 0; i < (advantage ? 2 : 1); i++) rolled.push(await new Roll("1d100").evaluate());
  const picked = pickReroll(rolled.map(r => r.total), "keepBest");
  const roll = rolled[picked.index];
  const rv = roll.total;
  const deg = ritualDegrees(rv, threshold);
  const success = deg > 0;
  const allRolls = [roll];
  const dominatorNote = picked.dropped.length
    ? ` · Покоритель: Преимущество, отброшено ${picked.dropped.join(", ")}` : "";
  const typeLabel = RITUAL_TYPES_MAP[R.type]?.label || R.type;
  // Разбивка Порога: к ритуальным слагаемым добавлены подписи из реестра
  // (wdbc-kuun) — Порог уже считался с Усталостью Ритуалиста, но в карточке
  // её видно не было.
  const breakdown = [...d.rows.map(r => `${r.label}: ${r.signed}`), ...ruleMods.parts].join(" · ");

  const failHtml = success ? "" : await ritualFailure(R, Math.abs(deg), d.prMax, allRolls, veilShiftFn);
  const condHtml = success ? conditionPillsHtml(item) : "";
  // Токен демона — только движковый тип "summon" (действительно материализует
  // НОВОГО демона; Владычество/Связывание/Врата действуют на уже имеющегося
  // или не дают конкретной сущности) и только если ритуалист назвал демона.
  if (success && R.type === "summon" && R.demonName) await spawnDemonFn(R.demonName, actor.uuid);
  const demonHtml = (success && R.demonName)
    ? `<div class="roll-threshold" style="font-size:0.85em;">Демон: <b>${esc(R.demonName)}</b>${R.type === "summon" ? " — токен размещён на сцене." : ""}</div>`
    : "";
  // Призыв Духов Стада (wdbc-xxb7) — бюджет успехов на Минотавров/Троллей/
  // Великанов распределяет ГМ в отдельном диалоге (Бестиарий игроку скрыт),
  // не сразу здесь: кнопка в карточке, обработчик — module/hooks.mjs.
  const herdHtml = (success && isHerdSpiritsRitual(item))
    ? `<div class="roll-threshold" style="font-size:0.85em;">
        <button type="button" class="wh-herd-spirits-btn" data-actor-uuid="${actor.uuid}"
          data-successes="${deg}">🐂 Распределить Духов Стада (${deg} усп.)</button>
      </div>`
    : "";

  const rollMode = game.settings.get("core", "rollMode");
  const dice = (await Promise.all(allRolls.map(r => r.render()))).join("");
  await ChatMessage.create(ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="wh-roll-result wh-ritual-card">
      <div class="roll-header">${veilIcon("ritual")} Ритуал: ${esc(R.name || typeLabel)}</div>
      <div class="roll-threshold">${esc(actor.name)} · ${esc(typeLabel)} → Порог: <b>${threshold}</b></div>
      <div class="roll-threshold" style="font-size:0.8em;opacity:0.85;">${esc(breakdown)}${dominatorNote ? esc(dominatorNote) : ""}</div>
      <div class="roll-dice">Бросок: <b>${rv}</b></div>
      <div class="roll-outcome">${success
        ? `<span class="roll-success">Ритуал удался — ${deg} ${deg === 1 ? "Успех" : "Успех(ов)"}</span>`
        : `<span class="roll-failure">Ритуал провален — ${Math.abs(deg)} Провал(ов)</span>`}</div>
      ${demonHtml}
      ${herdHtml}
      ${failHtml}
      ${condHtml}
      <details class="roll-dice-details"><summary>📊 Показать кубы</summary>${dice}</details>
    </div>`,
    rolls: allRolls, sound: CONFIG.sounds.dice
  }, rollMode));

  return { success, deg, threshold, roll: rv };
}
