// module/combat/fear.mjs
// ════════════════════════════════════════════════════════════════════════
//  Тест Страха / Ментальной Травмы. Вынесено из actor-sheet.mjs (по образцу
//  defense.mjs) — свободные функции, а не методы листа, чтобы кнопка
//  бесплатного переброса (см. ниже) могла вызвать их из hooks.mjs.
// ════════════════════════════════════════════════════════════════════════

import { FEAR_RATINGS, SHOCK_TABLE, TRAUMA_TABLE, lookupTable } from "../constants/fear-tables.mjs";
import { _degWord, esc }                               from "../helpers/utils.mjs";
import { rollIcon }                                from "../constants/roll-icons.mjs";
import { ruleFlagLabels, hasRuleFlag }             from "../rules/flags.mjs";
import { isRuleUsageUsed }                         from "../apps/game-session.mjs";
import { resolveKindOutcome }                      from "../rules/kind-outcome.mjs";
import { rollD100WithReroll }                      from "../rules/test-kind-widget.mjs";
import { conditionApplyFields, conditionRemoveFields } from "../sheets/tabs/conditions.mjs";
import { autoTestMods } from "../rules/roll-mods.mjs";
import { postTestCard, rollStatLine } from "../helpers/test-card.mjs";
// Пилюли крит-таблиц (wdbc-xql6) карточке Шока больше не нужны: строка
// применяется сама (applyShockRow), кнопка лишь задвоила бы Без сознания.
import { deathButtonHtml } from "./crit-effect-parser.mjs";
import { applyConditionWithDuration, clearConditionDuration } from "./condition-effects.mjs";
import { activeShock, shockFlagPatch, shockRecoveryBlock, SHOCK_FLAG, SHOCK_SCENE_FLAG,
         SHOCK_HALF_ACTION_FLAG, MACHINE_MIND_FLAG } from "../rules/shock.mjs";
import { testOutcome } from "../rules/roll-outcome.mjs";
import { rollMoraleTest }                          from "../rules/morale-test.mjs";
import { applyLordOfExoditesFailPenalty }          from "./lord-of-exodites.mjs";

/** Возможность «Абсолютная вера в прошлое» (Мир-кладбище). */
export const FAITH_FLAG = "fear.faithInThePast";

/** Полный иммунитет к Страху — автоуспех любого теста Страха (wdbc-m7we). */
export const FEAR_IMMUNE_FLAG = "fear.immune";

/** Флаг актора: наибольший рейтинг Страха, против которого уже был тест в этой сцене. */
export const FEAR_FACED_FLAG = "fearFacedRating";

/**
 * «Новая сцена»/«Конец сессии» — забыть пройденные тесты Страха и штраф Шока
 * «до конца сцены» (стр. 53). Несвязанные токены хранят флаги в своём
 * дельта-акторе, которого нет в game.actors, — поэтому обходятся и токены
 * текущей сцены.
 */
export async function clearFearSceneState() {
  const actors = new Set(game.actors ?? []);
  for (const t of canvas?.scene?.tokens ?? []) if (t.actor) actors.add(t.actor);
  for (const a of actors) {
    for (const key of [FEAR_FACED_FLAG, SHOCK_SCENE_FLAG]) {
      if (a.getFlag?.("warhammer-dbc", key)) await a.unsetFlag("warhammer-dbc", key);
    }
  }
}

/**
 * Тест Страха (1d100 + 10×Провалы−1 − Infamy → таблица Шока при провале).
 * ratingKey — ключ FEAR_RATINGS. properties.demon + провал → карточка
 * получает кнопку ОДНОГО бесплатного переброса; opts.free помечает, что
 * ЭТОТ вызов — уже сам такой переброс, поэтому повторно кнопку не даём
 * (одна бесплатная попытка на тест, не бесконечная цепочка).
 */
