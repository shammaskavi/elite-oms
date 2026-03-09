import React from "react";
import { BlousePathKey } from "./types";

export function BlouseVisual({ activePath }: { activePath: BlousePathKey }) {
    const base = "stroke-slate-200 stroke-[1.5] fill-none transition-all duration-500 ease-in-out";
    const active = "stroke-slate-900 stroke-[4] drop-shadow-[0_0_12px_rgba(15,23,42,0.4)]";

    return (
        <div className="relative w-full h-full flex items-center justify-center p-6 md:p-12">
            {/* Dynamic Background Glow */}
            <div className={`absolute inset-0 blur-[100px] opacity-20 transition-colors duration-1000 
        ${activePath === 'none' ? 'bg-slate-200' : 'bg-blue-500'}`}
            />
            <svg
                viewBox="0 0 400 300"
                className="w-full max-w-xl relative z-10"
                xmlns="http://www.w3.org/2000/svg"
            >

                {/* ARROW DEFINITIONS */}
                <defs>
                    <marker
                        id="arrow"
                        viewBox="0 0 10 10"
                        refX="5"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                    >
                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#1e293b" />
                    </marker>
                </defs>

                {/* CENTER GUIDE */}
                <line x1="200" y1="30" x2="200" y2="250" stroke="#e2e8f0" strokeWidth="1" />

                {/* BLOUSE SILHOUETTE */}
                <g stroke="#cbd5e1" strokeWidth="2" fill="white">

                    {/* LEFT BODY */}
                    <path d="
      M200 70
      L150 70
      L120 85
      C105 100 105 125 120 140
      L135 230
      L200 230
      Z
    "/>

                    {/* RIGHT BODY */}
                    <path d="
      M200 70
      L250 70
      L280 85
      C295 100 295 125 280 140
      L265 230
      L200 230
      Z
    "/>

                    {/* FRONT NECK */}
                    <path d="M160 70 Q200 105 240 70" fill="none" />

                    {/* LEFT SLEEVE */}
                    <path d="
      M120 85
      L80 100
      L95 140
      L135 120
      Z
    "/>

                    {/* RIGHT SLEEVE */}
                    <path d="
      M280 85
      L320 100
      L305 140
      L265 120
      Z
    "/>

                </g>

                {/* ===================== */}
                {/* MEASUREMENT LAYER */}
                {/* ===================== */}

                <g
                    stroke="#0f172a"
                    strokeWidth="2"
                    fill="none"
                    markerStart="url(#arrow)"
                    markerEnd="url(#arrow)"
                    className="transition-all duration-500"
                >

                    {/* SHOULDER WIDTH */}
                    <line
                        x1="150"
                        y1="60"
                        x2="250"
                        y2="60"
                        className={`${activePath === "shoulder" ? "opacity-100" : "opacity-20"}`}
                    />

                    {/* CHEST WIDTH */}
                    <line
                        x1="120"
                        y1="150"
                        x2="280"
                        y2="150"
                        className={`${activePath === "chest" ? "opacity-100" : "opacity-20"}`}
                    />

                    {/* BLOUSE LENGTH */}
                    <line
                        x1="200"
                        y1="70"
                        x2="200"
                        y2="230"
                        className={`${activePath === "length" ? "opacity-100" : "opacity-20"}`}
                    />

                    {/* SLEEVE LENGTH */}
                    <line
                        x1="280"
                        y1="85"
                        x2="320"
                        y2="100"
                        className={`${activePath === "sleeve" ? "opacity-100" : "opacity-20"}`}
                    />

                </g>

            </svg>
        </div>
    );
}