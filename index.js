(function () {

var W = window.innerWidth;
var H = window.innerHeight;
var Dpr = 2;
var RADIUS_EARTH = 10;
var RADIUS_LAND = 10.1;
var RADIUS_OCEAN = 9.9;
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

var renderer, scene, sceneRTT, camera, cameraRTT, lights, colors;

var rtTexture, rtMesh;
var rttDprRatio = 4;
window.rttOn = true;

var uiCanvas, uiCtx;
uiDprRatio = 2;

// var composer;

var keys = [];

var pivot = new THREE.Group();
var earth, earthSurface;
var clouds, cloudsSurface;
var land, landSurface;
var comet;
var ufo = new THREE.Group();
var ufoRay;
var ufoIndicator;
var specimenGroup = new THREE.Group();
var mediaGroup = new THREE.Group();

var cameraMixer, ufoMixer, ufoIndicatorMixer;
var cameraZoomAction, ufoIdleAction, ufoIndicatorAction;

var track = new THREE.Group();
var pathLength = 0;
var lastPosition;
var trackMediaMap = {};
var angularVel = { phi: 0, theta: 0 };
var ufoOriginRotation;

var clock;
var trackTime = Date.now();

var colors = {
    'Bg Top': '#0e1a25',// '#912deb',
    'Bg Bottom': '#202731',// '#59b5e8',
    'Ambient': '#eee',
    'Key': '#fff',// '#ccc',
    'Sky A': '#297aa7',// '#2981a7',
    'Sky B': '#3434c0', //'#4629a7',
    'OceanLevels': ['#31d9d9', '#32c5d9', '#44a9c8', '#2694b9', '#067499'],
    'Land': '#9be889',
    'Change': function () {}
};

// DEBUG
var gui;
var guiConfigs;
var stats;
// DEBUG END

main();

function main() {
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
        createSky();
        createComet();

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

        updateUI();
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
    // ====== Main ======
    scene = new THREE.Scene();
    sceneRTT = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 1000);
    camera.position.z = 20;
    camera.layers.enable(LAYER_EARTH);

    cameraMixer = new THREE.AnimationMixer(camera);
    initCameraZoomAction();

    var bg = new THREE.PlaneBufferGeometry(500, 200);
    var bgMat = new THREE.ShaderMaterial({
        uniforms: {
            t: {
                value: new THREE.Color(colors['Bg Top'])
            },
            b: {
                value: new THREE.Color(colors['Bg Bottom'])
            }
        },
        vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: 'uniform vec3 t;uniform vec3 b;varying vec2 vUv;void main(){gl_FragColor = vec4(mix(t,b,vUv.y),1.0);}'
    });
    var bgMesh = new THREE.Mesh(bg, bgMat);
    bgMesh.position.z = -100;
    scene.add(bgMesh);



    // ====== RTT ======
    var width = W / rttDprRatio;
    var height = H / rttDprRatio;
    cameraRTT = new THREE.OrthographicCamera(
        width / - 2,
        width / 2,
        height / 2,
        height / - 2,
        -10000,
        10000
    );
    cameraRTT.position.z = 100;

    rtTexture = new THREE.WebGLRenderTarget(
        width,
        height,
        {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBFormat
        }
    );

    var plane = new THREE.PlaneBufferGeometry(width, height);
    var mat = new THREE.MeshBasicMaterial({
        map: rtTexture.texture
    });
    rtMesh = new THREE.Mesh(plane, mat);
    rtMesh.position.z = -100;
    sceneRTT.add(rtMesh);
}

function initCameraZoomAction() {
    var pos = camera.position;
    var posTrack = new THREE.VectorKeyframeTrack(
        '.position',
        [0, 1],
        [pos.x, pos.y, pos.z, pos.x, pos.y, 15]
    );
    var clip = new THREE.AnimationClip('CameraZoom', 1, [posTrack]);
    cameraZoomAction = cameraMixer.clipAction(clip);
    cameraZoomAction.loop = THREE.LoopOnce;
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
    lights.key.castShadow = true;
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
    Dpr = (window.devicePixelRatio) ? window.devicePixelRatio : 1;
    renderer.setPixelRatio(Dpr);
    renderer.setSize(W, H);
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0.0);
    document.body.appendChild(renderer.domElement);


    // ====== UI ======
    uiCanvas = document.getElementById('ui-canvas');
    width = W / uiDprRatio;
    height = H / uiDprRatio;
    uiCanvas.width = width;
    uiCanvas.height = height;

    uiCtx = uiCanvas.getContext('2d');
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
    var geo = new THREE.IcosahedronGeometry(RADIUS_OCEAN, 4);
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
        color: colors.OceanLevels[0],
        flatShading: true,
        vertexColors: true,
        shininess: 0.8,
        // wireframe: true
    });

    earth = new THREE.Mesh(geo, mat);
    earth.layers.set(LAYER_EARTH);
    earth.receiveShadow = true;
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
        color: colors.Land,
        flatShading: true,
        shininess: 0
        // wireframe: true
    });

    var geo = new THREE.IcosahedronGeometry(RADIUS_LAND, 4);
    land = new THREE.Mesh(geo, mat);
    land.layers.set(LAYER_EARTH);
    land.receiveShadow = true;
    pivot.add(land);

    var isVLeveled = {};
    var vLevel = [];
    for (var i = 0; i < geo.vertices.length; ++i) {
        var vertex = geo.vertices[i];
        // Some random functions to calculate land and ocean
        if (
            vertex.x * vertex.x + vertex.y * vertex.y > 100
                && (vertex.x * vertex.y - vertex.z > 14)
            || vertex.y * vertex.x + vertex.y * vertex.z > 50
                && (vertex.y * vertex.x + vertex.y * vertex.z < 65)
            || vertex.y * vertex.z * vertex.z - vertex.x * vertex.x < -300
            || vertex.x * vertex.z - vertex.x * vertex.y > 60
            || vertex.x - vertex.y + vertex.x * vertex.z > 55
            || vertex.x - (vertex.y + 50) * (vertex.z - 20) > 1400
                && vertex.y * vertex.x > 200
            || vertex.x * vertex.y - vertex.x < -50
            || (vertex.x - 50) * vertex.z - vertex.x * 3 < -500
            || vertex.y * vertex.y - vertex.z * 30 - vertex.y * 50 + vertex.x * 20 < -490
                && vertex.y > 6
            || vertex.z < -8 && vertex.x > 2
            || vertex.y * vertex.y - vertex.z + vertex.x * 10 > 110
        ) {
            // Ocean
            geo.vertices[i].multiplyScalar(0.6);
            vLevel.push(0);
        }
        else {
            // Land
            vLevel.push(1);
        }
    }

    landSurface = [];
    for (var i = 0; i < geo.faces.length; ++i) {
        var f = geo.faces[i];
        if (vLevel[f.a] && vLevel[f.b] && vLevel[f.c]) {
            // Land
            landSurface.push(5);
            isVLeveled[f.a] = 2;
            isVLeveled[f.b] = 2;
            isVLeveled[f.c] = 2;
        }
        else {
            landSurface.push(-10);
        }
    }

    for (var level = 1; level > -4; --level) {
        for (var i = 0; i < geo.faces.length; ++i) {
            var f = geo.faces[i];
            var la = isVLeveled[f.a] > level;
            var lb = isVLeveled[f.b] > level;
            var lc = isVLeveled[f.c] > level;
            if (!(la && lb && lc) && (la || lb || lc)) {
                // One of the vertices is adjcent to current level
                landSurface[i] = level;
                isVLeveled[f.a] = isVLeveled[f.a] == null ? level : Math.max(level, isVLeveled[f.a]);
                isVLeveled[f.b] = isVLeveled[f.b] == null ? level : Math.max(level, isVLeveled[f.b]);
                isVLeveled[f.c] = isVLeveled[f.c] == null ? level : Math.max(level, isVLeveled[f.c]);
            }
            else if (isVLeveled[f.a] >= level && isVLeveled[f.b] >= level) {
                landSurface[i] = Math.max(level, landSurface[i]);
            }
        }
    }

    landSurface.forEach(function (i, id) {
        earth.geometry.faces[id].color = new THREE.Color(
            i >= 1
                ? colors.OceanLevels[0]
                : colors.OceanLevels[Math.min(-i + 1, colors.OceanLevels.length - 1)]
        );
    });

    earth.geometry.colorsNeedUpdate = true;
    geo.verticesNeedUpdate = true;
}

