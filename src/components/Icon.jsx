const P = {
  food: <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1-3 3.5-3 6.5V13h3v8" />,
  train: <><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 11h14M8 17l-2 4M16 17l2 4" /></>,
  hotel: <><path d="M3 19V7M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6" /><circle cx="7" cy="11.5" r="1.5" /></>,
  visit: <><path d="M4 8h3l2-2h6l2 2h3v11H4Z" /><circle cx="12" cy="13" r="3.5" /></>,
  market: <><path d="M12 3 7 10h3l-4 6h12l-4-6h3Z" /><path d="M12 16v4" /></>,
  car: <><path d="M4 16h16v-4l-2.5-5h-11L4 12Z" /><path d="M4 12h16M6 16v2.5M18 16v2.5" /></>,
  event: <><path d="M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4Z" /><path d="M10 7v12" stroke-dasharray="2 2" /></>,
  transport: <><rect x="5" y="4" width="14" height="13" rx="3" /><path d="M5 11h14M8 20v-3M16 20v-3" /></>,
  gift: <><rect x="4" y="9" width="16" height="11" rx="1" /><path d="M3 9h18M12 9v11M12 9c-1.5-4-6-4.5-6-1.5S10 9 12 9M12 9c1.5-4 6-4.5 6-1.5S14 9 12 9" /></>,
  other: <><circle cx="6" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18" cy="12" r="1.3" /></>,
  flight: <path d="M3 13.5 21 6l-6 15-3-6.5Z" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  check: <path d="M4 7h3M4 12h3M4 17h3M10 7h10M10 12h10M10 17h10" />,
  shield: <><path d="M12 3 5 6v5c0 5 3 8.5 7 10 4-1.5 7-5 7-10V6Z" /><path d="M12 9v4M12 16v.01" /></>,
  pin: <><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11Z" /><circle cx="12" cy="10" r="2.2" /></>,
  route: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="6" r="2" /><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" /></>,
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1Z" />,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  ticket: <path d="M4 7h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4Z" />,
  bag: <><rect x="4" y="7" width="16" height="13" rx="2" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  nav: <path d="M3 11 21 3l-8 18-2-8-8-2Z" />,
  qr: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3M21 14v7h-4M14 21v-2" /></>,
  file: <><path d="M6 3h8l4 4v14H6Z" /><path d="M14 3v4h4M9 13h6M9 17h6" /></>,
  back: <path d="m15 6-6 6 6 6" />,
  chev: <path d="m9 6 6 6-6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  cloud: <path d="M7 17a4 4 0 0 1 .5-8 5 5 0 0 1 9.6 1.5A3.3 3.3 0 0 1 17 17Z" />,
  snow: <><path d="M7 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.6 1.5A3.3 3.3 0 0 1 17 15Z" /><path d="M9 18.5v.01M12 20v.01M15 18.5v.01" /></>,
  rain: <><path d="M7 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.6 1.5A3.3 3.3 0 0 1 17 15Z" /><path d="M9 18l-1 2M13 18l-1 2M17 18l-1 2" /></>,
  mode: <><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" /></>,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16Z" />,
  sync: <path d="M20 11a8 8 0 0 0-14-4.5L4 8M4 13a8 8 0 0 0 14 4.5l2-1.5M4 4v4h4M20 20v-4h-4" />,
  upload: <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  euro: <path d="M17 6.5A6 6 0 0 0 7.5 9M17 17.5A6 6 0 0 1 7.5 15M5 10h8M5 14h8" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></>,
  ok: <path d="m5 12 5 5 9-10" />,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5Z" /></>,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z" />
};

export default function Icon({ name, size = 20, stroke = 1.7, fill, style, class: cls }) {
  return (
    <svg class={cls} style={style} width={size} height={size} viewBox="0 0 24 24" fill={fill || 'none'} stroke="currentColor"
      stroke-width={stroke} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {P[name] || P.other}
    </svg>
  );
}
