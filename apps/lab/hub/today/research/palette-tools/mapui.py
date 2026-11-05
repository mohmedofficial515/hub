"""Build creature palettes + UI mapping with WCAG contrast adjustment. Writes markdown to argv[1]."""
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0])))
from palette import rgb_to_oklab, oklab_to_rgb, hexs  # noqa: E402
from palette2 import CROPS  # noqa: E402  (palette2 runs its loop only when argv lists keys; we guard below)

BASE = os.path.dirname(os.path.abspath(sys.argv[0]))
meta = json.load(open(os.path.join(BASE, "meta.json"), encoding="utf-8"))

CREATURES = {
    "Peacock (Indian peafowl, Pavo cristatus)": ["peacock", "peacock_tail"],
    "Mandarinfish (Synchiropus splendidus)": ["mandarinfish"],
    "Panther chameleon (Furcifer pardalis)": ["chameleon_ambilobe", "chameleon"],
    "Rainbow lorikeet (Trichoglossus moluccanus)": ["lorikeet"],
    "Nudibranch (Chromodoris annae)": ["nudibranch"],
    "Hummingbirds (Anna's + violet sabrewing)": ["hummingbird", "sabrewing"],
    "Morpho butterfly (Morpho menelaus)": ["morpho"],
    "Parrotfish (queen parrotfish, Scarus vetula)": ["parrotfish"],
    "Rainbow eucalyptus bark (Eucalyptus deglupta)": ["eucalyptus"],
    "Coral reef (Palmyra Atoll + Red Sea)": ["coralreef_pd", "coralreef"],
    "Gouldian finch (Erythrura gouldiae)": ["gouldian"],
}

PRIMARY_HUE = {"Peacock": 261, "Rainbow lorikeet": 262, "Hummingbirds": 350, "Gouldian": 310}

SLOTS = [  # (name, target OKLCH hue)
    ("task", 262), ("decision", 85), ("need", 345), ("change", None), ("handoff", 215),
    ("redesign", 300), ("doc", 170), ("release", 125), ("success", 150), ("warning", 58), ("danger", 25),
]

# ---------- colour maths ----------
def lab_to_lch(lab):
    return lab[0], float(np.hypot(lab[1], lab[2])), float((np.degrees(np.arctan2(lab[2], lab[1])) + 360) % 360)

def lch_to_lab(L, C, h):
    r = np.radians(h)
    return np.array([L, C * np.cos(r), C * np.sin(r)])

def in_gamut(lab):
    M2i = np.array([[1, 0.3963377774, 0.2158037573], [1, -0.1055613458, -0.0638541728], [1, -0.0894841775, -1.2914855480]])
    lms = (lab @ M2i.T) ** 3
    M1i = np.array([[4.0767416621, -3.3077115913, 0.2309699292], [-1.2684380046, 2.6097574011, -0.3413193965], [-0.0041960863, -0.7034186147, 1.7076147010]])
    lin = lms @ M1i.T
    return bool(np.all(lin >= -1e-4) and np.all(lin <= 1 + 1e-4))

def lch_hex(L, C, h):
    lo, hi = 0.0, C
    if not in_gamut(lch_to_lab(L, C, h)):
        for _ in range(30):
            mid = (lo + hi) / 2
            if in_gamut(lch_to_lab(L, mid, h)): lo = mid
            else: hi = mid
        C = lo
    return hexs(oklab_to_rgb(lch_to_lab(L, C, h)))

def hex_rgb(hx):
    return np.array([int(hx[i:i + 2], 16) for i in (1, 3, 5)], dtype=float)

def lum(hx):
    c = hex_rgb(hx) / 255
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

def cr(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)

def hex_lch(hx):
    return lab_to_lch(rgb_to_oklab(hex_rgb(hx)[None])[0])

LIGHT, PAPER, DARK = "#FFFFFF", "#F7F5F0", "#121316"

def adjust(hx, against, target, direction):
    """Move OKLCH L (keeping h, C gamut-clipped) until contrast >= target. direction -1 darker, +1 lighter."""
    if cr(hx, against) >= target:
        return hx
    L, C, h = hex_lch(hx)
    for _ in range(200):
        L += 0.005 * direction
        cand = lch_hex(L, C, h)
        if cr(cand, against) >= target:
            return cand
    return cand

