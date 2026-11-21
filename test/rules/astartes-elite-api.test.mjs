// Ленивый API кнопок пачки «astartes»: каждое имя есть в своём модуле (21.11.2026).
import { describe, it, expect } from "vitest";
import "../support/foundry-stub.mjs";
import { API } from "../../module/combat/elite-api/astartes.mjs";

const MODULES = {
  "../../module/combat/bronenosets-talents.mjs": ["useChaosGreatbow", "useDivineShield", "dedicateChaosSteed", "useSinEater"],
  "../../module/combat/gerold-talents.mjs": ["ancientBannerLost", "useGreaterHerald", "useStandYourGround", "useVillainousHonour", "useDelegate", "noblesseObligeSlip"],
  "../../module/combat/warp-talon-talents.mjs": ["useVeilRender", "useRift", "useSpeedOfThought", "useWarpTrail"],
  "../../module/combat/moritat-talents.mjs": ["useBeltFeed", "useFlyBy"],
  "../../module/combat/terminator-talents.mjs": ["useAnointed", "useAtramentar", "useDeathShroud"],
  "../../module/combat/obliterator-talents.mjs": ["useLivingArsenal", "useBulletEater", "useMutilator", "useSelfForging", "useShredder", "useToTheTeeth"],
  "../../module/combat/blood-smith-talents.mjs": ["useRingOfBlood", "useDaemonPlate", "useUnforge"]
};

describe("API пачки astartes", () => {
  it("все ключи — функции, и каждая есть в модуле", async () => {
    const all = Object.values(MODULES).flat();
    expect(Object.keys(API).sort()).toEqual([...all].sort());
    for (const [path, names] of Object.entries(MODULES)) {
      const mod = await import(path);
      for (const n of names) expect(typeof mod[n], n).toBe("function");
    }
  });
});
