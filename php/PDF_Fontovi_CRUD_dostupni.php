<?php
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// Staza do foldera fontova iz sustav_varijable (id = 119), relativna na app root.
$rel = 'fontovi/';
$stmt = $mysqli->prepare('SELECT varijabla FROM sustav_varijable WHERE id = 119 LIMIT 1');
if ($stmt) {
    $stmt->execute();
    $res = $stmt->get_result();
    if ($res && ($r = $res->fetch_assoc()) && isset($r['varijabla']) && trim($r['varijabla']) !== '') {
        $rel = trim($r['varijabla']);
    }
    $stmt->close();
}
$mysqli->close();

// Sigurnosno: ukloni vodeće kose crte i ".." (bez izlaska iz app foldera).
$rel = str_replace('\\', '/', $rel);
$rel = preg_replace('#\.\.+#', '', $rel);
$rel = ltrim($rel, '/');

$appRoot = dirname(__DIR__);              // .../vnlh-web  (php/ je unutar app roota)
$dir = $appRoot . '/' . $rel;

// Grupiraj .ttf datoteke po porodici (dio prije prve crtice), skupi varijante (dio iza crtice).
$map = [];
if (is_dir($dir)) {
    $files = scandir($dir);
    if ($files !== false) {
        foreach ($files as $f) {
            if ($f === '.' || $f === '..') continue;
            if (!preg_match('/\.ttf$/i', $f)) continue;
            $base = preg_replace('/\.ttf$/i', '', $f);   // npr. "Roboto-Medium"
            $dash = strpos($base, '-');
            if ($dash !== false) {
                $porodica = trim(substr($base, 0, $dash));
                $varijanta = trim(substr($base, $dash + 1));
            } else {
                $porodica = trim($base);
                $varijanta = 'Regular';
            }
            if ($porodica === '') continue;
            if (!isset($map[$porodica])) $map[$porodica] = [];
            if ($varijanta !== '' && !in_array($varijanta, $map[$porodica], true)) {
                $map[$porodica][] = $varijanta;
            }
        }
    }
}

ksort($map, SORT_STRING | SORT_FLAG_CASE);
$out = [];
foreach ($map as $porodica => $varijante) {
    sort($varijante, SORT_STRING | SORT_FLAG_CASE);
    $out[] = ['porodica' => $porodica, 'varijante' => $varijante];
}
echo json_encode($out, JSON_UNESCAPED_UNICODE);
