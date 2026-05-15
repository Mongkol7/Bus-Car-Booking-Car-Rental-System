import { useEffect } from 'react';

export const Icon = ({
  d,
  size = 16,
  color = 'currentColor',
  className
}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>;

export const icons = {
  home: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M9 22V12h6v10',
  bus: 'M6 2h12a2 2 0 012 2v16a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2zM6 18h12M6 6h12',
  car: 'M5 17h14M5 17a2 2 0 11-4 0M5 17V9l2-5h10l2 5v8a2 2 0 01-2 2h-2M17 17a2 2 0 104 0',
  ticket: 'M15 5v2M15 11v2M15 17v2M5 5h14a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3a2 2 0 000-4V7a2 2 0 012-2z',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z',
  back: 'M19 12H5M12 19l-7-7 7-7',
  arrow: 'M5 12h14M12 5l7 7-7 7',
  chevron: 'M6 9l6 6 6-6',
  check: 'M20 6L9 17l-5-5',
  qr: 'M3 3h6v6H3zm12 0h6v6h-6zM3 15h6v6H3zm12 0h2v2h-2zm4 0h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2z',
  x: 'M18 6L6 18M6 6l12 12',
  edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z'
};

export const setupScrollReveal = () => {
  if (typeof window === 'undefined') return () => {};
  const elements = Array.from(document.querySelectorAll('.scroll-animate'));
  if (!('IntersectionObserver' in window)) {
    elements.forEach(el => {
      el.dataset.revealed = 'true';
    });
    return () => {};
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.dataset.revealed = 'true';
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.05,
    rootMargin: '0px 0px 0px 0px'
  });
  elements.forEach(el => {
    // Immediately reveal elements already visible in the viewport
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      el.dataset.revealed = 'true';
    } else {
      observer.observe(el);
    }
  });
  return () => observer.disconnect();
};

export const NAV = [{
  id: 'home',
  label: 'Home',
  icon: 'home'
}, {
  id: 'search',
  label: 'Bus booking',
  icon: 'bus'
}, {
  id: 'cars',
  label: 'Car rental',
  icon: 'car'
}, {
  id: 'bookings',
  label: 'My bookings',
  icon: 'ticket'
}, {
  id: 'profile',
  label: 'Profile',
  icon: 'user'
}];

export const companyMeta = {
  'Mekong Express': {
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.16)'
  },
  'Sorya Bus': {
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.16)'
  },
  'Giant Ibis': {
    color: '#a855f7',
    bg: 'rgba(168,85,247,0.16)'
  },
  'Larryta Express': {
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.16)'
  },
  'VET Air Bus': {
    color: '#f87171',
    bg: 'rgba(248,113,113,0.16)'
  },
  'Capitol Tours': {
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.16)'
  }
};

export const getCompanyMeta = name => companyMeta[name] || {
  color: 'var(--text-2)',
  bg: 'rgba(255,255,255,0.06)'
};

export const getTodayISO = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

