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
    earth = new THREE.Group();
    var geometry = new THREE.Geometry();

    geometry.vertices.push(
        new THREE.Vector3( -10,  10, 0 ),
        new THREE.Vector3( -10, -10, 0 ),
        new THREE.Vector3(  10, -10, 0 )
    );

    geometry.faces.push( new THREE.Face3( 0, 1, 2 ) );

    geometry.computeBoundingSphere();
    var points = window.globalPoints;
    var material = new THREE.MeshLambertMaterial({
        color: 0x00ff88,
        opacity: 0.9,
        transparent: true,
        side: THREE.DoubleSide
    });
    for (var i = 0; i < points.length; i += 3) {
        var geometry = new THREE.CircleGeometry(0.9, 6);
        var circle = new THREE.Mesh(geometry, material);
        var x = points[i] / 3;
        var y = points[i + 1] / 3;
        var z = points[i + 2] / 3;
        circle.position.set(x, y, z);
        circle.lookAt(0, 0, 0);
        earth.add(circle);
    }

    var sphereGeo = new THREE.SphereGeometry(9.8, 64, 64);
    var sphereMat = new THREE.MeshLambertMaterial({
        color: 0xccffee,
        opacity: 0.2,
        transparent: true
    });
    var sphere = new THREE.Mesh(sphereGeo, sphereMat);
    earth.add(sphere);

    scene.add(earth);
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
