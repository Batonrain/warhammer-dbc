// ════════════════════════════════════════════════════════════════════════
//  Сцена — общая страница настроек ГМа (wdbc-paif): «Окружение» и «Завеса»
//  одним окном вместо двух. Пользователь просил ИМЕННО одну страницу, а не
//  третий пункт в самом Нексусе Сцен — это окно и есть тот пункт назначения,
//  Нексус только открывает его.
//
//  Как это устроено: ни математика, ни разметка Окружения/Завесы НЕ
//  переписаны. EnvironmentApp/VeilMystic (module/apps/environment.mjs,
//  module/apps/veil.mjs) остаются полноценными самостоятельными классами —
//  сюда их методы _prepareContext/_onRender/_patch/… переиспользуются как
//  готовые функции, привязанные к СВОИМ ЛЁГКИМ «контроллерам» (env/veil),
//  а не к самому этому окну. Так каждый раздел продолжает читать/писать
//  СВОЙ namespace флагов сцены — Окружение через resolveEnvContainer/
//  readEnvForScene, Завеса через resolveVeilContainer/readVeilForScene
//  (оба в constants/scene-nexus.mjs) — без риска, что состояние вкладок
//  перепутается: у env и veil ДВА РАЗНЫХ объекта состояния, не один общий.
//
//  Почему не `envCtl = new EnvironmentApp()` напрямую: `element`/`state` —
//  геттеры без сеттера у настоящего ApplicationV2 (та же ловушка, из-за
//  которой в этой сессии добавили test/support/foundry-stub.mjs::state) —
//  присвоить свой корневой DOM-узел настоящему инстансу нельзя. Контроллер
//  здесь — обычный plain-object: копия методов класса (без прототипной цепочки
//  до ApplicationV2, значит без его геттеров) + своё состояние вкладки,
//  заведённое тем же способом, что и в конструкторе VeilMystic/EnvironmentApp
//  (константы вкладки Завесы — _newRitual/_newJourney/_tarotSlots/_newDefile,
//  экспортированы из veil.mjs специально для этого).
// ════════════════════════════════════════════════════════════════════════

import { EnvironmentApp } from "./environment.mjs";
import { VeilMystic, _newRitual, _newJourney, _tarotSlots, _newDefile } from "./veil.mjs";

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

// Методы класса как обычные функции — без прототипной цепочки до
// ApplicationV2 (значит без её геттеров `element`/`state`/…). `super._onRender`
// внутри _onRender у обоих классов уходит в HandlebarsApplicationMixin/
// ApplicationV2 — их собственная реализация пустая (см. проверку перед
// написанием этого модуля), поэтому вызывать её с чужим `this` безопасно.
function ownMethods(Cls) {
  const out = {};
  for (const key of Object.getOwnPropertyNames(Cls.prototype)) {
    if (key === "constructor") continue;
    const desc = Object.getOwnPropertyDescriptor(Cls.prototype, key);
    if (typeof desc.value === "function") out[key] = desc.value;
  }
  return out;
}

export class SceneSettingsApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "wh-scene-settings",
    classes: ["warhammer-dbc", "wh-holo", "wh-scene-settings"],
    window: { title: "Сцена", resizable: true },
    position: { width: 1000, height: 820 }
  };

  static PARTS = {
    body: {
      template: "systems/warhammer-dbc/templates/apps/scene-settings.hbs",
      root: true, scrollable: [".wh-veil-scroll"]
    }
  };

  constructor(...args) {
    super(...args);
    this.ssTab = "env";

    // Контроллер Окружения — своё состояние (как в EnvironmentApp.constructor).
    this.env = { uiState: { cat: "weather", target: null }, ...ownMethods(EnvironmentApp) };
    this.env.render = force => this.render(force);

    // Контроллер Завесы — своё состояние (как в VeilMystic.constructor).
    this.veil = {
      uiState: { tab: "veil", navId: "", godPicker: false },
      ritual: _newRitual(),
      journey: _newJourney(),
      tarot: { subtab: "reading", spread: "cross", question: "", teomant: "", quirit: "", slots: _tarotSlots("cross") },
      defile: _newDefile(),
      ...ownMethods(VeilMystic)
    };
    this.veil.render = force => this.render(force);
  }

  async _prepareContext(options) {
    const envCtx = await this.env._prepareContext(options);
    const veilCtx = await this.veil._prepareContext(options);
    return {
      isGM: game.user.isGM,
      isEnvTab: this.ssTab === "env",
      isVeilTab: this.ssTab === "veil",
      env: envCtx,
      veil: veilCtx
    };
  }

  _onRender(context, options) {
    super._onRender?.(context, options);
    const el = this.element;

    // Верхний переключатель раздела — свой, узкий, не пересекается ни с
    // data-cat (Окружение), ни с data-tab (внутренние вкладки Завесы).
    el.querySelectorAll("[data-sstab]").forEach(b => b.addEventListener("click", () => {
      this.ssTab = b.dataset.sstab; this.render(false);
    }));

    // Каждый раздел вешает СВОИ обработчики на общий el своим собственным
    // _onRender — их селекторы не пересекаются, а состояние (env/veil) не
    // общее, так что клик в одном разделе не затронет данные другого.
    this.env.element = el;
    this.env._onRender(context.env, options);

    this.veil.element = el;
    this.veil._onRender(context.veil, options);
  }

  async close(options) { _instance = null; return super.close(options); }
}

let _instance = null;
export function openSceneSettings(tab = null) {
  if (!game.user.isGM) { ui.notifications?.info("Настройки сцены доступны только Мастеру."); return null; }
  if (!_instance) _instance = new SceneSettingsApp();
  if (tab === "env" || tab === "veil") _instance.ssTab = tab;
  _instance.render(true);
  return _instance;
}
export function refreshSceneSettings() { if (_instance?.rendered) _instance.render(false); }
