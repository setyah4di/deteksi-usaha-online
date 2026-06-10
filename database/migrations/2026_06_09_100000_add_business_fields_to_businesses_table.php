<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->string('name')->nullable()->after('id');
            $table->text('address')->nullable()->after('name');
            $table->decimal('latitude', 10, 7)->nullable()->after('address');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->string('website')->nullable()->after('longitude');
            $table->string('instagram')->nullable()->after('website');
            $table->string('facebook')->nullable()->after('instagram');
            $table->string('whatsapp')->nullable()->after('facebook');
            $table->string('shopee')->nullable()->after('whatsapp');
            $table->string('tokopedia')->nullable()->after('shopee');
            $table->string('tiktok')->nullable()->after('tokopedia');
            $table->integer('digital_score')->default(0)->after('tiktok');
            $table->string('digital_level')->nullable()->after('digital_score');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->dropColumn([
                'name',
                'address',
                'latitude',
                'longitude',
                'website',
                'instagram',
                'facebook',
                'whatsapp',
                'shopee',
                'tokopedia',
                'tiktok',
                'digital_score',
                'digital_level',
            ]);
        });
    }
};
