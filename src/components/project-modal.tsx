import { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { 
  X, Folder, Terminal, Globe, Zap, ChevronDown,
  Code, Database, Server, Cpu, 
  Smartphone, Monitor, Tablet,
  Palette, Brush, Image, Camera,
  ShoppingCart, CreditCard, DollarSign, TrendingUp,
  Users, MessageCircle, Mail, Phone,
  Book, FileText, Bookmark,
  Music, Video, Headphones,
  Home, Building, Store,
  Car, Plane, Bike,
  Heart, Star, Gift, Coffee,
  Settings, Wrench, Hammer,
  Cloud, Sun, Moon,
  Lock, Shield, Key, Eye,
  Rocket, Target, Flag, Award,
  PieChart, BarChart, Activity, TrendingDown,
  // Basic additional icons
  Bug, Package,
  Sparkles, Flame,
  Brain, Lightbulb,
  Calculator, Hash,
  Archive, Wifi,
  Timer, Clock, Calendar,
  Play, Pause, Square,
  Volume2, Mic, 
  Edit, Type,
  Grid, Maximize,
  Search, Filter, List,
  MapPin, Map, Compass,
  Truck, Train, Battery,
  Mountain, Flower,
  Trophy,
  Tag, Briefcase
} from "lucide-react";

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

// Basic icon options using only commonly available Lucide React icons
const ICON_OPTIONS = [
  // Development
  { id: 'code', icon: Code, label: 'Code', category: 'Dev' },
  { id: 'terminal', icon: Terminal, label: 'Terminal', category: 'Dev' },
  { id: 'database', icon: Database, label: 'Database', category: 'Dev' },
  { id: 'server', icon: Server, label: 'Server', category: 'Dev' },
  { id: 'cpu', icon: Cpu, label: 'CPU', category: 'Dev' },
  { id: 'bug', icon: Bug, label: 'Bug Fix', category: 'Dev' },
  { id: 'package', icon: Package, label: 'Package', category: 'Dev' },
  { id: 'hash', icon: Hash, label: 'Hash', category: 'Dev' },
  
  // Web & Mobile
  { id: 'globe', icon: Globe, label: 'Web', category: 'Web' },
  { id: 'smartphone', icon: Smartphone, label: 'Mobile', category: 'Web' },
  { id: 'monitor', icon: Monitor, label: 'Desktop', category: 'Web' },
  { id: 'tablet', icon: Tablet, label: 'Tablet', category: 'Web' },
  { id: 'wifi', icon: Wifi, label: 'WiFi', category: 'Web' },
  
  // Design & Media
  { id: 'palette', icon: Palette, label: 'Design', category: 'Design' },
  { id: 'brush', icon: Brush, label: 'Art', category: 'Design' },
  { id: 'edit', icon: Edit, label: 'Edit', category: 'Design' },
  { id: 'type', icon: Type, label: 'Typography', category: 'Design' },
  { id: 'image', icon: Image, label: 'Images', category: 'Design' },
  { id: 'camera', icon: Camera, label: 'Photo', category: 'Design' },
  { id: 'grid', icon: Grid, label: 'Grid', category: 'Design' },
  { id: 'maximize', icon: Maximize, label: 'Fullscreen', category: 'Design' },
  
  // Audio & Video
  { id: 'music', icon: Music, label: 'Music', category: 'Media' },
  { id: 'video', icon: Video, label: 'Video', category: 'Media' },
  { id: 'headphones', icon: Headphones, label: 'Audio', category: 'Media' },
  { id: 'volume2', icon: Volume2, label: 'Volume', category: 'Media' },
  { id: 'mic', icon: Mic, label: 'Microphone', category: 'Media' },
  { id: 'play', icon: Play, label: 'Play', category: 'Media' },
  { id: 'pause', icon: Pause, label: 'Pause', category: 'Media' },
  { id: 'square', icon: Square, label: 'Stop', category: 'Media' },
  
  // Business & Commerce
  { id: 'shoppingcart', icon: ShoppingCart, label: 'E-commerce', category: 'Business' },
  { id: 'creditcard', icon: CreditCard, label: 'Payment', category: 'Business' },
  { id: 'dollarsign', icon: DollarSign, label: 'Finance', category: 'Business' },
  { id: 'trendingup', icon: TrendingUp, label: 'Analytics', category: 'Business' },
  { id: 'trendingdown', icon: TrendingDown, label: 'Decline', category: 'Business' },
  { id: 'piechart', icon: PieChart, label: 'Charts', category: 'Business' },
  { id: 'barchart', icon: BarChart, label: 'Bar Chart', category: 'Business' },
  { id: 'activity', icon: Activity, label: 'Activity', category: 'Business' },
  { id: 'briefcase', icon: Briefcase, label: 'Business', category: 'Business' },
  { id: 'tag', icon: Tag, label: 'Tags', category: 'Business' },
  
  // Communication & Social
  { id: 'users', icon: Users, label: 'Team', category: 'Social' },
  { id: 'messagecircle', icon: MessageCircle, label: 'Chat', category: 'Social' },
  { id: 'mail', icon: Mail, label: 'Email', category: 'Social' },
  { id: 'phone', icon: Phone, label: 'Phone', category: 'Social' },
  
  // Files & Storage
  { id: 'folder', icon: Folder, label: 'Folder', category: 'Files' },
  { id: 'filetext', icon: FileText, label: 'Text File', category: 'Files' },
  { id: 'archive', icon: Archive, label: 'Archive', category: 'Files' },
  
  // Education & Science
  { id: 'book', icon: Book, label: 'Book', category: 'Education' },
  { id: 'bookmark', icon: Bookmark, label: 'Reference', category: 'Education' },
  { id: 'calculator', icon: Calculator, label: 'Math', category: 'Education' },
  
  // Places & Transportation
  { id: 'home', icon: Home, label: 'Home', category: 'Places' },
  { id: 'building', icon: Building, label: 'Office', category: 'Places' },
  { id: 'store', icon: Store, label: 'Store', category: 'Places' },
  { id: 'car', icon: Car, label: 'Car', category: 'Transport' },
  { id: 'plane', icon: Plane, label: 'Airplane', category: 'Transport' },
  { id: 'bike', icon: Bike, label: 'Bicycle', category: 'Transport' },
  { id: 'truck', icon: Truck, label: 'Truck', category: 'Transport' },
  { id: 'train', icon: Train, label: 'Train', category: 'Transport' },
  
  // Tools & Utilities
  { id: 'settings', icon: Settings, label: 'Settings', category: 'Tools' },
  { id: 'wrench', icon: Wrench, label: 'Fix', category: 'Tools' },
  { id: 'hammer', icon: Hammer, label: 'Build', category: 'Tools' },
  { id: 'search', icon: Search, label: 'Search', category: 'Tools' },
  { id: 'filter', icon: Filter, label: 'Filter', category: 'Tools' },
  { id: 'list', icon: List, label: 'List', category: 'Tools' },
  
  // Time & Calendar
  { id: 'timer', icon: Timer, label: 'Timer', category: 'Time' },
  { id: 'clock', icon: Clock, label: 'Clock', category: 'Time' },
  { id: 'calendar', icon: Calendar, label: 'Calendar', category: 'Time' },
  
  // Navigation & Maps
  { id: 'mappin', icon: MapPin, label: 'Location', category: 'Navigation' },
  { id: 'map', icon: Map, label: 'Map', category: 'Navigation' },
  { id: 'compass', icon: Compass, label: 'Compass', category: 'Navigation' },
  
  // Nature & Weather
  { id: 'mountain', icon: Mountain, label: 'Mountain', category: 'Nature' },
  { id: 'flower', icon: Flower, label: 'Flower', category: 'Nature' },
  { id: 'sun', icon: Sun, label: 'Sun', category: 'Weather' },
  { id: 'moon', icon: Moon, label: 'Moon', category: 'Weather' },
  { id: 'cloud', icon: Cloud, label: 'Cloud', category: 'Weather' },
  
  // Security & Privacy
  { id: 'lock', icon: Lock, label: 'Secure', category: 'Security' },
  { id: 'shield', icon: Shield, label: 'Protected', category: 'Security' },
  { id: 'key', icon: Key, label: 'Key', category: 'Security' },
  { id: 'eye', icon: Eye, label: 'Monitor', category: 'Security' },
  
  // Gaming & Entertainment
  { id: 'trophy', icon: Trophy, label: 'Trophy', category: 'Gaming' },
  
  // Goals & Achievements
  { id: 'rocket', icon: Rocket, label: 'Launch', category: 'Goals' },
  { id: 'target', icon: Target, label: 'Target', category: 'Goals' },
  { id: 'flag', icon: Flag, label: 'Goal', category: 'Goals' },
  { id: 'award', icon: Award, label: 'Achievement', category: 'Goals' },
  
  // Energy & Power
  { id: 'zap', icon: Zap, label: 'Lightning', category: 'Energy' },
  { id: 'flame', icon: Flame, label: 'Fire', category: 'Energy' },
  { id: 'battery', icon: Battery, label: 'Battery', category: 'Energy' },
  { id: 'sparkles', icon: Sparkles, label: 'Magic', category: 'Energy' },
  
  // Ideas & Creativity
  { id: 'brain', icon: Brain, label: 'Brain', category: 'Ideas' },
  { id: 'lightbulb', icon: Lightbulb, label: 'Idea', category: 'Ideas' },
  
  // General & Misc
  { id: 'heart', icon: Heart, label: 'Favorite', category: 'General' },
  { id: 'star', icon: Star, label: 'Important', category: 'General' },
  { id: 'gift', icon: Gift, label: 'Special', category: 'General' },
  { id: 'coffee', icon: Coffee, label: 'Coffee', category: 'General' },
];

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