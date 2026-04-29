<?php
require_once __DIR__ . '/require_login_api.php';
/**
 * Zapisnik prisustvo — „svi članovi obedijencije” kad je radovi_prisustvo_tip.svi_clanovi_obedijncije = 1.
 * Dohvat: svi redovi iz `clanovi` s aktivnost = 1 i kandidat = 0.
 * Izlaz: isti oblik polja kao Clanovi_CRUD_sve_loze.php (JSON niz asoc. redova) da Zapisnik_CRUD.js
 * može isti format/haystack/filtar koristiti bez posebne grane za prikaz.
 */
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$sql = "SELECT
            c.id,
            c.sifra,
            c.loza,
            c.prezime,
            c.ime,
            c.spol,
            c.datum_rodjenja,
            c.oib,
            c.datum_inicijacije,
            c.porijeklo,
            c.stupanj,
            c.datum_stupnja,
            c.telefon,
            c.e_mail,
            c.adresa,
            c.na_prijedlog,
            m.prezime AS na_prijedlog_prezime,
            m.ime AS na_prijedlog_ime,
            c.napomena,
            c.aktivnost,
            c.kandidat,
            c.zastavice,
            c.upisano,
            c.slika_thumb_round_position,
            s.stupanj AS stupanj_show,
            s.stupanj AS stupanj_broj,
            s.naziv AS stupanj_naziv,
            (SELECT t2.telefon FROM telefoni t2 INNER JOIN telefoni_tip tt ON tt.id = t2.id_telefoni_tip AND tt.`Tip` = 1 WHERE t2.id_clanovi = c.id ORDER BY t2.id ASC LIMIT 1) AS telefon_text,
            (SELECT e2.email FROM e_maili e2 INNER JOIN email_tip et ON et.id = e2.id_email_tip AND et.`Tip` = 1 WHERE e2.id_clanovi = c.id ORDER BY e2.id ASC LIMIT 1) AS email_text,
            (SELECT a2.adresa_1 FROM adrese a2 INNER JOIN adrese_tip at2 ON at2.id = a2.id_adrese_tip AND at2.`Tip` = 1 WHERE a2.id_clanovi = c.id ORDER BY a2.id ASC LIMIT 1) AS adresa_1,
            (SELECT a2.adresa_2 FROM adrese a2 INNER JOIN adrese_tip at2 ON at2.id = a2.id_adrese_tip AND at2.`Tip` = 1 WHERE a2.id_clanovi = c.id ORDER BY a2.id ASC LIMIT 1) AS adresa_2,
            (SELECT a2.grad FROM adrese a2 INNER JOIN adrese_tip at2 ON at2.id = a2.id_adrese_tip AND at2.`Tip` = 1 WHERE a2.id_clanovi = c.id ORDER BY a2.id ASC LIMIT 1) AS adresa_grad,
            (SELECT a2.posta FROM adrese a2 INNER JOIN adrese_tip at2 ON at2.id = a2.id_adrese_tip AND at2.`Tip` = 1 WHERE a2.id_clanovi = c.id ORDER BY a2.id ASC LIMIT 1) AS adresa_posta,
            (SELECT a2.id_drzave_adrese FROM adrese a2 INNER JOIN adrese_tip at2 ON at2.id = a2.id_adrese_tip AND at2.`Tip` = 1 WHERE a2.id_clanovi = c.id ORDER BY a2.id ASC LIMIT 1) AS id_drzava_adrese,
            l.grad AS loza_grad,
            l.naziv AS loza_naziv,
            l.id_obred AS id_obred,
            obr.naziv AS obred_naziv,
            d_loza.naziv AS drzava_loze
        FROM clanovi c
        LEFT JOIN stupnjevi s ON s.id = c.stupanj
        LEFT JOIN loze l ON l.id = c.loza
        LEFT JOIN obredi obr ON obr.id = l.id_obred
        LEFT JOIN drzave d_loza ON d_loza.id = l.id_drzava
        LEFT JOIN clanovi m ON m.id = c.na_prijedlog
        WHERE c.aktivnost = 1 AND c.kandidat = 0
        ORDER BY c.prezime ASC, c.ime ASC";

$result = $mysqli->query($sql);
if (!$result) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
