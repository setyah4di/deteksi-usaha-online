<?php

use App\Http\Controllers\GisController;
use Illuminate\Support\Facades\Route;

Route::get('/', [GisController::class, 'index']);
Route::get('/api/geocode', [GisController::class, 'geocode']);
Route::get('/api/nearby', [GisController::class, 'nearby']);
Route::get('/api/businesses', [GisController::class, 'list']);
Route::post('/api/businesses', [GisController::class, 'store']);
Route::get('/api/stats', [GisController::class, 'stats']);
