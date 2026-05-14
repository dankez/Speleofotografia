<?php
// Speleofotografia - ImageProcessor v2.0
// Dvojitý výstup: originál bez vodoznaku + webová verzia WebP s vodoznakom

class ImageProcessor {

    /**
     * Spracuje nahratý obrázok:
     * - Uloží originál BEZ vodoznaku do $origPath
     * - Vytvorí web verziu WebP s vodoznakom do $webPath (resize na max 1920px)
     *
     * @return bool true ak obidve operácie prebehli OK
     */
    public static function processDouble($sourcePath, $origPath, $webPath, $maxWeb = 1920, $watermarkText = '') {
        $info = @getimagesize($sourcePath);
        if (!$info) return false;

        [$origWidth, $origHeight, $type] = $info;
        $src = self::createFromType($sourcePath, $type);
        if (!$src) return false;

        // 1) Uloženie originálu ako JPEG (bez zmeny veľkosti, bez vodoznaku)
        self::ensureDir(dirname($origPath));
        if (!imagejpeg($src, $origPath, 92)) {
            // Ak zlyhalo uloženie originálu, je to fatálna chyba (napr. práva)
            imagedestroy($src);
            return false;
        }

        // 2) Web verzia: resize + watermark + WebP
        $ratio = min($maxWeb / $origWidth, $maxWeb / $origHeight, 1.0);
        $newW = (int)round($origWidth * $ratio);
        $newH = (int)round($origHeight * $ratio);

        $dst = imagecreatetruecolor($newW, $newH);
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $newW, $newH, $origWidth, $origHeight);

        if (!empty($watermarkText)) {
            self::addWatermark($dst, $watermarkText, $newW, $newH);
        }

        self::ensureDir(dirname($webPath));
        $ok = imagewebp($dst, $webPath, 82);

        imagedestroy($src);
        imagedestroy($dst);
        return $ok;
    }

    /**
     * Jednoduché spracovanie (pre spätná kompatibilitu)
     */
    public static function process($sourcePath, $destPath, $maxWidth = 2200, $maxHeight = 2200, $watermarkText = null) {
        $info = @getimagesize($sourcePath);
        if (!$info) return false;

        [$origWidth, $origHeight, $type] = $info;
        $src = self::createFromType($sourcePath, $type);
        if (!$src) return false;

        $ratio = min($maxWidth / $origWidth, $maxHeight / $origHeight, 1.0);
        $newW = (int)round($origWidth * $ratio);
        $newH = (int)round($origHeight * $ratio);

        $dst = imagecreatetruecolor($newW, $newH);
        if ($type == IMAGETYPE_PNG || $type == IMAGETYPE_WEBP) {
            imagealphablending($dst, false);
            imagesavealpha($dst, true);
        }
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $newW, $newH, $origWidth, $origHeight);

        if ($watermarkText) {
            self::addWatermark($dst, $watermarkText, $newW, $newH);
        }

        imagejpeg($dst, $destPath, 85);
        imagedestroy($src);
        imagedestroy($dst);
        return true;
    }

    private static function createFromType($path, $type) {
        switch ($type) {
            case IMAGETYPE_JPEG: return imagecreatefromjpeg($path);
            case IMAGETYPE_PNG:  return imagecreatefrompng($path);
            case IMAGETYPE_WEBP: return imagecreatefromwebp($path);
            default: return false;
        }
    }

    private static function addWatermark($img, $text, $w, $h) {
        // Polopriesvitný biely text vpravo dole
        $color = imagecolorallocatealpha($img, 255, 255, 255, 50);
        $fontSize = 5; // vstavaný font
        $textW = imagefontwidth($fontSize) * strlen($text);
        $x = max(5, $w - $textW - 12);
        $y = $h - imagefontheight($fontSize) - 10;
        imagestring($img, $fontSize, $x, $y, $text, $color);
    }

    private static function ensureDir($dir) {
        if (!is_dir($dir)) mkdir($dir, 0755, true);
    }
}
