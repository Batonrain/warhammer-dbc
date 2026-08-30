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
export const captured = { dialog: null, rolls: [], chat: [], created: [], updates: [],
  nextRoll: 50, dice: null,
  confirmAnswer: true, warnings: [], errors: [],
  // Ручки открытого DialogV2 — их ставит заглушка wait (см. ниже).
  press: null, dismiss: null, rerender: null };

export function resetCaptured() {
  captured.dialog = null;
  captured.rolls = [];
  captured.chat = [];
  captured.created = [];
  captured.updates = [];
  captured.nextRoll = 50;
  captured.dice = null;
  captured.confirmAnswer = true;
  captured.warnings = [];
  captured.errors = [];
  captured.press = null;
  captured.dismiss = null;
  captured.rerender = null;
}

class ApplicationStub {
  static get defaultOptions() { return {}; }
  render() { return this; }
  /** Как у Foundry: базовый контекст пустой, всё нужное добавляет лист. */
  getData() { return {}; }
  /** Базовые слушатели Foundry (вкладки, свёртки) тестам не нужны. */
  activateListeners() {}
  /** То же для ApplicationV2: базовый контекст пустой, лист дополняет его сам. */
  async _prepareContext() { return {}; }
  /** Штатный дроп Foundry (Item/Actor/Folder) — тестам содержимое не нужно. */
  async _onDrop() {}
  async _onDropItem() {}
}

// Лист восстанавливает прокрутку следующим кадром; в node кадров нет.
globalThis.requestAnimationFrame ??= () => 0;

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

// Как у настоящего Foundry (common/data/fields.mjs): HTMLField — просто
// StringField с другим полем ввода на листе (prose-mirror вместо textarea).
class HTMLFieldStub extends StringFieldStub {}

class NumberFieldStub extends DataFieldStub {
  // `?? 0` здесь нельзя: у nullable-поля умолчание null — осмысленное значение,
  // и оно означает «поля нет». Так отличают щит от прочего оружия
  // (system.shieldAP, см. combat/hand-shield.mjs).
  get initial() { return "initial" in this.options ? this.options.initial : 0; }
  clean(value) {
    if (value === undefined) return this.initial;
    if (value === null) return this.options.nullable ? null : this.cast(value);
    return this.cast(value);
  }
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
 * Вложенная схема: своё поле на каждый ключ. В отличие от ObjectField ключи
 * перечислены, и незаявленный до документа не доедет — ради этого схемы и
 * заводятся. Тип элементов ArrayField заглушка не разбирает: она проверяет
 * структуру и умолчания, а не валидацию (см. шапку файла).
 */
class SchemaFieldStub extends DataFieldStub {
  constructor(fields = {}, options = {}) {
    super(options);
    // Настоящий SchemaField проставляет полю parent и отказывается принимать
    // поле, у которого parent уже есть: «The "head" field already belongs to
    // some other parent and may not be reused». Один и тот же экземпляр,
    // подставленный в две схемы (armor и armorBonus), валит систему при
    // загрузке — заглушка обязана ловить это в тестах, а не браузер в игре.
    for (const [key, field] of Object.entries(fields)) {
      if (field.parent)
        throw new Error(`The "${key}" field already belongs to some other parent and may not be reused.`);
      field.parent = this;
    }
    this.fields = fields;
  }

  get initial() {
    const out = {};
    for (const [key, field] of Object.entries(this.fields)) out[key] = field.initial;
    return out;
  }

