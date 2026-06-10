import React from 'react';
import ReactDOM from 'react-dom/client';
import '../css/app.css';
import BusinessForm from './components/BusinessForm';

const App = () => {
    const handleSaved = () => {
        // after save, navigate back or show message - simple redirect to dashboard
        window.location.href = '/';
    };

    return React.createElement('div', { className: 'min-h-screen bg-slate-50 p-8' },
        React.createElement('div', { className: 'mx-auto max-w-2xl' },
            React.createElement('h1', { className: 'text-2xl font-semibold mb-4' }, 'Tambah Usaha (Halaman Terpisah)'),
            React.createElement(BusinessForm, { onSaved: handleSaved, onCancel: () => window.history.back() })
        )
    );
};

const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(React.createElement(App));
