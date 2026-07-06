<!DOCTYPE html>
<html lang="id">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="csrf-token" content="{{ csrf_token() }}" />
        <title>Sistem Pemetaan Usaha Online</title>
        <link rel="icon" href="/logo_bps.png" />
        @vite(['resources/css/app.css', 'resources/js/app.ts'])
    </head>
    <body class="bg-slate-50 text-slate-900 antialiased">
        <div id="app" class="min-h-screen"></div>
    </body>
</html>
