import { useState, useEffect, useRef } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { ChevronDown } from "lucide-react";
import { ICON_OPTIONS } from "./shared-icons";
import type { UnifiedItem } from "../types";

interface IFormPanelProps {
  data?: {
    name: string;
    url: string;
    icon?: string;
  };
  onSubmit: (panelData: { name: string; url: string; icon?: string }) => void;
  onCancel: () => void;
}

export function FormPanel({ data, onSubmit, onCancel }: IFormPanelProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("globe");
  const [isIconDropdownOpen, setIsIconDropdownOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const iconDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data) {
      setName(data.name);
      setUrl(data.url);
      setSelectedIcon(data.icon || "globe");
      const iconOption = ICON_OPTIONS.find(opt => opt.id === (data.icon || 'globe'));
      setIconSearch(iconOption?.label || 'Globe');
    } else {
      setName("");
      setUrl("");
      setSelectedIcon("globe");
      setIconSearch("");
    }
  }, [data]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (iconDropdownRef.current && !iconDropdownRef.current.contains(event.target as Node)) {
        setIsIconDropdownOpen(false);
      }
    }

    if (isIconDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isIconDropdownOpen]);

  // Filter icons based on search
  const filteredIcons = ICON_OPTIONS.filter(icon =>
    icon.label.toLowerCase().includes(iconSearch.toLowerCase()) ||
    icon.category.toLowerCase().includes(iconSearch.toLowerCase())
  );

  const handleIconSelect = (iconId: string) => {
    setSelectedIcon(iconId);
    const selectedOption = ICON_OPTIONS.find(opt => opt.id === iconId);
    setIconSearch(selectedOption?.label || '');
    setIsIconDropdownOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    onSubmit({
      name: name.trim(),
      url: url.trim(),
      icon: selectedIcon || undefined,
    });
  };

  const selectedIconOption = ICON_OPTIONS.find(opt => opt.id === selectedIcon);
  const IconComponent = selectedIconOption?.icon;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Panel Name */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Panel Name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter panel name"
          required
          className="w-full"
        />
      </div>

      {/* Icon Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Icon
        </label>
        <div className="relative" ref={iconDropdownRef}>
          <div
            className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-600"
            onClick={() => setIsIconDropdownOpen(!isIconDropdownOpen)}
          >
            {IconComponent && <IconComponent className="h-4 w-4" />}
            <input
              type="text"
              value={iconSearch}
              onChange={(e) => {
                setIconSearch(e.target.value);
                setIsIconDropdownOpen(true);
              }}
              placeholder="Search icons..."
              className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 outline-none"
              onClick={(e) => {
                e.stopPropagation();
                setIsIconDropdownOpen(true);
              }}
            />
            <ChevronDown className={`h-4 w-4 transition-transform ${isIconDropdownOpen ? 'rotate-180' : ''}`} />
          </div>

          {isIconDropdownOpen && (
            <div className="absolute z-10 mt-1 w-full bg-gray-800 border border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredIcons.length > 0 ? (
                filteredIcons.map((icon) => {
                  const Icon = icon.icon;
                  return (
                    <button
                      key={icon.id}
                      type="button"
                      onClick={() => handleIconSelect(icon.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700 text-left"
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-200">{icon.label}</div>
                        <div className="text-xs text-gray-500">{icon.category}</div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500">No icons found</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Panel URL */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          URL
        </label>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
          className="w-full"
        />
        <p className="mt-1 text-xs text-gray-500">
          The URL to display in this panel
        </p>
      </div>

      {/* Form Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={!name.trim() || !url.trim()}
          className="flex-1"
        >
          {data ? 'Update' : 'Add'} Panel
        </Button>
      </div>
    </form>
  );
}