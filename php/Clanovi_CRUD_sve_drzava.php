<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_CRUD_sve_drzava.php – dohvat članova za jednu ili više država (bez blob kolona). GET id_drzava (broj ili zarezom odvojeni id-evi).
// Isti izlaz kao Clanovi_CRUD_sve.php, filtrirano po koloni clanovi.drzava.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$raw = isset($_GET['id_drzava']) ? trim((string)$_GET['id_drzava']) : '';
$id_list = [];
if (strpos($raw, ',') !== false) {
    foreach (array_map('trim', explode(',', $raw)) as $part) {
        $id = (int) $part;
        if ($id > 0) $id_list[] = $id;
    }
} else {
    $id = (int) $raw;
    if ($id > 0) $id_list[] = $id;
}
if (count($id_list) === 0) {
    header('Content-Type: application/json');
    echo '[]';
    exit;
}

$placeholders = implode(',', array_fill(0, count($id_list), '?'));
$sql = "SELECT
            c.id,
            c.sifra,
            c.loza,
            c.prezime,
            c.ime,
            c.spol,
            c.datum_rodjenja,
            c.oib,
            c.datum_ulaska_lozu,
            c.datum_izlaska_pokrivanja,
            c.datum_inicijacije,
            c.porijeklo,
            c.stupanj,
            c.datum_stupnja,
            c.telefon,
            c.e_mail,
            c.adresa,
            c.na_prijedlog,
            c.napomena,
            c.aktivnost,
            c.kandidat,
            c.zastavice,
            c.upisano,
            s.stupanj AS stupanj_show,
            t.telefon AS telefon_text,
            em.email AS email_text,
            a.adresa_1,
            a.adresa_2,
            a.grad AS adresa_grad,
            a.posta AS adresa_posta,
            a.id_drzave_adrese AS id_drzava_adrese,
            l.id_obred AS id_obred
        FROM clanovi c
        LEFT JOIN stupnjevi s ON s.id = c.stupanj
        LEFT JOIN telefoni t ON t.id = c.telefon
        LEFT JOIN e_maili em ON em.id = c.e_mail
        LEFT JOIN adrese a ON a.id = c.adresa
        LEFT JOIN loze l ON l.id = c.loza
        WHERE c.drzava IN ($placeholders)
        ORDER BY c.prezime ASC, c.ime ASC";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$bind_types = str_repeat('i', count($id_list));
$stmt->bind_param($bind_types, ...$id_list);
$stmt->execute();
$result = $stmt->get_result();
$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
}
$stmt->close();
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