  clean(value) {
    const out = {};
    for (const [key, field] of Object.entries(this.fields)) out[key] = field.clean(value?.[key]);
    return out;
  }
}

/** Список: хранится целиком, умолчание — пустой. */
class ArrayFieldStub extends DataFieldStub {
  constructor(element, options = {}) { super(options); this.element = element; }
  get initial() {
    const init = this.options.initial;
    if (typeof init === "function") return init();
    return structuredClone(init ?? []);
  }
  clean(value) { return Array.isArray(value) ? structuredClone(value) : this.initial; }
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
    api: {
      HandlebarsApplicationMixin: base => base, ApplicationV2: ApplicationStub,
      // «Да/Нет» второго поколения: как и у globalThis.Dialog, ответ задаёт
      // тест через captured.confirmAnswer, а сам запрос остаётся в
      // captured.dialog — по нему проверяют текст.
      DialogV2: class {
        static async confirm(config) { captured.dialog = config; return captured.confirmAnswer; }
        /**
         * Окно не рендерится, а запоминается — как и у globalThis.Dialog. Тест
         * жмёт кнопку через captured.press(действие, форма), закрывает окно
         * через captured.dismiss() и вызывает живой пересчёт через
         * captured.rerender(форма). Форму даёт fakeForm (внизу файла).
         *
         * Возвращает то же, что настоящий wait: значение колбэка нажатой
         * кнопки, а при закрытии — null (rejectClose: false).
         */
        static async wait(config) {
          captured.dialog = config;
          const self = { element: { querySelector: () => self.form }, setPosition: () => {} };
          captured.rerender = form => { self.form = form; config.render?.(null, self); };
          captured.press = async (action, form) => {
            const btn = config.buttons.find(b => b.action === action);
            // Как настоящий DialogV2 (scripts/foundry.mjs, #_onSubmit):
            // `(await callback(...)) ?? button.action`. Не `?? null` — иначе
            // заглушка мягче живого Foundry и не ловит кнопки, чей callback
            // возвращает null (результатом там становится строка-action).
            captured.settle(await btn.callback?.(null, { form }, self) ?? btn.action ?? null);
          };
          return new Promise(resolve => {
            captured.settle = resolve;
            captured.dismiss = () => resolve(null);
          });
        }
      }
    },
    sheets: { ActorSheetV2: ApplicationStub, ItemSheetV2: ApplicationStub,
              DocumentSheetV2: ApplicationStub, ActiveEffectConfig: ApplicationStub },
    ux: {
      // Тестам содержимое не важно — только что вызов не падает и возвращает
      // строку (её кладут в контекст листа как notesEnriched и т.п.).
      TextEditor: { implementation: { enrichHTML: async html => String(html ?? "") } }
    }
  },
  utils: {
    mergeObject: (a, b) => ({ ...a, ...b }),
    duplicate: x => structuredClone(x),
    deepClone: x => structuredClone(x),
    randomID: () => "stubid",
    // Как у Foundry v13: & < > " '. Настоящий тоже ничего сверх этого не делает.
    escapeHTML: v => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;"),
    getProperty: () => undefined,
    setProperty: () => true,
    // Как у настоящего Foundry: путь через точку, но без создания
    // промежуточных объектов — только проверка, что путь СУЩЕСТВУЕТ.
    hasProperty: (object, key) => {
      if (!key) return false;
      if (key in Object(object)) return true;
      let target = object;
      for (const p of key.split(".")) {
        if (target && typeof target === "object" && p in target) target = target[p];
        else return false;
      }
      return true;
    },
    // Настоящий debounce копит вызовы за delay мс; тестам синхронности не
    // нужно — важно только что module/regions/auras.mjs не падает при импорте.
    debounce: (fn, delay) => {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
      };
    }
  },
  documents: { collections: {} },
  abstract: { TypeDataModel: TypeDataModelStub },
  data: {
    fields: {
      StringField:  StringFieldStub,
      HTMLField:    HTMLFieldStub,
      NumberField:  NumberFieldStub,
      BooleanField: BooleanFieldStub,
      ObjectField:  ObjectFieldStub,
      SchemaField:  SchemaFieldStub,
      ArrayField:   ArrayFieldStub
    },
    regionBehaviors: { RegionBehaviorType: class {} }
  }
};

globalThis.CONST = {
  REGION_EVENTS: {
    BEHAVIOR_VIEWED: "behaviorViewed", BEHAVIOR_UNVIEWED: "behaviorUnviewed",
    REGION_BOUNDARY: "regionBoundary", TOKEN_MOVE_IN: "tokenMoveIn",
    TOKEN_MOVE_OUT: "tokenMoveOut", TOKEN_ANIMATE_IN: "tokenAnimateIn",
    TOKEN_ANIMATE_OUT: "tokenAnimateOut", TOKEN_ENTER: "tokenEnter",
    TOKEN_EXIT: "tokenExit", TOKEN_TURN_START: "tokenTurnStart",
    TOKEN_TURN_END: "tokenTurnEnd"
  }
};

globalThis.CONFIG = { sounds: { dice: "dice.wav" }, Actor: { dataModels: {} }, Item: { dataModels: {} } };
globalThis.Hooks  = { on: () => {}, once: () => {}, callAll: () => {} };
globalThis.game   = {
  settings: {
    // core/rollMode в Foundry — всегда строка режима. Заглушка отдавала
    // undefined на всё, и строгую проверку applyRollMode было не поставить.
    get: (scope, key) => (scope === "core" && key === "rollMode") ? "roll" : undefined,
    register: () => {}
  },
  i18n: { localize: s => s }, user: {}, users: []
};
// warn копится: выдача стартовых навыков сообщает им о нераспознанных записях.
globalThis.ui     = { notifications: { warn: m => captured.warnings.push(String(m)), info: () => {},
  error: m => captured.errors.push(String(m)) } };

