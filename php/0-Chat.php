<?php
/**
 * 0-Chat.php
 * Servira HTML fragment za chat (html/0-Chat.html). Učitava ga js/0-Chat.js (fetch).
 * Isti uzorak kao 0-Poruke.php – nije stavka menija; require_login izuzetak za 0-Chat.php.
 */
require_once __DIR__ . '/vnlh_paths.php';
vnlh_emit_html_file('0-Chat.html');
