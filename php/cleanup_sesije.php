<?php
/**
 * cleanup_sesije.php
 * CLI/cron: aktivna → timeout gdje je zadnja_aktivnost starija od session_timeout_sec (sustav_varijable id 112).
 *
 * Pokretanje: php cleanup_sesije.php (iz mape php/ ili s punom putanjom u cronu).
 */
if (php_sapi_name() !== 'cli' && php_sapi_name() !== 'phpdbg') {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'CLI only';
    exit;
}

require_once __DIR__ . '/vnlh_db_connect.php';
require_once __DIR__ . '/Alati_Sesije_Aktivne.php';
require_once __DIR__ . '/sesija_pracenje_aktivnosti_lib.php';

$mysqli = vnlh_db_connect();
if ($mysqli === false) {
    fwrite(STDERR, "DB connection failed\n");
    exit(1);
}

$idle = sesija_pracenje_aktivnosti_session_timeout_sec($mysqli);
if ($idle < 60) {
    $idle = 90;
}
/* SAMO status → timeout; zadnja_aktivnost se NE dira (ostaje stvarno zadnje vrijeme, ne trenutak detekcije). */
$sql = 'UPDATE sustav_sesije_aktivne SET status = \'timeout\'
        WHERE status = \'aktivna\' AND zadnja_aktivnost < DATE_SUB(NOW(), INTERVAL ' . (int) $idle . ' SECOND)';
$mysqli->query($sql);
Alati_Sesije_Aktivne_obrisi_neaktivne_redove($mysqli);
$mysqli->close();
exit(0);
