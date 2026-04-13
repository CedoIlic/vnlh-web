<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Version_Check.php
// Vraća trenutnu verziju iz js/00-Version.js.
// Koristi se za provjeru pri učitavanju stranice – ako se
// verzija na serveru razlikuje, klijent se osvježava.
//
// GET – odgovor: plain text verzija (npr. 10.12.25)
// =====================================================

header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

$file = __DIR__ . '/../js/00-Version.js';
if (!is_file($file)) {
    header('HTTP/1.1 404 Not Found');
    exit;
}

$content = file_get_contents($file);
if ($content === false) {
    header('HTTP/1.1 500 Internal Server Error');
    exit;
}

if (preg_match('/window\.VNLH_VERZIJA\s*=\s*"([^"]*)"/', $content, $m)) {
    echo trim($m[1]);
} else {
    echo '';
}
