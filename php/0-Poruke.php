<?php
/**
 * 0-Poruke.php
 * Servira HTML fragment modala za poruke (html/0-Poruke.html).
 * Poziva ga 0-Poruke.js preko fetch(); nije stavka menija, nego globalni modal.
 */
require_once __DIR__ . '/require_login.php';
vnlh_emit_html_file('0-Poruke.html');
