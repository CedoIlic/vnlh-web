<?php
require_once __DIR__ . '/require_login_api.php';
// Telefoni_CRUD_tip1.php – dohvat telefona s tipom 1 (primarni) za člana.
// GET id_clanovi. Vraća plain text: broj telefona ili prazan string ako nema.
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

$sql = "SELECT t.telefon
        FROM telefoni t
        INNER JOIN telefoni_tip tt ON tt.id = t.id_telefoni_tip AND tt.`Tip` = 1
        WHERE t.id_clanovi = ?
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
$telefon = '';
if ($row = $result->fetch_assoc()) {
    $telefon = trim((string)($row['telefon'] ?? ''));
}
$stmt->close();
$mysqli->close();
header('Content-Type: text/plain; charset=utf-8');
echo $telefon;