export async function _executeFearRoll(actor, ratingKey, type, infamy, mod, properties = {}, opts = {}) {
  // «Страх и Машины» (стр. 53): машина без свободы воли бросает на Int.
  const charKey = fearChar(actor);
  const wp = actor.system.characteristics[charKey]?.total ?? 0;
  // Стальное Сердце (Мутация, wdbc-tsz6): персонаж считает ВСЕ рейтинги
  // Страха на 1 меньше настоящего — не выдача Страха себе (для этого уже
  // есть Трейт Fear(X)), а обратное направление: снижение того, как чужой
  // Страх действует НА персонажа. Рейтинг ушёл в 0 или ниже — Страх
  // полностью игнорируется (автоуспех), тот же принцип, что у автопасса по
  // Infamy ниже. 4 god-гейтнутые субмутации (доп. −1 против конкретных типов
  // целей) не реализованы — _executeFearRoll не получает категорию источника
  // Страха вовсе, только числовой рейтинг; потребовало бы протащить новый
  // параметр через весь вызывающий путь (hooks.mjs/disorders.mjs).
  const steelHeart = hasRuleFlag(actor, "mutation.heartOfSteel");
  const effectiveKey = steelHeart ? Number(ratingKey) - 1 : Number(ratingKey);
  const steelHeartIgnored = steelHeart && effectiveKey <= 0;
  const r  = FEAR_RATINGS[effectiveKey] || FEAR_RATINGS[1];
  const important = type === "important";
  const ratingMod = important ? r.important : r.normal;

  // «Один тест на Страх в Ход — против сильнейшего источника, и до конца сцены
  // все прочие источники равного или меньшего рейтинга игнорируются» (стр. 53).
  // Без этой памяти каждый новый демон той же силы требовал нового теста, и
  // помнить, кто что уже прошёл, приходилось ГМу. Сравнивается настоящий
  // рейтинг источника, не пониженный Стальным Сердцем. Переброс Демона
  // (opts.free) — тот же тест, не новая встреча.
  const faced = Number(actor.getFlag?.("warhammer-dbc", FEAR_FACED_FLAG)) || 0;
  if (!opts.free && faced >= Number(ratingKey)) {
    await postTestCard(actor, {
      title: `Тест Страха — ${esc(actor.name)}`,
      outcome: `<span class="roll-success">Не требуется — в этой сцене уже был тест против Страха ${faced}</span>`,
      lines: [`<div class="roll-threshold">Источники Страха ${Number(ratingKey)} и ниже до конца сцены игнорируются.</div>`]
    });
    return;
  }
  if (!opts.free) await actor.setFlag?.("warhammer-dbc", FEAR_FACED_FLAG, Number(ratingKey));
  // Вид теста/Кубик/Крит из диалога (rules/test-kind-widget.mjs) — только у
  // самого первого броска; бесплатный переброс Демона (opts.free) идёт уже
  // Базовым тестом без tk, это отдельная книжная механика, не общий Кубик.
  const tk = opts.tk || {};
  // Штрафы состояния тела (Усталость и прочее) — из конвейера. Тест Страха
  // это тест Морали по книге, отсюда morale:true (та же область, что читает
  // resolveTest ниже при разборе исхода).
  //
  // Именно autoMods, а НЕ collectTestMods: галочки правил у Страха уже свои —
  // их показывает диалог (sheets/tabs/disorders.mjs::openFearDialog) и
  // складывает в `mod`. Общий сбор добавил бы отмеченную галочку второй раз.
  const ruleMods = autoTestMods(actor, { kind: "skill", char: charKey, morale: true });
  const baseEff  = wp + ratingMod + mod + (tk.difficulty || 0) + ruleMods.total;
  // Саркофаг Дредноута (стр. 57, wdbc-drn): пилот, отключённый от чувств,
  // автоматически проходит тесты Страха независимо от Infamy.
  // fear.immune — ОБЩЕЕ имя иммунитета к Страху, которое может выдать любой
  // предмет (wdbc-m7we). До него иммунитет умела только одна подсистема
  // (Саркофаг Дредноута), и Дар «Инфернальная Воля» обещал его текстом, а
  // система всё равно требовала тест. Читатель был, не хватало имени.
  //
  // Отличие от «Стального Сердца» выше: то лишь снижает воспринимаемый
  // рейтинг на 1, и Страх 3 остаётся Страхом 2 — тест по-прежнему нужен.
  //
  // Infamy и собственный Страх (стр. 53) — привилегия Важных персонажей: оба
  // условия стоят в одной фразе с ними. Собственный рейтинг сравнивается с
  // настоящим рейтингом источника: «равный или выше, чем у источника».
  const ownFear = Number(actor.system.fearRating) || 0;
  const infamyPass = important && infamy >= r.infamy;
  const ownFearPass = important && ownFear > 0 && ownFear >= Number(ratingKey);
  const autoPass = steelHeartIgnored || infamyPass || ownFearPass
                   || hasRuleFlag(actor, "sarcophagus.autoPassFear")
                   || hasRuleFlag(actor, FEAR_IMMUNE_FLAG);

  const reroll = tk.reroll || null;
  const { roll, rv, rolls, rerollNote } = await rollD100WithReroll(reroll);

  const outcome = await resolveKindOutcome(actor, {
    baseEff, rv, combined: tk.combined, extended: tk.extended, opposed: tk.opposed,
    ctx: { actor, kind: "skill", char: charKey, morale: true }, autoSuccess: autoPass
  });
  const { eff, success, deg } = outcome;
  const dof      = success ? 0 : deg;
  const allRolls = [roll];
  let shockHtml  = "";
  let shockUndo  = null;
  let moraleUndo = null;
  if (!success) {
    const sRoll = await new Roll("1d100").evaluate(); allRolls.push(sRoll);
    // Infamy вычитают только Важные персонажи (стр. 53).
    const shockInfamy = important ? infamy : 0;
    const total = sRoll.total + 10 * (dof - 1) - shockInfamy;
    if (total <= 0) {
      shockHtml = `<div class="roll-outcome"><span class="roll-success">${rollIcon("shield","#4dffa6")}Шок предотвращён (Infamy)</span></div>`;
    } else {
      const row = lookupTable(SHOCK_TABLE, total);
      shockHtml = `<div class="roll-damage-section">
        <div class="roll-damage-label">Шок (${sRoll.total}${dof > 1 ? ` +${10 * (dof - 1)}` : ""}${shockInfamy ? ` −${shockInfamy}` : ""} = ${total}):</div>
        <div class="roll-threshold">${row?.text ?? "—"}</div>
        ${/* Сегодня ни одна строка Шоковой таблицы смерть напрямую не
             утверждает — это закреплено сторожем (test/combat/crit-effect-
             parser.test.mjs, «Шоковая таблица: …только условная»), и вызов
             ниже возвращает пустую строку. Он остаётся намеренно (wdbc-e9e):
             SHOCK_TABLE — данные, а не код, и если в неё когда-нибудь попадёт
             безусловно смертельная строка, кнопка появится сама. Обратное —
             убрать вызов — означало бы, что такую строку заметят только за
             столом. */""}
        ${row?.text ? deathButtonHtml(row.text, actor.uuid) : ""}</div>`;
      // Строка Шока применяется сама (rules/shock.mjs) — ГМу остаётся
      // только то, чего система не видит: путь к побегу, ближайшая цель.
      const applied = await applyShockRow(actor, row);
      shockHtml += applied.html;
      shockUndo = applied.undo;
    }
  }
  await applyLordOfExoditesFailPenalty(actor, { dof, usedReroll: !!reroll });
  // Страх — тест Морали: провал снимает Командование (combat/command-state.mjs).
  if (!success) {
    const { handleMoraleFailure } = await import("./command-state.mjs");
    moraleUndo = await handleMoraleFailure(actor);
  }
  // 5+ степеней провала Страха → Ментальная Травма (в конце сцены)
  if (!success && dof >= 5) {
    shockHtml += `<div class="roll-threshold" style="margin-top:4px;color:#9a0000;font-weight:bold;">5+ степеней провала — в конце сцены пройдите тест Ментальной Травмы (кнопка «Травма»).</div>`;
  }

  // «Абсолютная вера в прошлое» (Мир-кладбище): при провале владелец может
  // потратить Очко Судьбы/Бесчестья и считать тест пройденным с 1 успехом,
  // получив 1 Порчи. Решение принимается ПОСЛЕ броска, поэтому это кнопка в
  // карточке, а не галочка в диалоге. Один раз за столкновение — метку ставит
  // обработчик в hooks.mjs, сбрасывает «Новая сцена» (apps/game-session.mjs).
  const faithLabel = (!success && !isRuleUsageUsed(actor, FAITH_FLAG))
    ? ruleFlagLabels(actor, FAITH_FLAG)[0] : null;
  const faithCtx = faithLabel ? { actorId: actor.id, actorUuid: actor.uuid, label: faithLabel } : null;
  // Что отменить, если провал потом станет успехом (переброс Демона, «Вера
  // в прошлое»): наложенный Шок и потерянное Командование.
  const failUndo = (shockUndo || moraleUndo) ? { shock: shockUndo, morale: moraleUndo } : null;

  const canReroll = !!properties.demon && !success && !opts.free;
  await _postFearMsg(actor, "Тест Страха", r.label, wp, ratingMod + mod, rv, eff, success, dof, shockHtml, allRolls, {
    properties, rerollCtx: canReroll ? { ratingKey, type, infamy, mod, failUndo } : null,
    faithCtx: faithCtx ? { ...faithCtx, failUndo } : null, charLabel: charKey === "int" ? "Int" : "W",
    rerollNote, critLine: outcome.critLine, kindLabel: outcome.kindLabel,
    combinedLine: outcome.combinedLine, extendedLine: outcome.extendedLine, opposedLine: outcome.opposedLine,
    difficulty: tk.difficulty || 0, ruleParts: ruleMods.parts
  });
}

