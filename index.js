(function (THREE, window, document) {

try {

// $$$_INJECT_VR_$$$
// $$$_INJECT_EMOJI_$$$

var getElementById = function (id) {
    return document.getElementById(id);
};

var STR_BLOCK = 'block';
var STR_NONE = 'none';
var STR_DIV = 'div';
var STR_IMG = 'img';
var COLOR_WHITE = '#fff';

var W = window.innerWidth;
var H = window.innerHeight;
var Dpr = 2;
var RADIUS_EARTH = 10;
var RADIUS_LAND = 10.1;
var RADIUS_OCEAN = 9.8;
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
    rayFailed$: 6,
    increasingLaser$: 7,
    reducingLaser$: 8,
    lasing$: 9,
    laseCompleted$: 10
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
BEFORE_GAME_ANIMATION_DURATION = 0;
// DEBUG END
var GAME_OVER_ANIMATION_DURATION = 60;

var baseAxisX = new THREE.Vector3(1, 0, 0);
var baseAxisY = new THREE.Vector3(0, 1, 0);

var minScale = new THREE.Vector3(0, 0, 0);
var maxScale = new THREE.Vector3(1, 1, 1);

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
var clouds;
var land, landSurface;
var ufo = new THREE.Group();
var ufoRay, ufoIndicator, ufoLaser;

var ufoMixer, ufoIndicatorMixer, ufoRayMixer, ufoLaserMixer;
var ufoIdleAction, ufoIndicatorAction, ufoRayAction, ufoLaserAction;

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
    primary$: '#DD4391',
    bgTop$: '#0e1a25',
    bgBottom$: '#202731',
    oceanLevels$: ['#31d9d9', '#32c5d9', '#44a9c8', '#2694b9', '#067499'],
    land$: '#9be889'
};

var tweetList = [];

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
        var point = createPoint(phi, theta, '#ffadd2');
        point.visible = false;
        this.group$.add(point);
    },

    remove$(item) {
        this.group$.remove(item);
    },

    count$() {
        return this.group$.children.length;
    },

    update$() {
        this.minAngle$ = calcMinAngle(this.group$.children);
        this.near$ = this.minAngle$ <= SPECIMEN_NEAR_THRES;
        this.available$ = this.minAngle$ <= SPECIMEN_AVAILABLE_THRES;
        this.updateTargetItem$();
    },

    updateTargetItem$() {
        if (ufoState === UFO_STATES.takingSpec$ && this.available$ && !this.targetItem$) {
            this.targetItem$ = getNearest(this.group$.children);
            if (!this.targetItem$) return;
            var vec = new THREE.Vector3();
            vec.setFromSphericalCoords(RADIUS_EARTH, UFO_PHI, UFO_THETA);
            var pos = pivot.worldToLocal(vec);
            this.targetItem$.position.set(pos.x, pos.y, pos.z);
            this.targetItem$.visible = true;
        }

        if (this.targetItem$) {
            const sph = new THREE.Spherical().setFromVector3(this.targetItem$.position);
            if (sph.radius < RADIUS_UFO_POS) {
                sph.radius += 0.02;
                this.targetItem$.position.setFromSpherical(sph);
            } else {
                this.remove$(this.targetItem$);
                this.targetItem$ = null;
                updateCanvas();
            }
        }
    }
};


