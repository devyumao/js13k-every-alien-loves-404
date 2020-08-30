var _IS_DEBUG_ = true;

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

var renderer, scene, camera, lights, colors;
var keys = [];

var pivot = new THREE.Group();
var earth;
var clouds;
var earthSurface;
var ufo = new THREE.Group();
var ufoRay;
var specimenGroup = new THREE.Group();
var mediaGroup = new THREE.Group();

var lastFrame = Date.now();


/**
 * ------------------
 * DEBUG
 */
var gui;
var guiConfigs;
/**
 * END OF DEBUG
 * ------------------
 */

main();

function main() {
    loadResources().then(() => {
        if (_IS_DEBUG_) {
            initDebug();
        }

        initScene();
        initLight();

        createEarth();
        createUfo();

        pivot.add(specimenGroup, mediaGroup);

        initSpecimenPoints();
        // addMediaPoint(2, 0.5);

        initRenderer();

        window.addEventListener('resize', onWindowResize, false);

        initControl();

        animate();
    });
}

function loadResources() {
    // var textureLoader = new THREE.TextureLoader();
    return new Promise(resolve => {
        // textureLoader.load('./asset/map.jpg', texture => {  
        //     resources.earthTexture = texture;
        // });
        resolve();
    });
}

function initScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 20;
}

function initLight() {
    lights = {};
    lights.key = new THREE.DirectionalLight(colors.key, 0.5);
    lights.key.position.set(0, 0.2, 0.5);
    lights.fillTop = new THREE.DirectionalLight(colors.skyA, 1);
    lights.fillTop.position.set(0.5, 1, 0.75);
    lights.fillBottom = new THREE.DirectionalLight(colors.skyB, 1);
    lights.fillBottom.position.set(-0.75, -1, 0.5);
    lights.ambient = new THREE.AmbientLight(colors.ambient);
    scene.add(lights.key);
    scene.add(lights.fillTop);
    scene.add(lights.fillBottom);
    scene.add(lights.ambient);
}

function initRenderer() {
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    renderer.setPixelRatio((window.devicePixelRatio) ? window.devicePixelRatio : 1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0.0);
    document.body.appendChild(renderer.domElement);
}

function createEarth() {
    var geo = new THREE.IcosahedronGeometry(EARTH_RADIUS, 3);
    earthSurface = [];
    for (var i = 0; i < geo.vertices.length; ++i) {
        earthSurface.push({
            x: geo.vertices[i].x,
            y: geo.vertices[i].y,
            z: geo.vertices[i].z,
            delta: Math.random() * Math.PI * 2
        });
    }

    var mat = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        flatShading: true
    });

    earth = new THREE.Mesh(geo, mat);
    scene.add(earth);
}

function createUfo() {
    var ufoCore = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 32, 32),
        new THREE.MeshLambertMaterial({ color: 0xbfbfbf })
    );
    ufoCore.position.y = -0.05;
    ufo.add(ufoCore);

    var ufoPlate = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 0.25, 32),
        new THREE.MeshLambertMaterial({ color: 0x8c8c8c })
    );
    ufo.add(ufoPlate);

    ufoRay = new THREE.Mesh(
        new THREE.ConeGeometry(0.55, 1, 32),
        new THREE.MeshLambertMaterial({ color: 0xffec3d })
    );
    ufoRay.position.y = -0.25;
    ufoRay.scale.set(0, 0, 0);
    ufo.add(ufoRay);

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

function createClouds() {
    clouds = new THREE.Group();
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
    
    if (keys[32]) { // Space
        // TODO: refactor
        if (ufoRay.scale.x < 1) {
            var scaleUp = Math.min(ufoRay.scale.x + 0.03, 0.90);
            ufoRay.scale.set(scaleUp, scaleUp, scaleUp);
        }
    } else {
        if (ufoRay.scale.x > 0) {
            var scaleDown = Math.max(ufoRay.scale.x - 0.03, 0);
            ufoRay.scale.set(scaleDown, scaleDown, scaleDown);
        }
    }

    updateEarth();

    lastFrame = Date.now();

    renderer.clear();
    renderer.render(scene, camera);
}

