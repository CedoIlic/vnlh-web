<?php
require_once __DIR__ . '/require_login_api.php';
// Loze_thumb_remove_bg.php – obrada thumb slike lože: uklanjanje pozadine, zadržavanje okvira.
// Ulaz: binarni sadržaj slike ($imageData), MIME tip ($mime).
// Izlaz: [ $processedData, $mime ] ili false ako obrada ne uspije.
// Pozadina (bijela/svijetla) postaje transparentna; ostaje vanjski okvir pozadine.
// Koristi Imagick ako je dostupan (bolji rezultat), inače GD s euklidskom distancom.

function loze_thumb_remove_background($imageData, $mime) {
    if (!$imageData || strlen($imageData) < 4) return false;

    if (extension_loaded('imagick') && class_exists('Imagick')) {
        $result = loze_thumb_remove_bg_imagick($imageData, $mime);
        if ($result !== false) return $result;
    }

    if (extension_loaded('gd')) {
        return loze_thumb_remove_bg_gd($imageData, $mime);
    }

    return false;
}

function loze_thumb_remove_bg_imagick($imageData, $mime) {
    try {
        $im = new Imagick();
        $im->readImageBlob($imageData);
        $im->setImageFormat('png');
        $im->setImageAlphaChannel(Imagick::ALPHACHANNEL_ACTIVATE);
        $w = $im->getImageWidth();
        $h = $im->getImageHeight();
        $lightest = null;
        $maxLum = -1;
        foreach ([[0, 0], [$w - 1, 0], [0, $h - 1], [$w - 1, $h - 1]] as $pt) {
            if ($pt[0] >= 0 && $pt[0] < $w && $pt[1] >= 0 && $pt[1] < $h) {
                $px = $im->getImagePixelColor($pt[0], $pt[1]);
                $c = $px->getColor();
                $lum = ($c['r'] ?? 0) + ($c['g'] ?? 0) + ($c['b'] ?? 0);
                if ($lum > $maxLum) {
                    $maxLum = $lum;
                    $lightest = $px;
                }
            }
        }
        $color = $lightest ?: $im->getImagePixelColor(0, 0);
        $qr = $im->getQuantumRange();
        $quantum = isset($qr['quantum']) ? (float)$qr['quantum'] : 65535;
        $fuzz = $quantum * 0.35;
        $im->paintTransparentImage($color, 0, $fuzz);
        $im->setImageFormat('png');
        $blob = $im->getImageBlob();
        $im->clear();
        $im->destroy();
        if ($blob && strlen($blob) > 4) {
            return [$blob, 'image/png'];
        }
    } catch (Throwable $e) {
        // fallback na GD
    }
    return false;
}

function loze_thumb_remove_bg_gd($imageData, $mime) {
    $src = @imagecreatefromstring($imageData);
    if (!$src) return false;
    if (!imageistruecolor($src) && function_exists('imagepalettetotruecolor')) {
        imagepalettetotruecolor($src);
    }
    $w = imagesx($src);
    $h = imagesy($src);
    if ($w < 1 || $h < 1 || $w > 2000 || $h > 2000) {
        imagedestroy($src);
        return false;
    }
    $keepBorder = false;
    $pad = 1;
    $bgR = $bgG = $bgB = 255;
    $toleranceEuclid = 35;
    $outW = $keepBorder ? ($w + 2 * $pad) : $w;
    $outH = $keepBorder ? ($h + 2 * $pad) : $h;
    $dx = $keepBorder ? $pad : 0;
    $dy = $keepBorder ? $pad : 0;
    $out = imagecreatetruecolor($outW, $outH);
    if (!$out) {
        imagedestroy($src);
        return false;
    }
    imagealphablending($out, false);
    imagesavealpha($out, true);
    $transparent = imagecolorallocatealpha($out, 0, 0, 0, 127);
    imagefill($out, 0, 0, $transparent);
    if ($keepBorder) {
        $borderColor = imagecolorallocatealpha($out, $bgR, $bgG, $bgB, 0);
        imagefilledrectangle($out, 0, 0, $outW - 1, $outH - 1, $borderColor);
    }
    imagealphablending($out, true);
    $transColor = imagecolorallocatealpha($out, 255, 255, 255, 127);
    if ($transColor === false || $transColor === -1) {
        imagedestroy($src);
        imagedestroy($out);
        return false;
    }
    $lumMin = 735;
    $perChannelMin = 238;
    $colorCache = [];
    for ($y = 0; $y < $h; $y++) {
        for ($x = 0; $x < $w; $x++) {
            $c = imagecolorat($src, $x, $y);
            $r = ($c >> 16) & 0xFF;
            $g = ($c >> 8) & 0xFF;
            $b = $c & 0xFF;
            $lum = $r + $g + $b;
            $dr = $r - $bgR;
            $dg = $g - $bgG;
            $db = $b - $bgB;
            $dist = sqrt($dr * $dr + $dg * $dg + $db * $db);
            $nearWhite = ($r >= $perChannelMin && $g >= $perChannelMin && $b >= $perChannelMin);
            $makeTransparent = ($dist <= $toleranceEuclid) || ($lum >= $lumMin) || $nearWhite;
            if ($makeTransparent) {
                $color = $transColor;
            } else {
                $key = ($r << 16) | ($g << 8) | $b;
                if (!isset($colorCache[$key])) {
                    $colorCache[$key] = imagecolorallocatealpha($out, $r, $g, $b, 0);
                }
                $color = $colorCache[$key];
            }
            imagesetpixel($out, $x + $dx, $y + $dy, $color);
        }
    }
    imagedestroy($src);
    ob_start();
    $ok = imagepng($out);
    $png = ob_get_clean();
    imagedestroy($out);
    if (!$ok || $png === false || strlen($png) < 4) return false;
    return [$png, 'image/png'];
}
