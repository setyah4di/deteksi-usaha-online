import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../css/app.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import * as XLSX from 'xlsx';
import BusinessForm from './components/BusinessForm';

L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

const DefaultIcon = L.icon({
    iconUrl, iconRetinaUrl, shadowUrl,
    iconSize: [25, 41], iconAnchor: [12, 41],
    popupAnchor: [1, -34], tooltipAnchor: [16, -28], shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const api = {
    geocode   : '/api/geocode',
    nearby    : '/api/nearby',
    businesses: '/api/businesses',
    stats     : '/api/stats',
};

const fetchJson = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || data?.message || 'Terjadi kesalahan server');
    return data;
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Page = 'dashboard' | 'daftar';

interface BusinessItem {
    id?: number | string;
    type?: string;
    category?: string;
    name: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    website?: string;
    instagram?: string;
    facebook?: string;
    whatsapp?: string;
    shopee?: string;
    tokopedia?: string;
    tiktok?: string;
    phone?: string;
    email?: string;
    rating?: number;
    total_reviews?: number;
    google_maps_url?: string;
    digital_score: number;
    digital_level: string;
}

// ─── Client-side exclusion filter ────────────────────────────────────────────

const EXCLUDED_NAME_KEYWORDS_CLIENT = [
    'bank', 'bri', 'bni', 'bca', 'mandiri', 'btn', 'bsi',
    'danamon', 'cimb', 'niaga', 'permata', 'maybank', 'ocbc',
    'bjb', 'bpd', 'koperasi', 'pegadaian', 'bpr',
    'atm', 'anjungan tunai',
    'sekolah', 'sdn', 'smpn', 'sman', 'smkn',
    'universitas', 'institut', 'politeknik', 'akademi', 'pesantren',
    'madrasah', 'paud',
    'rumah sakit', 'rsud', 'rsia', 'rsup', 'rsu ',
    'puskesmas', 'pustu', 'posyandu',
    'kantor dinas', 'kelurahan', 'kecamatan',
    'balai ', 'bpjs', 'samsat', 'polres', 'polsek',
    'koramil', 'kodim', 'kpu', 'kejaksaan', 'pengadilan',
    'masjid', 'musholla', 'gereja', 'pura', 'vihara', 'klenteng',
    'terminal', 'stasiun', 'pelabuhan', 'bandara',
    'pemadam kebakaran', 'damkar', 'pdam',
];

const isExcludedBusiness = (item: BusinessItem): boolean => {
    const nameLower = (item.name || '').toLowerCase();
    return EXCLUDED_NAME_KEYWORDS_CLIENT.some((kw) => nameLower.includes(kw));
};

// ─── Category helpers ─────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<string, { badge: string; bar: string }> = {
    'Restoran & Rumah Makan'      : { badge: 'bg-orange-50 text-orange-700 border-orange-200',    bar: '#f97316' },
    'Kafe & Minuman'              : { badge: 'bg-amber-50 text-amber-700 border-amber-200',       bar: '#f59e0b' },
    'Bakeri & Roti'               : { badge: 'bg-yellow-50 text-yellow-700 border-yellow-200',    bar: '#eab308' },
    'Bar & Minuman'               : { badge: 'bg-purple-50 text-purple-700 border-purple-200',    bar: '#a855f7' },
    'Makanan Siap Saji'           : { badge: 'bg-red-50 text-red-700 border-red-200',             bar: '#ef4444' },
    'Makanan & Minuman'           : { badge: 'bg-rose-50 text-rose-700 border-rose-200',          bar: '#f43f5e' },
    'Supermarket & Swalayan'      : { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: '#10b981' },
    'Pusat Perbelanjaan'          : { badge: 'bg-teal-50 text-teal-700 border-teal-200',          bar: '#14b8a6' },
    'Toko Pakaian & Fashion'      : { badge: 'bg-pink-50 text-pink-700 border-pink-200',          bar: '#ec4899' },
    'Toko Sepatu'                 : { badge: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200', bar: '#d946ef' },
    'Elektronik & Gadget'         : { badge: 'bg-blue-50 text-blue-700 border-blue-200',          bar: '#3b82f6' },
    'Furnitur & Perabot'          : { badge: 'bg-lime-50 text-lime-700 border-lime-200',          bar: '#84cc16' },
    'Toko Bangunan & Material'    : { badge: 'bg-stone-100 text-stone-700 border-stone-300',      bar: '#78716c' },
    'Peralatan Rumah Tangga'      : { badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',          bar: '#06b6d4' },
    'Minimarket & Toko Kelontong' : { badge: 'bg-green-50 text-green-700 border-green-200',       bar: '#22c55e' },
    'Toko Umum'                   : { badge: 'bg-sky-50 text-sky-700 border-sky-200',             bar: '#0ea5e9' },
    'Apotek & Toko Obat'          : { badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',    bar: '#6366f1' },
    'Salon & Kecantikan'          : { badge: 'bg-violet-50 text-violet-700 border-violet-200',    bar: '#8b5cf6' },
    'Laundry & Cuci Baju'         : { badge: 'bg-slate-100 text-slate-600 border-slate-300',      bar: '#64748b' },
    'Usaha Lainnya'               : { badge: 'bg-slate-50 text-slate-500 border-slate-200',       bar: '#94a3b8' },
};

const CATEGORY_ICONS: Record<string, string> = {
    'Restoran & Rumah Makan'      : '🍽️',
    'Kafe & Minuman'              : '☕',
    'Bakeri & Roti'               : '🥐',
    'Bar & Minuman'               : '🍹',
    'Makanan Siap Saji'           : '🥡',
    'Makanan & Minuman'           : '🍴',
    'Supermarket & Swalayan'      : '🛒',
    'Pusat Perbelanjaan'          : '🏬',
    'Toko Pakaian & Fashion'      : '👗',
    'Toko Sepatu'                 : '👟',
    'Elektronik & Gadget'         : '📱',
    'Furnitur & Perabot'          : '🪑',
    'Toko Bangunan & Material'    : '🔨',
    'Peralatan Rumah Tangga'      : '🏠',
    'Minimarket & Toko Kelontong' : '🏪',
    'Toko Umum'                   : '🛍️',
    'Apotek & Toko Obat'          : '💊',
    'Salon & Kecantikan'          : '💇',
    'Laundry & Cuci Baju'         : '👕',
    'Usaha Lainnya'               : '📦',
};

const categoryBadgeClass = (cat?: string) =>
    (CATEGORY_STYLE[cat || ''] ?? CATEGORY_STYLE['Usaha Lainnya']).badge;

const categoryBarColor = (cat?: string) =>
    (CATEGORY_STYLE[cat || ''] ?? CATEGORY_STYLE['Usaha Lainnya']).bar;

// ─── Download PNG gabungan (distribusi + bar chart kategori) ─────────────────

interface DownloadParams {
    locationLabel: string;
    total: number;
    high: number;
    medium: number;
    low: number;
    pctHigh: number;
    pctMed: number;
    pctLow: number;
    categoryData: [string, number][];
}

const downloadCombinedPNG = (p: DownloadParams) => {
    const DPR        = 2;          // retina
    const W          = 800;        // lebar logical
    const PAD        = 40;

    // ── Ukuran bagian distribusi ──
    const DIST_H     = 260;

    // ── Ukuran bagian bar chart ──
    const ROW_H      = 38;
    const LABEL_W    = 210;
    const BAR_X      = PAD + LABEL_W;
    const BAR_W      = W - BAR_X - PAD - 70;
    const CHART_ROWS = Math.min(p.categoryData.length, 15);
    const BAR_H      = CHART_ROWS * ROW_H + 60; // 60 = header section

    // ── Footer ──
    const FOOTER_H   = 36;

    const TOTAL_H    = PAD + DIST_H + 24 + BAR_H + FOOTER_H + PAD;

    const canvas  = document.createElement('canvas');
    canvas.width  = W * DPR;
    canvas.height = TOTAL_H * DPR;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(DPR, DPR);

    // ── Helpers ──
    const font = (size: number, weight: string = '400') =>
        `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`;

    const roundRect = (x: number, y: number, w: number, h: number, r: number, fill: string) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
    };

    // ════════════════════════════════
    // Background putih
    // ════════════════════════════════
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, W, TOTAL_H);
    roundRect(PAD / 2, PAD / 2, W - PAD, TOTAL_H - PAD, 20, '#ffffff');

    // ════════════════════════════════
    // Header global
    // ════════════════════════════════
    let y = PAD + 10;

    ctx.font      = font(15, '700');
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.fillText(
        p.locationLabel
            ? `Laporan Digitalisasi Usaha — ${p.locationLabel}`
            : 'Laporan Digitalisasi Usaha',
        W / 2, y
    );
    y += 20;

    ctx.font      = font(11);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(
        `${p.total} usaha terdeteksi · ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`,
        W / 2, y
    );
    y += 28;

    // ════════════════════════════════
    // BAGIAN 1 — Distribusi Level Digital
    // ════════════════════════════════

    ctx.textAlign = 'left';
    ctx.font      = font(12, '700');
    ctx.fillStyle = '#1e293b';
    ctx.fillText('Distribusi Level Digital Wilayah', PAD, y);
    ctx.font      = font(10);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Berdasarkan ${p.total} usaha`, PAD, y + 16);
    y += 34;

    // 3 stat cards
    const CARD_W   = (W - PAD * 2 - 24) / 3;
    const CARD_H   = 80;
    const cards = [
        { label: 'Tinggi / Sangat Tinggi', value: p.high,   color: '#10b981', bg: '#ecfdf5' },
        { label: 'Sedang',                  value: p.medium, color: '#f59e0b', bg: '#fffbeb' },
        { label: 'Rendah',                  value: p.low,    color: '#f43f5e', bg: '#fff1f2' },
    ];

    cards.forEach(({ label, value, color, bg }, i) => {
        const cx = PAD + i * (CARD_W + 12);
        roundRect(cx, y, CARD_W, CARD_H, 12, bg);

        ctx.font      = font(8.5, '600');
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'left';
        ctx.fillText(label.toUpperCase(), cx + 14, y + 20);

        ctx.font      = font(36, '800');
        ctx.fillStyle = color;
        ctx.fillText(String(value), cx + 14, y + 62);

        // persen kecil
        const pct = p.total > 0 ? Math.round((value / p.total) * 100) : 0;
        ctx.font      = font(10, '600');
        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.fillText(`${pct}%`, cx + CARD_W - 14, y + 62);
    });

    y += CARD_H + 20;

    // Progress bar
    const PB_H    = 14;
    const PB_W    = W - PAD * 2;

    // background track
    roundRect(PAD, y, PB_W, PB_H, 7, '#e2e8f0');

    // segments
    const segments = [
        { pct: p.pctHigh, color: '#34d399' },
        { pct: p.pctMed,  color: '#fbbf24' },
        { pct: p.pctLow,  color: '#fb7185' },
    ];
    let bx = PAD;
    segments.forEach(({ pct, color }, i) => {
        const sw = Math.round((pct / 100) * PB_W);
        if (sw <= 0) return;
        // Radius: kiri untuk segmen pertama, kanan untuk terakhir
        const r = 7;
        ctx.beginPath();
        const left  = i === 0;
        const right = i === segments.length - 1 || segments.slice(i + 1).every(s => s.pct === 0);
        if (left && right) {
            ctx.roundRect(bx, y, sw, PB_H, r);
        } else if (left) {
            ctx.roundRect(bx, y, sw, PB_H, [r, 0, 0, r]);
        } else if (right) {
            ctx.roundRect(bx, y, sw, PB_H, [0, r, r, 0]);
        } else {
            ctx.rect(bx, y, sw, PB_H);
        }
        ctx.fillStyle = color;
        ctx.fill();
        bx += sw;
    });

    // Legend
    y += PB_H + 12;
    const legends = [
        { label: `${p.pctHigh}% Tinggi`,  color: '#34d399' },
        { label: `${p.pctMed}% Sedang`,   color: '#fbbf24' },
        { label: `${p.pctLow}% Rendah`,   color: '#fb7185' },
    ];
    let lx = PAD;
    legends.forEach(({ label, color }) => {
        ctx.beginPath();
        ctx.arc(lx + 5, y + 5, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.font      = font(11);
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'left';
        ctx.fillText(label, lx + 14, y + 9);
        lx += ctx.measureText(label).width + 36;
    });

    y += 32;

    // Garis pemisah
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    y += 24;

    // ════════════════════════════════
    // BAGIAN 2 — Bar Chart Kategori
    // ════════════════════════════════

    ctx.textAlign = 'left';
    ctx.font      = font(12, '700');
    ctx.fillStyle = '#1e293b';
    ctx.fillText('Perbandingan Usaha per Kategori', PAD, y);
    ctx.font      = font(10);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`${p.categoryData.length} kategori`, PAD, y + 16);
    y += 34;

    const maxCount = p.categoryData.length > 0 ? p.categoryData[0][1] : 1;
    const rows     = p.categoryData.slice(0, 15);

    rows.forEach(([cat, count]) => {
        const midY  = y + ROW_H / 2;
        const barW  = Math.max(4, (count / maxCount) * BAR_W);
        const color = categoryBarColor(cat);
        const icon  = CATEGORY_ICONS[cat] || '📦';
        const pct   = p.total > 0 ? Math.round((count / p.total) * 100) : 0;

        // Label kiri (icon + nama kategori)
        ctx.font      = font(11);
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'right';
        // Truncate panjang nama
        let catLabel = `${icon} ${cat}`;
        while (ctx.measureText(catLabel).width > LABEL_W - 8 && catLabel.length > 4) {
            catLabel = catLabel.slice(0, -1);
        }
        if (catLabel !== `${icon} ${cat}`) catLabel += '…';
        ctx.fillText(catLabel, PAD + LABEL_W - 4, midY + 4);

        // Track bar (abu)
        roundRect(BAR_X, y + 8, BAR_W, ROW_H - 16, 6, '#f1f5f9');

        // Bar berwarna
        roundRect(BAR_X, y + 8, barW, ROW_H - 16, 6, color);

        // Angka jumlah
        ctx.font      = font(11, '700');
        ctx.fillStyle = '#1e293b';
        ctx.textAlign = 'left';
        ctx.fillText(String(count), BAR_X + barW + 8, midY + 4);

        // Persentase
        ctx.font      = font(10);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`${pct}%`, BAR_X + barW + 36, midY + 4);

        y += ROW_H;
    });

    y += 16;

    // ════════════════════════════════
    // Footer
    // ════════════════════════════════
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    y += 16;

    ctx.font      = font(9);
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'left';
    ctx.fillText('Pemetaan Usaha Digital', PAD, y + 6);

    ctx.textAlign = 'right';
    ctx.fillText(
        `Diunduh: ${new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}`,
        W - PAD, y + 6
    );

    // ── Export ke PNG ──
    canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href    = url;
        a.download = `laporan_digitalisasi_${(p.locationLabel || 'wilayah').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        URL.revokeObjectURL(url);
    }, 'image/png');
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const levelBadgeClass = (level: string) => {
    if (['Sangat Tinggi', 'Tinggi'].includes(level)) return 'text-emerald-700 bg-emerald-50 border border-emerald-200';
    if (level === 'Sedang') return 'text-amber-700 bg-amber-50 border border-amber-200';
    return 'text-rose-700 bg-rose-50 border border-rose-200';
};

const StatCard = ({ label, value, dark = false }: { label: string; value: string | number; dark?: boolean }) =>
    React.createElement('div',
        { className: `rounded-2xl p-5 flex flex-col gap-2 ${dark ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-950'}` },
        React.createElement('p', { className: `text-xs font-semibold uppercase tracking-widest ${dark ? 'text-slate-400' : 'text-slate-500'}` }, label),
        React.createElement('p', { className: 'text-3xl font-bold tabular-nums' }, value)
    );

// ─── Search Input ─────────────────────────────────────────────────────────────

const TableSearchInput = ({
    value, onChange, placeholder = 'Cari nama usaha…', resultCount, totalCount,
}: {
    value: string; onChange: (v: string) => void;
    placeholder?: string; resultCount: number; totalCount: number;
}) =>
    React.createElement('div', { className: 'flex items-center gap-3' },
        React.createElement('div', { className: 'relative flex-1' },
            React.createElement('div', { className: 'pointer-events-none absolute inset-y-0 left-3 flex items-center' },
                React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 20 20', fill: 'currentColor', className: 'w-4 h-4 text-slate-400' },
                    React.createElement('path', { fillRule: 'evenodd', d: 'M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z', clipRule: 'evenodd' })
                )
            ),
            React.createElement('input', {
                type: 'text', value,
                onChange: (e: any) => onChange(e.target.value),
                placeholder,
                className: 'w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-9 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100',
            }),
            value ? React.createElement('button', {
                onClick: () => onChange(''),
                className: 'absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-700 transition',
            },
                React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 20 20', fill: 'currentColor', className: 'w-4 h-4' },
                    React.createElement('path', { d: 'M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z' })
                )
            ) : null
        ),
        value ? React.createElement('span', { className: 'shrink-0 text-xs text-slate-500 tabular-nums' },
            `${resultCount} / ${totalCount}`
        ) : null
    );

