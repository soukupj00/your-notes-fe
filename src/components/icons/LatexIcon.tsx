import type * as React from 'react';

/**
 * The "TeX" wordmark (uppercase T, lowered E, uppercase X) - the canonical LaTeX/TeX
 * logo, drawn as an SVG so it renders crisply at toolbar-icon size and inherits the
 * current text color. Used for the Mathematics (LaTeX) toolbar button.
 */
export function LatexIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      {...props}
    >
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="13"
        letterSpacing="-0.5"
      >
        T
        <tspan dy="2.5" fontSize="11">
          e
        </tspan>
        <tspan dy="-2.5">X</tspan>
      </text>
    </svg>
  );
}
