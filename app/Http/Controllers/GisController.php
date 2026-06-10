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
    public function index(): View
    {
        return view('dashboard');
    }

    public function geocode(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'q' => ['required', 'string', 'max:255'],
        ]);

        if ($validator->fails()) {
            return Response::json(['error' => 'Parameter pencarian wajib diisi.'], 400);
        }

        $query = $validator->validated()['q'];

        $response = Http::withHeaders([
            'User-Agent' => 'UsahaOnlineDetector/1.0 (+https://example.com)',
        ])->timeout(20)->get('https://nominatim.openstreetmap.org/search', [
            'q' => $query,
            'format' => 'json',
            'addressdetails' => 1,
            'limit' => 8,
            'countrycodes' => 'id',
        ]);

        if ($response->failed()) {
            return Response::json(['error' => 'Gagal mengambil data geocoding dari Nominatim.'], 500);
        }

        return Response::json($response->json());
    }

    public function nearby(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'lat' => ['required', 'numeric'],
            'lon' => ['required', 'numeric'],
            'radius' => ['nullable', 'integer', 'min:100', 'max:5000'],
        ]);

        if ($validator->fails()) {
            return Response::json(['error' => 'Koordinat tidak valid.'], 400);
        }

        $validated = $validator->validated();
        $lat = $validated['lat'];
        $lon = $validated['lon'];
        $radius = $validated['radius'] ?? 1500;

        $query = "[out:json][timeout:25];(";
        $query .= "node(around:$radius,$lat,$lon)[shop];";
        $query .= "way(around:$radius,$lat,$lon)[shop];";
        $query .= "node(around:$radius,$lat,$lon)[amenity=cafe];";
        $query .= "way(around:$radius,$lat,$lon)[amenity=cafe];";
        $query .= "node(around:$radius,$lat,$lon)[amenity=restaurant];";
        $query .= "way(around:$radius,$lat,$lon)[amenity=restaurant];";
        $query .= ");out center tags;";

        try {
            $response = Http::withHeaders([
                'User-Agent' => 'UsahaOnlineDetector/1.0 (+https://example.com)',
            ])->timeout(40)->asForm()->post('https://overpass-api.de/api/interpreter', [
                'data' => $query,
            ]);
        } catch (\Exception $e) {
            return Response::json(['error' => 'Gagal mengambil data dari Overpass API.', 'detail' => $e->getMessage()], 500);
        }

        if ($response->failed()) {
            $status = $response->status();
            $body = (string) $response->body();
            $excerpt = strlen($body) > 512 ? substr($body, 0, 512) . '...' : $body;
            return Response::json(['error' => 'Gagal mengambil data dari Overpass API.', 'status' => $status, 'response_excerpt' => $excerpt], 500);
        }

        $elements = $response->json('elements', []);

        $results = array_map(function ($item) {
            $tags = $item['tags'] ?? [];
            $latitude = $item['lat'] ?? ($item['center']['lat'] ?? null);
            $longitude = $item['lon'] ?? ($item['center']['lon'] ?? null);
            $website = $this->firstTag($tags, ['website', 'contact:website']);
            $facebook = $this->firstTag($tags, ['facebook', 'contact:facebook']);
            $instagram = $this->firstTag($tags, ['instagram', 'contact:instagram']);
            $whatsapp = $this->firstTag($tags, ['whatsapp', 'contact:whatsapp']);
            $phone = $this->firstTag($tags, ['phone', 'contact:phone']);
            $email = $this->firstTag($tags, ['email', 'contact:email']);

            $addressParts = array_filter([
                $tags['addr:housenumber'] ?? null,
                $tags['addr:street'] ?? null,
                $tags['addr:suburb'] ?? null,
                $tags['addr:city'] ?? null,
                $tags['addr:state'] ?? null,
            ]);
            $address = $addressParts ? implode(', ', $addressParts) : ($tags['addr:full'] ?? null);

            $score = Business::computeDigitalScore([
                'website' => $website,
                'facebook' => $facebook,
                'instagram' => $instagram,
                'whatsapp' => $whatsapp,
                'phone' => $phone,
                'email' => $email,
                'opening_hours' => $tags['opening_hours'] ?? null,
                'ecommerce' => $tags['ecommerce'] ?? null,
                'name' => $tags['name'] ?? null,
            ]);

            return [
                'id' => $item['id'] ?? null,
                'type' => $item['type'] ?? 'unknown',
                'name' => $tags['name'] ?? 'Usaha Tanpa Nama',
                'address' => $address,
                'latitude' => $latitude,
                'longitude' => $longitude,
                'website' => $website,
                'facebook' => $facebook,
                'instagram' => $instagram,
                'whatsapp' => $whatsapp,
                'phone' => $phone,
                'email' => $email,
                'tags' => $tags,
                'digital_score' => $score,
                'digital_level' => Business::buildDigitalLevel($score),
            ];
        }, $elements);

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
            'name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:1024'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'website' => ['nullable', 'string', 'max:255'],
            'instagram' => ['nullable', 'string', 'max:255'],
            'facebook' => ['nullable', 'string', 'max:255'],
            'whatsapp' => ['nullable', 'string', 'max:255'],
            'shopee' => ['nullable', 'string', 'max:255'],
            'tokopedia' => ['nullable', 'string', 'max:255'],
            'tiktok' => ['nullable', 'string', 'max:255'],
        ]);

        $score = Business::computeDigitalScore($validated);
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
            'total' => (int) $stats->total,
            'average_score' => round($stats->average_score ?? 0, 1),
            'online_presence' => $onlineCount,
            'levels' => $levels,
        ]);
    }

    private function firstTag(array $tags, array $keys)
    {
        foreach ($keys as $key) {
            if (!empty($tags[$key])) {
                return $tags[$key];
            }
        }

        return null;
    }
}
