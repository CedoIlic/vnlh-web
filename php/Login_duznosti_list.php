<?php
/**
 * GET: JSON { duznosti: [ { id, naziv }, ... ] } za trenutnu sesiju s needs_duznost_choice.
 * Za punjenje popupa nakon OK_NEED_DUTY ili GET Login.html s __VNLH_LOGIN_NEED_DUTY__.
 */
require_once __DIR__ . '/auth_start.php';
require_once __DIR__ . '/vnlh_login_post_auth.php';

header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['id_korisnik']) || (int) $_SESSION['id_korisnik'] <= 0) {
    http_response_code(401);
    echo json_encode(['error' => '401'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (empty($_SESSION['needs_duznost_choice']) || !empty($_SESSION['must_change_password'])) {
    http_response_code(403);
    echo json_encode(['error' => '403'], JSON_UNESCAPED_UNICODE);
    exit;
}

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    http_response_code(503);
    echo json_encode(['error' => '503'], JSON_UNESCAPED_UNICODE);
    exit;
}

$idK = (int) $_SESSION['id_korisnik'];
$lista = vnlh_login_duznosti_lista_za_korisnika($mysqli, $idK);
$mysqli->close();

echo json_encode(['duznosti' => $lista], JSON_UNESCAPED_UNICODE);
