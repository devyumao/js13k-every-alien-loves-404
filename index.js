(function (THREE, window, document) {

// $$$_INJECT_VR_$$$

var getElementById = function (id) {
    return document.getElementById(id);
};

var STR_BLOCK = 'block';
var STR_NONE = 'none';

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
var MAX_TRACK_POINTS = 10;
var MAX_MEDIUM = 8;
var SPECIMEN_NEAR_THRES = 0.5;
var SPECIMEN_AVAILABLE_THRES = 0.045;
var CAMERA_DISTANT_Z = 20;
var CAMERA_CLOSE_Z = 15;
var CAMERA_ZOOM_VEL = (CAMERA_DISTANT_Z - CAMERA_CLOSE_Z) / 20;
var CAMERA_ROT_MAX_X = 0.36;
var CAMERA_ROT_MIN_X = 0;
var CAMERA_ROT_VEL = (CAMERA_ROT_MAX_X - CAMERA_ROT_MIN_X) / 20;
var CAMERA_STATES = {
    distant$: 0,
    close$: 1,
    zoomingIn$: 2,
    zoomingOut$: 3
};
var UFO_STATES = {
    idle$: 0,
    flying$: 1,
    increasingRay$: 2,
    reducingRay$: 3,
    raying$: 4,
    takingSpec$: 5,
    rayFailed$: 6
};
var GAME_STATES = {
    welcome$: 0, // display only once when web page loads
    welcomeEasingOut$: 1, // animation from welcom to inGame
    inGame$: 2,
    gameOverEasingIn$: 3,
    gameOver$: 4,
    gameOverEasingOut$: 5 // from gameOver to inGame
};
var isGameWin = 0; // should be used only when game over
var BEFORE_GAME_ANIMATION_DURATION = 3;
// DEBUG
// BEFORE_GAME_ANIMATION_DURATION = 0;
// DEBUG END
var GAME_OVER_ANIMATION_DURATION = 30;

var baseAxisX = new THREE.Vector3(1, 0, 0);
var baseAxisY = new THREE.Vector3(0, 1, 0);

// var resources = {
//     earthTexture: null
// };

var renderer, scene, sceneRTT, camera, cameraRTT, lights, vrControls;

var rtTexture, rtMesh;
var rttDprRatio = Math.max(2, Math.round(H / 250));
window.rttOn = true;

var uiCanvas, uiCtx;

// var composer;

var keys = [];

var pivot = new THREE.Group();
var earth, earthSurface;
var clouds, cloudsSurface;
var land, landSurface;
var comet;
var ufo = new THREE.Group();
var ufoRay, ufoIndicator, ufoLaser;

var cameraMixer, ufoMixer, ufoIndicatorMixer, ufoRayMixer;
var cameraShakeAction, ufoIdleAction, ufoIndicatorAction, ufoRayAction;

var track = new THREE.Group();
var pathLength = 0;
var lastPosition;
var trackMediaMap = {};
var angularVel = { phi: 0, theta: 0 };
var ufoOriginRotation;

var clock;
var trackTime;

var gameState = GAME_STATES.welcome$;
var cameraState = CAMERA_STATES.distant$;
var ufoState = UFO_STATES.idle$;

var cameraBeforeGamePosition = new THREE.Vector3(-50, -0.65, RADIUS_UFO_POS + 2);
var cameraInGamePosition = new THREE.Vector3(0, 0, CAMERA_DISTANT_Z);

var pivotInGamePosition = new THREE.Vector3(0, 0, 0);
var pivotGameOverPosition = new THREE.Vector3(-100, 0, -250);

var ufoBeforeGamePosition = new THREE.Vector3(-50, 0, RADIUS_UFO_POS);
var ufoInGamePosition = getVectorFromSphCoord(RADIUS_UFO_POS, UFO_PHI, UFO_THETA);
var ufoGameOverPosition = new THREE.Vector3(-3, 1, 16);

var inGameKeyPressed = false;

var colors = {
    primary: '#DD4391',
    'Bg Top': '#0e1a25',// '#912deb',
    'Bg Bottom': '#202731',// '#59b5e8',
    'Ambient': '#000',
    'Key': '#444',// '#ccc',
    'Sky A': '#297aa7',// '#2981a7',
    'Sky B': '#3434c0', //'#4629a7',
    'OceanLevels': ['#31d9d9', '#32c5d9', '#44a9c8', '#2694b9', '#067499'],
    'Land': '#9be889',
    'Change': function () {}
};

// $$$_INJECT_AUDIO_$$$

// DEBUG
var gui;
var guiConfigs;
var stats;
// DEBUG END


var specimens = {
    group$: new THREE.Group(),
    minAngle$: Infinity,
    near$: false,
    available$: false,
    targetItem$: null,

    init$() {
        pivot.add(this.group$);
        this.group$.layers.set(LAYER_EARTH);
        for (var i = 0; i < SPECIMENS_AMOUNT; ++i) {
            this.add$(randRad(), randRad());
        }
    },

    add$(phi, theta) {
        this.group$.add(createPoint(phi, theta, '#ffadd2'));
    },

    remove$(item) {
        this.group$.remove(item);
    },

    count$() {
        return this.group$.children.length;
    },

    update$() {
        this.minAngle$ = this.calcMinAngle$();
        this.near$ = this.minAngle$ <= SPECIMEN_NEAR_THRES;
        this.available$ = this.minAngle$ <= SPECIMEN_AVAILABLE_THRES;
        this.updateTargetItem$();
    },

    updateTargetItem$() {
        if (ufoState === UFO_STATES.takingSpec$ && this.available$ && !this.targetItem$) {
            this.targetItem$ = this.getNearest$();
            if (!this.targetItem$) return;
            var vec = new THREE.Vector3();
            vec.setFromSphericalCoords(RADIUS_EARTH, UFO_PHI, UFO_THETA);
            var pos = pivot.worldToLocal(vec);
            this.targetItem$.position.set(pos.x, pos.y, pos.z);
        }

        if (this.targetItem$) {
            const sph = new THREE.Spherical().setFromVector3(this.targetItem$.position);
            if (sph.radius < RADIUS_UFO_POS) {
                sph.radius += 0.02;
                this.targetItem$.position.setFromSpherical(sph);
            } else {
                this.remove$(this.targetItem$);
                this.targetItem$ = null;
            }
        }
    },

    calcMinAngle$() {
        return this.group$.children.reduce(function (min, item) {
            var angle = ufo.position.angleTo(item.localToWorld(new THREE.Vector3()));
            item.userData.angle = angle;
            return Math.min(min, angle);
        }, Infinity);
    },

    getNearest$() {
        return this.group$.children.reduce(function (a, b) {
            if (!a || b.userData.angle < a.userData.angle) return b;
            return a;
        }, null);
    }
};


var medium = {
    group$: new THREE.Group(),
    minAngle$: Infinity,
    targetItem$: null,
    popupsEl$: getElementById('p'),
    lastUpdated$: Date.now(),

    init$() {
        pivot.add(this.group$);
    },

    update$() {
        if (track.children.length <= MAX_MEDIUM) {
            var key = Math.ceil(pathLength / 15);
            if (!trackMediaMap[key]) {
                var point = track.children[0];
                if (point) {
                    var sph = new THREE.Spherical(RADIUS_EARTH);
                    sph.setFromVector3(point.position);
                    sph.phi += THREE.MathUtils.randFloatSpread(0.3);
                    sph.theta += THREE.MathUtils.randFloatSpread(0.3);
                    this.add$(sph.phi, sph.theta);
                    track.remove(point);
                }
            }
            trackMediaMap[key] = true;
        }

        this.updatePopups$();
    },

    updatePopups$() {
        var { popupsEl$ } = this;
        for (var i = 0; i < popupsEl$.children.length; ++i) {
            popupsEl$.children[i]._using = false;
        }

        var updateNumber = Date.now() - this.lastUpdated$ > 1e3;
        if (updateNumber) {
            this.lastUpdated$ = Date.now();
        }

        this.group$.children.forEach(function (media) {
            var pos = worldToScreen(media);
            // uiCtx.fillRect(pos.x / uiDprRatio, pos.y / uiDprRatio, 2, 2);
            var popup = media._popup;
            if (!popup) {
                popup = document.createElement('div');
                popup.setAttribute('class', 'p');
                popupsEl$.appendChild(popup);
                media._popup = popup;
                popup._media = media;
            }

            var width = popup.clientWidth;
            var height = popup.clientHeight;

            var style = popup.style;
            style.left = Math.round(pos.x - width / 2) + 'px';
            style.top = Math.round(pos.y - height) + 'px';
            style.opacity = pos.z < 0 ? 0.2 : 1;

            if (updateNumber && Math.random() > 0.8 || !popup.innerText) {
                // TODO: check media is not removed from mediaGroup

                if (media._viewed >= 1e6) {
                    const text = Math.round(media._viewed / 1e5) / 10 + 'M';
                    popup.setAttribute('class', 'p r');
                    popup.innerText = text + ' Viewed 🔥🔥🔥';
                }
                else if (media._viewed >= 1e3) {
                    const text = Math.round(media._viewed / 100) / 10 + 'K';
                    popup.setAttribute('class', 'p y');
                    popup.innerText = text + ' Viewed 🔥';
                }
                else {
                    popup.innerText = media._viewed + ' Viewed';
                }
                if (Math.random() > 0.95) {
                    // TODO: not so randomly
                    media._viewed += Math.ceil(Math.random() * 2e6);
                }
                else {
                    media._viewed += Math.ceil(Math.random() * media._maxV);
                }
            }

            popup._using = true;
        });

        for (var j = 0; j < popupsEl$.children.length; ++j) {
            var child = popupsEl$.children[j];
            if (!child._using) {
                popupsEl$.removeChild(child);
                child._media._popup = null;
            }
        }
    },

    add$(phi, theta) {
        var media = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 16, 16),
            new THREE.MeshBasicMaterial({ color: '#ff4d4f' })
        );
        media.position.setFromSphericalCoords(RADIUS_EARTH, phi, theta);

        media._viewed = Math.ceil(Math.random() * 10);
        media._maxV = Math.ceil(Math.random() * 1e3);

        medium.group$.add(media);
    }
};