/**
 * Заводит след активной Травмы — предмет mentalTrauma, без дублей по тексту.
 *
 * Имя предмета обрезается: строка таблицы бывает в несколько предложений, а в
 * списке нужна подпись. Полный текст лежит в описании.
 */
export async function createTraumaItem(actor, row) {
  const text = String(row?.text ?? "").trim();
  if (!text) return null;
  if (actor.items.some(i => i.type === "mentalTrauma" && i.system?.description === text)) return null;
  const label = text.length > 60 ? text.slice(0, 57) + "…" : text;
  const [item] = await actor.createEmbeddedDocuments("Item", [{
    name: label, type: "mentalTrauma",
    // Всегда W+0: в таблице Травмы своего модификатора теста нет, в отличие
    // от Расстройств.
    system: { description: text, testChar: "wp", testMod: 0 }
  }]);
  return item;
}

/** Тест Ментальной Травмы (W+0) → при провале таблица Травмы. Без Демона. */
export async function _executeTraumaRoll(actor, mod = 0, tk = {}) {
  const wp   = actor.system.characteristics.wp?.total ?? 0;
  // Тот же autoMods, что у теста Страха выше, и по той же причине: галочки
  // приходят из диалога в `mod`. Ментальная Травма — не тест Морали по книге
  // (в отличие от Страха и выхода из Шока), поэтому morale здесь не ставится.
  const ruleMods = autoTestMods(actor, { kind: "skill", char: "wp" });
  const baseEff = wp + mod + (tk.difficulty || 0) + ruleMods.total;

  const reroll = tk.reroll || null;
  const { roll, rv, rolls, rerollNote } = await rollD100WithReroll(reroll);

  const outcome = await resolveKindOutcome(actor, {
    baseEff, rv, combined: tk.combined, extended: tk.extended, opposed: tk.opposed,
    ctx: { actor, kind: "skill", char: "wp" }
  });
  const { eff, success, deg } = outcome;
  const dof  = success ? 0 : deg;
  const allRolls = [roll];
  let traumaHtml = "";
  if (!success) {
    const tRoll = await new Roll("1d100").evaluate(); allRolls.push(tRoll);
    const total = tRoll.total + 10 * (dof - 1);
    const row   = lookupTable(TRAUMA_TABLE, total);
    traumaHtml = `<div class="roll-damage-section">
      <div class="roll-damage-label">Травма (${tRoll.total}${dof > 1 ? ` +${10 * (dof - 1)}` : ""} = ${total}):</div>
      <div class="roll-threshold">${row?.text ?? "—"}</div></div>`;
    // Провал оставляет постоянный след. Без него «Подавление Травмы» на
    // вкладке Показатели не знало бы, что тестировать: раньше результат
    // просто падал в чат и исчезал.
    await createTraumaItem(actor, row);
  }
  const sub = mod ? `тест W${mod >= 0 ? "+" : ""}${mod}` : "тест W+0";
  await _postFearMsg(actor, "🧠 Ментальная Травма", sub, wp, mod, rv, eff, success, dof, traumaHtml, allRolls, {
    rerollNote, critLine: outcome.critLine, kindLabel: outcome.kindLabel,
    combinedLine: outcome.combinedLine, extendedLine: outcome.extendedLine, opposedLine: outcome.opposedLine,
    difficulty: tk.difficulty || 0, ruleParts: ruleMods.parts
  });
}

