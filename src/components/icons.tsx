import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ReelIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="2.4" />
      <circle cx="12" cy="6.4" r="1.5" />
      <circle cx="12" cy="17.6" r="1.5" />
      <circle cx="6.4" cy="12" r="1.5" />
      <circle cx="17.6" cy="12" r="1.5" />
    </Base>
  );
}

export function StarIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4-5.8-3.1-5.8 3.1 1.1-6.4L2.6 9.4l6.5-.9L12 2.6z" />
    </svg>
  );
}

export function TicketIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7.5A1.5 1.5 0 015.5 6h13A1.5 1.5 0 0120 7.5v2a2.5 2.5 0 000 5v2a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 16.5v-2a2.5 2.5 0 000-5v-2z" />
      <path d="M9 10.5v3M15 10.5v3" strokeDasharray="1 3" />
    </Base>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Base>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 6h16M7 12h10M10 18h4" />
    </Base>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4.5 12.5l5 5 10-11" />
    </Base>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7h16M9 7V4.8A.8.8 0 019.8 4h4.4a.8.8 0 01.8.8V7M6.5 7l.8 12.2a1 1 0 001 .8h7.4a1 1 0 001-.8L17.5 7M10 11v5M14 11v5" />
    </Base>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 13v5a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h5" />
    </Base>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Base>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3l1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3z" />
      <path d="M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16z" />
    </Base>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      <path d="M8.5 5.6a1 1 0 011.5-.87l9 6.4a1 1 0 010 1.74l-9 6.4a1 1 0 01-1.5-.87V5.6z" />
    </svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 16V4M8.5 7.5L12 4l3.5 3.5" />
      <path d="M5.5 12.5v6a1.5 1.5 0 001.5 1.5h10a1.5 1.5 0 001.5-1.5v-6" />
    </Base>
  );
}

export function FilmIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4" />
    </Base>
  );
}
