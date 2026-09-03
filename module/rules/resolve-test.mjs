// module/rules/resolve-test.mjs
//
// Единый конвейер теста. Семь фаз (docs/architecture-plan.md, этап 2):
//
//   1. Контекст     — кто бросает, чем, по кому, вид теста
//   2. Сбор правил  — источники плюс хук «dbc.collectRules»
//   3. Отбор        — по `when`, снятие вытесненных
//   4. Диалог       — ситуативные галочки игроку
//   5. Бросок       — единственное место, где встречается 1d100
//   6. Последствия  — урон, крит, состояния
//   7. Карточка     — сообщение в чат
//
// Здесь живут только фазы 1–3: они не знают ни про интерфейс, ни про чат, ни про
// кубик, и потому проверяются тестом без запуска Foundry. Фазы 4 и 6–7 пока
// остаются в листе персонажа, который берёт у конвейера готовый список правил и
// галочек. Фаза 5b (исход уже брошенного d100 против порога — успех/провал и
// степень) вынесена в rules/roll-outcome.mjs и подключена у Характеристики,
// Навыка, Атаки, Страха, Ужаса и Безумия (wdbc-4l9i); сам бросок кубика и выбор
// переброса остаются на месте вызова.

import { gatherRules, selectRules } from "./collect.mjs";
import { isKnownEffectKind } from "./effects.mjs";
import { SKILLS_DEF } from "../constants/skills.mjs";
import { itemHasName, sizeOf } from "./predicates.mjs";
import { WEAPON_PROPERTIES } from "../constants/weapon-properties.mjs";
import { mechFormulaTotalSafe, mechRollData } from "./mech-formula.mjs";

/**
 * Социальный ли навык. Своего перечня здесь нет намеренно: признак уже лежит
 * в таблице навыков (constants/skills.mjs, apt2:"social") — Обаяние,
 * Командование, Коммерция, Обман, Дознание, Допрос, Запугивание. Заведи мы
 * второй список, он разошёлся бы с первым при добавлении навыка.
 *
 * Проницательность (scrutiny) помечена «общей» и сюда не входит — так в книге.
 */
function isSocialSkill(skill) {
  return SKILLS_DEF?.[String(skill ?? "")]?.apt2 === "social";
}

/**
 * Встречные Запугивание/Пытки — тесты Морали по книге (core.json, «Мораль и
 * Потеря Командования», стр. 51). Диалог Навыка на листе не знает заранее,
 * встречным ли будет тест (Вид теста игрок выбирает уже В диалоге, после того
 * как ctx для галочек уже собран) — поэтому область "morale" включается для
 * ЛЮБОГО броска этими двумя навыками, не только фактически встречного: не
 * различить дешевле, чем разойтись с буквой книги в частом (боевом) случае.
 */
export function isMoraleOpposedSkill(skill) {
  return skill === "intimidate" || skill === "interrogate";
}

/** Хук вне Foundry не существует: в тестах конвейер работает без него. */
function callHook(name, ...args) {
  if (typeof Hooks === "undefined") return;
  Hooks.callAll(name, ...args);
}

/**
 * Фаза 1. Контекст броска в одном объекте.
 *
 * Поля `kind`, `skill`, `group`, `specialty`, `char` и флаговые (`suppression`,
 * `single`, `target`) читает матчер ситуативных модификаторов
 * (rules/match-context.mjs), поэтому имена и значения совпадают с тем, что лист
 * собирал раньше: `kind: "skill"` у тестов и навыка, и характеристики.
 *
 * Актор цели лежит в `targetActor`: имя `target` в этом же объекте занято
 * флагом «бросок нацелен».
 */
export function buildTestContext(input = {}) {
  const ctx = { kind: "skill", ...input };
  ctx.actor ??= null;
  return ctx;
}

/**
 * Область атаки: `attack` — любой удар и выстрел, `weapon:melee` и
 * `weapon:ranged` — половина из них, `weapon:<класс>` — конкретный класс оружия
 * (`pistol`, `heavy`, `basic`…).
 *
 * Метательное считается рукопашным, как и в самой атаке
 * ([attack.mjs](../combat/attack.mjs), `isMelee`): расходись эти два места, одно
 * и то же правило действовало бы по-разному в диалоге и в броске.
 */
