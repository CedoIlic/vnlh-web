<?php
/**
 * Brojanje neuspjelih prijava / promjene lozinke (stupac login_neuspjesni_pokusaji).
 * Prag neuspjeha: sustav_varijable.id = 107 (kolona varijabla = cijeli broj ≥ 1; nevaljano/prazno → zadano 5).
 * Nakon toliko neuspjelih pokušaja: pass_status = 2 (blokada).
 * Nakon uspješne prijave ili uspješne promjene lozinke: brojač se poništava (vnlh_login_reset_failures).
 * Brojač je po korisniku (isti login kao u sustav_korisnici_login.login); sesija zrcali po normaliziranom loginu ako stupac nije u bazi.
 * Zahtijeva ALTER: sql/sustav_korisnici_login_neuspjesni_pokusaji.sql (bez njega radi samo sesijski brojač + blokada u bazi).
 */

/** ID u sustav_varijable: maks. broj neuspjelih prijava / promjene lozinke prije blokade. */
define('VNLH_SUSTAV_VAR_MAX_LOGIN_NEUSPJEH', 107);

/** Zadani prag ako red 107 ne postoji ili varijabla nije pozitivan cijeli broj. */
define('VNLH_LOGIN_MAX_FAILED_ATTEMPTS_DEFAULT', 5);

/**
 * Maksimalan broj neuspjelih pokušaja prije blokade (iz sustav_varijable id 107).
 * Rezultat se kešira po HTTP zahtjevu.
 */
function vnlh_login_max_failed_attempts(mysqli $mysqli): int {
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }
    $idVar = VNLH_SUSTAV_VAR_MAX_LOGIN_NEUSPJEH;
    $stmt = $mysqli->prepare('SELECT varijabla FROM sustav_varijable WHERE id = ? LIMIT 1');
    if (!$stmt) {
        $cache = VNLH_LOGIN_MAX_FAILED_ATTEMPTS_DEFAULT;
        return $cache;
    }
    $stmt->bind_param('i', $idVar);
    if (!$stmt->execute()) {
        $stmt->close();
        $cache = VNLH_LOGIN_MAX_FAILED_ATTEMPTS_DEFAULT;
        return $cache;
    }
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$row || !isset($row['varijabla'])) {
        $cache = VNLH_LOGIN_MAX_FAILED_ATTEMPTS_DEFAULT;
        return $cache;
    }
    $raw = trim((string) $row['varijabla']);
    if ($raw === '') {
        $cache = VNLH_LOGIN_MAX_FAILED_ATTEMPTS_DEFAULT;
        return $cache;
    }
    $n = (int) $raw;
    if ($n < 1) {
        $cache = VNLH_LOGIN_MAX_FAILED_ATTEMPTS_DEFAULT;
        return $cache;
    }
    if ($n > 255) {
        $n = 255;
    }
    $cache = $n;
    return $cache;
}

function vnlh_login_failures_session_bucket(): string {
    return 'vnlh_login_fail';
}

/** Jedinstveni ključ po login stringu (isti korisnik = isti brojač). */
function vnlh_login_failures_session_key(string $login): string {
    return strtolower(trim($login));
}

function vnlh_login_mysqli_suggests_unknown_column(mysqli $mysqli, ?mysqli_stmt $stmt = null): bool {
    if ($mysqli->errno === 1054) {
        return true;
    }
    if ($stmt !== null && $stmt->errno === 1054) {
        return true;
    }
    $msg = $mysqli->error;
    if ($stmt !== null && $stmt->error !== '') {
        $msg = $stmt->error;
    }
    return $msg !== '' && stripos($msg, 'Unknown column') !== false;
}

function vnlh_login_fetch_login_for_korisnik(mysqli $mysqli, int $idKorisnik): string {
    if ($idKorisnik <= 0) {
        return '';
    }
    $stmt = $mysqli->prepare('SELECT login FROM sustav_korisnici_login WHERE id_korisnik = ? LIMIT 1');
    if (!$stmt) {
        return '';
    }
    $stmt->bind_param('i', $idKorisnik);
    $stmt->execute();
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$row || !isset($row['login'])) {
        return '';
    }
    return trim((string) $row['login']);
}

/**
 * Povećaj broj neuspjelih pokušaja za korisnika (ne ako je već pass_status = 2).
 * @param string $login Isti string kao pri prijavi (za ključ po loginu); mora odgovarati id_korisnik.
 * @return bool true ako je korisnik upravo blokiran (pass_status postavljen na 2)
 */