/** Характеристика тестов Страха и Шока: машина без свободы воли — Int (стр. 53). */
export function fearChar(actor) {
  return hasRuleFlag(actor, MACHINE_MIND_FLAG) ? "int" : "wp";
}

const UNIT_WORDS = { rounds: "Раундов", hours: "часов" };

/**
 * Применить строку таблицы Шока (стр. 53) — данные SHOCK_TABLE[].effect.
 * Возвращает html-строки для карточки и «откат» — что именно наложено, чтобы
 * бесплатный переброс Демона и «Вера в прошлое» могли это снять: оба
 * превращают проваленный тест в пройденный уже ПОСЛЕ броска Шока.
 */
export async function applyShockRow(actor, row) {
  const eff = row?.effect ?? {};
  const undo = { conditions: [], halfAction: false, sceneChanged: false,
                 prevScene: actor.getFlag?.("warhammer-dbc", SHOCK_SCENE_FLAG) ?? null };
  const notes = [];
  const patch = shockFlagPatch(actor, eff);
  if (eff.shocked) {
    const fields = conditionApplyFields("shocked", null, actor);
    if (Object.keys(fields).length) { Object.assign(patch, fields); undo.conditions.push("shocked"); }
    else delete patch[`flags.warhammer-dbc.${SHOCK_FLAG}`];   // иммунитет к Шоку
  }
  undo.halfAction = `flags.warhammer-dbc.${SHOCK_HALF_ACTION_FLAG}` in patch;
  undo.sceneChanged = `flags.warhammer-dbc.${SHOCK_SCENE_FLAG}` in patch;
  if (Object.keys(patch).length) await actor.update(patch);
  const shockedNow = undo.conditions.includes("shocked");

  for (const [key, formula, unit] of [["unconscious", eff.unconscious, "rounds"],
                                      ["helpless", eff.helpless, "rounds"],
                                      ["helpless", eff.catatonia, "hours"]]) {
    if (!formula) continue;
    const r = await new Roll(formula).evaluate();
    if (await applyConditionWithDuration(actor, key, { value: r.total, unit })) {
      undo.conditions.push(key);
      notes.push(`${key === "unconscious" ? "Без сознания" : "Беспомощен"}: <b>${r.total}</b> ${UNIT_WORDS[unit]} (${formula}) — снимется само`);
    }
  }
  if (undo.halfAction) notes.push("В следующий Ход — только 1 ОД (одно Полудействие)");
  if (shockedNow && eff.penalty) notes.push(`${eff.penalty} ко всем тестам, кроме T, пока в Шоке — учитывается само`);
  if (shockedNow && eff.apLock) notes.push("Не может действовать, пока в Шоке — ОД и Реакции 0");
  if (shockedNow && eff.fleeing) notes.push("Нет пути к побегу — галочка «😨 Шок: нет пути к побегу» (−20) в диалогах тестов");
  if (shockedNow && eff.noFirstTurn) notes.push("В первый Ход Шока оправиться нельзя — напоминание придёт Ходом позже");
  if (eff.scenePenalty) notes.push(`${eff.scenePenalty} ко всем тестам${eff.sceneAllTests ? "" : ", кроме T,"} до конца сцены — учитывается само`);
  let html = notes.length
    ? `<div class="roll-threshold">${notes.map(n => `• ${n}`).join("<br>")}</div>` : "";
  if (eff.heartAttack) {
    html += `<div class="roll-defense-btns">
      <button class="wh-shock-heart-btn" type="button" data-actor-uuid="${actor.uuid}">${rollIcon("skull", "#ff6b6b")} Тест T+0 — сердечный приступ</button>
    </div>`;
  }
  return { html, undo };
}

