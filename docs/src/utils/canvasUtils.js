//canvasサイズ更新処理
export function resizeCanvasToFit(canvas, camera, renderer, scene) {
  canvas.style.width = "";
  canvas.style.height = "";

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  canvas.width = width;
  canvas.height = height;

  camera.aspect = width / height;
  camera.updateProjectionMatrix();

  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.render(scene, camera);
}
