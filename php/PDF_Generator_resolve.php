<?php
require_once __DIR__ . '/require_login_api.php';
require_once __DIR__ . '/pdf_cmap_lib.php';
// PDF generator — razrješava kompoziciju (template + stavke + kontekst) u "render model" za pdfmake.
// Ulaz: POST JSON { template_id, stavke:[...], kontekst:{} }  (ili ?test=logo za brzu provjeru).
// Slika: BLOB -> data URL (MIME iz magic-bytes). Tekst: odlomci (\n) + auto-fallback runovi (DejaVuSans, var #120).
// Dohvat izvora je VEZAN NA WHITELIST (pdf_dozvoljeni_izvori): SQL identifikatori validirani, vrijednosti bound.

$db_ret = require_once __DIR__ . '/00_db.php';
header('Content-Type: application/json; charset=utf-8');
if ($db_ret !== -1) {
    http_response_code(500);
    echo json_encode(['greska' => 'Baza nedostupna.']);
    exit;
}

function pdf_err($poruka, $code = 400)
{
    http_response_code($code);
    echo json_encode(['greska' => $poruka], JSON_UNESCAPED_UNICODE);
    exit;
}
function pdf_ident_ok($s) { return is_string($s) && preg_match('/^[A-Za-z0-9_]+$/', $s) === 1; }

function pdf_kolona_postoji($mysqli, $tablica, $kolona)
{
    $stmt = $mysqli->prepare('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1');
    if (!$stmt) return false;
    $stmt->bind_param('ss', $tablica, $kolona);
    $stmt->execute();
    $res = $stmt->get_result();
    $ok = $res && $res->fetch_row();
    $stmt->close();
    return (bool) $ok;
}

/** MIME slike iz magic-bytes (PNG/JPEG/GIF/WebP) ili null. */
function pdf_magic_mime($d)
{
    $n = strlen($d);
    if ($n >= 8 && substr($d, 0, 8) === "\x89PNG\r\n\x1a\n") return 'image/png';
    if ($n >= 3 && substr($d, 0, 3) === "\xFF\xD8\xFF") return 'image/jpeg';
    if ($n >= 6 && (substr($d, 0, 6) === 'GIF87a' || substr($d, 0, 6) === 'GIF89a')) return 'image/gif';
    if ($n >= 12 && substr($d, 0, 4) === 'RIFF' && substr($d, 8, 4) === 'WEBP') return 'image/webp';
    return null;
}

/** Dohvati vrijednost {kolona} iz {tablica} prema načinu (staticki/dinamicki/po_vrijednosti). */
function pdf_dohvati_vrijednost($mysqli, $tablica, $kolona, $st, $kontekst)
{
    $tip = isset($st['izvor_tip']) ? $st['izvor_tip'] : '';
    if ($tip === 'staticki') {
        $idv = isset($st['izvor_red_id']) ? (int) $st['izvor_red_id'] : 0;
        if ($idv <= 0) return null;
        $sql = "SELECT `$kolona` AS v FROM `$tablica` WHERE id = ? LIMIT 1";
        $stmt = $mysqli->prepare($sql); if (!$stmt) return null;
        $stmt->bind_param('i', $idv);
    } elseif ($tip === 'dinamicki') {
        $kljuc = isset($st['kontekst_kljuc']) ? (string) $st['kontekst_kljuc'] : '';
        $idv = ($kljuc !== '' && isset($kontekst[$kljuc])) ? (int) $kontekst[$kljuc] : 0;
        if ($idv <= 0 && !empty($st['test_id'])) $idv = (int) $st['test_id'];   // pregled: testni id kad nema konteksta
        if ($idv <= 0) return null;
        $sql = "SELECT `$kolona` AS v FROM `$tablica` WHERE id = ? LIMIT 1";
        $stmt = $mysqli->prepare($sql); if (!$stmt) return null;
        $stmt->bind_param('i', $idv);
    } elseif ($tip === 'po_vrijednosti') {
        $tk = isset($st['trazi_kolona']) ? (string) $st['trazi_kolona'] : '';
        $tv = isset($st['trazi_vrijednost']) ? (string) $st['trazi_vrijednost'] : '';
        if (!pdf_ident_ok($tk) || !pdf_kolona_postoji($mysqli, $tablica, $tk)) return null;
        $sql = "SELECT `$kolona` AS v FROM `$tablica` WHERE `$tk` = ? ORDER BY id LIMIT 1";
        $stmt = $mysqli->prepare($sql); if (!$stmt) return null;
        $stmt->bind_param('s', $tv);
    } else {
        return null;
    }
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return $row ? $row['v'] : null;
}

