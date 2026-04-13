<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Version_Update.php
// Ažurira VNLH_VERZIJA u js/00-Version.js.
// Samo lokalno (XAMPP). Na javnom serveru: Razvoj=0, verzija se mijenja distribucijom.
//
// POST: version=10.12.18&razvoj=1
// Ili JSON: {"version":"10.12.18","razvoj":1}
//
// Odgovor: "OK" | "ERR:opis"
// =====================================================

header('Content-Type: text/plain; charset=utf-8');

// Samo na lokalnom okruženju – na javnom serveru nema potrebe za promjenom verzije
$host = $_SERVER['SERVER_NAME'] ?? '';
if (!in_array($host, ['localhost', '127.0.0.1'], true)) {
    header('HTTP/1.1 403 Forbidden');
    echo 'ERR:Samo na lokalnom okruženju';
    exit;
}

$version = '';
$razvoj = 0;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = file_get_contents('php://input');
    $contentType = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
    if (strpos($contentType, 'application/json') !== false) {
        $data = json_decode($input, true);
        if (is_array($data)) {
            $version = isset($data['version']) ? trim((string)$data['version']) : '';
            $razvoj = isset($data['razvoj']) ? (int)$data['razvoj'] : 0;
        }
    } else {
        $version = isset($_POST['version']) ? trim((string)$_POST['version']) : '';
        $razvoj = isset($_POST['razvoj']) ? (int)$_POST['razvoj'] : 0;
        if (($version === '' || $razvoj !== 1) && $input !== '') {
            parse_str($input, $parsed);
            if (is_array($parsed)) {
                if ($version === '') $version = isset($parsed['version']) ? trim((string)$parsed['version']) : '';
                if ($razvoj !== 1) $razvoj = isset($parsed['razvoj']) ? (int)$parsed['razvoj'] : 0;
            }
        }
    }
}

// Na localhostu je dovoljna provjera hosta; razvoj se ne provjerava (POST body može ne stići)

if ($version === '') {
    echo 'ERR:Verzija ne smije biti prazna';
    exit;
}

// Dozvoljeni znakovi: brojeve, točke, crtice, slova (npr. 10.12.18, 1.0.0-beta)
if (!preg_match('/^[a-zA-Z0-9.\-_]+$/', $version)) {
    echo 'ERR:Nevaljan format verzije';
    exit;
}

$file = __DIR__ . '/../js/00-Version.js';
if (!is_file($file)) {
    echo 'ERR:Datoteka 00-Version.js nije pronađena';
    exit;
}

$content = file_get_contents($file);
if ($content === false) {
    echo 'ERR:Nije moguće pročitati datoteku';
    exit;
}

// Zamijeni liniju s VNLH_VERZIJA (bez ^ da radi i s BOM ili razmacima)
$pattern = '/(window\.VNLH_VERZIJA\s*=\s*)"[^"]*";/';
$replacement = '${1}"' . $version . '";';
$newContent = preg_replace($pattern, $replacement, $content, 1, $count);

if ($count === 0) {
    echo 'ERR:Nije pronađena linija VNLH_VERZIJA';
    exit;
}

if (file_put_contents($file, $newContent) === false) {
    echo 'ERR:Nije moguće zapisati datoteku';
    exit;
}

// Ažuriraj ?v= u svim HTML datotekama (cache-busting)
$baseDir = __DIR__ . '/..';
$htmlFiles = array_merge(
    glob($baseDir . '/*.html') ?: [],
    glob($baseDir . '/html/*.html') ?: []
);
$vPattern = '/(\?v=)[a-zA-Z0-9.\-_]+/';
$vReplacement = '${1}' . $version;
foreach ($htmlFiles as $htmlFile) {
    if (!is_file($htmlFile)) continue;
    $htmlContent = file_get_contents($htmlFile);
    if ($htmlContent === false) continue;
    $newHtml = preg_replace($vPattern, $vReplacement, $htmlContent);
    if ($newHtml !== $htmlContent) {
        file_put_contents($htmlFile, $newHtml);
    }
}

echo 'OK';
