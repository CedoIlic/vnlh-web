<?php
/**
 * 0-Poruke.php
 * Servira HTML fragment modala za poruke (html/0-Poruke.html).
 * Poziva ga 0-Poruke.js preko fetch(); nije stavka menija.
 * Ne uključuje require_login.php (fragment); uključuje samo vnlh_paths za zamjenu __VNLH_ASSET_V__.
 */
require_once __DIR__ . '/vnlh_paths.php';
vnlh_emit_html_file('0-Poruke.html');
