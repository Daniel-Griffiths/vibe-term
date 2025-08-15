import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { X, ChevronDown } from "lucide-react";
import { ICON_OPTIONS } from "./shared-icons";

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (projectData: {
    name: string;
    path: string;
    icon?: string;
    runCommand?: string;
    previewUrl?: string;
    yoloMode?: boolean;
    restrictedBranches?: string;
  }) => void;
  editingProject?: {
    id: string;
    name: string;
    path: string;
    icon?: string;
    runCommand?: string;
    previewUrl?: string;
    yoloMode?: boolean;
    restrictedBranches?: string;
  } | null;
}


export default function ProjectModal({ isOpen, onClose, onSubmit, editingProject }: ProjectModalProps) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [selectedIcon, setSelectedIcon] = useState('code'); // Default to code icon
  const [runCommand, setRunCommand] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [yoloMode, setYoloMode] = useState(true);
  const [restrictedBranches, setRestrictedBranches] = useState("");
  const [iconSearch, setIconSearch] = useState("");
  const [isIconDropdownOpen, setIsIconDropdownOpen] = useState(false);
  const iconDropdownRef = useRef<HTMLDivElement>(null);

  // Populate form when editing
  useEffect(() => {
    if (editingProject && isOpen) {
      setName(editingProject.name);
      setPath(editingProject.path);
      setSelectedIcon(editingProject.icon || 'code');
      const iconOption = ICON_OPTIONS.find(opt => opt.id === (editingProject.icon || 'code'));
      setIconSearch(iconOption?.label || 'Code');
      setRunCommand(editingProject.runCommand || '');
      setPreviewUrl(editingProject.previewUrl || '');
      setYoloMode(editingProject.yoloMode || false);
      setRestrictedBranches(editingProject.restrictedBranches || '');
    } else if (isOpen && !editingProject) {
      // Reset for new project
      setName("");
      setPath("");
      setSelectedIcon('code');
      setRunCommand("");
      setPreviewUrl("");
      setYoloMode(true);
      setRestrictedBranches("");
      setIconSearch("");
      setIsIconDropdownOpen(false);
    }
  }, [editingProject, isOpen]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (iconDropdownRef.current && !iconDropdownRef.current.contains(event.target as Node)) {
        setIsIconDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    if (!path.trim()) return;

    const folderName = path.split('/').pop() || '';
    const projectName = name.trim() || folderName;

    onSubmit({
      name: projectName,
      path: path.trim(),
      icon: selectedIcon,
      runCommand: runCommand.trim() || undefined,
      previewUrl: previewUrl.trim() || undefined,
      yoloMode,
      restrictedBranches: restrictedBranches.trim() || undefined,
    });

    // Reset form
    setName("");
    setPath("");
    setSelectedIcon('code');
    setRunCommand("");
    setPreviewUrl("");
    setRestrictedBranches("");
    setIconSearch("");
  };

  const handleSelectDirectory = async () => {
    const selectedPath = await window.electronAPI?.selectDirectory();
    if (selectedPath) {
      setPath(selectedPath);
      // Auto-populate name with folder name if name is empty
      if (!name.trim()) {
        const folderName = selectedPath.split('/').pop() || '';
        setName(folderName);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative glass-card rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-200">
            {editingProject ? 'Edit Project' : 'Create New Project'}
          </h2>
          <Button
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 bg-transparent hover:bg-gray-800 text-gray-400 hover:text-gray-200"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Path */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Project Path *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/path/to/project"
                className="flex-1 px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600"
                required
              />
              <Button
                type="button"
                onClick={handleSelectDirectory}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200"
              >
                Browse
              </Button>
            </div>
          </div>

          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Project Name (optional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Auto-filled from folder name"
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600"
            />
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
                  <div className="max-h-64 overflow-y-auto">
                    {filteredIcons.map((option) => {
                      const IconComponent = option.icon;
                      return (
                        <div
                          key={option.id}
                          className="px-3 py-2 hover:bg-gray-700 cursor-pointer flex items-center gap-2 text-gray-200"
                          onClick={() => handleIconSelect(option.id)}
                        >
                          <IconComponent className="h-4 w-4" />
                          <span>{option.label}</span>
                        </div>
                      );
                    })}
                    {filteredIcons.length === 0 && (
                      <div className="px-3 py-2 text-gray-400 text-sm">No icons found</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Run Command */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Run Command (optional)
            </label>
            <input
              type="text"
              value={runCommand}
              onChange={(e) => setRunCommand(e.target.value)}
              placeholder="npm run dev, python main.py, etc."
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">
              This command will run in the background when the project starts
            </p>
          </div>


          {/* Preview URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Preview URL (optional)
            </label>
            <input
              type="url"
              value={previewUrl}
              onChange={(e) => setPreviewUrl(e.target.value)}
              placeholder="http://localhost:3000"
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600"
            />
          </div>

          {/* Restricted Branches */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Restricted Branches (optional)
            </label>
            <input
              type="text"
              value={restrictedBranches}
              onChange={(e) => setRestrictedBranches(e.target.value)}
              placeholder="main, master, production"
              className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated list of branches where git push is disabled
            </p>
          </div>

          {/* Yolo Mode Toggle */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={yoloMode}
                onChange={(e) => setYoloMode(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
              />
              Yolo Mode (skip file permissions)
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Uses --dangerously-skip-permissions flag for Claude Code
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
            >
              {editingProject ? 'Update Project' : 'Create Project'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}