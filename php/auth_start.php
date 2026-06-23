<?php
/**
 * Jedinstveni session_start za VNLH.
 * Trajanje kolačića / gc iz sustav_varijable id 112 (sesija_pracenje_aktivnosti_*); klizno produženje kroz vnlh_refresh_session_cookie().
 */
if (session_status() === PHP_SESSION_NONE) {
    require_once __DIR__ . '/sesija_pracenje_aktivnosti_lib.php';
    $cookieLife = sesija_pracenje_aktivnosti_cookie_max_age_pri_startu();
    $gcLife = max(120, $cookieLife + 30);
    ini_set('session.gc_maxlifetime', (string) $gcLife);
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params([
        'lifetime' => $cookieLife,
        'path' => '/',
        'domain' => '',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

/**
 * IPv6 loopback (::1) i IPv4-mapped (::ffff:a.b.c.d) pretvara u čitljiv IPv4 gdje ima smisla.
 * Ostale adrese ostaju nepromijenjene (puni IPv6 u produkciji).
 */
function vnlh_client_ip_normaliziraj(string $ip): string {
    $ip = trim($ip);
    if ($ip === '') {
        return '';
    }
    if ($ip === '::1') {
        return '127.0.0.1';
    }
    if (stripos($ip, '::ffff:') === 0) {
        $v4 = substr($ip, 7);
        if (filter_var($v4, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            return $v4;
        }
    }
    return $ip;
}

/**
 * IP klijenta za ovaj zahtjev.
 * Koristi isključivo REMOTE_ADDR – nije podložan lažiranju putem HTTP headera.
 * Rezultat se normalizira (::1 → 127.0.0.1, ::ffff:… → IPv4).
 */
function vnlh_client_ip(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    $raw = is_string($ip) ? trim($ip) : '';
    return vnlh_client_ip_normaliziraj($raw);
}

/**
 * Produžuje kolačić sesije za još session_timeout_sec (iz baze, cache; klizno s last_activity / pingom).
 */
function vnlh_refresh_session_cookie() {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }
    require_once __DIR__ . '/sesija_pracenje_aktivnosti_lib.php';
    $life = sesija_pracenje_aktivnosti_cookie_max_age_cached();
    $p = session_get_cookie_params();
    setcookie(session_name(), session_id(), [
        'expires' => time() + $life,
        'path' => $p['path'] ?: '/',
        'domain' => $p['domain'] ?? '',
        'secure' => $p['secure'] ?? false,
        'httponly' => $p['httponly'] ?? true,
        'samesite' => $p['samesite'] ?? 'Lax',
    ]);
}

/**
 * Blok sesije nakon uspješnog logiranja: nova ID sesije, korisnik, dužnosnik, last_activity (idle), osvježeni kolačić.
 * Zaštita od fixation-a: session_regenerate_id(true).
 */
function vnlh_establish_login_session(int $idKorisnik, int $idDuznosnik): void {
    session_regenerate_id(true);
    $_SESSION['id_korisnik'] = $idKorisnik;
    $_SESSION['id_duznosnik'] = $idDuznosnik;
    /* Popunjava se iz duznosnici.razina kad je poznata dužnost (vnlh_session_postavi_razinu_za_duznosnika). */
    $_SESSION['id_duznosnik_razina'] = 0;
    $_SESSION['last_activity'] = time();
    $_SESSION['client_ip'] = vnlh_client_ip();
    /* Jezik sučelja korisnika (i18n); 0/NULL = zadani jezik aplikacije (master). */
    $_SESSION['id_jezik'] = vnlh_login_id_jezik_korisnika($idKorisnik);
    vnlh_refresh_session_cookie();
}

/**
 * id_jezik korisnika iz sustav_korisnici_login (0 ako nema kolone/retka/vrijednosti → zadani jezik).
 * prepare() vraća false ako kolona još ne postoji (prije ALTER-a) → graciozno 0.
 */
function vnlh_login_id_jezik_korisnika(int $idKorisnik): int {
    if ($idKorisnik <= 0) {
        return 0;
    }
    require_once __DIR__ . '/vnlh_db_connect.php';
    $db = vnlh_db_connect();
    if ($db === false) {
        return 0;
    }
    $idJezik = 0;
    try {
        if ($st = $db->prepare("SELECT id_jezik FROM sustav_korisnici_login WHERE id_korisnik = ? LIMIT 1")) {
            $st->bind_param('i', $idKorisnik);
            $st->execute();
            $rs = $st->get_result();
            if ($rs && ($row = $rs->fetch_assoc())) {
                $idJezik = (int) ($row['id_jezik'] ?? 0);
            }
            $st->close();
        }
    } catch (\Throwable $e) {
        $idJezik = 0; // kolona još ne postoji (prije ALTER-a) ili DB greška → zadani jezik
    }
    $db->close();
    return $idJezik;
}

/**
 * Uništava sesiju i kolačić (odjava) – npr. nakon blokade pri promjeni lozinke.
 * U sustav_sesije_aktivne retak se označava statusom logout (ne briše se).
 */
function vnlh_session_destroy_logout(): void {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }
    $sidLogout = session_id();
    $uidLogout = isset($_SESSION['id_korisnik']) ? (int) $_SESSION['id_korisnik'] : 0;
    if ($sidLogout !== '' && $uidLogout > 0) {
        require_once __DIR__ . '/Alati_Sesije_Aktivne.php';
        Alati_Sesije_Aktivne_mark_logout_for_session($sidLogout, $uidLogout);
    }
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
}
