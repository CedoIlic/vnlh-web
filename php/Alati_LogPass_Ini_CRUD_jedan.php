<?php
require_once __DIR__ . '/require_login_api.php';
// GET id_korisnik → JSON { pass_status, login_neuspjesni_pokusaji } iz baze (svježe stanje pri selekciji u formi).

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo $db_ret;
    exit;
}

$id = isset($_GET['id_korisnik']) ? (int) $_GET['id_korisnik'] : 0;
if ($id <= 0) {
    $mysqli->close();
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['pass_status' => null, 'login_neuspjesni_pokusaji' => 0], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt = $mysqli->prepare(
    'SELECT pass_status, login_neuspjesni_pokusaji FROM sustav_korisnici_login WHERE id_korisnik = ? LIMIT 1'
);
if (!$stmt) {
    $mysqli->close();
    header('Content-Type: text/plain; charset=utf-8');
    echo '200,' . $mysqli->errno;
    exit;
}
$stmt->bind_param('i', $id);
$stmt->execute();
$res = $stmt->get_result();
$row = $res ? $res->fetch_assoc() : null;
$stmt->close();
$mysqli->close();

if (!$row) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['pass_status' => null, 'login_neuspjesni_pokusaji' => 0], JSON_UNESCAPED_UNICODE);
    exit;
}

$ps = $row['pass_status'];
$passStatus = ($ps === null || $ps === '') ? null : (int) $ps;
$lf = isset($row['login_neuspjesni_pokusaji']) && $row['login_neuspjesni_pokusaji'] !== null
    ? (int) $row['login_neuspjesni_pokusaji']
    : 0;
if ($lf < 0) {
    $lf = 0;
}
if ($lf > 255) {
    $lf = 255;
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode(
    ['pass_status' => $passStatus, 'login_neuspjesni_pokusaji' => $lf],
    JSON_UNESCAPED_UNICODE
);
