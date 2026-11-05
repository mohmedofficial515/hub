"""Hand-tuned top-3 token sets built from sampled colours; verifies WCAG contrast + distinguishability."""
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0])))
from mapui import cr, adjust, hex_lch, lch_hex, hex_rgb, PAPER, LIGHT, DARK  # noqa: E402
from palette import rgb_to_oklab  # noqa: E402

TYPES = ["task", "decision", "need", "change", "handoff", "redesign", "doc", "release"]
STATUS = ["success", "warning", "danger"]

def tune(hx, L=None, C=None, h=None):
    L0, C0, h0 = hex_lch(hx)
    return lch_hex(L if L is not None else L0, C if C is not None else C0, h if h is not None else h0)

def build(spec):
    out = {}
    nb = spec["neutrals"]
    for slot, (sample, note, ov) in spec["slots"].items():
        base = tune(sample, **ov) if ov else sample
        dot = base
        if cr(dot, PAPER) < 3: dot = adjust(dot, PAPER, 3.0, -1)
        if cr(dot, DARK) < 3: dot = adjust(dot, DARK, 3.0, +1)
        if cr(dot, nb["light_bg"]) < 3: dot = adjust(dot, nb["light_bg"], 3.0, -1)
        if cr(dot, nb["dark_bg"]) < 3: dot = adjust(dot, nb["dark_bg"], 3.0, +1)
        L, C, h = hex_lch(dot)
        soft_l = lch_hex(0.955, min(C, 0.045), h)
        soft_d = lch_hex(0.275, min(C, 0.05), h)
        tl = adjust(dot, soft_l, 4.5, -1)          # badge text on soft-light tint (implies >=4.5 on paper/white)
        tl = adjust(tl, PAPER, 4.5, -1)
        td = adjust(dot, soft_d, 4.5, +1)          # badge text on soft-dark tint
        td = adjust(td, DARK, 4.5, +1)
        out[slot] = dict(sample=sample, note=note, dot=dot, text_light=tl, text_dark=td, soft_light=soft_l, soft_dark=soft_d)
    return out

def lab(hx):
    return rgb_to_oklab(hex_rgb(hx)[None])[0]

def report(name, spec):
    t = build(spec); nb = spec["neutrals"]
    L = [f"#### {name}\n"]
    L.append("| token | light | dark |\n|---|---|---|")
    for k in ("bg", "surface", "border", "text", "muted"):
        L.append(f"| {k} | `{nb['light_'+k]}` | `{nb['dark_'+k]}` |")
    L.append(f"| text contrast | {cr(nb['light_text'], nb['light_bg']):.1f}:1 | {cr(nb['dark_text'], nb['dark_bg']):.1f}:1 |")
    L.append(f"| muted contrast | {cr(nb['light_muted'], nb['light_bg']):.1f}:1 | {cr(nb['dark_muted'], nb['dark_bg']):.1f}:1 |")
    p = spec["primary"]
    L.append(f"| primary (fill) | `{p['light']}` + white text {cr(p['light'], LIGHT):.1f}:1 | `{p['dark']}` + `{p['dark_on']}` text {cr(p['dark'], p['dark_on']):.1f}:1 |")
    L.append("")
    L.append("| slot | sampled | dot / stripe (both themes) | CR dot on light bg / dark bg | badge text light (on soft) | badge text dark (on soft) | soft light / soft dark |\n|---|---|---|---|---|---|---|")
    for s in TYPES + STATUS:
        v = t[s]
        L.append(f"| {s} | `{v['sample']}` {v['note']} | `{v['dot']}` | {cr(v['dot'], nb['light_bg']):.1f} / {cr(v['dot'], nb['dark_bg']):.1f} | "
                 f"`{v['text_light']}` ({cr(v['text_light'], v['soft_light']):.1f} on soft, {cr(v['text_light'], PAPER):.1f} on #F7F5F0) | "
                 f"`{v['text_dark']}` ({cr(v['text_dark'], v['soft_dark']):.1f} on soft, {cr(v['text_dark'], DARK):.1f} on #121316) | `{v['soft_light']}` / `{v['soft_dark']}` |")
    pairs = sorted((float(np.linalg.norm(lab(t[a]['dot']) - lab(t[b]['dot']))), a, b) for i, a in enumerate(TYPES) for b in TYPES[i + 1:])
    L.append(f"\nType-dot separation: closest {pairs[0][1]}–{pairs[0][2]} ΔE_ok {pairs[0][0]:.3f}; next {pairs[1][1]}–{pairs[1][2]} {pairs[1][0]:.3f}; median {np.median([p[0] for p in pairs]):.3f}.")
    sp = sorted((float(np.linalg.norm(lab(t[s]['dot']) - lab(t[x]['dot']))), s, x) for s in STATUS for x in TYPES)
    L.append(f"Closest status↔type: {sp[0][1]}–{sp[0][2]} {sp[0][0]:.3f}; {sp[1][1]}–{sp[1][2]} {sp[1][0]:.3f}.\n")
    return "\n".join(L), t

SPECS = json.load(open(sys.argv[1], encoding="utf-8"))
md = []
allt = {}
for name, spec in SPECS.items():
    for k, v in list(spec["neutrals"].items()):
        if isinstance(v, list): spec["neutrals"][k] = lch_hex(*v)
    for k, v in list(spec["primary"].items()):
        if isinstance(v, list): spec["primary"][k] = lch_hex(*v)
    for k, v in spec["slots"].items():
        spec["slots"][k] = (v[0], v[1], v[2] if len(v) > 2 else None)
    txt, t = report(name, spec); md.append(txt); allt[name] = t
open(sys.argv[2], "w", encoding="utf-8").write("\n".join(md))
json.dump(allt, open(sys.argv[2] + ".json", "w"), indent=1)
print("\n".join(md))
