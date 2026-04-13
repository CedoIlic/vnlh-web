<?php
require_once __DIR__ . '/require_login_api.php';
// Sustav_korisnici_modal_pregled.php – pregled dužnosti i korisnika (sustav_korisnici) za modal.
// GET bez parametara. JSON: [ { id_duznosnik, duznost_naziv, osobe_txt }, ... ] – jedan red po dužnosti.
// U osobe_txt svaka osoba: „prezime, ime“ [, loža] [, grad lože] (samo ne-prazni dijelovi, odvojeni „, „); više osoba odvojeno „; „.

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo $db_ret;
    exit;
}

// --- Blok: Svi dužnosnici ---
$resD = $mysqli->query('SELECT id, naziv FROM duznosnici ORDER BY naziv ASC');
if (!$resD) {
    header('Content-Type: text/plain; charset=utf-8');
    echo '200,' . $mysqli->errno;
    exit;
}
$duznosnici = [];
while ($row = $resD->fetch_assoc()) {
    $duznosnici[] = $row;
}

// --- Blok: Mapa id_duznosnik -> id_korisnik -> tekst prikaza osobe ---
$byDuz = [];
$resS = $mysqli->query(
    'SELECT sk.id_duznosnik, sk.id_korisnik, sk.login, c.prezime, c.ime,
            l.naziv AS loza_naziv, l.grad AS loza_grad
     FROM sustav_korisnici sk
     LEFT JOIN clanovi c ON c.id = sk.id_korisnik
     LEFT JOIN loze l ON l.id = c.loza'
);
if ($resS) {
    while ($r = $resS->fetch_assoc()) {
        $idD = (int) $r['id_duznosnik'];
        $idK = (int) $r['id_korisnik'];
        $prez = isset($r['prezime']) ? trim((string) $r['prezime']) : '';
        $ime = isset($r['ime']) ? trim((string) $r['ime']) : '';
        $segs = [];
        if ($prez !== '' || $ime !== '') {
            $segs[] = ($prez === '') ? $ime : (($ime === '') ? $prez : $prez . ', ' . $ime);
        } else {
            $login = isset($r['login']) ? trim((string) $r['login']) : '';
            $segs[] = ($login !== '') ? $login : ('#' . $idK);
        }
        $ln = isset($r['loza_naziv']) ? trim((string) $r['loza_naziv']) : '';
        $lg = isset($r['loza_grad']) ? trim((string) $r['loza_grad']) : '';
        if ($ln !== '') {
            $segs[] = $ln;
        }
        if ($lg !== '') {
            $segs[] = $lg;
        }
        $txt = implode(', ', $segs);
        if (!isset($byDuz[$idD])) {
            $byDuz[$idD] = [];
        }
        $byDuz[$idD][$idK] = $txt;
    }
}

// --- Blok: Izlaz – sve dužnosti, desno spojeni korisnici ---
$out = [];
foreach ($duznosnici as $d) {
    $idD = (int) $d['id'];
    $parts = isset($byDuz[$idD]) ? array_values($byDuz[$idD]) : [];
    $out[] = [
        'id_duznosnik' => $idD,
        'duznost_naziv' => $d['naziv'] !== null ? (string) $d['naziv'] : '',
        'osobe_txt' => implode('; ', $parts),
    ];
}

$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($out, JSON_UNESCAPED_UNICODE);
