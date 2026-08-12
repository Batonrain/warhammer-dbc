// test/support/foundry-stub.mjs
//
// Минимальные глобали Foundry — ровно столько, чтобы sheets/actor-sheet.mjs
// загрузился: он наследует класс из foundry.appv1 прямо при загрузке модуля, а
// вместе с ним подтягивается вся папка module/.
//
// Заглушка нужна для загрузки, а не для расчёта. Всё, что тесты проверяют
// (штрафы Усталости, бонус снятого шлема, сложение галочек в диалоге), считается
// из actor.system и данных книг, поэтому заглушка в результат не входит. Правило
// остаётся прежним: как только логика может жить без Foundry, она переезжает в
// module/rules/ и проверяется без этого файла.
//
// Файл импортируется первым, до импорта проверяемого модуля.

/**
 * Что перехвачено у Foundry: диалог, броски, отправленные сообщения.
 *
 * `dice` — очередь значений кубов для честного разбора формул (см. Roll ниже).
 * Пока она null, бросок ведёт себя по-старому: любая формула даёт `nextRoll`.
 */
export const captured = { dialog: null, rolls: [], chat: [], created: [], nextRoll: 50, dice: null,
  confirmAnswer: true, warnings: [] };

export function resetCaptured() {
  captured.dialog = null;
  captured.rolls = [];
  captured.chat = [];
  captured.created = [];
  captured.nextRoll = 50;
  captured.dice = null;
  captured.confirmAnswer = true;
  captured.warnings = [];
}

class ApplicationStub {
  static get defaultOptions() { return {}; }
  render() { return this; }
  /** Как у Foundry: базовый контекст пустой, всё нужное добавляет лист. */
  getData() { return {}; }
}

/* ── Схема типа данных ──────────────────────────────────────────────────────
 * Поля и TypeDataModel — ровно столько, чтобы проверить, какие умолчания
 * объявляет схема и что она делает с исходником документа. Валидацию Foundry
 * заглушка не изображает: недопустимое значение поля с `choices` она пропустит,
 * а настоящий Foundry поднимет ошибку. Поэтому тесты схем спрашивают про
 * умолчания и про сохранность данных из packs-src, а не про поведение на
 * заведомо неверных значениях — иначе проверялась бы заглушка, а не система.
 */
class DataFieldStub {
  constructor(options = {}) { this.options = options; }

  /** Значение поля, когда в исходнике его нет. */
  get initial() {
    const init = this.options.initial;
    return typeof init === "function" ? init() : init;
  }

  /** Значение поля из исходника документа. */
  clean(value) { return value === undefined ? this.initial : this.cast(value); }

  cast(value) { return value; }
}

class StringFieldStub extends DataFieldStub {
  get initial() { return this.options.initial ?? ""; }
  cast(value) { return String(value); }
}

class NumberFieldStub extends DataFieldStub {
  get initial() { return this.options.initial ?? 0; }
  cast(value) { return Number(value); }
}

class BooleanFieldStub extends DataFieldStub {
  get initial() { return this.options.initial ?? false; }
  cast(value) { return Boolean(value); }
}

/** Свободный объект: хранится как есть, ключи не перечисляются. */
class ObjectFieldStub extends DataFieldStub {
  get initial() {
    const init = this.options.initial;
    return typeof init === "function" ? init() : structuredClone(init ?? {});
  }
  cast(value) { return structuredClone(value); }
}

/**
 * Тип данных документа. Настоящий `TypeDataModel` при инициализации прогоняет
 * исходник через `migrateData`, потом через очистку полей — тот же порядок
 * повторён здесь: иначе миграция проверялась бы в отрыве от схемы.
 */
class TypeDataModelStub {
  constructor(source = {}) {
    const schema = this.constructor.defineSchema();
    const data   = this.constructor.migrateData(structuredClone(source ?? {}));
    for (const [key, field] of Object.entries(schema)) this[key] = field.clean(data[key]);
  }

  static migrateData(source) { return source; }

  /** Данные документа без служебных полей — с чем сравнивать template.json. */
  toObject() {
    const out = {};
    for (const key of Object.keys(this.constructor.defineSchema())) out[key] = this[key];
    return out;
  }
}

