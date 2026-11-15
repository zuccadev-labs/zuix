"""Decode a fig-kiwi canvas file into JSON-ish python objects (pickle) for inspection."""
import sys, struct, zlib, subprocess, pickle

def chunks(buf):
    assert buf[:8] == b'fig-kiwi', buf[:8]
    off = 12
    out = []
    while off + 4 <= len(buf):
        n = struct.unpack_from('<I', buf, off)[0]; off += 4
        out.append(buf[off:off+n]); off += n
    return out

def inflate(b):
    if b[:4] == b'\x28\xb5\x2f\xfd':
        return subprocess.run(['zstd', '-d', '-c'], input=b, capture_output=True, check=True).stdout
    return zlib.decompress(b, -15)

class R:
    def __init__(s, b): s.b = b; s.i = 0
    def byte(s): v = s.b[s.i]; s.i += 1; return v
    def vu(s):
        v = 0; sh = 0
        while True:
            b = s.byte(); v |= (b & 127) << sh; sh += 7
            if not b & 128 or sh >= 35: break
        return v & 0xFFFFFFFF
    def vi(s):
        v = s.vu(); return -(v >> 1) - 1 if v & 1 else v >> 1
    def vu64(s):
        v = 0; sh = 0
        while True:
            b = s.byte()
            if sh == 56: v |= b << sh; break
            v |= (b & 127) << sh; sh += 7
            if not b & 128: break
        return v
    def vi64(s):
        v = s.vu64(); return -(v >> 1) - 1 if v & 1 else v >> 1
    def f(s):
        first = s.b[s.i]
        if first == 0: s.i += 1; return 0.0
        bits = struct.unpack_from('<I', s.b, s.i)[0]; s.i += 4
        bits = ((bits << 23) | (bits >> 9)) & 0xFFFFFFFF
        return struct.unpack('<f', struct.pack('<I', bits))[0]
    def string(s):
        e = s.b.index(0, s.i); v = s.b[s.i:e].decode('utf8', 'replace'); s.i = e + 1; return v

def read_schema(b):
    r = R(b); defs = []
    for _ in range(r.vu()):
        name = r.string(); kind = r.byte(); fields = []
        for _ in range(r.vu()):
            fn = r.string(); t = r.vi(); arr = bool(r.byte()); val = r.vu()
            fields.append((fn, t, arr, val))
        defs.append((name, kind, fields))
    return defs

PRIM = {-1: 'bool', -2: 'byte', -3: 'int', -4: 'uint', -5: 'float', -6: 'string', -7: 'int64', -8: 'uint64'}

def decode(defs, r, t):
    if t < 0:
        p = PRIM[t]
        if p == 'bool': return bool(r.byte())
        if p == 'byte': return r.byte()
        if p == 'int': return r.vi()
        if p == 'uint': return r.vu()
        if p == 'float': return r.f()
        if p == 'string': return r.string()
        if p == 'int64': return r.vi64()
        return r.vu64()
    name, kind, fields = defs[t]
    if kind == 0:
        v = r.vu()
        for fn, _, _, val in fields:
            if val == v: return fn
        return v
    if kind == 1:
        return {fn: field(defs, r, ft, arr) for fn, ft, arr, _ in fields}
    out = {}
    byval = {val: (fn, ft, arr) for fn, ft, arr, val in fields}
    while True:
        k = r.vu()
        if k == 0: return out
        fn, ft, arr = byval[k]
        out[fn] = field(defs, r, ft, arr)

def field(defs, r, ft, arr):
    if not arr: return decode(defs, r, ft)
    n = r.vu()
    if ft == -2:
        v = bytes(r.b[r.i:r.i+n]); r.i += n; return v
    return [decode(defs, r, ft) for _ in range(n)]

if __name__ == '__main__':
    buf = open(sys.argv[1], 'rb').read()
    cs = chunks(buf)
    defs = read_schema(inflate(cs[0]))
    root = next(i for i, d in enumerate(defs) if d[0] == 'Message')
    msg = decode(defs, R(inflate(cs[1])), root)
    pickle.dump(msg, open(sys.argv[2], 'wb'))
    print('defs', len(defs), 'keys', list(msg.keys()), 'nodes', len(msg.get('nodeChanges', [])), 'blobs', len(msg.get('blobs', [])))