var wiggler = {
    el$: getElementById('w'),
    targetEl$: getElementById('wt'),
    pointerEl$: getElementById('wp'),

    length$: 16,
    targetStart$: 0,
    targetEnd$: 0,
    pointerLength$: 0.3,

    result$: null,

    initData$() {
        this.targetStart$ = 6;
        this.targetEnd$ = 8;
    },

    checkResult$() {
        this.pointerEl$.style.animationPlayState = 'paused';
        var pointerPos = parseFloat(window.getComputedStyle(this.pointerEl$).left, 10) / window.innerHeight * 100;
        return pointerPos >= this.targetStart$ - this.pointerLength$
            && pointerPos <= this.targetEnd$;
    },

    update$() {
        switch (ufoState) {
            case UFO_STATES.raying$:
                this.el$.style.opacity = 1;
                if (!keys[32]) {
                    this.result$ = wiggler.checkResult$();
                }
                break;
            case UFO_STATES.idle$:
            case UFO_STATES.rayFailed$:
                this.el$.style.opacity = 0;
                this.pointerEl$.style.animationPlayState = 'running';
                break;
            // case UFO_STATES.rayFailed$:
            //     // FIXME:
            //     if (!failMsg.running) {
            //         this.el.style.opacity = 0;
            //         this.pointerEl.style.animationPlayStates = 'running';
            //     }
            //     break;
        }

        if (ufoState !== UFO_STATES.raying$) {
            wiggler.result$ = null;
        }
    }
}


