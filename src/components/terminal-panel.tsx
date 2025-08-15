import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Send, X, Terminal } from "lucide-react";
import type { Project } from "../types";

interface TerminalPanelProps {
  selectedProject: Project | null;
  onSendInput: (projectId: string, input: string) => void;
  onClearOutput: (projectId: string) => void;
}

export default function TerminalPanel({
  selectedProject,
  onSendInput,
  onClearOutput,
}: TerminalPanelProps) {
  const [input, setInput] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [selectedProject?.output]);

  const handleSendInput = () => {
    if (input.trim() && selectedProject) {
      onSendInput(selectedProject.id, input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSendInput();
    }
  };

  if (!selectedProject) {
    return (
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: "transparent" }}
      >
        <div className="text-center text-gray-400 glass-card p-8 rounded-xl">
          <Terminal className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2 text-gray-200">
            No Project Selected
          </h3>
          <p className="text-sm">
            Select a project from the sidebar to view its terminal output
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col" style={{ background: "transparent" }}>
      <Card className="flex-1 m-4 mt-0 flex flex-col glass-card">
        <CardHeader className="flex-shrink-0 py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              {selectedProject.name}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  selectedProject.status === "running"
                    ? "bg-green-500 animate-pulse"
                    : selectedProject.status === "completed"
                    ? "bg-blue-500"
                    : selectedProject.status === "error"
                    ? "bg-red-500"
                    : "bg-gray-400"
                }`}
              />
              <span className="text-sm text-gray-400 capitalize">
                {selectedProject.status}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onClearOutput(selectedProject.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <p className="text-sm text-gray-400">{selectedProject.path}</p>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto p-4 terminal-glass text-green-400 font-mono text-sm whitespace-pre-wrap"
            style={{ minHeight: "300px" }}
          >
            {selectedProject.output.length === 0 ? (
              <div className="text-gray-500 italic">Waiting for output...</div>
            ) : (
              selectedProject.output.map((line, index) => (
                <div key={index} className="mb-1">
                  {line}
                </div>
              ))
            )}
          </div>

          {selectedProject.status === "running" && (
            <div className="border-t border-gray-700/50 glass-card p-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a command or message..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 font-mono"
                />
                <Button onClick={handleSendInput} disabled={!input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
