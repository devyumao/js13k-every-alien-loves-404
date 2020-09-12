THREE.VRControls = function (object) {

    var vrDisplay;

    var frameData = null;

    if ('VRFrameData' in window) {
        frameData = new VRFrameData();
    }

    function gotVRDisplays(displays) {
        if (displays.length > 0) {
            vrDisplay = displays[0];
        }
    }

    navigator.getVRDisplays && navigator.getVRDisplays().then(gotVRDisplays);

    this.update = function () {
        if (vrDisplay) {
            var pose;

            if (vrDisplay.getFrameData) {
                vrDisplay.getFrameData(frameData);
                pose = frameData.pose;
            } else if (vrDisplay.getPose) {
                pose = vrDisplay.getPose();
            }

            if (pose && pose.orientation !== null) {
                for (var i = 0; i < 3; ++i) {
                    pose.orientation[i] = Math.min(0.2, Math.max(-0.2, pose.orientation[i]));
                }
                object.quaternion.fromArray(pose.orientation);
            }
        }
    };

    this.resetPose = function () {
    	if ( vrDisplay ) {
    		vrDisplay.resetPose();
    	}
    };

    // this.dispose = function () {
    //     vrDisplay = null;
    // };
};