globalThis.foundry = {
  appv1: {
    api: { Application: ApplicationStub, Dialog: class extends ApplicationStub {}, FormApplication: class extends ApplicationStub {} },
    sheets: { ActorSheet: class extends ApplicationStub {}, ItemSheet: class extends ApplicationStub {} }
  },
  applications: {
    api: { HandlebarsApplicationMixin: base => base, ApplicationV2: ApplicationStub },
    sheets: { ActorSheetV2: ApplicationStub, DocumentSheetV2: ApplicationStub, ActiveEffectConfig: ApplicationStub }
  },
  utils: {
    mergeObject: (a, b) => ({ ...a, ...b }),
    duplicate: x => structuredClone(x),
    deepClone: x => structuredClone(x),
    randomID: () => "stubid",
    getProperty: () => undefined,
    setProperty: () => true
  },
  documents: { collections: {} },
  abstract: { TypeDataModel: TypeDataModelStub },
  data: {
    fields: {
      StringField:  StringFieldStub,
      NumberField:  NumberFieldStub,
      BooleanField: BooleanFieldStub,
      ObjectField:  ObjectFieldStub
    },
    regionBehaviors: { RegionBehaviorType: class {} }
  }
};

globalThis.CONST = {
  REGION_EVENTS: {
    BEHAVIOR_VIEWED: "behaviorViewed", BEHAVIOR_UNVIEWED: "behaviorUnviewed",
    REGION_BOUNDARY: "regionBoundary", TOKEN_MOVE_IN: "tokenMoveIn",
    TOKEN_MOVE_OUT: "tokenMoveOut", TOKEN_ANIMATE_IN: "tokenAnimateIn",
    TOKEN_ANIMATE_OUT: "tokenAnimateOut"
  }
};

globalThis.CONFIG = { sounds: { dice: "dice.wav" }, Actor: { dataModels: {} }, Item: { dataModels: {} } };
globalThis.Hooks  = { on: () => {}, once: () => {}, callAll: () => {} };
globalThis.game   = { settings: { get: () => undefined, register: () => {} }, i18n: { localize: s => s }, user: {}, users: [] };
// warn копится: выдача стартовых навыков сообщает им о нераспознанных записях.
globalThis.ui     = { notifications: { warn: m => captured.warnings.push(String(m)), info: () => {}, error: () => {} } };

/** Диалог не рендерится, а запоминается: тест сам нажимает его кнопки. */
globalThis.Dialog = class {
  constructor(config) { captured.dialog = config; }
  render() {}
  /** «Да/Нет»: ответ задаёт тест через captured.confirmAnswer. */
  static async confirm(config) { captured.dialog = config; return captured.confirmAnswer; }
};

/**
 * Разбор формулы броска на термы. Набор намеренно узкий: целые слагаемые и
 * «NdM» с модификаторами «min» и «kh» — ровно то, что порождают
 * applyDamageDiceMods (Рвущее, Проверенное) и сборка формулы урона. Всё
 * остальное роняет тест: заглушка, тихо считающая неправильно, хуже, чем её
 * отсутствие.
 */
function parseRollFormula(formula, takeDie) {
  const src   = String(formula ?? "").replace(/\s+/g, "");
  const parts = src.match(/[+-]?[^+-]+/g) ?? [];
  const terms = [];
  let total = 0;

  for (const part of parts) {
    const sign = part.startsWith("-") ? -1 : 1;
    const body = part.replace(/^[+-]/, "");

    if (/^\d+$/.test(body)) {
      total += sign * Number(body);
      terms.push({ number: sign * Number(body) });
      continue;
    }

    const m = body.match(/^(\d+)d(\d+)(?:min(\d+))?(?:kh(\d+))?$/i);
    if (!m) throw new Error(`Заглушка Roll: не разобрана формула «${formula}» (часть «${part}»)`);

    const [, nStr, facesStr, minStr, khStr] = m;
    const faces   = Number(facesStr);
    const results = [];
    for (let i = 0; i < Number(nStr); i++) {
      const rolled = takeDie(faces);
      // «min X» — Foundry поднимает выпавшее значение до X, а не перебрасывает.
      results.push({ result: minStr ? Math.max(rolled, Number(minStr)) : rolled, active: true });
    }
    if (khStr) {
      const keep = Number(khStr);
      [...results]
        .sort((a, b) => b.result - a.result)
        .slice(keep)
        .forEach(r => { r.active = false; });
    }
    for (const r of results) if (r.active) total += sign * r.result;
    terms.push({ faces, results });
  }
  return { total, terms };
}

