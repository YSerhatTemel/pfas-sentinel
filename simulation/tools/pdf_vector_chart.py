"""Extract vector chart geometry and text from one PDF content stream (stdlib only).

Usage: python -I simulation/tools/pdf_vector_chart.py <pdf> <obj_number> <out_json>
Writes: {"texts": [{x, y, s}], "paths": [{color, op, pts}]} in page coordinates.
"""
import json
import re
import sys
import zlib

TOKEN = re.compile(rb"\((?:\\.|[^\\)])*\)|<[0-9A-Fa-f\s]*>|\[|\]|/[^\s/\[\]()<>]+|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?|[A-Za-z'\"*]+|<<|>>")


def mat_mul(a, b):
    return [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
            a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
            a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]]


def apply(m, x, y):
    return (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])


def lit(s):
    s = s[1:-1]
    out = []
    i = 0
    while i < len(s):
        ch = s[i:i + 1]
        if ch == b"\\" and i + 1 < len(s):
            nxt = s[i + 1:i + 2]
            out.append({b"n": "\n", b"(": "(", b")": ")", b"\\": "\\"}.get(nxt, nxt.decode("latin-1")))
            i += 2
            continue
        out.append(ch.decode("latin-1"))
        i += 1
    return "".join(out)


def main(pdf, num, out):
    data = open(pdf, "rb").read()
    m = re.search(rb"\n" + num.encode() + rb" 0 obj(.*?)endobj", data, re.S)
    sm = re.search(rb"stream\r?\n(.*?)\r?\nendstream", m.group(1), re.S)
    raw = zlib.decompress(sm.group(1))
    toks = TOKEN.findall(raw)
    ctm = [1, 0, 0, 1, 0, 0]
    stack = []
    stroke = (0.0, 0.0, 0.0)
    fill = (0.0, 0.0, 0.0)
    operands = []
    cur = []
    subpaths = []
    tm = [1, 0, 0, 1, 0, 0]
    tlm = [1, 0, 0, 1, 0, 0]
    texts = []
    paths = []
    in_array = False
    arr = []
    for t in toks:
        if t == b"[":
            in_array = True
            arr = []
            continue
        if t == b"]":
            in_array = False
            operands.append(arr)
            continue
        if in_array:
            arr.append(t)
            continue
        if re.fullmatch(rb"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", t):
            operands.append(float(t))
            continue
        if t.startswith(b"(") or t.startswith(b"<") or t.startswith(b"/"):
            operands.append(t)
            continue
        op = t
        nums = [o for o in operands if isinstance(o, float)]
        if op == b"q":
            stack.append((list(ctm), stroke, fill))
        elif op == b"Q":
            if stack:
                ctm, stroke, fill = stack.pop()
        elif op == b"cm" and len(nums) >= 6:
            ctm = mat_mul(nums[-6:], ctm)
        elif op == b"RG" and len(nums) >= 3:
            stroke = tuple(nums[-3:])
        elif op == b"G" and nums:
            stroke = (nums[-1],) * 3
        elif op == b"rg" and len(nums) >= 3:
            fill = tuple(nums[-3:])
        elif op == b"g" and nums:
            fill = (nums[-1],) * 3
        elif op == b"m" and len(nums) >= 2:
            if cur:
                subpaths.append(cur)
            cur = [apply(ctm, nums[-2], nums[-1])]
        elif op == b"l" and len(nums) >= 2:
            cur.append(apply(ctm, nums[-2], nums[-1]))
        elif op == b"c" and len(nums) >= 6:
            cur.append(apply(ctm, nums[-2], nums[-1]))
        elif op == b"re" and len(nums) >= 4:
            x, y, w, h = nums[-4:]
            if cur:
                subpaths.append(cur)
            cur = [apply(ctm, x, y), apply(ctm, x + w, y), apply(ctm, x + w, y + h), apply(ctm, x, y + h)]
            subpaths.append(cur)
            cur = []
        elif op in (b"S", b"s", b"f", b"F", b"f*", b"B", b"B*", b"b", b"b*", b"n"):
            if cur:
                subpaths.append(cur)
                cur = []
            if op != b"n":
                color = stroke if op in (b"S", b"s") else fill
                for sp in subpaths:
                    paths.append({"color": [round(c, 3) for c in color], "op": op.decode(), "pts": [[round(p[0], 3), round(p[1], 3)] for p in sp]})
            subpaths = []
        elif op == b"BT":
            tm = [1, 0, 0, 1, 0, 0]
            tlm = [1, 0, 0, 1, 0, 0]
        elif op == b"Tm" and len(nums) >= 6:
            tm = nums[-6:]
            tlm = list(tm)
        elif op in (b"Td", b"TD") and len(nums) >= 2:
            tlm = mat_mul([1, 0, 0, 1, nums[-2], nums[-1]], tlm)
            tm = list(tlm)
        elif op in (b"Tj", b"TJ", b"'", b'"'):
            parts = []
            for o in operands:
                if isinstance(o, list):
                    parts.extend(lit(x) for x in o if x.startswith(b"("))
                elif isinstance(o, bytes) and o.startswith(b"("):
                    parts.append(lit(o))
            s = "".join(parts).strip()
            if s:
                x, y = apply(mat_mul(tm, ctm), 0, 0)
                texts.append({"x": round(x, 2), "y": round(y, 2), "s": s})
        operands = []
    json.dump({"texts": texts, "paths": paths}, open(out, "w"), indent=0)
    print("texts", len(texts), "paths", len(paths))


if __name__ == "__main__":
    main(*sys.argv[1:4])
