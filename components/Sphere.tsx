import React from 'react';

interface SphereProps {
  colorClass: string;
  className?: string; // Allow passing width/height via className
  isGhost?: boolean;
  isLocked?: boolean;
}

export const Sphere: React.FC<SphereProps> = ({ colorClass, className = "w-8 h-8", isGhost = false, isLocked = false }) => {
  return (
    <div className={`${className} flex items-center justify-center`}>
        {/* The Energy Node */}
        <div
            className={`
                w-[85%] h-[85%] rounded-full relative
                transition-all duration-300
                ${isGhost ? 'opacity-30 blur-[1px]' : 'opacity-100'} 
                ${isLocked ? 'brightness-50 saturate-50' : ''}
                ${colorClass}
                border-2
            `}
        >
            {/* Inner Core Glow (The nuclear center) */}
            {!isGhost && !isLocked && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] bg-white rounded-full shadow-[0_0_10px_white] opacity-90"></div>
            )}
            
            {/* Locked Indicator (Bolt) */}
            {isLocked && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] bg-black/50 rounded-full border border-white/20"></div>
            )}
            
            {/* Tech Scanlines / Grid Detail inside the orb (Optional detail for closeups) */}
            <div className="absolute inset-0 rounded-full bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjMDAwIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-50"></div>
        </div>
    </div>
  );
};