/** Диалог не рендерится, а запоминается: тест сам нажимает его кнопки. */
globalThis.Dialog = class {
  constructor(config) { captured.dialog = config; }
  render() {}
  close() {}
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

  /** Бросок, отправленный в чат сам собой (Проявление Одержимого, Механикум). */
  async toMessage(data = {}) { captured.chat.push({ ...data, roll: this }); return data; }
};

globalThis.ChatMessage = class {
  /**
   * Второй аргумент — СТРОКА режима ("roll"/"gmroll"/…), а не объект: Foundry
   * лезет в CONFIG.Dice.rollModes[rollMode].handler и на объекте падает
   * «Cannot read properties of undefined (reading 'handler')». Заглушка молча
   * возвращала data и восемнадцать таких вызовов доехали до игры незамеченными.
   */
  static applyRollMode(data, rollMode) {
    if (typeof rollMode !== "string")
      throw new TypeError(`applyRollMode ждёт строку режима, получено ${JSON.stringify(rollMode)}`);
    return data;
  }
  static getSpeaker() { return { alias: "stub" }; }
  static async create(data) { captured.chat.push(data); return data; }
};

globalThis.Actor = class { prepareBaseData() {} };
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
const elementJq = el => ({
  data:    key => el?.dataset?.[key],
  closest: () => ({ text: () => "" })
});
globalThis.$ = elementJq;

/**
 * Подставной документ: данные предмета плюс `update` с путями через точку —
 * ровно тем видом, каким система пишет в предметы. Правки копятся в
 * captured.updates и применяются к самому документу, чтобы тест мог прочитать
 * результат прямо из него.
 */
export function stubDocument(data = {}) {
  const doc = { sheet: { render: () => {} }, ...structuredClone(data) };
  doc.update = async (changes = {}) => {
    captured.updates.push(changes);
    for (const [path, value] of Object.entries(changes)) {
      const keys = path.split(".");
      let node = doc;
      for (const key of keys.slice(0, -1)) node = (node[key] ??= {});
      node[keys[keys.length - 1]] = value;
    }
    return doc;
  };
  return doc;
}

/**
 * Лист без Foundry: объект с прототипом класса и подставным актором. Конструктор
 * ApplicationV1 не вызывается — методам расчёта нужен только this.actor.
 */
