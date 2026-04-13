<?php
require_once __DIR__ . '/require_login_api.php';
// =====================================================
// Alati_Meni_Test_Upis.php
// Upsert sustav_varijable za id 103, 104, 105 (ID Main menija, podmenija, izvršnog menija).
// Ako red postoji: UPDATE samo kolona varijabla.
// Ako ne postoji: INSERT id, varijabla, naziv, opis.
// =====================================================
//
// Ulaz (POST):
//   glavni_id   – sadržaj edit_glavni_id (id 103)
//   podmeniji   – sadržaj edit_podmeniji (id 104)
//   izvrsni_meni – sadržaj edit_izvrsni_meni (id 105)
//
// Izlaz (TEXT): OK | 100 | 105 | 200,<errno>
// =====================================================

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain');
    echo $db_ret;
    exit;
}

header('Content-Type: text/plain; charset=utf-8');

$glavni_id = isset($_POST['glavni_id']) ? trim($_POST['glavni_id']) : '';
$podmeniji = isset($_POST['podmeniji']) ? trim($_POST['podmeniji']) : '';
$izvrsni_meni = isset($_POST['izvrsni_meni']) ? trim($_POST['izvrsni_meni']) : '';

$rows = [
    103 => ['v' => $glavni_id, 'naziv' => 'ID Main menija', 'opis' => 'ID glavnog odnosno horizontalnog menija'],
    104 => ['v' => $podmeniji, 'naziv' => 'ID podmenija', 'opis' => 'ID podmenija u sustavu menija'],
    105 => ['v' => $izvrsni_meni, 'naziv' => 'ID izvršnog menija', 'opis' => 'ID izvršnog menija, onog koji ima html']
];

foreach ($rows as $id => $data) {
    $v = $data['v'];
    $naziv = $data['naziv'];
    $opis = $data['opis'];

    $stmt = $mysqli->prepare("SELECT id FROM sustav_varijable WHERE id = ? LIMIT 1");
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    if (!$stmt->execute()) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $res = $stmt->get_result();
    $exists = $res->num_rows > 0;
    $stmt->close();

    if ($exists) {
        $stmt = $mysqli->prepare("UPDATE sustav_varijable SET varijabla = ? WHERE id = ?");
        if (!$stmt) {
            echo '200,' . $mysqli->errno;
            exit;
        }
        $stmt->bind_param('si', $v, $id);
    } else {
        $stmt = $mysqli->prepare("INSERT INTO sustav_varijable (id, varijabla, Naziv, opis) VALUES (?, ?, ?, ?)");
        if (!$stmt) {
            echo '200,' . $mysqli->errno;
            exit;
        }
        $stmt->bind_param('isss', $id, $v, $naziv, $opis);
    }

    if (!$stmt->execute()) {
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->close();
}

echo 'OK';
$mysqli->close();
