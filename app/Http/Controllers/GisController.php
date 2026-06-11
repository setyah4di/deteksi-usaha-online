<?php

namespace App\Http\Controllers;

use App\Models\Business;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Response;
use Illuminate\Support\Facades\Validator;
use Illuminate\View\View;

class GisController extends Controller
{
    private string $googleApiKey;

    public function __construct()
    {
        $this->googleApiKey = config('services.google_maps.key');
    }

    public function index(): View
    {
        return view('dashboard');
    }

    // ── Geocode: Nominatim → Google Geocoding API ──────────────────────────────
    public function geocode(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'q' => ['required', 'string', 'max:255'],
        ]);

        if ($validator->fails()) {
            return Response::json(['error' => 'Parameter pencarian wajib diisi.'], 400);
        }

        $query = $validator->validated()['q'];

        $response = Http::timeout(20)->get('https://maps.googleapis.com/maps/api/geocode/json', [
            'address'    => $query,
            'key'        => $this->googleApiKey,
            'region'     => 'id',
            'language'   => 'id',
        ]);

        if ($response->failed()) {
            return Response::json(['error' => 'Gagal mengambil data geocoding dari Google.'], 500);
        }

        $json = $response->json();

        if (($json['status'] ?? '') !== 'OK' || empty($json['results'])) {
            return Response::json([]);
        }

        // Normalise ke format yang sama seperti Nominatim agar frontend tidak perlu berubah
        $results = array_map(function ($item) {
            $loc = $item['geometry']['location'];
            return [
                'lat'          => $loc['lat'],
                'lon'          => $loc['lng'],
                'display_name' => $item['formatted_address'],
            ];
        }, $json['results']);

        return Response::json($results);
    }

    // ── Nearby: Overpass → Google Places Nearby Search ────────────────────────
    public function nearby(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'lat'    => ['required', 'numeric'],
            'lon'    => ['required', 'numeric'],
            'radius' => ['nullable', 'integer', 'min:100', 'max:5000'],
        ]);

        if ($validator->fails()) {
            return Response::json(['error' => 'Koordinat tidak valid.'], 400);
        }

        $validated = $validator->validated();
        $lat    = $validated['lat'];
        $lon    = $validated['lon'];
        $radius = $validated['radius'] ?? 1500;

        // Google Places Nearby Search — ambil semua tipe bisnis yang relevan
        $types = ['store', 'restaurant', 'cafe', 'food', 'shopping_mall', 'supermarket'];
        $allPlaces = [];
        $seenIds   = [];

        foreach ($types as $type) {
            $pageToken = null;

            do {
                $params = [
                    'location'  => "$lat,$lon",
                    'radius'    => $radius,
                    'type'      => $type,
                    'key'       => $this->googleApiKey,
                    'language'  => 'id',
                ];

                if ($pageToken) {
                    $params['pagetoken'] = $pageToken;
                    sleep(2); // Google membutuhkan jeda sebelum pagetoken aktif
                }

                $response = Http::timeout(30)->get(
                    'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
                    $params
                );

                if ($response->failed()) {
                    break;
                }

                $json      = $response->json();
                $status    = $json['status'] ?? '';
                $pageToken = $json['next_page_token'] ?? null;

                if (!in_array($status, ['OK', 'ZERO_RESULTS'])) {
                    break;
                }

                foreach ($json['results'] ?? [] as $place) {
                    $placeId = $place['place_id'] ?? null;
                    if (!$placeId || isset($seenIds[$placeId])) continue;
                    $seenIds[$placeId] = true;
                    $allPlaces[]       = $place;
                }

                // Batasi agar tidak terlalu banyak request
                if (count($allPlaces) >= 60) {
                    $pageToken = null;
                }

            } while ($pageToken);
        }

        // Untuk setiap place, ambil detail (website, phone, dll) via Place Details API
        $results = [];

        foreach ($allPlaces as $place) {
            $placeId = $place['place_id'];

            $detailResp = Http::timeout(15)->get(
                'https://maps.googleapis.com/maps/api/place/details/json',
                [
                    'place_id' => $placeId,
                    'fields'   => 'name,formatted_address,geometry,website,formatted_phone_number,url,opening_hours,types,rating,user_ratings_total',
                    'key'      => $this->googleApiKey,
                    'language' => 'id',
                ]
            );

            $detail = [];
            if ($detailResp->ok()) {
                $detail = $detailResp->json('result', []);
            }

            $website = $detail['website'] ?? null;
            $phone   = $detail['formatted_phone_number'] ?? null;
            $loc     = $place['geometry']['location'] ?? [];

            // Coba deteksi platform dari website URL
            $instagram = null;
            $facebook  = null;
            $tokopedia = null;
            $shopee    = null;
            $tiktok    = null;

            if ($website) {
                if (str_contains($website, 'instagram.com'))  $instagram  = $website;
                if (str_contains($website, 'facebook.com'))   $facebook   = $website;
                if (str_contains($website, 'tokopedia.com'))  $tokopedia  = $website;
                if (str_contains($website, 'shopee.co.id'))   $shopee     = $website;
                if (str_contains($website, 'tiktok.com'))     $tiktok     = $website;
            }

            $score = Business::computeDigitalScore([
                'website'       => $website,
                'facebook'      => $facebook,
                'instagram'     => $instagram,
                'whatsapp'      => null,
                'phone'         => $phone,
                'email'         => null,
                'opening_hours' => !empty($detail['opening_hours']) ? 'set' : null,
                'name'          => $place['name'] ?? null,
            ]);

            $results[] = [
                'id'            => $placeId,
                'type'          => 'google_place',
                'name'          => $place['name'] ?? 'Usaha Tanpa Nama',
                'address'       => $detail['formatted_address'] ?? ($place['vicinity'] ?? null),
                'latitude'      => $loc['lat'] ?? null,
                'longitude'     => $loc['lng'] ?? null,
                'website'       => $website,
                'facebook'      => $facebook,
                'instagram'     => $instagram,
                'whatsapp'      => null,
                'shopee'        => $shopee,
                'tokopedia'     => $tokopedia,
                'tiktok'        => $tiktok,
                'phone'         => $phone,
                'email'         => null,
                'rating'        => $place['rating'] ?? null,
                'total_reviews' => $place['user_ratings_total'] ?? null,
                'google_maps_url' => $detail['url'] ?? null,
                'digital_score' => $score,
                'digital_level' => Business::buildDigitalLevel($score),
            ];
        }

        // Urutkan: yang punya skor lebih tinggi di atas
        usort($results, fn($a, $b) => $b['digital_score'] <=> $a['digital_score']);

        return Response::json($results);
    }

    public function list()
    {
        $businesses = Business::orderBy('digital_score', 'desc')->get();
        return Response::json($businesses);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name'      => ['required', 'string', 'max:255'],
            'address'   => ['nullable', 'string', 'max:1024'],
            'latitude'  => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'website'   => ['nullable', 'string', 'max:255'],
            'instagram' => ['nullable', 'string', 'max:255'],
            'facebook'  => ['nullable', 'string', 'max:255'],
            'whatsapp'  => ['nullable', 'string', 'max:255'],
            'shopee'    => ['nullable', 'string', 'max:255'],
            'tokopedia' => ['nullable', 'string', 'max:255'],
            'tiktok'    => ['nullable', 'string', 'max:255'],
        ]);

        $score                    = Business::computeDigitalScore($validated);
        $validated['digital_score'] = $score;
        $validated['digital_level'] = Business::buildDigitalLevel($score);

        $business = Business::create($validated);

        return Response::json($business, 201);
    }

    public function stats()
    {
        $stats = Business::query()
            ->selectRaw('COUNT(*) as total')
            ->selectRaw('AVG(digital_score) as average_score')
            ->first();

        $levels = Business::query()
            ->selectRaw('digital_level, COUNT(*) as count')
            ->groupBy('digital_level')
            ->get();

        $onlineCount = Business::query()
            ->whereNotNull('website')
            ->orWhereNotNull('instagram')
            ->orWhereNotNull('facebook')
            ->count();

        return Response::json([
            'total'           => (int) $stats->total,
            'average_score'   => round($stats->average_score ?? 0, 1),
            'online_presence' => $onlineCount,
            'levels'          => $levels,
        ]);
    }
}
