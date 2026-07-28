// Tunables!
const defaults = {
    rectCount: 100,
    minRectWidth: .05,
    maxRectWidth: .2,
    polysPerCircle: 20,
    circleCount: 100,
    minCircleRadius: .05,
    maxCircleRadius: .2,
    maxRandVelComp: .01,
    density: 1,
    restitution: .5,
    pointerRadius: .03
};

// does not currently validate params!
const configFromQueryParams = (defaultConfig=defaults) => {
    const params = new URLSearchParams(window.location.search);

    const conf = {};
    for(const [tunable, defaultVal] of Object.entries(defaultConfig)) {
        conf[tunable] = +(params.get(tunable) ?? defaultVal);
    }
    console.log(conf)
    return conf;
};

export { defaults, configFromQueryParams };