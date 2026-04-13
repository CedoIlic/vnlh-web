<?php
/**
 * GET prijavna forma – uključuje se iz Login.php samo za GET.
 * Valjana sesija bez obveze promjene lozinke → Meni.php.
 * Valjana sesija s must_change_password → Login forma (promjena lozinke).
 */
require_once __DIR__ . '/vnlh_password_policy.php';
require_once __DIR__ . '/vnlh_paths.php';

$uid = isset($_SESSION['id_korisnik']) ? (int) $_SESSION['id_korisnik'] : 0;
$mustChange = !empty($_SESSION['must_change_password']);

if ($uid > 0 && !$mustChange) {
    header('Location: Meni.php', true, 302);
    exit;
}

$loginDisplay = '';
if ($mustChange && $uid > 0 && isset($_SESSION['login_display'])) {
    $loginDisplay = (string) $_SESSION['login_display'];
}

$htmlPath = __DIR__ . '/../html/Login.html';
$html = file_exists($htmlPath) ? (string) file_get_contents($htmlPath) : '';
$html = vnlh_apply_asset_token_to_html($html);

/*
 * Apsolutne pathname putanje od web korijena (npr. /vnlh/php/Meni.php) – Login.js ih koristi za navigaciju i POST.
 * Bez toga: ako preglednik nema /php/ u URL-u (DirectoryIndex, rewrite), new URL('Meni.php', location) postaje
 * /Meni.php umjesto /vnlh/php/Meni.php → 404 nakon prijave.
 */
$scriptName = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
if ($scriptName !== '' && $scriptName[0] !== '/') {
    $scriptName = '/' . $scriptName;
}
$phpDir = dirname($scriptName);
if ($phpDir === '/' || $phpDir === '\\' || $phpDir === '.') {
    $phpDir = '/php';
}
$phpDir = rtrim($phpDir, '/');
$pathMeni = $phpDir . '/Meni.php';
$pathLoginApi = $phpDir . '/Login.php';
$pathLogout = $phpDir . '/Logout.php';
$pathPass = $phpDir . '/Login_pass_promjena.php';

$passHint = vnlh_password_policy_hint_text();
$inject = '<script>window.__VNLH_LOGIN_PASS_CHANGE__=' . ($mustChange && $uid > 0 ? 'true' : 'false') . ';';
$inject .= 'window.__VNLH_LOGIN_LOGIN__=' . json_encode($loginDisplay, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS) . ';';
$inject .= 'window.__VNLH_PASS_HINT__=' . json_encode($passHint, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS) . ';';
$inject .= 'window.__VNLH_MENI_PATH__=' . json_encode($pathMeni, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS) . ';';
$inject .= 'window.__VNLH_LOGIN_API_PATH__=' . json_encode($pathLoginApi, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS) . ';';
$inject .= 'window.__VNLH_LOGOUT_PATH__=' . json_encode($pathLogout, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS) . ';';
$inject .= 'window.__VNLH_PASS_PROMJENA_PATH__=' . json_encode($pathPass, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS) . ';</script>';

/* Varijable moraju biti definirane prije učitavanja skripti (Login.js na kraju body-ja). */
if (strpos($html, '</head>') !== false) {
    $html = str_replace('</head>', $inject . "\n</head>", $html);
} elseif (preg_match('/<body[^>]*>/i', $html)) {
    $html = preg_replace('/<body[^>]*>/i', '$0' . $inject, $html, 1);
} elseif (strpos($html, '</body>') !== false) {
    $html = str_replace('</body>', $inject . "\n</body>", $html);
} else {
    $html = $inject . $html;
}

header('Content-Type: text/html; charset=utf-8');
echo $html;
