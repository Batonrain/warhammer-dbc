// test/rules/turn-flags.test.mjs
//
// wdbc-5uae.1: срок жизни метки «до начала следующего своего Хода» переехал из
// перечисления по имени в combat/action-economy.mjs в реестр данных.
//
// Второй тест здесь — сторож, и он важнее первых: он падает, если кто-нибудь
// снова впишет флаг прямо в сброс, минуя реестр. Без него правка развалилась бы
// обратно первым же новым флагом, и ровно так и было бы, потому что дописать
// одну строку в сброс дешевле, чем найти реестр.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { turnStartFlagClears, TURN_SCOPED_FLAGS, TURN_SCOPED_FLAG_KEYS }
  from "../../module/rules/turn-flags.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Актор с поднятыми флагами — и в виде документа, и в виде сырых данных. */
function actorWithFlags(keys = []) {
  const flags = Object.fromEntries(keys.map(k => [k, true]));
  return {
    flags: { "warhammer-dbc": flags },
    getFlag: (_ns, key) => flags[key]
  };
}

describe("turnStartFlagClears: гашение флагов такта (wdbc-5uae.1)", () => {
  it("нечего гасить — пустой патч, лишнего update не будет", () => {
    expect(turnStartFlagClears(actorWithFlags())).toEqual({});
  });

  it("поднятый флаг гасится штатным «-=», а не записью false", () => {
    // false оставило бы в данных мусор, неотличимый от «никогда не ставили».
    expect(turnStartFlagClears(actorWithFlags(["running"])))
      .toEqual({ "flags.warhammer-dbc.-=running": null });
  });

  it("несколько флагов разом — один патч на все", () => {
    const upd = turnStartFlagClears(actorWithFlags(["running", "exposedAggressive", "recoilPool"]));
    expect(Object.keys(upd).sort()).toEqual([
      "flags.warhammer-dbc.-=exposedAggressive",
      "flags.warhammer-dbc.-=recoilPool",
      "flags.warhammer-dbc.-=running"
    ]);
  });

  it("каждый флаг реестра действительно гасится", () => {
    const upd = turnStartFlagClears(actorWithFlags(TURN_SCOPED_FLAG_KEYS));
    expect(Object.keys(upd).length).toBe(TURN_SCOPED_FLAG_KEYS.length);
  });

  it("чужой флаг актора не трогается — реестр закрытый", () => {
    expect(turnStartFlagClears(actorWithFlags(["marchKind", "disengageActive"]))).toEqual({});
  });

  it("у каждой записи реестра есть объяснение, зачем она здесь", () => {
    for (const [key, why] of Object.entries(TURN_SCOPED_FLAGS)) {
      expect(String(why).trim(), key).not.toBe("");
    }
  });
});

describe("сторож: сброс Хода не гасит флаги по имени в обход реестра", () => {
  it("в resetActionEconomy не осталось построчных «flags.warhammer-dbc.-=»", () => {
    const src = fs.readFileSync(path.join(ROOT, "module/combat/action-economy.mjs"), "utf8");
    const reset = src.slice(src.indexOf("export async function resetActionEconomy"));
    const body  = reset.slice(0, reset.indexOf("\n}\n"));
    const inline = body.split(/\r?\n/)
      .map((line, i) => [line, i + 1])
      .filter(([line]) => /upd\[["'`]flags\.warhammer-dbc\.-=/.test(line))
      .map(([line, n]) => `${n}: ${line.trim()}`);
    expect(inline, [
      "Флаг такта вписан прямо в сброс, мимо реестра rules/turn-flags.mjs.",
      "Так срок жизни метки снова оказывается не при метке, а списком в чужом",
      "файле — и следующую забудут туда дописать. Добавьте строку в",
      "TURN_SCOPED_FLAGS, гашение подхватится само."
    ].join("\n")).toEqual([]);
  });
});