var failMsg = {
    el$: getElementById('f'),
    _clock$: null,
    running$: false,

    update$() {
        switch (ufoState) {
            case UFO_STATES.rayFailed$:
                var el = this.el$;
                if (!el.className || el.className === 'o') {
                    this.running$ = true;
                    // el.style.transitionDuration = '0.15s';
                    el.className = 'i';
                    this._clock$ = Date.now();
                } else if (Date.now() - this._clock$ >= 1e3) {
                    // el.style.transitionDuration = '0';
                    el.className = 'o';
                    this.running$ = false;
                }
                break;
        }
    }
};


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

        pivot.add(track);
        scene.add(pivot);

        specimens.init$();
        medium.init$();

        initRenderer();

        clock = new THREE.Clock();

        window.addEventListener('resize', onWindowResize, false);

        initControl();

        vrControls = new THREE.VRControls(camera);

        updateGameState(GAME_STATES.welcome$);

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
    // ====== Main ======
    scene = new THREE.Scene();
    sceneRTT = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 1e6);
    // camera.position.z = CAMERA_DISTANT_Z;
    camera.layers.enable(LAYER_EARTH);

    initCameraMixer();

    var bg = new THREE.PlaneBufferGeometry(5e3, 2e3);
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
    bgMesh.position.z = -400;
    scene.add(bgMesh);



    // ====== RTT ======
    var width = W / rttDprRatio;
    var height = H / rttDprRatio;
    cameraRTT = new THREE.OrthographicCamera(
        width / - 2,
        width / 2,
        height / 2,
        height / - 2,
        -1e4,
        1e4
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

function initCameraMixer() {
    cameraMixer = new THREE.AnimationMixer(camera);
    var rotationTrack = new THREE.VectorKeyframeTrack(
        '.position',
        [0, 1],
        [
            0, 0, 20,
            1, -1, 20
        ]
    );
    var clip = new THREE.AnimationClip('CameraShake', 1, [rotationTrack]);
    cameraShakeAction = cameraMixer.clipAction(clip);
    // cameraShakeAction.repetitions = 10;
    // cameraShakeAction.loop = THREE.LoopPingPong;
    // cameraShakeAction.play();
}

function initLight() {
    lights = {};

    lights.ambient = new THREE.AmbientLight(colors.ambient, 0.7);
    lights.ambient.layers.enable(LAYER_EARTH);
    lights.ambient.layers.disable(LAYER_DEFAULT);
    scene.add(lights.ambient);

    lights.key = new THREE.DirectionalLight(colors.key, 0.5);
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

    lights.fillTop = new THREE.DirectionalLight('#888', 1);
    lights.fillTop.position.set(0.5, 1, 0.75);
    lights.fillBottom = new THREE.DirectionalLight('#555', 1);
    lights.fillBottom.position.set(-0.5, -1, -0.75);
    lights.fillTop.layers.enable(LAYER_DEFAULT);
    lights.fillBottom.layers.enable(LAYER_DEFAULT);
    lights.fillTop.layers.disable(LAYER_EARTH);
    lights.fillBottom.layers.disable(LAYER_EARTH);
    pivot.add(lights.fillTop);
    pivot.add(lights.fillBottom);
}

function initRenderer() {
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    Dpr = (window.devicePixelRatio) ? window.devicePixelRatio : 1;
    renderer.setPixelRatio(Dpr);
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0.0);
    renderer.xr.enabled = true;
    document.body.appendChild(renderer.domElement);

    // ====== UI ======
    uiCanvas = getElementById('u');
    uiCtx = uiCanvas.getContext('2d');

    onWindowResize();
}

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
        // new THREE.MeshPhongMaterial({ color: '#eee', shininess: 0.2 })
        new THREE.MeshToonMaterial({ color: '#bfbfbf' })
    );
    ufoCore.position.y = -0.05;
    ufo.add(ufoCore);

    var ufoPlate = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 0.25, 32),
        // new THREE.MeshPhongMaterial({ color: '#acacac', shininess: 0.2 })
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
        new THREE.ConeGeometry(0.45, 0.8, 32),
        new THREE.MeshToonMaterial({ color: '#faad14', transparent: true, opacity: 0.5 })
    );
    ufoRay.position.y = -0.35;
    ufoRay.scale.set(0, 0, 0);
    ufo.add(ufoRay);

    ufoLaser = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.76, 32),
        new THREE.MeshToonMaterial({ color: '#dd4491', transparent: true, opacity: 0.5 })
    );
    ufoLaser.position.y = -0.4;
    ufoLaser.scale.set(0, 0, 0);
    ufo.add(ufoLaser);

    ufo.position.set(...ufoInGamePosition.toArray());
    ufo.rotation.x = 1;
    ufo.layers.set(LAYER_DEFAULT);
    scene.add(ufo);

    ufoOriginRotation = ufo.rotation.clone();

    initUfoMixer();
    initUfoIndicatorMixer();
    initUfoRayMixer();
}

