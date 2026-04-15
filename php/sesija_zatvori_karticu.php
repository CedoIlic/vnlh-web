<?php
/**
 * sesija_zatvori_karticu.php
 * sendBeacon (POST): puna odjava kao Logout.php; CSRF token iz sesije.
 */
header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/auth_start.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo '405';
    exit;
}

$tokPost = isset($_POST['token']) ? trim((string) $_POST['token']) : '';
$tokSes = isset($_SESSION['sesija_pracenje_tab_close_token']) ? (string) $_SESSION['sesija_pracenje_tab_close_token'] : '';

if ($tokPost === '' || $tokSes === '' || !hash_equals($tokSes, $tokPost)) {
    http_response_code(403);
    echo '403';
    exit;
}

if (!isset($_SESSION['id_korisnik']) || (int) $_SESSION['id_korisnik'] <= 0) {
    http_response_code(204);
    exit;
}

vnlh_session_destroy_logout();
http_response_code(204);
exit;