// ─── Export Excel ─────────────────────────────────────────────────────────────

const exportToExcel = (items: BusinessItem[], filename: string, sheetLabel: string) => {
    const rows = items.map((item) => ({
        'Nama Usaha'      : item.name,
        'Kategori'        : item.category || 'Usaha Lainnya',
        'Alamat'          : item.address || '',
        'Telepon'         : item.phone || '',
        'Email'           : item.email || '',
        'Website'         : item.website || '',
        'Instagram'       : item.instagram || '',
        'Facebook'        : item.facebook || '',
        'WhatsApp'        : item.whatsapp || '',
        'Shopee'          : item.shopee || '',
        'Tokopedia'       : item.tokopedia || '',
        'TikTok'          : item.tiktok || '',
        'Rating Google'   : item.rating ?? '',
        'Total Ulasan'    : item.total_reviews ?? '',
        'Skor Digital'    : item.digital_score,
        'Level Digital'   : item.digital_level,
        'Latitude'        : item.latitude ?? '',
        'Longitude'       : item.longitude ?? '',
        'Google Maps URL' : item.google_maps_url || '',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const colKeys = Object.keys(rows[0] || {}) as (keyof typeof rows[0])[];
    ws['!cols'] = colKeys.map((key) => ({
        wch: Math.max(String(key).length, ...rows.map((r) => String(r[key] ?? '').length)) + 2,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetLabel);
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

const ExportButton = ({ items, filename, sheetLabel }: { items: BusinessItem[]; filename: string; sheetLabel: string }) =>
    React.createElement('button', {
        onClick: () => exportToExcel(items, filename, sheetLabel),
        className: 'shrink-0 flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 active:bg-emerald-200 transition',
        title: `Export ${sheetLabel} ke Excel`,
    },
        React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 20 20', fill: 'currentColor', className: 'w-4 h-4 shrink-0' },
            React.createElement('path', { fillRule: 'evenodd', d: 'M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z', clipRule: 'evenodd' })
        ),
        'Export Excel'
    );

// ─── Detail Modal ─────────────────────────────────────────────────────────────

const DetailModal = ({ item, onClose }: { item: BusinessItem; onClose: () => void }) => {
    const platforms = [
        { key: 'website',   label: 'Website',   icon: '🌐' },
        { key: 'instagram', label: 'Instagram', icon: '📸' },
        { key: 'facebook',  label: 'Facebook',  icon: '👤' },
        { key: 'whatsapp',  label: 'WhatsApp',  icon: '💬' },
        { key: 'shopee',    label: 'Shopee',    icon: '🛍️' },
        { key: 'tokopedia', label: 'Tokopedia', icon: '🟢' },
        { key: 'tiktok',    label: 'TikTok',    icon: '🎵' },
    ].filter(({ key }) => (item as any)[key]);

    const contacts = [
        { key: 'phone', label: 'Telepon', icon: '📞', prefix: 'tel:' },
        { key: 'email', label: 'Email',   icon: '✉️', prefix: 'mailto:' },
    ].filter(({ key }) => (item as any)[key]);

    return React.createElement('div', { className: 'fixed inset-0 z-[99999] flex items-center justify-center' },
        React.createElement('div', { className: 'absolute inset-0 bg-black/40', onClick: onClose }),
        React.createElement('div', { className: 'relative z-[100000] w-full max-w-lg mx-4 bg-white rounded-[28px] shadow-2xl overflow-y-auto max-h-[90vh]' },
            React.createElement('div', { className: 'p-6 border-b border-slate-200 flex items-start justify-between gap-4' },
                React.createElement('div', null,
                    React.createElement('h3', { className: 'text-base font-semibold text-slate-950' }, item.name),
                    React.createElement('div', { className: 'flex items-center gap-2 mt-1 flex-wrap' },
                        item.category ? React.createElement('span', {
                            className: `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${categoryBadgeClass(item.category)}`,
                        }, `${CATEGORY_ICONS[item.category] || '📦'} ${item.category}`) : null,
                        React.createElement('p', { className: 'text-sm text-slate-500' }, item.address || 'Alamat tidak tersedia')
                    ),
                    item.rating ? React.createElement('div', { className: 'flex items-center gap-1.5 mt-1.5' },
                        React.createElement('span', { className: 'text-amber-400 text-sm' }, '★'),
                        React.createElement('span', { className: 'text-sm font-semibold text-slate-700' }, item.rating.toFixed(1)),
                        item.total_reviews ? React.createElement('span', { className: 'text-xs text-slate-400' }, `(${item.total_reviews.toLocaleString('id-ID')} ulasan)`) : null
                    ) : null
                ),
                React.createElement('button', { onClick: onClose, className: 'shrink-0 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition' },
                    React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 20 20', fill: 'currentColor', className: 'w-5 h-5' },
                        React.createElement('path', { d: 'M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z' })
                    )
                )
            ),
            React.createElement('div', { className: 'p-6 space-y-5' },
                React.createElement('div', { className: 'flex items-center gap-3 flex-wrap' },
                    React.createElement('div', { className: 'rounded-2xl bg-slate-100 px-5 py-3 text-center' },
                        React.createElement('p', { className: 'text-xs font-semibold uppercase tracking-widest text-slate-500' }, 'Skor Digital'),
                        React.createElement('p', { className: 'text-2xl font-bold text-sky-700 tabular-nums mt-1' }, item.digital_score)
                    ),
                    React.createElement('span', { className: `inline-block rounded-full px-3 py-1 text-sm font-semibold ${levelBadgeClass(item.digital_level)}` }, item.digital_level)
                ),
                item.latitude && item.longitude ? React.createElement('a', {
                    href: item.google_maps_url || `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`,
                    target: '_blank', rel: 'noreferrer',
                    className: 'flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 transition',
                },
                    React.createElement('span', null, '📍'),
                    React.createElement('span', { className: 'font-medium text-slate-700' }, 'Lihat di Google Maps'),
                    React.createElement('span', { className: 'ml-auto text-xs text-slate-400' }, '→')
                ) : null,
                React.createElement('div', { className: 'space-y-2' },
                    React.createElement('p', { className: 'text-xs font-semibold uppercase tracking-widest text-slate-400' }, 'Platform Online'),
                    platforms.length > 0
                        ? React.createElement('div', { className: 'space-y-2' },
                            ...platforms.map(({ key, label, icon }) =>
                                React.createElement('a', {
                                    key,
                                    href: (item as any)[key].startsWith('http') ? (item as any)[key] : `https://${(item as any)[key]}`,
                                    target: '_blank', rel: 'noreferrer',
                                    className: 'flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 transition',
                                },
                                    React.createElement('span', null, icon),
                                    React.createElement('span', { className: 'font-medium shrink-0' }, label),
                                    React.createElement('span', { className: 'ml-auto text-slate-400 text-xs truncate max-w-[200px]' }, (item as any)[key])
                                )
                            )
                          )
                        : React.createElement('p', { className: 'text-sm text-slate-400' }, 'Tidak ada platform online terdeteksi.')
                ),
                contacts.length > 0 ? React.createElement('div', { className: 'space-y-2' },
                    React.createElement('p', { className: 'text-xs font-semibold uppercase tracking-widest text-slate-400' }, 'Kontak'),
                    React.createElement('div', { className: 'space-y-2' },
                        ...contacts.map(({ key, label, icon, prefix }) =>
                            React.createElement('a', {
                                key,
                                href: `${prefix}${(item as any)[key]}`,
                                className: 'flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 transition',
                            },
                                React.createElement('span', null, icon),
                                React.createElement('span', { className: 'font-medium shrink-0' }, label),
                                React.createElement('span', { className: 'ml-auto text-slate-400 text-xs' }, (item as any)[key])
                            )
                        )
                    )
                ) : null
            )
        )
    );
};

// ─── Navbar ───────────────────────────────────────────────────────────────────

const Navbar = ({ activePage, onNavigate }: { activePage: Page; onNavigate: (p: Page) => void }) => {
    const navItems: { id: Page; label: string }[] = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'daftar',    label: 'Daftar Usaha' },
    ];
    return React.createElement('nav', { className: 'sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200 shadow-sm' },
        React.createElement('div', { className: 'mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16' },
            React.createElement('div', { className: 'flex items-center gap-3' },
                React.createElement('div', { className: 'flex items-center justify-center w-9 h-9 rounded-xl bg-sky-600' },
                    React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'white', className: 'w-5 h-5' },
                        React.createElement('path', { fillRule: 'evenodd', d: 'M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-2.003 3.5-4.697 3.5-8.071a6.75 6.75 0 00-13.5 0c0 3.374 1.555 6.068 3.5 8.07a19.576 19.576 0 002.683 2.283 16.975 16.975 0 001.144.742zM12 13.5a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z', clipRule: 'evenodd' })
                    )
                ),
                React.createElement('span', { className: 'text-base font-semibold text-slate-950 hidden sm:block' }, 'Pemetaan Usaha Digital')
            ),
            React.createElement('div', { className: 'flex items-center gap-1' },
                navItems.map(({ id, label }) =>
                    React.createElement('button', {
                        key: id, onClick: () => onNavigate(id),
                        className: ['px-4 py-2 rounded-xl text-sm font-medium transition',
                            activePage === id ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'].join(' '),
                    }, label)
                )
            )
        )
    );
};

// ─── Dashboard Page ───────────────────────────────────────────────────────────

const DashboardPage = () => {
    const [searchTerm, setSearchTerm]           = useState('');
    const [radius, setRadius]                   = useState('1000');
    const [statusText, setStatusText]           = useState('Masukkan lokasi untuk memulai pencarian.');
    const [nearbySummary, setNearbySummary]     = useState('Tekan Cari Usaha Sekitar setelah memilih lokasi.');
    const [currentPosition, setCurrentPosition] = useState<{ lat: number; lon: number } | null>(null);
    const [nearbyItems, setNearbyItems]         = useState<BusinessItem[]>([]);
    const [savedBusinesses, setSavedBusinesses] = useState<BusinessItem[]>([]);
    const [isGeocodingLoading, setIsGeocodingLoading] = useState(false);
    const [isNearbyLoading, setIsNearbyLoading]       = useState(false);
    const [hasSearched, setHasSearched]         = useState(false);
    const [selectedItem, setSelectedItem]       = useState<BusinessItem | null>(null);
    const [nearbySearch, setNearbySearch]       = useState('');
    const [locationLabel, setLocationLabel]     = useState('');

    const mapRef      = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);
    const savedLayer  = useRef<L.LayerGroup | null>(null);
    const nearbyLayer = useRef<L.LayerGroup | null>(null);

    const nearbyLevelCounts = useMemo(() => {
        const counts = { high: 0, medium: 0, low: 0 };
        nearbyItems.forEach((item) => {
            if (['Sangat Tinggi', 'Tinggi'].includes(item.digital_level)) counts.high++;
            else if (item.digital_level === 'Sedang') counts.medium++;
            else counts.low++;
        });
        return counts;
    }, [nearbyItems]);

    // Data kategori untuk chart & download
    const categoryData = useMemo(() => {
        const counts: Record<string, number> = {};
        nearbyItems.forEach((item) => {
            const cat = item.category || 'Usaha Lainnya';
            counts[cat] = (counts[cat] || 0) + 1;
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [nearbyItems]);

    const filteredNearbyItems = useMemo(() =>
        nearbySearch.trim()
            ? nearbyItems.filter((item) =>
                item.name.toLowerCase().includes(nearbySearch.toLowerCase()) ||
                (item.address || '').toLowerCase().includes(nearbySearch.toLowerCase())
              )
            : nearbyItems,
        [nearbyItems, nearbySearch]
    );

    useEffect(() => {
        if (!mapRef.current) return;
        mapInstance.current = L.map(mapRef.current, { center: [-2.5489, 118.0149], zoom: 5 });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(mapInstance.current);
        savedLayer.current  = L.layerGroup().addTo(mapInstance.current);
        nearbyLayer.current = L.layerGroup().addTo(mapInstance.current);
        return () => { mapInstance.current?.remove(); };
    }, []);

    useEffect(() => { loadSavedBusinesses(); }, []);

    useEffect(() => {
        if (!mapInstance.current || !savedLayer.current) return;
        savedLayer.current.clearLayers();
        savedBusinesses.forEach((item) => {
            if (!item.latitude || !item.longitude) return;
            L.marker([item.latitude, item.longitude], { title: item.name })
                .addTo(savedLayer.current!)
                .bindPopup(`<strong>${item.name}</strong><br />${item.address || '—'}<br />Skor: ${item.digital_score}`);
        });
    }, [savedBusinesses]);

    const loadSavedBusinesses = async () => {
        try { setSavedBusinesses(await fetchJson(api.businesses)); } catch (e) { console.warn(e); }
    };

    const searchLocation = async () => {
        if (!searchTerm.trim()) { setStatusText('Isi kata kunci lokasi terlebih dahulu.'); return; }
        setStatusText('Mencari lokasi...');
        setIsGeocodingLoading(true);
        try {
            const results = await fetchJson(`${api.geocode}?q=${encodeURIComponent(searchTerm.trim())}`);
            if (!Array.isArray(results) || results.length === 0) {
                setStatusText('Lokasi tidak ditemukan. Coba kata kunci lain.'); return;
            }
            const { lat: rawLat, lon: rawLon, display_name } = results[0];
            const lat = parseFloat(rawLat), lon = parseFloat(rawLon);
            setCurrentPosition({ lat, lon });
            setLocationLabel(searchTerm.trim());
            setStatusText(`Lokasi dipilih: ${display_name}`);
            if (mapInstance.current) {
                mapInstance.current.flyTo([lat, lon], 14, { duration: 0.9 });
                L.circle([lat, lon], { radius: parseInt(radius, 10), color: '#0ea5e9', fillOpacity: 0.08 })
                    .addTo(savedLayer.current!);
            }
        } catch (e: any) { setStatusText(e.message); }
        finally { setIsGeocodingLoading(false); }
    };

    const searchNearby = async () => {
        const lat = currentPosition?.lat, lon = currentPosition?.lon;
        if (!lat || !lon) { setNearbySummary('Pilih lokasi terlebih dahulu.'); return; }
        setNearbySummary('Mengambil usaha sekitar dari Google Maps...');
        setIsNearbyLoading(true);
        setNearbySearch('');
        nearbyLayer.current?.clearLayers();
        try {
            const raw = await fetchJson(`${api.nearby}?lat=${lat}&lon=${lon}&radius=${parseInt(radius, 10)}`);
            const allItems: BusinessItem[] = Array.isArray(raw) ? raw : [];
            const list = allItems.filter((item) => !isExcludedBusiness(item));
            setNearbyItems(list);
            setHasSearched(true);
            if (list.length) {
                list.forEach((item) => {
                    if (item.latitude && item.longitude) {
                        const markerColor = (() => {
                            if (['Sangat Tinggi', 'Tinggi'].includes(item.digital_level))
                                return { color: '#16a34a', fillColor: '#4ade80' };
                            if (item.digital_level === 'Sedang')
                                return { color: '#eab308', fillColor: '#fef08a' };
                            return { color: '#ef4444', fillColor: '#fecaca' };
                        })();
                        L.circleMarker([item.latitude, item.longitude], { radius: 7, ...markerColor, fillOpacity: 0.9 })
                            .addTo(nearbyLayer.current!)
                            .bindPopup(`<strong>${item.name}</strong><br />${item.address || '—'}<br />Skor: ${item.digital_score}`);
                    }
                });
                setNearbySummary(`${list.length} usaha ditemukan dalam radius ${radius} m.`);
            } else {
                setNearbySummary('Tidak ada usaha ditemukan dalam radius tersebut.');
            }
        } catch (e: any) {
            setNearbySummary(e.message || 'Gagal memuat data dari Google Maps.');
        } finally { setIsNearbyLoading(false); }
    };

    const total   = nearbyLevelCounts.high + nearbyLevelCounts.medium + nearbyLevelCounts.low;
    const pctHigh = total ? Math.round((nearbyLevelCounts.high   / total) * 100) : 0;
    const pctMed  = total ? Math.round((nearbyLevelCounts.medium / total) * 100) : 0;
    const pctLow  = total ? 100 - pctHigh - pctMed : 0;

    const exportFilename = `usaha_sekitar_${searchTerm.trim().replace(/\s+/g, '_') || 'wilayah'}_r${radius}m`;

    // ── Tombol unduh gambar gabungan ──
    const DownloadReportButton = () =>
        React.createElement('button', {
            onClick: () => downloadCombinedPNG({
                locationLabel,
                total,
                high  : nearbyLevelCounts.high,
                medium: nearbyLevelCounts.medium,
                low   : nearbyLevelCounts.low,
                pctHigh, pctMed, pctLow,
                categoryData,
            }),
            className: 'shrink-0 flex items-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-4 py-2.5 text-sm font-semibold text-sky-700 hover:bg-sky-100 active:bg-sky-200 transition',
            title: 'Unduh laporan distribusi + kategori sebagai PNG',
        },
            React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 20 20', fill: 'currentColor', className: 'w-4 h-4 shrink-0' },
                React.createElement('path', { fillRule: 'evenodd', d: 'M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z', clipRule: 'evenodd' })
            ),
            'Unduh Laporan (.png)'
        );

    return React.createElement('div', { className: 'mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8 space-y-6' },

        // ── Search bar ──
        React.createElement('div', { className: 'rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4' },
            React.createElement('h2', { className: 'text-base font-semibold text-slate-950' }, 'Cari Wilayah'),
            React.createElement('div', { className: 'flex flex-col sm:flex-row gap-3' },
                React.createElement('input', {
                    type: 'text', value: searchTerm,
                    onChange: (e: any) => setSearchTerm(e.target.value),
                    onKeyDown: (e: any) => e.key === 'Enter' && searchLocation(),
                    placeholder: 'Contoh: Kota Jambi, Prabumulih, Pasar…',
                    className: 'flex-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100',
                }),
                React.createElement('select', {
                    value: radius, onChange: (e: any) => setRadius(e.target.value),
                    className: 'rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-sky-500',
                },
                    ['500', '1000', '1500', '2500', '5000'].map((r) =>
                        React.createElement('option', { key: r, value: r }, `${r} m`)
                    )
                ),
                React.createElement('div', { className: 'flex gap-2' },
                    React.createElement('button', { onClick: searchLocation, className: 'flex-1 sm:flex-none rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700' }, 'Cari Lokasi'),
                    React.createElement('button', { onClick: searchNearby, className: 'flex-1 sm:flex-none rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50' }, 'Cari Usaha Sekitar')
                )
            ),
            React.createElement('p', { className: 'rounded-xl bg-slate-100 px-4 py-2.5 text-sm text-slate-600' }, statusText)
        ),

        // ── Map + Nearby table ──
        React.createElement('div', { className: 'grid gap-6 xl:grid-cols-[1.6fr_1fr]' },
            React.createElement('div', { className: 'rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200' },
                React.createElement('div', { id: 'map', ref: mapRef, className: 'h-[500px] w-full rounded-[20px] border border-slate-200 relative z-0' })
            ),
            React.createElement('div', { className: 'rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 flex flex-col gap-4' },
                React.createElement('div', { className: 'flex items-center justify-between gap-3' },
                    React.createElement('h2', { className: 'text-base font-semibold text-slate-950' }, 'Usaha di Sekitar Wilayah'),
                    nearbyItems.length > 0
                        ? React.createElement(ExportButton, { items: nearbyItems, filename: exportFilename, sheetLabel: 'Usaha Sekitar' })
                        : null
                ),
                React.createElement('p', { className: 'rounded-xl bg-slate-100 px-4 py-2.5 text-sm text-slate-600' }, nearbySummary),
                nearbyItems.length > 0
                    ? React.createElement(TableSearchInput, {
                        value: nearbySearch, onChange: setNearbySearch,
                        placeholder: 'Cari nama atau alamat usaha…',
                        resultCount: filteredNearbyItems.length, totalCount: nearbyItems.length,
                      })
                    : null,
                React.createElement('div', { className: 'overflow-auto rounded-2xl border border-slate-200 max-h-[380px]' },
                    React.createElement('table', { className: 'w-full border-collapse text-sm' },
                        React.createElement('thead', { className: 'bg-slate-50 text-slate-500 sticky top-0' },
                            React.createElement('tr', null,
                                React.createElement('th', { className: 'px-4 py-3 text-left font-semibold' }, 'Nama Usaha'),
                                React.createElement('th', { className: 'px-4 py-3 text-left font-semibold hidden sm:table-cell' }, 'Kategori'),
                                React.createElement('th', { className: 'px-4 py-3 text-center font-semibold w-16' }, 'Skor'),
                                React.createElement('th', { className: 'px-4 py-3 text-left font-semibold hidden md:table-cell' }, 'Level'),
                                React.createElement('th', { className: 'px-4 py-3 w-16' })
                            )
                        ),
                        React.createElement('tbody', null,
                            filteredNearbyItems.length === 0
                                ? React.createElement('tr', null,
                                    React.createElement('td', { colSpan: 5, className: 'px-4 py-10 text-center text-slate-400' },
                                        nearbyItems.length === 0
                                            ? 'Pilih wilayah dan tekan "Cari Usaha Sekitar".'
                                            : `Tidak ada usaha yang cocok dengan "${nearbySearch}".`
                                    ))
                                : filteredNearbyItems.map((item, idx) =>
                                    React.createElement('tr', {
                                        key: `${item.id}-${idx}`,
                                        className: 'border-t border-slate-100 hover:bg-slate-50 transition',
                                    },
                                        React.createElement('td', { className: 'px-4 py-3 font-medium text-slate-900' },
                                            React.createElement('div', null,
                                                item.name,
                                                item.rating ? React.createElement('span', { className: 'ml-1.5 text-xs text-amber-500' }, `★ ${item.rating.toFixed(1)}`) : null
                                            )
                                        ),
                                        React.createElement('td', { className: 'px-4 py-3 hidden sm:table-cell' },
                                            React.createElement('span', {
                                                className: `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${categoryBadgeClass(item.category)}`,
                                            },
                                                CATEGORY_ICONS[item.category || ''] || '📦',
                                                ' ',
                                                item.category || 'Usaha Lainnya'
                                            )
                                        ),
                                        React.createElement('td', { className: 'px-4 py-3 text-center tabular-nums font-semibold text-sky-700' }, item.digital_score),
                                        React.createElement('td', { className: 'px-4 py-3 hidden md:table-cell' },
                                            React.createElement('span', { className: `inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${levelBadgeClass(item.digital_level)}` }, item.digital_level)
                                        ),
                                        React.createElement('td', { className: 'px-4 py-3' },
                                            React.createElement('button', {
                                                onClick: () => setSelectedItem(item),
                                                className: 'rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition',
                                            }, 'Detail')
                                        )
                                    )
                                )
                        )
                    )
                )
            )
        ),

        // ── Distribusi Level Digital + Bar Chart Kategori dalam satu card ──
        React.createElement('div', { className: 'rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-6' },

            // Header card gabungan + satu tombol unduh
            React.createElement('div', { className: 'flex items-start justify-between gap-4 flex-wrap' },
                React.createElement('div', null,
                    React.createElement('h2', { className: 'text-base font-semibold text-slate-950' },
                        locationLabel ? `Analisis Digitalisasi — ${locationLabel}` : 'Analisis Digitalisasi Wilayah'
                    ),
                    React.createElement('p', { className: 'text-xs text-slate-400 mt-0.5' },
                        hasSearched && total > 0
                            ? `${total} usaha · ${categoryData.length} kategori`
                            : 'Cari wilayah terlebih dahulu untuk melihat analisis'
                    )
                ),
                // Satu tombol unduh untuk keduanya
                hasSearched && total > 0 ? React.createElement(DownloadReportButton, null) : null
            ),

            // ── Sub-section: Distribusi Level ──
            React.createElement('div', { className: 'space-y-3' },
                React.createElement('p', { className: 'text-sm font-semibold text-slate-700' }, 'Distribusi Level Digital'),
                React.createElement('div', { className: 'grid gap-4 sm:grid-cols-3' },
                    React.createElement(StatCard, { label: 'Tinggi / Sangat Tinggi', value: nearbyLevelCounts.high }),
                    React.createElement(StatCard, { label: 'Sedang',                  value: nearbyLevelCounts.medium }),
                    React.createElement(StatCard, { label: 'Rendah',                  value: nearbyLevelCounts.low })
                ),
                hasSearched && total > 0
                    ? React.createElement('div', { className: 'space-y-2' },
                        React.createElement('div', { className: 'flex h-3 w-full overflow-hidden rounded-full bg-slate-100' },
                            React.createElement('div', { style: { width: `${pctHigh}%` }, className: 'bg-emerald-400 transition-all' }),
                            React.createElement('div', { style: { width: `${pctMed}%` },  className: 'bg-amber-400 transition-all' }),
                            React.createElement('div', { style: { width: `${pctLow}%` },  className: 'bg-rose-400 transition-all' })
                        ),
                        React.createElement('div', { className: 'flex gap-4 text-xs text-slate-500' },
                            React.createElement('span', null, React.createElement('span', { className: 'text-emerald-600 font-semibold' }, `${pctHigh}%`), ' Tinggi'),
                            React.createElement('span', null, React.createElement('span', { className: 'text-amber-600 font-semibold' }, `${pctMed}%`),  ' Sedang'),
                            React.createElement('span', null, React.createElement('span', { className: 'text-rose-600 font-semibold' },   `${pctLow}%`),  ' Rendah')
                        )
                    )
                    : React.createElement('div', { className: 'rounded-xl border-2 border-dashed border-slate-200 py-8 text-center text-sm text-slate-400' },
                        'Grafik distribusi akan muncul setelah pencarian wilayah berhasil.')
            ),

            // Divider
            hasSearched && total > 0
                ? React.createElement('hr', { className: 'border-slate-100' })
                : null,

            // ── Sub-section: Bar Chart Kategori ──
            React.createElement('div', { className: 'space-y-3' },
                React.createElement('p', { className: 'text-sm font-semibold text-slate-700' }, 'Perbandingan Usaha per Kategori'),
                !hasSearched || total === 0
                    ? React.createElement('div', { className: 'rounded-xl border-2 border-dashed border-slate-200 py-10 text-center text-sm text-slate-400' },
                        'Bar chart akan muncul setelah pencarian wilayah berhasil.')
                    : React.createElement('div', { className: 'overflow-x-auto' },
                        React.createElement('div', { style: { minWidth: '420px' } },
                            ...categoryData.slice(0, 15).map(([cat, count]) => {
                                const maxC  = categoryData[0]?.[1] ?? 1;
                                const pct   = Math.round((count / total) * 100);
                                const barPct = Math.max(1, Math.round((count / maxC) * 100));
                                const color  = categoryBarColor(cat);
                                const icon   = CATEGORY_ICONS[cat] || '📦';

                                return React.createElement('div', { key: cat, className: 'flex items-center gap-3 mb-2.5' },
                                    // Label
                                    React.createElement('div', { className: 'shrink-0 w-44 text-right' },
                                        React.createElement('span', { className: 'text-xs text-slate-600 truncate block' }, `${icon} ${cat}`)
                                    ),
                                    // Track + bar
                                    React.createElement('div', { className: 'flex-1 relative h-6 rounded-full bg-slate-100 overflow-hidden' },
                                        React.createElement('div', {
                                            className: 'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
                                            style: { width: `${barPct}%`, backgroundColor: color },
                                        })
                                    ),
                                    // Count + pct
                                    React.createElement('div', { className: 'shrink-0 w-16 text-left' },
                                        React.createElement('span', { className: 'text-xs font-semibold text-slate-800' }, count),
                                        React.createElement('span', { className: 'text-xs text-slate-400 ml-1' }, `${pct}%`)
                                    )
                                );
                            })
                        )
                    )
            )
        ),

        selectedItem ? React.createElement(DetailModal, { item: selectedItem, onClose: () => setSelectedItem(null) }) : null,

        (isGeocodingLoading || isNearbyLoading) ? React.createElement('div', {
            className: 'fixed inset-0 z-[9999] flex items-center justify-center'
        },
            React.createElement('div', { className: 'absolute inset-0 bg-slate-950/60 backdrop-blur-sm' }),
            React.createElement('div', {
                className: 'relative z-10 flex flex-col items-center gap-6 rounded-3xl bg-white px-10 py-8 shadow-2xl shadow-slate-950/20 ring-1 ring-slate-200 min-w-[260px]'
            },
                React.createElement('div', { className: 'relative w-16 h-16' },
                    React.createElement('div', { className: 'absolute inset-0 rounded-full border-4 border-slate-100' }),
                    React.createElement('div', { className: 'absolute inset-0 rounded-full border-4 border-transparent border-t-sky-500 border-r-sky-300 animate-spin' }),
                    React.createElement('div', {
                        className: 'absolute inset-2 rounded-full border-4 border-transparent border-b-indigo-500 border-l-indigo-300',
                        style: { animation: 'spin 1.2s linear infinite reverse' }
                    }),
                    React.createElement('div', { className: 'absolute inset-[22px] rounded-full bg-sky-500 animate-pulse' })
                ),
                React.createElement('div', { className: 'text-center space-y-1' },
                    React.createElement('p', { className: 'text-sm font-semibold text-slate-900' },
                        isGeocodingLoading ? 'Mencari Lokasi' : 'Memuat Data Usaha'
                    ),
                    React.createElement('p', { className: 'text-xs text-slate-500' },
                        isGeocodingLoading ? 'Menghubungi layanan geocoding…' : 'Mengambil data dari Google Maps…'
                    )
                ),
                React.createElement('div', { className: 'flex items-center gap-1.5' },
                    ...[0, 1, 2].map((i) =>
                        React.createElement('div', {
                            key: i,
                            className: 'w-1.5 h-1.5 rounded-full bg-sky-400',
                            style: { animation: 'pulse 1.2s ease-in-out infinite', animationDelay: `${i * 0.2}s` }
                        })
                    )
                )
            )
        ) : null
    );
};

// ─── Daftar Usaha Page ────────────────────────────────────────────────────────

const DaftarUsahaPage = () => {
    const [businesses, setBusinesses]     = useState<BusinessItem[]>([]);
    const [stats, setStats]               = useState<any>({ total: 0, online_presence: 0, average_score: 0 });
    const [loading, setLoading]           = useState(true);
    const [showModal, setShowModal]       = useState(false);
    const [editingBusiness, setEditingBusiness] = useState<BusinessItem | null>(null);
    const [selectedItem, setSelectedItem] = useState<BusinessItem | null>(null);
    const [pendingDelete, setPendingDelete] = useState<BusinessItem | null>(null);
    const [daftarSearch, setDaftarSearch] = useState('');

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = (showModal || !!selectedItem) ? 'hidden' : prev;
        return () => { document.body.style.overflow = prev; };
    }, [showModal, selectedItem]);

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        setLoading(true);
        try { await Promise.all([loadBusinesses(), loadStats()]); }
        finally { setLoading(false); }
    };

    const loadBusinesses = async () => {
        try { setBusinesses(await fetchJson(api.businesses)); } catch (e) { console.warn(e); }
    };

    const loadStats = async () => {
        try { setStats(await fetchJson(api.stats)); } catch (e) { console.warn(e); }
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingBusiness(null);
    };

    const handleSaved = async () => { closeModal(); await loadAll(); };

    const handleDelete = async (business: BusinessItem) => {
        if (!business.id) return;

        try {
            await fetchJson(`/api/businesses/${business.id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)
                            ?.content || '',
                },
            });
            setPendingDelete(null);
            await loadAll();
        } catch (e: any) {
            window.alert(e?.message || 'Gagal menghapus usaha.');
        }
    };

    const filteredBusinesses = useMemo(() =>
        daftarSearch.trim()
            ? businesses.filter((b) =>
                b.name.toLowerCase().includes(daftarSearch.toLowerCase()) ||
                (b.address || '').toLowerCase().includes(daftarSearch.toLowerCase())
              )
            : businesses,
        [businesses, daftarSearch]
    );

    return React.createElement('div', { className: 'mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8 space-y-6' },

        React.createElement('div', { className: 'rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4' },
            React.createElement('h2', { className: 'text-base font-semibold text-slate-950' }, 'Ringkasan Data Usaha Tersimpan'),
            React.createElement('div', { className: 'grid gap-4 sm:grid-cols-3' },
                React.createElement(StatCard, { label: 'Total usaha tersimpan',        value: stats.total,           dark: true }),
                React.createElement(StatCard, { label: 'Usaha dengan online presence', value: stats.online_presence, dark: true }),
                React.createElement(StatCard, { label: 'Rata-rata skor digital',       value: stats.average_score,   dark: true })
            )
        ),

        React.createElement('div', { className: 'rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4' },
            React.createElement('div', { className: 'flex items-center justify-between gap-4 flex-wrap' },
                React.createElement('div', null,
                    React.createElement('h2', { className: 'text-base font-semibold text-slate-950' }, 'Daftar Usaha yang Ditambahkan'),
                    React.createElement('p', { className: 'text-sm text-slate-500 mt-0.5' }, 'Usaha yang telah Anda simpan ke database.')
                ),
                React.createElement('div', { className: 'flex items-center gap-2' },
                    !loading && businesses.length > 0
                        ? React.createElement(ExportButton, { items: businesses, filename: 'daftar_usaha', sheetLabel: 'Daftar Usaha' })
                        : null,
                    React.createElement('button', {
                        onClick: () => {
                            setEditingBusiness(null);
                            setShowModal(true);
                        },
                        className: 'shrink-0 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700',
                    }, '+ Tambah Usaha')
                )
            ),

            !loading && businesses.length > 0
                ? React.createElement(TableSearchInput, {
                    value: daftarSearch, onChange: setDaftarSearch,
                    placeholder: 'Cari nama atau alamat usaha…',
                    resultCount: filteredBusinesses.length, totalCount: businesses.length,
                  })
                : null,

            loading
                ? React.createElement('div', { className: 'py-16 text-center text-sm text-slate-400' }, 'Memuat data…')
                : React.createElement('div', { className: 'overflow-auto rounded-2xl border border-slate-200 max-h-[520px]' },
                    React.createElement('table', { className: 'w-full border-collapse text-sm' },
                        React.createElement('thead', { className: 'bg-slate-50 text-slate-500 sticky top-0' },
                            React.createElement('tr', null,
                                React.createElement('th', { className: 'px-4 py-3 text-left font-semibold' }, 'Nama Usaha'),
                                React.createElement('th', { className: 'px-4 py-3 text-left font-semibold hidden md:table-cell' }, 'Alamat'),
                                React.createElement('th', { className: 'px-4 py-3 text-left font-semibold hidden sm:table-cell' }, 'Platform Online'),
                                React.createElement('th', { className: 'px-4 py-3 text-center font-semibold w-16' }, 'Skor'),
                                React.createElement('th', { className: 'px-4 py-3 text-left font-semibold' }, 'Level'),
                                React.createElement('th', { className: 'px-4 py-3 text-center font-semibold w-28' }, 'Aksi')
                            )
                        ),
                        React.createElement('tbody', null,
                            filteredBusinesses.length === 0
                                ? React.createElement('tr', null,
                                    React.createElement('td', { colSpan: 7, className: 'px-4 py-16 text-center text-slate-400' },
                                        businesses.length === 0
                                            ? React.createElement('div', { className: 'space-y-2' },
                                                React.createElement('p', { className: 'font-medium' }, 'Belum ada usaha tersimpan.'),
                                                React.createElement('p', { className: 'text-xs' }, 'Tekan "+ Tambah Usaha" untuk menambahkan usaha baru.')
                                              )
                                            : `Tidak ada usaha yang cocok dengan "${daftarSearch}".`
                                    )
                                )
                                : filteredBusinesses.map((b, idx) => {
                                    const platforms = [
                                        b.website && 'Website', b.instagram && 'Instagram',
                                        b.facebook && 'Facebook', b.shopee && 'Shopee',
                                        b.tokopedia && 'Tokopedia', b.tiktok && 'TikTok', b.whatsapp && 'WhatsApp',
                                    ].filter(Boolean);
                                    return React.createElement('tr', {
                                        key: `${b.id}-${idx}`,
                                        className: 'border-t border-slate-100 hover:bg-slate-50 transition',
                                    },
                                        React.createElement('td', { className: 'px-4 py-3 font-medium text-slate-900' }, b.name),
                                        React.createElement('td', { className: 'px-4 py-3 text-slate-500 hidden md:table-cell max-w-[200px] truncate' }, b.address || '—'),
                                        React.createElement('td', { className: 'px-4 py-3 hidden sm:table-cell' },
                                            platforms.length > 0
                                                ? React.createElement('div', { className: 'flex flex-wrap gap-1' },
                                                    platforms.map((p) =>
                                                        React.createElement('span', { key: p, className: 'inline-block rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs px-2 py-0.5 font-medium' }, p)
                                                    )
                                                )
                                                : React.createElement('span', { className: 'text-slate-400 text-xs' }, 'Tidak ada')
                                        ),
                                        React.createElement('td', { className: 'px-4 py-3 text-center tabular-nums font-semibold text-sky-700' }, b.digital_score),
                                        React.createElement('td', { className: 'px-4 py-3' },
                                            React.createElement('span', { className: `inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${levelBadgeClass(b.digital_level)}` }, b.digital_level)
                                        ),
                                        React.createElement('td', { className: 'px-4 py-3' },
                                            React.createElement('div', { className: 'flex justify-center gap-2' },
                                                React.createElement(ActionIconButton, {
                                                    title: 'Detail',
                                                    onClick: () => setSelectedItem(b),
                                                    icon: React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 20 20', fill: 'currentColor', className: 'h-4 w-4' },
                                                        React.createElement('path', { d: 'M10 4.5c-4.1 0-7.3 2.6-8.8 6.3a.75.75 0 000 .74C2.7 15.9 5.9 18.5 10 18.5s7.3-2.6 8.8-6.3a.75.75 0 000-.74C17.3 7.1 14.1 4.5 10 4.5zm0 1.5A5.5 5.5 0 0115.4 10 5.5 5.5 0 014.6 10 5.5 5.5 0 0110 6zm0 2.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z' })
                                                    ),
                                                }),
                                                React.createElement(ActionIconButton, {
                                                    title: 'Edit',
                                                    onClick: () => {
                                                        setEditingBusiness(b);
                                                        setShowModal(true);
                                                    },
                                                    className: 'text-amber-600 hover:text-amber-700 hover:bg-amber-50',
                                                    icon: React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 20 20', fill: 'currentColor', className: 'h-4 w-4' },
                                                        React.createElement('path', { d: 'M13.85 3.15a2.5 2.5 0 013.53 3.53l-7.05 7.05a.75.75 0 01-.35.2l-3.5 1.05a.75.75 0 01-.93-.93l1.05-3.5a.75.75 0 01.2-.35l7.05-7.05zM12.44 4.56L4.39 12.61l1.7 1.7 8.05-8.05-1.7-1.7z' })
                                                    ),
                                                }),
                                                React.createElement(ActionIconButton, {
                                                    title: 'Delete',
                                                    onClick: () => setPendingDelete(b),
                                                    className: 'text-rose-600 hover:text-rose-700 hover:bg-rose-50',
                                                    icon: React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 20 20', fill: 'currentColor', className: 'h-4 w-4' },
                                                        React.createElement('path', { d: 'M7.5 3.75A1.25 1.25 0 018.75 2.5h2.5a1.25 1.25 0 011.25 1.25V4h3.75a.75.75 0 010 1.5H4.25a.75.75 0 010-1.5H8V3.75zM5.25 6.5h9.5l-.6 9.1a1.75 1.75 0 01-1.74 1.6H7.59a1.75 1.75 0 01-1.74-1.6L5.25 6.5z' })
                                                    ),
                                                })
                                            )
                                        )
                                    );
                                })
                        )
                    )
                )
        ),

        selectedItem ? React.createElement(DetailModal, { item: selectedItem, onClose: () => setSelectedItem(null) }) : null,

        pendingDelete ? React.createElement('div', { className: 'fixed inset-0 z-[99999] flex items-center justify-center' },
            React.createElement('div', { className: 'absolute inset-0 bg-slate-950/50', onClick: () => setPendingDelete(null) }),
            React.createElement('div', { className: 'relative z-[100000] w-full max-w-md mx-4 rounded-[24px] bg-white p-6 shadow-2xl' },
                React.createElement('div', { className: 'flex items-center gap-3' },
                    React.createElement('div', { className: 'flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600' },
                        React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 20 20', fill: 'currentColor', className: 'h-5 w-5' },
                            React.createElement('path', { d: 'M8.5 3.75A1.25 1.25 0 019.75 2.5h.5a1.25 1.25 0 011.25 1.25V4h7.5v-.25A1.25 1.25 0 0119.25 2.5h.5A1.25 1.25 0 0121 3.75V4h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V3.75zM4.25 7.5h11.5l-.6 9.1a1.75 1.75 0 01-1.74 1.6H6.59a1.75 1.75 0 01-1.74-1.6L4.25 7.5z' })
                        )
                    ),
                    React.createElement('div', null,
                        React.createElement('h3', { className: 'text-base font-semibold text-slate-950' }, 'Hapus usaha?'),
                        React.createElement('p', { className: 'text-sm text-slate-500 mt-1' }, `Yakin ingin menghapus "${pendingDelete?.name || 'usaha ini'}"?`) 
                    )
                ),
                React.createElement('div', { className: 'mt-6 flex justify-end gap-3' },
                    React.createElement('button', { onClick: () => setPendingDelete(null), className: 'rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50' }, 'Batal'),
                    React.createElement('button', { onClick: () => pendingDelete && handleDelete(pendingDelete), className: 'rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700' }, 'Hapus')
                )
            )
        ) : null,

        showModal ? React.createElement('div', { className: 'fixed inset-0 z-[99999] flex items-center justify-center' },
            React.createElement('div', { className: 'absolute inset-0 bg-black/40', onClick: closeModal }),
            React.createElement('div', { className: 'relative z-[100000] w-full max-w-2xl mx-4 bg-white rounded-[28px] shadow-2xl overflow-y-auto max-h-[90vh]' },
                React.createElement('div', { className: 'p-6 border-b border-slate-200 flex items-center justify-between' },
                    React.createElement('div', null,
                        React.createElement('h3', { className: 'text-base font-semibold text-slate-950' }, editingBusiness ? 'Edit Usaha' : 'Tambah Usaha Baru'),
                        React.createElement('p', { className: 'text-sm text-slate-500 mt-0.5' }, editingBusiness ? 'Perbarui detail usaha yang sudah tersimpan.' : 'Isi detail usaha untuk menyimpannya ke database.')
                    ),
                    React.createElement('button', { onClick: closeModal, className: 'rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition' },
                        React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 20 20', fill: 'currentColor', className: 'w-5 h-5' },
                            React.createElement('path', { d: 'M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z' })
                        )
                    )
                ),
                React.createElement('div', { className: 'p-6' },
                    React.createElement(BusinessForm, { key: editingBusiness ? `edit-${editingBusiness.id}` : 'create', initial: editingBusiness || {}, onSaved: handleSaved, onCancel: closeModal, mode: editingBusiness ? 'edit' : 'create' })
                )
            )
        ) : null
    );
};

// ─── Root App ─────────────────────────────────────────────────────────────────

const ActionIconButton = ({ icon, title, onClick, className }: { icon: React.ReactNode; title: string; onClick: () => void; className?: string }) =>
    React.createElement('button', {
        type: 'button',
        title,
        onClick,
        className: `inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 hover:text-slate-900 ${className || ''}`,
    }, icon);

const App = () => {
    const [page, setPage] = useState<Page>('dashboard');
    return React.createElement('div', { className: 'min-h-screen bg-slate-50 text-slate-900 antialiased' },
        React.createElement(Navbar, { activePage: page, onNavigate: setPage }),
        page === 'dashboard'
            ? React.createElement(DashboardPage, null)
            : React.createElement(DaftarUsahaPage, null)
    );
};

const root = ReactDOM.createRoot(document.getElementById('app')!);
root.render(React.createElement(App));
