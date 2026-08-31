import json, sys

VOLATILE_KEYS = ("_id", "_key", "_stats", "folder", "ownership", "sort", "img")

def strip(d):
    d = json.loads(json.dumps(d))
    for k in VOLATILE_KEYS:
        d.pop(k, None)
    return d

def load(path):
    return json.load(open(path, encoding="utf-8"))

wid, pack_path = sys.argv[1], sys.argv[2]
world = load(f"tools/_world-vehicles/{wid}.json")
pack = load(pack_path)

# top-level actor system (armor/structure/spd etc)
w_sys = strip(world).get("system", {})
p_sys = strip(pack).get("system", {})
if w_sys != p_sys:
    print("--- system (actor stats) differs ---")
    for k in set(w_sys) | set(p_sys):
        if w_sys.get(k) != p_sys.get(k):
            print(f"  {k}: pack={p_sys.get(k)!r}  world={w_sys.get(k)!r}")

# items keyed by name
def items_by_name(doc):
    out = {}
    for it in doc.get("items", []):
        out.setdefault(it.get("name"), []).append(strip(it))
    return out

wi = items_by_name(world)
pi = items_by_name(pack)

names = set(wi) | set(pi)
for name in sorted(names):
    wl = wi.get(name, [])
    pl = pi.get(name, [])
    if wl == pl:
        continue
    print(f"--- item '{name}' differs (world count={len(wl)}, pack count={len(pl)}) ---")
    if len(wl) == 1 and len(pl) == 1:
        ws, ps = wl[0].get("system", {}), pl[0].get("system", {})
        for k in set(ws) | set(ps):
            if ws.get(k) != ps.get(k):
                print(f"    {k}: pack={ps.get(k)!r}  world={ws.get(k)!r}")
    else:
        print("    (count mismatch or complex — needs manual look)")

# effects (combat status effects — usually NOT part of a "profile", just runtime state)
w_eff = [e.get("name") for e in world.get("effects", [])]
p_eff = [e.get("name") for e in pack.get("effects", [])]
if w_eff != p_eff:
    print(f"--- effects differ (likely just runtime combat state, ignore) --- pack={p_eff} world={w_eff}")
