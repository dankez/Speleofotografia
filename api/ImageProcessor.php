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
    public static function processDouble($sourcePath, $origPath, $webPath, $maxWeb = 1920, $watermarkText = '', $wSize = 24, $wColor = 'rgba(255,255,255,0.5)') {
        $info = @getimagesize($sourcePath);
        if (!$info) return false;

        [$origWidth, $origHeight, $type] = $info;
        $src = self::createFromType($sourcePath, $type);
        if (!$src) return false;

        // 1) Uloženie originálu ako JPEG (bez zmeny veľkosti, bez vodoznaku)
        self::ensureDir(dirname($origPath));
        if (!imagejpeg($src, $origPath, 92)) {
            imagedestroy($src);
            return false;
        }

        // 2) Web verzia: resize + watermark + WebP
        $ratio = min($maxWeb / $origWidth, $maxWeb / $origHeight, 1.0);
        $newW = (int)round($origWidth * $ratio);
        $newH = (int)round($origHeight * $ratio);

        $dst = imagecreatetruecolor($newW, $newH);
        
        // Alpha blending pre WebP
        imagealphablending($dst, true);
        imagesavealpha($dst, true);

        imagecopyresampled($dst, $src, 0, 0, 0, 0, $newW, $newH, $origWidth, $origHeight);

        if (!empty($watermarkText)) {
            self::addWatermark($dst, $watermarkText, $newW, $newH, $wSize, $wColor);
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

    public static function rotateFile($filePath, $angle = 90) {
        if (!file_exists($filePath)) return false;
        $info = @getimagesize($filePath);
        if (!$info) return false;
        [$w, $h, $type] = $info;
        
        $src = self::createFromType($filePath, $type, false); // Don't auto-exif rotate when explicitly rotating
        if (!$src) return false;

        // GD imagerotate uses counter-clockwise angle, so we negate for clockwise rotation
        $rotated = imagerotate($src, -$angle, 0);
        imagedestroy($src);
        if (!$rotated) return false;

        self::ensureDir(dirname($filePath));
        $ok = false;
        if ($type === IMAGETYPE_JPEG) {
            $ok = imagejpeg($rotated, $filePath, 92);
        } else if ($type === IMAGETYPE_WEBP) {
            $ok = imagewebp($rotated, $filePath, 85);
        } else if ($type === IMAGETYPE_PNG) {
            $ok = imagepng($rotated, $filePath, 8);
        }
        imagedestroy($rotated);
        return $ok;
    }

    public static function detectExifOrientation($filePath) {
        if (!file_exists($filePath) || !function_exists('exif_read_data')) return 1;
        $exif = @exif_read_data($filePath);
        return !empty($exif['Orientation']) ? (int)$exif['Orientation'] : 1;
    }

    private static function createFromType($path, $type, $applyExif = true) {
        switch ($type) {
            case IMAGETYPE_JPEG: {
                $img = @imagecreatefromjpeg($path);
                if ($img && $applyExif && function_exists('exif_read_data')) {
                    $exif = @exif_read_data($path);
                    if (!empty($exif['Orientation'])) {
                        $orientation = (int)$exif['Orientation'];
                        if ($orientation === 3) {
                            $rotated = imagerotate($img, 180, 0);
                            imagedestroy($img);
                            $img = $rotated;
                        } elseif ($orientation === 6) {
                            // 90 CW
                            $rotated = imagerotate($img, -90, 0);
                            imagedestroy($img);
                            $img = $rotated;
                        } elseif ($orientation === 8) {
                            // 90 CCW
                            $rotated = imagerotate($img, 90, 0);
                            imagedestroy($img);
                            $img = $rotated;
                        }
                    }
                }
                return $img;
            }
            case IMAGETYPE_PNG:  return @imagecreatefrompng($path);
            case IMAGETYPE_WEBP: return @imagecreatefromwebp($path);
            default: return false;
        }
    }

    private static function addWatermark($img, $text, $w, $h, $size = 24, $colorStr = 'rgba(255,255,255,0.5)') {
        $c = self::parseColor($img, $colorStr);
        $size = (float)$size;
        
        // Zoznam potenciálnych ciest k fontom
        $possibleFonts = [
            __DIR__ . '/font.ttf',
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
            '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
            '/usr/share/fonts/truetype/ttf-dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/X11/TTF/DejaVuSans.ttf',
            '/usr/share/fonts/truetype/Nakula/nakula.ttf',
        ];
        
        $fontPath = '';
        foreach ($possibleFonts as $f) {
            if (file_exists($f)) {
                $fontPath = $f;
                break;
            }
        }
        
        if (function_exists('imagettftext') && !empty($fontPath)) {
            dlog("WATERMARK: TTF OK, font=$fontPath, size=$size");
            $angle = 0;
            $bbox = imagettfbbox($size, $angle, $fontPath, $text);
            $textW = abs($bbox[4] - $bbox[0]);
            $textH = abs($bbox[5] - $bbox[1]);
            
            $x = $w - $textW - 25;
            $y = $h - 25;
            
            // Tieň
            $shadow = imagecolorallocatealpha($img, 0, 0, 0, 90);
            imagettftext($img, $size, $angle, $x+1, $y+1, $shadow, $fontPath, $text);
            imagettftext($img, $size, $angle, $x, $y, $c, $fontPath, $text);
        } else {
            $reason = empty($fontPath) ? "No font file found" : "imagettftext function missing";
            dlog("WATERMARK: Fallback! reason=$reason, size=$size");
            
            // Fallback na imagestring (veľkosti 1-5)
            $gdSize = min(5, max(1, (int)($size / 6))); 
            $textW = imagefontwidth($gdSize) * strlen($text);
            $x = max(5, $w - $textW - 15);
            $y = $h - imagefontheight($gdSize) - 15;
            imagestring($img, $gdSize, $x, $y, $text, $c);
        }
    }

    private static function parseColor($img, $str) {
        $r = 255; $g = 255; $b = 255; $a = 0;
        
        if (preg_match('/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d\.]+)\)/', $str, $m)) {
            $r = (int)$m[1]; $g = (int)$m[2]; $b = (int)$m[3];
            $a = (int)((1 - (float)$m[4]) * 127);
        } elseif (preg_match('/#([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})/', $str, $m)) {
            $r = hexdec($m[1]); $g = hexdec($m[2]); $b = hexdec($m[3]);
        }
        
        return imagecolorallocatealpha($img, $r, $g, $b, max(0, min(127, $a)));
    }

    private static function ensureDir($dir) {
        if (!is_dir($dir)) mkdir($dir, 0755, true);
    }
}
