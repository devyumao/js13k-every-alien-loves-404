var renderer, scene, camera;
var earth, ufo;
var keys = [];

var baseAxisX = new THREE.Vector3(1, 0, 0);
var baseAxisY = new THREE.Vector3(0, 1, 0);

var ROTATION_VEL = Math.PI / 600;

main();

function main() {
    initScene();

    createEarth();
    createUfo();

    initRenderer();

    window.addEventListener('resize', onWindowResize, false);
    document.addEventListener('keydown', onKeyDown, false);
    document.addEventListener('keyup', onKeyUp, false);

    animate();
}

function initScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    camera.position.z = 20;

    var light = new THREE.AmbientLight(0xffffff);
    scene.add(light);
}

function initRenderer() {
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
}

function createEarth() {
    var geometry = new THREE.SphereGeometry(10, 64, 64);
    var textureLoader = new THREE.TextureLoader();
    textureLoader.load('./asset/map.jpg', texture => {  
        var material = new THREE.MeshLambertMaterial({ map: texture, transparent: true });
        earth = new THREE.Mesh(geometry, material);  
        scene.add(earth);
    });
}

function createUfo() {
    var geometry = new THREE.ConeGeometry(0.5, 0.25, 32);
    var material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    ufo = new THREE.Mesh(geometry, material);
    ufo.position.set(0, 2, 11);
    ufo.rotation.x = 1
    scene.add(ufo);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(e) {
    keys[e.keyCode] = true;
}

function onKeyUp(e) {
    keys[e.keyCode] = false;
}

function animate() {
    requestAnimationFrame(animate);

    if (earth) {
        // TODO: 搞点惯性
        if (keys[87] /* W */ || keys[38] /* ArrowUp */) {
            earth.rotateOnWorldAxis(baseAxisX, ROTATION_VEL);
        }
        if (keys[83] /* S */ || keys[40] /* ArrowDown */) {
            earth.rotateOnWorldAxis(baseAxisX, -ROTATION_VEL);
        }
        if (keys[65] /* A */ || keys[37] /* ArrowLeft */) {
            earth.rotateOnWorldAxis(baseAxisY, ROTATION_VEL);
        }
        if (keys[68] /* D */ || keys[39] /* ArrowRight */) {
            earth.rotateOnWorldAxis(baseAxisY, -ROTATION_VEL);
        }
    }

    renderer.render(scene, camera);
}
