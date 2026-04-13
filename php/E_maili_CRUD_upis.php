<?php
require_once __DIR__ . '/require_login_api.php';
// E_maili_CRUD_upis.php – upis novog e-maila za člana.
// POST: id_clanovi (obavezno), id_email_tip (obavezno), email (obavezno).
// Ako je tip primarni (Tip = 1): najprije se brišu svi postojeći e-mailovi s tim tipom za tog člana, zatim se upisuje novi.
// Izlaz (TEXT): OK | 105 | 200,errno

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$id_clanovi = isset($_POST['id_clanovi']) ? (int)$_POST['id_clanovi'] : 0;
$id_email_tip = isset($_POST['id_email_tip']) ? (int)$_POST['id_email_tip'] : 0;
$email = isset($_POST['email']) ? trim((string)$_POST['email']) : '';

if ($id_clanovi <= 0 || $id_email_tip <= 0 || $email === '') {
    echo '105';
    exit;
}

// Ako je odabrani tip primarni (Tip = 1), obriši sve postojeće e-mailove s tim tipom za tog člana.
$res = $mysqli->query("SELECT 1 FROM email_tip WHERE id = " . (int)$id_email_tip . " AND `Tip` = 1 LIMIT 1");
if ($res && $res->num_rows > 0) {
    $res->free();
    $mysqli->query("DELETE e FROM e_maili e INNER JOIN email_tip et ON et.id = e.id_email_tip AND et.`Tip` = 1 WHERE e.id_clanovi = " . (int)$id_clanovi);
}

$stmt = $mysqli->prepare("INSERT INTO e_maili (id_clanovi, id_email_tip, email) VALUES (?, ?, ?)");
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('iis', $id_clanovi, $id_email_tip, $email);
if ($stmt->execute()) {
    echo 'OK';
} else {
    echo '200,' . $stmt->errno;
}
$stmt->close();
$mysqli->close();
