<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// Staza do foldera fontova iz sustav_varijable (id = 119), relativna na app root.
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
$mysqli->close();

// Sigurnosno: ukloni vodeće kose crte i ".." (bez izlaska iz app foldera).
$rel = str_replace('\\', '/', $rel);
$rel = preg_replace('#\.\.+#', '', $rel);
$rel = ltrim($rel, '/');

$appRoot = dirname(__DIR__);              // .../vnlh-web  (php/ je unutar app roota)
$dir = $appRoot . '/' . $rel;

// ---------------------------------------------------------------------------
// cmap parser (bez ovisnosti): ciljana provjera je li kodna točka pokrivena.
// ---------------------------------------------------------------------------
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

/** Pisma koja font pokriva (sve reprezentativne kodne točke pisma moraju postojati). */
function pdf_pisma_fonta($path)
{
    // Pismo se prijavljuje ako su SVE njegove reprezentativne kodne točke prisutne.
    // Dodavanje novog pisma: dopiši red 'ime' => [U+...] (jedno jasno mjesto).
    static $SKRIPTE = [
        // Europska
        'latin'      => [0x0041, 0x007A, 0x00E9, 0x010D, 0x017E, 0x0142, 0x0151, 0x0101], // puna europska latinica
        'greek'      => [0x03B1, 0x03C9, 0x0391, 0x03A9],
        'cyrillic'   => [0x0430, 0x044F, 0x0410, 0x042F],
        // Kavkaz / Bliski istok
        'armenian'   => [0x0531, 0x0561],
        'georgian'   => [0x10D0, 0x10D1],
        'hebrew'     => [0x05D0, 0x05D1],
        'arabic'     => [0x0627, 0x0628],
        'thaana'     => [0x0780, 0x0781],
        // Južna Azija
        'devanagari' => [0x0905, 0x0915],
        'bengali'    => [0x0985, 0x0995],
        'gurmukhi'   => [0x0A05, 0x0A15],
        'gujarati'   => [0x0A85, 0x0A95],
        'tamil'      => [0x0B85, 0x0B95],
        'telugu'     => [0x0C05, 0x0C15],
        'kannada'    => [0x0C85, 0x0C95],
        'malayalam'  => [0x0D05, 0x0D15],
        'sinhala'    => [0x0D85, 0x0D9A],
        // Jugoistočna Azija
        'thai'       => [0x0E01, 0x0E02],
        'lao'        => [0x0E81, 0x0E82],
        'khmer'      => [0x1780, 0x1781],
        'myanmar'    => [0x1000, 0x1001],
        // Istočna Azija
        'han'        => [0x4E00, 0x4E2D],   // CJK ideogrami
        'hiragana'   => [0x3042, 0x304B],
        'katakana'   => [0x30A2, 0x30AB],
        'hangul'     => [0xAC00, 0xD55C],
        // Ostalo
        'tibetan'    => [0x0F40, 0x0F41],
        'ethiopic'   => [0x1200, 0x1208],
    ];
    $data = @file_get_contents($path);
    if ($data === false) return [];
    $subs = pdf_cmap_subtables($data);
    if ($subs === null) return [];
    $out = [];
    foreach ($SKRIPTE as $ime => $cps) {
        $ok = true;
        foreach ($cps as $cp) {
            $nadjen = false;
            foreach ($subs as $so) {
                if (pdf_cp_in_subtable($data, $so, $cp)) { $nadjen = true; break; }
            }
            if (!$nadjen) { $ok = false; break; }
        }
        if ($ok) $out[] = $ime;
    }
    return $out;
}

/**
 * Jezici koje font podržava, grupirani po pismu (Latin/Cyrillic/Greek).
 * Jezik se prijavljuje ako su SVI njegovi karakteristični znakovi prisutni.
 * Vraća npr. ['Latin' => ['hrvatski','njemački',...], 'Cyrillic' => ['srpski',...]].
 * Dodavanje jezika: dopiši red 'ime' => [U+...] u odgovarajuću grupu.
 */
