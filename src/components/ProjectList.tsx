import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  Plus,
  Play,
  Square,
  CheckCircle,
  AlertCircle,
  Trash2,
  Edit,
  Folder,
  Terminal,
  Globe,
  Zap,
  Code, Database, Server, Cpu, 
  Smartphone, Monitor, Tablet, Gamepad2,
  Palette, Brush, Image, Camera,
  ShoppingCart, CreditCard, DollarSign, TrendingUp,
  Users, MessageCircle, Mail, Phone,
  Book, GraduationCap, FileText, Bookmark,
  Music, Video,
  Home, Building, Factory, Store,
  Heart, Star, Gift, Coffee,
  Settings, Wrench, Hammer,
  Lock, Shield, Key, Eye,
  Rocket, Target, Flag, Award,
  PieChart
} from "lucide-react";
import type { Project } from "../types";

interface ProjectListProps {
  projects: Project[];
  selectedProject: string | null;
  onProjectSelect: (projectId: string) => void;
  onProjectStart: (projectId: string, command: string) => void;
  onProjectStop: (projectId: string) => void;
  onProjectDelete: (projectId: string) => void;
  onProjectEdit: (projectId: string) => void;
  onOpenModal: () => void;
  onOpenSettings: () => void;
}

export default function ProjectList({
  projects,
  selectedProject,
  onProjectSelect,
  onProjectStart,
  onProjectStop,
  onProjectDelete,
  onProjectEdit,
  onOpenModal,
  onOpenSettings,
}: ProjectListProps) {

  const getProjectIcon = (iconId?: string) => {
    switch (iconId) {
      case 'code': return Code;
      case 'terminal': return Terminal;
      case 'database': return Database;
      case 'server': return Server;
      case 'cpu': return Cpu;
      case 'globe': return Globe;
      case 'smartphone': return Smartphone;
      case 'monitor': return Monitor;
      case 'tablet': return Tablet;
      case 'palette': return Palette;
      case 'brush': return Brush;
      case 'image': return Image;
      case 'camera': return Camera;
      case 'music': return Music;
      case 'video': return Video;
      case 'shoppingcart': return ShoppingCart;
      case 'creditcard': return CreditCard;
      case 'dollarsign': return DollarSign;
      case 'trendingup': return TrendingUp;
      case 'piechart': return PieChart;
      case 'users': return Users;
      case 'messagecircle': return MessageCircle;
      case 'mail': return Mail;
      case 'phone': return Phone;
      case 'book': return Book;
      case 'graduationcap': return GraduationCap;
      case 'filetext': return FileText;
      case 'bookmark': return Bookmark;
      case 'home': return Home;
      case 'building': return Building;
      case 'factory': return Factory;
      case 'store': return Store;
      case 'settings': return Settings;
      case 'tool': return Settings;
      case 'wrench': return Wrench;
      case 'hammer': return Hammer;
      case 'lock': return Lock;
      case 'shield': return Shield;
      case 'key': return Key;
      case 'eye': return Eye;
      case 'rocket': return Rocket;
      case 'target': return Target;
      case 'flag': return Flag;
      case 'award': return Award;
      case 'gamepad2': return Gamepad2;
      case 'zap': return Zap;
      case 'heart': return Heart;
      case 'star': return Star;
      case 'gift': return Gift;
      case 'coffee': return Coffee;
      case 'folder':
      default:
        return Folder;
    }
  };

  const getStatusIcon = (status: Project["status"]) => {
    switch (status) {
      case "running":
        return (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-3 w-3 border border-blue-400 border-t-transparent"></div>
          </div>
        );
      case "working":
        return (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-3 w-3 border border-yellow-400 border-t-transparent"></div>
          </div>
        );
      case "ready":
        return (
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/50" />
        );
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <div className="h-2 w-2 rounded-full bg-gray-500" />;
    }
  };

  return (
    <div className="w-80 min-w-80 max-w-80 glass-sidebar p-4 overflow-y-auto flex-shrink-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-200">Projects</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={onOpenSettings}
            className="h-8 w-8 p-0 raycast-button"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            onClick={onOpenModal}
            className="h-8 w-8 p-0 raycast-button"
            title="Add Project"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>


      <div className="space-y-2">
        {projects.map((project) => (
          <Card
            key={project.id}
            className={`cursor-pointer project-card-raycast ${
              selectedProject === project.id
                ? "rainbow-glow"
                : ""
            }`}
            onClick={() => onProjectSelect(project.id)}
          >
            <CardHeader className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(() => {
                    const IconComponent = getProjectIcon(project.icon);
                    return (
                      <IconComponent 
                        className={`h-4 w-4 ${
                          selectedProject === project.id
                            ? "text-white"
                            : "text-gray-400"
                        }`}
                      />
                    );
                  })()}
                  <CardTitle
                    className={`text-sm font-medium ${
                      selectedProject === project.id
                        ? "text-white font-semibold"
                        : "text-gray-200"
                    }`}
                  >
                    {project.name}
                  </CardTitle>
                </div>
                {getStatusIcon(project.status)}
              </div>
              <p
                className={`text-xs truncate ${
                  selectedProject === project.id
                    ? "text-gray-300"
                    : "text-gray-500"
                }`}
              >
                {project.path}
              </p>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {project.lastActivity}
                </span>
                <div className="flex gap-1">
                  {["running", "working", "ready"].includes(project.status) ? (
                    <Button
                      size="sm"
                      className="h-6 px-2 text-xs raycast-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onProjectStop(project.id);
                      }}
                    >
                      <Square className="h-3 w-3" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="h-6 px-2 text-xs raycast-button-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        onProjectStart(project.id, project.runCommand || "");
                      }}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="h-6 px-2 text-xs raycast-button text-blue-300 hover:text-blue-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      onProjectEdit(project.id);
                    }}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 px-2 text-xs raycast-button text-red-300 hover:text-red-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      onProjectDelete(project.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="text-center text-gray-400 mt-8 glass-card p-8 rounded-xl">
          <p className="text-sm">No projects yet</p>
          <p className="text-xs mt-1">Click the + button to add one</p>
        </div>
      )}
    </div>
  );
}
