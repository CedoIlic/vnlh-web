<?php
/* 0-Filteri_Drzava.php — zajednički, lančivi filter nad tablicom `clanovi`.
 *
 * Izdvaja samo članove čija je LOŽA u zadanoj državi:
 *   clanovi.loza → loze.id → loze.id_drzava = tražena država.
 * (Pazi: NIJE clanovi.drzava — to je članova osobna država/državljanstvo.)
 *
 * Serverski i neovisan o SELECT-u: dopisuje samo JOIN + WHERE + bind param u akumulatore,
 * pa radi na BILO KOJEM upitu nad `clanovi` (bez obzira koje se kolone vuku). Koristi VLASTITI
 * JOIN-alias (_fdrz) da nikad ne sudari s postojećim `JOIN loze` u host-upitu.
 *
 * Lančanje: pozovi više filtera redom nad istim akumulatorima; svi se WHERE uvjeti spajaju s AND.
 * Konvencija: id_drzava <= 0 (npr. -1) / prazno → NO-OP (filter se ne primjenjuje).
 *
 * Primjer:
 *   $joins=[]; $where=['c.aktivnost=1','c.kandidat=0']; $params=[]; $types='';
 *   vnlhFilterDrzava($joins,$where,$params,$types, $idDrzava);
 *   $sql = "SELECT c.id, c.prezime, c.ime FROM clanovi c "
 *        . implode(' ', $joins)
 *        . (count($where) ? ' WHERE '.implode(' AND ', $where) : '');
 */

if (!function_exists('vnlhFilterDrzava')) {
    /**
     * @param array  $joins    akumulator JOIN fragmenata (dopisuje se)
     * @param array  $where     akumulator WHERE uvjeta (spaja se s AND)
     * @param array  $params    akumulator bind vrijednosti (redom kako se pojavljuju u SQL-u)
     * @param string $types     akumulator mysqli bind tipova
     * @param mixed  $idDrzava  tražena drzave.id; -1 / 0 / '' / null → filter se preskače
     * @param string $cAlias    alias tablice `clanovi` u host-upitu (default 'c')
     * @return void
     */
    function vnlhFilterDrzava(array &$joins, array &$where, array &$params, string &$types, $idDrzava, string $cAlias = 'c')
    {
        $id = (int) $idDrzava;
        if ($id <= 0) {
            return; // -1 / 0 / prazno → bez filtriranja (država „sve")
        }
        $joins[]  = 'INNER JOIN loze _fdrz ON _fdrz.id = `' . $cAlias . '`.loza';
        $where[]  = '_fdrz.id_drzava = ?';
        $params[] = $id;
        $types   .= 'i';
    }
}
