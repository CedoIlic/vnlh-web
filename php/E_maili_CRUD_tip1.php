<?php
require_once __DIR__ . '/require_login_api.php';
// E_maili_CRUD_tip1.php – dohvat e-maila s tipom 1 (primarni) za člana.
// GET id_clanovi. Vraća plain text: e-mail adresa ili prazan string ako nema.
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$id_clanovi = isset($_GET['id_clanovi']) ? (int)$_GET['id_clanovi'] : 0;
if ($id_clanovi <= 0) {
    header('Content-Type: text/plain; charset=utf-8');
    echo '';
    exit;
}

$sql = "SELECT e.email
        FROM e_maili e
        INNER JOIN email_tip et ON et.id = e.id_email_tip AND et.`Tip` = 1
        WHERE e.id_clanovi = ?
        LIMIT 1";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id_clanovi);
$stmt->execute();
$result = $stmt->get_result();
$email = '';
if ($row = $result->fetch_assoc()) {
    $email = trim((string)($row['email'] ?? ''));
}
$stmt->close();
$mysqli->close();
header('Content-Type: text/plain; charset=utf-8');
echo $email;
