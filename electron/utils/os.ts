export enum OperatingSystem {
  MACOS = "darwin",
  LINUX = "linux",
}

export function getCurrentOS(): OperatingSystem {
  const platform = process.platform;

  switch (platform) {
    case "darwin":
      return OperatingSystem.MACOS;
    case "linux":
      return OperatingSystem.LINUX;
    default:
      throw new Error(`Unsupported operating system: ${platform}.`);
  }
}
