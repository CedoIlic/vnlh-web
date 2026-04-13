<?php
// Odjava – brisanje retka u sustav_sesije_aktivne, uništavanje sesije; redirect na Login.
require_once __DIR__ . '/auth_start.php';
require_once __DIR__ . '/vnlh_paths.php';

vnlh_session_destroy_logout();

header('Location: ' . vnlh_login_path(null));
exit;
