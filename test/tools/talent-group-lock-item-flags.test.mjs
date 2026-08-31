// test/tools/talent-group-lock-item-flags.test.mjs
//
// wdbc-sauo: три папки Талантов раньше проверяли ТОЧНОЕ имя предмета
// (`i.name === "…"`, лопается от любой правки написания в паке). Теперь
// предмет сам несёт запись Mechanics «Возможность» (kind:"capability"),
// которую читает hasRuleFlag() — этот тест держит JSON паков в синхроне с
// именем возможности, которое ждёт module/sheets/item-picker.mjs.

import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import { rulesFromItemMechanics } from "../../module/rules/item-rules.mjs";
import { isKnownCapability } from "../../module/constants/capabilities.mjs";

const ITEMS = [
  {
    file: "packs-src/traits/Книга_Пустоты/Navigator_s_Gen___Ген_Навигатора_RA4fT9IhVsau3sW8.json",
    capabilityKey: "talents.navigatorGen"
  },
  {
    file: "packs-src/implants/Адептус_Механикус/Кибернетика_Скитарии/Skitarii_War_Plate___Боевые_Латы_Скитари_5uZ4tNpHsLHjOEMB.json",
    capabilityKey: "talents.skitarii"
  },
  {
    file: "packs-src/traits/Элитные_архетипы/Варп_Кузнец/Mechanicum_Implants___Импланты_Механикум_mIHNU8mi5oBaNDpR.json",
    capabilityKey: "talents.mechanicum"
  }
];

describe.each(ITEMS)("$file несёт возможность $capabilityKey", ({ file, capabilityKey }) => {
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));

  it("имя возможности известно реестру (constants/capabilities.mjs)", () => {
    expect(isKnownCapability(capabilityKey)).toBe(true);
  });

  it("Mechanics предмета отдаёт grantFlag с этим именем, без ошибок", () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const rules = rulesFromItemMechanics([doc]);
    expect(rules.flatMap(r => r.effects)).toContainEqual({ kind: "grantFlag", target: capabilityKey });
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
