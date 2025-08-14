import { Card } from "./ui/card";
import { Button } from "./ui/button";

interface DependenciesModalProps {
  missingDeps: string[];
}

const getInstallCommand = (dep: string) => {
  switch (dep) {
    case "tmux":
      // Detect platform using user agent as fallback since process.platform may not be available
      const isMac =
        typeof navigator !== "undefined" && navigator.userAgent.includes("Mac");
      const isLinux =
        typeof navigator !== "undefined" &&
        navigator.userAgent.includes("Linux");

      if (isMac) {
        return "brew install tmux";
      } else if (isLinux) {
        return "sudo apt-get install tmux  # or sudo yum install tmux";
      }
      return "brew install tmux  # macOS or use your package manager";
    case "claude":
      return "curl -fsSL https://claude.ai/install.sh | sh";
    default:
      return `Install ${dep}`;
  }
};

export default function DependenciesModal({
  missingDeps,
}: DependenciesModalProps) {
  // Debug logging
  console.log("DependenciesModal received missingDeps:", missingDeps);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <Card className="relative glass-card border border-white/10 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center mb-6">
            <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center mr-4">
              <svg
                className="w-6 h-6 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                Missing Dependencies
              </h2>
              <p className="text-gray-400 mt-1">
                Vibe Term requires the following dependencies to function
                properly
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {missingDeps.map((dep) => (
              <div
                key={dep}
                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-white capitalize">
                    {dep}
                  </h3>
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                    Not Installed
                  </span>
                </div>

                <p className="text-gray-400 text-sm mb-4">
                  {dep === "tmux" &&
                    "Terminal multiplexer required for session management"}
                  {dep === "claude" &&
                    "Claude Code CLI tool required for AI assistance"}
                </p>

                <div className="bg-gray-900 rounded-md p-3 border border-gray-600">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400 font-mono">
                      Install Command:
                    </span>
                    <Button
                      onClick={() => copyToClipboard(getInstallCommand(dep))}
                      className="h-6 px-2 text-xs bg-gray-700 hover:bg-gray-600"
                    >
                      Copy
                    </Button>
                  </div>
                  <code className="text-sm text-green-400 font-mono block">
                    {getInstallCommand(dep)}
                  </code>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 text-blue-400 mr-3 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <h4 className="text-sm font-medium text-blue-400 mb-1">
                  Next Steps:
                </h4>
                <ol className="text-sm text-blue-200 space-y-1 list-decimal list-inside">
                  <li>Run the install commands above in your terminal</li>
                  <li>Restart Vibe Term after installation</li>
                  <li>The app will automatically detect the dependencies</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-center">
            <Button
              onClick={() => window.location.reload()}
              variant="primary"
              className="px-6 py-2"
            >
              Check Again
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