var medium = {
    group$: new THREE.Group(),
    minAngle$: Infinity,
    targetItem$: null,
    popupsEl$: getElementById('p'),
    lastUpdated$: Date.now(),
    progress$: {
        _clock$: null,
        running$: false,
        result$: null,
    },

    init$() {
        this.group$.layers.set(LAYER_EARTH);
        pivot.add(this.group$);
        // this.add$(UFO_PHI, UFO_THETA); // FIXME: temp
    },

    add$(phi, theta) {
        var media = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 16, 16),
            new THREE.MeshToonMaterial({ color: '#ff4d4f', transparent: true, opacity: 0.5 })
        );
        media.position.setFromSphericalCoords(RADIUS_EARTH, phi, theta);

        media._viewed = Math.ceil(Math.random() * 10);
        media._maxV = Math.ceil(Math.random() * 1e3);

        media._p = createElement(STR_DIV, this.popupsEl$, 'p');;

        medium.group$.add(media);
    },

    remove$(item) {
        this.popupsEl$.removeChild(item._p)
        item._p = null;
        this.group$.remove(item);
    },

    update$() {
        if (track.children.length <= MAX_MEDIUM) {
            var key = Math.ceil(pathLength / 15);
            if (!trackMediaMap[key]) {
                var point = track.children[0];
                if (point) {
                    var sph = new THREE.Spherical(RADIUS_EARTH);
                    sph.setFromVector3(point.position);
                    sph.phi += THREE.MathUtils.randFloatSpread(1);
                    sph.theta += THREE.MathUtils.randFloatSpread(1);
                    this.add$(sph.phi, sph.theta);
                    track.remove(point);
                }
            }
            trackMediaMap[key] = true;
        }

        this.minAngle$ = calcMinAngle(this.group$.children);
        this.updateTargetItem$();
        this.updatePopups$();
    },

    updateTargetItem$() {
        this.targetItem$ = this.minAngle$ < 0.02 ? getNearest(this.group$.children) : null;
        if (ufoState === UFO_STATES.lasing$) {
            var progress = this.progress$;
            if (keys[32]) {
                if (!progress.running$) {
                    this.runProgress$();
                } else if (Date.now() - progress._clock$ >= 1e3) {
                    this.finishProgress$();
                }
            } else {
                this.stopProgress$();
            }
        }
    },

    runProgress$() {
        var { progress$, targetItem$ } = this;
        progress$.running$ = true;
        targetItem$._p.classList.add('l');
        progress$._clock$ = Date.now();
    },

    stopProgress$() {
        var { progress$, targetItem$ } = this;
        targetItem$._p.classList.remove('l');
        progress$.running$ = false;
        progress$.result$ = false;
    },

    finishProgress$() {
        var { progress$, targetItem$ } = this;
        progress$.running$ = false;
        progress$.result$ = true;
        targetItem$._p.classList.add('f');
        targetItem$.visible = false;
        targetItem$._d = true;
        setTimeout(() => this.remove$(targetItem$), 3e3);
    },

    updatePopups$() {
        var updateNumber = Date.now() - this.lastUpdated$ > 1e3;
        if (updateNumber) {
            this.lastUpdated$ = Date.now();
        }

        this.group$.children.forEach(function (media) {
            var pos = worldToScreen(media);
            // uiCtx.fillRect(pos.x / uiDprRatio, pos.y / uiDprRatio, 2, 2);
            var popup = media._p;
            var { style } = popup;
            style.left = Math.round(pos.x) + 'px';
            style.top = Math.round(pos.y + 10) + 'px';
            style.opacity = pos.z < 5 ? 0.2 : 1;

            if (!media._d && updateNumber && Math.random() > 0.8 || !popup.innerText) {
                // TODO: check media is not removed from mediaGroup

                if (media._viewed >= 1e6) {
                    const text = Math.round(media._viewed / 1e5) / 10 + 'M';
                    popup.setAttribute('class', 'p r');
                    popup.innerText = text + ' VIEWED';
                }
                else if (media._viewed >= 1e3) {
                    const text = Math.round(media._viewed / 100) / 10 + 'K';
                    popup.setAttribute('class', 'p y');
                    popup.innerText = text + ' VIEWED';
                }
                else {
                    popup.innerText = media._viewed + ' VIEWED';
                }
                if (Math.random() > 0.95) {
                    // TODO: not so randomly
                    media._viewed += Math.ceil(Math.random() * 2e6);
                }
                else {
                    media._viewed += Math.ceil(Math.random() * media._maxV);
                }
            }
        });
    }
};

function calcMinAngle(children) {
    return children.reduce(function (min, item) {
        var angle = ufo.position.angleTo(item.localToWorld(new THREE.Vector3()));
        item.userData.angle = angle;
        return Math.min(min, angle);
    }, Infinity);
}

