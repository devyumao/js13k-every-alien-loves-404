var TUTORIAL = {
    NONE$: 0,
    ASDW$: 1,
    AFTER_ASDW$: 2,
    AFTER_DNA_NEAR$: 3,
    AFTER_DNA_AVAILABLE$: 4,
    AFTER_MEDIUM_APPEAR$: 5,
    AFTER_MEDIA$: 6,
    AFTER_MEDIA_CAUGHT$: 7,
    DONE$: 8
};

var tutorialState;
var tutorialCompleted = false;
var tutorialStepComplated = [];

function setTutorial(state) {
    if (tutorialCompleted) {
        return;
    }

    var dom = document.getElementById('r');

    tutorialState = state;

    var text = '';
    switch (state) {
        case TUTORIAL.NONE$:
        case TUTORIAL.DONE$:
            dom.style.display = 'none';
            return;

        case TUTORIAL.ASDW$:
            text = 'USE A/S/D/W TO MOVE AROUND.';
            break;

        case TUTORIAL.AFTER_ASDW$:
            text = 'YOUR MISSION IS TO FIND 10 DNA SAMPLES ON THE EARTH. IF ONE IS NEAR YOU, THE BLUE LIGHT ON YOUR FLYING SAUCER WILL BLINK FASTER AND THE RADAR AUDIO MAY ALSO HELP.';
            setTimeout(() => {
                tutorialStepComplated[TUTORIAL.AFTER_ASDW$] = 1;
            }, 6e3);
            break;

        case TUTORIAL.AFTER_DNA_NEAR$:
            text = 'FIND THE PLACE WHERE THE LIGHT BLINKS FASTEST AND THE AUDIO HAS THE HIGHEST FREQUENCY.';
            break;

        case TUTORIAL.AFTER_DNA_AVAILABLE$:
            text = 'HOLD SPACE AND RELEASE ON CORRECT MOMENT TO CATCH IT!';
            break;

        case TUTORIAL.AFTER_MEDIUM_APPEAR$:
            text = 'OOPS... YOU WERE WITNESSED BY HUMANS. IF TOO MANY PEOPLE KNOW ABOUT YOU, THE SECRET AGREEMENT WITH SEVERAL GOVERNMENTS THAT ALLOWS YOU TO COLLECT DNA WILL BE TERMINATED. SO, WATCH OUT FOR THE POPULARITY OF EACH TWEET AND MAKE IT 404 WHEN NECESSARY.';
            setTimeout(() => {
                tutorialStepComplated[TUTORIAL.AFTER_MEDIUM_APPEAR$] = 1;
            }, 6e3);
            break;

        case TUTORIAL.AFTER_MEDIA$:
            text = 'FLY OVER THE RED SPOT AND HOLD SPACE TO MAKE IT 404, THANKS TO THE GREAT TECHNOLOGY OF OUR THREE-BODY GALAXY.';
            break;

        case TUTORIAL.AFTER_MEDIA_CAUGHT$:
            text = 'GOOD JOB! NOW, COMPLETE YOUR GOAL OF COLLECTING 10 DNA SAMPLES. REMEMBER YOU ONLY HAVE TO MAKE THE TWEETS 404 WHEN NECESSARY. DON\'T WASTE TOO MUCH YOUR TIME ON IT.';
            setTimeout(() => {
                setTutorial(TUTORIAL.DONE$);
                tutorialCompleted = true;
            }, 6e3);
            break;
    }

    dom.innerText = text;
    dom.style.display = 'block';
}
