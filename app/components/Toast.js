'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';

const ToastContext = createContext(null);

export function useToast() {
    return useContext(ToastContext);
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type, removing: false }]);
        setTimeout(() => {
            setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t));
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 300);
        }, duration);
    }, []);

    const toast = {
        success: (msg) => addToast(msg, 'success'),
        error: (msg) => addToast(msg, 'error', 6000),
        info: (msg) => addToast(msg, 'info'),
        warning: (msg) => addToast(msg, 'warning', 5000)
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div style={{
                position: 'fixed',
                bottom: '1.5rem',
                right: '1.5rem',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                pointerEvents: 'none'
            }}>
                {toasts.map(t => (
                    <div
                        key={t.id}
                        style={{
                            padding: '0.75rem 1.25rem',
                            borderRadius: '10px',
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            fontFamily: 'var(--font-sans)',
                            maxWidth: '380px',
                            pointerEvents: 'auto',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                            backdropFilter: 'blur(12px)',
                            transition: 'all 0.3s ease',
                            opacity: t.removing ? 0 : 1,
                            transform: t.removing ? 'translateX(100%)' : 'translateX(0)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            ...toastStyles[t.type]
                        }}
                    >
                        <span>{toastIcons[t.type]}</span>
                        <span>{t.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

const toastStyles = {
    success: { background: '#065F46', color: '#D1FAE5', border: '1px solid #059669' },
    error: { background: '#7F1D1D', color: '#FEE2E2', border: '1px solid #DC2626' },
    info: { background: 'var(--brand-primary)', color: '#DBEAFE', border: '1px solid #3B82F6' },
    warning: { background: '#78350F', color: '#FEF3C7', border: '1px solid #D97706' }
};

const toastIcons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠'
};
