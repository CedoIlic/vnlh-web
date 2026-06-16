<?php
// php/pdf_cmap_lib.php — dijeljeni TTF cmap parser + lokacija fontova.
// Bez side-efekata (samo funkcije); uključuje se s require_once.
// Koristi: PDF_Generator_resolve.php (auto-fallback simbola), PDF_Fontovi_CRUD_dostupni.php (pisma/jezici).

if (!function_exists('pdf_cmap_subtables')) {
    /** Vraća niz apsolutnih offseta cmap podtablica, ili null. */
    function pdf_cmap_subtables($data)
    {
        if (strlen($data) < 12) return null;
        $num = unpack('n', substr($data, 4, 2))[1];
        $cmap_off = null;
        $off = 12;
        for ($i = 0; $i < $num; $i++) {
            if ($off + 16 > strlen($data)) break;
            $tag = substr($data, $off, 4);
            if ($tag === 'cmap') {
                $cmap_off = unpack('N', substr($data, $off + 8, 4))[1];
            }
            $off += 16;
        }
        if ($cmap_off === null || $cmap_off + 4 > strlen($data)) return null;
        $ntab = unpack('n', substr($data, $cmap_off + 2, 2))[1];
        $subs = [];
        $p = $cmap_off + 4;
        for ($i = 0; $i < $ntab; $i++) {
            if ($p + 8 > strlen($data)) break;
            $offset = unpack('N', substr($data, $p + 4, 4))[1];   // plat(2)+enc(2)+offset(4)
            $subs[] = $cmap_off + $offset;
            $p += 8;
        }
        return $subs;
    }
}

if (!function_exists('pdf_cp_in_subtable')) {
    /** Je li kodna točka $cp pokrivena u jednoj podtablici (format 4 i 12). */
    function pdf_cp_in_subtable($data, $so, $cp)
    {
        if ($so + 2 > strlen($data)) return false;
        $fmt = unpack('n', substr($data, $so, 2))[1];
        if ($fmt == 4) {
            $segX2 = unpack('n', substr($data, $so + 6, 2))[1];
            $segc = intdiv($segX2, 2);
            $endo = $so + 14;
            $starto = $endo + $segX2 + 2;
            $deltao = $starto + $segX2;
            $rangeo = $deltao + $segX2;
            for ($s = 0; $s < $segc; $s++) {
                $end = unpack('n', substr($data, $endo + $s * 2, 2))[1];
                if ($cp > $end) continue;
                $start = unpack('n', substr($data, $starto + $s * 2, 2))[1];
                if ($cp < $start) return false;   // segmenti sortirani; u rupi smo
                $delta = unpack('n', substr($data, $deltao + $s * 2, 2))[1];
                $roff = unpack('n', substr($data, $rangeo + $s * 2, 2))[1];
                if ($roff == 0) {
                    $g = ($cp + $delta) & 0xFFFF;
                } else {
                    $a = $rangeo + $s * 2 + $roff + ($cp - $start) * 2;
                    if ($a + 2 > strlen($data)) return false;
                    $g = unpack('n', substr($data, $a, 2))[1];
                    if ($g != 0) $g = ($g + $delta) & 0xFFFF;
                }
                return $g != 0;
            }
            return false;
        } elseif ($fmt == 12) {
            $ng = unpack('N', substr($data, $so + 12, 4))[1];
            $gp = $so + 16;
            for ($i = 0; $i < $ng; $i++) {
                if ($gp + 12 > strlen($data)) break;
                $sc = unpack('N', substr($data, $gp, 4))[1];
                $ec = unpack('N', substr($data, $gp + 4, 4))[1];
                if ($cp >= $sc && $cp <= $ec) return true;
                $gp += 12;
            }
            return false;
        }
        return false;
    }
}

if (!function_exists('pdf_fontovi_dir')) {
    /** Apsolutna staza foldera fontova (sustav_varijable #119, default 'fontovi/'). */
    function pdf_fontovi_dir($mysqli)
    {
        $rel = 'fontovi/';
        $stmt = $mysqli->prepare('SELECT varijabla FROM sustav_varijable WHERE id = 119 LIMIT 1');
        if ($stmt) {
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res && ($r = $res->fetch_assoc()) && isset($r['varijabla']) && trim($r['varijabla']) !== '') {
                $rel = trim($r['varijabla']);
            }
            $stmt->close();
        }
        $rel = str_replace('\\', '/', $rel);
        $rel = preg_replace('#\.\.+#', '', $rel);   // bez izlaska iz app foldera
        $rel = ltrim($rel, '/');
        return dirname(__DIR__) . '/' . $rel;       // php/ je unutar app roota
    }
}

if (!function_exists('pdf_font_subtables_cache')) {
    /**
     * Učita TTF porodice/varijante i vrati ['data'=>..,'subs'=>..] (keširano po stazi),
     * ili null ako datoteke nema / nema cmap. Za provjeru pokrivenosti glifa (auto-fallback).
     */
    function pdf_font_subtables_cache($dir, $porodica, $varijanta = 'Regular')
    {
        static $cache = [];
        $path = $dir . '/' . $porodica . '-' . $varijanta . '.ttf';
        if (array_key_exists($path, $cache)) return $cache[$path];
        $data = @file_get_contents($path);
        if ($data === false) { $cache[$path] = null; return null; }
        $subs = pdf_cmap_subtables($data);
        if ($subs === null) { $cache[$path] = null; return null; }
        $cache[$path] = ['data' => $data, 'subs' => $subs];
        return $cache[$path];
    }
}

if (!function_exists('pdf_font_pokriva_cp')) {
    /** Pokriva li font (rezultat pdf_font_subtables_cache) kodnu točku $cp? */
    function pdf_font_pokriva_cp($font, $cp)
    {
        if (!$font) return false;
        foreach ($font['subs'] as $so) {
            if (pdf_cp_in_subtable($font['data'], $so, $cp)) return true;
        }
        return false;
    }
}
