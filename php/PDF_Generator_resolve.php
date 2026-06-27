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

/** Bazni id dinamičke stavke: iz konteksta po ključu, inače testni id (preview). 0 ako nema. */
function pdf_dinamicki_id($st, $kontekst)
{
    $kljuc = isset($st['kontekst_kljuc']) ? (string) $st['kontekst_kljuc'] : '';
    $idv = ($kljuc !== '' && isset($kontekst[$kljuc])) ? (int) $kontekst[$kljuc] : 0;
    if ($idv <= 0 && !empty($st['test_id'])) $idv = (int) $st['test_id'];   // pregled: testni id kad nema konteksta
    return $idv;
}

/** Vrijednost {kolona} iz {tablica} za zadani id (identifikatori moraju biti prethodno provjereni). */
function pdf_vrijednost_po_id($mysqli, $tablica, $kolona, $id)
{
    $id = (int) $id;
    if ($id <= 0) return null;
    $sql = "SELECT `$kolona` AS v FROM `$tablica` WHERE id = ? LIMIT 1";
    $stmt = $mysqli->prepare($sql); if (!$stmt) return null;
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return $row ? $row['v'] : null;
}

/** Vrijedi li uvjetni ključ mape za zadanu vrijednost? Vraća true/false. Ključ NIJE točan ni "*"
 *  (to caller provjerava prije). Podržano: usporedbe ==,=,!=,<>,>=,<=,>,< + broj; raspon "min-max"
 *  (uključivo, nenegativni brojevi); tekstualno ≠ ("!=tekst"/"<>tekst"). Numerički uvjeti vrijede
 *  samo kad je vrijednost broj. */
function pdf_mapa_uvjet_vrijedi($k, $kljuc, $jeBroj, $kljucNum)
{
    if (preg_match('/^(==|=|!=|<>|>=|<=|>|<)\s*(-?\d+(?:\.\d+)?)$/', $k, $m)) {   // operator + broj
        if (!$jeBroj) return false;
        $a = $kljucNum; $b = (float) $m[2];
        switch ($m[1]) {
            case '==': case '=': return $a == $b;
            case '!=': case '<>': return $a != $b;
            case '>':  return $a > $b;
            case '<':  return $a < $b;
            case '>=': return $a >= $b;
            case '<=': return $a <= $b;
        }
        return false;
    }
    if (preg_match('/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/', $k, $m)) {        // raspon min-max (uključivo)
        if (!$jeBroj) return false;
        return $kljucNum >= (float) $m[1] && $kljucNum <= (float) $m[2];
    }
    if (preg_match('/^(!=|<>)(.*)$/', $k, $m)) {                                  // tekstualno "nije jednako"
        return trim($m[2]) !== $kljuc;
    }
    return false;
}

/** Mapiranje vrijednosti po formatu "ključ:tekst;ključ:tekst" (npr. 0:Brat;1:Sestra). Bez poklapanja → original.
    Ključ smije biti: točna vrijednost (broj ili tekst); operator ==,=,!=,<>,>=,<=,>,< + broj; raspon "min-max"
    (uključivo); tekstualno "!=tekst"/"<>tekst"; "*" = default kad ništa drugo ne pogodi.
    Prioritet: TOČAN ključ → PRVI uvjet po redu koji vrijedi → "*".
    U mapiranom tekstu '^' postaje razmak (kao kod korisničkog teksta) — za rubne razmake koje bi trim pojeo. */
function pdf_mapa_primijeni($vrijednost, $mapa)
{
    if ($vrijednost === null) return null;
    $mapa = trim((string) $mapa);
    if ($mapa === '') return $vrijednost;
    $kljuc = trim((string) $vrijednost);
    $jeBroj = is_numeric($kljuc);
    $kljucNum = $jeBroj ? (float) $kljuc : null;
    $default = null;     // tekst "*" ključa (ako postoji)
    $uvjetHit = null;    // tekst prvog uvjeta po redu koji vrijedi
    foreach (preg_split('/[;\r\n]+/', $mapa) as $par) {   // razdjelnik: ; ili novi red (višeredna mapa)
        $par = trim($par);
        if ($par === '') continue;
        $p = explode(':', $par, 2);
        if (count($p) !== 2) continue;
        $k = trim($p[0]);
        $t = str_replace('^', ' ', trim($p[1]));
        if ($k === $kljuc) return $t;                      // točno poklapanje — pobjeđuje odmah
        if ($k === '*') { if ($default === null) $default = $t; continue; }
        if ($uvjetHit === null && pdf_mapa_uvjet_vrijedi($k, $kljuc, $jeBroj, $kljucNum)) $uvjetHit = $t;
    }
    if ($uvjetHit !== null) return $uvjetHit;
    if ($default !== null) return $default;
    return $vrijednost;
}

/** Parsira datum/datetime string → ['Y','M','D','H','i','s'] ili null ako nije datum. */
function pdf_parse_datum($v)
{
    $v = trim((string) $v);
    if ($v === '') return null;
    if (preg_match('/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/', $v, $m)) {
        return ['Y' => (int) $m[1], 'M' => (int) $m[2], 'D' => (int) $m[3], 'H' => isset($m[4]) ? (int) $m[4] : 0, 'i' => isset($m[5]) ? (int) $m[5] : 0, 's' => isset($m[6]) ? (int) $m[6] : 0];
    }
    if (preg_match('/^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?/', $v, $m)) {
        return ['Y' => (int) $m[3], 'M' => (int) $m[2], 'D' => (int) $m[1], 'H' => 0, 'i' => 0, 's' => 0];
    }
    return null;
}

/** Dan u tjednu (Sakamoto, bez ovisnosti o timezone): 0=nedjelja … 6=subota. */
function pdf_dan_u_tjednu($Y, $M, $D)
{
    $t = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
    $y = $Y - ($M < 3 ? 1 : 0);
    return (int) (($y + intdiv($y, 4) - intdiv($y, 100) + intdiv($y, 400) + $t[$M - 1] + $D) % 7);
}

/** Godina istinske svjetlosti (PHP blizanac JS Godina_Istinske_Svjetlosti): Y+4000, mjesec ožujak=1.
 *  Mjesec se ispisuje RIMSKIM brojem bez točke (npr. „1. dan IV mjeseca 6026. godine"). */
