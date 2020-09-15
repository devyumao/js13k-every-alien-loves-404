THREE.VRButton = {

    createButton: function (renderer) {

        function showEnterVR( /*device*/) {

            var currentSession = null;

            function onSessionStarted(session) {

                session.addEventListener('end', onSessionEnded);

                renderer.xr.setSession(session);
                button.textContent = 'EXIT VR';

                currentSession = session;

            }

            function onSessionEnded( /*event*/) {

                currentSession.removeEventListener('end', onSessionEnded);

                button.textContent = 'ENTER VR';

                currentSession = null;

            }

            buttonStyle.display = '';

            buttonStyle.cursor = 'pointer';
            buttonStyle.left = 'calc(50% - 50px)';
            buttonStyle.width = '100px';

            button.textContent = 'ENTER VR';

            button.onmouseenter = function () {

                buttonStyle.opacity = '1.0';

            };

            button.onmouseleave = function () {

                buttonStyle.opacity = '0.5';

            };

            button.onclick = function () {

                if (currentSession === null) {

                    // WebXR's requestReferenceSpace only works if the corresponding feature
                    // was requested at session creation time. For simplicity, just ask for
                    // the interesting ones as optional features, but be aware that the
                    // requestReferenceSpace call will fail if it turns out to be unavailable.
                    // ('local' is always available for immersive sessions and doesn't need to
                    // be requested separately.)

                    var sessionInit = { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] };
                    navigator.xr.requestSession('immersive-vr', sessionInit).then(onSessionStarted);

                } else {

                    currentSession.end();

                }

            };

        }

        function disableButton() {
            buttonStyle.display = '';

            buttonStyle.cursor = 'auto';
            buttonStyle.left = 'calc(50% - 75px)';
            buttonStyle.width = '150px';

            button.onmouseenter = null;
            button.onmouseleave = null;

            button.onclick = null;
        }

        function showWebXRNotFound() {
            disableButton();
            button.textContent = 'VR NOT SUPPORTED';
        }

        function stylizeElement(element) {
            var elementStyle = element.style;

            elementStyle.position = 'absolute';
            elementStyle.bottom = '20px';
            elementStyle.padding = '12px 6px';
            elementStyle.border = '1px solid #fff';
            elementStyle.borderRadius = '4px';
            elementStyle.background = 'rgba(0,0,0,.1)';
            elementStyle.color = '#fff';
            elementStyle.font = 'normal 13px sans-serif';
            elementStyle.textAlign = 'center';
            elementStyle.opacity = '0.5';
            elementStyle.outline = 'none';
            elementStyle.zIndex = '999';
        }

        if ('xr' in navigator) {

            var button = document.createElement('button');
            button.id = 'VRButton';
            var buttonStyle = button.style;
            buttonStyle.display = 'none';

            stylizeElement(button);

            navigator.xr.isSessionSupported('immersive-vr').then(function (supported) {

                supported ? showEnterVR() : showWebXRNotFound();

            });

            return button;

        }

    }

};
