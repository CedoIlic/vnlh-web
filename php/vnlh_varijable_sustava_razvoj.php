<?php
/**
 * Režim „Razvoj“ za Alati_Varijable_Sustava_CRUD.
 *
 * Red `sustav_varijable` s PK **1002**: stupac `varijabla` sadrži jedan ili više id-eva korisnika (odvojeno zarezom)
 * koji smiju vidjeti sve varijable i uključiti toggle „Razvoj“. Ostali korisnici vide samo id 0–999.
 *
 * Ovisno o POST/GET parametru `razvoj` (0|1) i pravu korisnika, ostali endpointi filtriraju podatke i validiraju upis.
 */

/** PK retka u `sustav_varijable` koji sadrži listu id-eva administratora razvoja. */
const VNLH_VAR_SUST_ADMIN_ROW_ID = 1002;

/**
 * Je li korisnik u listi administratora (stupac varijabla retka id = VNLH_VAR_SUST_ADMIN_ROW_ID).
 */
function vnlh_var_sust_korisnik_moze_toggle_razvoj(mysqli $mysqli, int $idKorisnika): bool
{
    if ($idKorisnika <= 0) {
        return false;
    }
    $rid = VNLH_VAR_SUST_ADMIN_ROW_ID;
    $stmt = $mysqli->prepare('SELECT varijabla FROM sustav_varijable WHERE id = ? LIMIT 1');
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param('i', $rid);
    if (!$stmt->execute()) {
        $stmt->close();
        return false;
    }
    $res = $stmt->get_result();
    $row = $res ? $res->fetch_assoc() : null;
    $stmt->close();
    if (!$row || !isset($row['varijabla'])) {
        return false;
    }
    $raw = trim((string) $row['varijabla']);
    if ($raw === '') {
        return false;
    }
    foreach (preg_split('/\s*,\s*/', $raw) as $part) {
        if ($part === '') {
            continue;
        }
        if ((int) $part === $idKorisnika) {
            return true;
        }
    }

    return false;
}

/**
 * Stvarno uključen „Razvoj“ (sve varijable): samo administrator i eksplicitni zahtjev razvoj=1.
 */
function vnlh_var_sust_efektivni_razvoj_ukljucen(mysqli $mysqli, int $idKorisnika, bool $paramRazvojZahtjev): bool
{
    return vnlh_var_sust_korisnik_moze_toggle_razvoj($mysqli, $idKorisnika) && $paramRazvojZahtjev;
}