function attackScopeApplies(scope, ctx) {
  if (scope === "attack") return true;
  if (!scope.startsWith("weapon:")) return false;
  const want = scope.slice("weapon:".length);
  if (want === "melee")  return ctx.isMelee === true;
  if (want === "ranged") return ctx.isMelee === false;
  return want === String(ctx.weaponClass ?? "").toLowerCase();
}

/**
 * Область манифестации: `power` — любая психосила, `power:<имя>` — конкретная.
 *
 * Имя сравнивается тем же способом, что имена Талантов и Черт в условиях
 * (`hasTalent`): по любой половине двуязычного имени, со снятой специализацией
 * в скобках. Иначе «Smite / Порицание» и «Порицание» были бы разными силами.
 */
function powerScopeApplies(scope, ctx) {
  if (scope === "power") return true;
  if (!scope.startsWith("power:")) return false;
  return itemHasName(ctx.power, scope.slice("power:".length));
}

/**
 * Область действия эффекта: `target` записывается с двоеточием
 * (`skill:medicae`, `char:wp`, `weapon:melee`, `initiative`), `all` или пустой —
 * «в любом тесте».
 *
 * Тест навыка и тест характеристики различаются наличием `ctx.skill`: у теста
 * характеристики его нет. Поэтому `char:int` не подхватывается броском навыка на
 * Интеллекте — иначе одна запись означала бы два разных правила книги.
 *
 * По той же причине атака отбирается отдельной веткой и не подхватывает
 * `char:ws`: «+10 к тестам Оружейного Мастерства» и «+10 ко всем ударам» — два
 * разных правила книги, и различает их область.
 *
 * Манифестация — третья такая ветка: психотест идёт по Воле, а у Прорицания по
 * Псинауке, но «+10 к тестам Воли» и «+10 к манифестациям» — снова два разных
 * правила книги.
 *
 * Суффикс `:recipient` (wdbc-uez7 — делегированный тест) — правило с
 * Предмета/Таланта ПОЛУЧАТЕЛЯ чужого теста (пациент при Лечении, а не сам
 * медик): «Высокий болевой порог» пациента должно влиять на Медику ДОКТОРА
 * над ним, а не на собственные броски пациента. Требует `ctx.asRecipient`
 * — вызывающий код собирает правила С САМОГО получателя (`resolveTest({
 * actor: patient, ..., asRecipient: true })`) отдельным проходом от обычных
 * правил бросающего. Без суффикса эффект остаётся «про свои тесты» и в
 * режиме получателя не подмешивается — иначе Талант «+10 Медика» самого
 * пациента (для ЕГО собственных бросков) тайно засчитался бы доктору только
 * потому, что оба читают один и тот же `ctx.skill`.
 */
