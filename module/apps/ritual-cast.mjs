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
import { WARP_GODS, WARP_GODS_MAP } from "../constants/veil.mjs";
import { godRelationCat } from "../constants/patronage.mjs";
import { MARK_LABELS } from "../constants/talent-requirements.mjs";
import { hasRuleFlag } from "../rules/flags.mjs";
import { veilShift } from "../constants/scene-nexus.mjs";
import { checkRequirements, getItemRequirements } from "./mechanics.mjs";
import { veilIcon } from "../constants/veil-icons.mjs";
import { CONDITIONS_DEF } from "../constants/conditions.mjs";
import { defaultSpawnDemonFn } from "./demon-summon.mjs";
import { defaultBindArmigerWeaponFn } from "./armiger-weapon.mjs";
import { isHerdSpiritsRitual } from "./herd-spirits-summon.mjs";
import { esc } from "../helpers/utils.mjs";
import { hasDominator, isOwnArmiger } from "../rules/dominator.mjs";
import { pickReroll } from "../rules/reroll-pick.mjs";
import { collectTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, testCardHtml, outcomeHtml } from "../helpers/test-card.mjs";

const sgn = n => (n >= 0 ? "+" : "") + n;

/** Максимум псайкер-бонуса ритуалиста (стр. 393: «до +2×PR»). */
export function psykerMaxBonus(actor) {
  return actor?.system?.psyker ? 2 * (actor.system.psyker.rating || 0) : 0;
}

/**
 * Три строки таблицы «Модификаторы Призыва», которые система знает про лист
 * сама (корбук, «VI. МИСТИКА → РИТУАЛЫ»): «Персонаж имеет метку бога демона
 * +30», «Персонаж имеет покровительство (но не метку) бога демона +20» и
 * «Персонаж имеет покровительство или метку враждебного бога −20».
 *
 * Первые две книга держит взаимоисключающими прямым текстом, поэтому
 * Покровительство при наличии Метки не считается вовсе. Третья с ними
 * складывается: это отдельная строка про ДРУГОГО бога, и носитель Метки
 * Кхорна с фавором Слаанеш, зовущий кхорнита, получает и +30, и −20.
 *
 * Кто кому враждебен, книга определяет ровно один раз — матрицей отношений
 * Богов в «I. СОЗДАНИЕ ПЕРСОНАЖА → ОПЫТ и СТАРТОВОЕ СНАРЯЖЕНИЕ» (стр. 23),
 * где Слаанеш↔Кхорн и Нургл↔Тзинч стоят «Вражд.», а Неделимый нейтрален всем.
 * Второго определения в книге нет, поэтому «враждебный бог» читается этой
 * матрицей — она уже живёт в constants/patronage.mjs → godRelationCat().
 *
 * Метка спрашивается возможностью `mark.<бог>` (её выдаёт Черта из
 * packs-src/traits/Метки_Богов), а не полем `patronGod`: это разные сущности,
 * и вся разница между +30 и +20 именно в них. А вот для −20 книга принимает
 * ЛЮБОЕ из двух («покровительство ИЛИ метку»), поэтому здесь они равноправны.
 * @returns {{god:string, mark:boolean, patronage:boolean, enemy:boolean,
 *   enemyGod:string}|null} null — бог демона не назван, строки остаются ручными.
 */
export function autoSummonMods(actor, god) {
  if (!god || !WARP_GODS_MAP[god]) return null;
  const mark = hasRuleFlag(actor, `mark.${god}`);
  const patronGod = actor?.system?.patronGod || "";
  // Не список «кто чей враг» вторым экземпляром, а вопрос матрице: если книга
  // однажды разведёт богов иначе, менять придётся её одну.
  const enemyGod = WARP_GODS
    .map(g => g.key)
    .filter(key => godRelationCat(key, god) === "enemy")
    .find(key => hasRuleFlag(actor, `mark.${key}`) || patronGod === key) || "";
  return { god, mark, patronage: !mark && patronGod === god, enemy: !!enemyGod, enemyGod };
}

