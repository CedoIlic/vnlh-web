<?php
require_once __DIR__ . '/require_login_api.php';
// Alati_LogPass_Ini_CRUD_izmjena.php
// POST: id_korisnik (obavezno), login, pass (prazno ili isto kao u bazi = ne mijenjati), pass_status (prazno = NULL; inače jedna znamenka 0–9),
//       login_neuspjesni_pokusaji (0–255; prazno = 0) — stupac login_neuspjesni_pokusaji; pri promjeni lozinke brojač se poništava (reset).
// Izlaz: OK | 105 | 109 | 200,errno
//
// Lozinka u stupcu pass uvijek se upisuje kao password_hash(..., PASSWORD_DEFAULT); u bazu ne ide čisti tekst.

$db_ret = require_once __DIR__ . '/00_db.php';
if ($db_ret !== -1) {
    header('Content-Type: text/plain; charset=utf-8');
    echo $db_ret;
    exit;
}

$id = isset($_POST['id_korisnik']) ? (int) $_POST['id_korisnik'] : 0;
if ($id <= 0) {
    echo '105';
    $mysqli->close();
    exit;
}

$loginRaw = isset($_POST['login']) ? trim((string) $_POST['login']) : '';
$passNew = isset($_POST['pass']) ? (string) $_POST['pass'] : '';
$statusRaw = isset($_POST['pass_status']) ? trim((string) $_POST['pass_status']) : '';

if ($statusRaw !== '' && !preg_match('/^[0-9]$/', $statusRaw)) {
    echo '105';
    $mysqli->close();
    exit;
}

$logFailRaw = isset($_POST['login_neuspjesni_pokusaji']) ? trim((string) $_POST['login_neuspjesni_pokusaji']) : '';
if ($logFailRaw !== '' && !preg_match('/^[0-9]+$/', $logFailRaw)) {
    echo '105';
    $mysqli->close();
    exit;
}
$logFailVal = $logFailRaw === '' ? 0 : (int) $logFailRaw;
if ($logFailVal > 255) {
    echo '105';
    $mysqli->close();
    exit;
}

$passStatusVal = $statusRaw === '' ? null : (int) $statusRaw;
$loginVal = $loginRaw === '' ? null : $loginRaw;

if ($loginVal !== null && (function_exists('mb_strlen') ? mb_strlen($loginVal, 'UTF-8') : strlen($loginVal)) > 100) {
    echo '105';
    $mysqli->close();
    exit;
}

$stmt = $mysqli->prepare('SELECT login, pass FROM sustav_korisnici_login WHERE id_korisnik = ? LIMIT 1');
if (!$stmt) {
    echo '200,' . $mysqli->errno;
    $mysqli->close();
    exit;
}
$stmt->bind_param('i', $id);
$stmt->execute();
$resOld = $stmt->get_result();
$oldRow = $resOld ? $resOld->fetch_assoc() : null;
$stmt->close();
if (!$oldRow) {
    echo '105';
    $mysqli->close();
    exit;
}

$oldPassStr = isset($oldRow['pass']) && $oldRow['pass'] !== null ? trim((string) $oldRow['pass']) : '';
if (strtoupper($oldPassStr) === 'NULL') {
    $oldPassStr = '';
}
$passPostTrim = trim($passNew);
$menjaPass = ($passPostTrim !== '') && ($passPostTrim !== $oldPassStr);

if ($loginVal !== null && $loginVal !== '') {
    $stmt = $mysqli->prepare(
        'SELECT 1 FROM sustav_korisnici_login WHERE login IS NOT NULL AND TRIM(login) <> \'\' AND LOWER(TRIM(login)) = LOWER(?) AND id_korisnik <> ? LIMIT 1'
    );
    if (!$stmt) {
        echo '200,' . $mysqli->errno;
        $mysqli->close();
        exit;
    }
    $stmt->bind_param('si', $loginVal, $id);
    $stmt->execute();
    $stmt->store_result();
    if ($stmt->num_rows > 0) {
        $stmt->close();
        echo '109';
        $mysqli->close();
        exit;
    }
    $stmt->close();
}

if ($menjaPass) {
    // U bazu samo hash (nikad čista lozinka).
    $hash = password_hash($passPostTrim, PASSWORD_DEFAULT);
    if ($hash === false) {
        echo '200,0';
        $mysqli->close();
        exit;
    }
    if ($passStatusVal === null) {
        $stmt = $mysqli->prepare('UPDATE sustav_korisnici_login SET login = ?, pass = ?, pass_status = NULL WHERE id_korisnik = ?');
        if (!$stmt) {
            echo '200,' . $mysqli->errno;
            $mysqli->close();
            exit;
        }
        $stmt->bind_param('ssi', $loginVal, $hash, $id);
    } else {
        $stmt = $mysqli->prepare('UPDATE sustav_korisnici_login SET login = ?, pass = ?, pass_status = ? WHERE id_korisnik = ?');
        if (!$stmt) {
            echo '200,' . $mysqli->errno;
            $mysqli->close();
            exit;
        }
        $stmt->bind_param('ssii', $loginVal, $hash, $passStatusVal, $id);
    }
} else {
    if ($passStatusVal === null) {
        $stmt = $mysqli->prepare('UPDATE sustav_korisnici_login SET login = ?, pass_status = NULL WHERE id_korisnik = ?');
        if (!$stmt) {
            echo '200,' . $mysqli->errno;
            $mysqli->close();
            exit;
        }
        $stmt->bind_param('si', $loginVal, $id);
    } else {
        $stmt = $mysqli->prepare('UPDATE sustav_korisnici_login SET login = ?, pass_status = ? WHERE id_korisnik = ?');
        if (!$stmt) {
            echo '200,' . $mysqli->errno;
            $mysqli->close();
            exit;
        }
        $stmt->bind_param('sii', $loginVal, $passStatusVal, $id);
    }
}

if (!$stmt->execute()) {
    if ($mysqli->errno === 1062) {
        echo '109';
    } else {
        echo '200,' . $mysqli->errno;
    }
    $stmt->close();
    $mysqli->close();
    exit;
}
$stmt->close();

require_once __DIR__ . '/vnlh_login_failures.php';
if ($menjaPass) {
    vnlh_login_reset_failures($mysqli, $id);
} else {
    $stmtLf = $mysqli->prepare('UPDATE sustav_korisnici_login SET login_neuspjesni_pokusaji = ? WHERE id_korisnik = ? LIMIT 1');
    if (!$stmtLf) {
        echo '200,' . $mysqli->errno;
        $mysqli->close();
        exit;
    }
    $stmtLf->bind_param('ii', $logFailVal, $id);
    if (!$stmtLf->execute()) {
        echo '200,' . $mysqli->errno;
        $stmtLf->close();
        $mysqli->close();
        exit;
    }
    $stmtLf->close();
    if ($logFailVal >= vnlh_login_max_failed_attempts($mysqli)) {
        $stmtBlk = $mysqli->prepare('UPDATE sustav_korisnici_login SET pass_status = 2 WHERE id_korisnik = ? LIMIT 1');
        if ($stmtBlk) {
            $stmtBlk->bind_param('i', $id);
            $stmtBlk->execute();
            $stmtBlk->close();
        }
    }
}

echo 'OK';
$mysqli->close();
