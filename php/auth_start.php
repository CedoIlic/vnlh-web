<?php
/**
 * Jedinstveni session_start za VNLH.
 * gc_maxlifetime 1800 s; kolačić httponly, SameSite=Lax; sliding Max-Age kroz vnlh_refresh_session_cookie().
 */
if (session_status() === PHP_SESSION_NONE) {
    ini_set('session.gc_maxlifetime', '1800');
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    session_set_cookie_params([
        'lifetime' => 1800,
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
 * Produžuje kolačić sesije za još 1800 s (klizno s last_activity).
 */
function vnlh_refresh_session_cookie() {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }
    $p = session_get_cookie_params();
    setcookie(session_name(), session_id(), [
        'expires' => time() + 1800,
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
    $_SESSION['last_activity'] = time();
    $_SESSION['client_ip'] = vnlh_client_ip();
    vnlh_refresh_session_cookie();
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
