import { Shield, Heart, GraduationCap, Bus, ShoppingBag, Moon } from 'lucide-react';

export const IntentChips = ({ activeFilter, onFilterChange, className }) => {
  const CHIPS = [
    { id: 'safety', label: 'Safety', icon: Shield, color: 'text-red-600', bg: 'bg-red-50' },
    { id: 'health', label: 'Health', icon: Heart, color: 'text-pink-600', bg: 'bg-pink-50' },
    { id: 'education', label: 'Education', icon: GraduationCap, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'transit', label: 'Transit', icon: Bus, color: 'text-amber-600', bg: 'bg-amber-50' },
    { id: 'living', label: 'Lifestyle', icon: ShoppingBag, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'faith', label: 'Faith', icon: Moon, color: 'text-violet-600', bg: 'bg-violet-50' },
  ];

  return (
    <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-[400] flex gap-2 overflow-x-auto max-w-[90%] p-2 bg-white/90 backdrop-blur-md rounded-full shadow-lg border border-gray-200 scrollbar-hide ${className}`}>
      {CHIPS.map((chip) => {
        const isActive = activeFilter === chip.id;
        return (
          <button
            key={chip.id}
            onClick={() => onFilterChange(isActive ? null : chip.id)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap
              ${isActive 
                ? 'bg-gray-900 text-white shadow-md transform scale-105' 
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-100'}
            `}
          >
            <chip.icon size={14} className={isActive ? 'text-white' : chip.color} />
            {chip.label}
          </button>
        );
      })}
    </div>
  );
};