import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
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
  Code,
  Database,
  Server,
  Cpu,
  Smartphone,
  Monitor,
  Tablet,
  Gamepad2,
  Palette,
  Brush,
  Image,
  Camera,
  ShoppingCart,
  CreditCard,
  DollarSign,
  TrendingUp,
  Users,
  MessageCircle,
  Mail,
  Phone,
  Book,
  GraduationCap,
  FileText,
  Bookmark,
  Music,
  Video,
  Home,
  Building,
  Factory,
  Store,
  Heart,
  Star,
  Gift,
  Coffee,
  Settings,
  Wrench,
  Hammer,
  Lock,
  Shield,
  Key,
  Eye,
  Rocket,
  Target,
  Flag,
  Award,
  PieChart,
} from "lucide-react";
import { NonIdealState } from "./non-ideal-state";
import type { Project, Panel } from "../types";

interface IProjectListProps {
  projects: Project[];
  selectedProject: string | null;
  panels: Panel[];
  selectedPanel: string | null;
  onProjectSelect: (projectId: string) => void;
  onProjectStart: (projectId: string, command: string) => void;
  onProjectStop: (projectId: string) => void;
  onProjectDelete: (projectId: string) => void;
  onProjectEdit: (projectId: string) => void;
  onProjectReorder: (startIndex: number, endIndex: number) => void;
  onPanelReorder: (startIndex: number, endIndex: number) => void;
  onOpenModal: () => void;
  onOpenSettings: () => void;
  onPanelSelect: (panelId: string) => void;
  onPanelAdd: () => void;
  onPanelEdit: (panelId: string) => void;
  onPanelDelete: (panelId: string) => void;
}

interface ISortableProjectCardProps {
  project: Project;
  selectedProject: string | null;
  onProjectSelect: (projectId: string) => void;
  onProjectStart: (projectId: string, command: string) => void;
  onProjectStop: (projectId: string) => void;
  onProjectDelete: (projectId: string) => void;
  onProjectEdit: (projectId: string) => void;
  getProjectIcon: (iconId?: string) => any;
  getStatusIcon: (status: Project["status"]) => JSX.Element;
}

