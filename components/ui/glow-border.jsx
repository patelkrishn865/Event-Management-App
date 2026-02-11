"use client";

import React from "react";

/**
 * GlowBorder component that adds a premium gradient border and backdrop blur.
 * @param {Object} props - Component props.
 * @param {React.ReactNode} props.children - Content to wrap.
 * @param {string} [props.className] - Optional container classes.
 */
export function GlowBorder({ children, className = "" }) {
    return (
        <div
            className={[
                "rounded-3xl p-px bg-linear-to-br",
                "from-primary/45 via-foreground/10 to-secondary/40",
                "shadow-sm hover:shadow-md transition",
                className,
            ].join(" ")}
        >
            <div className="rounded-3xl bg-card/80 backdrop-blur h-full w-full">
                {children}
            </div>
        </div>
    );
}
