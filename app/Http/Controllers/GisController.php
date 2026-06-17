<?php

namespace App\Http\Controllers;

use App\Models\Business;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Response;
use Illuminate\Support\Facades\Validator;
use Illuminate\View\View;

class GisController extends Controller
{
    private string $googleApiKey;

    // Tipe yang dipakai untuk Nearby Search — urut dari yang paling produktif
    private const PLACE_TYPES = [
        'store', 'restaurant', 'cafe', 'food',
        'supermarket', 'shopping_mall', 'bakery',
        'bar', 'beauty_salon', 'clothing_store',
        'convenience_store', 'drugstore', 'electronics_store',
        'furniture_store', 'hardware_store', 'home_goods_store',
        'laundry', 'meal_takeaway', 'pharmacy', 'shoe_store',
    ];

    // Tipe Google Places yang DIKECUALIKAN dari hasil deteksi usaha digital
    private const EXCLUDED_TYPES = [
        'bank',
        'atm',
        'school',
        'hospital',
        'government_office',
    ];

    // Kata kunci nama usaha yang menandakan bukan usaha digital
    // (digunakan sebagai fallback jika tipe tidak terdeteksi oleh Google)
    private const EXCLUDED_NAME_KEYWORDS = [
        // Bank & keuangan
        'bank', 'bri', 'bni', 'bca', 'mandiri', 'btn', 'bsi',
        'danamon', 'cimb', 'niaga', 'permata', 'maybank', 'ocbc',
        'bjb', 'bpd', 'koperasi', 'pegadaian', 'bpr',
        // ATM
        'atm', 'anjungan tunai',
        // Sekolah & pendidikan
        'sekolah', 'sdn', 'smpn', 'sman', 'smkn', 'sd ', 'smp ', 'sma ', 'smk ',
        'universitas', 'univ.', 'institut', 'politeknik', 'akademi', 'pesantren',
        'madrasah', 'mts ', 'mi ', 'ma ', 'paud', 'tk ', 'tkit', 'sdit', 'smpit',
        'bimbel', 'lembaga kursus',
        // Rumah sakit & kesehatan pemerintah
        'rumah sakit', 'rs ', 'rsud', 'rsia', 'rsup', 'rsud', 'rsu ',
        'puskesmas', 'pustu', 'klinik pemerintah', 'posyandu',
        // Kantor pemerintah
        'kantor', 'dinas', 'kelurahan', 'kecamatan', 'kabupaten',
        'balai', 'bpjs', 'samsat', 'polres', 'polsek', 'polresta',
        'koramil', 'kodim', 'korem', 'kpu', 'kejaksaan', 'pengadilan',
        'bpn', 'bpbd', 'bps', 'bnpb', 'disdukcapil', 'dispenda',
        // Tempat ibadah
        'masjid', 'musholla', 'gereja', 'pura', 'vihara', 'klenteng',
        // Fasilitas umum
        'terminal', 'stasiun', 'pelabuhan', 'bandara', 'tpu', 'pemakaman',
        'pemadam kebakaran', 'damkar', 'pdam',
    ];

    /**
     * Peta tipe Google Places → label kategori usaha (Bahasa Indonesia).
     * Urutan penting: tipe lebih spesifik diprioritaskan (key pertama yang cocok menang).
     */
    private const CATEGORY_MAP = [
        // Makanan & Minuman
        'restaurant'    => 'Restoran & Rumah Makan',
        'cafe'          => 'Kafe & Minuman',
        'bakery'        => 'Bakeri & Roti',
        'bar'           => 'Bar & Minuman',
        'meal_takeaway' => 'Makanan Siap Saji',
        'food'          => 'Makanan & Minuman',
        // Ritel & Belanja
        'supermarket'         => 'Supermarket & Swalayan',
        'shopping_mall'       => 'Pusat Perbelanjaan',
        'clothing_store'      => 'Toko Pakaian & Fashion',
        'shoe_store'          => 'Toko Sepatu',
        'electronics_store'   => 'Elektronik & Gadget',
        'furniture_store'     => 'Furnitur & Perabot',
        'hardware_store'      => 'Toko Bangunan & Material',
        'home_goods_store'    => 'Peralatan Rumah Tangga',
        'convenience_store'   => 'Minimarket & Toko Kelontong',
        'store'               => 'Toko Umum',
        // Kesehatan & Kecantikan
        'pharmacy'     => 'Apotek & Toko Obat',
        'drugstore'    => 'Apotek & Toko Obat',
        'beauty_salon' => 'Salon & Kecantikan',
        // Jasa
        'laundry' => 'Laundry & Cuci Baju',
    ];

    // Field detail yang diambil — hanya yang benar-benar dipakai
    private const DETAIL_FIELDS = 'name,formatted_address,geometry,website,formatted_phone_number,url,opening_hours,rating,user_ratings_total,types';

    public function __construct()
    {
        $this->googleApiKey = config('services.google_maps.key');
    }

    public function index(): View
    {
        return view('dashboard');
    }

