import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';

const fetchJson = async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || data?.message || 'Terjadi kesalahan');
    return data;
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

// Kolom template Excel — urutan & header yang ditampilkan ke user
const TEMPLATE_COLUMNS = [
    { key: 'name',      header: 'Nama Usaha' },
    { key: 'address',   header: 'Alamat' },
    { key: 'latitude',  header: 'Latitude' },
    { key: 'longitude', header: 'Longitude' },
    { key: 'website',   header: 'Website' },
    { key: 'instagram', header: 'Instagram' },
    { key: 'facebook',  header: 'Facebook' },
    { key: 'whatsapp',  header: 'WhatsApp' },
    { key: 'shopee',    header: 'Shopee' },
    { key: 'tokopedia', header: 'Tokopedia' },
    { key: 'tiktok',    header: 'TikTok' },
];

const Field = ({ label, children }: { label?: string; children: React.ReactNode }) =>
    React.createElement('div', { className: 'grid gap-1.5' },
        label ? React.createElement('label', { className: 'text-sm font-semibold text-slate-700' }, label) : null,
        children
    );

const inputClass =
    'w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100';

// ─── Download Template ────────────────────────────────────────────────────────

function downloadTemplate() {
    const headers = TEMPLATE_COLUMNS.map((c) => c.header);
    const example = [
        'Toko Maju Bersama',
        'Jl. Contoh No. 1, Kota Jambi',
        '-1.609816',
        '103.614723',
        'https://tokosaya.com',
        '@namainstagram',
        'nama-page-facebook',
        '08123456789',
        'https://shopee.co.id/tokosaya',
        'https://tokopedia.com/tokosaya',
        '@akuntiktok',
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);

    // Lebar kolom otomatis berdasarkan panjang header
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 4, 18) }));

    XLSX.utils.book_append_sheet(wb, ws, 'Usaha');
    XLSX.writeFile(wb, 'template_import_usaha.xlsx');
}

// ─── Parse Excel → array of objects ──────────────────────────────────────────

function parseExcel(file: File): Promise<Record<string, string>[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const wb   = XLSX.read(data, { type: 'array' });
                const ws   = wb.Sheets[wb.SheetNames[0]];
                const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

                if (rows.length < 2) { resolve([]); return; }

                // Baris pertama = header, mapping header → key
                const headerRow = (rows[0] as string[]).map((h) => String(h).trim());
                const headerToKey: Record<string, string> = {};
                TEMPLATE_COLUMNS.forEach(({ key, header }) => {
                    const idx = headerRow.findIndex(
                        (h) => h.toLowerCase() === header.toLowerCase()
                    );
                    if (idx !== -1) headerToKey[idx] = key;
                });

                const records: Record<string, string>[] = [];

                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i] as any[];
                    // Lewati baris yang benar-benar kosong semua
                    if (row.every((cell) => cell === '' || cell == null)) continue;

                    const obj: Record<string, string> = {};
                    Object.entries(headerToKey).forEach(([colIdx, key]) => {
                        const val = row[Number(colIdx)];
                        // Hanya masukkan jika ada nilai; kolom kosong → tidak masuk payload (jadi null di DB)
                        if (val !== '' && val != null) {
                            obj[key] = String(val).trim();
                        }
                    });

                    records.push(obj);
                }

                resolve(records);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Gagal membaca file.'));
        reader.readAsArrayBuffer(file);
    });
}

// ─── Import Panel ─────────────────────────────────────────────────────────────