function SortableProjectCard({
  project,
  selectedProject,
  onProjectSelect,
  onProjectStart,
  onProjectStop,
  onProjectDelete,
  onProjectEdit,
  getProjectIcon,
  getStatusIcon,
}: ISortableProjectCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: project.id });

  const style = {
    transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={`cursor-pointer project-card-raycast ${
          selectedProject === project.id ? "rainbow-glow" : ""
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
                {...attributes}
                {...listeners}
                className={`text-sm font-medium cursor-grab active:cursor-grabbing touch-none ${
                  selectedProject === project.id
                    ? "text-white font-semibold"
                    : "text-gray-200"
                }`}
                title="Drag to reorder"
              >
                {project.name}
              </CardTitle>
            </div>
            {getStatusIcon(project.status)}
          </div>
          <p
            className={`text-xs truncate ${
              selectedProject === project.id ? "text-gray-300" : "text-gray-500"
            }`}
          >
            {project.path}
          </p>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="flex items-center justify-end">
            <div className="flex gap-1">
              {["running", "working", "ready"].includes(project.status) ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
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
                  variant="primary"
                  className="h-6 px-2 text-xs"
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
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onProjectEdit(project.id);
                }}
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
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
    </div>
  );
}

interface ISortablePanelCardProps {
  panel: Panel;
  selectedPanel: string | null;
  onPanelSelect: (panelId: string) => void;
  onPanelEdit: (panelId: string) => void;
  onPanelDelete: (panelId: string) => void;
  getProjectIcon: (iconId?: string) => any;
}

function SortablePanelCard({
  panel,
  selectedPanel,
  onPanelSelect,
  onPanelEdit,
  onPanelDelete,
  getProjectIcon,
}: ISortablePanelCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: panel.id });

  const style = {
    transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className={`cursor-pointer project-card-raycast ${
          selectedPanel === panel.id ? "rainbow-glow" : ""
        }`}
        onClick={() => onPanelSelect(panel.id)}
      >
        <CardHeader className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {(() => {
                const IconComponent = getProjectIcon(panel.icon);
                return (
                  <IconComponent
                    className={`h-4 w-4 ${
                      selectedPanel === panel.id
                        ? "text-white"
                        : "text-gray-400"
                    }`}
                  />
                );
              })()}
              <CardTitle
                {...attributes}
                {...listeners}
                className={`text-sm font-medium cursor-grab active:cursor-grabbing touch-none ${
                  selectedPanel === panel.id
                    ? "text-white font-semibold"
                    : "text-gray-200"
                }`}
                title="Drag to reorder"
              >
                {panel.name}
              </CardTitle>
            </div>
            <Globe className="h-4 w-4 text-gray-400" />
          </div>
          <p
            className={`text-xs truncate ${
              selectedPanel === panel.id ? "text-gray-300" : "text-gray-500"
            }`}
          >
            {panel.url}
          </p>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="flex items-center justify-end">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onPanelEdit(panel.id);
                }}
                className="h-6 px-2 text-xs"
                title="Edit panel"
              >
                <Edit className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onPanelDelete(panel.id);
                }}
                className="h-6 px-2 text-xs"
                title="Delete panel"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProjectList({
  projects,
  selectedProject,
  panels,
  selectedPanel,
  onProjectSelect,
  onProjectStart,
  onProjectStop,
  onProjectDelete,
  onProjectEdit,
  onProjectReorder,
  onPanelReorder,
  onOpenModal,
  onOpenSettings,
  onPanelSelect,
  onPanelAdd,
  onPanelEdit,
  onPanelDelete,
}: IProjectListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleProjectDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = projects.findIndex((p) => p.id === active.id);
      const newIndex = projects.findIndex((p) => p.id === over.id);
      onProjectReorder(oldIndex, newIndex);
    }
  };

  const handlePanelDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = panels.findIndex((p) => p.id === active.id);
      const newIndex = panels.findIndex((p) => p.id === over.id);
      onPanelReorder(oldIndex, newIndex);
    }
  };
  const getProjectIcon = (iconId?: string) => {
    switch (iconId) {
      case "code":
        return Code;
      case "terminal":
        return Terminal;
      case "database":
        return Database;
      case "server":
        return Server;
      case "cpu":
        return Cpu;
      case "globe":
        return Globe;
      case "smartphone":
        return Smartphone;
      case "monitor":
        return Monitor;
      case "tablet":
        return Tablet;
      case "palette":
        return Palette;
      case "brush":
        return Brush;
      case "image":
        return Image;
      case "camera":
        return Camera;
      case "music":
        return Music;
      case "video":
        return Video;
      case "shoppingcart":
        return ShoppingCart;
      case "creditcard":
        return CreditCard;
      case "dollarsign":
        return DollarSign;
      case "trendingup":
        return TrendingUp;
      case "piechart":
        return PieChart;
      case "users":
        return Users;
      case "messagecircle":
        return MessageCircle;
      case "mail":
        return Mail;
      case "phone":
        return Phone;
      case "book":
        return Book;
      case "graduationcap":
        return GraduationCap;
      case "filetext":
        return FileText;
      case "bookmark":
        return Bookmark;
      case "home":
        return Home;
      case "building":
        return Building;
      case "factory":
        return Factory;
      case "store":
        return Store;
      case "settings":
        return Settings;
      case "tool":
        return Settings;
      case "wrench":
        return Wrench;
      case "hammer":
        return Hammer;
      case "lock":
        return Lock;
      case "shield":
        return Shield;
      case "key":
        return Key;
      case "eye":
        return Eye;
      case "rocket":
        return Rocket;
      case "target":
        return Target;
      case "flag":
        return Flag;
      case "award":
        return Award;
      case "gamepad2":
        return Gamepad2;
      case "zap":
        return Zap;
      case "heart":
        return Heart;
      case "star":
        return Star;
      case "gift":
        return Gift;
      case "coffee":
        return Coffee;
      case "folder":
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
      default:
        return <div className="h-2 w-2 rounded-full bg-gray-500" />;
    }
  };

  return (
    <div className="w-80 min-w-64 max-w-80 lg:w-80 md:w-72 sm:w-64 h-full glass-sidebar p-4 flex-shrink-0 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-200">Projects</h2>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={onOpenSettings}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={onOpenModal}
            title="Add Project"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleProjectDragEnd}
      >
        <SortableContext
          items={projects.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {projects.map((project) => (
              <SortableProjectCard
                key={project.id}
                project={project}
                selectedProject={selectedProject}
                onProjectSelect={onProjectSelect}
                onProjectStart={onProjectStart}
                onProjectStop={onProjectStop}
                onProjectDelete={onProjectDelete}
                onProjectEdit={onProjectEdit}
                getProjectIcon={getProjectIcon}
                getStatusIcon={getStatusIcon}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {projects.length === 0 && (
        <NonIdealState
          icon={Folder}
          title="No Projects Found"
          description="Add your first project to get started"
          action={
            <Button onClick={onOpenModal} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Project
            </Button>
          }
        />
      )}

      {/* Separator */}
      <div className="border-t border-gray-800 my-6"></div>

      {/* Panels Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-200">Panels</h2>
          <Button
            size="icon"
            variant="outline"
            onClick={onPanelAdd}
            title="Add Panel"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 min-h-0">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handlePanelDragEnd}
          >
            <SortableContext
              items={(panels || []).map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {(panels || []).map((panel) => (
                  <SortablePanelCard
                    key={panel.id}
                    panel={panel}
                    selectedPanel={selectedPanel}
                    onPanelSelect={onPanelSelect}
                    onPanelEdit={onPanelEdit}
                    onPanelDelete={onPanelDelete}
                    getProjectIcon={getProjectIcon}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {(panels || []).length === 0 && (
            <NonIdealState
              icon={Globe}
              title="No Panels"
              description="Add panels to quickly access your favorite tools and dashboards."
              action={
                <Button onClick={onPanelAdd} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Panel
                </Button>
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
