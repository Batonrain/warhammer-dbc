// module/rules/condition-mirrors.mjs
// ════════════════════════════════════════════════════════════════════════════
//  НЕВИДИМЫЕ МЕТКИ КАК СОСТОЯНИЯ (wdbc-5uae).
//
//  Кроме книжных Состояний на акторе живёт ещё десяток временных меток тем же
//  смыслом — «сейчас с персонажем происходит X, скоро пройдёт»: в Ярости, в
//  Беге, в Марше, в Открытой стойке, отмечен Аватаром Резни. Каждая своим
//  способом: одна полем схемы (system.inRage), остальные флагами актора. Ни
//  одна не видна на токене, потому что иконки есть только у Состояний.
//
//  ── Почему ЗЕРКАЛО, а не переезд хранения ─────────────────────────────────
//  Буквальный переезд («перенести метку в system.conditions.X») — это правка
//  примерно 120 мест чтения и запись миграции живых данных, причём метки
//  разные: у Ярости своё поле схемы, у Марша флаг со ЗНАЧЕНИЕМ (вид марша, а
//  не «да/нет»), у Поднятого щита флаг вообще на ПРЕДМЕТЕ, а не на акторе.
//  Такой переезд нельзя проверить целиком, а половина его читателей —
//  тонкие места боя.
//
//  Поэтому взят приём, который в этом коде УЖЕ работает и уже описан:
//  «Усталость» не хранится своим флагом Состояния, а зеркалит настоящий
//  счётчик (rules/character.mjs — «Тег в СОСТОЯНИЯХ — не отдельное поле, а
//  зеркало настоящего счётчика Усталости... источник истины один»). Здесь то
//  же самое, обобщённое: метка остаётся жить там, где живёт, и продолжает
//  ставиться/сниматься/истекать своим кодом — а Состояние считается из неё
//  заново на каждый прогон производных данных.
//
//  Что это даёт игроку сразу: иконку на токене, тег на листе, снятие щелчком
//  и работающие предикаты hasCondition/targetHasCondition — то есть всё, чем
//  метка отличалась от Оглушения. Чего это НЕ даёт: сокращения числа мест
//  хранения. Это честный остаток, и он не спрятан — консолидация хранения
//  идёт отдельно, по метке за раз, а не одним махом.
//
//  Чистый модуль: ни одного обращения к Foundry, только чтение переданного
//  актора и сборка патча для actor.update.
// ════════════════════════════════════════════════════════════════════════════

const FLAG_SCOPE = "warhammer-dbc";

/**
 * Имя документа по uuid, куском для подсказки: « — Кхарн» или пусто.
 *
 * fromUuidSync — единственный синхронный путь: подсказка собирается при
 * рендере листа, ждать там нечего. Токена уже нет на сцене (бой кончился,
 * актор удалён) — молча пусто: «Аватар Резни» без имени лучше, чем ошибка
 * или строка «undefined» в подсказке.
 */
function uuidName(uuid) {
  if (!uuid) return "";
  try {
    const doc = globalThis.fromUuidSync?.(uuid);
    const name = doc?.name ?? doc?.actor?.name;
    return name ? ` — ${name}` : "";
  } catch { return ""; }
}

/**
 * Откуда читается каждая метка.
 *
 * kind:
 *   "system"   — поле схемы актора (system.<path>);
 *   "flag"     — флаг актора (flags.warhammer-dbc.<path>);
 *   "itemFlag" — флаг на ПРЕДМЕТЕ актора: метка не про актора, а про вещь в
 *                руках, и Состояние показывает «хоть один такой предмет
 *                сейчас в этом состоянии».
 *
 * Несколько источников в одном Состоянии — это ИЛИ: «Отмечен» одинаково
 * значит и метку Аватара Резни, и Проклятую Метку, и Поклон Публике. Игроку
 * важно «на мне метка», а чья именно — написано в подсказке тега.
 */