/** Tekst -> niz odlomaka (\n); svaki odlomak = niz pdfmake runova s auto-fallbackom. */
function pdf_tekst_u_odlomke($tekst, $fontGlavni, $fontFallback, $kljucFallback)
{
    $tekst = str_replace("\r\n", "\n", (string) $tekst);
    $odlomci = explode("\n", $tekst);
    $out = [];
    foreach ($odlomci as $od) {
        $runovi = [];
        $buf = '';
        $bufFont = null;   // null = glavni font (naslijeđen); inače kljuc fallback fonta
        $len = mb_strlen($od, 'UTF-8');
        for ($i = 0; $i < $len; $i++) {
            $ch = mb_substr($od, $i, 1, 'UTF-8');
            $cp = mb_ord($ch, 'UTF-8');
            if ($cp === false) continue;
            $koji = null;
            if ($fontGlavni === null) {
                $koji = null;                                   // ne znamo pokrivenost glavnog -> sve u glavni
            } elseif (pdf_font_pokriva_cp($fontGlavni, $cp)) {
                $koji = null;
            } elseif ($fontFallback && pdf_font_pokriva_cp($fontFallback, $cp)) {
                $koji = $kljucFallback;
            } else {
                continue;                                       // ni glavni ni fallback -> izostavi (tiho)
            }
            if ($buf !== '' && $koji !== $bufFont) {
                $r = ['text' => $buf];
                if ($bufFont !== null) $r['font'] = $bufFont;
                $runovi[] = $r;
                $buf = '';
            }
            $bufFont = $koji;
            $buf .= $ch;
        }
        if ($buf !== '') {
            $r = ['text' => $buf];
            if ($bufFont !== null) $r['font'] = $bufFont;
            $runovi[] = $r;
        }
        if (empty($runovi)) $runovi = [['text' => '']];
        $out[] = $runovi;
    }
    return $out;
}

/** Kao pdf_tekst_u_odlomke, ali iz niza dijelova [{tekst, color}] — run se lomi i po promjeni boje.
 *  Koristi se kod inline-spajanja kad neki segment treba posebnu boju (npr. sivi placeholder XXXXXXXX). */
function pdf_odlomci_iz_dijelova($dijelovi, $fontGlavni, $fontFallback, $kljucFallback)
{
    $out = [];
    $runovi = [];
    $buf = ''; $bufFont = null; $bufColor = null;
    foreach ($dijelovi as $dio) {
        $tekst = str_replace("\r\n", "\n", (string) ($dio['tekst'] ?? ''));
        $color = isset($dio['color']) ? $dio['color'] : null;
        $len = mb_strlen($tekst, 'UTF-8');
        for ($i = 0; $i < $len; $i++) {
            $ch = mb_substr($tekst, $i, 1, 'UTF-8');
            if ($ch === "\n") {
                if ($buf !== '') { $r = ['text' => $buf]; if ($bufFont !== null) $r['font'] = $bufFont; if ($bufColor !== null) $r['color'] = $bufColor; $runovi[] = $r; $buf = ''; }
                if (empty($runovi)) $runovi = [['text' => '']];
                $out[] = $runovi; $runovi = []; $bufFont = null; $bufColor = null;
                continue;
            }
            $cp = mb_ord($ch, 'UTF-8');
            if ($cp === false) continue;
            $koji = null;
            if ($fontGlavni === null) { $koji = null; }
            elseif (pdf_font_pokriva_cp($fontGlavni, $cp)) { $koji = null; }
            elseif ($fontFallback && pdf_font_pokriva_cp($fontFallback, $cp)) { $koji = $kljucFallback; }
            else { continue; }
            if ($buf !== '' && ($koji !== $bufFont || $color !== $bufColor)) {
                $r = ['text' => $buf]; if ($bufFont !== null) $r['font'] = $bufFont; if ($bufColor !== null) $r['color'] = $bufColor; $runovi[] = $r; $buf = '';
            }
            $bufFont = $koji; $bufColor = $color; $buf .= $ch;
        }
    }
    if ($buf !== '') { $r = ['text' => $buf]; if ($bufFont !== null) $r['font'] = $bufFont; if ($bufColor !== null) $r['color'] = $bufColor; $runovi[] = $r; }
    if (!empty($runovi)) $out[] = $runovi;
    if (empty($out)) $out[] = [['text' => '']];
    return $out;
}

