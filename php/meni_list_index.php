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
