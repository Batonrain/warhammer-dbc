// module/rules/actor-setup.mjs
// ════════════════════════════════════════════════════════════════════════════
//  ВАРИАЦИИ БЕСТИАРИЯ — ядро без Foundry.
//
//  Книги дают многих обитателей бестиария «с развилкой»: у Культиста Фанатика
//  кроме базовой версии есть Берсерк, Молотильщик и Оплот, у Мутанта — четыре
//  благословения, у Отребья — вооружённая версия. В паке это лежало прозой в
//  `system.notes`, то есть машине было недоступно.
//
//  Теперь развилка описана данными: флаг `warhammer-dbc.setup` у актора пака.
//  Здесь — разбор этого описания и сборка ПЛАНА правок по ответам ГМа. Ни
//  одного обращения к Foundry: план считается на голых данных и проверяется
//  тестом без заглушки (правило проекта — логика без Foundry живёт в rules/).
//
//  Формат описания:
//    setup.source           — ссылка на книгу (показывается в диалоге);
//    setup.groups[]         — развилки; у каждой key, label, mode, options[];
//      mode "one"           — одна опция из списка (Вариация): радиокнопки;
//      mode "many"          — сколько угодно (Химия, доп. снаряжение): галочки;
//      default              — ключ опции по умолчанию (для "one");
//    option                 — key, label, hint и до пяти действий:
//      add[]                — UUID предметов компендиума;
//      remove[]             — что снять с листа: {type, name};
//      system{}             — правки полей system (число, "+5", "-2", строка);
//      groupSkills[]        — ранг групповому навыку: {group, specialty, rank};
//      pick[]               — вложенный выбор: {label, from[UUID]}.
//
//  Групповые навыки вынесены отдельным действием не для красоты: обычный навык
//  лежит полем (`skills.command.rank`) и правится путём, а групповой — записью
//  в массиве (`groupSkills.commonLore[]`), и путь к ней зависит от порядка
//  записей у конкретного актора. Такую правку считает применение, а не данные.
//
//  Применение плана и диалог — в module/apps/actor-setup.mjs: там уже нужна
//  живая Foundry (компендиумы, создание предметов).
// ════════════════════════════════════════════════════════════════════════════

const SYSTEM = "warhammer-dbc";

const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);

/** Одна опция развилки. Без ключа опция не опознаётся ответом — такую отбрасываем. */
function readOption(raw) {
  const key = String(raw?.key || "").trim();
  if (!key) return null;
  return {
    key,
    label: String(raw.label || key),
    hint:  String(raw.hint || ""),
    add:    asArray(raw.add).map(String).filter(Boolean),
    remove: asArray(raw.remove)
      .map(r => (typeof r === "string" ? { name: r } : r))
      .filter(r => r && r.name)
      .map(r => (r.type ? { type: String(r.type), name: String(r.name) } : { name: String(r.name) })),
    system: raw.system && typeof raw.system === "object" ? { ...raw.system } : {},
    groupSkills: asArray(raw.groupSkills)
      .filter(g => g && g.group && g.specialty)
      .map(g => ({
        group:     String(g.group),
        specialty: String(g.specialty),
        rank:      String(g.rank || "trained")
      })),
    pick:   asArray(raw.pick)
      .map((p, i) => ({
        label: String(p?.label || `Выбор ${i + 1}`),
        from:  asArray(p?.from).map(String).filter(Boolean)
      }))
      .filter(p => p.from.length)
  };
}

/**
 * Описание развилок актора или null, если их нет. Принимает и сырые данные
 * пака, и живой документ: у обоих флаги лежат по одному пути.
 */
export function readSetup(actorData) {
  const raw = actorData?.flags?.[SYSTEM]?.setup;
  if (!raw || typeof raw !== "object") return null;

  const groups = asArray(raw.groups).map(g => {
    const key = String(g?.key || "").trim();
    if (!key) return null;
    const options = asArray(g.options).map(readOption).filter(Boolean);
    // Группа без опций выбора не даёт: показывать в диалоге нечего.
    if (!options.length) return null;
    return {
      key,
      label:   String(g.label || key),
      mode:    g.mode === "many" ? "many" : "one",
      default: g.default != null ? String(g.default) : "",
      options
    };
  }).filter(Boolean);

  if (!groups.length) return null;
  return { source: String(raw.source || ""), groups };
}

/**
 * Ответы «как в книге по умолчанию»: базовая версия существа. Ими же
 * заполняется диалог при открытии и они же применяются, если ГМ его закрыл.
 */
