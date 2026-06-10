<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Business extends Model
{
    use HasFactory;

    protected $guarded = [];

    protected $casts = [
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'digital_score' => 'integer',
    ];

    public static function computeDigitalScore(array $data): int
    {
        $score = 0;

        if (!empty($data['website'])) {
            $score += 25;
        }

        if (!empty($data['facebook'])) {
            $score += 15;
        }

        if (!empty($data['instagram'])) {
            $score += 15;
        }

        if (!empty($data['whatsapp'])) {
            $score += 10;
        }

        if (!empty($data['email']) || !empty($data['phone'])) {
            $score += 10;
        }

        if (!empty($data['opening_hours'])) {
            $score += 5;
        }

        if (!empty($data['ecommerce']) || !empty($data['shopee']) || !empty($data['tokopedia']) || !empty($data['tiktok'])) {
            $score += 10;
        }

        if (!empty($data['name'])) {
            $score += 10;
        }

        return min(100, $score);
    }

    public static function buildDigitalLevel(int $score): string
    {
        if ($score >= 75) {
            return 'Sangat Tinggi';
        }

        if ($score >= 50) {
            return 'Tinggi';
        }

        if ($score >= 25) {
            return 'Sedang';
        }

        return 'Rendah';
    }
}