function pdf_gis_datum($Y, $M, $D)
{
    $Mnovi = (($M - 3 + 12) % 12) + 1;
    $rim = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    $mjRim = isset($rim[$Mnovi]) ? $rim[$Mnovi] : (string) $Mnovi;
    return $D . '. dan ' . $mjRim . ' mjeseca ' . ($Y + 4000) . '. godine';
}

/** Formatira datumsku vrijednost po uzorku (tokeni) ili keyword "GIS".
    Prazan format ili vrijednost koja nije datum → vrijednost se vraća nepromijenjena.
    Tokeni: dddd dan u tjednu, mmmm mjesec imenom, DD/D dan, MM/M mjesec broj, YYYY/YY godina, HH/mm/ss vrijeme. */
function pdf_formatiraj_datum($vrijednost, $format)
{
    if ($vrijednost === null) return null;
    $format = trim((string) $format);
    if ($format === '') return $vrijednost;
    $d = pdf_parse_datum($vrijednost);
    if ($d === null) return $vrijednost;
    if ($format === 'GIS') return pdf_gis_datum($d['Y'], $d['M'], $d['D']);
    $mjeseci = ['', 'siječanj', 'veljača', 'ožujak', 'travanj', 'svibanj', 'lipanj', 'srpanj', 'kolovoz', 'rujan', 'listopad', 'studeni', 'prosinac'];
    $dani = ['nedjelja', 'ponedjeljak', 'utorak', 'srijeda', 'četvrtak', 'petak', 'subota'];
    $dow = pdf_dan_u_tjednu($d['Y'], $d['M'], $d['D']);
    $z2 = function ($n) { return str_pad((string) $n, 2, '0', STR_PAD_LEFT); };
    return preg_replace_callback('/dddd|mmmm|YYYY|YY|DD|D|MM|M|HH|mm|ss/', function ($mm) use ($d, $mjeseci, $dani, $dow, $z2) {
        switch ($mm[0]) {
            case 'dddd': return $dani[$dow];
            case 'mmmm': return $mjeseci[$d['M']];
            case 'YYYY': return (string) $d['Y'];
            case 'YY': return substr((string) $d['Y'], -2);
            case 'DD': return $z2($d['D']);
            case 'D': return (string) $d['D'];
            case 'MM': return $z2($d['M']);
            case 'M': return (string) $d['M'];
            case 'HH': return $z2($d['H']);
            case 'mm': return $z2($d['i']);
            case 'ss': return $z2($d['s']);
        }
        return $mm[0];
    }, $format);
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
        $idv = pdf_dinamicki_id($st, $kontekst);
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

// Sentinel za "meki" prijelom reda unutar istog odlomka (spajanje stavki, bez_kraja_odlomka=2).
// Pravi "\n" ostaje prijelom odlomka; ovaj znak postaje prijelom reda (run {text:'\n'}) bez zatvaranja bloka.
if (!defined('PDF_MEKI_PRIJELOM')) define('PDF_MEKI_PRIJELOM', "\x01");
// Sentinel za podebljani raspon (toggle): \x02 uključi/isključi bold; runovi u tom rasponu dobiju bold=true.
if (!defined('PDF_BOLD')) define('PDF_BOLD', "\x02");

/** Tekst -> niz odlomaka (\n); svaki odlomak = niz pdfmake runova s auto-fallbackom.
 *  PDF_MEKI_PRIJELOM unutar teksta = prijelom reda u istom odlomku (ne otvara novi odlomak). */
function pdf_tekst_u_odlomke($tekst, $fontGlavni, $fontFallback, $kljucFallback)
{
    $tekst = str_replace("\r\n", "\n", (string) $tekst);
    $tekst = str_replace([':.', '.·.'], '∴', $tekst);   // masonska oznaka: ":." i ".·." (podignuta srednja) → "∴" (U+2234)
    $odlomci = explode("\n", $tekst);
    $out = [];
    foreach ($odlomci as $od) {
        $runovi = [];
        $buf = '';
        $bufFont = null;   // null = glavni font (naslijeđen); inače kljuc fallback fonta
        $bold = false;     // raspon podebljanja (toggle preko PDF_BOLD); resetira se po odlomku
        $emit = function ($buf, $bufFont, $bold) {               // jedan run iz bufera
            $r = ['text' => $buf];
            if ($bufFont !== null) $r['font'] = $bufFont;
            if ($bold) $r['bold'] = true;
            return $r;
        };
        $len = mb_strlen($od, 'UTF-8');
        for ($i = 0; $i < $len; $i++) {
            $ch = mb_substr($od, $i, 1, 'UTF-8');
            if ($ch === PDF_BOLD) {                              // uključi/isključi bold (flush pa toggle)
                if ($buf !== '') { $runovi[] = $emit($buf, $bufFont, $bold); $buf = ''; }
                $bold = !$bold;
                continue;
            }
            if ($ch === PDF_MEKI_PRIJELOM) {                     // meki prijelom reda u istom odlomku
                if ($buf !== '') { $runovi[] = $emit($buf, $bufFont, $bold); $buf = ''; }
                $runovi[] = ['text' => "\n"];
                $bufFont = null;
                continue;
            }
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
                $runovi[] = $emit($buf, $bufFont, $bold);
                $buf = '';
            }
            $bufFont = $koji;
            $buf .= $ch;
        }
        if ($buf !== '') {
            $runovi[] = $emit($buf, $bufFont, $bold);
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
        $tekst = str_replace([':.', '.·.'], '∴', $tekst);   // masonska oznaka: ":." i ".·." → "∴" (U+2234)
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
            if ($ch === PDF_MEKI_PRIJELOM) {                     // meki prijelom reda u istom odlomku
                if ($buf !== '') { $r = ['text' => $buf]; if ($bufFont !== null) $r['font'] = $bufFont; if ($bufColor !== null) $r['color'] = $bufColor; $runovi[] = $r; $buf = ''; }
                $runovi[] = ['text' => "\n"]; $bufFont = null; $bufColor = null;
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
$brojParId = isset($ulaz['broj_stranice_paragraf_id']) ? (int) $ulaz['broj_stranice_paragraf_id'] : 0;   // stil brojača (dokument-razina)
// Startni broj stranice (opcionalno; default 1). Pomiče SAMO prikazani broj stranice (#S i #U za +(startni-1)).
// Vrijedi za SVAKI poziv generatora (eseji, zapisnici, budući dokumenti); ne dira raspored zona. Min 1.
$startniBrojStranice = isset($ulaz['startni_broj_stranice']) ? (int) $ulaz['startni_broj_stranice'] : 1;
if ($startniBrojStranice < 1) $startniBrojStranice = 1;

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

// --- Whitelist relacija (relacija_id -> junction + FK kolone + ciljni izvor naziva) -----
$relacije = [];
$r = $mysqli->query('SELECT id, naziv, junction_tablica, fk_baza_kolona, link_kolona, ciljni_izvor_id, sort_kolona, suffix_fk_kolona, suffix_izvor_id, suffix_bazni_izvor_id, suffix_format, grupa_tablica, grupa_label_kolona, grupa_sort_kolona, diskriminator_kolona, fallback_kolona, fallback_predlozak FROM pdf_dozvoljeni_relacije');
if ($r) while ($row = $r->fetch_assoc()) $relacije[(int) $row['id']] = $row;

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
if ($brojParId > 0) $parIds[$brojParId] = true;   // stil brojača (možda nije referenciran nijednom stavkom)
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
// Pridruži pdfmake_kljuc paragraf-stilovima (render brojača treba font-ključ; stavke ga dobivaju zasebno).
foreach ($parStilovi as $pid => $prow) {
    $fid = !empty($prow['font_id']) ? (int) $prow['font_id'] : 0;
    if ($fid && isset($fontPoId[$fid])) $parStilovi[$pid]['pdfmake_kljuc'] = $fontPoId[$fid]['pdfmake_kljuc'];
}

/** Spojeni nazivi 1-na-više veze ($rel) za bazni id: junction.fk_baza = baseId JOIN cilj.kolona po link.
 *  Vraća niz vrijednosti (može biti prazan). Identifikatori moraju biti prethodno provjereni. */
function pdf_relacija_lista_vrijednosti($mysqli, $jt, $fk, $lk, $ct, $ck, $baseId)
{
    $sql = "SELECT t.`$ck` AS v FROM `$jt` j JOIN `$ct` t ON t.id = j.`$lk` WHERE j.`$fk` = ? ORDER BY t.`$ck`";
    $stmt = $mysqli->prepare($sql); if (!$stmt) return [];
    $stmt->bind_param('i', $baseId);
    $stmt->execute();
    $res = $stmt->get_result();
    $out = [];
    if ($res) while ($row = $res->fetch_assoc()) { if ($row['v'] !== null && $row['v'] !== '') $out[] = (string) $row['v']; }
    $stmt->close();
    return $out;
}

/** Broj redova 1-na-više veze ($rel) za bazni id: junction.fk_baza = baseId. */
function pdf_relacija_broj($mysqli, $jt, $fk, $baseId)
{
    $sql = "SELECT COUNT(*) AS n FROM `$jt` WHERE `$fk` = ?";
    $stmt = $mysqli->prepare($sql); if (!$stmt) return 0;
    $stmt->bind_param('i', $baseId);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    return $row ? (int) $row['n'] : 0;
}

// Predložak retka/imena: {j.kol} spojna, {c.kol} cilj, {j.kol->tbl.kol2} FK-skok (LEFT JOIN), {tab};
// opcionalno :transform (npr. :inicijal = prvo slovo) pa |mapa. ^ = razmak.
// Grupe: 1 src(j|c), 2 kol, 3 fk-tbl, 4 fk-kol, 5 transform, 6 mapa, 7 tab.
if (!defined('PDF_PREDLOZAK_RE')) define('PDF_PREDLOZAK_RE', '/\{(?:(j|c)\.([A-Za-z0-9_]+)(?:->([A-Za-z0-9_]+)\.([A-Za-z0-9_]+))?(?::([a-z]+))?(?:\|([^}]*))?|(tab))\}/u');

/** Transformacija vrijednosti placeholdera (predložak modifikator ":kljuc").
 *  inicijal / i → prvo slovo (UTF-8, veliko); nepoznat kljuc → vrijednost nepromijenjena. */
function pdf_predlozak_transform($v, $t)
{
    $v = (string) $v;
    switch ($t) {
        case 'i':
        case 'inicijal':
            $v = trim($v);
            return $v === '' ? '' : mb_strtoupper(mb_substr($v, 0, 1, 'UTF-8'), 'UTF-8');
    }
    return $v;
}

/** Parsiraj predložak → ['jCols'=>[], 'cCols'=>[], 'follows'=>[{src,col,tbl,col2}]]. */
function pdf_predlozak_parse($tpl)
{
    preg_match_all(PDF_PREDLOZAK_RE, (string) $tpl, $ms, PREG_SET_ORDER);
    $jCols = []; $cCols = []; $follows = [];
    foreach ($ms as $m) {
        if (!empty($m[7])) continue;   // {tab}
        $src = $m[1]; $col = $m[2]; $ftbl = isset($m[3]) ? $m[3] : ''; $fcol = isset($m[4]) ? $m[4] : '';
        if ($ftbl !== '' && $fcol !== '') { $follows["$src.$col.$ftbl.$fcol"] = ['src' => $src, 'col' => $col, 'tbl' => $ftbl, 'col2' => $fcol]; }
        else { if ($src === 'j') $jCols[$col] = true; else $cCols[$col] = true; }
    }
    return ['jCols' => $jCols, 'cCols' => $cCols, 'follows' => array_values($follows)];
}

/** Vrijednost jednog placeholdera ($m iz PDF_PREDLOZAK_RE) → string. */
function pdf_predlozak_segment($m, $row, $followAlias, $tab)
{
    if (!empty($m[7])) return $tab;   // {tab}
    $src = $m[1]; $col = $m[2]; $ftbl = isset($m[3]) ? $m[3] : ''; $fcol = isset($m[4]) ? $m[4] : '';
    $transform = isset($m[5]) ? $m[5] : ''; $mapa = isset($m[6]) ? $m[6] : '';
    if ($ftbl !== '' && $fcol !== '') {
        $ak = isset($followAlias["$src.$col.$ftbl.$fcol"]) ? $followAlias["$src.$col.$ftbl.$fcol"] : '';
        $v = ($ak !== '' && array_key_exists($ak, $row) && $row[$ak] !== null) ? (string) $row[$ak] : '';
    } else {
        $rk = ($src === 'j' ? 'j_' : 'c_') . $col;
        $v = (array_key_exists($rk, $row) && $row[$rk] !== null) ? (string) $row[$rk] : '';
    }
    if ($transform !== '') $v = pdf_predlozak_transform($v, $transform);   // :inicijal i sl. (prije mape)
    if ($mapa !== '') $v = (string) pdf_mapa_primijeni($v, $mapa);
    return $v;
}

/** Renderiraj predložak po retku. Podržava opcionalni blok [..]: ispisuje se SAMO ako sadrži bar
 *  jednu ne-praznu vrijednost (za uvjetne separatore, npr. [-{j.loza}]). $followAlias za FK-skokove. */
function pdf_predlozak_render($tpl, $row, $followAlias, $tab)
{
    // 1) Opcionalni blokovi [..] (bez ugnježđivanja)
    $tpl = preg_replace_callback('/\[([^\[\]]*)\]/u', function ($bm) use ($row, $followAlias, $tab) {
        $imaVrijednost = false;
        $inner = preg_replace_callback(PDF_PREDLOZAK_RE, function ($m) use ($row, $followAlias, $tab, &$imaVrijednost) {
            $v = pdf_predlozak_segment($m, $row, $followAlias, $tab);
            if ($v !== '') $imaVrijednost = true;
            return $v;
        }, $bm[1]);
        return $imaVrijednost ? $inner : '';
    }, $tpl);
    // 2) Preostali placeholderi (izvan blokova)
    return preg_replace_callback(PDF_PREDLOZAK_RE, function ($m) use ($row, $followAlias, $tab) {
        return pdf_predlozak_segment($m, $row, $followAlias, $tab);
    }, $tpl);
}

/** Validiraj listu kolona predloška (j./c.) protiv whitelista. Vraća greška-string ili null. */
function pdf_predlozak_validiraj_kolone($info, $dozvoljene, $jt, $tt)
{
    foreach (array_keys($info['jCols']) as $c) { if (!pdf_ident_ok($c) || empty($dozvoljene["$jt.$c"])) return "Kolona {j.$c} nije u whitelistu."; }
    foreach (array_keys($info['cCols']) as $c) { if (!pdf_ident_ok($c) || empty($dozvoljene["$tt.$c"])) return "Kolona {c.$c} nije u whitelistu."; }
    return null;
}

/** Za follows izgradi SELECT dodatke + JOIN klauzule + alias-map (fk0, fk1…). Vraća [greska|null, sel[], joins, alias[]]. */
function pdf_follows_build($follows, $dozvoljene, $jt, $tt, &$idx)
{
    $sel = []; $joins = ''; $alias = [];
    foreach ($follows as $f) {
        $col = $f['col']; $tbl = $f['tbl']; $col2 = $f['col2']; $src = $f['src'];
        if (!pdf_ident_ok($col) || !pdf_ident_ok($tbl) || !pdf_ident_ok($col2)) return ['Neispravan FK-skok u predlošku.', [], '', []];
        $srcTbl = ($src === 'j') ? $jt : $tt;
        if (empty($dozvoljene["$srcTbl.$col"])) return ["FK kolona {$src}.$col nije u whitelistu.", [], '', []];
        if (empty($dozvoljene["$tbl.$col2"])) return ["Cilj FK-skoka $tbl.$col2 nije u whitelistu.", [], '', []];
        $a = 'fk' . $idx; $idx++;
        $srcAlias = ($src === 'j') ? 'j' : 't';
        $sel[] = "$a.`$col2` AS `__$a`";
        $joins .= " LEFT JOIN `$tbl` $a ON $a.id = $srcAlias.`$col`";
        $alias["$src.$col.$tbl.$col2"] = "__$a";
    }
    return [null, $sel, $joins, $alias];
}

/** Vrijednost jednog segmenta: korisnicki -> literal_tekst (^=razmak); relacija_* -> 1-na-više veza; inače iz whitelist izvora. */
function pdf_segment_vrijednost($mysqli, $s, $izvori, $relacije, $kontekst)
{
    $izvorTip = (string) ($s['izvor_tip'] ?? '');
    if ($izvorTip === 'korisnicki') {
        $lit = (string) ($s['literal_tekst'] ?? '');
        return ['greska' => null, 'vrijednost' => pdf_formatiraj_datum(str_replace('^', ' ', $lit), $s['format_datuma'] ?? null)];
    }
    if ($izvorTip === 'relacija_broj' || $izvorTip === 'relacija_lista') {
        $relId = isset($s['relacija_id']) ? (int) $s['relacija_id'] : 0;
        $rel = isset($relacije[$relId]) ? $relacije[$relId] : null;
        if (!$rel || !pdf_ident_ok($rel['junction_tablica']) || !pdf_ident_ok($rel['fk_baza_kolona']) || !pdf_ident_ok($rel['link_kolona'])) {
            return ['greska' => 'Relacija nije u whitelistu.', 'vrijednost' => null];
        }
        $baseId = pdf_dinamicki_id($s, $kontekst);
        if ($baseId <= 0) return ['greska' => null, 'vrijednost' => null];   // nema konteksta (pregled) → prazno
        if ($izvorTip === 'relacija_broj') {
            $broj = pdf_relacija_broj($mysqli, $rel['junction_tablica'], $rel['fk_baza_kolona'], $baseId);
            return ['greska' => null, 'vrijednost' => pdf_mapa_primijeni((string) $broj, $s['mapa_vrijednosti'] ?? null)];
        }
        // relacija_lista: ciljni izvor (tablica.kolona naziva) iz whitelista
        $cil = isset($izvori[(int) $rel['ciljni_izvor_id']]) ? $izvori[(int) $rel['ciljni_izvor_id']] : null;
        if (!$cil || !pdf_ident_ok($cil['tablica']) || !pdf_ident_ok($cil['kolona'])) {
            return ['greska' => 'Ciljni izvor relacije nije u whitelistu.', 'vrijednost' => null];
        }
        $stavke_lista = pdf_relacija_lista_vrijednosti($mysqli, $rel['junction_tablica'], $rel['fk_baza_kolona'], $rel['link_kolona'], $cil['tablica'], $cil['kolona'], $baseId);
        if (empty($stavke_lista)) return ['greska' => null, 'vrijednost' => null];   // 0 redova → prazno (radi sakrij_ako_prazno)
        $nacin = (string) ($s['lista_nacin'] ?? 'zarez');
        if ($nacin === 'novi_red') {
            $sep = PDF_MEKI_PRIJELOM;
        } elseif ($nacin === 'novi_odlomak') {
            $sep = "\n";
        } else {
            $ls = isset($s['lista_separator']) ? (string) $s['lista_separator'] : '';
            $sep = ($ls !== '') ? str_replace('^', ' ', $ls) : ', ';
        }
        return ['greska' => null, 'vrijednost' => implode($sep, $stavke_lista)];
    }
    if ($izvorTip === 'relacija_redak') {
        $relId = isset($s['relacija_id']) ? (int) $s['relacija_id'] : 0;
        $rel = isset($relacije[$relId]) ? $relacije[$relId] : null;
        if (!$rel || !pdf_ident_ok($rel['junction_tablica']) || !pdf_ident_ok($rel['fk_baza_kolona']) || !pdf_ident_ok($rel['link_kolona'])) {
            return ['greska' => 'Relacija nije u whitelistu.', 'vrijednost' => null];
        }
        $cil = isset($izvori[(int) $rel['ciljni_izvor_id']]) ? $izvori[(int) $rel['ciljni_izvor_id']] : null;
        if (!$cil || !pdf_ident_ok($cil['tablica'])) {
            return ['greska' => 'Ciljna tablica relacije nije u whitelistu.', 'vrijednost' => null];
        }
        $jt = $rel['junction_tablica']; $tt = $cil['tablica']; $fk = $rel['fk_baza_kolona']; $lk = $rel['link_kolona'];
        $tpl = (string) ($s['redak_predlozak'] ?? '');
        if (trim($tpl) === '') return ['greska' => 'Redak-predložak je prazan.', 'vrijednost' => null];
        $baseId = pdf_dinamicki_id($s, $kontekst);
        if ($baseId <= 0) return ['greska' => null, 'vrijednost' => null];   // nema konteksta (pregled) → prazno
        // Dozvoljene kolone iz whitelista (tablica.kolona)
        $dozvoljene = [];
        foreach ($izvori as $iz) { if (isset($iz['tablica'], $iz['kolona'])) $dozvoljene[$iz['tablica'] . '.' . $iz['kolona']] = true; }
        $info = pdf_predlozak_parse($tpl);
        $verr = pdf_predlozak_validiraj_kolone($info, $dozvoljene, $jt, $tt);
        if ($verr !== null) return ['greska' => $verr, 'vrijednost' => null];
        $fidx = 0;
        list($ferr, $fSel, $fJoins, $fAlias) = pdf_follows_build($info['follows'], $dozvoljene, $jt, $tt, $fidx);
        if ($ferr !== null) return ['greska' => $ferr, 'vrijednost' => null];
        // Sort (kolona spojne tablice)
        $orderBy = '';
        $sort = isset($rel['sort_kolona']) ? (string) $rel['sort_kolona'] : '';
        if ($sort !== '' && pdf_ident_ok($sort) && pdf_kolona_postoji($mysqli, $jt, $sort)) $orderBy = " ORDER BY j.`$sort`";
        // Uvjetni sufiks (npr. ime lože člana ako nije iz lože nosioca): aktivan kad su sva tri postavljena
        $sfxAktivan = false; $sfxFk = ''; $sfxTbl = ''; $sfxCol = ''; $sfxHost = null; $sfxFormat = ', {v}';
        $sfxFkRaw = isset($rel['suffix_fk_kolona']) ? (string) $rel['suffix_fk_kolona'] : '';
        $sfxIzvorId = isset($rel['suffix_izvor_id']) ? (int) $rel['suffix_izvor_id'] : 0;
        $sfxBazniId = isset($rel['suffix_bazni_izvor_id']) ? (int) $rel['suffix_bazni_izvor_id'] : 0;
        if ($sfxFkRaw !== '' && $sfxIzvorId > 0 && $sfxBazniId > 0 && pdf_ident_ok($sfxFkRaw) && !empty($dozvoljene["$tt.$sfxFkRaw"])) {
            $izS = isset($izvori[$sfxIzvorId]) ? $izvori[$sfxIzvorId] : null;
            $izB = isset($izvori[$sfxBazniId]) ? $izvori[$sfxBazniId] : null;
            if ($izS && $izB && pdf_ident_ok($izS['tablica']) && pdf_ident_ok($izS['kolona']) && pdf_ident_ok($izB['tablica']) && pdf_ident_ok($izB['kolona'])) {
                $sfxFk = $sfxFkRaw; $sfxTbl = $izS['tablica']; $sfxCol = $izS['kolona'];
                $sfxHost = pdf_vrijednost_po_id($mysqli, $izB['tablica'], $izB['kolona'], $baseId);
                if (isset($rel['suffix_format']) && trim((string) $rel['suffix_format']) !== '') $sfxFormat = (string) $rel['suffix_format'];
                $sfxAktivan = true;
            }
        }
        // SELECT samo traženih kolona (+ FK-skokovi + sufiks)
        $sel = [];
        foreach (array_keys($info['jCols']) as $c) $sel[] = "j.`$c` AS `j_$c`";
        foreach (array_keys($info['cCols']) as $c) $sel[] = "t.`$c` AS `c_$c`";
        foreach ($fSel as $fs) $sel[] = $fs;
        if ($sfxAktivan) { $sel[] = "t.`$sfxFk` AS `__sfx_fk`"; $sel[] = "s2.`$sfxCol` AS `__sfx_name`"; }
        if (empty($sel)) $sel[] = "j.`$fk` AS `j_$fk`";   // barem nešto (predložak bez polja)
        $sfxJoin = $sfxAktivan ? " LEFT JOIN `$sfxTbl` s2 ON s2.id = t.`$sfxFk`" : '';
        $sql = "SELECT " . implode(', ', $sel) . " FROM `$jt` j JOIN `$tt` t ON t.id = j.`$lk`" . $fJoins . $sfxJoin . " WHERE j.`$fk` = ?" . $orderBy;
        $stmt = $mysqli->prepare($sql); if (!$stmt) return ['greska' => 'Upit relacije neuspješan.', 'vrijednost' => null];
        $stmt->bind_param('i', $baseId);
        $stmt->execute();
        $res = $stmt->get_result();
        $fiks = isset($s['fiksna_pozicija']) ? (float) $s['fiksna_pozicija'] : 0;
        $tab = $fiks > 0 ? '~(' . rtrim(rtrim(sprintf('%.2f', $fiks), '0'), '.') . ')' : ' ';
        $redci = [];
        if ($res) while ($row = $res->fetch_assoc()) {
            $line = str_replace('^', ' ', pdf_predlozak_render($tpl, $row, $fAlias, $tab));
            if ($sfxAktivan) {   // dodaj sufiks samo kad se FK kolona cilja razlikuje od bazne (npr. loža člana ≠ nosioc) i naziv postoji
                $rowName = (array_key_exists('__sfx_name', $row) && $row['__sfx_name'] !== null) ? (string) $row['__sfx_name'] : '';
                $rowFk = array_key_exists('__sfx_fk', $row) ? $row['__sfx_fk'] : null;
                if ($rowName !== '' && (string) $rowFk !== (string) $sfxHost) {
                    $line .= str_replace('{v}', $rowName, str_replace('^', ' ', $sfxFormat));
                }
            }
            $redci[] = $line;
        }
        $stmt->close();
        if (empty($redci)) return ['greska' => null, 'vrijednost' => null];   // nema redova → prazno (sakrij)
        return ['greska' => null, 'vrijednost' => implode("\n", $redci)];
    }
    if ($izvorTip === 'relacija_grupe') {
        $relId = isset($s['relacija_id']) ? (int) $s['relacija_id'] : 0;
        $rel = isset($relacije[$relId]) ? $relacije[$relId] : null;
        if (!$rel || !pdf_ident_ok($rel['junction_tablica']) || !pdf_ident_ok($rel['fk_baza_kolona']) || !pdf_ident_ok($rel['link_kolona'])) {
            return ['greska' => 'Relacija nije u whitelistu.', 'vrijednost' => null];
        }
        $cil = isset($izvori[(int) $rel['ciljni_izvor_id']]) ? $izvori[(int) $rel['ciljni_izvor_id']] : null;
        if (!$cil || !pdf_ident_ok($cil['tablica'])) {
            return ['greska' => 'Ciljna tablica relacije nije u whitelistu.', 'vrijednost' => null];
        }
        $jt = $rel['junction_tablica']; $tt = $cil['tablica']; $fk = $rel['fk_baza_kolona']; $lk = $rel['link_kolona'];
        $gt = (string) ($rel['grupa_tablica'] ?? ''); $gl = (string) ($rel['grupa_label_kolona'] ?? '');
        $gs = (string) ($rel['grupa_sort_kolona'] ?? ''); $disc = (string) ($rel['diskriminator_kolona'] ?? '');
        $fb = (string) ($rel['fallback_kolona'] ?? '');
        $grupiraj = ($gt !== '');   // bez grupe → jedan popis, labela iz mape na BROJU (1 vs >1)
        $dozvoljene = [];
        foreach ($izvori as $iz) { if (isset($iz['tablica'], $iz['kolona'])) $dozvoljene[$iz['tablica'] . '.' . $iz['kolona']] = true; }
        if ($grupiraj) {
            if (!pdf_ident_ok($gt) || !pdf_ident_ok($gl) || !pdf_ident_ok($disc)) return ['greska' => 'Grupiranje relacije nije ispravno.', 'vrijednost' => null];
            if (empty($dozvoljene["$gt.$gl"])) return ['greska' => 'Labela grupe nije u whitelistu.', 'vrijednost' => null];
            if (!pdf_kolona_postoji($mysqli, $jt, $disc)) return ['greska' => 'Diskriminator nije ispravan.', 'vrijednost' => null];
        }
        $tpl = (string) ($s['redak_predlozak'] ?? '');           // predložak imena ČLANA (cilj=clanovi)
        if (trim($tpl) === '') return ['greska' => 'Predložak imena je prazan.', 'vrijednost' => null];
        $fbTpl = (string) ($rel['fallback_predlozak'] ?? '');     // predložak imena GOSTA (clanovi NULL)
        $baseId = pdf_dinamicki_id($s, $kontekst);
        if ($baseId <= 0) return ['greska' => null, 'vrijednost' => null];
        // Parsiraj oba predloška (član + gost) i validiraj kolone
        $infoM = pdf_predlozak_parse($tpl);
        $verr = pdf_predlozak_validiraj_kolone($infoM, $dozvoljene, $jt, $tt);
        if ($verr !== null) return ['greska' => $verr, 'vrijednost' => null];
        $infoG = ['jCols' => [], 'cCols' => [], 'follows' => []];
        if (trim($fbTpl) !== '') {
            $infoG = pdf_predlozak_parse($fbTpl);
            $verr = pdf_predlozak_validiraj_kolone($infoG, $dozvoljene, $jt, $tt);
            if ($verr !== null) return ['greska' => $verr, 'vrijednost' => null];
        } elseif ($fb !== '' && (!pdf_ident_ok($fb) || empty($dozvoljene["$jt.$fb"]))) {
            return ['greska' => 'Fallback kolona nije u whitelistu.', 'vrijednost' => null];
        }
        // FK-skokovi iz oba predloška
        $fidx = 0;
        list($ferr, $fSel, $fJoins, $fAlias) = pdf_follows_build(array_merge($infoM['follows'], $infoG['follows']), $dozvoljene, $jt, $tt, $fidx);
        if ($ferr !== null) return ['greska' => $ferr, 'vrijednost' => null];
        // Suffix (loža člana ako nije iz lože nosioca) — primjenjuje se samo na članove
        $sfxAktivan = false; $sfxFk = ''; $sfxTbl = ''; $sfxCol = ''; $sfxHost = null; $sfxFormat = ', {v}';
        $sfxFkRaw = (string) ($rel['suffix_fk_kolona'] ?? ''); $sfxIzvorId = (int) ($rel['suffix_izvor_id'] ?? 0); $sfxBazniId = (int) ($rel['suffix_bazni_izvor_id'] ?? 0);
        if ($sfxFkRaw !== '' && $sfxIzvorId > 0 && $sfxBazniId > 0 && pdf_ident_ok($sfxFkRaw) && !empty($dozvoljene["$tt.$sfxFkRaw"])) {
            $izS = isset($izvori[$sfxIzvorId]) ? $izvori[$sfxIzvorId] : null; $izB = isset($izvori[$sfxBazniId]) ? $izvori[$sfxBazniId] : null;
            if ($izS && $izB && pdf_ident_ok($izS['tablica']) && pdf_ident_ok($izS['kolona']) && pdf_ident_ok($izB['tablica']) && pdf_ident_ok($izB['kolona'])) {
                $sfxFk = $sfxFkRaw; $sfxTbl = $izS['tablica']; $sfxCol = $izS['kolona'];
                $sfxHost = pdf_vrijednost_po_id($mysqli, $izB['tablica'], $izB['kolona'], $baseId);
                if (isset($rel['suffix_format']) && trim((string) $rel['suffix_format']) !== '') $sfxFormat = (string) $rel['suffix_format'];
                $sfxAktivan = true;
            }
        }
        // SELECT: (labela grupe + sort kad grupiramo) + kolone obaju predložaka + FK-skokovi + link + suffix
        $sel = []; $ord = [];
        if ($grupiraj) {
            $sel[] = "g.`$gl` AS `__glabel`";
            if ($gs !== '' && pdf_ident_ok($gs) && pdf_kolona_postoji($mysqli, $gt, $gs)) { $sel[] = "g.`$gs` AS `__gsort`"; $ord[] = "g.`$gs`"; }
            else { $ord[] = "g.id"; }
        }
        $jColsAll = $infoM['jCols'] + $infoG['jCols'];
        foreach (array_keys($jColsAll) as $c) $sel[] = "j.`$c` AS `j_$c`";
        foreach (array_keys($infoM['cCols']) as $c) { $sel[] = "t.`$c` AS `c_$c`"; $ord[] = "t.`$c`"; }
        foreach ($fSel as $fs) $sel[] = $fs;
        $sel[] = "j.`$lk` AS `__link`";
        if (trim($fbTpl) === '' && $fb !== '') { $sel[] = "j.`$fb` AS `__fb`"; }
        if ($sfxAktivan) { $sel[] = "t.`$sfxFk` AS `__sfx_fk`"; $sel[] = "s2.`$sfxCol` AS `__sfx_name`"; }
        $grupaJoin = $grupiraj ? " JOIN `$gt` g ON g.id = j.`$disc`" : '';
        $sfxJoin = $sfxAktivan ? " LEFT JOIN `$sfxTbl` s2 ON s2.id = t.`$sfxFk`" : '';
        $orderBy = !empty($ord) ? (" ORDER BY " . implode(', ', $ord)) : '';
        $sql = "SELECT " . implode(', ', $sel) . " FROM `$jt` j" . $grupaJoin . " LEFT JOIN `$tt` t ON t.id = j.`$lk`" . $fJoins . $sfxJoin . " WHERE j.`$fk` = ?" . $orderBy;
        $stmt = $mysqli->prepare($sql); if (!$stmt) return ['greska' => 'Upit grupe neuspješan.', 'vrijednost' => null];
        $stmt->bind_param('i', $baseId);
        $stmt->execute();
        $res = $stmt->get_result();
        $groups = []; $order = []; $svi = [];
        if ($res) while ($row = $res->fetch_assoc()) {
            $link = array_key_exists('__link', $row) ? $row['__link'] : null;
            $jeClan = ($link !== null && (int) $link > 0);
            if ($jeClan) {
                $ime = trim(str_replace('^', ' ', pdf_predlozak_render($tpl, $row, $fAlias, '')));
                if ($sfxAktivan && $ime !== '') {   // loža člana ako nije iz lože nosioca
                    $rn = (array_key_exists('__sfx_name', $row) && $row['__sfx_name'] !== null) ? (string) $row['__sfx_name'] : '';
                    $rf = array_key_exists('__sfx_fk', $row) ? $row['__sfx_fk'] : null;
                    if ($rn !== '' && (string) $rf !== (string) $sfxHost) $ime .= str_replace('{v}', $rn, str_replace('^', ' ', $sfxFormat));
                }
            } elseif (trim($fbTpl) !== '') {
                $ime = trim(str_replace('^', ' ', pdf_predlozak_render($fbTpl, $row, $fAlias, '')));
            } elseif ($fb !== '' && array_key_exists('__fb', $row) && $row['__fb'] !== null) {
                $ime = trim((string) $row['__fb']);
            } else {
                $ime = '';
            }
            if ($ime === '') continue;   // nema upotrebljivog imena
            if ($grupiraj) {
                $label = (string) $row['__glabel'];
                if (!isset($groups[$label])) { $groups[$label] = []; $order[] = $label; }
                $groups[$label][] = $ime;
            } else {
                $svi[] = $ime;
            }
        }
        $stmt->close();
        $bold = !empty($s['labela_bold']);
        if (!$grupiraj) {   // bez grupe: jedan redak, labela iz mape na BROJU (1 vs >1); engine doda ": "
            if (empty($svi)) return ['greska' => null, 'vrijednost' => null];
            $label = (string) pdf_mapa_primijeni((string) count($svi), $s['mapa_vrijednosti'] ?? null);
            $lbl = $bold ? (PDF_BOLD . $label . PDF_BOLD) : $label;
            return ['greska' => null, 'vrijednost' => $lbl . ': ' . implode(', ', $svi)];
        }
        if (empty($order)) return ['greska' => null, 'vrijednost' => null];   // nema grupa → prazno (sakrij)
        $lines = [];
        foreach ($order as $label) {
            $lbl = $bold ? (PDF_BOLD . $label . PDF_BOLD) : $label;
            $lines[] = $lbl . ': ' . implode(', ', $groups[$label]);
        }
        return ['greska' => null, 'vrijednost' => implode(PDF_MEKI_PRIJELOM, $lines)];
    }
    $izvorId = isset($s['izvor_id']) ? (int) $s['izvor_id'] : 0;
    $izvor = isset($izvori[$izvorId]) ? $izvori[$izvorId] : null;
    if (!$izvor || !pdf_ident_ok($izvor['tablica']) || !pdf_ident_ok($izvor['kolona'])) {
        return ['greska' => 'Izvor nije u whitelistu.', 'vrijednost' => null];
    }
    $tip = (string) ($s['izvor_tip'] ?? '');
    $prekoId = isset($s['preko_izvor_id']) ? (int) $s['preko_izvor_id'] : 0;
    if ($tip === 'dinamicki' && $prekoId > 0) {
        // Indirektni ključ: bazni id (kontekst/test) -> preko-izvor (FK kolona) -> id ciljnog izvora.
        $preko = isset($izvori[$prekoId]) ? $izvori[$prekoId] : null;
        if (!$preko || !pdf_ident_ok($preko['tablica']) || !pdf_ident_ok($preko['kolona'])) {
            return ['greska' => 'Veza (preko izvora) nije u whitelistu.', 'vrijednost' => null];
        }
        $baseId = pdf_dinamicki_id($s, $kontekst);
        $val = null;
        if ($baseId > 0) {
            $fkId = (int) pdf_vrijednost_po_id($mysqli, $preko['tablica'], $preko['kolona'], $baseId);
            if ($fkId > 0) $val = pdf_vrijednost_po_id($mysqli, $izvor['tablica'], $izvor['kolona'], $fkId);
        }
    } else {
        $val = pdf_dohvati_vrijednost($mysqli, $izvor['tablica'], $izvor['kolona'], $s, $kontekst);
    }
    return ['greska' => null, 'vrijednost' => pdf_formatiraj_datum(pdf_mapa_primijeni($val, $s['mapa_vrijednosti'] ?? null), $s['format_datuma'] ?? null)];
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
        // Separator prema spajanju PRETHODNOG segmenta s vrijednošću: 1=isti red (''), 2=novi red (meki prijelom).
        $dijelovi = [];
        $combined = '';
        $imaPlaceholder = false;
        $segErr = null;
        $imaPrije = false;     // je li već dodan segment s vrijednošću
        $zadnjiFlag = 0;       // bez_kraja_odlomka zadnjeg dodanog segmenta
        $sakrijRed = false;    // bilo koji segment s "sakrij_ako_prazno" i prazan → sakrij cijeli red (bez placeholdera)
        foreach ($chain as $ci) {
            $seg = $stavke[$ci];
            $r = pdf_segment_vrijednost($mysqli, $seg, $izvori, $relacije, $kontekst);
            if ($r['greska'] !== null && $segErr === null) $segErr = $r['greska'];
            $val = $r['vrijednost'];
            $segTekst = null; $segColor = null;
            $prazno = ($val === null || $val === '');
            if (!empty($seg['sakrij_ako_prazno']) && $prazno) { $sakrijRed = true; continue; }   // oznaka + prazno → sakrij red
            if ((($seg['izvor_tip'] ?? '') === 'dinamicki') && $prazno) {
                $segTekst = 'XXXXXXXX'; $segColor = '#cccccc';   // placeholder kao siva ploha
                $imaPlaceholder = true;
            } elseif (!$prazno) {
                $segTekst = (string) $val; $segColor = null;
            }
            if ($segTekst === null) continue;                    // prazan segment — preskoči (flag se ne mijenja)
            // relacija_redak sam ubacuje pozicionirane ~(N) (jedan po retku iz {tab}) → NE dirati ga.
            if (($seg['izvor_tip'] ?? '') !== 'relacija_redak') {
                // Korisnički upisan ~(N) više nije podržan (zamijenila ga „Fiksna pozicija stavke") → ukloni ga.
                $segTekst = preg_replace('/~\(\d+(?:\.\d+)?\)/', '', $segTekst);
                // Fiksna pozicija stavke → INTERNI ~(N) marker ispred sadržaja (renderer ga pretvara u columns).
                $fiks = isset($seg['fiksna_pozicija']) ? (float) $seg['fiksna_pozicija'] : 0;
                if ($fiks > 0) {
                    $segTekst = '~(' . rtrim(rtrim(sprintf('%.2f', $fiks), '0'), '.') . ')' . $segTekst;
                }
            }
            if ($imaPrije && $zadnjiFlag === 2) {                 // meki prijelom prema prethodnom segmentu
                $combined .= PDF_MEKI_PRIJELOM;
                $dijelovi[] = ['tekst' => PDF_MEKI_PRIJELOM, 'color' => null];
            }
            $combined .= $segTekst;
            $dijelovi[] = ['tekst' => $segTekst, 'color' => $segColor];
            $imaPrije = true;
            $zadnjiFlag = (int) ($seg['bez_kraja_odlomka'] ?? 0);
        }
        $rec = [
            'redoslijed' => isset($first['redoslijed']) ? (int) $first['redoslijed'] : 0,
            'zona' => $zona,
            'vrsta' => 'tekst',
            'greska' => null,
            'paragraf_id' => $parId ?: null,
            'font_kljuc' => $fk,
            // relacija-liste su JEDAN blok (više odlomaka = retci) → razmak prije/poslije samo na rubovima bloka
            'spojeni_odlomci' => in_array(($first['izvor_tip'] ?? ''), ['relacija_redak', 'relacija_lista', 'relacija_grupe'], true)
        ];
        if ($sakrijRed) {
            $rec['sakrij'] = true;     // označena stavka prazna → cijeli red se ne prikazuje
            $rec['odlomci'] = [];
        } elseif ($combined === '') {
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
        $r = pdf_segment_vrijednost($mysqli, $s, $izvori, $relacije, $kontekst);
        $rec['slika_stil_id'] = !empty($s['slika_stil_id']) ? (int) $s['slika_stil_id'] : null;
        if ($r['greska'] !== null) {
            $rec['greska'] = $r['greska'];
        } else {
            $vrijednost = $r['vrijednost'];
            if ($vrijednost === null || $vrijednost === '') {
                if (!empty($s['sakrij_ako_prazno'])) {
                    $rec['sakrij'] = true;   // označena slika prazna → red se ne prikazuje (bez placeholdera)
                } elseif (($s['izvor_tip'] ?? '') === 'dinamicki') {
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
    'default_font' => $kljucFallback,
    'broj_stranice_paragraf_id' => ($brojParId > 0 ? $brojParId : null),
    'startni_broj_stranice' => $startniBrojStranice
], JSON_UNESCAPED_UNICODE);
