import {
  Zap,
  Cpu,
  Key,
  Eye,
  Code,
  Mail,
  Book,
  Home,
  Star,
  Gift,
  Lock,
  Flag,
  Plus,
  Play,
  Edit,
  Globe,
  Brush,
  Image,
  Users,
  Phone,
  Music,
  Video,
  Store,
  Heart,
  Award,
  Folder,
  Server,
  Tablet,
  Camera,
  Coffee,
  Wrench,
  Hammer,
  Shield,
  Rocket,
  Target,
  Square,
  Trash2,
  Monitor,
  Palette,
  Factory,
  Terminal,
  Database,
  Gamepad2,
  FileText,
  Bookmark,
  Building,
  Settings,
  PieChart,
  Smartphone,
  CreditCard,
  DollarSign,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  ShoppingCart,
  MessageCircle,
  GraduationCap,
  // Additional icons from the search
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Maximize2,
  ChevronDown,
  Bell,
  Copy,
  Check,
  AlertTriangle,
  X,
  Info,
  XCircle,
  ChevronUp,
  File,
  FolderOpen,
  ChevronRight,
  Save,
  RefreshCw,
  GitBranch,
  Minus,
  Undo2,
  GitCommit,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  // Additional icons from shared-icons
  Headphones,
  Car,
  Plane,
  Bike,
  Cloud,
  Sun,
  Moon,
  BarChart,
  Activity,
  TrendingDown,
  Bug,
  Package,
  Sparkles,
  Flame,
  Brain,
  Lightbulb,
  Calculator,
  Hash,
  Archive,
  Wifi,
  Timer,
  Clock,
  Calendar,
  Pause,
  Volume2,
  Mic,
  Type,
  Grid,
  Maximize,
  Search,
  Filter,
  List,
  MapPin,
  Map,
  Compass,
  Truck,
  Train,
  Battery,
  Mountain,
  Flower,
  Trophy,
  Tag,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

export type IconName =
  | "zap"
  | "cpu"
  | "key"
  | "eye"
  | "code"
  | "mail"
  | "book"
  | "home"
  | "tool"
  | "lock"
  | "flag"
  | "star"
  | "gift"
  | "plus"
  | "play"
  | "edit"
  | "globe"
  | "brush"
  | "image"
  | "users"
  | "phone"
  | "music"
  | "video"
  | "store"
  | "award"
  | "heart"
  | "folder"
  | "server"
  | "tablet"
  | "camera"
  | "wrench"
  | "hammer"
  | "shield"
  | "rocket"
  | "target"
  | "coffee"
  | "square"
  | "trash2"
  | "monitor"
  | "palette"
  | "factory"
  | "terminal"
  | "database"
  | "gamepad2"
  | "piechart"
  | "filetext"
  | "bookmark"
  | "building"
  | "settings"
  | "smartphone"
  | "creditcard"
  | "dollarsign"
  | "trendingup"
  | "checkcircle"
  | "alertcircle"
  | "shoppingcart"
  | "messagecircle"
  | "graduationcap"
  // Additional icons
  | "loader2"
  | "zoomin"
  | "zoomout"
  | "rotatecw"
  | "download"
  | "maximize2"
  | "chevrondown"
  | "bell"
  | "copy"
  | "check"
  | "alerttriangle"
  | "x"
  | "info"
  | "xcircle"
  | "chevronup"
  | "file"
  | "folderopen"
  | "chevronright"
  | "save"
  | "refreshcw"
  | "gitbranch"
  | "minus"
  | "undo2"
  | "gitcommit"
  | "rotateccw"
  | "arrowleft"
  | "arrowright"
  // Additional from shared-icons
  | "headphones"
  | "car"
  | "plane"
  | "bike"
  | "cloud"
  | "sun"
  | "moon"
  | "barchart"
  | "activity"
  | "trendingdown"
  | "bug"
  | "package"
  | "sparkles"
  | "flame"
  | "brain"
  | "lightbulb"
  | "calculator"
  | "hash"
  | "archive"
  | "wifi"
  | "timer"
  | "clock"
  | "calendar"
  | "pause"
  | "volume2"
  | "mic"
  | "type"
  | "grid"
  | "maximize"
  | "search"
  | "filter"
  | "list"
  | "mappin"
  | "map"
  | "compass"
  | "truck"
  | "train"
  | "battery"
  | "mountain"
  | "flower"
  | "trophy"
  | "tag"
  | "briefcase";

const iconMap: Record<IconName, LucideIcon> = {
  zap: Zap,
  cpu: Cpu,
  key: Key,
  eye: Eye,
  code: Code,
  mail: Mail,
  book: Book,
  home: Home,
  lock: Lock,
  flag: Flag,
  star: Star,
  gift: Gift,
  plus: Plus,
  play: Play,
  edit: Edit,
  globe: Globe,
  brush: Brush,
  image: Image,
  users: Users,
  phone: Phone,
  music: Music,
  video: Video,
  store: Store,
  award: Award,
  heart: Heart,
  folder: Folder,
  server: Server,
  tablet: Tablet,
  camera: Camera,
  wrench: Wrench,
  hammer: Hammer,
  shield: Shield,
  rocket: Rocket,
  target: Target,
  coffee: Coffee,
  square: Square,
  trash2: Trash2,
  monitor: Monitor,
  palette: Palette,
  factory: Factory,
  terminal: Terminal,
  database: Database,
  gamepad2: Gamepad2,
  piechart: PieChart,
  filetext: FileText,
  bookmark: Bookmark,
  building: Building,
  settings: Settings,
  smartphone: Smartphone,
  creditcard: CreditCard,
  dollarsign: DollarSign,
  trendingup: TrendingUp,
  checkcircle: CheckCircle,
  alertcircle: AlertCircle,
  shoppingcart: ShoppingCart,
  messagecircle: MessageCircle,
  graduationcap: GraduationCap,
  tool: Settings, // Alias for settings
  // Additional icons
  loader2: Loader2,
  zoomin: ZoomIn,
  zoomout: ZoomOut,
  rotatecw: RotateCw,
  download: Download,
  maximize2: Maximize2,
  chevrondown: ChevronDown,
  bell: Bell,
  copy: Copy,
  check: Check,
  alerttriangle: AlertTriangle,
  x: X,
  info: Info,
  xcircle: XCircle,
  chevronup: ChevronUp,
  file: File,
  folderopen: FolderOpen,
  chevronright: ChevronRight,
  save: Save,
  refreshcw: RefreshCw,
  gitbranch: GitBranch,
  minus: Minus,
  undo2: Undo2,
  gitcommit: GitCommit,
  rotateccw: RotateCcw,
  arrowleft: ArrowLeft,
  arrowright: ArrowRight,
  // Additional from shared-icons
  headphones: Headphones,
  car: Car,
  plane: Plane,
  bike: Bike,
  cloud: Cloud,
  sun: Sun,
  moon: Moon,
  barchart: BarChart,
  activity: Activity,
  trendingdown: TrendingDown,
  bug: Bug,
  package: Package,
  sparkles: Sparkles,
  flame: Flame,
  brain: Brain,
  lightbulb: Lightbulb,
  calculator: Calculator,
  hash: Hash,
  archive: Archive,
  wifi: Wifi,
  timer: Timer,
  clock: Clock,
  calendar: Calendar,
  pause: Pause,
  volume2: Volume2,
  mic: Mic,
  type: Type,
  grid: Grid,
  maximize: Maximize,
  search: Search,
  filter: Filter,
  list: List,
  mappin: MapPin,
  map: Map,
  compass: Compass,
  truck: Truck,
  train: Train,
  battery: Battery,
  mountain: Mountain,
  flower: Flower,
  trophy: Trophy,
  tag: Tag,
  briefcase: Briefcase,
};

interface IIconProps {
  name?: IconName | string;
  className?: string;
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}

export function Icon({ 
  name = "folder", 
  className = "", 
  size,
  onClick,
  title 
}: IIconProps) {
  const IconComponent = iconMap[name as IconName] || Folder;
  
  return (
    <IconComponent 
      className={className}
      size={size}
      onClick={onClick}
      {...(title && { 'aria-label': title })}
    />
  );
}