import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import {
  Plus,
  FolderOpen,
  Play,
  Square,
  CheckCircle,
  AlertCircle,
  Trash2,
} from "lucide-react";
import type { Project } from "../types";

interface ProjectListProps {
  projects: Project[];
  selectedProject: string | null;
  onProjectSelect: (projectId: string) => void;
  onProjectAdd: (name: string, path: string) => void;
  onProjectStart: (projectId: string, command: string) => void;
  onProjectStop: (projectId: string) => void;
  onProjectDelete: (projectId: string) => void;
}

export default function ProjectList({
  projects,
  selectedProject,
  onProjectSelect,
  onProjectAdd,
  onProjectStart,
  onProjectStop,
  onProjectDelete,
}: ProjectListProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const handleAddProject = async () => {
    let path: string | null = null;

    if (typeof window !== "undefined" && window.electronAPI) {
      path = await window.electronAPI.selectDirectory();
    } else {
      // Fallback for browser - use a mock path
      path = `/mock/path/${newProjectName
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")}`;
    }

    if (path) {
      // Auto-generate name from folder if no name provided
      const finalName =
        newProjectName.trim() || path.split("/").pop() || "Unnamed Project";
      onProjectAdd(finalName, path);
      setNewProjectName("");
      setIsAdding(false);
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

  const getStatusColor = (status: Project["status"]) => {
    switch (status) {
      case "running":
        return "border-l-blue-500";
      case "working":
        return "border-l-yellow-500";
      case "completed":
        return "border-l-green-500";
      case "error":
        return "border-l-red-500";
      default:
        return "border-l-gray-300";
    }
  };

  return (
    <div className="w-80 min-w-80 max-w-80 glass-sidebar p-4 overflow-y-auto flex-shrink-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-200">Projects</h2>
        <Button
          size="sm"
          onClick={() => setIsAdding(true)}
          className="h-8 w-8 p-0 raycast-button"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {isAdding && (
        <Card className="mb-4">
          <CardContent className="p-3 space-y-2">
            <Input
              placeholder="Project name (optional - will use folder name)"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddProject()}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAddProject}
                className="raycast-button-primary"
              >
                <FolderOpen className="h-3 w-3 mr-1" />
                Select
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setIsAdding(false);
                  setNewProjectName("");
                }}
                className="raycast-button"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {projects.map((project) => (
          <Card
            key={project.id}
            className={`cursor-pointer project-card-raycast ${
              selectedProject === project.id && project.status === "ready"
                ? "rainbow-glow"
                : ""
            }`}
            onClick={() => onProjectSelect(project.id)}
          >
            <CardHeader className="p-3">
              <div className="flex items-center justify-between">
                <CardTitle
                  className={`text-sm font-medium ${
                    selectedProject === project.id
                      ? "text-white font-semibold"
                      : "text-gray-200"
                  }`}
                >
                  {project.name}
                </CardTitle>
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
                        onProjectStart(project.id, "");
                      }}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                  )}
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

      {projects.length === 0 && !isAdding && (
        <div className="text-center text-gray-400 mt-8">
          <p className="text-sm">No projects yet</p>
          <p className="text-xs mt-1">Click the + button to add one</p>
        </div>
      )}
    </div>
  );
}
