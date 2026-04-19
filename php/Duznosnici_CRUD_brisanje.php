<?php
/**
 * Duznosnici_CRUD_brisanje.php — brisanje dužnosti i povezanih podataka (transakcija).
 *
 * Redoslijed:
 *  1) Podređeni u hijerarhiji: id_nadredjeni koji je pokazivao na ovaj id → 0 (nema FK-a u bazi).
 *  2) duznosnici_ogranicenja — sva ograničenja za ovog dužnosnika.
 *  3) duznosnici_prava — mora prije retka u duznosnici zbog FK (duznost → duznosnici.id).
 *  4) sustav_korisnici — sve veze (id_korisnik, id_duznosnik) za ovu dužnost.
 *  5) sustav_korisnici_login — samo za korisnike koji su imali isključivo ovu jednu dužnost
 *     (nakon brisanja veze ostaju bez redaka u sustav_korisnici → briše se login).
 *     Aktivne sesije (sustav_sesije_aktivne) vezane na login brišu se kaskadno (ON DELETE CASCADE).
 *  6) duznosnici — sam slog dužnosti.
 */
require_once __DIR__ . '/require_login_api.php';
$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    echo $db_ret;
    exit;
}

$id = isset($_POST['id']) ? (int) $_POST['id'] : 0;
if ($id <= 0) {
    echo '105';
    exit;
}

try {
    $mysqli->begin_transaction();

    // 1) Djeca u stablu više ne smiju pokazivati na obrisani čvor.
    $stmt = $mysqli->prepare('UPDATE duznosnici SET id_nadredjeni = 0 WHERE id_nadredjeni = ?');
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    if (!$stmt->execute()) {
        $errno = $mysqli->errno;
        $stmt->close();
        $mysqli->rollback();
        echo '200,' . $errno;
        exit;
    }
    $stmt->close();

    // 2) Geo + funkcionalna ograničenja + stupnjevi po obredu.
    $stmt = $mysqli->prepare('DELETE FROM duznosnici_ogranicenja WHERE id_duznosnik = ?');
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    if (!$stmt->execute()) {
        $errno = $mysqli->errno;
        $stmt->close();
        $mysqli->rollback();
        echo '200,' . $errno;
        exit;
    }
    $stmt->close();

    // 3) Prava dužnosti (FK na duznosnici).
    $stmt = $mysqli->prepare('DELETE FROM duznosnici_prava WHERE duznost = ?');
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    if (!$stmt->execute()) {
        $errno = $mysqli->errno;
        $stmt->close();
        $mysqli->rollback();
        echo '200,' . $errno;
        exit;
    }
    $stmt->close();

    // 4) Korisnici kojima je ovo bila jedina dužnost — nakon DELETE iz sustav_korisnici treba ukloniti login.
    $sqlJedina = 'SELECT sk.id_korisnik
                  FROM sustav_korisnici sk
                  WHERE sk.id_duznosnik = ?
                    AND (SELECT COUNT(*) FROM sustav_korisnici sk2 WHERE sk2.id_korisnik = sk.id_korisnik) = 1';
    $stmt = $mysqli->prepare($sqlJedina);
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    if (!$stmt->execute()) {
        $errno = $mysqli->errno;
        $stmt->close();
        $mysqli->rollback();
        echo '200,' . $errno;
        exit;
    }
    $res = $stmt->get_result();
    $korisniciZaBrisanjeLogina = [];
    while ($row = $res->fetch_assoc()) {
        $kid = isset($row['id_korisnik']) ? (int) $row['id_korisnik'] : 0;
        if ($kid > 0) {
            $korisniciZaBrisanjeLogina[] = $kid;
        }
    }
    $stmt->close();

    // 5) Ukloni sve dodjele ove dužnosti korisnicima.
    $stmt = $mysqli->prepare('DELETE FROM sustav_korisnici WHERE id_duznosnik = ?');
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    if (!$stmt->execute()) {
        $errno = $mysqli->errno;
        $stmt->close();
        $mysqli->rollback();
        echo '200,' . $errno;
        exit;
    }
    $stmt->close();

    // 6) Login zapisi za korisnike bez preostalih dužnosti.
    $stmtLogin = $mysqli->prepare('DELETE FROM sustav_korisnici_login WHERE id_korisnik = ?');
    if (!$stmtLogin) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    foreach ($korisniciZaBrisanjeLogina as $kid) {
        $stmtLogin->bind_param('i', $kid);
        if (!$stmtLogin->execute()) {
            $errno = $mysqli->errno;
            $stmtLogin->close();
            $mysqli->rollback();
            echo '200,' . $errno;
            exit;
        }
    }
    $stmtLogin->close();

    // 7) Sam dužnosnik.
    $stmt = $mysqli->prepare('DELETE FROM duznosnici WHERE id = ?');
    if (!$stmt) {
        $mysqli->rollback();
        echo '200,' . $mysqli->errno;
        exit;
    }
    $stmt->bind_param('i', $id);
    if (!$stmt->execute()) {
        $errno = $mysqli->errno;
        $stmt->close();
        $mysqli->rollback();
        if ($errno == 1451) {
            echo '106,' . $errno;
        } else {
            echo '200,' . $errno;
        }
        exit;
    }
    $stmt->close();

    $mysqli->commit();
    echo 'OK';
    exit;
} catch (mysqli_sql_exception $e) {
    try {
        $mysqli->rollback();
    } catch (Throwable $t) {
        // ignoriraj ako već nije aktivna transakcija
    }
    $code = (int) $e->getCode();
    if ($code === 1451) {
        echo '106,' . $code;
        exit;
    }
    echo '200,' . $code;
    exit;
}