function createSky() {
    var sky = new THREE.Group();
    pivot.add(sky);

    var R = 80;
    var r = 2.5;
    for (var i = 0; i < 2000; ++i) {
        var mat = new THREE.MeshBasicMaterial({
            color: '#999',
            opacity: Math.random(),
            transparent: true
        });
        var geo = new THREE.TetrahedronGeometry(Math.random(), 0);
        var mesh = new THREE.Mesh(geo, mat);

        var radius = R * (Math.random() * 2 + 1);
        var sph = new THREE.Spherical(radius);
        sph.phi = THREE.MathUtils.randFloatSpread(Math.PI * 2);
        sph.theta = THREE.MathUtils.randFloatSpread(Math.PI * 2);
        mesh.position.setFromSphericalCoords(radius, sph.phi, sph.theta);

        mesh.rotation.set(
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2,
            Math.random() * Math.PI * 2
        );

        mesh.scale.setScalar(THREE.MathUtils.randFloatSpread(r));

        sky.add(mesh);
    }
}

function createComet() {
    // console.log('create');
    // var R = 30;
    // var x = Math.random() * 10 + 0.01; // in case dividing by 0
    // var y = 10;
    // var z = R;
    // var angle = -Math.atan(x / y);

    // if (!comet) {
    //     var group = new THREE.Group();
    //     var cnt = 10;
    //     for (var i = 0; i < cnt; ++i) {
    //         var mat = new THREE.MeshBasicMaterial({
    //             color: '#cc6',
    //             opacity: 1 - i / 8,
    //             transparent: true
    //         });
    //         var geo = new THREE.TetrahedronGeometry(1, 0);
    //         var mesh = new THREE.Mesh(geo, mat);
    //         group.add(mesh);

    //         mesh.rotation.z = angle;
    //         mesh.position.x = i * x * 0.1;
    //         mesh.position.y = -i * y * 0.1;
    //         mesh.scale.setScalar(1 - i / cnt);
    //     }

    //     group.position.set(x, y, z);
    //     group.scale.setScalar(Math.random() * 2 + 4);
    //     pivot.add(group);

    //     comet = {
    //         mesh: group,
    //         offscreenDistance: R * 2,
    //         x: x,
    //         y: y,
    //         z: z
    //     };
    // }

    // var d = Math.sqrt(comet.x * comet.x + comet.y * comet.y);
    // var rand = THREE.MathUtils.randFloatSpread(1 / d);
    // comet.vx = -rand * comet.x;
    // comet.vy = rand * comet.y;
    // comet.vz = 0;
    // comet.delay = 0//25000 * Math.random() + 5000; // 5~30 seconds
    // comet.birth = Date.now();
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
    var oldWidth = W;
    var oldHeight = H;
    W = window.innerWidth;
    H = window.innerHeight;
    var width = W / rttDprRatio;
    var height = H / rttDprRatio;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    cameraRTT.left = width / - 2;
    cameraRTT.right = width / 2;
    cameraRTT.top = height / 2;
    cameraRTT.bottom = height / - 2;
    cameraRTT.updateProjectionMatrix();

    rtMesh.scale.x *= width / oldWidth;
    rtMesh.scale.y *= height / oldHeight;
    rtTexture.width = width;
    rtTexture.height = height;

    renderer.setSize(W, H);
    // composer.setSize(W, H);
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

    updateRay();

    var delta = clock.getDelta();
    updateEarth(delta * 1e3);
    updateClouds(delta * 1e3);
    updateUfo();

    updatePathLength();
    updateTrack();
    updateMedium();

    updateComet();

    updateUI();

    cameraMixer.update(delta);
    ufoMixer.update(delta);
    ufoIndicatorMixer.update(delta);

    if (window.rttOn) {
        renderer.setRenderTarget(rtTexture);
        renderer.clear();
    }

    // camera.layers.set(LAYER_BLOOM);
    // composer.render();
    // renderer.clearDepth();

    camera.layers.set(LAYER_EARTH);
    renderer.render(scene, camera);
    camera.layers.set(LAYER_DEFAULT);
    renderer.render(scene, camera);

    if (window.rttOn) {
        renderer.setRenderTarget(null);
        renderer.clear();
        renderer.render(sceneRTT, cameraRTT);
    }

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
        var scale = Math.min(Math.sin(s.delta) * 0.1, RADIUS_LAND - RADIUS_OCEAN - 0.1);
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
    if (keys[32]) {
        slowDownAngularVel('phi');
        slowDownAngularVel('theta');
        return;
    }

    if (keys[87] /* W */ || keys[38] /* ArrowUp */) {
        if (angularVel.phi < ANGULAR_VEL) {
            angularVel.phi = Math.min(angularVel.phi + ANGULAR_ACC, ANGULAR_VEL);
        }
    } else if (keys[83] /* S */ || keys[40] /* ArrowDown */) {
        if (angularVel.phi > -ANGULAR_VEL) {
            angularVel.phi = Math.max(angularVel.phi - ANGULAR_ACC, -ANGULAR_VEL);
        }
    } else {
        slowDownAngularVel('phi');
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
        slowDownAngularVel('theta');
    }
}

