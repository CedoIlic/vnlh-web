<?php
require_once __DIR__ . '/require_login.php';
require_once __DIR__ . '/vnlh_paths.php';

/* Spriječi preglednikov keš HTML stranice — svaki zahtjev mora dobiti svjež sadržaj s diska. */
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

$html = file_get_contents(__DIR__ . '/../html/Alati_Meni_Test.html');
$html = vnlh_apply_asset_token_to_html($html);
/* Pravo na chat ikonu u naslovu (0-Poruke.js); ručni echo stranice ne prolaze vnlh_emit_html_file. */
$html = vnlh_inject_chat_flag_script($html);
$html = vnlh_inject_sesija_pracenje_aktivnosti_script($html);
$appBaseJs = vnlh_app_base_path_for_js();
$injectBase = '<script>window.__VNLH_APP_BASE_PATH__=' . json_encode($appBaseJs, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS) . ';</script>';
if (strpos($html, '</head>') !== false) {
    $html = str_replace('</head>', $injectBase . "\n</head>", $html);
} else {
    $html = $injectBase . $html;
}
echo $html;
