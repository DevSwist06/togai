export function webgpuLaunchArgs(platform) {
  if (platform === 'darwin') return ['--enable-unsafe-webgpu'];
  return [
    '--enable-unsafe-webgpu',
    '--use-angle=swiftshader',
    '--enable-features=Vulkan',
    '--enable-unsafe-swiftshader',
  ];
}
