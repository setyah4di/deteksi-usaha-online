import React, { useState } from 'react';

const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Terjadi kesalahan');
    }
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

export default function BusinessForm({ onSaved, onCancel, initial = {} }) {
    const [form, setForm] = useState({ ...initialFormState, ...initial });
    const [message, setMessage] = useState('');

    const handleChange = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('Menyimpan...');
        try {
            await fetchJson('/api/businesses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.content || '' },
                body: JSON.stringify(Object.fromEntries(Object.entries(form).filter(([,v]) => v && v.toString().trim()))),
            });
            setMessage('Tersimpan.');
            if (onSaved) onSaved();
        } catch (err) {
            setMessage(err.message || 'Gagal menyimpan');
        }
    };

    return React.createElement('form', { onSubmit: handleSubmit, className: 'space-y-4' },
        React.createElement('div', { className: 'grid gap-2' },
            React.createElement('label', { className: 'text-sm font-semibold' }, 'Nama usaha'),
            React.createElement('input', { type: 'text', value: form.name, onChange: (e) => handleChange('name', e.target.value), className: 'rounded border px-3 py-2' })
        ),
        React.createElement('div', { className: 'grid gap-2' },
            React.createElement('label', { className: 'text-sm font-semibold' }, 'Alamat'),
            React.createElement('textarea', { rows: 3, value: form.address, onChange: (e) => handleChange('address', e.target.value), className: 'rounded border px-3 py-2' })
        ),
        React.createElement('div', { className: 'grid gap-2 sm:grid-cols-2' },
            React.createElement('div', null,
                React.createElement('label', { className: 'text-sm font-semibold' }, 'Latitude'),
                React.createElement('input', { type: 'number', step: '0.000001', value: form.latitude, onChange: (e) => handleChange('latitude', e.target.value), className: 'rounded border px-3 py-2' })
            ),
            React.createElement('div', null,
                React.createElement('label', { className: 'text-sm font-semibold' }, 'Longitude'),
                React.createElement('input', { type: 'number', step: '0.000001', value: form.longitude, onChange: (e) => handleChange('longitude', e.target.value), className: 'rounded border px-3 py-2' })
            )
        ),
        React.createElement('div', { className: 'grid gap-2' },
            React.createElement('label', { className: 'text-sm font-semibold' }, 'Website'),
            React.createElement('input', { type: 'text', value: form.website, onChange: (e) => handleChange('website', e.target.value), className: 'rounded border px-3 py-2' })
        ),
        React.createElement('div', { className: 'grid gap-2 sm:grid-cols-2' },
            React.createElement('input', { type: 'text', placeholder: 'Instagram', value: form.instagram, onChange: (e) => handleChange('instagram', e.target.value), className: 'rounded border px-3 py-2' }),
            React.createElement('input', { type: 'text', placeholder: 'Facebook', value: form.facebook, onChange: (e) => handleChange('facebook', e.target.value), className: 'rounded border px-3 py-2' })
        ),
        React.createElement('div', { className: 'grid gap-2 sm:grid-cols-2' },
            React.createElement('input', { type: 'text', placeholder: 'WhatsApp', value: form.whatsapp, onChange: (e) => handleChange('whatsapp', e.target.value), className: 'rounded border px-3 py-2' }),
            React.createElement('input', { type: 'text', placeholder: 'Shopee', value: form.shopee, onChange: (e) => handleChange('shopee', e.target.value), className: 'rounded border px-3 py-2' })
        ),
        React.createElement('div', { className: 'grid gap-2 sm:grid-cols-2' },
            React.createElement('input', { type: 'text', placeholder: 'Tokopedia', value: form.tokopedia, onChange: (e) => handleChange('tokopedia', e.target.value), className: 'rounded border px-3 py-2' }),
            React.createElement('input', { type: 'text', placeholder: 'TikTok', value: form.tiktok, onChange: (e) => handleChange('tiktok', e.target.value), className: 'rounded border px-3 py-2' })
        ),
        React.createElement('div', { className: 'flex gap-3 justify-end' },
            React.createElement('button', { type: 'button', onClick: onCancel, className: 'rounded px-4 py-2 border' }, 'Batal'),
            React.createElement('button', { type: 'submit', className: 'rounded bg-sky-600 px-4 py-2 text-white' }, 'Simpan')
        ),
        React.createElement('p', { className: 'text-sm text-slate-600' }, message)
    );
}
