"""Render evidence images: creature strips and top-3 UI swatch boards."""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont
sys.path.insert(0, os.path.dirname(os.path.abspath(sys.argv[0])))
from mapui import lch_hex, CREATURES, meta  # noqa: E402

OUT = sys.argv[1]
SCR = os.path.dirname(os.path.dirname(os.path.abspath(sys.argv[0])))
try:
    F = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 15); FB = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 17)
    FS = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 12)
except Exception:
    F = FB = FS = ImageFont.load_default()

# 1) creature strips
summ = json.load(open(os.path.join(SCR, "out", "creatures.json"), encoding="utf-8"))
rows = list(CREATURES.items())
H = 92; W = 1180
img = Image.new("RGB", (W, H * len(rows) + 10), "#FFFFFF"); d = ImageDraw.Draw(img)
for r, (name, keys) in enumerate(rows):
    y = r * H + 5
    th = Image.open(meta[keys[0]]["local"]).convert("RGB"); th.thumbnail((120, 84)); img.paste(th, (8, y))
    d.text((140, y + 2), name, fill="#111", font=FB)
    cols = summ[name]["picked"]
    for i, hx in enumerate(cols):
        x = 140 + i * 128
        d.rounded_rectangle((x, y + 28, x + 120, y + 70), 8, fill=hx)
        d.text((x + 4, y + 72), hx, fill="#333", font=FS)
img.save(os.path.join(OUT, "palette-creatures-sampled.png"))

# 2) top-3 boards
specs = json.load(open(os.path.join(SCR, "out", "specs.json"), encoding="utf-8"))
top = json.load(open(os.path.join(SCR, "out", "top3.md.json"), encoding="utf-8"))
TYPES = ["task", "decision", "need", "change", "handoff", "redesign", "doc", "release"]
ST = ["success", "warning", "danger"]
for idx, (name, spec) in enumerate(specs.items()):
    nb = {k: (lch_hex(*v) if isinstance(v, list) else v) for k, v in spec["neutrals"].items()}
    pr = {k: (lch_hex(*v) if isinstance(v, list) else v) for k, v in spec["primary"].items()}
    t = top[name]
    board = Image.new("RGB", (1200, 470), "#000"); d = ImageDraw.Draw(board)
    for half, mode in enumerate(("light", "dark")):
        x0 = half * 600
        d.rectangle((x0, 0, x0 + 600, 470), fill=nb[mode + "_bg"])
        d.text((x0 + 20, 14), f"{name.split(' - ')[0]} · {mode}", fill=nb[mode + "_text"], font=FB)
        d.rounded_rectangle((x0 + 20, 48, x0 + 580, 452), 14, fill=nb[mode + "_surface"], outline=nb[mode + "_border"])
        d.text((x0 + 40, 62), "Awaiting me (4)", fill=nb[mode + "_text"], font=FB)
        d.text((x0 + 40, 86), "muted meta text · 2h ago · GTV-231", fill=nb[mode + "_muted"], font=F)
        pf = pr["light"] if mode == "light" else pr["dark"]; pt = "#FFFFFF" if mode == "light" else pr["dark_on"]
        d.rounded_rectangle((x0 + 440, 62, x0 + 560, 94), 8, fill=pf); d.text((x0 + 466, 68), "Decide", fill=pt, font=FB)
        for i, s in enumerate(TYPES + ST):
            col, row = i % 2, i // 2
            x = x0 + 40 + col * 270; y = 118 + row * 54
            v = t[s]
            d.ellipse((x, y + 9, x + 12, y + 21), fill=v["dot"])
            d.rectangle((x + 20, y, x + 23, y + 30), fill=v["dot"])
            soft = v["soft_" + mode]; fg = v["text_" + mode]
            d.rounded_rectangle((x + 32, y + 2, x + 140, y + 28), 13, fill=soft)
            d.text((x + 44, y + 5), s, fill=fg, font=F)
            d.text((x + 150, y + 5), v["dot"], fill=nb[mode + "_muted"], font=FS)
    board.save(os.path.join(OUT, f"palette-top{idx+1}-{['reef','peacock','mandarin'][idx]}.png"))
print("ok")