function vnlh_login_record_auth_failure(mysqli $mysqli, string $login, int $idKorisnik): bool {
    $key = vnlh_login_failures_session_key($login);
    if ($key === '' || $idKorisnik <= 0) {
        return false;
    }

    $bucket = vnlh_login_failures_session_bucket();
    if (!isset($_SESSION[$bucket])) {
        $_SESSION[$bucket] = [];
    }

    $stmt = $mysqli->prepare(
        'UPDATE sustav_korisnici_login SET login_neuspjesni_pokusaji = LEAST(IFNULL(login_neuspjesni_pokusaji, 0) + 1, 255)
         WHERE id_korisnik = ? AND (pass_status IS NULL OR pass_status <> 2)
         LIMIT 1'
    );

    if (!$stmt) {
        if (vnlh_login_mysqli_suggests_unknown_column($mysqli, null)) {
            $cnt = vnlh_login_increment_failure_session($bucket, $key);
            return vnlh_login_maybe_block_after_count($mysqli, $idKorisnik, $cnt);
        }
        return false;
    }

    $stmt->bind_param('i', $idKorisnik);
    if (!$stmt->execute()) {
        $fail = vnlh_login_mysqli_suggests_unknown_column($mysqli, $stmt);
        $stmt->close();
        if ($fail) {
            $cnt = vnlh_login_increment_failure_session($bucket, $key);
            return vnlh_login_maybe_block_after_count($mysqli, $idKorisnik, $cnt);
        }
        return false;
    }

    $aff = $stmt->affected_rows;
    $stmt->close();

    if ($aff >= 1) {
        $stmt2 = $mysqli->prepare('SELECT login_neuspjesni_pokusaji FROM sustav_korisnici_login WHERE id_korisnik = ? LIMIT 1');
        if (!$stmt2) {
            return false;
        }
        $stmt2->bind_param('i', $idKorisnik);
        $stmt2->execute();
        $res = $stmt2->get_result();
        $row = $res ? $res->fetch_assoc() : null;
        $stmt2->close();
        if (!$row) {
            return false;
        }
        $cnt = (int) ($row['login_neuspjesni_pokusaji'] ?? 0);
        $_SESSION[$bucket][$key] = $cnt;
        return vnlh_login_maybe_block_after_count($mysqli, $idKorisnik, $cnt);
    }

    $stmtPs = $mysqli->prepare('SELECT pass_status FROM sustav_korisnici_login WHERE id_korisnik = ? LIMIT 1');
    if (!$stmtPs) {
        return false;
    }
    $stmtPs->bind_param('i', $idKorisnik);
    $stmtPs->execute();
    $resPs = $stmtPs->get_result();
    $rowPs = $resPs ? $resPs->fetch_assoc() : null;
    $stmtPs->close();
    if ($rowPs !== null && isset($rowPs['pass_status']) && (int) $rowPs['pass_status'] === 2) {
        return false;
    }

    return false;
}

/**
 * @param string $bucket
 * @param string $key normalized login key
 */
function vnlh_login_increment_failure_session(string $bucket, string $key): int {
    if (!isset($_SESSION[$bucket][$key])) {
        $_SESSION[$bucket][$key] = 0;
    }
    $_SESSION[$bucket][$key] = (int) $_SESSION[$bucket][$key] + 1;
    return (int) $_SESSION[$bucket][$key];
}

function vnlh_login_maybe_block_after_count(mysqli $mysqli, int $idKorisnik, int $cnt): bool {
    if ($cnt < vnlh_login_max_failed_attempts($mysqli)) {
        return false;
    }
    $stmt = $mysqli->prepare('UPDATE sustav_korisnici_login SET pass_status = 2 WHERE id_korisnik = ? LIMIT 1');
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param('i', $idKorisnik);
    $stmt->execute();
    $stmt->close();
    return true;
}

function vnlh_login_reset_failures(mysqli $mysqli, int $idKorisnik): void {
    if ($idKorisnik <= 0) {
        return;
    }
    $login = vnlh_login_fetch_login_for_korisnik($mysqli, $idKorisnik);
    $key = vnlh_login_failures_session_key($login);
    $bucket = vnlh_login_failures_session_bucket();
    if ($key !== '' && isset($_SESSION[$bucket][$key])) {
        unset($_SESSION[$bucket][$key]);
    }

    $stmt = $mysqli->prepare('UPDATE sustav_korisnici_login SET login_neuspjesni_pokusaji = 0 WHERE id_korisnik = ? LIMIT 1');
    if ($stmt) {
        $stmt->bind_param('i', $idKorisnik);
        $stmt->execute();
        $stmt->close();
    }
}

/**
 * Smije li korisnik zadržati sesiju (za require_login): pass_status nije 2, brojač ispod praga (var. 107).
 * pass_status NULL → nema pristupa.
 */
function vnlh_auth_user_may_access(mysqli $mysqli, int $idKorisnik): bool {
    if ($idKorisnik <= 0) {
        return false;
    }
    $stmt = $mysqli->prepare(
        'SELECT pass_status, login_neuspjesni_pokusaji FROM sustav_korisnici_login WHERE id_korisnik = ? LIMIT 1'
    );
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param('i', $idKorisnik);
    if (!$stmt->execute()) {
        $stmt->close();
        return false;
    }
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$row) {
        return false;
    }
    $ps = $row['pass_status'];
    if ($ps === null) {
        return false;
    }
    $psInt = (int) $ps;
    if ($psInt === 2) {
        return false;
    }
    $n = isset($row['login_neuspjesni_pokusaji']) ? (int) $row['login_neuspjesni_pokusaji'] : 0;
    if ($n >= vnlh_login_max_failed_attempts($mysqli)) {
        return false;
    }
    return true;
}

/**
 * Neuspjela validacija promjene lozinke (025) ili blokada nakon dosega praga (026 + odjava).
 * Zahtijeva učitani auth_start.php (vnlh_session_destroy_logout).
 */
function vnlh_login_pass_change_reject(mysqli $mysqli, int $idKorisnik): void {
    $login = vnlh_login_fetch_login_for_korisnik($mysqli, $idKorisnik);
    if ($login === '') {
        $mysqli->close();
        echo '025';
        exit;
    }
    if (vnlh_login_record_auth_failure($mysqli, $login, $idKorisnik)) {
        vnlh_session_destroy_logout();
        $mysqli->close();
        echo '026';
        exit;
    }
    $mysqli->close();
    echo '025';
    exit;
}
