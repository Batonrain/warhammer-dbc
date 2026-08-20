// Совмещённая специализация Группы Навыков («Варп, Демоны и Псайкеры» —
// skill-specializations.mjs, combines) должна закрывать требование Таланта
// на ЛЮБУЮ из трёх объединённых специализаций текстом («Forbidden Lore
// (Psykers)+20»), а не только на своё собственное имя — иначе персонаж с
// книжной записью Sorcerer/Witch/Psyker не мог бы взять завязанные на неё
// Таланты (Witchfinder, Psychic Collapse и т.п.).

import { describe, it, expect } from "vitest";
import { checkRequirement } from "../../module/constants/talent-requirements.mjs";

const actor = (groupSkills = {}) => ({
  system: { characteristics: {}, skills: {}, groupSkills },
  items: []
});

describe("совмещённая специализация Группы Навыков в текстовых требованиях", () => {
  const withCombo = rank => actor({
    forbiddenLore: [{ specKey: "warpDaemonsPsykers", specialty: "Варп, Демоны и Псайкеры", rank }]
  });

  it("закрывает требование на каждую из трёх объединённых специализаций", () => {
    for (const text of ["Forbidden Lore (Warp)+20", "Forbidden Lore (Daemons)+20", "Forbidden Lore (Psykers)+20"]) {
      expect(checkRequirement(withCombo("veteran"), text).state).toBe("ok");
    }
  });

  it("ранг спрашивается у самой совмещённой записи", () => {
    expect(checkRequirement(withCombo("knows"), "Forbidden Lore (Psykers)+20").state).toBe("fail");
  });

  it("не закрывает специализацию, которая в combines не входит", () => {
    expect(checkRequirement(withCombo("expert"), "Forbidden Lore (Heresy)+0").state).toBe("fail");
  });

  it("отдельная запись без combines по-прежнему работает как раньше", () => {
    const a = actor({ forbiddenLore: [{ specKey: "daemons", specialty: "Демоны", rank: "trained" }] });
    expect(checkRequirement(a, "Forbidden Lore (Daemons)+0").state).toBe("ok");
    expect(checkRequirement(a, "Forbidden Lore (Warp)+0").state).toBe("fail");
  });
});
