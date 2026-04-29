<?php
// =====================================================
// meni_list_index.php
// Dohvat stavki menija za INDEX (PUBLIC VIEW)
//
// Namjena:
// - vraća samo stavke koje se smiju prikazati na indexu
// - vraća samo polja koja index treba
// - vraća podatke u JSON formatu
//
// Pravila:
// - aktivno = 1
// - test = 1
// - html_fajl mora biti upisan (da ne generira "mrtvu" tipku)
//
// Sortiranje:
// - redoslijed (NULL na kraj)
// - naziv (abecedno)
//
// GET device (opcionalno, isto kao meni_dohvat_stabla_menija.php):
//   0 = sve stavke (default, kompatibilnost)
//   1 = prikaz kao na desktopu: (device = 0 OR device = 1) — bez stavki samo za mobitel
//   2 = prikaz kao na mobitelu: (device = 0 OR device = 2) — bez stavki samo za desktop (u bazi device = 1)
// =====================================================

// -----------------------------------------------------
// Sesija (zaštita)
// -----------------------------------------------------
require_once __DIR__ . '/require_login_api.php';

// -----------------------------------------------------
// Učitavanje centralne konekcije na bazu
// -----------------------------------------------------
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

$device = isset($_GET['device']) ? (int)$_GET['device'] : 0;
if ($device < 0) {
    $device = 0;
}
if ($device > 2) {
    $device = 2;
}

// -----------------------------------------------------
// SQL upit
// -----------------------------------------------------
$sql = "
    SELECT
        m.naziv,
        m.putanja,
        m.html_fajl,
        m.ref,
        m.redoslijed,
        m.device
    FROM meni m
    WHERE
        m.aktivno = 1
        AND m.test = 1
        AND m.html_fajl IS NOT NULL
        AND TRIM(m.html_fajl) <> ''
";
if ($device > 0) {
    $sql .= ' AND (COALESCE(m.device, 0) = 0 OR COALESCE(m.device, 0) = ' . (int) $device . ')';
}
$sql .= "
    ORDER BY
        (m.redoslijed IS NULL) ASC,
        m.redoslijed ASC,
        m.naziv ASC
";

// -----------------------------------------------------
// Izvršavanje upita
// -----------------------------------------------------
$result = $mysqli->query($sql);

// -----------------------------------------------------
// Priprema rezultata za JSON izlaz
// -----------------------------------------------------
$meni = [];

if ($result) {
    while ($row = $result->fetch_assoc()) {
        if (isset($row['html_fajl'])) {
            $row['html_fajl'] = vnlh_html_to_php_url($row['html_fajl']);
        }
        $meni[] = $row;
    }
}

// -----------------------------------------------------
// Slanje JSON odgovora
// -----------------------------------------------------
header('Content-Type: application/json');
echo json_encode($meni);

// -----------------------------------------------------
// Zatvaranje konekcije na bazu
// -----------------------------------------------------
$mysqli->close();
?>