// --- Ulaz ---------------------------------------------------------------
$ulaz = null;
if (isset($_GET['test']) && $_GET['test'] === 'logo') {
    $tpl = null;
    $r = $mysqli->query('SELECT id FROM pdf_template ORDER BY id LIMIT 1');
    if ($r && ($row = $r->fetch_assoc())) $tpl = (int) $row['id'];
    $ulaz = [
        'template_id' => $tpl,
        'kontekst' => [],
        'stavke' => [[
            'redoslijed' => 1, 'zona' => 'zaglavlje', 'vrsta' => 'slika',
            'izvor_id' => 3, 'izvor_tip' => 'po_vrijednosti',
            'trazi_kolona' => 'naziv', 'trazi_vrijednost' => 'VNLH Logo',
            'slika_stil_id' => null
        ]]
    ];
} else {
    $raw = file_get_contents('php://input');
    $ulaz = json_decode($raw, true);
    if (!is_array($ulaz)) pdf_err('Neispravan JSON ulaz.');
}

$template_id = isset($ulaz['template_id']) ? (int) $ulaz['template_id'] : 0;
$stavke = isset($ulaz['stavke']) && is_array($ulaz['stavke']) ? $ulaz['stavke'] : [];
$kontekst = isset($ulaz['kontekst']) && is_array($ulaz['kontekst']) ? $ulaz['kontekst'] : [];

// --- Template -----------------------------------------------------------
$template = null;
if ($template_id > 0) {
    $stmt = $mysqli->prepare('SELECT * FROM pdf_template WHERE id = ? LIMIT 1');
    $stmt->bind_param('i', $template_id);
    $stmt->execute();
    $res = $stmt->get_result();
    $template = $res ? $res->fetch_assoc() : null;
    $stmt->close();
}
if (!$template) pdf_err('Template nije pronađen.');

// --- Whitelist (izvor_id -> tablica/kolona/tip) -------------------------
$izvori = [];
$r = $mysqli->query('SELECT id, tablica, kolona, tip_podatka FROM pdf_dozvoljeni_izvori');
if ($r) while ($row = $r->fetch_assoc()) $izvori[(int) $row['id']] = $row;

// --- Fallback font (sustav_varijable #120 -> pdfmake_kljuc) --------------
$fontDir = pdf_fontovi_dir($mysqli);
$kljucFallback = 'DejaVuSans';
$st = $mysqli->prepare('SELECT varijabla FROM sustav_varijable WHERE id = 120 LIMIT 1');
if ($st) { $st->execute(); $rs = $st->get_result(); if ($rs && ($x = $rs->fetch_assoc()) && trim((string) $x['varijabla']) !== '') $kljucFallback = trim($x['varijabla']); $st->close(); }
$porodicaFallback = $kljucFallback;
$st = $mysqli->prepare('SELECT porodica FROM pdf_fontovi WHERE pdfmake_kljuc = ? LIMIT 1');
if ($st) { $st->bind_param('s', $kljucFallback); $st->execute(); $rs = $st->get_result(); if ($rs && ($x = $rs->fetch_assoc()) && trim((string) $x['porodica']) !== '') $porodicaFallback = trim($x['porodica']); $st->close(); }
$fontFallback = pdf_font_subtables_cache($fontDir, $porodicaFallback);

// --- Korišteni stilovi/fontovi ------------------------------------------
$parIds = [];
$slikaIds = [];
foreach ($stavke as $s) {
    if (($s['vrsta'] ?? '') === 'tekst' && !empty($s['paragraf_id'])) $parIds[(int) $s['paragraf_id']] = true;
    if (($s['vrsta'] ?? '') === 'slika' && !empty($s['slika_stil_id'])) $slikaIds[(int) $s['slika_stil_id']] = true;
}
function pdf_ucitaj_stilove($mysqli, $tablica, $ids)
{
    $out = [];
    if (empty($ids)) return $out;
    $idLista = array_map('intval', array_keys($ids));
    $in = implode(',', $idLista);
    $r = $mysqli->query("SELECT * FROM `$tablica` WHERE id IN ($in)");
    if ($r) while ($row = $r->fetch_assoc()) $out[(int) $row['id']] = $row;
    return $out;
}
$parStilovi = pdf_ucitaj_stilove($mysqli, 'pdf_paragraf', $parIds);
$slikaStilovi = pdf_ucitaj_stilove($mysqli, 'pdf_slika_stil', $slikaIds);

