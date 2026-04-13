<?php
/**
 * 00-Testni_modal.php
 * Servira HTML fragment testnog modala (html/00-Testni_modal.html).
 * Poziva ga 00-Testni_modal.js preko fetch(); nije stavka menija.
 * Ne uključuje require_login.php (fragment); uključuje samo vnlh_paths za zamjenu __VNLH_ASSET_V__.
 */
require_once __DIR__ . '/vnlh_paths.php';
vnlh_emit_html_file('00-Testni_modal.html');