function slowDownAngularVel(phiOrTheta) {
    if (angularVel[phiOrTheta] > 0) {
        angularVel[phiOrTheta] = Math.max(angularVel[phiOrTheta] - ANGULAR_ACC, 0);
    } else if (angularVel[phiOrTheta] < 0) {
        angularVel[phiOrTheta] = Math.min(angularVel[phiOrTheta] + ANGULAR_ACC, 0);
    }
}

function updateMovement() {
    angularVel.phi && pivot.rotateOnWorldAxis(baseAxisX, angularVel.phi);
    angularVel.theta && pivot.rotateOnWorldAxis(baseAxisY, angularVel.theta);
}

function updateRay() {
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
    ufoIdleAction.paused = angularVel.phi || angularVel.theta || keys[32];
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

function updateComet() {
    // if (Date.now() > comet.birth + comet.delay) {
    //     console.log('fly');
    //     // flying
    //     comet.mesh.position.x += comet.vx;
    //     comet.mesh.position.y += comet.vy;
    //     comet.mesh.position.z += comet.vz;

    //     if (Math.abs(comet.mesh.position.x) > comet.offscreenDistance
    //         || Math.abs(comet.mesh.position.y) > comet.offscreenDistance
    //     ) {
    //         createComet();
    //     }
    // }
}

function updateUI() {
    uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

    uiCtx.fillStyle = '#00f';

    mediaGroup.children.forEach(function (media) {
        var pos = worldToScreen(media);
        uiCtx.fillRect(pos.x / uiDprRatio, pos.y / uiDprRatio, 2, 2);
    });
}

// DEBUG
function initDebug() {
    gui = new dat.GUI();

    var isNight = false;

    guiConfigs = Object.assign({}, colors);
    guiConfigs.Ocean0 = guiConfigs.OceanLevels[0];
    guiConfigs.Ocean1 = guiConfigs.OceanLevels[1];
    guiConfigs.Ocean2 = guiConfigs.OceanLevels[2];
    guiConfigs.Ocean3 = guiConfigs.OceanLevels[3];

    gui.addColor(guiConfigs, 'Bg Top')
        .onChange(function (val) {
            document.body.setAttribute(
                'style',
                'background:linear-gradient(90deg, '
                    + val + ' 0%, '
                    + guiConfigs['Bg Bottom'] + ' 100%);'
            );
        });
    gui.addColor(guiConfigs, 'Bg Bottom')
        .onChange(function (val) {
            document.body.setAttribute(
                'style',
                'background:linear-gradient(90deg, '
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

    [0, 1, 2, 3].forEach(function (x) {
        gui.addColor(guiConfigs, 'Ocean' + x)
            .onChange(function (val) {
                colors.OceanLevels[x] = val;

                landSurface.forEach(function (i, id) {
                    earth.geometry.faces[id].color = new THREE.Color(
                        i >= 1
                            ? colors.OceanLevels[0]
                            : colors.OceanLevels[-i + 1]
                    );
                });
                earth.geometry.colorsNeedUpdate = true;
                earth.geometry.elementsNeedUpdate = true;
            });
    });

    gui.addColor(guiConfigs, 'Land')
        .onChange(function (val) {
            land.material.color.set(val);
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

function worldToScreen(obj) {
    var widthHalf = W / 2;
    var heightHalf = H / 2;
    var pos = new THREE.Vector3();
    obj.getWorldPosition(pos);
    // console.log(pos.z); // TODO: may be used to know if is at back
    pos.project(camera);
    pos.x = (pos.x * widthHalf) + widthHalf;
    pos.y = - (pos.y * heightHalf) + heightHalf;
    return pos;
}

})();
