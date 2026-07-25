<?php
require_once __DIR__ . '/require_login_api.php';
// Kandidat_Dokumenti_Pred_Print_lista.php – aktivni reci šifarnika pred-printa za tab „Ostalo".
// Uz svaki redak vraća i kontekst ključeve dokumenta (pdf_dokument_stavke.kontekst_kljuc):
// forma iz njih zna koji joj id treba, pa zna smije li PDF ikona biti omogućena.

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) { header('Content-Type: text/plain'); echo $db_ret; exit; }

header('Content-Type: application/json; charset=utf-8');

$sql = "SELECT p.id, p.id_dokument, p.naziv, p.izvor_tablica, p.izvor_kolona, p.redosljed,
               d.naziv AS dokument_naziv
          FROM kandidat_dokumenti_pred_print p
          JOIN pdf_dokument d ON d.id = p.id_dokument
         WHERE p.aktivan = 1
      ORDER BY p.redosljed ASC, d.naziv ASC";
$res = $mysqli->query($sql);
if (!$res) { header('Content-Type: text/plain'); echo '200,' . $mysqli->errno; exit; }

$rows = [];
$dokIds = [];
while ($row = $res->fetch_assoc()) {
    $row['kontekst_kljucevi'] = [];
    $rows[] = $row;
    $dokIds[(int) $row['id_dokument']] = true;
}

// Kontekst ključevi po dokumentu (obično točno jedan po dokumentu).
$kljuceviPoDok = [];
if ($dokIds) {
    $lista = implode(',', array_map('intval', array_keys($dokIds)));
    $res2 = $mysqli->query("SELECT DISTINCT dokument_id, kontekst_kljuc
                              FROM pdf_dokument_stavke
                             WHERE dokument_id IN ($lista)
                               AND kontekst_kljuc IS NOT NULL AND kontekst_kljuc <> ''");
    if ($res2) {
        while ($r = $res2->fetch_assoc()) {
            $did = (int) $r['dokument_id'];
            if (!isset($kljuceviPoDok[$did])) $kljuceviPoDok[$did] = [];
            $kljuceviPoDok[$did][] = $r['kontekst_kljuc'];
        }
    }
}
for ($i = 0; $i < count($rows); $i++) {
    $did = (int) $rows[$i]['id_dokument'];
    if (isset($kljuceviPoDok[$did])) $rows[$i]['kontekst_kljucevi'] = $kljuceviPoDok[$did];
}

echo json_encode($rows, JSON_UNESCAPED_UNICODE);
$mysqli->close();