function initUfoMixer() {
    ufoMixer = new THREE.AnimationMixer(ufo);
    var pos1 = ufo.position;
    var pos2 = getVectorFromSphCoord(RADIUS_UFO_POS + 0.28, UFO_PHI, UFO_THETA);
    var posTrack = new THREE.VectorKeyframeTrack(
        '.position',
        [0, 0.8],
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
    ufoIndicatorAction.play();
}

function initUfoRayMixer() {
    ufoRayMixer = new THREE.AnimationMixer(ufoRay);
    ufoRayAction = ufoRayMixer.clipAction(
        new THREE.AnimationClip('UfoRay', 1.2, [
            new THREE.VectorKeyframeTrack(
                '.scale',
                [0, 1.2],
                [1, 1, 1, 0.5, 1, 0.5]
            )
        ])
    );
    ufoRayAction.loop = THREE.LoopPingPong;
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
            || (vertex.x - 50) * vertex.z - vertex.x * vertex.y * 8 < -500
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

    var R = 150;
    var r = 6;
    for (var i = 0; i < 3e3; ++i) {
        var mat = new THREE.MeshBasicMaterial({
            color: '#999',
            opacity: Math.random() * 0.5,
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

function createClouds() {
    clouds = new THREE.Group();
    pivot.add(clouds);

    var R = RADIUS_EARTH + 2;
    var mat = new THREE.MeshPhongMaterial({
        color: new THREE.Color('#fff'),
        flatShading: true
    });
    for (var cluster = 0; cluster < 40; ++cluster) {
        var cnt = 4;
        var phi = THREE.MathUtils.randFloatSpread(Math.PI * 2);
        var theta = THREE.MathUtils.randFloatSpread(Math.PI * 2);
        var scale = Math.random() * 0.5 + 0.8;
        for (var i = 0; i < cnt; ++i) {
            var r = [0.4, 0.6, 0.8, 0.4][i] + THREE.MathUtils.randFloatSpread(0.2);
            var geo = new THREE.IcosahedronGeometry(r * scale, 0);
            var mesh = new THREE.Mesh(geo, mat);
            phi += 0.04 + THREE.MathUtils.randFloatSpread(Math.PI * 0.03);
            var dR = THREE.MathUtils.randFloatSpread(0.1);
            mesh.position.setFromSphericalCoords(R + dR, phi, theta);
            mesh.rotation.set(
                THREE.MathUtils.randFloatSpread(Math.PI * 2),
                THREE.MathUtils.randFloatSpread(Math.PI * 2),
                THREE.MathUtils.randFloatSpread(Math.PI * 2)
            )
            mesh.layers.set(LAYER_EARTH);
            clouds.add(mesh);
        }
    }
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

    rtMesh.scale.x *= W / oldWidth;
    rtMesh.scale.y *= H / oldHeight;
    rtTexture.setSize(width, height);

    renderer.setSize(W, H);
    // composer.setSize(W, H);

    uiCanvas.width = W * Dpr;
    uiCanvas.height = H * Dpr;
    updateCanvas();
}

function initControl() {
    document.addEventListener('keydown', function (e) {
        // DEBUG
        // console.log('KEY CODE', e.keyCode);
        // DEBUG END

        keys[e.keyCode] = true;
        audio.playBg();

        var keyEnter = 13;
        var keySpace = 32;
        // TODO: add VR keys?
        var isKeyOk = [keyEnter, keySpace].indexOf(e.keyCode) > -1;

        if (gameState === GAME_STATES.welcome$) {
            if (isKeyOk) {
                updateGameState(GAME_STATES.welcomeEasingOut$);
            }
        }
        else if (gameState === GAME_STATES.inGame$) {
            if (!inGameKeyPressed) {
                inGameKeyPressed = true;
                trackTime = Date.now();
            }
        }
        else if (gameState === GAME_STATES.gameOverEasingIn$ || gameState === GAME_STATES.gameOver$) {
            if (isKeyOk) {
                updateGameState(GAME_STATES.gameOverEasingOut$);
            }
        }
    });
    document.addEventListener('keyup', function (e) {
        keys[e.keyCode] = false;
    });
}

function animate() {
    // DEBUG
    stats.begin();
    // DEBUG END

    var delta = clock.getDelta();
    if (gameState === GAME_STATES.inGame$) {
        updateCamera();

        updateVelocity();
        updateMovement();

        updateUfo();

        updatePathLength();
        updateTrack();

        specimens.update$();
        medium.update$();

        updateComet();

        wiggler.update$();
        failMsg.update$();

        cameraMixer.update(delta);
        ufoMixer.update(delta);
        ufoRayMixer.update(delta);
    }
    else if (gameState === GAME_STATES.welcomeEasingOut$) {
        updateBeforeGame(delta);
    }
    else if (gameState === GAME_STATES.gameOverEasingIn$) {
        updateGameOverEasingIn(delta);
    }

    updateEarth(delta * 1e3);
    updateClouds(delta * 1e3);
    ufoIndicatorMixer.update(delta);

    if (window.rttOn) {
        renderer.setRenderTarget(rtTexture);
        renderer.clear();
    }

    // camera.layers.set(LAYER_BLOOM);
    // composer.render();
    // renderer.clearDepth();

    vrControls.update();

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

    renderer.setAnimationLoop(animate);
}

function updateCamera() {
    const camPos = camera.position;
    const camRot = camera.rotation;
    if (keys[32] && ufoState !== UFO_STATES.reducingRay$) {
        if (camPos.z > CAMERA_CLOSE_Z) {
            camPos.z = Math.max(camPos.z - CAMERA_ZOOM_VEL, CAMERA_CLOSE_Z);
            cameraState = CAMERA_STATES.zoomingIn$;
        } else {
            cameraState = CAMERA_STATES.close$;
        }
        if (camRot.x < CAMERA_ROT_MAX_X) {
            camRot.x = Math.min(camRot.x + CAMERA_ROT_VEL, CAMERA_ROT_MAX_X);
        }
    } else if (ufoState === UFO_STATES.reducingRay$ || ufoState === UFO_STATES.idle$) {
        if (camPos.z < CAMERA_DISTANT_Z) {
            camPos.z = Math.min(camPos.z + CAMERA_ZOOM_VEL, CAMERA_DISTANT_Z);
            cameraState = CAMERA_STATES.zoomingOut$;
        } else {
            cameraState = CAMERA_STATES.distant$;
        }
        if (camRot.x > CAMERA_ROT_MIN_X) {
            camRot.x = Math.max(camRot.x - CAMERA_ROT_VEL, CAMERA_ROT_MIN_X);
        }
    }
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
    clouds.rotation.x += delta * 2e-5;
    clouds.rotation.z += delta * 1.2e-5;

    clouds.children.forEach(function (child, i) {
        child.rotation.y += delta * 2e-4;
        child.rotation.x += delta * 1e-4;

        var s = earthSurface[i]; // use as random number here
        var scale = Math.sin(s.delta / 5 + i / 10) * 0.8 + 0.2;
        child.scale.setScalar(scale);
    });
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

function updateGameState(state, isWin) {
    gameState = state;

    var b = getElementById('b');
    var u = getElementById('u');

    function restart() {
        ufo._v = ufoInGamePosition.clone().sub(ufo.position)
            .divideScalar(BEFORE_GAME_ANIMATION_DURATION);

        camera._v = cameraInGamePosition.clone().sub(camera.position)
            .divideScalar(BEFORE_GAME_ANIMATION_DURATION);

        ufoIndicatorAction.stop();

        setTimeout(function () {
            updateGameState(GAME_STATES.inGame$);
        }, BEFORE_GAME_ANIMATION_DURATION * 1e3);
    }

    if (gameState === GAME_STATES.welcome$) {
        ufo.position.set(...ufoBeforeGamePosition.toArray());
        camera.position.set(...cameraBeforeGamePosition.toArray());
    }
    else if (gameState === GAME_STATES.welcomeEasingOut$) {
        var ui = getElementById('a');
        ui.parentNode.removeChild(ui);

        restart();
    }
    else if (gameState === GAME_STATES.gameOverEasingIn$) {
        pivot._v = pivotGameOverPosition.clone().sub(pivot.position)
            .divideScalar(GAME_OVER_ANIMATION_DURATION);

        ufo._v = ufoGameOverPosition.clone().sub(ufo.position)
            .divideScalar(GAME_OVER_ANIMATION_DURATION / 4);

        b.style.display = STR_BLOCK;
        u.style.display = STR_NONE;

        if (isWin) {
            b.className = 'w';
        }
        else {
            b.className = 'f';
        }

        setTimeout(function () {
            updateGameState(GAME_STATES.gameOver$);
        }, GAME_OVER_ANIMATION_DURATION * 1e3);
    }
    else if (gameState === GAME_STATES.gameOverEasingOut$) {
        b.style.display = STR_NONE;
        u.style.display = STR_BLOCK;

        restart();
    }
    else if (gameState === GAME_STATES.inGame$) {
        ufo.position.set(...ufoInGamePosition.toArray());
        camera.position.set(...cameraInGamePosition.toArray());
        pivot.position.set(...pivotInGamePosition.toArray());

        u.style.display = STR_BLOCK;
        updateCanvas();
    }
}

function updateBeforeGame(delta) {
    ufo.position.add(ufo._v.clone().multiplyScalar(delta));
    clamp(ufo.position, ufoBeforeGamePosition, ufoInGamePosition);
    camera.position.add(camera._v.clone().multiplyScalar(delta));
    clamp(camera.position, cameraBeforeGamePosition, cameraInGamePosition);
}

function updateGameOverEasingIn(delta) {
    ufo.position.add(ufo._v.clone().multiplyScalar(delta));
    clamp(ufo.position, ufoInGamePosition, ufoGameOverPosition);

    pivot.position.add(pivot._v.clone().multiplyScalar(delta));
    clamp(pivot.position, pivotInGamePosition, pivotGameOverPosition);
}

function clamp(obj, source, target) {
    ['x', 'y', 'z'].forEach(function (dim) {
        if (source[dim] > target[dim]) {
            obj[dim] = Math.max(obj[dim], target[dim]);
        }
        else {
            obj[dim] = Math.min(obj[dim], target[dim]);
        }
    });
}

function updateUfo() {
    // console.log(ufoState);
    updateUfoState();
    updateUfoRotation();
    updateUfoActions();
    updateUfoIndicator();
    updateUfoRay();
}

function updateUfoState() {
    switch (ufoState) {
        case UFO_STATES.idle$:
            if (angularVel.phi || angularVel.theta) {
                ufoState = UFO_STATES.flying$;
            } else if (keys[32] && cameraState === CAMERA_STATES.close$) {
                ufoState = UFO_STATES.increasingRay$;
            }
            break;
        case UFO_STATES.flying$:
            if (!angularVel.phi && !angularVel.theta) {
                ufoState = UFO_STATES.idle$;
            }
            break;
        case UFO_STATES.increasingRay$:
            if (keys[32]) {
                if (ufoRay.scale.y >= 1) {
                    if (specimens.available$) {
                        ufoState = UFO_STATES.raying$;
                        wiggler.initData$();
                    } else {
                        ufoState = UFO_STATES.rayFailed$;
                    }
                }
            } else {
                ufoState = UFO_STATES.reducingRay$;
            }
            break;
        case UFO_STATES.reducingRay$:
            if (ufoRay.scale.y <= 0) {
                ufoState = UFO_STATES.idle$;
            }
            break;
        case UFO_STATES.raying$:
            if (wiggler.result$ != null) {
                ufoState = wiggler.result$ ? UFO_STATES.takingSpec$ : UFO_STATES.rayFailed$;
            }
            break;
        case UFO_STATES.takingSpec$:
            if (ufoRay.scale.y <= 0) {
                ufoState = UFO_STATES.idle$;
            }
            break;
        case UFO_STATES.rayFailed$:
            if (!failMsg.running$) {
                ufoState = UFO_STATES.reducingRay$;
            }
            break;
    }
}

function updateUfoRotation() {
    ufo.rotation.x = ufoOriginRotation.x - angularVel.phi * 30;
    ufo.rotation.z = ufoOriginRotation.z + angularVel.theta * 30;

    // camera.position.y = -angularVel.phi * 50;
    // camera.position.x = angularVel.theta * 50;
}

function updateUfoActions() {
    ufoIdleAction.paused = ufoState !== UFO_STATES.idle$;
}

function updateUfoIndicator() {
    const isRunning = ufoIndicatorAction.isRunning();
    if (specimens.near$) {
        !isRunning && ufoIndicatorAction.play();
        // TODO: quadratic
        ufoIndicatorAction.timeScale = 0.55 / (0.05 + specimens.minAngle$);
    } else {
        isRunning && ufoIndicatorAction.stop();
    }
}

function updateUfoRay() {
    var scale;
    switch (ufoState) {
        case UFO_STATES.increasingRay$:
            scale = Math.min(ufoRay.scale.y + 0.03, 1);
            ufoRay.scale.set(scale, scale, scale);
            // !cameraZoomAction.isRunning() && cameraZoomAction.play();
            break;
        case UFO_STATES.reducingRay$:
            scale = Math.max(ufoRay.scale.y - 0.03, 0);
            ufoRay.scale.set(scale, scale, scale);
            break;
        case UFO_STATES.raying$:
            if (!ufoRayAction.isRunning()) {
                ufoRayAction.play();
            }
            break;
        case UFO_STATES.takingSpec$:
            pauseAction();
            scale = Math.max(ufoRay.scale.y - 0.02, 0);
            ufoRay.scale.set(scale, scale, scale);
            break;
        case UFO_STATES.rayFailed$:
            pauseAction();
            break;
    }

    function pauseAction() {
        if (ufoRayAction.isRunning()) {
            ufoRayAction.paused = true;
        }
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

function updateCanvas() {
    uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

    var margin = [20, 30];
    var textColor = '#ddd';
    drawText('DNA Samples Collected (4/10)', margin[0], margin[1], textColor, 16);

    var radius = 9;
    var d = radius * 2;
    var circleMargin = 4;
    var circleTop = 42;
    var collectedCount = 4;
    var emptyColor = 'rgba(200,200,200,.1)';
    for (var i = 0; i < 10; ++i) {
        var color = i < collectedCount ? colors.OceanLevels[0] : emptyColor;
        drawCircle(margin[0] + (d + circleMargin) * i, circleTop, d, d, 2, color);
    }

    var barWidth = d * 10 + circleMargin * 9;
    var rightStart = W - margin[0] - barWidth;
    drawText('People Heard About Aliens', rightStart - 4, margin[1], textColor, 16);
    drawCircle(rightStart, circleTop, barWidth, 8, 2, emptyColor);

    var peoplePercent = 0.7;
    drawCircle(rightStart, circleTop, barWidth * peoplePercent, 8, 2, colors.primary, 1);

    function drawText(text, x, y, color, fontSize) {
        uiCtx.fillStyle = color;
        uiCtx.font = fontSize * Dpr + 'px Minecraft';
        uiCtx.fillText(text, x * Dpr, y * Dpr);
    }

    function drawCircle(x, y, w, h, borderRadius, color, noRightRadius) {
        uiCtx.fillStyle = color;
        var wSize = w * Dpr;
        var hSize = h * Dpr;
        uiCtx.fillRect(x * Dpr, y * Dpr, wSize, hSize);

        var x2 = x + w - borderRadius;
        var y2 = y + h - borderRadius;
        var d = borderRadius * Dpr;
        uiCtx.clearRect(x * Dpr, y * Dpr, d, d);
        uiCtx.clearRect(x * Dpr, y2 * Dpr, d, d);
        if (!noRightRadius) {
            uiCtx.clearRect(x2 * Dpr, y * Dpr, d, d);
            uiCtx.clearRect(x2 * Dpr, y2 * Dpr, d, d);
        }
    }
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

    // gui.hide();

    stats = new Stats();
    stats.showPanel(0);
    // document.body.appendChild(stats.dom);
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
    var z = pos.z;
    pos.project(camera);
    pos.x = (pos.x * widthHalf) + widthHalf;
    pos.y = - (pos.y * heightHalf) + heightHalf;
    pos.z = z;
    return pos;
}

})(THREE, window, document);
