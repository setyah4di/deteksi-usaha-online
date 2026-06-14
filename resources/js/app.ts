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
    value,
    onChange,
    placeholder = 'Cari nama usaha…',
    resultCount,
    totalCount,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    resultCount: number;
    totalCount: number;
}) =>
    React.createElement('div', { className: 'flex items-center gap-3' },
        React.createElement('div', { className: 'relative flex-1' },
            // Icon search
            React.createElement('div', { className: 'pointer-events-none absolute inset-y-0 left-3 flex items-center' },
                React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 20 20', fill: 'currentColor', className: 'w-4 h-4 text-slate-400' },
                    React.createElement('path', { fillRule: 'evenodd', d: 'M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z', clipRule: 'evenodd' })
                )
            ),
            React.createElement('input', {
                type: 'text',
                value,
                onChange: (e: any) => onChange(e.target.value),
                placeholder,
                className: 'w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-9 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100',
            }),
            // Tombol clear jika ada input
            value ? React.createElement('button', {
                onClick: () => onChange(''),
                className: 'absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-700 transition',
            },
                React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 20 20', fill: 'currentColor', className: 'w-4 h-4' },
                    React.createElement('path', { d: 'M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z' })
                )
            ) : null
        ),
        // Counter hasil
        value ? React.createElement('span', { className: 'shrink-0 text-xs text-slate-500 tabular-nums' },
            `${resultCount} / ${totalCount}`
        ) : null
    );

// ─── Export Excel ─────────────────────────────────────────────────────────────