function effectAppliesTo(target, ctx) {
  const scope = String(target ?? "all").trim().toLowerCase();

  if (scope.endsWith(":recipient")) {
    if (!ctx.asRecipient) return false;
    return effectAppliesTo(scope.slice(0, -":recipient".length), { ...ctx, asRecipient: false });
  }
  if (ctx.asRecipient) return false;

  if (scope === "all" || scope === "") return true;
  if (scope === "initiative") return ctx.kind === "initiative";
  // Нестабильность — свой вид теста, а не тест Воли: демон бросает его по W, но
  // «+10 к тестам Воли» и «+Inf на Нестабильность» — разные правила книги.
  if (scope === "instability") return ctx.kind === "instability";
  // Тесты Морали (core.json, «Мораль и Потеря Командования», стр. 51): Страх,
  // выход из Шока, Паника от Горения, Подавление, встречные Запугивание/Пытки.
  // Разные тесты идут разными путями (навык, характеристика, вообще без
  // диалога) — общего ctx.kind/ctx.skill на них нет, поэтому вызывающий код
  // сам проставляет ctx.morale=true там, где RAW называет тест тестом Морали.
  if (scope === "morale") return ctx.morale === true;
  // Встречный тест демона против Экзорцизма/Чистой Демонологии (Локус Цепей,
  // wdbc-smc, daemon-sheet.mjs::_rollVsExorcism) — узкий вид теста, а не любой
  // "opposed": книга даёт бонус именно этому конкретному тесту, не всем
  // встречным тестам подряд.
  if (scope === "vsexorcism") return ctx.kind === "vsExorcism";
  if (scope === "social") return isSocialSkill(ctx.skill);
  // Любой тест НАВЫКА (обычного или группового), но не Характеристики — тест
  // характеристики не несёт ни ctx.skill, ни ctx.group (см. коммент выше).
  // Пока единственный потребитель — Зависимость (rules/addiction.mjs).
  if (scope === "anyskill") return !!(ctx.skill || ctx.group);
  // Карабканье (wdbc-egll) — свой ctx-флаг, не через ctx.skill: тест
  // Карабканья идёт по тому же Athletics(S), что и тесты Борьбы
  // (module/combat/grapple.mjs), и «skill:athletics» подхватил бы оба —
  // разные правила книги под одинаковым навыком.
  if (scope === "climbing") return ctx.climbing === true;
  if (ctx.kind === "attack") return attackScopeApplies(scope, ctx);
  if (ctx.kind === "power")  return powerScopeApplies(scope, ctx);
  if (ctx.skill) return scope === `skill:${String(ctx.skill).toLowerCase()}`;
  // Групповой навык (Навигация/Ремесло/…) несёт ключ в ctx.group, не ctx.skill
  // (см. onSkillRoll, actor-sheet.mjs) — «skill:navigation» обязано ловить его
  // так же, как обычный навык: одно и то же правило книги («+10 Navigation
  // (Surface)», Cartograph) не должно молчать только потому, что навык
  // групповой. Специализация (ctx.specialty) в отборе не участвует — запись
  // не умеет её сузить, тот же компромисс, что у остальных ситуативных
  // модификаторов этой области.
  if (ctx.group)  return scope === `skill:${String(ctx.group).toLowerCase()}`;
  if (ctx.char)  return scope === `char:${String(ctx.char).toLowerCase()}`;
  return false;
}

/**
 * Значение эффекта. Обычно это число в `value`, но у правил, зависящих от того,
 * по кому бьют, числа в данных быть не может: «Проворный» даёт атакующему минус
 * Бонус Ловкости ЦЕЛИ, а он у каждой цели свой. Такие правила пишут `valueFrom`,
 * и значение считается на каждый бросок.
 *
 * Источники: `targetCharBonus`/`selfCharBonus` (бонус характеристики цели или
 * самого бросающего) и `targetSize`/`selfSize` (Размер цели или бросающего —
 * стр. 30, «Проворный» и таблица Размера дают +10/−10 за каждую ступень).
 * Неизвестный источник не превращается молча в ноль, а жалуется: правило,
 * тихо давшее «+0», ищется днями.
 *
 * `formula` (wdbc-1rno, modValueMode:"formula" у kind:"testMod") — та же
 * mech-formula.mjs нотация, что у полей «Значение»/«Рейтинг» Конструктора
 * («ceil(cor/2)» — Black Eyes: «+½Cor(окр.▲) на тесты зрения»), но считается
 * заново на КАЖДЫЙ бросок от ctx.actor — testMod живой запрос, а не разовая
 * выдача (в отличие от kind:"trait"/"characteristic", где формула застывает
 * числом один раз при получении предмета). Safe-вариант — недопустимая
 * формула тут не должна ронять бросок, тот же принцип, что и у остального
 * конвейера теста.
 *
 * @returns {?number} null, если источник значения не распознан
 */
