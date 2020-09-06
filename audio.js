var SKIP_NOTE = -1;
var TRACK_ID_MELODY = 0;
var BEATS_PER_MINUTE = 15;
var BEAT_DURATION = 60 / BEATS_PER_MINUTE;
var SAMPLE_RATE = 48000;
var AudioContext = window.AudioContext || window.webkitAudioContext;
var OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;

var audio = {
    ctx: new AudioContext(),

    isReady: false,
    isMuted: false,

    playBg: playBg,

    _audioBg: null,
    _isBgPlaying: false
};

init();

function init() {
    var canon = [7, 4, 5, 2, 3, 0, 3, 4];
    var getPattern = function (mapArr, octaveOffset) {
        octaveOffset = octaveOffset || 0;
        return canon.map(function (n) {
            return mapArr.map(function (d) {
                return n + 7 * octaveOffset + d;
            });
        });
    };

    var p0 = SKIP_NOTE;
    var p1 = getPattern([0], -3);
    var p2 = getPattern([0], -1);
    var p3 = getPattern([0], 0);
    var pa = {
        span: 2,
        pattern: p1
    };
    var pb = {
        span: 2,
        pattern: getPattern([0, 3], -3)
    };
    var pc = [[3, 0, -4]];

    var w = 'w999';
    var imag = new Float32Array(w.length);
    var real = new Float32Array(w.length);
    for (var i = 1; i < w.length; ++i) {
        imag[i] = w[i];
    }

    var tracks = [{
        // rhythm
        patterns: [pa, pb, pb, pb, pb, pc],
        volumn: 0.4,
        wave: w,
        maxOscillatorCnt: 3, // at most 3 notes at the same time
        envelope: {
            attack: 0.3,
            decay: 0.05,
            sustain: 0.05,
            release: 0.5,
            value: 0.9
        }
    }, {
        // melody
        patterns: [, , p3, p2, , , p2, p3, p2, p0],
        volumn: 0.1,
        envelope: {
            attack: 0,
            decay: 0.5,
            sustain: 0,
            release: 0.3,
            value: 1
        }
    }];

    var duration = 44 * BEAT_DURATION;
    var offCtx = new OfflineAudioContext(1, SAMPLE_RATE * duration, SAMPLE_RATE);
    var bgOscillators = [];
    var wave = offCtx.createPeriodicWave(real, imag);

    tracks.forEach(function (track, trackId) {
        var bgGainsTrack = [];
        var bgOscillatorsTrack = [];
        bgOscillators.push(bgOscillatorsTrack);

        var bgFacade = offCtx.createGain();
        bgFacade.gain.value = track.volumn || 1;
        bgFacade.gain.maxValue = 1;
        bgFacade.connect(offCtx.destination);

        var maxOscillatorCnt = track.maxOscillatorCnt || 1;
        for (var i = 0; i < maxOscillatorCnt; ++i) {
            var bgOscillator = offCtx.createOscillator();
            if (track.wave) {
                bgOscillator.setPeriodicWave(wave);
            }
            bgOscillatorsTrack.push(bgOscillator);

            var bgGain = offCtx.createGain();
            bgGainsTrack.push(bgGain);

            bgOscillator.connect(bgGain);
            bgGain.connect(bgFacade);
        }

        var time = 0;
        var envelope = track.envelope;
        for (var pId = 0; pId < track.patterns.length; ++pId) {
            var patterns = track.patterns[pId];
            if (patterns == undefined || patterns == SKIP_NOTE) {
                for (var oId = 0; oId < maxOscillatorCnt; ++oId) {
                    bgGainsTrack[oId].gain.setValueAtTime(0, time);
                }
                time += BEAT_DURATION * 4;
                continue;
            }

            var beatSpan = 1;
            if (patterns.span) {
                beatSpan = patterns.span;
                patterns = patterns.pattern;
            }
            patterns.forEach(function (beats, bId) {
                var ratio = 1 / beats.length;
                var beatDuration = BEAT_DURATION * beatSpan / patterns.length * 4;
                if (trackId === 0 && pId === tracks[0].patterns.length - 1) {
                    beatDuration /= 4;
                }
                var attack = envelope.attack * beatDuration;
                var decayStart = time + attack;
                var decay = envelope.decay * beatDuration;
                var sustainStart = decayStart + decay;
                var sustain = envelope.sustain * beatDuration;
                var sustainValue = envelope.value * ratio;
                var releaseStart = sustainStart + sustain;
                var release = envelope.release * beatDuration;

                for (var oId = 0; oId < maxOscillatorCnt; ++oId) {
                    if (oId < beats.length) {
                        var freq = getFreq(beats[oId]);
                        bgOscillatorsTrack[oId].frequency.setValueAtTime(freq, time);

                        var obj = bgGainsTrack[oId].gain;
                        var rampValue = trackId === 0
                            ? 'linearRampToValueAtTime'
                            : 'exponentialRampToValueAtTime';
                        obj.setValueAtTime(0, time);
                        obj[rampValue](ratio, decayStart);
                        obj[rampValue](sustainValue, sustainStart);
                        obj.setValueAtTime(sustainValue, releaseStart);
                        obj.linearRampToValueAtTime(0, releaseStart + release);
                    }
                    else {
                        // No sound at the moment, set gain value to be 0
                        bgGainsTrack[oId].gain.setValueAtTime(0, time);
                        bgGainsTrack[oId].gain.setValueAtTime(0, time + beatDuration);
                    }
                }
                time += beatDuration;
            });
        }
    });

    bgOscillators.forEach(function (os) {
        os.forEach(function (o) {
            o.start();
        });
    });

    offCtx.startRendering()
        .then(function (renderedBuffer) {
            audio._audioBg = audio.ctx.createBufferSource();
            audio._audioBg.buffer = renderedBuffer;

            audio._audioBg.connect(audio.ctx.destination);
            audio.isReady = true;
        })
        .catch(function (e) {
            // DEBUG
            console.error(e);
            // DEBUG END
        });
}

function playBg() {
    if (audio.isReady && !audio._isBgPlaying) {
        audio._audioBg.start();
        audio._isBgPlaying = true;
    }
}

function getFreq(note, octaveOffset) {
    octaveOffset = octaveOffset || 0;
    while (note <= 0) {
        --octaveOffset;
        note += 7;
    }
    while (note > 7) {
        ++octaveOffset;
        note -= 7;
    }

    const degree = [0, 2, 3, 5, 7, 8, 10][note - 1];
    return 440 * Math.pow(2, octaveOffset + degree / 12);
}