const exportToExcel = (items: BusinessItem[], filename: string, sheetLabel: string) => {
    const rows = items.map((item) => ({
        'Nama Usaha'      : item.name,
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
        React.createElement('span', null, 'Export Excel')
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
                    React.createElement('p', { className: 'text-sm text-slate-500 mt-0.5' }, item.address || 'Alamat tidak tersedia'),
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
                React.createElement('span', { className: 'text-base font-semibold text-slate-950 hidden sm:block' }, 'Pemetaan Usaha Online')
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

    // ── State search tabel usaha sekitar ──
    const [nearbySearch, setNearbySearch] = useState('');

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

    // ── Filter nearbyItems berdasarkan search ──
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
        setNearbySearch(''); // reset search saat cari ulang
        nearbyLayer.current?.clearLayers();
        try {
            const items = await fetchJson(`${api.nearby}?lat=${lat}&lon=${lon}&radius=${parseInt(radius, 10)}`);
            const list: BusinessItem[] = Array.isArray(items) ? items : [];
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
                        L.circleMarker([item.latitude, item.longitude], {
                            radius: 7, ...markerColor, fillOpacity: 0.9,
                        })
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

    return React.createElement('div', { className: 'mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8 space-y-6' },

        // ── Search bar lokasi ──
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
                    ['500', '1000', '1500', '2500'].map((r) =>
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
            // Peta
            React.createElement('div', { className: 'rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200' },
                React.createElement('div', { id: 'map', ref: mapRef, className: 'h-[500px] w-full rounded-[20px] border border-slate-200 relative z-0' })
            ),

            // Panel tabel usaha sekitar
            React.createElement('div', { className: 'rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 flex flex-col gap-4' },

                // Header + Export
                React.createElement('div', { className: 'flex items-center justify-between gap-3' },
                    React.createElement('h2', { className: 'text-base font-semibold text-slate-950' }, 'Usaha di Sekitar Wilayah'),
                    nearbyItems.length > 0
                        ? React.createElement(ExportButton, {
                            items: nearbyItems,
                            filename: exportFilename,
                            sheetLabel: 'Usaha Sekitar',
                          })
                        : null
                ),

                React.createElement('p', { className: 'rounded-xl bg-slate-100 px-4 py-2.5 text-sm text-slate-600' }, nearbySummary),

                // ── Search tabel usaha sekitar ──
                nearbyItems.length > 0
                    ? React.createElement(TableSearchInput, {
                        value: nearbySearch,
                        onChange: setNearbySearch,
                        placeholder: 'Cari nama atau alamat usaha…',
                        resultCount: filteredNearbyItems.length,
                        totalCount: nearbyItems.length,
                      })
                    : null,

                React.createElement('div', { className: 'overflow-auto rounded-2xl border border-slate-200 max-h-[380px]' },
                    React.createElement('table', { className: 'w-full border-collapse text-sm' },
                        React.createElement('thead', { className: 'bg-slate-50 text-slate-500 sticky top-0' },
                            React.createElement('tr', null,
                                React.createElement('th', { className: 'px-4 py-3 text-left font-semibold' }, 'Nama Usaha'),
                                React.createElement('th', { className: 'px-4 py-3 text-center font-semibold w-16' }, 'Skor'),
                                React.createElement('th', { className: 'px-4 py-3 text-left font-semibold' }, 'Level'),
                                React.createElement('th', { className: 'px-4 py-3 w-16' })
                            )
                        ),
                        React.createElement('tbody', null,
                            filteredNearbyItems.length === 0
                                ? React.createElement('tr', null,
                                    React.createElement('td', { colSpan: 4, className: 'px-4 py-10 text-center text-slate-400' },
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
                                        React.createElement('td', { className: 'px-4 py-3 text-center tabular-nums font-semibold text-sky-700' }, item.digital_score),
                                        React.createElement('td', { className: 'px-4 py-3' },
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

        // ── Distribusi Level Digital ──
        React.createElement('div', { className: 'rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4' },
            React.createElement('div', { className: 'flex items-center justify-between' },
                React.createElement('h2', { className: 'text-base font-semibold text-slate-950' }, 'Distribusi Level Digital Wilayah'),
                React.createElement('span', { className: 'text-xs text-slate-400' },
                    hasSearched ? `Berdasarkan ${total} usaha di wilayah yang dipilih` : 'Belum ada data — cari wilayah terlebih dahulu'
                )
            ),
            React.createElement('div', { className: 'grid gap-4 sm:grid-cols-3' },
                React.createElement(StatCard, { label: 'Tinggi / Sangat Tinggi', value: nearbyLevelCounts.high }),
                React.createElement(StatCard, { label: 'Sedang', value: nearbyLevelCounts.medium }),
                React.createElement(StatCard, { label: 'Rendah', value: nearbyLevelCounts.low })
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

        // ── Detail Modal ──
        selectedItem ? React.createElement(DetailModal, { item: selectedItem, onClose: () => setSelectedItem(null) }) : null,

        // ── Loading overlay ──
        (isGeocodingLoading || isNearbyLoading) ? React.createElement('div', { className: 'fixed inset-0 z-[9999] flex items-center justify-center' },
            React.createElement('div', { className: 'absolute inset-0 bg-black/25' }),
            React.createElement('div', { className: 'relative z-10 flex flex-col items-center gap-3 rounded-2xl bg-white/95 px-8 py-6 shadow-xl' },
                React.createElement('div', { className: 'w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin' }),
                React.createElement('p', { className: 'text-sm font-medium text-slate-800' },
                    isGeocodingLoading ? 'Mencari lokasi…' : 'Mengambil usaha dari Google Maps…')
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
    const [selectedItem, setSelectedItem] = useState<BusinessItem | null>(null);

    // ── State search tabel daftar usaha ──
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

    const handleSaved = async () => { setShowModal(false); await loadAll(); };

    // ── Filter businesses berdasarkan search ──
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

        // ── Ringkasan ──
        React.createElement('div', { className: 'rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4' },
            React.createElement('h2', { className: 'text-base font-semibold text-slate-950' }, 'Ringkasan Data Usaha Tersimpan'),
            React.createElement('div', { className: 'grid gap-4 sm:grid-cols-3' },
                React.createElement(StatCard, { label: 'Total usaha tersimpan',        value: stats.total,           dark: true }),
                React.createElement(StatCard, { label: 'Usaha dengan online presence', value: stats.online_presence, dark: true }),
                React.createElement(StatCard, { label: 'Rata-rata skor digital',       value: stats.average_score,   dark: true })
            )
        ),

        // ── Tabel ──
        React.createElement('div', { className: 'rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200 space-y-4' },

            // Header + Export + Tambah
            React.createElement('div', { className: 'flex items-center justify-between gap-4 flex-wrap' },
                React.createElement('div', null,
                    React.createElement('h2', { className: 'text-base font-semibold text-slate-950' }, 'Daftar Usaha yang Ditambahkan'),
                    React.createElement('p', { className: 'text-sm text-slate-500 mt-0.5' }, 'Usaha yang telah Anda simpan ke database.')
                ),
                React.createElement('div', { className: 'flex items-center gap-2' },
                    !loading && businesses.length > 0
                        ? React.createElement(ExportButton, {
                            items: businesses,
                            filename: 'daftar_usaha',
                            sheetLabel: 'Daftar Usaha',
                          })
                        : null,
                    React.createElement('button', {
                        onClick: () => setShowModal(true),
                        className: 'shrink-0 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700',
                    }, '+ Tambah Usaha')
                )
            ),

            // ── Search tabel daftar usaha ──
            !loading && businesses.length > 0
                ? React.createElement(TableSearchInput, {
                    value: daftarSearch,
                    onChange: setDaftarSearch,
                    placeholder: 'Cari nama atau alamat usaha…',
                    resultCount: filteredBusinesses.length,
                    totalCount: businesses.length,
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
                                React.createElement('th', { className: 'px-4 py-3 w-16' })
                            )
                        ),
                        React.createElement('tbody', null,
                            filteredBusinesses.length === 0
                                ? React.createElement('tr', null,
                                    React.createElement('td', { colSpan: 6, className: 'px-4 py-16 text-center text-slate-400' },
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
                                                        React.createElement('span', {
                                                            key: p,
                                                            className: 'inline-block rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs px-2 py-0.5 font-medium',
                                                        }, p)
                                                    )
                                                )
                                                : React.createElement('span', { className: 'text-slate-400 text-xs' }, 'Tidak ada')
                                        ),
                                        React.createElement('td', { className: 'px-4 py-3 text-center tabular-nums font-semibold text-sky-700' }, b.digital_score),
                                        React.createElement('td', { className: 'px-4 py-3' },
                                            React.createElement('span', { className: `inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${levelBadgeClass(b.digital_level)}` }, b.digital_level)
                                        ),
                                        React.createElement('td', { className: 'px-4 py-3' },
                                            React.createElement('button', {
                                                onClick: () => setSelectedItem(b),
                                                className: 'rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-700 transition',
                                            }, 'Detail')
                                        )
                                    );
                                })
                        )
                    )
                )
        ),

        // ── Detail Modal ──
        selectedItem ? React.createElement(DetailModal, { item: selectedItem, onClose: () => setSelectedItem(null) }) : null,

        // ── Modal Tambah Usaha ──
        showModal ? React.createElement('div', { className: 'fixed inset-0 z-[99999] flex items-center justify-center' },
            React.createElement('div', { className: 'absolute inset-0 bg-black/40', onClick: () => setShowModal(false) }),
            React.createElement('div', { className: 'relative z-[100000] w-full max-w-2xl mx-4 bg-white rounded-[28px] shadow-2xl overflow-y-auto max-h-[90vh]' },
                React.createElement('div', { className: 'p-6 border-b border-slate-200 flex items-center justify-between' },
                    React.createElement('div', null,
                        React.createElement('h3', { className: 'text-base font-semibold text-slate-950' }, 'Tambah Usaha Baru'),
                        React.createElement('p', { className: 'text-sm text-slate-500 mt-0.5' }, 'Isi detail usaha untuk menyimpannya ke database.')
                    ),
                    React.createElement('button', { onClick: () => setShowModal(false), className: 'rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition' },
                        React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 20 20', fill: 'currentColor', className: 'w-5 h-5' },
                            React.createElement('path', { d: 'M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z' })
                        )
                    )
                ),
                React.createElement('div', { className: 'p-6' },
                    React.createElement(BusinessForm, { onSaved: handleSaved, onCancel: () => setShowModal(false) })
                )
            )
        ) : null
    );
};

// ─── Root App ─────────────────────────────────────────────────────────────────

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
