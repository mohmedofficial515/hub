"""Subject-cropped hue-bin sampling: one real (averaged) colour per hue family present on the creature."""
import json, os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0])))
from palette import rgb_to_oklab, oklab_to_rgb, hexs  # noqa: E402

BASE = os.path.dirname(os.path.abspath(sys.argv[0]))
meta = json.load(open(os.path.join(BASE, "meta.json"), encoding="utf-8"))
CROPS = {
    "mandarinfish": (0.25, 0.2, 0.95, 0.95), "chameleon_ambilobe": (0.05, 0.15, 1.0, 0.95),
    "chameleon": (0.05, 0.25, 0.98, 0.75), "lorikeet": (0.2, 0.05, 0.78, 0.7),
    "nudibranch": (0.12, 0.3, 0.92, 0.82), "hummingbird": (0.1, 0.25, 0.65, 0.85),
    "sabrewing": (0.25, 0.25, 0.9, 0.85), "parrotfish": (0.4, 0.05, 0.97, 0.75),
    "eucalyptus": (0, 0, 0.75, 1), "gouldian": (0.1, 0.18, 0.55, 0.75),
}

def lch(lab):
    return lab[:, 0], np.hypot(lab[:, 1], lab[:, 2]), (np.degrees(np.arctan2(lab[:, 2], lab[:, 1])) + 360) % 360

if __name__ == "__main__":
    for k in (sys.argv[1:] or list(meta)):
        im = Image.open(meta[k]["local"]).convert("RGB")
        W, H = im.size
        c = CROPS.get(k, (0, 0, 1, 1))
        im = im.crop((int(c[0] * W), int(c[1] * H), int(c[2] * W), int(c[3] * H)))
        im.thumbnail((420, 420))
        lab = rgb_to_oklab(np.asarray(im).reshape(-1, 3).astype(float))
        L, C, h = lch(lab)
        if k == "morpho":
            keep = ~((L > 0.93) & (C < 0.02)); lab, L, C, h = lab[keep], L[keep], C[keep], h[keep]
        n = len(lab)
        print(f"=== {k}   crop={c}")
        viv = C > 0.045
        rows = []
        for b0 in range(0, 360, 15):
            m = viv & (h >= b0) & (h < b0 + 15)
            share = m.sum() / n
            if share < 0.006:
                continue
            sub, subC = lab[m], C[m]
            top = sub[subC >= np.quantile(subC, 0.7)]
            mid = sub[(subC >= np.quantile(subC, 0.3)) & (subC <= np.quantile(subC, 0.7))]
            rows.append((share, b0, top.mean(0), mid.mean(0)))
        for share, b0, t, md in sorted(rows, key=lambda r: -r[0]):
            tl = lch(t[None])
            print(f"  h{b0:3d}-{b0+15:3d} share={share:5.1%}  vivid={hexs(oklab_to_rgb(t))} (L{tl[0][0]:.2f} C{tl[1][0]:.3f})  typical={hexs(oklab_to_rgb(md))}")
        neu = lab[C < 0.04]
        if len(neu) > 50:
            Ln = neu[:, 0]
            out = []
            for q in (0.08, 0.5, 0.92):
                v = np.quantile(Ln, q)
                sel = neu[np.abs(Ln - v) < 0.03]
                out.append(hexs(oklab_to_rgb(sel.mean(0))))
            print(f"  neutrals (C<0.04, share={len(neu)/n:4.0%}): dark={out[0]} mid={out[1]} light={out[2]}")
