<?php
// =====================================================
// 0-Poruke_poruke_razvoj.php
// API: povijest poruka tipa „Poruka razvoju” koje je logirani korisnik poslao timu za razvoj.
// Jedan zapis u JSON-u po id_razgovor: 0-Poruke_posalji.php pri više primatelja (var. 1002) umeće
// više redova s istim id_razgovor – u povijesti se prikazuje jedna poruka bez obzira na broj primatelja.
// Ne miješa se s 0-Poruke_poruke.php (tip = 'Poruka', razgovor s odabranim pošiljateljem).
//
// Ulaz: GET (bez parametara) – id korisnika iz sesije.
//
// Izlaz:
//   (JSON) Isti oblik kao 0-Poruke_poruke.php: [{ id, id_razgovor, poruka, vrijeme_slanja, smjer, procitano }, …]
//          smjer je uvijek 'odgovor' (sve su poruke trenutnog korisnika kao pošiljatelja).
//   (TEXT) Greška konekcije: 100
//   (TEXT) SQL greška: 200
// =====================================================

require_once __DIR__ . '/require_login_api.php';

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$idKorisnik = (int) $_SESSION['id_korisnik'];

$sql = "
    SELECT
        p.id,
        p.id_razgovor,
        p.poruka,
        p.vrijeme_slanja,
        p.status
    FROM sustav_sesije_poruke p
    INNER JOIN (
        SELECT id_razgovor, MIN(id) AS rep_id
        FROM sustav_sesije_poruke
        WHERE brisano = 0
          AND tip = 'Poruka razvoju'
          AND id_posiljatelj = ?
        GROUP BY id_razgovor
    ) z ON p.id = z.rep_id
    WHERE p.brisano = 0
      AND p.tip = 'Poruka razvoju'
      AND p.id_posiljatelj = ?
    ORDER BY p.id_razgovor ASC, p.vrijeme_slanja ASC, p.id ASC
";

$stmt = $mysqli->prepare($sql);
if (!$stmt) {
    echo json_encode(['error' => '200', 'sql_errno' => $mysqli->errno], JSON_UNESCAPED_UNICODE);
    exit;
}

$stmt->bind_param('ii', $idKorisnik, $idKorisnik);

if (!$stmt->execute()) {
    echo json_encode(['error' => '200', 'sql_errno' => $stmt->errno], JSON_UNESCAPED_UNICODE);
    $stmt->close();
    exit;
}

$result = $stmt->get_result();
$poruke = [];

while ($row = $result->fetch_assoc()) {
    $procitano = ($row['status'] === 'Pročitano') ? 1 : 0;
    $poruke[] = [
        'id'             => (int) $row['id'],
        'id_razgovor'    => (int) $row['id_razgovor'],
        'poruka'         => $row['poruka'] ?? '',
        'vrijeme_slanja' => $row['vrijeme_slanja'] ?? '',
        'smjer'          => 'odgovor',
        'procitano'      => $procitano
    ];
}

$stmt->close();
$mysqli->close();

echo json_encode($poruke, JSON_UNESCAPED_UNICODE);
