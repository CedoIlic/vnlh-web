<?php
/**
 * Alati_Varijable_Sustava_CRUD.php – ulaz u formu „Varijable sustava” (tablica sustav_varijable).
 *
 * Stavka u tablici meni (html_fajl, putanja, ref) dodaje se ručno u bazi ako stranica
 * treba biti u izborniku; primjer ref-a: alati_varijable_sustava_crud.
 */
require_once __DIR__ . '/require_login.php';
vnlh_emit_html_file('Alati_Varijable_Sustava_CRUD.html');
