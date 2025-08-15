import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { X, ChevronDown } from "lucide-react";
import { ICON_OPTIONS } from "./shared-icons";
import type { Panel } from "../types";

interface PanelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (panelData: { name: string; url: string; icon?: string }) => void;
  editingPanel?: Panel | null;
}

export default function PanelModal({
  isOpen,
  onClose,
  onSubmit,
  editingPanel,
}: PanelModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("globe");
  const [isIconDropdownOpen, setIsIconDropdownOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState("");
  const iconDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingPanel) {
      setName(editingPanel.name);
      setUrl(editingPanel.url);
      setSelectedIcon(editingPanel.icon || "globe");
    } else {
      setName("");
      setUrl("");
      setSelectedIcon("globe");
    }
  }, [editingPanel, isOpen]);

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
  const filteredIcons = ICON_OPTIONS.filter(option =>
    option.label.toLowerCase().includes(iconSearch.toLowerCase()) ||
    option.category.toLowerCase().includes(iconSearch.toLowerCase())
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;

    onSubmit({
      name: name.trim(),
      url: url.trim(),
      icon: selectedIcon,
    });

    // Reset form
    setName("");
    setUrl("");
    setSelectedIcon("globe");
  };

  const handleClose = () => {
    setName("");
    setUrl("");
    setSelectedIcon("globe");
    setIsIconDropdownOpen(false);
    setIconSearch("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative glass-card rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-200">
            {editingPanel ? "Edit Panel" : "Add Panel"}
          </h2>
          <Button
            size="sm"
            onClick={handleClose}
            className="h-6 w-6 p-0 bg-transparent hover:bg-gray-800 text-gray-400 hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Panel Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Panel Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., GitHub Dashboard"
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600"
              required
            />
          </div>

          {/* Panel URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com"
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the full URL including https://
            </p>
          </div>

          {/* Icon Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Icon (optional)
            </label>
            <div className="relative" ref={iconDropdownRef}>
              <div 
                className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 cursor-pointer flex items-center justify-between"
                onClick={() => setIsIconDropdownOpen(!isIconDropdownOpen)}
              >
                <div className="flex items-center gap-2">
                  {(() => {
                    const selectedOption = ICON_OPTIONS.find(opt => opt.id === selectedIcon);
                    if (selectedOption) {
                      const IconComponent = selectedOption.icon;
                      return (
                        <>
                          <IconComponent className="h-4 w-4" />
                          <span>{selectedOption.label}</span>
                        </>
                      );
                    }
                    return <span className="text-gray-500">Select an icon</span>;
                  })()}
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isIconDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
              
              {isIconDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg z-50 max-h-80 overflow-hidden">
                  {/* Search Input */}
                  <div className="p-2 border-b border-gray-700">
                    <input
                      type="text"
                      placeholder="Search icons..."
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-500"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  
                  {/* Icon Options */}
                  <div className="max-h-60 overflow-y-auto">
                    {filteredIcons.length > 0 ? (
                      <div className="grid grid-cols-1 gap-1 p-1">
                        {filteredIcons.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              setSelectedIcon(option.id);
                              setIsIconDropdownOpen(false);
                              setIconSearch("");
                            }}
                            className={`flex items-center gap-3 px-3 py-2 text-sm rounded hover:bg-gray-700 transition-colors ${
                              selectedIcon === option.id ? "bg-blue-600 text-white" : "text-gray-200"
                            }`}
                          >
                            <option.icon className="h-4 w-4 flex-shrink-0" />
                            <span className="flex-1 text-left">{option.label}</span>
                            <span className="text-xs text-gray-400">{option.category}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-gray-400 text-sm">
                        No icons found
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={!name.trim() || !url.trim()}
            >
              {editingPanel ? "Update Panel" : "Add Panel"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}