function ImportPanel({ onImportDone }: { onImportDone: () => void }) {
    const fileInputRef               = useRef<HTMLInputElement>(null);
    const [importing, setImporting]  = useState(false);
    const [result, setResult]        = useState<{ success: number; failed: number; errors: string[] } | null>(null);
    const [fileName, setFileName]    = useState('');

    const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setResult(null);
        setImporting(true);

        try {
            const records = await parseExcel(file);

            if (records.length === 0) {
                setResult({ success: 0, failed: 0, errors: ['File tidak mengandung data usaha.'] });
                setImporting(false);
                return;
            }

            let success = 0;
            const errors: string[] = [];

            // Kirim satu per satu agar error per baris bisa ditangkap
            for (let i = 0; i < records.length; i++) {
                const row = records[i];
                // Nama wajib ada untuk bisa disimpan
                if (!row.name) {
                    errors.push(`Baris ${i + 2}: kolom "Nama Usaha" kosong, baris dilewati.`);
                    continue;
                }
                try {
                    await fetchJson('/api/businesses', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN':
                                (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)
                                    ?.content || '',
                        },
                        body: JSON.stringify(row),
                    });
                    success++;
                } catch (err: any) {
                    errors.push(`Baris ${i + 2} (${row.name}): ${err.message}`);
                }
            }

            setResult({ success, failed: errors.length, errors });
            if (success > 0) onImportDone();
        } catch (err: any) {
            setResult({ success: 0, failed: 0, errors: [err.message || 'Gagal memproses file.'] });
        } finally {
            setImporting(false);
            // Reset input agar file yang sama bisa dipilih lagi
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return React.createElement('div', { className: 'space-y-3' },

        // Divider
        React.createElement('div', { className: 'flex items-center gap-3' },
            React.createElement('div', { className: 'flex-1 h-px bg-slate-200' }),
            React.createElement('p', { className: 'text-xs font-semibold uppercase tracking-widest text-slate-400' }, 'Import dari Excel'),
            React.createElement('div', { className: 'flex-1 h-px bg-slate-200' })
        ),

        // Tombol aksi
        React.createElement('div', { className: 'flex flex-wrap gap-2' },
            // Download template
            React.createElement('button', {
                type: 'button',
                onClick: downloadTemplate,
                className: 'inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50',
            },
                React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 20 20', fill: 'currentColor', className: 'w-4 h-4 text-emerald-600' },
                    React.createElement('path', { d: 'M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z' }),
                    React.createElement('path', { d: 'M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z' })
                ),
                'Download Template'
            ),

            // Upload file
            React.createElement('label', {
                className: [
                    'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition cursor-pointer',
                    importing
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-sky-600 text-white hover:bg-sky-700',
                ].join(' '),
            },
                importing
                    ? React.createElement('span', { className: 'w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block' })
                    : React.createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 20 20', fill: 'currentColor', className: 'w-4 h-4' },
                        React.createElement('path', { d: 'M9.25 13.25a.75.75 0 001.5 0V4.636l2.955 3.129a.75.75 0 001.09-1.03l-4.25-4.5a.75.75 0 00-1.09 0l-4.25 4.5a.75.75 0 101.09 1.03L9.25 4.636v8.614z' }),
                        React.createElement('path', { d: 'M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z' })
                    ),
                importing ? 'Mengimpor…' : 'Pilih File Excel',
                React.createElement('input', {
                    ref: fileInputRef,
                    type: 'file',
                    accept: '.xlsx,.xls,.csv',
                    disabled: importing,
                    onChange: handleFile,
                    className: 'sr-only',
                })
            )
        ),

        // Nama file terpilih
        fileName && !result ? React.createElement('p', { className: 'text-xs text-slate-500' }, `File: ${fileName}`) : null,

        // Hasil import
        result ? React.createElement('div', {
            className: [
                'rounded-xl border px-4 py-3 space-y-1 text-sm',
                result.failed === 0 && result.success > 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : result.success > 0
                        ? 'bg-amber-50 border-amber-200 text-amber-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800',
            ].join(' '),
        },
            React.createElement('p', { className: 'font-semibold' },
                result.success > 0
                    ? `${result.success} usaha berhasil diimpor${result.failed > 0 ? `, ${result.failed} gagal` : ''}.`
                    : `Import gagal — ${result.errors[0]}`
            ),
            result.errors.length > 0 && result.success > 0
                ? React.createElement('ul', { className: 'list-disc list-inside text-xs space-y-0.5 mt-1' },
                    result.errors.map((e, i) => React.createElement('li', { key: i }, e))
                )
                : null
        ) : null,

        // Petunjuk singkat
        React.createElement('p', { className: 'text-xs text-slate-400' },
            'Format yang didukung: .xlsx, .xls. Hanya kolom "Nama Usaha" yang wajib diisi; kolom lain boleh kosong.'
        )
    );
}

// ─── BusinessForm ─────────────────────────────────────────────────────────────

