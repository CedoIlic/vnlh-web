<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_001_CRUD_jedan.php – dohvat Obrasca 001a kandidata po id_clan (1:1).
// GET id_clan. Vraća JSON:
//   { id_clan, id (red u kandidat_dokumenti_001|null), postoji (bool),
//     polja obrasca (mjesto_rodjenja, drzava_rodjenja, ...),
//     ro: { prezime, ime, spol, oib, datum_rodjenja, ulica, grad, posta, drzava, telefon } }
// RO podaci (Osobni + Boravište) iz clanovi/adrese/telefoni (primarni tip = 1) — samo za prikaz.

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$id_clan = isset($_GET['id_clan']) ? (int) $_GET['id_clan'] : 0;
header('Content-Type: application/json; charset=utf-8');
if ($id_clan <= 0) {
    echo json_encode(['id_clan' => 0, 'postoji' => false], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $sql = "SELECT
                c.prezime, c.ime, c.spol, c.oib, c.datum_rodjenja,
                (SELECT a.adresa_1 FROM adrese a INNER JOIN adrese_tip at2 ON at2.id = a.id_adrese_tip AND at2.`Tip` = 1 WHERE a.id_clanovi = c.id LIMIT 1) AS ulica,
                (SELECT a.adresa_2 FROM adrese a INNER JOIN adrese_tip at2 ON at2.id = a.id_adrese_tip AND at2.`Tip` = 1 WHERE a.id_clanovi = c.id LIMIT 1) AS ulica2,
                (SELECT a.grad FROM adrese a INNER JOIN adrese_tip at2 ON at2.id = a.id_adrese_tip AND at2.`Tip` = 1 WHERE a.id_clanovi = c.id LIMIT 1) AS grad,
                (SELECT a.posta FROM adrese a INNER JOIN adrese_tip at2 ON at2.id = a.id_adrese_tip AND at2.`Tip` = 1 WHERE a.id_clanovi = c.id LIMIT 1) AS posta,
                (SELECT da.naziv FROM adrese a INNER JOIN adrese_tip at2 ON at2.id = a.id_adrese_tip AND at2.`Tip` = 1 LEFT JOIN drzave_adresa da ON da.id = a.id_drzave_adrese WHERE a.id_clanovi = c.id LIMIT 1) AS drzava,
                (SELECT t.telefon FROM telefoni t INNER JOIN telefoni_tip tt ON tt.id = t.id_telefoni_tip AND tt.`Tip` = 1 WHERE t.id_clanovi = c.id LIMIT 1) AS telefon,
                k.id AS k_id, k.mjesto_rodjenja, k.drzava_rodjenja, k.drzavljanstvo, k.zvanje, k.zanimanje,
                k.gradjanski_status, k.broj_djece, k.poznavanje_jezika, k.pocasni_naslovi,
                k.dijete_masona, k.veza_masoni, k.zahtjev_druga_loza, k.primljen_iniciran,
                k.datum_dokumenta, k.dokument_prored
            FROM clanovi c
            LEFT JOIN kandidat_dokumenti_001 k ON k.id_clan = c.id
            WHERE c.id = ? LIMIT 1";
    $stmt = $mysqli->prepare($sql);
    $stmt->bind_param('i', $id_clan);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res->fetch_assoc();
    $stmt->close();

    if (!$row) {
        echo json_encode(['id_clan' => $id_clan, 'postoji' => false], JSON_UNESCAPED_UNICODE);
        $mysqli->close();
        exit;
    }

    $postoji = ($row['k_id'] !== null);
    $out = [
        'id_clan' => $id_clan,
        'id'      => $postoji ? (int) $row['k_id'] : null,
        'postoji' => $postoji,
        // Polja obrasca (null kad zapis ne postoji).
        'mjesto_rodjenja'    => $row['mjesto_rodjenja'],
        'drzava_rodjenja'    => $row['drzava_rodjenja'],
        'drzavljanstvo'      => $row['drzavljanstvo'],
        'zvanje'             => $row['zvanje'],
        'zanimanje'          => $row['zanimanje'],
        'gradjanski_status'  => $row['gradjanski_status'],
        'broj_djece'         => ($row['broj_djece'] !== null) ? (int) $row['broj_djece'] : null,
        'poznavanje_jezika'  => $row['poznavanje_jezika'],
        'pocasni_naslovi'    => $row['pocasni_naslovi'],
        'dijete_masona'      => ($row['dijete_masona'] !== null) ? (int) $row['dijete_masona'] : 0,
        'veza_masoni'        => ($row['veza_masoni'] !== null) ? (int) $row['veza_masoni'] : 0,
        'zahtjev_druga_loza' => ($row['zahtjev_druga_loza'] !== null) ? (int) $row['zahtjev_druga_loza'] : 0,
        'primljen_iniciran'  => $row['primljen_iniciran'],
        'datum_dokumenta'    => $row['datum_dokumenta'],
        'dokument_prored'    => $row['dokument_prored'],
        // Samo prikaz (RO) — iz kandidata.
        'ro' => [
            'prezime'        => $row['prezime'],
            'ime'            => $row['ime'],
            'spol'           => (int) $row['spol'],
            'oib'            => $row['oib'],
            'datum_rodjenja' => $row['datum_rodjenja'],
            'ulica'          => $row['ulica'],
            'ulica2'         => $row['ulica2'],
            'grad'           => $row['grad'],
            'posta'          => $row['posta'],
            'drzava'         => $row['drzava'],
            'telefon'        => $row['telefon'],
        ],
    ];
    echo json_encode($out, JSON_UNESCAPED_UNICODE);
} catch (mysqli_sql_exception $e) {
    echo json_encode(['greska' => '200,' . $e->getCode()], JSON_UNESCAPED_UNICODE);
}

$mysqli->close();
