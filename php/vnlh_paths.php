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
 * Flag za JS: smije li korisnik vidjeti ikonu chata u zaglavlju (sesija nakon Login / require_login).
 * Fragmenti HTML-a bez <head> ne dobiju injekt – parent stranica već nosi window.VNLH_CHAT_DOZVOLJEN.
 * Ručni serviran HTML-a (Meni.php, Alati_*.php) također zovu ovu funkciju jer ne prolaze vnlh_emit_html_*.
 */
function vnlh_chat_dozvoljen_js_literal(): int
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return 0;
    }
    /* Eksplicitno 1/0: izbjegava edge-case s !empty() i stringom "0" / neočekivanim tipovima iz sesije. */
    return (int) ($_SESSION['chat_dozvoljen'] ?? 0) === 1 ? 1 : 0;
}

/**
 * Umeće jedan inline script odmah nakon <head> ako postoji; inače vraća HTML nepromijenjen.
 */
function vnlh_inject_chat_flag_script(string $html): string
{
    $flag = vnlh_chat_dozvoljen_js_literal();
    $snip = '<script>window.VNLH_CHAT_DOZVOLJEN=' . $flag . ';</script>';
    if (stripos($html, '<head>') === false) {
        return $html;
    }
    $out = preg_replace('/<head>/i', '<head>' . "\n" . $snip, $html, 1);
    return is_string($out) ? $out : $html;
}

/**
 * Umeće window.__VNLH_APP_BASE_PATH__ (vidi vnlh_app_base_path_for_js) — isto kao Meni.php za pouzdane API putanje u 0-Common.js.
 */
function vnlh_inject_app_base_path_script(string $html): string
{
    $base = vnlh_app_base_path_for_js();
    $snip = '<script>window.__VNLH_APP_BASE_PATH__=' . json_encode($base, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS) . ';</script>';
    if (stripos($html, '<head>') === false) {
        return $html;
    }
    $out = preg_replace('/<head>/i', '<head>' . "\n" . $snip, $html, 1);
    return is_string($out) ? $out : $html;
}

/**
 * Umeće ping / zatvaranje-kartice skriptu (sesija_pracenje_aktivnosti_lib) odmah nakon <head>.
 */
function vnlh_inject_sesija_pracenje_aktivnosti_script(string $html): string
{
    require_once __DIR__ . '/sesija_pracenje_aktivnosti_lib.php';
    $snip = sesija_pracenje_aktivnosti_inline_script_tag();
    if ($snip === '' || stripos($html, '<head>') === false) {
        return $html;
    }
    $out = preg_replace('/<head>/i', '<head>' . "\n" . $snip, $html, 1);
    return is_string($out) ? $out : $html;
}

/**
 * Umeće CSS+JS globalnog prebacivača jezika (css/0-Jezik.css, js/0-Jezik.js) odmah nakon <head>.
 * Iste relativne putanje (../) kao ostali asseti forme; fragmenti bez <head> se preskaču (parent ih već nosi).
 */
function vnlh_inject_jezik_prebacivac_script(string $html): string
{
    if (stripos($html, '<head>') === false) {
        return $html;
    }
    $v = rawurlencode(vnlh_asset_cache_token());
    $snip = '<link rel="stylesheet" href="../css/0-Jezik.css?v=' . $v . '">'
          . '<script defer src="../js/0-Jezik.js?v=' . $v . '"></script>';
    $out = preg_replace('/<head>/i', '<head>' . "\n" . $snip, $html, 1);
    return is_string($out) ? $out : $html;
}

/**
 * device vrijednost (meni.device) za zadanu html datoteku: 0=svi uređaji, 1=samo desktop, 2=samo mobitel.
 * Static cache po requestu; čita živo iz baze (promjena meni.device → vrijedi na sljedećem serviranju forme).
 */
function vnlh_meni_device_za_html(string $htmlFajl): int {
    static $cache = [];
    $key = strtolower(trim($htmlFajl));
    if ($key === '') return 0;
    if (array_key_exists($key, $cache)) return $cache[$key];
    $device = 0;
    require_once __DIR__ . '/vnlh_db_connect.php';
    $db = vnlh_db_connect();
    if ($db !== false) {
        $stmt = $db->prepare('SELECT device FROM meni WHERE LOWER(html_fajl) = ? LIMIT 1');
        if ($stmt) {
            $stmt->bind_param('s', $key);
            $stmt->execute();
            $res = $stmt->get_result();
            if ($res && ($row = $res->fetch_assoc())) $device = (int) $row['device'];
            $stmt->close();
        }
        $db->close();
    }
    return $cache[$key] = $device;
}

/**
 * Forme za samo desktop (meni.device=1): doda klasu vnlh-samo-desktop na <body>
 * (CSS body.vnlh-samo-desktop { min-width } → bez sažimanja po širini). Inače nepromijenjeno.
 */
function vnlh_inject_samo_desktop(string $html, string $htmlFajl): string {
    if (vnlh_meni_device_za_html($htmlFajl) !== 1) {
        return $html;
    }
    if (preg_match('/<body\b[^>]*\bclass\s*=\s*"/i', $html)) {
        $out = preg_replace('/(<body\b[^>]*\bclass\s*=\s*")/i', '$1vnlh-samo-desktop ', $html, 1);
    } else {
        $out = preg_replace('/<body\b/i', '<body class="vnlh-samo-desktop"', $html, 1);
    }
    return is_string($out) ? $out : $html;
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
    $html = vnlh_apply_asset_token_to_html($raw !== false ? $raw : '');
    $html = vnlh_inject_chat_flag_script($html);
    $html = vnlh_inject_app_base_path_script($html);
    $html = vnlh_inject_sesija_pracenje_aktivnosti_script($html);
    $html = vnlh_inject_jezik_prebacivac_script($html);
    echo vnlh_inject_samo_desktop($html, $basename);
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
    $html = vnlh_apply_asset_token_to_html($raw !== false ? $raw : '');
    $html = vnlh_inject_chat_flag_script($html);
    $html = vnlh_inject_app_base_path_script($html);
    $html = vnlh_inject_sesija_pracenje_aktivnosti_script($html);
    echo vnlh_inject_samo_desktop($html, basename($absolutePath));
}
