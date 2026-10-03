import React, { useState, useRef, useEffect, ReactNode } from 'react';
import { ChevronDown, LucideIcon } from 'lucide-react';

export interface ActionDropdownItem {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon | ReactNode;
  iconBgClass?: string;       // e.g. 'bg-emerald-100 text-emerald-800' or 'bg-slate-100 text-slate-700'
  iconColorClass?: string;    // e.g. 'text-emerald-700' or 'text-slate-600'
  onClick: () => void;
  disabled?: boolean;
  dividerAbove?: boolean;     // puts a border-t border-slate-100 above this item
  variant?: 'default' | 'danger' | 'warning' | 'primary';
  badge?: string | number;
  badgeClass?: string;
  title?: string;
}

export interface SplitActionConfig {
  label: string;
  icon?: LucideIcon | ReactNode;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  variant?: 'emerald' | 'primary' | 'slate' | 'rose' | 'amber';
}

export interface ActionDropdownProps {
  /** If provided, renders as a split button: left is main action, right is caret toggle */
  splitAction?: SplitActionConfig;
  /** For single trigger button mode: the trigger label */
  triggerLabel?: string;
  /** For single trigger button mode: the trigger icon */
  triggerIcon?: LucideIcon | ReactNode;
  /** Trigger button styling variant for single trigger mode */
  triggerVariant?: 'emerald' | 'white' | 'outline' | 'slate' | 'ghost';
  /** Dropdown title / header inside the popover */
  header?: string;
  /** List of dropdown options */
  items: ActionDropdownItem[];
  /** Popover placement alignment (default: 'right') */
  align?: 'left' | 'right';
  /** Custom width for popover (default: 'w-72') */
  widthClass?: string;
  /** Additional container class */
  className?: string;
  /** Custom tooltip / title for trigger button */
  title?: string;
  /** Disable the entire dropdown */
  disabled?: boolean;
}

export const ActionDropdown: React.FC<ActionDropdownProps> = ({
  splitAction,
  triggerLabel,
  triggerIcon,
  triggerVariant = 'white',
  header,
  items,
  align = 'right',
  widthClass = 'w-72',
  className = '',
  title,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Helper to render an icon safely whether it's a Lucide component or JSX
  const renderIcon = (icon?: LucideIcon | ReactNode, defaultClassName = 'w-4 h-4') => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    const IconComp = icon as LucideIcon;
    return <IconComp className={defaultClassName} />;
  };

  // Variant styles for Split Action Main Button
  const getSplitMainStyles = (variant: SplitActionConfig['variant'] = 'emerald') => {
    switch (variant) {
      case 'primary':
      case 'emerald':
        return 'bg-emerald-600 hover:bg-emerald-700 text-white';
      case 'slate':
        return 'bg-slate-800 hover:bg-slate-900 text-white';
      case 'rose':
        return 'bg-rose-600 hover:bg-rose-700 text-white';
      case 'amber':
        return 'bg-amber-600 hover:bg-amber-700 text-white';
      default:
        return 'bg-emerald-600 hover:bg-emerald-700 text-white';
    }
  };

  // Variant styles for Split Action Toggle Button
  const getSplitToggleStyles = (variant: SplitActionConfig['variant'] = 'emerald') => {
    switch (variant) {
      case 'primary':
      case 'emerald':
        return 'bg-emerald-700 hover:bg-emerald-800 text-white border-l border-emerald-500/40';
      case 'slate':
        return 'bg-slate-900 hover:bg-slate-950 text-white border-l border-slate-700';
      case 'rose':
        return 'bg-rose-700 hover:bg-rose-800 text-white border-l border-rose-500/40';
      case 'amber':
        return 'bg-amber-700 hover:bg-amber-800 text-white border-l border-amber-500/40';
      default:
        return 'bg-emerald-700 hover:bg-emerald-800 text-white border-l border-emerald-500/40';
    }
  };

  // Variant styles for Single Trigger Button
  const getSingleTriggerStyles = (variant: ActionDropdownProps['triggerVariant'] = 'white') => {
    switch (variant) {
      case 'emerald':
        return 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs';
      case 'slate':
        return 'bg-slate-800 hover:bg-slate-900 text-white shadow-2xs';
      case 'outline':
        return 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs';
      case 'ghost':
        return 'bg-transparent hover:bg-slate-100 text-slate-700';
      case 'white':
      default:
        return 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs';
    }
  };

  return (
    <div className={`relative inline-flex ${className}`} ref={containerRef}>
      {splitAction ? (
        /* MODE 1: SPLIT BUTTON (Main Action Button + Caret Toggle) */
        <div className="relative inline-flex rounded-xl shadow-2xs">
          <button
            type="button"
            onClick={splitAction.onClick}
            disabled={disabled || splitAction.disabled}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-l-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${getSplitMainStyles(
              splitAction.variant
            )}`}
            title={splitAction.title || splitAction.label}
          >
            {renderIcon(splitAction.icon, 'w-4 h-4')}
            <span>{splitAction.label}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled}
            aria-expanded={isOpen}
            aria-haspopup="menu"
            className={`inline-flex items-center px-2.5 py-2 text-xs font-bold rounded-r-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${getSplitToggleStyles(
              splitAction.variant
            )}`}
            title={title || 'Pilihan opsi lainnya'}
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-150 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>
      ) : (
        /* MODE 2: SINGLE TRIGGER BUTTON */
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${getSingleTriggerStyles(
            triggerVariant
          )}`}
          title={title || triggerLabel}
        >
          {renderIcon(triggerIcon, 'w-4 h-4')}
          {triggerLabel && <span>{triggerLabel}</span>}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
      )}

      {/* DROPDOWN POPOVER MENU */}
      {isOpen && (
        <div
          role="menu"
          className={`absolute top-full mt-2 ${
            align === 'left' ? 'left-0' : 'right-0'
          } ${widthClass} bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden`}
        >
          {header && (
            <div className="px-3.5 py-2 text-[11px] font-semibold text-slate-500 border-b border-slate-100">
              {header}
            </div>
          )}

          <div className="py-1">
            {items.map(item => (
              <button
                key={item.id}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setIsOpen(false);
                  item.onClick();
                }}
                className={`w-full px-3.5 py-2.5 text-left text-xs font-medium flex items-center gap-3 transition-colors cursor-pointer ${
                  item.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : item.variant === 'danger'
                    ? 'text-rose-700 hover:bg-rose-50/70'
                    : 'text-slate-700 hover:bg-emerald-50/60'
                } ${item.dividerAbove ? 'border-t border-slate-100 mt-1 pt-2.5' : ''}`}
                title={item.title || item.label}
              >
                {/* Rounded Icon Box */}
                {item.icon && (
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      item.iconBgClass ||
                      (item.variant === 'danger'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-emerald-100 text-emerald-800')
                    }`}
                  >
                    {renderIcon(
                      item.icon,
                      `w-4 h-4 ${
                        item.iconColorClass ||
                        (item.variant === 'danger'
                          ? 'text-rose-600'
                          : 'text-emerald-700')
                      }`
                    )}
                  </div>
                )}

                {/* Text Content: Title & Helper Description */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      className={`font-bold leading-snug ${
                        item.variant === 'danger'
                          ? 'text-rose-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {item.label}
                    </div>
                    {item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md ${
                          item.badgeClass || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
                      {item.description}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
