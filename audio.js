var AudioContext = window.AudioContext || window.webkitAudioContext;
var OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;

let zzfx,zzfxV,zzfxX,zzfxR

// ZzFXMicro - Zuper Zmall Zound Zynth
/*
  ZzFX MIT License

  Copyright (c) 2019 - Frank Force

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.

*/
zzfxV=.3    // volume
zzfx=       // play sound
(q=1,k=.05,c=220,e=0,t=0,u=.1,r=0,F=1,v=0,z=0,w=0,A=0,l=0,B=0,x=0,G=0,d=0,y=1,m=0,C=0)=>{let b=2*Math.PI,H=v*=500*b/zzfxR**2,I=(0<x?1:-1)*b/4,D=c*=(1+2*k*Math.random()-k)*b/zzfxR,Z=[],g=0,E=0,a=0,n=1,J=0,K=0,f=0,p,h;e=99+zzfxR*e;m*=zzfxR;t*=zzfxR;u*=zzfxR;d*=zzfxR;z*=500*b/zzfxR**3;x*=b/zzfxR;w*=b/zzfxR;A*=zzfxR;l=zzfxR*l|0;for(h=e+m+t+u+d|0;a<h;Z[a++]=f)++K%(100*G|0)||(f=r?1<r?2<r?3<r?Math.sin((g%b)**3):Math.max(Math.min(Math.tan(g),1),-1):1-(2*g/b%2+2)%2:1-4*Math.abs(Math.round(g/b)-g/b):Math.sin(g),f=(l?1-C+C*Math.sin(2*Math.PI*a/l):1)*(0<f?1:-1)*Math.abs(f)**F*q*zzfxV*(a<e?a/e:a<e+m?1-(a-e)/m*(1-y):a<e+m+t?y:a<h-d?(h-a-d)/u*y:0),f=d?f/2+(d>a?0:(a<h-d?1:(h-a)/d)*Z[a-d|0]/2):f),p=(c+=v+=z)*Math.sin(E*x-I),g+=p-p*B*(1-1E9*(Math.sin(a)+1)%2),E+=p-p*B*(1-1E9*(Math.sin(a)**2+1)%2),n&&++n>A&&(c+=w,D+=w,n=0),!l||++J%l||(c=D,v=H,n=n||1);q=zzfxX.createBuffer(1,h,zzfxR);q.getChannelData(0).set(Z);c=zzfxX.createBufferSource();c.buffer=q;c.connect(zzfxX.destination);c.start();return c}
zzfxX=new AudioContext // audio context
zzfxR=44100 // sample rate



var EFFECT_DNA = [,,290,.48,.1,.55,,.61,-0.3,-4.2,230,.02,.1,,.1,,,.77,.09,.34]; // Powerup 17
var EFEECT_FAIL = [,,37,,,.25,4,.4,,,,,,,,,,.61,.14]; // Random 264
var EFFECT_404 = [,,405,.11,.24,.98,2,.34,-1.2,,6,.07,.28,,,,,.64,.03]; // Powerup 174
var EFFECT_TWEET = [,,431,.04,.09,.37,,.76,-3.2,,,,,,,.1,,.98,.05]; // Jump 130

var SKIP_NOTE = -1;
var TRACK_ID_MELODY = 0;
var BEATS_PER_MINUTE = 10;
var BEAT_DURATION = 60 / BEATS_PER_MINUTE;
var SAMPLE_RATE = zzfxR;

var audio = {
    ctx: new AudioContext(),

    isReady: false,
    isMuted: false,

    playBg: playBg,
    playEffect: playEffect,

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

    var w = '4909';
    var imag = new Float32Array(w.length);
    var real = new Float32Array(w.length);
    for (var i = 0; i < w.length; ++i) {
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
            var audioSrc = audio.ctx.createBufferSource();
            audio._audioBg = audioSrc;
            audioSrc.buffer = renderedBuffer;
            audioSrc.connect(audio.ctx.destination);
            audioSrc.loop = true;

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

function playEffect(zzfxArr) {
    zzfx(... zzfxArr);
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
