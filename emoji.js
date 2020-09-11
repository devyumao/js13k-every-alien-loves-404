var emojis = [];
var lastEmojiId;

function initEmoji() {
    function createCanvas(width, height) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    var emojiSize = 64;
    var outSize = 16;
    var padding = 0;
    var dy = 4;
    var emojiBox = emojiSize + padding * 2;
    var emojiList = '👨‍🌾👩‍✈️👩‍🏫🕵️‍♀️👩‍💻👨‍🎨👩‍💼👨‍🚒🧙‍♂️👨‍🎓👨‍🚀🧛‍♂️👨‍🎤👷👨‍⚖️🧕';
    var emojiCount = 16;

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
        emojis.push(outCanvas.toDataURL());
    }
}

function getAvatar() {
    if (!lastEmojiId) {
        // first
        lastEmojiId = Math.floor(Math.random() * emojis.length);
    }

    ++lastEmojiId;
    if (lastEmojiId >= emojis.length) {
        lastEmojiId = 0;
    }
    return emojis[lastEmojiId];
}
