import React, { useState } from 'react';

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

const Field = ({ label, children }: { label?: string; children: React.ReactNode }) =>
    React.createElement(
        'div',
        { className: 'grid gap-1.5' },
        label ? React.createElement('label', { className: 'text-sm font-semibold text-slate-700' }, label) : null,
        children
    );

const inputClass = 'w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100';

export default function BusinessForm({
    onSaved,
    onCancel,
    initial = {},
}: {
    onSaved?: () => void;
    onCancel?: (() => void) | null;
    initial?: Partial<typeof initialFormState>;
}) {
    const [form, setForm] = useState({ ...initialFormState, ...initial });
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
                    'X-CSRF-TOKEN': (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '',
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

    return React.createElement(
        'form',
        { onSubmit: handleSubmit, className: 'space-y-5' },

        // Name
        React.createElement(Field, { label: 'Nama usaha *' },
            React.createElement('input', { type: 'text', value: form.name, onChange: (e: any) => set('name', e.target.value), className: inputClass, placeholder: 'Toko Maju Bersama' })
        ),

        // Address
        React.createElement(Field, { label: 'Alamat' },
            React.createElement('textarea', { rows: 3, value: form.address, onChange: (e: any) => set('address', e.target.value), className: inputClass, placeholder: 'Jl. Contoh No. 1, Kota Jambi' })
        ),

        // Coordinates
        React.createElement(
            'div',
            { className: 'grid gap-4 sm:grid-cols-2' },
            React.createElement(Field, { label: 'Latitude' },
                React.createElement('input', { type: 'number', step: '0.000001', value: form.latitude, onChange: (e: any) => set('latitude', e.target.value), className: inputClass, placeholder: '-1.609816' })
            ),
            React.createElement(Field, { label: 'Longitude' },
                React.createElement('input', { type: 'number', step: '0.000001', value: form.longitude, onChange: (e: any) => set('longitude', e.target.value), className: inputClass, placeholder: '103.614723' })
            )
        ),

        // Website
        React.createElement(Field, { label: 'Website' },
            React.createElement('input', { type: 'text', value: form.website, onChange: (e: any) => set('website', e.target.value), className: inputClass, placeholder: 'https://tokosaya.com' })
        ),

        // Social divider
        React.createElement(
            'div',
            { className: 'flex items-center gap-3' },
            React.createElement('div', { className: 'flex-1 h-px bg-slate-200' }),
            React.createElement('p', { className: 'text-xs font-semibold uppercase tracking-widest text-slate-400' }, 'Media Sosial & Marketplace'),
            React.createElement('div', { className: 'flex-1 h-px bg-slate-200' })
        ),

        // Social fields 2-col
        ...[
            [['Instagram', 'instagram', '@namaakun'], ['Facebook', 'facebook', 'nama-page']],
            [['WhatsApp', 'whatsapp', '08123456789'], ['Shopee', 'shopee', 'link toko']],
            [['Tokopedia', 'tokopedia', 'link toko'], ['TikTok', 'tiktok', '@akuntiktok']],
        ].map(([a, b], idx) =>
            React.createElement(
                'div',
                { key: idx, className: 'grid gap-4 sm:grid-cols-2' },
                React.createElement(Field, { label: a[0] as string },
                    React.createElement('input', { type: 'text', value: (form as any)[a[1]], onChange: (e: any) => set(a[1] as string, e.target.value), className: inputClass, placeholder: a[2] as string })
                ),
                React.createElement(Field, { label: b[0] as string },
                    React.createElement('input', { type: 'text', value: (form as any)[b[1]], onChange: (e: any) => set(b[1] as string, e.target.value), className: inputClass, placeholder: b[2] as string })
                )
            )
        ),

        // Feedback message
        message && message !== 'success'
            ? React.createElement('p', { className: 'rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-700' }, message)
            : null,

        // Actions
        React.createElement(
            'div',
            { className: 'flex gap-3 justify-end pt-2' },
            onCancel
                ? React.createElement(
                    'button',
                    { type: 'button', onClick: onCancel, className: 'rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50' },
                    'Batal'
                )
                : null,
            React.createElement(
                'button',
                {
                    type: 'submit',
                    disabled: loading,
                    className: 'rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60',
                },
                loading ? 'Menyimpan…' : 'Simpan Usaha'
            )
        )
    );
}
