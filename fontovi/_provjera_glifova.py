#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Provjera pokrivenosti glifova u .ttf fontovima (bez vanjskih ovisnosti).
Pokretanje:  python _provjera_glifova.py
Skenira sve *.ttf u istom folderu i ispisuje pokriva li svaki font:
  - skup simbola (∴, °, crtice, buleti, ček/ballot)
  - uzorak europskih pisama (latinica HR/PL/HU/Balt/RO, grčki, ćirilica)
Dodavanje novog simbola: upiši U+XXXX u SIMBOLI ili PISMA i ponovno pokreni.
"""
import struct, glob, os

# ---- Skupovi za provjeru (U+XXXX, opis ASCII radi Windows konzole) ----
SIMBOLI = [
    (0x2234, 'therefore (3 tocke)'),
    (0x00B0, 'degree (stupanj)'),
    # crtice raznih velicina
    (0x002D, 'hyphen-minus'),
    (0x2010, 'hyphen'),
    (0x2011, 'non-breaking hyphen'),
    (0x2012, 'figure dash'),
    (0x2013, 'en dash'),
    (0x2014, 'em dash'),
    (0x2015, 'horizontal bar'),
    (0x2212, 'minus sign'),
    # buleti
    (0x00B7, 'middle dot'),
    (0x2022, 'bullet'),
    (0x2023, 'triangular bullet'),
    (0x2043, 'hyphen bullet'),
    (0x2219, 'bullet operator'),
    (0x25AA, 'black small square'),
    (0x25CB, 'white circle'),
    (0x25CF, 'black circle'),
    (0x25E6, 'white bullet'),
    # cek / ballot
    (0x2713, 'check mark'),
    (0x2714, 'heavy check mark'),
    (0x2717, 'ballot X'),
    (0x2718, 'heavy ballot X'),
    (0x2610, 'ballot box'),
    (0x2611, 'ballot box w/ check'),
    (0x2612, 'ballot box w/ X'),
]

PISMA = {
    'Latinica HR':   [0x010D, 0x0107, 0x017E, 0x0161, 0x0111, 0x010C, 0x0110],          # c c z s d C D
    'Latinica PL':   [0x0142, 0x0105, 0x0119, 0x017C, 0x017A, 0x0144, 0x015B],          # l a e z z n s
    'Latinica HU':   [0x0151, 0x0171],                                                  # o u (dvostruki akut)
    'Latinica Balt': [0x0101, 0x0113, 0x0123, 0x012B, 0x0137, 0x013C, 0x0146, 0x016B],  # a e g i k l n u
    'Latinica RO':   [0x0219, 0x021B, 0x0103, 0x00E2, 0x00EE],                          # s t a a i
    'Grcki':         [0x03B1, 0x03B2, 0x03B3, 0x0394, 0x03A9],                          # a b g D O
    'Cirilica':      [0x0430, 0x0431, 0x0432, 0x044F, 0x042F, 0x0436, 0x0452, 0x0459],  # a b v ya Ya zh dje lje
}


def read_table_dir(data):
    num = struct.unpack('>H', data[4:6])[0]
    tables = {}; off = 12
    for i in range(num):
        tag = data[off:off+4]
        offset, length = struct.unpack('>II', data[off+8:off+16])
        tables[tag] = (offset, length); off += 16
    return tables


def parse_cmap(data, cmap_off):
    ntab = struct.unpack('>H', data[cmap_off+2:cmap_off+4])[0]
    subs = []; p = cmap_off + 4
    for i in range(ntab):
        plat, enc, off = struct.unpack('>HHI', data[p:p+8])
        subs.append(cmap_off+off); p += 8
    cps = set()
    for so in subs:
        fmt = struct.unpack('>H', data[so:so+2])[0]
        if fmt == 4:
            segX2 = struct.unpack('>H', data[so+6:so+8])[0]; segc = segX2//2
            endo = so+14; starto = endo + segX2 + 2
            deltao = starto + segX2; rangeo = deltao + segX2
            for s in range(segc):
                end = struct.unpack('>H', data[endo+s*2:endo+s*2+2])[0]
                start = struct.unpack('>H', data[starto+s*2:starto+s*2+2])[0]
                delta = struct.unpack('>H', data[deltao+s*2:deltao+s*2+2])[0]
                roff = struct.unpack('>H', data[rangeo+s*2:rangeo+s*2+2])[0]
                if start == 0xFFFF: continue
                for c in range(start, end+1):
                    if roff == 0:
                        g = (c + delta) & 0xFFFF
                    else:
                        a = rangeo + s*2 + roff + (c-start)*2
                        if a+2 > len(data): continue
                        g = struct.unpack('>H', data[a:a+2])[0]
                        if g != 0: g = (g + delta) & 0xFFFF
                    if g != 0: cps.add(c)
        elif fmt == 12:
            ng = struct.unpack('>I', data[so+12:so+16])[0]; gp = so+16
            for gI in range(ng):
                sc, ec, sg = struct.unpack('>III', data[gp:gp+12]); gp += 12
                for c in range(sc, ec+1): cps.add(c)
    return cps


def coverage(path):
    with open(path, 'rb') as f: data = f.read()
    tabs = read_table_dir(data)
    co = tabs.get(b'cmap', (None, None))[0]
    if co is None: return None
    return parse_cmap(data, co)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    files = sorted(glob.glob(os.path.join(here, '*.ttf')))
    if not files:
        print('Nema .ttf datoteka u folderu.'); return
    for path in files:
        name = os.path.basename(path)
        cps = coverage(path)
        if cps is None:
            print(f'{name}: NEMA cmap tablice'); continue
        print('=' * 70)
        print(name)
        # Simboli
        nedostaju_sim = [f'U+{cp:04X} {op}' for cp, op in SIMBOLI if cp not in cps]
        if not nedostaju_sim:
            print('  Simboli: SVI prisutni')
        else:
            print('  Simboli NEDOSTAJU:')
            for s in nedostaju_sim: print('    - ' + s)
        # Pisma
        for grupa, lst in PISMA.items():
            miss = [f'U+{cp:04X}' for cp in lst if cp not in cps]
            status = 'OK' if not miss else 'NEDOSTAJE: ' + ', '.join(miss)
            print(f'  {grupa:14s}: {status}')
    print('=' * 70)


if __name__ == '__main__':
    main()