function effectValue(effect, ctx, ruleId) {
  if (effect.formula != null) return mechFormulaTotalSafe(effect.formula, mechRollData(ctx?.actor));
  if (!effect.valueFrom) return Number(effect.value) || 0;

  const { targetCharBonus, selfCharBonus, targetSize, selfSize, multiplier = 1 } = effect.valueFrom;
  // Своя характеристика: «+Inf герольда на тесты Нестабильности» (Локус Цепей).
  // Числа в данных быть не может — Бесчестие у каждого своё.
  // "pr" — не характеристика: Психосилы/Техночудеса скалируются собственным
  // текущим Пси-Рейтингом кастера (актора.system.psyker.currentRating, уже
  // уменьшенным поддерживаемыми силами), не бонусом characteristics[x].bonus
  // (wdbc-jw81 — «+PR»/«+2×PR» встречается почти в каждой записи пака).
  if (selfCharBonus === "pr") {
    const pr = Number(ctx?.actor?.system?.psyker?.currentRating) || 0;
    return pr * multiplier || 0;
  }
  // "cor" — тоже не Характеристика: Порча (system.corruptionBonus, wdbc-1rno)
  // не входит в characteristics{}. Книга почти всегда даёт «½Cor.b (окр.▲)»
  // (Enchanting Voice, Black Eyes и др.) — не то же самое, что multiplier у
  // остальных источников (там всегда целые множители вроде ×2), поэтому
  // здесь multiplier может быть дробным и результат ВСЕГДА округляется вверх
  // (Math.ceil), как требует книга; multiplier=1 (по умолчанию) не меняет
  // округление благодаря Math.ceil на целом числе.
  if (selfCharBonus === "cor") {
    const cb = Number(ctx?.actor?.system?.corruptionBonus) || 0;
    return Math.ceil(cb * multiplier) || 0;
  }
  if (selfCharBonus) {
    const bonus = ctx?.actor?.system?.characteristics?.[selfCharBonus]?.bonus ?? 0;
    return bonus * multiplier || 0;
  }
  if (targetCharBonus) {
    const bonus = ctx?.targetActor?.system?.characteristics?.[targetCharBonus]?.bonus ?? 0;
    // «|| 0» убирает минус ноль: без цели галочка иначе подписывалась бы «−0».
    return bonus * multiplier || 0;
  }
  if (selfSize)   return sizeOf(ctx?.actor) * multiplier || 0;
  if (targetSize) return sizeOf(ctx?.targetActor) * multiplier || 0;

  console.error(`Warhammer DBC | правило «${ruleId ?? "без id"}»: неизвестный источник значения ${JSON.stringify(effect.valueFrom)}`);
  return null;
}

/**
 * Галочки для диалога броска. Формат тот же, что у Особенностей Происхождения и
 * предметных `rollMods`: { value, label, halvePenalty } — лист складывает их
 * одинаково, не зная, откуда галочка пришла.
 *
 * Отбор по `when` уже прошёл на фазе 3, поэтому `when` в галочке нет: правило,
 * не подходящее актору, сюда не доходит. Остаётся `ruleId` — по нему видно,
 * какое правило дало модификатор.
 *
 * Модификатор не применяется молча: игрок сам решает, уместен ли он здесь, — так
 * же, как с Особенностями.
 */
export function rollModsFromRules(rules, ctx = {}) {
  const mods = [];
  for (const rule of rules ?? []) {
    for (const effect of rule?.effects ?? []) {
      if (!isKnownEffectKind(effect?.kind)) {
        console.error(`Warhammer DBC | правило «${rule?.id ?? "без id"}»: неизвестный вид эффекта «${effect?.kind}»`);
        continue;
      }
      if (!effectAppliesTo(effect.target, ctx)) continue;

      const label = effect.label ?? rule.label ?? rule.id;
      if (effect.kind === "rollBonus") {
        const value = effectValue(effect, ctx, rule.id);
        if (value !== null) mods.push({ ruleId: rule.id, label, value, halvePenalty: false });
        continue;
      }
      // Диалог умеет только ополовинить штраф — другого множителя в нём нет.
      // Правило с иным factor не применяем молча, а жалуемся: тихо потерянный
      // множитель ищется днями.
      if (effect.kind === "penaltyMul") {
        if (Number(effect.factor) !== 0.5) {
          console.error(`Warhammer DBC | правило «${rule?.id ?? "без id"}»: множитель штрафа ${effect.factor} диалог броска не умеет, только 0.5`);
          continue;
        }
        mods.push({ ruleId: rule.id, label, value: 0, halvePenalty: true });
      }
      // Остальные виды эффектов на бросок не влияют: они про урон, броню и
      // производные поля, и подключаются вместе с фазами 5–6. Переброс
      // (`rollMode`) — не модификатор: его не с чем складывать, он меняет сам
      // бросок, и потому едет отдельным списком (rerollsFromRules ниже).
    }
  }
  return mods;
}

/** Режимы переброса, которые понимает бросок. Умолчание — «лучший из двух». */
const REROLL_MODES = new Set(["keepBest", "keepWorst"]);

