// src/components/map/IntentChips.jsx
import { GraduationCap, HeartPulse, ShieldAlert, Bus, ShoppingBag, Moon, X } from 'lucide-react';
import { clsx } from 'clsx'; 

export const IntentChips = ({ activeFilter, onFilterChange, className }) => {
  
  const CHIPS = [
    { id: 'safety', label: 'Safety', icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
    { id: 'health', label: 'Health', icon: HeartPulse, color: 'text-pink-500', bg: 'bg-pink-50', border: 'border-pink-200' },
    { id: 'education', label: 'Education', icon: GraduationCap, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200' },
    { id: 'transit', label: 'Transit', icon: Bus, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200' },
    { id: 'living', label: 'Living', icon: ShoppingBag, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    { id: 'faith', label: 'Faith', icon: Moon, color: 'text-violet-500', bg: 'bg-violet-50', border: 'border-violet-200' },
  ];

  return (
    <div 
      className={clsx(
        "absolute left-0 right-0 z-[1000] flex justify-center items-end px-4 pointer-events-none transition-all duration-300",
        // If className provided, use it. Otherwise default to bottom-8.
        className || "bottom-8"
      )}
    >
      <div className="flex gap-2 p-2 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl pointer-events-auto overflow-x-auto max-w-full no-scrollbar border border-gray-100">
        {CHIPS.map((chip) => {
          const Icon = chip.icon;
          const isActive = activeFilter === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => onFilterChange(isActive ? null : chip.id)} 
              className={clsx(
                "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border shrink-0",
                isActive 
                  ? `${chip.bg} ${chip.color} ${chip.border} shadow-inner scale-95` 
                  : "bg-white text-gray-500 border-transparent hover:bg-gray-50"
              )}
            >
              <Icon size={16} />
              <span className="whitespace-nowrap">{chip.label}</span>
            </button>
          );
        })}
        {activeFilter && (
          <button onClick={() => onFilterChange(null)} className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 shrink-0"><X size={14} /></button>
        )}
      </div>
    </div>
  );
};