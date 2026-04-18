<?php
/**
 * Stranica „Prava dužnosnika“: učitava HTML šablon i umeće Master ID (id dužnosti iz sesije).
 * GET id_duznosnik_test (>0): koristi se kao Master umjesto $_SESSION['id_duznosnik'] (Alati_Meni_Test).
 */
require_once __DIR__ . '/require_login.php';
require_once __DIR__ . '/vnlh_paths.php';

$basename = 'Duznosnici_Prava_CRUD.html';
$abs = __DIR__ . '/../html/' . basename($basename);
if (!is_readable($abs)) {
    http_response_code(500);
    echo 'HTML template missing: ' . htmlspecialchars($basename, ENT_QUOTES, 'UTF-8');
    return;
}
$raw = file_get_contents($abs);
if ($raw === false) {
    http_response_code(500);
    echo 'HTML template read error.';
    return;
}

$idTest = isset($_GET['id_duznosnik_test']) ? (int) $_GET['id_duznosnik_test'] : 0;
$masterId = ($idTest > 0)
    ? $idTest
    : (int) ($_SESSION['id_duznosnik'] ?? 0);

$html = str_replace('__VNLH_SESSION_MASTER_ID_DUZNOSNIK__', (string) $masterId, $raw);
$html = vnlh_apply_asset_token_to_html($html);
$html = vnlh_inject_chat_flag_script($html);
echo vnlh_inject_sesija_pracenje_aktivnosti_script($html);
