<?php
/**
 * Putanja do stranice prijave (php/Login.php) u odnosu na web root (za Location).
 */
function vnlh_login_path($refQuery = null) {
    $sn = $_SERVER['SCRIPT_NAME'] ?? '';
    $dir = str_replace('\\', '/', dirname($sn));
    $parts = array_values(array_filter(explode('/', trim($dir, '/'))));
    $last = count($parts) ? $parts[count($parts) - 1] : '';

    if ($last === 'html') {
        $loginPath = dirname($dir) . '/php/Login.php';
    } elseif ($last === 'php') {
        $loginPath = $dir . '/Login.php';
    } else {
        $loginPath = rtrim($dir, '/') . '/php/Login.php';
    }

    if ($refQuery !== null && $refQuery !== '') {
        $loginPath .= '?ref=' . rawurlencode($refQuery);
    }
    return $loginPath;
}

/**
 * Zamjena nastavka .html → .php za zaštićene stranice (izbornik, API JSON).
 */
/**
 * Pathname korijena aplikacije za JS (npr. /vnlh) – iz SCRIPT_NAME (roditelj mape php/), ne iz filesystema.
 * Koristi se za window.__VNLH_APP_BASE_PATH__ kad pathname u pregledniku sadrži npr. /D:/.../php/ (pogrešan oblik).
 */
function vnlh_app_base_path_for_js(): string
{
    $sn = str_replace('\\', '/', (string) ($_SERVER['SCRIPT_NAME'] ?? ''));
    if ($sn === '' || $sn === '/') {
        return '';
    }
    $phpDir = dirname($sn);
    if ($phpDir === '/' || $phpDir === '\\' || $phpDir === '.') {
        return '';
    }
    $base = dirname($phpDir);
    if ($base === '/' || $base === '\\' || $base === '.') {
        return '';
    }
    return $base;
}

function vnlh_html_to_php_url($fajl) {
    $f = trim((string) $fajl);
    if ($f === '' || strcasecmp($f, 'Login.html') === 0 || strcasecmp($f, 'Login.php') === 0) {
        return $f;
    }
    if (preg_match('/\.html$/i', $f)) {
        return preg_replace('/\.html$/i', '.php', $f);
    }
    return $f;
}

/**
 * Cache-bust parametar ?v= za statičke CSS/JS (i favicon) u HTML šablonima.
 *
 * Izvor istine: **js/00-Version.js** (`window.VNLH_VERZIJA`). Bumpaj samo tamo — ne diraj desetke HTML-ova
 * pri svakoj reviziji; u šablonima stoji literal `__VNLH_ASSET_V__`, a PHP ga ovdje zamijeni stvarnim brojem
 * pri svakom odgovoru (read je jeftin za malu datoteku).
 *
 * Šablon: `href="../css/0-Common.css?v=__VNLH_ASSET_V__"` (vidi vnlh_emit_html_file).
 *
 * @return string npr. "10.16.07" ili "1" ako čitanje/regex ne uspije
 */
function vnlh_asset_cache_token(): string {
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }
    $path = __DIR__ . '/../js/00-Version.js';
    $cached = '1';
    if (is_readable($path)) {
        $js = @file_get_contents($path);
        if ($js !== false && preg_match('/window\.VNLH_VERZIJA\s*=\s*"([^"]+)"/', $js, $m)) {
            $ver = $m[1];
            if (preg_match('/^[0-9.]+$/', $ver)) {
                $cached = $ver;
            }
        }
    }
    return $cached;
}

/**
 * @param string $html sadržaj šablona s placeholderom __VNLH_ASSET_V__
 */
function vnlh_apply_asset_token_to_html(string $html): string {
    return str_replace('__VNLH_ASSET_V__', vnlh_asset_cache_token(), $html);
}

/**
 * Učitaj html/<ime>, zamijeni __VNLH_ASSET_V__ i ispiši (umjesto readfile na statičkom HTML-u).
 *
 * @param string $htmlBasename npr. "Clanovi_CRUD.html" (koristi basename radi sigurnosti)
 */
function vnlh_emit_html_file(string $htmlBasename): void {
    $basename = basename($htmlBasename);
    $abs = __DIR__ . '/../html/' . $basename;
    if (!is_readable($abs)) {
        http_response_code(500);
        echo 'HTML template missing: ' . htmlspecialchars($basename, ENT_QUOTES, 'UTF-8');
        return;
    }
    $raw = file_get_contents($abs);
    echo vnlh_apply_asset_token_to_html($raw !== false ? $raw : '');
}

/**
 * Isto kao vnlh_emit_html_file, ali puna putanja (npr. index.html u korijenu projekta uz index.php).
 */
function vnlh_emit_html_absolute(string $absolutePath): void {
    if (!is_readable($absolutePath)) {
        http_response_code(500);
        echo 'HTML template missing.';
        return;
    }
    $raw = file_get_contents($absolutePath);
    echo vnlh_apply_asset_token_to_html($raw !== false ? $raw : '');
}