// font po paragrafu (font_id -> {kljuc, porodica}); skupi i listu potrebnih fontova
$fontPoId = [];
$fontIds = [];
foreach ($parStilovi as $p) { if (!empty($p['font_id'])) $fontIds[(int) $p['font_id']] = true; }
if (!empty($fontIds)) {
    $in = implode(',', array_map('intval', array_keys($fontIds)));
    $r = $mysqli->query("SELECT id, pdfmake_kljuc, porodica FROM pdf_fontovi WHERE id IN ($in)");
    if ($r) while ($row = $r->fetch_assoc()) $fontPoId[(int) $row['id']] = $row;
}

/** Vrijednost jednog segmenta: korisnicki -> literal_tekst (^=razmak), inače iz whitelist izvora. */
function pdf_segment_vrijednost($mysqli, $s, $izvori, $kontekst)
{
    if (($s['izvor_tip'] ?? '') === 'korisnicki') {
        $lit = (string) ($s['literal_tekst'] ?? '');
        return ['greska' => null, 'vrijednost' => str_replace('^', ' ', $lit)];
    }
    $izvorId = isset($s['izvor_id']) ? (int) $s['izvor_id'] : 0;
    $izvor = isset($izvori[$izvorId]) ? $izvori[$izvorId] : null;
    if (!$izvor || !pdf_ident_ok($izvor['tablica']) || !pdf_ident_ok($izvor['kolona'])) {
        return ['greska' => 'Izvor nije u whitelistu.', 'vrijednost' => null];
    }
    return ['greska' => null, 'vrijednost' => pdf_dohvati_vrijednost($mysqli, $izvor['tablica'], $izvor['kolona'], $s, $kontekst)];
}

