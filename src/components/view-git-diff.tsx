import { useEffect, useState } from "react";
import {
  CodeEditor,
  SharedDiffEditor,
  getLanguageFromPath,
} from "./code-editor";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import {
  GitBranch,
  FileText,
  Plus,
  Minus,
  Edit,
  Save,
  Undo2,
  RefreshCw,
  X,
  GitCommit,
  AlertCircle,
} from "lucide-react";
import { NonIdealState } from "./non-ideal-state";
import type { UnifiedItem } from "../types";

interface IViewGitDiffProps {
  selectedProject: UnifiedItem | null;
}

interface GitFile {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  oldContent: string;
  newContent: string;
}

interface GitDiffData {
  files: GitFile[];
  branch: string;
  ahead: number;
  behind: number;
}

export default function ViewGitDiff({ selectedProject }: IViewGitDiffProps) {
  const [diffData, setDiffData] = useState<GitDiffData | null>(null);
  const [selectedFile, setSelectedFile] = useState<GitFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState<string>("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [commitMessage, setCommitMessage] = useState<string>("");
  const [isCommitting, setIsCommitting] = useState(false);

  useEffect(() => {
    if (!selectedProject) {
      setDiffData(null);
      setSelectedFile(null);
      return;
    }

    const fetchGitDiff = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await window.electronAPI?.getGitDiff(
          selectedProject.path
        );
        if (result.success) {
          setDiffData(result.data);
          if (result.data.files.length > 0) {
            // Try to preserve the currently selected file if it still exists
            const currentSelectedPath = selectedFile?.path;
            const stillExists =
              currentSelectedPath &&
              result.data.files.some(
                (f: GitFile) => f.path === currentSelectedPath
              );

            if (stillExists) {
              // Update the selected file with new content but keep it selected
              const updatedFile = result.data.files.find(
                (f: GitFile) => f.path === currentSelectedPath
              );
              setSelectedFile(updatedFile || result.data.files[0]);
            } else if (!selectedFile) {
              // Only select the first file if no file was previously selected
              setSelectedFile(result.data.files[0]);
            }
          }
        } else {
          setError(result.error || "Failed to fetch git diff");
        }
      } catch (err) {
        setError("Error fetching git diff");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    // Fetch git diff only when component mounts or project changes
    fetchGitDiff();
  }, [selectedProject]);

  // Manual refresh function
  const handleRefresh = async () => {
    if (!selectedProject) return;

    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI?.getGitDiff(selectedProject.path);
      if (result.success) {
        setDiffData(result.data);
        if (result.data.files.length > 0) {
          // Try to preserve the currently selected file if it still exists
          const currentSelectedPath = selectedFile?.path;
          const stillExists =
            currentSelectedPath &&
            result.data.files.some(
              (f: GitFile) => f.path === currentSelectedPath
            );

          if (stillExists) {
            // Update the selected file with new content but keep it selected
            const updatedFile = result.data.files.find(
              (f: GitFile) => f.path === currentSelectedPath
            );
            setSelectedFile(updatedFile || result.data.files[0]);
          } else if (!selectedFile) {
            // Only select the first file if no file was previously selected
            setSelectedFile(result.data.files[0]);
          }
        }
      } else {
        setError(result.error || "Failed to fetch git diff");
      }
    } catch (err) {
      setError("Error fetching git diff");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Handle entering edit mode
  const handleEditMode = () => {
    if (selectedFile) {
      setEditContent(selectedFile.newContent);
      setEditMode(true);
      setHasUnsavedChanges(false);
    }
  };

  // Handle exiting edit mode (back to diff view)
  const handleViewMode = () => {
    setEditMode(false);
    setHasUnsavedChanges(false);
  };

  // Handle content changes in edit mode
  const handleContentChange = (value: string | undefined) => {
    if (value !== undefined) {
      setEditContent(value);
      setHasUnsavedChanges(value !== selectedFile?.newContent);
    }
  };

  // Handle saving file changes
  const handleSaveFile = async () => {
    if (!selectedProject || !selectedFile) return;

    try {
      const result = await window.electronAPI?.saveFile(
        selectedProject.path,
        selectedFile.path,
        editContent
      );
      if (result?.success) {
        // Update the selected file with new content
        if (selectedFile) {
          const updatedFile = { ...selectedFile, newContent: editContent };
          setSelectedFile(updatedFile);
        }
        setHasUnsavedChanges(false);
        // Optionally refresh the diff data
        // fetchGitDiff();
      } else {
        setError(result?.error || "Failed to save file");
      }
    } catch (err) {
      setError("Error saving file");
      console.error(err);
    }
  };

  // Handle committing all files
  const handleCommit = async () => {
    if (!selectedProject || !commitMessage.trim() || !diffData?.files.length)
      return;

    setIsCommitting(true);
    try {
      const result = await window.electronAPI?.gitCommit(
        selectedProject.path,
        commitMessage.trim()
      );
      if (result?.success) {
        setCommitMessage("");
        // Check if current branch is restricted before offering push
        const currentBranch = diffData?.branch;
        const restrictedBranches = selectedProject.restrictedBranches;
        const isRestrictedBranch =
          restrictedBranches &&
          currentBranch &&
          restrictedBranches
            .split(",")
            .map((b) => b.trim())
            .includes(currentBranch);

        if (isRestrictedBranch) {
          alert(
            `Push is disabled for branch "${currentBranch}". This branch is listed in restricted branches.`
          );
        } else {
          // Ask user if they want to push
          const shouldPush = window.confirm(
            "Commit successful! Do you want to push to remote?"
          );
          if (shouldPush) {
            const pushResult = await window.electronAPI?.gitPush(
              selectedProject.path
            );
            if (pushResult?.success) {
              alert("Successfully pushed to remote!");
            } else {
              alert(`Push failed: ${pushResult?.error || "Unknown error"}`);
            }
          }
        }
        // Refresh the diff data
        handleRefresh();
      } else {
        setError(result?.error || "Failed to commit");
      }
    } catch (err) {
      setError("Error committing changes");
      console.error(err);
    } finally {
      setIsCommitting(false);
    }
  };

  // Handle reverting a specific file (from the file list)
  const handleRevertSpecificFile = async (filePath: string) => {
    if (!selectedProject) return;

    try {
      const result = await window.electronAPI?.revertFile(
        selectedProject.path,
        filePath
      );
      if (result?.success) {
        // If this was the currently selected file, update it
        if (selectedFile && selectedFile.path === filePath) {
          const revertedFile = {
            ...selectedFile,
            newContent: selectedFile.oldContent,
          };
          setSelectedFile(revertedFile);
          setEditContent(selectedFile.oldContent);
          setHasUnsavedChanges(false);
        }
        // Refresh the diff data to update the file list
        handleRefresh();
      } else {
        setError(result?.error || "Failed to revert file");
      }
    } catch (err) {
      setError("Error reverting file");
      console.error(err);
    }
  };

  if (!selectedProject) {
    return (
      <div className="flex-1 h-full flex items-center justify-center">
        <NonIdealState
          icon={GitBranch}
          title="No Project Selected"
          description="Select a project from the sidebar to view its git diff"
          className="min-w-80 max-w-2xl"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 h-full flex items-center justify-center">
        <NonIdealState
          icon={AlertCircle}
          title="Git Error"
          description={error}
          variant="error"
          className="min-w-80 max-w-2xl"
          action={
            <Button onClick={handleRefresh} className="raycast-button-primary">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  // Always show the git diff interface, even if no changes
  const hasChanges = diffData && diffData.files.length > 0;

  return (
    <div className="h-full flex pt-0">
      {/* File List Sidebar */}
      <div className="w-80 bg-gray-950 border-r border-t border-gray-800 overflow-y-auto rounded-tr-lg max-h-screen">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <GitBranch className="h-4 w-4" />
              <span>{diffData?.branch || "main"}</span>
              {diffData?.ahead && diffData.ahead > 0 && (
                <span className="text-green-400">↑{diffData.ahead}</span>
              )}
              {diffData?.behind && diffData.behind > 0 && (
                <span className="text-red-400">↓{diffData.behind}</span>
              )}
            </div>
            {/* Refresh button for entire git diff */}
            <Button
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="h-6 w-6 p-0 bg-gray-600 hover:bg-gray-700 text-white disabled:opacity-50"
              title="Refresh git status"
            >
              <RefreshCw
                className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
          <div className="text-xs text-gray-500 mb-3">
            {hasChanges
              ? `${diffData!.files.length} file${
                  diffData!.files.length !== 1 ? "s" : ""
                } changed`
              : "Working directory is clean"}
          </div>

          {/* Commit section */}
          {hasChanges && (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Commit message"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600"
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    commitMessage.trim() &&
                    !isCommitting
                  ) {
                    handleCommit();
                  }
                }}
              />
              <Button
                size="sm"
                onClick={handleCommit}
                disabled={!commitMessage.trim() || isCommitting}
                variant="success"
                className="w-full h-8"
              >
                <GitCommit className="h-3 w-3 mr-1" />
                {isCommitting ? "Committing..." : "Commit All"}
              </Button>
            </div>
          )}
        </div>

        <div className="p-2">
          {hasChanges ? (
            diffData!.files.map((file) => (
              <div
                key={file.path}
                className={`group rounded p-2 transition-colors cursor-pointer ${
                  selectedFile?.path === file.path
                    ? "bg-gray-800"
                    : "hover:bg-gray-800/50"
                }`}
                onClick={() => setSelectedFile(file)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {file.status === "added" ? (
                      <Plus className="h-4 w-4 text-green-400 flex-shrink-0" />
                    ) : file.status === "deleted" ? (
                      <Minus className="h-4 w-4 text-red-400 flex-shrink-0" />
                    ) : (
                      <Edit className="h-4 w-4 text-yellow-400 flex-shrink-0" />
                    )}
                    <span
                      className="text-sm text-gray-300 truncate flex-1 min-w-0"
                      title={file.path}
                    >
                      <span className="font-medium">
                        {file.path.split("/").pop()}
                      </span>
                      <span className="text-gray-500 ml-2">{file.path}</span>
                    </span>
                  </div>

                  {/* Revert button - only show for modified/deleted files, not added */}
                  {file.status !== "added" && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRevertSpecificFile(file.path);
                      }}
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-orange-600 hover:bg-orange-700 text-white"
                      title={`Revert ${file.path}`}
                    >
                      <Undo2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <GitBranch className="h-8 w-8 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No changes to display</p>
              <p className="text-xs text-gray-600 mt-1">
                Your working directory is clean
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Diff Editor */}
      <div className="flex-1 flex flex-col h-full p-4 pt-0">
        <Card className="flex-1 flex flex-col glass-card overflow-hidden">
          <CardHeader className="flex-shrink-0 py-3 bg-gradient-to-r from-black to-gray-900 border-b border-gray-800 rounded-t-lg">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-gray-200 font-semibold">
                <FileText className="h-5 w-5 text-green-400" />
                {selectedFile?.path || "Select a file"}
                {hasUnsavedChanges && (
                  <span className="text-yellow-400 text-xs">●</span>
                )}
                {selectedFile && (
                  <div className="flex items-center gap-1 text-xs ml-2">
                    {selectedFile.additions > 0 && (
                      <span className="text-green-400">
                        +{selectedFile.additions}
                      </span>
                    )}
                    {selectedFile.deletions > 0 && (
                      <span className="text-red-400">
                        -{selectedFile.deletions}
                      </span>
                    )}
                  </div>
                )}
              </CardTitle>

              {selectedFile && (
                <div className="flex items-center gap-2">
                  {!editMode ? (
                    <Button
                      size="sm"
                      onClick={handleEditMode}
                      variant="primary"
                      className="h-7 px-3"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        onClick={handleSaveFile}
                        disabled={!hasUnsavedChanges}
                        variant="success"
                        className="h-7 px-3"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleViewMode}
                        variant="outline"
                        className="h-7 px-3"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden">
            {selectedFile ? (
              <>
                {!editMode ? (
                  <SharedDiffEditor
                    original={selectedFile.oldContent}
                    modified={selectedFile.newContent}
                    language={getLanguageFromPath(selectedFile.path)}
                  />
                ) : (
                  <CodeEditor
                    value={editContent}
                    onChange={handleContentChange}
                    language={getLanguageFromPath(selectedFile.path)}
                  />
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">
                    {hasChanges
                      ? "Select a file to view changes"
                      : "No files to display"}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {hasChanges
                      ? "Choose a file from the sidebar to see its diff"
                      : "Your working directory is clean"}
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
