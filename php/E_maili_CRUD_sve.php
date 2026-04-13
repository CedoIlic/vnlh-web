<?php
require_once __DIR__ . '/require_login_api.php';
// E_maili_CRUD_sve.php – dohvat svih e-mail adresa za člana. GET id_clanovi.
// Vraća JSON: [{ "id", "id_email_tip", "email", "tip" }, ...]
// tip = 1/0 iz email_tip.Tip (primarni tip).
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}
$id_clanovi = isset($_GET['id_clanovi']) ? (int)$_GET['id_clanovi'] : 0;
if ($id_clanovi <= 0) {
    header('Content-Type: application/json');
    echo '[]';
    exit;
}

$sql = "SELECT e.id, e.id_email_tip, e.email, COALESCE(et.`Tip`, 0) AS tip
        FROM e_maili e
        LEFT JOIN email_tip et ON et.id = e.id_email_tip
        WHERE e.id_clanovi = ?
        ORDER BY et.`Tip` DESC, e.id ASC";
$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    header('Content-Type: text/plain');
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id_clanovi);
$stmt->execute();
$result = $stmt->get_result();
$rows = [];
while ($row = $result->fetch_assoc()) {
    $rows[] = [
        'id' => (int)$row['id'],
        'id_email_tip' => $row['id_email_tip'] !== null ? (int)$row['id_email_tip'] : null,
        'email' => $row['email'],
        'tip' => (int)$row['tip']
    ];
}
$stmt->close();
$mysqli->close();
header('Content-Type: application/json; charset=utf-8');
echo json_encode($rows, JSON_UNESCAPED_UNICODE);
