import React from "react";

// Code 39 Barcode character mapping for native SVG drawing
const CODE39_MAP: Record<string, string> = {
  '0': '101001101101', '1': '110100101011', '2': '101100101011', '3': '110110010101',
  '4': '101001101011', '5': '110100110101', '6': '101100110101', '7': '101001011011',
  '8': '110100101101', '9': '101100101101', 'A': '110101001011', 'B': '101101001011',
  'C': '110110100101', 'D': '101011001011', 'E': '110101100101', 'F': '101101100101',
  'G': '101010011011', 'H': '110101001101', 'I': '101101001101', 'J': '101011001101',
  'K': '110101010011', 'L': '101101010011', 'M': '110110101001', 'N': '101011010011',
  'O': '110101101001', 'P': '101101101001', 'Q': '101010110011', 'R': '110101011001',
  'S': '101101011001', 'T': '101011011001', 'U': '110010101011', 'V': '100110101011',
  'W': '110011010101', 'X': '100101101011', 'Y': '110010110101', 'Z': '100110110101',
  '-': '100101011011', '.': '110010101101', ' ': '100110101101', '*': '100101101101',
  '$': '100100100101', '/': '100100101001', '+': '100101001001', '%': '101001001001'
};

interface BarcodeSvgProps {
  code: string;
  height?: number;
  className?: string;
}

export function BarcodeSvg({
  code,
  height = 24,
  className = "w-full select-none",
}: BarcodeSvgProps) {
  const cleanCode = (code || "").trim().toUpperCase().replace(/[^0-9A-Z\-.\s\$/+*%]/g, "");
  const normalized = `*${cleanCode}*`;
  let bitString = "";
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    const bits = CODE39_MAP[char] || CODE39_MAP["*"];
    bitString += bits + "0";
  }

  const width = bitString.length * 1;

  return (
    <svg 
      width="100%" 
      height={height} 
      viewBox={`0 0 ${width} ${height}`} 
      className={className}
      shapeRendering="crispEdges"
    >
      {bitString.split("").map((bit, idx) => {
        if (bit === "1") {
          return (
            <rect 
              key={idx} 
              x={idx * 1} 
              y="0" 
              width="1" 
              height={height} 
              fill="currentColor" 
              shapeRendering="crispEdges"
            />
          );
        }
        return null;
      })}
    </svg>
  );
}

export default BarcodeSvg;
