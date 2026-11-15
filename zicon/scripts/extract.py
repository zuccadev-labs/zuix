"""Extrae los iconos de Dazicon.fig a zicon/icons.json y zicon/svg/.

Uso:  python3 scripts/extract.py <ruta a Dazicon.fig>          (desde zicon/)
      python3 scripts/extract.py <ruta> --raw <dir>            vuelca además SVG con el nombre original (para revisar renombrados)
      DAZICON_FIG=<ruta> python3 scripts/extract.py            la ruta también puede venir de la variable de entorno
El archivo .fig no está en el repositorio y no tiene ruta por defecto.
Requiere: python3 y el binario `zstd`. No necesita Figma.
Lee scripts/rename.json (nombre original → nombre final, y categorías) y falla si un icono no queda emparejado
en outline y solid.
"""
import sys, os, json, struct, zipfile, collections, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import figdecode as fd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SETS = {'DAZICON / OUTLINE': 'outline', 'DAZICON / SOLID': 'solid'}

def load(fig):
    with zipfile.ZipFile(fig) as z: buf = z.read('canvas.fig')
    cs = fd.chunks(buf); defs = fd.read_schema(fd.inflate(cs[0]))
    root = next(i for i, d in enumerate(defs) if d[0] == 'Message')
    return fd.decode(defs, fd.R(fd.inflate(cs[1])), root)

def num(v):
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s

def mul(a, b):  # a ∘ b, matrices (m00, m01, m02, m10, m11, m12)
    return (a[0]*b[0] + a[1]*b[3], a[0]*b[1] + a[1]*b[4], a[0]*b[2] + a[1]*b[5] + a[2],
            a[3]*b[0] + a[4]*b[3], a[3]*b[1] + a[4]*b[4], a[3]*b[2] + a[4]*b[5] + a[5])

def path(blob, m):
    b = blob['bytes']; i = 0; out = []
    def pt():
        nonlocal i
        x, y = struct.unpack_from('<ff', b, i); i += 8
        return f'{num(m[0]*x + m[1]*y + m[2])} {num(m[3]*x + m[4]*y + m[5])}'
    while i < len(b):
        c = b[i]; i += 1
        if c == 0: out.append('Z')
        elif c == 1: out.append('M' + pt())
        elif c == 2: out.append('L' + pt())
        elif c == 3: out.append('Q' + pt() + ' ' + pt())
        elif c == 4: out.append('C' + pt() + ' ' + pt() + ' ' + pt())
        else: raise ValueError(f'comando de trazado desconocido: {c}')
    return ''.join(out)