function pdf_jezici_fonta($path)
{
    static $JEZICI = [
        'Latin' => [
            'engleski'      => [0x0041, 0x007A],
            'hrvatski'      => [0x010D, 0x0107, 0x0111, 0x0161, 0x017E],
            'srpski (lat.)' => [0x010D, 0x0107, 0x0111, 0x0161, 0x017E],
            'bosanski'      => [0x010D, 0x0107, 0x0111, 0x0161, 0x017E],
            'slovenski'     => [0x010D, 0x0161, 0x017E],
            'njemački'      => [0x00E4, 0x00F6, 0x00FC, 0x00DF],
            'talijanski'    => [0x00E0, 0x00E8, 0x00E9, 0x00EC, 0x00F2, 0x00F9],
            'francuski'     => [0x00E0, 0x00E2, 0x00E7, 0x00E8, 0x00E9, 0x00EA, 0x00EB, 0x00EE, 0x00EF, 0x00F4, 0x00F9, 0x00FB, 0x0153],
            'španjolski'    => [0x00E1, 0x00E9, 0x00ED, 0x00F3, 0x00FA, 0x00F1, 0x00FC, 0x00A1, 0x00BF],
            'portugalski'   => [0x00E1, 0x00E2, 0x00E3, 0x00E7, 0x00E9, 0x00EA, 0x00ED, 0x00F3, 0x00F4, 0x00F5, 0x00FA],
            'katalonski'    => [0x00E0, 0x00E7, 0x00E8, 0x00E9, 0x00ED, 0x00EF, 0x00F2, 0x00F3, 0x00FA, 0x00FC],
            'nizozemski'    => [0x00E9, 0x00EB, 0x00EF],
            'poljski'       => [0x0105, 0x0107, 0x0119, 0x0142, 0x0144, 0x00F3, 0x015B, 0x017A, 0x017C],
            'češki'         => [0x00E1, 0x010D, 0x010F, 0x00E9, 0x011B, 0x00ED, 0x0148, 0x00F3, 0x0159, 0x0161, 0x0165, 0x00FA, 0x016F, 0x00FD, 0x017E],
            'slovački'      => [0x00E1, 0x00E4, 0x010D, 0x010F, 0x00E9, 0x00ED, 0x013A, 0x013E, 0x0148, 0x00F4, 0x0155, 0x0161, 0x0165, 0x00FA, 0x00FD, 0x017E],
            'mađarski'      => [0x00E1, 0x00E9, 0x00ED, 0x00F3, 0x00F6, 0x0151, 0x00FA, 0x00FC, 0x0171],
            'rumunjski'     => [0x0103, 0x00E2, 0x00EE, 0x0219, 0x021B],
            'danski'        => [0x00E6, 0x00F8, 0x00E5],
            'norveški'      => [0x00E6, 0x00F8, 0x00E5],
            'švedski'       => [0x00E5, 0x00E4, 0x00F6],
            'finski'        => [0x00E4, 0x00F6],
            'islandski'     => [0x00E1, 0x00E9, 0x00ED, 0x00F3, 0x00FA, 0x00FD, 0x00FE, 0x00F0, 0x00E6, 0x00F6],
            'estonski'      => [0x00E4, 0x00F6, 0x00F5, 0x00FC, 0x0161, 0x017E],
            'latvijski'     => [0x0101, 0x010D, 0x0113, 0x0123, 0x012B, 0x0137, 0x013C, 0x0146, 0x0161, 0x016B, 0x017E],
            'litavski'      => [0x0105, 0x010D, 0x0117, 0x0119, 0x012F, 0x0161, 0x016B, 0x0173, 0x017E],
            'turski'        => [0x00E7, 0x011F, 0x0131, 0x0130, 0x00F6, 0x015F, 0x00FC],
            'albanski'      => [0x00E7, 0x00EB],
            'velški'        => [0x00E2, 0x00EA, 0x00EE, 0x00F4, 0x00FB, 0x0175, 0x0177],
            'irski'         => [0x00E1, 0x00E9, 0x00ED, 0x00F3, 0x00FA],
            'malteški'      => [0x010B, 0x0121, 0x0127, 0x017C],
            'luksemburški'  => [0x00E4, 0x00EB, 0x00E9],
        ],
        'Cyrillic' => [
            'ruski'         => [0x0410, 0x044F, 0x0401, 0x0451],
            'srpski (ćir.)' => [0x0452, 0x0458, 0x0459, 0x045A, 0x045B, 0x045F],
            'makedonski'    => [0x0453, 0x0455, 0x0458, 0x0459, 0x045A, 0x045C, 0x045F],
            'bugarski'      => [0x0430, 0x044F, 0x044A],
            'ukrajinski'    => [0x0454, 0x0456, 0x0457, 0x0491],
            'bjeloruski'    => [0x045E, 0x0456],
        ],
        'Greek' => [
            'grčki'         => [0x03B1, 0x03C9, 0x0391, 0x03A9],
        ],
    ];

    $data = @file_get_contents($path);
    if ($data === false) return [];
    $subs = pdf_cmap_subtables($data);
    if ($subs === null) return [];

    // Sve distinktne kodne točke -> provjeri svaku jednom (cache).
    $cov = [];
    foreach ($JEZICI as $grupa => $jezici) {
        foreach ($jezici as $ime => $cps) {
            foreach ($cps as $cp) {
                if (!isset($cov[$cp])) {
                    $found = false;
                    foreach ($subs as $so) {
                        if (pdf_cp_in_subtable($data, $so, $cp)) { $found = true; break; }
                    }
                    $cov[$cp] = $found;
                }
            }
        }
    }

    $out = [];
    foreach ($JEZICI as $grupa => $jezici) {
        $lista = [];
        foreach ($jezici as $ime => $cps) {
            $ok = true;
            foreach ($cps as $cp) {
                if (empty($cov[$cp])) { $ok = false; break; }
            }
            if ($ok) $lista[] = $ime;
        }
        if (!empty($lista)) $out[$grupa] = $lista;
    }
    return $out;
}

