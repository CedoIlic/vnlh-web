<?php
/**
 * Aktivne sesije – HTML s umetnutim zadanim intervalom iz sustav_varijable id 109.
 */
require_once __DIR__ . '/require_login.php';
require_once __DIR__ . '/vnlh_paths.php';
require_once __DIR__ . '/vnlh_db_connect.php';

$defaultSec = (int) VNLH_SESIJA_INTERVAL_OSVJEZI_SEC_DEFAULT;
$db = vnlh_db_connect();
if ($db) {
    $defaultSec = Alati_Sesije_Aktivne_interval_osvjezi_sec_iz_baze($db);
    $db->close();
}

$html = file_get_contents(__DIR__ . '/../html/Alati_Aktivne_Sesije.html');
$html = vnlh_apply_asset_token_to_html($html);
// Jedinstveni placeholder u statičkom HTML-u (vrijednost već ograničena u PHP funkciji).
$html = str_replace('{{VNLH_DEFAULT_INTERVAL_OSVJEZI}}', (string) $defaultSec, $html);
$appBaseJs = vnlh_app_base_path_for_js();
$injectBase = '<script>window.__VNLH_APP_BASE_PATH__=' . json_encode($appBaseJs, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS) . ';</script>';
if (strpos($html, '</head>') !== false) {
    $html = str_replace('</head>', $injectBase . "\n</head>", $html);
} else {
    $html = $injectBase . $html;
}
echo $html;
