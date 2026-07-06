<?php

namespace Tests\Feature;

use App\Models\Business;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BusinessCrudTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_update_existing_business(): void
    {
        $business = Business::create([
            'name' => 'Toko Lama',
            'address' => 'Alamat lama',
            'website' => 'https://lama.test',
            'digital_score' => 10,
            'digital_level' => 'Rendah',
        ]);

        $response = $this->putJson('/api/businesses/' . $business->id, [
            'name' => 'Toko Baru',
            'address' => 'Alamat baru',
            'website' => 'https://baru.test',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('name', 'Toko Baru')
            ->assertJsonPath('address', 'Alamat baru');

        $this->assertDatabaseHas('businesses', [
            'id' => $business->id,
            'name' => 'Toko Baru',
            'address' => 'Alamat baru',
        ]);
    }

    public function test_can_delete_existing_business(): void
    {
        $business = Business::create([
            'name' => 'Toko Hapus',
            'address' => 'Alamat hapus',
            'digital_score' => 10,
            'digital_level' => 'Rendah',
        ]);

        $response = $this->deleteJson('/api/businesses/' . $business->id);

        $response->assertStatus(200)
            ->assertJson(['deleted' => true]);

        $this->assertDatabaseMissing('businesses', ['id' => $business->id]);
    }
}
