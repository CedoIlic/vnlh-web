<?php
require_once __DIR__ . '/require_login_api.php';
// Alati_LogPass_Ini_CRUD_sve.php – lista sustav_korisnici za Login-pass administracija.
// GET → JSON [ { id_korisnik, id_duznosnik, prikaz, ime, prezime, login, pass, pass_status, login_neuspjesni_pokusaji }, ... ]
// pass: sadržaj stupca pass iz baze (npr. hash ili čisti tekst) za punjenje forme.

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo $db_ret;
    exit;
}

$sql = 'SELECT sk.id_korisnik, sk.id_duznosnik, sk.login, sk.pass, sk.pass_status,
               sk.login_neuspjesni_pokusaji,
               c.prezime, c.ime, d.naziv AS duznost_naziv
        FROM sustav_korisnici sk
        LEFT JOIN clanovi c ON c.id = sk.id_korisnik
        LEFT JOIN duznosnici d ON d.id = sk.id_duznosnik
        ORDER BY c.prezime ASC, c.ime ASC, d.naziv ASC';

$result = $mysqli->query($sql);
if (!$result) {
    header('Content-Type: text/plain; charset=utf-8');
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}

$out = [];
while ($row = $result->fetch_assoc()) {
    $prez = isset($row['prezime']) ? trim((string) $row['prezime']) : '';
    $ime = isset($row['ime']) ? trim((string) $row['ime']) : '';
    $dz = isset($row['duznost_naziv']) ? trim((string) $row['duznost_naziv']) : '';
    $prikaz = $prez . ', ' . $ime . ', ' . $dz;

    $ps = $row['pass_status'];
    if ($ps === null || $ps === '') {
        $passStatus = null;
    } else {
        $passStatus = (int) $ps;
    }

    $lg = isset($row['login']) && $row['login'] !== null ? trim((string) $row['login']) : '';
    if (strtoupper($lg) === 'NULL') {
        $lg = '';
    }

    $passCol = $row['pass'] ?? null;
    if ($passCol === null) {
        $passOut = '';
    } else {
        $passOut = (string) $passCol;
        if (strtoupper(trim($passOut)) === 'NULL') {
            $passOut = '';
        }
    }

    $lf = isset($row['login_neuspjesni_pokusaji']) && $row['login_neuspjesni_pokusaji'] !== null
        ? (int) $row['login_neuspjesni_pokusaji']
        : 0;

    $out[] = [
        'id_korisnik' => (int) $row['id_korisnik'],
        'id_duznosnik' => (int) $row['id_duznosnik'],
        'prikaz' => $prikaz,
        'ime' => $ime,
        'prezime' => $prez,
        'login' => $lg,
        'pass' => $passOut,
        'pass_status' => $passStatus,
        'login_neuspjesni_pokusaji' => $lf,
    ];
}

$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($out, JSON_UNESCAPED_UNICODE);