# ---------- sampling ----------
def bins_for(key):
    im = Image.open(meta[key]["local"]).convert("RGB")
    W, H = im.size
    c = CROPS.get(key, (0, 0, 1, 1))
    im = im.crop((int(c[0] * W), int(c[1] * H), int(c[2] * W), int(c[3] * H)))
    im.thumbnail((420, 420))
    lab = rgb_to_oklab(np.asarray(im).reshape(-1, 3).astype(float))
    C = np.hypot(lab[:, 1], lab[:, 2]); h = (np.degrees(np.arctan2(lab[:, 2], lab[:, 1])) + 360) % 360
    if key == "morpho":
        keep = ~((lab[:, 0] > 0.93) & (C < 0.02)); lab, C, h = lab[keep], C[keep], h[keep]
    n = len(lab); out = []
    for b0 in range(0, 360, 15):
        m = (C > 0.045) & (h >= b0) & (h < b0 + 15)
        if m.sum() / n < 0.006: continue
        sub, subC = lab[m], C[m]
        top = sub[subC >= np.quantile(subC, 0.7)].mean(0)
        L_, C_, h_ = lab_to_lch(top)
        out.append({"hex": hexs(oklab_to_rgb(top)), "L": L_, "C": C_, "h": h_, "share": m.sum() / n, "src": key})
    neu = lab[C < 0.04]
    neutrals = []
    if len(neu) > 50:
        for q in (0.08, 0.5, 0.92):
            v = np.quantile(neu[:, 0], q); sel = neu[np.abs(neu[:, 0] - v) < 0.03].mean(0)
            neutrals.append(hexs(oklab_to_rgb(sel)))
    return out, neutrals

def hdist(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)

