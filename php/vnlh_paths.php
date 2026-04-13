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