function getNearest(children) {
    return children.reduce(function (a, b) {
        if (!b._d && (!a || b.userData.angle < a.userData.angle)) {
            return b;
        }
        return a;
    }, null);
}

var wiggler = {
    el$: getElementById('w'),
    targetEl$: getElementById('wt'),
    pointerEl$: getElementById('wp'),

    length$: 16,
    targetStart$: 0,
    targetEnd$: 0,
    pointerLength$: 0.3,

    result$: null,

    initData$(angle) {
        var targetLen = 0.6 + 0.06 / (0.02 + angle);
        this.targetStart$ = (this.length$ - targetLen) / 2;
        this.targetEnd$ = this.length$ - this.targetStart$;
        var style = this.targetEl$.style;
        style.marginLeft = this.targetStart$ + 'vh';
        style.width = targetLen + 'vh';
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
                    this.result$ = this.checkResult$();
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
        if (ufoState === UFO_STATES.rayFailed$) {
            var el = this.el$;
            if (!el.className || el.className === 'o') {
                this.running$ = true;
                el.className = 'i';
                this._clock$ = Date.now();
            } else if (Date.now() - this._clock$ >= 1e3) {
                el.className = 'o';
                this.running$ = false;
            }
        }
    }
};


main();

function main() {
    // DEBUG
    initDebug();
    // DEBUG END

    initEmoji();

    initScene();
    initLight();

    createEarth();
    createUfo();
    createClouds();
    createLand();
    createSky();

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
}

