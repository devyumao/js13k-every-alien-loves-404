var _IS_DEBUG_ = true;

var EARTH_RADIUS = 10;
var SPECIMENS_AMOUNT = 10;
var ROTATION_VEL = Math.PI / 600;
var UFO_PHI = Math.PI * 0.42;
var UFO_THETA = 0;
var LAYER_DEFAULT = 0;
var LAYER_EARTH = 2;
// var LAYER_BLOOM = 3;

var baseAxisX = new THREE.Vector3(1, 0, 0);
var baseAxisY = new THREE.Vector3(0, 1, 0);

var resources = {
    earthTexture: null
};

var renderer, scene, camera, lights, colors;
var composer;

var keys = [];

var pivot = new THREE.Group();
var earth;
var clouds;
var earthSurface;
var ufo = new THREE.Group();
var ufoRay;
var ufoIndicator;
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
        scene.add(pivot);

        initSpecimenPoints();
        // addMediaPoint(2, 0.5);

        initRenderer();
        // initEffects();

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
    camera.layers.enable(LAYER_EARTH);
}

function initLight() {
    lights = {};

    lights.key = new THREE.DirectionalLight(colors.key, 0.5);
    lights.key.position.set(0, 0.2, 0.5);
    lights.ambient = new THREE.AmbientLight(colors.ambient);
    lights.key.layers.enableAll();
    lights.ambient.layers.enableAll();
    scene.add(lights.key);
    scene.add(lights.ambient);

    lights.fillTop = new THREE.DirectionalLight('#333', 1);
    lights.fillTop.position.set(0.5, 1, 0.75);
    lights.fillBottom = new THREE.DirectionalLight('#333', 1);
    lights.fillBottom.position.set(-0.5, -1, -0.75);
    lights.fillTop.layers.enable(LAYER_DEFAULT);
    lights.fillBottom.layers.enable(LAYER_DEFAULT);
    lights.fillTop.layers.disable(LAYER_EARTH);
    lights.fillBottom.layers.disable(LAYER_EARTH);
    pivot.add(lights.fillTop);
    pivot.add(lights.fillBottom);

    lights.fillTopEarth = new THREE.DirectionalLight(colors.skyA, 1);
    lights.fillTopEarth.position.set(0.5, 1, 0.75);
    lights.fillBottomEarth = new THREE.DirectionalLight(colors.skyB, 1);
    lights.fillBottomEarth.position.set(-0.5, -1, -0.75);
    lights.fillTopEarth.layers.disable(LAYER_DEFAULT);
    lights.fillBottomEarth.layers.disable(LAYER_DEFAULT);
    lights.fillTopEarth.layers.enable(LAYER_EARTH);
    lights.fillBottomEarth.layers.enable(LAYER_EARTH);
    pivot.add(lights.fillTopEarth);
    pivot.add(lights.fillBottomEarth);
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

function initEffects() {
    var renderScene = new THREE.RenderPass(scene, camera);
    var bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.21;
    bloomPass.strength = 1.2;
    bloomPass.radius = 0.55;
    bloomPass.renderToScreen = true;
    composer = new THREE.Effectcomposer(renderer);
    composer.setSize(window.innerWidth, window.innerHeight);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
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
        color: '#75e8e1',
        flatShading: true
    });

    earth = new THREE.Mesh(geo, mat);
    earth.layers.set(LAYER_EARTH);
    pivot.add(earth);
}

function createUfo() {
    var ufoCore = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 32, 32),
        new THREE.MeshToonMaterial({ color: '#bfbfbf' })
    );
    ufoCore.position.y = -0.05;
    ufo.add(ufoCore);

    var ufoPlate = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 0.25, 32),
        new THREE.MeshToonMaterial({ color: '#8c8c8c' })
    );
    ufo.add(ufoPlate);

    ufoIndicator = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, 0.16, 32),
        new THREE.MeshToonMaterial({ color: '#8c8c8c' /* '#d9f7be' */ })
    );
    ufoIndicator.position.y = 0.047;
    // ufoIndicator.layers.enable(LAYER_BLOOM);
    ufo.add(ufoIndicator);

    ufoRay = new THREE.Mesh(
        new THREE.ConeGeometry(0.55, 1, 32),
        new THREE.MeshToonMaterial({ color: '#ffec3d', opacity: 0.5 })
    );
    ufoRay.position.y = -0.25;
    ufoRay.scale.set(0, 0, 0);
    ufo.add(ufoRay);

    ufo.position.setFromSphericalCoords(11, UFO_PHI, UFO_THETA);
    ufo.rotation.x = 1;
    ufo.layers.set(LAYER_DEFAULT);
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
    // composer.setSize(window.innerWidth, window.innerHeight);
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
    updateUfoIndicator();

    lastFrame = Date.now();

    // renderer.autoClear = false;
    renderer.clear();

    // camera.layers.set(LAYER_BLOOM);
    // composer.render();
    // renderer.clearDepth();

    camera.layers.set(LAYER_EARTH);
    renderer.render(scene, camera);
    camera.layers.set(LAYER_DEFAULT);
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

function updateUfoIndicator() {
    var minSpecimenAngle = calcMinSpecimenAngle();
    if (minSpecimenAngle <= 0.5) {
        ufoIndicator.material.color = new THREE.Color('#b7eb8f');
    } else {
        ufoIndicator.material.color = new THREE.Color('#8c8c8c');
    }
}

function initDebug() {
    gui = new dat.GUI();

    var isNight = false;

    guiConfigs = {
        'Bg Top': '#252541',// '#912deb',
        'Bg Bottom': '#384c7f',// '#59b5e8',
        'Ambient': '#666666',
        'Key': '#6077af',// '#ccc',
        'Sky A': '#297aa7',// '#2981a7',
        'Sky B': '#3434c0', //'#4629a7',
        'Ocean': '#75e8e1',
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
            lights.fillTopEarth.color.set(val);
        });
    gui.addColor(guiConfigs, 'Sky B')
        .onChange(function (val) {
            lights.fillBottomEarth.color.set(val);
        });
    gui.addColor(guiConfigs, 'Ocean')
        .onChange(function (val) {
            earth.material.color.set(val);
        });

    gui.add(guiConfigs, 'Change')
        .onChange(function () {
            isNight = !isNight;
            setTime(isNight);
        });

    gui.hide();

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
        lights.fillTopEarth.color.set(colors.skyA);
        lights.fillBottomEarth.color.set(colors.skyB);

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