const summonModValue = key => RITUAL_SUMMON_MODS.find(m => m.key === key)?.value || 0;

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
    // Бог демона называется там же и нужен не для поиска, а для двух строк
    // Модификаторов Призыва, которые считаются по листу (autoSummonMods).
    demonName: "", demonInf: 0, demonGod: "",
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
  // Метка/Покровительство бога демона считаются по листу, если бог назван.
  // Авто-строка только ДОБАВЛЯЕТ: Метку из источника, которого система пока
  // не знает, ГМ по-прежнему может отметить руками. А вот сложить обе строки
  // нельзя никогда — книга пишет «покровительство (но не метку)», то есть с
  // Меткой это +30, а не +50 (раньше две отмеченные пилюли давали +50).
  const auto = isSummonLike ? autoSummonMods(actor, R.demonGod) : null;
  const marked = !!(auto?.mark || R.summon?.mark);
  const summonOn = key => {
    if (key === "mark") return marked;
    // Строка Покровительства читается «но не метку» — с Меткой её нет вовсе.
    if (key === "patronage") return !marked && !!(auto?.patronage || R.summon?.patronage);
    if (key === "enemyMark") return !!(auto?.enemy || R.summon?.enemyMark);
    return !!R.summon?.[key];
  };
  // Авто-строки выводятся отдельно и с именем Бога: игрок не отмечал их сам и
  // должен видеть, откуда взялись +30/+20/−20.
  const autoMark   = !!auto?.mark;
  const autoPatron = !!(auto?.patronage && summonOn("patronage"));
  const autoEnemy  = !!auto?.enemy;
  const isAuto = key => (key === "mark" && autoMark)
                     || (key === "patronage" && autoPatron)
                     || (key === "enemyMark" && autoEnemy);
  const summonTotal = RITUAL_SUMMON_MODS.reduce(
    (s, m) => (summonOn(m.key) && !isAuto(m.key) ? s + m.value : s), 0);
  const autoTotal = RITUAL_SUMMON_MODS.reduce(
    (s, m) => (isAuto(m.key) ? s + m.value : s), 0);
  const godName = key => MARK_LABELS[key] || WARP_GODS_MAP[key]?.label || key;
  const godLabel = auto ? godName(auto.god) : "";
  const famVal = isCurse ? (CURSE_FAMILIARITY.find(f => f.key === R.curseFam)?.value || 0) : 0;
  const sympTotal = isCurse ? CURSE_SYMPATHY.reduce((s, m) => s + (R.curseSymp?.[m.key] ? m.value : 0), 0) : 0;
  const prMax = psykerMaxBonus(actor);
  const prBonus = R.psyker ? Math.min(R.psykerBonus || 0, prMax) : 0;
  const numMod = R.numMod || 0;
  const extraTotal = (R.extraMods || []).reduce((s, m, i) => s + (R.extraSel?.[i] ? (Number(m.value) || 0) : 0), 0);
  // −Inf призываемого демона (напр. Призыв Демонического Владыки) — узнаётся
  // только если ритуалист вписал Inf (демона называет ГМ, см. demonInf выше).
  const demonMod = isSummonLike ? -(Number(R.demonInf) || 0) : 0;

  const threshold = baseVal + (R.gmMod || 0) + assistTotal + summonTotal + autoTotal + famVal + sympTotal + prBonus + numMod + extraTotal + demonMod;

  const rows = [
    { label: skillOpt ? `${skillOpt.label} (${charAbbr(testChar)})` : "— навык —", val: baseVal, primary: true },
    { label: "Сложность ритуала", val: R.gmMod || 0 },
    ...(assistTotal ? [{ label: `Жертва ассистентов ×${sacrificed}`, val: assistTotal }] : []),
    ...(summonTotal ? [{ label: "Модификаторы призыва", val: summonTotal }] : []),
    ...(autoMark ? [{ label: `Метка ${godLabel}`, val: summonModValue("mark") }] : []),
    ...(autoPatron ? [{ label: `Покровительство ${godLabel} (без Метки)`, val: summonModValue("patronage") }] : []),
    ...(autoEnemy ? [{ label: `Враждебный Бог: ${WARP_GODS_MAP[auto.enemyGod]?.label || auto.enemyGod}`,
                      val: summonModValue("enemyMark") }] : []),
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
    // Какие строки Призыва реально сработали и какие из них поставила система
    // сама — диалогу, чтобы подсветить пилюли, а не повторять у себя правило
    // «покровительство, но не метку» вторым экземпляром.
    summonOn: RITUAL_SUMMON_MODS.filter(m => summonOn(m.key)).map(m => m.key),
    summonAuto: RITUAL_SUMMON_MODS.filter(m => isAuto(m.key)).map(m => m.key),
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
  spawnDemonFn = defaultSpawnDemonFn, bindWeaponFn = defaultBindArmigerWeaponFn,
  isOwnArmigerFn = isOwnArmiger
} = {}) {
  if (!actor) { ui.notifications?.warn("Ритуал: не выбран Ритуалист."); return null; }
  const d = ritualThreshold(R, actor, item);
  if (!d.reqOk) {
    const proceed = await confirmUnmet(actor, d.reqFailed);
    if (!proceed) return null;
  }
  // wdbc-1rno: Инфернальный Оруженосец/Рыцарь Бога — «простым N-минутным
  // ритуалом, НЕ требующим тестов». Требования к ритуалисту уже проверены/
  // подтверждены выше (ritualThreshold/confirmUnmet) — noTest снимает только
  // сам бросок и Порог, не право персонажа провести ритуал вообще.
  if (item?.system?.noTest) return castNoTestRitual(R, actor, { spawnDemonFn, bindWeaponFn });
  // wdbc-1rno, шаг E: «автоматически побеждает во всех тестах Владычества
  // против него [своего Оруженосца]» — не свойство ЭТОГО предмета-ритуала
  // (Владычество разыгрывается обычными книжными ритуалами, см. Rite of
  // Audacity), а свойство ЦЕЛИ, названной в R.demonName. Гейт требований и
  // Порог с Модификаторами Призыва тут ни при чём — своего демона обязывать
  // себе подчиниться незачем никаким тестом вовсе.
  if (R.type === "dominion" && isOwnArmigerFn(actor, R.demonName)) return castAutoWinDominion(R, actor);
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

  const dice = (await Promise.all(allRolls.map(r => r.render()))).join("");
  // Класс `wh-ritual-card` идёт в classes: styles/ui/veil.css рисует по нему
  // блок провала ритуала селектором `.wh-ritual-card .rf-*`, то есть класс
  // обязан стоять на том же узле, что и `wh-roll-result`. Строка Порога здесь
  // своего формата («имя · тип → Порог: N»), поэтому передаётся готовой.
  await postTestCard(actor, testCardHtml({
    icon: `${veilIcon("ritual")} `, title: `Ритуал: ${esc(R.name || typeLabel)}`,
    classes: "wh-ritual-card",
    threshold: `<div class="roll-threshold">${esc(actor.name)} · ${esc(typeLabel)} → Порог: <b>${threshold}</b></div>`,
    lines: [
      `<div class="roll-threshold" style="font-size:0.8em;opacity:0.85;">${esc(breakdown)}${dominatorNote ? esc(dominatorNote) : ""}</div>`
    ],
    rv,
    outcome: success
      ? outcomeHtml(true, `Ритуал удался — ${deg} ${deg === 1 ? "Успех" : "Успех(ов)"}`)
      : outcomeHtml(false, `Ритуал провален — ${Math.abs(deg)} Провал(ов)`),
    sections: [
      demonHtml, herdHtml, failHtml, condHtml,
      `<details class="roll-dice-details"><summary>📊 Показать кубы</summary>${dice}</details>`
    ]
  }), { rolls: allRolls });

  return { success, deg, threshold, roll: rv };
}