/**
 * Перебросы, доступные на ЭТОМ броске. Книга даёт их россыпью — «раз в Раунд
 * перебросить любой тест A» (Локус Грации), «перебросить любой тест атаки»
 * (Локус Буйства), «перебрасывать все тесты на щиты» (Локус Преломления) — и
 * все они одной формы: бросить несколько раз и оставить лучший.
 *
 * Отдельно от `rollModsFromRules` по существу дела, а не для порядка: галочки
 * там складываются в одно число, а переброс складывать не с чем. Диалог
 * показывает их своей строкой, и игрок решает, тратить ли переброс здесь.
 *
 * Область отбирается тем же `effectAppliesTo`, что и у модификаторов: «+10 к
 * тестам Ловкости» и «переброс теста Ловкости» обязаны срабатывать на одних и
 * тех же бросках, иначе одно и то же слово книги значило бы разное.
 */
export function rerollsFromRules(rules, ctx = {}) {
  const out = [];
  for (const rule of rules ?? []) {
    for (const effect of rule?.effects ?? []) {
      if (effect?.kind !== "rollMode") continue;
      if (!effectAppliesTo(effect.target, ctx)) continue;

      const mode = effect.mode ?? "keepBest";
      if (!REROLL_MODES.has(mode)) {
        console.error(`Warhammer DBC | правило «${rule?.id ?? "без id"}»: неизвестный режим переброса «${mode}»`);
        continue;
      }
      // Один бросок — не переброс. Молча превратить это в «лучший из одного»
      // значило бы показать игроку кнопку, которая ничего не делает.
      const rolls = effect.rolls == null ? 2 : Number(effect.rolls);
      if (!Number.isFinite(rolls) || rolls < 2) {
        console.error(`Warhammer DBC | правило «${rule?.id ?? "без id"}»: перебросу нужно не меньше двух бросков, задано ${effect.rolls}`);
        continue;
      }
      // who — чей бросок: свой или навязанный цели. Диалог показывает игроку
      // только свои; чужие уезжают на кнопки защиты в карточке атаки.
      out.push({ ruleId: rule.id, label: effect.label ?? rule.label ?? rule.id, mode, rolls,
                 who: effect.who === "target" ? "target" : "self" });
    }
  }
  return out;
}

/**
 * Расширение диапазона Критического Успеха/Провала (стр. 25) от эффектов
 * `critRangeMod`. В отличие от `rollModsFromRules` это не галочки для игрока —
 * диапазон не выбирают, он просто шире, пока действует правило, — поэтому сразу
 * сумма по стороне, а не список.
 *
 * @returns {{successExtra:number, failExtra:number}}
 */
export function critModsFromRules(rules, ctx = {}) {
  let successExtra = 0, failExtra = 0;
  for (const rule of rules ?? []) {
    for (const effect of rule?.effects ?? []) {
      if (effect?.kind !== "critRangeMod") continue;
      if (!effectAppliesTo(effect.target, ctx)) continue;
      const value = Number(effect.value) || 0;
      const side = effect.side ?? "both";
      if (side === "success" || side === "both") successExtra += value;
      if (side === "failure" || side === "both") failExtra += value;
    }
  }
  return { successExtra, failExtra };
}

/**
 * Особые Свойства Оружия, которые эта атака получает не от самого оружия, а от
 * правила (wdbc-w8z4): цель помечена, у актора есть Дар/Талант, и т.п. — то же
 * cross-actor чтение флага цели через `ctx.targetActor`, что уже делает
 * `rollBonus` (Проворный/Avatar of Slaughter/Hex-Marked Prey), только вместо
 * числа к порогу добавляется запись `{key, rating, rating2}` для движка сборки
 * wProps (combat/weapon-properties.mjs::resolveWeaponPropsList/aggregateAuto).
 *
 * В отличие от `rollBonus` эффект не превращается в галочку диалога: Особое
 * Свойство — это факт об атаке при выполненном условии, а не число, которое
 * может задвоиться с чем-то ещё (тот же принцип, что у `critRangeMod` — «не
 * выбирают, оно просто есть, пока действует правило»). Порядок отбора тот же:
 * `when` уже прошло на фазе 3, здесь только форма выдачи.
 *
 * Неизвестный `propKey` (опечатка в данных) — ошибка в консоль, запись не
 * идёт в результат: молча пропавшее свойство оружия ищется днями, как и
 * неизвестный `kind`/источник значения выше.
 *
 * @returns {{ruleId:string, label:string, key:string, rating:number, rating2:number}[]}
 */