export function sheetOf(cls, { items = [], type = "character", ...system } = {}) {
  const sheet = Object.create(cls.prototype);
  const list  = [...items];
  list.get = id => list.find(i => i.id === id) ?? null;
  // Флаги актора — plain-объект по scope, ключ читается/пишется как путь через
  // точку, как и в настоящем getFlag/setFlag/unsetFlag (Банк Расширенного
  // теста хранится там: flags.warhammer-dbc.extendedTests.<ключ>).
  const flagStore = {};
  const flagPath = (scope, key) => {
    const bag = flagStore[scope] ?? {};
    return { parts: String(key).split("."), bag };
  };
  Object.defineProperty(sheet, "actor", {
    // `update` — заглушка: диалог атаки сбрасывает им прицеливание, а тест
    // проверяет порог броска, а не запись в актора. Выданные предметы, наоборот,
    // запоминаются: тест мутаций проверяет, что именно легло на лист.
    value: {
      id: "actor-stub", name: "Подставной", type, system, items: list,
      update: async () => {},
      getFlag: (scope, key) => {
        const { parts, bag } = flagPath(scope, key);
        return parts.reduce((o, k) => o?.[k], bag);
      },
      setFlag: async (scope, key, value) => {
        flagStore[scope] ??= {};
        const parts = String(key).split(".");
        let node = flagStore[scope];
        for (const k of parts.slice(0, -1)) node = (node[k] ??= {});
        node[parts.at(-1)] = value;
      },
      unsetFlag: async (scope, key) => {
        const bag = flagStore[scope];
        if (!bag) return;
        const parts = String(key).split(".");
        let node = bag;
        for (const k of parts.slice(0, -1)) node = node?.[k];
        if (node) delete node[parts.at(-1)];
      },
      createEmbeddedDocuments: async (type, docs) => {
        captured.created.push(...docs);
        // Выданный предмет умеет и обновляться: бросок субмутации пишет
        // результат прямо в него сразу после выдачи. Правки ложатся в
        // captured.updates и в сам документ, чтобы дальше его можно было читать.
        return docs.map(d => stubDocument(d));
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

/**
 * Подставная форма для DialogV2 — то же, чем fakeHtml был для jQuery, но на
 * двух методах, которыми диалог читает форму: `fields` отдаёт элемент по
 * селектору, `checks` — список элементов.
 *
 * Значение задаётся строкой (`value`), `true` (отмеченный флажок) или готовым
 * объектом. Объект возвращается как есть — так живой пересчёт может писать в
 * него `textContent`, и тест увидит написанное.
 */
export function fakeForm(fields = {}, checks = {}) {
  const el = v => (v !== null && typeof v === "object")
    ? v : { value: v, checked: v === true, dataset: {} };
  return {
    addEventListener: () => {},
    querySelector:    sel => (sel in fields) ? el(fields[sel]) : (checks[sel]?.[0] ?? null),
    querySelectorAll: sel => checks[sel] ?? ((sel in fields) ? [el(fields[sel])] : [])
  };
}

/**
 * Подставной корень листа для модулей на чистом DOM: querySelectorAll отдаёт
 * узлы по селектору, а навешенный обработчик ложится в handlers под ключом
 * «селектор:событие» — тем же, каким его кладёт listenerHtml.
 *
 * Селектор без объявленных узлов всё равно отдаёт один пустой: в игре он просто
 * не дал бы слушателя, а тесту нужен сам обработчик, чтобы его дёрнуть. Так же
 * вела себя и jQuery-заглушка — find() всегда возвращала узел.
 */
export function listenerRoot(nodes = {}, handlers = {}) {
  const bind = (selector, el) => ({
    ...el,
    addEventListener: (event, fn) => { handlers[`${selector}:${event}`] = fn; }
  });
  return {
    handlers,
    // Классы и CSS-переменные темы листа (раса/мировоззрение/класс/патрон)
    // заглушка проглатывает, как и остальное оформление: тесты проверяют
    // поведение обработчиков.
    classList: Object.assign([], { add() {}, remove() {}, toggle() {}, contains: () => false }),
    style: { setProperty() {}, removeProperty() {} },
    addEventListener: (event, fn) => { handlers[`:${event}`] = fn; },
    // Селектор без объявленных узлов отдаёт один пустой — с dataset, как у
    // настоящего элемента: обработчик читает из него данные строки.
    querySelectorAll: selector => (nodes[selector]?.length ? nodes[selector] : [{ dataset: {} }])
      .map(el => bind(selector, el)),
    querySelector:    selector => nodes[selector]?.[0] ?? null
  };
}

/**
 * Подставной jQuery для activateListeners: запоминает обработчики под ключом
 * «селектор:событие» в html.handlers, а всё остальное (классы, текст,
 * видимость) молча проглатывает — тесты проверяют поведение обработчика, а не
 * оформление. nodes отдаёт узлы для .each() по селектору.
 */
export function listenerHtml(nodes = {}) {
  const handlers = {};
  const html = {
    handlers,
    // html[0] — корень DOM для модулей, уже снятых с jQuery (wdbc-z0z).
    // Обработчики ложатся в тот же handlers, поэтому тесты не различают,
    // какой из двух путей навесил слушателя.
    0: listenerRoot(nodes, handlers),
    find(selector) {
      const node = {
        click:  fn => { handlers[`${selector}:click`]  = fn; return node; },
        change: fn => { handlers[`${selector}:change`] = fn; return node; },
        on: (event, fn) => { handlers[`${selector}:${event}`] = fn; return node; },
        each: fn => { (nodes[selector] ?? []).forEach((el, i) => fn(i, el)); return node; },
        text: () => node, addClass: () => node, removeClass: () => node,
        toggleClass: () => node, css: () => node, toggle: () => node,
        val: () => undefined, is: () => false
      };
      return node;
    }
  };
  // Лист V2 оборачивает свой корень сам — $(this.element). Отдаём на этот
  // корень ту же обёртку, иначе модули вкладок, ещё не снятые с jQuery (wdbc-z0z),
  // ничего не найдут и обработчики не попадут в handlers.
  globalThis.$ = el => (el === html[0] ? html : elementJq(el));
  return html;
}

/** Отмеченная галочка модификатора — как её читает диалог из data-атрибутов. */
export function checkbox(value, halvePenalty = false) {
  return { dataset: { value: String(value), ...(halvePenalty ? { halve: "1" } : {}) } };
}