function initScene() {
    // ====== Main ======
    scene = new THREE.Scene();
    sceneRTT = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(75, W / H, 0.1, 1e6);
    // camera.position.z = CAMERA_DISTANT_Z;
    camera.layers.enable(LAYER_EARTH);

    var bg = new THREE.PlaneBufferGeometry(5e3, 2e3);
    var bgMat = new THREE.ShaderMaterial({
        uniforms: {
            t: {
                value: new THREE.Color(colors.bgTop$)
            },
            b: {
                value: new THREE.Color(colors.bgBottom$)
            }
        },
        vertexShader: 'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: 'uniform vec3 t;uniform vec3 b;varying vec2 v;void main(){gl_FragColor = vec4(mix(t,b,v.y),1.0);}'
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

function initLight() {
    lights = {};

    lights.ambient = new THREE.AmbientLight(COLOR_WHITE, 0.7);
    lights.ambient.layers.enable(LAYER_EARTH);
    lights.ambient.layers.disable(LAYER_DEFAULT);
    scene.add(lights.ambient);

    lights.key = new THREE.DirectionalLight(COLOR_WHITE, 0.4);
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

// DEBUG
setTimeout(function () {
    appendTweet();
    appendTweet();
    appendTweet();
    appendTweet();
    appendTweet();

    var last = appendTweet();
    setTweet404(last);

    appendTweet();
    appendTweet();
    appendTweet();
}, 10000);
// DEBUG END

function showTweets() {
    var dom = document.getElementById('t');
    dom.style.display = STR_BLOCK;
}

function hideTweets() {
    var dom = document.getElementById('t');
    dom.style.display = STR_NONE;
}

function appendTweet() {
    var dom = document.getElementById('t');

    var tweet = createElement(STR_DIV, dom, 'T');

    var left = createElement(STR_DIV, tweet, 'l');

    var avatar = createElement(STR_IMG, left, 'a');
    avatar.setAttribute('src', getAvatar());

    var viewed = createElement(STR_DIV, left, 'v');
    viewed.innerText = '12K VIEWED';

    var right = createElement(STR_DIV, tweet, 'r');

    var name = createElement(STR_DIV, right, 'n');
    name.innerText = '@' + getRandomName();

    var content = createElement(STR_DIV, right, 'c');
    content.innerText = getRandomTweet();

    tweet.parentNode.scrollTop = tweet.offsetTop;

    tweetList.push(tweet);
    return tweet;
}

function setTweet404(dom) {
    dom.className = 'T TT';

    var viewed = dom.children[0].children[1];
    viewed.innerText = 'NA';

    var content = dom.children[1].children[1];
    content.innerText = '(404) NOT FOUND';

    dom.parentNode.scrollTop = dom.offsetTop;
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
        color: colors.oceanLevels$[0],
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

    var ufoPlate = new THREE.Mesh(
        new THREE.ConeGeometry(0.5, 0.25, 32),
        // new THREE.MeshPhongMaterial({ color: '#acacac', shininess: 0.2 })
        new THREE.MeshToonMaterial({ color: '#8c8c8c' })
    );

    ufoIndicator = new THREE.Mesh(
        new THREE.ConeGeometry(0.32, 0.16, 32),
        new THREE.MeshToonMaterial({ color: '#b7eb8f', transparent: true, opacity: 0 })
    );
    ufoIndicator.position.y = 0.047;

    ufoRay = new THREE.Mesh(
        new THREE.ConeGeometry(0.45, 0.8, 32),
        new THREE.MeshToonMaterial({ color: '#faad14', transparent: true, opacity: 0.5 })
    );
    ufoRay.position.y = -0.35;
    ufoRay.scale.set(0, 0, 0);

    ufoLaser = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.76, 32),
        new THREE.MeshToonMaterial({ color: '#dd4491', transparent: true, opacity: 0.5 })
    );
    ufoLaser.position.y = -0.4;
    ufoLaser.scale.set(0, 0, 0);

    ufo.position.set(...ufoInGamePosition.toArray());
    ufo.rotation.x = 1;
    ufo.layers.set(LAYER_DEFAULT);

    ufo.add(ufoCore, ufoPlate, ufoIndicator, ufoRay, ufoLaser);
    scene.add(ufo);

    ufoOriginRotation = ufo.rotation.clone();

    initUfoMixer();
    initUfoIndicatorMixer();
    initUfoRayMixer();
    initUfoLaserMixer();
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
    ufoIndicatorAction = ufoIndicatorMixer.clipAction(
        new THREE.AnimationClip('UfoIndicator', 1, [
            new THREE.NumberKeyframeTrack('.material.opacity', [0, 1], [0, 1])
        ])
    );
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

function initUfoLaserMixer() {
    ufoLaserMixer = new THREE.AnimationMixer(ufoLaser);
    ufoLaserAction = ufoLaserMixer.clipAction(
        new THREE.AnimationClip('UfoLaser', 0.3, [
            new THREE.VectorKeyframeTrack(
                '.scale',
                [0, 0.3],
                [1, 1, 1, 0.4, 1, 0.4]
            )
        ])
    );
    ufoLaserAction.loop = THREE.LoopPingPong;
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
        color: colors.land$,
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
                ? colors.oceanLevels$[0]
                : colors.oceanLevels$[Math.min(-i + 1, colors.oceanLevels$.length - 1)]
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
            opacity: Math.random() * 0.8,
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

function createClouds() {
    clouds = new THREE.Group();
    pivot.add(clouds);

    var R = RADIUS_EARTH + 2;
    var mat = new THREE.MeshPhongMaterial({
        color: new THREE.Color(COLOR_WHITE),
        flatShading: true
    });
    for (var cluster = 0; cluster < 50; ++cluster) {
        var cnt = 5;
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
        audio.playBg$();

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

        updateVelocity(delta);
        updateMovement();

        updateUfo(delta);

        updatePathLength();
        updateTrack();

        specimens.update$();
        medium.update$();

        wiggler.update$();
        failMsg.update$();

        ufoMixer.update(delta);
        ufoRayMixer.update(delta);
        ufoLaserMixer.update(delta);
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

function updateVelocity(delta) {
    var acc = ANGULAR_ACC * delta / 0.02;

    if (keys[32]) {
        slowDownAngularVel(acc, 'phi');
        slowDownAngularVel(acc, 'theta');
        return;
    }

    if (keys[87] /* W */ || keys[38] /* ArrowUp */) {
        if (angularVel.phi < ANGULAR_VEL) {
            angularVel.phi = Math.min(angularVel.phi + acc, ANGULAR_VEL);
        }
    } else if (keys[83] /* S */ || keys[40] /* ArrowDown */) {
        if (angularVel.phi > -ANGULAR_VEL) {
            angularVel.phi = Math.max(angularVel.phi - acc, -ANGULAR_VEL);
        }
    } else {
        slowDownAngularVel(acc, 'phi');
    }

    if (keys[65] /* A */ || keys[37] /* ArrowLeft */) {
        if (angularVel.theta < ANGULAR_VEL) {
            angularVel.theta = Math.min(angularVel.theta + acc, ANGULAR_VEL);
        }
    } else if (keys[68] /* D */ || keys[39] /* ArrowRight */) {
        if (angularVel.theta > -ANGULAR_VEL) {
            angularVel.theta = Math.max(angularVel.theta - acc, -ANGULAR_VEL);
        }
    } else {
        slowDownAngularVel(acc, 'theta');
    }
}

function slowDownAngularVel(acc, phiOrTheta) {
    if (angularVel[phiOrTheta] > 0) {
        angularVel[phiOrTheta] = Math.max(angularVel[phiOrTheta] - acc, 0);
    } else if (angularVel[phiOrTheta] < 0) {
        angularVel[phiOrTheta] = Math.min(angularVel[phiOrTheta] + acc, 0);
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

        hideTweets();

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
        showTweets();
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

function updateUfo(delta) {
    updateUfoState();
    updateUfoRotation();
    updateUfoActions();
    updateUfoIndicator();
    updateUfoRay(delta);
    updateUfoLaser(delta);
}

function updateUfoState() {
    switch (ufoState) {
        case UFO_STATES.idle$:
            if (angularVel.phi || angularVel.theta) {
                ufoState = UFO_STATES.flying$;
            } else if (keys[32] && cameraState === CAMERA_STATES.close$) {
                if (medium.targetItem$) {
                    ufoState = UFO_STATES.increasingLaser$;
                } else {
                    ufoState = UFO_STATES.increasingRay$;
                }
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
                        wiggler.initData$(specimens.minAngle$);
                    } else {
                        ufoState = UFO_STATES.rayFailed$;
                    }
                }
            } else {
                ufoState = UFO_STATES.reducingRay$;
            }
            break;
        case UFO_STATES.raying$:
            if (wiggler.result$ != null) {
                ufoState = wiggler.result$ ? UFO_STATES.takingSpec$ : UFO_STATES.rayFailed$;
            }
            break;
        case UFO_STATES.rayFailed$:
            if (!failMsg.running$) {
                ufoState = UFO_STATES.reducingRay$;
            }
            break;
        case UFO_STATES.takingSpec$:
        case UFO_STATES.reducingRay$:
            if (ufoRay.scale.y <= 0) {
                ufoState = UFO_STATES.idle$;
            }
            break;
        case UFO_STATES.increasingLaser$:
            if (keys[32]) {
                if (ufoLaser.scale.y >= 1) {
                    ufoState = UFO_STATES.lasing$;
                }
            } else {
                ufoState = UFO_STATES.reducingLaser$;
            }
            break;
        case UFO_STATES.lasing$:
            if (!medium.progress$.running$) {
                ufoState = UFO_STATES.reducingLaser$
            }
            break;
        case UFO_STATES.reducingLaser$:
            if (ufoLaser.scale.y <= 0) {
                ufoState = UFO_STATES.idle$;
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

function updateUfoRay(delta) {
    switch (ufoState) {
        case UFO_STATES.increasingRay$:
            updateScale(ufoRay, 0.6, delta);
            break;
        case UFO_STATES.reducingRay$:
            updateScale(ufoRay, 0.4, delta, true);
            break;
        case UFO_STATES.raying$:
            playAction(ufoRayAction);
            break;
        case UFO_STATES.takingSpec$:
            pauseAction(ufoRayAction);
            updateScale(ufoRay, 0.8, delta, true);
            break;
        case UFO_STATES.rayFailed$:
            pauseAction(ufoRayAction);
            break;
    }
}

function updateUfoLaser(delta) {
    switch (ufoState) {
        case UFO_STATES.increasingLaser$:
            updateScale(ufoLaser, 0.3, delta);
            break;
        case UFO_STATES.reducingLaser$:
            pauseAction(ufoLaserAction);
            updateScale(ufoLaser, 0.3, delta, true);
            break;
        case UFO_STATES.lasing$:
            playAction(ufoLaserAction);
            break;
    }
}

function updateScale(object, duration, delta, scaleDown) {
    if (!object._s) {
        var targetScale = scaleDown ? minScale : maxScale;
        object._s = targetScale.clone().sub(object.scale).divideScalar(duration);
    } else {
        object.scale
            .add(object._s.clone().multiplyScalar(delta))
            .clamp(minScale, maxScale);
        if (object.scale.equals(minScale) || object.scale.equals(maxScale)) {
            object._s = null;
        }
    }
}

function playAction(action) {
    if (!action.isRunning() || action.paused) {
        action.stop();
        action.play();
    }
}

function pauseAction(action) {
    if (!action.paused) {
        action.paused = true;
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

function updateCanvas() {
    uiCtx.clearRect(0, 0, uiCanvas.width, uiCanvas.height);

    var margin = [20, 30];
    var textColor = '#ddd';
    drawText(`DNA SAMPLES COLLECTED`, margin[0], margin[1], textColor, 16);

    var radius = 9;
    var d = radius * 2;
    var circleMargin = 4;
    var circleTop = 42;
    var collectedCount = SPECIMENS_AMOUNT - specimens.count$();
    var emptyColor = 'rgba(200,200,200,.1)';
    for (var i = 0; i < 10; ++i) {
        var color = i < collectedCount ? colors.oceanLevels$[0] : emptyColor;
        drawCircle(margin[0] + (d + circleMargin) * i, circleTop, d, d, 2, color);
    }

    var barWidth = d * 10 + circleMargin * 9;
    var rightStart = W - margin[0] - barWidth;
    drawText('PUBLIC PRESSURE', rightStart + 50, margin[1], textColor, 16);
    drawCircle(rightStart, circleTop, barWidth, 8, 2, emptyColor);

    var peoplePercent = 0.7;
    drawCircle(rightStart, circleTop, barWidth * peoplePercent, 8, 2, colors.primary$, 1);

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

function createElement(node, parent, className) {
    var dom = document.createElement(node);
    if (parent) {
        parent.appendChild(dom);
    }
    if (className) {
        dom.className = className;
    }
    return dom;
}

function getRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function getRandomName() {
    var names = ['ALICE', 'BOB', 'CAROL', 'DAVE', 'EVE', 'FRANK', 'GRACE', 'HEIDI'];
    var verbes = ['LOVES', 'HATES', 'MISSING', 'THE'];
    var nouns = ['CATS', 'DOGS', 'SLEEPING', 'OVILIA', 'YUMAO', 'YOU', 'JOKES', 'JS', 'GAMES'];
    return getRandom(names) + '_' + getRandom(verbes) + '_' + getRandom(nouns);
}

function getRandomTweet() {
    var preset = [
        'OMG!',
        'OH NO!',
        'OH SH*T...',
        'CAN YOU BELIEVE THIS?',
        'TELL ME I HAVEN\'T WOKEN UP FROM MY DREAM.',
        'ARE YOU KIDDING?',
        'YOU WON\'T BELIEVE THIS!',
        'I CAN\'T BELIEVE THIS EITHER... BUT',
        'I CAN\'T BELIEVE MY OWN EYES',
        '!!!',
        ''
    ]
    var list = [
        'THERE IS AN ALIEN IN MY BACKYARD?!!',
        'AN ALIEN IN THE DOWNTOWN!',
        'MY SON SAID THAT HE SAW AN ALIEN THIS MORNING. GUESS HOW OLD IS HE?',
        'GUESS WHAT/WHO I SAW TODAY!',
        'I SAW A UFO FLYING OVER MY HOUSE JUST NOW!',
        'WHAT\'T THE *THING* FLYING OVER ME JUST NOW???',
        'WAS IT AN ALIENE OR AEROPLANE?'
    ];
    return getRandom(preset) + ' ' + getRandom(list);
}

} catch (e) {
    // DEBUG
    console.error('Catched error:', e);
    // DEBUG END
}

})(THREE, window, document);