export function defaultAnswers(setup) {
  const groups = {};
  for (const g of setup?.groups || []) {
    if (g.mode === "many") { groups[g.key] = []; continue; }
    const fallback = g.options.find(o => o.key === g.default) || g.options[0];
    groups[g.key] = fallback ? [fallback.key] : [];
  }
  return { groups, picks: {} };
}

/** Ключ ответа для вложенного выбора: группа.опция.номер. */
export function pickKey(groupKey, optionKey, index) {
  return `${groupKey}.${optionKey}.${index}`;
}

/**
 * План правок по ответам. Ничего не применяет — только собирает, что добавить,
 * что снять и какие поля поправить, плюс журнал для чата и предупреждения о
 * непонятых ответах (ответ мог прийти от старой версии пака).
 */
export function buildSetupPlan(setup, answers) {
  const plan = { add: [], remove: [], system: {}, groupSkills: [], chosen: {}, log: [], warnings: [] };
  const given = answers?.groups || {};
  const picks = answers?.picks || {};

  for (const key of Object.keys(given)) {
    if (!(setup?.groups || []).some(g => g.key === key)) {
      plan.warnings.push(`Неизвестная группа «${key}» — пропущена.`);
    }
  }

  for (const group of setup?.groups || []) {
    // «Одно из» — ровно один ответ: две Вариации разом книга не даёт.
    const answered = asArray(given[group.key]).map(String);
    const wanted = group.mode === "many" ? answered : answered.slice(0, 1);
    const chosen = [];

    for (const optionKey of wanted) {
      const option = group.options.find(o => o.key === optionKey);
      if (!option) {
        plan.warnings.push(`Неизвестный вариант «${optionKey}» в группе «${group.label}» — пропущен.`);
        continue;
      }
      chosen.push(option.key);

      plan.add.push(...option.add);
      plan.remove.push(...option.remove);
      plan.groupSkills.push(...option.groupSkills);
      Object.assign(plan.system, option.system);

      // Вложенный выбор: ГМ мог не тронуть селект — тогда берём первый пункт,
      // он же стоит в диалоге по умолчанию.
      option.pick.forEach((p, i) => {
        const answer = picks[pickKey(group.key, option.key, i)];
        plan.add.push(p.from.includes(answer) ? answer : p.from[0]);
      });

      if (option.key !== (group.default || group.options[0]?.key) || group.mode === "many") {
        plan.log.push(`${group.label}: ${option.label}`);
      }
    }

    if (chosen.length) plan.chosen[group.key] = chosen;
  }

  plan.isEmpty = !plan.add.length && !plan.remove.length
    && !plan.groupSkills.length && !Object.keys(plan.system).length;
  return plan;
}

/**
 * Групповые навыки актора после правок варианта: запись по специализации
 * находится или заводится, ранг понижать нельзя — вариант даёт бонус к тому,
 * что уже есть, а не отбирает выученное.
 */
export function mergeGroupSkills(current, wanted, rankOrder) {
  const out = {};
  for (const entry of wanted) {
    const list = out[entry.group] || (out[entry.group] = [...(current?.[entry.group] || [])].map(r => ({ ...r })));
    const same = list.find(r => String(r.specialty).toLowerCase() === entry.specialty.toLowerCase());
    if (!same) { list.push({ specialty: entry.specialty, rank: entry.rank }); continue; }
    const now = rankOrder.indexOf(String(same.rank));
    const next = rankOrder.indexOf(entry.rank);
    if (next > now) same.rank = entry.rank;
  }
  return out;
}

/** Значение поля по пути «a.b.c» — свой, чтобы не тянуть foundry.utils. */
function valueAt(obj, path) {
  return String(path).split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/**
 * Правки полей в вид, который принимает actor.update: ключи с префиксом
 * `system.`, дельты («+5», «−2») сложены с текущим значением. Минус берём и
 * обычный, и книжный — в книгах он типографский.
 */
export function applyDeltas(system, updates) {
  const out = {};
  for (const [path, value] of Object.entries(updates || {})) {
    const delta = typeof value === "string" && /^[+\-−]\s*\d+(\.\d+)?$/.test(value.trim());
    if (delta) {
      const raw = value.trim().replace("−", "-").replace(/\s+/g, "");
      const current = Number(valueAt(system, path)) || 0;
      out[`system.${path}`] = current + Number(raw);
    } else {
      out[`system.${path}`] = value;
    }
  }
  return out;
}
