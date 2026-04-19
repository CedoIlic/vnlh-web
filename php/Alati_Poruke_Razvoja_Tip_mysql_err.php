<?php
/**
 * Alati_Poruke_Razvoja_Tip – MySQL 1054 (Unknown column) obično znači da na bazi
 * nije pokrenuta migracija stupca `redosljed` (sql/*redosljed*.sql).
 * Vraća true ako je poslan odgovor 154 (korisnik zatvara modal bez zamjene #1).
 */
function vnlh_tip_razvoja_je_mysql_1054($errno)
{
    return (int) $errno === 1054;
}