// --- Razrješavanje stavki -----------------------------------------------
$out = [];
$trebaFallback = false;
$stavke = array_values($stavke);
$n = count($stavke);
$i = 0;
while ($i < $n) {
    $s = $stavke[$i];
    $vrsta = $s['vrsta'] ?? '';
    $zona = $s['zona'] ?? 'tijelo';

    if ($vrsta === 'tekst') {
        // Lanac inline-spajanja: i..k; svaka (osim zadnje) ima bez_kraja_odlomka=1, sve 'tekst', isti zona.
        $chain = [];
        $k = $i;
        while (true) {
            $chain[] = $k;
            if (empty($stavke[$k]['bez_kraja_odlomka'])) break;                 // kraj odlomka ovdje
            $nx = $k + 1;
            if ($nx >= $n) break;                                               // nema sljedeće
            if (($stavke[$nx]['vrsta'] ?? '') !== 'tekst') break;               // ne-tekst prekida lanac
            if (($stavke[$nx]['zona'] ?? 'tijelo') !== $zona) break;            // promjena zone prekida
            $k = $nx;
        }
        // Stil/font cijele linije = PRVE stavke u lancu.
        $first = $stavke[$chain[0]];
        $parId = !empty($first['paragraf_id']) ? (int) $first['paragraf_id'] : 0;
        $fk = null; $fontGlavni = null;
        if ($parId && isset($parStilovi[$parId]) && !empty($parStilovi[$parId]['font_id'])) {
            $fid = (int) $parStilovi[$parId]['font_id'];
            if (isset($fontPoId[$fid])) {
                $fk = $fontPoId[$fid]['pdfmake_kljuc'];
                $fontGlavni = pdf_font_subtables_cache($fontDir, $fontPoId[$fid]['porodica']);
            }
        }
        // Spoji segmente (preskoči prazne). Dinamički bez vrijednosti (nema test_id/konteksta) → sivi XXXXXXXX.
        $dijelovi = [];
        $combined = '';
        $imaPlaceholder = false;
        $segErr = null;
        foreach ($chain as $ci) {
            $seg = $stavke[$ci];
            $r = pdf_segment_vrijednost($mysqli, $seg, $izvori, $kontekst);
            if ($r['greska'] !== null && $segErr === null) $segErr = $r['greska'];
            $val = $r['vrijednost'];
            if ((($seg['izvor_tip'] ?? '') === 'dinamicki') && ($val === null || $val === '')) {
                $dijelovi[] = ['tekst' => 'XXXXXXXX', 'color' => '#cccccc'];   // placeholder kao siva ploha
                $combined .= 'XXXXXXXX';
                $imaPlaceholder = true;
            } elseif ($val !== null && $val !== '') {
                $dijelovi[] = ['tekst' => (string) $val, 'color' => null];
                $combined .= (string) $val;
            }
        }
        $rec = [
            'redoslijed' => isset($first['redoslijed']) ? (int) $first['redoslijed'] : 0,
            'zona' => $zona,
            'vrsta' => 'tekst',
            'greska' => null,
            'paragraf_id' => $parId ?: null,
            'font_kljuc' => $fk
        ];
        if ($combined === '') {
            $rec['greska'] = (count($chain) === 1 && $segErr !== null) ? $segErr : 'Izvor prazan.';
            $rec['odlomci'] = [];
        } else {
            $rec['odlomci'] = $imaPlaceholder
                ? pdf_odlomci_iz_dijelova($dijelovi, $fontGlavni, $fontFallback, $kljucFallback)
                : pdf_tekst_u_odlomke($combined, $fontGlavni, $fontFallback, $kljucFallback);
            $trebaFallback = true;
        }
        $out[] = $rec;
        $i = $k + 1;
        continue;
    }

    // Slika ili nepoznata vrsta
    $rec = [
        'redoslijed' => isset($s['redoslijed']) ? (int) $s['redoslijed'] : 0,
        'zona' => $zona,
        'vrsta' => $vrsta,
        'greska' => null
    ];
    if ($vrsta === 'slika') {
        $r = pdf_segment_vrijednost($mysqli, $s, $izvori, $kontekst);
        $rec['slika_stil_id'] = !empty($s['slika_stil_id']) ? (int) $s['slika_stil_id'] : null;
        if ($r['greska'] !== null) {
            $rec['greska'] = $r['greska'];
        } else {
            $vrijednost = $r['vrijednost'];
            if ($vrijednost === null || $vrijednost === '') {
                if (($s['izvor_tip'] ?? '') === 'dinamicki') {
                    // Dinamička slika bez konteksta (uređivanje/pregled): placeholder za pozicioniranje/stil.
                    $rec['placeholder'] = true;
                    $rec['kontekst_kljuc'] = isset($s['kontekst_kljuc']) ? (string) $s['kontekst_kljuc'] : '';
                } else {
                    $rec['greska'] = 'Izvor prazan.';
                }
            } else {
                $mime = pdf_magic_mime($vrijednost);
                if ($mime === null) {
                    $rec['greska'] = 'Nepoznat format slike.';
                } else {
                    $rec['dataurl'] = 'data:' . $mime . ';base64,' . base64_encode($vrijednost);
                }
            }
        }
    } else {
        $rec['greska'] = 'Nepoznata vrsta stavke.';
    }
    $out[] = $rec;
    $i++;
}

// --- Potrebni fontovi (za lazy-load na klijentu) ------------------------
$fontoviOut = [];
$videni = [];
foreach ($fontPoId as $f) {
    $k = $f['pdfmake_kljuc'];
    if (!isset($videni[$k])) { $videni[$k] = true; $fontoviOut[] = ['kljuc' => $k, 'porodica' => $f['porodica']]; }
}
// DejaVuSans uvijek (default font za pdfmake — i kad nema teksta; inače Roboto kojeg nema u vfs).
if (!isset($videni[$kljucFallback])) {
    $fontoviOut[] = ['kljuc' => $kljucFallback, 'porodica' => $porodicaFallback];
}

$mysqli->close();

echo json_encode([
    'template' => $template,
    'stavke' => $out,
    'stilovi_paragraf' => $parStilovi,
    'stilovi_slika' => $slikaStilovi,
    'fontovi' => $fontoviOut,
    'default_font' => $kljucFallback
], JSON_UNESCAPED_UNICODE);