/**
 * Проваленный тест Страха засчитан пройденным (переброс Демона, «Вера в
 * прошлое») — снять Шок и вернуть потерянное Командование.
 */
export async function revertFearFailure(actor, failUndo) {
  if (!failUndo) return;
  await revertShock(actor, failUndo.shock);
  if (failUndo.morale) {
    const { revertMoraleFailure } = await import("./command-state.mjs");
    await revertMoraleFailure(failUndo.morale);
  }
}

/**
 * Персонаж кнопки карточки Страха. По uuid, а не по id: у несвязанного токена
 * id — это id актора-прототипа в мире, и кнопка сработала бы на него, а не
 * на сам токен. actorId — для карточек, созданных до этой правки.
 */
export async function fearCardActor(ctx) {
  if (ctx?.actorUuid) {
    const a = await fromUuid(ctx.actorUuid).catch(() => null);
    if (a) return a;
  }
  return ctx?.actorId ? game.actors?.get(ctx.actorId) ?? null : null;
}

/** Снять то, что наложил applyShockRow (переброс Демона, «Вера в прошлое»). */
export async function revertShock(actor, undo) {
  if (!actor || !undo) return;
  const patch = {};
  if (undo.conditions?.includes("shocked")) Object.assign(patch, conditionRemoveFields("shocked"));
  if (undo.halfAction) patch[`flags.warhammer-dbc.-=${SHOCK_HALF_ACTION_FLAG}`] = null;
  if (undo.sceneChanged) {
    if (undo.prevScene) patch[`flags.warhammer-dbc.${SHOCK_SCENE_FLAG}`] = undo.prevScene;
    else patch[`flags.warhammer-dbc.-=${SHOCK_SCENE_FLAG}`] = null;
  }
  for (const key of ["unconscious", "helpless"]) {
    if (!undo.conditions?.includes(key)) continue;
    await clearConditionDuration(actor, key);
    Object.assign(patch, conditionRemoveFields(key));
  }
  if (Object.keys(patch).length) await actor.update(patch);
}

