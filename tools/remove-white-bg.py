import sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
def cutout(src, dst, maxh=2000, frac=0.002):
    im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(np.float32)
    # distance from background white
    dist = np.sqrt(((255 - a) ** 2).sum(-1))
    near = dist < 28                       # candidate background
    lab, n = nd.label(near)
    H, W = near.shape
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    sizes = nd.sum(near, lab, range(1, n + 1))
    bg = np.zeros_like(near)
    big = frac * H * W                    # enclosed gaps (between arm and body) are large; eye whites are small
    for i, s in enumerate(sizes, 1):
        if i in border or s > big: bg |= lab == i
    # soft edge: alpha ramps from bg (0) to solid (1) across a thin band
    fg = ~bg
    d_out = nd.distance_transform_edt(fg)  # distance inside foreground from bg
    alpha = np.clip(d_out / 2.0, 0, 1)
    edge = (alpha < 1) & fg
    # within the band, use color distance to decide softness
    alpha[edge] = np.minimum(alpha[edge], np.clip((dist[edge] - 10) / 60, 0, 1) * 0.6 + alpha[edge] * 0.4)
    alpha[bg] = 0
    # remove white fringe: unblend against white where partially transparent
    al = alpha[..., None]
    rgb = np.where(al > 0.02, (a - 255 * (1 - al)) / np.maximum(al, 0.02), a)
    rgb = np.clip(rgb, 0, 255)
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    bbox = img.getbbox()
    # keep full canvas (same framing across expressions), only scale down
    if img.height > maxh:
        img = img.resize((round(img.width * maxh / img.height), maxh), Image.LANCZOS)
    img.save(dst, 'WEBP', quality=90, method=6)
    return bbox, n
if __name__ == '__main__':
    print(cutout(sys.argv[1], sys.argv[2], frac=float(sys.argv[3]) if len(sys.argv)>3 else 0.002))
