(function () {

var RADIUS_EARTH = 10;
var RADIUS_LAND = 10.1;
var RADIUS_UFO_POS = 11;
var SPECIMENS_AMOUNT = 10;
var ANGULAR_VEL = Math.PI / 600;
var ANGULAR_ACC = ANGULAR_VEL / 30;
var UFO_PHI = Math.PI * 0.42;
var UFO_THETA = 0;
var LAYER_DEFAULT = 0;
var LAYER_EARTH = 2;
// var LAYER_BLOOM = 3;
var LAYER_UI = 4;
var MAX_TRACK_POINTS = 10;
var MAX_MEDIUM = 8;

var baseAxisX = new THREE.Vector3(1, 0, 0);
var baseAxisY = new THREE.Vector3(0, 1, 0);

// var resources = {
//     earthTexture: null
// };

var renderer, scene, camera, lights, colors;
// var composer;

var keys = [];

var pivot = new THREE.Group();
var earth, earthSurface;
var clouds, cloudsSurface;
var land, landSurface;
var ufo = new THREE.Group();
var ufoRay;
var ufoIndicator;
var specimenGroup = new THREE.Group();
var mediaGroup = new THREE.Group();

var ufoMixer, ufoIndicatorMixer;
var ufoIdleAction, ufoIndicatorAction;

var track = new THREE.Group();
var pathLength = 0;
var lastPosition;
var trackMediaMap = {};
var angularVel = { phi: 0, theta: 0 };
var ufoOriginRotation;

var clock;
var trackTime = Date.now();

var colors = {
    'Bg Top': '#252541',// '#912deb',
    'Bg Bottom': '#384c7f',// '#59b5e8',
    'Ambient': '#666666',
    'Key': '#ddd',// '#ccc',
    'Sky A': '#297aa7',// '#2981a7',
    'Sky B': '#3434c0', //'#4629a7',
    'Ocean': '#75e8e1',
    'Change': function () {}
};

// DEBUG
var gui;
var guiConfigs;
var stats;
// DEBUG END

main();

function main() {
    document.body.setAttribute(
        'style',
        'background:linear-gradient(0deg, '
            + colors['Bg Top'] + ' 0%, '
            + colors['Bg Bottom'] + ' 100%);'
    );

    loadResources().then(() => {
        // DEBUG
        initDebug();
        // DEBUG END

        initScene();
        initLight();

        createEarth();
        createUfo();
        createClouds();
        createLand();

        pivot.add(specimenGroup, mediaGroup, track);
        scene.add(pivot);

        initSpecimenPoints();
        // addMediaPoint(2, 0.5);

        initRenderer();
        // initEffects();

        clock = new THREE.Clock();

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

    lights.ambient = new THREE.AmbientLight(colors.ambient, 0.5);
    lights.ambient.layers.enable(LAYER_EARTH);
    lights.ambient.layers.disable(LAYER_DEFAULT);
    scene.add(lights.ambient);

    lights.key = new THREE.DirectionalLight(colors.key, 0.8);
    lights.key.position.set(0, 0.5, 1);
    lights.key.layers.enableAll();
    scene.add(lights.key);

    lights.spot = new THREE.SpotLight('#fc6', 0.25, 100, Math.PI / 12, 0.5, 2);
    lights.spot.position.set(0, 5, 20);
    lights.spot.lookAt(0, 0, 0);
    lights.spot.shadow.mapSize.width = 1024;
    lights.spot.shadow.mapSize.height = 1024;
    lights.spot.layers.enableAll();
    // scene.add(lights.spot);

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
    // pivot.add(lights.fillTopEarth);
    // pivot.add(lights.fillBottomEarth);
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

// function initEffects() {
//     var renderScene = new THREE.RenderPass(scene, camera);
//     var bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
//     bloomPass.threshold = 0.21;
//     bloomPass.strength = 1.2;
//     bloomPass.radius = 0.55;
//     bloomPass.renderToScreen = true;
//     composer = new THREE.Effectcomposer(renderer);
//     composer.setSize(window.innerWidth, window.innerHeight);
//     composer.addPass(renderScene);
//     composer.addPass(bloomPass);
// }

function createEarth() {
    var geo = new THREE.IcosahedronGeometry(RADIUS_EARTH, 3);
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
        flatShading: true,
        // wireframe: true
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
        new THREE.MeshToonMaterial({ color: '#b7eb8f', transparent: true, opacity: 0 })
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

    ufo.position.setFromSphericalCoords(RADIUS_UFO_POS, UFO_PHI, UFO_THETA);
    ufo.rotation.x = 1;
    ufo.layers.set(LAYER_DEFAULT);
    scene.add(ufo);

    ufoOriginRotation = ufo.rotation.clone();

    initUfoMixer();
    initUfoIndicatorMixer();
}

function initUfoMixer() {
    ufoMixer = new THREE.AnimationMixer(ufo);
    var pos1 = ufo.position;
    var pos2 = getVectorFromSphCoord(RADIUS_UFO_POS + 0.35, UFO_PHI, UFO_THETA);
    var posTrack = new THREE.VectorKeyframeTrack(
        '.position',
        [0, 1],
        [pos1.x, pos1.y, pos1.z, pos2.x, pos2.y, pos2.z],
        // THREE.InterpolateSmooth
    );
    var clip = new THREE.AnimationClip('UfoIdle', 0.8, [posTrack]);
    ufoIdleAction = ufoMixer.clipAction(clip);
    ufoIdleAction.loop = THREE.LoopPingPong;
    ufoIdleAction.play();
}

function initUfoIndicatorMixer() {
    ufoIndicatorMixer = new THREE.AnimationMixer(ufoIndicator);
    var opacityTrack = new THREE.NumberKeyframeTrack('.material.opacity', [0, 1], [0, 1]);
    var clip = new THREE.AnimationClip('UfoIndicator', 1, [opacityTrack]);
    ufoIndicatorAction = ufoIndicatorMixer.clipAction(clip);
    ufoIndicatorAction.loop = THREE.LoopPingPong;
}

function initSpecimenPoints() {
    for (var i = 0; i < SPECIMENS_AMOUNT; ++i) {
        addSpecimenPoint(randRad(), randRad());
    }
}

function addSpecimenPoint(phi, theta) {
    specimenGroup.add(createPoint(phi, theta, 0x73d13d));
}

function addMedia(phi, theta) {
    var media = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 16, 16),
        new THREE.MeshBasicMaterial({ color: '#ff4d4f' })
    );
    media.position.setFromSphericalCoords(RADIUS_EARTH, phi, theta);
    mediaGroup.add(media);
}

function createPoint(phi, theta, color) {
    // var point = new THREE.Object3D();
    var geometry = new THREE.SphereGeometry(0.1, 16, 16);
    var material = new THREE.MeshBasicMaterial({ color });
    var point = new THREE.Mesh(geometry, material);
    point.position.setFromSphericalCoords(RADIUS_EARTH, phi, theta);
    return point;
}

function addPointToTrack() {
    var point = new THREE.Object3D();
    point.position.setFromSphericalCoords(RADIUS_EARTH, UFO_PHI, UFO_THETA);
    pivot.worldToLocal(point.position);
    track.add(point);
    if (track.children.length > MAX_TRACK_POINTS) {
        track.remove(track.children[0]);
    }
}

function calcMinSpecimenAngle() {
    return specimenGroup.children.reduce(function (min, item) {
        var angle = ufo.position.angleTo(item.localToWorld(new THREE.Vector3()));
        item.userData.angle = angle;
        return Math.min(min, angle);
    }, Infinity);
}

function createLand() {
    var mat = new THREE.MeshPhongMaterial({
        color: '#7ee48c',
        flatShading: true,
        // wireframe: true
    });

    var geo = new THREE.IcosahedronGeometry(RADIUS_LAND, 3);
    land = new THREE.Mesh(geo, mat);
    land.layers.set(LAYER_EARTH);
    pivot.add(land);

    landSurface = [];
    for (var i = 0; i < geo.vertices.length; ++i) {
        landSurface.push(1);
    }
    for (var i = 0; i < geo.vertices.length; ++i) {
        var vertex = geo.vertices[i];
        // Some random functions to calculate land and ocean
        if (
            vertex.x * vertex.x + vertex.y * vertex.y > 100
                && (vertex.x * vertex.y - vertex.z > 14)
            || vertex.y * vertex.x + vertex.y * vertex.z > 50
                && (vertex.y * vertex.x + vertex.y * vertex.z < 65)
            || vertex.x * vertex.z - vertex.y > 50
            || vertex.y * vertex.x - vertex.z < -20
        ) {
            geo.vertices[i].multiplyScalar(0.6);
        }
    }
    geo.verticesNeedUpdate = true;
}

function getNearestSpecimen() {
    return specimenGroup.children.reduce(function (a, b) {
        if (!a || b.userData.angle < a.userData.angle) return b;
        return a;
    }, null);
}

function createClouds() {
    // clouds = new THREE.Group();
    // pivot.add(clouds);
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
    // DEBUG
    stats.begin();
    // DEBUG END

    updateVelocity();
    updateMovement();

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

    var delta = clock.getDelta();
    updateEarth(delta * 1e3);
    updateClouds(delta * 1e3);
    updateUfo();

    updatePathLength();
    updateTrack();
    updateMedium();

    ufoMixer.update(delta);
    ufoIndicatorMixer.update(delta);

    // renderer.autoClear = false;
    renderer.clear();

    // camera.layers.set(LAYER_BLOOM);
    // composer.render();
    // renderer.clearDepth();

    camera.layers.set(LAYER_EARTH);
    renderer.render(scene, camera);
    camera.layers.set(LAYER_DEFAULT);
    renderer.render(scene, camera);

    // DEBUG
	stats.end();
    // DEBUG END

    requestAnimationFrame(animate);
}

function updateEarth(delta) {
    var vertices = earth.geometry.vertices;
    for (var i = 0; i < vertices.length; ++i) {
        var s = earthSurface[i];
        s.delta += delta * 0.002;
        var scale = Math.min(Math.sin(s.delta) * 0.06, RADIUS_LAND - RADIUS_EARTH - 0.1);
        vertices[i].set(
            s.x + scale,
            s.y + scale,
            s.z + scale
        );
    }
    earth.geometry.verticesNeedUpdate = true;
}

function updateClouds(delta) {
    // for (var i = 0; i < cloudsSurface.length; ++i) {
    //     cloudsSurface[i].delta += delta * 0.002;
    //     var scale = Math.sin(cloudsSurface[i].delta) * 0.06;
    //     clouds.children[i].scale.setScalar(1 + scale);
    // }
}

function updateVelocity() {
    // if (keys[32]) return;

    if (keys[87] /* W */ || keys[38] /* ArrowUp */) {
        if (angularVel.phi < ANGULAR_VEL) {
            angularVel.phi = Math.min(angularVel.phi + ANGULAR_ACC, ANGULAR_VEL);
        }
    } else if (keys[83] /* S */ || keys[40] /* ArrowDown */) {
        if (angularVel.phi > -ANGULAR_VEL) {
            angularVel.phi = Math.max(angularVel.phi - ANGULAR_ACC, -ANGULAR_VEL);
        }
    } else {
        if (angularVel.phi > 0) {
            angularVel.phi = Math.max(angularVel.phi - ANGULAR_ACC, 0);
        } else if (angularVel.phi < 0) {
            angularVel.phi = Math.min(angularVel.phi + ANGULAR_ACC, 0);
        }
    }

    if (keys[65] /* A */ || keys[37] /* ArrowLeft */) {
        if (angularVel.theta < ANGULAR_VEL) {
            angularVel.theta = Math.min(angularVel.theta + ANGULAR_ACC, ANGULAR_VEL);
        }
    } else if (keys[68] /* D */ || keys[39] /* ArrowRight */) {
        if (angularVel.theta > -ANGULAR_VEL) {
            angularVel.theta = Math.max(angularVel.theta - ANGULAR_ACC, -ANGULAR_VEL);
        }
    } else {
        if (angularVel.theta > 0) {
            angularVel.theta = Math.max(angularVel.theta - ANGULAR_ACC, 0);
        } else if (angularVel.theta < 0) {
            angularVel.theta = Math.min(angularVel.theta + ANGULAR_ACC, 0);
        }
    }
}

function updateMovement() {
    angularVel.phi && pivot.rotateOnWorldAxis(baseAxisX, angularVel.phi);
    angularVel.theta && pivot.rotateOnWorldAxis(baseAxisY, angularVel.theta);
}

function updateUfo() {
    updateUfoRotation();
    updateUfoActions();
    updateUfoIndicator();
}

function updateUfoRotation() {
    ufo.rotation.x = ufoOriginRotation.x - angularVel.phi * 30;
    ufo.rotation.z = ufoOriginRotation.z + angularVel.theta * 30;

    // camera.position.y = -angularVel.phi * 50;
    // camera.position.x = angularVel.theta * 50;
}

function updateUfoActions() {
    ufoIdleAction.paused = angularVel.phi || angularVel.theta;
}

function updateUfoIndicator() {
    var minSpecimenAngle = calcMinSpecimenAngle();
    const isRunning = ufoIndicatorAction.isRunning();
    if (minSpecimenAngle <= 0.5) {
        !isRunning && ufoIndicatorAction.play();
        ufoIndicatorAction.timeScale = 0.55 / (0.05 + minSpecimenAngle);
    } else {
        isRunning && ufoIndicatorAction.stop();
    }
}

function updatePathLength() {
    var vec = new THREE.Vector3();
    vec.setFromSphericalCoords(RADIUS_EARTH, UFO_PHI, UFO_THETA);
    var position = pivot.worldToLocal(vec);
    if (lastPosition) {
        pathLength += position.distanceTo(lastPosition);
    }
    lastPosition = position;
}

function updateTrack() {
    var now = Date.now();
    if (now - trackTime >= 3e3) {
        trackTime = now;
        addPointToTrack();
    }
}

function updateMedium() {
    if (track.children.length > MAX_MEDIUM) return;
    var key = Math.ceil(pathLength / 15);
    if (!trackMediaMap[key]) {
        var point = track.children[0];
        if (point) {
            var sph = new THREE.Spherical(RADIUS_EARTH);
            sph.setFromVector3(point.position);
            sph.phi += THREE.MathUtils.randFloatSpread(0.3);
            sph.theta += THREE.MathUtils.randFloatSpread(0.3);
            addMedia(sph.phi, sph.theta);
            track.remove(point);
        }
    }
    trackMediaMap[key] = true;
}

// DEBUG
function initDebug() {
    gui = new dat.GUI();

    var isNight = false;

    guiConfigs = Object.assign({}, colors);
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

    stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);
}
// DEBUG END


// ====== Utils ======

function getVectorFromSphCoord(radius, phi, theta) {
    var vec = new THREE.Vector3();
    vec.setFromSphericalCoords(radius, phi, theta);
    return vec;
}

function randRad() {
    return THREE.MathUtils.randFloatSpread(2 * Math.PI);
}

})();