function updateEarth() {
    var delta = (Date.now() - lastFrame) * 0.002;
    var vertices = earth.geometry.vertices;
    for (var i = 0; i < vertices.length; ++i) {
        earthSurface[i].delta += delta;
        var scale = Math.sin(earthSurface[i].delta) * 0.06;
        vertices[i].set(
            earthSurface[i].x + scale,
            earthSurface[i].y + scale,
            earthSurface[i].z + scale
        );
    }
    earth.geometry.verticesNeedUpdate = true;
}

function initDebug() {
    gui = new dat.GUI();

    var isNight = false;

    guiConfigs = {
        'Bg Top': '#912deb',
        'Bg Bottom': '#59b5e8',
        'Ambient': '#444',
        'Key': '#ccc',
        'Sky A': '#2981a7',
        'Sky B': '#4629a7',
        'Change': function () {}
    };
    gui.addColor(guiConfigs, 'Bg Top')
        .onChange(function (val) {
            document.body.setAttribute(
                'style',
                'background:linear-gradient(0deg, '
                    + val + ' 0%, '
                    + guiConfigs['Bg Bottom'] + ' 100%);'
            );
        });
    gui.addColor(guiConfigs, 'Bg Bottom')
        .onChange(function (val) {
            document.body.setAttribute(
                'style',
                'background:linear-gradient(0deg, '
                    + guiConfigs['Bg Top'] + ' 0%, '
                    + val + ' 100%);'
            );
        });

    gui.addColor(guiConfigs, 'Ambient')
        .onChange(function (val) {
            lights.ambient.color.set(val);
        });
    gui.addColor(guiConfigs, 'Key')
        .onChange(function (val) {
            lights.key.color.set(val);
        });
    gui.addColor(guiConfigs, 'Sky A')
        .onChange(function (val) {
            lights.fillTop.color.set(val);
        });
    gui.addColor(guiConfigs, 'Sky B')
        .onChange(function (val) {
            lights.fillBottom.color.set(val);
        });

    gui.add(guiConfigs, 'Change')
        .onChange(function () {
            isNight = !isNight;
            setTime(isNight);
        });

    // TODO: if color is chosen, write as fixed string
    colors = {};
    colors.bgTop = guiConfigs['Bg Top'];
    colors.bgBottom = guiConfigs['Bg Bottom'];
    colors.ambient = guiConfigs['Ambient'];
    colors.key = guiConfigs['Key'];
    colors.skyA = guiConfigs['Sky A'];
    colors.skyB = guiConfigs['Sky B'];

    document.body.setAttribute(
        'style',
        'background:linear-gradient(0deg, '
            + guiConfigs['Bg Top'] + ' 0%, '
            + guiConfigs['Bg Bottom'] + ' 100%);'
    );

    function setTime(isNight) {
        if (isNight) {
            colors.bgTop = '#200837';
            colors.bgBottom = '#8c2c2c';
            colors.ambient = '#000000';
            colors.key = '#848c4b';
            colors.skyA = '#cf5631';
            colors.skyB = '#7f265a';
        }
        else {
            colors.bgTop = '#912deb';
            colors.bgBottom = '#59b5e8';
            colors.ambient = '#444';
            colors.key = '#ccc';
            colors.skyA = '#2981a7';
            colors.skyB = '#4629a7';
        }

        lights.ambient.color.set(colors.ambient);
        lights.key.color.set(colors.key);
        lights.fillTop.color.set(colors.skyA);
        lights.fillBottom.color.set(colors.skyB);

        document.body.setAttribute(
            'style',
            'background:linear-gradient(0deg, '
                + colors.bgTop + ' 0%, '
                + colors.bgBottom + ' 100%);'
        );
    }
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
