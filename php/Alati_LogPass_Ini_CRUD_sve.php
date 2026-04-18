<?php
require_once __DIR__ . '/require_login_api.php';
// Alati_LogPass_Ini_CRUD_sve.php – lista sustav_korisnici_login (jedan red po korisniku) za Login-pass administracija.
// GET → JSON [ { id_korisnik, id_duznosnik: 0, prikaz, ime, prezime, login, pass, pass_status, login_neuspjesni_pokusaji }, ... ]
// prikaz: „prezime, ime, dužnost1, dužnost2, …” (više dužnosti odvojeno zarezom i razmakom).
// pass: sadržaj stupca pass iz baze (npr. hash) za punjenje forme.

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo $db_ret;
    exit;
}

$sql = 'SELECT l.id_korisnik, l.login, l.pass, l.pass_status, l.login_neuspjesni_pokusaji,
               c.prezime, c.ime,
               (SELECT GROUP_CONCAT(DISTINCT d.naziv ORDER BY d.naziv SEPARATOR \', \')
                  FROM sustav_korisnici sk
                  INNER JOIN duznosnici d ON d.id = sk.id_duznosnik
                 WHERE sk.id_korisnik = l.id_korisnik) AS duznosti_txt
          FROM sustav_korisnici_login l
          LEFT JOIN clanovi c ON c.id = l.id_korisnik
          ORDER BY c.prezime ASC, c.ime ASC';

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
    $dzAgg = isset($row['duznosti_txt']) ? trim((string) $row['duznosti_txt']) : '';
    $prikaz = $prez . ', ' . $ime;
    if ($dzAgg !== '') {
        $prikaz .= ', ' . $dzAgg;
    }

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
        'id_duznosnik' => 0,
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