/**
 * Ритуал без теста (wdbc-1rno) — вызывается ТОЛЬКО из castRitual выше, когда
 * item.system.noTest установлен: требования к ритуалисту уже проверены/
 * подтверждены там же. Ни Порога, ни броска книга для такого ритуала не
 * даёт вовсе — результат гарантирован, единственная цена — время (проза
 * ритуала называет его отдельно, механикой не считается).
 * @returns {Promise<{success:true, deg:1, threshold:null, roll:null}>}
 */
async function castNoTestRitual(R, actor, { spawnDemonFn, bindWeaponFn }) {
  // Токен демона — та же логика, что в основном пути: только "summon" и
  // только если ритуалист (тут — сам предмет) назвал демона. asMinion
  // (Инфернальный Оруженосец/Рыцарь Бога — «без траты слотов Миньонов»)
  // проставляет system.masterUuid созданному демону.
  if (R.type === "summon" && R.demonName && !R.asWeapon) {
    await spawnDemonFn(R.demonName, actor.uuid, { asMinion: !!R.asMinion });
  }
  // asWeapon (шаг D той же серии) — тот же ритуал, второй книжный исход:
  // демон вселяется в оружие Ритуалиста, а не встаёт Миньоном. R.weaponId —
  // id предмета-оружия на самом Ритуалисте, выбранного в диалоге проведения
  // (module/sheets/ritual-cast-dialog.mjs); нет выбранного оружия — вселять
  // некуда, ритуал всё равно засчитан (проведён), но без демона в вещи.
  let weaponHtml = "";
  if (R.type === "summon" && R.demonName && R.asWeapon) {
    const weapon = R.weaponId ? actor.items?.get(R.weaponId) : null;
    if (weapon) {
      const res = await bindWeaponFn(weapon.uuid, R.demonName, R.demonGod);
      weaponHtml = `<div class="roll-threshold" style="font-size:0.85em;">Оруженосец вселён в оружие: <b>${esc(weapon.name)}</b>${res?.ok === false ? ` — ${esc(res.reason || "не осквернено")}` : ""}</div>`;
    } else {
      weaponHtml = `<div class="roll-threshold" style="font-size:0.85em;">Оружие для вселения не выбрано — Оруженосец остаётся в Истинной Форме.</div>`;
    }
  }
  const demonHtml = R.demonName
    ? `<div class="roll-threshold" style="font-size:0.85em;">Демон: <b>${esc(R.demonName)}</b>${R.type === "summon" && !R.asWeapon ? " — токен размещён на сцене." : ""}${R.asMinion && !R.asWeapon ? " Привязан Миньоном без слота." : ""}</div>${weaponHtml}`
    : "";

  await postTestCard(actor, testCardHtml({
    icon: `${veilIcon("ritual")} `, title: `Ритуал: ${esc(R.name || RITUAL_TYPES_MAP[R.type]?.label || R.type)}`,
    classes: "wh-ritual-card",
    threshold: `<div class="roll-threshold">${esc(actor.name)} — ритуал не требует теста, результат гарантирован.</div>`,
    outcome: outcomeHtml(true, "Ритуал проведён"),
    sections: [demonHtml]
  }), { sound: false });

  return { success: true, deg: 1, threshold: null, roll: null };
}

