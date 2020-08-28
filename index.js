var EARTH_RADIUS = 10;
var SPECIMENS_AMOUNT = 10;
var ROTATION_VEL = Math.PI / 600;
var UFO_PHI = Math.PI * 0.42;
var UFO_THETA = 0;

var baseAxisX = new THREE.Vector3(1, 0, 0);
var baseAxisY = new THREE.Vector3(0, 1, 0);

var resources = {
    earthTexture: null
};

var renderer, scene, camera;
var keys = [];

var earth;
var ufo = new THREE.Group();
var pivot = new THREE.Group();
var specimenGroup = new THREE.Group();
var mediaGroup = new THREE.Group();


main();

function main() {
    loadResources().then(() => {
        initScene();

        createEarth();
        createUfo();

        initSpecimenPoints();
        // addMediaPoint(2, 0.5);

        initRenderer();

        window.addEventListener('resize', onWindowResize, false);

        initControl();

        animate();
    });
}

function loadResources() {
    var textureLoader = new THREE.TextureLoader();
    return new Promise(resolve => {
        textureLoader.load('./asset/map.jpg', texture => {  
            resources.earthTexture = texture;
            resolve();
        });
    });
}

function initScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

    camera.position.z = 20;

    scene.add(pivot);
    pivot.add(specimenGroup, mediaGroup);

    var light = new THREE.AmbientLight(0xffffff);
    // var light = new THREE.PointLight(0xffffff, 4, 100);
    // light.position.set(50, 50, 50);
    scene.add(light);
}

function initRenderer() {
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
}

function createEarth() {
    var geometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
    var material = new THREE.MeshLambertMaterial({ map: resources.earthTexture, transparent: true });
    earth = new THREE.Mesh(geometry, material);
    pivot.add(earth);
}

function createUfo() {
    var ufoCore = (function () {
        var geometry = new THREE.SphereGeometry(0.25, 32, 32);
        var material = new THREE.MeshLambertMaterial({ color: 0xbfbfbf });
        return new THREE.Mesh(geometry, material);
    })();
    ufoCore.position.y = -0.05;
    ufo.add(ufoCore);
    
    var ufoPlate = (function () {
        var geometry = new THREE.ConeGeometry(0.5, 0.25, 32);
        var material = new THREE.MeshLambertMaterial({ color: 0x8c8c8c });
        return new THREE.Mesh(geometry, material);
    })();
    ufo.add(ufoPlate);

    ufo.position.setFromSphericalCoords(11, UFO_PHI, UFO_THETA);
    ufo.rotation.x = 1;
    // ufo.lookAt(getVectorFromSphCoord(11, Math.PI / 2, 0));
    scene.add(ufo);
}

function initSpecimenPoints() {
    for (var i = 0; i < SPECIMENS_AMOUNT; ++i) {
        addSpecimenPoint(randRad(), randRad());
    }
}

function addSpecimenPoint(phi, theta) {
    specimenGroup.add(createPoint(phi, theta, 0x73d13d));
}

function addMediaPoint(phi, theta) {
    mediaGroup.add(createPoint(phi, theta, 0xff4d4f));
}

function createPoint(phi, theta, color) {
    // var point = new THREE.Object3D();
    var geometry = new THREE.SphereGeometry(0.1, 16, 16);
    var material = new THREE.MeshBasicMaterial({ color });
    var point = new THREE.Mesh(geometry, material);
    point.position.setFromSphericalCoords(EARTH_RADIUS, phi, theta);
    return point;
}

function calcMinSpecimenAngle() {
    return specimenGroup.children.reduce(function (a, b) {
        const angle = ufo.position.angleTo(b.localToWorld(new THREE.Vector3()))
        return Math.min(a, angle);
    }, Infinity);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function initControl() {
    document.addEventListener('keydown', function (e) {
        keys[e.keyCode] = true;
    });
    document.addEventListener('keyup', function (e) {
        keys[e.keyCode] = false;
    });
}

function animate() {
    requestAnimationFrame(animate);

    calcMinSpecimenAngle();

    // TODO: inertia
    if (keys[87] /* W */ || keys[38] /* ArrowUp */) {
        pivot.rotateOnWorldAxis(baseAxisX, ROTATION_VEL);
    }
    if (keys[83] /* S */ || keys[40] /* ArrowDown */) {
        pivot.rotateOnWorldAxis(baseAxisX, -ROTATION_VEL);
    }
    if (keys[65] /* A */ || keys[37] /* ArrowLeft */) {
        pivot.rotateOnWorldAxis(baseAxisY, ROTATION_VEL);
    }
    if (keys[68] /* D */ || keys[39] /* ArrowRight */) {
        pivot.rotateOnWorldAxis(baseAxisY, -ROTATION_VEL);
    }

    renderer.render(scene, camera);
}


// ====== Utils ======

function getVectorFromSphCoord(radius, phi, theta) {
    var vec = new THREE.Vector3();
    vec.setFromSphericalCoords(radius, phi, theta);
    return vec;
}

function randRad() {
    return THREE.MathUtils.randFloatSpread(2 * Math.PI);
}