export const CONDITION_MIRRORS = {
  inRage: {
    label: "Ярость",
    sources: [{ kind: "system", path: "inRage" }]
  },
  running: {
    label: "Бег",
    sources: [{ kind: "flag", path: "running" }]
  },
  marching: {
    label: "Марш",
    // Флаг несёт ВИД марша (обычный/форсированный), а не «да/нет» — Состояние
    // читает сам факт непустого значения, вид уходит в подсказку.
    sources: [{ kind: "flag", path: "marchKind", hint: v => `вид: ${v}` }]
  },
  exposedStance: {
    label: "Открытая стойка",
    sources: [{ kind: "flag", path: "exposedAggressive" }]
  },
  disengaging: {
    label: "Выход из Боя",
    sources: [{ kind: "flag", path: "disengageActive" }]
  },
  marked: {
    label: "Отмечен",
    // ВАЖНО, чего здесь БОЛЬШЕ НЕТ (wdbc-5uae.2): раньше сюда входил и
    // bowToAudienceMark. Он лежит на ИСПОЛНИТЕЛЕ поклона, а не на том, кому
    // поклонились (combat/bow-to-audience.mjs:76 ставит флаг самому актору,
    // {targetIds, bonus}), — то есть под «на мне чужая метка» показывался тот,
    // кто пометил ДРУГИХ. Разведено в своё Состояние «Поклон Публике» ниже.
    sources: [
      { kind: "flag", path: "avatarOfSlaughterMark",
        hint: v => `Аватар Резни${uuidName(v?.berserkerUuid)}` },
      { kind: "flag", path: "hexMarkedPrey",
        hint: v => `Проклятая Метка${v?.god ? ` (${v.god})` : ""}${uuidName(v?.shamanUuid)}` }
    ]
  },
  bowedToAudience: {
    label: "Поклон Публике",
    // Флаг ИСПОЛНИТЕЛЯ: «я поклонился публике и наметил себе цели» — читает
    // module/sheets/attack-dialog.mjs у самого атакующего.
    sources: [{ kind: "flag", path: "bowToAudienceMark",
                hint: v => `цели намечены: ${(v?.targetIds ?? []).length}${v?.bonus ? `, бонус +${v.bonus}` : ""}` }]
  },
  dreadWailFeared: {
    label: "Устрашён",
    sources: [{ kind: "flag", path: "dreadWailFeared" }]
  },
  seesOnlyCaster: {
    label: "Заворожён",
    // Метка с полезной нагрузкой ({casterUuid}): нагрузку по-прежнему читает
    // своё правило, Состояние отвечает игроку «а на мне это сейчас есть?» —
    // и, через hint, «от кого».
    sources: [{ kind: "flag", path: "seesOnlyCaster",
                hint: v => `видит только${uuidName(v?.casterUuid) || " наложившего"}` }]
  },
  justTheLight: {
    label: "Лишь Свет",
    sources: [{ kind: "flag", path: "justTheLightActive" }]
  },
  radiationSickness: {
    label: "Лучевая болезнь",
    sources: [{ kind: "flag", path: "radiationSickness" }]
  },
  shieldUp: {
    label: "Щит поднят",
    // Флаг на ПРЕДМЕТЕ (щите), не на акторе: у персонажа может быть два щита,
    // и «поднят» — про конкретный. Состояние отвечает на вопрос игрока «я
    // сейчас за щитом?», то есть поднят ли хоть один.
    sources: [{ kind: "itemFlag", path: "shieldRaised" }]
  }
};

/** Ключи Состояний-зеркал. */
export const MIRROR_KEYS = Object.keys(CONDITION_MIRRORS);

/** Зеркалится ли это Состояние из чужого источника (а не хранится своим флагом). */
export function isMirroredCondition(key) {
  return Object.hasOwn(CONDITION_MIRRORS, key);
}

/** Значение одного источника как есть (не приведённое к булеву). */
function sourceValue(actor, source) {
  if (source.kind === "system") return actor?.system?.[source.path];
  if (source.kind === "flag") {
    const viaFlag = actor?.getFlag?.(FLAG_SCOPE, source.path);
    return viaFlag ?? actor?.flags?.[FLAG_SCOPE]?.[source.path];
  }
  if (source.kind === "itemFlag") {
    for (const item of actor?.items ?? []) {
      const v = item?.getFlag?.(FLAG_SCOPE, source.path) ?? item?.flags?.[FLAG_SCOPE]?.[source.path];
      if (v) return v;
    }
    return undefined;
  }
  return undefined;
}

