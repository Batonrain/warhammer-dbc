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
import { postTestCard, thresholdLine } from "../helpers/test-card.mjs";
import { parseCritEffectPills, critPillsHtml }     from "./crit-effect-parser.mjs";
import { rollMoraleTest }                          from "../rules/morale-test.mjs";
import { applyLordOfExoditesFailPenalty }          from "./lord-of-exodites.mjs";

/** Возможность «Абсолютная вера в прошлое» (Мир-кладбище). */
export const FAITH_FLAG = "fear.faithInThePast";

/** Полный иммунитет к Страху — автоуспех любого теста Страха (wdbc-m7we). */
export const FEAR_IMMUNE_FLAG = "fear.immune";

/**
 * Тест Страха (1d100 + 10×Провалы−1 − Infamy → таблица Шока при провале).
 * ratingKey — ключ FEAR_RATINGS. properties.demon + провал → карточка
 * получает кнопку ОДНОГО бесплатного переброса; opts.free помечает, что
 * ЭТОТ вызов — уже сам такой переброс, поэтому повторно кнопку не даём
 * (одна бесплатная попытка на тест, не бесконечная цепочка).
 */
export async function _executeFearRoll(actor, ratingKey, type, infamy, mod, properties = {}, opts = {}) {
  const wp = actor.system.characteristics.wp?.total ?? 0;
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
  const ratingMod = type === "important" ? r.important : r.normal;
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
  const ruleMods = autoTestMods(actor, { kind: "skill", char: "wp", morale: true });
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
  const autoPass = steelHeartIgnored || infamy >= r.infamy
                   || hasRuleFlag(actor, "sarcophagus.autoPassFear")
                   || hasRuleFlag(actor, FEAR_IMMUNE_FLAG);

  const reroll = tk.reroll || null;
  const { roll, rv, rolls, rerollNote } = await rollD100WithReroll(reroll);

  const outcome = await resolveKindOutcome(actor, {
    kind: tk.kind || "base", baseEff, rv, combined: tk.combined, extended: tk.extended, opposed: tk.opposed,
    ctx: { actor, kind: "skill", char: "wp", morale: true }, autoSuccess: autoPass
  });
  const { eff, success, deg } = outcome;
  const dof      = success ? 0 : deg;
  const allRolls = [roll];
  let shockHtml  = "";
  if (!success) {
    const sRoll = await new Roll("1d100").evaluate(); allRolls.push(sRoll);
    const total = sRoll.total + 10 * (dof - 1) - infamy;
    if (total <= 0) {
      shockHtml = `<div class="roll-outcome"><span class="roll-success">${rollIcon("shield","#4dffa6")}Шок предотвращён (Infamy)</span></div>`;
    } else {
      const row = lookupTable(SHOCK_TABLE, total);
      // wdbc-xql6: та же пилюльная обвязка, что у крит-таблиц — цель Шока
      // это сам actor теста Страха, известен уже здесь.
      const shockPills = row?.text ? parseCritEffectPills(row.text) : [];
      shockHtml = `<div class="roll-damage-section">
        <div class="roll-damage-label">Шок (${sRoll.total}${dof > 1 ? ` +${10 * (dof - 1)}` : ""}${infamy ? ` −${infamy}` : ""} = ${total}):</div>
        <div class="roll-threshold">${row?.text ?? "—"}</div>
        ${critPillsHtml(shockPills, actor.uuid)}</div>`;
      // Персистентное состояние «в Шоке» (стр. 53) — снимается тестом
      // выхода из Шока в начале Хода (rollShockRecovery ниже).
      await actor.update(conditionApplyFields("shocked", null, actor));
    }
  }
  await applyLordOfExoditesFailPenalty(actor, { dof, usedReroll: !!reroll });
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
  const faithCtx = faithLabel ? { actorId: actor.id, label: faithLabel } : null;

  const canReroll = !!properties.demon && !success && !opts.free;
  await _postFearMsg(actor, "Тест Страха", r.label, wp, ratingMod + mod, rv, eff, success, dof, shockHtml, allRolls, {
    properties, rerollCtx: canReroll ? { ratingKey, type, infamy, mod } : null, faithCtx,
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
    kind: tk.kind || "base", baseEff, rv, combined: tk.combined, extended: tk.extended, opposed: tk.opposed,
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

/**
 * Напоминание в начале Хода Шокированного персонажа (стр. 53) — тест выхода
 * из Шока катается по кнопке (не автоматически), тем же приёмом, что
 * напоминание Подавления (module/combat/suppression.mjs::
 * postSuppressionRecoveryPrompt). Провал НЕ отнимает эффекты Командования
 * (книга это отдельно оговаривает), поэтому в отличие от исходного теста
 * Страха здесь нет параметра «важный»/Infamy — только W+0.
 */
export async function postShockRecoveryPrompt(actor) {
  const rollMode = game.settings.get("core", "rollMode");
  const messageData = ChatMessage.applyRollMode({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div class="wh-roll-result">
        <div class="roll-header">${rollIcon("target","#8fd0ff")}${esc(actor.name)} в Шоке — начало Хода</div>
        <div class="roll-threshold">Тест W+0 на выход из Шока.</div>
        <div class="roll-defense-btns">
          <button class="wh-shock-recovery-btn" type="button" data-actor-uuid="${actor.uuid}">Тест</button>
        </div>
      </div>`,
    sound: null
  }, rollMode);
  await ChatMessage.create(messageData);
}

/** Тест выхода из Шока (стр. 53): W+0, тест Морали. Успех снимает conditions.shocked. */
export async function rollShockRecovery(actor) {
  const wp = actor.system.characteristics.wp?.total ?? 0;
  const { eff, parts, roll, rv, rerollNote, success, dof, usedReroll } = await rollMoraleTest(actor, wp);
  if (success) await actor.update(conditionRemoveFields("shocked"));
  await applyLordOfExoditesFailPenalty(actor, { dof, usedReroll });

  await postTestCard(actor, {
    icon: rollIcon("target","#8fd0ff"), title: `Выход из Шока — ${esc(actor.name)}`,
    threshold: thresholdLine({ label: "WP", base: wp, parts, threshold: eff }),
    rv, rerollNote,
    outcome: success
      ? `<span class="roll-success">Успех — Шок снят</span>`
      : `<span class="roll-failure">Провал — всё ещё в Шоке</span>`
  }, { rolls: [roll] });
  return { success, rv, eff };
}

/**
 * Общая карточка для Страха/Травмы. rerollCtx (только у Страха, при
 * непройденном тесте с «Демон») добавляет кнопку и кладёт контекст в
 * flags.warhammer-dbc.fearTest — оттуда её читает обработчик в hooks.mjs.
 */
export async function _postFearMsg(actor, header, sub, wp, mod, rv, eff, success, dof, extraHtml, allRolls,
  { properties = {}, rerollCtx = null, faithCtx = null, rerollNote = "", critLine = "",
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
    <div class="roll-defense-section roll-fear-faith wh-owner-only" data-actor-id="${actor.id}">
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
    threshold: thresholdLine({ prefix: sub, label: "W", base: wp, parts, threshold: eff }),
    lines: [combinedLine, propsHtml],
    rv, rerollNote, critLine,
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
        ...(rerollCtx ? { fearTest: { actorId: actor.id, properties, ...rerollCtx } } : {}),
        ...(faithCtx ? { faithInThePast: faithCtx } : {})
      }
    } : null
  });
}