/**
 * Такт Шока на границе Хода (стр. 53) — тест выхода катается по кнопке, тем
 * же приёмом, что напоминание Подавления (combat/suppression.mjs::
 * postSuppressionRecoveryPrompt). Провал НЕ отнимает эффекты Командования
 * (книга оговаривает отдельно), поэтому здесь нет «важный»/Infamy — только W+0.
 *
 * at:"start" — начало Хода (condition-ticks.mjs), at:"end" — конец Хода
 * (hooks.mjs); prompt:false — только сдвинуть «первый Ход», без кнопки
 * (выход в конце Хода даёт лишь «Укрепление Морали» Командования).
 *
 * «Первый Ход Шока»: ставится "pending" при наложении. Начало Хода делает его
 * текущим ("active"), конец Хода — прошедшим. Шок, полученный посреди своего
 * Хода, считает первым этот же Ход.
 */
export async function postShockRecoveryPrompt(actor, { at = "start", prompt = true } = {}) {
  const shock = activeShock(actor);
  if (shock?.firstTurn) {
    const next = (at === "start" && shock.firstTurn === "pending") ? "active" : "";
    await actor.setFlag?.("warhammer-dbc", SHOCK_FLAG, { ...shock, firstTurn: next });
    if (at === "start") {
      await postTestCard(actor, {
        icon: rollIcon("target","#8fd0ff"), title: `${esc(actor.name)} в Шоке — начало Хода`,
        outcome: `<span class="roll-failure">Первый Ход Шока — оправиться нельзя</span>`
      }, { sound: false });
    }
    return;
  }
  if (!prompt) return;
  if (shockRecoveryBlock(actor)) return;
  const where = at === "end" ? "конец Хода" : "начало Хода";
  const far = shock?.fleeing ? " Только если персонаж уже вдали от источника Страха." : "";
  const char = fearChar(actor) === "int" ? "Int" : "W";
  const rollMode = game.settings.get("core", "rollMode");
  const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("target","#8fd0ff")}${esc(actor.name)} в Шоке — ${where}</div>
        <div class="roll-threshold">Тест ${char}+0 на выход из Шока.${far}</div>
        <div class="roll-defense-btns">
          <button class="wh-shock-recovery-btn" type="button" data-actor-uuid="${actor.uuid}">Тест</button>
        </div>
      </div>`,
    sound: null
  }, rollMode);
  await ChatMessage.create(messageData);
}

/** Тест выхода из Шока (стр. 53): W+0 (машина — Int+0), тест Морали. Успех снимает conditions.shocked. */
export async function rollShockRecovery(actor) {
  const block = shockRecoveryBlock(actor);
  if (block) {
    globalThis.ui?.notifications?.warn?.(`${actor.name}: ${block}.`);
    return { success: false, blocked: block };
  }
  const char = fearChar(actor);
  const wp = actor.system.characteristics[char]?.total ?? 0;
  const { eff, parts, roll, rv, rerollNote, success, dof, usedReroll } =
    await rollMoraleTest(actor, wp, { affectsCommand: false, char });
  if (success) await actor.update(conditionRemoveFields("shocked"));
  await applyLordOfExoditesFailPenalty(actor, { dof, usedReroll });

  await postTestCard(actor, {
    icon: rollIcon("target","#8fd0ff"), title: `Выход из Шока — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: char === "int" ? "Int" : "WP", base: wp, parts, threshold: eff, rv }),
    rerollNote,
    outcome: success
      ? `<span class="roll-success">Успех — Шок снят</span>`
      : `<span class="roll-failure">Провал — всё ещё в Шоке</span>`
  }, { rolls: [roll] });
  return { success, rv, eff };
}

