import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  FONT_FAMILIES, FONT_CHOICES, resolveFontFamily, effectiveFontFamily,
  registerSystemFonts, registerFontSettings, applySystemFont
} from "../../module/constants/fonts.mjs";

describe("resolveFontFamily — чистая функция резолюции", () => {
  it("личный оверрайд важнее мирового дефолта", () => {
    expect(resolveFontFamily("Колхидский", "System")).toBe("Колхидский");
  });
  it("пустой личный оверрайд — берём мировой дефолт", () => {
    expect(resolveFontFamily("", "Высокая Готика")).toBe("Высокая Готика");
  });
  it("оба пустые — пустая строка (дефолт Foundry как есть, не трогаем)", () => {
    expect(resolveFontFamily("", "")).toBe("");
    expect(resolveFontFamily(undefined, undefined)).toBe("");
  });
  it("мировой дефолт пуст, но задан личный — личный побеждает", () => {
    expect(resolveFontFamily("Odessa", "")).toBe("Odessa");
  });
});

describe("FONT_FAMILIES / FONT_CHOICES — 7 шрифтов", () => {
  it("ровно 7 файлов с русскими именами по книге", () => {
    expect(FONT_FAMILIES).toHaveLength(7);
    const byFamily = Object.fromEntries(FONT_FAMILIES.map(f => [f.family, f.file]));
    expect(byFamily["Бинарный Кант"]).toBe("binaric.ttf");
    expect(byFamily["Колхидский"]).toBe("colhidian.ttf");
    expect(byFamily["Высокая Готика"]).toBe("highGothic.ttf");
    expect(byFamily["Низкая Готика"]).toBe("lowGothic.ttf");
    expect(byFamily["Odessa"]).toBe("odessa.otf");
    expect(byFamily["System"]).toBe("system.ttf");
    expect(byFamily["Истинный Язык"]).toBe("trueTongue.ttf");
  });
  it("FONT_CHOICES начинается с пустого пункта «дефолт Foundry»", () => {
    expect(FONT_CHOICES[""]).toBeTruthy();
    expect(Object.keys(FONT_CHOICES)).toHaveLength(8); // "" + 7 шрифтов
  });
});

describe("Foundry-завязанный код — CONFIG.fontDefinitions / game.settings", () => {
  let registeredSettings;

  beforeEach(() => {
    registeredSettings = {};
    globalThis.CONFIG = {};
    globalThis.game = {
      settings: {
        register: (ns, key, cfg) => { registeredSettings[key] = { ns, ...cfg }; },
        get: (ns, key) => registeredSettings[key]?._value ?? registeredSettings[key]?.default ?? ""
      }
    };
    globalThis.document = { documentElement: { style: {
      _props: {},
      setProperty(k, v) { this._props[k] = v; },
      removeProperty(k) { delete this._props[k]; }
    } } };
  });

  afterEach(() => {
    delete globalThis.CONFIG;
    delete globalThis.game;
    delete globalThis.document;
  });

  it("registerSystemFonts кладёт все 7 семейств в CONFIG.fontDefinitions с editor:true", () => {
    registerSystemFonts();
    expect(Object.keys(CONFIG.fontDefinitions)).toHaveLength(7);
    const bin = CONFIG.fontDefinitions["Бинарный Кант"];
    expect(bin.editor).toBe(true);
    expect(bin.fonts[0].urls[0]).toBe("systems/warhammer-dbc/fonts/binaric.ttf");
  });

  it("registerFontSettings регистрирует defaultFont (world) и fontOverride (client)", () => {
    registerFontSettings();
    expect(registeredSettings.defaultFont.scope).toBe("world");
    expect(registeredSettings.defaultFont.default).toBe("");
    expect(registeredSettings.defaultFont.choices).toBe(FONT_CHOICES);
    expect(registeredSettings.fontOverride.scope).toBe("client");
    expect(registeredSettings.fontOverride.default).toBe("");
  });

  it("applySystemFont выставляет --wh-font-body, когда выбор не пуст", () => {
    registeredSettings.fontOverride = { _value: "Odessa" };
    registeredSettings.defaultFont = { _value: "" };
    applySystemFont();
    expect(document.documentElement.style._props["--wh-font-body"]).toContain("Odessa");
  });

  it("applySystemFont снимает переменную (не ставит в ''), когда всё пусто", () => {
    document.documentElement.style.setProperty("--wh-font-body", `"Odessa"`);
    registeredSettings.fontOverride = { _value: "" };
    registeredSettings.defaultFont = { _value: "" };
    applySystemFont();
    expect("--wh-font-body" in document.documentElement.style._props).toBe(false);
  });

  it("effectiveFontFamily без game (настройки ещё не готовы) не падает — пустая строка", () => {
    delete globalThis.game;
    expect(effectiveFontFamily()).toBe("");
  });
});
