<?php
// =====================================================
// 0-Poruke_lista.php
// API: lista sugovornika za tip = 'Poruka' ili (GET samo_razvoj=1) tip = 'Poruka razvoju'. Chat: poruke_chat_*.php.
// Za svaku osobu vraća id, prezime, ime i broj nepročitanih poruka.
// SQL isključuje brisano=1 (rezime: vidi zaglavlje 0-Poruke_brisi.php).
//
// Ulaz (GET):
//   samo_neprocitane (opcionalno) – 1 = samo pošiljatelji s nepročitanim porukama
//   samo_razvoj      (opcionalno) – 1 = nit Poruka razvoju (samo ako je sesijski korisnik u listi varijable 1002)
//
// Izlaz:
//   (JSON) Uspjeh: niz objekata [{id_posiljatelj, prezime, ime, neprocitane}, ...]
//   (TEXT) Greška konekcije (00_db.php): 100
//   (TEXT) SQL greška: 200
// =====================================================

require_once __DIR__ . '/require_login_api.php';
require_once __DIR__ . '/poruke_razvoj_var_1002.php';

// --- Blok: Konekcija na bazu ---
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// --- Blok: Parametri ---
$idKorisnik = (int) $_SESSION['id_korisnik'];
$samoNeprocitane = isset($_GET['samo_neprocitane']) && $_GET['samo_neprocitane'] === '1';
$samoRazvoj = isset($_GET['samo_razvoj']) && $_GET['samo_razvoj'] === '1';
if ($samoRazvoj && !poruke_razvoj_sesija_je_clan_tima($mysqli)) {
    $samoRazvoj = false;
}
$tipLista = $samoRazvoj ? 'Poruka razvoju' : 'Poruka';

// --- Blok: SQL – dohvat sugovornika grupirano, s brojem nepročitanih ---
// Uključuje razgovore u OBA smjera: poruke primljene (id_primatelj = ja) I
// poruke poslane (id_posiljatelj = ja). "Druga strana" je sugovornik.
// JOIN na clanovi radi prezimena/imena sugovornika.
// COUNT nepročitanih = poruke koje sam JA primio (id_primatelj = ja) sa status 'Novo'.
// $tipLista: 'Poruka' (obični modal) | 'Poruka razvoju' (toggle „Razvoj” u listi).
$sql = "
    SELECT
        sugovornik_id,
        c.prezime,
        c.ime,
        SUM(neprocitane_raw) AS neprocitane
    FROM (
        /* Poruke koje sam primio – druga strana je pošiljatelj */
        SELECT
            p.id_posiljatelj AS sugovornik_id,
            CASE WHEN p.status = 'Novo' THEN 1 ELSE 0 END AS neprocitane_raw
        FROM sustav_sesije_poruke p
        WHERE p.id_primatelj = ?
          AND p.brisano = 0
          AND p.tip = ?
        UNION ALL
        /* Poruke koje sam poslao – druga strana je primatelj */
        SELECT
            p.id_primatelj AS sugovornik_id,
            0 AS neprocitane_raw
        FROM sustav_sesije_poruke p
        WHERE p.id_posiljatelj = ?
          AND p.brisano = 0
          AND p.tip = ?
    ) AS razgovori
    LEFT JOIN clanovi c ON c.id = razgovori.sugovornik_id
    GROUP BY sugovornik_id, c.prezime, c.ime
";

if ($samoNeprocitane) {
    $sql .= " HAVING neprocitane > 0";
}

$sql .= " ORDER BY neprocitane DESC, c.prezime ASC, c.ime ASC";

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo json_encode(['error' => '200', 'sql_errno' => $mysqli->errno]);
    exit;
}

$stmt->bind_param('isis', $idKorisnik, $tipLista, $idKorisnik, $tipLista);

if (!$stmt->execute()) {
    echo json_encode(['error' => '200', 'sql_errno' => $stmt->errno]);
    $stmt->close();
    exit;
}

$result = $stmt->get_result();
$lista = [];

while ($row = $result->fetch_assoc()) {
    $lista[] = [
        'id_posiljatelj' => (int) $row['sugovornik_id'],
        'prezime'        => $row['prezime'] ?? '',
        'ime'            => $row['ime'] ?? '',
        'neprocitane'    => (int) $row['neprocitane']
    ];
}

$stmt->close();
$mysqli->close();

echo json_encode($lista, JSON_UNESCAPED_UNICODE);
