// module/rules/library/baleful-dirge.mjs
// Мрачный Плач: −10 на все тесты, кроме T, пока певец поёт (rules/baleful-dirge.mjs).
export const BALEFUL_DIRGE_RULES = [
  {
    id: "social.balefulDirge",
    label: "🎶 Мрачный Плач −10",
    when: { underBalefulDirge: true, charNotIn: ["t"] },
    effects: [{ kind: "rollBonus", target: "all", value: -10, label: "🎶 Мрачный Плач", auto: true }]
  }
];