/**
 * Автопобеда во Владычестве против своего же демона-Оруженосца (wdbc-1rno,
 * шаг E) — вызывается ТОЛЬКО из castRitual выше, когда R.type==="dominion" и
 * isOwnArmiger(actor, R.demonName) подтвердил цель. В отличие от
 * castNoTestRitual, это не свойство предмета (обычный ритуал Владычества
 * остаётся обычным против чужого демона) — только результат гарантирован
 * для ЭТОЙ конкретной цели, ни Порог, ни требования ритуала не отменяются
 * этой веткой (они уже проверены в castRitual выше, до этой точки).
 * @returns {Promise<{success:true, deg:1, threshold:null, roll:null}>}
 */
async function castAutoWinDominion(R, actor) {
  await postTestCard(actor, testCardHtml({
    icon: `${veilIcon("ritual")} `, title: `Ритуал: ${esc(R.name || RITUAL_TYPES_MAP[R.type]?.label || R.type)}`,
    classes: "wh-ritual-card",
    threshold: `<div class="roll-threshold">${esc(actor.name)} — Владычество над собственным Оруженосцем не требует теста, победа гарантирована.</div>`,
    outcome: outcomeHtml(true, `Владычество подтверждено${R.demonName ? ` — ${esc(R.demonName)}` : ""}`)
  }), { sound: false });

  return { success: true, deg: 1, threshold: null, roll: null };
}
