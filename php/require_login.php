<?php
/**
 * Zaštita HTML/PHP stranica: valjana sesija + najviše 1800 s neaktivnosti.
 *
 * Nakon osnovnih provjera (prijava, lozinka, baza, idle) slijedi provjera menija:
 * izvršna skripta mora odgovarati dopuštenoj stavci (html_fajl u $_SESSION['vnlh_meni_dopustene']),
 * osim eksplicitno navedenih izuzetaka u bloku ispod (Meni.php, index.php, test.php, te
 * php/0-Obrada_Slike.php – vidi komentar uz taj uvjet).
 *
 * Novi PHP koji samo servira HTML fragment za fetch/XHR (nije stavka menija) mora biti
 * dodan u isti izuzetak ili učitavati šablon drugačije; inače preglednik dobije 302 na Meni.php
 * umjesto fragmenta.
 */
require_once __DIR__ . '/auth_start.php';
require_once __DIR__ . '/vnlh_paths.php';

define('VNLH_SESSION_IDLE_SECONDS', 1800);

if (!isset($_SESSION['id_korisnik']) || !is_numeric($_SESSION['id_korisnik']) || (int) $_SESSION['id_korisnik'] <= 0) {
    $ref = $_SERVER['REQUEST_URI'] ?? '';
    header('Location: ' . vnlh_login_path($ref));
    exit;
}

if (!empty($_SESSION['must_change_password'])) {
    header('Location: ' . vnlh_login_path(null));
    exit;
}

require_once __DIR__ . '/vnlh_db_connect.php';
require_once __DIR__ . '/vnlh_login_failures.php';
$vnlhAuthDb = vnlh_db_connect();
if ($vnlhAuthDb === false) {
    header('Location: ' . vnlh_login_path(null));
    exit;
}
if (!vnlh_auth_user_may_access($vnlhAuthDb, (int) $_SESSION['id_korisnik'])) {
    vnlh_session_destroy_logout();
    $vnlhAuthDb->close();
    header('Location: ' . vnlh_login_path(null));
    exit;
}
$vnlhAuthDb->close();

/** Stare sesije bez popisa: jedan dohvat kao pri prijavi (isti SQL kao meni). */
if (!isset($_SESSION['vnlh_meni_dopustene']) && isset($_SESSION['id_duznosnik'])) {
    $dbMeniSes = vnlh_db_connect();
    if ($dbMeniSes !== false) {
        require_once __DIR__ . '/meni_za_sesiju.php';
        $_SESSION['vnlh_meni_dopustene'] = meni_za_sesiju_ucitaj_dopustene($dbMeniSes, (int) $_SESSION['id_duznosnik']);
        $dbMeniSes->close();
    }
}

require_once __DIR__ . '/Alati_Sesije_Aktivne.php';
Alati_Sesije_Aktivne_odjava_ako_red_timeout('html');

$now = time();
if (isset($_SESSION['last_activity']) && ($now - (int) $_SESSION['last_activity'] > VNLH_SESSION_IDLE_SECONDS)) {
    require_once __DIR__ . '/Alati_Sesije_Aktivne.php';
    Alati_Sesije_Aktivne_mark_timeout_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $p['path'] ?: '/',
            'domain' => $p['domain'] ?? '',
            'secure' => $p['secure'] ?? false,
            'httponly' => $p['httponly'] ?? true,
            'samesite' => $p['samesite'] ?? 'Lax',
        ]);
    }
    session_destroy();
    header('Location: ' . vnlh_login_path(null));
    exit;
}

/*
 * --- Provjera skripte naspram menija (dopuštene stranice) ---
 *
 * Za većinu php/*.php očekuje se da basename skripte odgovara jednoj od stavki menija
 * (npr. Clanovi_CRUD.php → Clanovi_CRUD.html u tablici meni). Ako ne odgovara, redirect na Meni.php.
 *
 * Izuzeci (ne ulaze u petlju $allowed / $wantHtml):
 * - Meni.php, index.php, test.php – ulazne točke, nisu „stranica forme“.
 * - 0-Obrada_Slike.php – ne učitava cijelu stranicu nego samo HTML fragment modala obrade slike
 *   (readfile html/0-Obrada_Slike.html). Učitava ga 0-Obrada_Slike.js preko fetch(); nije u meniju
 *   kao zasebna stavka. Bez ovog izuzetka fetch bi slijedio 302 na Meni.php i modal bi se ne pokrenuo.
 *   Zaštita: ista valjana sesija i ostale provjere u ovom fajlu kao za ostale stranice.
 * - 0-Poruke.php – HTML fragment modala za sustav poruka (readfile html/0-Poruke.html).
 *   Učitava ga 0-Poruke.js preko fetch(); globalni modal, nije stavka menija.
 *
 * Kad dodaješ novi sličan „fragment“ endpoint, ili ga dodaj u ovaj uvjet (uz komentar), ili
 * uključi šablon u glavnu HTML stranicu da ne treba zaseban PHP.
 */
$scriptBase = basename($_SERVER['SCRIPT_NAME'] ?? '');
if ($scriptBase !== 'Meni.php' && $scriptBase !== 'index.php' && $scriptBase !== 'test.php' && $scriptBase !== '0-Obrada_Slike.php' && $scriptBase !== '0-Poruke.php') {
    $allowed = isset($_SESSION['vnlh_meni_dopustene']) && is_array($_SESSION['vnlh_meni_dopustene'])
        ? $_SESSION['vnlh_meni_dopustene'] : [];
    $wantHtml = preg_replace('/\.php$/i', '.html', $scriptBase);
    $ok = false;
    foreach ($allowed as $item) {
        if (!is_array($item)) {
            continue;
        }
        $hf = isset($item['html_fajl']) ? strtolower(trim((string) $item['html_fajl'])) : '';
        if ($hf !== '' && ($hf === strtolower($wantHtml) || $hf === strtolower($scriptBase))) {
            $ok = true;
            break;
        }
    }
    if (!$ok) {
        header('Location: Meni.php', true, 302);
        exit;
    }
}

$_SESSION['last_activity'] = $now;
vnlh_refresh_session_cookie();

Alati_Sesije_Aktivne_touch_request();
