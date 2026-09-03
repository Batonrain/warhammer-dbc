// module/constants/fonts.mjs
// ════════════════════════════════════════════════════════════════════════
//  Тематические шрифты сеттинга (wdbc-9m83) — файлы лежат в systems/
//  warhammer-dbc/fonts/, регистрируются в CONFIG.fontDefinitions (Foundry
//  v11+, читается FontConfig._loadFonts() при старте канваса — см.
//  client/applications/settings/menus/font-config.mjs, отдельного ключа
//  манифеста system.json под шрифты у Foundry нет). Регистрация в
//  CONFIG.fontDefinitions добавляет FontFace прямо в document.fonts —
//  этого достаточно и для системного интерфейса целиком (обычный CSS
//  font-family подхватывает семейство везде на странице), и для
//  редактора/пикера шрифтов самого Foundry (editor:true). Classic
//  @font-face в styles/base/fonts.css — не альтернативный путь, а
//  дублирующая подстраховка на случай, если fontDefinitions не подхватится.
//
//  Настройка выбора — по принципу «пусто = наследовать» (тот же, что у
//  pricingModeOverride актора, module/sheets/actor-sheet.mjs): мировой
//  дефолт (scope:"world", решает ГМ) + личный оверрайд игрока
//  (scope:"client", пусто = взять мировой). Итоговое имя семейства
//  применяется как CSS-переменная --wh-font-body на :root — см.
//  applySystemFont().
//
//  Открытый вопрос (не реализовано здесь, зафиксировано по просьбе
//  пользователя как заметка на будущее): один общий шрифт на весь
//  интерфейс — самый простой вариант и то, о чём буквально просили
//  («выбор шрифта по умолчанию»). Тематические имена файлов (Binaric,
//  Colhidian, Истинный Язык) наводят на мысль о более тонкой схеме —
//  разные шрифты для разных типов текста/рас (акцентные вставки лора
//  вместо шрифта всего интерфейса) — это отдельная возможная доработка,
//  не блокирует эту задачу.
// ════════════════════════════════════════════════════════════════════════

export const SYSTEM_ID = "warhammer-dbc";

/** Файл → тематическое русское имя семейства (что видит игрок в списке). */
export const FONT_FAMILIES = [
  { family: "Бинарный Кант",  file: "binaric.ttf" },
  { family: "Колхидский",     file: "colhidian.ttf" },
  { family: "Высокая Готика", file: "highGothic.ttf" },
  { family: "Низкая Готика",  file: "lowGothic.ttf" },
  { family: "Odessa",         file: "odessa.otf" },
  { family: "System",         file: "system.ttf" },
  { family: "Истинный Язык",  file: "trueTongue.ttf" }
];

/** Пустое значение = «дефолт Foundry, ничего не подставлять» — везде первым пунктом. */
export const FONT_CHOICES = Object.freeze(
  Object.fromEntries([
    ["", "По умолчанию (Foundry)"],
    ...FONT_FAMILIES.map(f => [f.family, f.family])
  ])
);

/**
 * Регистрирует 7 тематических шрифтов в CONFIG.fontDefinitions — вызывать
 * из Hooks.once("init") ДО того, как Foundry соберёт список для канваса
 * (FontConfig._loadFonts вызывается позже, при инициализации канваса).
 * editor:true — шрифт виден и в стандартном пикере/HTML-редакторе Foundry,
 * не только в наших двух настройках.
 */
export function registerSystemFonts() {
  CONFIG.fontDefinitions ??= {};
  for (const { family, file } of FONT_FAMILIES) {
    CONFIG.fontDefinitions[family] = {
      editor: true,
      fonts: [{ urls: [`systems/${SYSTEM_ID}/fonts/${file}`] }]
    };
  }
}

/**
 * Мировой дефолт (ГМ) + личный оверрайд (игрок, client-scope). Пустое
 * значение у обоих = дефолтный шрифт Foundry как есть, ничего не трогаем.
 */
export function registerFontSettings() {
  game.settings.register(SYSTEM_ID, "defaultFont", {
    name: "Шрифт интерфейса (по умолчанию)",
    hint: "Шрифт основного интерфейса системы для всех игроков мира. Пустое значение — обычный шрифт Foundry. Игрок может поставить свой шрифт в «Настройках игрока» (Шрифт интерфейса — личный выбор) — это не поменяется при смене мирового значения.",
    scope: "world", config: true, type: String,
    choices: FONT_CHOICES, default: "",
    onChange: () => applySystemFont()
  });
  game.settings.register(SYSTEM_ID, "fontOverride", {
    name: "Шрифт интерфейса — личный выбор",
    hint: "Переопределяет мировой шрифт только для вас на этом экране. Пустое значение — наследовать мировой шрифт (или дефолт Foundry, если мировой тоже не задан).",
    scope: "client", config: true, type: String,
    choices: FONT_CHOICES, default: "",
    onChange: () => applySystemFont()
  });
}

/**
 * Чистая функция резолюции — личный оверрайд важнее мирового дефолта,
 * пусто-пусто = "" (не трогать дефолтный шрифт Foundry). Тот же принцип,
 * что у effectivePricingMode(actor) в patronage.mjs, но без актора: это
 * предпочтение экрана конкретного игрока, не поле документа.
 */
export function resolveFontFamily(fontOverride, defaultFont) {
  return fontOverride || defaultFont || "";
}

/** Действующее имя семейства сейчас — до готовности настроек считаем, что ничего не выбрано. */
export function effectiveFontFamily() {
  try {
    const override = game.settings.get(SYSTEM_ID, "fontOverride");
    const world = game.settings.get(SYSTEM_ID, "defaultFont");
    return resolveFontFamily(override, world);
  } catch (e) { return ""; }
}

/**
 * Подставляет/снимает --wh-font-body на :root. Пустая строка снимает
 * переменную вовсе (не выставляет её в ""), чтобы CSS var(--wh-font-body,
 * <дефолтный стек>) корректно откатился на дефолт — CSS-переменная,
 * выставленная в "", была бы невалидным font-family, а не «не задана».
 */
export function applySystemFont() {
  const family = effectiveFontFamily();
  const root = document?.documentElement;
  if (!root) return;
  if (family) {
    root.style.setProperty("--wh-font-body", `"${family}", "Book Antiqua", Palatino, Georgia, serif`);
  } else {
    root.style.removeProperty("--wh-font-body");
  }
}
