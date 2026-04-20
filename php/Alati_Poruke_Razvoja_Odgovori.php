<?php
/**
 * Forma „Odgovori razvoja“ – pregled poruka tipa „Poruka razvoju“ iz sustav_sesije_poruke (logičko brisanje).
 * Stavka mora postojati u tablici meni (html_fajl = Alati_Poruke_Razvoja_Odgovori.html) da require_login dopusti pristup.
 */
require_once __DIR__ . '/require_login.php';
vnlh_emit_html_file('Alati_Poruke_Razvoja_Odgovori.html');