    // ── Geocode ───────────────────────────────────────────────────────────────
    public function geocode(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'q' => ['required', 'string', 'max:255'],
        ]);

        if ($validator->fails()) {
            return Response::json(['error' => 'Parameter pencarian wajib diisi.'], 400);
        }

        $query    = $validator->validated()['q'];
        $cacheKey = 'geocode_v2_' . md5($query);

        if ($cached = Cache::get($cacheKey)) {
            return Response::json($cached);
        }

        $response = Http::timeout(10)->get('https://maps.googleapis.com/maps/api/geocode/json', [
            'address'  => $query,
            'key'      => $this->googleApiKey,
            'region'   => 'id',
            'language' => 'id',
        ]);

        if (!$response->ok() || $response->json('status') !== 'OK') {
            return Response::json([]);
        }

        $results = array_map(fn($item) => [
            'lat'          => $item['geometry']['location']['lat'],
            'lon'          => $item['geometry']['location']['lng'],
            'display_name' => $item['formatted_address'],
        ], $response->json('results', []));

        Cache::put($cacheKey, $results, now()->addHours(6));

        return Response::json($results);
    }

    // ── Nearby ────────────────────────────────────────────────────────────────
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

        $lat    = $validator->validated()['lat'];
        $lon    = $validator->validated()['lon'];
        $radius = $validator->validated()['radius'] ?? 1500;

        $latRound = round((float) $lat, 3);
        $lonRound = round((float) $lon, 3);
        $cacheKey = 'nearby_v4_' . md5("{$latRound}_{$lonRound}_{$radius}");

        if ($cached = Cache::get($cacheKey)) {
            return Response::json($cached);
        }

        // ── STEP 1: Nearby Search ─────────────────────────────────────────
        $location  = "{$lat},{$lon}";
        $allPlaces = $this->fetchAllPlaces($location, $radius);

        if (empty($allPlaces)) {
            return Response::json([]);
        }

        // ── STEP 2: Place Details ─────────────────────────────────────────
        $details = $this->fetchAllDetails($allPlaces);

        // ── STEP 3: Susun & return ────────────────────────────────────────
        $results = $this->buildResults($allPlaces, $details);

        usort($results, fn($a, $b) => $b['digital_score'] <=> $a['digital_score']);

        Cache::put($cacheKey, $results, now()->addHour());

        return Response::json($results);
    }

    // ── Tentukan kategori usaha dari types Google Places ──────────────────────
    private function resolveCategory(array $types): string
    {
        foreach (self::CATEGORY_MAP as $type => $label) {
            if (in_array($type, $types, true)) {
                return $label;
            }
        }
        return 'Usaha Lainnya';
    }

    // ── Cek apakah sebuah place harus dikecualikan ────────────────────────
    private function isExcludedPlace(array $place, array $detail = []): bool
    {
        // 1. Cek tipe dari data Nearby Search (field 'types')
        $nearbyTypes = $place['types'] ?? [];
        foreach (self::EXCLUDED_TYPES as $excluded) {
            if (in_array($excluded, $nearbyTypes, true)) {
                return true;
            }
        }

        // 2. Cek tipe dari Place Details (bisa lebih lengkap)
        $detailTypes = $detail['types'] ?? [];
        foreach (self::EXCLUDED_TYPES as $excluded) {
            if (in_array($excluded, $detailTypes, true)) {
                return true;
            }
        }

        // 3. Cek nama usaha mengandung kata kunci yang dikecualikan
        $nameLower = mb_strtolower($place['name'] ?? '');
        foreach (self::EXCLUDED_NAME_KEYWORDS as $keyword) {
            // Gunakan word-boundary sederhana: cek apakah keyword ada di nama
            if (str_contains($nameLower, $keyword)) {
                return true;
            }
        }

        return false;
    }

    // ── Fetch semua places paralel ─────────────────────────────────────────
    private function fetchAllPlaces(string $location, int $radius): array
    {
        $types = self::PLACE_TYPES;

        $page1 = Http::pool(function ($pool) use ($types, $location, $radius) {
            return array_map(fn($type) =>
                $pool->as($type)
                     ->timeout(20)
                     ->get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', [
                         'location' => $location,
                         'radius'   => $radius,
                         'type'     => $type,
                         'key'      => $this->googleApiKey,
                         'language' => 'id',
                     ]),
                $types
            );
        });

        $allPlaces  = [];
        $seenIds    = [];
        $pageTokens = [];

        foreach ($types as $type) {
            $resp = $page1[$type] ?? null;
            if (!$resp || !$resp->ok()) continue;

            $json   = $resp->json();
            $status = $json['status'] ?? '';
            if (!in_array($status, ['OK', 'ZERO_RESULTS'])) continue;

            foreach ($json['results'] ?? [] as $place) {
                $pid = $place['place_id'] ?? null;
                if (!$pid || isset($seenIds[$pid])) continue;

                // Filter awal berdasarkan tipe dari Nearby Search
                // (sebelum ambil detail — hemat API call)
                if ($this->isExcludedPlace($place)) {
                    continue;
                }

                $seenIds[$pid] = true;
                $allPlaces[]   = $place;
            }

            if (!empty($json['next_page_token'])) {
                $pageTokens[] = $json['next_page_token'];
            }
        }

        if (!empty($pageTokens) && count($allPlaces) < 100) {
            sleep(2);

            $page2 = Http::pool(function ($pool) use ($pageTokens) {
                return array_map(fn($token) =>
                    $pool->timeout(20)
                         ->get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', [
                             'pagetoken' => $token,
                             'key'       => $this->googleApiKey,
                         ]),
                    $pageTokens
                );
            });

            foreach ($page2 as $resp) {
                if (!$resp || !$resp->ok()) continue;
                foreach ($resp->json('results', []) as $place) {
                    $pid = $place['place_id'] ?? null;
                    if (!$pid || isset($seenIds[$pid])) continue;

                    if ($this->isExcludedPlace($place)) {
                        continue;
                    }

                    $seenIds[$pid] = true;
                    $allPlaces[]   = $place;
                }
            }
        }

        return $allPlaces;
    }

    // ── Fetch detail semua place paralel dalam batch ───────────────────────
    private function fetchAllDetails(array $allPlaces): array
    {
        $chunks  = array_chunk($allPlaces, 20);
        $details = [];

        foreach ($chunks as $chunk) {
            $responses = Http::pool(function ($pool) use ($chunk) {
                return array_map(fn($place) =>
                    $pool->as($place['place_id'])
                         ->timeout(15)
                         ->get('https://maps.googleapis.com/maps/api/place/details/json', [
                             'place_id' => $place['place_id'],
                             'fields'   => self::DETAIL_FIELDS,
                             'key'      => $this->googleApiKey,
                             'language' => 'id',
                         ]),
                    $chunk
                );
            });

            foreach ($chunk as $place) {
                $pid           = $place['place_id'];
                $resp          = $responses[$pid] ?? null;
                $details[$pid] = ($resp && $resp->ok()) ? ($resp->json('result') ?? []) : [];
            }
        }

        return $details;
    }

    // ── Susun array hasil akhir ────────────────────────────────────────────
    private function buildResults(array $allPlaces, array $details): array
    {
        $results = [];

        foreach ($allPlaces as $place) {
            $pid    = $place['place_id'];
            $detail = $details[$pid] ?? [];

            // Filter sekunder: cek lagi dengan data detail yang lebih lengkap
            // (tipe detail bisa berbeda/lebih spesifik dari Nearby Search)
            if ($this->isExcludedPlace($place, $detail)) {
                continue;
            }

            $loc = $place['geometry']['location'] ?? [];

            $website = $detail['website'] ?? null;
            $phone   = $detail['formatted_phone_number'] ?? null;

            $ws        = (string) $website;
            $instagram = str_contains($ws, 'instagram.com') ? $website : null;
            $facebook  = str_contains($ws, 'facebook.com')  ? $website : null;
            $tokopedia = str_contains($ws, 'tokopedia.com') ? $website : null;
            $shopee    = str_contains($ws, 'shopee.co.id')  ? $website : null;
            $tiktok    = str_contains($ws, 'tiktok.com')    ? $website : null;

            $whatsapp = null;
            if ($phone) {
                $normalized = preg_replace('/[^0-9]/', '', $phone);
                if (str_starts_with($normalized, '08') || str_starts_with($normalized, '628')) {
                    $whatsapp = $normalized;
                }
            }

            // Gabungkan types Nearby + Detail untuk resolusi kategori terbaik
            $allTypes = array_unique(array_merge(
                $place['types'] ?? [],
                $detail['types'] ?? []
            ));
            $category = $this->resolveCategory($allTypes);

            $score = Business::computeDigitalScore([
                'website'       => $website,
                'facebook'      => $facebook,
                'instagram'     => $instagram,
                'whatsapp'      => $whatsapp,
                'phone'         => $phone,
                'email'         => null,
                'opening_hours' => !empty($detail['opening_hours']) ? 'set' : null,
                'name'          => $place['name'] ?? null,
            ]);

            $results[] = [
                'id'              => $pid,
                'type'            => 'google_place',
                'category'        => $category,
                'name'            => $place['name'] ?? 'Usaha Tanpa Nama',
                'address'         => $detail['formatted_address'] ?? ($place['vicinity'] ?? null),
                'latitude'        => $loc['lat'] ?? null,
                'longitude'       => $loc['lng'] ?? null,
                'website'         => $website,
                'facebook'        => $facebook,
                'instagram'       => $instagram,
                'whatsapp'        => $whatsapp,
                'shopee'          => $shopee,
                'tokopedia'       => $tokopedia,
                'tiktok'          => $tiktok,
                'phone'           => $phone,
                'email'           => null,
                'rating'          => $place['rating'] ?? null,
                'total_reviews'   => $place['user_ratings_total'] ?? null,
                'google_maps_url' => $detail['url'] ?? null,
                'digital_score'   => $score,
                'digital_level'   => Business::buildDigitalLevel($score),
            ];
        }

        return $results;
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

        $score                      = Business::computeDigitalScore($validated);
        $validated['digital_score'] = $score;
        $validated['digital_level'] = Business::buildDigitalLevel($score);

        return Response::json(Business::create($validated), 201);
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
