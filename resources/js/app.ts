import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import '../css/app.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import BusinessForm from './components/BusinessForm';

L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
});

// Ensure Leaflet markers always use the resolved asset URLs from the bundler
const DefaultIcon = L.icon({
    iconUrl: iconUrl,
    iconRetinaUrl: iconRetinaUrl,
    shadowUrl: shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

const api = {
    geocode: '/api/geocode',
    nearby: '/api/nearby',
    businesses: '/api/businesses',
    stats: '/api/stats',
};

const initialFormState = {
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    website: '',
    instagram: '',
    facebook: '',
    whatsapp: '',
    shopee: '',
    tokopedia: '',
    tiktok: '',
};

const buildHref = (value) => {
    if (!value) {
        return '#';
    }
    const normalized = value.startsWith('http') ? value : `https://${value.replace(/^\/+/, '')}`;
    return normalized;
};

const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Terjadi kesalahan server');
    }

    return data;
};

const App = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [radius, setRadius] = useState('1000');
    const [statusText, setStatusText] = useState('Masukkan lokasi untuk memulai pencarian.');
    const [nearbySummary, setNearbySummary] = useState('Tekan Cari Usaha Sekitar setelah memilih lokasi.');
    const [currentPosition, setCurrentPosition] = useState(null);
    const [nearbyItems, setNearbyItems] = useState([]);
    const [savedBusinesses, setSavedBusinesses] = useState([]);
    const [stats, setStats] = useState({ total: 0, online_presence: 0, average_score: 0, levels: [] });
    const [form, setForm] = useState(initialFormState);
    const [saveMessage, setSaveMessage] = useState('Gunakan form untuk menambahkan usaha baru.');
    const [showModal, setShowModal] = useState(false);

    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const savedLayer = useRef(null);
    const nearbyLayer = useRef(null);

    const levelCounts = useMemo(() => {
        const counts = { high: 0, medium: 0, low: 0 };
        stats.levels?.forEach((item) => {
            if (['Sangat Tinggi', 'Tinggi'].includes(item.digital_level)) counts.high += item.count;
            if (item.digital_level === 'Sedang') counts.medium += item.count;
            if (item.digital_level === 'Rendah') counts.low += item.count;
        });
        return counts;
    }, [stats.levels]);

    useEffect(() => {
        if (!mapRef.current) {
            return;
        }

        mapInstance.current = L.map(mapRef.current, {
            center: [-2.5489, 118.0149],
            zoom: 5,
            zoomControl: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }).addTo(mapInstance.current);

        savedLayer.current = L.layerGroup().addTo(mapInstance.current);
        nearbyLayer.current = L.layerGroup().addTo(mapInstance.current);

        return () => {
            mapInstance.current?.remove();
        };
    }, []);

    useEffect(() => {
        // prevent background scroll when modal open
        const prev = document.body.style.overflow;
        document.body.style.overflow = showModal ? 'hidden' : prev;
        return () => { document.body.style.overflow = prev; };
    }, [showModal]);

    useEffect(() => {
        const loadInitial = async () => {
            await Promise.all([loadStats(), loadSavedBusinesses()]);
        };

        loadInitial();
    }, []);

    useEffect(() => {
        if (!mapInstance.current || !savedLayer.current) {
            return;
        }

        savedLayer.current.clearLayers();
        savedBusinesses.forEach((item) => {
            if (!item.latitude || !item.longitude) {
                return;
            }

            const marker = L.marker([item.latitude, item.longitude], {
                title: item.name,
            }).addTo(savedLayer.current);
            marker.bindPopup(`
                <strong>${item.name}</strong><br />
                ${item.address || 'Alamat tidak tersedia'}<br />
                Skor digital: ${item.digital_score}
            `);
        });
    }, [savedBusinesses]);

    const loadStats = async () => {
        try {
            const data = await fetchJson(api.stats);
            setStats(data);
        } catch (error) {
            console.warn(error);
        }
    };

    const loadSavedBusinesses = async () => {
        try {
            const items = await fetchJson(api.businesses);
            setSavedBusinesses(items);
        } catch (error) {
            console.warn(error);
        }
    };

    const handleFormSaved = async () => {
        setShowModal(false);
        setSaveMessage('Usaha berhasil disimpan.');
        await Promise.all([loadStats(), loadSavedBusinesses()]);
    };

    const searchLocation = async () => {
        if (!searchTerm.trim()) {
            setStatusText('Isi kata kunci lokasi terlebih dahulu.');
            return;
        }

        setStatusText('Mencari lokasi...');

        try {
            const results = await fetchJson(`${api.geocode}?q=${encodeURIComponent(searchTerm.trim())}`);

            if (!Array.isArray(results) || results.length === 0) {
                setStatusText('Lokasi tidak ditemukan. Coba kata kunci lain.');
                return;
            }

            const place = results[0];
            const lat = parseFloat(place.lat);
            const lon = parseFloat(place.lon);

            setCurrentPosition({ lat, lon });
            setForm((prev) => ({ ...prev, latitude: String(lat), longitude: String(lon) }));
            setStatusText(`Lokasi dipilih: ${place.display_name}`);

            if (mapInstance.current) {
                mapInstance.current.flyTo([lat, lon], 14, { duration: 0.9 });
                L.circle([lat, lon], { radius: parseInt(radius, 10), color: '#0ea5e9', fillOpacity: 0.08 }).addTo(savedLayer.current);
            }
        } catch (error) {
            setStatusText(error.message);
        }
    };

    const searchNearby = async () => {
        const lat = currentPosition?.lat ?? parseFloat(form.latitude);
        const lon = currentPosition?.lon ?? parseFloat(form.longitude);

        if (Number.isNaN(lat) || Number.isNaN(lon)) {
            setNearbySummary('Isi lokasi atau pilih lokasi terlebih dahulu.');
            return;
        }

        setNearbySummary('Mengambil usaha sekitar dari Overpass API...');
        nearbyLayer.current?.clearLayers();

        try {
            const items = await fetchJson(`${api.nearby}?lat=${lat}&lon=${lon}&radius=${parseInt(radius, 10)}`);
            setNearbyItems(items);

            if (Array.isArray(items) && items.length) {
                items.forEach((item) => {
                    if (item.latitude && item.longitude) {
                        const marker = L.circleMarker([item.latitude, item.longitude], {
                            radius: 7,
                            color: '#2563eb',
                            fillColor: '#93c5fd',
                            fillOpacity: 0.9,
                        }).addTo(nearbyLayer.current);

                        marker.bindPopup(`
                            <strong>${item.name}</strong><br />
                            ${item.address || 'Alamat tidak tersedia'}<br />
                            Skor: ${item.digital_score}
                        `);
                    }
                });

                setNearbySummary(`Ditemukan ${items.length} usaha dalam radius ${radius} meter.`);
            } else {
                setNearbyItems([]);
                setNearbySummary('Tidak ada usaha ditemukan dalam radius tersebut.');
            }
        } catch (error) {
            setNearbySummary(error.message || 'Gagal memuat data usaha dari Overpass API.');
            console.error(error);
        }
    };

    const saveBusiness = async (event) => {
        event.preventDefault();
        setSaveMessage('Menyimpan usaha...');

        const payload = Object.entries(form).reduce((acc, [key, value]) => {
            if (value?.toString().trim()) {
                acc[key] = value.toString().trim();
            }
            return acc;
        }, {});

        try {
            await fetchJson(api.businesses, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '',
                },
                body: JSON.stringify(payload),
            });
            setSaveMessage('Usaha berhasil disimpan.');
            setForm(initialFormState);
            await Promise.all([loadStats(), loadSavedBusinesses()]);
        } catch (error) {
            setSaveMessage(error.message || 'Gagal menyimpan usaha.');
        }
    };

    const handleInputChange = (key, value) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    return React.createElement(
        'div',
        { className: 'min-h-screen bg-slate-50 text-slate-900 antialiased' },
        React.createElement(
            'div',
            { className: 'mx-auto max-w-[1320px] px-4 py-8 sm:px-6 lg:px-8' },
            React.createElement(
                'header',
                { className: 'mb-8 rounded-[32px] bg-white p-8 shadow-lg shadow-slate-200/80 ring-1 ring-slate-200' },
                React.createElement(
                    'div',
                    { className: 'flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between' },
                    React.createElement(
                        'div',
                        { className: 'space-y-3' },
                        React.createElement(
                            'div',
                            null,
                            React.createElement('h1', { className: 'text-3xl justify-center font-semibold tracking-tight text-slate-950 sm:text-4xl' }, 'Sistem Pemetaan dan Deteksi Usaha Online'),
                            React.createElement('p', { className: 'mt-3 max-w-2xl text-slate-600' }, 'Cari lokasi, temukan usaha sekitar, pantau kehadiran digital, dan simpan data usaha.')
                        )
                    ),
                    React.createElement('a', { 
                        href: 'https://www.openstreetmap.org', 
                        target: '_blank', 
                        rel: 'noreferrer', 
                        className: 'inline-flex items-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800' 
                    }, 'Buka OpenStreetMap')
                )
            ),
            React.createElement(
                'div',
                { className: 'grid gap-8 xl:grid-cols-[1.55fr_1fr]' },
                React.createElement(
                    'section',
                    { className: 'space-y-8' },
                    React.createElement(
                        'div',
                        { className: 'rounded-[32px] bg-white p-8 shadow-lg shadow-slate-200/70 ring-1 ring-slate-200' },
                        React.createElement(
                            'div',
                            { className: 'grid gap-6 sm:grid-cols-[1.7fr_auto]' },
                            React.createElement(
                                'div',
                                { className: 'space-y-4' },
                                React.createElement('label', { className: 'block text-sm font-semibold text-slate-700' }, 'Cari alamat atau nama lokasi'),
                                React.createElement('input', {
                                    type: 'text',
                                    value: searchTerm,
                                    onChange: (e) => setSearchTerm(e.target.value),
                                    placeholder: 'Contoh: Kota Jambi, Prabumulih, Pasar',
                                    className: 'w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100',
                                })
                            ),
                            React.createElement(
                                'div',
                                { className: 'grid gap-3 sm:items-end' },
                                React.createElement('button', {
                                    onClick: searchLocation,
                                    className: 'rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700'
                                }, 'Cari Lokasi'),
                                React.createElement('button', {
                                    onClick: searchNearby,
                                    className: 'rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50'
                                }, 'Cari Usaha Sekitar')
                            )
                        ),
                        React.createElement(
                            'div',
                            { className: 'mt-6 grid gap-6 sm:grid-cols-[1fr_auto]' },
                            React.createElement(
                                'div',
                                { className: 'grid gap-3' },
                                React.createElement('label', { className: 'text-sm font-semibold text-slate-700' }, 'Radius pencarian (meter)'),
                                React.createElement(
                                    'select',
                                    {
                                        value: radius,
                                        onChange: (e) => setRadius(e.target.value),
                                        className: 'w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100'
                                    },
                                    React.createElement('option', { value: '500' }, '500 m'),
                                    React.createElement('option', { value: '1000' }, '1000 m'),
                                    React.createElement('option', { value: '1500' }, '1500 m'),
                                    React.createElement('option', { value: '2500' }, '2500 m')
                                )
                            ),
                            React.createElement('div', { className: 'rounded-3xl bg-slate-100 p-4 text-sm text-slate-600' }, statusText)
                        )
                    ),
                    React.createElement(
                        'div',
                        { className: 'rounded-[32px] bg-white p-8 shadow-lg shadow-slate-200/70 ring-1 ring-slate-200' },
                        React.createElement('div', { id: 'map', ref: mapRef, className: 'h-[520px] w-full rounded-[28px] border border-slate-200 relative z-0' })
                    ),
                    React.createElement(
                        'div',
                        { className: 'grid gap-6 sm:grid-cols-3' },
                        React.createElement(
                            'div',
                            { className: 'rounded-3xl bg-slate-950 p-6 text-white shadow-lg shadow-slate-200/20' },
                            React.createElement('p', { className: 'text-sm uppercase tracking-[0.18em] text-slate-300' }, 'Total usaha tersimpan'),
                            React.createElement('p', { className: 'mt-4 text-3xl font-semibold' }, stats.total)
                        ),
                        React.createElement(
                            'div',
                            { className: 'rounded-3xl bg-slate-950 p-6 text-white shadow-lg shadow-slate-200/20' },
                            React.createElement('p', { className: 'text-sm uppercase tracking-[0.18em] text-slate-300' }, 'Usaha dengan online presence'),
                            React.createElement('p', { className: 'mt-4 text-3xl font-semibold' }, stats.online_presence)
                        ),
                        React.createElement(
                            'div',
                            { className: 'rounded-3xl bg-slate-950 p-6 text-white shadow-lg shadow-slate-200/20' },
                            React.createElement('p', { className: 'text-sm uppercase tracking-[0.18em] text-slate-300' }, 'Rata-rata skor digital'),
                            React.createElement('p', { className: 'mt-4 text-3xl font-semibold' }, stats.average_score)
                        )
                    )
                ),
                React.createElement(
                    'aside',
                    { className: 'space-y-8' },
                    React.createElement(
                        'section',
                        { className: 'rounded-[32px] bg-white p-8 shadow-lg shadow-slate-200/70 ring-1 ring-slate-200' },
                        React.createElement('h2', { className: 'text-xl font-semibold text-slate-950' }, 'Ringkasan Deteksi Sekitar'),
                        React.createElement('p', { className: 'mt-3 rounded-3xl bg-slate-100 px-4 py-4 text-sm text-slate-600' }, nearbySummary),
                        React.createElement(
                            'div',
                            { className: 'mt-6 overflow-hidden rounded-3xl border border-slate-200' },
                            React.createElement(
                                'table',
                                { className: 'w-full border-collapse text-sm' },
                                React.createElement(
                                    'thead',
                                    { className: 'bg-slate-100 text-slate-600' },
                                    React.createElement(
                                        'tr',
                                        null,
                                        React.createElement('th', { className: 'px-4 py-3 text-left' }, 'Nama'),
                                        React.createElement('th', { className: 'px-4 py-3 text-left' }, 'Score'),
                                        React.createElement('th', { className: 'px-4 py-3 text-left' }, 'Level')
                                    )
                                ),
                                React.createElement(
                                    'tbody',
                                    null,
                                    nearbyItems.length === 0
                                        ? React.createElement('tr', null, React.createElement('td', { colSpan: 3, className: 'px-4 py-5 text-slate-500' }, 'Belum ada hasil.'))
                                        : nearbyItems.map((item) =>
                                            React.createElement(
                                                'tr',
                                                { key: `${item.type}-${item.id}`, className: 'border-t border-slate-200' },
                                                React.createElement('td', { className: 'px-4 py-4' }, item.name),
                                                React.createElement('td', { className: 'px-4 py-4' }, item.digital_score),
                                                React.createElement('td', { className: 'px-4 py-4' }, item.digital_level)
                                            )
                                        )
                                )
                            )
                        )
                    ),
                    React.createElement(
                        'section',
                        { className: 'rounded-[32px] bg-white p-8 shadow-lg shadow-slate-200/70 ring-1 ring-slate-200' },
                        React.createElement('h2', { className: 'text-xl font-semibold text-slate-950' }, 'Input Usaha Baru'),
                        React.createElement('p', { className: 'mt-3 text-sm text-slate-600' }, 'Tambahkan usaha baru melalui modal.'),
                        React.createElement('div', { className: 'mt-4 flex gap-3 justify-end' },
                            React.createElement('button', { onClick: () => setShowModal(true), className: 'rounded-2xl bg-sky-600 px-4 py-2 text-white' }, 'Tambah Usaha')
                        )
                    ),
                    React.createElement(
                        'section',
                        { className: 'rounded-[32px] bg-white p-8 shadow-lg shadow-slate-200/70 ring-1 ring-slate-200' },
                        React.createElement('h2', { className: 'text-xl font-semibold text-slate-950' }, 'Statistik Level Digital'),
                        React.createElement(
                            'div',
                            { className: 'mt-6 grid gap-4 sm:grid-cols-3' },
                            React.createElement(
                                'div',
                                { className: 'rounded-3xl bg-slate-100 p-5 text-slate-950' },
                                React.createElement('p', { className: 'text-sm font-semibold uppercase tracking-[0.12em] text-slate-500' }, 'Tinggi / Sangat Tinggi'),
                                React.createElement('p', { className: 'mt-3 text-3xl font-semibold' }, levelCounts.high)
                            ),
                            React.createElement(
                                'div',
                                { className: 'rounded-3xl bg-slate-100 p-5 text-slate-950' },
                                React.createElement('p', { className: 'text-sm font-semibold uppercase tracking-[0.12em] text-slate-500' }, 'Sedang'),
                                React.createElement('p', { className: 'mt-3 text-3xl font-semibold' }, levelCounts.medium)
                            ),
                            React.createElement(
                                'div',
                                { className: 'rounded-3xl bg-slate-100 p-5 text-slate-950' },
                                React.createElement('p', { className: 'text-sm font-semibold uppercase tracking-[0.12em] text-slate-500' }, 'Rendah'),
                                React.createElement('p', { className: 'mt-3 text-3xl font-semibold' }, levelCounts.low)
                            )
                        )
                    )
                )
            )
        ,
        showModal ? React.createElement(
            'div',
            { className: 'fixed inset-0 z-[99999] flex items-center justify-center' },
            React.createElement('div', { className: 'absolute inset-0 bg-black/40', onClick: () => setShowModal(false) }),
            React.createElement('div', { className: 'relative z-[100000] w-full max-w-2xl p-6 bg-white rounded-2xl shadow-lg' },
                React.createElement(BusinessForm, { onSaved: handleFormSaved, onCancel: () => setShowModal(false) })
            )
        ) : null
    ));
};

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(React.createElement(App));
