import { useEffect, useState, useCallback } from "react";
import { SharedEditor, getLanguageFromPath } from "./monaco-editor";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import {
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Save,
  X,
  RefreshCw,
  FileText,
  AlertCircle,
} from "lucide-react";
import { NonIdealState } from "./non-ideal-state";
import type { Project } from "../types";

interface FileEditorViewProps {
  selectedProject: Project | null;
}

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
  isExpanded?: boolean;
}

interface OpenFile {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
}

export default function FileEditorView({
  selectedProject,
}: FileEditorViewProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load file tree when project changes
  useEffect(() => {
    if (!selectedProject) {
      setFileTree([]);
      setOpenFiles([]);
      setActiveFile(null);
      return;
    }

    loadFileTree();
  }, [selectedProject]);

  const loadFileTree = async () => {
    if (!selectedProject) return;

    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI?.getProjectFiles(
        selectedProject.path
      );
      if (result?.success) {
        setFileTree(result.data || []);
      } else {
        setError(result?.error || "Failed to load project files");
      }
    } catch (err) {
      setError("Error loading file tree");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleDirectory = (path: string) => {
    const updateNode = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((node) => {
        if (node.path === path && node.isDirectory) {
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };

    setFileTree(updateNode(fileTree));
  };

  const openFile = async (filePath: string, fileName: string) => {
    // Check if file is already open
    const existingFile = openFiles.find((f) => f.path === filePath);
    if (existingFile) {
      setActiveFile(filePath);
      return;
    }

    if (!selectedProject) return;

    try {
      const result = await window.electronAPI?.readProjectFile(
        selectedProject.path,
        filePath
      );
      if (result?.success) {
        const content = result.data || "";
        const newFile: OpenFile = {
          path: filePath,
          name: fileName,
          content: content,
          originalContent: content,
          isDirty: false,
        };

        setOpenFiles((prev) => [...prev, newFile]);
        setActiveFile(filePath);
      } else {
        setError(result?.error || `Failed to open file: ${fileName}`);
      }
    } catch (err) {
      setError(`Error opening file: ${fileName}`);
      console.error(err);
    }
  };

  const closeFile = (filePath: string) => {
    setOpenFiles((prev) => prev.filter((f) => f.path !== filePath));

    // If this was the active file, switch to another or none
    if (activeFile === filePath) {
      const remainingFiles = openFiles.filter((f) => f.path !== filePath);
      setActiveFile(remainingFiles.length > 0 ? remainingFiles[0].path : null);
    }
  };

  const handleContentChange = (value: string | undefined, filePath: string) => {
    if (value === undefined) return;

    setOpenFiles((prev) =>
      prev.map((file) => {
        if (file.path === filePath) {
          return {
            ...file,
            content: value,
            isDirty: value !== file.originalContent,
          };
        }
        return file;
      })
    );
  };

  const saveFile = useCallback(
    async (filePath: string) => {
      const file = openFiles.find((f) => f.path === filePath);
      if (!file || !selectedProject) return;

      try {
        const result = await window.electronAPI?.saveFile(
          selectedProject.path,
          filePath,
          file.content
        );
        if (result?.success) {
          // Update the file as saved
          setOpenFiles((prev) =>
            prev.map((f) => {
              if (f.path === filePath) {
                return {
                  ...f,
                  originalContent: f.content,
                  isDirty: false,
                };
              }
              return f;
            })
          );
        } else {
          setError(result?.error || `Failed to save file: ${file.name}`);
        }
      } catch (err) {
        setError(`Error saving file: ${file.name}`);
        console.error(err);
      }
    },
    [openFiles, selectedProject]
  );

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+S or Cmd+S to save
      if ((event.ctrlKey || event.metaKey) && event.key === "s") {
        event.preventDefault();
        if (activeFile) {
          const currentFile = openFiles.find((f) => f.path === activeFile);
          if (currentFile?.isDirty) {
            saveFile(activeFile);
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeFile, openFiles, saveFile]);

  const renderFileTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node) => (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1 py-1 px-2 hover:bg-gray-800/50 cursor-pointer rounded text-sm`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
            if (node.isDirectory) {
              toggleDirectory(node.path);
            } else {
              openFile(node.path, node.name);
            }
          }}
        >
          {node.isDirectory ? (
            <>
              {node.isExpanded ? (
                <ChevronDown className="h-3 w-3 text-gray-500" />
              ) : (
                <ChevronRight className="h-3 w-3 text-gray-500" />
              )}
              {node.isExpanded ? (
                <FolderOpen className="h-4 w-4 text-blue-400" />
              ) : (
                <Folder className="h-4 w-4 text-blue-400" />
              )}
            </>
          ) : (
            <>
              <div className="w-3" /> {/* Spacer for alignment */}
              <File className="h-4 w-4 text-gray-400" />
            </>
          )}
          <span className="text-gray-300 truncate">{node.name}</span>
        </div>

        {node.isDirectory && node.isExpanded && node.children && (
          <div>{renderFileTree(node.children, depth + 1)}</div>
        )}
      </div>
    ));
  };

  const getLanguageFromPath = (path: string): string => {
    const ext = path.split(".").pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      json: "json",
      html: "html",
      css: "css",
      scss: "scss",
      md: "markdown",
      py: "python",
      rs: "rust",
      go: "go",
      java: "java",
      cpp: "cpp",
      c: "c",
      h: "c",
      hpp: "cpp",
      cs: "csharp",
      rb: "ruby",
      php: "php",
      swift: "swift",
      kt: "kotlin",
      yaml: "yaml",
      yml: "yaml",
      toml: "toml",
      xml: "xml",
      sh: "shell",
      bash: "shell",
    };
    return languageMap[ext || ""] || "plaintext";
  };

  if (!selectedProject) {
    return (
      <NonIdealState
        icon={FileText}
        title="No Project Selected"
        description="Select a project from the sidebar to browse and edit files"
      />
    );
  }

  if (error) {
    return (
      <NonIdealState
        icon={AlertCircle}
        title="Error Loading Files"
        description={error}
        variant="error"
        action={
          <Button onClick={loadFileTree} className="raycast-button-primary">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        }
      />
    );
  }

  const currentFile = activeFile
    ? openFiles.find((f) => f.path === activeFile)
    : null;

  return (
    <div className="h-full flex">
      {/* File Explorer Sidebar */}
      <div className="w-80 bg-gray-950 border-r border-t border-gray-800 overflow-y-auto rounded-tr-lg max-h-screen">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <FileText className="h-4 w-4" />
              <span>Explorer</span>
            </div>
            <Button
              size="sm"
              onClick={loadFileTree}
              disabled={loading}
              className="h-6 w-6 p-0 bg-gray-600 hover:bg-gray-700 text-white disabled:opacity-50"
              title="Refresh file tree"
            >
              <RefreshCw
                className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
          <div className="text-xs text-gray-500">{selectedProject.name}</div>
        </div>

        <div className="p-2">
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-6 w-6 text-gray-600 mx-auto mb-2 animate-spin" />
              <p className="text-sm text-gray-500">Loading files...</p>
            </div>
          ) : fileTree.length > 0 ? (
            renderFileTree(fileTree)
          ) : (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No files found</p>
            </div>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col">
        <Card className="flex-1 m-4 mt-0 flex flex-col glass-card overflow-hidden">
          <CardHeader className="flex-shrink-0 py-3 bg-gradient-to-r from-black to-gray-900 border-b border-gray-800 rounded-t-lg">
            <div className="flex items-center justify-between">
              {/* File Tabs in Header */}
              {openFiles.length > 0 ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-blue-400 flex-shrink-0" />
                  <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0">
                    {openFiles.map((file, index) => (
                      <div
                        key={file.path}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-sm cursor-pointer whitespace-nowrap ${
                          activeFile === file.path
                            ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                            : "hover:bg-gray-700/50 text-gray-400 hover:text-gray-300"
                        }`}
                        onClick={() => setActiveFile(file.path)}
                      >
                        <span className="truncate max-w-32">{file.name}</span>
                        {file.isDirty && (
                          <span className="text-yellow-400 text-xs">●</span>
                        )}
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            closeFile(file.path);
                          }}
                          className="h-3 w-3 p-0 bg-transparent hover:bg-red-600/20 text-gray-500 hover:text-red-400 rounded-sm"
                        >
                          <X className="h-2 w-2" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <CardTitle className="flex items-center gap-2 text-gray-200 font-semibold">
                  <FileText className="h-5 w-5 text-blue-400" />
                  No file selected
                </CardTitle>
              )}

              {currentFile && (
                <Button
                  size="sm"
                  onClick={() => saveFile(currentFile.path)}
                  disabled={!currentFile.isDirty}
                  variant="success"
                  className="h-7 px-3 ml-4 flex-shrink-0"
                >
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden">
            {currentFile ? (
              <SharedEditor
                value={currentFile.content}
                onChange={(value) =>
                  handleContentChange(value, currentFile.path)
                }
                language={getLanguageFromPath(currentFile.path)}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">
                    Select a file to start editing
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Choose a file from the explorer to open it in the editor
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