export function weaponPropsFromRules(rules, ctx = {}) {
  const out = [];
  for (const rule of rules ?? []) {
    for (const effect of rule?.effects ?? []) {
      if (effect?.kind !== "grantWeaponProp") continue;
      if (!effectAppliesTo(effect.target, ctx)) continue;

      const key = String(effect.propKey ?? "").trim();
      if (!key || !Object.hasOwn(WEAPON_PROPERTIES, key)) {
        console.error(`Warhammer DBC | правило «${rule?.id ?? "без id"}»: неизвестное Особое Свойство Оружия «${effect.propKey}»`);
        continue;
      }
      out.push({
        ruleId: rule.id, label: effect.label ?? rule.label ?? rule.id,
        key, rating: Number(effect.rating) || 0, rating2: Number(effect.rating2) || 0
      });
    }
  }
  return out;
}

/**
 * Доп. степени провала, если тест УЖЕ провален (wdbc-1rno: Sentient Cyst,
 * «+3 Провала при провале социального теста») — эффект `failDegMod`, тот же
 * принцип суммирования, что у `critRangeMod` выше (безусловно, не галочка),
 * но применяется ПОСЛЕ броска (`rules/kind-outcome.mjs::resolveKindOutcome`),
 * а не в модификаторах диалога — на успешный тест не влияет вовсе.
 *
 * @returns {number} сумма value всех подходящих failDegMod (может быть 0)
 */
export function failDegModFromRules(rules, ctx = {}) {
  let extra = 0;
  for (const rule of rules ?? []) {
    for (const effect of rule?.effects ?? []) {
      if (effect?.kind !== "failDegMod") continue;
      if (!effectAppliesTo(effect.target, ctx)) continue;
      extra += Number(effect.value) || 0;
    }
  }
  return extra;
}

/**
 * Скрипты Механики (kind:"script"), назначенные срабатывать автоматически по
 * исходу ЭТОГО теста (wdbc-1rno: «Полимат» — Крит на тесте Крафта, «Библиотека
 * Акаши» — Крит на тесте Знания). Здесь только ОТБОР подходящих (область +
 * side ещё не сверен с реальным success/crit — тот известен только после
 * броска) — сам запуск делает `rules/kind-outcome.mjs::resolveKindOutcome`,
 * у которого есть live `actor`/`item` для `executeItemCode`; здесь их нет
 * (список правил не хранит документы, только itemId/entryId — тот же
 * принцип, что у `grantItem` (`uuid`), эффекты остаются чистыми данными).
 *
 * @returns {{itemId:string, entryId:string, side:string, ruleId:string}[]}
 */
export function scriptTriggersFromRules(rules, ctx = {}) {
  const out = [];
  for (const rule of rules ?? []) {
    for (const effect of rule?.effects ?? []) {
      if (effect?.kind !== "scriptTrigger") continue;
      if (!effectAppliesTo(effect.target, ctx)) continue;
      out.push({ itemId: effect.itemId, entryId: effect.entryId, side: effect.side, ruleId: rule.id });
    }
  }
  return out;
}

/**
 * Фазы 1–3 целиком: контекст, сбор, отбор.
 *
 * Хук «dbc.collectRules» получает контекст и изменяемый список правил до
 * отбора — так сторонний модуль дописывает правила, и они просеиваются по `when`
 * наравне с остальными.
 *
 * @returns {{ctx: object, rules: object[], mods: object[], rerolls: object[]}}
 */
export function resolveTest(input = {}) {
  const ctx = buildTestContext(input);
  const bag = gatherRules(ctx.actor, ctx);
  callHook("dbc.collectRules", ctx, bag);
  const rules = selectRules(bag, ctx.actor, ctx);
  return {
    ctx, rules,
    mods: rollModsFromRules(rules, ctx),
    rerolls: rerollsFromRules(rules, ctx),
    crit: critModsFromRules(rules, ctx),
    weaponProps: weaponPropsFromRules(rules, ctx),
    failDegExtra: failDegModFromRules(rules, ctx),
    scriptTriggers: scriptTriggersFromRules(rules, ctx)
  };
}
