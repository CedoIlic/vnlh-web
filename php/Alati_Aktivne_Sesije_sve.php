<?php
/**
 * Alati_Aktivne_Sesije_sve.php – lista sustav_sesije_aktivne s imenom korisnika (clanovi).
 * GET → JSON niz objekata za formu Aktivne sesije.
 * Sortiranje: prvo sve aktivne sesije (status = aktivna), zatim neaktivne (timeout, logout);
 * unutar skupine zadnja_aktivnost DESC. Tablica u JS-u nema korisničku promjenu sorta.
 */
require_once __DIR__ . '/require_login_api.php';

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo $db_ret;
    exit;
}

require_once __DIR__ . '/Alati_Sesije_Aktivne.php';
Alati_Sesije_Aktivne_reconcile_timeout_stale_aktivne($mysqli);

/**
 * Format datuma za prikaz u tablici (hr).
 */
function vnlh_aktivne_sesije_fmt_dt(?string $s): string
{
    if ($s === null || $s === '') {
        return '';
    }
    $t = strtotime($s);
    if ($t === false) {
        return $s;
    }
    return date('d.m.Y H:i:s', $t);
}

$sql = 'SELECT s.id, s.id_korisnik, s.session_id, s.login_vrijeme, s.zadnja_aktivnost,
               s.otvorena_stranica, s.povijest_sesije, s.ip_adresa, s.user_agent, s.status,
               TRIM(CONCAT(COALESCE(c.prezime, \'\'), \' \', COALESCE(c.ime, \'\'))) AS korisnik_prikaz
        FROM sustav_sesije_aktivne s
        LEFT JOIN clanovi c ON c.id = s.id_korisnik
        ORDER BY CASE WHEN s.status = \'aktivna\' THEN 0 ELSE 1 END, s.zadnja_aktivnost DESC';

$result = $mysqli->query($sql);
if (!$result) {
    header('Content-Type: text/plain; charset=utf-8');
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}

$out = [];
while ($row = $result->fetch_assoc()) {
    $lv = $row['login_vrijeme'] ?? null;
    $za = $row['zadnja_aktivnost'] ?? null;
    $out[] = [
        'id' => (int) $row['id'],
        'id_korisnik' => (int) $row['id_korisnik'],
        'session_id' => isset($row['session_id']) ? (string) $row['session_id'] : '',
        'login_vrijeme' => $lv !== null ? (string) $lv : '',
        'zadnja_aktivnost' => $za !== null ? (string) $za : '',
        'login_vrijeme_fmt' => vnlh_aktivne_sesije_fmt_dt($lv !== null ? (string) $lv : null),
        'zadnja_aktivnost_fmt' => vnlh_aktivne_sesije_fmt_dt($za !== null ? (string) $za : null),
        'otvorena_stranica' => isset($row['otvorena_stranica']) && $row['otvorena_stranica'] !== null ? (string) $row['otvorena_stranica'] : '',
        'povijest_sesije' => isset($row['povijest_sesije']) && $row['povijest_sesije'] !== null ? (string) $row['povijest_sesije'] : '',
        'ip_adresa' => isset($row['ip_adresa']) && $row['ip_adresa'] !== null ? (string) $row['ip_adresa'] : '',
        'user_agent' => isset($row['user_agent']) && $row['user_agent'] !== null ? (string) $row['user_agent'] : '',
        'status' => isset($row['status']) ? (string) $row['status'] : '',
        'korisnik_prikaz' => isset($row['korisnik_prikaz']) ? trim((string) $row['korisnik_prikaz']) : '',
    ];
}

$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($out, JSON_UNESCAPED_UNICODE);
