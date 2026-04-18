<?php
/**
 * Zajedničke pomoćne funkcije za hijerarhiju tablice duznosnici (id_nadredjeni).
 * Uključuje se iz CRUD skripti — ne šalje sam zaglavlja niti izlaz.
 */

if (!function_exists('duznosnici_je_potomak_masterna')) {
    /**
     * Je li $cvorId čvor strogo ispod $masterId u stablu (lanac id_nadredjeni prema korijenu)?
     * Za izmjenu: predloženi id_nadredjeni mora biti potomak Mastera (id uređivanog sloga).
     *
     * @param mysqli $mysqli
     * @param int $masterId  ID Master dužnosnika (uređivani red)
     * @param int $cvorId    Predloženi id_nadredjeni
     * @return bool
     */
    function duznosnici_je_potomak_masterna($mysqli, $masterId, $cvorId) {
        $masterId = (int) $masterId;
        $cvorId = (int) $cvorId;
        if ($cvorId <= 0 || $masterId <= 0) {
            return false;
        }
        if ($cvorId === $masterId) {
            return false;
        }
        $cur = $cvorId;
        $guard = 0;
        while ($cur > 0 && $guard < 10000) {
            $guard++;
            if ($cur === $masterId) {
                return ($cvorId !== $masterId);
            }
            $stmt = $mysqli->prepare('SELECT id_nadredjeni FROM duznosnici WHERE id = ? LIMIT 1');
            if (!$stmt) {
                return false;
            }
            $stmt->bind_param('i', $cur);
            $stmt->execute();
            $res = $stmt->get_result();
            $row = $res ? $res->fetch_assoc() : null;
            $stmt->close();
            if (!$row) {
                return false;
            }
            $cur = isset($row['id_nadredjeni']) ? (int) $row['id_nadredjeni'] : 0;
        }
        return false;
    }
}

if (!function_exists('duznosnici_je_validan_nadredjeni_iznad')) {
    /**
     * Je li predloženi id_nadredjeni u lancu „iznad“ čvora (predak prema korijenu), ili 0?
     * Smjer Iznad: dopušteni su samo nadređeni dužnosnici na putu do korijena.
     *
     * @param mysqli $mysqli
     * @param int $cvorId              Uređivani slog (Master / odabrani red)
     * @param int $predlozeniNadredjeni Predloženi id_nadredjeni
     */
    function duznosnici_je_validan_nadredjeni_iznad($mysqli, $cvorId, $predlozeniNadredjeniId) {
        $cvorId = (int) $cvorId;
        $predlozeniNadredjeniId = (int) $predlozeniNadredjeniId;
        if ($predlozeniNadredjeniId === 0) {
            return true;
        }
        if ($predlozeniNadredjeniId === $cvorId) {
            return false;
        }
        $stmt = $mysqli->prepare('SELECT id_nadredjeni FROM duznosnici WHERE id = ? LIMIT 1');
        if (!$stmt) {
            return false;
        }
        $stmt->bind_param('i', $cvorId);
        $stmt->execute();
        $res = $stmt->get_result();
        $row = $res ? $res->fetch_assoc() : null;
        $stmt->close();
        if (!$row) {
            return false;
        }
        $cur = isset($row['id_nadredjeni']) ? (int) $row['id_nadredjeni'] : 0;
        $guard = 0;
        while ($cur > 0 && $guard < 10000) {
            $guard++;
            if ($cur === $predlozeniNadredjeniId) {
                return true;
            }
            $stmt = $mysqli->prepare('SELECT id_nadredjeni FROM duznosnici WHERE id = ? LIMIT 1');
            if (!$stmt) {
                return false;
            }
            $stmt->bind_param('i', $cur);
            $stmt->execute();
            $res = $stmt->get_result();
            $row = $res ? $res->fetch_assoc() : null;
            $stmt->close();
            if (!$row) {
                return false;
            }
            $cur = isset($row['id_nadredjeni']) ? (int) $row['id_nadredjeni'] : 0;
        }
        return false;
    }
}

if (!function_exists('duznosnici_je_validan_nadredjeni_bez_ciklusa')) {
    /**
     * UPDATE (izmjena dužnosnika): id_nadredjeni smije biti 0 („ne odgovara nikome“) ili bilo koji postojeći
     * slog u duznosnici koji nije sam uređivani čvor (ne smije biti odgovoran sam sebi) i nije njegov potomak
     * u stablu (inače bi nastao ciklus).
     *
     * @param mysqli $mysqli
     * @param int $cvorId              Uređivani slog (Master red)
     * @param int $predlozeniNadredjeni Predloženi id_nadredjeni
     */
    function duznosnici_je_validan_nadredjeni_bez_ciklusa($mysqli, $cvorId, $predlozeniNadredjeniId) {
        $cvorId = (int) $cvorId;
        $predlozeniNadredjeniId = (int) $predlozeniNadredjeniId;
        if ($predlozeniNadredjeniId === 0) {
            return true;
        }
        if ($predlozeniNadredjeniId === $cvorId) {
            return false;
        }
        $stmt = $mysqli->prepare('SELECT 1 FROM duznosnici WHERE id = ? LIMIT 1');
        if (!$stmt) {
            return false;
        }
        $stmt->bind_param('i', $predlozeniNadredjeniId);
        $stmt->execute();
        $stmt->store_result();
        $exists = $stmt->num_rows > 0;
        $stmt->close();
        if (!$exists) {
            return false;
        }
        // Potomak kao nadređeni → ciklus u stablu.
        if (duznosnici_je_potomak_masterna($mysqli, $cvorId, $predlozeniNadredjeniId)) {
            return false;
        }
        return true;
    }
}

if (!function_exists('duznosnici_je_dopusten_nadredjeni_pri_insertu')) {
    /**
     * INSERT (novi dužnosnik): id_nadredjeni smije biti 0 ili bilo koji postojeći id u tablici duznosnici
     * (cijela hijerarhija uključujući „master“ / korijenske čvorove — bez veze s id_duznosnik iz sesije).
     *
     * @param mysqli $mysqli
     * @param int $idNadredjeni POST id_nadredjeni
     */
    function duznosnici_je_dopusten_nadredjeni_pri_insertu($mysqli, $idNadredjeni) {
        $idNadredjeni = (int) $idNadredjeni;
        if ($idNadredjeni === 0) {
            return true;
        }
        if ($idNadredjeni < 0) {
            return false;
        }
        $stmt = $mysqli->prepare('SELECT 1 FROM duznosnici WHERE id = ? LIMIT 1');
        if (!$stmt) {
            return false;
        }
        $stmt->bind_param('i', $idNadredjeni);
        $stmt->execute();
        $stmt->store_result();
        $ok = $stmt->num_rows > 0;
        $stmt->close();
        return $ok;
    }
}
