<?php
/**
 * 0-Jezik_lib.php — i18n runtime (modul 0-Jezik).
 *
 * Master jezik = jezik u kojem je app pisana (sustav_jezici.zadani=1) = literal u kodu = fallback.
 * Za master se rječnik ne servira (prikazuju se literali iz koda). Za ostale jezike server injektira
 * window.__I18N__ (po formi: global.* + ključevi te forme) i JS/PHP t() zamjenjuje literale.
 *
 * Funkcije:
 *   jezik_je_razvoj()                          – VNLH_RAZVOJ iz js/00-Version.js (1=razvoj)
 *   jezik_korisnika()                          – ['id','kod','master'] jezika korisnika (sesija → fallback zadani)
 *   jezik_rjecnik($naziv_fajla)                – [kljuc => tekst] za jezik korisnika i tu formu (+ global)
 *   jezik_t($kljuc, $master, $params)          – PHP prijevod; fallback = $master literal
 *   jezik_inject_i18n_script($html, $fajl)     – ubaci window.__I18N__ / __VNLH_JEZIK__ / __VNLH_RAZVOJ__ nakon <head>
 */

require_once __DIR__ . '/vnlh_db_connect.php';

/** VNLH_RAZVOJ (1=lokalni razvoj) iz js/00-Version.js; keš po zahtjevu. */
function jezik_je_razvoj(): bool
{
    static $c = null;
    if ($c !== null) {
        return $c;
    }
    $c = false;
    $p = __DIR__ . '/../js/00-Version.js';
    if (is_readable($p)) {
        $s = @file_get_contents($p);
        if ($s !== false && preg_match('/window\.VNLH_RAZVOJ\s*=\s*(\d)/', $s, $m)) {
            $c = ((int) $m[1] === 1);
        }
    }
    return $c;
}

/**
 * Jezik korisnika: ['id'=>int, 'kod'=>string, 'master'=>bool].
 * master=true kad je korisnikov jezik = zadani (sustav_jezici.zadani=1) ili nije postavljen/aktivan.
 * Keš po zahtjevu.
 */
function jezik_korisnika(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $idSes = (session_status() === PHP_SESSION_ACTIVE && isset($_SESSION['id_jezik'])) ? (int) $_SESSION['id_jezik'] : 0;

    $db = vnlh_db_connect();
    if ($db === false) {
        return $cache = ['id' => 0, 'kod' => '', 'master' => true];
    }

    $zid = 0;
    $zkod = '';
    if ($r = $db->query("SELECT id, kod FROM sustav_jezici WHERE zadani = 1 LIMIT 1")) {
        if ($row = $r->fetch_assoc()) {
            $zid = (int) $row['id'];
            $zkod = (string) $row['kod'];
        }
    }

    if ($idSes <= 0 || $idSes === $zid) {
        $db->close();
        return $cache = ['id' => $zid, 'kod' => $zkod, 'master' => true];
    }

    $kod = '';
    $ok = false;
    if ($st = $db->prepare("SELECT kod FROM sustav_jezici WHERE id = ? AND aktivan = 1 LIMIT 1")) {
        $st->bind_param('i', $idSes);
        $st->execute();
        $rs = $st->get_result();
        if ($rs && ($row = $rs->fetch_assoc())) {
            $kod = (string) $row['kod'];
            $ok = true;
        }
        $st->close();
    }
    $db->close();

    if (!$ok) {
        return $cache = ['id' => $zid, 'kod' => $zkod, 'master' => true];
    }
    return $cache = ['id' => $idSes, 'kod' => $kod, 'master' => false];
}

/**
 * Rječnik [kljuc => tekst] za jezik korisnika i zadanu formu: global.* + Poruka + ključevi te forme.
 * Master jezik → []. Uvjet: prijevod=1 (+ prijevod_test=1 ako razvoj) i zastarjelo=0 i ključ aktivan.
 * Keš po naziv_fajla unutar zahtjeva.
 */
