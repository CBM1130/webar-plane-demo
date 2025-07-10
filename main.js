// main.js
import * as THREE          from 'https://cdn.jsdelivr.net/npm/three@0.178.0/build/three.module.js';
import { ARButton }        from 'https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/webxr/ARButton.js';
import { GLTFLoader }      from 'https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/loaders/GLTFLoader.js';

let camera, scene, renderer;
let controller, reticle, model;
let hitTestSource = null, localSpace = null;

init();
animate();

async function init() {
  const info = document.getElementById('info');

  // Scene, Camera
  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  // AR 지원 체크
  if (!navigator.xr || !(await navigator.xr.isSessionSupported('immersive-ar'))) {
    info.textContent = '죄송합니다. AR을 지원하지 않는 기기입니다.';
    return;
  }

  // ARButton 추가
  document.body.appendChild(
    ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] })
  );
  info.style.display = 'none';

  // Light
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1));

  // Reticle (Green ring)
  {
    const ringGeo = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI/2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    reticle = new THREE.Mesh(ringGeo, ringMat);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
  }

  // GLTF model 로드 (초기 숨김)
  try {
    const gltf = await new GLTFLoader().loadAsync('./model/table_set.glb');
    model = gltf.scene;
    model.visible = false;
    model.scale.set(0.3,0.3,0.3);
    scene.add(model);
  } catch (e) {
    console.error('모델 로드 실패:', e);
    info.style.display = 'block';
    info.textContent = '3D 모델 로드에 실패했습니다.';
  }

  // Controller (터치 → 모델 배치)
  controller = renderer.xr.getController(0);
  controller.addEventListener('select', () => {
    if (reticle.visible && model) {
      model.position.setFromMatrixPosition(reticle.matrix);
      model.quaternion.setFromRotationMatrix(reticle.matrix);
      model.visible = true;
    }
  });
  scene.add(controller);

  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  if (frame) {
    const session = renderer.xr.getSession();
    const refSpace = renderer.xr.getReferenceSpace();

    if (!hitTestSource) {
      // Hit Test Source 요청
      session.requestReferenceSpace('viewer').then((viewerSpace) => {
        session.requestHitTestSource({ space: viewerSpace }).then((source) => {
          hitTestSource = source;
        });
      });
    }

    if (hitTestSource) {
      const hits = frame.getHitTestResults(hitTestSource);
      if (hits.length > 0) {
        const hit = hits[0];
        const pose = hit.getPose(refSpace);
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }

  renderer.render(scene, camera);
}
