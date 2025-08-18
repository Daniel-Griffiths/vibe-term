import { useState, useEffect, useRef } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { ChevronDown } from "lucide-react";
import { ICON_OPTIONS } from "./shared-icons";
import { communicationAPI } from "../utils/communication";

interface IFormProjectProps {
  data?: {
    name: string;
    path: string;
    icon?: string;
    runCommand?: string;
    url?: string;
    yoloMode?: boolean;
    restrictedBranches?: string;
  };
  onSubmit: (projectData: {
    name: string;
    path: string;
    icon?: string;
    runCommand?: string;
    url?: string;
    yoloMode?: boolean;
    restrictedBranches?: string;
  }) => void;
  onCancel: () => void;
}

export function FormProject({
  data,
  onSubmit,
  onCancel,
}: IFormProjectProps) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("code");
  const [runCommand, setRunCommand] = useState("");
  const [url, setUrl] = useState("");
  const [yoloMode, setYoloMode] = useState(true);
  const [restrictedBranches, setRestrictedBranches] = useState("");
  const [iconSearch, setIconSearch] = useState("");
  const [isIconDropdownOpen, setIsIconDropdownOpen] = useState(false);
  const iconDropdownRef = useRef<HTMLDivElement>(null);

  // Populate form when editing
  useEffect(() => {
    if (data) {
      setName(data.name);
      setPath(data.path);
      setSelectedIcon(data.icon || "code");
      const iconOption = ICON_OPTIONS.find(
        (opt) => opt.id === (data.icon || "code")
      );
      setIconSearch(iconOption?.label || "Code");
      setRunCommand(data.runCommand || "");
      setUrl(data.url || "");
      setYoloMode(data.yoloMode ?? true);
      setRestrictedBranches(data.restrictedBranches || "");
    } else {
      // Reset for new project
      setName("");
      setPath("");
      setSelectedIcon("code");
      setRunCommand("");
      setUrl("");
      setYoloMode(true);
      setRestrictedBranches("");
      setIconSearch("");
      setIsIconDropdownOpen(false);
    }
  }, [data]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        iconDropdownRef.current &&
        !iconDropdownRef.current.contains(event.target as Node)
      ) {
        setIsIconDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter icons based on search
  const filteredIcons = ICON_OPTIONS.filter(
    (icon) =>
      icon.label.toLowerCase().includes(iconSearch.toLowerCase()) ||
      icon.category.toLowerCase().includes(iconSearch.toLowerCase())
  );

  const handleIconSelect = (iconId: string) => {
    setSelectedIcon(iconId);
    const selectedOption = ICON_OPTIONS.find((opt) => opt.id === iconId);
    setIconSearch(selectedOption?.label || "");
    setIsIconDropdownOpen(false);
  };

  const handleSelectDirectory = async () => {
    try {
      const result = await communicationAPI.selectDirectory();
      if (result?.success && result?.data?.path) {
        setPath(result.data.path);
        // Auto-populate name with folder name if name is empty
        if (!name.trim()) {
          const folderName = result.data.path.split("/").pop() || "";
          setName(folderName);
        }
      }
    } catch (error) {
      console.error("Failed to select directory:", error);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!path.trim()) return;

    const folderName = path.split("/").pop() || "";
    const projectName = name.trim() || folderName;

    onSubmit({
      name: projectName,
      path: path.trim(),
      icon: selectedIcon || undefined,
      runCommand: runCommand.trim() || undefined,
      url: url.trim() || undefined,
      yoloMode: yoloMode,
      restrictedBranches: restrictedBranches.trim() || undefined,
    });
  };


  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Project Path */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Project Path *
        </label>
        <div className="flex gap-2">
          <Input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/path/to/project"
            required
            className="flex-1"
            readOnly
          />
          <Button
            type="button"
            onClick={handleSelectDirectory}
            variant="outline"
            size="default"
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
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Auto-filled from folder name"
          className="w-full"
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
                const selectedOption = ICON_OPTIONS.find(
                  (opt) => opt.id === selectedIcon
                );
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
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform ${
                isIconDropdownOpen ? "rotate-180" : ""
              }`}
            />
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
                        <div className="text-sm text-gray-200">
                          {icon.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {icon.category}
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No icons found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Run Command */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Run Command (optional)
        </label>
        <Input
          value={runCommand}
          onChange={(e) => setRunCommand(e.target.value)}
          placeholder="npm run dev, python main.py, etc."
          className="w-full"
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
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="http://localhost:3000"
          className="w-full"
        />
      </div>

      {/* Restricted Branches */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Restricted Branches (optional)
        </label>
        <Input
          value={restrictedBranches}
          onChange={(e) => setRestrictedBranches(e.target.value)}
          placeholder="main, master, production"
          className="w-full"
        />
        <p className="text-xs text-gray-500 mt-1">
          Comma-separated list of branches where git push is disabled
        </p>
      </div>

      {/* Yolo Mode */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-gray-300">
            Yolo Mode (skip file permissions)
          </label>
          <p className="text-xs text-gray-500 mt-1">
            Uses --dangerously-skip-permissions flag for Claude Code
          </p>
        </div>
        <button
          type="button"
          onClick={() => setYoloMode(!yoloMode)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            yoloMode ? "bg-blue-600" : "bg-gray-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              yoloMode ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Form Actions */}
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={!path.trim()} className="flex-1">
          {data ? "Update" : "Add"} Project
        </Button>
      </div>
    </form>
  );
}