def main():
    args = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith('--') and sys.argv[i - 1] != '--raw']
    fig = args[0] if args else os.environ.get('DAZICON_FIG')
    if not fig: sys.exit('Falta la ruta a Dazicon.fig: pásala como argumento o en la variable de entorno DAZICON_FIG.')
    if not os.path.isfile(fig): sys.exit(f'No existe el archivo: {fig}')
    raw_dir = sys.argv[sys.argv.index('--raw') + 1] if '--raw' in sys.argv else None
    msg = load(fig); nodes = msg['nodeChanges']; blobs = msg['blobs']
    gid = lambda g: (g['sessionID'], g['localID'])
    kids = collections.defaultdict(list)
    for n in nodes:
        p = n.get('parentIndex')
        if p: kids[gid(p['guid'])].append(n)
    for k in kids: kids[k].sort(key=lambda n: n['parentIndex']['position'])
    ch = lambda n: kids.get(gid(n['guid']), [])
    size = lambda n: (n['size']['x'], n['size']['y']) if n.get('size') else None
    shown = lambda paints: any(p.get('visible', True) and p.get('opacity', 1) > 0 for p in paints or [])

    def leaves(n):
        out = []
        for c in ch(n):
            s = size(c)
            if c.get('type') in ('FRAME', 'SYMBOL', 'INSTANCE') and s and max(s) <= 64: out.append(c)
            elif c.get('type') in ('FRAME', 'SECTION'): out += leaves(c)
        return out

    def emit(n, m, acc):
        if n.get('visible') is False: return
        if n.get('type') not in ('FRAME', 'SYMBOL', 'INSTANCE'):
            for key, paints in (('fillGeometry', 'fillPaints'), ('strokeGeometry', 'strokePaints')):
                if not shown(n.get(paints)): continue
                for g in n.get(key) or []:
                    if 'commandsBlob' in g:
                        acc.append(['evenodd' if g.get('windingRule') == 'ODD' else 'nonzero', path(blobs[g['commandsBlob']], m)])
        for c in ch(n):
            t = c.get('transform')
            emit(c, mul(m, (t['m00'], t['m01'], t['m02'], t['m10'], t['m11'], t['m12'])) if t else m, acc)

    rename = json.load(open(os.path.join(HERE, 'rename.json')))
    cats = rename['categories']; names = rename['names']; drop = set(rename.get('drop', []))
    icons = collections.OrderedDict(); problems = []
    for setname, variant in SETS.items():
        root = next(n for n in nodes if n.get('name') == setname)
        for ci, cat in enumerate(ch(root)):
            for ic in leaves(cat):
                raw = ic['name'].split('_Individuales_')[-1].split('_', 1)[1]
                w, h = size(ic)
                acc = []; emit(ic, (1, 0, (24 - w) / 2, 0, 1, (24 - h) / 2), acc)
                merged = []
                for rule, d in acc:  # une trazados consecutivos con la misma regla de relleno
                    if merged and merged[-1][0] == rule: merged[-1][1] += d
                    else: merged.append([rule, d])
                if raw_dir:
                    os.makedirs(os.path.join(raw_dir, variant), exist_ok=True)
                    open(os.path.join(raw_dir, variant, f'{ci:02d}__{raw}.svg'.replace('/', '-')), 'w').write(svg(merged, 96))
                key = f'{variant}:{raw}'
                if key in drop: continue
                name = names.get(key) or names.get(raw) or re.sub(r'[_\s]+', '-', raw.strip().lower())
                if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', name): problems.append(f'nombre no normalizado: {key} → {name}')
                cat_key = cats['byIndex'][ci]
                e = icons.setdefault(name, {'name': name, 'category': cat_key, 'variants': {}})
                if variant in e['variants']: problems.append(f'duplicado: {name} ({variant}) desde "{raw}"')
                if e['category'] != cat_key: problems.append(f'categoría distinta entre variantes: {name} ({e["category"]} / {cat_key})')
                e['variants'][variant] = merged
    for e in icons.values():
        missing = [v for v in ('outline', 'solid') if v not in e['variants']]
        if missing: problems.append(f'{e["name"]}: falta {", ".join(missing)}')
    if problems:
        print('\n'.join('✗ ' + p for p in problems)); print(f'{len(problems)} problemas; corrige scripts/rename.json'); sys.exit(1)
    out = {'source': 'Dazicon.fig', 'box': 24, 'categories': cats['labels'], 'icons': sorted(icons.values(), key=lambda e: e['name'])}
    json.dump(out, open(os.path.join(ROOT, 'icons.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
    for e in out['icons']:
        for v, paths in e['variants'].items():
            os.makedirs(os.path.join(ROOT, 'svg', v), exist_ok=True)
            open(os.path.join(ROOT, 'svg', v, e['name'] + '.svg'), 'w').write(svg(paths, 24))
    print(f'✓ {len(out["icons"])} iconos × 2 variantes → icons.json y svg/')

def svg(paths, px):
    body = ''.join(f'<path d="{d}"/>' if rule == 'nonzero' else f'<path fill-rule="evenodd" clip-rule="evenodd" d="{d}"/>' for rule, d in paths)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="{px}" height="{px}" fill="currentColor">{body}</svg>\n'

if __name__ == '__main__':
    main()