def run(md_path):
    lines = []
    summary = {}
    for name, keys in CREATURES.items():
        bins, neus = [], []
        for k in keys:
            b, nn = bins_for(k); bins += b; neus.append(nn)
        # curated sampled palette: up to 8 vivid with hue separation + 2 neutrals
        pool = sorted(bins, key=lambda r: -(r["share"] ** 0.5) * r["C"])
        picked = []
        for sep, dl in ((18, 0.22), (10, 0.12)):
            for r in pool:
                if len(picked) == 8: break
                if r in picked: continue
                if all(hdist(r["h"], p["h"]) >= sep or abs(r["L"] - p["L"]) > dl for p in picked):
                    picked.append(r)
        neutral_dark = min((x[0] for x in neus if x), key=lambda hx: hex_lch(hx)[0])
        neutral_light = max((x[2] for x in neus if x), key=lambda hx: hex_lch(hx)[0])
        neutral_mid = neus[0][1] if neus[0] else "#777777"
        nh = hex_lch(neutral_mid)[2]
        if hex_lch(neutral_mid)[1] < 0.008: nh = hex_lch(neutral_light)[2]
        lines.append(f"### {name}\n")
        src = "; ".join(f"[{meta[k]['title'][5:]}]({meta[k]['page']}) — {meta[k]['artist']}, {meta[k]['license']}" for k in keys)
        lines.append(f"Photo(s): {src}\n")
        lines.append("Sampled palette (OKLab hue-bin sampling of the subject crop; hex = mean of the most chromatic 30 % of pixels in that hue family):\n")
        lines.append("| # | hex | OKLCH L / C / h | share of crop |\n|---|---|---|---|")
        for i, p in enumerate(sorted(picked, key=lambda r: r["h"])):
            lines.append(f"| {i+1} | `{p['hex']}` | {p['L']:.2f} / {p['C']:.3f} / {p['h']:.0f} | {p['share']:.1%} |")
        lines.append(f"| {len(picked)+1} | `{neutral_dark}` | neutral dark | — |")
        lines.append(f"| {len(picked)+2} | `{neutral_light}` | neutral light | — |\n")
        # neutrals for UI (tinted with the creature's neutral hue)
        ui_neu = {
            "light bg": lch_hex(0.975, 0.007, nh), "light surface": lch_hex(0.995, 0.003, nh),
            "light border": lch_hex(0.90, 0.012, nh), "light muted text": lch_hex(0.50, 0.018, nh),
            "dark bg": lch_hex(0.17, 0.010, nh), "dark surface": lch_hex(0.215, 0.012, nh),
            "dark border": lch_hex(0.30, 0.012, nh), "dark muted text": lch_hex(0.72, 0.018, nh),
        }
        ui_neu["light muted text"] = adjust(ui_neu["light muted text"], ui_neu["light bg"], 4.5, -1)
        ui_neu["dark muted text"] = adjust(ui_neu["dark muted text"], ui_neu["dark bg"], 4.5, +1)
        lines.append("UI neutrals (tinted with the photo's neutral hue h≈%d): " % nh +
                     ", ".join(f"{k} `{v}`" for k, v in ui_neu.items()) + "\n")
        # primary = most present vivid colour
        ph = next((v for kk, v in PRIMARY_HUE.items() if name.startswith(kk)), None)
        if ph is None:
            sig = max(bins, key=lambda r: r["share"] * (r["C"] > 0.09))
        else:
            sig = max([b for b in bins if hdist(b["h"], ph) <= 20], key=lambda r: r["C"] * r["share"] ** 0.5)
        p_light = adjust(sig["hex"], LIGHT, 4.5, -1)
        p_dark = adjust(sig["hex"], DARK, 4.5, +1)
        lines.append(f"Primary/brand: sampled `{sig['hex']}` → light-mode fill with white text `{p_light}` ({cr(p_light, LIGHT):.1f}:1), dark-mode fill/link `{p_dark}` ({cr(p_dark, DARK):.1f}:1 on #121316).\n")
        lines.append("| slot | sampled from photo | CR of sample on #FFFFFF / #F7F5F0 / #121316 | dot/fill, both themes (≥3:1 on #F7F5F0 and #121316) | text on light (≥4.5 vs #F7F5F0, so also vs #FFF) | text on dark (≥4.5 vs #121316) |\n|---|---|---|---|---|---|")
        res = {}
        # assignment with de-duplication: a hue family may serve one slot only
        used = set(); choice = {}
        pairs = []
        for slot, hue in SLOTS:
            if hue is None: continue
            for i, b in enumerate(bins):
                if hdist(b["h"], hue) <= 22 and b["C"] >= 0.07:
                    pairs.append((hdist(b["h"], hue) - 40 * b["C"] - 8 * b["share"] ** 0.5, slot, i))
        for _, slot, i in sorted(pairs):
            if slot in choice or i in used: continue
            # also refuse samples within 12 deg of an already used sample (same family from the 2nd photo)
            if any(hdist(bins[i]["h"], bins[j]["h"]) < 20 for j in used): continue
            choice[slot] = i; used.add(i)
        vivC = float(np.median([b["C"] for b in bins if b["C"] >= 0.07] or [0.12]))
        for slot, hue in SLOTS:
            if slot == "change":
                L_, C_, h_ = hex_lch(neutral_mid)
                base = lch_hex(min(max(L_, 0.5), 0.62), min(C_, 0.03), h_ if C_ > 0.008 else nh); note = "photo neutral"
            elif slot in choice:
                b = bins[choice[slot]]; base = b["hex"]; note = f"h{b['h']:.0f}"
            else:
                base = lch_hex(0.62, min(0.15, max(vivC, 0.12)), hue); note = "**ext** (no unused photo sample within ±22°)"
            L_, C_, h_ = hex_lch(base)
            dot = base
            if cr(dot, PAPER) < 3: dot = adjust(dot, PAPER, 3.0, -1)
            if cr(dot, DARK) < 3: dot = adjust(dot, DARK, 3.0, +1)
            tl = adjust(dot, PAPER, 4.5, -1); td = adjust(dot, DARK, 4.5, +1)
            res[slot] = (base, dot, tl, td, note)
            lines.append(f"| {slot} | `{base}` {note} | {cr(base, LIGHT):.1f} / {cr(base, PAPER):.1f} / {cr(base, DARK):.1f} | `{dot}` ({cr(dot, PAPER):.1f} / {cr(dot, DARK):.1f}) | `{tl}` ({cr(tl, PAPER):.1f}) | `{td}` ({cr(td, DARK):.1f}) |")
        # distinguishability of the 8 type dots
        types = ["task", "decision", "need", "change", "handoff", "redesign", "doc", "release"]
        labs = {t: rgb_to_oklab(hex_rgb(res[t][1])[None])[0] for t in types}
        worst = min(((float(np.linalg.norm(labs[a] - labs[b])), a, b) for ai, a in enumerate(types) for b in types[ai + 1:]))
        lines.append(f"\nClosest pair of type dots: {worst[1]} vs {worst[2]}, ΔE(OKLab) = {worst[0]:.3f} " +
                     ("(good, ≥ 0.10)" if worst[0] >= 0.10 else "(acceptable only with icon + label, 0.06–0.10)" if worst[0] >= 0.06 else "(**too close**, < 0.06)"))
        ext = sum(1 for v in res.values() if "ext" in v[-1])
        lines.append(f"\nCoverage: {11-ext}/11 slots filled from distinct photo samples, {ext} extended.\n")
        summary[name] = {"picked": [p["hex"] for p in picked], "neutrals": ui_neu, "primary": (sig["hex"], p_light, p_dark), "slots": res, "ext": ext}
    open(md_path, "w", encoding="utf-8").write("\n".join(lines))
    json.dump(summary, open(md_path.replace(".md", ".json"), "w", encoding="utf-8"), indent=1)

if __name__ == "__main__":
    run(sys.argv[1])
