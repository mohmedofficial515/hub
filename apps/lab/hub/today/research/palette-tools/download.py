import json, os, sys, time, re, urllib.request, urllib.parse

UA = "GoteavDesignResearch/1.0 (palette research)"
BASE = os.path.dirname(os.path.abspath(sys.argv[0]))
DL = os.path.join(os.path.dirname(BASE), "dl")

files = {
    "peacock": "File:Peacock male (Pavo cristatus).jpg",
    "peacock_tail": "File:Peacock's tail (4525489101).jpg",
    "mandarinfish": "File:Synchiropus splendidus 2 Luc Viatour.jpg",
    "chameleon": "File:Panther chameleon (Furcifer pardalis) male Nosy Be.jpg",
    "lorikeet": "File:Rainbow lorikeet (Trichoglossus moluccanus moluccanus) Sydney.jpg",
    "nudibranch": "File:Babosa de mar (Chromodoris annae), Anilao, Filipinas, 2023-08-22, DD 53.jpg",
    "hummingbird": "File:Anna's hummingbird (Calypte anna) male in flight Campbell River.jpg",
    "sabrewing": "File:Violet sabrewing (Campylopterus hemileucurus mellitus) male in flight.jpg",
    "morpho": "File:Morpho menelaus huebneri MHNT Male Dos.jpg",
    "parrotfish": "File:Queen parrotfish Scarus vetula terminal phase (3471718081).jpg",
    "eucalyptus": "File:Starr-130214-1575-Eucalyptus deglupta-bark-Waihee-Maui (25112573891).jpg",
    "coralreef": "File:كنز الحيد المرجاني . بالبحر الأحمر.jpg",
    "coralreef_pd": "File:Colorful underwater landscape of a coral reef.jpg",
    "chameleon_ambilobe": "File:Ambilobe panther chameleon.jpg",
    "gouldian": "File:Erythrura gouldiae -Artis Zoo -Netherlands -male-8a.jpg",
}
which = sys.argv[1:] or list(files)
meta_path = os.path.join(BASE, "meta.json")
meta = json.load(open(meta_path, encoding="utf-8")) if os.path.exists(meta_path) else {}
for k in which:
    if k in meta and os.path.exists(meta[k]["local"]):
        continue
    t = files[k]
    url = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo"
           "&iiprop=url|extmetadata&iiurlwidth=1000&titles=" + urllib.parse.quote(t))
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        d = json.loads(urllib.request.urlopen(req, timeout=40).read().decode("utf-8"))
        p = list(d["query"]["pages"].values())[0]
        ii = p["imageinfo"][0]
        md = ii.get("extmetadata", {})
        d_dir = os.path.join(DL, k)
        os.makedirs(d_dir, exist_ok=True)
        local = os.path.join(d_dir, "img.jpg")
        req = urllib.request.Request(ii["thumburl"], headers={"User-Agent": UA})
        with open(local, "wb") as f:
            f.write(urllib.request.urlopen(req, timeout=60).read())
        meta[k] = {"title": t, "page": ii["descriptionurl"], "thumb": ii["thumburl"],
                   "license": md.get("LicenseShortName", {}).get("value", "?"),
                   "artist": re.sub("<[^>]+>", "", md.get("Artist", {}).get("value", "?")).strip()[:80],
                   "local": local}
        print(k, "ok", meta[k]["license"], meta[k]["artist"])
    except Exception as e:
        print(k, "ERR", e)
    json.dump(meta, open(meta_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    time.sleep(2.5)
