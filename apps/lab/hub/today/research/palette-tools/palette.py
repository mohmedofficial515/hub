"""Sample palettes from photos: k-means in OKLab on all pixels and on vivid pixels only."""
import json, os, sys
import numpy as np
from PIL import Image
from sklearn.cluster import KMeans

BASE = os.path.dirname(os.path.abspath(sys.argv[0]))
meta = json.load(open(os.path.join(BASE, "meta.json"), encoding="utf-8"))

def srgb_to_lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)

def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055) * 255

def rgb_to_oklab(rgb):
    l = srgb_to_lin(rgb)
    M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
                   [0.2119034982, 0.6806995451, 0.1073969566],
                   [0.0883024619, 0.2817188376, 0.6299787005]])
    lms = l @ M1.T
    lms = np.cbrt(lms)
    M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
                   [1.9779984951, -2.4285922050, 0.4505937099],
                   [0.0259040371, 0.7827717662, -0.8086757660]])
    return lms @ M2.T

def oklab_to_rgb(lab):
    M2i = np.array([[1, 0.3963377774, 0.2158037573],
                    [1, -0.1055613458, -0.0638541728],
                    [1, -0.0894841775, -1.2914855480]])
    lms = lab @ M2i.T
    lms = lms ** 3
    M1i = np.array([[4.0767416621, -3.3077115913, 0.2309699292],
                    [-1.2684380046, 2.6097574011, -0.3413193965],
                    [-0.0041960863, -0.7034186147, 1.7076147010]])
    return lin_to_srgb(lms @ M1i.T)

def hexs(rgb):
    r = np.clip(np.round(rgb), 0, 255).astype(int)
    return "#%02X%02X%02X" % tuple(r)

def describe(lab, w):
    L, a, b = lab
    C = (a * a + b * b) ** 0.5
    h = (np.degrees(np.arctan2(b, a)) + 360) % 360
    return f"{hexs(oklab_to_rgb(np.array(lab)))}  w={w:5.1%}  L={L:.2f} C={C:.3f} h={h:5.1f}"

if __name__ == "__main__":
    keys = sys.argv[1:] or list(meta)
    for k in keys:
        im = Image.open(meta[k]["local"]).convert("RGB")
        im.thumbnail((360, 360))
        px = np.asarray(im).reshape(-1, 3).astype(float)
        lab = rgb_to_oklab(px)
        if k == "morpho":  # museum specimen on white: drop near-white background
            lab = lab[~((lab[:, 0] > 0.93) & (np.hypot(lab[:, 1], lab[:, 2]) < 0.02))]
        km = KMeans(n_clusters=12, n_init=4, random_state=1).fit(lab)
        cnt = np.bincount(km.labels_, minlength=12) / len(lab)
        order = np.argsort(-cnt)
        print(f"=== {k}  ({meta[k]['title']})")
        print("  -- all pixels (k=12, by weight)")
        for i in order:
            print("   ", describe(km.cluster_centers_[i], cnt[i]))
        C = np.hypot(lab[:, 1], lab[:, 2])
        viv = lab[C > 0.09]
        if len(viv) > 200:
            kv = KMeans(n_clusters=10, n_init=4, random_state=1).fit(viv)
            cv = np.bincount(kv.labels_, minlength=10) / len(lab)
            print("  -- vivid pixels only (C>0.09, k=10; weight = share of whole image)")
            for i in np.argsort(-cv):
                print("   ", describe(kv.cluster_centers_[i], cv[i]))
