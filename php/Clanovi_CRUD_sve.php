<?php
require_once __DIR__ . '/require_login_api.php';
// Clanovi_CRUD_sve.php – dohvat članova za ložu (bez blob kolona). GET id_loza.
// id_obred: obred lože (isti za sve članove u retku – za Napredovanja_CRUD i sl.).
// Vraća stupanj_show iz stupnjevi; telefon_text, email_text, adresa_* mogu se dodati JOIN-om na telefoni, e_maili, adrese.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$id_loza = isset($_GET['id_loza']) ? (int)$_GET['id_loza'] : 0;
if ($id_loza <= 0) {
    header('Content-Type: application/json');
    echo '[]';
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
            c.slika_thumb_round_position,
            s.stupanj AS stupanj_show,
            l.id_obred AS id_obred,
            (SELECT t2.telefon FROM telefoni t2 INNER JOIN telefoni_tip tt ON tt.id = t2.id_telefoni_tip AND tt.`Tip` = 1 WHERE t2.id_clanovi = c.id LIMIT 1) AS telefon_text,
            (SELECT e2.email FROM e_maili e2 INNER JOIN email_tip et ON et.id = e2.id_email_tip AND et.`Tip` = 1 WHERE e2.id_clanovi = c.id LIMIT 1) AS email_text,
            (SELECT a2.adresa_1 FROM adrese a2 INNER JOIN adrese_tip at2 ON at2.id = a2.id_adrese_tip AND at2.`Tip` = 1 WHERE a2.id_clanovi = c.id LIMIT 1) AS adresa_1,
            (SELECT a2.adresa_2 FROM adrese a2 INNER JOIN adrese_tip at2 ON at2.id = a2.id_adrese_tip AND at2.`Tip` = 1 WHERE a2.id_clanovi = c.id LIMIT 1) AS adresa_2,
            (SELECT a2.grad FROM adrese a2 INNER JOIN adrese_tip at2 ON at2.id = a2.id_adrese_tip AND at2.`Tip` = 1 WHERE a2.id_clanovi = c.id LIMIT 1) AS adresa_grad,
            (SELECT a2.posta FROM adrese a2 INNER JOIN adrese_tip at2 ON at2.id = a2.id_adrese_tip AND at2.`Tip` = 1 WHERE a2.id_clanovi = c.id LIMIT 1) AS adresa_posta,
            (SELECT a2.id_drzave_adrese FROM adrese a2 INNER JOIN adrese_tip at2 ON at2.id = a2.id_adrese_tip AND at2.`Tip` = 1 WHERE a2.id_clanovi = c.id LIMIT 1) AS id_drzava_adrese,
            (SELECT po.datum_od FROM clanovi_privremeni_otpust po WHERE po.id_clan = c.id AND po.datum_od <= CURDATE() AND po.datum_do >= CURDATE() ORDER BY po.datum_od DESC LIMIT 1) AS otpust_od,
            (SELECT po.datum_do FROM clanovi_privremeni_otpust po WHERE po.id_clan = c.id AND po.datum_od <= CURDATE() AND po.datum_do >= CURDATE() ORDER BY po.datum_od DESC LIMIT 1) AS otpust_do,
            l.grad AS loza_grad
        FROM clanovi c
        LEFT JOIN stupnjevi s ON s.id = c.stupanj
        LEFT JOIN loze l ON l.id = c.loza
        WHERE c.loza = ?
          AND NOT (c.aktivnost = 0 AND c.kandidat = 0)
        ORDER BY c.prezime ASC, c.ime ASC";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id_loza);
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
