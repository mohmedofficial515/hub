import re, sys, os

base = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(sys.argv[0]))), "out")
rd = lambda n: open(os.path.join(base, n), encoding="utf-8").read()
p1, p2, cr, p3, top = rd("part1.md"), rd("part2_intro.md"), rd("creatures.md"), rd("part3.md"), rd("top3.md")

p1 = p1.replace("(Cardinal `#FF4B4B`, Bee `#FFC800`, Fox `#FF9600` confirmed on the official page; Feather Green `#58CC02`, Macaw `#1CB0F6`, Beetle `#CE82FF` from mirrors, unverified)",
                "(Cardinal `#FF4B4B`, Bee `#FFC800`, Fox `#FF9600` from the search-indexed text of the official page, which redirected to the blog when I opened it; Feather Green `#58CC02`, Macaw `#1CB0F6`, Beetle `#CE82FF` from mirrors, unverified)")
p3 = p3.replace("Designers include Bonnie Shaver-Troup and Thomas Jockin (the Lexend readability team) and Nadine Chahine.",
                "Designers include Bonnie Shaver-Troup, Thomas Jockin and Nadine Chahine (Shaver-Troup and Jockin made Lexend, a readability-focused font: general knowledge).")
p3 = p3.replace("https://design.duolingo.com/identity/color (Cardinal, Bee, Fox seen in the search snippet;",
                "https://design.duolingo.com/identity/color (Cardinal, Bee, Fox seen in the search-indexed text; the page redirected to the blog when opened;")

moods = {
    "Peacock": "**Mood:** regal, jewel-toned, calm luxury. Low-chroma green-grey is 56 % of the crop; blue and cyan are small, precious accents. **Best use:** dark-first theme, where jewel accents glow on green-black. Magenta and violet are not in the photo.",
    "Mandarinfish": "**Mood:** electric, psychedelic, a high-energy maze. Its blue is rare: S. splendidus is \"one of only two vertebrate species known to have blue colouring because of cellular pigment\" ([Wikipedia](https://en.wikipedia.org/wiki/Synchiropus_splendidus)). The pink sample comes from the soft coral behind the fish in the same photo. **Best use:** bold editorial look with an ink-blue brand.",
    "Panther chameleon": "**Mood:** earthy-tropical. Olive, lime, ochre and rust (Ambilobe male) plus mint-green (Nosy Be male). Few blues or violets. **Best use:** a warm accent family or a warm data-viz ramp; not a full 8-type set.",
    "Rainbow lorikeet": "**Mood:** festive and warm-saturated: orange breast, yellow-green body, violet-blue head. The photo is in shade, so the samples are dimmer than memory suggests. **Best use:** playful accents. A full set would need chroma raised.",
    "Nudibranch": "**Mood:** graphic, poster-like. One electric blue, a yellow-orange rim and black/white stripes (the white and black fall into the neutrals). **Best use:** a two-accent brand (blue + gold) on a neutral UI. Too few hues for 8 types.",
    "Hummingbirds": "**Mood:** quiet sage and grey with a single jewel flash: the Anna's magenta gorget `#D1478E` and the sabrewing's violet-blue. **Best use:** the \"one vivid accent on calm neutrals\" model. Good for a brand colour, not a category set.",
    "Morpho": "**Mood:** serene, monochrome azure to navy with brown borders (structural colour from wing scales). **Best use:** a primary ramp or the sequential heatmap scale. 8 of 11 slots are extended.",
    "Parrotfish": "**Mood:** fresh, cool aquatic turquoise and teal on sand. **Best use:** a cool family for handoff, doc and info, plus neutrals. Warm slots are extended, and decision and release collapse into similar muted olives (ΔE 0.035), so avoid it as-is.",
    "Rainbow eucalyptus": "**Mood:** painterly and soft: lime-green, coral-salmon, maroon, warm grey. **Best use:** warm soft tints and the neutral \"change\" family. 7 slots are extended.",
    "Coral reef": "**Mood:** the whole spectrum against sand and deep water: reef blue, sky, lagoon teal, coral pink, crimson, ochre, algae, deep violet. **Best use:** the only photo set covering all 11 slots; light-first with sand neutrals. The Red Sea photo ties to Goteav's markets (Egypt, Gulf).",
    "Gouldian finch": "**Mood:** flat colour blocks: red face, purple chest, yellow belly, green back. The turquoise collar fell outside the crop. **Best use:** a bold editorial alternative to the mandarinfish; the blocks read well as large tiles.",
}
out = []
for block in re.split(r"(?=^### )", cr, flags=re.M):
    if not block.strip():
        continue
    head, rest = block.split("\n", 1)
    key = next(k for k in moods if head[4:].startswith(k))
    out.append(head.replace("### ", f"### 2.{len(out) + 1} ") + "\n\n" + moods[key] + "\n" + rest)
doc = p1 + p2 + "\n".join(out) + p3.replace("{{TOP3}}", top.replace("#### ", "### "))
open(sys.argv[1], "w", encoding="utf-8").write(doc)
print(len(doc), doc.count("\n"))
