import globals from "globals";

export default [
  {
    files: ["**/*.mjs"],
    ignores: ["node_modules/**", "packs/**", "assets/**", ".claude/worktrees/**"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.browser,
        game: "readonly", ui: "readonly", Hooks: "readonly", Combatant: "readonly",
        foundry: "readonly", CONFIG: "readonly", CONST: "readonly",
        Roll: "readonly", ChatMessage: "readonly", Dialog: "readonly",
        Actor: "readonly", Item: "readonly", ActiveEffect: "readonly",
        canvas: "readonly", fromUuid: "readonly", renderTemplate: "readonly",
        Folder: "readonly", JournalEntry: "readonly", FilePicker: "readonly",
        fromUuidSync: "readonly", Handlebars: "readonly", $: "readonly", PIXI: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { args: "none" }],
      // Взято из js.configs.recommended точечно, не целиком — остальные правила
      // пресета (no-empty, no-cond-assign и т.д.) дают тысячи находок в уже
      // рабочем коде, который никто не просил чинить этим тикетом (wdbc-swzz).
      // no-dupe-keys уже поймал живой дубль ("squad" дважды в
      // test/data/actor-schemas.test.mjs, wdbc-e728/wdbc-sk8s) — исправлен тут же.
      "no-dupe-class-members": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
      "no-fallthrough": "error"
    }
  },
  {
    // Инструменты сборки компендиумов запускаются в Node, а не в браузере.
    files: ["tools/**/*.mjs"],
    languageOptions: { globals: globals.node }
  }
];