/**
 * Сердечный приступ (строка 171+): «тест T+0 или умереть; при Успехе —
 * кататония на 1d5 часов». Смерть — через ту же кнопку «Констатировать
 * смерть», что у крит-таблиц: её жмёт владелец, и за ней стоит Спасение от
 * смерти (rules/death-save.mjs).
 */
export async function rollHeartAttack(actor) {
  const t = actor.system.characteristics.t?.total ?? 0;
  const ruleMods = autoTestMods(actor, { kind: "skill", char: "t" });
  const eff = t + ruleMods.total;
  const { roll, rv, rerollNote } = await rollD100WithReroll(null);
  const { success } = testOutcome(rv, eff);
  let extra;
  if (success) {
    const r = await new Roll("1d5").evaluate();
    await applyConditionWithDuration(actor, "helpless", { value: r.total, unit: "hours" });
    extra = `<div class="roll-threshold">Кататония: Беспомощен <b>${r.total}</b> часов (1d5) — снимется само.</div>`;
  } else {
    extra = deathButtonHtml("Персонаж умирает от сердечного приступа.", actor.uuid);
  }
  await postTestCard(actor, {
    icon: rollIcon("skull", "#ff6b6b"), title: `Сердечный приступ — ${esc(actor.name)}`,
    threshold: rollStatLine({ label: "T", base: t, parts: ruleMods.parts, threshold: eff, rv }),
    rerollNote,
    outcome: success
      ? `<span class="roll-success">Выжил — кататония</span>`
      : `<span class="roll-failure">Провал — сердце останавливается</span>`,
    sections: [extra]
  }, { rolls: [roll] });
  return { success };
}

/**
 * Общая карточка для Страха/Травмы. rerollCtx (только у Страха, при
 * непройденном тесте с «Демон») добавляет кнопку и кладёт контекст в
 * flags.warhammer-dbc.fearTest — оттуда её читает обработчик в hooks.mjs.
 */