// ---------------------------------------------------------------------------
// Grupiraj .ttf po porodici (dio prije prve crtice); skupi varijante + rep. datoteku.
// ---------------------------------------------------------------------------
$map = [];      // porodica => [varijante]
$repFile = [];  // porodica => putanja reprezentativne datoteke (Regular ili prva)
if (is_dir($dir)) {
    $files = scandir($dir);
    if ($files !== false) {
        foreach ($files as $f) {
            if ($f === '.' || $f === '..') continue;
            if (!preg_match('/\.ttf$/i', $f)) continue;
            $base = preg_replace('/\.ttf$/i', '', $f);
            $dash = strpos($base, '-');
            if ($dash !== false) {
                $porodica = trim(substr($base, 0, $dash));
                $varijanta = trim(substr($base, $dash + 1));
            } else {
                $porodica = trim($base);
                $varijanta = 'Regular';
            }
            if ($porodica === '') continue;
            if (!isset($map[$porodica])) $map[$porodica] = [];
            if ($varijanta !== '' && !in_array($varijanta, $map[$porodica], true)) {
                $map[$porodica][] = $varijanta;
            }
            // Reprezentativna datoteka: preferiraj Regular, inače prvu zatečenu.
            if (!isset($repFile[$porodica]) || strcasecmp($varijanta, 'Regular') === 0) {
                $repFile[$porodica] = $dir . '/' . $f;
            }
        }
    }
}

ksort($map, SORT_STRING | SORT_FLAG_CASE);
$out = [];
foreach ($map as $porodica => $varijante) {
    sort($varijante, SORT_STRING | SORT_FLAG_CASE);
    $pisma  = isset($repFile[$porodica]) ? pdf_pisma_fonta($repFile[$porodica]) : [];
    $jezici = isset($repFile[$porodica]) ? pdf_jezici_fonta($repFile[$porodica]) : [];
    $out[] = ['porodica' => $porodica, 'varijante' => $varijante, 'pisma' => $pisma, 'jezici' => $jezici];
}
echo json_encode($out, JSON_UNESCAPED_UNICODE);