function jezik_rjecnik(string $naziv_fajla): array
{
    static $cache = [];
    $kkey = strtolower(trim($naziv_fajla));
    if (array_key_exists($kkey, $cache)) {
        return $cache[$kkey];
    }

    $j = jezik_korisnika();
    if ($j['master'] || $j['id'] <= 0) {
        return $cache[$kkey] = [];
    }

    $db = vnlh_db_connect();
    if ($db === false) {
        return $cache[$kkey] = [];
    }

    $uvjetStanje = jezik_je_razvoj() ? "(p.prijevod = 1 OR p.prijevod_test = 1)" : "p.prijevod = 1";
    $sql = "SELECT k.kljuc AS kljuc, p.tekst AS tekst
            FROM sustav_prijevodi p
            JOIN sustav_prijevodi_kljucevi k ON k.id = p.id_kljuc
            WHERE p.id_jezik = ?
              AND p.zastarjelo = 0
              AND $uvjetStanje
              AND k.aktivan = 1
              AND (k.izvor = 'Poruka' OR k.kljuc LIKE 'global.%' OR k.naziv_fajla = ?)";

    $out = [];
    if ($st = $db->prepare($sql)) {
        $st->bind_param('is', $j['id'], $naziv_fajla);
        $st->execute();
        $rs = $st->get_result();
        while ($rs && ($row = $rs->fetch_assoc())) {
            $out[(string) $row['kljuc']] = (string) $row['tekst'];
        }
        $st->close();
    }
    $db->close();

    return $cache[$kkey] = $out;
}

/**
 * PHP prijevod ključa za trenutnu formu (postavlja je jezik_inject_i18n_script). Fallback = $master literal.
 * $params: [1 => 'x', 2 => 'y'] → zamjena {1},{2}.
 */
function jezik_t(string $kljuc, string $master = '', array $params = []): string
{
    $fajl = isset($GLOBALS['jezik_trenutna_forma']) ? (string) $GLOBALS['jezik_trenutna_forma'] : '';
    $rj = ($fajl !== '') ? jezik_rjecnik($fajl) : [];
    $txt = $rj[$kljuc] ?? $master;
    foreach ($params as $k => $v) {
        $txt = str_replace('{' . $k . '}', (string) $v, $txt);
    }
    return $txt;
}

/**
 * Ubacuje inline <script> s window.__I18N__ (rječnik forme), __VNLH_JEZIK__ (kod), __VNLH_JEZIK_MASTER__,
 * __VNLH_RAZVOJ__ — odmah nakon <head>. Za master jezik __I18N__ je {} (literali iz koda).
 * Fragmenti bez <head> se preskaču.
 */
function jezik_inject_i18n_script(string $html, string $naziv_fajla): string
{
    if (stripos($html, '<head>') === false) {
        return $html;
    }
    $GLOBALS['jezik_trenutna_forma'] = $naziv_fajla;

    $j = jezik_korisnika();
    $rj = $j['master'] ? [] : jezik_rjecnik($naziv_fajla);

    $opts = JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS;
    $jsonRj = json_encode($rj, $opts);
    if (!is_string($jsonRj)) {
        $jsonRj = '{}';
    }
    $jsonKod = json_encode($j['kod'], $opts);
    if (!is_string($jsonKod)) {
        $jsonKod = '""';
    }

    $snip = '<script>'
        . 'window.__I18N__=' . $jsonRj . ';'
        . 'window.__VNLH_JEZIK__=' . $jsonKod . ';'
        . 'window.__VNLH_JEZIK_MASTER__=' . ($j['master'] ? 'true' : 'false') . ';'
        . 'window.__VNLH_RAZVOJ__=' . (jezik_je_razvoj() ? '1' : '0') . ';'
        . '</script>';

    $out = preg_replace('/<head>/i', '<head>' . "\n" . $snip, $html, 1);
    return is_string($out) ? $out : $html;
}