/**
 * Бросок без случайности.
 *
 * По умолчанию любая формула даёт `captured.nextRoll` — этого хватает тестам
 * диалога навыка, где проверяется порог, а не кубы. Тест атаки выставляет
 * `captured.dice` — очередь выпадающих значений, — и тогда формула считается
 * честно, с `terms`: их читает Экстремальный урон, а `active` — Рвущее.
 */
globalThis.Roll = class {
  constructor(formula) { this.formula = formula; captured.rolls.push(formula); }

  async evaluate() {
    if (captured.dice === null) { this.total = captured.nextRoll; return this; }
    const take = faces => {
      if (!captured.dice.length)
        throw new Error(`Заглушка Roll: очередь кубов пуста, а формула «${this.formula}» просит ещё d${faces}`);
      return captured.dice.shift();
    };
    const { total, terms } = parseRollFormula(this.formula, take);
    this.total = total;
    this.terms = terms;
    return this;
  }

  async render() { return `<div class="stub-roll">${this.formula} = ${this.total}</div>`; }
};

globalThis.ChatMessage = class {
  static applyRollMode(data) { return data; }
  static getSpeaker() { return { alias: "stub" }; }
  static async create(data) { captured.chat.push(data); return data; }
};

globalThis.Actor = class {};
globalThis.Item = class {};
globalThis.ActiveEffect = class {};
globalThis.Folder = class {};
globalThis.JournalEntry = class {};
globalThis.FilePicker = class {};
globalThis.Application = ApplicationStub;
globalThis.Handlebars = { registerHelper: () => {} };
globalThis.canvas = {};
globalThis.renderTemplate = async () => "";
globalThis.fromUuid = async () => null;
globalThis.fromUuidSync = () => null;
/** jQuery-обёртка над элементом: диалог атаки читает галочки через $(cb).data(). */
globalThis.$ = el => ({
  data:    key => el?.dataset?.[key],
  closest: () => ({ text: () => "" })
});

/**
 * Лист без Foundry: объект с прототипом класса и подставным актором. Конструктор
 * ApplicationV1 не вызывается — методам расчёта нужен только this.actor.
 */
export function sheetOf(cls, { items = [], ...system } = {}) {
  const sheet = Object.create(cls.prototype);
  const list  = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  Object.defineProperty(sheet, "actor", {
    // `update` — заглушка: диалог атаки сбрасывает им прицеливание, а тест
    // проверяет порог броска, а не запись в актора. Выданные предметы, наоборот,
    // запоминаются: тест мутаций проверяет, что именно легло на лист.
    value: {
      id: "actor-stub", name: "Подставной", system, items: list,
      update: async () => {},
      createEmbeddedDocuments: async (type, docs) => {
        captured.created.push(...docs);
        return docs.map(d => ({ ...d, sheet: { render: () => {} } }));
      }
    },
    configurable: true
  });
  return sheet;
}

/**
 * Подставной jQuery для колбэка кнопки диалога: `fields` отдаёт значения полей
 * по селектору, `checks` — отмеченные галочки.
 *
 * Значение поля читается тремя способами, как и в настоящем диалоге:
 * `.val()` — текст поля, `.is(":checked")` — отмечен ли флажок (задаётся
 * значением `true`), `.data(ключ)` — data-атрибут (задаётся объектом).
 */
export function fakeHtml(fields = {}, checks = {}) {
  return {
    find: selector => ({
      val:  () => fields[selector],
      is:   () => fields[selector] === true,
      data: key => (typeof fields[selector] === "object" && fields[selector] !== null)
        ? fields[selector][key] : undefined,
      on:   () => {},
      each: fn => (checks[selector] ?? []).forEach((cb, i) => fn(i, cb))
    })
  };
}

/** Отмеченная галочка модификатора — как её читает диалог из data-атрибутов. */
export function checkbox(value, halvePenalty = false) {
  return { dataset: { value: String(value), ...(halvePenalty ? { halve: "1" } : {}) } };
}