/**
 * Стоит ли сейчас метка. Непустой объект (метка Аватара Резни — это
 * {berserkerUuid}) считается «стоит», пустая строка и ноль — нет: флаг со
 * ЗНАЧЕНИЕМ (вид марша) выключается снятием, а не записью нуля.
 */
export function readMirror(actor, key) {
  const def = CONDITION_MIRRORS[key];
  if (!def || !actor) return false;
  return def.sources.some(s => {
    const v = sourceValue(actor, s);
    return v !== undefined && v !== null && v !== false && v !== "" && v !== 0;
  });
}

/**
 * Чем именно поднято Состояние-зеркало прямо сейчас — строкой для подсказки
 * тега (wdbc-5uae.2).
 *
 * Тикет спрашивал, не завести ли Состояниям поле «источник». Заводить не
 * пришлось: НАГРУЗКА у каждой метки своя и разной формы ({berserkerUuid} у
 * Аватара Резни, {shamanUuid, god} у Проклятой Метки, {targetIds, bonus} у
 * Поклона), одним полем sourceUuid она не выражается, а второе место правды
 * рядом с настоящим флагом — ровно то, чего зеркала и избегают. Поэтому
 * нагрузка остаётся у своего правила, а сюда приходит только ЧИТАЕМАЯ строка,
 * которую собирает сам источник своей функцией hint.
 *
 * @returns {string} пустая строка, если сказать нечего
 */
export function mirrorHint(actor, key) {
  const def = CONDITION_MIRRORS[key];
  if (!def || !actor) return "";
  const parts = [];
  for (const source of def.sources) {
    const value = sourceValue(actor, source);
    if (value === undefined || value === null || value === false || value === "" || value === 0) continue;
    const text = source.hint ? String(source.hint(value) ?? "").trim() : "";
    if (text) parts.push(text);
  }
  return parts.join("; ");
}

/** Все метки актора разом: { <ключ>: boolean } — для производных данных листа. */
export function readAllMirrors(actor) {
  const out = {};
  for (const key of MIRROR_KEYS) out[key] = readMirror(actor, key);
  return out;
}

/**
 * Патч для actor.update, гасящий ИСТОЧНИК метки — снятие тега/иконки должно
 * убирать саму метку, а не её отражение: записанное в system.conditions
 * производные данные затрут обратно на первом же пересчёте.
 *
 * Флаги гасятся штатным `-=` (тот же приём, что в combat/action-economy.mjs),
 * поле схемы — записью false.
 *
 * Источники на ПРЕДМЕТЕ сюда не попадают: их патчем актора не достать (см.
 * mirrorItemSources — щит снимается своей кнопкой на вкладке СНАРЯЖЕНИЕ).
 *
 * @returns {object} пустой объект, если гасить нечего
 */
export function mirrorClearPatch(key) {
  const def = CONDITION_MIRRORS[key];
  if (!def) return {};
  const patch = {};
  for (const s of def.sources) {
    if (s.kind === "system") patch[`system.${s.path}`] = false;
    else if (s.kind === "flag") patch[`flags.${FLAG_SCOPE}.-=${s.path}`] = null;
  }
  return patch;
}

/** Источники этой метки, живущие на предметах — их actor.update не достаёт. */
export function mirrorItemSources(key) {
  return (CONDITION_MIRRORS[key]?.sources ?? []).filter(s => s.kind === "itemFlag");
}

/**
 * Можно ли снять метку щелчком по тегу/иконке. Метка целиком на предметах
 * снимается только своей кнопкой — врать крестиком, который ничего не делает,
 * хуже, чем не показывать крестик.
 */
export function isMirrorClearable(key) {
  return Object.keys(mirrorClearPatch(key)).length > 0;
}
