var emojiAvatars = [];
var lastEmojiAvatarId;

var emojiDnas = [];
var lastEmojiDnaId;

function initEmoji() {
    init('👨‍🌾👩‍✈️👩‍🏫🕵️‍♀️👩‍💻👨‍🎨👩‍💼👨‍🚒🧙‍♂️👨‍🎓👨‍🚀🧛‍♂️👨‍🎤👷👨‍⚖️🧕', 16, emojiAvatars);
    init('🐼🦋🦊🐶🌻🐷🐝🐔🐙🐡', 10, emojiDnas);

    function createCanvas(width, height) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    function init(emojiList, emojiCount, arr) {
        var emojiSize = 64;
        var outSize = 16;
        var padding = 0;
        var dy = 0;
        var emojiBox = emojiSize + padding * 2;

        var canvas = createCanvas(emojiBox * emojiCount, emojiBox);
        var ctx = canvas.getContext('2d');

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.font = emojiSize + 'px serif';

        ctx.fillText(emojiList, padding, padding + dy);

        var outCanvas = createCanvas(outSize, outSize);
        var outCtx = outCanvas.getContext('2d');
        var ratio = emojiBox / outSize;

        for (var i = 0; i < emojiCount; ++i) {
            outCtx.clearRect(0, 0, outSize, outSize);

            var pixels = ctx.getImageData(i * emojiBox, 0, emojiBox, emojiBox).data;

            var outData = ctx.createImageData(outSize, outSize);
            var outPixels = outData.data;
            for (var x = 0; x < outSize; ++x) {
                var xIn = Math.round((x) * ratio);
                for (var y = 0; y < outSize; ++y) {
                    var yIn = Math.round((y ) * ratio);
                    var inId = (yIn * emojiBox + xIn) * 4;
                    var outId = (y * outSize + x) * 4;
                    for (var c = 0; c < 4; ++c) {
                        outPixels[outId + c] = pixels[inId + c];
                    }
                }
            }
            outCtx.putImageData(outData, 0, 0);
            arr.push(outCanvas.toDataURL());
        }
    }
}

function getEmojiAvatar() {
    if (!lastEmojiAvatarId) {
        // first
        lastEmojiAvatarId = Math.floor(Math.random() * emojiAvatars.length);
    }

    ++lastEmojiAvatarId;
    if (lastEmojiAvatarId >= emojiAvatars.length) {
        lastEmojiAvatarId = 0;
    }
    return emojiAvatars[lastEmojiAvatarId];
}

function getEmojiDna() {
    if (!lastEmojiDnaId) {
        // first
        lastEmojiDnaId = Math.floor(Math.random() * emojiDnas.length);
    }

    ++lastEmojiDnaId;
    if (lastEmojiDnaId >= emojiDnas.length) {
        lastEmojiDnaId = 0;
    }
    return emojiDnas[lastEmojiDnaId];
}
