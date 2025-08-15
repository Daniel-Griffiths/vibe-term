import {
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
  Tag, Briefcase,
  Globe, Terminal, Folder,
  Factory, GraduationCap
} from "lucide-react";

export const ICON_OPTIONS = [
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
  
  // Business & Finance
  { id: 'shoppingcart', icon: ShoppingCart, label: 'E-commerce', category: 'Business' },
  { id: 'creditcard', icon: CreditCard, label: 'Payments', category: 'Business' },
  { id: 'dollarsign', icon: DollarSign, label: 'Finance', category: 'Business' },
  { id: 'trendingup', icon: TrendingUp, label: 'Growth', category: 'Business' },
  { id: 'trendingdown', icon: TrendingDown, label: 'Decline', category: 'Business' },
  { id: 'piechart', icon: PieChart, label: 'Analytics', category: 'Business' },
  { id: 'barchart', icon: BarChart, label: 'Charts', category: 'Business' },
  { id: 'activity', icon: Activity, label: 'Activity', category: 'Business' },
  { id: 'briefcase', icon: Briefcase, label: 'Business', category: 'Business' },
  { id: 'tag', icon: Tag, label: 'Tags', category: 'Business' },
  
  // Communication
  { id: 'users', icon: Users, label: 'Team', category: 'Social' },
  { id: 'messagecircle', icon: MessageCircle, label: 'Chat', category: 'Social' },
  { id: 'mail', icon: Mail, label: 'Email', category: 'Social' },
  { id: 'phone', icon: Phone, label: 'Phone', category: 'Social' },
  
  // Education & Knowledge
  { id: 'book', icon: Book, label: 'Documentation', category: 'Education' },
  { id: 'graduationcap', icon: GraduationCap, label: 'Learning', category: 'Education' },
  { id: 'filetext', icon: FileText, label: 'Notes', category: 'Education' },
  { id: 'bookmark', icon: Bookmark, label: 'Reference', category: 'Education' },
  { id: 'brain', icon: Brain, label: 'AI/ML', category: 'Education' },
  { id: 'lightbulb', icon: Lightbulb, label: 'Ideas', category: 'Education' },
  
  // Places & Buildings
  { id: 'home', icon: Home, label: 'Home', category: 'Places' },
  { id: 'building', icon: Building, label: 'Office', category: 'Places' },
  { id: 'factory', icon: Factory, label: 'Factory', category: 'Places' },
  { id: 'store', icon: Store, label: 'Shop', category: 'Places' },
  
  // Transportation
  { id: 'car', icon: Car, label: 'Car', category: 'Transport' },
  { id: 'plane', icon: Plane, label: 'Travel', category: 'Transport' },
  { id: 'bike', icon: Bike, label: 'Bike', category: 'Transport' },
  { id: 'truck', icon: Truck, label: 'Shipping', category: 'Transport' },
  { id: 'train', icon: Train, label: 'Train', category: 'Transport' },
  
  // Tools & Utilities
  { id: 'settings', icon: Settings, label: 'Settings', category: 'Tools' },
  { id: 'wrench', icon: Wrench, label: 'Tools', category: 'Tools' },
  { id: 'hammer', icon: Hammer, label: 'Build', category: 'Tools' },
  { id: 'calculator', icon: Calculator, label: 'Calculator', category: 'Tools' },
  { id: 'search', icon: Search, label: 'Search', category: 'Tools' },
  { id: 'filter', icon: Filter, label: 'Filter', category: 'Tools' },
  { id: 'list', icon: List, label: 'List', category: 'Tools' },
  { id: 'archive', icon: Archive, label: 'Archive', category: 'Tools' },
  
  // Nature & Weather
  { id: 'cloud', icon: Cloud, label: 'Cloud', category: 'Nature' },
  { id: 'sun', icon: Sun, label: 'Sun', category: 'Nature' },
  { id: 'moon', icon: Moon, label: 'Moon', category: 'Nature' },
  { id: 'mountain', icon: Mountain, label: 'Mountain', category: 'Nature' },
  { id: 'flower', icon: Flower, label: 'Flower', category: 'Nature' },
  
  // Security
  { id: 'lock', icon: Lock, label: 'Security', category: 'Security' },
  { id: 'shield', icon: Shield, label: 'Protection', category: 'Security' },
  { id: 'key', icon: Key, label: 'Keys', category: 'Security' },
  { id: 'eye', icon: Eye, label: 'Monitoring', category: 'Security' },
  
  // Achievement & Goals
  { id: 'rocket', icon: Rocket, label: 'Launch', category: 'Goals' },
  { id: 'target', icon: Target, label: 'Goals', category: 'Goals' },
  { id: 'flag', icon: Flag, label: 'Milestone', category: 'Goals' },
  { id: 'award', icon: Award, label: 'Achievement', category: 'Goals' },
  { id: 'trophy', icon: Trophy, label: 'Trophy', category: 'Goals' },
  { id: 'star', icon: Star, label: 'Favorite', category: 'Goals' },
  
  // Time & Scheduling
  { id: 'timer', icon: Timer, label: 'Timer', category: 'Time' },
  { id: 'clock', icon: Clock, label: 'Time', category: 'Time' },
  { id: 'calendar', icon: Calendar, label: 'Schedule', category: 'Time' },
  
  // Personal & Lifestyle
  { id: 'heart', icon: Heart, label: 'Health', category: 'Personal' },
  { id: 'gift', icon: Gift, label: 'Gift', category: 'Personal' },
  { id: 'coffee', icon: Coffee, label: 'Coffee', category: 'Personal' },
  
  // Tech & Innovation
  { id: 'sparkles', icon: Sparkles, label: 'Magic', category: 'Tech' },
  { id: 'flame', icon: Flame, label: 'Hot', category: 'Tech' },
  { id: 'battery', icon: Battery, label: 'Power', category: 'Tech' },
  
  // Navigation & Location
  { id: 'mappin', icon: MapPin, label: 'Location', category: 'Location' },
  { id: 'map', icon: Map, label: 'Map', category: 'Location' },
  { id: 'compass', icon: Compass, label: 'Compass', category: 'Location' },
  
  // General
  { id: 'folder', icon: Folder, label: 'Folder', category: 'General' },
];