export default function BusinessForm({
    onSaved,
    onCancel,
    initial = {},
}: {
    onSaved?: () => void;
    onCancel?: (() => void) | null;
    initial?: Partial<typeof initialFormState>;
}) {
    const [form, setForm]       = useState({ ...initialFormState, ...initial });
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { setMessage('Nama usaha wajib diisi.'); return; }
        setMessage('');
        setLoading(true);
        try {
            const payload = Object.fromEntries(
                Object.entries(form).filter(([, v]) => v && v.toString().trim())
            );
            await fetchJson('/api/businesses', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)
                            ?.content || '',
                },
                body: JSON.stringify(payload),
            });
            setMessage('success');
            if (onSaved) onSaved();
        } catch (err: any) {
            setMessage(err.message || 'Gagal menyimpan.');
        } finally {
            setLoading(false);
        }
    };

    return React.createElement('div', { className: 'space-y-6' },

        // ── Form manual ──
        React.createElement('form', { onSubmit: handleSubmit, className: 'space-y-5' },

            React.createElement(Field, { label: 'Nama usaha *' },
                React.createElement('input', { type: 'text', value: form.name, onChange: (e: any) => set('name', e.target.value), className: inputClass, placeholder: 'Toko Maju Bersama' })
            ),

            React.createElement(Field, { label: 'Alamat' },
                React.createElement('textarea', { rows: 3, value: form.address, onChange: (e: any) => set('address', e.target.value), className: inputClass, placeholder: 'Jl. Contoh No. 1, Kota Jambi' })
            ),

            React.createElement('div', { className: 'grid gap-4 sm:grid-cols-2' },
                React.createElement(Field, { label: 'Latitude' },
                    React.createElement('input', { type: 'number', step: '0.000001', value: form.latitude, onChange: (e: any) => set('latitude', e.target.value), className: inputClass, placeholder: '-1.609816' })
                ),
                React.createElement(Field, { label: 'Longitude' },
                    React.createElement('input', { type: 'number', step: '0.000001', value: form.longitude, onChange: (e: any) => set('longitude', e.target.value), className: inputClass, placeholder: '103.614723' })
                )
            ),

            React.createElement(Field, { label: 'Website' },
                React.createElement('input', { type: 'text', value: form.website, onChange: (e: any) => set('website', e.target.value), className: inputClass, placeholder: 'https://tokosaya.com' })
            ),

            React.createElement('div', { className: 'flex items-center gap-3' },
                React.createElement('div', { className: 'flex-1 h-px bg-slate-200' }),
                React.createElement('p', { className: 'text-xs font-semibold uppercase tracking-widest text-slate-400' }, 'Media Sosial & Marketplace'),
                React.createElement('div', { className: 'flex-1 h-px bg-slate-200' })
            ),

            ...[
                [['Instagram', 'instagram', '@namaakun'],   ['Facebook',  'facebook',  'nama-page']],
                [['WhatsApp',  'whatsapp',  '08123456789'], ['Shopee',    'shopee',    'link toko']],
                [['Tokopedia', 'tokopedia', 'link toko'],   ['TikTok',    'tiktok',    '@akuntiktok']],
            ].map(([a, b], idx) =>
                React.createElement('div', { key: idx, className: 'grid gap-4 sm:grid-cols-2' },
                    React.createElement(Field, { label: a[0] as string },
                        React.createElement('input', { type: 'text', value: (form as any)[a[1]], onChange: (e: any) => set(a[1] as string, e.target.value), className: inputClass, placeholder: a[2] as string })
                    ),
                    React.createElement(Field, { label: b[0] as string },
                        React.createElement('input', { type: 'text', value: (form as any)[b[1]], onChange: (e: any) => set(b[1] as string, e.target.value), className: inputClass, placeholder: b[2] as string })
                    )
                )
            ),

            message && message !== 'success'
                ? React.createElement('p', { className: 'rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-700' }, message)
                : null,

            React.createElement('div', { className: 'flex gap-3 justify-end pt-2' },
                onCancel
                    ? React.createElement('button', { type: 'button', onClick: onCancel, className: 'rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50' }, 'Batal')
                    : null,
                React.createElement('button', {
                    type: 'submit', disabled: loading,
                    className: 'rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60',
                }, loading ? 'Menyimpan…' : 'Simpan Usaha')
            )
        ),

        // ── Import Excel ──
        React.createElement(ImportPanel, { onImportDone: onSaved ?? (() => {}) })
    );
}
