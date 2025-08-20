import { useEffect, useState, useCallback, useMemo } from "react";
import { CodeEditor, getLanguageFromPath } from "./code-editor";
import { CodeEditorImageViewer } from "./code-editor-image-viewer";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { api } from "../utils/api";
import { Button } from "./button";
import { Icon } from "./icon";
import { NonIdealState } from "./non-ideal-state";
import { ContextMenu, ContextMenuItem } from "./context-menu";
import { Modal } from "./modal";
import type { UnifiedItem } from "../types";

// Utility function to check if a file is an image
const isImageFile = (path: string): boolean => {
  const ext = path.split(".").pop()?.toLowerCase();
  const imageExtensions = [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "svg",
    "webp",
    "ico",
    "tiff",
    "tif",
    "avif",
  ];
  return imageExtensions.includes(ext || "");
};

interface IViewFileEditorProps {
  selectedProject: UnifiedItem | null;
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

export function ViewFileEditor({ selectedProject }: IViewFileEditorProps) {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number };
    targetFile: string | null;
  }>({ isOpen: false, position: { x: 0, y: 0 }, targetFile: null });
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    fileName: string;
    onConfirm: () => void;
  }>({ isOpen: false, fileName: "", onConfirm: () => {} });

  const loadFileTree = useCallback(async () => {
    if (
      !selectedProject ||
      selectedProject.type !== "project" ||
      !selectedProject.path
    )
      return;

    setLoading(true);
    setError(null);
    try {
      const result = await api.getProjectFiles(selectedProject.path);
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
  }, [selectedProject]);

  // Load file tree when project changes
  useEffect(() => {
    if (!selectedProject) {
      setFileTree([]);
      setOpenFiles([]);
      setActiveFile(null);
      return;
    }

    loadFileTree();
  }, [selectedProject, loadFileTree]);

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

    if (
      !selectedProject ||
      selectedProject.type !== "project" ||
      !selectedProject.path
    )
      return;

    // Check if current active file is unchanged and can be replaced
    const currentFile = activeFile
      ? openFiles.find((f) => f.path === activeFile)
      : null;
    const shouldReplaceCurrentFile = currentFile && !currentFile.isDirty;

    // For image files, we don't need to read the content as text
    if (isImageFile(filePath)) {
      const newFile: OpenFile = {
        path: filePath,
        name: fileName,
        content: "", // Empty content for images
        originalContent: "",
        isDirty: false,
      };

      if (shouldReplaceCurrentFile && currentFile) {
        // Replace the current file
        setOpenFiles((prev) =>
          prev.map((f) => (f.path === currentFile.path ? newFile : f))
        );
      } else {
        // Add as new tab
        setOpenFiles((prev) => [...prev, newFile]);
      }
      setActiveFile(filePath);
      return;
    }

    try {
      const result = await api.readProjectFile(selectedProject.path, filePath);
      if (result?.success) {
        const content = result.data || "";
        const newFile: OpenFile = {
          path: filePath,
          name: fileName,
          content: content,
          originalContent: content,
          isDirty: false,
        };

        if (shouldReplaceCurrentFile && currentFile) {
          // Replace the current file
          setOpenFiles((prev) =>
            prev.map((f) => (f.path === currentFile.path ? newFile : f))
          );
        } else {
          // Add as new tab
          setOpenFiles((prev) => [...prev, newFile]);
        }
        setActiveFile(filePath);
      } else {
        setError(result?.error || `Failed to open file: ${fileName}`);
      }
    } catch (err) {
      setError(`Error opening file: ${fileName}`);
      console.error(err);
    }
  };

  const closeFile = useCallback(
    (filePath: string, skipConfirmation = false) => {
      const fileToClose = openFiles.find((f) => f.path === filePath);

      // If file has unsaved changes and we haven't skipped confirmation, show dialog
      if (fileToClose?.isDirty && !skipConfirmation) {
        setConfirmDialog({
          isOpen: true,
          fileName: fileToClose.name,
          onConfirm: () => {
            setConfirmDialog({
              isOpen: false,
              fileName: "",
              onConfirm: () => {},
            });
            closeFile(filePath, true); // Skip confirmation on recursive call
          },
        });
        return;
      }

      setOpenFiles((prev) => prev.filter((f) => f.path !== filePath));

      // If this was the active file, switch to another or none
      if (activeFile === filePath) {
        const remainingFiles = openFiles.filter((f) => f.path !== filePath);
        setActiveFile(
          remainingFiles.length > 0 ? remainingFiles[0].path : null
        );
      }
    },
    [openFiles, activeFile, setConfirmDialog]
  );

  const closeFilesToRight = (filePath: string) => {
    const fileIndex = openFiles.findIndex((f) => f.path === filePath);
    if (fileIndex === -1) return;

    const filesToClose = openFiles.slice(fileIndex + 1);
    const hasUnsavedChanges = filesToClose.some((f) => f.isDirty);

    if (hasUnsavedChanges) {
      const unsavedFiles = filesToClose.filter((f) => f.isDirty);
      setConfirmDialog({
        isOpen: true,
        fileName: `${unsavedFiles.length} file${
          unsavedFiles.length > 1 ? "s" : ""
        }`,
        onConfirm: () => {
          setConfirmDialog({
            isOpen: false,
            fileName: "",
            onConfirm: () => {},
          });
          const remainingFiles = openFiles.slice(0, fileIndex + 1);
          setOpenFiles(remainingFiles);

          // If the active file was closed, switch to the target file
          if (filesToClose.some((f) => f.path === activeFile)) {
            setActiveFile(filePath);
          }
        },
      });
      return;
    }

    const remainingFiles = openFiles.slice(0, fileIndex + 1);
    setOpenFiles(remainingFiles);

    // If the active file was closed, switch to the target file
    if (filesToClose.some((f) => f.path === activeFile)) {
      setActiveFile(filePath);
    }
  };

  const closeOtherFiles = (filePath: string) => {
    const targetFile = openFiles.find((f) => f.path === filePath);
    if (!targetFile) return;

    const otherFiles = openFiles.filter((f) => f.path !== filePath);
    const hasUnsavedChanges = otherFiles.some((f) => f.isDirty);

    if (hasUnsavedChanges) {
      const unsavedFiles = otherFiles.filter((f) => f.isDirty);
      setConfirmDialog({
        isOpen: true,
        fileName: `${unsavedFiles.length} file${
          unsavedFiles.length > 1 ? "s" : ""
        }`,
        onConfirm: () => {
          setConfirmDialog({
            isOpen: false,
            fileName: "",
            onConfirm: () => {},
          });
          setOpenFiles([targetFile]);
          setActiveFile(filePath);
        },
      });
      return;
    }

    setOpenFiles([targetFile]);
    setActiveFile(filePath);
  };

  const handleTabRightClick = useCallback(
    (event: React.MouseEvent, filePath: string) => {
      event.preventDefault();
      setContextMenu({
        isOpen: true,
        position: { x: event.clientX, y: event.clientY },
        targetFile: filePath,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu({
      isOpen: false,
      position: { x: 0, y: 0 },
      targetFile: null,
    });
  }, []);

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialog({ isOpen: false, fileName: "", onConfirm: () => {} });
  }, []);

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
      if (
        !file ||
        !selectedProject ||
        selectedProject.type !== "project" ||
        !selectedProject.path
      )
        return;

      try {
        const result = await api.saveFile(
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
                <Icon name="chevrondown" className="h-3 w-3 text-gray-500" />
              ) : (
                <Icon name="chevronright" className="h-3 w-3 text-gray-500" />
              )}
              {node.isExpanded ? (
                <Icon name="folderopen" className="h-4 w-4 text-blue-400" />
              ) : (
                <Icon name="folder" className="h-4 w-4 text-blue-400" />
              )}
            </>
          ) : (
            <>
              <div className="w-3" /> {/* Spacer for alignment */}
              <Icon name="file" className="h-4 w-4 text-gray-400" />
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

  if (!selectedProject) {
    return (
      <div className="flex-1 h-full flex items-center justify-center">
        <NonIdealState
          icon={() => <Icon name="filetext" className="h-16 w-16 opacity-50" />}
          title="No Project Selected"
          description="Select a project from the sidebar to browse and edit files"
          className="min-w-80 max-w-2xl"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 h-full flex items-center justify-center">
        <NonIdealState
          icon={() => <Icon name="alertcircle" className="h-16 w-16 opacity-50" />}
          title="Error Loading Files"
          description={error}
          variant="error"
          className="min-w-80 max-w-2xl"
          action={
            <Button onClick={loadFileTree} className="raycast-button-primary">
              <Icon name="refreshcw" className="h-4 w-4 mr-2" />
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  const currentFile = useMemo(() => {
    return activeFile ? openFiles.find((f) => f.path === activeFile) : null;
  }, [activeFile, openFiles]);

  return (
    <div className="h-full flex flex-col lg:flex-row pt-0">
      {/* File Explorer Sidebar */}
      <div className="w-full lg:w-80 lg:min-w-64 lg:max-w-80 md:w-72 bg-gray-950 border-r border-t border-gray-800 overflow-y-auto rounded-tr-lg lg:max-h-screen max-h-64 lg:flex-shrink-0">
        <div className="p-2 md:p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Icon name="filetext" className="h-4 w-4" />
              <span>Explorer</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                loadFileTree();
              }}
            >
              <Icon name="refreshcw" className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="text-xs text-gray-500">{selectedProject.name}</div>
        </div>

        <div className="p-2">
          {loading ? (
            <div className="text-center py-8">
              <Icon name="refreshcw" className="h-6 w-6 text-gray-600 mx-auto mb-2 animate-spin" />
              <p className="text-sm text-gray-500">Loading files...</p>
            </div>
          ) : fileTree.length > 0 ? (
            renderFileTree(fileTree)
          ) : (
            <div className="text-center py-8">
              <Icon name="filetext" className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No files found</p>
            </div>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col h-full">
        <Card className="flex-1 m-0 md:m-4 md:mt-0 flex flex-col glass-card overflow-hidden">
          <CardHeader className="flex-shrink-0 py-3 bg-gradient-to-r from-black to-gray-900 border-b border-gray-800 md:rounded-t-lg">
            <div className="flex items-center justify-between">
              {/* File Tabs in Header */}
              {openFiles.length > 0 ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <Icon name="filetext" className="h-5 w-5 text-blue-400 flex-shrink-0" />
                  <div className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                    {openFiles.map((file) => (
                      <div
                        key={file.path}
                        className={`flex items-center gap-1 px-2 py-1 rounded text-sm cursor-pointer whitespace-nowrap ${
                          activeFile === file.path
                            ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                            : "hover:bg-gray-700/50 text-gray-400 hover:text-gray-300"
                        }`}
                        onClick={() => setActiveFile(file.path)}
                        onContextMenu={(e) => handleTabRightClick(e, file.path)}
                      >
                        <span className="truncate max-w-24 sm:max-w-32 lg:max-w-40">
                          {file.name}
                        </span>
                        {file.isDirty && (
                          <span className="text-yellow-400 text-xs">●</span>
                        )}
                        <Icon 
                          name="x" 
                          className="h-3 w-3 text-gray-500 hover:text-red-400 cursor-pointer" 
                          onClick={(e) => {
                            e.stopPropagation();
                            closeFile(file.path);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <CardTitle className="flex items-center gap-2 text-gray-200 font-semibold">
                  <Icon name="filetext" className="h-5 w-5 text-blue-400" />
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
                  <Icon name="save" className="h-3 w-3 mr-1" />
                  Save
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden">
            {currentFile ? (
              <FileEditorContent
                currentFile={currentFile}
                selectedProject={selectedProject}
                handleContentChange={handleContentChange}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Icon name="filetext" className="h-12 w-12 text-gray-600 mx-auto mb-3" />
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

      {/* Context Menu */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={closeContextMenu}
      >
        <ContextMenuItem
          onClick={() => {
            if (contextMenu.targetFile) {
              closeFile(contextMenu.targetFile);
            }
            closeContextMenu();
          }}
        >
          Close
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            if (contextMenu.targetFile) {
              closeOtherFiles(contextMenu.targetFile);
            }
            closeContextMenu();
          }}
          disabled={openFiles.length <= 1}
        >
          Close Others
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => {
            if (contextMenu.targetFile) {
              closeFilesToRight(contextMenu.targetFile);
            }
            closeContextMenu();
          }}
          disabled={
            !contextMenu.targetFile ||
            openFiles.findIndex((f) => f.path === contextMenu.targetFile) >=
              openFiles.length - 1
          }
        >
          Close to the Right
        </ContextMenuItem>
      </ContextMenu>

      {/* Confirmation Dialog */}
      <Modal
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirmDialog}
        title="Unsaved Changes"
        intent="warning"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-gray-300 leading-relaxed">
            {confirmDialog.fileName} has unsaved changes. Are you sure you want
            to close without saving?
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button
              onClick={closeConfirmDialog}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-gray-200"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDialog.onConfirm}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white"
            >
              Close Without Saving
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Separate component to handle file content rendering
// This ensures hooks are always called in the same order
function FileEditorContent({
  currentFile,
  selectedProject,
  handleContentChange,
}: {
  currentFile: any;
  selectedProject: any;
  handleContentChange: (value: string | undefined, path: string) => void;
}) {
  const isImage = isImageFile(currentFile.path);

  // Always render both components to maintain hook order
  // But only show one at a time
  if (isImage) {
    return (
      <CodeEditorImageViewer
        filePath={currentFile.path}
        projectPath={selectedProject.path || ""}
        fileName={currentFile.name}
      />
    );
  } else {
    return (
      <CodeEditor
        value={currentFile.content}
        onChange={(value) => handleContentChange(value, currentFile.path)}
        language={getLanguageFromPath(currentFile.path)}
      />
    );
  }
}