export async function _postFearMsg(actor, header, sub, wp, mod, rv, eff, success, dof, extraHtml, allRolls,
  { properties = {}, rerollCtx = null, faithCtx = null, rerollNote = "", critLine = "", charLabel = "W",
    kindLabel = null, combinedLine = "", extendedLine = "", opposedLine = "", difficulty = 0, ruleParts = [] } = {}) {
  const dice = (await Promise.all(allRolls.map(r => r.render()))).join("");
  // Свойства источника Страха (напр. Демон) — для будущих эффектов, которые
  // будут цепляться за них (Хатред и т.п.); здесь же дают бесплатный переброс.
  const propLabels = { demon: "Демон" };
  const activeProps = Object.entries(properties).filter(([, v]) => v).map(([k]) => propLabels[k] || k);
  const propsHtml = activeProps.length
    ? `<div class="roll-threshold">Свойства: <b>${activeProps.join(", ")}</b></div>` : "";
  const rerollHtml = rerollCtx ? `
    <div class="roll-defense-section roll-fear-reroll">
      <div class="roll-defense-title">Демон — доступен бесплатный переброс</div>
      <div class="roll-defense-btns">
        <button type="button" class="wh-fear-reroll-btn">🎲 Бесплатный переброс</button>
      </div>
    </div>` : "";
  // Карточка в чате одна на всех, поэтому кнопку рисуем всем, а класс
  // wh-owner-only прячет её у тех, кто не владеет актором (обработчик всё
  // равно перепроверяет права). Неактивна, если тратить нечего.
  const hasPoint = (Number(actor.system.fate?.value) || 0) > 0;
  const faithHtml = faithCtx ? `
    <div class="roll-defense-section roll-fear-faith wh-owner-only" data-actor-uuid="${actor.uuid}">
      <div class="roll-defense-title">${faithCtx.label}</div>
      <div class="roll-defense-btns">
        <button type="button" class="wh-fear-faith-btn" ${hasPoint ? "" : "disabled"}
                title="${hasPoint ? "Потратить Очко: тест пройден с 1 успехом, +1 Порчи" : "Нет Очков Судьбы/Бесчестья"}">
          🕯️ Вера в прошлое
        </button>
      </div>
    </div>` : "";

  // Строка Порога и вся обвязка карточки — общим сборщиком (wdbc-kuun).
  // Раньше разметка жила здесь своей копией: «Сложность» и модификатор
  // дописывались к числу без разделителей, тогда как боевые карточки
  // перечисляли слагаемые в скобках через запятую. Теперь вид один.
  const parts = [
    mod !== 0 ? `модификатор ${mod >= 0 ? "+" : ""}${mod}` : "",
    difficulty !== 0 ? `📊 Сложность ${difficulty >= 0 ? "+" : ""}${difficulty}` : "",
    ...ruleParts
  ];
  await postTestCard(actor, {
    title: `${header}${kindLabel ? ` · ${kindLabel}` : ""} — ${esc(actor.name)}`,
    threshold: rollStatLine({ prefix: sub, label: charLabel, base: wp, parts, threshold: eff, rv }),
    lines: [combinedLine, propsHtml],
    rerollNote, critLine,
    outcome: success
      ? `<span class="roll-success">Успех — выстоял</span>`
      : `<span class="roll-failure">Провал — ${dof} ${_degWord(dof)}</span>`,
    sections: [
      extraHtml, extendedLine, opposedLine, rerollHtml, faithHtml,
      `<details class="roll-dice-details"><summary>${rollIcon("chart","#8fd0ff")}Показать кубы</summary>${dice}</details>`
    ]
  }, {
    rolls: allRolls,
    // Кнопки карточки читают свой контекст из флагов сообщения: бесплатный
    // переброс «Демон» (hooks.mjs) и «Вера в прошлое» (Особенность Мира).
    flags: (rerollCtx || faithCtx) ? {
      "warhammer-dbc": {
        ...(rerollCtx ? { fearTest: { actorId: actor.id, actorUuid: actor.uuid, properties, ...rerollCtx } } : {}),
        ...(faithCtx ? { faithInThePast: faithCtx } : {})
      }
    } : null
  });
}
