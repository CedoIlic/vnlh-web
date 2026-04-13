<?php
// ==============================
// Konekcija na MySQL bazu
// ==============================

require_once __DIR__ . '/vnlh_db_connect.php';

$mysqli = vnlh_db_connect();

// Provjera konekcije (povrat 100 = greška konekcije; vidi 0-Poruke_Tekstovi.js kod 100)
if ($mysqli === false) {
    return 100;
}

return -1; // sve u redu
