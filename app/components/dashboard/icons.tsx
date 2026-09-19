"use client";
import React from "react";

type IconProps = { size?: number; className?: string; strokeWidth?: number };

function icon(path: string | React.ReactNode, viewBox = "0 0 24 24") {
  return function Icon({ size = 24, className = "", strokeWidth = 1.8 }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {typeof path === "string" ? <path d={path} /> : path}
      </svg>
    );
  };
}

export const TodayIcon = icon(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
  </>,
);

export const CalendarIcon = icon(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </>,
);

export const CallsIcon = icon(
  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />,
);

export const EscalationIcon = icon(
  <>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </>,
);

export const ClientsIcon = icon(
  <>
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
  </>,
);

export const PetsIcon = icon(
  <>
    <circle cx="7" cy="7.5" r="2" />
    <circle cx="17" cy="7.5" r="2" />
    <circle cx="4" cy="14" r="2" />
    <circle cx="20" cy="14" r="2" />
    <path d="M12 18c-3 0-7-1.5-7-5 0-2.5 2-4 4-4h6c2 0 4 1.5 4 4 0 3.5-4 5-7 5z" />
  </>,
);

export const RecordsIcon = icon(
  <>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </>,
);

export const ListCheckIcon = icon(
  <>
    <path d="m3 17 2 2 4-4" />
    <path d="m3 7 2 2 4-4" />
    <path d="M13 6h8" />
    <path d="M13 12h8" />
    <path d="M13 18h8" />
  </>,
);

export const MicroscopeIcon = icon(
  <>
    <path d="M6 18h8" />
    <path d="M3 22h18" />
    <path d="M14 22a7 7 0 1 0 0-14h-1" />
    <path d="M9 14h2" />
    <path d="M9 12V6a2 2 0 0 1 2-2 2 2 0 0 1 2 2v6" />
    <path d="M8 6h6" />
  </>,
);

export const CreditCardIcon = icon(
  <>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
  </>,
);

export const SettingsIcon = icon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </>,
);

export const SearchIcon = icon(
  <>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </>,
);

export const BellIcon = icon(
  <>
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" />
  </>,
);

export const HomeIcon = icon(
  <>
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </>,
);

export const PhoneIcon = icon(
  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />,
);

export const MailIcon = icon(
  <>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </>,
);

export const PinIcon = icon(
  <>
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </>,
);

export const ClockIcon = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </>,
);

export const SparkleIcon = icon(
  <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM5 3v4M3 5h4M19 17v4M17 19h4" />,
);

export const WaveIcon = icon(
  <path d="M2 12c1.5-3 3-4.5 4.5-4.5s3 3 4.5 3 3-4.5 4.5-4.5S18 9 19.5 9 21 10.5 22 12" />,
);

export const ChevRightIcon = icon(
  <polyline points="9 18 15 12 9 6" />,
);

export const ChevLeftIcon = icon(
  <polyline points="15 18 9 12 15 6" />,
);

export const XIcon = icon(
  <>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </>,
);

export const CheckIcon = icon(
  <polyline points="20 6 9 17 4 12" />,
);

export const PlusIcon = icon(
  <>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </>,
);

export const PlayIcon = icon(
  <polygon points="5 3 19 12 5 21 5 3" />,
);

export const UserIcon = icon(
  <>
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </>,
);

export const ArrowRightIcon = icon(
  <>
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </>,
);

// Animal icons for pets
export function DogIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M4.5 11C3.12 11 2 12.12 2 13.5v1C2 15.88 3.12 17 4.5 17S7 15.88 7 14.5v-1C7 12.12 5.88 11 4.5 11zM19.5 11C18.12 11 17 12.12 17 13.5v1c0 1.38 1.12 2.5 2.5 2.5S22 15.88 22 14.5v-1C22 12.12 20.88 11 19.5 11zM17 6l2.5-2.5a1 1 0 00-1.41-1.41L15 5.17V4a3 3 0 00-6 0v1.17L5.91 2.09a1 1 0 00-1.41 1.41L7 6v4a5 5 0 0010 0V6zm-5 7a3 3 0 110-6 3 3 0 010 6z" />
    </svg>
  );
}

export function CatIcon({ size = 24, className = "" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18 3l3 3-3 1.5V9a6 6 0 01-6 6 6 6 0 01-6-6V7.5L6 6l3-3h9zM10 10a1 1 0 100 2 1 1 0 000-2zm4 0a1 1 0 100 2 1 1 0 000-2zM12 15v2l-2 2h4l-2-2v-2" />
    </svg>
  );
}

export function AnimalIcon({ species, size = 20, className = "" }: { species: string; size?: number; className?: string }) {
  if (species === "cat") return <CatIcon size={size} className={className} />;
  return <DogIcon size={size} className={className} />;
}

// Toast/status variant icons — distinguish severity by shape, not colour alone.
export const CheckCircleIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.5 2.5L16 9.5" />
  </>,
);

export const XCircleIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
  </>,
);

export const AlertTriangleIcon = icon(
  <>
    <path d="M12 3l10 18H2L12 3z" />
    <path d="M12 9v5M12 17h.01" />
  </>,
);

export const InfoCircleIcon = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8h.01M12 11v5" />
  </>,
);

export const PackageIcon = icon(
  <>
    <path d="M3 8l9-5 9 5-9 5-9-5zM3 8v8l9 5 9-5V8M12 13v8" />
  </>,
);
